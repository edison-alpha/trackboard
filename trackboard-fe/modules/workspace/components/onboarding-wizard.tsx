"use client";

import { AnimatePresence, motion } from "motion/react";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, BookmarkSimple, Calendar, ChatDots, Check, CheckSquare, Desktop, FileText, MagnifyingGlass, Moon, PencilSimple, Sun, UserSwitch, type Icon } from "@/components/icons";
import { Logo } from "@/components/brand/logo";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { cx } from "@/lib/cx";
import { PROFILE_COLORS, useProfile, useSaveProfile } from "@/modules/profile";

const ROLES = ["Engineering", "Design", "Product", "Marketing", "Operations", "Founder", "Student", "Other"] as const;

const FOCUS: { id: string; label: string; hint: string; Icon: Icon }[] = [
  { id: "docs", label: "Team documentation", hint: "Guides, specs and handbooks", Icon: FileText },
  { id: "planning", label: "Project planning", hint: "Roadmaps, tasks and decisions", Icon: CheckSquare },
  { id: "meetings", label: "Meeting notes", hint: "Agendas, notes and follow-ups", Icon: Calendar },
  { id: "kb", label: "Knowledge base", hint: "One place for what the team knows", Icon: BookmarkSimple },
  { id: "research", label: "Research and study", hint: "Collect sources and write up", Icon: MagnifyingGlass },
  { id: "personal", label: "Personal notes", hint: "Ideas and drafts just for you", Icon: PencilSimple },
];
const MAX_FOCUS = 3;

const THEMES = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "Match device", Icon: Desktop },
] as const;

const FEATURES: { Icon: Icon; title: string; body: string }[] = [
  { Icon: FileText, title: "Nested pages", body: "Organize docs like folders, with a rich editor for everything inside." },
  { Icon: UserSwitch, title: "Write together", body: "See teammates' cursors and edits live, in the same page." },
  { Icon: ChatDots, title: "Ask AI", body: "Summarize, rewrite or translate without leaving the page." },
];

const STEPS = ["welcome", "you", "focus", "look"] as const;
type Step = (typeof STEPS)[number];

const TITLES: Record<Step, string> = {
  welcome: "Welcome to Trackdocs",
  you: "Tell us about you",
  focus: "What will you work on?",
  look: "Make it yours",
};

