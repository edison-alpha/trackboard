"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import { Spinner } from "./spinner";

type Variant = "primary" | "glass" | "ghost" | "danger";
type Size = "md" | "sm";

/* Pill shape is reserved for buttons (DESIGN.md "Shape"). Glass sits on primary and glass variants only.
   pointer-coarse raises every button to a 44px touch target on phones and tablets. */
const base =
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium leading-none select-none transition-[background,color,box-shadow,transform] duration-150 active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100";

const sizes: Record<Size, string> = {
  md: "h-10 px-4 text-[15px] pointer-coarse:h-11",
  sm: "h-8 px-3 text-sm pointer-coarse:h-11 pointer-coarse:px-4",
};

const variants: Record<Variant, string> = {
  // Accent fill frosted like the glass buttons, so primary and secondary actions share one material.
  // Solid accent, flat: no inner highlight (white label 4.72:1).
  primary:
    "bg-accent text-on-accent shadow-[0_1px_2px_rgb(0_0_0/0.14)] hover:bg-accent-strong",
  glass: "glass text-ink hover:[background:var(--glass-bg-hover)]",
  ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink",
  danger: "bg-danger-soft text-danger hover:brightness-95 dark:hover:brightness-125",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  busy?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "glass", size = "md", icon, busy, children, className, type = "button", disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(base, sizes[size], variants[variant], className)}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...rest}
    >
      {busy ? <Spinner /> : icon}
      {children}
    </button>
  );
});

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Required: icon-only buttons need an accessible name. Also shown as the native tooltip. */
  label: string;
  active?: boolean;
  size?: "md" | "sm";
};

/** Square icon control for toolbars and rows. Round, not pill, so it reads as a tool rather than an action. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, active, size = "md", className, children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-full text-ink-2 transition-colors duration-150 hover:bg-surface-2 hover:text-ink active:scale-95 disabled:opacity-40",
        size === "md" ? "size-9 pointer-coarse:size-11" : "size-7 pointer-coarse:size-10",
        active && "bg-accent-soft text-accent-ink hover:bg-accent-soft hover:text-accent-ink",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
