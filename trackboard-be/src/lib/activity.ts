import type { ActivityDay } from "@trackboard/api-types";
import { db } from "./db/client.ts";

/*
 * Writing activity for the profile heatmap. A "window" is a five-minute stretch in which the person changed any page;
 * a day's count is how many such windows it had. It counts time spent writing, not keystrokes, so a burst of typing is
 * one unit and a long session is several.
 */

const WINDOW_MS = 5 * 60 * 1000;
const lastWindow = new Map<string, number>();

const dayOf = (at: number) => new Date(at).toISOString().slice(0, 10);

/** Called on every change to a page; writes to the database at most once per person per window. */
export async function recordActivity(userId: string, now = Date.now()): Promise<void> {
  const bucket = Math.floor(now / WINDOW_MS);
  if (lastWindow.get(userId) === bucket) return;
  lastWindow.set(userId, bucket);
  await (await db()).query("insert into user_activity (user_id, day, windows) values ($1, $2, 1) on conflict (user_id, day) do update set windows = user_activity.windows + 1", [userId, dayOf(now)]);
}

/** Days with activity over the last `days` days (zeros are left out; the app fills them). */
export async function activityFor(userId: string, days = 365, now = Date.now()): Promise<ActivityDay[]> {
  const since = dayOf(now - (Math.max(1, Math.min(730, days)) - 1) * 86_400_000);
  const rows = await (await db()).query<{ day: string; windows: number }>("select day, windows from user_activity where user_id = $1 and day >= $2 order by day", [userId, since]);
  return rows.map((r) => ({ date: r.day, count: Number(r.windows) }));
}

/** Tests start from a clean slate. */
export const resetActivityWindows = () => lastWindow.clear();
