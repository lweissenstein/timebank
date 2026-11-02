import { describe, expect, it } from 'vitest';
import { eachDay } from '../core/dates';
import { Ledger } from '../core/ledger';
import { projectedBalanceOn } from '../core/projection';
import { absence, testProfile } from '../core/testUtils';
import { vacationAccounts, vacationDaysInRange } from '../core/vacation';
import { holidaysForProfile } from './holidayCalendar';

/** Vacation 27.–31.12.2026 with real Berlin holidays (27.12. is a Sunday, 01.01. New Year). */
describe('vacation 27.–31.12.2026 (Berlin)', () => {
  const profile = testProfile({
    period: { start: '2026-11-02', end: '2027-03-31', startBalanceHours: 0 },
    holidays: { country: 'DE', region: 'BE', extra: [], excluded: [] },
  });
  const holidays = holidaysForProfile(profile);
  const base = new Ledger({ profile, holidays, sessions: [], absences: [], now: 0 });
  // What "set range 27.–31.12." in the calendar creates:
  const days = vacationDaysInRange(base, '2026-12-27', '2026-12-31');
  const ledger = new Ledger({ profile, holidays, sessions: [], absences: days.map((d) => absence(d)), now: 0 });

  it('books only the workdays Mon 28. – Thu 31.12.', () => {
    expect(days).toEqual(['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31']);
  });

  it('credits 4 h per vacation day; with New Year the week is balanced', () => {
    const w = ledger.week('2026-12-28');
    expect(w.vacation).toBe(16);
    expect(w.holiday).toBe(4);
    expect(w.target).toBe(20);
    expect(w.delta).toBe(0);
  });

  it('consumes 4 vacation days of 2026 (entitlement 3.33)', () => {
    const [y2026, y2027] = vacationAccounts(ledger, days.map((d) => absence(d)), '2026-11-16');
    expect(y2026.planned).toBe(4);
    expect(y2026.remaining).toBeCloseTo(-0.67);
    expect(y2026.availableNow).toBeCloseTo(1.67);
    expect(y2027.taken + y2027.planned).toBe(0);
  });

  it('forecast: no work assumed on vacation days', () => {
    // Assume 40 h/week. Without vacation the week of 28.12. would add +16 h (4 days × 8 h + New Year 4 h − 20 h).
    const today = '2026-12-28';
    const withVacation = projectedBalanceOn(ledger, today, 40, '2027-01-04') - ledger.balanceAt('2026-12-27');
    const without = projectedBalanceOn(base, today, 40, '2027-01-04') - base.balanceAt('2026-12-27');
    expect(withVacation).toBeCloseTo(0);
    expect(without).toBeCloseTo(16);
  });

  it('every vacation day is a workday without holiday', () => {
    for (const d of eachDay('2026-12-27', '2026-12-31')) {
      expect(ledger.day(d).vacation).toBe(days.includes(d) ? 4 : 0);
    }
  });
});
