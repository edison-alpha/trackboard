"use client";

import { useQuery } from "@tanstack/react-query";
import { LogoMark } from "@/components/brand/logo";
import { GitHubActivity, type Contribution } from "@/components/ui/github-activity";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { motion } from "motion/react";
import { useMemo } from "react";
import { api } from "@/lib/api/client";
import { keys } from "@/lib/api/keys";
import type { ActivityDay } from "@/lib/api/types";
import { usePages } from "@/modules/workspace";
import { displayTitle, livePages } from "@/modules/workspace/lib/pages";
import { setUi } from "@/modules/shell";
import { useProfile } from "../hooks";

const DAY = 24 * 60 * 60 * 1000;

/** The last 365 days, one entry per day, with the days the server has counts for filled in and the rest at zero. */
function lastYear(days: ActivityDay[]): Contribution[] {
  const counts = new Map(days.map((d) => [d.date, d.count]));
  const end = new Date();
  return Array.from({ length: 365 }, (_, index) => {
    const date = new Date(end.getTime() - (364 - index) * DAY).toISOString().slice(0, 10);
    const count = counts.get(date) ?? 0;
    return { date, count, level: Math.min(4, count) as 0 | 1 | 2 | 3 | 4 };
  });
}

function monthCounts(activity: Contribution[]): number[] {
  const months = Array.from({ length: 12 }, () => 0);
  const year = new Date().getFullYear();
  activity.forEach((day) => {
    const date = new Date(`${day.date}T00:00:00`);
    if (date.getFullYear() === year) months[date.getMonth()] = (months[date.getMonth()] ?? 0) + day.count;
  });
  return months;
}

export function ProfileView() {
  const profile = useProfile();
  const pages = usePages();
  const live = livePages(pages);
  // Writing activity is counted by the server as people type, so this is real from the first edit and empty until then.
  const days = useQuery({ queryKey: keys.activity, queryFn: async () => (await api<{ days: ActivityDay[] }>("/api/me/activity?days=365")).days });
  const activity = useMemo(() => lastYear(days.data ?? []), [days.data]);
  const months = useMemo(() => monthCounts(activity), [activity]);
  const activeDays = activity.filter((day) => day.count > 0).length;
  const currentYear = new Date().getFullYear();
  const sessionsThisYear = months.reduce((sum, count) => sum + count, 0);

  if (!profile) return null;
  // Pages this person has written in, newest first.
  const written = live.filter((p) => p.editors[profile.id] !== undefined).sort((a, b) => (b.editors[profile.id] ?? 0) - (a.editors[profile.id] ?? 0)).slice(0, 5);
  const created = live.filter((p) => p.createdBy === profile.id).length;

  return (
    <main className="mx-auto w-full max-w-[980px] px-4 pb-16 sm:px-8">
      <section className="overflow-hidden rounded-(--radius-panel) border border-line bg-surface">
        <div className="relative h-36 overflow-hidden bg-accent sm:h-48">
          <div className="absolute -right-8 -bottom-16 opacity-20">
            <LogoMark size={230} />
          </div>
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/20 to-transparent" />
        </div>
        <div className="relative px-5 pb-5 sm:px-8">
          <div className="-mt-10 flex flex-wrap items-end justify-between gap-4 sm:-mt-12">
            <Avatar name={profile.name} color={profile.color} size={88} className="ring-4 ring-surface" />
            <div className="flex gap-2">
              <Button variant="glass" onClick={() => setUi({ profile: true })}>
                Edit profile
              </Button>
            </div>
          </div>
          <div className="mt-3">
            <h1 className="text-2xl font-bold tracking-tight text-ink">{profile.name}</h1>
            <p className="mt-1 text-sm text-ink-3">{profile.email}</p>
            {profile.role && <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-2">{profile.role}</p>}
          </div>
        </div>
      </section>

      <section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Pages", live.length, `${created} created by you`],
          ["Writing sessions", sessionsThisYear, `in ${currentYear}, 5-minute stretches`],
          ["Active days", activeDays, "in the last year"],
          ["Focus areas", profile.focus.length, "chosen in your profile"],
        ].map(([label, value, hint], index) => (
          <motion.div key={String(label)} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }} className="rounded-(--radius-card) border border-line bg-surface px-4 py-4">
            <p className="text-xs text-ink-3">{label}</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-ink">{value}</p>
            <p className="mt-1 text-xs text-ink-3">{hint}</p>
          </motion.div>
        ))}
      </section>

      <section className="mt-5 rounded-(--radius-panel) border border-line bg-surface p-4 sm:p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-ink">Writing activity</h2>
            <p className="mt-1 text-sm text-ink-3">
              {days.isError ? days.error.message : sessionsThisYear === 0 ? "Nothing yet. Time spent writing in a page shows up here." : `${sessionsThisYear} writing sessions this year`}
            </p>
          </div>
          <span className="shrink-0 pt-0.5 text-xs text-ink-3">Less <span className="mx-1 inline-block size-2 rounded-sm bg-line align-middle" /> More <span className="ml-1 inline-block size-2 rounded-sm bg-accent align-middle" /></span>
        </div>
        <GitHubActivity contributions={activity} accent={profile.color} months={12} showMonths />
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-(--radius-panel) border border-line bg-surface p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-ink">Writing by month</h2>
              <p className="mt-1 text-sm text-ink-3">A simple view of your writing rhythm</p>
            </div>
            <span className="text-sm font-medium text-accent-ink">{sessionsThisYear} total</span>
          </div>
          <div className="mt-7 flex h-44 items-end gap-2 sm:gap-3">
            {months.map((count, index) => {
              const max = Math.max(...months, 1);
              return (
                <div key={index} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                  <div className="flex h-32 w-full items-end">
                    <motion.div initial={{ height: 0 }} animate={{ height: `${Math.max(4, (count / max) * 100)}%` }} transition={{ delay: index * 0.025, duration: 0.35, ease: "easeOut" }} className="w-full rounded-t-md bg-accent" title={`${count} sessions`} />
                  </div>
                  <span className="text-[11px] text-ink-3">{new Date(currentYear, index, 1).toLocaleDateString("en-US", { month: "short" })}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-(--radius-panel) border border-line bg-surface p-5">
          <h2 className="font-semibold text-ink">Pages you wrote in</h2>
          <div className="mt-4 grid gap-1">
            {written.length === 0 ? (
              <p className="py-8 text-sm text-ink-3">Pages you write in will appear here.</p>
            ) : (
              written.map((page) => (
                <a key={page.id} href={`/p/${page.id}`} className="flex min-w-0 items-center gap-3 rounded-(--radius-row) px-2 py-2.5 hover:bg-surface-2">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-sm">{page.icon ?? "D"}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{displayTitle(page)}</span>
                  <span className="text-xs text-ink-3">{new Date(page.editors[profile.id] ?? page.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                </a>
              ))
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
