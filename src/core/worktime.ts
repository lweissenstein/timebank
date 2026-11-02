import { addDays, dayStartMs, MS_PER_MINUTE, overlapMs, toISODate, type ISODate } from './dates';
import type { Session } from './types';

/** Break time of a session in ms, including a currently running pause. */
export function sessionBreakMs(s: Session, now: number): number {
  const running = s.end === null && s.pausedAt !== null ? Math.max(0, now - s.pausedAt) : 0;
  return s.breakMinutes * MS_PER_MINUTE + running;
}

/** Gross span (start to end/now) of a session in ms. */
export function sessionSpanMs(s: Session, now: number): number {
  return Math.max(0, (s.end ?? now) - s.start);
}

/** Net working time of a session in ms. */
export function sessionWorkMs(s: Session, now: number): number {
  return Math.max(0, sessionSpanMs(s, now) - sessionBreakMs(s, now));
}

/**
 * Splits a session's net working time across calendar days. Sessions crossing
 * midnight are divided proportionally to their gross time on each day.
 */
export function splitSessionByDay(s: Session, now: number): { date: ISODate; ms: number }[] {
  const end = s.end ?? now;
  const span = end - s.start;
  if (span <= 0) return [];
  const net = sessionWorkMs(s, now);
  const parts: { date: ISODate; ms: number }[] = [];
  for (let day = toISODate(new Date(s.start)); dayStartMs(day) < end; day = addDays(day, 1)) {
    const gross = overlapMs(s.start, end, dayStartMs(day), dayStartMs(addDays(day, 1)));
    if (gross > 0) parts.push({ date: day, ms: (net * gross) / span });
  }
  return parts;
}

/** Adds the net working time of each session to a per-day map (ms). */
export function workByDay(sessions: Session[], now: number): Map<ISODate, number> {
  const map = new Map<ISODate, number>();
  for (const s of sessions) {
    for (const { date, ms } of splitSessionByDay(s, now)) {
      map.set(date, (map.get(date) ?? 0) + ms);
    }
  }
  return map;
}

/**
 * Total break of a set of sessions on one day in minutes: recorded pauses plus
 * gaps between consecutive sessions.
 */
export function breakMinutesOf(sessions: Session[], now: number): number {
  const sorted = [...sessions].sort((a, b) => a.start - b.start);
  let ms = 0;
  let lastEnd: number | null = null;
  for (const s of sorted) {
    ms += sessionBreakMs(s, now);
    if (lastEnd !== null && s.start > lastEnd) ms += s.start - lastEnd;
    lastEnd = Math.max(lastEnd ?? 0, s.end ?? now);
  }
  return ms / MS_PER_MINUTE;
}

/** Gaps shorter than this between two sessions are treated as continuous work. */
export const CONTINUITY_MS = 2 * 60_000;

export interface PauseItem {
  /** Start/end in epoch ms; null if only the total is known. */
  start: number | null;
  end: number | null;
  minutes: number;
  /** "button": recorded with pause/resume; "gap": time between two work sessions. */
  kind: 'button' | 'gap';
  /** Button pause: the session it belongs to. Gap: the session after the gap. */
  sessionId?: string;
  /** Gap only: confirmed by the user (otherwise detected automatically). */
  confirmed?: boolean;
  /** The pause is still running. */
  running?: boolean;
  /** Time used for ordering in a timeline. */
  at: number;
}

/**
 * Breaks of one day:
 *  - pauses recorded with the pause button (with times), plus the total of
 *    older or manually edited breaks without times,
 *  - gaps of at least 2 minutes between two consecutive work sessions. They
 *    count as an automatic break until the user confirms them or marks them
 *    as "no break" (`gapBefore = 'off'` on the following session).
 */
export function pausesOfDay(sessions: Session[], isWork: (s: Session) => boolean, now: number): PauseItem[] {
  const items: PauseItem[] = [];
  const sorted = sessions.filter((s) => !s.deleted).sort((a, b) => a.start - b.start);
  for (const s of sorted) {
    let recorded = 0;
    for (const p of s.pauses ?? []) {
      const minutes = (p.end - p.start) / MS_PER_MINUTE;
      recorded += minutes;
      items.push({ kind: 'button', start: p.start, end: p.end, minutes, sessionId: s.id, at: p.start });
    }
    const rest = s.breakMinutes - recorded;
    if (rest >= 0.5) {
      items.push({ kind: 'button', start: null, end: null, minutes: rest, sessionId: s.id, at: s.end ?? now });
    }
    if (s.end === null && s.pausedAt !== null) {
      items.push({ kind: 'button', start: s.pausedAt, end: null, minutes: (now - s.pausedAt) / MS_PER_MINUTE, sessionId: s.id, running: true, at: s.pausedAt });
    }
  }
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1];
    const b = sorted[i];
    const aEnd = a.end ?? now;
    if (!isWork(a) || !isWork(b) || b.gapBefore === 'off' || b.start - aEnd < CONTINUITY_MS) continue;
    items.push({
      kind: 'gap',
      start: aEnd,
      end: b.start,
      minutes: (b.start - aEnd) / MS_PER_MINUTE,
      sessionId: b.id,
      confirmed: b.gapBefore === 'pause',
      at: aEnd,
    });
  }
  return items.sort((x, y) => x.at - y.at);
}
