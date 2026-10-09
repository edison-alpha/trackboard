/** Short random id for pages, threads and snapshots. URL-safe, collision odds are negligible at workspace scale. */
export function createId(size = 12): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(size));
  let id = "";
  for (const b of bytes) id += alphabet[b % alphabet.length];
  return id;
}
