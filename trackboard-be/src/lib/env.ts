/**
 * Configuration comes only from the process environment (Bun loads .env automatically in development). Secrets are read
 * here and never logged; log.ts redacts any field that looks like one.
 */
function read() {
  const e = process.env;
  const production = e.NODE_ENV === "production";
  const port = Number(e.PORT ?? 3400);
  const list = (v: string | undefined, fallback: string) => (v ?? fallback).split(",").map((s) => s.trim()).filter(Boolean);
  return {
    production,
    port,
    allowedOrigins: list(e.TB_ALLOWED_ORIGINS, "http://localhost:3300"),
    appOrigin: e.TB_APP_ORIGIN || "http://localhost:3300",
    crossSiteCookie: e.TB_CROSS_SITE_COOKIE === "1",
    /** postgres://… for a real server; empty means embedded PGlite in .tb-db (or memory:// in tests). */
    databaseUrl: e.DATABASE_URL || undefined,
    pgliteDir: e.TB_PGLITE_DIR || ".tb-db",
    sessionSecret: e.SESSION_SECRET || undefined,
    /** Local development and tests only: GET /api/auth/dev signs in as any name without Google. Forced off in production. */
    devLogin: e.TB_DEV_LOGIN === "1" && !production,
    googleClientId: e.GOOGLE_CLIENT_ID || undefined,
    googleClientSecret: e.GOOGLE_CLIENT_SECRET || undefined,
    publicUrl: (e.TB_PUBLIC_URL || `http://localhost:${port}`).replace(/\/$/, ""),
    filesDir: e.TB_FILES_DIR || ".tb-files",
    aiBaseUrl: e.AI_BASE_URL || undefined,
    aiApiKey: e.AI_API_KEY || undefined,
    aiModel: e.AI_MODEL || "claude-haiku-4-5-20251001",
  };
}

export type Env = ReturnType<typeof read>;

let cached: Env | undefined;

export function env(): Env {
  cached ??= read();
  return cached;
}

/** Tests change process.env between cases; this drops the cached view. */
export function resetEnv() {
  cached = undefined;
}
