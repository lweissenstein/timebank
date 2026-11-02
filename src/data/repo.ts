import { MS_PER_MINUTE, type ISODate } from '../core/dates';
import { isSnapshot, mergeSnapshots, type Snapshot } from '../core/merge';
import { applyMigration, type Migration } from '../core/migrate';
import { CONTINUITY_MS } from '../core/worktime';
import type { Absence, AbsenceType, Profile, Session } from '../core/types';
import { db, newId, type TimebankDB } from './db';

const PROFILE_KEY = 'profile';
export { CONTINUITY_MS };

/** Data access for the app. Every write bumps `updatedAt` so changes can be synced. */
export class Repository {
  constructor(private readonly store: TimebankDB = db) {}

  // ---------- profile ----------

  async getProfile(): Promise<{ value: Profile; updatedAt: number } | null> {
    const kv = await this.store.kv.get(PROFILE_KEY);
    return kv ? { value: kv.value as Profile, updatedAt: kv.updatedAt } : null;
  }

  async saveProfile(profile: Profile): Promise<void> {
    await this.store.kv.put({ key: PROFILE_KEY, value: profile, updatedAt: Date.now() });
  }

  // ---------- sessions ----------

  async running(): Promise<Session | undefined> {
    return (await this.store.sessions.toArray()).find((s) => s.end === null && !s.deleted);
  }

  /**
   * Starts tracking in an area/category. A running session is stopped first,
   * so switching is a single action. Returns the session that was stopped.
   */
  async start(areaId: string, categoryId: string, now = Date.now(), locationId?: string): Promise<Session | undefined> {
    return this.store.transaction('rw', this.store.sessions, async () => {
      const stopped = await this.stopInternal(now);
      // A stop followed by a start within a short time is a correction, not a break:
      // the new session starts exactly where the last one ended.
      const lastEnd = stopped?.end ?? (await this.lastEnd());
      const start = lastEnd !== null && now - lastEnd >= 0 && now - lastEnd < CONTINUITY_MS ? lastEnd : now;
      await this.store.sessions.add({
        id: newId(),
        areaId,
        categoryId,
        start,
        end: null,
        breakMinutes: 0,
        pausedAt: null,
        note: '',
        thesisRelevant: false,
        ...(locationId ? { locationId } : {}),
        updatedAt: now,
      });
      return stopped;
    });
  }

  /** End time of the most recently finished session. */
  private async lastEnd(): Promise<number | null> {
    let latest: number | null = null;
    await this.store.sessions.each((s) => {
      if (!s.deleted && s.end !== null && (latest === null || s.end > latest)) latest = s.end;
    });
    return latest;
  }

  async stop(now = Date.now()): Promise<Session | undefined> {
    return this.store.transaction('rw', this.store.sessions, () => this.stopInternal(now));
  }

  private async stopInternal(now: number): Promise<Session | undefined> {
    const s = await this.running();
    if (!s) return undefined;
    const stopped: Session = { ...closePause(s, now), end: now, updatedAt: now };
    await this.store.sessions.put(stopped);
    return stopped;
  }

  async togglePause(now = Date.now()): Promise<void> {
    const s = await this.running();
    if (!s) return;
    const next = s.pausedAt === null ? { ...s, pausedAt: now } : closePause(s, now);
    await this.store.sessions.put({ ...next, updatedAt: now });
  }

  /** Changes the work location of the running session. */
  async setRunningLocation(locationId: string | undefined): Promise<void> {
    const s = await this.running();
    if (s) await this.store.sessions.put({ ...s, locationId, updatedAt: Date.now() });
  }

  /**
   * Applies a category migration to all local data. Returns the snapshot taken
   * before (for the backup) and after, plus the migration report.
   */
  async migrate(migration: Migration, now = Date.now()) {
    const before = await this.snapshot();
    const { snapshot: after, report } = applyMigration(before, migration, now);
    await this.restore(after);
    return { before, after, report };
  }

  /** Confirms the gap before a session as break, marks it as no break, or resets it. */
  async setGapBefore(sessionId: string, value: 'pause' | 'off' | undefined): Promise<void> {
    const s = await this.store.sessions.get(sessionId);
    if (s) await this.store.sessions.put({ ...s, gapBefore: value, updatedAt: Date.now() });
  }

  async getSession(id: string): Promise<Session | undefined> {
    return this.store.sessions.get(id);
  }

  async saveSession(session: Session): Promise<void> {
    await this.store.sessions.put({ ...session, updatedAt: Date.now() });
  }

  async addManualSession(data: Omit<Session, 'id' | 'updatedAt' | 'pausedAt'>): Promise<void> {
    await this.store.sessions.add({ ...data, id: newId(), pausedAt: null, updatedAt: Date.now() });
  }

  async deleteSession(id: string): Promise<void> {
    const s = await this.store.sessions.get(id);
    if (s) await this.store.sessions.put({ ...s, deleted: true, updatedAt: Date.now() });
  }

  // ---------- absences ----------

  /** Sets (or with `type = null` removes) the absence on a day. */
  async setAbsence(date: ISODate, type: AbsenceType | null, hours: number | null = null): Promise<void> {
    const now = Date.now();
    await this.store.transaction('rw', this.store.absences, async () => {
      const existing = (await this.store.absences.where('date').equals(date).toArray()).filter((a) => !a.deleted);
      for (const a of existing) await this.store.absences.put({ ...a, deleted: true, updatedAt: now });
      if (type) {
        const a: Absence = { id: newId(), date, type, hours, note: '', updatedAt: now };
        await this.store.absences.add(a);
      }
    });
  }

  // ---------- backup & sync ----------

  async snapshot(): Promise<Snapshot> {
    return {
      format: 'timebank',
      version: 1,
      exportedAt: Date.now(),
      profile: await this.getProfile(),
      sessions: await this.store.sessions.toArray(),
      absences: await this.store.absences.toArray(),
    };
  }

  /** Writes a snapshot into the local database (replacing everything). */
  async restore(snapshot: Snapshot): Promise<void> {
    await this.store.transaction('rw', this.store.sessions, this.store.absences, this.store.kv, async () => {
      await this.store.sessions.clear();
      await this.store.absences.clear();
      await this.store.sessions.bulkPut(snapshot.sessions);
      await this.store.absences.bulkPut(snapshot.absences);
      if (snapshot.profile) {
        await this.store.kv.put({ key: PROFILE_KEY, ...snapshot.profile });
      }
    });
  }

  /** Imports a backup. "merge" keeps newer local changes, "replace" overwrites. */
  async importBackup(data: unknown, mode: 'merge' | 'replace'): Promise<void> {
    if (!isSnapshot(data)) throw new Error('Not a Timebank backup file');
    const next = mode === 'merge' ? mergeSnapshots(await this.snapshot(), data) : data;
    await this.restore(next);
  }

  async clearAll(): Promise<void> {
    await Promise.all([this.store.sessions.clear(), this.store.absences.clear(), this.store.kv.clear()]);
  }
}

function closePause(s: Session, now: number): Session {
  if (s.pausedAt === null) return s;
  return {
    ...s,
    breakMinutes: s.breakMinutes + Math.max(0, now - s.pausedAt) / MS_PER_MINUTE,
    pauses: [...(s.pauses ?? []), { start: s.pausedAt, end: now }],
    pausedAt: null,
  };
}

export const repo = new Repository();
