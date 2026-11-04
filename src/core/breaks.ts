import { MS_PER_MINUTE } from './dates';
import type { Session } from './types';

/**
 * Breaks are modelled as the gap between two sessions: pausing ends the
 * current session, resuming starts a new one with the same settings.
 * These helpers convert breaks recorded inside a session into that form.
 */

/** Settings that a resumed session inherits from the paused one. */
export function continuation(from: Session, id: string, start: number, now: number): Session {
  return {
    id,
    areaId: from.areaId,
    categoryId: from.categoryId,
    start,
    end: null,
    breakMinutes: 0,
    pausedAt: null,
    note: from.note,
    thesisRelevant: from.thesisRelevant,
    ...(from.locationId ? { locationId: from.locationId } : {}),
    gapBefore: 'pause',
    updatedAt: now,
  };
}

/**
 * Splits a session at a break [from, to]. The first part keeps the id, the
 * second part gets `newId`. An untimed break total (breakMinutes without
 * recorded times) is reduced by the inserted break.
 */
export function splitAtBreak(s: Session, from: number, to: number, newId: string, now: number): [Session, Session] {
  const end = s.end ?? now;
  if (!(from > s.start && to > from && to < end)) throw new Error('Break must lie inside the session');
  const untimed = Math.max(0, s.breakMinutes - recordedMinutes(s));
  const remaining = Math.max(0, untimed - (to - from) / MS_PER_MINUTE);
  const first: Session = { ...s, end: from, pausedAt: null, pauses: undefined, breakMinutes: remaining, onBreak: false, updatedAt: now };
  const second: Session = {
    ...continuation(s, newId, to, now),
    end: s.end,
    pausedAt: s.end === null ? s.pausedAt : null,
    breakMinutes: 0,
  };
  return [first, second];
}

function recordedMinutes(s: Session): number {
  return (s.pauses ?? []).reduce((sum, p) => sum + (p.end - p.start) / MS_PER_MINUTE, 0);
}

/**
 * Converts pauses recorded inside a session (`pauses` intervals and a running
 * `pausedAt`) into separate sessions. Ids of new parts are derived from the
 * original id, so two devices converting the same data produce the same result.
 * Returns null if nothing needs to change.
 */
export function normalizeBreaks(s: Session, now: number): Session[] | null {
  if (s.deleted) return null;
  const intervals = [...(s.pauses ?? [])].sort((a, b) => a.start - b.start);
  const runningPause = s.end === null && s.pausedAt !== null ? s.pausedAt : null;
  if (intervals.length === 0 && runningPause === null) return null;

  const untimed = Math.max(0, s.breakMinutes - recordedMinutes(s));
  const parts: Session[] = [];
  let segmentStart = s.start;
  let i = 0;
  for (const p of intervals) {
    const id = i === 0 ? s.id : `${s.id}-${i}`;
    const base = i === 0 ? { ...s, gapBefore: s.gapBefore } : continuation(s, id, segmentStart, now);
    parts.push({ ...base, id, start: segmentStart, end: p.start, pauses: undefined, pausedAt: null, breakMinutes: i === 0 ? untimed : 0, onBreak: false, updatedAt: now });
    segmentStart = p.end;
    i++;
  }
  const id = i === 0 ? s.id : `${s.id}-${i}`;
  const base = i === 0 ? s : continuation(s, id, segmentStart, now);
  if (runningPause !== null) {
    // A pause still running: end the last part there and mark it as on break.
    parts.push({ ...base, id, start: segmentStart, end: runningPause, pauses: undefined, pausedAt: null, breakMinutes: i === 0 ? untimed : 0, onBreak: true, updatedAt: now });
  } else {
    parts.push({ ...base, id, start: segmentStart, end: s.end, pauses: undefined, pausedAt: null, breakMinutes: i === 0 ? untimed : 0, updatedAt: now });
  }
  return parts;
}
