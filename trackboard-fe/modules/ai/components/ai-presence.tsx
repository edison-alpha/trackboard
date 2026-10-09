"use client";

import { BotAvatar } from "bot-avatars";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { ThinkingOrb, type OrbState } from "thinking-orbs";
import { cx } from "@/lib/cx";
import type { AiActionId } from "../lib/actions";

/* The AI's face and its "thinking" indicator, both in the Trackboard accent (DESIGN.md palette). */

const BRAND = "#0b6fe8";
const BRAND_ON_DARK = "#4da3ff";

/** Resolved theme after mount; avoids a server/client mismatch on the first paint. */
function useDark(): boolean {
  const { resolvedTheme } = useTheme();
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(resolvedTheme === "dark"), [resolvedTheme]);
  return dark;
}

/**
 * The assistant: a glossy rounded-square bot in brand blue (its shape echoes the logo tile).
 * Idles while waiting, hops while the model is working.
 */
export function AiAvatar({ thinking = false, size = 28, className }: { thinking?: boolean; size?: number; className?: string }) {
  return (
    <span className={cx("grid shrink-0 place-items-center", className)} style={{ width: size, height: size }} aria-hidden="true">
      <BotAvatar type="square" color={BRAND} shading="plastic" saturation={1.2} face="mouth" state={thinking ? "working" : "default"} size={size} interactive={false} />
    </span>
  );
}

/** Each kind of job gets the orb animation that reads like it. */
export function orbStateFor(action: AiActionId | undefined): OrbState {
  switch (action) {
    case "ask":
      return "searching";
    case "translate-en":
    case "translate-id":
    case "translate-page-en":
    case "translate-page-id":
      return "weaving";
    case "explain":
    case "summarize-selection":
    case "summarize-page":
    case "action-items":
      return "solving";
    case "outline":
    case "table":
    case "to-list":
    case "to-table":
    case "cleanup-page":
      return "shaping";
    case "brainstorm":
    case "pros-cons":
      return "connecting";
    default:
      return "composing";
  }
}

/** Replaces the spinner while the model works. Tinted with the accent, tuned for the current theme. */
export function AiThinking({ state = "composing", size = 20, label }: { state?: OrbState; size?: 20 | 32 | 64; label: string }) {
  const dark = useDark();
  return (
    <span role="status" aria-label={label} className="inline-flex shrink-0">
      <ThinkingOrb state={state} size={size} theme={dark ? "dark" : "light"} color={dark ? BRAND_ON_DARK : BRAND} aria-hidden="true" />
    </span>
  );
}
