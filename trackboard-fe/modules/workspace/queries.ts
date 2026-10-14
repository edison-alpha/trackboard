import { queryOptions } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { keys } from "@/lib/api/keys";
import type { Member, PagesIndex, WorkspaceSummary } from "@/lib/api/types";

/** Workspaces this person belongs to, then the ones where they only have shared pages. */
export const workspacesQuery = queryOptions({
  queryKey: keys.workspaces,
  queryFn: async (): Promise<WorkspaceSummary[]> => (await api<{ workspaces: WorkspaceSummary[] }>("/api/workspaces")).workspaces,
});

/** Everything the page list needs for one workspace, already filtered to what this person may see. */
export const pagesQuery = (workspaceId: string) =>
  queryOptions({
    queryKey: keys.pages(workspaceId),
    queryFn: () => api<PagesIndex>(`/api/pages?workspace=${encodeURIComponent(workspaceId)}`),
  });

export const membersQuery = (workspaceId: string) =>
  queryOptions({
    queryKey: keys.members(workspaceId),
    queryFn: async (): Promise<Member[]> => (await api<{ members: Member[] }>(`/api/workspaces/${encodeURIComponent(workspaceId)}/members`)).members,
  });
