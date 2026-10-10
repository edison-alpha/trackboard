"use client";

import { FileText, Keyboard, MagnifyingGlass, PencilSimple, Plus, SidebarSimple, Star, Trash, UserCircle, UserSwitch, Inbox as InboxIcon } from "@/components/icons";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { useInbox } from "@/modules/inbox";
import { Avatar } from "@/components/ui/avatar";
import { Button, IconButton } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { cx } from "@/lib/cx";
import { useStore } from "@/lib/store";
import { signOut } from "@/modules/profile";
import { setUi } from "@/modules/shell/lib/ui-store";
import { NoiseSwitch, ThemeSwitch } from "@/modules/theme";
import { ancestorsOf, childrenOf, displayTitle, favoritesOf, pageHref, trashOf, usePageActions, usePages, useWorkspace } from "@/modules/workspace";
import { drag } from "../lib/drag";
import { setExpanded } from "../lib/expanded";
import { TreeRow } from "./tree-row";

function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="mt-4">
      <div className="group flex h-7 items-center justify-between pr-1 pl-2">
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="rounded-md text-xs font-semibold text-ink-3 hover:text-ink">
          {title}
        </button>
        {action}
      </div>
      {open && children}
    </section>
  );
}

/** Workspace navigation. Same content in the desktop column and the phone drawer. */
export function Sidebar({ onNavigate, onCollapse }: { onNavigate?: () => void; onCollapse?: () => void }) {
  const pages = usePages();
  const { profile } = useWorkspace();
  const actions = usePageActions();
  const pathname = usePathname();
  const router = useRouter();
  const d = useStore(drag);
  const activeId = pathname.startsWith("/p/") ? pathname.slice(3) : null;
  const roots = childrenOf(pages, null);
  const favorites = favoritesOf(pages);
  const trashCount = trashOf(pages).length;
  const { unread } = useInbox();

  // Reveal the page you navigated to, wherever it sits in the tree.
  useEffect(() => {
    if (activeId) ancestorsOf(pages, activeId).forEach((p) => setExpanded(p.id, true));
  }, [activeId, pages]);

  const newPage = () => {
    actions.create();
    onNavigate?.();
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center justify-between gap-2 px-3">
        <Link href="/" onClick={onNavigate} className="rounded-lg" aria-label="Trackdocs home">
          <Logo />
        </Link>
        {onCollapse && (
          <IconButton label="Close sidebar (Ctrl/⌘ \)" size="sm" onClick={onCollapse}>
            <SidebarSimple size={18} />
          </IconButton>
        )}
      </div>

      <div className="grid gap-1 px-2">
        <button
          type="button"
          onClick={() => setUi({ palette: true, drawer: false })}
          className="flex h-9 items-center gap-2.5 rounded-(--radius-row) px-2.5 text-[14px] text-ink-2 hover:bg-(--sidebar-hover) hover:text-ink pointer-coarse:h-11"
        >
          <MagnifyingGlass size={17} />
          <span className="flex-1 text-left">Search</span>
          <Kbd keys="Mod+K" className="hidden md:inline-flex" />
        </button>
        <Link
          href="/inbox"
          onClick={onNavigate}
          aria-current={pathname === "/inbox" ? "page" : undefined}
          aria-label={unread ? `Inbox, ${unread} unread` : "Inbox"}
          className={cx(
            "flex h-9 items-center gap-2.5 rounded-(--radius-row) px-2.5 text-[14px] pointer-coarse:h-11",
            pathname === "/inbox" ? "bg-(--sidebar-active) font-medium text-ink" : "text-ink-2 hover:bg-(--sidebar-hover) hover:text-ink",
          )}
        >
          <InboxIcon size={17} />
          <span className="flex-1">Inbox</span>
          {unread > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-semibold text-on-accent">{unread > 99 ? "99+" : unread}</span>}
        </Link>
        <Button variant="primary" size="sm" icon={<Plus size={15} weight="bold" />} onClick={newPage} className="mt-1 justify-start">
          New page
        </Button>
      </div>

      <nav aria-label="Pages" className="thin-scroll mt-2 min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-2 pb-4">
        {favorites.length > 0 && (
          <Section title="Favorites">
            <ul className="grid grid-cols-[minmax(0,1fr)] gap-px">
              {favorites.map((p) => (
                <li key={p.id}>
                  <Link
                    href={pageHref(p.id)}
                    onClick={onNavigate}
                    aria-current={p.id === activeId ? "page" : undefined}
                    className={cx(
                      "flex h-8 items-center gap-2 rounded-(--radius-row) px-2.5 text-[14px] pointer-coarse:h-11",
                      p.id === activeId ? "bg-(--sidebar-active) font-medium text-ink" : "text-ink-2 hover:bg-(--sidebar-hover) hover:text-ink",
                    )}
                  >
                    <span className="flex size-5 items-center justify-center text-[15px]" aria-hidden="true">
                      {p.icon ?? <Star size={15} weight="fill" className="text-ink-3" />}
                    </span>
                    <span className="min-w-0 truncate">{displayTitle(p)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section
          title="Pages"
          action={
            <IconButton label="New page at the top level" size="sm" onClick={newPage}>
              <Plus size={14} weight="bold" />
            </IconButton>
          }
        >
          {roots.length === 0 ? (
            <div className="mx-1 rounded-(--radius-row) border border-dashed border-line-strong px-3 py-4 text-center text-[13px] text-ink-3">
              <FileText size={20} className="mx-auto mb-1.5" />
              No pages yet. Press <span className="font-medium text-ink-2">New page</span> to write the first one.
            </div>
          ) : (
            <ul role="tree" aria-label="Page tree" className="grid grid-cols-[minmax(0,1fr)] gap-px">
              {roots.map((p) => (
                <TreeRow key={p.id} page={p} depth={0} activeId={activeId} onNavigate={onNavigate} />
              ))}
            </ul>
          )}
          {/* Drop here to move a page to the top level, at the end. */}
          {d.dragId && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const id = drag.get().dragId;
                drag.set({ dragId: null, overId: null, zone: null });
                if (id) actions.move(id, null, childrenOf(pages, null).length);
              }}
              className="mt-1 rounded-(--radius-row) border border-dashed border-accent/60 py-2 text-center text-xs text-accent-ink"
            >
              Drop here to move to the top level
            </div>
          )}
        </Section>

      </nav>

      <div className="grid shrink-0 gap-2 border-t border-line p-2">
        <div className="flex items-center gap-1">
          <Menu>
            <MenuTrigger
              className="flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-(--radius-row) px-2 text-left hover:bg-(--sidebar-hover) data-[state=open]:bg-(--sidebar-hover) pointer-coarse:h-11"
              aria-label={`Profile: ${profile.name}`}
            >
              <Avatar name={profile.name} color={profile.color} size={26} />
              <span className="truncate text-[14px] font-medium text-ink">{profile.name}</span>
            </MenuTrigger>
            <MenuContent side="top" align="start" className="w-60">
              <MenuItem icon={<UserCircle size={16} />} onSelect={() => router.push("/profile")}>
                View profile
              </MenuItem>
              <MenuItem icon={<PencilSimple size={16} />} onSelect={() => setUi({ profile: true, drawer: false })}>
                Change name and color
              </MenuItem>
              <MenuItem icon={<UserSwitch size={16} />} onSelect={signOut}>
                Switch person in this tab
              </MenuItem>
            </MenuContent>
          </Menu>
          {/* Trash lives with the tools, not among pages: you rarely open it, so it should not take a slot in the tree. */}
          <Link
            href="/trash"
            onClick={onNavigate}
            aria-current={pathname === "/trash" ? "page" : undefined}
            aria-label={trashCount ? `Trash, ${trashCount} ${trashCount === 1 ? "page" : "pages"}` : "Trash"}
            title="Trash"
            className={cx(
              "relative inline-flex size-7 shrink-0 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-(--sidebar-hover) hover:text-ink pointer-coarse:size-10",
              pathname === "/trash" && "bg-(--sidebar-active) text-ink",
            )}
          >
            <Trash size={17} />
            {trashCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-surface-3 px-1 text-[10px] font-semibold text-ink-2">{trashCount}</span>
            )}
          </Link>
          <IconButton label="Keyboard shortcuts (Ctrl/⌘ /)" size="sm" onClick={() => setUi({ shortcuts: true, drawer: false })}>
            <Keyboard size={17} />
          </IconButton>
        </div>
        <div className="flex items-center gap-1">
          <NoiseSwitch />
          <ThemeSwitch className="flex-1" />
        </div>
      </div>
    </div>
  );
}
