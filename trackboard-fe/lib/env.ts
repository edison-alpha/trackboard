/** WebSocket of trackboard-be. Empty means local mode: IndexedDB + sync between tabs of this browser. */
export const COLLAB_URL = process.env.NEXT_PUBLIC_COLLAB_URL?.trim() || "";
