import { beforeAll, describe, expect, test } from "bun:test";
import * as Y from "yjs";
import { boot, pid, type Person, type World } from "./harness.ts";

let w: World;
let storeDocument: typeof import("../src/lib/collab.ts").storeDocument;

beforeAll(async () => {
  w = await boot();
  ({ storeDocument } = await import("../src/lib/collab.ts"));
});

const createPage = (who: Person, body: Record<string, unknown> = {}) => {
  const id = pid();
  return w.ok(`/api/pages`, { method: "POST", cookie: who.cookie, body: { id, workspaceId: who.ws, ...body } });
};
const patch = (who: Person, id: string, body: Record<string, unknown>) => w.call(`/api/pages/${id}`, { method: "PATCH", cookie: who.cookie, body });
const list = (who: Person, ws: string) => w.ok<{ pages: { id: string; access: string; publicToken: string | null; favorite: boolean }[]; people: { id: string }[] }>(`/api/pages?workspace=${ws}`, { cookie: who.cookie });
const ids = async (who: Person, ws: string) => (await list(who, ws)).pages.map((p) => p.id);
const workspaceInvite = (who: Person, body: Record<string, unknown> = { role: "member" }) => w.call(`/api/workspaces/${who.ws}/invites`, { method: "POST", cookie: who.cookie, body });
const accept = (who: Person, code: string) => w.call(`/api/invites/${code}/accept`, { method: "POST", cookie: who.cookie });

/** Ana's workspace with Budi joined as a member through a real invite link. */
async function team(tag: string) {
  const ana = await w.person(`Ana${tag}`);
  const budi = await w.person(`Budi${tag}`);
  const invite = await (await workspaceInvite(ana)).json();
  expect((await accept(budi, invite.code)).status).toBe(200);
  return { ana, budi };
}

describe("private and workspace pages", () => {
  test("a private page is invisible to a member of the same workspace, and to owners", async () => {
    const { ana, budi } = await team("1");
    const secret = await createPage(ana, { title: "Salary plan" });
    expect(await ids(budi, ana.ws)).not.toContain(secret.id);
    expect(await w.status(`/api/pages/${secret.id}/export`, { cookie: budi.cookie })).toBe(404);
    expect(await patch(budi, secret.id, { title: "mine now" }).then((r) => r.status)).toBe(404);
    // Budi writes a private page too, and Ana (the owner) cannot see it either.
    const theirs = await createPage(budi, { workspaceId: ana.ws, title: "Budi private" });
    expect(await ids(ana, ana.ws)).not.toContain(theirs.id);
  });

  test("sharing with the workspace gives members the workspace permission", async () => {
    const { ana, budi } = await team("2");
    const page = await createPage(ana, { title: "Handbook" });
    await patch(ana, page.id, { visibility: "workspace", workspacePermission: "view" });
    const seen = (await list(budi, ana.ws)).pages.find((p) => p.id === page.id);
    expect(seen?.access).toBe("view");
    expect((await patch(budi, page.id, { title: "Hijack" })).status).toBe(403);
    await patch(ana, page.id, { workspacePermission: "edit" });
    expect((await patch(budi, page.id, { title: "Handbook v2" })).status).toBe(200);
  });

  test("only people who manage a page can change who sees it", async () => {
    const { ana, budi } = await team("3");
    const page = await createPage(ana);
    await patch(ana, page.id, { visibility: "workspace", workspacePermission: "edit" });
    expect((await patch(budi, page.id, { visibility: "private" })).status).toBe(403);
    expect((await patch(budi, page.id, { workspacePermission: "view" })).status).toBe(403);
  });

  test("owners and admins manage workspace pages made by others, but never private ones", async () => {
    const { ana, budi } = await team("4");
    const page = await createPage(budi, { workspaceId: ana.ws });
    await patch(budi, page.id, { visibility: "workspace", workspacePermission: "view" });
    expect((await list(ana, ana.ws)).pages.find((p) => p.id === page.id)?.access).toBe("manage");
    await patch(budi, page.id, { visibility: "private" });
    expect(await ids(ana, ana.ws)).not.toContain(page.id);
  });

  test("making a page private again hides it from the workspace at once", async () => {
    const { ana, budi } = await team("5");
    const page = await createPage(ana);
    await patch(ana, page.id, { visibility: "workspace" });
    expect(await ids(budi, ana.ws)).toContain(page.id);
    await patch(ana, page.id, { visibility: "private" });
    expect(await ids(budi, ana.ws)).not.toContain(page.id);
  });

  test("a link to a page finds it for anyone who can open it, wherever it lives, and tells no one else", async () => {
    const ana = await w.person("Ana-find");
    const cara = await w.person("Cara-find");
    const out = await w.person("Out-find");
    const page = await createPage(ana, { title: "Brief" });
    await w.ok(`/api/pages/${page.id}/share`, { method: "POST", cookie: ana.cookie, body: { userId: cara.id, permission: "view" } });
    expect(await w.ok(`/api/pages/${page.id}`, { cookie: cara.cookie })).toMatchObject({ id: page.id, workspaceId: ana.ws, access: "view", title: "Brief" });
    expect(await w.ok(`/api/pages/${page.id}`, { cookie: ana.cookie })).toMatchObject({ access: "manage" });
    expect(await w.status(`/api/pages/${page.id}`, { cookie: out.cookie })).toBe(404);
    expect(await w.status(`/api/pages/${page.id}`)).toBe(401);
  });

  test("favorites belong to each person", async () => {
    const { ana, budi } = await team("6");
    const page = await createPage(ana);
    await patch(ana, page.id, { visibility: "workspace" });
    await w.ok(`/api/pages/${page.id}/favorite`, { method: "PUT", cookie: budi.cookie });
    expect((await list(budi, ana.ws)).pages.find((p) => p.id === page.id)?.favorite).toBe(true);
    expect((await list(ana, ana.ws)).pages.find((p) => p.id === page.id)?.favorite).toBe(false);
    await w.ok(`/api/pages/${page.id}/favorite`, { method: "DELETE", cookie: budi.cookie });
    expect((await list(budi, ana.ws)).pages.find((p) => p.id === page.id)?.favorite).toBe(false);
  });
});

