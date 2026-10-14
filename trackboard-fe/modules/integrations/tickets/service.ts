import { api } from "@/lib/api/client";
import type { NewTicket, TicketLink } from "@/lib/api/types";

export type { TicketLink };
export type TicketRequest = NewTicket;

/** Creates a ticket (or links an existing one) on the server and returns what the page keeps. */
export function sendTicketRequest(input: TicketRequest): Promise<TicketLink> {
  return api<TicketLink>("/api/tickets", { body: input });
}
