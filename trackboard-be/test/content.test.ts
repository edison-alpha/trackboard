import { beforeAll, describe, expect, test } from "bun:test";
import * as Y from "yjs";
import { boot, pid, type Person, type World } from "./harness.ts";

let w: World;
let storeDocument: typeof import("../src/lib/collab.ts").storeDocument;
let recordActivity: typeof import("../src/lib/activity.ts").recordActivity;

beforeAll(async () => {
  w = await boot();
  ({ storeDocument } = await import("../src/lib/collab.ts"));
  ({ recordActivity } = await import("../src/lib/activity.ts"));
});

type Meta = { id: string };
const page = (who: Person, body: Record<string, unknown> = {}) => w.ok<Meta>("/api/pages", { method: "POST", cookie: who.cookie, body: { id: pid(), workspaceId: who.ws, ...body } });
const share = (owner: Person, id: string, target: Person, permission: "view" | "edit") => w.ok(`/api/pages/${id}/share`, { method: "POST", cookie: owner.cookie, body: { userId: target.id, permission } });

/** An owner with a page, and two people it is shared with: one who can edit and one who can only view. */
async function trio(tag: string) {
  const ana = await w.person(`Ana${tag}`);
  const eli = await w.person(`Eli${tag}`);
  const vic = await w.person(`Vic${tag}`);
  const p = await page(ana, { title: `Doc ${tag}` });
  await share(ana, p.id, eli, "edit");
  await share(ana, p.id, vic, "view");
  return { ana, eli, vic, p };
}

function snapshotBody(label: string | null, text = "hi") {
  const doc = new Y.Doc();
  doc.getText("t").insert(0, text);
  return { label, author: { name: "Ana", color: "#0b6fe8" }, update: Buffer.from(Y.encodeStateAsUpdate(doc)).toString("base64") };
}

function docWith(text: string): Y.Doc {
  const doc = new Y.Doc();
  const p = new Y.XmlElement("paragraph");
  const t = new Y.XmlText();
  t.insert(0, text);
  p.insert(0, [t]);
  doc.getXmlFragment("default").insert(0, [p]);
  return doc;
}

describe("version history", () => {
  test("save, list and read back the same state", async () => {
    const { ana, p } = await trio("v1");
    const saved = await w.ok(`/api/pages/${p.id}/snapshots`, { method: "POST", cookie: ana.cookie, body: snapshotBody("Before launch", "hello world") });
    const list = await w.ok<{ snapshots: { id: string; label: string }[] }>(`/api/pages/${p.id}/snapshots`, { cookie: ana.cookie });
    expect(list.snapshots.map((s) => s.label)).toEqual(["Before launch"]);
    const one = await w.ok<{ update: string }>(`/api/pages/${p.id}/snapshots/${saved.id}`, { cookie: ana.cookie });
    const restored = new Y.Doc();
    Y.applyUpdate(restored, Buffer.from(one.update, "base64"));
    expect(restored.getText("t").toString()).toBe("hello world");
  });

  test("junk bytes are rejected", async () => {
    const { ana, p } = await trio("v2");
    const bad = { label: null, author: { name: "A", color: "#000000" }, update: Buffer.from("not yjs at all").toString("base64") };
    expect(await w.status(`/api/pages/${p.id}/snapshots`, { method: "POST", cookie: ana.cookie, body: bad })).toBe(400);
  });

  test("editors can use history, viewers and outsiders cannot", async () => {
    const { eli, vic, p } = await trio("v3");
    const outsider = await w.person("Outsider-v3");
    expect(await w.status(`/api/pages/${p.id}/snapshots`, { method: "POST", cookie: eli.cookie, body: snapshotBody(null) })).toBe(200);
    expect(await w.status(`/api/pages/${p.id}/snapshots`, { method: "POST", cookie: vic.cookie, body: snapshotBody(null) })).toBe(403);
    expect(await w.status(`/api/pages/${p.id}/snapshots`, { cookie: vic.cookie })).toBe(403);
    expect(await w.status(`/api/pages/${p.id}/snapshots`, { cookie: outsider.cookie })).toBe(404);
  });

  test("only automatic versions are pruned, named ones stay", async () => {
    const { ana, p } = await trio("v4");
    for (let i = 0; i < 43; i++) await w.call(`/api/pages/${p.id}/snapshots`, { method: "POST", cookie: ana.cookie, body: snapshotBody(null, `v${i}`) });
    await w.call(`/api/pages/${p.id}/snapshots`, { method: "POST", cookie: ana.cookie, body: snapshotBody("Keep me") });
    const { snapshots } = await w.ok<{ snapshots: { label: string | null }[] }>(`/api/pages/${p.id}/snapshots`, { cookie: ana.cookie });
    expect(snapshots.filter((s) => s.label === null)).toHaveLength(40);
    expect(snapshots.filter((s) => s.label === "Keep me")).toHaveLength(1);
  });
});

