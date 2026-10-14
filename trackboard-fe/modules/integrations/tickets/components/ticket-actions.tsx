"use client";

import { LinkSimple, Plus } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useState } from "react";
import { sendTicketRequest, type TicketLink } from "../service";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageId: string;
  pageTitle: string;
  pageText: string;
  linkedTickets: TicketLink[];
  onLinked: (ticket: TicketLink) => void;
};

export function TicketActions({ open, onOpenChange, pageId, pageTitle, pageText, linkedTickets, onLinked }: Props) {
  const [mode, setMode] = useState<"create" | "link">("create");
  const [title, setTitle] = useState(pageTitle);
  const [description, setDescription] = useState(pageText);
  const [ticketId, setTicketId] = useState("");

  // A refusal (no edit access, a missing id) shows as a toast through the app-wide mutation error handler.
  const send = useMutation({
    mutationFn: sendTicketRequest,
    onSuccess: (ticket) => {
      onLinked(ticket);
      onOpenChange(false);
      toast.success(mode === "create" ? "Task created and linked to this doc." : "Ticket linked to this doc.");
    },
  });
  const submit = () => send.mutate({ action: mode, pageId, title, description, ...(mode === "link" && { ticketId }) });

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Connect to a task" description="Turn this doc into work, or attach it to existing work.">
      <div className="grid gap-5 overflow-y-auto px-5 pb-5">
        <div className="grid grid-cols-2 gap-1 rounded-(--radius-field) bg-surface-2 p-1">
          <Button variant={mode === "create" ? "primary" : "ghost"} size="sm" onClick={() => setMode("create")} icon={<Plus size={15} weight="bold" />}>
            Create task
          </Button>
          <Button variant={mode === "link" ? "primary" : "ghost"} size="sm" onClick={() => setMode("link")} icon={<LinkSimple size={15} />}>
            Link ticket
          </Button>
        </div>

        {mode === "create" ? (
          <>
            <Field label="Task title">
              <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What should be done?" />
            </Field>
            <Field label="Context" hint="The document text is sent as context for the task.">
              <Textarea value={description} onChange={(event) => setDescription(event.target.value)} className="min-h-36" placeholder="Add acceptance criteria or useful context..." />
            </Field>
          </>
        ) : (
          <Field label="Ticket ID or key" hint="Use the id or key from your ticket workspace.">
            <Input value={ticketId} onChange={(event) => setTicketId(event.target.value)} placeholder="e.g. TASK-123" autoFocus />
          </Field>
        )}

        {linkedTickets.length > 0 && (
          <div className="grid gap-2 border-t border-line pt-4">
            <p className="text-xs font-semibold text-ink-3">Already linked</p>
            {linkedTickets.map((ticket) => (
              ticket.url ? (
                <a key={ticket.id} href={ticket.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-(--radius-row) bg-surface-2 px-3 py-2 text-sm text-ink-2 hover:text-ink">
                  <LinkSimple size={15} />
                  <span className="truncate">{ticket.id} · {ticket.title}</span>
                </a>
              ) : (
                <div key={ticket.id} className="flex items-center gap-2 rounded-(--radius-row) bg-surface-2 px-3 py-2 text-sm text-ink-2">
                  <LinkSimple size={15} />
                  <span className="truncate">{ticket.id} · {ticket.title}</span>
                </div>
              )
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" busy={send.isPending} disabled={mode === "create" ? !title.trim() : !ticketId.trim()} onClick={submit}>
            {mode === "create" ? "Create and link" : "Link ticket"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
