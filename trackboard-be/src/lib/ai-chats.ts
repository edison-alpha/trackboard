import { requireAccess } from "./access.ts";
import { db } from "./db/client.ts";
import { InputError } from "./errors.ts";

const MAX_MESSAGES = 40;
const MAX_BYTES = 200_000;

/** One person's conversation with the assistant about one page. Private to them; they only need to be able to read the page. */
export async function getChat(userId: string, pageId: string): Promise<unknown[]> {
  await requireAccess(userId, pageId, "view");
  const [row] = await (await db()).query<{ messages: unknown }>("select messages from ai_chats where user_id = $1 and page_id = $2", [userId, pageId]);
  const messages = typeof row?.messages === "string" ? JSON.parse(row.messages) : row?.messages;
  return Array.isArray(messages) ? messages : [];
}

export async function putChat(userId: string, pageId: string, messages: unknown): Promise<void> {
  await requireAccess(userId, pageId, "view");
  if (!Array.isArray(messages)) throw new InputError("messages must be a list.");
  const kept = messages.slice(-MAX_MESSAGES);
  const json = JSON.stringify(kept);
  if (json.length > MAX_BYTES) throw new InputError("That conversation is too large to save.");
  await (await db()).query(
    "insert into ai_chats (user_id, page_id, messages, updated_at) values ($1, $2, $3::jsonb, $4) on conflict (user_id, page_id) do update set messages = excluded.messages, updated_at = excluded.updated_at",
    [userId, pageId, json, Date.now()],
  );
}

export async function clearChat(userId: string, pageId: string): Promise<void> {
  await (await db()).query("delete from ai_chats where user_id = $1 and page_id = $2", [userId, pageId]);
}
