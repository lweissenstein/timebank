import { describe, expect, it } from 'vitest';
import { Ledger } from './ledger';
import type { Snapshot } from './merge';
import { applyMigration, type Migration } from './migrate';
import { testProfile, work } from './testUtils';

function snapshot(): Snapshot {
  const s1 = { ...work('2026-11-09', 4, 'bob'), note: 'keep me', thesisRelevant: true, categoryId: 'dev' };
  const s2 = { ...work('2026-11-10', 3, 'thesis'), categoryId: 'write' };
  return {
    format: 'timebank',
    version: 1,
    exportedAt: 0,
    profile: { value: testProfile(), updatedAt: 1 },
    sessions: [s1, s2],
    absences: [],
  };
}

const MIGRATION: Migration = {
  id: 'test',
  areas: [
    {
      id: 'bob',
      name: 'Project Bob',
      color: '#1f6f5c',
      countsAsWork: true,
      categories: [
        { id: 'scoping', name: 'Scoping' },
        { id: 'development', name: 'Development' },
      ],
    },
    { id: 'general', name: 'General', color: '#555555', countsAsWork: true, categories: [{ id: 'orga', name: 'Orga' }] },
  ],
  moves: [{ areaId: 'bob', from: 'dev', to: 'development' }],
  profilePatch: { workLocations: [{ id: 'office', name: 'Office' }] },
};

function totals(snap: Snapshot) {
  const l = new Ledger({ profile: snap.profile!.value, holidays: new Map(), sessions: snap.sessions, absences: snap.absences, now: 0 });
  return { worked: l.range(l.start, l.end).worked, balance: l.balanceAt('2026-11-15') };
}

describe('category migration', () => {
  it('moves sessions and keeps times, notes and flags', () => {
    const before = snapshot();
    const { snapshot: after, report } = applyMigration(before, MIGRATION, 1000);
    const [s1] = after.sessions;
    expect(s1.categoryId).toBe('development');
    expect({ ...s1, categoryId: 'dev', updatedAt: 0 }).toEqual({ ...before.sessions[0], updatedAt: 0 });
    expect(after.sessions[1]).toBe(before.sessions[1]);
    expect(report.movedSessions).toBe(1);
    expect(report.before).toEqual({ 'bob/dev': 1, 'thesis/write': 1 });
    expect(report.after).toEqual({ 'bob/development': 1, 'thesis/write': 1 });
  });

  it('hides unlisted categories instead of deleting them and adds new areas', () => {
    const { snapshot: after, report } = applyMigration(snapshot(), MIGRATION, 1000);
    const bob = after.profile!.value.areas.find((a) => a.id === 'bob')!;
    expect(bob.categories.map((c) => [c.id, c.hidden])).toEqual([
      ['scoping', false],
      ['development', false],
      ['dev', true],
    ]);
    expect(report.hiddenCategories).toEqual(['bob/dev']);
    expect(report.addedAreas).toEqual(['general']);
    expect(after.profile!.value.workLocations).toEqual([{ id: 'office', name: 'Office' }]);
  });

  it('keeps worked hours and balance identical', () => {
    const before = snapshot();
    expect(totals(applyMigration(before, MIGRATION, 1000).snapshot)).toEqual(totals(before));
  });

  it('rejects moves to unknown categories', () => {
    const bad = { ...MIGRATION, moves: [{ areaId: 'bob', from: 'dev', to: 'nope' }] };
    expect(() => applyMigration(snapshot(), bad)).toThrow(/does not exist/);
  });

  it('orders areas as listed in the migration', () => {
    const m = { ...MIGRATION, areas: [MIGRATION.areas[1], MIGRATION.areas[0]] };
    const { snapshot: after } = applyMigration(snapshot(), m, 1000);
    expect(after.profile!.value.areas.map((a) => a.id)).toEqual(['general', 'bob', 'app', 'thesis']);
  });
});
