import { MS_PER_MINUTE, toISODate } from './dates';
import type { WeekTotals } from './ledger';
import type { Area, Session } from './types';
import { sessionWorkMs } from './worktime';

export interface CsvOptions {
  delimiter: ',' | ';';
  /** Decimal separator for numbers. Use ',' together with ';' for German Excel. */
  decimal: '.' | ',';
}

export const CSV_DEFAULT: CsvOptions = { delimiter: ',', decimal: '.' };

function cell(value: string | number | boolean, opts: CsvOptions): string {
  let s: string;
  if (typeof value === 'number') s = value.toFixed(2).replace('.', opts.decimal);
  else if (typeof value === 'boolean') s = value ? '1' : '0';
  else s = value;
  return /["\n\r]/.test(s) || s.includes(opts.delimiter) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: (string | number | boolean)[][], opts: CsvOptions): string {
  return rows.map((r) => r.map((v) => cell(v, opts)).join(opts.delimiter)).join('\r\n') + '\r\n';
}

function time(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function sessionsToCsv(
  sessions: Session[],
  areas: Area[],
  now: number,
  opts: CsvOptions = CSV_DEFAULT,
): string {
  const areaById = new Map(areas.map((a) => [a.id, a]));
  const rows: (string | number | boolean)[][] = [
    ['date', 'start', 'end', 'area', 'category', 'counts_as_work', 'break_minutes', 'hours', 'thesis_relevant', 'note'],
  ];
  for (const s of [...sessions].filter((x) => !x.deleted).sort((a, b) => a.start - b.start)) {
    const area = areaById.get(s.areaId);
    const category = area?.categories.find((c) => c.id === s.categoryId);
    rows.push([
      toISODate(new Date(s.start)),
      time(s.start),
      s.end === null ? '' : time(s.end),
      area?.name ?? s.areaId,
      category?.name ?? s.categoryId,
      area?.countsAsWork ?? false,
      Math.round(s.breakMinutes),
      sessionWorkMs(s, now) / (60 * MS_PER_MINUTE),
      s.thesisRelevant,
      s.note,
    ]);
  }
  return toCsv(rows, opts);
}

export function weeksToCsv(weeks: WeekTotals[], balances: number[], opts: CsvOptions = CSV_DEFAULT): string {
  const rows: (string | number | boolean)[][] = [
    ['week_start', 'from', 'to', 'target', 'worked', 'vacation', 'sick', 'holiday', 'actual', 'delta', 'balance'],
  ];
  weeks.forEach((w, i) =>
    rows.push([w.weekStart, w.from, w.to, w.target, w.worked, w.vacation, w.sick, w.holiday, w.actual, w.delta, balances[i] ?? 0]),
  );
  return toCsv(rows, opts);
}
