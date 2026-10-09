"use client";

import { emojis } from "@tiptap/extension-emoji";
import { useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const ALL = emojis.filter((e) => e.emoji && !e.name.includes("skin_tone"));

/** Emoji page icon picker with search by English shortcode or tag. */
export function IconPicker({ value, onChange, children }: { value: string | null; onChange: (icon: string | null) => void; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const query = q.toLowerCase().trim();
    const found = query ? ALL.filter((e) => e.shortcodes.some((s) => s.includes(query)) || e.tags.some((t) => t.includes(query))) : ALL;
    return found.slice(0, 240);
  }, [q]);

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
          <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search emoji" aria-label="Search emoji" />
          {value && (
            <Button size="sm" variant="ghost" onClick={() => choose(null)} className="h-10">
              Remove
            </Button>
          )}
        </div>
        <div className="thin-scroll mt-2 grid max-h-64 grid-cols-8 gap-0.5 overflow-y-auto" role="listbox" aria-label="Emoji">
          {list.length === 0 && <p className="col-span-8 py-6 text-center text-sm text-ink-3">No emoji for &ldquo;{q}&rdquo;</p>}
          {list.map((e) => (
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
              {e.emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
