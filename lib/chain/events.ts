import { BorshEventCoder } from "@coral-xyz/anchor";
import { IDL } from "./idl";

const PROGRAM_DATA_PREFIX = "Program data: ";

// The JSON IDL emitted by `anchor build` keeps field/event names in
// snake_case. `Program<Slp>` auto-camelCases internally, but the standalone
// `BorshEventCoder` does not — so we apply the same conversion ourselves
// before constructing the coder. Keys converted mirror Anchor's own list.
const KEYS_TO_CONVERT = new Set(["name", "path", "account", "relations", "generic"]);

function toCamel(s: string): string {
  return s
    .split(".")
    .map((part) =>
      part.replace(/_([a-zA-Z0-9])/g, (_m, c: string) => c.toUpperCase()),
    )
    .join(".");
}

function convertIdlToCamelCase<T>(idl: T): T {
  const clone: any = structuredClone(idl);
  const walk = (obj: any): void => {
    if (obj === null || typeof obj !== "object") return;
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (KEYS_TO_CONVERT.has(key)) {
        obj[key] = Array.isArray(val) ? val.map(toCamel) : toCamel(val);
      } else if (typeof val === "object" && val !== null) {
        walk(val);
      }
    }
  };
  walk(clone);
  return clone;
}

let coderInstance: BorshEventCoder | null = null;
function coder(): BorshEventCoder {
  if (!coderInstance) {
    const camelIdl = convertIdlToCamelCase(IDL as any);
    coderInstance = new BorshEventCoder(camelIdl);
  }
  return coderInstance;
}

export type SlpEventName =
  | "SkillPublished"
  | "Subscribed"
  | "ExperienceSubmitted"
  | "ExperienceEvaluated"
  | "PeriodSettled"
  | "RevenueClaimed"
  | "VersionPublished";

export interface SlpEvent<N extends SlpEventName = SlpEventName> {
  name: N;
  data: Record<string, any>;
}

export function decodeEvents(logs: string[]): SlpEvent[] {
  const out: SlpEvent[] = [];
  for (const line of logs) {
    if (!line.startsWith(PROGRAM_DATA_PREFIX)) continue;
    const b64 = line.slice(PROGRAM_DATA_PREFIX.length);
    try {
      const decoded = coder().decode(b64);
      if (decoded) out.push({ name: decoded.name as SlpEventName, data: decoded.data });
    } catch {
      // not ours, skip
    }
  }
  return out;
}