describe("files", () => {
  const upload = (who: Person, file: File, pageId?: string) => {
    const form = new FormData();
    form.set("file", file);
    if (pageId) form.set("pageId", pageId);
    return w.call("/api/files", { method: "POST", cookie: who.cookie, form });
  };
  const png = () => new File([new Uint8Array([137, 80, 78, 71, 1, 2, 3])], "pic.png", { type: "image/png" });

  test("a file on a page follows that page's access", async () => {
    const { ana, eli, vic, p } = await trio("f1");
    const outsider = await w.person("Outsider-f1");
    const rec = await (await upload(ana, png(), p.id)).json();
    expect(rec).toMatchObject({ name: "pic.png", size: 7, url: `http://api.test/api/files/${rec.id}` });
    for (const who of [ana, eli, vic]) {
      const got = await w.call(`/api/files/${rec.id}`, { cookie: who.cookie });
      expect(got.status).toBe(200);
      expect(got.headers.get("content-type")).toBe("image/png");
      expect(got.headers.get("content-disposition")).toStartWith("inline");
      expect(got.headers.get("x-content-type-options")).toBe("nosniff");
      expect([...new Uint8Array(await got.arrayBuffer())]).toEqual([137, 80, 78, 71, 1, 2, 3]);
    }
    expect(await w.status(`/api/files/${rec.id}`, { cookie: outsider.cookie })).toBe(404);
    expect(await w.status(`/api/files/${rec.id}`)).toBe(404);
  });

  test("a file is cached for a year and revalidates with its ETag", async () => {
    const { ana, p } = await trio("f0");
    const rec = await (await upload(ana, png(), p.id)).json();
    const first = await w.call(`/api/files/${rec.id}`, { cookie: ana.cookie });
    const etag = first.headers.get("etag")!;
    expect(etag).toMatch(/^"[0-9a-f]{64}"$/);
    expect(first.headers.get("cache-control")).toBe("private, max-age=31536000, immutable");
    const again = await w.app.handle(new Request(`http://api.test/api/files/${rec.id}`, { headers: { cookie: ana.cookie, "if-none-match": etag } }));
    expect(again.status).toBe(304);
    expect(await again.text()).toBe("");
    // Revalidating never skips the access check.
    const outsider = await w.person("Outsider-f0");
    const denied = await w.app.handle(new Request(`http://api.test/api/files/${rec.id}`, { headers: { cookie: outsider.cookie, "if-none-match": etag } }));
    expect(denied.status).toBe(404);
  });

  test("viewers cannot upload to a page, editors can", async () => {
    const { eli, vic, p } = await trio("f2");
    expect((await upload(vic, png(), p.id)).status).toBe(403);
    expect((await upload(eli, png(), p.id)).status).toBe(200);
  });

  test("a page with a public link serves its files to anyone", async () => {
    const { ana, p } = await trio("f3");
    const rec = await (await upload(ana, png(), p.id)).json();
    expect(await w.status(`/api/files/${rec.id}`)).toBe(404);
    await w.ok(`/api/pages/${p.id}/public`, { method: "PUT", cookie: ana.cookie });
    expect(await w.status(`/api/files/${rec.id}`)).toBe(200);
    await w.ok(`/api/pages/${p.id}/public`, { method: "DELETE", cookie: ana.cookie });
    expect(await w.status(`/api/files/${rec.id}`)).toBe(404);
  });

  test("anything that is not a plain image or media is a download, never rendered", async () => {
    const { ana, p } = await trio("f4");
    const html = await (await upload(ana, new File(["<script>alert(1)</script>"], "x.html", { type: "text/html" }), p.id)).json();
    const got = await w.call(`/api/files/${html.id}`, { cookie: ana.cookie });
    expect(got.headers.get("content-type")).toBe("application/octet-stream");
    expect(got.headers.get("content-disposition")).toStartWith("attachment");
    const svg = await (await upload(ana, new File(["<svg onload=alert(1)/>"], "x.svg", { type: "image/svg+xml" }), p.id)).json();
    expect((await w.call(`/api/files/${svg.id}`, { cookie: ana.cookie })).headers.get("content-disposition")).toStartWith("attachment");
  });

  test("PDF and media play inline, without the sandbox that would block the PDF viewer", async () => {
    const { ana, p } = await trio("f5");
    const pdf = await (await upload(ana, new File(["%PDF-1.4"], "doc.pdf", { type: "application/pdf" }), p.id)).json();
    const got = await w.call(`/api/files/${pdf.id}`, { cookie: ana.cookie });
    expect(got.headers.get("content-type")).toBe("application/pdf");
    expect(got.headers.get("content-disposition")).toStartWith("inline");
    expect(got.headers.get("content-security-policy")).toBeNull();
    const mp4 = await (await upload(ana, new File([new Uint8Array(4)], "clip.mp4", { type: "video/mp4" }), p.id)).json();
    expect((await w.call(`/api/files/${mp4.id}`, { cookie: ana.cookie })).headers.get("content-type")).toBe("video/mp4");
  });

  test("a workspace file without a page is for members only, and the limit is enforced", async () => {
    const { ana } = await trio("f6");
    const outsider = await w.person("Outsider-f6");
    const form = new FormData();
    form.set("file", new File(["hello"], "n.txt", { type: "text/plain" }));
    form.set("workspaceId", ana.ws);
    const rec = await (await w.call("/api/files", { method: "POST", cookie: ana.cookie, form })).json();
    expect(await w.status(`/api/files/${rec.id}`, { cookie: ana.cookie })).toBe(200);
    expect(await w.status(`/api/files/${rec.id}`, { cookie: outsider.cookie })).toBe(404);
    const big = new FormData();
    big.set("file", new File([new Uint8Array(10 * 1024 * 1024 + 1)], "big.bin"));
    big.set("workspaceId", ana.ws);
    expect((await w.call("/api/files", { method: "POST", cookie: ana.cookie, form: big })).status).toBe(413);
    expect(await w.status("/api/files", { method: "POST", cookie: ana.cookie, body: {} })).toBe(400);
  });
});

