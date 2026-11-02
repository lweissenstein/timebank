import { MS_PER_HOUR, type ISODate } from './dates';
import type { Area, Session } from './types';
import { splitSessionByDay } from './worktime';

export interface CategoryHours {
  categoryId: string;
  hours: number;
}

export interface AreaHours {
  areaId: string;
  hours: number;
  categories: CategoryHours[];
}

export interface Breakdown {
  /** Hours in areas that count as work. */
  workHours: number;
  /** Hours in all areas, including non-counting ones (e.g. thesis). */
  allHours: number;
  areas: AreaHours[];
}

/** Hours per area and category for an inclusive date range. */
export function breakdown(
  areas: Area[],
  sessions: Session[],
  from: ISODate,
  to: ISODate,
  now: number,
): Breakdown {
  const byArea = new Map<string, Map<string, number>>();
  for (const s of sessions) {
    if (s.deleted) continue;
    for (const part of splitSessionByDay(s, now)) {
      if (part.date < from || part.date > to) continue;
      const cats = byArea.get(s.areaId) ?? new Map<string, number>();
      cats.set(s.categoryId, (cats.get(s.categoryId) ?? 0) + part.ms);
      byArea.set(s.areaId, cats);
    }
  }
  const counting = new Set(areas.filter((a) => a.countsAsWork).map((a) => a.id));
  const order = new Map(areas.map((a, i) => [a.id, i]));
  let workHours = 0;
  let allHours = 0;
  const result: AreaHours[] = [];
  for (const [areaId, cats] of byArea) {
    const categories = [...cats]
      .map(([categoryId, ms]) => ({ categoryId, hours: ms / MS_PER_HOUR }))
      .sort((a, b) => b.hours - a.hours);
    const hours = categories.reduce((s, c) => s + c.hours, 0);
    allHours += hours;
    if (counting.has(areaId)) workHours += hours;
    result.push({ areaId, hours, categories });
  }
  result.sort((a, b) => (order.get(a.areaId) ?? 99) - (order.get(b.areaId) ?? 99));
  return { workHours, allHours, areas: result };
}

export interface LocationHours {
  /** Location id, or '' for sessions without a location. */
  locationId: string;
  hours: number;
  /** Days with at least one counted session at this location. */
  days: number;
}

/** Working hours (counting areas only) and days per work location in a date range. */
export function locationBreakdown(
  areas: Area[],
  sessions: Session[],
  from: ISODate,
  to: ISODate,
  now: number,
): LocationHours[] {
  const counting = new Set(areas.filter((a) => a.countsAsWork).map((a) => a.id));
  const hours = new Map<string, number>();
  const days = new Map<string, Set<ISODate>>();
  for (const s of sessions) {
    if (s.deleted || !counting.has(s.areaId)) continue;
    const loc = s.locationId ?? '';
    for (const part of splitSessionByDay(s, now)) {
      if (part.date < from || part.date > to) continue;
      hours.set(loc, (hours.get(loc) ?? 0) + part.ms / MS_PER_HOUR);
      days.set(loc, (days.get(loc) ?? new Set()).add(part.date));
    }
  }
  return [...hours].map(([locationId, h]) => ({ locationId, hours: h, days: days.get(locationId)?.size ?? 0 }));
}
