import { cx } from "@/lib/cx";

/* The Trackboard mark: a T built from three board columns (DESIGN.md "Identity motif").
   Two short columns form the bar, the tall middle column forms the stem. */
export const LOGO_COLUMNS = [
  { x: 6.5, height: 6.5 },
  { x: 13.5, height: 17 },
  { x: 20.5, height: 6.5 },
] as const;
export const LOGO_COLUMN = { y: 7.5, width: 5, radius: 2.5 } as const;

export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={cx("shrink-0", className)} aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="var(--accent)" />
      {LOGO_COLUMNS.map((c) => (
        <rect key={c.x} x={c.x} y={LOGO_COLUMN.y} width={LOGO_COLUMN.width} height={c.height} rx={LOGO_COLUMN.radius} fill="#fff" />
      ))}
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2", className)}>
      <LogoMark size={24} />
      <span className="text-[17px] font-bold tracking-[-0.01em] text-ink">trackboard</span>
    </span>
  );
}
