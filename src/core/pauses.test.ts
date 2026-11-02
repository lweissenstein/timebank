import { describe, expect, it } from 'vitest';
import { MS_PER_MINUTE } from './dates';
import { work } from './testUtils';
import type { Session } from './types';
import { pausesOfDay } from './worktime';

const isWork = (s: Session) => s.areaId !== 'thesis';

describe('pauses of a day', () => {
  it('lists pause-button breaks and gaps between work sessions', () => {
    const a = work('2026-11-09', 3, 'bob', 9, 30); // 09:00–12:30 with 30 min pause
    const recorded = { ...a, pauses: [{ start: a.start + 60 * MS_PER_MINUTE, end: a.start + 90 * MS_PER_MINUTE }] };
    const b = work('2026-11-09', 2, 'app', 13.5); // 60 min gap before (lunch)
    const items = pausesOfDay([b, recorded], isWork, 0);
    expect(items.map((p) => [p.kind, p.minutes, p.confirmed ?? null])).toEqual([
      ['button', 30, null],
      ['gap', 60, false],
    ]);
    expect(items[1].sessionId).toBe(b.id);
  });

  it('respects confirmation and "no break"', () => {
    const a = work('2026-11-09', 3, 'bob', 9);
    const b = work('2026-11-09', 2, 'app', 13);
    expect(pausesOfDay([a, { ...b, gapBefore: 'pause' }], isWork, 0)[0].confirmed).toBe(true);
    expect(pausesOfDay([a, { ...b, gapBefore: 'off' }], isWork, 0)).toEqual([]);
  });

  it('ignores gaps under 2 minutes and next to non-work sessions', () => {
    const a = work('2026-11-09', 1, 'bob', 9);
    const b = work('2026-11-09', 1, 'app', 10 + 1 / 60);
    const thesis = work('2026-11-09', 1, 'thesis', 18);
    expect(pausesOfDay([a, b, thesis], isWork, 0)).toEqual([]);
  });

  it('shows a total without times for older sessions and a running pause', () => {
    const s = work('2026-11-09', 4, 'bob', 9, 45);
    expect(pausesOfDay([s], isWork, 0)[0]).toMatchObject({ start: null, minutes: 45 });
    const running = { ...work('2026-11-09', 1, 'bob', 20), end: null, pausedAt: Date.UTC(2026, 10, 9, 20) };
    expect(pausesOfDay([running], isWork, running.pausedAt + 10 * MS_PER_MINUTE)[0]).toMatchObject({ running: true, minutes: 10 });
  });
});
