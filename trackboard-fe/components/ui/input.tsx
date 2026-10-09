import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cx } from "@/lib/cx";

const field =
  "w-full rounded-(--radius-field) border border-field-line/35 bg-surface-2 px-3.5 text-[15px] text-ink placeholder:text-ink-3 transition-colors hover:border-field-line/70 focus-visible:border-accent focus-visible:bg-bg focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus/40";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cx(field, "h-10 pointer-coarse:h-11", className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cx(field, "min-h-20 resize-none py-2.5 leading-relaxed", className)} {...rest} />;
});

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm font-medium text-ink-2">{label}</span>
      {children}
      {hint && <span className="text-xs text-ink-3">{hint}</span>}
    </label>
  );
}
