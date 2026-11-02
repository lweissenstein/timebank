import { dayStartMs, MS_PER_HOUR, type ISODate } from './dates';
import type { Absence, Profile, Session } from './types';

/** A minimal profile for tests: 20 h / week, Mon–Fri, 02.11.2026 – 31.03.2027. */
export function testProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    version: 1,
    name: 'Test',
    period: { start: '2026-11-02', end: '2027-03-31', startBalanceHours: 0 },
    contract: { weeklyHours: 20, workdays: [1, 2, 3, 4, 5] },
    vacation: { daysPerYear: 20, proRata: true, overrides: {} },
    holidays: { country: '', extra: [], excluded: [] },
    areas: [
      { id: 'bob', name: 'Project Bob', color: '#1f6f5c', countsAsWork: true, hidden: false, categories: [{ id: 'dev', name: 'Dev', hidden: false }] },
      { id: 'app', name: 'App', color: '#3b6fb6', countsAsWork: true, hidden: false, categories: [{ id: 'dev', name: 'Dev', hidden: false }] },
      { id: 'thesis', name: 'Thesis', color: '#a05a2c', countsAsWork: false, hidden: false, categories: [{ id: 'write', name: 'Write', hidden: false }] },
    ],
    phases: [],
    milestones: [],
    warnings: {
      enabled: true,
      maxDailyHours: 10,
      longSessionHours: 6,
      breakRules: [
        { afterHours: 6, minBreakMinutes: 30 },
        { afterHours: 9, minBreakMinutes: 45 },
      ],
    },
    ...overrides,
  };
}

let counter = 0;

/** A finished session on `date` starting at `startHour` lasting `hours` (net). */
export function work(date: ISODate, hours: number, areaId = 'bob', startHour = 9, breakMinutes = 0): Session {
  const start = dayStartMs(date) + startHour * MS_PER_HOUR;
  return {
    id: `s${++counter}`,
    areaId,
    categoryId: 'dev',
    start,
    end: start + hours * MS_PER_HOUR + breakMinutes * 60_000,
    breakMinutes,
    pausedAt: null,
    note: '',
    thesisRelevant: false,
    updatedAt: 0,
  };
}

export function absence(date: ISODate, type: Absence['type'] = 'vacation', hours: number | null = null): Absence {
  return { id: `a${++counter}`, date, type, hours, note: '', updatedAt: 0 };
}
