"use client";

import { Popover as R } from "radix-ui";
import type { ComponentProps } from "react";
import { cx } from "@/lib/cx";
import { menuSurface } from "./menu";

export const Popover = R.Root;
export const PopoverTrigger = R.Trigger;
export const PopoverAnchor = R.Anchor;
export const PopoverClose = R.Close;

export function PopoverContent({ className, children, ...rest }: ComponentProps<typeof R.Content>) {
  return (
    <R.Portal>
      <R.Content sideOffset={8} collisionPadding={12} className={cx(menuSurface, "p-3", className)} {...rest}>
        {children}
      </R.Content>
    </R.Portal>
  );
}
