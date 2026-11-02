import { describe, expect, it } from 'vitest';
import { Ledger } from './ledger';
import { absence, testProfile } from './testUtils';
import { accruedUntil, entitlementForYear, vacationAccounts } from './vacation';

describe('vacation account', () => {
  const profile = testProfile();

  it('pro-rates 20 days per year by months in the period', () => {
    expect(entitlementForYear(profile, 2026)).toBeCloseTo(3.33);
    expect(entitlementForYear(profile, 2027)).toBeCloseTo(5);
  });

  it('respects explicit overrides and disabled pro-rating', () => {
    expect(entitlementForYear(testProfile({ vacation: { daysPerYear: 20, proRata: true, overrides: { '2026': 4 } } }), 2026)).toBe(4);
    expect(entitlementForYear(testProfile({ vacation: { daysPerYear: 20, proRata: false, overrides: {} } }), 2026)).toBe(20);
  });

  it('accrues monthly', () => {
    expect(accruedUntil(profile, '2026-11-15')).toBeCloseTo(1.67);
    expect(accruedUntil(profile, '2026-12-01')).toBeCloseTo(3.33);
    expect(accruedUntil(profile, '2027-02-10')).toBeCloseTo(3.33);
  });

  it('splits taken and planned days and counts half days', () => {
    const holidays = new Map([['2026-12-25', 'Christmas']]);
    const absences = [absence('2026-11-20'), absence('2026-12-21'), absence('2026-12-22', 'vacation', 2), absence('2026-12-25'), absence('2026-11-23', 'sick')];
    const l = new Ledger({ profile, holidays, sessions: [], absences, now: 0 });
    const [y2026] = vacationAccounts(l, absences, '2026-12-01');
    expect(y2026.taken).toBe(1);
    expect(y2026.planned).toBe(1.5); // the holiday does not consume vacation
    expect(y2026.remaining).toBeCloseTo(0.83);
    expect(y2026.availableNow).toBeCloseTo(2.33);
  });
});
