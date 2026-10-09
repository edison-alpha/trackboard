"use client";

import { X } from "@/components/icons";
import { AnimatePresence, motion } from "motion/react";
import { Dialog as R } from "radix-ui";
import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import { IconButton } from "./button";

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Visible under the title. When omitted the title alone describes the dialog. */
  description?: string;
  children: ReactNode;
  className?: string;
  /** Hide the title visually but keep it for screen readers (command palette). */
  bare?: boolean;
};

/** Controlled dialog. Focus trap, Escape and outside click come from Radix; motion handles enter and exit. */
export function Dialog({ open, onOpenChange, title, description, children, className, bare }: DialogProps) {
  return (
    <R.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <R.Portal forceMount>
            <R.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-scrim"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
              />
            </R.Overlay>
            <div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
              {/* Without a description Radix expects aria-describedby to be explicitly unset. */}
              <R.Content asChild forceMount {...(!description && { "aria-describedby": undefined })}>
                <motion.div
                  className={cx(
                    "pointer-events-auto flex max-h-[85dvh] w-full flex-col overflow-hidden rounded-t-(--radius-panel) bg-surface text-ink shadow-elev outline-none sm:max-w-lg sm:rounded-(--radius-panel)",
                    className,
                  )}
                  initial={{ opacity: 0, y: 16, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 12, scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 520, damping: 40, mass: 0.8 }}
                >
                  {bare ? (
                    <R.Title className="sr-only">{title}</R.Title>
                  ) : (
                    <header className="flex items-start justify-between gap-4 px-5 pt-5 pb-3">
                      <div className="min-w-0">
                        <R.Title className="text-lg font-semibold">{title}</R.Title>
                        {description && <R.Description className="mt-1 text-sm text-ink-3">{description}</R.Description>}
                      </div>
                      <R.Close asChild>
                        <IconButton label="Close" size="sm" className="-mt-1 -mr-2">
                          <X size={16} />
                        </IconButton>
                      </R.Close>
                    </header>
                  )}
                  {children}
                </motion.div>
              </R.Content>
            </div>
          </R.Portal>
        )}
      </AnimatePresence>
    </R.Root>
  );
}