describe("sharing with a person", () => {
  test("a share gives a guest exactly that page, with the permission given", async () => {
    const ana = await w.person("Ana7");
    const cara = await w.person("Cara7");
    const shared = await createPage(ana, { title: "Brief" });
    const other = await createPage(ana, { title: "Not shared" });
    const res = await w.ok(`/api/pages/${shared.id}/share`, { method: "POST", cookie: ana.cookie, body: { userId: cara.id, permission: "view" } });
    expect(res).toMatchObject({ kind: "shared", person: { id: cara.id } });

    const spaces = await w.ok<{ workspaces: { id: string; role: string }[] }>("/api/workspaces", { cookie: cara.cookie });
    expect(spaces.workspaces.find((s) => s.id === ana.ws)?.role).toBe("guest");
    const seen = await list(cara, ana.ws);
    expect(seen.pages.map((p) => p.id)).toEqual([shared.id]);
    expect(seen.pages[0]?.access).toBe("view");
    expect(await ids(cara, ana.ws)).not.toContain(other.id);
    expect(await w.status(`/api/pages?workspace=${ana.ws}`, { cookie: cara.cookie })).toBe(200);

    expect((await patch(cara, shared.id, { title: "x" })).status).toBe(403);
    await w.ok(`/api/pages/${shared.id}/share`, { method: "POST", cookie: ana.cookie, body: { userId: cara.id, permission: "edit" } });
    expect((await patch(cara, shared.id, { title: "Brief v2" })).status).toBe(200);
  });

  test("sharing by the email of an existing account shares at once", async () => {
    const ana = await w.person("Ana8");
    const dani = await w.person("Dani8");
    const page = await createPage(ana);
    const res = await w.ok(`/api/pages/${page.id}/share`, { method: "POST", cookie: ana.cookie, body: { email: dani.email.toUpperCase(), permission: "view" } });
    expect(res.kind).toBe("shared");
    expect(await ids(dani, ana.ws)).toContain(page.id);
  });

  test("removing a share takes the page away", async () => {
    const ana = await w.person("Ana9");
    const cara = await w.person("Cara9");
    const page = await createPage(ana);
    await w.ok(`/api/pages/${page.id}/share`, { method: "POST", cookie: ana.cookie, body: { userId: cara.id, permission: "edit" } });
    await w.ok(`/api/pages/${page.id}/share/${cara.id}`, { method: "DELETE", cookie: ana.cookie });
    expect(await w.status(`/api/pages?workspace=${ana.ws}`, { cookie: cara.cookie })).toBe(404);
  });

  test("a person can drop their own access, others cannot remove it for them", async () => {
    const ana = await w.person("Ana10");
    const cara = await w.person("Cara10");
    const eli = await w.person("Eli10");
    const page = await createPage(ana);
    for (const who of [cara, eli]) await w.ok(`/api/pages/${page.id}/share`, { method: "POST", cookie: ana.cookie, body: { userId: who.id, permission: "edit" } });
    expect(await w.status(`/api/pages/${page.id}/share/${eli.id}`, { method: "DELETE", cookie: cara.cookie })).toBe(403);
    expect(await w.status(`/api/pages/${page.id}/share/${cara.id}`, { method: "DELETE", cookie: cara.cookie })).toBe(200);
  });

  test("the sharing state is for people who manage the page", async () => {
    const ana = await w.person("Ana11");
    const cara = await w.person("Cara11");
    const page = await createPage(ana);
    await w.ok(`/api/pages/${page.id}/share`, { method: "POST", cookie: ana.cookie, body: { userId: cara.id, permission: "edit" } });
    expect(await w.status(`/api/pages/${page.id}/share`, { cookie: cara.cookie })).toBe(403);
    const state = await w.ok(`/api/pages/${page.id}/share`, { cookie: ana.cookie });
    expect(state).toMatchObject({ visibility: "private", workspacePermission: "edit", publicToken: null });
    expect(state.shares.map((s: { user: { id: string } }) => s.user.id)).toEqual([cara.id]);
  });

  test("you cannot share a page with yourself or with its owner", async () => {
    const ana = await w.person("Ana12");
    const cara = await w.person("Cara12");
    const page = await createPage(ana);
    await w.ok(`/api/pages/${page.id}/share`, { method: "POST", cookie: ana.cookie, body: { userId: cara.id, permission: "edit" } });
    expect(await w.status(`/api/pages/${page.id}/share`, { method: "POST", cookie: ana.cookie, body: { userId: ana.id, permission: "view" } })).toBe(400);
    expect(await w.status(`/api/pages/${page.id}/share`, { method: "POST", cookie: ana.cookie, body: { userId: cara.id, permission: "owner" } })).toBe(400);
  });
});

