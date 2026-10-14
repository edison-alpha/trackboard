import { describe, expect, test } from "bun:test";
import { testEnv } from "./helpers.ts";

describe("dev login", () => {
  test("is off unless TB_DEV_LOGIN=1", async () => {
    testEnv();
    const { createApp } = await import("../src/app.ts");
    const res = await createApp().handle(new Request("http://api.test/api/auth/dev?name=Ana"));
    expect(res.status).toBe(404);
  });

  test("is forced off in production even when asked for", async () => {
    testEnv({ TB_DEV_LOGIN: "1", NODE_ENV: "production" });
    const { resetEnv } = await import("../src/lib/env.ts");
    resetEnv();
    const { createApp } = await import("../src/app.ts");
    const res = await createApp().handle(new Request("http://api.test/api/auth/dev?name=Ana"));
    expect(res.status).toBe(404);
  });

  test("when on, signs in and redirects back into the app with a working session", async () => {
    testEnv({ TB_DEV_LOGIN: "1" });
    const { resetEnv } = await import("../src/lib/env.ts");
    resetEnv();
    const { createApp } = await import("../src/app.ts");
    const app = createApp();
    const res = await app.handle(new Request("http://api.test/api/auth/dev?name=Dewi&returnTo=/p/abc"));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("http://app.test/p/abc");
    const cookie = res.headers.get("set-cookie")!.split(";")[0]!;
    const me = (await (await app.handle(new Request("http://api.test/api/me", { headers: { cookie } }))).json()) as { name: string; email: string };
    expect(me).toMatchObject({ name: "Dewi", email: "dewi@dev.local" });
  });
});
