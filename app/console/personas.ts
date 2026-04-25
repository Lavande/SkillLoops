"use client";

import { Keypair, Transaction, VersionedTransaction } from "@solana/web3.js";
import type { Signer } from "@/lib/chain/program";

export type PersonaName = "alice" | "bob" | "carol" | "judge";

export interface PersonaSigner extends Signer {
  name: PersonaName;
  keypair: Keypair;
}

export type PersonaPubkeys = Record<PersonaName, string>;
export type PersonaSigners = Record<PersonaName, PersonaSigner>;

let cachedSigners: PersonaSigners | null = null;
let cachedPubkeys: PersonaPubkeys | null = null;

function makeSigner(name: PersonaName, keypair: Keypair): PersonaSigner {
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

async function unwrap<T>(res: Response): Promise<T> {
  const body = await res.json();
  if (!body.ok) throw new Error(body.error ?? `http_${res.status}`);
  return body.data as T;
}

export async function fetchPersonaPubkeys(): Promise<PersonaPubkeys> {
  if (cachedPubkeys) return cachedPubkeys;
  const res = await fetch("/api/console/personas");
  cachedPubkeys = await unwrap<PersonaPubkeys>(res);
  return cachedPubkeys;
}

export async function unlockPersonaSigners(): Promise<PersonaSigners> {
  if (cachedSigners) return cachedSigners;
  const res = await fetch("/api/console/personas", { method: "POST" });
  const vault = await unwrap<Record<PersonaName, number[]>>(res);
  cachedSigners = {
    alice: makeSigner("alice", Keypair.fromSecretKey(Uint8Array.from(vault.alice))),
    bob: makeSigner("bob", Keypair.fromSecretKey(Uint8Array.from(vault.bob))),
    carol: makeSigner("carol", Keypair.fromSecretKey(Uint8Array.from(vault.carol))),
    judge: makeSigner("judge", Keypair.fromSecretKey(Uint8Array.from(vault.judge))),
  };
  return cachedSigners;
}
