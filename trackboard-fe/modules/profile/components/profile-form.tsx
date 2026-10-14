"use client";

import { useForm } from "@tanstack/react-form";
import { Check } from "@/components/icons";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { cx } from "@/lib/cx";
import { useSaveProfile } from "../hooks";
import { PROFILE_COLORS, type Profile } from "../lib/profile";

/** Name + cursor colour for the signed-in person. Used from the profile menu. */
export function ProfileForm({ initial, submitLabel, onDone }: { initial?: Profile | null; submitLabel: string; onDone?: () => void }) {
  const save = useSaveProfile();
  const form = useForm({
    defaultValues: { name: initial?.name ?? "", color: initial?.color ?? (PROFILE_COLORS[0] as string) },
    onSubmit: ({ value }) => save.mutateAsync({ name: value.name.trim(), color: value.color }).then(() => onDone?.()),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
      className="grid gap-5"
      noValidate
    >
      <form.Field
        name="name"
        validators={{ onSubmit: ({ value }) => (value.trim().length < 2 ? "Use at least 2 letters so teammates can recognize your cursor." : undefined) }}
      >
        {(field) => (
          <div className="flex items-center gap-3">
            <form.Subscribe selector={(s) => s.values.color}>{(color) => <Avatar name={field.state.value.trim() || "New profile"} color={color} size={44} />}</form.Subscribe>
            <div className="min-w-0 flex-1">
              <Field label="Name your collaborators see">
                <Input
                  autoFocus
                  value={field.state.value}
                  maxLength={40}
                  placeholder="Your name"
                  aria-invalid={field.state.meta.errors.length > 0}
                  aria-describedby={field.state.meta.errors.length ? "profile-error" : undefined}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              </Field>
              {field.state.meta.errors.length > 0 && (
                <p id="profile-error" role="alert" className="mt-1.5 text-sm text-danger">
                  {field.state.meta.errors.join(" ")}
                </p>
              )}
            </div>
          </div>
        )}
      </form.Field>
      <form.Field name="color">
        {(field) => (
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink-2">Cursor color</legend>
            <div className="flex flex-wrap gap-2">
              {PROFILE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Color ${c}`}
                  aria-pressed={c === field.state.value}
                  onClick={() => field.handleChange(c)}
                  className={cx("flex size-9 items-center justify-center rounded-full transition-transform active:scale-90 pointer-coarse:size-11", c === field.state.value && "ring-2 ring-ink ring-offset-2 ring-offset-surface")}
                  style={{ background: c }}
                >
                  {c === field.state.value && <Check size={16} weight="bold" color="var(--on-accent)" />}
                </button>
              ))}
            </div>
          </fieldset>
        )}
      </form.Field>
      <Button type="submit" variant="primary" busy={save.isPending} className="justify-self-start">
        {submitLabel}
      </Button>
    </form>
  );
}
