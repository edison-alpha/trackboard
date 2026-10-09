"use client";

import { useEffect, useState } from "react";
import type { Awareness } from "y-protocols/awareness";

export type PresenceUser = { clientId: number; id: string; name: string; color: string; self: boolean };

type UserField = { id?: string; name?: string; color?: string };

/** People connected to a doc, one entry per person (someone with two tabs counts once). */
export function usePresence(awareness: Awareness | null): PresenceUser[] {
  const [users, setUsers] = useState<PresenceUser[]>([]);

  useEffect(() => {
    if (!awareness) return;
    const compute = () => {
      const seen = new Map<string, PresenceUser>();
      awareness.getStates().forEach((state, clientId) => {
        const u = (state as { user?: UserField }).user;
        if (!u?.name || !u.color) return;
        const id = u.id ?? String(clientId);
        const self = clientId === awareness.clientID;
        if (!seen.has(id) || self) seen.set(id, { clientId, id, name: u.name, color: u.color, self });
      });
      setUsers([...seen.values()].sort((a, b) => Number(b.self) - Number(a.self)));
    };
    compute();
    awareness.on("change", compute);
    return () => awareness.off("change", compute);
  }, [awareness]);

  return users;
}
