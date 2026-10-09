"use client";

import { FilePlus } from "@/components/icons";
import { Dialog } from "@/components/ui/dialog";
import { usePageActions, usePage } from "@/modules/workspace";
import { TEMPLATES } from "../lib/templates";

/** Starts a new page from a template. The page fills itself the first time it opens. */
export function TemplateDialog({ open, onOpenChange, parentId }: { open: boolean; onOpenChange: (o: boolean) => void; parentId: string | null }) {
  const actions = usePageActions();
  const parent = usePage(parentId ?? "");

  const pick = (template: (typeof TEMPLATES)[number] | null) => {
    const id = actions.create({ parentId: parent ? parentId : null, template: template?.id ?? null, title: template?.title });
    if (template) actions.update(id, { icon: template.icon });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="New page from a template" description={parent ? `Goes inside "${parent.title || "Untitled"}"` : "Goes at the top level"}>
      <ul className="grid gap-1 px-3 pb-4">
        <li>
          <button type="button" onClick={() => pick(null)} className="flex w-full items-center gap-3 rounded-(--radius-row) px-3 py-2.5 text-left hover:bg-surface-2">
            <span className="flex size-10 items-center justify-center rounded-xl border border-line text-ink-2">
              <FilePlus size={20} />
            </span>
            <span>
              <span className="block text-sm font-medium">Blank page</span>
              <span className="block text-xs text-ink-3">Start from scratch</span>
            </span>
          </button>
        </li>
        {TEMPLATES.map((t) => (
          <li key={t.id}>
            <button type="button" onClick={() => pick(t)} className="flex w-full items-center gap-3 rounded-(--radius-row) px-3 py-2.5 text-left hover:bg-surface-2">
              <span className="flex size-10 items-center justify-center rounded-xl border border-line text-xl" aria-hidden="true">
                {t.icon}
              </span>
              <span>
                <span className="block text-sm font-medium">{t.name}</span>
                <span className="block text-xs text-ink-3">{t.description}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
