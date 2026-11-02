import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { mergeById } from '../core/merge';
import { testProfile } from '../core/testUtils';
import { TimebankDB } from './db';
import { GitHubSync } from './githubSync';
import { Repository } from './repo';

let n = 0;
function freshRepo() {
  return new Repository(new TimebankDB(`test-${++n}`));
}

describe('repository', () => {
  let repo: Repository;
  beforeEach(() => {
    repo = freshRepo();
  });

  it('switches sessions with one call and tracks pauses', async () => {
    const t0 = Date.UTC(2026, 10, 9, 8);
    await repo.start('bob', 'dev', t0);
    await repo.togglePause(t0 + 60 * 60_000);
    await repo.togglePause(t0 + 90 * 60_000);
    const stopped = await repo.start('app', 'dev', t0 + 120 * 60_000);
    expect(stopped?.breakMinutes).toBe(30);
    expect(stopped?.end).toBe(t0 + 120 * 60_000);
    expect((await repo.running())?.areaId).toBe('app');
    await repo.stop(t0 + 180 * 60_000);
    expect(await repo.running()).toBeUndefined();
  });

  it('replaces the absence of a day and keeps tombstones', async () => {
    await repo.setAbsence('2026-11-09', 'vacation');
    await repo.setAbsence('2026-11-09', 'sick');
    const snap = await repo.snapshot();
    expect(snap.absences.filter((a) => !a.deleted).map((a) => a.type)).toEqual(['sick']);
    expect(snap.absences.filter((a) => a.deleted)).toHaveLength(1);
  });

  it('round-trips a backup', async () => {
    await repo.saveProfile(testProfile());
    await repo.start('bob', 'dev');
    const backup = JSON.parse(JSON.stringify(await repo.snapshot()));
    const other = freshRepo();
    await other.importBackup(backup, 'replace');
    expect((await other.getProfile())?.value.name).toBe('Test');
    expect((await other.snapshot()).sessions).toHaveLength(1);
  });
});

describe('merge', () => {
  it('keeps the newest version of each record', () => {
    const merged = mergeById([{ id: 'a', updatedAt: 1 }, { id: 'b', updatedAt: 5 }], [{ id: 'a', updatedAt: 2, deleted: true }, { id: 'b', updatedAt: 3 }]);
    expect(merged).toEqual([{ id: 'a', updatedAt: 2, deleted: true }, { id: 'b', updatedAt: 5 }]);
  });
});

describe('GitHub sync', () => {
  function fakeGitHub() {
    let file: { content: string; sha: string } | null = null;
    let version = 0;
    const fetchFn = (async (_url: string, init?: RequestInit) => {
      if (!init?.method) {
        if (!file) return new Response('{"message":"Not Found"}', { status: 404 });
        return Response.json({ sha: file.sha, encoding: 'base64', content: file.content });
      }
      const body = JSON.parse(init.body as string);
      if ((file?.sha ?? undefined) !== body.sha) return new Response('{"message":"conflict"}', { status: 409 });
      file = { content: body.content, sha: `sha${++version}` };
      return Response.json({});
    }) as typeof fetch;
    return { fetchFn, pushes: () => version };
  }

  it('pushes local data and pulls it on another device', async () => {
    const gh = fakeGitHub();
    const config = { owner: 'me', repo: 'data', path: 'timebank.json', token: 't' };
    const deviceA = freshRepo();
    const deviceB = freshRepo();
    await deviceA.saveProfile(testProfile());
    await deviceA.setAbsence('2026-11-09', 'vacation');

    expect((await new GitHubSync(config, gh.fetchFn).sync(deviceA)).status).toBe('pushed');
    expect((await new GitHubSync(config, gh.fetchFn).sync(deviceB)).status).toBe('pulled');
    expect((await deviceB.getProfile())?.value.name).toBe('Test');

    await deviceB.setAbsence('2026-11-10', 'sick');
    await new GitHubSync(config, gh.fetchFn).sync(deviceB);
    await new GitHubSync(config, gh.fetchFn).sync(deviceA);
    const active = (await deviceA.snapshot()).absences.filter((a) => !a.deleted).map((a) => a.date).sort();
    expect(active).toEqual(['2026-11-09', '2026-11-10']);
    expect((await new GitHubSync(config, gh.fetchFn).sync(deviceA)).status).toBe('unchanged');
    expect(gh.pushes()).toBe(2);
  });

  it('keeps umlauts intact', async () => {
    const gh = fakeGitHub();
    const config = { owner: 'me', repo: 'data', path: 'timebank.json', token: 't' };
    const a = freshRepo();
    await a.saveProfile(testProfile({ name: 'Überstunden äöü ß' }));
    await new GitHubSync(config, gh.fetchFn).sync(a);
    const b = freshRepo();
    await new GitHubSync(config, gh.fetchFn).sync(b);
    expect((await b.getProfile())?.value.name).toBe('Überstunden äöü ß');
  });
});
