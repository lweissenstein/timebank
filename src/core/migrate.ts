import type { ISODate } from './dates';
import { Ledger } from './ledger';
import type { Snapshot } from './merge';
import type { Area, Category, HolidayMap, Profile } from './types';

/**
 * A reproducible change of areas/categories (and optionally profile fields).
 *
 * - `areas`: target definition per area id. Listed categories are created or
 *   renamed (matched by id) in the given order. Existing categories that are
 *   not listed are kept but hidden, so history never points to a missing id.
 *   Areas that are not listed stay unchanged (after the listed ones); areas
 *   are ordered as listed in the migration.
 * - `moves`: re-assign sessions from one category to another within the same
 *   area. Only `categoryId` and `updatedAt` change.
 * - `profilePatch`: top-level profile fields to replace (`period` is merged).
 */
export interface Migration {
  id: string;
  description?: string;
  areas: (Omit<Area, 'hidden' | 'categories'> & {
    hidden?: boolean;
    categories: (Omit<Category, 'hidden'> & { hidden?: boolean })[];
  })[];
  moves: { areaId: string; from: string; to: string }[];
  profilePatch?: Partial<Omit<Profile, 'period'>> & { period?: Partial<Profile['period']> };
}

export interface MigrationReport {
  /** Sessions per `area/category` before the migration (deleted ones excluded). */
  before: Record<string, number>;
  after: Record<string, number>;
  movedSessions: number;
  hiddenCategories: string[];
  addedCategories: string[];
  addedAreas: string[];
}

function countByCategory(snapshot: Snapshot): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const s of snapshot.sessions) {
    if (s.deleted) continue;
    const key = `${s.areaId}/${s.categoryId}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

export function migrateProfile(profile: Profile, migration: Migration): { profile: Profile; hidden: string[]; added: string[]; addedAreas: string[] } {
  const hidden: string[] = [];
  const added: string[] = [];
  const addedAreas: string[] = [];
  const areas = profile.areas.map((area) => ({ ...area, categories: [...area.categories] }));

  for (const target of migration.areas) {
    const existing = areas.find((a) => a.id === target.id);
    const categories: Category[] = target.categories.map((c) => ({ id: c.id, name: c.name, hidden: c.hidden ?? false }));
    if (existing) {
      for (const c of categories) if (!existing.categories.some((x) => x.id === c.id)) added.push(`${target.id}/${c.id}`);
      for (const old of existing.categories) {
        if (!categories.some((c) => c.id === old.id)) {
          categories.push({ ...old, hidden: true });
          if (!old.hidden) hidden.push(`${target.id}/${old.id}`);
        }
      }
      Object.assign(existing, {
        name: target.name,
        color: target.color,
        countsAsWork: target.countsAsWork,
        hidden: target.hidden ?? existing.hidden,
        categories,
      });
    } else {
      areas.push({ id: target.id, name: target.name, color: target.color, countsAsWork: target.countsAsWork, hidden: target.hidden ?? false, categories });
      addedAreas.push(target.id);
    }
  }

  // Listed areas first, in migration order; unlisted areas keep their relative order after them.
  const order = new Map(migration.areas.map((a, i) => [a.id, i]));
  const sorted = [...areas].sort((a, b) => (order.get(a.id) ?? Infinity) - (order.get(b.id) ?? Infinity));

  const { period, ...rest } = migration.profilePatch ?? {};
  return {
    profile: { ...profile, ...rest, period: { ...profile.period, ...period }, areas: sorted },
    hidden,
    added,
    addedAreas,
  };
}

/** Applies a migration to a snapshot. Pure: returns a new snapshot. */
export function applyMigration(snapshot: Snapshot, migration: Migration, now = Date.now()): { snapshot: Snapshot; report: MigrationReport } {
  if (!snapshot.profile) throw new Error('Snapshot has no profile');
  const { profile, hidden, added, addedAreas } = migrateProfile(snapshot.profile.value, migration);

  for (const m of migration.moves) {
    const area = profile.areas.find((a) => a.id === m.areaId);
    if (!area?.categories.some((c) => c.id === m.to)) {
      throw new Error(`Move target ${m.areaId}/${m.to} does not exist`);
    }
  }

  let moved = 0;
  const sessions = snapshot.sessions.map((s) => {
    const move = migration.moves.find((m) => m.areaId === s.areaId && m.from === s.categoryId);
    if (!move || s.deleted || move.from === move.to) return s;
    moved++;
    return { ...s, categoryId: move.to, updatedAt: Math.max(now, s.updatedAt + 1) };
  });

  const next: Snapshot = {
    ...snapshot,
    exportedAt: now,
    profile: { value: profile, updatedAt: Math.max(now, snapshot.profile.updatedAt + 1) },
    sessions,
  };

  // Every session must still point to an existing area and category.
  for (const s of next.sessions) {
    if (s.deleted) continue;
    const area = profile.areas.find((a) => a.id === s.areaId);
    if (!area?.categories.some((c) => c.id === s.categoryId)) {
      throw new Error(`Session ${s.id} would point to missing category ${s.areaId}/${s.categoryId}`);
    }
  }

  return {
    snapshot: next,
    report: {
      before: countByCategory(snapshot),
      after: countByCategory(next),
      movedSessions: moved,
      hiddenCategories: hidden,
      addedCategories: added,
      addedAreas,
    },
  };
}

/** Worked hours and balances of a snapshot, used to verify that a migration changed nothing. */
export function snapshotTotals(snapshot: Snapshot, holidays: HolidayMap, today: ISODate, now: number) {
  const profile = snapshot.profile!.value;
  const ledger = new Ledger({ profile, holidays, sessions: snapshot.sessions, absences: snapshot.absences, now });
  const round = (n: number) => Math.round(n * 10_000) / 10_000;
  return {
    workedHours: round(ledger.range(ledger.start, ledger.end).worked),
    balanceToday: round(ledger.balanceAt(today)),
    balanceEnd: round(ledger.balanceAt(ledger.end)),
  };
}
