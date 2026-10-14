import { beforeAll, describe, expect, test } from "bun:test";
import { boot, pid, type Person, type World } from "./harness.ts";

let w: World;
beforeAll(async () => {
  w = await boot();
});

/** Opens the live stream the way the app does and collects the events that arrive. */
async function listen(who: Person) {
  const abort = new AbortController();
  const res = await w.app.handle(new Request("http://api.test/api/events", { headers: { cookie: who.cookie }, signal: abort.signal }));
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toContain("text/event-stream");
  const events: { type: string; [k: string]: unknown }[] = [];
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  void (async () => {
    for (;;) {
      const { value, done } = await reader.read().catch(() => ({ value: undefined, done: true }));
      if (done || !value) return;
      buffer += decoder.decode(value, { stream: true });
      let at: number;
      while ((at = buffer.indexOf("\n\n")) >= 0) {
        const chunk = buffer.slice(0, at);
        buffer = buffer.slice(at + 2);
        const line = chunk.split("\n").find((l) => l.startsWith("data: "));
        if (line) events.push(JSON.parse(line.slice(6)));
      }
    }
  })();
  return { events, stop: () => abort.abort() };
}

const settle = () => new Promise((r) => setTimeout(r, 120));

describe("live events", () => {
  test("people who can see a page hear that the list changed; people who cannot hear nothing", async () => {
    const ana = await w.person("AnaE1");
    const budi = await w.person("BudiE1");
    const outsider = await w.person("OutE1");
    const invite = await w.ok(`/api/workspaces/${ana.ws}/invites`, { method: "POST", cookie: ana.cookie, body: { role: "member" } });
    await w.ok(`/api/invites/${invite.code}/accept`, { method: "POST", cookie: budi.cookie });

    const [forBudi, forOutsider, forAna] = await Promise.all([listen(budi), listen(outsider), listen(ana)]);
    // A private page concerns only its creator.
    const secret = pid();
    await w.ok("/api/pages", { method: "POST", cookie: ana.cookie, body: { id: secret, workspaceId: ana.ws } });
    await settle();
    expect(forAna.events.some((e) => e.type === "pages" && e.workspaceId === ana.ws)).toBe(true);
    expect(forBudi.events.filter((e) => e.type === "pages")).toEqual([]);

    // Once it is shared with the workspace, members hear about it.
    await w.ok(`/api/pages/${secret}`, { method: "PATCH", cookie: ana.cookie, body: { visibility: "workspace" } });
    await settle();
    expect(forBudi.events.some((e) => e.type === "pages" && e.workspaceId === ana.ws)).toBe(true);
    expect(forOutsider.events).toEqual([]);
    [forBudi, forOutsider, forAna].forEach((s) => s.stop());
  });

  test("comments and notifications reach the people they concern", async () => {
    const ana = await w.person("AnaE2");
    const eli = await w.person("EliE2");
    const page = pid();
    await w.ok("/api/pages", { method: "POST", cookie: ana.cookie, body: { id: page, workspaceId: ana.ws } });
    await w.ok(`/api/pages/${page}/share`, { method: "POST", cookie: ana.cookie, body: { userId: eli.id, permission: "edit" } });
    const [forAna, forEli] = await Promise.all([listen(ana), listen(eli)]);
    await w.ok(`/api/pages/${page}/threads`, { method: "POST", cookie: eli.cookie, body: { id: pid("t"), quote: "", body: "Hello" } });
    await settle();
    expect(forAna.events.some((e) => e.type === "comments" && e.pageId === page)).toBe(true);
    expect(forAna.events.some((e) => e.type === "notifications")).toBe(true);
    expect(forEli.events.some((e) => e.type === "comments" && e.pageId === page)).toBe(true);
    // Eli wrote the comment, so there is nothing new in his inbox.
    expect(forEli.events.some((e) => e.type === "notifications")).toBe(false);
    [forAna, forEli].forEach((s) => s.stop());
  });

  test("joining a workspace tells its members", async () => {
    const ana = await w.person("AnaE3");
    const budi = await w.person("BudiE3");
    const forAna = await listen(ana);
    const invite = await w.ok(`/api/workspaces/${ana.ws}/invites`, { method: "POST", cookie: ana.cookie, body: { role: "member" } });
    await w.ok(`/api/invites/${invite.code}/accept`, { method: "POST", cookie: budi.cookie });
    await settle();
    expect(forAna.events.some((e) => e.type === "members" && e.workspaceId === ana.ws)).toBe(true);
    forAna.stop();
  });
});
