/**
 * Formats a duration given in hours as "7 h 20 min", "45 min" or "7 h".
 * Rounded to full minutes. `compact` gives "7h20" for tight spaces.
 */
export function formatHours(hours: number, opts: { compact?: boolean } = {}): string {
  const totalMinutes = Math.round(Math.abs(hours) * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (opts.compact) {
    if (h === 0) return `${m}m`;
    return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
  }
  if (h === 0 && m === 0) return '0 h';
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Like formatHours with a sign: "+7 h 20 min", "−45 min", "±0 h". */
export function formatSignedHours(hours: number): string {
  const rounded = Math.round(hours * 60);
  const sign = rounded > 0 ? '+' : rounded < 0 ? '−' : '±';
  return `${sign}${formatHours(hours)}`;
}
