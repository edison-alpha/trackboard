"use client";

import { CloudArrowUp, CloudCheck, CloudSlash } from "@/components/icons";
import { useStore, type Store } from "@/lib/store";
import type { SyncStatus as Status } from "../lib/open-doc";

const COPY: Record<Status, { label: string; hint: string; Icon: typeof CloudCheck }> = {
  connecting: { label: "Connecting", hint: "Connecting to the collaboration server", Icon: CloudArrowUp },
  online: { label: "Synced", hint: "Your edits reach collaborators as you type", Icon: CloudCheck },
  offline: { label: "Offline", hint: "Edits are saved on this device and sent when you reconnect", Icon: CloudSlash },
};

/** Where edits are going right now. Text label + icon, never colour alone. */
export function SyncStatus({ status }: { status: Store<Status> }) {
  const s = useStore(status);
  const { label, hint, Icon } = COPY[s];
  return (
    <span title={hint} className="hidden items-center gap-1.5 text-xs font-medium text-ink-3 md:inline-flex" role="status">
      <Icon size={15} weight={s === "offline" ? "bold" : "regular"} className={s === "offline" ? "text-danger" : undefined} />
      {label}
    </span>
  );
}
