"use client";

import { ArrowsHorizontal, Check, ImageSquare, Smiley, X } from "@/components/icons";
import { useDebouncer } from "@tanstack/react-pacer";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button, IconButton } from "@/components/ui/button";
import { cx } from "@/lib/cx";
import { formatDateTime, timeAgo } from "@/lib/time";
import { usePageActions, usePeople, type PageMeta, type Person } from "@/modules/workspace";
import { coverBackground, isImageCover } from "../lib/covers";
import { CoverPicker } from "./cover-picker";
import { IconPicker } from "./icon-picker";

/**
 * Full-width cover band, pulled up under the top bar (h-14) so it runs to the top edge.
 * Image covers can be repositioned: drag the image up or down, or use the arrow keys, then save.
 */
export function PageCover({ page }: { page: PageMeta }) {
  const actions = usePageActions();
  const [moving, setMoving] = useState(false);
  const [y, setY] = useState(page.coverY);
  const drag = useRef<{ startY: number; startPos: number; height: number } | null>(null);
  const coverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moving) setY(page.coverY);
  }, [page.coverY, moving]);

  if (!page.cover) return <div className="h-8 sm:h-14" />;
  const image = isImageCover(page.cover);
  const clamp = (n: number) => Math.round(Math.max(0, Math.min(100, n)));

  const save = () => {
    actions.update(page.id, { coverY: y });
    setMoving(false);
  };
  const cancel = () => {
    setY(page.coverY);
    setMoving(false);
  };

  return (
    <div
      ref={coverRef}
      className={cx(
        "group/cover relative -mt-14 h-[calc(22vh+56px)] min-h-44 w-full select-none sm:h-[calc(28vh+56px)]",
        moving && "cursor-grab touch-none outline-2 outline-offset-[-2px] outline-accent active:cursor-grabbing",
      )}
      style={{ background: coverBackground(page.cover, y) }}
      {...(moving && {
        role: "slider",
        tabIndex: 0,
        "aria-label": "Cover position",
        "aria-valuemin": 0,
        "aria-valuemax": 100,
        "aria-valuenow": y,
        onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { startY: e.clientY, startPos: y, height: e.currentTarget.clientHeight };
        },
        onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
          const d = drag.current;
          // Dragging the image down reveals more of its top, so the focus point moves up.
          if (d) setY(clamp(d.startPos - ((e.clientY - d.startY) / d.height) * 100));
        },
        onPointerUp: () => (drag.current = null),
        onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
          if (e.key === "ArrowUp") (e.preventDefault(), setY((v) => clamp(v - 5)));
          if (e.key === "ArrowDown") (e.preventDefault(), setY((v) => clamp(v + 5)));
          if (e.key === "Enter") (e.preventDefault(), save());
          if (e.key === "Escape") (e.preventDefault(), cancel());
        },
      })}
    >
      {moving ? (
        <>
          <p className="glass pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full px-4 py-1.5 text-sm font-medium text-ink">
            Drag the image to reposition
          </p>
          <div
            className="absolute top-1/2 right-3 flex -translate-y-1/2 flex-col gap-1 rounded-2xl p-1 opacity-0 glass transition-opacity group-hover/cover:opacity-100 focus-within:opacity-100"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <IconButton label="Cancel repositioning" size="sm" onClick={cancel}>
              <X size={17} />
            </IconButton>
            <IconButton label="Save cover position" size="sm" active onClick={save}>
              <Check size={17} weight="bold" />
            </IconButton>
          </div>
        </>
      ) : page.access === "view" ? null : (
        <div className="absolute top-1/2 right-3 flex -translate-y-1/2 flex-col gap-1 rounded-2xl p-1 opacity-0 glass transition-opacity group-hover/cover:opacity-100 focus-within:opacity-100">
          {image && (
            <IconButton
              label="Reposition cover"
              size="sm"
              onClick={() => {
                setMoving(true);
                requestAnimationFrame(() => coverRef.current?.focus());
              }}
            >
              <ArrowsHorizontal size={17} />
            </IconButton>
          )}
          <CoverPicker value={page.cover} pageId={page.id} onChange={(cover) => actions.edit(page.id, { cover, coverY: 50 })}>
            <IconButton label="Change cover" size="sm">
              <ImageSquare size={17} />
            </IconButton>
          </CoverPicker>
        </div>
      )}
    </div>
  );
}

