"use client";

import { ChatCircleText, FileText, LinkSimple, Star } from "@/components/icons";
import type { TableOfContentDataItem } from "@tiptap/extension-table-of-contents";
import type { Editor } from "@tiptap/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { InlineLoader } from "@/components/brand/loading-screen";
import { Button, IconButton } from "@/components/ui/button";
import { askConfirm, askText } from "@/components/ui/prompt";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { cx } from "@/lib/cx";
import { createId } from "@/lib/id";
import { PresenceAvatars, SyncStatus, useCollabDoc, usePresence, type CollabDoc } from "@/modules/collab";
import { AiComposer, AiDock } from "@/modules/ai";
import { CommentsPanel, threadRequest, useThreads, type CommentDraft } from "@/modules/comments";
import { recordMention } from "@/modules/inbox";
import { useStore } from "@/lib/store";
import { DocEditor, TableOfContents } from "@/modules/editor";
import { HistoryPanel, useAutoSnapshot } from "@/modules/history";
import { TicketActions } from "@/modules/integrations/tickets";
import { setUi, togglePanel, Topbar, useUi } from "@/modules/shell";
import { templateById } from "@/modules/templates";
import {
  ancestorsOf,
  displayTitle,
  isTrashed,
  livePages,
  pageDocName,
  pageHref,
  usePage,
  usePageActions,
  usePages,
  usePeople,
  useWorkspace,
  type PageMeta,
} from "@/modules/workspace";
import { PageCover, PageTitleBlock } from "./page-header";
import { PageMenu } from "./page-menu";

function Breadcrumbs({ page }: { page: PageMeta }) {
  const pages = usePages();
  const chain = ancestorsOf(pages, page.id);
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1 text-sm text-ink-2">
        {chain.map((p) => (
          <li key={p.id} className="hidden min-w-0 items-center gap-1 sm:flex">
            <Link href={pageHref(p.id)} className="max-w-36 truncate rounded-md px-1.5 py-1 hover:bg-surface-2 hover:text-ink">
              {p.icon && <span className="mr-1">{p.icon}</span>}
              {displayTitle(p)}
            </Link>
            <span aria-hidden="true" className="text-ink-3">
              /
            </span>
          </li>
        ))}
        <li className="flex min-w-0 items-center gap-1.5 px-1.5 font-medium text-ink" aria-current="page">
          <span aria-hidden="true">{page.icon ?? <FileText size={15} />}</span>
          <span className="truncate">{displayTitle(page)}</span>
        </li>
      </ol>
    </nav>
  );
}

/** Route-level component: resolves the page, opens its document, and handles missing / trashed pages. */
export function PageView({ pageId }: { pageId: string }) {
  const page = usePage(pageId);
  const pages = usePages();
  const actions = usePageActions();
  const router = useRouter();

  if (!page) {
    return (
      <>
        <Topbar />
        <EmptyState
          title="Page not found"
          body="It was deleted for good, or the link comes from another workspace."
          action={
            <Button variant="primary" onClick={() => router.push("/")}>
              Back to home
            </Button>
          }
        />
      </>
    );
  }

  const trashed = isTrashed(pages, page.id);

  return (
    <>
      {trashed && (
        <div role="status" className="flex flex-wrap items-center justify-center gap-3 bg-danger-soft px-4 py-2.5 text-sm text-danger" data-print-hide>
          <span className="font-medium">This page is in the trash.</span>
          <Button size="sm" variant="glass" onClick={() => actions.restore(page.deletedAt ? page.id : (ancestorsOf(pages, page.id).find((p) => p.deletedAt)?.id ?? page.id))}>
            Restore
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={async () => {
              const ok = await askConfirm({ title: "Delete for good?", body: "This page and every page inside it will be gone. This can't be undone.", confirmLabel: "Delete for good", danger: true });
              if (ok) {
                await actions.deleteForever(page.id);
                router.push("/trash");
              }
            }}
          >
            Delete for good
          </Button>
        </div>
      )}
      <PageDocument key={page.id} page={page} />
    </>
  );
}

function PageDocument({ page }: { page: PageMeta }) {
  const state = useCollabDoc(pageDocName(page.id));
  if (state.status === "error") {
    return (
      <>
        <Topbar>
          <Breadcrumbs page={page} />
        </Topbar>
        <ErrorState
          title="Couldn't open this page"
          body={`The document didn't load from browser storage (${state.error.message}). Reload to try again.`}
          action={
            <Button variant="primary" onClick={() => location.reload()}>
              Reload
            </Button>
          }
        />
      </>
    );
  }
  if (state.status === "loading") {
    return (
      <>
        <Topbar>
          <Breadcrumbs page={page} />
        </Topbar>
        <InlineLoader label="Opening page" />
      </>
    );
  }
  return <LoadedPage page={page} collab={state.collab} />;
}

