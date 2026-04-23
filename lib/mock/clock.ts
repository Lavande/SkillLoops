// Unix seconds wrapper so tests can freeze time if needed.
let frozen: number | null = null;

export function now(): number {
  return frozen ?? Math.floor(Date.now() / 1000);
}

export function freezeTime(t: number) {
  frozen = t;
}

export function unfreezeTime() {
  frozen = null;
}
