/* Page templates. Bracketed text is a placeholder the writer replaces, never sample data dressed as real. */

export type Template = { id: string; name: string; description: string; icon: string; title: string; html: string };

const meeting = `
<p><strong>Date:</strong> [date] · <strong>Attendees:</strong> [@mention people]</p>
<h2>Goal</h2>
<p>[One sentence: the decision this meeting has to reach]</p>
<h2>Agenda</h2>
<ol><li><p>[Topic 1]</p></li><li><p>[Topic 2]</p></li></ol>
<h2>Notes</h2>
<p></p>
<h2>Decisions</h2>
<ul><li><p>[The decision and why]</p></li></ul>
<h2>Follow-ups</h2>
<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>[Task] · [owner] · [due date]</p></li></ul>`;

const prd = `
<div data-type="callout" data-tone="info"><p>Status: [Draft / In review / Approved] · Owner: [name]</p></div>
<h2>Problem</h2>
<p>[Who has which problem, and how we know]</p>
<h2>Goals and how we measure them</h2>
<ul><li><p>[A measure you can check after release]</p></li></ul>
<h2>Out of scope</h2>
<ul><li><p>[What we are deliberately not doing]</p></li></ul>
<h2>Requirements</h2>
<table><tbody>
<tr><th><p>Requirement</p></th><th><p>Priority</p></th><th><p>Notes</p></th></tr>
<tr><td><p>[...]</p></td><td><p>[Must / Should]</p></td><td><p></p></td></tr>
</tbody></table>
<h2>Open questions</h2>
<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>[Question]</p></li></ul>`;

const sop = `
<p>[When to use this procedure and who runs it]</p>
<h2>Before you start</h2>
<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>[Access or tools you need]</p></li></ul>
<h2>Steps</h2>
<ol><li><p>[First step]</p></li><li><p>[Next step]</p></li></ol>
<details><summary>If something fails</summary><div data-type="detailsContent"><p>[Symptom, cause, and how to recover]</p></div></details>`;

const guide = `
<p>This page was written in the editor you're about to use. Change it, delete it, or move it wherever you like.</p>
<h2>Writing</h2>
<ul>
<li><p>Type <code>/</code> on an empty line to insert a block: headings, lists, to-dos, toggles, callouts, code, tables, columns, a table of contents, math, images, files, bookmarks, embeds (Figma, Loom, Google Docs and more), dates, and colors.</p></li>
<li><p>Click the <code>⋮⋮</code> handle left of any block to turn it into another type, color it, duplicate, move, or delete it.</p></li>
<li><p>Select text to open the toolbar for formatting, links, colors, and comments.</p></li>
<li><p>Markdown works as you type: <code>#</code> for a heading, <code>-</code> for a list, <code>[]</code> for a to-do, <code>&gt;</code> for a quote, <code>\`\`\`</code> for code.</p></li>
<li><p>Type <code>@</code> to link another page, <code>:</code> for emoji, and <code>$x^2$</code> for math.</p></li>
<li><p>Drag the handle to the left of a block to move it.</p></li>
</ul>
<h2>Writing together</h2>
<p>Open this page in a second tab and sign in there as someone else: you'll see each other's typing and cursor as it happens. To discuss a passage, select it and press the comment icon in the toolbar.</p>
<h2>Shortcuts</h2>
<ul data-type="taskList">
<li data-type="taskItem" data-checked="false"><p>Press <code>Ctrl/⌘ + K</code> to search pages and run commands.</p></li>
<li data-type="taskItem" data-checked="false"><p>Press <code>Ctrl/⌘ + /</code> to see every shortcut.</p></li>
<li data-type="taskItem" data-checked="false"><p>Press <code>Alt + N</code> to create a page.</p></li>
</ul>
<div data-type="callout" data-tone="info"><p>For now, every page is stored in this browser. Once trackboard-be is connected, pages sync through the server and teammates can open them on their own devices.</p></div>`;

export const TEMPLATES: Template[] = [
  { id: "meeting", name: "Meeting notes", description: "Agenda, decisions, and follow-ups", icon: "🗓️", title: "Meeting notes", html: meeting },
  { id: "prd", name: "Product spec (PRD)", description: "Problem, goals, requirements, open questions", icon: "📐", title: "Product spec", html: prd },
  { id: "sop", name: "Procedure (SOP)", description: "Prerequisites, steps, and recovery", icon: "🧾", title: "Procedure", html: sop },
];

const ALL = [...TEMPLATES, { id: "guide", name: "Guide", description: "", icon: "🧭", title: "Trackboard guide", html: guide }];

export function templateById(id: string | null | undefined): Template | undefined {
  return ALL.find((t) => t.id === id);
}
