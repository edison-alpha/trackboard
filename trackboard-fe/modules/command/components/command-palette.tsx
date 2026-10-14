"use client";

import { ChatDots, FileText, Keyboard, MagnifyingGlass, Moon, Plus, Rows, Trash, UserCircle, UserSwitch } from "@/components/icons";
import { Command } from "cmdk";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { signOut } from "@/modules/profile";
import { setUi } from "@/modules/shell/lib/ui-store";
import { useToggleTheme } from "@/modules/theme";
import { ancestorsOf, displayTitle, livePages, pageHref, usePageActions, usePages } from "@/modules/workspace";
import { searchPages } from "../lib/search";

function Item({ value, onSelect, icon, children, hint, shortcut }: { value: string; onSelect: () => void; icon: ReactNode; children: ReactNode; hint?: string | null; shortcut?: string }) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-3 rounded-[10px] px-3 py-2 text-sm text-ink outline-none select-none data-[selected=true]:bg-surface-2/90"
    >
      <span className="flex size-5 shrink-0 items-center justify-center text-ink-2">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate">{children}</span>
        {hint && <span className="block truncate text-xs text-ink-3">{hint}</span>}
      </span>
      {shortcut && <Kbd keys={shortcut} className="hidden sm:inline-flex" />}
    </Command.Item>
  );
}

/** Ctrl/⌘ + K: find any page by title or content, or run an app action. */
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [query, setQuery] = useState("");
  const pages = usePages();
  const router = useRouter();
  const pathname = usePathname();
  const actions = usePageActions();
  const toggleTheme = useToggleTheme();
  const currentId = pathname.startsWith("/p/") ? pathname.slice(3) : null;

  const hits = useMemo(() => searchPages(livePages(pages), query), [pages, query]);

  const run = (fn: () => void) => {
    onOpenChange(false);
    setQuery("");
    fn();
  };

  const q = query.toLowerCase();
  const commands = [
    { id: "new", label: "New page", icon: <Plus size={17} />, shortcut: "Alt+N", run: () => actions.create() },
    ...(currentId ? [{ id: "new-sub", label: "New page inside this one", icon: <Rows size={17} />, run: () => actions.create({ parentId: currentId }) }] : []),
    { id: "ask-ai", label: "Ask AI about your pages", icon: <ChatDots size={17} />, run: () => setUi({ ask: true }) },
    { id: "template", label: "New page from a template", icon: <FileText size={17} />, run: () => setUi({ templates: true }) },
    { id: "theme", label: "Switch light and dark", icon: <Moon size={17} />, shortcut: "Alt+T", run: toggleTheme },
    { id: "shortcuts", label: "Show keyboard shortcuts", icon: <Keyboard size={17} />, shortcut: "Mod+/", run: () => setUi({ shortcuts: true }) },
    { id: "trash", label: "Open trash", icon: <Trash size={17} />, run: () => router.push("/trash") },
    { id: "profile", label: "Change your name and cursor color", icon: <UserCircle size={17} />, run: () => setUi({ profile: true }) },
    { id: "sign-out", label: "Sign out", icon: <UserSwitch size={17} />, run: () => void signOut() },
  ].filter((c) => !q || c.label.toLowerCase().includes(q));

  return (
    <Dialog open={open} onOpenChange={(o) => (onOpenChange(o), o || setQuery(""))} title="Search and run commands" bare className="floating sm:max-w-xl">
      <Command shouldFilter={false} loop className="flex min-h-0 flex-col" label="Command palette">
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          <MagnifyingGlass size={18} className="shrink-0 text-ink-3" />
          <Command.Input
            autoFocus
            value={query}
            onValueChange={setQuery}
            placeholder="Search pages or commands"
            className="h-14 w-full bg-transparent text-[16px] text-ink outline-none placeholder:text-ink-3"
          />
        </div>
        <Command.List className="thin-scroll max-h-[min(60dvh,440px)] overflow-y-auto overscroll-contain p-2">
          <Command.Empty className="px-3 py-8 text-center text-sm text-ink-3">No pages or commands match &ldquo;{query}&rdquo;.</Command.Empty>
          {hits.length > 0 && (
            <Command.Group heading={query ? "Pages" : "Recently edited"} className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-1.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-ink-3">
              {hits.map(({ page, snippet }) => {
                const path = ancestorsOf(pages, page.id).map(displayTitle).join(" / ");
                return (
                  <Item key={page.id} value={`page-${page.id}`} icon={page.icon ?? <FileText size={17} />} hint={snippet ?? (path || null)} onSelect={() => run(() => router.push(pageHref(page.id)))}>
                    {displayTitle(page)}
                  </Item>
                );
              })}
            </Command.Group>
          )}
          {commands.length > 0 && (
            <Command.Group heading="Commands" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-ink-3">
              {commands.map((c) => (
                <Item key={c.id} value={`cmd-${c.id}`} icon={c.icon} shortcut={c.shortcut} onSelect={() => run(c.run)}>
                  {c.label}
                </Item>
              ))}
            </Command.Group>
          )}
        </Command.List>
      </Command>
    </Dialog>
  );
}
