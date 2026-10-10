import type { AnyExtension } from "@tiptap/core";
import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import { Collaboration } from "@tiptap/extension-collaboration";
import { CollaborationCaret } from "@tiptap/extension-collaboration-caret";
import { Details, DetailsContent, DetailsSummary } from "@tiptap/extension-details";
import { Emoji, gitHubEmojis, type EmojiItem } from "@tiptap/extension-emoji";
import { FileHandler } from "@tiptap/extension-file-handler";
import { Highlight } from "@tiptap/extension-highlight";
import { InvisibleCharacters } from "@tiptap/extension-invisible-characters";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Mathematics } from "@tiptap/extension-mathematics";
import { Subscript } from "@tiptap/extension-subscript";
import { Superscript } from "@tiptap/extension-superscript";
import { TableKit } from "@tiptap/extension-table";
import { TableOfContents, getHierarchicalIndexes, type TableOfContentData } from "@tiptap/extension-table-of-contents";
import { TextAlign } from "@tiptap/extension-text-align";
import { TextStyleKit } from "@tiptap/extension-text-style";
import { Typography } from "@tiptap/extension-typography";
import { UniqueID } from "@tiptap/extension-unique-id";
import { CharacterCount, Focus, Placeholder } from "@tiptap/extensions";
import { Markdown } from "@tiptap/markdown";
import { StarterKit } from "@tiptap/starter-kit";
import { common, createLowlight } from "lowlight";
import type * as Y from "yjs";
import { EmojiMenu } from "../components/emoji-menu";
import type { EditorContext } from "../lib/slash-items";
import { suggestionRenderer } from "../lib/suggestion-renderer";
import { BlockActions } from "./block-actions";
import { Callout } from "./callout";
import { CommentMark } from "./comment-mark";
import { createMention, type MentionSources } from "./mention";
import { Bookmark } from "./nodes/bookmark";
import { Column, Columns } from "./nodes/columns";
import { DateChip } from "./nodes/date-chip";
import { Embed } from "./nodes/embed";
import { FileBlock } from "./nodes/file-block";
import { Heading } from "./nodes/heading";
import { Image } from "./nodes/image";
import { TocBlock } from "./nodes/toc-block";
import { Youtube } from "./nodes/youtube";
import { SlashCommand } from "./slash-command";

const lowlight = createLowlight(common);

export type CollabUser = { id: string; name: string; color: string };

export type BuildOptions = {
  /** Live mode: the shared doc, its awareness carrier and the local user. Omit for read-only previews. */
  collab?: { doc: Y.Doc; provider: { awareness: unknown; on: (e: string, cb: () => void) => void; off: (e: string, cb: () => void) => void }; user: CollabUser };
  /** Read-only preview of a stored Y.Doc (version history). */
  previewDoc?: Y.Doc;
  context?: EditorContext;
  mentions?: MentionSources;
  onImageFiles?: (files: File[], pos?: number) => void;
  onTocUpdate?: (data: TableOfContentData) => void;
  onCommentActivate?: (threadId: string) => void;
  onLinkRequest?: () => void;
  onAiRequest?: () => void;
};

/** Every extension the Trackdocs editor uses, configured in one place. */
export function buildExtensions(o: BuildOptions): AnyExtension[] {
  const doc = o.collab?.doc ?? o.previewDoc;

  const ext: AnyExtension[] = [
    StarterKit.configure({
      // Collaboration brings its own history that only undoes your own changes.
      undoRedo: false,
      codeBlock: false,
      heading: false,
      link: { openOnClick: false, autolink: true, defaultProtocol: "https", HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" } },
      dropcursor: { color: "var(--accent)", width: 2 },
    }),
    Heading.configure({ levels: [1, 2, 3, 4] }),
    CodeBlockLowlight.configure({ lowlight, defaultLanguage: null }),
    Placeholder.configure({
      includeChildren: false,
      placeholder: ({ node, editor }) => {
        if (node.type.name === "heading") return `Heading ${node.attrs.level}`;
        if (node.type.name === "detailsSummary") return "Toggle title";
        return editor.isEmpty ? "Start writing, or type / to insert a block" : "Type / for blocks";
      },
    }),
    CharacterCount,
    Focus.configure({ className: "has-focus", mode: "shallowest" }),
    Typography,
    Highlight.configure({ multicolor: true }),
    TextStyleKit,
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    Subscript,
    Superscript,
    TaskList,
    TaskItem.configure({ nested: true }),
    TableKit.configure({ table: { resizable: true, cellMinWidth: 80 } }),
    Details.configure({ persist: true, HTMLAttributes: { class: "tb-details" } }),
    DetailsSummary,
    DetailsContent,
    Image.configure({ allowBase64: true, HTMLAttributes: { class: "tb-image" } }),
    Youtube.configure({ nocookie: true, modestBranding: true, HTMLAttributes: { class: "tb-video" } }),
    Mathematics.configure({ katexOptions: { throwOnError: false } }),
    Emoji.configure({
      emojis: gitHubEmojis,
      enableEmoticons: true,
      suggestion: {
        items: ({ editor, query }) => {
          const q = query.toLowerCase();
          const all = (editor.storage as unknown as { emoji: { emojis: EmojiItem[] } }).emoji.emojis;
          return all.filter((e) => e.emoji && (e.shortcodes.some((s) => s.startsWith(q)) || e.tags.some((t) => t.startsWith(q)))).slice(0, 24);
        },
        render: suggestionRenderer(EmojiMenu),
      },
    }),
    InvisibleCharacters.configure({ visible: false }),
    UniqueID.configure({ types: ["heading", "paragraph", "callout", "taskList", "table", "columns", "embed", "bookmark", "fileBlock"] }),
    TableOfContents.configure({
      getIndex: getHierarchicalIndexes,
      onUpdate: (data) => o.onTocUpdate?.(data),
      scrollParent: () => document.getElementById("tb-scroll") ?? window,
    }),
    Markdown,
    Callout,
    Columns,
    Column,
    Embed,
    Bookmark,
    FileBlock,
    DateChip,
    TocBlock,
    CommentMark.configure({ onActivate: o.onCommentActivate ?? (() => {}) }),
    BlockActions.configure({ onLinkRequest: o.onLinkRequest ?? (() => {}), onAiRequest: o.onAiRequest ?? (() => {}) }),
  ];

  if (doc) ext.push(Collaboration.configure({ document: doc, field: "default" }));
  if (o.collab) ext.push(CollaborationCaret.configure({ provider: o.collab.provider, user: o.collab.user }));
  if (o.context) ext.push(SlashCommand.configure({ context: o.context }));
  // Always in the schema so documents with mentions open everywhere, even where suggesting is off.
  ext.push(createMention(o.mentions ?? { pages: () => [], people: () => [] }));
  if (o.onImageFiles) {
    const onImageFiles = o.onImageFiles;
    ext.push(
      FileHandler.configure({
        allowedMimeTypes: ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"],
        onDrop: (_editor, files, pos) => onImageFiles(files, pos),
        onPaste: (_editor, files, html) => {
          // Pasted HTML that carries the image already is handled by the Image extension.
          if (!html) onImageFiles(files);
        },
      }),
    );
  }
  return ext;
}
