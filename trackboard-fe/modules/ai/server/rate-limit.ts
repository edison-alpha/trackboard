import "server-only";

/* In-memory sliding window per caller. Enough for one server process; trackboard-be replaces it with a shared store. */

const WINDOW_MS = 60_000;
const LIMIT = Number(process.env.AI_RATE_PER_MINUTE ?? 20);
const hits = new Map<string, number[]>();

/** Returns seconds to wait, or 0 when the request may go ahead. */
export function rateLimit(key: string, now = Date.now()): number {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= LIMIT) {
    hits.set(key, recent);
    return Math.ceil((WINDOW_MS - (now - (recent[0] ?? now))) / 1000);
  }
  recent.push(now);
  hits.set(key, recent);
  return 0;
}
