"use client";

import {
  ChatCircleText,
  Code,
  LinkSimple,
  LinkBreak,
  TextB,
  TextItalic,
  TextStrikethrough,
  TextUnderline,
  TextSubscript,
  TextSuperscript,
  TextAlignLeft,
  TextAlignCenter,
  TextAlignRight,
  CaretDown,
  ChatDots,
  Check,
} from "@/components/icons";
import { CellSelection } from "@tiptap/pm/tables";
import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import { BubbleMenu as TiptapBubbleMenu } from "@tiptap/react/menus";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { cx } from "@/lib/cx";
import { useStore, type Store } from "@/lib/store";
import { openAi } from "@/modules/ai/lib/ai-store";
import { BLOCK_TYPES } from "../lib/block-types";
import { HIGHLIGHTS, TEXT_COLORS } from "../lib/colors";

function ToolButton({ label, active, onClick, children }: { label: string; active?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cx(
        "inline-flex size-8 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-surface-2/80 hover:text-ink pointer-coarse:size-10",
        active && "bg-accent-soft text-accent-ink hover:bg-accent-soft hover:text-accent-ink",
      )}
    >
      {children}
    </button>
  );
}

const Sep = () => <span className="mx-0.5 h-5 w-px shrink-0 bg-line" aria-hidden="true" />;

