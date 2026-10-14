export type { PageMeta, Person, WorkspaceSummary, PagesIndex, Access } from "@/lib/api/types";
import type { PageMeta } from "@/lib/api/types";

export type PageMap = ReadonlyMap<string, PageMeta>;

/** Local name of a page's document; `scopedDocName` adds the workspace, which is how the server stores it. */
export const pageDocName = (id: string) => `page:${id}`;
export const scopedDocName = (workspaceId: string, local: string) => `${workspaceId}/${local}`;
