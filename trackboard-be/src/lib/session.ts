import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { jwtVerify, SignJWT } from "jose";
import { env } from "./env.ts";
import { AuthError } from "./errors.ts";

export const SESSION_COOKIE = "tb_session";
const TTL_SEC = 30 * 24 * 3_600;

export type Session = { userId: string };

/** HS256 key for cookies and tokens. SESSION_SECRET in production; otherwise generated once beside the local database. */
function secretKey(): Uint8Array {
  const e = env();
  if (e.sessionSecret) return new TextEncoder().encode(e.sessionSecret);
  if (e.production) throw new Error("SESSION_SECRET is required in production.");
  if (e.pgliteDir.startsWith("memory://")) return (memoryKey ??= new TextEncoder().encode(randomBytes(32).toString("base64url")));
  const dir = resolve(process.cwd(), e.pgliteDir);
  const file = resolve(dir, "session.secret");
  if (!existsSync(file)) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(file, randomBytes(48).toString("base64url"), { mode: 0o600 });
  }
  return new TextEncoder().encode(readFileSync(file, "utf8").trim());
}
let memoryKey: Uint8Array | undefined;

/** Signs a short-lived, single-purpose token (session, oauth state, collab socket). */
export async function signToken(purpose: string, claims: Record<string, unknown>, ttlSec: number): Promise<string> {
  return new SignJWT({ ...claims, purpose }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(`${ttlSec}s`).sign(secretKey());
}

export async function readToken<T extends Record<string, unknown>>(purpose: string, token: string): Promise<T | undefined> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    return payload.purpose === purpose ? (payload as unknown as T) : undefined;
  } catch {
    return undefined;
  }
}

/** SameSite=Lax when the app and the API share a site; None; Partitioned across sites. */
export function cookieString(name: string, value: string, maxAge: number): string {
  const e = env();
  const parts = [`${name}=${value}`, "Path=/", "HttpOnly", `Max-Age=${maxAge}`];
  if (e.crossSiteCookie) parts.push("SameSite=None", "Secure", "Partitioned");
  else {
    parts.push("SameSite=Lax");
    if (e.production) parts.push("Secure");
  }
  return parts.join("; ");
}

export async function sessionCookie(userId: string): Promise<string> {
  return cookieString(SESSION_COOKIE, await signToken("session", { userId }, TTL_SEC), TTL_SEC);
}

export const clearedSessionCookie = () => cookieString(SESSION_COOKIE, "", 0);

export function readCookie(header: string | null | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return undefined;
}

export async function sessionFromCookie(cookieHeader: string | null | undefined): Promise<Session | undefined> {
  const raw = readCookie(cookieHeader, SESSION_COOKIE);
  if (!raw) return undefined;
  const payload = await readToken<{ userId?: string }>("session", raw);
  return payload?.userId ? { userId: payload.userId } : undefined;
}

export const getSession = (request: Request) => sessionFromCookie(request.headers.get("cookie"));

export async function requireSession(request: Request): Promise<Session> {
  const session = await getSession(request);
  if (!session) throw new AuthError("Sign in to continue.");
  return session;
}
