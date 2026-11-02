import { useLiveQuery } from 'dexie-react-hooks';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { today as todayOf, type ISODate } from '../core/dates';
import { Ledger } from '../core/ledger';
import type { Absence, HolidayMap, Profile, Session } from '../core/types';
import { db } from '../data/db';
import { holidaysForProfile } from '../data/holidayCalendar';
import { repo } from '../data/repo';
import { useI18n } from '../i18n';

export interface AppData {
  profile: Profile;
  sessions: Session[];
  absences: Absence[];
  holidays: HolidayMap;
  ledger: Ledger;
  running: Session | undefined;
  /** Refreshed every 30 seconds. */
  now: number;
  today: ISODate;
}

const Ctx = createContext<AppData | null>(null);

/** Re-renders periodically and returns the current time. */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    const onVisible = () => setNow(Date.now());
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [intervalMs]);
  return now;
}

/** Loads the stored profile: undefined while loading, null if none exists. */
export function useStoredProfile() {
  return useLiveQuery(() => repo.getProfile(), [], undefined);
}

export function AppDataProvider({ profile, children }: { profile: Profile; children: ReactNode }) {
  const { lang } = useI18n();
  const allSessions = useLiveQuery(() => db.sessions.toArray(), [], [] as Session[]);
  const allAbsences = useLiveQuery(() => db.absences.toArray(), [], [] as Absence[]);
  const now = useNow(30_000);

  const sessions = useMemo(() => allSessions.filter((s) => !s.deleted), [allSessions]);
  const absences = useMemo(() => allAbsences.filter((a) => !a.deleted), [allAbsences]);
  const holidays = useMemo(() => holidaysForProfile(profile, lang), [profile, lang]);
  const ledger = useMemo(
    () => new Ledger({ profile, holidays, sessions, absences, now }),
    [profile, holidays, sessions, absences, now],
  );

  const value = useMemo<AppData>(
    () => ({
      profile,
      sessions,
      absences,
      holidays,
      ledger,
      running: sessions.find((s) => s.end === null),
      now,
      today: todayOf(new Date(now)),
    }),
    [profile, sessions, absences, holidays, ledger, now],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppData(): AppData {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAppData outside of AppDataProvider');
  return ctx;
}
