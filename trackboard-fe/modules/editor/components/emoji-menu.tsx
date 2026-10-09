"use client";

import type { EmojiItem } from "@tiptap/extension-emoji";
import type { SuggestionProps } from "@tiptap/suggestion";
import { forwardRef } from "react";
import type { SuggestionListHandle } from "../lib/suggestion-renderer";
import { SuggestionList } from "./suggestion-list";

export const EmojiMenu = forwardRef<SuggestionListHandle, SuggestionProps<EmojiItem>>(function EmojiMenu(props, ref) {
  return (
    <SuggestionList
      ref={ref}
      {...props}
      label="Pick an emoji"
      empty="No emoji found"
      getKey={(i) => i.name}
      renderItem={(item) => (
        <span className="flex items-center gap-2.5 px-2.5 py-1.5">
          <span className="w-6 text-center text-lg">{item.emoji}</span>
          <span className="truncate text-ink-2">:{item.shortcodes[0]}:</span>
        </span>
      )}
    />
  );
});
