import { randomUUID } from "node:crypto";
import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";
import type {
  AiRequest, DuplicatePage, HealthResponse, Me, MemberPatch, MeUpdate, MovePage, NewInvite, NewPage, NewShare, NewSnapshot, NewThread, NewTicket, NewWorkspace, PagePatch, PurgePages, WorkspacePatch,
} from "@trackboard/api-types";
import { docName, MAX_FILE_BYTES, pageDocName } from "@trackboard/shared";
import { getPage, requireAccess } from "./lib/access.ts";
import { activityFor } from "./lib/activity.ts";
import { getChat, putChat, clearChat } from "./lib/ai-chats.ts";
import { prepareAi, streamAi } from "./lib/ai/run.ts";
import { deleteMessage, deleteThread, listThreads, reply, setResolved, startThread } from "./lib/comments.ts";
import { COLLAB_TOKEN_TTL_SEC } from "./lib/collab.ts";
import { db } from "./lib/db/client.ts";
import { env } from "./lib/env.ts";
import { AuthError, classify, InputError, NotFoundError, UnavailableError } from "./lib/errors.ts";
import { eventStream } from "./lib/events.ts";
import { authorizeFileRead, readStoredFile, saveFile } from "./lib/files.ts";
import { clearedStateCookie, finishGoogle, googleConfigured, safeReturnTo, startGoogle } from "./lib/google.ts";
import { acceptInvite, createWorkspaceInvite, listWorkspaceInvites, previewInvite, revokeInvite } from "./lib/invites.ts";
import { log, requestContext } from "./lib/log.ts";
import { announceMentions, listNotifications, markRead } from "./lib/notifications.ts";
import { createPage, duplicatePage, exportPage, listPages, movePage, pageMeta, purgePages, restorePage, setFavorite, trashPage, updatePage } from "./lib/pages.ts";
import { contextPages, searchPages } from "./lib/search.ts";
import { clearedSessionCookie, getSession, requireSession, sessionCookie, signToken } from "./lib/session.ts";
import { getPublicPage, getShareState, removeShare, setPublic, shareWithPerson } from "./lib/shares.ts";
import { getSnapshot, listSnapshots, saveSnapshot } from "./lib/snapshots.ts";
import { addTicket } from "./lib/tickets.ts";
import { getMe, updateMe, upsertGoogleUser } from "./lib/users.ts";
import { createWorkspace, listMembers, listWorkspaces, removeMember, renameWorkspace, setMemberRole } from "./lib/workspaces.ts";

type Ctx = { request: Request; params: Record<string, string>; body: unknown; query: Record<string, string | undefined> };
type Input = { params: Record<string, string>; body: unknown; query: Record<string, string | undefined>; request: Request };
type Run = (input: Input & { me: Me }) => Promise<unknown>;
type PublicRun = (input: Input) => Promise<unknown>;

/** What the app needs from the collab server, so tests can run the REST API without opening a socket. */
export type CollabHandle = { liveState(name: string): Uint8Array | undefined; closeDocuments(names: string[]): void };

const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...headers } });

/**
 * Every route runs here: request id, structured log, optional session, and error classification. Expected failures
 * become 4xx/503 with a message the user can act on; anything else is logged and returned as 500 with its first line.
 * A handler may return a Response (redirects, files, streams); anything else is sent as JSON.
 */
async function handle(ctx: Ctx, fn: Run | PublicRun, auth: boolean): Promise<Response> {
  const requestId = ctx.request.headers.get("x-request-id") ?? randomUUID();
  const path = new URL(ctx.request.url).pathname;
  const started = performance.now();
  return requestContext.run({ requestId }, async () => {
    const respond = (response: Response) => {
      response.headers.set("x-request-id", requestId);
      // The live event stream stays open for as long as the tab does; its start is the only line worth logging.
      log("api.request", { method: ctx.request.method, path, status: response.status, ms: Math.round(performance.now() - started) }, response.status >= 500 ? "error" : "info");
      return response;
    };
    try {
      const input: Input = { params: ctx.params ?? {}, body: ctx.body ?? {}, query: ctx.query ?? {}, request: ctx.request };
      let out: unknown;
      if (auth) {
        const session = await requireSession(ctx.request);
        const me = await getMe(session.userId);
        const store = requestContext.getStore();
        if (store) store.user = me.id;
        out = await (fn as Run)({ ...input, me });
      } else {
        out = await (fn as PublicRun)(input);
      }
      return respond(out instanceof Response ? out : json(out));
    } catch (error) {
      const known = classify(error);
      if (known) return respond(json({ error: known.message, requestId }, known.status, known.headers));
      log("api.error", { path, error: (error as Error).message.split("\n")[0], stack: (error as Error).stack?.split("\n").slice(1, 4) }, "error");
      return respond(json({ error: `Unexpected server error (request ${requestId.slice(0, 8)}). ${(error as Error).message.split("\n")[0]}`, requestId }, 500));
    }
  });
}

