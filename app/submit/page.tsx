"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { api } from "@/lib/api-client";
import { ExperienceBundleSchema } from "@/lib/schemas";
import { LabeledBox } from "@/components/brutalist/LabeledBox";
import { Btn } from "@/components/brutalist/Btn";
import { PhantomSignPending } from "@/components/brutalist/PhantomSignPending";
import { TxStatus } from "@/components/brutalist/TxStatus";
import { getConnection } from "@/lib/chain/connection";
import { getChainConfig } from "@/lib/chain/config";
import { submitExperience as chainSubmit, getNextExperienceId } from "@/lib/chain/tx";
import { signMessage } from "@/lib/wallet";

async function sha256Bytes(content: string): Promise<Uint8Array> {
  const buf = new TextEncoder().encode(content);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return new Uint8Array(digest);
}

export default function SubmitPage() {
  const w = useWallet();
  const wallet = w.publicKey?.toBase58() ?? null;
  const router = useRouter();
  const [text, setText] = useState("");
  const [signing, setSigning] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<"idle" | "signing" | "confirming" | "confirmed" | "error">("idle");
  const [txSig, setTxSig] = useState<string | undefined>();

  const validation = useMemo(() => {
    if (!text.trim()) return { ok: false as const, errors: [] as string[], bundle: null };
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch (e: any) {
      return { ok: false as const, errors: [`JSON parse: ${e.message}`], bundle: null };
    }
    const r = ExperienceBundleSchema.safeParse(parsed);
    if (!r.success) {
      return {
        ok: false as const,
        errors: r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
        bundle: null,
      };
    }
    return { ok: true as const, errors: [], bundle: r.data };
  }, [text]);

  async function onSubmit() {
    if (!wallet) return alert("Connect Phantom first");
    if (!validation.ok) return;
    const bundle = validation.bundle;
    const json = JSON.stringify(bundle);
    setErr(null);
    setTxStatus("idle");
    setTxSig(undefined);
    try {
      setSigning("Approve Irys upload");
      const { signatureBase58: sig1 } = await signMessage(w, `SLP IRYS SUBMIT\ntrace: ${bundle.trace_id}\nt: ${Date.now()}`);
      const upload = await api.uploadIrys(wallet, sig1, {
        content: json,
        tags: [
          { name: "Protocol", value: "SLP" },
          { name: "Type", value: "ExperienceBundle" },
          { name: "SkillId", value: bundle.skill_id },
        ],
      });
      setSigning(null);

      setTxStatus("signing");
      const { programId } = getChainConfig();
      const conn = getConnection();
      const skillPk = new PublicKey(bundle.skill_id);
      const nextExpId = await getNextExperienceId(conn, programId, skillPk);
      const contentHash = await sha256Bytes(json);
      const result = await chainSubmit(conn, w as any, {
        programId,
        skill: skillPk,
        nextExperienceId: nextExpId,
        contentHash,
        arweaveTxId: upload.txId,
        skillVersion: bundle.skill_version,
      });
      setTxSig(result.sig);
      setTxStatus("confirmed");
      router.push(`/me?tab=contributions&expId=${nextExpId.toString()}`);
    } catch (e: any) {
      setErr(e?.message ?? "submit failed");
      setTxStatus("error");
    } finally {
      setSigning(null);
    }
  }

  return (
    <div className="grid grid-cols-12 gap-6 pt-6">
      <header className="col-span-12 pb-2">
        <div className="caption mb-2">CONTRIBUTOR / SUBMIT</div>
        <h1 className="font-display text-display-2 uppercase">Submit an ExperienceBundle</h1>
        <p className="font-serif text-lg mt-2 max-w-2xl">
          Paste the JSON your Reflection Skill produced. Validate, sign twice, done. The AI Judge evaluates within ~3 seconds.
        </p>
      </header>

      <LabeledBox title="BUNDLE JSON" code="§ paste" className="col-span-12 lg:col-span-8">
        <textarea
          className="plate w-full font-mono text-xs min-h-[480px]"
          placeholder='paste your ExperienceBundle JSON here…'
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="mt-3 flex items-center gap-3">
          <Btn variant="primary" onClick={onSubmit} disabled={!validation.ok || !wallet}>
            {wallet ? "Sign & submit" : "Connect wallet to submit"}
          </Btn>
          <span className="caption">Irys upload · Phantom-signed devnet tx</span>
        </div>
        {err ? <div className="plate text-accent mt-3">error: {err}</div> : null}
        <TxStatus status={txStatus} sig={txSig} cluster={getChainConfig().cluster} error={err ?? undefined} />
      </LabeledBox>

      <aside className="col-span-12 lg:col-span-4 flex flex-col gap-4">
        <LabeledBox title="VALIDATION" code="§ zod">
          {text.trim() === "" ? (
            <div className="font-mono text-xs text-muted">waiting for paste…</div>
          ) : validation.ok ? (
            <div>
              <div className="caption mb-2 text-accent">VALID ✓</div>
              <ul className="font-mono text-xs flex flex-col gap-1">
                <li>skill: <span className="text-ink">{validation.bundle.skill_id}</span></li>
                <li>version: <span className="text-ink">{validation.bundle.skill_version}</span></li>
                <li>trace: <span className="text-ink">{validation.bundle.trace_id}</span></li>
                <li>trajectory steps: {validation.bundle.trajectory.length}</li>
              </ul>
            </div>
          ) : (
            <ul className="font-mono text-xs flex flex-col gap-1 text-accent">
              {validation.errors.slice(0, 8).map((e, i) => (
                <li key={i}>✗ {e}</li>
              ))}
            </ul>
          )}
        </LabeledBox>
        <LabeledBox title="SCORING" code="§ judge">
          <div className="font-mono text-[11px] leading-5">
            Five dimensions, 0–10 each:
            <ul className="list-disc pl-4 mt-1 text-ink/85">
              <li>Novelty ×1.2</li>
              <li>Specificity ×1.0</li>
              <li>Actionability ×1.2</li>
              <li>Reproducibility ×0.8</li>
              <li>Impact ×0.8</li>
            </ul>
            Shares minted = <span className="text-accent">score × 10</span>, capped by author floor.
          </div>
        </LabeledBox>
      </aside>

      <PhantomSignPending open={!!signing} label={signing ?? ""} />
    </div>
  );
}
