import { expect } from "bun:test";
import { testEnv } from "./helpers.ts";

/** Boots the app in-process against a fresh in-memory database. People are real accounts with real session cookies. */
export async function boot(extraEnv: Record<string, string> = {}) {
  testEnv(extraEnv);
  const { createApp } = await import("../src/app.ts");
  const { sessionCookie } = await import("../src/lib/session.ts");
  const { upsertGoogleUser } = await import("../src/lib/users.ts");
  const { db } = await import("../src/lib/db/client.ts");
  const app = createApp();

  type Init = { method?: string; cookie?: string; body?: unknown; origin?: string; form?: FormData };
  /** A response whose JSON is untyped, so tests can read fields without casting every time. */
  type Reply = Omit<Response, "json"> & { json(): Promise<any> };
  const call = (path: string, init: Init = {}): Promise<Reply> => {
    const headers: Record<string, string> = {};
    if (init.cookie) headers.cookie = init.cookie;
    if (init.origin) headers.origin = init.origin;
    let body: FormData | string | undefined;
    if (init.form) body = init.form;
    else if (init.body !== undefined) {
      headers["content-type"] = "application/json";
      body = JSON.stringify(init.body);
    }
    return app.handle(new Request(`http://api.test${path}`, { method: init.method ?? "GET", headers, body })) as Promise<Reply>;
  };

  /** A signed-in person: their account and the cookie to send. */
  const person = async (name: string, email = `${name.toLowerCase()}@example.com`) => {
    const me = await upsertGoogleUser({ sub: `t:${email}`, email, name });
    const cookie = (await sessionCookie(me.id)).split(";")[0]!;
    return { me, cookie, id: me.id, ws: me.workspaceId, email };
  };

  /** Calls and expects 200, returning the JSON body. */
  const ok = async <T = any>(path: string, init: Init = {}): Promise<T> => {
    const res = await call(path, init);
    const text = await res.text();
    expect(res.status, `${init.method ?? "GET"} ${path} -> ${res.status} ${text}`).toBe(200);
    return JSON.parse(text) as T;
  };
  const status = async (path: string, init: Init = {}) => (await call(path, init)).status;

  return { app, call, ok, status, person, db };
}

export type World = Awaited<ReturnType<typeof boot>>;
export type Person = Awaited<ReturnType<World["person"]>>;

let counter = 0;
/** A page id that is valid and unique within a test run. */
export const pid = (tag = "p") => `${tag}${String(++counter).padStart(7, "0")}`;
