import {
  eachDay,
  eachWeekStart,
  endOfWeek,
  maxDate,
  minDate,
  MS_PER_HOUR,
  weekday,
  type ISODate,
} from './dates';
import type { Absence, HolidayMap, Profile, Session } from './types';
import { workByDay } from './worktime';

/** Hours of one contractual working day, derived from weekly hours and workdays. */
export function hoursPerDay(profile: Profile): number {
  const n = profile.contract.workdays.length;
  return n === 0 ? 0 : profile.contract.weeklyHours / n;
}

/** Hour totals for one day or a range of days. All values in hours. */
export interface Totals {
  /** Contractual target. */
  target: number;
  /** Net time in areas that count as work. */
  worked: number;
  vacation: number;
  sick: number;
  holiday: number;
  /** worked + vacation + sick + holiday */
  actual: number;
  /** actual - target; the change of the overtime balance. */
  delta: number;
}

export interface WeekTotals extends Totals {
  weekStart: ISODate;
  /** First and last day of the week that lie inside the tracking period. */
  from: ISODate;
  to: ISODate;
}

export const ZERO_TOTALS: Totals = {
  target: 0,
  worked: 0,
  vacation: 0,
  sick: 0,
  holiday: 0,
  actual: 0,
  delta: 0,
};

export function addTotals(a: Totals, b: Totals): Totals {
  return {
    target: a.target + b.target,
    worked: a.worked + b.worked,
    vacation: a.vacation + b.vacation,
    sick: a.sick + b.sick,
    holiday: a.holiday + b.holiday,
    actual: a.actual + b.actual,
    delta: a.delta + b.delta,
  };
}

export interface LedgerInput {
  profile: Profile;
  holidays: HolidayMap;
  sessions: Session[];
  absences: Absence[];
  /** Epoch ms used for running sessions. */
  now: number;
}

/**
 * The hour ledger implements the balance rules:
 *  - target: hours per day on every contractual workday inside the period
 *    (a full week = weekly hours, partial weeks are pro-rated)
 *  - actual: work in counting areas + vacation + sick days + holidays on workdays
 *  - balance change = actual - target
 * Weekly deltas are the sum of daily deltas, so balances can be evaluated on any day.
 */
export class Ledger {
  readonly profile: Profile;
  readonly holidays: HolidayMap;
  readonly perDay: number;
  private readonly workMs: Map<ISODate, number>;
  private readonly absencesByDay: Map<ISODate, Absence[]>;
  private readonly workdays: Set<number>;

  constructor(input: LedgerInput) {
    this.profile = input.profile;
    this.holidays = input.holidays;
    this.perDay = hoursPerDay(input.profile);
    this.workdays = new Set(input.profile.contract.workdays);
    const countingAreas = new Set(
      input.profile.areas.filter((a) => a.countsAsWork).map((a) => a.id),
    );
    this.workMs = workByDay(
      input.sessions.filter((s) => !s.deleted && countingAreas.has(s.areaId)),
      input.now,
    );
    this.absencesByDay = new Map();
    for (const a of input.absences) {
      if (a.deleted) continue;
      const list = this.absencesByDay.get(a.date) ?? [];
      list.push(a);
      this.absencesByDay.set(a.date, list);
    }
  }

  get start(): ISODate {
    return this.profile.period.start;
  }

  get end(): ISODate {
    return this.profile.period.end;
  }

  inPeriod(date: ISODate): boolean {
    return date >= this.start && date <= this.end;
  }

  isWorkday(date: ISODate): boolean {
    return this.workdays.has(weekday(date));
  }

  /** A holiday that is credited: on a contractual workday. */
  isCreditedHoliday(date: ISODate): boolean {
    return this.isWorkday(date) && this.holidays.has(date);
  }

  /** Hours credited for an absence on this day (0 on non-workdays and holidays). */
  absenceHours(a: Absence): number {
    if (!this.inPeriod(a.date) || !this.isWorkday(a.date) || this.holidays.has(a.date)) return 0;
    return a.hours ?? this.perDay;
  }

  day(date: ISODate): Totals {
    if (!this.inPeriod(date)) return ZERO_TOTALS;
    const workday = this.isWorkday(date);
    const target = workday ? this.perDay : 0;
    const holiday = this.isCreditedHoliday(date) ? this.perDay : 0;
    let vacation = 0;
    let sick = 0;
    for (const a of this.absencesByDay.get(date) ?? []) {
      const h = this.absenceHours(a);
      if (a.type === 'vacation') vacation += h;
      else sick += h;
    }
    const worked = (this.workMs.get(date) ?? 0) / MS_PER_HOUR;
    const actual = worked + vacation + sick + holiday;
    return { target, worked, vacation, sick, holiday, actual, delta: actual - target };
  }

  /** Totals for an inclusive date range, clipped to the tracking period. */
  range(from: ISODate, to: ISODate): Totals {
    let t = ZERO_TOTALS;
    for (const d of eachDay(maxDate(from, this.start), minDate(to, this.end))) {
      t = addTotals(t, this.day(d));
    }
    return t;
  }

  week(weekStart: ISODate): WeekTotals {
    const from = maxDate(weekStart, this.start);
    const to = minDate(endOfWeek(weekStart), this.end);
    return { weekStart, from, to, ...this.range(from, to) };
  }

  weeks(from: ISODate = this.start, to: ISODate = this.end): WeekTotals[] {
    return eachWeekStart(maxDate(from, this.start), minDate(to, this.end)).map((w) =>
      this.week(w),
    );
  }

  /** Overtime balance at the end of the given day. */
  balanceAt(date: ISODate): number {
    if (date < this.start) return this.profile.period.startBalanceHours;
    return this.profile.period.startBalanceHours + this.range(this.start, date).delta;
  }
}
