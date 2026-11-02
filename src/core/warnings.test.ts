import { describe, expect, it } from 'vitest';
import { testProfile, work } from './testUtils';
import { dayWarnings, isUnusuallyLong } from './warnings';

const DAY = '2026-11-09';

describe('warnings', () => {
  const profile = testProfile();

  it('warns about more than 10 h of work per day', () => {
    const w = dayWarnings(profile, [work(DAY, 11, 'bob', 8, 60)], 0);
    expect(w.map((x) => x.kind)).toEqual(['maxDaily']);
  });

  it('requires 30 min break after 6 h and 45 min after 9 h', () => {
    expect(dayWarnings(profile, [work(DAY, 6.5)], 0)).toMatchObject([{ kind: 'break', required: 30 }]);
    expect(dayWarnings(profile, [work(DAY, 6.5, 'bob', 8, 30)], 0)).toEqual([]);
    expect(dayWarnings(profile, [work(DAY, 9.5, 'bob', 8, 30)], 0)).toMatchObject([{ kind: 'break', required: 45 }]);
  });

  it('counts gaps between sessions as breaks', () => {
    const sessions = [work(DAY, 4, 'bob', 8), work(DAY, 3, 'app', 12.5)];
    expect(dayWarnings(profile, sessions, 0)).toEqual([]);
  });

  it('ignores non-counting areas and can be disabled', () => {
    expect(dayWarnings(profile, [work(DAY, 12, 'thesis')], 0)).toEqual([]);
    const off = testProfile({ warnings: { ...profile.warnings, enabled: false } });
    expect(dayWarnings(off, [work(DAY, 12)], 0)).toEqual([]);
  });

  it('flags unusually long running sessions', () => {
    const s = { ...work(DAY, 1), end: null };
    expect(isUnusuallyLong(profile, s, s.start + 7 * 3_600_000)).toBe(true);
    expect(isUnusuallyLong(profile, s, s.start + 2 * 3_600_000)).toBe(false);
  });
});
