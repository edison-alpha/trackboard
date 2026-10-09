"use client";

import { useEffect, useRef } from "react";
import { isApple, isTypingTarget } from "@/lib/platform";
import { SHORTCUTS, matches } from "./lib/registry";

type Handlers = Partial<Record<string, () => void>>;

/** Shortcuts that work from anywhere, including inside the editor (they all carry a modifier). */
const ALWAYS = new Set(["palette", "shortcuts", "sidebar"]);

/**
 * Wires the global shortcuts from the registry to handlers. Runs in the bubble phase, so a key the
 * editor already handled (Mod+K on a selection = link) arrives with defaultPrevented and is skipped.
 */
export function useGlobalShortcuts(handlers: Handlers): void {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    const apple = isApple();
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat) return;
      for (const s of SHORTCUTS) {
        if (!s.global || !matches(e, s.keys, apple)) continue;
        const handler = ref.current[s.id];
        if (!handler) return;
        // Alt shortcuts type characters on macOS; keep them out of plain inputs, but allow in the editor.
        if (!ALWAYS.has(s.id) && isTypingTarget(e.target) && !(e.target as HTMLElement).isContentEditable) return;
        e.preventDefault();
        handler();
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
