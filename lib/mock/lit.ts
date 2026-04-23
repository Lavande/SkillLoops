import { getDb } from "@/lib/db";
import { now } from "./clock";

// Simple mock: "encryption" is a constant wrapper. Decryption returns plaintext
// only if the caller has an active Subscription row for the skill.

export const LitMock = {
  encrypt(plaintext: string, skillId: string): { ciphertext: string } {
    return { ciphertext: `enc::${skillId}::${Buffer.from(plaintext).toString("base64")}` };
  },

  decrypt(ciphertext: string, skillId: string, caller: string): { ok: true; plaintext: string } | { ok: false; reason: string } {
    const db = getDb();
    const sub = db
      .prepare(
        `SELECT subscriber, expiry_time FROM subscriptions WHERE subscriber = ? AND skill_id = ? AND is_active = 1`
      )
      .get(caller, skillId) as { subscriber: string; expiry_time: number } | undefined;
    // Skill author can always decrypt their own skill.
    const skill = db
      .prepare(`SELECT author FROM skills WHERE skill_id = ?`)
      .get(skillId) as { author: string } | undefined;
    const isAuthor = skill?.author === caller;
    if (!isAuthor) {
      if (!sub) return { ok: false, reason: "no_subscription" };
      if (sub.expiry_time < now()) return { ok: false, reason: "subscription_expired" };
    }
    const prefix = `enc::${skillId}::`;
    if (!ciphertext.startsWith(prefix)) return { ok: false, reason: "wrong_skill" };
    const plaintext = Buffer.from(ciphertext.slice(prefix.length), "base64").toString("utf8");
    return { ok: true, plaintext };
  },
};
