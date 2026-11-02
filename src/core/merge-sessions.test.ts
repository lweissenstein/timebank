import { describe, expect, it } from 'vitest';
import { mergeSessions } from './merge';
import { work } from './testUtils';

describe('session merge', () => {
  const base = { ...work('2026-11-09', 2, 'bob', 9), end: null, updatedAt: 100 };
  const stoppedOnPc = { ...base, end: base.start + 3 * 3_600_000, breakMinutes: 15, updatedAt: 200 };

  it('a stop wins over a running copy that was edited later', () => {
    const runningOnPhone = { ...base, note: 'edited on phone', updatedAt: 300 };
    const [merged] = mergeSessions([runningOnPhone], [stoppedOnPc]);
    expect(merged.end).toBe(stoppedOnPc.end);
    expect(merged.breakMinutes).toBe(15);
    expect(merged.note).toBe('edited on phone');
    expect(merged.updatedAt).toBe(301);
  });

  it('is symmetric', () => {
    const runningOnPhone = { ...base, note: 'edited on phone', updatedAt: 300 };
    expect(mergeSessions([stoppedOnPc], [runningOnPhone])).toEqual(mergeSessions([runningOnPhone], [stoppedOnPc]));
  });

  it('otherwise the newest version wins', () => {
    const older = { ...stoppedOnPc, note: 'a', updatedAt: 200 };
    const newer = { ...stoppedOnPc, note: 'b', updatedAt: 250 };
    expect(mergeSessions([older], [newer])[0].note).toBe('b');
    expect(mergeSessions([stoppedOnPc], [base])[0]).toBe(stoppedOnPc);
  });
});
