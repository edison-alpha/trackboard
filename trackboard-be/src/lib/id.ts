/** Short random id, same alphabet as the frontend's createId so page ids and server ids look alike. */
export function createId(size = 12): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(size));
  let id = "";
  for (const b of bytes) id += alphabet[b % alphabet.length];
  return id;
}
