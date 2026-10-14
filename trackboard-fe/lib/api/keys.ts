/** Every query key in one place, so what a server event refetches is easy to see and to change. */
export const keys = {
  session: ["session"] as const,
  workspaces: ["workspaces"] as const,
  pages: (workspaceId: string) => ["pages", workspaceId] as const,
  /** All page lists, whatever the workspace. */
  allPages: ["pages"] as const,
  members: (workspaceId: string) => ["members", workspaceId] as const,
  workspaceInvites: (workspaceId: string) => ["workspace-invites", workspaceId] as const,
  share: (pageId: string) => ["share", pageId] as const,
  threads: (pageId: string) => ["threads", pageId] as const,
  snapshots: (pageId: string) => ["snapshots", pageId] as const,
  snapshot: (pageId: string, id: string) => ["snapshot", pageId, id] as const,
  chat: (pageId: string) => ["chat", pageId] as const,
  notifications: ["notifications"] as const,
  search: (workspaceId: string, q: string) => ["search", workspaceId, q] as const,
  activity: ["activity"] as const,
  invite: (code: string) => ["invite", code] as const,
  publicPage: (token: string) => ["public", token] as const,
};
