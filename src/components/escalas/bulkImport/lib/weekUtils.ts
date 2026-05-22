import { format } from "date-fns";

/** Returns the Monday of the week containing the given date (local time). */
export function normalizeToMonday(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

/** Add N days to a date in local time (no UTC shifting). */
export function addDaysLocal(date: Date, days: number): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + days);
  return d;
}

/** YYYY-MM-DD in local timezone (no UTC conversion). */
export function toLocalISODate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/** "DD/MM até DD/MM" for the week starting on `monday`. */
export function formatWeekRange(monday: Date): string {
  const sunday = addDaysLocal(monday, 6);
  return `${format(monday, "dd/MM")} até ${format(sunday, "dd/MM")}`;
}
