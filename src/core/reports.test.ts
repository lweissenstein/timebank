import { describe, expect, it } from 'vitest';
import { sessionsToCsv } from './csv';
import { breakdown } from './reports';
import { testProfile, work } from './testUtils';

describe('reports', () => {
  const { areas } = testProfile();
  const sessions = [work('2026-11-09', 4, 'bob'), work('2026-11-10', 2, 'app'), work('2026-11-10', 3, 'thesis', 14)];

  it('sums hours per area and separates non-counting areas', () => {
    const b = breakdown(areas, sessions, '2026-11-09', '2026-11-15', 0);
    expect(b.workHours).toBeCloseTo(6);
    expect(b.allHours).toBeCloseTo(9);
    expect(b.areas.map((a) => a.areaId)).toEqual(['bob', 'app', 'thesis']);
  });

  it('respects the date range', () => {
    expect(breakdown(areas, sessions, '2026-11-10', '2026-11-10', 0).workHours).toBeCloseTo(2);
  });

  it('exports sessions as CSV with quoting', () => {
    const csv = sessionsToCsv([{ ...sessions[0], note: 'a, "b"' }], areas, 0, { delimiter: ';', decimal: ',' });
    const [header, row] = csv.trim().split('\r\n');
    expect(header.split(';')[0]).toBe('date');
    expect(row).toContain('4,00');
    expect(row).toContain('a, ""b""');
  });
});
