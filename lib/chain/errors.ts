export const ERROR_MESSAGES: Record<string, string> = {
  NotJudge: "Only the protocol judge can evaluate experiences.",
  AlreadyEvaluated: "This experience has already been evaluated.",
  ScoreOutOfRange: "Judge score must be between 0 and 50.",
  WrongSkill: "Experience does not belong to this skill.",
  PeriodNotElapsed: "The settlement period has not yet elapsed.",
  HoldersIncomplete: "Settle is missing some shareholders — try again.",
  ShareAccountMismatch: "ShareAccount belongs to the wrong skill.",
  SharesMustBeNonzero: "Zero-share holders cannot be settled.",
  WrongClaimPda: "Internal: claim PDA mismatch.",
  NothingToClaim: "Nothing to claim right now.",
  ZeroPrice: "Subscription price must be positive.",
  FloorTooLow: "Author floor ratio below protocol minimum (30%).",
  InvalidK: "Contribution coefficient (k) must be in 1..=100.",
  StringTooLong: "One of the text fields exceeds its length limit.",
  NotAuthor: "Only the skill author can publish a new version.",
  TooManyContributors: "Too many contributing experiences for one version (max 16).",
  PoolBelowRentExempt: "Claim would leave the pool below rent-exempt.",
  SettleAccountsUnpaired: "Settle requires paired [share, claim] accounts.",
  SignatureDeclined: "Transaction signature was declined.",
  Unknown: "Transaction failed.",
};

export class ChainError extends Error {
  constructor(public code: string, public readonly sig?: string) {
    super(ERROR_MESSAGES[code] ?? ERROR_MESSAGES.Unknown);
    this.name = "ChainError";
  }
}

export function parseChainError(err: unknown, sig?: string): ChainError {
  if (err instanceof ChainError) return err;
  const anyErr = err as any;

  // Anchor AnchorError shape
  const code = anyErr?.error?.errorCode?.code;
  if (typeof code === "string" && ERROR_MESSAGES[code]) return new ChainError(code, sig);

  // Wallet rejection patterns
  const msg = anyErr?.message ?? String(err);
  if (/rejected|user denied|cancell?ed/i.test(msg)) return new ChainError("SignatureDeclined", sig);

  const e = new ChainError("Unknown", sig);
  e.message = `${e.message} (${msg})`;
  return e;
}
