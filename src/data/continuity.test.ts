import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { TimebankDB } from './db';
import { Repository } from './repo';

let n = 0;
const fresh = () => new Repository(new TimebankDB(`continuity-${++n}`));
const T0 = Date.UTC(2026, 10, 9, 8);
const min = (m: number) => T0 + m * 60_000;

describe('continuous tracking', () => {
  it('closes gaps under 2 minutes between stop and start', async () => {
    const repo = fresh();
    await repo.start('bob', 'dev', min(0));
    await repo.stop(min(60));
    await repo.start('app', 'dev', min(61.5));
    expect((await repo.running())?.start).toBe(min(60));
  });

  it('keeps longer gaps', async () => {
    const repo = fresh();
    await repo.start('bob', 'dev', min(0));
    await repo.stop(min(60));
    await repo.start('app', 'dev', min(65));
    expect((await repo.running())?.start).toBe(min(65));
  });

  it('switching directly is seamless', async () => {
    const repo = fresh();
    await repo.start('bob', 'dev', min(0));
    const stopped = await repo.start('app', 'dev', min(30));
    expect(stopped?.end).toBe(min(30));
    expect((await repo.running())?.start).toBe(min(30));
  });
});
