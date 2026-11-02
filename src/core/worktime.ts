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
