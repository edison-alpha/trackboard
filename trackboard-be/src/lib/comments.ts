import type { CommentMessage, NewThread, Thread } from "@trackboard/api-types";
import { ID_PATTERN } from "@trackboard/shared";
import { requireAccess } from "./access.ts";
import { db } from "./db/client.ts";
import { InputError, NotFoundError } from "./errors.ts";
import { publishComments } from "./events.ts";
import { createId } from "./id.ts";
import { notify } from "./notifications.ts";

type MsgRow = { id: string; thread_id: string; body: string; created_at: string | number; author_id: string; author_name: string; author_color: string };
type ThreadRow = { id: string; page_id: string; quote: string; resolved: boolean; created_at: string | number };

const message = (m: MsgRow): CommentMessage => ({ id: m.id, body: m.body, at: Number(m.created_at), author: { id: m.author_id, name: m.author_name, color: m.author_color } });

const body = (v: unknown): string => {
  const s = String(v ?? "").trim();
  if (!s) throw new InputError("Write a comment first.");
  if (s.length > 4000) throw new InputError("That comment is too long.");
  return s;
};

export async function listThreads(userId: string, pageId: string): Promise<Thread[]> {
  await requireAccess(userId, pageId, "view");
  const d = await db();
  const threads = await d.query<ThreadRow>("select id, page_id, quote, resolved, created_at from comment_threads where page_id = $1 order by created_at", [pageId]);
  if (!threads.length) return [];
  const msgs = await d.query<MsgRow>(
    `select m.id, m.thread_id, m.body, m.created_at, u.id as author_id, u.name as author_name, u.color as author_color
       from comment_messages m join users u on u.id = m.author_id where m.thread_id = any($1::text[]) order by m.created_at`,
    [threads.map((t) => t.id)],
  );
  return threads.map((t) => ({ id: t.id, pageId: t.page_id, quote: t.quote, resolved: t.resolved, createdAt: Number(t.created_at), messages: msgs.filter((m) => m.thread_id === t.id).map(message) }));
}

/** The people a comment on this page concerns: whoever made the page, and whoever has written in it. */
async function pageStakeholders(pageId: string): Promise<string[]> {
  const rows = await (await db()).query<{ id: string }>("select created_by as id from pages where id = $1 union select user_id from page_editors where page_id = $1", [pageId]);
  return rows.map((r) => r.id);
}

/** A new thread anchored to a passage. Needs edit, because the anchor is a mark written into the page. */
export async function startThread(userId: string, pageId: string, input: NewThread): Promise<Thread> {
  await requireAccess(userId, pageId, "edit");
  if (!ID_PATTERN.test(input.id ?? "")) throw new InputError("Invalid thread id.");
  const text = body(input.body);
  const quote = String(input.quote ?? "").slice(0, 500);
  const messageId = createId(16);
  const now = Date.now();
  await (await db()).tx(async (t) => {
    await t.query("insert into comment_threads (id, page_id, quote, created_by, created_at) values ($1, $2, $3, $4, $5)", [input.id, pageId, quote, userId, now]);
    await t.query("insert into comment_messages (id, thread_id, author_id, body, created_at) values ($1, $2, $3, $4, $5)", [messageId, input.id, userId, text, now]);
  });
  await notify({ userIds: await pageStakeholders(pageId), kind: "comment", pageId, actorId: userId, threadId: input.id, messageId, preview: text, quote });
  void publishComments(pageId);
  return (await listThreads(userId, pageId)).find((t) => t.id === input.id)!;
}

async function threadPage(threadId: string): Promise<{ pageId: string; createdBy: string }> {
  const [t] = await (await db()).query<{ page_id: string; created_by: string }>("select page_id, created_by from comment_threads where id = $1", [threadId]);
  if (!t) throw new NotFoundError("That comment thread no longer exists.");
  return { pageId: t.page_id, createdBy: t.created_by };
}

/** Anyone who can open the page may reply, viewers included. */
export async function reply(userId: string, threadId: string, text: string): Promise<CommentMessage> {
  const { pageId } = await threadPage(threadId);
  await requireAccess(userId, pageId, "view");
  const clean = body(text);
  const d = await db();
  const id = createId(16);
  const now = Date.now();
  await d.query("insert into comment_messages (id, thread_id, author_id, body, created_at) values ($1, $2, $3, $4, $5)", [id, threadId, userId, clean, now]);
  const authors = await d.query<{ author_id: string }>("select distinct author_id from comment_messages where thread_id = $1", [threadId]);
  const [t] = await d.query<{ quote: string }>("select quote from comment_threads where id = $1", [threadId]);
  await notify({ userIds: [...authors.map((a) => a.author_id), ...(await pageStakeholders(pageId))], kind: "reply", pageId, actorId: userId, threadId, messageId: id, preview: clean, quote: t?.quote ?? null });
  void publishComments(pageId);
  const [row] = await d.query<MsgRow>(
    "select m.id, m.thread_id, m.body, m.created_at, u.id as author_id, u.name as author_name, u.color as author_color from comment_messages m join users u on u.id = m.author_id where m.id = $1",
    [id],
  );
  return message(row!);
}

export async function setResolved(userId: string, threadId: string, resolved: boolean): Promise<void> {
  const { pageId } = await threadPage(threadId);
  await requireAccess(userId, pageId, "edit");
  await (await db()).query("update comment_threads set resolved = $2 where id = $1", [threadId, Boolean(resolved)]);
  void publishComments(pageId);
}

export async function deleteThread(userId: string, threadId: string): Promise<void> {
  const { pageId } = await threadPage(threadId);
  await requireAccess(userId, pageId, "edit");
  await (await db()).query("delete from comment_threads where id = $1", [threadId]);
  void publishComments(pageId);
}

/** The author may delete their own message; so may anyone who manages the page. The last message takes its thread with it. */
export async function deleteMessage(userId: string, messageId: string): Promise<void> {
  const d = await db();
  const [m] = await d.query<{ thread_id: string; author_id: string }>("select thread_id, author_id from comment_messages where id = $1", [messageId]);
  if (!m) throw new NotFoundError("That comment no longer exists.");
  const { pageId } = await threadPage(m.thread_id);
  await requireAccess(userId, pageId, m.author_id === userId ? "view" : "manage");
  await d.query("delete from comment_messages where id = $1", [messageId]);
  const left = await d.query("select 1 as ok from comment_messages where thread_id = $1", [m.thread_id]);
  if (!left.length) await d.query("delete from comment_threads where id = $1", [m.thread_id]);
  void publishComments(pageId);
}
