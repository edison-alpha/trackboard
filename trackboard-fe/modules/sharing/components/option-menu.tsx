"use client";

import { CaretDown, Check } from "@/components/icons";
import type { ReactNode } from "react";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { cx } from "@/lib/cx";

export type Option<T extends string> = { value: T; label: string; hint?: string };

/** A small dropdown that picks one of a few options (a permission, a role), with an optional destructive action at the end. */
export function OptionMenu<T extends string>({
  value,
  options,
  onChange,
  disabled,
  className,
  remove,
}: {
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
  remove?: { label: string; onSelect: () => void };
}): ReactNode {
  const current = options.find((o) => o.value === value);
  if (disabled) return <span className={cx("px-2 text-sm text-ink-3", className)}>{current?.label}</span>;
  return (
    <Menu>
      <MenuTrigger className={cx("inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-sm text-ink-2 hover:bg-surface-2 data-[state=open]:bg-surface-2 pointer-coarse:h-10", className)}>
        {current?.label}
        <CaretDown size={13} />
      </MenuTrigger>
      <MenuContent align="end" className="w-56">
        {options.map((o) => (
          <MenuItem key={o.value} icon={o.value === value ? <Check size={16} /> : <span className="size-4" />} onSelect={() => onChange(o.value)}>
            <span className="block">{o.label}</span>
            {o.hint && <span className="block text-xs text-ink-3">{o.hint}</span>}
          </MenuItem>
        ))}
        {remove && (
          <>
            <MenuSeparator />
            <MenuItem danger onSelect={remove.onSelect}>
              {remove.label}
            </MenuItem>
          </>
        )}
      </MenuContent>
    </Menu>
  );
}
