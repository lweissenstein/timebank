import { describe, expect, it } from 'vitest';
import { Ledger } from './ledger';
import { balanceCurve, simulatePlan } from './plan';
import { testProfile, work } from './testUtils';

describe('balance adjustments', () => {
  const profile = testProfile({
    period: { start: '2026-11-02', end: '2027-03-31', startBalanceHours: 0 },
    balanceAdjustments: [
      { date: '2026-10-29', hours: 6, note: 'overtime October' },
      { date: '2026-10-30', hours: 7 },
      { date: '2026-11-20', hours: -2, note: 'correction' },
    ],
  });
  const ledger = new Ledger({ profile, holidays: new Map(), sessions: [work('2026-11-02', 4)], absences: [], now: 0 });

  it('adds adjustments before the period to the opening balance', () => {
    expect(ledger.openingBalance).toBe(13);
    expect(ledger.balanceAt('2026-10-29')).toBe(6);
    expect(ledger.balanceAt('2026-11-02')).toBeCloseTo(13);
  });

  it('applies adjustments inside the period on their date', () => {
    const before = ledger.balanceAt('2026-11-19');
    expect(ledger.balanceAt('2026-11-20') - before).toBeCloseTo(-2 - 4);
  });

  it('does not change target or actual hours', () => {
    const w = ledger.week('2026-11-16');
    expect(w.target).toBe(20);
    expect(w.actual).toBe(0);
  });

  it('is included in the plan curve', () => {
    expect(balanceCurve(ledger, '2026-11-02')[0].planned).toBe(13);
    const sim = simulatePlan(ledger, ledger.start, ledger.openingBalance);
    expect(sim.daily.get('2026-11-20')! - sim.daily.get('2026-11-19')!).toBeCloseTo(-2);
  });
});
