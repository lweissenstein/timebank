import { useSyncExternalStore } from 'react';
import { GitHubSync, loadSyncConfig, type SyncResult } from '../data/githubSync';
import { db } from '../data/db';
import { repo } from '../data/repo';

/** Background sync: on start, when the app becomes visible and shortly after local changes. */
interface SyncState {
  busy: boolean;
  last: SyncResult | null;
  error: string | null;
}

let state: SyncState = { busy: false, last: null, error: null };
const listeners = new Set<() => void>();
let timer: number | undefined;
let pending = false;

function set(next: Partial<SyncState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

export async function syncNow(): Promise<void> {
  const config = loadSyncConfig();
  if (!config) return;
  if (state.busy) {
    pending = true;
    return;
  }
  set({ busy: true, error: null });
  try {
    const last = await new GitHubSync(config).sync(repo);
    // Data from an older app version may still contain in-session pauses.
    const converted = await repo.normalizeBreaks();
    set({ busy: false, last });
    if (converted > 0) scheduleSync(1000);
  } catch (e) {
    set({ busy: false, error: (e as Error).message });
  }
  if (pending) {
    pending = false;
    scheduleSync(1000);
  }
}

export function scheduleSync(delayMs = 8000): void {
  if (!loadSyncConfig()) return;
  window.clearTimeout(timer);
  timer = window.setTimeout(() => void syncNow(), delayMs);
}

let started = false;

/** Hooks into database changes and page visibility. Call once at startup. */
export function startAutoSync(): void {
  if (started) return;
  started = true;
  const onChange = () => {
    if (!state.busy) scheduleSync();
  };
  db.sessions.hook('creating', onChange);
  db.sessions.hook('updating', onChange);
  db.absences.hook('creating', onChange);
  db.absences.hook('updating', onChange);
  db.kv.hook('creating', onChange);
  db.kv.hook('updating', onChange);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') scheduleSync(500);
  });
  window.addEventListener('online', () => scheduleSync(500));
  // Pull changes from other devices regularly while the app is open.
  window.setInterval(() => {
    if (document.visibilityState === 'visible' && navigator.onLine && !state.busy) void syncNow();
  }, 60_000);
  scheduleSync(300);
}

export function useSyncState(): SyncState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}
