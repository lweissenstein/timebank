import type { ISODate } from './dates';
import type { HolidayMap, Profile } from './types';

export interface HolidayEntry {
  date: ISODate;
  name: string;
}

/**
 * Combines holidays from a calendar source with the profile's manual
 * additions and exclusions.
 */
export function buildHolidayMap(
  fromCalendar: HolidayEntry[],
  config: Pick<Profile['holidays'], 'extra' | 'excluded'>,
): HolidayMap {
  const map: HolidayMap = new Map();
  for (const h of fromCalendar) if (!map.has(h.date)) map.set(h.date, h.name);
  for (const h of config.extra) map.set(h.date, h.name);
  for (const d of config.excluded) map.delete(d);
  return map;
}
