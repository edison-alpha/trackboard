"use client";

import type { SuggestionProps } from "@tiptap/suggestion";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import type { SuggestionListHandle } from "../lib/suggestion-renderer";

type Props<I> = SuggestionProps<I> & {
  label: string;
  empty: string;
  renderItem: (item: I, active: boolean) => ReactNode;
  getKey: (item: I) => string;
  /** Optional group heading shown above the first item of each group. */
  getGroup?: (item: I) => string | undefined;
  /** Grid layout for emoji. */
  columns?: number;
};

/** Keyboard-driven list for a suggestion popup: ↑ ↓ (and ← → in grids) move, Enter or Tab picks. */
function SuggestionListInner<I>(
  { items, command, label, empty, renderItem, getKey, getGroup, columns }: Props<I>,
  ref: React.ForwardedRef<SuggestionListHandle>,
) {
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => setActive(0), [items]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const pick = (i: number) => {
    const item = items[i];
    if (item) command(item);
  };

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (!items.length) return false;
      const step = columns ?? 1;
      const moves: Record<string, number> = { ArrowDown: step, ArrowUp: -step, ...(columns ? { ArrowRight: 1, ArrowLeft: -1 } : {}) };
      if (event.key in moves) {
        setActive((a) => (a + (moves[event.key] ?? 0) + items.length) % items.length);
        return true;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        pick(active);
        return true;
      }
      return false;
    },
  }));

  return (
    // The rounded shell clips; the list scrolls inside it, so the scrollbar never pokes past the corners.
    <div className="floating w-[min(340px,calc(100vw-24px))] overflow-hidden rounded-(--radius-menu) text-sm text-ink">
    <div
      ref={listRef}
      role="listbox"
      aria-label={label}
      className="thin-scroll overflow-x-hidden overflow-y-auto overscroll-contain p-1.5"
      style={{ maxHeight: 360 }}
    >
      {items.length === 0 ? (
        <p className="px-3 py-2.5 text-ink-3">{empty}</p>
      ) : (
        <div className={columns ? "grid gap-0.5" : "grid"} style={columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}>
          {items.map((item, i) => {
            const group = getGroup?.(item);
            const prev = i > 0 ? items[i - 1] : undefined;
            const showGroup = group && (prev === undefined || group !== getGroup?.(prev));
            return (
              <div key={getKey(item)} className={cx(columns ? undefined : "contents")}>
                {showGroup && !columns && <p className="px-2.5 pt-2 pb-1 text-xs font-medium text-ink-3">{group}</p>}
                <button
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  data-index={i}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(i)}
                  className={cx("w-full rounded-[10px] text-left outline-none", i === active && "bg-surface-2/90")}
                >
                  {renderItem(item, i === active)}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
    </div>
  );
}

export const SuggestionList = forwardRef(SuggestionListInner) as <I>(
  props: Props<I> & { ref?: React.ForwardedRef<SuggestionListHandle> },
) => ReturnType<typeof SuggestionListInner>;