describe("comments", () => {
  const thread = (who: Person, pageId: string, body = "Is this right?", id = pid("t")) => w.call(`/api/pages/${pageId}/threads`, { method: "POST", cookie: who.cookie, body: { id, quote: "the quarter", body } });

  test("an editor starts a thread, anyone with access can read and reply, a viewer cannot start one", async () => {
    const { ana, eli, vic, p } = await trio("c1");
    const outsider = await w.person("Outsider-c1");
    expect((await thread(vic, p.id)).status).toBe(403);
    expect((await thread(outsider, p.id)).status).toBe(404);
    const made = await (await thread(eli, p.id, "Check the number")).json();
    expect(made).toMatchObject({ pageId: p.id, quote: "the quarter", resolved: false, messages: [{ body: "Check the number", author: { id: eli.id } }] });

    const reply = await w.ok(`/api/threads/${made.id}/replies`, { method: "POST", cookie: vic.cookie, body: { body: "Looks right to me" } });
    expect(reply).toMatchObject({ body: "Looks right to me", author: { id: vic.id } });
    const all = await w.ok<{ threads: { messages: unknown[] }[] }>(`/api/pages/${p.id}/threads`, { cookie: ana.cookie });
    expect(all.threads[0]?.messages).toHaveLength(2);
    expect(await w.status(`/api/pages/${p.id}/threads`, { cookie: outsider.cookie })).toBe(404);
    expect(await w.status(`/api/threads/${made.id}/replies`, { method: "POST", cookie: outsider.cookie, body: { body: "hi" } })).toBe(404);
  });

  test("empty and oversized comments are refused", async () => {
    const { eli, p } = await trio("c2");
    expect((await thread(eli, p.id, "   ")).status).toBe(400);
    expect((await thread(eli, p.id, "x".repeat(4001))).status).toBe(400);
  });

  test("resolving and deleting need edit; the author may delete their own message; the last message takes the thread", async () => {
    const { ana, eli, vic, p } = await trio("c3");
    const made = await (await thread(eli, p.id)).json();
    const reply = await w.ok(`/api/threads/${made.id}/replies`, { method: "POST", cookie: vic.cookie, body: { body: "ok" } });
    expect(await w.status(`/api/threads/${made.id}`, { method: "PATCH", cookie: vic.cookie, body: { resolved: true } })).toBe(403);
    expect(await w.status(`/api/threads/${made.id}`, { method: "PATCH", cookie: eli.cookie, body: { resolved: true } })).toBe(200);
    expect((await w.ok(`/api/pages/${p.id}/threads`, { cookie: ana.cookie })).threads[0].resolved).toBe(true);
    expect(await w.status(`/api/messages/${reply.id}`, { method: "DELETE", cookie: ana.cookie })).toBe(200);
    expect(await w.status(`/api/messages/${made.messages[0].id}`, { method: "DELETE", cookie: vic.cookie })).toBe(403);
    expect(await w.status(`/api/messages/${made.messages[0].id}`, { method: "DELETE", cookie: eli.cookie })).toBe(200);
    expect((await w.ok(`/api/pages/${p.id}/threads`, { cookie: ana.cookie })).threads).toEqual([]);
    expect(await w.status(`/api/threads/${made.id}`, { method: "DELETE", cookie: ana.cookie })).toBe(404);
  });
});