/** Creator · contributors · last updated, under the title. */
function PageMetaRow({ page }: { page: PageMeta }) {
  const people = usePeople();
  const fallback = (id: string): Person => ({ id, name: "Unknown person", color: "#666666" });
  const creator = people.get(page.createdBy) ?? fallback(page.createdBy);
  const contributors = Object.entries(page.editors)
    .filter(([id]) => id !== page.createdBy)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => people.get(id) ?? fallback(id));

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[13px] text-ink-3">
      <span className="flex items-center gap-1.5">
        <Avatar name={creator.name} color={creator.color} size={20} />
        <span className="font-medium text-ink-2">{creator.name}</span>
      </span>
      {contributors.length > 0 && (
        <>
          <span aria-hidden="true">•</span>
          <span className="flex items-center gap-1.5" title={contributors.map((c) => c.name).join(", ")}>
            <span className="flex items-center gap-1">
              {contributors.slice(0, 4).map((c) => (
                <Avatar key={c.id} name={c.name} color={c.color} size={20} ring />
              ))}
            </span>
            <span>{contributors.length === 1 ? contributors[0]?.name : `${contributors.length} contributors`}</span>
          </span>
        </>
      )}
      <span aria-hidden="true">•</span>
      <span title={formatDateTime(page.updatedAt)}>Last updated {timeAgo(page.updatedAt)}</span>
    </div>
  );
}

/** Icon, title and meta row. Lives in the same column as the document so everything shares one left edge. */
export function PageTitleBlock({ page, onEnter }: { page: PageMeta; onEnter: () => void }) {
  const actions = usePageActions();
  const ref = useRef<HTMLTextAreaElement>(null);
  const canEdit = page.access !== "view";
  // What this person is typing, or null when they are not: then the title is whatever the server has, so a rename
  // by someone else shows up without ever overwriting a word being typed.
  const [draft, setDraft] = useState<string | null>(null);
  const title = draft ?? page.title;
  // Typing saves after a short pause, and leaving the field saves at once.
  const save = useDebouncer((value: string) => actions.edit(page.id, { title: value }), { wait: 600 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [title]);

  return (
    <div className="group/header mb-6">
      {page.icon && canEdit && (
        <IconPicker value={page.icon} onChange={(icon) => actions.edit(page.id, { icon })}>
          <button
            type="button"
            aria-label="Change page icon"
            className={cx("relative z-10 -ml-1.5 flex size-[76px] items-center justify-center rounded-2xl text-[58px] leading-none transition-colors hover:bg-surface-2", page.cover && "-mt-11")}
          >
            {page.icon}
          </button>
        </IconPicker>
      )}

      {page.icon && !canEdit && (
        <span aria-hidden="true" className={cx("relative z-10 -ml-1.5 flex size-[76px] items-center justify-center text-[58px] leading-none", page.cover && "-mt-11")}>
          {page.icon}
        </span>
      )}

      <div className={cx("mt-2 flex h-8 gap-1 opacity-0 transition-opacity group-hover/header:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-100", !canEdit && "hidden")}>
        {!page.icon && (
          <IconPicker value={null} onChange={(icon) => actions.edit(page.id, { icon })}>
            <Button size="sm" variant="ghost" icon={<Smiley size={16} />} className="-ml-3">
              Add icon
            </Button>
          </IconPicker>
        )}
        {!page.cover && (
          <CoverPicker value={null} pageId={page.id} onChange={(cover) => actions.edit(page.id, { cover })}>
            <Button size="sm" variant="ghost" icon={<ImageSquare size={16} />} className={page.icon ? "-ml-3" : undefined}>
              Add cover
            </Button>
          </CoverPicker>
        )}
      </div>

      <textarea
        ref={ref}
        rows={1}
        value={title}
        readOnly={!canEdit}
        placeholder="Untitled"
        aria-label="Page title"
        onFocus={() => setDraft(page.title)}
        onBlur={() => {
          save.flush();
          setDraft(null);
        }}
        onChange={(e) => {
          setDraft(e.target.value);
          save.maybeExecute(e.target.value.trim());
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || (e.key === "ArrowDown" && e.currentTarget.selectionStart === title.length)) {
            e.preventDefault();
            onEnter();
          }
        }}
        className="block w-full resize-none overflow-hidden bg-transparent p-0 text-[30px] leading-tight font-bold tracking-[-0.02em] text-ink outline-none placeholder:text-ink-3 sm:text-[40px]"
      />
      <PageMetaRow page={page} />
    </div>
  );
}
