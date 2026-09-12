const UNITS: { limit: number; divisor: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { limit: 60, divisor: 1, unit: "second" },
  { limit: 3600, divisor: 60, unit: "minute" },
  { limit: 86400, divisor: 3600, unit: "hour" },
  { limit: 604800, divisor: 86400, unit: "day" },
  { limit: 2629800, divisor: 604800, unit: "week" },
  { limit: 31557600, divisor: 2629800, unit: "month" },
];

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** Formats a past ISO timestamp as "3 hours ago" for session history lists. */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const seconds = Math.round((now.getTime() - new Date(iso).getTime()) / 1000);
  if (seconds < 5) return "just now";

  for (const { limit, divisor, unit } of UNITS) {
    if (seconds < limit) return rtf.format(-Math.round(seconds / divisor), unit);
  }
  const years = Math.round(seconds / 31557600);
  return rtf.format(-years, "year");
}
