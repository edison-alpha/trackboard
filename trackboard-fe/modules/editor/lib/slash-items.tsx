import type { Editor, Range } from "@tiptap/core";
import {
  ArrowDown,
  ArrowUp,
  BookmarkCard,
  Calendar,
  CaretCircleRight,
  ChatDots,
  CheckCircle,
  CheckSquare,
  Code,
  ColumnsLayout,
  Contents,
  Copy,
  Eraser,
  FileText,
  Function as FunctionIcon,
  Image,
  Info,
  LinkRound,
  ListBullets,
  ListNumbers,
  MathOperations,
  Mention,
  Minus,
  Paperclip,
  Quotes,
  Smiley,
  Table,
  TextAlignCenter,
  TextAlignLeft,
  TextAlignRight,
  TextHFour,
  TextHOne,
  TextHThree,
  TextHTwo,
  TextT,
  Trash,
  UserRounded,
  Warning,
  WindowFrame,
  YoutubeLogo,
  type Icon,
  type IconProps,
} from "@/components/icons";
import { openAi } from "@/modules/ai/lib/ai-store";
import { HIGHLIGHTS, TEXT_COLORS } from "./colors";
import { toEmbed } from "./embed-url";

export type EditorContext = {
  /** Inserts an image picked from disk. */
  pickImage: (editor: Editor) => void;
  /** Attaches any file picked from disk as a file block. */
  pickFile: (editor: Editor) => void;
  /** Creates a child page and returns its id and title, for a link in the current page. */
  createSubpage: () => { id: string; title: string };
  /** Asks for a value (link, formula). Resolves null when cancelled. */
  prompt: (title: string, placeholder: string) => Promise<string | null>;
  /** Opens a row/column picker before inserting a table. */
  pickTable: (editor: Editor, range: Range) => void;
};

export type SlashGroup = "AI" | "Basic" | "Lists" | "Media" | "Embeds" | "Layout" | "Advanced" | "Inline" | "Color" | "Actions";

export type SlashItem = {
  id: string;
  title: string;
  hint: string;
  group: SlashGroup;
  icon: Icon;
  keywords: string[];
  shortcut?: string;
  run: (editor: Editor, range: Range, ctx: EditorContext) => void;
};

const chain = (editor: Editor, range: Range) => editor.chain().focus().deleteRange(range);

