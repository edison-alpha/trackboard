"use client";

import { Check } from "@/components/icons";
import { useState, type FormEvent } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { cx } from "@/lib/cx";
import { PROFILE_COLORS, saveProfile, type Profile } from "../lib/profile";

/** Name + cursor colour. Used for first-run onboarding and for editing later. */
export function ProfileForm({ initial, submitLabel, onDone }: { initial?: Profile | null; submitLabel: string; onDone?: () => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState<string>(initial?.color ?? PROFILE_COLORS[0]);
  const [error, setError] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) {
      setError("Use at least 2 letters so teammates can recognize your cursor.");
      return;
    }
    saveProfile({ id: initial?.id, name, color });
    onDone?.();
  }

  return (
    <form onSubmit={submit} className="grid gap-5" noValidate>
      <div className="flex items-center gap-3">
        <Avatar name={name.trim() || "New profile"} color={color} size={44} />
        <div className="min-w-0 flex-1">
          <Field label="Name your collaborators see">
            <Input
              autoFocus
              value={name}
              maxLength={40}
              placeholder="Your name"
              aria-invalid={!!error}
              aria-describedby={error ? "profile-error" : undefined}
              onChange={(e) => {
                setName(e.target.value);
                setError("");
              }}
            />
          </Field>
        </div>
      </div>
      {error && (
        <p id="profile-error" className="-mt-2 text-sm text-danger">
          {error}
        </p>
      )}
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink-2">Cursor color</legend>
        <div className="flex flex-wrap gap-2">
          {PROFILE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Color ${c}`}
              aria-pressed={c === color}
              onClick={() => setColor(c)}
              className={cx("flex size-9 items-center justify-center rounded-full transition-transform active:scale-90 pointer-coarse:size-11", c === color && "ring-2 ring-ink ring-offset-2 ring-offset-surface")}
              style={{ background: c }}
            >
              {c === color && <Check size={16} weight="bold" color="var(--on-accent)" />}
            </button>
          ))}
        </div>
      </fieldset>
      <Button type="submit" variant="primary" className="justify-self-start">
        {submitLabel}
      </Button>
    </form>
  );
}
