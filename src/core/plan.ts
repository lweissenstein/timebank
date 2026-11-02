import { addDays, eachDay, endOfWeek, eachWeekStart, maxDate, minDate, startOfWeek, type ISODate } from './dates';
import type { Ledger } from './ledger';
import type { Phase } from './types';

export function phaseAt(phases: Phase[], date: ISODate): Phase | undefined {
  return phases.find((p) => date >= p.start && date <= p.end);
}

/**
 * Hours that are fixed regardless of how much you work on a day:
 * holidays and absences minus the target. Planned work adds on top.
 */
function fixedDelta(ledger: Ledger, date: ISODate): number {
  const t = ledger.day(date);
  return t.holiday + t.vacation + t.sick - t.target;
}

/** A workday without holiday or absence, i.e. a day where work is planned. */
function isFreeWorkday(ledger: Ledger, date: ISODate): boolean {
  const t = ledger.day(date);
  return t.target > 0 && t.holiday + t.vacation + t.sick === 0;
}

/**
 * Planned hours per free workday for a fixed-hours phase: the week's planned
 * hours (pro-rated if the phase covers only part of the week) are spread over
 * the free workdays, so holidays or single days off do not reduce the plan.
 */
function fixedPhaseRate(ledger: Ledger, phase: Phase, hoursPerWeek: number, date: ISODate, nWorkdays: number): number {
  const from = maxDate(startOfWeek(date), phase.start);
  const to = minDate(endOfWeek(date), phase.end);
  const days = eachDay(from, to);
  const workdays = days.filter((d) => ledger.isWorkday(d)).length;
  const free = days.filter((d) => isFreeWorkday(ledger, d)).length;
  return free > 0 ? (hoursPerWeek * workdays) / nWorkdays / free : 0;
}

export interface SimulationResult {
  /** Balance at the end of each simulated day. */
  daily: Map<ISODate, number>;
  /** Planned working hours per simulated day. */
  plannedWork: Map<ISODate, number>;
  endBalance: number;
}

/**
 * Simulates the balance from `from` (inclusive) to the end of the period,
 * starting with `startBalance` on the morning of `from`, assuming you work
 * exactly according to the phase plan. Days without a phase are planned as
 * regular target days (balance unchanged). Entered absences (including future
 * ones) and holidays are taken into account.
 */
export function simulatePlan(ledger: Ledger, from: ISODate, startBalance: number): SimulationResult {
  const phases = ledger.profile.phases;
  const perDay = ledger.perDay;
  const nWorkdays = ledger.profile.contract.workdays.length || 1;
  const daily = new Map<ISODate, number>();
  const plannedWork = new Map<ISODate, number>();
  let balance = startBalance;
  const zeroBalanceRate = new Map<string, number>();

  for (const date of eachDay(maxDate(from, ledger.start), ledger.end)) {
    const phase = phaseAt(phases, date);
    let work = 0;
    if (isFreeWorkday(ledger, date)) {
      if (!phase) {
        work = perDay;
      } else if (phase.plannedHoursPerWeek === 'zero-balance') {
        if (!zeroBalanceRate.has(phase.id)) {
          const days = eachDay(date, minDate(phase.end, ledger.end));
          const fixed = days.reduce((sum, d) => sum + fixedDelta(ledger, d) + ledger.adjustmentsOn(d), 0);
          const freeDays = days.filter((d) => isFreeWorkday(ledger, d)).length;
          const needed = Math.max(0, -(balance + fixed));
          zeroBalanceRate.set(phase.id, freeDays > 0 ? needed / freeDays : 0);
        }
        work = zeroBalanceRate.get(phase.id)!;
      } else {
        work = fixedPhaseRate(ledger, phase, phase.plannedHoursPerWeek, date, nWorkdays);
      }
    }
    plannedWork.set(date, work);
    balance += fixedDelta(ledger, date) + ledger.adjustmentsOn(date) + work;
    daily.set(date, balance);
  }
  return { daily, plannedWork, endBalance: balance };
}