function LoadedPage({ page, collab }: { page: PageMeta; collab: CollabDoc }) {
  const { profile, doc } = useWorkspace();
  const pages = usePages();
  const actions = usePageActions();
  const { panel } = useUi();
  const [editor, setEditor] = useState<Editor | null>(null);
  const [toc, setToc] = useState<TableOfContentDataItem[]>([]);
  const [draft, setDraft] = useState<CommentDraft | null>(null);
  const [activeThread, setActiveThread] = useState<string | null>(null);
  const [ticketDialogOpen, setTicketDialogOpen] = useState(false);
  const users = usePresence(collab.awareness);
  const threads = useThreads(page.id);
  const openCount = threads.filter((t) => !t.resolved).length;
  const pagesRef = useRef(pages);
  pagesRef.current = pages;
  const people = usePeople();
  const peopleRef = useRef(people);
  peopleRef.current = people;

  const user = useMemo(() => ({ id: profile.id, name: profile.name, color: profile.color }), [profile]);
  useAutoSnapshot(page.id, collab.doc, { name: profile.name, color: profile.color });

  // Keep the caret label in sync when the profile changes.
  useEffect(() => {
    editor?.commands.updateUser?.(user);
  }, [editor, user]);

  // Opened from the inbox: show the comments panel on the thread that was clicked.
  const requested = useStore(threadRequest, null);
  useEffect(() => {
    if (!requested || requested.pageId !== page.id) return;
    setActiveThread(requested.threadId);
    setUi({ panel: "comments" });
    threadRequest.set(null);
  }, [requested, page.id]);

  const template = page.template ? (templateById(page.template)?.html ?? null) : null;

  const startComment = useCallback((e: Editor) => {
    const { from, to } = e.state.selection;
    const quote = e.state.doc.textBetween(from, to, " ");
    const threadId = createId();
    e.chain().setComment(threadId).run();
    setDraft({ threadId, quote });
    setActiveThread(threadId);
    setUi({ panel: "comments" });
  }, []);

  const context = useMemo(
    () => ({
      createSubpage: () => {
        const id = actions.create({ parentId: page.id, open: false });
        return { id, title: "Untitled" };
      },
      prompt: (title: string, placeholder: string) => askText({ title, placeholder }),
    }),
    [actions, page.id],
  );

  const mentions = useMemo(
    () => ({
      pages: () => livePages(pagesRef.current).filter((p) => p.id !== page.id),
      // Everyone who has opened this workspace, not only who is on the page right now.
      people: () => [...peopleRef.current.values()].filter((p) => p.id !== profile.id),
    }),
    [page.id],
  );

  return (
    <div className={cx("flex min-h-full flex-col transition-[padding] duration-200", panel && "lg:pr-[380px]")}>
      <Topbar
        overCover={!!page.cover}
        actions={
          <>
            <SyncStatus status={collab.status} />
            <div className="ml-1 hidden sm:block">
              <PresenceAvatars users={users} />
            </div>
            <IconButton
              label={`Comments${openCount ? ` (${openCount} open)` : ""} (Alt+C)`}
              active={panel === "comments"}
              onClick={() => togglePanel("comments")}
              className="relative ml-1"
            >
              <ChatCircleText size={19} />
              {openCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-on-accent">{openCount}</span>
              )}
            </IconButton>
            <Button variant="ghost" size="sm" icon={<LinkSimple size={17} />} onClick={() => setTicketDialogOpen(true)} className="hidden sm:inline-flex">
              Task
            </Button>
            <IconButton label={page.favorite ? "Remove from favorites (Alt+S)" : "Add to favorites (Alt+S)"} active={page.favorite} onClick={() => actions.toggleFavorite(page.id)}>
              <Star size={19} weight={page.favorite ? "fill" : "regular"} />
            </IconButton>
            <PageMenu page={page} editor={editor} />
          </>
        }
      >
        <Breadcrumbs page={page} />
      </Topbar>

      <main className="flex flex-1 flex-col">
        <PageCover page={page} />
        <div
          className={cx(
            "mx-auto flex w-full gap-10 px-5 sm:px-12",
            page.pageWidth === "full" && "max-w-none",
            page.pageWidth === "center" && "max-w-[760px]",
            page.pageWidth === "normal" && "max-w-[760px] xl:max-w-[1040px]",
          )}
        >
          <article className={cx("min-w-0 flex-1", page.pageWidth === "normal" && "xl:max-w-[760px]")}>
            <PageTitleBlock page={page} onEnter={() => editor?.commands.focus("start")} />
            <DocEditor
              collab={collab}
              user={user}
              context={context}
              mentions={mentions}
              template={template}
              onTemplateApplied={() => actions.update(page.id, { template: null })}
              onLocalChange={(text) => actions.edit(page.id, { text })}
              onMention={(ids) => ids.forEach((userId) => recordMention(doc, { pageId: page.id, userId, by: profile.id }))}
              onTocUpdate={(data) => setToc(data)}
              onComment={startComment}
              onCommentActivate={(id) => {
                setActiveThread(id);
                setUi({ panel: "comments" });
              }}
              onReady={setEditor}
            />
          </article>
          {page.pageWidth === "normal" && toc.length > 1 && (
            <aside className="sticky top-20 mt-28 hidden h-fit max-h-[calc(100dvh-120px)] w-56 shrink-0 overflow-y-auto xl:block" data-print-hide>
              <TableOfContents items={toc} editor={editor} />
            </aside>
          )}
        </div>
        <AiDock editor={editor} pageId={page.id} pageTitle={page.title} />
      </main>

      <CommentsPanel
        open={panel === "comments"}
        onClose={() => setUi({ panel: null })}
        pageId={page.id}
        editor={editor}
        draft={draft}
        onDraftDone={() => setDraft(null)}
        activeId={activeThread}
        onActivate={setActiveThread}
      />
      {editor && <AiComposer editor={editor} pageTitle={page.title} onTitle={(title) => title && actions.edit(page.id, { title })} />}
      <HistoryPanel open={panel === "history"} onClose={() => setUi({ panel: null })} pageId={page.id} doc={collab.doc} editor={editor} author={{ name: profile.name, color: profile.color }} />
      <TicketActions
        open={ticketDialogOpen}
        onOpenChange={setTicketDialogOpen}
        pageId={page.id}
        pageTitle={displayTitle(page)}
        pageText={page.text}
        linkedTickets={page.linkedTickets}
        onLinked={(ticket) => {
          if (!page.linkedTickets.some((linked) => linked.id === ticket.id)) actions.update(page.id, { linkedTickets: [...page.linkedTickets, ticket] });
        }}
      />
    </div>
  );
}
