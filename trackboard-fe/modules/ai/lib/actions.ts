/*
 * What the AI can do, as seen by the browser: labels, grouping and how each result lands in the document.
 * The prompts for these ids live server-side in modules/ai/server/prompts.ts.
 */

export type AiScope = "selection" | "write" | "page" | "ask";

/** Where an accepted result goes. */
export type AiApply =
  | "replace" // replace the selection
  | "insert-below" // new blocks after the selection
  | "at-cursor" // at the caret (write mode)
  | "page-top" // summary callout at the top of the page
  | "page-end" // appended at the end of the page
  | "replace-page" // the whole document
  | "title" // the page title
  | "none"; // read-only answer (ask)

export type AiActionId =
  | "improve"
  | "fix"
  | "shorter"
  | "longer"
  | "simplify"
  | "tone-professional"
  | "tone-friendly"
  | "tone-direct"
  | "translate-en"
  | "translate-id"
  | "explain"
  | "summarize-selection"
  | "to-list"
  | "to-table"
  | "custom-edit"
  | "write"
  | "continue"
  | "outline"
  | "brainstorm"
  | "agenda"
  | "table"
  | "pros-cons"
  | "summarize-page"
  | "action-items"
  | "suggest-title"
  | "cleanup-page"
  | "fix-page"
  | "translate-page-en"
  | "translate-page-id"
  | "ask"
  | "chat";

export type AiAction = { id: AiActionId; label: string; group: string; scope: AiScope; apply: AiApply };

export const AI_ACTIONS: AiAction[] = [
  { id: "improve", label: "Improve writing", group: "Edit", scope: "selection", apply: "replace" },
  { id: "fix", label: "Fix spelling and grammar", group: "Edit", scope: "selection", apply: "replace" },
  { id: "shorter", label: "Make shorter", group: "Edit", scope: "selection", apply: "replace" },
  { id: "longer", label: "Make longer", group: "Edit", scope: "selection", apply: "replace" },
  { id: "simplify", label: "Simplify language", group: "Edit", scope: "selection", apply: "replace" },
  { id: "to-list", label: "Turn into a list", group: "Edit", scope: "selection", apply: "replace" },
  { id: "to-table", label: "Turn into a table", group: "Edit", scope: "selection", apply: "replace" },
  { id: "tone-professional", label: "Professional tone", group: "Tone", scope: "selection", apply: "replace" },
  { id: "tone-friendly", label: "Friendly tone", group: "Tone", scope: "selection", apply: "replace" },
  { id: "tone-direct", label: "Direct tone", group: "Tone", scope: "selection", apply: "replace" },
  { id: "translate-en", label: "Translate to English", group: "Translate", scope: "selection", apply: "replace" },
  { id: "translate-id", label: "Translate to Indonesian", group: "Translate", scope: "selection", apply: "replace" },
  { id: "explain", label: "Explain this", group: "Understand", scope: "selection", apply: "insert-below" },
  { id: "summarize-selection", label: "Summarize this", group: "Understand", scope: "selection", apply: "insert-below" },

  { id: "continue", label: "Continue writing", group: "Write", scope: "write", apply: "at-cursor" },
  { id: "outline", label: "Draft an outline", group: "Write", scope: "write", apply: "at-cursor" },
  { id: "brainstorm", label: "Brainstorm ideas", group: "Write", scope: "write", apply: "at-cursor" },
  { id: "agenda", label: "Meeting agenda", group: "Write", scope: "write", apply: "at-cursor" },
  { id: "table", label: "Make a table", group: "Write", scope: "write", apply: "at-cursor" },
  { id: "pros-cons", label: "Pros and cons", group: "Write", scope: "write", apply: "at-cursor" },

  { id: "summarize-page", label: "Summarize page", group: "Page", scope: "page", apply: "page-top" },
  { id: "action-items", label: "Find action items", group: "Page", scope: "page", apply: "page-end" },
  { id: "suggest-title", label: "Suggest a title", group: "Page", scope: "page", apply: "title" },
  { id: "cleanup-page", label: "Clean up and structure", group: "Page", scope: "page", apply: "replace-page" },
  { id: "fix-page", label: "Fix spelling on the page", group: "Page", scope: "page", apply: "replace-page" },
  { id: "translate-page-en", label: "Translate page to English", group: "Page", scope: "page", apply: "replace-page" },
  { id: "translate-page-id", label: "Translate page to Indonesian", group: "Page", scope: "page", apply: "replace-page" },
];

/** Free-form actions: what the person types becomes the instruction. */
export const CUSTOM_ACTION: Record<"selection" | "write", AiAction> = {
  selection: { id: "custom-edit", label: "Custom instruction", group: "Edit", scope: "selection", apply: "replace" },
  write: { id: "write", label: "Write", group: "Write", scope: "write", apply: "at-cursor" },
};

export const ASK_ACTION: AiAction = { id: "ask", label: "Ask your pages", group: "Ask", scope: "ask", apply: "none" };

export const actionsFor = (scope: AiScope) => AI_ACTIONS.filter((a) => a.scope === scope);

/** Request body for POST /api/ai. */
export type AiRequest = {
  action: AiActionId;
  /** The selected text, or the whole page as Markdown for page actions. */
  text?: string;
  /** What the person typed (custom edit, write, ask). */
  instruction?: string;
  /** Text above the caret, so "continue" and "write" match what's already there. */
  before?: string;
  title?: string;
  /** Pages used to answer a workspace question. */
  pages?: { id: string; title: string; text: string }[];
  /** Conversation so far for the chat dock; the last message is the new question. */
  messages?: ChatMessage[];
};

export type ChatMessage = { role: "user" | "assistant"; content: string };

/** Turns of history the chat sends; older ones stay on screen but are not re-sent. */
export const CHAT_HISTORY = 12;

/** One line of the NDJSON response stream. */
export type AiEvent =
  | { t: "delta"; v: string }
  | { t: "done"; usage: { input: number; output: number }; cut: boolean }
  | { t: "error"; message: string };

/** Hard cap on what one request may send, checked on both sides (about 30k tokens). */
export const MAX_INPUT_CHARS = 120_000;