const authed = (fn: Run) => (ctx: Ctx) => handle(ctx, fn, true);
const open = (fn: PublicRun) => (ctx: Ctx) => handle(ctx, fn, false);

const redirect = (to: string, cookies: string[]) => {
  const headers = new Headers({ location: to, "cache-control": "no-store" });
  for (const c of cookies) headers.append("set-cookie", c);
  return new Response(null, { status: 302, headers });
};

const id = (params: Record<string, string>, key = "id") => {
  const v = params[key];
  if (!v) throw new InputError(`${key} is required.`);
  return v;
};

export function createApp(collab?: CollabHandle) {
  const e = env();
  return (
    new Elysia({ serve: { maxRequestBodySize: MAX_FILE_BYTES + 1024 * 1024 } })
      .use(cors({ origin: e.allowedOrigins, credentials: true, methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"], allowedHeaders: ["content-type", "x-request-id"], exposeHeaders: ["x-request-id"] }))
      // A state-changing request from an origin outside the allowlist is refused before any handler runs. CORS alone
      // only stops the response from being read; this stops the side effect.
      .onBeforeHandle(({ request }) => {
        const origin = request.headers.get("origin");
        if (origin && !["GET", "HEAD", "OPTIONS"].includes(request.method) && !e.allowedOrigins.includes(origin)) return json({ error: "Origin not allowed." }, 403);
      })

      // Health ---------------------------------------------------------------------------------------------------------
      .get("/api/health", async () => {
        try {
          const d = await db();
          await d.query("select 1");
          return json({ ok: true, database: d.kind, google: googleConfigured(), ai: Boolean(e.aiApiKey) } satisfies HealthResponse);
        } catch {
          return json({ ok: false, database: "unreachable", google: googleConfigured(), ai: Boolean(e.aiApiKey) } satisfies HealthResponse, 503);
        }
      })

      // Sign-in --------------------------------------------------------------------------------------------------------
      .get("/api/auth/google", open(async ({ query }) => {
        if (!googleConfigured()) throw new UnavailableError("Google sign-in is not set up on this server.");
        const { url, cookie } = await startGoogle(query.returnTo ?? null);
        return redirect(url, [cookie]);
      }))
      .get("/api/auth/google/callback", open(async ({ query, request }) => {
        // A failed sign-in goes back to the app with a code it can show, instead of leaving the person on a JSON error.
        const back = (reason: string) => redirect(`${e.appOrigin}/?signin_error=${reason}`, [clearedStateCookie()]);
        if (query.error) return back("cancelled");
        try {
          const identity = await finishGoogle({ code: query.code ?? null, state: query.state ?? null, cookieHeader: request.headers.get("cookie") });
          const me = await upsertGoogleUser(identity);
          return redirect(`${e.appOrigin}${identity.returnTo}`, [await sessionCookie(me.id), clearedStateCookie()]);
        } catch (error) {
          log("auth.failed", { error: (error as Error).message.split("\n")[0] }, "warn");
          return back(error instanceof AuthError ? "expired" : "failed");
        }
      }))
      // Local development and tests only: signs in as the given name, so the app can be driven without a Google account.
      .get("/api/auth/dev", open(async ({ query }) => {
        if (!e.devLogin) throw new NotFoundError("Not found.");
        const name = (query.name ?? "").trim().slice(0, 40);
        if (name.length < 2) throw new InputError("name is required.");
        const email = (query.email ?? "").trim().toLowerCase() || `${name.toLowerCase().replace(/[^a-z0-9]+/g, ".")}@dev.local`;
        const me = await upsertGoogleUser({ sub: `dev:${email}`, email, name });
        return redirect(`${e.appOrigin}${safeReturnTo(query.returnTo)}`, [await sessionCookie(me.id)]);
      }))
      .get("/api/session", async ({ request }) => {
        const session = await getSession(request);
        return json({ user: session ? await getMe(session.userId).catch(() => null) : null });
      })
      .delete("/api/session", () => json({ ok: true }, 200, { "set-cookie": clearedSessionCookie() }))
      // A short-lived token for the collab socket: the socket host never receives the session cookie.
      .get("/api/collab-token", authed(async ({ me }) => ({ token: await signToken("collab", { userId: me.id }, COLLAB_TOKEN_TTL_SEC), expiresIn: COLLAB_TOKEN_TTL_SEC })))
      // Live updates: a small event naming what changed, so the app refetches it (and the refetch checks permissions).
      .get("/api/events", authed(async ({ me, request }) =>
        new Response(eventStream(me.id, request.signal), { headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store, no-transform", connection: "keep-alive", "x-accel-buffering": "no" } })))

      // Me -------------------------------------------------------------------------------------------------------------
      .get("/api/me", authed(async ({ me }) => me))
      .patch("/api/me", authed(async ({ me, body }) => updateMe(me.id, body as MeUpdate)))
      .get("/api/me/activity", authed(async ({ me, query }) => ({ days: await activityFor(me.id, query.days ? Number(query.days) : 365) })))

      // Workspaces and members -----------------------------------------------------------------------------------------
      .get("/api/workspaces", authed(async ({ me }) => ({ workspaces: await listWorkspaces(me.id) })))
      .post("/api/workspaces", authed(async ({ me, body }) => createWorkspace(me.id, (body as NewWorkspace).name)))
      .patch("/api/workspaces/:id", authed(async ({ me, params, body }) => renameWorkspace(me.id, id(params), (body as WorkspacePatch).name)))
      .get("/api/workspaces/:id/members", authed(async ({ me, params }) => ({ members: await listMembers(me.id, id(params)) })))
      .patch("/api/workspaces/:id/members/:uid", authed(async ({ me, params, body }) => { await setMemberRole(me.id, id(params), id(params, "uid"), (body as MemberPatch).role); return { ok: true }; }))
      .delete("/api/workspaces/:id/members/:uid", authed(async ({ me, params }) => { await removeMember(me.id, id(params), id(params, "uid")); return { ok: true }; }))
      .get("/api/workspaces/:id/invites", authed(async ({ me, params }) => ({ invites: await listWorkspaceInvites(me.id, id(params)) })))
      .post("/api/workspaces/:id/invites", authed(async ({ me, params, body }) => createWorkspaceInvite(me.id, id(params), body as NewInvite)))
      .get("/api/invites/:code", open(async ({ params }) => previewInvite(id(params, "code"))))
      .post("/api/invites/:code/accept", authed(async ({ me, params }) => acceptInvite(me.id, id(params, "code"))))
      .delete("/api/invites/:code", authed(async ({ me, params }) => { await revokeInvite(me.id, id(params, "code")); return { ok: true }; }))

      // Pages ----------------------------------------------------------------------------------------------------------
      .get("/api/pages", authed(async ({ me, query }) => listPages(me.id, query.workspace ?? me.workspaceId)))
      .post("/api/pages", authed(async ({ me, body }) => createPage(me.id, body as NewPage)))
      .post("/api/pages/purge", authed(async ({ me, body }) => {
        const names = await purgePages(me.id, (body as PurgePages | null)?.ids ?? []);
        collab?.closeDocuments(names);
        return { ok: true };
      }))
      // One page as this person sees it: how a link to a page in another workspace (a notification, a share) finds where it lives.
      .get("/api/pages/:id", authed(async ({ me, params }) => pageMeta(me.id, id(params))))
      .patch("/api/pages/:id", authed(async ({ me, params, body }) => updatePage(me.id, id(params), body as PagePatch)))
      .post("/api/pages/:id/move", authed(async ({ me, params, body }) => movePage(me.id, id(params), body as MovePage)))
      .post("/api/pages/:id/trash", authed(async ({ me, params }) => trashPage(me.id, id(params))))
      .post("/api/pages/:id/restore", authed(async ({ me, params }) => restorePage(me.id, id(params))))
      .post("/api/pages/:id/duplicate", authed(async ({ me, params, body }) => {
        const to = (body as DuplicatePage | null)?.to;
        if (typeof to !== "string") throw new InputError("to is required.");
        const source = await getPage(id(params));
        const live = source ? collab?.liveState(docName(source.workspace_id, pageDocName(source.id))) : undefined;
        return duplicatePage(me.id, id(params), to, live);
      }))
      .put("/api/pages/:id/favorite", authed(async ({ me, params }) => { await setFavorite(me.id, id(params), true); return { ok: true }; }))
      .delete("/api/pages/:id/favorite", authed(async ({ me, params }) => { await setFavorite(me.id, id(params), false); return { ok: true }; }))

      // Sharing --------------------------------------------------------------------------------------------------------
      .get("/api/pages/:id/share", authed(async ({ me, params }) => getShareState(me.id, id(params))))
      .post("/api/pages/:id/share", authed(async ({ me, params, body }) => shareWithPerson(me.id, id(params), body as NewShare)))
      .delete("/api/pages/:id/share/:uid", authed(async ({ me, params }) => { await removeShare(me.id, id(params), id(params, "uid")); return { ok: true }; }))
      .put("/api/pages/:id/public", authed(async ({ me, params }) => ({ publicToken: await setPublic(me.id, id(params), true) })))
      .delete("/api/pages/:id/public", authed(async ({ me, params }) => ({ publicToken: await setPublic(me.id, id(params), false) })))
      // Anyone with the link, signed in or not.
      .get("/api/public/:token", open(async ({ params }) => getPublicPage(id(params, "token"))))

      // Versions, export, assistant -------------------------------------------------------------------------------------
      .get("/api/pages/:id/snapshots", authed(async ({ me, params }) => ({ snapshots: await listSnapshots((await requireAccess(me.id, id(params), "edit")).page.workspace_id, id(params)) })))
      .get("/api/pages/:id/snapshots/:sid", authed(async ({ me, params }) => getSnapshot((await requireAccess(me.id, id(params), "edit")).page.workspace_id, id(params), id(params, "sid"))))
      .post("/api/pages/:id/snapshots", authed(async ({ me, params, body }) => saveSnapshot((await requireAccess(me.id, id(params), "edit")).page.workspace_id, id(params), body as NewSnapshot)))
      .get("/api/pages/:id/export", authed(async ({ me, params, query }) => {
        const { page } = await requireAccess(me.id, id(params), "view");
        const out = await exportPage(page.workspace_id, id(params), query.format === "text" ? "text" : "json");
        return new Response(out.body, { headers: { "content-type": out.type, "cache-control": "no-store" } });
      }))
      .get("/api/pages/:id/chat", authed(async ({ me, params }) => ({ messages: await getChat(me.id, id(params)) })))
      .put("/api/pages/:id/chat", authed(async ({ me, params, body }) => { await putChat(me.id, id(params), (body as { messages?: unknown }).messages); return { ok: true }; }))
      .delete("/api/pages/:id/chat", authed(async ({ me, params }) => { await clearChat(me.id, id(params)); return { ok: true }; }))

      // Comments, mentions, inbox --------------------------------------------------------------------------------------
      .get("/api/pages/:id/threads", authed(async ({ me, params }) => ({ threads: await listThreads(me.id, id(params)) })))
      .post("/api/pages/:id/threads", authed(async ({ me, params, body }) => startThread(me.id, id(params), body as NewThread)))
      .post("/api/threads/:tid/replies", authed(async ({ me, params, body }) => reply(me.id, id(params, "tid"), (body as { body?: string }).body ?? "")))
      .patch("/api/threads/:tid", authed(async ({ me, params, body }) => { await setResolved(me.id, id(params, "tid"), Boolean((body as { resolved?: boolean }).resolved)); return { ok: true }; }))
      .delete("/api/threads/:tid", authed(async ({ me, params }) => { await deleteThread(me.id, id(params, "tid")); return { ok: true }; }))
      .delete("/api/messages/:mid", authed(async ({ me, params }) => { await deleteMessage(me.id, id(params, "mid")); return { ok: true }; }))
      .post("/api/pages/:id/mentions", authed(async ({ me, params, body }) => {
        await requireAccess(me.id, id(params), "edit");
        return announceMentions(me.id, id(params), (body as { userIds?: string[] }).userIds ?? []);
      }))
      .get("/api/notifications", authed(async ({ me }) => listNotifications(me.id)))
      .post("/api/notifications/read", authed(async ({ me, body }) => { await markRead(me.id, (body ?? {}) as { ids?: string[]; all?: boolean }); return { ok: true }; }))
      .get("/api/search/context", authed(async ({ me, query }) => ({ pages: await contextPages(me.id, query.workspace ?? me.workspaceId, query.q ?? "") })))
      .get("/api/search", authed(async ({ me, query }) => ({ hits: await searchPages(me.id, query.workspace ?? me.workspaceId, query.q ?? "") })))

      // Files ----------------------------------------------------------------------------------------------------------
      .post("/api/files", authed(async ({ me, body }) => {
        const b = (body ?? {}) as { file?: File; pageId?: string; workspaceId?: string };
        return saveFile({ userId: me.id, file: b.file as File, ...(b.pageId ? { pageId: b.pageId } : {}), ...(b.workspaceId ? { workspaceId: b.workspaceId } : {}) });
      }))
      // Signed in or not: a page's files follow the page, and a public page's files are public with it.
      .get("/api/files/:id", open(async ({ params, request }) => {
        const session = await getSession(request);
        const workspaceId = await authorizeFileRead(session?.userId ?? null, id(params));
        const file = await readStoredFile(id(params), workspaceId, request.headers.get("if-none-match"));
        return new Response(file.body, { status: file.status, headers: file.headers });
      }))

      // Tickets --------------------------------------------------------------------------------------------------------
      .post("/api/tickets", authed(async ({ me, body }) => {
        const ticket = body as NewTicket;
        const { page } = await requireAccess(me.id, ticket.pageId, "edit");
        return addTicket({ workspaceId: page.workspace_id, userId: me.id, ticket });
      }))

      // AI -------------------------------------------------------------------------------------------------------------
      .post("/api/ai", authed(async ({ me, body, request }) => {
        const req = body as AiRequest;
        const { chat } = prepareAi(req, me.id);
        return new Response(streamAi(req, chat, request.signal), { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
      }))
  );
}
