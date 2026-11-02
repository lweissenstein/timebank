import { describe, expect, it } from 'vitest';
import { sessionsToCsv } from './csv';
import { locationBreakdown } from './reports';
import { testProfile, work } from './testUtils';

describe('work locations', () => {
  const profile = testProfile({ workLocations: [{ id: 'office', name: 'Office' }, { id: 'remote', name: 'Remote' }] });
  const sessions = [
    { ...work('2026-11-09', 4), locationId: 'office' },
    { ...work('2026-11-10', 3), locationId: 'remote' },
    { ...work('2026-11-10', 2, 'app', 14), locationId: 'remote' },
    { ...work('2026-11-11', 5, 'thesis'), locationId: 'remote' },
    work('2026-11-12', 1),
  ];

  it('sums counted hours and days per location', () => {
    const b = locationBreakdown(profile.areas, sessions, '2026-11-09', '2026-11-15', 0);
    expect(b).toEqual([
      { locationId: 'office', hours: 4, days: 1 },
      { locationId: 'remote', hours: 5, days: 1 },
      { locationId: '', hours: 1, days: 1 },
    ]);
  });

  it('exports the location name as CSV column', () => {
    const csv = sessionsToCsv(sessions.slice(0, 1), profile.areas, 0, undefined, profile.workLocations);
    const [header, row] = csv.trim().split('\r\n');
    expect(header.endsWith(',location')).toBe(true);
    expect(row.endsWith(',Office')).toBe(true);
  });
});
