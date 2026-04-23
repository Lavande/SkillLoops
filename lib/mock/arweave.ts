import crypto from "node:crypto";
import { getDb } from "@/lib/db";
import { now } from "./clock";

export interface Tag {
  name: string;
  value: string;
}

export interface ArweaveUpload {
  txId: string;
}

export interface ArweaveObject {
  content: string;
  tags: Tag[];
  owner: string;
  uploadedAt: number;
}

function mockTxId(content: string, owner: string): string {
  const h = crypto.createHash("sha256").update(owner).update("::").update(content).update("::mock").digest("hex");
  return `ar_${h.slice(0, 40)}`;
}

export const ArweaveMock = {
  upload(content: string, tags: Tag[], owner: string): ArweaveUpload {
    const db = getDb();
    const txId = mockTxId(content, owner);
    db.prepare(
      `INSERT OR REPLACE INTO arweave_objects (tx_id, content, tags, owner, uploaded_at) VALUES (?,?,?,?,?)`
    ).run(txId, content, JSON.stringify(tags), owner, now());
    return { txId };
  },

  fetch(txId: string): ArweaveObject | null {
    const db = getDb();
    const row = db
      .prepare(`SELECT content, tags, owner, uploaded_at AS uploadedAt FROM arweave_objects WHERE tx_id = ?`)
      .get(txId) as { content: string; tags: string; owner: string; uploadedAt: number } | undefined;
    if (!row) return null;
    return {
      content: row.content,
      tags: JSON.parse(row.tags),
      owner: row.owner,
      uploadedAt: row.uploadedAt,
    };
  },
};
