import { Keypair, Transaction, VersionedTransaction } from "@solana/web3.js";
import type { Signer } from "./chain/program";
import fs from "node:fs";
import path from "node:path";

export type PersonaName = "alice" | "bob" | "carol" | "judge";

export interface PersonaSigner extends Signer {
  name: PersonaName;
  keypair: Keypair;
}

export interface PersonaVaultFile {
  alice: number[]; bob: number[]; carol: number[]; judge: number[];
}

export function personaVaultPath(): string {
  const p = process.env.DEMO_PERSONAS_PATH ?? "./data/demo-personas.json";
  return path.resolve(p);
}

export function loadPersonaVault(): PersonaVaultFile | null {
  const p = personaVaultPath();
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8")) as PersonaVaultFile;
}

export function savePersonaVault(vault: PersonaVaultFile): void {
  const p = personaVaultPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(vault, null, 2));
}

export function makePersonaSigner(name: PersonaName, keypair: Keypair): PersonaSigner {
  return {
    name,
    keypair,
    publicKey: keypair.publicKey,
    async signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T> {
      if (tx instanceof Transaction) { tx.partialSign(keypair); return tx; }
      (tx as VersionedTransaction).sign([keypair]);
      return tx;
    },
    async signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> {
      return Promise.all(txs.map((t) => this.signTransaction(t)));
    },
  };
}

export function loadPersonaSigners(): Record<PersonaName, PersonaSigner> | null {
  const vault = loadPersonaVault();
  if (!vault) return null;
  return {
    alice: makePersonaSigner("alice", Keypair.fromSecretKey(Uint8Array.from(vault.alice))),
    bob: makePersonaSigner("bob", Keypair.fromSecretKey(Uint8Array.from(vault.bob))),
    carol: makePersonaSigner("carol", Keypair.fromSecretKey(Uint8Array.from(vault.carol))),
    judge: makePersonaSigner("judge", Keypair.fromSecretKey(Uint8Array.from(vault.judge))),
  };
}

export function loadJudgeSigner(
  env: Record<string, string | undefined> = process.env,
): PersonaSigner | null {
  const encoded = env.JUDGE_PRIVATE_KEY_BASE64?.trim();
  if (encoded) {
    const secretKey = Buffer.from(encoded, "base64");
    if (secretKey.length !== 64) {
      throw new Error("judge_private_key_base64_invalid");
    }
    try {
      return makePersonaSigner(
        "judge",
        Keypair.fromSecretKey(new Uint8Array(secretKey)),
      );
    } catch {
      throw new Error("judge_private_key_base64_invalid");
    }
  }

  const vault = loadPersonaVault();
  if (!vault) return null;
  return makePersonaSigner(
    "judge",
    Keypair.fromSecretKey(Uint8Array.from(vault.judge)),
  );
}
