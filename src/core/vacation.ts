import { eachDay, maxDate, minDate, yearOf, type ISODate } from './dates';
import type { Ledger } from './ledger';
import type { Absence, Profile } from './types';

/** Months (1-12) of `year` that overlap the tracking period. */
export function monthsInPeriod(profile: Profile, year: number): number[] {
  const months: number[] = [];
  for (let m = 1; m <= 12; m++) {
    const first = `${year}-${String(m).padStart(2, '0')}-01`;
    const last = `${year}-${String(m).padStart(2, '0')}-31`;
    if (first <= profile.period.end && last >= profile.period.start) months.push(m);
  }
  return months;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Vacation entitlement in days for a calendar year. */
export function entitlementForYear(profile: Profile, year: number): number {
  const override = profile.vacation.overrides[String(year)];
  if (override !== undefined) return override;
  if (!profile.vacation.proRata) return profile.vacation.daysPerYear;
  return round2((profile.vacation.daysPerYear * monthsInPeriod(profile, year).length) / 12);
}

/** Entitlement earned so far in the year of `date` (monthly accrual, capped). */
export function accruedUntil(profile: Profile, date: ISODate): number {
  const year = yearOf(date);
  const total = entitlementForYear(profile, year);
  const months = monthsInPeriod(profile, year);
  if (months.length === 0) return 0;
  const month = Number(date.slice(5, 7));
  const elapsed = months.filter((m) => m <= month).length;
  return round2(Math.min(total, (total * elapsed) / months.length));
}

export interface VacationAccount {
  year: number;
  entitlement: number;
  /** Earned so far (for the current year), the full entitlement for past years. */
  accrued: number;
  /** Vacation days on or before today. */
  taken: number;
  /** Vacation days after today. */
  planned: number;
  /** entitlement - taken - planned */
  remaining: number;
  /** accrued - taken: what you could theoretically take right now. */
  availableNow: number;
}

/** Vacation days per year, measured in working days (credited hours / hours per day). */
export function vacationAccounts(
  ledger: Ledger,
  absences: Absence[],
  todayDate: ISODate,
): VacationAccount[] {
  const profile = ledger.profile;
  const years: number[] = [];
  for (let y = yearOf(ledger.start); y <= yearOf(ledger.end); y++) years.push(y);
  return years.map((year) => {
    let taken = 0;
    let planned = 0;
    for (const a of absences) {
      if (a.deleted || a.type !== 'vacation' || yearOf(a.date) !== year) continue;
      const days = ledger.perDay > 0 ? ledger.absenceHours(a) / ledger.perDay : 0;
      if (a.date <= todayDate) taken += days;
      else planned += days;
    }
    const entitlement = entitlementForYear(profile, year);
    const accrued =
      year < yearOf(todayDate) ? entitlement : year > yearOf(todayDate) ? 0 : accruedUntil(profile, todayDate);
    return {
      year,
      entitlement,
      accrued,
      taken: round2(taken),
      planned: round2(planned),
      remaining: round2(entitlement - taken - planned),
      availableNow: round2(accrued - taken),
    };
  });
}

/** Workdays in the range that would consume vacation (no holidays, inside period). */
export function vacationDaysInRange(ledger: Ledger, from: ISODate, to: ISODate): ISODate[] {
  return eachDay(maxDate(from, ledger.start), minDate(to, ledger.end)).filter(
    (d) => ledger.isWorkday(d) && !ledger.holidays.has(d),
  );
}