export interface CurvePoint {
  /** Last day of the week (or period end). */
  date: ISODate;
  planned: number;
  /** Actual balance; undefined for future weeks. */
  actual?: number;
}

/** Weekly points of the planned balance (from period start) vs. the actual balance. */
export function balanceCurve(ledger: Ledger, todayDate: ISODate): CurvePoint[] {
  const plan = simulatePlan(ledger, ledger.start, ledger.openingBalance);
  const points: CurvePoint[] = [
    {
      date: addDays(ledger.start, -1),
      planned: ledger.openingBalance,
      actual: ledger.openingBalance,
    },
  ];
  for (const w of eachWeekStart(ledger.start, ledger.end)) {
    const date = minDate(endOfWeek(w), ledger.end);
    const point: CurvePoint = { date, planned: plan.daily.get(date) ?? 0 };
    if (date <= todayDate) point.actual = ledger.balanceAt(date);
    else if (w <= todayDate) point.actual = ledger.balanceAt(todayDate);
    points.push(point);
  }
  return points;
}

export interface Forecast {
  /** Balance at the start (morning) of this day. */
  date: ISODate;
  /** Continuing according to the phase plan from today on. */
  byPlan: number;
  /** Continuing with the average weekly delta of recent weeks; null without history. */
  byPace: number | null;
}

/** Average balance change per week over the last `weeks` completed weeks. */
export function recentWeeklyPace(ledger: Ledger, todayDate: ISODate, weeks = 4): number | null {
  const completed = ledger.weeks().filter((w) => w.to < todayDate && w.to === endOfWeek(w.weekStart));
  const recent = completed.slice(-weeks);
  if (recent.length === 0) return null;
  return recent.reduce((s, w) => s + w.delta, 0) / recent.length;
}

export function forecast(ledger: Ledger, todayDate: ISODate, dates: ISODate[]): Forecast[] {
  const balanceNow = ledger.balanceAt(todayDate);
  const sim = simulatePlan(ledger, addDays(todayDate, 1), balanceNow);
  const pace = recentWeeklyPace(ledger, todayDate);
  return dates.map((date) => {
    // balance at the start of `date` = end of the previous day
    const target = minDate(addDays(date, -1), ledger.end);
    const byPlan = target <= todayDate ? ledger.balanceAt(target) : (sim.daily.get(target) ?? balanceNow);
    let byPace: number | null = null;
    if (pace !== null) {
      // Pace extrapolation: fixed items (holidays, absences) plus the recent average
      // of "work minus target" applied to the remaining weeks.
      const days = Math.max(0, eachDay(addDays(todayDate, 1), target).length);
      byPace = balanceNow + (pace * days) / 7;
    }
    return { date, byPlan, byPace };
  });
}

export interface Requirement {
  /** Working hours still needed until the end of the period to reach a 0 balance. */
  totalHours: number;
  /** Remaining workdays without holiday/absence. */
  freeWorkdays: number;
  /** Remaining calendar weeks (days / 7). */
  weeks: number;
  /** Average hours per remaining calendar week. */
  perWeek: number;
  /** Hours per remaining free workday. */
  perFreeWorkday: number;
}

/**
 * How much you still have to work from tomorrow on so that the balance is
 * exactly 0 at the end of the period. Negative totals mean you would end with
 * a surplus even without working.
 */
export function requiredToBalance(ledger: Ledger, todayDate: ISODate): Requirement {
  const balanceNow = ledger.balanceAt(todayDate);
  const days = eachDay(maxDate(addDays(todayDate, 1), ledger.start), ledger.end);
  const fixed = days.reduce((s, d) => s + fixedDelta(ledger, d) + ledger.adjustmentsOn(d), 0);
  const freeWorkdays = days.filter((d) => isFreeWorkday(ledger, d)).length;
  const totalHours = -(balanceNow + fixed);
  const weeks = days.length / 7;
  return {
    totalHours,
    freeWorkdays,
    weeks,
    perWeek: weeks > 0 ? totalHours / weeks : 0,
    perFreeWorkday: freeWorkdays > 0 ? totalHours / freeWorkdays : 0,
  };
}
