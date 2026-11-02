import { describe, expect, it } from 'vitest';
import { MS_PER_MINUTE } from './dates';
import { work } from './testUtils';
import type { Session } from './types';
import { pausesOfDay } from './worktime';

const isWork = (s: Session) => s.areaId !== 'thesis';

describe('pauses of a day', () => {
  it('lists recorded pause intervals and gaps between work sessions', () => {
    const a = work('2026-11-09', 3, 'bob', 9, 30); // 09:00–12:30 with 30 min pause
    const recorded = { ...a, pauses: [{ start: a.start + 60 * MS_PER_MINUTE, end: a.start + 90 * MS_PER_MINUTE }] };
    const b = work('2026-11-09', 2, 'app', 13); // starts 13:00 → 30 min gap
    const items = pausesOfDay([b, recorded], isWork, 0);
    expect(items.map((p) => [p.minutes, p.sessionId ?? 'gap'])).toEqual([
      [30, recorded.id],
      [30, 'gap'],
    ]);
    expect(items[0].start).toBe(recorded.pauses[0].start);
  });

  it('shows a total without times for older sessions', () => {
    const s = work('2026-11-09', 4, 'bob', 9, 45);
    const [p] = pausesOfDay([s], isWork, 0);
    expect(p).toMatchObject({ start: null, minutes: 45, sessionId: s.id });
  });

  it('ignores gaps next to non-work sessions and includes a running pause', () => {
    const w = work('2026-11-09', 2, 'bob', 9);
    const thesis = work('2026-11-09', 1, 'thesis', 18);
    const running = { ...work('2026-11-09', 1, 'bob', 20), end: null, pausedAt: Date.UTC(2026, 10, 9, 20) };
    const now = running.pausedAt + 10 * MS_PER_MINUTE;
    const items = pausesOfDay([w, thesis, running], isWork, now);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ running: true, minutes: 10 });
  });
});
