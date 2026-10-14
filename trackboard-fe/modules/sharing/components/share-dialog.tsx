"use client";

import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Copy, Globe, Lock, UsersGroup, X } from "@/components/icons";
import { Avatar } from "@/components/ui/avatar";
import { Button, IconButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { InviteSummary, PageMeta, Permission, Visibility } from "@/lib/api/types";
import { cx } from "@/lib/cx";
import { displayTitle, usePageActions, usePeople, useWorkspace } from "@/modules/workspace";
import { permissionLabel, useShareActions } from "../hooks";
import { copyText } from "../lib/copy";
import { shareQuery } from "../queries";
import { OptionMenu } from "./option-menu";

const PERMISSIONS: { value: Permission; label: string; hint: string }[] = [
  { value: "edit", label: "Can edit", hint: "Write, comment and use history" },
  { value: "view", label: "Can view", hint: "Read and reply to comments" },
];

function Switch({ on, onChange, label, busy }: { on: boolean; onChange: (on: boolean) => void; label: string; busy?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={busy}
      onClick={() => onChange(!on)}
      className={cx("relative h-6 w-10 shrink-0 rounded-full transition-colors disabled:opacity-60 pointer-coarse:h-7 pointer-coarse:w-12", on ? "bg-accent" : "bg-surface-3")}
    >
      <span className={cx("absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-sm transition-transform pointer-coarse:size-6", on && "translate-x-4 pointer-coarse:translate-x-5")} />
    </button>
  );
}

function LinkBox({ url, onCopy }: { url: string; onCopy?: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <Input readOnly value={url} aria-label="Link" onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 text-[13px]" />
      <Button size="sm" variant="glass" icon={<Copy size={15} />} onClick={() => { void copyText(url); onCopy?.(); }}>
        Copy
      </Button>
    </div>
  );
}

const when = (ms: number) => new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });

/** Who can open this page: people by email, everyone in the workspace, or anyone with a public link. */
export function ShareDialog({ open, onOpenChange, page }: { open: boolean; onOpenChange: (o: boolean) => void; page: PageMeta }) {
  const manage = page.access === "manage";
  const state = useQuery({ ...shareQuery(page.id), enabled: open && manage });
  const actions = useShareActions(page.id);
  const pageActions = usePageActions();
  const people = usePeople();
  const { workspace } = useWorkspace();
  // The link made by the last invite to someone with no account yet, so it can be copied right away.
  const [justMade, setJustMade] = useState<InviteSummary | null>(null);

  const form = useForm({
    defaultValues: { email: "", permission: "edit" as Permission },
    onSubmit: async ({ value, formApi }) => {
      const result = await actions.share.mutateAsync({ email: value.email.trim(), permission: value.permission });
      setJustMade(result.kind === "invited" ? result.invite : null);
      formApi.reset();
    },
  });

  const owner = people.get(page.createdBy);
  const data = state.data;
  const publicUrl = data?.publicToken ? `${location.origin}/s/${data.publicToken}` : null;
  const accessOptions: { value: Visibility; label: string; hint: string }[] = [
    { value: "private", label: "Only people added", hint: "Private to you and the people below" },
    { value: "workspace", label: `Everyone in ${workspace?.name ?? "the workspace"}`, hint: "Every member can open it" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Share" description={displayTitle(page)} className="sm:max-w-xl">
      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-5">
        {!manage ? (
          <p className="rounded-(--radius-card) bg-surface-2 px-4 py-3 text-sm text-ink-2">
            You {page.access === "edit" ? "can edit" : "can view"} this page. Only people who manage it can change who else has access.
          </p>
        ) : (
          <>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void form.handleSubmit();
              }}
              noValidate
              className="flex items-start gap-2"
            >
              <form.Field
                name="email"
                validators={{ onSubmit: ({ value }) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? undefined : "Enter an email address.") }}
              >
                {(field) => (
                  <div className="min-w-0 flex-1">
                    <Input
                      type="email"
                      autoComplete="off"
                      value={field.state.value}
                      placeholder="Add people by email"
                      aria-label="Email address"
                      aria-invalid={field.state.meta.errors.length > 0}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                    {field.state.meta.errors.length > 0 && (
                      <p role="alert" className="mt-1 text-xs text-danger">
                        {field.state.meta.errors.join(" ")}
                      </p>
                    )}
                  </div>
                )}
              </form.Field>
              <form.Field name="permission">
                {(field) => <OptionMenu value={field.state.value} options={PERMISSIONS} onChange={field.handleChange} className="h-10" />}
              </form.Field>
              <Button type="submit" variant="primary" busy={actions.share.isPending}>
                Invite
              </Button>
            </form>

            {justMade && (
              <div className="mt-3 rounded-(--radius-card) bg-accent-soft/50 p-3">
                <p className="mb-2 text-sm text-ink">
                  {justMade.email} has no account yet. Send them this link; it only works for that Google account and expires {when(justMade.expiresAt)}.
                </p>
                <LinkBox url={justMade.url} />
              </div>
            )}

            <section aria-label="People with access" className="mt-5">
              <h3 className="mb-1.5 text-xs font-semibold text-ink-3">People with access</h3>
              <ul className="grid gap-0.5">
                {owner && (
                  <li className="flex items-center gap-3 rounded-(--radius-row) px-1 py-1.5">
                    <Avatar name={owner.name} color={owner.color} size={30} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{owner.name}</span>
                    <span className="px-2 text-sm text-ink-3">Owner</span>
                  </li>
                )}
                {data?.shares.map((s) => (
                  <li key={s.user.id} className="flex items-center gap-3 rounded-(--radius-row) px-1 py-1.5">
                    <Avatar name={s.user.name} color={s.user.color} size={30} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{s.user.name}</span>
                      <span className="block truncate text-xs text-ink-3">{s.user.email}</span>
                    </span>
                    <OptionMenu
                      value={s.permission}
                      options={PERMISSIONS}
                      onChange={(permission) => actions.share.mutate({ userId: s.user.id, permission })}
                      remove={{ label: "Remove access", onSelect: () => actions.remove.mutate(s.user.id) }}
                    />
                  </li>
                ))}
                {data?.invites.map((i) => (
                  <li key={i.id} className="flex items-center gap-3 rounded-(--radius-row) px-1 py-1.5">
                    <span className="flex size-[30px] items-center justify-center rounded-full bg-surface-2 text-ink-3">
                      <Lock size={15} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink">{i.email}</span>
                      <span className="block text-xs text-ink-3">
                        Invite pending · {permissionLabel(i.level as Permission)} · expires {when(i.expiresAt)}
                      </span>
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => void copyText(i.url)}>
                      Copy link
                    </Button>
                    <IconButton label="Cancel invite" size="sm" onClick={() => actions.cancelInvite.mutate(i.code)}>
                      <X size={15} />
                    </IconButton>
                  </li>
                ))}
              </ul>
              {state.isError && <p className="px-1 py-2 text-sm text-danger">{state.error.message}</p>}
            </section>

            <section aria-label="General access" className="mt-5 border-t border-line pt-4">
              <h3 className="mb-2 text-xs font-semibold text-ink-3">General access</h3>
              <div className="flex items-center gap-3">
                <span className="flex size-[30px] items-center justify-center rounded-full bg-surface-2 text-ink-2">{page.visibility === "workspace" ? <UsersGroup size={16} /> : <Lock size={16} />}</span>
                <span className="min-w-0 flex-1">
                  <OptionMenu value={page.visibility} options={accessOptions} onChange={(visibility) => pageActions.update(page.id, { visibility })} className="-ml-2.5 font-medium text-ink" />
                  <span className="block text-xs text-ink-3">{accessOptions.find((o) => o.value === page.visibility)?.hint}</span>
                </span>
                {page.visibility === "workspace" && (
                  <OptionMenu value={page.workspacePermission} options={PERMISSIONS} onChange={(workspacePermission) => pageActions.update(page.id, { workspacePermission })} />
                )}
              </div>
            </section>

            <section aria-label="Public link" className="mt-4 border-t border-line pt-4">
              <div className="flex items-center gap-3">
                <span className="flex size-[30px] items-center justify-center rounded-full bg-surface-2 text-ink-2">
                  <Globe size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-ink">Share to the web</span>
                  <span className="block text-xs text-ink-3">Anyone with the link can read this page, without signing in. They cannot edit it.</span>
                </span>
                <Switch on={!!publicUrl} busy={actions.publish.isPending} label="Share to the web" onChange={(on) => actions.publish.mutate(on)} />
              </div>
              {publicUrl && (
                <div className="mt-3">
                  <LinkBox url={publicUrl} />
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </Dialog>
  );
}
