import BoringAvatar from "boring-avatars";
import { cx } from "@/lib/cx";

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")).toUpperCase();
}

/** Mixes a hex colour toward white (amount > 0) or black (amount < 0). */
function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const target = amount > 0 ? 255 : 0;
  const k = Math.abs(amount);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round(c + (target - c) * k));
  return `#${ch.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Default avatar (boring-avatars "beam"), generated from the person's id or name and tinted with their
 * cursor colour, so the face in the sidebar matches the caret in the document.
 */
export function Avatar({ name, color, seed, size = 28, className }: { name: string; color: string; seed?: string; size?: number; ring?: boolean; className?: string }) {
  const palette = [color, shade(color, 0.55), shade(color, 0.82), shade(color, -0.35), "#f5d77a"];
  return (
    <span title={name} className={cx("inline-flex shrink-0 overflow-hidden rounded-full align-middle select-none", className)} style={{ width: size, height: size }}>
      <BoringAvatar name={seed ?? name} variant="beam" colors={palette} size={size} title={false} aria-hidden="true" />
      <span className="sr-only">{name}</span>
    </span>
  );
}
