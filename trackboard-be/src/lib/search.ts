import type { ContextPage, SearchHit } from "@trackboard/api-types";
import { computeAccess, type Permission, type Visibility, type WorkspaceRole } from "@trackboard/shared";
import { db } from "./db/client.ts";
import { workspaceFor } from "./workspaces.ts";

type Row = {
  id: string; title: string; icon: string | null; updated_at: string | number; created_by: string; visibility: Visibility; workspace_permission: Permission;
  share: Permission | null; role: WorkspaceRole | null; text: string | null; title_hit: boolean;
};

const MAX_HITS = 20;

/** Pages in one workspace whose title or text contains the query, limited to what this person may open. */
export async function searchPages(userId: string, workspaceId: string, query: string): Promise<SearchHit[]> {
  await workspaceFor(userId, workspaceId);
  const q = query.trim().slice(0, 100);
  if (!q) return [];
  // LIKE wildcards in what the person typed are ordinary characters.
  const like = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
  const rows = await (await db()).query<Row>(
    `select p.id, p.title, p.icon, p.updated_at, p.created_by, p.visibility, p.workspace_permission, s.permission as share, m.role as role, d.text,
            (p.title ilike $3) as title_hit
       from pages p
       left join page_shares s on s.page_id = p.id and s.user_id = $1
       left join workspace_members m on m.workspace_id = p.workspace_id and m.user_id = $1
       left join documents d on d.name = p.workspace_id || '/page:' || p.id
      where p.workspace_id = $2 and p.deleted_at is null
        and (p.created_by = $1 or s.user_id is not null or (m.user_id is not null and p.visibility = 'workspace'))
        and (p.title ilike $3 or d.text ilike $3)
      order by title_hit desc, p.updated_at desc limit 60`,
    [userId, workspaceId, like],
  );
  const needle = q.toLowerCase();
  return rows
    .filter((r) => computeAccess({ userId, createdBy: r.created_by, visibility: r.visibility, workspacePermission: r.workspace_permission, share: r.share, role: r.role }) !== "none")
    .slice(0, MAX_HITS)
    .map((r) => {
      const at = r.text ? r.text.toLowerCase().indexOf(needle) : -1;
      let snippet: string | null = null;
      if (at >= 0 && r.text) {
        const start = Math.max(0, at - 40);
        snippet = (start > 0 ? "…" : "") + r.text.slice(start, at + needle.length + 60).replace(/\s+/g, " ").trim() + "…";
      }
      return { pageId: r.id, title: r.title.trim() || "Untitled", icon: r.icon, snippet, updatedAt: Number(r.updated_at) };
    });
}

const PER_PAGE = 8000;
const TOTAL = 60_000;
const MAX_CONTEXT_PAGES = 6;
const words = (s: string) => s.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [];

/**
 * Picks the pages most likely to answer a question for the assistant: keyword hits in the title count triple. Falls back
 * to the most recently edited pages when nothing matches. Only pages this person can open are considered, and long pages
 * are cut and flagged so the answer can say what it was based on.
 */
export async function contextPages(userId: string, workspaceId: string, question: string): Promise<ContextPage[]> {
  await workspaceFor(userId, workspaceId);
  const rows = await (await db()).query<Row>(
    `select p.id, p.title, p.icon, p.updated_at, p.created_by, p.visibility, p.workspace_permission, s.permission as share, m.role as role, d.text, false as title_hit
       from pages p
       left join page_shares s on s.page_id = p.id and s.user_id = $1
       left join workspace_members m on m.workspace_id = p.workspace_id and m.user_id = $1
       left join documents d on d.name = p.workspace_id || '/page:' || p.id
      where p.workspace_id = $2 and p.deleted_at is null
        and (p.created_by = $1 or s.user_id is not null or (m.user_id is not null and p.visibility = 'workspace'))
      order by p.updated_at desc limit 300`,
    [userId, workspaceId],
  );
  const terms = [...new Set(words(question))];
  const open = rows
    .filter((r) => computeAccess({ userId, createdBy: r.created_by, visibility: r.visibility, workspacePermission: r.workspace_permission, share: r.share, role: r.role }) !== "none")
    .map((r) => ({ id: r.id, title: r.title.trim() || "Untitled", text: r.text ?? "", updatedAt: Number(r.updated_at) }))
    .filter((p) => p.text.trim() || p.title !== "Untitled");
  const scored = open.map((p) => {
    const title = p.title.toLowerCase();
    const body = p.text.toLowerCase();
    return { p, score: terms.reduce((n, t) => n + (title.includes(t) ? 3 : 0) + Math.min(body.split(t).length - 1, 10), 0) };
  });
  const ranked = scored.some((x) => x.score > 0) ? scored.filter((x) => x.score > 0).sort((a, b) => b.score - a.score) : scored.sort((a, b) => b.p.updatedAt - a.p.updatedAt);
  const out: ContextPage[] = [];
  let used = 0;
  for (const { p } of ranked.slice(0, MAX_CONTEXT_PAGES)) {
    const room = Math.min(PER_PAGE, TOTAL - used);
    if (room <= 200) break;
    const text = p.text.slice(0, room);
    used += text.length;
    out.push({ id: p.id, title: p.title, text, partial: p.text.length > text.length });
  }
  return out;
}