describe("invite links", () => {
  test("an email with no account gets a link that only that Google account can use", async () => {
    const ana = await w.person("Ana13");
    const page = await createPage(ana, { title: "Plan" });
    const res = await w.ok(`/api/pages/${page.id}/share`, { method: "POST", cookie: ana.cookie, body: { email: "newcomer13@example.com", permission: "edit" } });
    expect(res.kind).toBe("invited");
    const code = res.invite.code;
    expect(res.invite.url).toBe(`http://app.test/invite/${code}`);

    const preview = await w.ok(`/api/invites/${code}`);
    expect(preview).toMatchObject({ kind: "page", pageTitle: "Plan", inviter: "Ana13", level: "edit", email: "newcomer13@example.com", expired: false });

    const wrong = await w.person("Wrong13");
    expect((await accept(wrong, code)).status).toBe(403);
    const right = await w.person("Newcomer13", "newcomer13@example.com");
    const joined = await w.ok(`/api/invites/${code}/accept`, { method: "POST", cookie: right.cookie });
    expect(joined).toMatchObject({ kind: "page", workspaceId: ana.ws, pageId: page.id });
    expect((await list(right, ana.ws)).pages.find((p) => p.id === page.id)?.access).toBe("edit");
    // The same link cannot be taken by someone else afterwards.
    expect((await accept(wrong, code)).status).toBe(403);
  });

  test("a link locked to an email is single use", async () => {
    const ana = await w.person("Ana14");
    const page = await createPage(ana);
    const res = await w.ok(`/api/pages/${page.id}/share`, { method: "POST", cookie: ana.cookie, body: { email: "one14@example.com", permission: "view" } });
    const one = await w.person("One14", "one14@example.com");
    expect((await accept(one, res.invite.code)).status).toBe(200);
    // Accepting again as the same person is harmless.
    expect((await accept(one, res.invite.code)).status).toBe(200);
  });

  test("a workspace link works for several people until it expires or is cancelled", async () => {
    const ana = await w.person("Ana15");
    const invite = await w.ok(`/api/workspaces/${ana.ws}/invites`, { method: "POST", cookie: ana.cookie, body: { role: "member" } });
    const [a, b] = [await w.person("Fay15"), await w.person("Gus15")];
    expect((await accept(a, invite.code)).status).toBe(200);
    expect((await accept(b, invite.code)).status).toBe(200);
    const members = await w.ok<{ members: { id: string; role: string }[] }>(`/api/workspaces/${ana.ws}/members`, { cookie: ana.cookie });
    expect(members.members.map((m) => m.role).sort()).toEqual(["member", "member", "owner"]);

    const later = await w.person("Hal15");
    expect(await w.status(`/api/invites/${invite.code}`, { method: "DELETE", cookie: ana.cookie })).toBe(200);
    expect((await accept(later, invite.code)).status).toBe(404);
    expect(await w.status(`/api/invites/${invite.code}`)).toBe(404);
  });

  test("an expired invite cannot be used and says so", async () => {
    const ana = await w.person("Ana16");
    const invite = await w.ok(`/api/workspaces/${ana.ws}/invites`, { method: "POST", cookie: ana.cookie, body: { role: "member" } });
    await (await w.db()).query("update invites set expires_at = $2 where code = $1", [invite.code, Date.now() - 1000]);
    expect((await w.ok(`/api/invites/${invite.code}`)).expired).toBe(true);
    expect((await accept(await w.person("Ivy16"), invite.code)).status).toBe(409);
  });

  test("an unknown code reveals nothing", async () => {
    expect(await w.status("/api/invites/not-a-real-code")).toBe(404);
    const cara = await w.person("Cara17");
    expect((await accept(cara, "not-a-real-code")).status).toBe(404);
  });

  test("joining a workspace never lowers an existing role", async () => {
    const ana = await w.person("Ana18");
    const invite = await w.ok(`/api/workspaces/${ana.ws}/invites`, { method: "POST", cookie: ana.cookie, body: { role: "member" } });
    expect((await accept(ana, invite.code)).status).toBe(200);
    const members = await w.ok<{ members: { id: string; role: string }[] }>(`/api/workspaces/${ana.ws}/members`, { cookie: ana.cookie });
    expect(members.members.find((m) => m.id === ana.id)?.role).toBe("owner");
  });

  test("only owners and admins can invite to the workspace", async () => {
    const { ana, budi } = await team("19");
    const inviteToAna = (body: Record<string, unknown>) => w.call(`/api/workspaces/${ana.ws}/invites`, { method: "POST", cookie: budi.cookie, body });
    expect((await inviteToAna({ role: "member" })).status).toBe(403);
    await w.ok(`/api/workspaces/${ana.ws}/members/${budi.id}`, { method: "PATCH", cookie: ana.cookie, body: { role: "admin" } });
    expect((await inviteToAna({ role: "member" })).status).toBe(200);
    expect((await workspaceInvite(ana, { role: "owner" })).status).toBe(400);
  });
});

