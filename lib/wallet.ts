import type { WalletContextState } from "@solana/wallet-adapter-react";

export interface SignResult {
  signatureBase58: string;
  messageUtf8: string;
}

function utf8Encode(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

async function toBase58(bytes: Uint8Array): Promise<string> {
  const { default: bs58 } = await import("bs58");
  return bs58.encode(bytes);
}

/**
 * Ask the connected wallet to sign a textual message.
 * Returns a base58 signature and the utf-8 message. Throws if the user rejects.
 */
export async function signMessage(
  wallet: WalletContextState,
  message: string
): Promise<SignResult> {
  if (!wallet.publicKey) throw new Error("wallet_not_connected");
  if (!wallet.signMessage) throw new Error("wallet_no_sign_message");
  const msgBytes = utf8Encode(message);
  const sig = await wallet.signMessage(msgBytes);
  const signatureBase58 = await toBase58(sig);
  return { signatureBase58, messageUtf8: message };
}

export function authHeaders(wallet: string | null | undefined, signature?: string | null) {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (wallet) h["x-slp-wallet"] = wallet;
  if (signature) h["x-slp-signature"] = signature;
  return h;
}
