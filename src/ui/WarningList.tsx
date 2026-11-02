import type { DayWarning } from '../core/warnings';
import { useI18n } from '../i18n';

export function WarningList({ warnings }: { warnings: DayWarning[] }) {
  const { t, num, date } = useI18n();
  if (warnings.length === 0) return null;
  return (
    <ul className="warnings">
      {warnings.map((w, i) => (
        <li key={i} className="warning">
          {w.kind === 'maxDaily'
            ? t('stats.warnMaxDaily', { date: date(w.date), hours: num(w.workedHours), limit: w.limit })
            : t('stats.warnBreak', { date: date(w.date), hours: num(w.workedHours), min: Math.round(w.breakMinutes), required: w.required })}
        </li>
      ))}
    </ul>
  );
}
