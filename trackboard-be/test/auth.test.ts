import { beforeAll, describe, expect, test } from "bun:test";
import { boot, type Person, type World } from "./harness.ts";

const ORIGIN = "http://app.test";
let w: World;
let ana: Person;
let safeReturnTo: typeof import("../src/lib/google.ts").safeReturnTo;

beforeAll(async () => {
  w = await boot();
  ana = await w.person("AnaAuth");
  ({ safeReturnTo } = await import("../src/lib/google.ts"));
});

describe("health and sessions", () => {
  test("health reports the database", async () => {
    expect(await w.ok("/api/health")).toMatchObject({ ok: true, database: "pglite", google: false, ai: false });
  });

  test("protected routes need a session", async () => {
    for (const path of ["/api/me", "/api/collab-token", "/api/pages", "/api/workspaces", "/api/notifications", "/api/events", "/api/search?q=x", "/api/me/activity"]) {
      expect(await w.status(path), path).toBe(401);
    }
  });

  test("a tampered cookie is rejected", async () => {
    expect(await w.status("/api/me", { cookie: `${ana.cookie}x` })).toBe(401);
  });

  test("the session endpoint answers null when signed out", async () => {
    expect(await w.ok<unknown>("/api/session")).toEqual({ user: null });
    expect((await w.ok("/api/session", { cookie: ana.cookie })).user.email).toBe("anaauth@example.com");
  });

  test("Google sign-in is 503 until it is configured", async () => {
    expect(await w.status("/api/auth/google")).toBe(503);
  });

  test("sign-out clears the cookie", async () => {
    expect((await w.call("/api/session", { method: "DELETE", cookie: ana.cookie })).headers.get("set-cookie")).toContain("Max-Age=0");
  });

  test("returnTo only ever points inside the app", () => {
    expect(safeReturnTo("/p/abc")).toBe("/p/abc");
    for (const bad of ["//evil.test", "https://evil.test", "/\\evil.test", null]) expect(safeReturnTo(bad)).toBe("/");
  });

  test("a state change from a foreign origin is refused before it runs", async () => {
    expect(await w.status("/api/me", { method: "PATCH", cookie: ana.cookie, origin: "http://evil.test", body: { name: "Hacked" } })).toBe(403);
    expect((await w.ok("/api/me", { cookie: ana.cookie })).name).toBe("AnaAuth");
  });

  test("CORS allows the app origin with credentials", async () => {
    const res = await w.call("/api/me", { cookie: ana.cookie, origin: ORIGIN });
    expect(res.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    expect(res.headers.get("access-control-allow-credentials")).toBe("true");
  });
});

describe("accounts", () => {
  test("the first sign-in creates one personal workspace and signing in again reuses it", async () => {
    const { upsertGoogleUser } = await import("../src/lib/users.ts");
    const again = await upsertGoogleUser({ sub: "t:anaauth@example.com", email: "anaauth@example.com", name: "AnaAuth" });
    expect(again.id).toBe(ana.id);
    expect(again.workspaceId).toBe(ana.ws);
    const spaces = await w.ok<{ workspaces: { id: string; personal: boolean; role: string }[] }>("/api/workspaces", { cookie: ana.cookie });
    expect(spaces.workspaces).toMatchObject([{ id: ana.ws, personal: true, role: "owner" }]);
  });

  test("patching saves onboarding answers", async () => {
    expect(await w.ok("/api/me", { method: "PATCH", cookie: ana.cookie, body: { role: "Engineering", focus: ["docs", "planning"], onboardingDone: true, color: "#1d7a45" } })).toMatchObject({
      role: "Engineering", focus: ["docs", "planning"], onboardingDone: true, color: "#1d7a45",
    });
  });

  test("patching rejects bad values", async () => {
    for (const body of [{ name: "A" }, { color: "red" }, { focus: "docs" }, { focus: new Array(7).fill("x") }]) {
      expect(await w.status("/api/me", { method: "PATCH", cookie: ana.cookie, body })).toBe(400);
    }
  });

  test("a collab token is issued for the signed-in person", async () => {
    expect((await w.ok("/api/collab-token", { cookie: ana.cookie })).token.split(".")).toHaveLength(3);
  });

  test("workspace names are validated", async () => {
    expect(await w.status("/api/workspaces", { method: "POST", cookie: ana.cookie, body: { name: "A" } })).toBe(400);
    expect(await w.status(`/api/workspaces/${ana.ws}`, { method: "PATCH", cookie: ana.cookie, body: { name: "x".repeat(61) } })).toBe(400);
    expect(await w.ok(`/api/workspaces/${ana.ws}`, { method: "PATCH", cookie: ana.cookie, body: { name: "Ana's studio" } })).toMatchObject({ name: "Ana's studio" });
  });
});
