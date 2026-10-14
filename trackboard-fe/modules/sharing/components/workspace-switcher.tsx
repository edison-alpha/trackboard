"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Buildings, CaretDown, Check, Plus, UserPlus } from "@/components/icons";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { askText } from "@/components/ui/prompt";
import { setUi } from "@/modules/shell/lib/ui-store";
import { setActiveWorkspace, useWorkspace, workspacesQuery } from "@/modules/workspace";
import { useCreateWorkspace } from "../hooks";

/** Which workspace is open, and the way to another one, to a new one, or to the member list. */
export function WorkspaceSwitcher({ onNavigate }: { onNavigate?: () => void }) {
  const { workspaceId, workspace } = useWorkspace();
  const workspaces = useQuery(workspacesQuery);
  const create = useCreateWorkspace();
  const router = useRouter();

  const mine = workspaces.data?.filter((w) => w.role !== "guest") ?? [];
  const shared = workspaces.data?.filter((w) => w.role === "guest") ?? [];

  const open = (id: string) => {
    setActiveWorkspace(id);
    router.push("/");
    onNavigate?.();
  };

  const make = async () => {
    const name = await askText({ title: "New workspace", placeholder: "For example: Design team", confirmLabel: "Create" });
    if (name) create.mutate(name.trim(), { onSuccess: () => { router.push("/"); onNavigate?.(); } });
  };

  return (
    <Menu>
      <MenuTrigger className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-(--radius-row) px-2 text-left hover:bg-(--sidebar-hover) data-[state=open]:bg-(--sidebar-hover) pointer-coarse:h-11" aria-label="Switch workspace">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent-ink">
          <Buildings size={15} />
        </span>
        <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink">{workspace?.name ?? "Workspace"}</span>
        <CaretDown size={12} className="shrink-0 text-ink-3" />
      </MenuTrigger>
      <MenuContent side="bottom" align="start" className="w-64">
        <MenuLabel>Workspaces</MenuLabel>
        {mine.map((w) => (
          <MenuItem key={w.id} icon={w.id === workspaceId ? <Check size={16} /> : <span className="size-4" />} onSelect={() => open(w.id)}>
            <span className="block truncate">{w.name}</span>
            <span className="block text-xs text-ink-3">{w.personal ? "Your own" : w.role === "owner" ? "Owner" : w.role === "admin" ? "Admin" : "Member"}</span>
          </MenuItem>
        ))}
        {shared.length > 0 && (
          <>
            <MenuSeparator />
            <MenuLabel>Shared with you</MenuLabel>
            {shared.map((w) => (
              <MenuItem key={w.id} icon={w.id === workspaceId ? <Check size={16} /> : <span className="size-4" />} onSelect={() => open(w.id)}>
                <span className="block truncate">{w.name}</span>
              </MenuItem>
            ))}
          </>
        )}
        <MenuSeparator />
        <MenuItem icon={<UserPlus size={16} />} onSelect={() => setUi({ members: true, drawer: false })}>
          Members and invites
        </MenuItem>
        <MenuItem icon={<Plus size={16} />} onSelect={() => void make()}>
          New workspace
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