describe("inbox and mentions", () => {
  type Inbox = { items: { id: string; kind: string; read: boolean; by: { id: string }; pageId: string; preview: string; quote: string | null }[]; unread: number };
  const inboxAll = (who: Person) => w.ok<Inbox>("/api/notifications", { cookie: who.cookie });
  /** Everything except the "shared with you" notices that the test setup itself causes. */
  const inbox = async (who: Person): Promise<Inbox> => {
    const items = (await inboxAll(who)).items.filter((i) => i.kind !== "share");
    return { items, unread: items.filter((i) => !i.read).length };
  };

  test("a comment tells the page's creator, never the person who wrote it", async () => {
    const { ana, eli, p } = await trio("n1");
    await w.ok(`/api/pages/${p.id}/threads`, { method: "POST", cookie: eli.cookie, body: { id: pid("t"), quote: "the quarter", body: "Please check" } });
    const mine = await inbox(ana);
    expect(mine.items).toHaveLength(1);
    expect(mine.items[0]).toMatchObject({ kind: "comment", by: { id: eli.id }, pageId: p.id, preview: "Please check", quote: "the quarter", read: false });
    expect(mine.unread).toBe(1);
    expect((await inbox(eli)).items).toEqual([]);
  });

  test("a reply tells everyone in the thread, and read state is kept on the server", async () => {
    const { ana, eli, vic, p } = await trio("n2");
    const t = await w.ok(`/api/pages/${p.id}/threads`, { method: "POST", cookie: eli.cookie, body: { id: pid("t"), quote: "", body: "Question" } });
    await w.ok(`/api/threads/${t.id}/replies`, { method: "POST", cookie: vic.cookie, body: { body: "Answer" } });
    const forEli = await inbox(eli);
    expect(forEli.items.map((i) => i.kind)).toEqual(["reply"]);
    await w.ok("/api/notifications/read", { method: "POST", cookie: eli.cookie, body: { ids: [forEli.items[0]!.id] } });
    expect(await inbox(eli)).toMatchObject({ unread: 0 });
    expect((await inbox(ana)).unread).toBeGreaterThan(0);
    await w.ok("/api/notifications/read", { method: "POST", cookie: ana.cookie, body: { all: true } });
    expect((await inbox(ana)).unread).toBe(0);
  });

  test("a mention tells a person who can open the page, and names the ones who cannot", async () => {
    const { ana, eli, vic, p } = await trio("n3");
    const stranger = await w.person("Stranger-n3");
    const res = await w.ok(`/api/pages/${p.id}/mentions`, { method: "POST", cookie: ana.cookie, body: { userIds: [eli.id, stranger.id, ana.id] } });
    expect(res.notified).toEqual([eli.id]);
    expect(res.noAccess).toMatchObject([{ id: stranger.id, name: "Stranger-n3" }]);
    expect((await inbox(eli)).items.map((i) => i.kind)).toEqual(["mention"]);
    expect((await inbox(stranger)).items).toEqual([]);
    // Typing the same name again before it is read is not a second ping.
    const again = await w.ok(`/api/pages/${p.id}/mentions`, { method: "POST", cookie: ana.cookie, body: { userIds: [eli.id] } });
    expect(again.notified).toEqual([]);
    expect((await inbox(eli)).items).toHaveLength(1);
    expect(await w.status(`/api/pages/${p.id}/mentions`, { method: "POST", cookie: vic.cookie, body: { userIds: [eli.id] } })).toBe(403);
  });

  test("a share is announced, and a notification for a page you can no longer open disappears", async () => {
    const ana = await w.person("Ana-n4");
    const cara = await w.person("Cara-n4");
    const p = await page(ana, { title: "Brief" });
    await share(ana, p.id, cara, "view");
    expect((await inboxAll(cara)).items.map((i) => i.kind)).toEqual(["share"]);
    await w.ok(`/api/pages/${p.id}/share/${cara.id}`, { method: "DELETE", cookie: ana.cookie });
    expect((await inboxAll(cara)).items).toEqual([]);
  });
});

