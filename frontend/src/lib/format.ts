import { CURRENCY, LOCALE } from "./constants";

/** Format a number or string as currency (EUR) */
export function formatCurrency(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: CURRENCY,
  }).format(num);
}

/** Format a date string (ISO) to dd.MM.yyyy */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "–";
  const date = new Date(dateStr);
  return date.toLocaleDateString(LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Format a datetime string to dd.MM.yyyy HH:mm */
export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "–";
  const date = new Date(dateStr);
  return date.toLocaleDateString(LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Format a time string (HH:mm:ss) to HH:mm */
export function formatTime(timeStr: string | null | undefined): string {
  if (!timeStr) return "–";
  return timeStr.substring(0, 5);
}

/** Format duration in minutes to Xh Ym */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} Min.`;
  if (m === 0) return `${h} Std.`;
  return `${h} Std. ${m} Min.`;
}

/** Format a user's full name */
export function formatUserName(user: { first_name: string; last_name: string } | null | undefined): string {
  if (!user) return "–";
  return `${user.first_name} ${user.last_name}`.trim() || "–";
}

/** Get initials from a name */
export function getInitials(firstName?: string, lastName?: string): string {
  return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
}
