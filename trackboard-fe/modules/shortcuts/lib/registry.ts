/* Single source for every shortcut: the global handlers read it, and so does the shortcut list (Ctrl/⌘ + /).
   Global combos avoid browser defaults (Ctrl+N, Ctrl+T, Alt+F, Ctrl+Shift+C are taken by Chrome). */

export type ShortcutGroup = "Navigation" | "Page" | "Text" | "Blocks" | "Insert";

export type Shortcut = { id: string; keys: string; label: string; group: ShortcutGroup; global?: boolean };

export const SHORTCUTS: Shortcut[] = [
  { id: "palette", keys: "Mod+K", label: "Search pages and commands (elsewhere)", group: "Navigation", global: true },
  { id: "shortcuts", keys: "Mod+/", label: "Show shortcuts", group: "Navigation", global: true },
  { id: "sidebar", keys: "Mod+\\", label: "Show or hide the sidebar", group: "Navigation", global: true },
  { id: "theme", keys: "Alt+T", label: "Switch light and dark", group: "Navigation", global: true },

  { id: "new-page", keys: "Alt+N", label: "New page", group: "Page", global: true },
  { id: "favorite", keys: "Alt+S", label: "Add or remove from favorites", group: "Page", global: true },
  { id: "comments", keys: "Alt+C", label: "Comments", group: "Page", global: true },
  { id: "history", keys: "Alt+H", label: "Version history", group: "Page", global: true },
  { id: "ai-dock", keys: "Alt+A", label: "Open or minimize the AI conversation", group: "Page", global: true },

  { id: "bold", keys: "Mod+B", label: "Bold", group: "Text" },
  { id: "italic", keys: "Mod+I", label: "Italic", group: "Text" },
  { id: "underline", keys: "Mod+U", label: "Underline", group: "Text" },
  { id: "strike", keys: "Mod+Shift+S", label: "Strikethrough", group: "Text" },
  { id: "code", keys: "Mod+E", label: "Inline code", group: "Text" },
  { id: "highlight", keys: "Mod+Shift+H", label: "Highlight", group: "Text" },
  { id: "link", keys: "Mod+K", label: "Link (text selected, or caret in a link)", group: "Text" },
  { id: "sub", keys: "Mod+,", label: "Subscript", group: "Text" },
  { id: "link-open", keys: "Mod+Click", label: "Open a link (a plain click edits it)", group: "Text" },
  { id: "sup", keys: "Mod+.", label: "Superscript", group: "Text" },
  { id: "undo", keys: "Mod+Z", label: "Undo", group: "Text" },
  { id: "redo", keys: "Mod+Shift+Z", label: "Redo", group: "Text" },

  { id: "h1", keys: "Mod+Alt+1", label: "Heading 1", group: "Blocks" },
  { id: "h2", keys: "Mod+Alt+2", label: "Heading 2", group: "Blocks" },
  { id: "h3", keys: "Mod+Alt+3", label: "Heading 3", group: "Blocks" },
  { id: "h4", keys: "Mod+Alt+4", label: "Heading 4", group: "Blocks" },
  { id: "ol", keys: "Mod+Shift+7", label: "Numbered list", group: "Blocks" },
  { id: "ul", keys: "Mod+Shift+8", label: "Bulleted list", group: "Blocks" },
  { id: "task", keys: "Mod+Shift+9", label: "To-do list", group: "Blocks" },
  { id: "quote", keys: "Mod+Shift+B", label: "Quote", group: "Blocks" },
  { id: "codeblock", keys: "Mod+Alt+C", label: "Code block", group: "Blocks" },
  { id: "align-left", keys: "Mod+Shift+L", label: "Align left", group: "Blocks" },
  { id: "align-center", keys: "Mod+Shift+E", label: "Align center", group: "Blocks" },
  { id: "align-right", keys: "Mod+Shift+R", label: "Align right", group: "Blocks" },
  { id: "move-up", keys: "Mod+Shift+↑", label: "Move block up", group: "Blocks" },
  { id: "move-down", keys: "Mod+Shift+↓", label: "Move block down", group: "Blocks" },
  { id: "duplicate", keys: "Mod+D", label: "Duplicate block", group: "Blocks" },
  { id: "indent", keys: "Tab", label: "Indent list item", group: "Blocks" },
  { id: "outdent", keys: "Shift+Tab", label: "Outdent list item", group: "Blocks" },
  { id: "cell-next", keys: "Tab", label: "Next table cell (adds a row at the end)", group: "Blocks" },
  { id: "cell-prev", keys: "Shift+Tab", label: "Previous table cell", group: "Blocks" },

  { id: "ai", keys: "Mod+J", label: "Ask AI (selection or cursor)", group: "Insert" },
  { id: "slash", keys: "/", label: "Block menu", group: "Insert" },
  { id: "mention", keys: "@", label: "Mention a page or person", group: "Insert" },
  { id: "emoji", keys: ":", label: "Emoji", group: "Insert" },
  { id: "md-heading", keys: "#", label: "Heading (# ## ### then space)", group: "Insert" },
  { id: "md-list", keys: "-", label: "Bulleted list (- then space)", group: "Insert" },
  { id: "md-task", keys: "[]", label: "To-do list ([] then space)", group: "Insert" },
  { id: "md-code", keys: "```", label: "Code block", group: "Insert" },
  { id: "md-quote", keys: ">", label: "Quote (> then space)", group: "Insert" },
  { id: "md-ol", keys: "1.", label: "Numbered list (1. then space)", group: "Insert" },
  { id: "md-divider", keys: "---", label: "Divider (--- then Enter)", group: "Insert" },
  { id: "md-inline", keys: "**", label: "Bold, italic, code: **bold**, *italic*, `code`", group: "Insert" },
  { id: "auto-symbols", keys: "->", label: "Turns into symbols: -> becomes an arrow, (c) a copyright sign, :) an emoji", group: "Insert" },
];

const CODES: Record<string, string> = { "/": "Slash", "\\": "Backslash", ",": "Comma", ".": "Period" };

/** True when a keydown matches a combo like "Mod+Shift+L" or "Alt+N". Uses physical keys so Alt+N works on macOS too. */
export function matches(e: KeyboardEvent, keys: string, apple: boolean): boolean {
  const parts = keys.split("+");
  const key = parts.at(-1) ?? "";
  const want = { mod: parts.includes("Mod"), alt: parts.includes("Alt"), shift: parts.includes("Shift") };
  const mod = apple ? e.metaKey : e.ctrlKey;
  const otherMod = apple ? e.ctrlKey : e.metaKey;
  if (mod !== want.mod || e.altKey !== want.alt || e.shiftKey !== want.shift || otherMod) return false;
  const code = CODES[key] ?? (key.length === 1 && /[a-z0-9]/i.test(key) ? (/\d/.test(key) ? `Digit${key}` : `Key${key.toUpperCase()}`) : key);
  return e.code === code;
}
