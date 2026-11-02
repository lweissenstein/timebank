import { describe, expect, it } from 'vitest';
import { addDays } from './dates';
import { Ledger } from './ledger';
import { absence, testProfile, work } from './testUtils';
import type { Absence, HolidayMap, Session } from './types';

const WEEK = '2026-11-09'; // a regular Monday inside the period

function ledger(sessions: Session[], absences: Absence[] = [], holidays: HolidayMap = new Map(), profile = testProfile()) {
  return new Ledger({ profile, holidays, sessions, absences, now: Date.now() });
}

function weekDays(n: number, from = WEEK): string[] {
  return Array.from({ length: n }, (_, i) => addDays(from, i));
}

describe('weekly balance – required examples', () => {
  it('40 h of work → +20 h', () => {
    const l = ledger(weekDays(5).map((d) => work(d, 8)));
    expect(l.week(WEEK).delta).toBeCloseTo(20);
  });

  it('5 vacation days, no work → +0 h', () => {
    const w = l5vac();
    expect(w.actual).toBeCloseTo(20);
    expect(w.delta).toBeCloseTo(0);
    function l5vac() {
      return ledger([], weekDays(5).map((d) => absence(d))).week(WEEK);
    }
  });

  it('3 vacation days (12 h) and 10 h of work → +2 h', () => {
    const l = ledger([work(addDays(WEEK, 3), 5), work(addDays(WEEK, 4), 5)], weekDays(3).map((d) => absence(d)));
    const w = l.week(WEEK);
    expect(w.vacation).toBeCloseTo(12);
    expect(w.delta).toBeCloseTo(2);
  });

  it('no work, no vacation → −20 h', () => {
    expect(ledger([]).week(WEEK).delta).toBeCloseTo(-20);
  });

  it('8 h of work → −12 h', () => {
    expect(ledger([work(WEEK, 8)]).week(WEEK).delta).toBeCloseTo(-12);
  });

  it('holiday on a weekday and 16 h of work → +0 h', () => {
    const holidays: HolidayMap = new Map([['2027-03-08', "Women's Day"]]); // Monday
    const week = '2027-03-08';
    const l = ledger(weekDays(4, addDays(week, 1)).map((d) => work(d, 4)), [], holidays);
    const w = l.week(week);
    expect(w.holiday).toBeCloseTo(4);
    expect(w.delta).toBeCloseTo(0);
  });

  it('holiday on a Saturday and 16 h of work → −4 h', () => {
    const holidays: HolidayMap = new Map([['2026-12-26', 'Boxing Day']]); // Saturday
    const week = '2026-12-21';
    const l = ledger(weekDays(4, week).map((d) => work(d, 4)), [], holidays);
    const w = l.week(week);
    expect(w.holiday).toBe(0);
    expect(w.delta).toBeCloseTo(-4);
  });
});

describe('ledger rules', () => {
  it('ignores areas that do not count as work (thesis)', () => {
    const l = ledger([work(WEEK, 8, 'thesis'), work(addDays(WEEK, 1), 8, 'app')]);
    expect(l.week(WEEK).worked).toBeCloseTo(8);
  });

  it('sick days count like vacation', () => {
    const w = ledger([], weekDays(5).map((d) => absence(d, 'sick'))).week(WEEK);
    expect(w.sick).toBeCloseTo(20);
    expect(w.delta).toBeCloseTo(0);
  });

  it('partial absences use their own hours', () => {
    const w = ledger([], [absence(WEEK, 'vacation', 2)]).week(WEEK);
    expect(w.vacation).toBeCloseTo(2);
  });

  it('absences on weekends or holidays credit nothing', () => {
    const holidays: HolidayMap = new Map([['2026-11-10', 'Test']]);
    const w = ledger([], [absence('2026-11-14'), absence('2026-11-10')], holidays).week(WEEK);
    expect(w.vacation).toBe(0);
    expect(w.holiday).toBeCloseTo(4);
  });

  it('weekend work counts as actual time', () => {
    expect(ledger([work('2026-11-14', 5)]).week(WEEK).worked).toBeCloseTo(5);
  });

  it('subtracts breaks from working time', () => {
    expect(ledger([work(WEEK, 6, 'bob', 9, 30)]).week(WEEK).worked).toBeCloseTo(6);
  });

  it('pro-rates the target in partial weeks at the period boundaries', () => {
    const profile = testProfile({ period: { start: '2026-11-04', end: '2027-03-31', startBalanceHours: 0 } });
    const l = ledger([], [], new Map(), profile);
    expect(l.week('2026-11-02').target).toBeCloseTo(12); // Wed–Fri
    expect(l.week('2027-03-29').target).toBeCloseTo(12); // Mon–Wed
  });

  it('derives hours per day from weekly hours and workdays', () => {
    const profile = testProfile({ contract: { weeklyHours: 30, workdays: [1, 2, 3] } });
    const l = ledger([], [absence(WEEK)], new Map(), profile);
    const w = l.week(WEEK);
    expect(w.target).toBeCloseTo(30);
    expect(w.vacation).toBeCloseTo(10);
  });

  it('splits sessions across midnight', () => {
    const s = work('2026-11-09', 4, 'bob', 22); // 22:00 – 02:00
    const l = ledger([s]);
    expect(l.day('2026-11-09').worked).toBeCloseTo(2);
    expect(l.day('2026-11-10').worked).toBeCloseTo(2);
  });

  it('accumulates the balance with the start balance', () => {
    const profile = testProfile({ period: { start: '2026-11-02', end: '2027-03-31', startBalanceHours: 13 } });
    const sessions = weekDays(5, '2026-11-02').map((d) => work(d, 8));
    const l = ledger(sessions, [], new Map(), profile);
    expect(l.balanceAt('2026-11-08')).toBeCloseTo(33);
    expect(l.balanceAt('2026-11-10')).toBeCloseTo(25); // two empty days → −8
    expect(l.balanceAt('2026-11-01')).toBe(13);
  });

  it('ignores deleted sessions and absences', () => {
    const s = { ...work(WEEK, 8), deleted: true };
    const a = { ...absence(WEEK), deleted: true };
    expect(ledger([s], [a]).week(WEEK).actual).toBe(0);
  });
});
