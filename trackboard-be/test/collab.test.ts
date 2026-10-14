import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { HocuspocusProvider } from "@hocuspocus/provider";
import * as Y from "yjs";
import { boot, pid, type Person, type World } from "./harness.ts";

const PORT = 34_567;

let w: World;
let server: ReturnType<typeof import("../src/lib/collab.ts").createCollabServer>;
let loadState: typeof import("../src/lib/collab.ts").loadState;
let signToken: typeof import("../src/lib/session.ts").signToken;
let onCloseDocument: typeof import("../src/lib/events.ts").onCloseDocument;
const providers: HocuspocusProvider[] = [];

beforeAll(async () => {
  w = await boot({ PORT: String(PORT - 1) });
  const collab = await import("../src/lib/collab.ts");
  ({ loadState } = collab);
  ({ signToken } = await import("../src/lib/session.ts"));
  ({ onCloseDocument } = await import("../src/lib/events.ts"));
  server = collab.createCollabServer(PORT);
  server.listen();
  onCloseDocument((name) => server.closeDocument(name));
});

afterAll(async () => {
  providers.forEach((p) => p.destroy());
  await server.destroy();
});

const tokenFor = (userId: string) => signToken("collab", { userId }, 60);
const until = async (ok: () => boolean | Promise<boolean>, ms = 5_000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await ok()) return;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error("timed out waiting for condition");
};

async function connect(name: string, who: Person | null, token?: string) {
  const doc = new Y.Doc();
  const events = { synced: false, failed: "", closed: false };
  const provider = new HocuspocusProvider({
    url: `ws://127.0.0.1:${PORT}`,
    name,
    document: doc,
    token: token ?? (who ? await tokenFor(who.id) : ""),
    onSynced: () => void (events.synced = true),
    onAuthenticationFailed: ({ reason }: { reason: string }) => void (events.failed = reason),
    onClose: () => void (events.closed = true),
  });
  providers.push(provider);
  return { doc, provider, events };
}

function paragraph(doc: Y.Doc, text: string) {
  const p = new Y.XmlElement("paragraph");
  const t = new Y.XmlText();
  t.insert(0, text);
  p.insert(0, [t]);
  doc.getXmlFragment("default").insert(0, [p]);
}

const makePage = async (owner: Person) => {
  const id = pid("c");
  await w.ok("/api/pages", { method: "POST", cookie: owner.cookie, body: { id, workspaceId: owner.ws } });
  return { id, name: `${owner.ws}/page:${id}` };
};
const share = (owner: Person, id: string, target: Person, permission: "view" | "edit") => w.ok(`/api/pages/${id}/share`, { method: "POST", cookie: owner.cookie, body: { userId: target.id, permission } });