describe("search", () => {
  const search = (who: Person, ws: string, q: string) => w.ok<{ hits: { pageId: string; title: string; snippet: string | null }[] }>(`/api/search?workspace=${ws}&q=${encodeURIComponent(q)}`, { cookie: who.cookie }).then((r) => r.hits);

  test("finds pages by title and by text, titles first, with a snippet around the hit", async () => {
    const ana = await w.person("Ana-s1");
    const byTitle = await page(ana, { title: "Quarterly roadmap" });
    const byText = await page(ana, { title: "Meeting" });
    await storeDocument(`${ana.ws}/page:${byText.id}`, docWith("We discussed the quarterly numbers at length"));
    const hits = await search(ana, ana.ws, "quarterly");
    expect(hits.map((h) => h.pageId)).toEqual([byTitle.id, byText.id]);
    expect(hits[1]?.snippet).toContain("quarterly numbers");
    expect(await search(ana, ana.ws, "nothing like this")).toEqual([]);
    expect(await search(ana, ana.ws, "   ")).toEqual([]);
  });

  test("never returns a page the person cannot open", async () => {
    const ana = await w.person("Ana-s2");
    const cara = await w.person("Cara-s2");
    const secret = await page(ana, { title: "Acquisition target" });
    await storeDocument(`${ana.ws}/page:${secret.id}`, docWith("confidential acquisition details"));
    expect((await search(ana, ana.ws, "acquisition")).map((h) => h.pageId)).toEqual([secret.id]);
    expect(await w.status(`/api/search?workspace=${ana.ws}&q=acquisition`, { cookie: cara.cookie })).toBe(404);
    await share(ana, secret.id, cara, "view");
    expect((await search(cara, ana.ws, "acquisition")).map((h) => h.pageId)).toEqual([secret.id]);
  });

  test("wildcard characters are ordinary text", async () => {
    const ana = await w.person("Ana-s3");
    await page(ana, { title: "100% done" });
    await page(ana, { title: "Other" });
    expect((await search(ana, ana.ws, "%")).map((h) => h.title)).toEqual(["100% done"]);
    expect(await search(ana, ana.ws, "_")).toEqual([]);
  });

  test("the assistant gets the pages most likely to answer, never one the person cannot open", async () => {
    const ana = await w.person("Ana-s5");
    const cara = await w.person("Cara-s5");
    const hit = await page(ana, { title: "Pricing" });
    const noise = await page(ana, { title: "Lunch menu" });
    await storeDocument(`${ana.ws}/page:${hit.id}`, docWith("The enterprise pricing tier costs ninety dollars per seat"));
    await storeDocument(`${ana.ws}/page:${noise.id}`, docWith("Pasta on Tuesday"));
    const ask = (who: Person, q: string) => w.ok<{ pages: { id: string; text: string; partial: boolean }[] }>(`/api/search/context?workspace=${ana.ws}&q=${encodeURIComponent(q)}`, { cookie: who.cookie });
    expect((await ask(ana, "what does the enterprise pricing tier cost?")).pages.map((p) => p.id)).toEqual([hit.id]);
    // With no keyword match it falls back to the most recently edited pages.
    expect((await ask(ana, "zzz")).pages.map((p) => p.id).sort()).toEqual([hit.id, noise.id].sort());
    expect(await w.status(`/api/search/context?workspace=${ana.ws}&q=pricing`, { cookie: cara.cookie })).toBe(404);
    await share(ana, hit.id, cara, "view");
    expect((await ask(cara, "pricing")).pages.map((p) => p.id)).toEqual([hit.id]);
  });

  test("trashed pages are not found", async () => {
    const ana = await w.person("Ana-s4");
    const gone = await page(ana, { title: "Old plan" });
    await w.ok(`/api/pages/${gone.id}/trash`, { method: "POST", cookie: ana.cookie });
    expect(await search(ana, ana.ws, "old plan")).toEqual([]);
  });
});

