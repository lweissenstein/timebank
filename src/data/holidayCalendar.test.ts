import { describe, expect, it } from 'vitest';
import { testProfile } from '../core/testUtils';
import { holidaysForProfile, listRegions } from './holidayCalendar';

describe('holiday calendar', () => {
  it('loads Berlin public holidays for the period years', () => {
    const map = holidaysForProfile(testProfile({ holidays: { country: 'DE', region: 'BE', extra: [], excluded: [] } }));
    for (const d of ['2026-12-25', '2026-12-26', '2027-01-01', '2027-03-08', '2027-03-26', '2027-03-29']) {
      expect(map.has(d), d).toBe(true);
    }
    expect(map.has('2026-11-18')).toBe(false); // Buß- und Bettag is Saxony only
  });

  it('applies extra and excluded days', () => {
    const map = holidaysForProfile(
      testProfile({ holidays: { country: 'DE', region: 'BE', extra: [{ date: '2026-11-20', name: 'Company day' }], excluded: ['2027-03-08'] } }),
    );
    expect(map.get('2026-11-20')).toBe('Company day');
    expect(map.has('2027-03-08')).toBe(false);
  });

  it('lists German states', () => {
    expect(listRegions('DE').map((r) => r.code)).toContain('BE');
  });
});
