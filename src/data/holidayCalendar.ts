import Holidays from 'date-holidays';
import { buildHolidayMap, type HolidayEntry } from '../core/holidays';
import { yearOf } from '../core/dates';
import type { HolidayMap, Profile } from '../core/types';

/** Public holidays from the built-in calendar (date-holidays) for the given years. */
export function calendarHolidays(
  country: string,
  region: string | undefined,
  years: number[],
  language?: string,
): HolidayEntry[] {
  if (!country) return [];
  const hd = region ? new Holidays(country, region) : new Holidays(country);
  if (language) hd.setLanguages(language);
  const entries: HolidayEntry[] = [];
  for (const year of years) {
    for (const h of hd.getHolidays(year) || []) {
      if (h.type === 'public') entries.push({ date: h.date.slice(0, 10), name: h.name });
    }
  }
  return entries;
}

/** All credited holidays for the profile's tracking period. */
export function holidaysForProfile(profile: Profile, language?: string): HolidayMap {
  const years: number[] = [];
  for (let y = yearOf(profile.period.start); y <= yearOf(profile.period.end); y++) years.push(y);
  const { country, region, extra, excluded } = profile.holidays;
  return buildHolidayMap(calendarHolidays(country, region, years, language), { extra, excluded });
}

export function listCountries(language = 'en'): { code: string; name: string }[] {
  const all = new Holidays().getCountries(language) ?? {};
  return Object.entries(all)
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function listRegions(country: string, language = 'en'): { code: string; name: string }[] {
  if (!country) return [];
  const all = new Holidays().getStates(country, language) ?? {};
  return Object.entries(all)
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
