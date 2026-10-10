"use client";

import { emojis } from "@tiptap/extension-emoji";
import { useDeferredValue, useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const ALL = emojis.filter(
  (e) =>
    e.emoji &&
    !e.name.includes("skin_tone") &&
    !/^[A-Z]$/.test(e.emoji),
);

/** Emoji page icon picker with search by English shortcode or tag. */
export function IconPicker({ value, onChange, children }: { value: string | null; onChange: (icon: string | null) => void; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const query = useDeferredValue(q);
  const list = useMemo(() => {
    const normalizedQuery = query.toLowerCase().trim();
    const found = normalizedQuery
      ? ALL.filter((e) => e.shortcodes.some((s) => s.includes(normalizedQuery)) || e.tags.some((t) => t.includes(normalizedQuery)))
      : ALL;
    return found;
  }, [query]);

  const groups = useMemo(() => {
    const grouped = new Map<string, typeof list>();
    list.forEach((emoji) => {
      const group = emoji.group || "Other";
      const items = grouped.get(group) ?? [];
      items.push(emoji);
      grouped.set(group, items);
    });
    return grouped;
  }, [list]);

  const choose = (icon: string | null) => {
    onChange(icon);
    setOpen(false);
    setQ("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className="w-[min(340px,calc(100vw-24px))]">
        <div className="flex gap-2">
          <Input
            autoFocus
            value={q}
            onChange={(e) => {
              const value = e.target.value;
              setQ(value);
            }}
            placeholder="Search emoji"
            aria-label="Search emoji"
          />
          {value && (
            <Button size="sm" variant="ghost" onClick={() => choose(null)} className="h-10">
              Remove
            </Button>
          )}
        </div>
        <div className="thin-scroll mt-2 max-h-64 overflow-y-auto" role="listbox" aria-label="Emoji">
          {list.length === 0 && <p className="py-6 text-center text-sm text-ink-3">No emoji for &ldquo;{q}&rdquo;</p>}
          {[...groups.entries()].map(([group, items]) => (
            <section
              key={group}
              aria-label={group}
              style={{ contentVisibility: "auto", containIntrinsicSize: "0 220px" }}
            >
              <h3 className="sticky top-0 z-10 bg-surface py-1.5 text-xs font-medium capitalize text-ink-3">{group}</h3>
              <div className="grid grid-cols-8 gap-0.5">
                {items.map((e) => (
                  <button
                    key={e.name}
                    type="button"
                    role="option"
                    aria-selected={value === e.emoji}
                    aria-label={e.shortcodes[0]}
                    title={`:${e.shortcodes[0]}:`}
                    onClick={() => choose(e.emoji ?? null)}
                    className="flex aspect-square items-center justify-center rounded-lg text-xl hover:bg-surface-2"
                  >
                    {e.group === "flags" && e.fallbackImage ? (
                      // Regional-indicator glyphs render as country codes in some system fonts.
                      // The library fallback keeps every flag visible across platforms.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={e.fallbackImage}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="size-5 object-contain"
                      />
                    ) : (
                      e.emoji
                    )}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
