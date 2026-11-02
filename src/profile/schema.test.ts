import { describe, expect, it } from 'vitest';
import example from '../../profiles/example.json';
import { parseProfile, parseProfileJson } from './schema';

describe('profile schema', () => {
  it('accepts the example profile and fills defaults', () => {
    const r = parseProfile(example);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.profile.areas[0].categories[0].hidden).toBe(false);
      expect(r.profile.areas[2].countsAsWork).toBe(false);
    }
  });

  it('accepts a minimal profile', () => {
    const r = parseProfile({
      period: { start: '2027-01-01', end: '2027-12-31' },
      contract: { weeklyHours: 40 },
      areas: [{ id: 'work', name: 'Work' }],
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.profile.contract.workdays).toEqual([1, 2, 3, 4, 5]);
  });

  it('reports readable errors', () => {
    const r = parseProfile({ period: { start: '2027-02-01', end: '2027-01-01' }, contract: { weeklyHours: 20 }, areas: [{ id: 'a', name: 'A' }, { id: 'a', name: 'B' }] });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.join('\n')).toContain('period.end');
      expect(r.errors.join('\n')).toContain('Duplicate area id');
    }
  });

  it('rejects invalid JSON', () => {
    expect(parseProfileJson('{').ok).toBe(false);
  });
});
