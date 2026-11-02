import { useMemo, useState } from 'react';
import { eachDay, endOfMonth, endOfWeek, startOfMonth, startOfWeek, type ISODate } from '../core/dates';
import type { AbsenceType } from '../core/types';
import { vacationAccounts, vacationDaysInRange } from '../core/vacation';
import { repo } from '../data/repo';
import { useI18n } from '../i18n';
import { useAppData } from './AppData';
import { Card, Segmented, Stat } from './common';

type Mode = AbsenceType | 'clear';

function shiftMonth(month: ISODate, delta: number): ISODate {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export function CalendarPage() {
  const { t, num, date, lang, durShort } = useI18n();
  const { profile, ledger, absences, holidays, today } = useAppData();
  const [month, setMonth] = useState(() => startOfMonth(today));
  const [mode, setMode] = useState<Mode>('vacation');
  const [hours, setHours] = useState<string>('');
  const [range, setRange] = useState({ from: today, to: today });

  const absenceByDay = useMemo(() => new Map(absences.map((a) => [a.date, a])), [absences]);
  const accounts = vacationAccounts(ledger, absences, today);
  const weekdays = t('weekday.short').split(',');
  const days = eachDay(startOfWeek(month), endOfWeek(endOfMonth(month)));
  const tags = lang === 'de' ? { vacation: 'U', sick: 'K' } : { vacation: 'V', sick: 'S' };
  const customHours = hours.trim() === '' ? null : Number(hours.replace(',', '.'));

  async function apply(day: ISODate) {
    if (!ledger.inPeriod(day) || !ledger.isWorkday(day) || holidays.has(day)) return;
    const current = absenceByDay.get(day);
    if (mode === 'clear' || (current && current.type === mode && current.hours === customHours)) {
      await repo.setAbsence(day, null);
    } else {
      await repo.setAbsence(day, mode, customHours);
    }
  }

  async function applyRange() {
    for (const d of vacationDaysInRange(ledger, range.from, range.to)) {
      await repo.setAbsence(d, mode === 'clear' ? null : mode, mode === 'clear' ? null : customHours);
    }
  }

  const monthLabel = new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-GB', { month: 'long', year: 'numeric' }).format(new Date(`${month}T00:00`));
  const monthHolidays = [...holidays].filter(([d]) => d >= month && d <= endOfMonth(month)).sort();

  return (
    <div className="page">
      <Card>
        <div className="cal-head">
          <button className="btn icon" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="previous">
            ‹
          </button>
          <strong>{monthLabel}</strong>
          <button className="btn icon" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="next">
            ›
          </button>
        </div>
        <p className="hint">{t('cal.mode')}</p>
        <Segmented<Mode>
          value={mode}
          onChange={setMode}
          options={[
            { value: 'vacation', label: t('cal.vacation') },
            { value: 'sick', label: t('cal.sick') },
            { value: 'clear', label: t('cal.clear') },
          ]}
        />
        {mode !== 'clear' && (
          <label className="inline">
            {t('cal.hours')}
            <input type="number" min={0} step={0.5} inputMode="decimal" placeholder={num(ledger.perDay, 2)} value={hours} onChange={(e) => setHours(e.target.value)} />
          </label>
        )}
        <div className="cal-grid">
          {weekdays.map((w) => (
            <div key={w} className="cal-wd">
              {w}
            </div>
          ))}
          {days.map((d) => {
            const a = absenceByDay.get(d);
            const holiday = holidays.get(d);
            const inMonth = d.slice(0, 7) === month.slice(0, 7);
            const worked = ledger.day(d).worked;
            const classes = [
              'cal-day',
              inMonth ? '' : 'other',
              ledger.inPeriod(d) ? '' : 'outside',
              ledger.isWorkday(d) ? '' : 'weekend',
              holiday ? 'holiday' : '',
              a ? a.type : '',
              d === today ? 'today' : '',
            ].join(' ');
            return (
              <button key={d} className={classes} onClick={() => apply(d)} title={holiday ?? undefined}>
                <span className="cal-num">{Number(d.slice(8))}</span>
                {a && <span className="cal-tag">{tags[a.type]}{a.hours !== null ? ` ${durShort(a.hours)}` : ''}</span>}
                {holiday && !a && <span className="cal-tag">★</span>}
                {worked > 0 && <span className="cal-hours">{durShort(worked)}</span>}
              </button>
            );
          })}
        </div>
        <details className="range">
          <summary>{t('cal.range')}</summary>
          <div className="row">
            <label>
              {t('cal.from')}
              <input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
            </label>
            <label>
              {t('cal.to')}
              <input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
            </label>
          </div>
          <button className="btn primary" onClick={applyRange}>
            {t('cal.apply')}
          </button>
        </details>
      </Card>

      <Card title={t('cal.holidays')}>
        {monthHolidays.length === 0 ? (
          <p className="muted">{t('cal.noHolidays')}</p>
        ) : (
          <ul className="plain">
            {monthHolidays.map(([d, name]) => (
              <li key={d} className={ledger.isWorkday(d) ? '' : 'muted'}>
                {date(d)} – {name}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {profile.vacation.daysPerYear > 0 &&
        accounts.map((acc) => (
          <Card key={acc.year} title={t('cal.account', { year: acc.year })}>
            <div className="stats-grid">
              <Stat label={t('cal.entitlement')} value={num(acc.entitlement, 2)} />
              {acc.year === Number(today.slice(0, 4)) && <Stat label={t('cal.accrued')} value={num(acc.accrued, 2)} />}
              <Stat label={t('cal.taken')} value={num(acc.taken, 2)} />
              <Stat label={t('cal.planned')} value={num(acc.planned, 2)} />
              <Stat label={t('cal.remaining')} value={num(acc.remaining, 2)} tone={acc.remaining < 0 ? 'neg' : undefined} />
              {acc.year === Number(today.slice(0, 4)) && (
                <Stat label={t('cal.availableNow')} value={num(acc.availableNow, 2)} tone={acc.availableNow < 0 ? 'neg' : 'pos'} />
              )}
            </div>
          </Card>
        ))}
      <p className="hint muted">{`${t('cal.vacation')}: ${tags.vacation} · ${t('cal.sick')}: ${tags.sick} · ★ = ${t('stats.holiday')}`}</p>
    </div>
  );
}
