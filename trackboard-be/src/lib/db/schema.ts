/**
 * Ordered, append-only migrations. Each statement ends with ";" and a newline (the runner splits on that), so keep
 * one statement per block and never put ";\n" inside a string. Never edit an applied migration: add a new one.
 */
export const MIGRATIONS: { id: string; sql: string }[] = [
  {
    id: "001_init",
    sql: `
create table users (
  id text primary key,
  google_sub text not null unique,
  email text not null,
  name text not null,
  color text not null,
  role text,
  focus jsonb not null default '[]',
  onboarding_done boolean not null default false,
  created_at bigint not null
);
create table workspaces (
  id text primary key,
  name text not null,
  created_at bigint not null
);
create table workspace_members (
  workspace_id text not null references workspaces(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  role text not null default 'member',
  primary key (workspace_id, user_id)
);
create index workspace_members_user on workspace_members (user_id);
create table documents (
  name text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  ydoc bytea not null,
  content_json jsonb,
  text text not null default '',
  updated_at bigint not null
);
create index documents_workspace on documents (workspace_id);
create table snapshots (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  page_id text not null,
  label text,
  author_name text not null,
  author_color text not null,
  ydoc bytea not null,
  created_at bigint not null
);
create index snapshots_page on snapshots (workspace_id, page_id, created_at desc);
create table files (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  name text not null,
  mime text not null,
  size bigint not null,
  sha256 text not null,
  created_by text not null references users(id),
  created_at bigint not null
);
create table tickets (
  id text primary key,
  ticket_ref text not null,
  workspace_id text not null references workspaces(id) on delete cascade,
  page_id text not null,
  title text not null,
  url text,
  provider text not null default 'trackdocs',
  created_by text not null references users(id),
  linked_at bigint not null
);
create index tickets_page on tickets (workspace_id, page_id);
`,
  },
  {
    id: "002_sharing",
    sql: `
alter table workspaces add column personal boolean not null default false;
update workspaces set personal = true;
alter table files add column page_id text;
create table pages (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  parent_id text references pages(id) on delete cascade,
  title text not null default '',
  icon text,
  cover text,
  cover_y integer not null default 50,
  position double precision not null default 0,
  page_width text not null default 'center',
  full_width boolean not null default false,
  template text,
  visibility text not null default 'private',
  workspace_permission text not null default 'edit',
  public_token text unique,
  created_by text not null references users(id),
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint
);
create index pages_workspace on pages (workspace_id);
create index pages_parent on pages (parent_id);
create table page_shares (
  page_id text not null references pages(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  permission text not null,
  created_at bigint not null,
  primary key (page_id, user_id)
);
create index page_shares_user on page_shares (user_id);
create table page_favorites (
  user_id text not null references users(id) on delete cascade,
  page_id text not null references pages(id) on delete cascade,
  primary key (user_id, page_id)
);
create table page_editors (
  page_id text not null references pages(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  last_at bigint not null,
  primary key (page_id, user_id)
);
create table invites (
  id text primary key,
  code text not null unique,
  kind text not null,
  workspace_id text not null references workspaces(id) on delete cascade,
  page_id text references pages(id) on delete cascade,
  level text not null,
  email text,
  created_by text not null references users(id),
  created_at bigint not null,
  expires_at bigint not null,
  accepted_by text references users(id),
  accepted_at bigint,
  revoked_at bigint
);
create index invites_workspace on invites (workspace_id);
create table comment_threads (
  id text primary key,
  page_id text not null references pages(id) on delete cascade,
  quote text not null default '',
  resolved boolean not null default false,
  created_by text not null references users(id),
  created_at bigint not null
);
create index comment_threads_page on comment_threads (page_id);
create table comment_messages (
  id text primary key,
  thread_id text not null references comment_threads(id) on delete cascade,
  author_id text not null references users(id),
  body text not null,
  created_at bigint not null
);
create index comment_messages_thread on comment_messages (thread_id, created_at);
create table notifications (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  kind text not null,
  page_id text not null references pages(id) on delete cascade,
  actor_id text not null references users(id),
  thread_id text,
  message_id text,
  preview text not null default '',
  quote text,
  at bigint not null,
  read_at bigint
);
create index notifications_user on notifications (user_id, at desc);
create table user_activity (
  user_id text not null references users(id) on delete cascade,
  day text not null,
  windows integer not null default 0,
  primary key (user_id, day)
);
create table ai_chats (
  user_id text not null references users(id) on delete cascade,
  page_id text not null references pages(id) on delete cascade,
  messages jsonb not null default '[]',
  updated_at bigint not null,
  primary key (user_id, page_id)
);
`,
  },
];
