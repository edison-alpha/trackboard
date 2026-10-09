"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createStore, useStore } from "@/lib/store";
import { Button } from "./button";
import { Dialog } from "./dialog";
import { Input } from "./input";

type Request =
  | { kind: "text"; title: string; placeholder: string; initial?: string; confirmLabel: string; resolve: (v: string | null) => void }
  | { kind: "confirm"; title: string; body: string; confirmLabel: string; danger?: boolean; resolve: (v: boolean) => void };

const requests = createStore<Request | null>(null);

/** Asks for one line of text in an accessible dialog. Resolves null when cancelled. */
export function askText(opts: { title: string; placeholder: string; initial?: string; confirmLabel?: string }): Promise<string | null> {
  return new Promise((resolve) => requests.set({ kind: "text", confirmLabel: "Insert", ...opts, resolve }));
}

/** Asks for confirmation before an action that cannot be undone. */
export function askConfirm(opts: { title: string; body: string; confirmLabel: string; danger?: boolean }): Promise<boolean> {
  return new Promise((resolve) => requests.set({ kind: "confirm", ...opts, resolve }));
}

/** Mounted once in the app providers; renders whichever request is pending. */
export function PromptHost() {
  const req = useStore(requests, null);
  const [value, setValue] = useState("");
  useEffect(() => setValue(req?.kind === "text" ? (req.initial ?? "") : ""), [req]);

  const close = (result: string | boolean | null) => {
    if (!req) return;
    if (req.kind === "text") req.resolve(typeof result === "string" ? result : null);
    else req.resolve(result === true);
    requests.set(null);
    setValue("");
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (req?.kind === "text") close(value.trim() || null);
    else close(true);
  };

  return (
    <Dialog open={!!req} onOpenChange={(o) => !o && close(null)} title={req?.title ?? ""} description={req?.kind === "confirm" ? req.body : undefined}>
      <form onSubmit={submit} className="grid gap-4 px-5 pb-5">
        {req?.kind === "text" && (
          <Input autoFocus value={value} placeholder={req.placeholder} onChange={(e) => setValue(e.target.value)} aria-label={req.title} />
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => close(null)}>
            Cancel
          </Button>
          <Button type="submit" variant={req?.kind === "confirm" && req.danger ? "danger" : "primary"} autoFocus={req?.kind === "confirm"}>
            {req?.confirmLabel}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
