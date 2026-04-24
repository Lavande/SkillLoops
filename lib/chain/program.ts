import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import type { Connection, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { IDL, type Slp } from "./idl";

export interface Signer {
  publicKey: PublicKey;
  signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T>;
  signAllTransactions?<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]>;
}

export function getProgram(
  connection: Connection,
  signer: Signer,
  programId?: PublicKey,
): Program<Slp> {
  const wallet: Wallet = {
    publicKey: signer.publicKey,
    signTransaction: signer.signTransaction.bind(signer) as Wallet["signTransaction"],
    signAllTransactions:
      signer.signAllTransactions?.bind(signer) ??
      (async (txs: any[]) => Promise.all(txs.map((t) => signer.signTransaction(t)))),
    payer: undefined as any, // unused when signing via Phantom / external signer
  };
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  // Anchor 0.31 derives the program id from `idl.address`. Callers that want
  // to target a different deployment (e.g. unit tests) can override it by
  // passing a PublicKey; we clone + patch the IDL so the constructor picks it up.
  const idl = programId
    ? { ...(IDL as any), address: programId.toBase58() }
    : (IDL as any);
  return new Program<Slp>(idl, provider);
}
