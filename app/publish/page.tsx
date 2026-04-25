"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { api } from "@/lib/api-client";
import { signMessage } from "@/lib/wallet";
import { LabeledBox } from "@/components/brutalist/LabeledBox";
import { Btn } from "@/components/brutalist/Btn";
import { PhantomSignPending } from "@/components/brutalist/PhantomSignPending";
import { TxStatus } from "@/components/brutalist/TxStatus";
import { getConnection } from "@/lib/chain/connection";
import { getChainConfig } from "@/lib/chain/config";
import { publishSkill } from "@/lib/chain/tx";

type TxState = "idle" | "signing" | "confirming" | "confirmed" | "error";

export default function PublishPage() {
  const w = useWallet();
  const wallet = w.publicKey?.toBase58() ?? null;
  const router = useRouter();
  const [signing, setSigning] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<TxState>("idle");
  const [txSig, setTxSig] = useState<string | undefined>();
  const [form, setForm] = useState({
    name: "",
    description: "",
    category: "code-review",
    content: DEFAULT_SKILL_MD,
    subscription_price_sol: 0.1,
    min_author_ratio_bps: 4000,
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!wallet) return alert("Connect Phantom first");
    setErr(null);
    setTxStatus("idle");
    setTxSig(undefined);

    try {
      setSigning("Approve Irys upload");
      const { signatureBase58: sig1 } = await signMessage(
        w,
        `SLP IRYS PUBLISH\nname: ${form.name}\nt: ${Date.now()}`
      );
      const upload = await api.uploadIrys(wallet, sig1, {
        content: form.content,
        tags: [
          { name: "Protocol", value: "SLP" },
          { name: "Type", value: "SkillContent" },
          { name: "Name", value: form.name },
        ],
      });
      setSigning(null);

      setTxStatus("signing");
      const { programId } = getChainConfig();
      const result = await publishSkill(getConnection(), w as any, {
        programId,
        name: form.name,
        description: form.description,
        category: form.category,
        content: form.content,
        arweaveTxId: upload.txId,
        subscriptionPriceLamports: BigInt(Math.floor(form.subscription_price_sol * LAMPORTS_PER_SOL)),
        minAuthorRatioBps: form.min_author_ratio_bps,
        k: 10,
        periodLengthSeconds: 300n,
      });
      setTxSig(result.sig);
      setTxStatus("confirmed");
      router.push(`/skill/${result.skillId}`);
    } catch (e: any) {
      setErr(e?.message ?? "publish failed");
      setTxStatus("error");
    } finally {
      setSigning(null);
    }
  }

  const { cluster } = getChainConfig();

  return (
    <div className="grid grid-cols-12 gap-6 pt-6">
      <header className="col-span-12 pb-2">
        <div className="caption mb-2">AUTHOR / PUBLISH</div>
        <h1 className="font-display text-display-2 uppercase">Publish a new skill</h1>
        <p className="font-serif text-lg mt-2 max-w-2xl">
          Your SKILL.md is encrypted via Lit and stored on Arweave via Irys. Subscribers can decrypt;
          the public market shows only metadata.
        </p>
      </header>

      <form className="col-span-12 lg:col-span-8 flex flex-col gap-4" onSubmit={onSubmit}>
        <LabeledBox title="METADATA" code="§ 1">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Name" hint="max 64 chars">
              <input className="plate w-full" required minLength={2} maxLength={64} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Category" hint="free text, displayed as chip">
              <input className="plate w-full" required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </Field>
            <Field label="Description" hint="max 256 chars" className="col-span-2">
              <textarea className="plate w-full" rows={3} required minLength={2} maxLength={256} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
          </div>
        </LabeledBox>
        <LabeledBox title="SKILL.md" code="§ 2">
          <textarea
            className="plate w-full font-mono text-xs min-h-[360px]"
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
          />
        </LabeledBox>
        <LabeledBox title="ECONOMICS" code="§ 3">
          <div className="grid grid-cols-2 gap-6">
            <Field label="Subscription price (SOL / 30d)" hint="recommend 0.01 – 0.5 SOL">
              <input
                type="number"
                step="0.01"
                min="0"
                className="plate w-full"
                value={form.subscription_price_sol}
                onChange={(e) => setForm({ ...form, subscription_price_sol: Number(e.target.value) })}
              />
            </Field>
            <Field label={`Author floor: ${(form.min_author_ratio_bps / 100).toFixed(0)}%`} hint="hard protocol minimum: 30%">
              <input
                type="range"
                min={3000}
                max={9500}
                step={50}
                value={form.min_author_ratio_bps}
                onChange={(e) => setForm({ ...form, min_author_ratio_bps: Number(e.target.value) })}
                className="w-full"
              />
            </Field>
          </div>
        </LabeledBox>

        {err ? <div className="plate text-accent">error: {err}</div> : null}
        <TxStatus status={txStatus} sig={txSig} cluster={cluster} error={err ?? undefined} />

        <div className="flex items-center gap-3">
          <Btn variant="primary" type="submit" disabled={!wallet}>
            {wallet ? "Sign & publish" : "Connect wallet to publish"}
          </Btn>
          <span className="caption">Phantom signs once · sends a real devnet tx</span>
        </div>
      </form>

      <aside className="col-span-12 lg:col-span-4">
        <LabeledBox title="PRINCIPLES" code="§ author">
          <ul className="font-mono text-xs leading-5 list-disc pl-4 text-ink/85">
            <li>Every subscriber starts at 0 shares. Only merit grows the pie.</li>
            <li>Your floor is protected: mints are capped so your ratio never drops below it.</li>
            <li>All decrypted content is gated by active subscription via Lit.</li>
            <li>Every judge report is permanently auditable on Arweave.</li>
          </ul>
        </LabeledBox>
      </aside>

      <PhantomSignPending open={!!signing} label={signing ?? ""} />
    </div>
  );
}

function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1 ${className ?? ""}`}>
      <span className="caption">{label}</span>
      {children}
      {hint ? <span className="text-[10px] font-mono text-muted">{hint}</span> : null}
    </label>
  );
}

const DEFAULT_SKILL_MD = `# My Skill v1.0

## Purpose

Describe what this skill helps an agent do.

## When to use
- Specific task / situation
- Another trigger

## Steps
1. ...
2. ...
3. ...

## Output format
- ...
`;
