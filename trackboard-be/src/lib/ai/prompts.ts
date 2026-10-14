import type { AiActionId, AiRequest } from "@trackboard/api-types";

/*
 * One frozen system prompt shared by every action (so the prefix stays identical between requests),
 * plus a short task line per action in the user turn.
 */
export const SYSTEM = `You are the writing assistant inside Trackdocs, a documentation editor for teams.

Rules for every reply:
- Reply with the result only. No preamble ("Here is..."), no closing remarks, no notes about what you changed.
- Write Markdown the editor can render: ## headings, bullet and numbered lists, to-do items written as "- [ ] item", tables, **bold**, *italic*, \`code\`, links.
- Keep the language of the provided text unless the task says to translate.
- Never invent facts, names, numbers, dates, quotes or sources that are not in the provided text. When a needed detail is unknown, write a bracketed placeholder such as [date] or [owner].
- Plain, direct wording. Avoid filler and marketing words.`;

const TASKS: Record<Exclude<AiActionId, "ask" | "chat">, string> = {
  improve: "Rewrite the selection so it reads more clearly and flows better. Keep the meaning, the facts and roughly the same length.",
  fix: "Fix spelling, grammar and punctuation in the selection. Change nothing else.",
  shorter: "Rewrite the selection at about half its length. Keep every important point.",
  longer: "Expand the selection with more explanation and detail drawn from what it already says. Do not add new facts.",
  simplify: "Rewrite the selection in simple words and short sentences a new teammate understands.",
  "tone-professional": "Rewrite the selection in a professional, neutral tone.",
  "tone-friendly": "Rewrite the selection in a warm, friendly tone.",
  "tone-direct": "Rewrite the selection to be direct and concise. Lead with the point.",
  "translate-en": "Translate the selection into English. Keep formatting.",
  "translate-id": "Translate the selection into Indonesian (Bahasa Indonesia). Keep formatting.",
  explain: "Explain the selection in plain words for a teammate who missed the discussion, in 2 to 5 sentences.",
  "summarize-selection": "Summarize the selection as 2 to 5 short bullet points.",
  "to-list": "Turn the selection into a bullet list. One idea per item.",
  "to-table": "Turn the selection into a Markdown table with sensible column headers.",
  "custom-edit": "Apply the instruction to the selection and return the edited selection.",
  write: "Write what the instruction asks for. Fit it to the page title and the text above the caret.",
  continue: "Continue writing from where the text above the caret stops, in the same voice. Write 1 to 3 paragraphs. Do not repeat what is already there.",
  outline: "Draft an outline for this page as nested bullet points with ## section headings. Base it on the title and the text so far.",
  brainstorm: "Brainstorm 8 to 12 distinct ideas for the topic of this page as a bullet list, one line each.",
  agenda: "Write a meeting agenda for this page: a ## Goal line, a numbered list of topics with time boxes as [mm] placeholders, and a ## Follow-ups to-do list.",
  table: "Create a Markdown table for what the instruction or page title describes. Use [placeholders] for unknown cells.",
  "pros-cons": "List pros and cons for the topic of this page under ## Pros and ## Cons, as bullet points.",
  "summarize-page": "Summarize the page in 3 to 6 bullet points that a reader can scan in 20 seconds.",
  "action-items": "Find every task, decision that needs follow-up, or open question in the page. Return them only as a to-do list (- [ ] item), with the owner in brackets when the page names one. If there are none, reply exactly: No action items found.",
  "suggest-title": "Suggest one short, specific title for the page (at most 8 words). Reply with the title only, no quotes or punctuation at the end.",
  "cleanup-page": "Restructure the page into a clean document: clear ## headings, short paragraphs, lists where the content is a list. Keep every fact, link and to-do. Do not add new content.",
  "fix-page": "Fix spelling, grammar and punctuation across the whole page. Keep the structure and everything else unchanged.",
  "translate-page-en": "Translate the whole page into English. Keep the structure and formatting.",
  "translate-page-id": "Translate the whole page into Indonesian (Bahasa Indonesia). Keep the structure and formatting.",
};

