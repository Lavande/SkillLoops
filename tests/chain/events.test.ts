import { describe, it, expect } from "vitest";
import { PublicKey } from "@solana/web3.js";
import { BN, BorshEventCoder } from "@coral-xyz/anchor";
import { Buffer } from "node:buffer";
import { IDL } from "@/lib/chain/idl";
import { decodeEvents, type SlpEvent } from "@/lib/chain/events";

const PROGRAM_LOG_PREFIX = "Program log: ";
const PROGRAM_DATA_PREFIX = "Program data: ";

// Mirror Anchor's own `convertIdlToCamelCase` (not re-exported from the
// top-level package in 0.31) so the test coder can read the snake_case
// IDL produced by `anchor build` the same way our production decoder does.
const KEYS = new Set(["name", "path", "account", "relations", "generic"]);
const toCamel = (s: string) =>
  s.split(".").map((p) => p.replace(/_([a-zA-Z0-9])/g, (_m, c) => c.toUpperCase())).join(".");
function camelize<T>(idl: T): T {
  const clone: any = structuredClone(idl);
  const walk = (o: any): void => {
    if (!o || typeof o !== "object") return;
    for (const k of Object.keys(o)) {
      const v = o[k];
      if (KEYS.has(k)) o[k] = Array.isArray(v) ? v.map(toCamel) : toCamel(v);
      else if (typeof v === "object" && v !== null) walk(v);
    }
  };
  walk(clone);
  return clone;
}

const BN_TYPES = new Set(["u64", "i64", "u128", "i128"]);

// `BorshEventCoder` in @coral-xyz/anchor@0.31 exposes only `decode`. To build
// round-trip fixtures we reach into its internal `layouts` Map (which holds
// the per-event discriminator + borsh struct layout) and encode manually.
// 64-bit integer fields must be BN instances for `@coral-xyz/borsh`.
function encodeEvent(name: string, data: Record<string, unknown>): string {
  const camelIdl = camelize(IDL as any);
  const coder = new BorshEventCoder(camelIdl);
  const layouts: Map<string, { discriminator: number[]; layout: any }> = (coder as any).layouts;
  const entry = layouts.get(name);
  if (!entry) throw new Error(`Unknown event: ${name}`);

  const evType = (camelIdl.types as any[]).find((t) => t.name === name);
  const coerced: Record<string, unknown> = {};
  for (const field of evType.type.fields as Array<{ name: string; type: unknown }>) {
    const raw = data[field.name];
    coerced[field.name] =
      typeof field.type === "string" && BN_TYPES.has(field.type) && typeof raw === "number"
        ? new BN(raw)
        : raw;
  }

  const buf = Buffer.alloc(1000);
  const len = entry.layout.encode(coerced, buf);
  const bytes = Buffer.concat([Buffer.from(entry.discriminator), buf.slice(0, len)]);
  return `${PROGRAM_DATA_PREFIX}${bytes.toString("base64")}`;
}

describe("decodeEvents", () => {
  const SKILL = new PublicKey("11111111111111111111111111111114");
  const USER = new PublicKey("11111111111111111111111111111115");

  it("decodes SkillPublished", () => {
    const log = encodeEvent("SkillPublished", { skill: SKILL, author: USER, createdAt: 12345 });
    const events = decodeEvents([PROGRAM_LOG_PREFIX + "noise", log]);
    expect(events.length).toBe(1);
    const e = events[0] as SlpEvent<"SkillPublished">;
    expect(e.name).toBe("SkillPublished");
    expect(e.data.skill.toBase58()).toBe(SKILL.toBase58());
    expect(e.data.author.toBase58()).toBe(USER.toBase58());
  });

  it("decodes Subscribed", () => {
    const log = encodeEvent("Subscribed", { skill: SKILL, subscriber: USER, expiryTime: 999 });
    const [e] = decodeEvents([log]);
    expect(e.name).toBe("Subscribed");
  });

  it("decodes ExperienceSubmitted", () => {
    const log = encodeEvent("ExperienceSubmitted", { skill: SKILL, experienceId: 0, contributor: USER });
    const [e] = decodeEvents([log]);
    expect(e.name).toBe("ExperienceSubmitted");
  });

  it("decodes ExperienceEvaluated", () => {
    const log = encodeEvent("ExperienceEvaluated", {
      skill: SKILL,
      experienceId: 0,
      contributor: USER,
      score: 38,
      contributionWeightDelta: 95,
      ownershipDeltaBps: 0,
      authorOwnershipBps: 10000,
      contributorPoolBps: 0,
      approved: true,
    });
    const [e] = decodeEvents([log]);
    expect(e.name).toBe("ExperienceEvaluated");
    expect(e.data.contributionWeightDelta.toString()).toBe("95");
    expect(e.data.ownershipDeltaBps).toBe(0);
    expect(e.data.authorOwnershipBps).toBe(10000);
  });

  it("decodes PeriodSettled", () => {
    const log = encodeEvent("PeriodSettled", {
      skill: SKILL,
      snapshotId: 1,
      periodRevenue: 300000000,
      authorOwnershipBps: 10000,
      contributorPoolBps: 0,
    });
    const [e] = decodeEvents([log]);
    expect(e.name).toBe("PeriodSettled");
  });

  it("decodes RevenueClaimed", () => {
    const log = encodeEvent("RevenueClaimed", {
      skill: SKILL, holder: USER, amount: 217391305, snapshotId: 1,
    });
    const [e] = decodeEvents([log]);
    expect(e.name).toBe("RevenueClaimed");
  });

  it("decodes VersionPublished", () => {
    const log = encodeEvent("VersionPublished", { skill: SKILL, version: 2, contributingCount: 1 });
    const [e] = decodeEvents([log]);
    expect(e.name).toBe("VersionPublished");
  });

  it("ignores non-event log lines", () => {
    const events = decodeEvents([
      "Program log: hello",
      "Program invocation: slp",
      "Program consumed 12345 of 200000 units",
    ]);
    expect(events.length).toBe(0);
  });
});
