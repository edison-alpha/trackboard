export type TicketLink = {
  id: string;
  title: string;
  url: string | null;
  provider: "trackdocs";
  linkedAt: number;
};

export type TicketRequest = {
  action: "create" | "link";
  pageId: string;
  title: string;
  description: string;
  ticketId?: string;
};

const STORAGE_KEY = "trackdocs-local-tickets";

function readTickets(): TicketLink[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as TicketLink[];
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export async function sendTicketRequest(input: TicketRequest): Promise<TicketLink> {
  const existing = readTickets();
  const ticket: TicketLink = {
    id: input.action === "link" ? input.ticketId?.trim() ?? "" : `LOCAL-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    title: input.title.trim(),
    url: null,
    provider: "trackdocs",
    linkedAt: Date.now(),
  };
  if (!ticket.id) throw new Error("Enter a ticket id to link.");
  if (input.action === "create") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...existing, ticket]));
  }
  return ticket;
}
