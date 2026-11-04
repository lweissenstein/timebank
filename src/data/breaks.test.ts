import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { TimebankDB } from './db';
import { Repository } from './repo';

let n = 0;
const fresh = () => new Repository(new TimebankDB(`breaks-${++n}`));
const T0 = Date.UTC(2026, 10, 3, 8);
const min = (m: number) => T0 + m * 60_000;

describe('pause and resume', () => {
  it('pause ends the block, resume starts a new one with the same settings', async () => {
    const repo = fresh();
    await repo.start('bob', 'dev', min(0), 'office');
    const running = await repo.running();
    await repo.saveSession({ ...running!, note: 'Feature X', thesisRelevant: true });
    await repo.pause(min(300));
    expect(await repo.running()).toBeUndefined();
    expect((await repo.onBreakSession())?.end).toBe(min(300));
    const next = await repo.resume(min(384));
    expect(next).toMatchObject({ areaId: 'bob', categoryId: 'dev', locationId: 'office', note: 'Feature X', thesisRelevant: true, start: min(384), gapBefore: 'pause' });
    expect(await repo.onBreakSession()).toBeUndefined();
  });

  it('starting another category during a break ends the break', async () => {
    const repo = fresh();
    await repo.start('bob', 'dev', min(0));
    await repo.pause(min(60));
    await repo.start('app', 'dev', min(90));
    expect(await repo.onBreakSession()).toBeUndefined();
    expect((await repo.running())?.gapBefore).toBe('pause');
  });

  it('end break without resuming', async () => {
    const repo = fresh();
    await repo.start('bob', 'dev', min(0));
    await repo.pause(min(60));
    await repo.endBreak(min(70));
    expect(await repo.onBreakSession()).toBeUndefined();
    expect(await repo.running()).toBeUndefined();
  });

  it('converts old in-session pauses into two blocks', async () => {
    const repo = fresh();
    await repo.start('bob', 'dev', min(0));
    await repo.togglePause(min(360));
    await repo.togglePause(min(444));
    await repo.stop(min(540));
    expect(await repo.normalizeBreaks(min(600))).toBe(2);
    const sessions = (await repo.snapshot()).sessions.sort((a, b) => a.start - b.start);
    expect(sessions.map((s) => [s.start, s.end, Math.round(s.breakMinutes)])).toEqual([
      [min(0), min(360), 0],
      [min(444), min(540), 0],
    ]);
    expect(await repo.normalizeBreaks(min(601))).toBe(0);
  });
});
