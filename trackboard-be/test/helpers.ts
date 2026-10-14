import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Must run before anything imports src/: env() reads these once. Each test file gets its own in-memory database. */
export function testEnv(extra: Record<string, string> = {}) {
  process.env.NODE_ENV = "test";
  process.env.TB_LOG = "silent";
  process.env.TB_PGLITE_DIR = "memory://";
  process.env.DATABASE_URL = "";
  process.env.SESSION_SECRET = "test-secret-test-secret-test-secret";
  process.env.TB_ALLOWED_ORIGINS = "http://app.test";
  process.env.TB_APP_ORIGIN = "http://app.test";
  process.env.TB_PUBLIC_URL = "http://api.test";
  process.env.TB_FILES_DIR = mkdtempSync(join(tmpdir(), "tb-files-"));
  process.env.GOOGLE_CLIENT_ID = "";
  process.env.GOOGLE_CLIENT_SECRET = "";
  process.env.AI_API_KEY = "";
  Object.assign(process.env, extra);
}
