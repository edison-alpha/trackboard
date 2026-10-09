"use client";

import {
  ChatDots,
  ArrowsHorizontal,
  ClockCounterClockwise,
  Copy,
  DotsThree,
  DownloadSimple,
  Paragraph,
  Printer,
  TextAlignCenter,
  TextAlignLeft,
  Trash,
  UploadSimple,
} from "@/components/icons";
import type { Editor } from "@tiptap/react";
import { useState } from "react";
import { toast } from "sonner";
import { IconButton } from "@/components/ui/button";
import { Menu, MenuCheckItem, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuSub, MenuSubContent, MenuSubTrigger, MenuTrigger } from "@/components/ui/menu";
import { askConfirm } from "@/components/ui/prompt";
import { downloadText, pickFile, slugify } from "@/lib/files";
import { actionsFor, openAi } from "@/modules/ai";
import { togglePanel } from "@/modules/shell";
import { displayTitle, usePageActions, type PageMeta } from "@/modules/workspace";

/** Page-level actions: layout, history, import/export, duplicate, trash. */
export function PageMenu({ page, editor }: { page: PageMeta; editor: Editor | null }) {
  const actions = usePageActions();
  const [invisibles, setInvisibles] = useState(false);

  const exportMarkdown = () => {
    if (!editor) return;
    const md = `# ${displayTitle(page)}\n\n${editor.getMarkdown()}`;
    downloadText(`${slugify(displayTitle(page))}.md`, md);
  };

  const importMarkdown = async () => {
    if (!editor) return;
    const file = await pickFile(".md,.markdown,text/markdown,text/plain");
    if (!file) return;
    if (!editor.isEmpty) {
      const ok = await askConfirm({
        title: "Replace this page's content?",
        body: `${file.name} will replace what's on this page. You can bring the current version back from Version history.`,
        confirmLabel: "Replace content",
      });
      if (!ok) return;
    }
    try {
      editor.commands.setContent(await file.text(), { contentType: "markdown" });
      toast.success(`Imported ${file.name}`);
    } catch {
      toast.error("That file couldn't be read as Markdown.");
    }
  };

  return (
    <Menu>
      <MenuTrigger asChild>
        <IconButton label="Page options">
          <DotsThree size={20} weight="bold" />
        </IconButton>
      </MenuTrigger>
      <MenuContent align="end" className="w-64">
        <MenuSub>
          <MenuSubTrigger icon={<ChatDots size={16} />}>Ask AI about this page</MenuSubTrigger>
          <MenuSubContent className="w-60">
            <MenuLabel>Sends this page to the AI service</MenuLabel>
            {actionsFor("page").map((a) => (
              <MenuItem key={a.id} disabled={!editor} onSelect={() => openAi({ scope: "page", range: { from: 0, to: 0 }, preset: a.id })}>
                {a.label}
              </MenuItem>
            ))}
          </MenuSubContent>
        </MenuSub>
        <MenuSeparator />
        <MenuSub>
          <MenuSubTrigger icon={<ArrowsHorizontal size={16} />}>Page width</MenuSubTrigger>
          <MenuSubContent className="w-52">
            <MenuLabel>Choose a reading layout</MenuLabel>
            <MenuCheckItem checked={page.pageWidth === "normal"} onCheckedChange={() => actions.update(page.id, { pageWidth: "normal", fullWidth: false })} icon={<TextAlignLeft size={16} />}>
              Normal
            </MenuCheckItem>
            <MenuCheckItem checked={page.pageWidth === "center"} onCheckedChange={() => actions.update(page.id, { pageWidth: "center", fullWidth: false })} icon={<TextAlignCenter size={16} />}>
              Center
            </MenuCheckItem>
            <MenuCheckItem checked={page.pageWidth === "full"} onCheckedChange={() => actions.update(page.id, { pageWidth: "full", fullWidth: true })} icon={<ArrowsHorizontal size={16} />}>
              Full
            </MenuCheckItem>
          </MenuSubContent>
        </MenuSub>
        <MenuCheckItem
          checked={invisibles}
          onCheckedChange={(v) => {
            setInvisibles(v);
            if (v) editor?.commands.showInvisibleCharacters();
            else editor?.commands.hideInvisibleCharacters();
          }}
          icon={<Paragraph size={16} />}
        >
          Show hidden characters
        </MenuCheckItem>
        <MenuSeparator />
        <MenuItem icon={<ClockCounterClockwise size={16} />} shortcut="Alt+H" onSelect={() => togglePanel("history")}>
          Version history
        </MenuItem>
        <MenuItem icon={<Copy size={16} />} onSelect={() => void actions.duplicate(page.id)}>
          Duplicate page
        </MenuItem>
        <MenuSeparator />
        <MenuItem icon={<DownloadSimple size={16} />} onSelect={exportMarkdown} disabled={!editor}>
          Export as Markdown
        </MenuItem>
        <MenuItem icon={<Printer size={16} />} onSelect={() => window.print()}>
          Print or save as PDF
        </MenuItem>
        <MenuItem icon={<UploadSimple size={16} />} onSelect={() => void importMarkdown()} disabled={!editor}>
          Import Markdown
        </MenuItem>
        <MenuSeparator />
        <MenuItem danger icon={<Trash size={16} />} onSelect={() => actions.trash(page.id)}>
          Move to trash
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
