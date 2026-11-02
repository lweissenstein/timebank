import type { Absence, Profile, Session } from './types';

export interface Versioned {
  id: string;
  updatedAt: number;
  deleted?: boolean;
}

/** Portable snapshot of all user data, used for backups and sync. */
export interface Snapshot {
  format: 'timebank';
  version: 1;
  exportedAt: number;
  profile: { value: Profile; updatedAt: number } | null;
  sessions: Session[];
  absences: Absence[];
}

/**
 * Merges two record lists by id; the record with the newer `updatedAt` wins.
 * Deletions are kept as tombstones (`deleted: true`) so they propagate.
 */
export function mergeById<T extends Versioned>(a: T[], b: T[]): T[] {
  const map = new Map<string, T>();
  for (const r of a) map.set(r.id, r);
  for (const r of b) {
    const existing = map.get(r.id);
    if (!existing || r.updatedAt > existing.updatedAt) map.set(r.id, r);
  }
  return [...map.values()];
}

/**
 * Sessions merge like other records (newest wins), with one exception:
 * a stop always wins. If one device stopped a session while the other still
 * has it running (and changed e.g. its note later), the result keeps the newer
 * fields but takes the end and breaks from the stopped version.
 */
export function mergeSessions(a: Session[], b: Session[]): Session[] {
  const map = new Map<string, Session>();
  for (const r of a) map.set(r.id, r);
  for (const r of b) {
    const existing = map.get(r.id);
    if (!existing) {
      map.set(r.id, r);
      continue;
    }
    const newer = r.updatedAt > existing.updatedAt ? r : existing;
    const older = newer === r ? existing : r;
    if (newer.end === null && older.end !== null && !newer.deleted) {
      map.set(r.id, {
        ...newer,
        end: older.end,
        pausedAt: null,
        breakMinutes: older.breakMinutes,
        pauses: older.pauses,
        updatedAt: newer.updatedAt + 1,
      });
    } else {
      map.set(r.id, newer);
    }
  }
  return [...map.values()];
}

export function mergeSnapshots(local: Snapshot, remote: Snapshot | null): Snapshot {
  if (!remote) return local;
  let profile = local.profile;
  if (remote.profile && (!profile || remote.profile.updatedAt > profile.updatedAt)) {
    profile = remote.profile;
  }
  return {
    format: 'timebank',
    version: 1,
    exportedAt: Date.now(),
    profile,
    sessions: mergeSessions(local.sessions, remote.sessions),
    absences: mergeById(local.absences, remote.absences),
  };
}

/** True if both snapshots contain the same records in the same versions. */
export function sameContent(a: Snapshot, b: Snapshot | null): boolean {
  if (!b) return false;
  const key = (list: Versioned[]) =>
    list
      .map((r) => `${r.id}:${r.updatedAt}:${r.deleted ? 1 : 0}`)
      .sort()
      .join('|');
  return (
    (a.profile?.updatedAt ?? 0) === (b.profile?.updatedAt ?? 0) &&
    key(a.sessions) === key(b.sessions) &&
    key(a.absences) === key(b.absences)
  );
}

export function isSnapshot(data: unknown): data is Snapshot {
  const d = data as Snapshot;
  return !!d && d.format === 'timebank' && Array.isArray(d.sessions) && Array.isArray(d.absences);
}
