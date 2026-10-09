"use client";

import { useEffect, useState } from "react";
import { cx } from "@/lib/cx";
import { isApple } from "@/lib/platform";

const APPLE: Record<string, string> = { Mod: "⌘", Alt: "⌥", Shift: "⇧", Enter: "↵" };
const OTHER: Record<string, string> = { Mod: "Ctrl", Alt: "Alt", Shift: "Shift", Enter: "Enter" };

/** Renders a shortcut like "Mod+Shift+L" as keycaps for the current platform. */
export function Kbd({ keys, className }: { keys: string; className?: string }) {
  const [apple, setApple] = useState(false);
  useEffect(() => setApple(isApple()), []);
  const map = apple ? APPLE : OTHER;
  return (
    <span className={cx("inline-flex items-center gap-1", className)}>
      {keys.split("+").map((k) => (
        <kbd
          key={k}
          className="inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-line-strong bg-surface px-1.5 font-sans text-[11px] font-medium text-ink-2"
        >
          {map[k] ?? k}
        </kbd>
      ))}
    </span>
  );
}

/** Compact one-line shortcut for dense lists (menus, suggestions), where keycaps would not fit. */
export function KeyHint({ keys, className }: { keys: string; className?: string }) {
  const [apple, setApple] = useState(false);
  useEffect(() => setApple(isApple()), []);
  const map = apple ? APPLE : OTHER;
  const parts = keys.split("+").map((k) => map[k] ?? k);
  return <span className={cx("shrink-0 font-sans text-xs whitespace-nowrap text-ink-3 tabular-nums", className)}>{parts.join(apple ? "" : "+")}</span>;
}
