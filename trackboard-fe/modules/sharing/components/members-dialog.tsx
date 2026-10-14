"use client";

import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Lock, X } from "@/components/icons";
import { Avatar } from "@/components/ui/avatar";
import { Button, IconButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { askConfirm } from "@/components/ui/prompt";
import { Input } from "@/components/ui/input";
import type { InviteSummary, WorkspaceRole } from "@/lib/api/types";
import { membersQuery, useWorkspace } from "@/modules/workspace";
import { useWorkspaceActions } from "../hooks";
import { copyText } from "../lib/copy";
import { workspaceInvitesQuery } from "../queries";
import { OptionMenu } from "./option-menu";

const ROLES = [
  { value: "member" as const, label: "Member", hint: "Works on pages shared with the workspace" },
  { value: "admin" as const, label: "Admin", hint: "Also invites people and manages members" },
];

const when = (ms: number) => new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });

/** The workspace as a team: who is in it and with what role, and the links that let more people join. */
export function MembersDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { workspaceId, workspace, profile } = useWorkspace();
  const role = workspace?.role;
  const isMember = role === "owner" || role === "admin" || role === "member";
  const canManage = role === "owner" || role === "admin";
  const members = useQuery({ ...membersQuery(workspaceId), enabled: open && isMember });
  const invites = useQuery({ ...workspaceInvitesQuery(workspaceId), enabled: open && canManage });
  const actions = useWorkspaceActions(workspaceId);
  const [made, setMade] = useState<InviteSummary | null>(null);

  const form = useForm({
    defaultValues: { role: "member" as Exclude<WorkspaceRole, "owner">, email: "" },
    onSubmit: async ({ value }) => {
      const invite = await actions.invite.mutateAsync({ role: value.role, ...(value.email.trim() ? { email: value.email.trim() } : {}) });
      setMade(invite);
    },
  });

  const rename = useForm({
    defaultValues: { name: workspace?.name ?? "" },
    onSubmit: ({ value }) => actions.rename.mutateAsync(value.name.trim()).then(() => undefined),
  });

  const leave = async (userId: string, name: string, self: boolean) => {
    const ok = await askConfirm({
      title: self ? `Leave ${workspace?.name}?` : `Remove ${name}?`,
      body: self ? "You will lose access to pages shared with this workspace." : `${name} will lose access to the pages shared with this workspace.`,
      confirmLabel: self ? "Leave" : "Remove",
      danger: true,
    });
    if (ok) actions.removeMember.mutate(userId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Members" description={workspace?.name} className="sm:max-w-xl">
      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-5">
        {!isMember ? (
          <p className="rounded-(--radius-card) bg-surface-2 px-4 py-3 text-sm text-ink-2">You are a guest here: you can open the pages shared with you, but you are not a member of this workspace.</p>
        ) : (
          <>
            {canManage && !workspace?.personal && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void rename.handleSubmit();
                }}
                className="mb-5 flex items-center gap-2"
              >
                <rename.Field name="name">
                  {(field) => <Input value={field.state.value} maxLength={60} aria-label="Workspace name" onChange={(e) => field.handleChange(e.target.value)} />}
                </rename.Field>
                <Button type="submit" variant="glass" busy={actions.rename.isPending}>
                  Rename
                </Button>
              </form>
            )}

            {canManage && (
              <section aria-label="Invite people">
                <h3 className="mb-1.5 text-xs font-semibold text-ink-3">Invite people</h3>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void form.handleSubmit();
                  }}
                  className="flex items-start gap-2"
                >
                  <form.Field name="email">
                    {(field) => (
                      <Input
                        type="email"
                        value={field.state.value}
                        placeholder="Only this email (optional)"
                        aria-label="Limit the link to one email address"
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                    )}
                  </form.Field>
                  <form.Field name="role">{(field) => <OptionMenu value={field.state.value} options={ROLES} onChange={field.handleChange} className="h-10" />}</form.Field>
                  <Button type="submit" variant="primary" busy={actions.invite.isPending}>
                    Create link
                  </Button>
                </form>
                <p className="mt-1.5 text-xs text-ink-3">Send the link yourself. Without an email it works for anyone who has it until it expires or you cancel it.</p>
                {made && (
                  <div className="mt-3 flex items-center gap-2 rounded-(--radius-card) bg-accent-soft/50 p-2.5">
                    <Input readOnly value={made.url} aria-label="Invite link" onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 text-[13px]" />
                    <Button size="sm" variant="glass" onClick={() => void copyText(made.url, "Invite link")}>
                      Copy
                    </Button>
                  </div>
                )}
                {invites.data && invites.data.length > 0 && (
                  <ul className="mt-3 grid gap-0.5">
                    {invites.data.map((i) => (
                      <li key={i.id} className="flex items-center gap-3 px-1 py-1.5">
                        <span className="flex size-[30px] items-center justify-center rounded-full bg-surface-2 text-ink-3">
                          <Lock size={15} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-ink">{i.email ?? "Anyone with the link"}</span>
                          <span className="block text-xs text-ink-3">
                            {i.level === "admin" ? "Admin" : "Member"} · expires {when(i.expiresAt)}
                          </span>
                        </span>
                        <Button size="sm" variant="ghost" onClick={() => void copyText(i.url, "Invite link")}>
                          Copy link
                        </Button>
                        <IconButton label="Cancel invite" size="sm" onClick={() => actions.cancelInvite.mutate(i.code)}>
                          <X size={15} />
                        </IconButton>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            <section aria-label="Members" className={canManage ? "mt-6 border-t border-line pt-4" : undefined}>
              <h3 className="mb-1.5 text-xs font-semibold text-ink-3">{members.data ? `${members.data.length} ${members.data.length === 1 ? "member" : "members"}` : "Members"}</h3>
              <ul className="grid gap-0.5">
                {members.data?.map((m) => {
                  const self = m.id === profile.id;
                  return (
                    <li key={m.id} className="flex items-center gap-3 rounded-(--radius-row) px-1 py-1.5">
                      <Avatar name={m.name} color={m.color} size={30} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">
                          {m.name}
                          {self && <span className="ml-1.5 font-normal text-ink-3">(you)</span>}
                        </span>
                        <span className="block truncate text-xs text-ink-3">{m.email}</span>
                      </span>
                      {m.role === "owner" ? (
                        <span className="px-2 text-sm text-ink-3">Owner</span>
                      ) : (
                        <OptionMenu
                          value={m.role as "admin" | "member"}
                          options={ROLES}
                          disabled={!canManage}
                          onChange={(next) => actions.setRole.mutate({ userId: m.id, role: next })}
                          {...((canManage || self) && { remove: { label: self ? "Leave workspace" : "Remove from workspace", onSelect: () => void leave(m.id, m.name, self) } })}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
              {members.isError && <p className="px-1 py-2 text-sm text-danger">{members.error.message}</p>}
            </section>
          </>
        )}
      </div>
    </Dialog>
  );
}
