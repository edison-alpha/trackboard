import { beforeAll, describe, expect, test } from "bun:test";
import * as Y from "yjs";
import { boot, pid, type Person, type World } from "./harness.ts";

let w: World;
let ana: Person;
let budi: Person;
let storeDocument: typeof import("../src/lib/collab.ts").storeDocument;

beforeAll(async () => {
  w = await boot();
  ana = await w.person("Ana");
  budi = await w.person("Budi");
  ({ storeDocument } = await import("../src/lib/collab.ts"));
});

const create = (who: Person, body: Record<string, unknown>) => w.call("/api/pages", { method: "POST", cookie: who.cookie, body });

function docWith(text: string): Y.Doc {
  const doc = new Y.Doc();
  const p = new Y.XmlElement("paragraph");
  const t = new Y.XmlText();
  t.insert(0, text);
  p.insert(0, [t]);
  doc.getXmlFragment("default").insert(0, [p]);
  return doc;
}

describe("creating pages", () => {
  test("a new top-level page is private and managed by its creator", async () => {
    const id = pid();
    const res = await create(ana, { id, workspaceId: ana.ws, title: "Roadmap" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id, title: "Roadmap", visibility: "private", workspacePermission: "edit", access: "manage", createdBy: ana.id, favorite: false, parentId: null, deletedAt: null });
  });

  test("a subpage starts with the visibility of its parent", async () => {
    const parent = pid();
    await create(ana, { id: parent, workspaceId: ana.ws });
    await w.ok(`/api/pages/${parent}`, { method: "PATCH", cookie: ana.cookie, body: { visibility: "workspace", workspacePermission: "view" } });
    const child = pid();
    const meta = await (await create(ana, { id: child, workspaceId: ana.ws, parentId: parent })).json();
    expect(meta).toMatchObject({ visibility: "workspace", workspacePermission: "view", parentId: parent });
  });

  test("a top-level page can start shared with the workspace; a subpage still follows its parent", async () => {
    const shared = pid();
    expect(await (await create(ana, { id: shared, workspaceId: ana.ws, visibility: "workspace" })).json()).toMatchObject({ visibility: "workspace" });
    const priv = pid();
    await create(ana, { id: priv, workspaceId: ana.ws });
    const child = await (await create(ana, { id: pid(), workspaceId: ana.ws, parentId: priv, visibility: "workspace" })).json();
    expect(child.visibility).toBe("private");
  });

  test("ids must be valid and unique, and the workspace must be yours", async () => {
    const id = pid();
    await create(ana, { id, workspaceId: ana.ws });
    expect((await create(ana, { id, workspaceId: ana.ws })).status).toBe(409);
    expect((await create(ana, { id: "../x", workspaceId: ana.ws })).status).toBe(400);
    expect((await create(budi, { id: pid(), workspaceId: ana.ws })).status).toBe(404);
  });

  test("a parent from another workspace is refused", async () => {
    const theirs = pid();
    await create(budi, { id: theirs, workspaceId: budi.ws });
    expect((await create(ana, { id: pid(), workspaceId: ana.ws, parentId: theirs })).status).toBe(404);
  });

  test("the list is only what you may see, and another workspace is closed to you", async () => {
    const mine = pid();
    await create(ana, { id: mine, workspaceId: ana.ws, title: "Only mine" });
    const list = await w.ok<{ pages: { id: string }[]; people: { id: string }[]; workspace: { id: string; role: string } }>(`/api/pages?workspace=${ana.ws}`, { cookie: ana.cookie });
    expect(list.pages.map((p) => p.id)).toContain(mine);
    expect(list.workspace).toMatchObject({ id: ana.ws, role: "owner" });
    expect(list.people.map((p) => p.id)).toContain(ana.id);
    expect(await w.status(`/api/pages?workspace=${ana.ws}`, { cookie: budi.cookie })).toBe(404);
    expect(await w.status(`/api/pages?workspace=${ana.ws}`)).toBe(401);
  });
});

describe("editing pages", () => {
  test("title, icon and cover are saved and count as writing", async () => {
    const id = pid();
    const before = (await (await create(ana, { id, workspaceId: ana.ws })).json()) as { updatedAt: number };
    await new Promise((r) => setTimeout(r, 5));
    const after = await w.ok(`/api/pages/${id}`, { method: "PATCH", cookie: ana.cookie, body: { title: "Spec", icon: "📐", cover: "sky", coverY: 120, pageWidth: "full" } });
    expect(after).toMatchObject({ title: "Spec", icon: "📐", cover: "sky", coverY: 100, pageWidth: "full" });
    expect(after.updatedAt).toBeGreaterThan(before.updatedAt);
    expect(Object.keys(after.editors)).toEqual([ana.id]);
  });

  test("layout changes do not count as writing", async () => {
    const id = pid();
    const before = (await (await create(ana, { id, workspaceId: ana.ws })).json()) as { updatedAt: number };
    await new Promise((r) => setTimeout(r, 5));
    const after = await w.ok(`/api/pages/${id}`, { method: "PATCH", cookie: ana.cookie, body: { fullWidth: true } });
    expect(after.updatedAt).toBe(before.updatedAt);
  });

  test("unknown fields and bad values are refused", async () => {
    const id = pid();
    await create(ana, { id, workspaceId: ana.ws });
    for (const body of [{ nope: 1 }, { title: "x".repeat(201) }, { pageWidth: "huge" }, { visibility: "public" }, { icon: 5 }]) {
      expect(await w.status(`/api/pages/${id}`, { method: "PATCH", cookie: ana.cookie, body })).toBe(400);
    }
  });

  test("a page you cannot see does not even confirm it exists", async () => {
    const id = pid();
    await create(ana, { id, workspaceId: ana.ws });
    expect(await w.status(`/api/pages/${id}`, { method: "PATCH", cookie: budi.cookie, body: { title: "x" } })).toBe(404);
    expect(await w.status(`/api/pages/${pid()}`, { method: "PATCH", cookie: budi.cookie, body: { title: "x" } })).toBe(404);
  });
});

