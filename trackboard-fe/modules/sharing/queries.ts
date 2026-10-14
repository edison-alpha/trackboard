import { queryOptions } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { keys } from "@/lib/api/keys";
import type { InvitePreview, InviteSummary, ShareState } from "@/lib/api/types";

/** Who can open a page and how. The server only answers people who manage the page. */
export const shareQuery = (pageId: string) =>
  queryOptions({
    queryKey: keys.share(pageId),
    queryFn: () => api<ShareState>(`/api/pages/${pageId}/share`),
  });

/** Invite links still waiting to be used in a workspace (owners and admins only; empty for others). */
export const workspaceInvitesQuery = (workspaceId: string) =>
  queryOptions({
    queryKey: keys.workspaceInvites(workspaceId),
    queryFn: async (): Promise<InviteSummary[]> => (await api<{ invites: InviteSummary[] }>(`/api/workspaces/${encodeURIComponent(workspaceId)}/invites`)).invites,
  });

/** What an invite link is for, readable before signing in. */
export const invitePreviewQuery = (code: string) =>
  queryOptions({
    queryKey: keys.invite(code),
    queryFn: () => api<InvitePreview>(`/api/invites/${encodeURIComponent(code)}`),
    retry: false,
  });
