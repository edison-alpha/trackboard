"use client";

import type { SuggestionProps } from "@tiptap/suggestion";
import { forwardRef } from "react";
import { KeyHint } from "@/components/ui/kbd";
import type { SlashItem } from "../lib/slash-items";
import type { SuggestionListHandle } from "../lib/suggestion-renderer";
import { SuggestionList } from "./suggestion-list";

export const SlashMenu = forwardRef<SuggestionListHandle, SuggestionProps<SlashItem>>(function SlashMenu(props, ref) {
  return (
    <SuggestionList
      ref={ref}
      {...props}
      label="Insert a block"
      empty="No block by that name"
      getKey={(i) => i.id}
      getGroup={(i) => i.group}
      renderItem={(item) => (
        <span className="flex min-w-0 items-center gap-3 px-2 py-1.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-line bg-surface text-ink-2">
            <item.icon size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{item.title}</span>
            <span className="block truncate text-xs text-ink-3">{item.hint}</span>
          </span>
          {item.shortcut && <KeyHint keys={item.shortcut} className="hidden pr-1 sm:inline" />}
        </span>
      )}
    />
  );
});