/** First-run setup: welcome, who you are, what you focus on, theme. Saves the profile on the last step. */
export function OnboardingWizard() {
  // Google already told the server who this is; start from that name and the colour assigned to it.
  const me = useProfile();
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const [name, setName] = useState(me?.name ?? "");
  const [color, setColor] = useState<string>(me?.color ?? PROFILE_COLORS[0]);
  const [role, setRole] = useState<string>(me?.role ?? "");
  const [focus, setFocus] = useState<string[]>(me?.focus ?? []);
  const [error, setError] = useState("");
  const save = useSaveProfile();
  const saving = save.isPending;
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const step = STEPS[index]!;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  // Move focus to the new step's heading so keyboard and screen-reader users land in the right place.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [index]);

  function go(to: number) {
    setDir(to > index ? 1 : -1);
    setIndex(to);
  }

  function next(e?: FormEvent) {
    e?.preventDefault();
    if (step === "you" && name.trim().length < 2) {
      setError("Use at least 2 letters so teammates can recognize your cursor.");
      return;
    }
    if (step === "focus" && focus.length === 0) {
      setError("Pick at least one so we know what to set up first.");
      return;
    }
    setError("");
    if (step === "look") {
      save.mutate({ name, color, role: role || null, focus, onboardingDone: true }, { onError: (err) => setError(err.message) });
      return;
    }
    go(index + 1);
  }

  function toggleFocus(id: string) {
    setError("");
    setFocus((f) => (f.includes(id) ? f.filter((x) => x !== id) : f.length >= MAX_FOCUS ? f : [...f, id]));
  }

  const first = name.trim().split(" ")[0] || "there";

  const total = STEPS.length - 1;

  return (
    <main className="flex min-h-dvh flex-col bg-bg px-5 py-6 sm:px-10">
      <header className="mx-auto flex w-full max-w-xl items-center justify-between">
        <Logo />
      </header>

      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center py-10">
        <div className="flex-none">
          {step !== "welcome" && (
            <div className="mb-8" role="progressbar" aria-label="Setup progress" aria-valuemin={0} aria-valuemax={total} aria-valuenow={index} aria-valuetext={`Step ${index} of ${total}`}>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-2">
                <motion.div className="h-full rounded-full bg-accent" initial={false} animate={{ width: `${(index / total) * 100}%` }} transition={{ duration: 0.35, ease: "easeOut" }} />
              </div>
              <p className="mt-2 text-xs font-medium text-ink-3" aria-hidden="true">
                Step {index} of {total}
              </p>
            </div>
          )}

          <AnimatePresence mode="wait" initial={false} custom={dir}>
            <motion.form
              key={step}
              custom={dir}
              onSubmit={next}
              noValidate
              initial={{ opacity: 0, x: dir * 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: dir * -24 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="grid gap-6"
            >
              <div>
                <h1 ref={headingRef} tabIndex={-1} className="text-[28px] leading-tight font-bold tracking-[-0.02em] text-ink outline-none sm:text-[32px]">
                  {TITLES[step]}
                </h1>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
                  {step === "welcome" && "A calm place for your team's documentation. Set up takes about a minute."}
                  {step === "you" && "Your name and color show on your cursor when someone opens the same page."}
                  {step === "focus" && `Choose up to ${MAX_FOCUS}. You can change this later.`}
                  {step === "look" && `Pick how Trackdocs looks, ${first}. It follows you everywhere.`}
                </p>
              </div>

              {step === "welcome" && (
                <ul className="grid gap-4">
                  {FEATURES.map(({ Icon, title, body }) => (
                    <li key={title} className="flex gap-3.5">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
                        <Icon size={20} />
                      </span>
                      <span>
                        <span className="block text-[15px] font-semibold text-ink">{title}</span>
                        <span className="block text-sm leading-relaxed text-ink-2">{body}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {step === "you" && (
                <div className="grid gap-5">
                  <div className="flex items-end gap-3">
<Avatar name={name.trim() || "New profile"} color={color} size={44} />
<div className="min-w-0 flex-1">
<Field label="Full name">
                    <Input
                      autoFocus
                      value={name}
                      maxLength={40}
                      autoComplete="name"
                      placeholder="e.g. Maya Putri"
                      aria-invalid={!!error}
                      aria-describedby={error ? "onboarding-error" : undefined}
                      onChange={(e) => {
                        setName(e.target.value);
                        setError("");
                      }}
                    />
                  </Field>
</div>
</div>
                  <fieldset>
                    <legend className="mb-2 text-sm font-medium text-ink-2">Your role</legend>
                    <div className="flex flex-wrap gap-2">
                      {ROLES.map((r) => (
                        <Chip key={r} selected={role === r} onClick={() => setRole(role === r ? "" : r)}>
                          {r}
                        </Chip>
                      ))}
                    </div>
                  </fieldset>
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
                          className={cx("flex size-9 items-center justify-center rounded-full transition-transform active:scale-90 pointer-coarse:size-11", c === color && "ring-2 ring-ink ring-offset-2 ring-offset-bg")}
                          style={{ background: c }}
                        >
                          {c === color && <Check size={16} weight="bold" color="var(--on-accent)" />}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                </div>
              )}

              {step === "focus" && (
                <div className="grid gap-2.5 sm:grid-cols-2" role="group" aria-label="Focus areas">
                  {FOCUS.map(({ id, label, hint, Icon }) => {
                    const on = focus.includes(id);
                    const locked = !on && focus.length >= MAX_FOCUS;
                    return (
                      <button
                        key={id}
                        type="button"
                        aria-pressed={on}
                        disabled={locked}
                        onClick={() => toggleFocus(id)}
                        className={cx(
                          "relative flex flex-col items-start gap-2 rounded-3xl border p-4 text-left transition-colors disabled:opacity-45",
                          on ? "border-accent bg-accent-soft" : "border-line hover:border-line-strong hover:bg-surface-2",
                        )}
                      >
                        <span className={cx("flex size-9 items-center justify-center rounded-full", on ? "bg-accent text-on-accent" : "bg-surface-2 text-ink-2")}>
                          <Icon size={18} />
                        </span>
                        <span>
                          <span className="block text-[15px] font-semibold text-ink">{label}</span>
                          <span className="block text-xs leading-snug text-ink-3">{hint}</span>
                        </span>
                        {on && (
                          <span className="absolute top-3 right-3 flex size-5 items-center justify-center rounded-full bg-accent">
                            <Check size={12} weight="bold" color="var(--on-accent)" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {step === "look" && (
                <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-2.5">
                  {THEMES.map(({ value, label, Icon }) => {
                    const on = (mounted ? (theme ?? "system") : "system") === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => setTheme(value)}
                        className={cx(
                          "flex flex-col items-center gap-2 rounded-3xl border px-2 py-5 text-sm font-medium transition-colors",
                          on ? "border-accent bg-accent-soft text-accent-ink" : "border-line text-ink-2 hover:border-line-strong hover:bg-surface-2",
                        )}
                      >
                        <Icon size={24} weight={on ? "fill" : "regular"} />
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}

              {error && (
                <p id="onboarding-error" role="alert" className="-mt-2 text-sm text-danger">
                  {error}
                </p>
              )}

              <div className="flex items-center gap-2">
                {index > 0 && (
                  <Button variant="ghost" icon={<ArrowLeft size={16} />} onClick={() => go(index - 1)} disabled={saving}>
                    Back
                  </Button>
                )}
                <Button type="submit" variant="primary" busy={saving} className="ml-auto">
                  {step === "welcome" ? "Get started" : step === "look" ? "Open my workspace" : "Continue"}
                  {step !== "look" && <ArrowRight size={16} />}
                </Button>
              </div>
            </motion.form>
          </AnimatePresence>
        </div>
      </div>

    </main>
  );
}

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cx(
        "h-9 rounded-full border px-3.5 text-sm font-medium transition-colors pointer-coarse:h-11",
        selected ? "border-accent bg-accent-soft text-accent-ink" : "border-line text-ink-2 hover:border-line-strong hover:bg-surface-2",
      )}
    >
      {children}
    </button>
  );
}
