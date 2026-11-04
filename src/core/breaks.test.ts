import { describe, expect, it } from 'vitest';
import { normalizeBreaks, splitAtBreak } from './breaks';
import { dayStartMs, MS_PER_HOUR, MS_PER_MINUTE } from './dates';
import { work } from './testUtils';

const DAY = '2026-11-03';
const at = (h: number, m = 0) => dayStartMs(DAY) + h * MS_PER_HOUR + m * MS_PER_MINUTE;

describe('breaks as gaps between sessions', () => {
  it('splits a session at recorded pause intervals (14:00–15:24)', () => {
    const s = { ...work(DAY, 0, 'bob', 9), end: at(17), breakMinutes: 84, pauses: [{ start: at(14), end: at(15, 24) }], note: 'n', locationId: 'office' };
    const parts = normalizeBreaks(s, 1)!;
    expect(parts.map((p) => [p.id, p.start, p.end, p.breakMinutes])).toEqual([
      [s.id, at(9), at(14), 0],
      [`${s.id}-1`, at(15, 24), at(17), 0],
    ]);
    expect(parts[1]).toMatchObject({ areaId: 'bob', categoryId: 'dev', note: 'n', locationId: 'office', gapBefore: 'pause' });
  });

  it('keeps worked time identical', () => {
    const s = { ...work(DAY, 0, 'bob', 9), end: at(17), breakMinutes: 84, pauses: [{ start: at(14), end: at(15, 24) }] };
    const worked = (x: typeof s) => (x.end! - x.start) / MS_PER_MINUTE - x.breakMinutes;
    const parts = normalizeBreaks(s, 1)!;
    expect(parts.reduce((sum, p) => sum + worked(p as typeof s), 0)).toBeCloseTo(worked(s));
  });

  it('turns a running pause into "on break"', () => {
    const s = { ...work(DAY, 0, 'bob', 9), end: null, pausedAt: at(12) };
    const [p] = normalizeBreaks(s, 1)!;
    expect(p).toMatchObject({ end: at(12), onBreak: true, pausedAt: null });
  });

  it('leaves sessions without recorded pauses alone', () => {
    expect(normalizeBreaks(work(DAY, 3, 'bob', 9, 30), 1)).toBeNull();
  });

  it('inserts a break into a session and consumes the untimed total', () => {
    const s = { ...work(DAY, 0, 'bob', 9), end: at(17), breakMinutes: 84 }; // older session: 84 min without times
    const [a, b] = splitAtBreak(s, at(14), at(15, 24), 'new', 1);
    expect([a.start, a.end, a.breakMinutes]).toEqual([at(9), at(14), 0]);
    expect([b.id, b.start, b.end, b.gapBefore]).toEqual(['new', at(15, 24), at(17), 'pause']);
  });

  it('rejects breaks outside the session', () => {
    const s = { ...work(DAY, 0, 'bob', 9), end: at(12) };
    expect(() => splitAtBreak(s, at(13), at(14), 'x', 1)).toThrow();
  });
});
