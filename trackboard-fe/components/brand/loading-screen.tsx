"use client";

import { motion, useReducedMotion } from "motion/react";
import { cx } from "@/lib/cx";
import { LOGO_COLUMN, LOGO_COLUMNS } from "./logo";

/** The logo columns rise one after another, then settle and rise again while work is still running. */
export function LoaderMark({ size = 72 }: { size?: number }) {
  const reduce = useReducedMotion();
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="var(--accent)" />
      {LOGO_COLUMNS.map((c, i) => (
        <motion.rect
          key={c.x}
          x={c.x}
          y={LOGO_COLUMN.y}
          width={LOGO_COLUMN.width}
          height={c.height}
          rx={LOGO_COLUMN.radius}
          fill="#fff"
          style={{ originY: 0, transformBox: "fill-box" }}
          initial={reduce ? false : { scaleY: 0.15, opacity: 0.4 }}
          animate={reduce ? undefined : { scaleY: [0.15, 1, 1, 0.15], opacity: [0.4, 1, 1, 0.4] }}
          transition={{ duration: 1.6, times: [0, 0.35, 0.75, 1], ease: "easeInOut", repeat: Infinity, delay: i * 0.14 }}
        />
      ))}
    </svg>
  );
}

/** Full-screen boot screen. Shown only while the workspace is actually being opened from storage. */
export function LoadingScreen({ status = "Opening your workspace", className }: { status?: string; className?: string }) {
  return (
    <motion.div
      className={cx("fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5 bg-bg", className)}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.02, transition: { duration: 0.28, ease: "easeOut" } }}
      role="status"
      aria-live="polite"
    >
      <LoaderMark />
      <div className="text-center">
        <p className="text-xl font-bold tracking-[-0.01em] text-ink">trackboard</p>
        <p className="mt-1 text-sm text-ink-3">{status}…</p>
      </div>
    </motion.div>
  );
}

/** Inline version for a single page that is still syncing. */
export function InlineLoader({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center gap-3 py-24 text-sm text-ink-3">
      <LoaderMark size={36} />
      {label}…
    </div>
  );
}
