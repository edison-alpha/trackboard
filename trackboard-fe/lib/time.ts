const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const full = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

/** "2 minutes ago" for the last week, a full date after that. */
export function timeAgo(at: number, now = Date.now()): string {
  const s = Math.round((at - now) / 1000);
  const abs = Math.abs(s);
  if (abs < 45) return "just now";
  if (abs < 3600) return rtf.format(Math.round(s / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(s / 3600), "hour");
  if (abs < 604800) return rtf.format(Math.round(s / 86400), "day");
  return full.format(at);
}

export function formatDateTime(at: number): string {
  return full.format(at);
}
