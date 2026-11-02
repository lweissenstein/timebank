import type { ISODate, Weekday } from './dates';

/** A selectable category inside an area, e.g. "Bugfixing". */
export interface Category {
  id: string;
  name: string;
  hidden: boolean;
}

/** A top-level bucket of work, e.g. a project. */
export interface Area {
  id: string;
  name: string;
  color: string;
  /** Whether time in this area counts towards the working-time balance. */
  countsAsWork: boolean;
  hidden: boolean;
  categories: Category[];
}

/**
 * A planning phase. `plannedHoursPerWeek` is either a fixed number of planned
 * working hours per week or "zero-balance": work exactly as much as needed so
 * that the balance reaches 0 at the end of the phase.
 */
export interface Phase {
  id: string;
  name: string;
  start: ISODate;
  end: ISODate;
  plannedHoursPerWeek: number | 'zero-balance';
  /** Optional informational split of planned hours by area id (fractions or hours). */
  areaShare?: Record<string, number>;
  note?: string;
}

export interface BreakRule {
  /** Applies when daily working time exceeds this many hours. */
  afterHours: number;
  minBreakMinutes: number;
}

export interface Profile {
  version: 1;
  name: string;
  locale?: 'en' | 'de';
  period: {
    start: ISODate;
    end: ISODate;
    /** Balance carried over into the first tracked day (hours, may be negative). */
    startBalanceHours: number;
  };
  contract: {
    weeklyHours: number;
    workdays: Weekday[];
  };
  vacation: {
    daysPerYear: number;
    /** Reduce the yearly entitlement by the months the period covers in that year. */
    proRata: boolean;
    /** Explicit entitlement per calendar year, e.g. { "2026": 3.33 }. */
    overrides: Record<string, number>;
  };
  holidays: {
    /** ISO 3166-1 country code, e.g. "DE". Empty string disables built-in holidays. */
    country: string;
    /** State/region code, e.g. "BE" for Berlin. */
    region?: string;
    extra: { date: ISODate; name: string }[];
    excluded: ISODate[];
  };
  areas: Area[];
  phases: Phase[];
  warnings: {
    enabled: boolean;
    maxDailyHours: number;
    longSessionHours: number;
    breakRules: BreakRule[];
  };
}

/** A tracked time span. Timestamps are epoch milliseconds. */
export interface Session {
  id: string;
  areaId: string;
  categoryId: string;
  start: number;
  /** `null` while the session is running. */
  end: number | null;
  /** Accumulated break time in minutes (excluding a currently running pause). */
  breakMinutes: number;
  /** Set while the running session is paused. */
  pausedAt: number | null;
  note: string;
  thesisRelevant: boolean;
  updatedAt: number;
  deleted?: boolean;
}

export type AbsenceType = 'vacation' | 'sick';

/** A full or partial day off. */
export interface Absence {
  id: string;
  date: ISODate;
  type: AbsenceType;
  /** Credited hours; `null` means "one regular working day". */
  hours: number | null;
  note: string;
  updatedAt: number;
  deleted?: boolean;
}

/** Holidays by date (name as value). */
export type HolidayMap = Map<ISODate, string>;
