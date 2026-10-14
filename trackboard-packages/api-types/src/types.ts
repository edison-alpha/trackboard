/* Wire types shared by trackboard-be and trackboard-fe. Plain JSON only: no classes, no Dates (timestamps are epoch ms). */

export type Visibility = "private" | "workspace";
export type Permission = "view" | "edit";
export type Access = "none" | "view" | "edit" | "manage";
export type WorkspaceRole = "owner" | "admin" | "member";

/* ---------- people and workspaces ---------- */

export type Me = {
  id: string;
  /** The workspace opened by default: the person's own. */
  workspaceId: string;
  email: string;
  name: string;
  color: string;
  /** Collected by onboarding; null until the person finishes it. */
  role: string | null;
  focus: string[];
  onboardingDone: boolean;
};

export type MeUpdate = {
  name?: string;
  color?: string;
  role?: string | null;
  focus?: string[];
  onboardingDone?: boolean;
};

export type SessionResponse = { user: Me | null };

/** Someone shown next to a page, comment or cursor. */
export type Person = { id: string; name: string; color: string };

/** `guest` = not a member, but a page of this workspace was shared with them. */
export type WorkspaceSummary = { id: string; name: string; role: WorkspaceRole | "guest"; personal: boolean };

export type Member = Person & { email: string; role: WorkspaceRole };

/* ---------- pages ---------- */

export type TicketLink = { id: string; title: string; url: string | null; provider: "trackdocs"; linkedAt: number };

/** What the page list needs about a page, already filtered to what the viewer may see. */
export type PageMeta = {
  id: string;
  workspaceId: string;
  parentId: string | null;
  title: string;
  /** Emoji chosen by the user, or null for the default page icon. */
  icon: string | null;
  /** Cover key from COVERS, an image URL, or null. */
  cover: string | null;
  /** Vertical focus of an image cover, 0 (top) to 100 (bottom). */
  coverY: number;
  /** Sort key among siblings; fractional so a move rewrites one page only. */
  position: number;
  /** Reading layout: normal keeps the table of contents, center centers the article, full uses the available width. */
  pageWidth: "normal" | "center" | "full";
  fullWidth: boolean;
  /** Template id to apply the first time the page opens with an empty document. */
  template: string | null;
  visibility: Visibility;
  /** What every workspace member can do when the page is shared with the workspace. */
  workspacePermission: Permission;
  /** Set while the page has a public link. Only people who manage the page see it. */
  publicToken: string | null;
  createdAt: number;
  createdBy: string;
  updatedAt: number;
  /** Set when moved to trash. Descendants are hidden with it and come back with it. */
  deletedAt: number | null;
  /** The first lines of the page as plain text, for the home feed. */
  preview: string;
  /** This viewer's own favourite. */
  favorite: boolean;
  /** What this viewer may do with the page. */
  access: Exclude<Access, "none">;
  /** Everyone who edited the page (person id -> last edit time), for the contributors row. */
  editors: Record<string, number>;
  linkedTickets: TicketLink[];
};

export type PagesIndex = { workspace: WorkspaceSummary; pages: PageMeta[]; people: Person[] };

export type NewPage = {
  /** Chosen by the app so it can open the page before the server answers. */
  id: string;
  workspaceId: string;
  parentId?: string | null;
  title?: string;
  icon?: string | null;
  template?: string | null;
  position?: number;
  /** Only for a top-level page: start it shared with the workspace instead of private. A subpage follows its parent. */
  visibility?: Visibility;
};

export type PagePatch = {
  title?: string;
  icon?: string | null;
  cover?: string | null;
  coverY?: number;
  pageWidth?: "normal" | "center" | "full";
  fullWidth?: boolean;
  template?: string | null;
  /** Changing who can see the page needs `manage`. */
  visibility?: Visibility;
  workspacePermission?: Permission;
};

export type MovePage = { parentId: string | null; position: number };
export type DuplicatePage = { to: string };
export type PurgePages = { ids: string[] };

/* ---------- sharing and invites ---------- */

export type PageShare = { user: Person & { email: string }; permission: Permission };

