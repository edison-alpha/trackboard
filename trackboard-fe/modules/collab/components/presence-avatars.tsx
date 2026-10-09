"use client";

import { AnimatePresence, motion } from "motion/react";
import { Avatar } from "@/components/ui/avatar";
import type { PresenceUser } from "../hooks/use-presence";

/** Avatars of everyone on this page. Arrivals and departures animate so a change gets noticed. */
export function PresenceAvatars({ users, max = 4 }: { users: PresenceUser[]; max?: number }) {
  const shown = users.slice(0, max);
  const rest = users.length - shown.length;
  const label = users.map((u) => (u.self ? `${u.name} (you)` : u.name)).join(", ");
  return (
    <div className="flex items-center gap-1" aria-label={`On this page: ${label}`} role="group">
      <AnimatePresence initial={false}>
        {shown.map((u) => (
          <motion.span
            key={u.id}
            className="flex"
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.4, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          >
            <Avatar name={u.self ? `${u.name} (you)` : u.name} seed={u.name} color={u.color} size={26} ring />
          </motion.span>
        ))}
      </AnimatePresence>
      {rest > 0 && (
        <span className="inline-flex size-[26px] items-center justify-center rounded-full bg-surface-3 text-[11px] font-semibold text-ink-2">+{rest}</span>
      )}
    </div>
  );
}
