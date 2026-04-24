import idlJson from "./idl-slp.json";
import type { Slp } from "./slp";

export const IDL = idlJson as unknown as Slp;
export type { Slp };
