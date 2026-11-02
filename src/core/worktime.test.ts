import { describe, expect, it } from 'vitest';
import { work } from './testUtils';
import { breakMinutesOf } from './worktime';

describe('breakMinutesOf', () => {
  it('adds recorded pauses and gaps between sessions', () => {
    const morning = work('2026-11-09', 3, 'bob', 9, 15); // 09:00–12:15, 15 min pause
    const afternoon = work('2026-11-09', 2, 'app', 12.75); // starts 12:45 → 30 min gap
    expect(breakMinutesOf([afternoon, morning], 0)).toBeCloseTo(45);
  });

  it('is zero for back-to-back sessions', () => {
    expect(breakMinutesOf([work('2026-11-09', 2, 'bob', 9), work('2026-11-09', 1, 'app', 11)], 0)).toBe(0);
  });
});
