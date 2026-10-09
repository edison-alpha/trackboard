"use client";

import { FilePlus, FileText, MagnifyingGlass, Star } from "@/components/icons";
import { motion } from "motion/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { KeyHint } from "@/components/ui/kbd";
import { EmptyState } from "@/components/ui/states";
import { timeAgo } from "@/lib/time";
import { setUi, Topbar } from "@/modules/shell";
import { ancestorsOf, displayTitle, favoritesOf, pageHref, recentOf, usePageActions, usePages, useWorkspace, type PageMeta } from "@/modules/workspace";

/** One page in the feed: icon, title, the first lines of the page, and when it changed. */
function FeedItem({ page, path }: { page: PageMeta; path: string }) {
  const preview = page.text.replace(/\s+/g, " ").trim().slice(0, 180);
  return (
    <Link href={pageHref(page.id)} className="group flex gap-4 rounded-(--radius-card) px-4 py-4 transition-colors hover:bg-surface-2/70 sm:px-5">
      <span className="flex size-9 shrink-0 items-center justify-center text-2xl" aria-hidden="true">
        {page.icon ?? <FileText size={22} className="text-ink-2" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-3">
          <span className="min-w-0 flex-1 truncate text-[16px] font-semibold text-ink">{displayTitle(page)}</span>
          <span className="shrink-0 text-xs text-ink-3">{timeAgo(page.updatedAt)}</span>
        </span>
        {path && <span className="mt-0.5 block truncate text-xs text-ink-3">{path}</span>}
        <span className="mt-1 line-clamp-2 block text-[15px] leading-relaxed text-ink-2">{preview || "Nothing written yet."}</span>
      </span>
    </Link>
  );
}

/** Search field pinned in the top bar. It opens the command palette, which does the actual searching. */
function SearchBar() {
  return (
    <button
      type="button"
      onClick={() => setUi({ palette: true })}
      className="mx-auto flex h-10 w-full max-w-[560px] items-center gap-2.5 rounded-full bg-surface-2 px-4 text-left text-[15px] text-ink-3 transition-colors hover:bg-surface-3 pointer-coarse:h-11"
    >
      <MagnifyingGlass size={18} />
      <span className="min-w-0 flex-1 truncate">Search pages and commands</span>
      <KeyHint keys="Mod+K" className="hidden sm:inline" />
    </button>
  );
}

/** Landing view of the workspace: where you left off, and the ways to start something new. */
export function HomeView() {
  const pages = usePages();
  const { profile } = useWorkspace();
  const actions = usePageActions();
  const recent = recentOf(pages, 12);
  const favorites = favoritesOf(pages);
  const path = (p: PageMeta) => ancestorsOf(pages, p.id).map(displayTitle).join(" / ");

  return (
    <>
      <Topbar>
        <SearchBar />
      </Topbar>
      <main className="mx-auto w-full max-w-[720px] px-4 pt-6 pb-16 sm:px-6 sm:pt-10">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.26, ease: "easeOut" }}>
          <h1 className="px-1 text-[30px] leading-tight font-bold tracking-[-0.02em] sm:text-[36px]">Hi, {profile.name.split(" ")[0]}</h1>

          <section aria-label="Start" className="mt-6 rounded-(--radius-card) bg-surface-2 p-5 sm:p-6">
            <p className="text-sm font-medium text-ink-3">Start here</p>
            <p className="mt-1.5 text-[16px] leading-relaxed text-ink">
              Write a new page, or start from a meeting, spec, or procedure template.
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button variant="glass" size="sm" onClick={() => setUi({ templates: true })}>
                Use a template
              </Button>
              <Button variant="primary" size="sm" icon={<FilePlus size={16} />} onClick={() => actions.create()}>
                New page
              </Button>
            </div>
          </section>
        </motion.div>

        {favorites.length > 0 && (
          <section className="mt-10" aria-labelledby="fav-title">
            <h2 id="fav-title" className="mb-1 flex items-center gap-1.5 px-1 text-sm font-semibold text-ink-2">
              <Star size={15} weight="fill" /> Favorites
            </h2>
            <ul className="-mx-4 sm:-mx-5">
              {favorites.map((p) => (
                <li key={p.id}>
                  <FeedItem page={p} path={path(p)} />
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-10" aria-labelledby="recent-title">
          <h2 id="recent-title" className="mb-1 px-1 text-sm font-semibold text-ink-2">
            Recently edited
          </h2>
          {recent.length === 0 ? (
            <EmptyState title="No pages yet" body="Pages you create or edit show up here, newest first." className="py-10" />
          ) : (
            <ul className="-mx-4 sm:-mx-5">
              {recent.map((p) => (
                <li key={p.id}>
                  <FeedItem page={p} path={path(p)} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
