"use client";

import { useMemo, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { BEHAVIOR_NOTES } from "../lib/behavior";
import { SHORTCUTS, type ShortcutGroup } from "../lib/registry";

const ORDER: ShortcutGroup[] = ["Navigation", "Page", "Text", "Blocks", "Insert"];

/** Searchable list of every shortcut, grouped. Opened with Ctrl/⌘ + /. */
export function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [q, setQ] = useState("");
  const groups = useMemo(() => {
    const query = q.toLowerCase().trim();
    const list = SHORTCUTS.filter((s) => !query || s.label.toLowerCase().includes(query) || s.keys.toLowerCase().includes(query));
    return ORDER.map((g) => ({ g, items: list.filter((s) => s.group === g) })).filter((x) => x.items.length);
  }, [q]);

  const notes = useMemo(() => {
    const query = q.toLowerCase().trim();
    return BEHAVIOR_NOTES.filter((n) => !query || n.title.toLowerCase().includes(query) || n.body.toLowerCase().includes(query));
  }, [q]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Shortcuts and behavior" description="Ctrl on Windows and Linux, ⌘ on Mac." className="sm:max-w-2xl">
      <div className="px-5 pb-3">
        <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search shortcuts" aria-label="Search shortcuts" />
      </div>
      <div className="thin-scroll grid gap-6 overflow-y-auto px-5 pb-6 sm:grid-cols-2">
        {groups.length === 0 && notes.length === 0 && <p className="text-sm text-ink-3">No shortcut matches that.</p>}
        {groups.map(({ g, items }) => (
          <section key={g}>
            <h3 className="mb-2 text-xs font-semibold text-ink-3">{g}</h3>
            <dl className="grid gap-1">
              {items.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 rounded-lg py-1">
                  <dt className="text-sm text-ink-2">{s.label}</dt>
                  <dd>
                    <Kbd keys={s.keys} />
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
        {notes.length > 0 && (
          <section className="sm:col-span-2">
            <h3 className="mb-2 text-xs font-semibold text-ink-3">Good to know</h3>
            <dl className="grid gap-3">
              {notes.map((n) => (
                <div key={n.id}>
                  <dt className="text-sm font-medium text-ink">{n.title}</dt>
                  <dd className="text-sm text-ink-2">{n.body}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}
      </div>
    </Dialog>
  );
}
