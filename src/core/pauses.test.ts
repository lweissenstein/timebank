import { describe, expect, it } from 'vitest';
import { MS_PER_MINUTE } from './dates';
import { work } from './testUtils';
import { pausesOfDay } from './worktime';

describe('pauses of a day', () => {
  it('lists pauses recorded with the pause button, not gaps between sessions', () => {
    const a = work('2026-11-09', 3, 'bob', 9, 30); // 09:00–12:30 with 30 min pause
    const recorded = { ...a, pauses: [{ start: a.start + 60 * MS_PER_MINUTE, end: a.start + 90 * MS_PER_MINUTE }] };
    const b = work('2026-11-09', 2, 'app', 13); // 30 min gap before: not a pause
    const items = pausesOfDay([b, recorded], 0);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ minutes: 30, start: recorded.pauses[0].start });
  });

  it('shows a total without times for older sessions', () => {
    const s = work('2026-11-09', 4, 'bob', 9, 45);
    const [p] = pausesOfDay([s], 0);
    expect(p).toMatchObject({ start: null, minutes: 45 });
  });

  it('includes a running pause', () => {
    const running = { ...work('2026-11-09', 1, 'bob', 20), end: null, pausedAt: Date.UTC(2026, 10, 9, 20) };
    const [p] = pausesOfDay([running], running.pausedAt + 10 * MS_PER_MINUTE);
    expect(p).toMatchObject({ running: true, minutes: 10 });
  });
});
