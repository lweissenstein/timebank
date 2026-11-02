import { useMemo, useState } from 'react';
import { addDays, eachDay, endOfMonth, endOfWeek, isoWeek, maxDate, minDate, startOfMonth, startOfWeek, type ISODate } from '../core/dates';
import { averageWeeklyWork, hoursToZero, projectBalance, projectedBalanceOn } from '../core/projection';
import { breakdown, locationBreakdown } from '../core/reports';
import { dayWarnings } from '../core/warnings';
import { useI18n } from '../i18n';
import { useAppData } from './AppData';
import { BalanceChart, type ChartPoint } from './BalanceChart';
import { Card, Segmented, Stat, tone } from './common';
import { WarningList } from './WarningList';

type Scope = 'week' | 'month' | 'total';

const ASSUMED_KEY = 'timebank.assumedWeeklyHours';

function loadAssumed(): number | null {
  try {
    const v = localStorage.getItem(ASSUMED_KEY);
    return v === null ? null : Number(v);
  } catch {
    return null;
  }
}

function saveAssumed(v: number) {
  try {
    localStorage.setItem(ASSUMED_KEY, String(v));
  } catch {
    /* ignore */
  }
}

export function StatsPage() {
  const { t, signed, date, dur } = useI18n();
  const { profile, ledger, sessions, holidays, today, now } = useAppData();
  const average = averageWeeklyWork(ledger, today);
  const [assumed, setAssumedState] = useState<number>(() => loadAssumed() ?? Math.round(average?.hours ?? profile.contract.weeklyHours));
  const setAssumed = (v: number) => {
    const clean = Number.isFinite(v) && v >= 0 ? v : 0;
    setAssumedState(clean);
    saveAssumed(clean);
  };
  const [scope, setScope] = useState<Scope>('week');
  const [anchor, setAnchor] = useState<ISODate>(() => minDate(maxDate(today, profile.period.start), profile.period.end));

  const yesterday = addDays(today, -1);
  const balance = ledger.balanceAt(yesterday);
  const day = ledger.day(today);
  const weekSoFar = ledger.range(startOfWeek(today), today);
  const active = today <= profile.period.end;

  // ----- projection -----
  const targets = [
    ...profile.milestones.filter((m) => m.date > today).map((m) => ({ date: m.date, name: m.name })),
    { date: addDays(profile.period.end, 1), name: t('stats.periodEnd') },
  ];
  const projection = useMemo(() => projectBalance(ledger, today, assumed), [ledger, today, assumed]);
  const zero = hoursToZero(ledger, today);
  const chartPoints = useMemo<ChartPoint[]>(() => {
    const points: ChartPoint[] = [{ date: addDays(ledger.start, -1), actual: ledger.openingBalance }];
    for (const w of ledger.weeks()) {
      if (w.to < today) points.push({ date: w.to, actual: ledger.balanceAt(w.to) });
    }
    if (today >= ledger.start && today <= ledger.end) {
      // Connect actual and forecast at the end of yesterday.
      const last = points[points.length - 1];
      const start = ledger.balanceAt(yesterday);
      if (last.date === yesterday) last.forecast = start;
      else points.push({ date: yesterday, actual: start, forecast: start });
      for (const w of ledger.weeks(today)) {
        if (w.to >= today) points.push({ date: w.to, forecast: projection.get(w.to) });
      }
    }
    return points;
  }, [ledger, today, yesterday, projection]);
  const warnings = useMemo(() => dayWarnings(profile, sessions, now), [profile, sessions, now]);

  // ----- range for the breakdown -----
  let from: ISODate = profile.period.start;
  let to: ISODate = minDate(profile.period.end, today);
  let rangeLabel = `${t('stats.total')} · ${date(from)} – ${date(to)}`;
  if (scope === 'week') {
    from = startOfWeek(anchor);
    to = endOfWeek(anchor);
    rangeLabel = `${t('stats.cw')} ${isoWeek(anchor).week} · ${date(from)} – ${date(to)}`;
  } else if (scope === 'month') {
    from = startOfMonth(anchor);
    to = endOfMonth(anchor);
    rangeLabel = date(from, { month: 'long', year: 'numeric' });
  }
  // Target and difference only count up to today; future days are not "missing" yet.
  const totals = ledger.range(from, minDate(to, today));
  const partial = to > today && from <= today;
  const parts = breakdown(profile.areas, sessions, from, to, now);
  const byLocation = (profile.workLocations?.length ?? 0) > 0 ? locationBreakdown(profile.areas, sessions, from, to, now) : [];
  const adjustments = profile.balanceAdjustments ?? [];
  const maxArea = Math.max(1, ...parts.areas.map((a) => a.hours));

  function step(dir: -1 | 1) {
    if (scope === 'week') setAnchor(addDays(anchor, 7 * dir));
    else if (scope === 'month') {
      const d = new Date(`${startOfMonth(anchor)}T00:00`);
      d.setMonth(d.getMonth() + dir);
      setAnchor(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`);
    }
  }

  const weeks = ledger
    .weeks(profile.period.start, endOfWeek(today))
    .map((w) => (w.to > today ? { ...w, ...ledger.range(w.from, today), to: today } : w));

  return (
    <div className="page">
      <Card>
        <div className="hero">
          <div className="stat-label">{t('stats.balance')}</div>
          <div className={`hero-value ${tone(balance) ?? ''}`}>{signed(balance)}</div>
          <div className="muted small">{t('stats.balanceHint')}</div>
        </div>
        <div className="stats-grid">
          <Stat label={t('stats.today')} value={`${dur(day.actual)} / ${dur(day.target)}`} />
          <Stat label={t('stats.weekSoFar')} value={`${dur(weekSoFar.actual)} / ${dur(weekSoFar.target)}`} />
          <Stat label={t('stats.weekDelta')} value={signed(weekSoFar.delta)} tone={tone(weekSoFar.delta)} />
        </div>
      </Card>

      {active && (
        <Card title={t('stats.forecast')}>
          <label className="inline">
            {t('stats.assumption')}
            <span className="assume">
              <input type="number" min={0} step={1} inputMode="decimal" value={assumed} onChange={(e) => setAssumed(Number(e.target.value))} />
              <span>{t('stats.hoursPerWeek')}</span>
            </span>
          </label>
          <div className="chips">
            {average && (
              <button className="chip small" onClick={() => setAssumed(Math.round(average.hours * 10) / 10)}>
                {t('stats.useAverage', { hours: dur(average.hours), weeks: average.weeks })}
              </button>
            )}
            <button className="chip small" onClick={() => setAssumed(profile.contract.weeklyHours)}>
              {t('stats.useContract', { hours: dur(profile.contract.weeklyHours) })}
            </button>
          </div>
          <table className="table">
            <tbody>
              {targets.map((f) => {
                const value = projectedBalanceOn(ledger, today, assumed, f.date);
                return (
                  <tr key={f.date}>
                    <td>
                      {f.name}
                      <div className="muted small">{t('stats.morningOf', { date: date(f.date, { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' }) })}</div>
                    </td>
                    <td className={`nowrap big-num ${tone(value) ?? ''}`}>{signed(value)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="small">
            {zero.hours > 0
              ? t('stats.zeroText', { date: date(profile.period.end), perWeek: dur(zero.perWeek), total: dur(zero.hours) })
              : t('stats.zeroSurplus', { hours: dur(-zero.hours) })}
          </p>
          <details className="explain">
            <summary>{t('stats.howCalculated')}</summary>
            <p className="small muted">{t('stats.explanation', { perDay: dur(ledger.perDay), weekly: dur(profile.contract.weeklyHours) })}</p>
          </details>
        </Card>
      )}

      <Card title={t('stats.chart')}>
        <BalanceChart points={chartPoints} today={today} />
      </Card>

      <Card title={t('stats.breakdown')}>
        <Segmented<Scope>
          value={scope}
          onChange={setScope}
          options={[
            { value: 'week', label: t('stats.week') },
            { value: 'month', label: t('stats.month') },
            { value: 'total', label: t('stats.total') },
          ]}
        />
        <div className="range-nav">
          {scope !== 'total' ? (
            <button className="btn icon" onClick={() => step(-1)} aria-label="previous">
              ‹
            </button>
          ) : (
            <span />
          )}
          <strong>{rangeLabel}</strong>
          {scope !== 'total' ? (
            <button className="btn icon" onClick={() => step(1)} aria-label="next">
              ›
            </button>
          ) : (
            <span />
          )}
        </div>
        <div className="stats-grid">
          <Stat label={t('stats.workedPaid')} value={dur(totals.worked)} />
          <Stat label={t('stats.offCredited')} value={dur(totals.vacation + totals.sick + totals.holiday)} />
          <Stat label={t('stats.credited')} value={dur(totals.actual)} />
          <Stat label={t('stats.target')} value={dur(totals.target)} />
          <Stat label={t('stats.delta')} value={signed(totals.delta)} tone={tone(totals.delta)} />
        </div>
        {partial && <p className="hint">{t('stats.untilToday')}</p>}

        {scope === 'week' && (
          <table className="table compact days">
            <thead>
              <tr>
                <th />
                <th>{t('stats.workedPaid')}</th>
                <th>{t('stats.off')}</th>
                <th>{t('stats.target')}</th>
                <th>{t('stats.delta')}</th>
              </tr>
            </thead>
            <tbody>
              {eachDay(from, to).map((d) => {
                const x = ledger.day(d);
                const off = x.vacation + x.sick + x.holiday;
                const label = x.holiday ? holidays.get(d) : x.vacation ? t('stats.vacation') : x.sick ? t('stats.sick') : '';
                return (
                  <tr key={d} className={d === today ? 'current' : ''}>
                    <td className="nowrap">{date(d, { weekday: 'short', day: '2-digit', month: '2-digit' })}</td>
                    <td>{x.worked ? dur(x.worked) : '–'}</td>
                    <td>
                      {off ? dur(off) : '–'}
                      {label && <div className="muted small">{label}</div>}
                    </td>
                    <td>{x.target ? dur(x.target) : '–'}</td>
                    <td className={`nowrap ${tone(x.delta) ?? ''}`}>{d <= today && (x.target || x.actual) ? signed(x.delta) : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {parts.areas.length === 0 ? (
          <p className="muted">{t('stats.noData')}</p>
        ) : (
          <div className="bars">
            {parts.areas.map((a) => {
              const area = profile.areas.find((x) => x.id === a.areaId);
              return (
                <details key={a.areaId} className="bar-group">
                  <summary>
                    <span className="bar-label">
                      {area?.name ?? a.areaId}
                      {area && !area.countsAsWork && <span className="badge">{t('common.notCounted')}</span>}
                    </span>
                    <span className="bar-track">
                      <span className="bar" style={{ width: `${(a.hours / maxArea) * 100}%`, background: area?.color }} />
                    </span>
                    <span className="bar-value">{dur(a.hours)}</span>
                  </summary>
                  {a.categories.map((c) => (
                    <div key={c.categoryId} className="bar-sub">
                      <span>{area?.categories.find((x) => x.id === c.categoryId)?.name ?? c.categoryId}</span>
                      <span>{dur(c.hours)}</span>
                    </div>
                  ))}
                </details>
              );
            })}
          </div>
        )}
        {byLocation.length > 0 && (
          <ul className="plain location-list">
            {byLocation.map((l) => (
              <li key={l.locationId}>
                <span>{profile.workLocations?.find((x) => x.id === l.locationId)?.name ?? t('stats.noLocation')}</span>
                <span className="muted">
                  {dur(l.hours)} · {t('stats.days', { n: l.days })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={t('stats.weeks')}>
        <div className="table-wrap">
          <table className="table compact">
            <thead>
              <tr>
                <th>{t('stats.cw')}</th>
                <th>{t('stats.workedPaid')}</th>
                <th>{t('stats.off')}</th>
                <th>{t('stats.target')}</th>
                <th>{t('stats.delta')}</th>
                <th>{t('track.balance')}</th>
              </tr>
            </thead>
            <tbody>
              {[...weeks].reverse().map((w) => (
                <tr key={w.weekStart} className={w.weekStart === startOfWeek(today) ? 'current' : ''}>
                  <td>
                    {isoWeek(w.weekStart).week}
                    <div className="muted small">{date(w.from, { day: '2-digit', month: '2-digit' })}</div>
                  </td>
                  <td>{dur(w.worked)}</td>
                  <td>{dur(w.vacation + w.sick + w.holiday)}</td>
                  <td>{dur(w.target)}</td>
                  <td className={`nowrap ${tone(w.delta) ?? ''}`}>{signed(w.delta)}</td>
                  <td className="nowrap">{signed(ledger.balanceAt(minDate(w.to, today)))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {adjustments.length > 0 && (
        <Card title={t('stats.adjustments')}>
          <ul className="plain">
            {adjustments.map((a, i) => (
              <li key={i}>
                {date(a.date, { day: '2-digit', month: '2-digit', year: 'numeric' })}: <strong className={tone(a.hours)}>{signed(a.hours)}</strong>
                {a.note && <span className="muted"> – {a.note}</span>}
              </li>
            ))}
          </ul>
          <p className="hint">{t('stats.adjustmentsHint')}</p>
        </Card>
      )}

      {profile.warnings.enabled && warnings.length > 0 && (
        <Card title={t('stats.warnings')}>
          <WarningList warnings={warnings.slice(-20).reverse()} />
        </Card>
      )}
    </div>
  );
}
