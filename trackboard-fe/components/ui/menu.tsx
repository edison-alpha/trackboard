"use client";

import { Check, CaretRight } from "@/components/icons";
import { DropdownMenu as R } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cx } from "@/lib/cx";
import { KeyHint } from "./kbd";

/* Dropdown menu built on Radix: keyboard navigation, typeahead and Escape come for free.
   The surface is a floating glass layer (DESIGN.md "Glass"). */

export const Menu = R.Root;
export const MenuTrigger = R.Trigger;
export const MenuGroup = R.Group;
export const MenuSub = R.Sub;

export const menuSurface = "floating pop z-50 min-w-52 rounded-(--radius-menu) p-1.5 text-sm text-ink";

export function MenuContent({ className, children, ...rest }: ComponentProps<typeof R.Content>) {
  return (
    <R.Portal>
      <R.Content sideOffset={6} collisionPadding={12} className={cx(menuSurface, className)} {...rest}>
        {children}
      </R.Content>
    </R.Portal>
  );
}

const itemClass =
  "relative flex h-9 cursor-pointer items-center gap-2.5 rounded-(--radius-row) px-2.5 outline-none select-none data-disabled:cursor-not-allowed data-disabled:opacity-40 data-highlighted:bg-surface-2/80 pointer-coarse:h-11 [&>svg]:shrink-0 [&>svg]:text-ink-2";

type ItemProps = ComponentProps<typeof R.Item> & { icon?: ReactNode; shortcut?: string; danger?: boolean };

export function MenuItem({ icon, shortcut, danger, className, children, ...rest }: ItemProps) {
  return (
    <R.Item className={cx(itemClass, danger && "text-danger [&>svg]:text-danger", className)} {...rest}>
      {icon}
      <span className="flex-1 truncate">{children}</span>
      {shortcut && <KeyHint keys={shortcut} className="ml-4" />}
    </R.Item>
  );
}

export function MenuCheckItem({ checked, onCheckedChange, children, icon }: { checked: boolean; onCheckedChange: (v: boolean) => void; children: ReactNode; icon?: ReactNode }) {
  return (
    <R.CheckboxItem checked={checked} onCheckedChange={onCheckedChange} onSelect={(e) => e.preventDefault()} className={itemClass}>
      {icon}
      <span className="flex-1">{children}</span>
      <R.ItemIndicator>
        <Check size={14} weight="bold" className="text-accent-ink" />
      </R.ItemIndicator>
    </R.CheckboxItem>
  );
}

export function MenuSubTrigger({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <R.SubTrigger className={cx(itemClass, "data-[state=open]:bg-surface-2/80")}>
      {icon}
      <span className="flex-1">{children}</span>
      <CaretRight size={12} />
    </R.SubTrigger>
  );
}

export function MenuSubContent({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <R.Portal>
      <R.SubContent sideOffset={6} collisionPadding={12} className={cx(menuSurface, className)}>
        {children}
      </R.SubContent>
    </R.Portal>
  );
}

export function MenuSeparator() {
  return <R.Separator className="mx-2 my-1.5 h-px bg-line" />;
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <R.Label className="px-2.5 pt-1.5 pb-1 text-xs font-medium text-ink-3">{children}</R.Label>;
}
