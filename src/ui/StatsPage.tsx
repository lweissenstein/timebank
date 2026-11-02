import { useMemo, useState } from 'react';
import { addDays, endOfMonth, endOfWeek, isoWeek, maxDate, minDate, startOfMonth, startOfWeek, type ISODate } from '../core/dates';
import { balanceCurve, forecast, phaseAt, requiredToBalance } from '../core/plan';
import { breakdown } from '../core/reports';
import { dayWarnings } from '../core/warnings';
import { useI18n } from '../i18n';
import { useAppData } from './AppData';
import { BalanceChart } from './BalanceChart';
import { Card, Segmented, Stat, tone } from './common';
import { WarningList } from './WarningList';

type Scope = 'week' | 'month' | 'phase' | 'total';

export function StatsPage() {
  const { t, num, signed, date } = useI18n();
  const { profile, ledger, sessions, today, now } = useAppData();
  const [scope, setScope] = useState<Scope>('week');
  const [anchor, setAnchor] = useState<ISODate>(() => minDate(maxDate(today, profile.period.start), profile.period.end));
  const [phaseIndex, setPhaseIndex] = useState(() => {
    const i = profile.phases.findIndex((p) => today >= p.start && today <= p.end);
    return i < 0 ? 0 : i;
  });

  const balance = ledger.balanceAt(addDays(today, -1));
  const balanceIfStopNow = ledger.balanceAt(today);
  const day = ledger.day(today);
  const week = ledger.week(startOfWeek(today));
  const curve = useMemo(() => balanceCurve(ledger, today), [ledger, today]);
  const forecastDates = [...profile.milestones.map((m) => ({ date: m.date, name: m.name })), { date: addDays(profile.period.end, 1), name: t('stats.periodEnd') }];
  const forecasts = forecast(ledger, today, forecastDates.map((f) => f.date));
  const required = requiredToBalance(ledger, today);
  const currentPhase = phaseAt(profile.phases, today);
  const warnings = useMemo(() => dayWarnings(profile, sessions, now), [profile, sessions, now]);

  // ----- range for the breakdown -----
  let from: ISODate = profile.period.start;
  let to: ISODate = profile.period.end;
  let rangeLabel = t('stats.total');
  const phase = profile.phases[phaseIndex];
  if (scope === 'week') {
    from = startOfWeek(anchor);
    to = endOfWeek(anchor);
    rangeLabel = `${t('stats.cw')} ${isoWeek(anchor).week} · ${date(from)} – ${date(to)}`;
  } else if (scope === 'month') {
    from = startOfMonth(anchor);
    to = endOfMonth(anchor);
    rangeLabel = date(from, { month: 'long', year: 'numeric' });
  } else if (scope === 'phase' && phase) {
    from = phase.start;
    to = phase.end;
    rangeLabel = `${phase.name} · ${date(from)} – ${date(to)}`;
  }
  const totals = ledger.range(from, to);
  const parts = breakdown(profile.areas, sessions, from, to, now);
  const maxArea = Math.max(1, ...parts.areas.map((a) => a.hours));

  function step(dir: -1 | 1) {
    if (scope === 'week') setAnchor(addDays(anchor, 7 * dir));
    else if (scope === 'month') {
      const d = new Date(`${startOfMonth(anchor)}T00:00`);
      d.setMonth(d.getMonth() + dir);
      setAnchor(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`);
    } else if (scope === 'phase') setPhaseIndex(Math.min(Math.max(0, phaseIndex + dir), profile.phases.length - 1));
  }

  const weeks = ledger.weeks(profile.period.start, endOfWeek(today));

  return (
    <div className="page">
      <Card>
        <div className="hero">
          <div className="stat-label">{t('stats.balance')}</div>
          <div className={`hero-value ${tone(balance) ?? ''}`}>{signed(balance)}</div>
          <div className="muted small">{t('stats.balanceHint')}</div>
          <div className="muted small">
            {t('stats.todaySoFar', { actual: num(day.actual), target: num(day.target), balance: signed(balanceIfStopNow) })}
          </div>
          <div className="muted small">
            {t('stats.thisWeek')}: {num(week.actual)} / {num(week.target)} h ({signed(week.delta)})
          </div>
          {currentPhase && <div className="muted small">{t('stats.currentPhase', { name: currentPhase.name })}</div>}
        </div>
      </Card>

      <Card title={t('stats.forecast')}>
        <table className="table">
          <thead>
            <tr>
              <th />
              <th>{t('stats.byPlan')}</th>
              <th>{t('stats.byPace')}</th>
            </tr>
          </thead>
          <tbody>
            {forecasts.map((f, i) => (
              <tr key={f.date}>
                <td>
                  {forecastDates[i].name}
                  <div className="muted small">{date(f.date)}</div>
                </td>
                <td className={`nowrap ${tone(f.byPlan) ?? ''}`}>{signed(f.byPlan)}</td>
                <td className={`nowrap ${f.byPace === null ? 'muted' : (tone(f.byPace) ?? '')}`}>{f.byPace === null ? '–' : signed(f.byPace)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {today <= profile.period.end && (
        <Card title={t('stats.required', { date: date(profile.period.end) })} className={currentPhase?.plannedHoursPerWeek === 'zero-balance' ? 'highlight' : ''}>
          <p>
            {required.totalHours > 0
              ? t('stats.requiredText', { total: num(required.totalHours), perWeek: num(required.perWeek), perDay: num(required.perFreeWorkday) })
              : t('stats.surplusText', { hours: num(-required.totalHours) })}
          </p>
        </Card>
      )}

      <Card title={t('stats.chart')}>
        <BalanceChart points={curve} today={today} />
      </Card>

      <Card title={t('stats.breakdown')}>
        <Segmented<Scope>
          value={scope}
          onChange={setScope}
          options={[
            { value: 'week', label: t('stats.week') },
            { value: 'month', label: t('stats.month') },
            { value: 'phase', label: t('stats.phase') },
            { value: 'total', label: t('stats.total') },
          ]}
        />
        {scope === 'phase' && profile.phases.length === 0 ? (
          <p className="muted">{t('stats.noPhase')}</p>
        ) : (
          <>
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
              <Stat label={t('stats.target')} value={`${num(totals.target)} h`} />
              <Stat label={t('stats.actualHours')} value={`${num(totals.actual)} h`} />
              <Stat label={t('stats.delta')} value={signed(totals.delta)} tone={tone(totals.delta)} />
              <Stat label={t('stats.worked')} value={`${num(totals.worked)} h`} />
              <Stat label={`${t('stats.vacation')} / ${t('stats.sick')}`} value={`${num(totals.vacation + totals.sick)} h`} />
              <Stat label={t('stats.holiday')} value={`${num(totals.holiday)} h`} />
            </div>
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
                        <span className="bar-value">{num(a.hours)} h</span>
                      </summary>
                      {a.categories.map((c) => (
                        <div key={c.categoryId} className="bar-sub">
                          <span>{area?.categories.find((x) => x.id === c.categoryId)?.name ?? c.categoryId}</span>
                          <span>{num(c.hours)} h</span>
                        </div>
                      ))}
                    </details>
                  );
                })}
              </div>
            )}
          </>
        )}
      </Card>

      <Card title={t('stats.weeks')}>
        <div className="table-wrap">
          <table className="table compact">
            <thead>
              <tr>
                <th>{t('stats.cw')}</th>
                <th>{t('stats.target')}</th>
                <th>{t('stats.worked')}</th>
                <th>{t('stats.absent')}</th>
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
                  <td>{num(w.target)}</td>
                  <td>{num(w.worked)}</td>
                  <td>{num(w.vacation + w.sick + w.holiday)}</td>
                  <td className={`nowrap ${tone(w.delta) ?? ''}`}>{signed(w.delta)}</td>
                  <td className="nowrap">{signed(ledger.balanceAt(minDate(w.to, today)))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {profile.warnings.enabled && warnings.length > 0 && (
        <Card title={t('stats.warnings')}>
          <WarningList warnings={warnings.slice(-20).reverse()} />
        </Card>
      )}
    </div>
  );
}