describe("members", () => {
  test("a removed member loses the workspace and the pages shared with it", async () => {
    const { ana, budi } = await team("20");
    const page = await createPage(ana);
    await patch(ana, page.id, { visibility: "workspace" });
    expect(await ids(budi, ana.ws)).toContain(page.id);
    await w.ok(`/api/workspaces/${ana.ws}/members/${budi.id}`, { method: "DELETE", cookie: ana.cookie });
    expect(await w.status(`/api/pages?workspace=${ana.ws}`, { cookie: budi.cookie })).toBe(404);
  });

  test("a member can leave, a plain member cannot remove others, and the owner stays", async () => {
    const { ana, budi } = await team("21");
    const cara = await w.person("Cara21");
    const invite = await w.ok(`/api/workspaces/${ana.ws}/invites`, { method: "POST", cookie: ana.cookie, body: { role: "member" } });
    await accept(cara, invite.code);
    expect(await w.status(`/api/workspaces/${ana.ws}/members/${cara.id}`, { method: "DELETE", cookie: budi.cookie })).toBe(403);
    expect(await w.status(`/api/workspaces/${ana.ws}/members/${ana.id}`, { method: "DELETE", cookie: ana.cookie })).toBe(409);
    expect(await w.status(`/api/workspaces/${ana.ws}/members/${budi.id}`, { method: "DELETE", cookie: budi.cookie })).toBe(200);
  });

  test("roles change only by owners and admins, never the owner's", async () => {
    const { ana, budi } = await team("22");
    expect(await w.status(`/api/workspaces/${ana.ws}/members/${ana.id}`, { method: "PATCH", cookie: budi.cookie, body: { role: "member" } })).toBe(403);
    expect(await w.status(`/api/workspaces/${ana.ws}/members/${ana.id}`, { method: "PATCH", cookie: ana.cookie, body: { role: "member" } })).toBe(403);
    expect(await w.status(`/api/workspaces/${ana.ws}/members/${budi.id}`, { method: "PATCH", cookie: ana.cookie, body: { role: "owner" } })).toBe(400);
  });

  test("a person can have several workspaces, and the default stays their own", async () => {
    const { ana, budi } = await team("23");
    const spaces = await w.ok<{ workspaces: { id: string; name: string; role: string; personal: boolean }[] }>("/api/workspaces", { cookie: budi.cookie });
    expect(spaces.workspaces.map((s) => s.id)).toEqual([budi.ws, ana.ws]);
    expect(spaces.workspaces[0]).toMatchObject({ personal: true, role: "owner" });
    expect(spaces.workspaces[1]).toMatchObject({ personal: false, role: "member" });
    const team2 = await w.ok("/api/workspaces", { method: "POST", cookie: ana.cookie, body: { name: "Design team" } });
    expect(team2).toMatchObject({ name: "Design team", role: "owner", personal: false });
    expect(await w.status(`/api/workspaces/${team2.id}`, { method: "PATCH", cookie: budi.cookie, body: { name: "Mine" } })).toBe(404);
  });
});

