import { addDays, eachDay, endOfWeek, maxDate, minDate, type ISODate } from './dates';
import type { Ledger } from './ledger';

/**
 * Simple, transparent projection of the overtime balance:
 *
 *   balance(end of yesterday)
 *   + for every remaining day: credited hours − target
 *
 * where credited hours on a remaining day are
 *   - entered vacation / sick hours and public holidays (as recorded), plus
 *   - on workdays: the assumed work (weekly hours / workdays), reduced by
 *     absence or holiday hours on that day.
 * Today counts with at least the work already tracked.
 * Weekends get no assumed work. No phases or plans are involved.
 */

/** Average tracked working hours per week over the last `weeks` completed full weeks. */
export function averageWeeklyWork(ledger: Ledger, today: ISODate, weeks = 4): { hours: number; weeks: number } | null {
  const complete = ledger
    .weeks()
    .filter((w) => w.to < today && w.from === w.weekStart && w.to === endOfWeek(w.weekStart))
    .slice(-weeks);
  if (complete.length === 0) return null;
  return { hours: complete.reduce((s, w) => s + w.worked, 0) / complete.length, weeks: complete.length };
}

/** Assumed working hours on one day if you work `weeklyHours` per week. */
function assumedWork(ledger: Ledger, date: ISODate, weeklyHours: number): number {
  if (!ledger.isWorkday(date)) return 0;
  const perDay = weeklyHours / (ledger.profile.contract.workdays.length || 1);
  const t = ledger.day(date);
  const away = t.vacation + t.sick + t.holiday;
  const share = ledger.perDay > 0 ? Math.max(0, 1 - away / ledger.perDay) : 1;
  return perDay * share;
}

/**
 * Projected balance at the end of each day from today until the end of the
 * period, assuming you work `weeklyHours` per week from now on.
 */
export function projectBalance(ledger: Ledger, today: ISODate, weeklyHours: number): Map<ISODate, number> {
  const result = new Map<ISODate, number>();
  const from = maxDate(today, ledger.start);
  let balance = ledger.balanceAt(addDays(from, -1));
  for (const date of eachDay(from, ledger.end)) {
    const t = ledger.day(date);
    let work = assumedWork(ledger, date, weeklyHours);
    if (date === today) work = Math.max(work, t.worked);
    balance += work + t.vacation + t.sick + t.holiday - t.target + ledger.adjustmentsOn(date);
    result.set(date, balance);
  }
  return result;
}

/** Projected balance on the morning of `date` (= end of the previous day). */
export function projectedBalanceOn(ledger: Ledger, today: ISODate, weeklyHours: number, date: ISODate): number {
  const day = minDate(addDays(date, -1), ledger.end);
  if (day < today) return ledger.balanceAt(day);
  return projectBalance(ledger, today, weeklyHours).get(day) ?? ledger.balanceAt(day);
}

export interface ZeroBalanceRequirement {
  /** Working hours still needed from today until the end of the period. */
  hours: number;
  /** Remaining calendar weeks (including today). */
  weeks: number;
  /** Average hours per remaining week. */
  perWeek: number;
}

/**
 * How many hours you still have to work (from today on, already tracked work
 * of today included) so that the balance is exactly 0 at the end of the period.
 * Negative hours mean you end with a surplus even without further work.
 */
export function hoursToZero(ledger: Ledger, today: ISODate): ZeroBalanceRequirement {
  const from = maxDate(today, ledger.start);
  const days = eachDay(from, ledger.end);
  let balance = ledger.balanceAt(addDays(from, -1));
  for (const d of days) {
    const t = ledger.day(d);
    balance += t.vacation + t.sick + t.holiday - t.target + ledger.adjustmentsOn(d);
  }
  const workedToday = ledger.day(from).worked;
  const hours = -balance - workedToday;
  const weeks = days.length / 7;
  return { hours, weeks, perWeek: weeks > 0 ? hours / weeks : 0 };
}
