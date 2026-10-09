import { computePosition, flip, offset, shift, size } from "@floating-ui/dom";
import { ReactRenderer } from "@tiptap/react";
import type { SuggestionKeyDownProps, SuggestionOptions, SuggestionProps } from "@tiptap/suggestion";
import type { ComponentType, RefAttributes } from "react";

export type SuggestionListHandle = { onKeyDown: (props: SuggestionKeyDownProps) => boolean };

type ListComponent<I> = ComponentType<SuggestionProps<I> & RefAttributes<SuggestionListHandle>>;

/**
 * Bridges Tiptap's suggestion plugin to a React list rendered in a floating layer next to the caret.
 * Shared by slash commands, mentions and emoji so all three popups look and behave the same.
 */
export function suggestionRenderer<I>(List: ListComponent<I>): SuggestionOptions<I>["render"] {
  return () => {
    let renderer: ReactRenderer<SuggestionListHandle, SuggestionProps<I>> | null = null;
    let el: HTMLDivElement | null = null;

    const place = (props: SuggestionProps<I>) => {
      const rect = props.clientRect?.();
      if (!el || !rect) return;
      const virtual = { getBoundingClientRect: () => rect };
      void computePosition(virtual, el, {
        placement: "bottom-start",
        strategy: "fixed",
        middleware: [
          offset(8),
          flip({ padding: 12 }),
          shift({ padding: 12 }),
          size({ padding: 12, apply: ({ availableHeight }) => {
            if (el) el.style.maxHeight = `${Math.min(360, availableHeight)}px`;
          },
        }),
        ],
      }).then(({ x, y }) => {
        if (el) Object.assign(el.style, { left: `${x}px`, top: `${y}px` });
      });
    };

    return {
      onStart(props) {
        renderer = new ReactRenderer(List, { props, editor: props.editor });
        el = document.createElement("div");
        el.style.position = "fixed";
        el.style.zIndex = "60";
        el.appendChild(renderer.element);
        document.body.appendChild(el);
        place(props);
      },
      onUpdate(props) {
        renderer?.updateProps(props);
        place(props);
      },
      onKeyDown(props) {
        if (props.event.key === "Escape") {
          el?.remove();
          return true;
        }
        return renderer?.ref?.onKeyDown(props) ?? false;
      },
      onExit() {
        renderer?.destroy();
        el?.remove();
        renderer = null;
        el = null;
      },
    };
  };
}