export type InviteSummary = {
  id: string;
  code: string;
  kind: "workspace" | "page";
  /** Role for a workspace invite, permission for a page invite. */
  level: WorkspaceRole | Permission;
  email: string | null;
  expiresAt: number;
  url: string;
};

export type ShareState = {
  visibility: Visibility;
  workspacePermission: Permission;
  publicToken: string | null;
  shares: PageShare[];
  invites: InviteSummary[];
};

/** Share with someone who already has an account (`userId`) or by email (an invite link when there is no account yet). */
export type NewShare = { userId?: string; email?: string; permission: Permission };
export type ShareResult = { kind: "shared"; person: Person } | { kind: "invited"; invite: InviteSummary };

export type NewInvite = { role: Exclude<WorkspaceRole, "owner">; email?: string; days?: number };

export type InvitePreview = {
  kind: "workspace" | "page";
  workspaceName: string;
  pageTitle: string | null;
  inviter: string;
  level: WorkspaceRole | Permission;
  /** Set when the invite only works for one Google account. */
  email: string | null;
  expired: boolean;
};

export type AcceptedInvite = { kind: "workspace" | "page"; workspaceId: string; pageId: string | null };

export type NewWorkspace = { name: string };
export type WorkspacePatch = { name: string };
export type MemberPatch = { role: Exclude<WorkspaceRole, "owner"> };

/* ---------- versions, files, tickets ---------- */

export type SnapshotAuthor = { name: string; color: string };

/** A stored version of a page. `update` is the Yjs state, base64. */
export type SnapshotMeta = { id: string; at: number; label: string | null; author: SnapshotAuthor };
export type Snapshot = SnapshotMeta & { update: string };
export type NewSnapshot = { label: string | null; author: SnapshotAuthor; update: string };

export type FileRecord = { id: string; name: string; mime: string; size: number; url: string };

export type NewTicket = { action: "create" | "link"; pageId: string; title: string; description: string; ticketId?: string };

/** Markdown and HTML are produced in the editor (it owns the custom blocks); the server serves the stored read copy. */
export type ExportFormat = "json" | "text";

/* ---------- comments and notifications ---------- */

export type CommentMessage = { id: string; body: string; at: number; author: Person };
export type Thread = { id: string; pageId: string; quote: string; resolved: boolean; createdAt: number; messages: CommentMessage[] };
export type NewThread = { id: string; quote: string; body: string };

export type NotificationKind = "mention" | "comment" | "reply" | "share";

export type Notification = {
  id: string;
  kind: NotificationKind;
  at: number;
  read: boolean;
  pageId: string;
  pageTitle: string;
  pageIcon: string | null;
  threadId: string | null;
  by: Person;
  preview: string;
  /** The text a comment thread is anchored to. */
  quote: string | null;
};

export type NotificationList = { items: Notification[]; unread: number };

/** Result of announcing mentions: people who were told, and people who cannot open the page yet. */
export type MentionResult = { notified: string[]; noAccess: Person[] };

/* ---------- search, activity, public pages ---------- */

export type SearchHit = { pageId: string; title: string; icon: string | null; snippet: string | null; updatedAt: number };

/** A page the assistant may use to answer a question about the workspace. `partial` = the text was cut to fit. */
export type ContextPage = { id: string; title: string; text: string; partial: boolean };

export type ActivityDay = { date: string; count: number };

export type PublicPage = {
  title: string;
  icon: string | null;
  cover: string | null;
  coverY: number;
  pageWidth: "normal" | "center" | "full";
  /** ProseMirror JSON, the same shape `editor.getJSON()` returns. */
  content: unknown;
};

export type HealthResponse = { ok: boolean; database: "postgres" | "pglite" | "unreachable"; google: boolean; ai: boolean };

export type ApiError = { error: string; requestId?: string };

/** One line of the live event stream. The app refetches what the event names; events carry no data. */
export type ServerEvent =
  | { type: "pages"; workspaceId: string }
  | { type: "comments"; pageId: string }
  | { type: "notifications" }
  | { type: "members"; workspaceId: string };
