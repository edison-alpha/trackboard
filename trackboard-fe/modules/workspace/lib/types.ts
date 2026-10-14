import type { TicketLink } from "@/modules/integrations/tickets/service";

export type PageMeta = {
  id: string;
  parentId: string | null;
  title: string;
  /** Emoji chosen by the user, or null for the default page icon. */
  icon: string | null;
  /** Cover key from COVERS, an image data URL, or null. */
  cover: string | null;
  /** Vertical focus of an image cover, 0 (top) to 100 (bottom). */
  coverY: number;
  /** Sort key among siblings; fractional so a move rewrites one page only. */
  position: number;
  favorite: boolean;
  fullWidth: boolean;
  /** Reading layout: normal keeps the table of contents, center centers the article, full uses the available width. */
  pageWidth: "normal" | "center" | "full";
  createdAt: number;
  createdBy: string;
  updatedAt: number;
  /** Set when moved to trash. Descendants are hidden with it and come back with it. */
  deletedAt: number | null;
  /** Plain text of the document, kept for search across pages. */
  text: string;
  /** Template id to apply the first time the page opens with an empty document. */
  template: string | null;
  /** Everyone who edited the page (profile id -> last edit time), for the contributors row. */
  editors: Record<string, number>;
  linkedTickets: TicketLink[];
};

export type Person = { id: string; name: string; color: string };

export type PageMap = ReadonlyMap<string, PageMeta>;

export const pageDocName = (id: string) => `page:${id}`;
export const WORKSPACE_DOC = "workspace:default";

/** The name the server stores a document under: scoped by workspace so one person's pages never open in another's. */
export const scopedDocName = (workspaceId: string, local: string) => `${workspaceId}/${local}`;
