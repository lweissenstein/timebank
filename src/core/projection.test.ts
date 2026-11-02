import { describe, expect, it } from 'vitest';
import { addDays } from './dates';
import { Ledger } from './ledger';
import { averageWeeklyWork, hoursToZero, projectBalance, projectedBalanceOn } from './projection';
import { absence, testProfile, work } from './testUtils';
import type { Absence, HolidayMap, Session } from './types';

const PERIOD = { start: '2026-11-02', end: '2026-11-29', startBalanceHours: 10 }; // 4 full weeks

function ledger(sessions: Session[] = [], absences: Absence[] = [], holidays: HolidayMap = new Map()) {
  return new Ledger({ profile: testProfile({ period: PERIOD }), holidays, sessions, absences, now: 0 });
}

const week = (monday: string, hoursPerDay: number) => [0, 1, 2, 3, 4].map((i) => work(addDays(monday, i), hoursPerDay));

describe('average weekly work', () => {
  it('averages completed weeks only', () => {
    const l = ledger([...week('2026-11-02', 8), ...week('2026-11-09', 4), work('2026-11-16', 8)]);
    expect(averageWeeklyWork(l, '2026-11-17')).toEqual({ hours: 30, weeks: 2 });
    expect(averageWeeklyWork(l, '2026-11-05')).toBeNull();
  });
});

describe('balance projection', () => {
  it('working exactly the contract keeps the balance', () => {
    const l = ledger();
    expect(projectedBalanceOn(l, '2026-11-02', 20, '2026-11-30')).toBeCloseTo(10);
  });

  it('extrapolates the assumed weekly hours', () => {
    const l = ledger();
    // 4 weeks with 8 h/week → −12 per week
    expect(projectedBalanceOn(l, '2026-11-02', 8, '2026-11-30')).toBeCloseTo(10 - 48);
  });

  it('credits entered vacation and holidays instead of assumed work', () => {
    const vacation = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13'].map((d) => absence(d));
    const holidays: HolidayMap = new Map([['2026-11-18', 'Holiday']]);
    const l = ledger([], vacation, holidays);
    // 40 h/week: week 1 +20, vacation week ±0, holiday week +16 (4 days × 8 + 4 − 20), week 4 +20
    expect(projectedBalanceOn(l, '2026-11-02', 40, '2026-11-30')).toBeCloseTo(10 + 20 + 0 + 16 + 20);
  });

  it('starts from yesterday and counts at least the work tracked today', () => {
    const l = ledger([work('2026-11-03', 6)]);
    const p = projectBalance(l, '2026-11-03', 20);
    // Monday without work: −4, Tuesday 6 h tracked (> 4 h assumed): +2
    expect(p.get('2026-11-03')).toBeCloseTo(10 - 4 + 2);
  });

  it('returns the actual balance for past dates', () => {
    const l = ledger([work('2026-11-02', 8)]);
    expect(projectedBalanceOn(l, '2026-11-10', 20, '2026-11-03')).toBeCloseTo(14);
  });
});

describe('hours to reach zero', () => {
  it('computes the remaining work for a zero balance', () => {
    const l = ledger();
    // target 80 h, start balance 10 h → 70 h over 4 weeks
    const r = hoursToZero(l, '2026-11-02');
    expect(r.hours).toBeCloseTo(70);
    expect(r.perWeek).toBeCloseTo(17.5);
  });

  it('takes vacation and work tracked today into account', () => {
    const l = ledger([work('2026-11-02', 3)], [absence('2026-11-03')]);
    expect(hoursToZero(l, '2026-11-02').hours).toBeCloseTo(70 - 4 - 3);
  });
});