describe("tree operations", () => {
  const move = (who: Person, id: string, parentId: string | null, position: number) => w.call(`/api/pages/${id}/move`, { method: "POST", cookie: who.cookie, body: { parentId, position } });

  test("moving sets the parent and the position", async () => {
    const [a, b] = [pid(), pid()];
    await create(ana, { id: a, workspaceId: ana.ws });
    await create(ana, { id: b, workspaceId: ana.ws });
    expect(await (await move(ana, b, a, 2.5)).json()).toMatchObject({ parentId: a, position: 2.5 });
  });

  test("a page cannot move into itself or its own subtree", async () => {
    const [a, b, c] = [pid(), pid(), pid()];
    await create(ana, { id: a, workspaceId: ana.ws });
    await create(ana, { id: b, workspaceId: ana.ws, parentId: a });
    await create(ana, { id: c, workspaceId: ana.ws, parentId: b });
    expect((await move(ana, a, a, 1)).status).toBe(400);
    expect((await move(ana, a, c, 1)).status).toBe(400);
  });

  test("restore puts a page back, or at the top when its parent is still in the trash", async () => {
    const [parent, child] = [pid(), pid()];
    await create(ana, { id: parent, workspaceId: ana.ws });
    await create(ana, { id: child, workspaceId: ana.ws, parentId: parent });
    const trashed = await w.ok(`/api/pages/${child}/trash`, { method: "POST", cookie: ana.cookie });
    expect(trashed.deletedAt).not.toBeNull();
    await w.ok(`/api/pages/${parent}/trash`, { method: "POST", cookie: ana.cookie });
    expect(await w.ok(`/api/pages/${child}/restore`, { method: "POST", cookie: ana.cookie })).toMatchObject({ deletedAt: null, parentId: null });
  });

  test("duplicate copies the content right after the original", async () => {
    const src = pid();
    await create(ana, { id: src, workspaceId: ana.ws, title: "Original" });
    await storeDocument(`${ana.ws}/page:${src}`, docWith("Body text"));
    const copy = pid();
    expect(await w.ok(`/api/pages/${src}/duplicate`, { method: "POST", cookie: ana.cookie, body: { to: copy } })).toMatchObject({ id: copy, title: "Original (copy)", createdBy: ana.id });
    expect(await (await w.call(`/api/pages/${copy}/export?format=text`, { cookie: ana.cookie })).text()).toBe("Body text");
    const index = await w.ok<{ pages: { id: string; preview: string }[] }>(`/api/pages?workspace=${ana.ws}`, { cookie: ana.cookie });
    expect(index.pages.find((p) => p.id === src)?.preview).toBe("Body text");
    expect(await w.status(`/api/pages/${src}/duplicate`, { method: "POST", cookie: ana.cookie, body: { to: copy } })).toBe(409);
    expect(await w.status(`/api/pages/${src}/duplicate`, { method: "POST", cookie: budi.cookie, body: { to: pid() } })).toBe(404);
  });

  test("purge removes the page, its subpages and their content for good", async () => {
    const [a, b] = [pid(), pid()];
    await create(ana, { id: a, workspaceId: ana.ws });
    await create(ana, { id: b, workspaceId: ana.ws, parentId: a });
    await storeDocument(`${ana.ws}/page:${b}`, new Y.Doc());
    await w.ok("/api/pages/purge", { method: "POST", cookie: ana.cookie, body: { ids: [a] } });
    expect(await w.status(`/api/pages/${b}/export`, { cookie: ana.cookie })).toBe(404);
    expect(await (await w.db()).query("select 1 as ok from pages where id = any($1::text[])", [[a, b]])).toHaveLength(0);
    expect(await (await w.db()).query("select 1 as ok from documents where name = $1", [`${ana.ws}/page:${b}`])).toHaveLength(0);
  });

  test("purge needs manage on every page named", async () => {
    const id = pid();
    await create(ana, { id, workspaceId: ana.ws });
    expect(await w.status("/api/pages/purge", { method: "POST", cookie: budi.cookie, body: { ids: [id] } })).toBe(404);
    expect(await w.status("/api/pages/purge", { method: "POST", cookie: ana.cookie, body: { ids: [] } })).toBe(400);
  });
});

describe("export", () => {
  test("serves the stored JSON and text, and 404 before anything is saved", async () => {
    const id = pid();
    await create(ana, { id, workspaceId: ana.ws });
    expect(await w.status(`/api/pages/${id}/export`, { cookie: ana.cookie })).toBe(404);
    await storeDocument(`${ana.ws}/page:${id}`, docWith("Quarterly plan"));
    expect(await (await w.call(`/api/pages/${id}/export`, { cookie: ana.cookie })).json()).toEqual({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Quarterly plan" }] }] });
    expect(await (await w.call(`/api/pages/${id}/export?format=text`, { cookie: ana.cookie })).text()).toBe("Quarterly plan");
    expect(await w.status(`/api/pages/${id}/export`, { cookie: budi.cookie })).toBe(404);
  });
});
