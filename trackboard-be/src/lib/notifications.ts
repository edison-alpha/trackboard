import type { MentionResult, NotificationKind, NotificationList, Person } from "@trackboard/api-types";
import { accessibleAmong } from "./access.ts";
import { db } from "./db/client.ts";
import { publish } from "./events.ts";
import { createId } from "./id.ts";

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n).trimEnd()}…` : s);

/**
 * Tells people about something that happened on a page. Only people who can still open the page are told, the person
 * who did it never is, and each gets a live event so their inbox refreshes.
 */
export async function notify(input: { userIds: string[]; kind: NotificationKind; pageId: string; actorId: string; threadId?: string; messageId?: string; preview?: string; quote?: string | null }): Promise<string[]> {
  const d = await db();
  const told: string[] = [];
  const at = Date.now();
  for (const userId of new Set(input.userIds)) {
    if (userId === input.actorId) continue;
    if (!(await accessibleAmong(userId, [input.pageId])).has(input.pageId)) continue;
    await d.query("insert into notifications (id, user_id, kind, page_id, actor_id, thread_id, message_id, preview, quote, at) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)", [
      createId(16), userId, input.kind, input.pageId, input.actorId, input.threadId ?? null, input.messageId ?? null, clip(input.preview ?? "", 180), input.quote ? clip(input.quote, 100) : null, at,
    ]);
    told.push(userId);
  }
  publish(told, { type: "notifications" });
  return told;
}

type Row = { id: string; kind: NotificationKind; at: string | number; read_at: string | number | null; page_id: string; page_title: string; page_icon: string | null; thread_id: string | null; actor_id: string; actor_name: string; actor_color: string; preview: string; quote: string | null };

const MAX_ITEMS = 100;

/** The person's notifications, newest first, leaving out pages they can no longer open or that are in the trash. */
export async function listNotifications(userId: string): Promise<NotificationList> {
  const rows = await (await db()).query<Row>(
    `select n.id, n.kind, n.at, n.read_at, n.page_id, p.title as page_title, p.icon as page_icon, n.thread_id, n.actor_id, u.name as actor_name, u.color as actor_color, n.preview, n.quote
       from notifications n join pages p on p.id = n.page_id join users u on u.id = n.actor_id
      where n.user_id = $1 and p.deleted_at is null order by n.at desc limit 300`,
    [userId],
  );
  const open = await accessibleAmong(userId, [...new Set(rows.map((r) => r.page_id))]);
  const items = rows
    .filter((r) => open.has(r.page_id))
    .slice(0, MAX_ITEMS)
    .map((r) => ({
      id: r.id, kind: r.kind, at: Number(r.at), read: r.read_at !== null, pageId: r.page_id, pageTitle: r.page_title.trim() || "Untitled", pageIcon: r.page_icon,
      threadId: r.thread_id, by: { id: r.actor_id, name: r.actor_name, color: r.actor_color }, preview: r.preview, quote: r.quote,
    }));
  return { items, unread: items.filter((i) => !i.read).length };
}

export async function markRead(userId: string, input: { ids?: string[]; all?: boolean }): Promise<void> {
  const d = await db();
  const now = Date.now();
  if (input.all) await d.query("update notifications set read_at = $2 where user_id = $1 and read_at is null", [userId, now]);
  else if (input.ids?.length) await d.query("update notifications set read_at = $2 where user_id = $1 and read_at is null and id = any($3::text[])", [userId, now, input.ids.slice(0, 500)]);
  publish([userId], { type: "notifications" });
}

/** Announces @mentions. People who cannot open the page are reported back so the writer can share it with them. */
export async function announceMentions(actorId: string, pageId: string, userIds: string[]): Promise<MentionResult> {
  const unique = [...new Set(userIds)].filter((id) => id !== actorId).slice(0, 50);
  const d = await db();
  const notified: string[] = [];
  const noAccess: Person[] = [];
  for (const userId of unique) {
    if (!(await accessibleAmong(userId, [pageId])).has(pageId)) {
      const [u] = await d.query<Person>("select id, name, color from users where id = $1", [userId]);
      if (u) noAccess.push(u);
      continue;
    }
    // One unread mention per page and person is enough; typing the same name again is not a second ping.
    const dup = await d.query("select 1 as ok from notifications where user_id = $1 and page_id = $2 and kind = 'mention' and read_at is null", [userId, pageId]);
    if (dup.length) continue;
    notified.push(...(await notify({ userIds: [userId], kind: "mention", pageId, actorId })));
  }
  return { notified, noAccess };
}
