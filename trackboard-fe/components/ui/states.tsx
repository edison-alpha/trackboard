import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

/** The board-column motif as an empty-state illustration: three columns, the middle one still unfilled. */
function ColumnsArt() {
  return (
    <svg width="72" height="56" viewBox="0 0 72 56" aria-hidden="true" className="text-line-strong">
      <rect x="2" y="2" width="20" height="24" rx="8" fill="currentColor" />
      <rect x="26" y="2" width="20" height="52" rx="8" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
      <rect x="50" y="2" width="20" height="24" rx="8" fill="currentColor" />
    </svg>
  );
}

/** Empty state: says why it is empty and offers the one action that fills it (R-27). */
export function EmptyState({ title, body, action, className }: { title: string; body: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cx("flex flex-col items-center px-6 py-16 text-center", className)}>
      <ColumnsArt />
      <h2 className="mt-5 text-base font-semibold text-ink">{title}</h2>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-ink-3">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Error state: what failed and what to do next, never colour alone. */
export function ErrorState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center px-6 py-16 text-center">
      <span className="rounded-full bg-danger-soft px-3 py-1 text-xs font-semibold text-danger">Error</span>
      <h2 className="mt-4 text-base font-semibold text-ink">{title}</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-3">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