/** Asks for a link, then runs `then` with it (nothing happens when the prompt is cancelled). */
const withUrl = (ctx: EditorContext, title: string, then: (url: string) => void) =>
  void ctx.prompt(title, "https://").then((v) => {
    const url = v?.trim();
    if (url) then(/^[a-z]+:\/\//i.test(url) ? url : `https://${url}`);
  });

/** Applies a colour to every character of the caret's block. */
function colorBlock(editor: Editor, kind: "text" | "background", value: string | null) {
  const { $from } = editor.state.selection;
  const range = { from: $from.start(), to: $from.end() };
  const caret = editor.state.selection.from;
  const c = editor.chain().focus().setTextSelection(range);
  if (kind === "text") (value ? c.setColor(value) : c.unsetColor()).setTextSelection(caret).run();
  else (value ? c.setHighlight({ color: value }) : c.unsetHighlight()).setTextSelection(caret).run();
}

/** Swatch shown as the icon of a colour item, so the menu previews the colour itself. */
function swatch(value: string | null, kind: "text" | "background"): Icon {
  function Swatch({ size = 18 }: IconProps) {
    return kind === "text" ? (
      <span aria-hidden="true" className="inline-flex items-center justify-center font-sans font-bold" style={{ width: size, height: size, color: value ?? "var(--ink)", fontSize: size * 0.8 }}>
        A
      </span>
    ) : (
      <span aria-hidden="true" className="inline-block rounded-[5px] border border-line-strong" style={{ width: size, height: size, background: value ?? "transparent" }} />
    );
  }
  return Swatch;
}

export const SLASH_ITEMS: SlashItem[] = [
  {
    id: "ai",
    title: "Ask AI",
    hint: "Write, outline, brainstorm, or continue",
    group: "AI",
    icon: ChatDots,
    keywords: ["ai", "write", "draft", "generate", "continue", "outline", "brainstorm"],
    shortcut: "Mod+J",
    run: (e, r) => {
      chain(e, r).run();
      const pos = e.state.selection.from;
      openAi({ scope: "write", range: { from: pos, to: pos } });
    },
  },

  { id: "text", title: "Text", hint: "Plain paragraph", group: "Basic", icon: TextT, keywords: ["paragraph", "text", "p"], run: (e, r) => chain(e, r).setParagraph().run() },
  { id: "h1", title: "Heading 1", hint: "Large section heading", group: "Basic", icon: TextHOne, keywords: ["heading", "h1", "#", "title"], shortcut: "Mod+Alt+1", run: (e, r) => chain(e, r).setHeading({ level: 1 }).run() },
  { id: "h2", title: "Heading 2", hint: "Medium section heading", group: "Basic", icon: TextHTwo, keywords: ["heading", "h2", "##"], shortcut: "Mod+Alt+2", run: (e, r) => chain(e, r).setHeading({ level: 2 }).run() },
  { id: "h3", title: "Heading 3", hint: "Small section heading", group: "Basic", icon: TextHThree, keywords: ["heading", "h3", "###"], shortcut: "Mod+Alt+3", run: (e, r) => chain(e, r).setHeading({ level: 3 }).run() },
  { id: "h4", title: "Heading 4", hint: "Smallest heading, for sub-points", group: "Basic", icon: TextHFour, keywords: ["heading", "h4", "####"], shortcut: "Mod+Alt+4", run: (e, r) => chain(e, r).setHeading({ level: 4 }).run() },
  { id: "quote", title: "Quote", hint: "Set off a quotation", group: "Basic", icon: Quotes, keywords: ["quote", "blockquote", ">"], shortcut: "Mod+Shift+B", run: (e, r) => chain(e, r).toggleBlockquote().run() },
  { id: "divider", title: "Divider", hint: "Line between sections", group: "Basic", icon: Minus, keywords: ["hr", "divider", "line", "separator", "---"], run: (e, r) => chain(e, r).setHorizontalRule().run() },
  { id: "callout", title: "Note callout", hint: "Box for something to remember", group: "Basic", icon: Info, keywords: ["callout", "note", "info", "tip"], run: (e, r) => chain(e, r).setCallout("info").run() },
  { id: "callout-warn", title: "Warning callout", hint: "Something to watch out for", group: "Basic", icon: Warning, keywords: ["callout", "warning", "caution", "danger"], run: (e, r) => chain(e, r).setCallout("warn").run() },
  { id: "callout-ok", title: "Success callout", hint: "A confirmation or result", group: "Basic", icon: CheckCircle, keywords: ["callout", "success", "done", "ok"], run: (e, r) => chain(e, r).setCallout("ok").run() },
  { id: "code", title: "Code block", hint: "Code with syntax highlighting", group: "Basic", icon: Code, keywords: ["code", "snippet", "```", "pre"], shortcut: "Mod+Alt+C", run: (e, r) => chain(e, r).setCodeBlock().run() },

  { id: "bullet", title: "Bulleted list", hint: "List without order", group: "Lists", icon: ListBullets, keywords: ["bullet", "list", "ul", "-"], shortcut: "Mod+Shift+8", run: (e, r) => chain(e, r).toggleBulletList().run() },
  { id: "ordered", title: "Numbered list", hint: "List in order", group: "Lists", icon: ListNumbers, keywords: ["numbered", "ordered", "ol", "1."], shortcut: "Mod+Shift+7", run: (e, r) => chain(e, r).toggleOrderedList().run() },
  { id: "task", title: "To-do list", hint: "Checklist you can tick off", group: "Lists", icon: CheckSquare, keywords: ["todo", "task", "checklist", "[]"], shortcut: "Mod+Shift+9", run: (e, r) => chain(e, r).toggleTaskList().run() },
  { id: "toggle", title: "Toggle", hint: "Section that folds away", group: "Lists", icon: CaretCircleRight, keywords: ["toggle", "details", "collapse", "fold", "accordion"], run: (e, r) => chain(e, r).setDetails().run() },

  { id: "image", title: "Image", hint: "Upload from your device", group: "Media", icon: Image, keywords: ["image", "picture", "photo", "upload"], run: (e, r, ctx) => (chain(e, r).run(), ctx.pickImage(e)) },
  {
    id: "image-url",
    title: "Image from link",
    hint: "Show an image hosted elsewhere",
    group: "Media",
    icon: LinkRound,
    keywords: ["image", "url", "link", "picture"],
    run: (e, r, ctx) => (chain(e, r).run(), withUrl(ctx, "Image link", (src) => e.chain().focus().setImage({ src }).run())),
  },
  { id: "file", title: "File", hint: "Attach a file people can download", group: "Media", icon: Paperclip, keywords: ["file", "attachment", "upload", "pdf", "document"], run: (e, r, ctx) => (chain(e, r).run(), ctx.pickFile(e)) },
  {
    id: "youtube",
    title: "YouTube video",
    hint: "Embed from a link",
    group: "Media",
    icon: YoutubeLogo,
    keywords: ["video", "youtube", "embed"],
    run: (e, r, ctx) => (chain(e, r).run(), withUrl(ctx, "YouTube video link", (src) => e.chain().focus().setYoutubeVideo({ src }).run())),
  },

  {
    id: "embed",
    title: "Embed",
    hint: "Figma, Loom, Google Docs, Miro, CodePen, Spotify…",
    group: "Embeds",
    icon: WindowFrame,
    keywords: ["embed", "iframe", "figma", "loom", "google", "docs", "sheets", "slides", "miro", "codepen", "spotify", "vimeo", "airtable"],
    run: (e, r, ctx) =>
      (chain(e, r).run(),
      withUrl(ctx, "Link to embed", (url) => {
        if (/youtu\.?be/.test(url)) return e.chain().focus().setYoutubeVideo({ src: url }).run();
        const info = toEmbed(url);
        if (info) e.chain().focus().setEmbed({ src: info.src, url, provider: info.provider }).run();
      })),
  },
  { id: "bookmark", title: "Bookmark", hint: "Link shown as a card", group: "Embeds", icon: BookmarkCard, keywords: ["bookmark", "link", "card", "url", "web"], run: (e, r, ctx) => (chain(e, r).run(), withUrl(ctx, "Link to bookmark", (url) => e.chain().focus().setBookmark({ url }).run())) },

  { id: "cols-2", title: "2 columns", hint: "Two blocks side by side", group: "Layout", icon: ColumnsLayout, keywords: ["columns", "layout", "side", "grid", "2"], run: (e, r) => chain(e, r).insertColumns(2).run() },
  { id: "cols-3", title: "3 columns", hint: "Three blocks side by side", group: "Layout", icon: ColumnsLayout, keywords: ["columns", "layout", "grid", "3"], run: (e, r) => chain(e, r).insertColumns(3).run() },
  { id: "cols-4", title: "4 columns", hint: "Four blocks side by side", group: "Layout", icon: ColumnsLayout, keywords: ["columns", "layout", "grid", "4"], run: (e, r) => chain(e, r).insertColumns(4).run() },
  { id: "toc", title: "Table of contents", hint: "Live list of this page's headings", group: "Layout", icon: Contents, keywords: ["toc", "contents", "outline", "index", "headings"], run: (e, r) => chain(e, r).insertTableOfContents().run() },

  { id: "table", title: "Table", hint: "Choose rows and columns", group: "Advanced", icon: Table, keywords: ["table", "grid", "columns", "rows"], run: (e, r, ctx) => ctx.pickTable(e, r) },
  {
    id: "math-block",
    title: "Equation",
    hint: "LaTeX on its own line",
    group: "Advanced",
    icon: MathOperations,
    keywords: ["math", "latex", "equation", "formula", "katex"],
    run: (e, r, ctx) => {
      chain(e, r).run();
      void ctx.prompt("LaTeX equation", "E = mc^2").then((latex) => latex && e.chain().focus().insertBlockMath({ latex }).run());
    },
  },
  {
    id: "math-inline",
    title: "Inline equation",
    hint: "Math inside a sentence",
    group: "Advanced",
    icon: FunctionIcon,
    keywords: ["math", "inline", "latex", "formula"],
    run: (e, r, ctx) => {
      chain(e, r).run();
      void ctx.prompt("LaTeX equation", "a^2 + b^2 = c^2").then((latex) => latex && e.chain().focus().insertInlineMath({ latex }).run());
    },
  },
  {
    id: "subpage",
    title: "Page",
    hint: "New page inside this one",
    group: "Advanced",
    icon: FileText,
    keywords: ["page", "subpage", "child", "nested"],
    run: (e, r, ctx) => {
      const page = ctx.createSubpage();
      chain(e, r)
        .insertContent([{ type: "mention", attrs: { id: `page:${page.id}`, label: page.title } }, { type: "text", text: " " }])
        .run();
    },
  },

  { id: "mention-page", title: "Link to page", hint: "Mention another page", group: "Inline", icon: Mention, keywords: ["link", "page", "mention", "@"], run: (e, r) => chain(e, r).insertContent("@").run() },
  { id: "mention-person", title: "Mention person", hint: "Mention someone on this page", group: "Inline", icon: UserRounded, keywords: ["mention", "person", "people", "user", "@"], run: (e, r) => chain(e, r).insertContent("@").run() },
  { id: "date", title: "Date", hint: "Today's date, click it to pick another", group: "Inline", icon: Calendar, keywords: ["date", "today", "deadline", "due", "calendar"], run: (e, r) => chain(e, r).insertDate().run() },
  { id: "date-range", title: "Date range", hint: "From and to dates, with quick presets", group: "Inline", icon: Calendar, keywords: ["date", "range", "period", "timeline", "sprint", "from", "to"], run: (e, r) => chain(e, r).insertDateRange().run() },
  { id: "emoji", title: "Emoji", hint: "Search emoji by name", group: "Inline", icon: Smiley, keywords: ["emoji", "icon", "smile", ":"], run: (e, r) => chain(e, r).insertContent(":").run() },

  ...TEXT_COLORS.map(
    (c): SlashItem => ({
      id: `color-${c.name}`,
      title: c.value ? `${c.name} text` : "Default text color",
      hint: "Colors the whole block",
      group: "Color",
      icon: swatch(c.value, "text"),
      keywords: ["color", "colour", "text", c.name.toLowerCase()],
      run: (e, r) => (chain(e, r).run(), colorBlock(e, "text", c.value)),
    }),
  ),
  ...HIGHLIGHTS.map(
    (c): SlashItem => ({
      id: `bg-${c.name}`,
      title: c.value ? `${c.name} background` : "No background",
      hint: "Highlights the whole block",
      group: "Color",
      icon: swatch(c.value, "background"),
      keywords: ["background", "highlight", "color", c.name.toLowerCase()],
      run: (e, r) => (chain(e, r).run(), colorBlock(e, "background", c.value)),
    }),
  ),

  { id: "duplicate", title: "Duplicate block", hint: "Copy this block below it", group: "Actions", icon: Copy, keywords: ["duplicate", "copy", "clone"], shortcut: "Mod+D", run: (e, r) => chain(e, r).duplicateBlock().run() },
  { id: "move-up", title: "Move up", hint: "Swap with the block above", group: "Actions", icon: ArrowUp, keywords: ["move", "up"], shortcut: "Mod+Shift+↑", run: (e, r) => chain(e, r).moveBlock(-1).run() },
  { id: "move-down", title: "Move down", hint: "Swap with the block below", group: "Actions", icon: ArrowDown, keywords: ["move", "down"], shortcut: "Mod+Shift+↓", run: (e, r) => chain(e, r).moveBlock(1).run() },
  { id: "align-left", title: "Align left", hint: "Text starts at the left", group: "Actions", icon: TextAlignLeft, keywords: ["align", "left"], shortcut: "Mod+Shift+L", run: (e, r) => chain(e, r).setTextAlign("left").run() },
  { id: "align-center", title: "Align center", hint: "Center the text", group: "Actions", icon: TextAlignCenter, keywords: ["align", "center", "middle"], shortcut: "Mod+Shift+E", run: (e, r) => chain(e, r).setTextAlign("center").run() },
  { id: "align-right", title: "Align right", hint: "Text ends at the right", group: "Actions", icon: TextAlignRight, keywords: ["align", "right"], shortcut: "Mod+Shift+R", run: (e, r) => chain(e, r).setTextAlign("right").run() },
  { id: "clear", title: "Clear formatting", hint: "Plain text, no styles", group: "Actions", icon: Eraser, keywords: ["clear", "reset", "plain", "format", "remove"], run: (e, r) => chain(e, r).selectParentNode().unsetAllMarks().clearNodes().run() },
  { id: "delete", title: "Delete block", hint: "Remove this block", group: "Actions", icon: Trash, keywords: ["delete", "remove", "trash"], run: (e, r) => chain(e, r).deleteBlock().run() },
];

/** Matches title and keywords; "/h2" and "/heading" both work. */
export function filterSlashItems(query: string): SlashItem[] {
  const q = query.toLowerCase().trim();
  if (!q) return SLASH_ITEMS;
  return SLASH_ITEMS.filter((i) => i.title.toLowerCase().includes(q) || i.keywords.some((k) => k.includes(q)));
}
