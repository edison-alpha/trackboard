import { createRemoteJWKSet, jwtVerify } from "jose";
import { env } from "./env.ts";
import { AuthError, InputError } from "./errors.ts";
import { log } from "./log.ts";
import { readCookie, readToken, signToken } from "./session.ts";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
export const STATE_COOKIE = "tb_oauth";
const STATE_TTL_SEC = 600;

export const googleConfigured = () => Boolean(env().googleClientId && env().googleClientSecret);
export const redirectUri = () => `${env().publicUrl}/api/auth/google/callback`;

/** Only a path on the app itself: "/p/abc", never "//evil.test" or "https://evil.test". */
export function safeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  return value;
}

/** Where to send the browser to sign in, and the cookie that ties the round trip to this browser. */
export async function startGoogle(returnTo: string | null): Promise<{ url: string; cookie: string }> {
  const e = env();
  if (!googleConfigured()) throw new InputError("Google sign-in is not set up on this server.");
  const nonce = crypto.randomUUID();
  const state = await signToken("oauth", { nonce, returnTo: safeReturnTo(returnTo) }, STATE_TTL_SEC);
  const url = new URL(AUTH_URL);
  url.search = new URLSearchParams({
    client_id: e.googleClientId!,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  }).toString();
  // The state cookie is read on the navigation back from Google, so it is Lax even when the session cookie is not.
  return { url: url.toString(), cookie: `${STATE_COOKIE}=${nonce}; Path=/; HttpOnly; Max-Age=${STATE_TTL_SEC}; SameSite=Lax${e.production ? "; Secure" : ""}` };
}

export const clearedStateCookie = () => `${STATE_COOKIE}=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax`;

export type GoogleIdentity = { sub: string; email: string; name: string; returnTo: string };

/** Checks the state against this browser's cookie, trades the code for an ID token, and verifies that token. */
export async function finishGoogle(input: { code: string | null; state: string | null; cookieHeader: string | null }): Promise<GoogleIdentity> {
  const e = env();
  if (!input.code || !input.state) throw new InputError("The Google sign-in response is incomplete.");
  const state = await readToken<{ nonce?: string; returnTo?: string }>("oauth", input.state);
  const nonce = readCookie(input.cookieHeader, STATE_COOKIE);
  if (!state?.nonce || !nonce || state.nonce !== nonce) throw new AuthError("The sign-in attempt expired. Start again.");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code: input.code, client_id: e.googleClientId!, client_secret: e.googleClientSecret!, redirect_uri: redirectUri(), grant_type: "authorization_code" }),
  });
  if (!res.ok) {
    log("google.token_failed", { status: res.status }, "warn");
    throw new AuthError("Google did not accept the sign-in. Try again.");
  }
  const { id_token } = (await res.json()) as { id_token?: string };
  if (!id_token) throw new AuthError("Google did not return an identity.");
  const { payload } = await jwtVerify(id_token, JWKS, { issuer: ["https://accounts.google.com", "accounts.google.com"], audience: e.googleClientId! });
  if (typeof payload.sub !== "string" || typeof payload.email !== "string") throw new AuthError("The Google account has no email address.");
  if (payload.email_verified !== true) throw new AuthError("Verify the email address on your Google account first.");
  return { sub: payload.sub, email: payload.email, name: typeof payload.name === "string" ? payload.name : payload.email.split("@")[0]!, returnTo: safeReturnTo(state.returnTo) };
}
