/**
 * Calendar-date helpers working on ISO date strings ("YYYY-MM-DD") in local time.
 * Using plain strings for calendar days avoids time-zone and DST pitfalls.
 */

export type ISODate = string;

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const MS_PER_HOUR = 3_600_000;
export const MS_PER_MINUTE = 60_000;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function toISODate(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Parses an ISO date as local midnight. */
export function parseISODate(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function today(now: Date = new Date()): ISODate {
  return toISODate(now);
}

export function addDays(s: ISODate, days: number): ISODate {
  const d = parseISODate(s);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function weekday(s: ISODate): Weekday {
  const js = parseISODate(s).getDay(); // 0 = Sunday
  return (js === 0 ? 7 : js) as Weekday;
}

/** Monday of the ISO week that contains the given date. */
export function startOfWeek(s: ISODate): ISODate {
  return addDays(s, 1 - weekday(s));
}

export function endOfWeek(s: ISODate): ISODate {
  return addDays(startOfWeek(s), 6);
}

export function startOfMonth(s: ISODate): ISODate {
  return `${s.slice(0, 7)}-01`;
}

export function endOfMonth(s: ISODate): ISODate {
  const d = parseISODate(startOfMonth(s));
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  return toISODate(d);
}

export function yearOf(s: ISODate): number {
  return Number(s.slice(0, 4));
}

export function minDate(a: ISODate, b: ISODate): ISODate {
  return a < b ? a : b;
}

export function maxDate(a: ISODate, b: ISODate): ISODate {
  return a > b ? a : b;
}

/** Inclusive list of days from `from` to `to`. Empty if `from > to`. */
export function eachDay(from: ISODate, to: ISODate): ISODate[] {
  const days: ISODate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  return days;
}

/** Monday of every week that overlaps the range. */
export function eachWeekStart(from: ISODate, to: ISODate): ISODate[] {
  const weeks: ISODate[] = [];
  for (let w = startOfWeek(from); w <= to; w = addDays(w, 7)) weeks.push(w);
  return weeks;
}

/** Number of calendar days between two dates (b - a). */
export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / 86_400_000);
}

/** Local midnight of the given day as epoch milliseconds. */
export function dayStartMs(s: ISODate): number {
  return parseISODate(s).getTime();
}

/** ISO 8601 week number and week-based year. */
export function isoWeek(s: ISODate): { year: number; week: number } {
  const thursday = addDays(startOfWeek(s), 3);
  const year = yearOf(thursday);
  const firstThursday = addDays(startOfWeek(`${year}-01-04`), 3);
  return { year, week: daysBetween(firstThursday, thursday) / 7 + 1 };
}

export function overlapMs(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
}
