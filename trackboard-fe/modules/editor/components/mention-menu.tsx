"use client";

import { FileText } from "@/components/icons";
import type { SuggestionProps } from "@tiptap/suggestion";
import { forwardRef } from "react";
import { Avatar } from "@/components/ui/avatar";
import type { SuggestionListHandle } from "../lib/suggestion-renderer";
import { SuggestionList } from "./suggestion-list";

export type MentionItem = { id: string; label: string; kind: "page" | "person"; icon?: string | null; color?: string };

export const MentionMenu = forwardRef<SuggestionListHandle, SuggestionProps<MentionItem>>(function MentionMenu(props, ref) {
  return (
    <SuggestionList
      ref={ref}
      {...props}
      label="Mention a page or person"
      empty="No page or person by that name"
      getKey={(i) => i.id}
      getGroup={(i) => (i.kind === "person" ? "People" : "Pages")}
      renderItem={(item) => (
        <span className="flex items-center gap-2.5 px-2.5 py-2">
          {item.kind === "person" ? (
            <Avatar name={item.label} color={item.color ?? "#0b6fe8"} size={22} />
          ) : (
            <span className="flex size-[22px] items-center justify-center text-ink-2">{item.icon ?? <FileText size={17} />}</span>
          )}
          <span className="truncate">{item.label}</span>
        </span>
      )}
    />
  );
});
