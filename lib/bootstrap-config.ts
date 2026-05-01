type Env = Record<string, string | undefined>;

export function shouldAutostartIndexer(env: Env = process.env): boolean {
  return (env.INDEXER_AUTOSTART ?? "true") === "true";
}

export function shouldAutostartJudgeDaemon(env: Env = process.env): boolean {
  return env.JUDGE_DAEMON_AUTOSTART === "true";
}
