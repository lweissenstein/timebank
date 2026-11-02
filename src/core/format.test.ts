import { describe, expect, it } from 'vitest';
import { formatHours, formatSignedHours } from './format';

describe('duration formatting', () => {
  it('uses hours and minutes', () => {
    expect(formatHours(7 + 20 / 60)).toBe('7 h 20 min');
    expect(formatHours(7)).toBe('7 h');
    expect(formatHours(0.75)).toBe('45 min');
    expect(formatHours(0)).toBe('0 h');
    expect(formatHours(1.9999)).toBe('2 h');
  });

  it('adds a sign', () => {
    expect(formatSignedHours(2.5)).toBe('+2 h 30 min');
    expect(formatSignedHours(-0.25)).toBe('−15 min');
    expect(formatSignedHours(0.001)).toBe('±0 h');
  });

  it('has a compact form', () => {
    expect(formatHours(7 + 5 / 60, { compact: true })).toBe('7h05');
    expect(formatHours(4, { compact: true })).toBe('4h');
    expect(formatHours(0.5, { compact: true })).toBe('30m');
  });
});
