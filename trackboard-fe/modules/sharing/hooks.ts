"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import { keys } from "@/lib/api/keys";
import type { AcceptedInvite, InviteSummary, MemberPatch, NewInvite, NewShare, Permission, ShareResult, WorkspaceSummary } from "@/lib/api/types";
import { setActiveWorkspace } from "@/modules/workspace/lib/active";

/** Sharing one page: add people, change or take away their access, and turn the public link on or off. */
export function useShareActions(pageId: string) {
  const queryClient = useQueryClient();
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: keys.share(pageId) });
    void queryClient.invalidateQueries({ queryKey: keys.allPages });
  };

  const share = useMutation({
    mutationFn: (v: NewShare) => api<ShareResult>(`/api/pages/${pageId}/share`, { body: v }),
    onSuccess: (result, v) => {
      if (result.kind === "shared") toast.success(`${result.person.name} can now ${v.permission === "edit" ? "edit" : "view"} this page`);
    },
    onSettled: refresh,
  });
  const remove = useMutation({
    mutationFn: (userId: string) => api(`/api/pages/${pageId}/share/${userId}`, { method: "DELETE" }),
    onSettled: refresh,
  });
  const publish = useMutation({
    mutationFn: (on: boolean) => api<{ publicToken: string | null }>(`/api/pages/${pageId}/public`, { method: on ? "PUT" : "DELETE" }),
    onSettled: refresh,
  });
  const cancelInvite = useMutation({
    mutationFn: (code: string) => api(`/api/invites/${code}`, { method: "DELETE" }),
    onSettled: refresh,
  });
  return { share, remove, publish, cancelInvite };
}

/** The workspace as a team: members and roles, invite links, and its name. */
export function useWorkspaceActions(workspaceId: string) {
  const queryClient = useQueryClient();
  const refreshMembers = () => {
    void queryClient.invalidateQueries({ queryKey: keys.members(workspaceId) });
    void queryClient.invalidateQueries({ queryKey: keys.workspaces });
  };
  const refreshInvites = () => queryClient.invalidateQueries({ queryKey: keys.workspaceInvites(workspaceId) });

  const invite = useMutation({
    mutationFn: (v: NewInvite) => api<InviteSummary>(`/api/workspaces/${workspaceId}/invites`, { body: v }),
    onSettled: refreshInvites,
  });
  const cancelInvite = useMutation({
    mutationFn: (code: string) => api(`/api/invites/${code}`, { method: "DELETE" }),
    onSettled: refreshInvites,
  });
  const setRole = useMutation({
    mutationFn: (v: { userId: string } & MemberPatch) => api(`/api/workspaces/${workspaceId}/members/${v.userId}`, { method: "PATCH", body: { role: v.role } }),
    onSettled: refreshMembers,
  });
  const removeMember = useMutation({
    mutationFn: (userId: string) => api(`/api/workspaces/${workspaceId}/members/${userId}`, { method: "DELETE" }),
    onSettled: refreshMembers,
  });
  const rename = useMutation({
    mutationFn: (name: string) => api<WorkspaceSummary>(`/api/workspaces/${workspaceId}`, { method: "PATCH", body: { name } }),
    onSettled: refreshMembers,
  });
  return { invite, cancelInvite, setRole, removeMember, rename };
}

/** Makes a new team workspace and opens it. */
export function useCreateWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api<WorkspaceSummary>("/api/workspaces", { body: { name } }),
    onSuccess: (workspace) => {
      void queryClient.invalidateQueries({ queryKey: keys.workspaces });
      setActiveWorkspace(workspace.id);
    },
  });
}

/** Accepts an invite link: joins the workspace or opens the page, then switches to where it leads. */
export function useAcceptInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => api<AcceptedInvite>(`/api/invites/${code}/accept`, { method: "POST" }),
    onSuccess: (accepted) => {
      setActiveWorkspace(accepted.workspaceId);
      void queryClient.invalidateQueries({ queryKey: keys.workspaces });
      void queryClient.invalidateQueries({ queryKey: keys.allPages });
    },
  });
}

export const permissionLabel = (p: Permission) => (p === "edit" ? "Can edit" : "Can view");
