"use client";

import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CaretRight,
  Copy,
  DotsThree,
  FileText,
  PencilSimple,
  Plus,
  Star,
  Trash,
} from "@/components/icons";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { cx } from "@/lib/cx";
import { useStore } from "@/lib/store";
import { childrenOf, displayTitle, pageHref, usePageActions, usePages, type PageMeta } from "@/modules/workspace";
import { drag, zoneFor } from "../lib/drag";
import { setExpanded, useExpanded } from "../lib/expanded";

type Props = { page: PageMeta; depth: number; activeId: string | null; onNavigate?: () => void };

export function TreeRow({ page, depth, activeId, onNavigate }: Props) {
  const pages = usePages();
  const actions = usePageActions();
  const expandedSet = useExpanded();
  const d = useStore(drag);
  const kids = childrenOf(pages, page.id);
  const open = expandedSet.has(page.id);
  const active = page.id === activeId;
  const [renaming, setRenaming] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);

  const isOver = d.overId === page.id && d.dragId !== page.id;

  const addChild = () => {
    setExpanded(page.id, true);
    actions.create({ parentId: page.id });
    onNavigate?.();
  };

  return (
    <li className="min-w-0" role="treeitem" aria-expanded={kids.length ? open : undefined} aria-selected={active} aria-level={depth + 1}>
      <div
        ref={rowRef}
        draggable={!renaming}
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", page.id);
          drag.set({ dragId: page.id, overId: null, zone: null });
        }}
        onDragEnd={() => drag.set({ dragId: null, overId: null, zone: null })}
        onDragOver={(e) => {
          if (!d.dragId || d.dragId === page.id) return;
          e.preventDefault();
          const zone = zoneFor(e, e.currentTarget);
          if (d.overId !== page.id || d.zone !== zone) drag.set({ ...d, overId: page.id, zone });
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) drag.set({ ...drag.get(), overId: null, zone: null });
        }}
        onDrop={(e) => {
          e.preventDefault();
          const id = drag.get().dragId;
          const zone = drag.get().zone;
          drag.set({ dragId: null, overId: null, zone: null });
          if (!id || id === page.id || !zone) return;
          if (zone === "inside") {
            if (actions.move(id, page.id, childrenOf(pages, page.id).length)) setExpanded(page.id, true);
          } else {
            const siblings = childrenOf(pages, page.parentId).filter((p) => p.id !== id);
            const i = siblings.findIndex((p) => p.id === page.id);
            actions.move(id, page.parentId, zone === "before" ? i : i + 1);
          }
        }}
        className={cx(
          "group relative flex h-8 items-center gap-1 rounded-(--radius-row) pr-1 text-[14px] transition-colors pointer-coarse:h-11",
          active ? "bg-(--sidebar-active) font-medium text-ink" : "text-ink-2 hover:bg-(--sidebar-hover) hover:text-ink",
          d.dragId === page.id && "opacity-40",
          isOver && d.zone === "inside" && "bg-accent-soft ring-1 ring-accent/50",
        )}
        style={{ paddingLeft: 4 + depth * 14 }}
      >
        {isOver && d.zone !== "inside" && <span className={cx("pointer-events-none absolute right-1 left-2 h-0.5 rounded-full bg-accent", d.zone === "before" ? "-top-px" : "-bottom-px")} />}

        <button
          type="button"
          aria-label={open ? `Collapse ${displayTitle(page)}` : `Expand ${displayTitle(page)}`}
          onClick={() => setExpanded(page.id, !open)}
          className={cx("flex size-6 shrink-0 items-center justify-center rounded-md text-ink-3 hover:bg-(--sidebar-active) hover:text-ink pointer-coarse:size-9", !kids.length && "invisible")}
          tabIndex={kids.length ? 0 : -1}
        >
          <CaretRight size={12} weight="bold" className={cx("transition-transform duration-150", open && "rotate-90")} />
        </button>

        {renaming ? (
          <RenameInput page={page} onDone={() => setRenaming(false)} />
        ) : (
          <Link
            href={pageHref(page.id)}
            onClick={onNavigate}
            draggable={false}
            aria-current={active ? "page" : undefined}
            onDoubleClick={() => setRenaming(true)}
            className="flex min-w-0 flex-1 items-center gap-2 self-stretch rounded-md outline-offset-[-2px]"
          >
            <span className="flex size-5 shrink-0 items-center justify-center text-[15px]" aria-hidden="true">
              {page.icon ?? <FileText size={16} />}
            </span>
            <span className="min-w-0 truncate">{displayTitle(page)}</span>
          </Link>
        )}

        <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 has-[[data-state=open]]:opacity-100 pointer-coarse:opacity-100">
          <Menu>
            <MenuTrigger
              aria-label={`Options for ${displayTitle(page)}`}
              className="flex size-6 items-center justify-center rounded-md text-ink-3 hover:bg-(--sidebar-active) hover:text-ink pointer-coarse:size-9"
            >
              <DotsThree size={16} weight="bold" />
            </MenuTrigger>
            <MenuContent align="start" side="right">
              <MenuItem icon={<Plus size={16} />} onSelect={addChild}>
                Add page inside
              </MenuItem>
              <MenuItem icon={<PencilSimple size={16} />} onSelect={() => setTimeout(() => setRenaming(true), 0)}>
                Rename
              </MenuItem>
              <MenuItem icon={<Star size={16} weight={page.favorite ? "fill" : "regular"} />} onSelect={() => actions.toggleFavorite(page.id)}>
                {page.favorite ? "Remove from favorites" : "Add to favorites"}
              </MenuItem>
              <MenuItem icon={<Copy size={16} />} onSelect={() => void actions.duplicate(page.id)}>
                Duplicate
              </MenuItem>
              <MenuSeparator />
              <MenuItem icon={<ArrowUp size={16} />} onSelect={() => actions.nudge(page.id, -1)}>
                Move up
              </MenuItem>
              <MenuItem icon={<ArrowDown size={16} />} onSelect={() => actions.nudge(page.id, 1)}>
                Move down
              </MenuItem>
              <MenuItem icon={<ArrowRight size={16} />} onSelect={() => actions.indent(page.id, "in")}>
                Nest under the page above
              </MenuItem>
              {page.parentId && (
                <MenuItem icon={<ArrowLeft size={16} />} onSelect={() => actions.indent(page.id, "out")}>
                  Move out one level
                </MenuItem>
              )}
              <MenuSeparator />
              <MenuItem danger icon={<Trash size={16} />} onSelect={() => actions.trash(page.id)}>
                Move to trash
              </MenuItem>
            </MenuContent>
          </Menu>
          <button
            type="button"
            aria-label={`Add a page inside ${displayTitle(page)}`}
            title="Add page inside"
            onClick={addChild}
            className="flex size-6 items-center justify-center rounded-md text-ink-3 hover:bg-(--sidebar-active) hover:text-ink pointer-coarse:size-9"
          >
            <Plus size={14} weight="bold" />
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open && kids.length > 0 && (
          <motion.ul
            role="group"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="overflow-hidden"
          >
            {kids.map((k) => (
              <TreeRow key={k.id} page={k} depth={depth + 1} activeId={activeId} onNavigate={onNavigate} />
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </li>
  );
}

function RenameInput({ page, onDone }: { page: PageMeta; onDone: () => void }) {
  const actions = usePageActions();
  const [value, setValue] = useState(page.title);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.select(), []);
  const commit = () => {
    if (value !== page.title) actions.edit(page.id, { title: value.trim() });
    onDone();
  };
  return (
    <input
      ref={ref}
      autoFocus
      value={value}
      aria-label="Page name"
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") onDone();
      }}
      className="h-7 min-w-0 flex-1 rounded-md border border-accent bg-bg px-1.5 text-[14px] text-ink outline-none"
    />
  );
}