describe("activity, assistant chats, tickets", () => {
  test("writing activity counts five-minute windows per day", async () => {
    const ana = await w.person("Ana-a1");
    const t = Date.UTC(2026, 9, 14, 10, 0, 0);
    await recordActivity(ana.id, t);
    await recordActivity(ana.id, t + 60_000);
    await recordActivity(ana.id, t + 6 * 60_000);
    await recordActivity(ana.id, t + 24 * 3600_000);
    const { days } = await w.ok<{ days: { date: string; count: number }[] }>("/api/me/activity?days=730", { cookie: ana.cookie });
    expect(days).toEqual([{ date: "2026-10-14", count: 2 }, { date: "2026-10-15", count: 1 }]);
    expect((await w.ok("/api/me/activity", { cookie: (await w.person("Nobody-a1")).cookie })).days).toEqual([]);
  });

  test("an assistant chat is saved per person and page, trimmed to the latest 40", async () => {
    const { ana, eli, p } = await trio("a2");
    const msgs = Array.from({ length: 45 }, (_, i) => ({ id: `m${i}`, role: i % 2 ? "assistant" : "user", content: `message ${i}`, status: "done" }));
    await w.ok(`/api/pages/${p.id}/chat`, { method: "PUT", cookie: ana.cookie, body: { messages: msgs } });
    const mine = await w.ok<{ messages: { id: string }[] }>(`/api/pages/${p.id}/chat`, { cookie: ana.cookie });
    expect(mine.messages).toHaveLength(40);
    expect(mine.messages[0]?.id).toBe("m5");
    expect((await w.ok(`/api/pages/${p.id}/chat`, { cookie: eli.cookie })).messages).toEqual([]);
    expect(await w.status(`/api/pages/${p.id}/chat`, { method: "PUT", cookie: ana.cookie, body: { messages: "nope" } })).toBe(400);
    await w.ok(`/api/pages/${p.id}/chat`, { method: "DELETE", cookie: ana.cookie });
    expect((await w.ok(`/api/pages/${p.id}/chat`, { cookie: ana.cookie })).messages).toEqual([]);
  });

  test("tickets need edit on the page and show up on it", async () => {
    const { ana, eli, vic, p } = await trio("a3");
    const made = await w.ok(`/api/tickets`, { method: "POST", cookie: eli.cookie, body: { action: "create", pageId: p.id, title: "Fix login", description: "" } });
    expect(made.id).toMatch(/^LOCAL-[A-Z0-9]{8}$/);
    const linked = await w.ok(`/api/tickets`, { method: "POST", cookie: ana.cookie, body: { action: "link", pageId: p.id, title: "x", description: "", ticketId: "ENG-42" } });
    expect(linked.id).toBe("ENG-42");
    expect(await w.status(`/api/tickets`, { method: "POST", cookie: vic.cookie, body: { action: "create", pageId: p.id, title: "x", description: "" } })).toBe(403);
    expect(await w.status(`/api/tickets`, { method: "POST", cookie: ana.cookie, body: { action: "link", pageId: p.id, title: "x", description: "" } })).toBe(400);
    const list = await w.ok<{ pages: { id: string; linkedTickets: { id: string }[] }[] }>(`/api/pages?workspace=${ana.ws}`, { cookie: vic.cookie });
    expect(list.pages.find((x) => x.id === p.id)?.linkedTickets.map((t) => t.id).sort()).toEqual(["ENG-42", made.id].sort());
  });

  test("AI refuses bad requests before spending anything, and says when it is not set up", async () => {
    const ana = await w.person("Ana-a4");
    expect(await w.status("/api/ai", { method: "POST", cookie: ana.cookie, body: { action: "nope" } })).toBe(400);
    expect(await w.status("/api/ai", { method: "POST", cookie: ana.cookie, body: { action: "write" } })).toBe(400);
    expect(await w.status("/api/ai", { method: "POST", cookie: ana.cookie, body: { action: "improve", text: "x".repeat(120_001) } })).toBe(413);
    expect(await w.status("/api/ai", { method: "POST", body: { action: "improve", text: "hi" } })).toBe(401);
    const res = await w.call("/api/ai", { method: "POST", cookie: ana.cookie, body: { action: "improve", text: "hi" } });
    expect(res.status).toBe(503);
    expect(((await res.json()) as { error: string }).error).toContain("AI_API_KEY");
  });
});
