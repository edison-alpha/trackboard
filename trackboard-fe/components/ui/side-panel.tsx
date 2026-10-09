"use client";

import { X } from "@/components/icons";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, type ReactNode } from "react";
import { useMediaQuery } from "@/lib/use-media-query";
import { IconButton } from "./button";

/**
 * Right-hand panel on desktop (pushes nothing, overlays the page edge), bottom sheet on phones.
 * Escape closes it. Used by comments and version history.
 */
export function SidePanel({ open, onClose, title, actions, children }: { open: boolean; onClose: () => void; title: string; actions?: ReactNode; children: ReactNode }) {
  const desktop = useMediaQuery("(min-width: 1024px)");
  const hidden = desktop ? { x: "100%", y: 0 } : { x: 0, y: "100%" };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !e.defaultPrevented && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="scrim"
            className="fixed inset-0 z-30 bg-scrim lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.aside
            key="panel"
            aria-label={title}
            data-print-hide
            className="fixed inset-x-0 bottom-0 z-40 flex max-h-[80dvh] flex-col rounded-t-(--radius-panel) border-line bg-surface shadow-elev lg:inset-y-0 lg:right-0 lg:left-auto lg:max-h-none lg:w-[380px] lg:rounded-none lg:border-l lg:shadow-none"
            initial={hidden}
            animate={{ x: 0, y: 0 }}
            exit={hidden}
            transition={{ type: "spring", stiffness: 420, damping: 40 }}
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-4">
              <h2 className="flex-1 truncate text-[15px] font-semibold">{title}</h2>
              {actions}
              <IconButton label="Close panel" size="sm" onClick={onClose}>
                <X size={16} />
              </IconButton>
            </header>
            <div className="thin-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
