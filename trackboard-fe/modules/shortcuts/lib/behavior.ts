/* What the editor does that a shortcut list can't say: limits, shared state and what leaves the page.
   Shown under the shortcuts in the Ctrl/⌘ + / dialog. Keep each line true to the code it describes. */

export type BehaviorNote = { id: string; title: string; body: string };

export const BEHAVIOR_NOTES: BehaviorNote[] = [
  { id: "files", title: "Files and images", body: "They are stored inside the page: images up to 3 MB, other files up to 5 MB. Drop or paste them anywhere in the page." },
  { id: "blocks", title: "Moving, duplicating, deleting", body: "These act on the whole top-level block. Inside a column, callout or list that means the entire row, callout or list." },
  { id: "fold", title: "Folded headings and toggles", body: "Folding is shared: everyone on the page sees the same sections open or closed. Folded sections still print in full." },
  { id: "undo", title: "Undo", body: "Undo only reverts your own edits. A page made from the block menu stays in the sidebar, so use Undo on its notice to remove it." },
  { id: "links", title: "Links", body: "A plain click edits the text. Hold Ctrl/⌘ and click to open a link." },
  { id: "bookmark", title: "Bookmarks and embeds", body: "A bookmark doesn't fetch a preview, so give it a title. Some sites refuse to be shown inside a page; use \"open original\" on the embed." },
  { id: "dates", title: "Dates", body: "Today's date uses your local time zone. A date is a label; it doesn't send reminders." },
  { id: "markdown", title: "Markdown export and import", body: "Export keeps text, lists, tables, code and callouts. Uploaded files, comments and the columns layout are not included, and embeds become links. Import replaces the whole page; callouts exported from here come back as callouts." },
  { id: "ai", title: "Ask AI", body: "The selected text, or the whole page for page actions, is sent to the AI service. The selection follows the text if others edit around it." },
];
