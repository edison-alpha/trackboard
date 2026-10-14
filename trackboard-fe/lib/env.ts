/*
 * Where trackboard-be lives. Production builds talk to the real server out of the box; `next dev` talks to a backend on
 * this machine (`bun run dev` in trackboard-be). NEXT_PUBLIC_API_URL / NEXT_PUBLIC_COLLAB_URL override either.
 * These are public addresses, not secrets, so they are safe in the bundle.
 *
 * The real API signs people in only for pages served from trackboard.eaco1.xyz: the session cookie is SameSite=Lax, so a
 * localhost page never receives it. Use a local backend (with TB_DEV_LOGIN=1) while developing.
 */
const production = process.env.NODE_ENV === "production";
const configuredApi = process.env.NEXT_PUBLIC_API_URL?.trim();

/** Origin of trackboard-be (REST, Google sign-in, files, AI). */
export const API_URL = (configuredApi || (production ? "https://api.eaco1.xyz" : "http://localhost:3400")).replace(/\/$/, "");

/** WebSocket of trackboard-be's collaboration server. Production uses its own host; a custom API is assumed to serve it at /collab. */
export const COLLAB_URL =
  process.env.NEXT_PUBLIC_COLLAB_URL?.trim() || (configuredApi ? `${API_URL.replace(/^http/, "ws")}/collab` : production ? "wss://ws.eaco1.xyz" : "ws://localhost:3401");