describe("public links", () => {
  test("anyone with the link can read the page, signed in or not, and only until it is turned off", async () => {
    const ana = await w.person("Ana24");
    const page = await createPage(ana, { title: "Launch notes", icon: "🚀" });
    const doc = new Y.Doc();
    const p = new Y.XmlElement("paragraph");
    const t = new Y.XmlText();
    t.insert(0, "We ship Friday");
    p.insert(0, [t]);
    doc.getXmlFragment("default").insert(0, [p]);
    await storeDocument(`${ana.ws}/page:${page.id}`, doc);

    const { publicToken } = await w.ok<{ publicToken: string }>(`/api/pages/${page.id}/public`, { method: "PUT", cookie: ana.cookie });
    expect(publicToken.length).toBeGreaterThanOrEqual(20);
    // Turning it on again keeps the same link.
    expect((await w.ok(`/api/pages/${page.id}/public`, { method: "PUT", cookie: ana.cookie })).publicToken).toBe(publicToken);

    const pub = await w.ok(`/api/public/${publicToken}`);
    expect(pub).toMatchObject({ title: "Launch notes", icon: "🚀", content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "We ship Friday" }] }] } });

    await w.ok(`/api/pages/${page.id}/public`, { method: "DELETE", cookie: ana.cookie });
    expect(await w.status(`/api/public/${publicToken}`)).toBe(404);
  });

  test("the public link is shown only to people who manage the page, and a public page stays read-only", async () => {
    const { ana, budi } = await team("25");
    const page = await createPage(ana);
    await patch(ana, page.id, { visibility: "workspace", workspacePermission: "edit" });
    const { publicToken } = await w.ok(`/api/pages/${page.id}/public`, { method: "PUT", cookie: ana.cookie });
    expect((await list(ana, ana.ws)).pages.find((p) => p.id === page.id)?.publicToken).toBe(publicToken);
    expect((await list(budi, ana.ws)).pages.find((p) => p.id === page.id)?.publicToken).toBeNull();
    expect(await w.status(`/api/pages/${page.id}/public`, { method: "PUT", cookie: budi.cookie })).toBe(403);
    // Anonymous visitors can read but there is no route that lets them write.
    expect(await w.status(`/api/pages/${page.id}`, { method: "PATCH", body: { title: "x" } })).toBe(401);
  });

  test("a trashed page is no longer served publicly", async () => {
    const ana = await w.person("Ana26");
    const page = await createPage(ana);
    const { publicToken } = await w.ok(`/api/pages/${page.id}/public`, { method: "PUT", cookie: ana.cookie });
    await w.ok(`/api/pages/${page.id}/trash`, { method: "POST", cookie: ana.cookie });
    expect(await w.status(`/api/public/${publicToken}`)).toBe(404);
  });

  test("a made-up token reveals nothing", async () => {
    expect(await w.status("/api/public/nope")).toBe(404);
    expect(await w.status(`/api/public/${"a".repeat(24)}`)).toBe(404);
  });
});
