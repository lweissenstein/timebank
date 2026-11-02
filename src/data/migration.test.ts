import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { testProfile } from '../core/testUtils';
import { TimebankDB } from './db';
import { Repository } from './repo';

let n = 0;
function freshRepo() {
  return new Repository(new TimebankDB(`migration-test-${++n}`));
}

describe('repository migration and locations', () => {
  it('stores the work location of new and running sessions', async () => {
    const repo = freshRepo();
    await repo.start('bob', 'dev', Date.now(), 'office');
    expect((await repo.running())?.locationId).toBe('office');
    await repo.setRunningLocation('remote');
    expect((await repo.running())?.locationId).toBe('remote');
  });

  it('migrates local data and keeps the running session', async () => {
    const repo = freshRepo();
    await repo.saveProfile(testProfile());
    await repo.start('bob', 'dev');
    const { report } = await repo.migrate({
      id: 't',
      areas: [{ id: 'bob', name: 'Bob', color: '#000000', countsAsWork: true, categories: [{ id: 'development', name: 'Development' }] }],
      moves: [{ areaId: 'bob', from: 'dev', to: 'development' }],
    });
    expect(report.movedSessions).toBe(1);
    const running = await repo.running();
    expect(running?.categoryId).toBe('development');
    expect(running?.end).toBeNull();
  });
});
