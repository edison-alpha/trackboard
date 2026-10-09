"use client";

import { motion } from "motion/react";
import { cx } from "@/lib/cx";
import { LogoMark } from "./logo";

/** Reuses the document mark so the loading screen and sidebar share the same identity. */
export function LoaderMark({ size = 72 }: { size?: number }) {
  return (
    <LogoMark size={size} />
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
        <p className="text-xl font-bold tracking-[-0.01em] text-ink">trackdocs</p>
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
