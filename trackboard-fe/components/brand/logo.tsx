import { cx } from "@/lib/cx";

export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={cx("shrink-0", className)} aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="var(--accent)" />
      <path d="M9 6.5h9l5 5v14H9z" fill="#fff" />
      <path d="M18 6.5v5h5" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M12.5 16h7M12.5 19.5h7M12.5 23h5" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2", className)}>
      <LogoMark size={24} />
      <span className="text-[17px] font-bold tracking-[-0.01em] text-ink">trackdocs</span>
    </span>
  );
}