/** Formatting toolbar that appears over a text selection. Mod+K opens it straight in link mode. */
export function BubbleMenu({ editor, linkRequests, onComment }: { editor: Editor; linkRequests: Store<number>; onComment: () => void }) {
  const [mode, setMode] = useState<"format" | "link">("format");
  const [href, setHref] = useState("");
  const linkRequest = useStore(linkRequests);

  useEffect(() => {
    if (linkRequest > 0) {
      setHref(editor.getAttributes("link").href ?? "");
      setMode("link");
    }
  }, [linkRequest, editor]);

  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      code: e.isActive("code"),
      link: e.isActive("link"),
      sub: e.isActive("subscript"),
      sup: e.isActive("superscript"),
      align: e.isActive({ textAlign: "center" }) ? "center" : e.isActive({ textAlign: "right" }) ? "right" : "left",
      block: BLOCK_TYPES.find((b) => b.active(e))?.label ?? "Text",
      color: e.getAttributes("textStyle").color as string | undefined,
      highlight: e.getAttributes("highlight").color as string | undefined,
    }),
  });

  const applyLink = () => {
    const value = href.trim();
    const chain = editor.chain().focus().extendMarkRange("link");
    if (value) chain.setLink({ href: /^[a-z]+:|^\/|^#/i.test(value) ? value : `https://${value}` }).run();
    else chain.unsetLink().run();
    setMode("format");
  };
  const saveLink = (ev: FormEvent) => {
    ev.preventDefault();
    applyLink();
  };

  return (
    <TiptapBubbleMenu
      editor={editor}
      // Mounted in <body> so focus moving into a dropdown (also portaled to <body>) does not count as leaving the menu.
      appendTo={() => document.body}
      options={{ strategy: "fixed", placement: "top", offset: 10, flip: true, shift: { padding: 12 }, onHide: () => setMode("format") }}
      shouldShow={({ editor: e, state }) => {
        const { empty } = state.selection;
        // Selected table cells get the table menu instead.
        if (empty || !e.isEditable || state.selection instanceof CellSelection) return false;
        return !e.isActive("codeBlock") && !e.isActive("image") && !e.isActive("youtube") && !e.isActive("blockMath") && !e.isActive("inlineMath");
      }}
      className="floating z-40 rounded-(--radius-menu) p-1"
    >
      {mode === "link" ? (
        <form onSubmit={saveLink} className="flex items-center gap-1">
          <input
            autoFocus
            value={href}
            onChange={(e) => setHref(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && (e.preventDefault(), setMode("format"), editor.commands.focus())}
            placeholder="Paste or type a link"
            aria-label="Link address"
            className="h-8 w-60 rounded-[9px] bg-transparent px-2 text-sm text-ink outline-none placeholder:text-ink-3 sm:w-72"
          />
          <ToolButton label="Save link" onClick={applyLink}>
            <Check size={16} weight="bold" />
          </ToolButton>
          {s.link && (
            <ToolButton label="Remove link" onClick={() => (editor.chain().focus().extendMarkRange("link").unsetLink().run(), setMode("format"))}>
              <LinkBreak size={16} />
            </ToolButton>
          )}
        </form>
      ) : (
        <div className="flex max-w-[calc(100vw-24px)] items-center gap-0.5 overflow-x-auto">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              const { from, to } = editor.state.selection;
              openAi({ scope: "selection", range: { from, to } });
            }}
            title="Ask AI (Ctrl/⌘ J)"
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-sm font-medium text-accent-ink hover:bg-accent-soft pointer-coarse:h-10"
          >
            <ChatDots size={16} />
            Ask AI
          </button>
          <Sep />
          <Menu>
            <MenuTrigger
              onMouseDown={(e) => e.preventDefault()}
              className="inline-flex h-8 shrink-0 items-center gap-1 rounded-[9px] px-2 text-sm font-medium text-ink-2 hover:bg-surface-2/80 hover:text-ink pointer-coarse:h-10"
            >
              {s.block}
              <CaretDown size={12} />
            </MenuTrigger>
            <MenuContent onCloseAutoFocus={(e) => e.preventDefault()}>
              <MenuLabel>Turn into</MenuLabel>
              {BLOCK_TYPES.map((b) => (
                <MenuItem key={b.label} onSelect={() => b.apply(editor.chain().focus()).run()} icon={b.label === s.block ? <Check size={14} /> : <span className="w-3.5" />}>
                  {b.label}
                </MenuItem>
              ))}
            </MenuContent>
          </Menu>
          <Sep />
          <ToolButton label="Bold (Ctrl/⌘ B)" active={s.bold} onClick={() => editor.chain().focus().toggleBold().run()}>
            <TextB size={16} weight="bold" />
          </ToolButton>
          <ToolButton label="Italic (Ctrl/⌘ I)" active={s.italic} onClick={() => editor.chain().focus().toggleItalic().run()}>
            <TextItalic size={16} />
          </ToolButton>
          <ToolButton label="Underline (Ctrl/⌘ U)" active={s.underline} onClick={() => editor.chain().focus().toggleUnderline().run()}>
            <TextUnderline size={16} />
          </ToolButton>
          <ToolButton label="Strikethrough (Ctrl/⌘ Shift S)" active={s.strike} onClick={() => editor.chain().focus().toggleStrike().run()}>
            <TextStrikethrough size={16} />
          </ToolButton>
          <ToolButton label="Inline code (Ctrl/⌘ E)" active={s.code} onClick={() => editor.chain().focus().toggleCode().run()}>
            <Code size={16} />
          </ToolButton>
          <ToolButton
            label="Link (Ctrl/⌘ K)"
            active={s.link}
            onClick={() => {
              setHref(editor.getAttributes("link").href ?? "");
              setMode("link");
            }}
          >
            <LinkSimple size={16} />
          </ToolButton>
          <Sep />
          <Menu>
            <MenuTrigger
              aria-label="Text color and highlight"
              title="Text color and highlight"
              onMouseDown={(e) => e.preventDefault()}
              className="inline-flex h-8 shrink-0 items-center gap-0.5 rounded-[9px] px-1.5 hover:bg-surface-2/80 pointer-coarse:h-10"
            >
              <span
                className="flex size-5 items-center justify-center rounded-md border border-line text-[13px] font-bold"
                style={{ color: s.color ?? "var(--ink)", background: s.highlight ?? "transparent" }}
              >
                A
              </span>
              <CaretDown size={12} className="text-ink-2" />
            </MenuTrigger>
            <MenuContent onCloseAutoFocus={(e) => e.preventDefault()} className="w-56">
              <MenuLabel>Text color</MenuLabel>
              {TEXT_COLORS.map((c) => (
                <MenuItem
                  key={c.name}
                  onSelect={() => (c.value ? editor.chain().focus().setColor(c.value).run() : editor.chain().focus().unsetColor().run())}
                  icon={<span className="flex size-5 items-center justify-center rounded-md border border-line text-[13px] font-bold" style={{ color: c.value ?? "var(--ink)" }}>A</span>}
                >
                  {c.name}
                </MenuItem>
              ))}
              <MenuSeparator />
              <MenuLabel>Highlight</MenuLabel>
              {HIGHLIGHTS.map((c) => (
                <MenuItem
                  key={c.name}
                  onSelect={() => (c.value ? editor.chain().focus().setHighlight({ color: c.value }).run() : editor.chain().focus().unsetHighlight().run())}
                  icon={<span className="size-5 rounded-md border border-line" style={{ background: c.value ?? "transparent" }} />}
                >
                  {c.name}
                </MenuItem>
              ))}
            </MenuContent>
          </Menu>
          <Menu>
            <MenuTrigger
              aria-label="Alignment and more"
              title="Alignment and more"
              onMouseDown={(e) => e.preventDefault()}
              className="inline-flex h-8 shrink-0 items-center gap-0.5 rounded-[9px] px-1.5 text-ink-2 hover:bg-surface-2/80 hover:text-ink pointer-coarse:h-10"
            >
              {s.align === "center" ? <TextAlignCenter size={16} /> : s.align === "right" ? <TextAlignRight size={16} /> : <TextAlignLeft size={16} />}
              <CaretDown size={12} />
            </MenuTrigger>
            <MenuContent onCloseAutoFocus={(e) => e.preventDefault()}>
              <MenuItem icon={<TextAlignLeft size={16} />} shortcut="Mod+Shift+L" onSelect={() => editor.chain().focus().setTextAlign("left").run()}>
                Align left
              </MenuItem>
              <MenuItem icon={<TextAlignCenter size={16} />} shortcut="Mod+Shift+E" onSelect={() => editor.chain().focus().setTextAlign("center").run()}>
                Align center
              </MenuItem>
              <MenuItem icon={<TextAlignRight size={16} />} shortcut="Mod+Shift+R" onSelect={() => editor.chain().focus().setTextAlign("right").run()}>
                Align right
              </MenuItem>
              <MenuSeparator />
              <MenuItem icon={<TextSubscript size={16} />} shortcut="Mod+," onSelect={() => editor.chain().focus().toggleSubscript().run()}>
                {s.sub ? "Remove subscript" : "Subscript"}
              </MenuItem>
              <MenuItem icon={<TextSuperscript size={16} />} shortcut="Mod+." onSelect={() => editor.chain().focus().toggleSuperscript().run()}>
                {s.sup ? "Remove superscript" : "Superscript"}
              </MenuItem>
            </MenuContent>
          </Menu>
          <Sep />
          <ToolButton label="Comment on this" onClick={onComment}>
            <ChatCircleText size={16} />
          </ToolButton>
        </div>
      )}
    </TiptapBubbleMenu>
  );
}