describe("collab server", () => {
  test("two people edit together and the page is saved as Yjs, JSON and text", async () => {
    const ana = await w.person("AnaC1");
    const eli = await w.person("EliC1");
    const { id, name } = await makePage(ana);
    await share(ana, id, eli, "edit");
    const a = await connect(name, ana);
    await until(() => a.events.synced);
    paragraph(a.doc, "Written together");
    const b = await connect(name, eli);
    await until(() => b.events.synced && b.doc.getXmlFragment("default").length === 1);
    expect(b.doc.getXmlFragment("default").toString()).toContain("Written together");
    paragraph(b.doc, "Reply from Eli");
    await until(() => a.doc.getXmlFragment("default").length === 2);

    server.hocuspocus.flushPendingStores();
    await until(async () => (await (await w.db()).query("select 1 from documents where name = $1", [name])).length === 1);
    const row = (await (await w.db()).query<{ text: string; content_json: { content: unknown[] } }>("select content_json, text from documents where name = $1", [name]))[0]!;
    expect(row.text).toContain("Written together");
    expect(row.content_json.content).toHaveLength(2);
    const fromDb = new Y.Doc();
    Y.applyUpdate(fromDb, (await loadState(name))!);
    expect(fromDb.getXmlFragment("default").toString()).toContain("Reply from Eli");

    // The page now says who wrote it and when.
    const meta = (await w.ok<{ pages: { id: string; editors: Record<string, number> }[] }>(`/api/pages?workspace=${ana.ws}`, { cookie: ana.cookie })).pages.find((p) => p.id === id)!;
    expect(Object.keys(meta.editors)).toContain(ana.id);
  });

  test("a viewer reads the page live but nothing they send is kept or shown to others", async () => {
    const ana = await w.person("AnaC2");
    const vic = await w.person("VicC2");
    const { id, name } = await makePage(ana);
    await share(ana, id, vic, "view");
    const a = await connect(name, ana);
    await until(() => a.events.synced);
    paragraph(a.doc, "Official text");
    const v = await connect(name, vic);
    await until(() => v.events.synced && v.doc.getXmlFragment("default").length === 1);
    expect(v.doc.getXmlFragment("default").toString()).toContain("Official text");

    paragraph(v.doc, "Vandalism");
    await new Promise((r) => setTimeout(r, 400));
    expect(a.doc.getXmlFragment("default").toString()).not.toContain("Vandalism");
    server.hocuspocus.flushPendingStores();
    await new Promise((r) => setTimeout(r, 300));
    const stored = new Y.Doc();
    Y.applyUpdate(stored, (await loadState(name))!);
    expect(stored.getXmlFragment("default").toString()).not.toContain("Vandalism");
  });

  test("someone with no access, no token, a forged token or a page in another workspace is turned away", async () => {
    const ana = await w.person("AnaC3");
    const out = await w.person("OutC3");
    const { id, name } = await makePage(ana);
    const attempts = [
      await connect(name, out),
      await connect(name, null),
      await connect(name, null, await signToken("session", { userId: ana.id }, 60)),
      await connect(`${out.ws}/page:${id}`, out),
      await connect(`${ana.ws}/page:${pid("z")}`, ana),
    ];
    for (const c of attempts) {
      await until(() => c.events.failed !== "");
      expect(c.events.synced).toBe(false);
    }
  });

  test("document names outside the scheme are refused", async () => {
    const ana = await w.person("AnaC4");
    for (const name of ["page:collab00006", `${ana.ws}/secrets`, `${ana.ws}/page:../x`, `${ana.ws}/workspace:default`]) {
      const c = await connect(name, ana);
      await until(() => c.events.failed !== "");
      expect(c.events.synced).toBe(false);
    }
  });

  test("taking someone's access away ends their live session and they cannot come back", async () => {
    const ana = await w.person("AnaC5");
    const eli = await w.person("EliC5");
    const { id, name } = await makePage(ana);
    await share(ana, id, eli, "edit");
    const e = await connect(name, eli);
    await until(() => e.events.synced);
    e.events.closed = false;
    await w.ok(`/api/pages/${id}/share/${eli.id}`, { method: "DELETE", cookie: ana.cookie });
    await until(() => e.events.closed);
    const again = await connect(name, eli);
    await until(() => again.events.failed !== "");
    expect(again.events.synced).toBe(false);
  });

  test("making a page private again ends the sessions of the people who only had it through the workspace", async () => {
    const ana = await w.person("AnaC6");
    const budi = await w.person("BudiC6");
    const invite = await w.ok(`/api/workspaces/${ana.ws}/invites`, { method: "POST", cookie: ana.cookie, body: { role: "member" } });
    await w.ok(`/api/invites/${invite.code}/accept`, { method: "POST", cookie: budi.cookie });
    const { id, name } = await makePage(ana);
    await w.ok(`/api/pages/${id}`, { method: "PATCH", cookie: ana.cookie, body: { visibility: "workspace", workspacePermission: "edit" } });
    const b = await connect(name, budi);
    await until(() => b.events.synced);
    b.events.closed = false;
    await w.ok(`/api/pages/${id}`, { method: "PATCH", cookie: ana.cookie, body: { visibility: "private" } });
    await until(() => b.events.closed);
    const again = await connect(name, budi);
    await until(() => again.events.failed !== "");
  });

  test("a document survives the server dropping it from memory", async () => {
    const ana = await w.person("AnaC7");
    const { name } = await makePage(ana);
    const a = await connect(name, ana);
    await until(() => a.events.synced);
    paragraph(a.doc, "Still here after restart");
    server.hocuspocus.flushPendingStores();
    await until(async () => (await loadState(name)) !== undefined);
    a.provider.destroy();
    await until(() => !server.hocuspocus.documents.has(name));
    const again = await connect(name, ana);
    await until(() => again.events.synced && again.doc.getXmlFragment("default").length === 1);
    expect(again.doc.getXmlFragment("default").toString()).toContain("Still here after restart");
  });

  test("typing is counted as writing activity", async () => {
    const ana = await w.person("AnaC8");
    const { name } = await makePage(ana);
    const a = await connect(name, ana);
    await until(() => a.events.synced);
    paragraph(a.doc, "Counting");
    await until(async () => ((await w.ok<{ days: unknown[] }>("/api/me/activity", { cookie: ana.cookie })).days.length ?? 0) > 0);
  });
});
