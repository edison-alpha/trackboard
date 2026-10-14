import type { NewTicket, TicketLink } from "@trackboard/api-types";
import { ID_PATTERN } from "@trackboard/shared";
import { db } from "./db/client.ts";
import { InputError } from "./errors.ts";
import { createId } from "./id.ts";

/** Creates a local ticket, or records a link to an existing one, and returns what the page keeps. */
export async function addTicket(input: { workspaceId: string; userId: string; ticket: NewTicket }): Promise<TicketLink> {
  const t = input.ticket;
  if (t.action !== "create" && t.action !== "link") throw new InputError("Unknown ticket action.");
  if (!ID_PATTERN.test(t.pageId ?? "")) throw new InputError("Invalid page id.");
  const title = String(t.title ?? "").trim().slice(0, 200);
  const ref = t.action === "link" ? String(t.ticketId ?? "").trim().slice(0, 64) : `LOCAL-${createId(8).toUpperCase()}`;
  if (!ref) throw new InputError("Enter a ticket id to link.");
  const linkedAt = Date.now();
  await (await db()).query("insert into tickets (id, ticket_ref, workspace_id, page_id, title, url, provider, created_by, linked_at) values ($1, $2, $3, $4, $5, null, 'trackdocs', $6, $7)", [
    createId(), ref, input.workspaceId, t.pageId, title, input.userId, linkedAt,
  ]);
  return { id: ref, title, url: null, provider: "trackdocs", linkedAt };
}

export async function deleteTickets(workspaceId: string, pageIds: string[]): Promise<void> {
  if (!pageIds.length) return;
  await (await db()).query("delete from tickets where workspace_id = $1 and page_id = any($2::text[])", [workspaceId, pageIds]);
}
