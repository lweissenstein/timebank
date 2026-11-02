import { MS_PER_HOUR, MS_PER_MINUTE, type ISODate } from './dates';
import type { Profile, Session } from './types';
import { sessionWorkMs, splitSessionByDay } from './worktime';

export type DayWarning =
  | { kind: 'maxDaily'; date: ISODate; workedHours: number; limit: number }
  | { kind: 'break'; date: ISODate; workedHours: number; breakMinutes: number; required: number };

/**
 * Daily checks for sessions in counting areas:
 *  - more than `maxDailyHours` of work
 *  - too little break (session breaks + gaps between sessions) for the worked time
 */
export function dayWarnings(profile: Profile, sessions: Session[], now: number): DayWarning[] {
  if (!profile.warnings.enabled) return [];
  const counting = new Set(profile.areas.filter((a) => a.countsAsWork).map((a) => a.id));
  const byDay = new Map<ISODate, { work: number; first: number; last: number }>();
  for (const s of sessions) {
    if (s.deleted || !counting.has(s.areaId)) continue;
    for (const part of splitSessionByDay(s, now)) {
      const entry = byDay.get(part.date) ?? { work: 0, first: Infinity, last: -Infinity };
      entry.work += part.ms;
      entry.first = Math.min(entry.first, s.start);
      entry.last = Math.max(entry.last, s.end ?? now);
      byDay.set(part.date, entry);
    }
  }
  const rules = [...profile.warnings.breakRules].sort((a, b) => b.afterHours - a.afterHours);
  const warnings: DayWarning[] = [];
  for (const [date, { work, first, last }] of [...byDay].sort(([a], [b]) => a.localeCompare(b))) {
    const workedHours = work / MS_PER_HOUR;
    if (workedHours > profile.warnings.maxDailyHours) {
      warnings.push({ kind: 'maxDaily', date, workedHours, limit: profile.warnings.maxDailyHours });
    }
    const rule = rules.find((r) => workedHours > r.afterHours);
    if (rule) {
      const breakMinutes = Math.max(0, (last - first - work) / MS_PER_MINUTE);
      if (breakMinutes + 0.5 < rule.minBreakMinutes) {
        warnings.push({ kind: 'break', date, workedHours, breakMinutes, required: rule.minBreakMinutes });
      }
    }
  }
  return warnings;
}

/** True when a running session exceeds the configured "unusually long" threshold. */
export function isUnusuallyLong(profile: Profile, s: Session, now: number): boolean {
  return s.end === null && sessionWorkMs(s, now) > profile.warnings.longSessionHours * MS_PER_HOUR;
}