const ASK_TASK = `Answer the question using only the pages below.
- Start with the direct answer, then supporting points.
- Cite each page you rely on as a Markdown link: [Page title](/p/PAGE_ID).
- If the pages do not contain the answer, say it isn't in the workspace yet and name the page that would need to exist.`;

/** Builds the user turn: task first, then the material in tags so instructions and content never mix. */
export function buildUserMessage(req: AiRequest): string {
  const parts: string[] = [];
  if (req.action === "ask") {
    parts.push(ASK_TASK);
    for (const p of req.pages ?? []) parts.push(`<page id="${p.id}" title="${escapeAttr(p.title)}">\n${p.text}\n</page>`);
    parts.push(`<question>\n${req.instruction ?? ""}\n</question>`);
    return parts.join("\n\n");
  }
  parts.push(`Task: ${TASKS[req.action as Exclude<AiActionId, "ask" | "chat">]}`);
  if (req.instruction) parts.push(`<instruction>\n${req.instruction}\n</instruction>`);
  if (req.title) parts.push(`<page_title>${req.title}</page_title>`);
  if (req.before) parts.push(`<text_above_caret>\n${req.before}\n</text_above_caret>`);
  if (req.text) parts.push(`<${tagFor(req.action)}>\n${req.text}\n</${tagFor(req.action)}>`);
  return parts.join("\n\n");
}

const PAGE_ACTIONS = new Set<AiActionId>(["summarize-page", "action-items", "suggest-title", "cleanup-page", "fix-page", "translate-page-en", "translate-page-id"]);
const tagFor = (id: AiActionId) => (PAGE_ACTIONS.has(id) ? "page" : "selection");
const escapeAttr = (s: string) => s.replace(/"/g, "&quot;");

/** Output budget per action: enough for the job, small enough to keep runs cheap. */
export function maxTokensFor(req: AiRequest): number {
  const inputTokens = Math.ceil((req.text?.length ?? 0) / 3.5);
  const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.ceil(n)));
  switch (req.action) {
    case "suggest-title":
      return 60;
    case "explain":
    case "summarize-selection":
    case "summarize-page":
      return 700;
    case "action-items":
      return 900;
    case "ask":
      return 1500;
    case "longer":
      return clamp(inputTokens * 2.2 + 300, 400, 4000);
    case "cleanup-page":
    case "fix-page":
    case "translate-page-en":
    case "translate-page-id":
      return clamp(inputTokens * 1.6 + 300, 600, 12000);
    case "write":
    case "continue":
    case "outline":
    case "brainstorm":
    case "agenda":
    case "table":
    case "pros-cons":
      return 2000;
    default:
      return clamp(inputTokens * 1.6 + 200, 300, 4000);
  }
}

/* ---------- chat dock ---------- */

export const CHAT_SYSTEM = `${SYSTEM}

You are also a conversation partner about the page the person has open. Answer questions about it, draft text for it, and suggest edits.
- When you write content meant for the page, write it as ready-to-insert Markdown with no lead-in sentence, so the person can insert your whole reply as is.
- When you answer a question, answer it directly and briefly.
- If the page does not contain what you need, say so instead of guessing.`;

/**
 * The conversation for Claude: earlier turns as they were, and the newest question wrapped with the page
 * and the selection, so the context always reflects the page as it is now.
 */
export function buildChatMessages(req: AiRequest): { role: "user" | "assistant"; content: string }[] {
  const history = (req.messages ?? []).filter((m) => m.content.trim());
  const last = history.at(-1);
  if (!last || last.role !== "user") return [];
  const parts: string[] = [];
  if (req.title) parts.push(`<page_title>${req.title}</page_title>`);
  // An empty page is still context: say so, or the model answers as if it could not see the page.
  if (req.text !== undefined) parts.push(req.text.trim() ? `<page>\n${req.text}\n</page>` : "<page>(This page is empty so far.)</page>");
  if (req.before) parts.push(`<selection>\n${req.before}\n</selection>`);
  parts.push(last.content);
  // The API expects the turns to alternate, starting with the person.
  const turns = history.slice(0, -1);
  while (turns[0]?.role === "assistant") turns.shift();
  return [...turns, { role: "user", content: parts.join("\n\n") }];
}
