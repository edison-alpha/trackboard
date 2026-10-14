/* In-memory sliding window per person. Enough for one server process. */

const WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

/** Returns seconds to wait, or 0 when the request may go ahead. */
export function rateLimit(key: string, now = Date.now(), limit = Number(process.env.AI_RATE_PER_MINUTE ?? 20)): number {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return Math.ceil((WINDOW_MS - (now - (recent[0] ?? now))) / 1000);
  }
  recent.push(now);
  hits.set(key, recent);
  return 0;
}
