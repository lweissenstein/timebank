import Dexie, { type Table } from 'dexie';
import type { Absence, Session } from '../core/types';

export interface KeyValue {
  key: string;
  value: unknown;
  updatedAt: number;
}

/** Local IndexedDB storage. All data stays in the browser unless you sync or export it. */
export class TimebankDB extends Dexie {
  sessions!: Table<Session, string>;
  absences!: Table<Absence, string>;
  kv!: Table<KeyValue, string>;

  constructor(name = 'timebank') {
    super(name);
    this.version(1).stores({
      sessions: 'id, start, areaId, updatedAt',
      absences: 'id, date, updatedAt',
      kv: 'key',
    });
  }
}

export const db = new TimebankDB();

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
