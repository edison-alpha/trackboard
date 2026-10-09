import { Extension } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import Suggestion from "@tiptap/suggestion";
import { SlashMenu } from "../components/slash-menu";
import { filterSlashItems, type EditorContext, type SlashItem } from "../lib/slash-items";
import { suggestionRenderer } from "../lib/suggestion-renderer";

/** "/" at the start of a block (or after a space) opens the block menu. */
export const SlashCommand = Extension.create<{ context: EditorContext | null }>({
  name: "slashCommand",

  addOptions() {
    return { context: null };
  },

  addProseMirrorPlugins() {
    const context = this.options.context;
    return [
      Suggestion<SlashItem, SlashItem>({
        editor: this.editor,
        pluginKey: new PluginKey("slashCommand"),
        char: "/",
        allowSpaces: false,
        startOfLine: false,
        allow: ({ state, range }) => {
          const $from = state.doc.resolve(range.from);
          // Not inside code, where "/" is just a character.
          return $from.parent.type.name !== "codeBlock";
        },
        items: ({ query }) => filterSlashItems(query),
        command: ({ editor, range, props }) => {
          if (context) props.run(editor, range, context);
        },
        render: suggestionRenderer(SlashMenu),
      }),
    ];
  },
});
