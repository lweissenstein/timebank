import { isSnapshot, mergeSnapshots, sameContent, type Snapshot } from '../core/merge';
import type { Repository } from './repo';

/**
 * Sync through a (private) GitHub repository using the REST "contents" API.
 * The whole data set lives in one JSON file; every device merges its local
 * data with the remote file and writes the result back.
 */
export interface SyncConfig {
  owner: string;
  repo: string;
  /** File path inside the repo. */
  path: string;
  branch?: string;
  /** Fine-grained personal access token with "Contents: read and write" on that repo only. */
  token: string;
}

export type SyncResult = { status: 'pushed' | 'pulled' | 'unchanged'; at: number };

const API = 'https://api.github.com';

export class SyncError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function fromBase64(b64: string): string {
  const binary = atob(b64.replace(/\s/g, ''));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export class GitHubSync {
  constructor(
    private readonly config: SyncConfig,
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
  ) {}

  private headers(): HeadersInit {
    return {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${this.config.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    };
  }

  private url(suffix = ''): string {
    const { owner, repo, path } = this.config;
    const encodedPath = path.split('/').map(encodeURIComponent).join('/');
    return `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}${suffix}`;
  }

  /** Reads the remote snapshot; `null` if the file does not exist yet. */
  async read(): Promise<{ snapshot: Snapshot | null; sha: string | null }> {
    const ref = this.config.branch ? `?ref=${encodeURIComponent(this.config.branch)}` : '';
    const res = await this.fetchFn(this.url(ref), { headers: this.headers(), cache: 'no-store' });
    if (res.status === 404) return { snapshot: null, sha: null };
    if (!res.ok) throw new SyncError(await errorMessage(res), res.status);
    const meta = (await res.json()) as { sha: string; content?: string; encoding?: string };
    let content = meta.encoding === 'base64' && meta.content ? meta.content : null;
    if (content === null) {
      // Files > 1 MB are not inlined; fetch the blob instead.
      const { owner, repo } = this.config;
      const blob = await this.fetchFn(`${API}/repos/${owner}/${repo}/git/blobs/${meta.sha}`, {
        headers: this.headers(),
        cache: 'no-store',
      });
      if (!blob.ok) throw new SyncError(await errorMessage(blob), blob.status);
      content = ((await blob.json()) as { content: string }).content;
    }
    const data = JSON.parse(fromBase64(content));
    if (!isSnapshot(data)) throw new SyncError('Remote file is not a Timebank data file');
    return { snapshot: data, sha: meta.sha };
  }

  async write(snapshot: Snapshot, sha: string | null): Promise<void> {
    const body = {
      message: `Sync ${new Date(snapshot.exportedAt).toISOString()}`,
      content: toBase64(JSON.stringify(snapshot, null, 1)),
      ...(sha ? { sha } : {}),
      ...(this.config.branch ? { branch: this.config.branch } : {}),
    };
    const res = await this.fetchFn(this.url(), {
      method: 'PUT',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new SyncError(await errorMessage(res), res.status);
  }

  /** Pull, merge, store locally and push if anything changed. */
  async sync(repo: Repository, attempt = 0): Promise<SyncResult> {
    const { snapshot: remote, sha } = await this.read();
    const local = await repo.snapshot();
    const merged = mergeSnapshots(local, remote);
    const localChanged = !sameContent(merged, local);
    if (localChanged) await repo.restore(merged);
    if (sameContent(merged, remote)) {
      return { status: localChanged ? 'pulled' : 'unchanged', at: Date.now() };
    }
    try {
      await this.write(merged, sha);
    } catch (e) {
      // Another device wrote in between: retry once with fresh remote data.
      if (e instanceof SyncError && (e.status === 409 || e.status === 422) && attempt === 0) {
        return this.sync(repo, 1);
      }
      throw e;
    }
    return { status: 'pushed', at: Date.now() };
  }
}

async function errorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string };
    return `GitHub ${res.status}: ${body.message ?? res.statusText}`;
  } catch {
    return `GitHub ${res.status}: ${res.statusText}`;
  }
}

const CONFIG_KEY = 'timebank.sync';

/** Sync settings stay in this browser only (they contain the token). */
export function loadSyncConfig(): SyncConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    return raw ? (JSON.parse(raw) as SyncConfig) : null;
  } catch {
    return null;
  }
}

export function saveSyncConfig(config: SyncConfig | null): void {
  try {
    if (config) localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    else localStorage.removeItem(CONFIG_KEY);
  } catch {
    /* storage unavailable */
  }
}
