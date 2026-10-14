import { AsyncLocalStorage } from "node:async_hooks";

type Context = { requestId: string; user?: string };
export const requestContext = new AsyncLocalStorage<Context>();

const SECRET_KEY = /(secret|password|apikey|api_key|token|cookie|authorization|code)/i;

/** One JSON line per event with the current request id. Keys that look like secrets are redacted. */
export function log(event: string, fields: Record<string, unknown> = {}, level: "info" | "warn" | "error" = "info") {
  if (process.env.TB_LOG === "silent") return;
  const ctx = requestContext.getStore();
  const safe = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, SECRET_KEY.test(k) ? "[REDACTED]" : v]));
  const line = JSON.stringify({ at: new Date().toISOString(), level, event, requestId: ctx?.requestId, user: ctx?.user, ...safe });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
