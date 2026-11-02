import { useMemo, useState } from 'react';
import { toISODate } from '../core/dates';
import type { Session } from '../core/types';
import { pausesOfDay, sessionWorkMs, type PauseItem } from '../core/worktime';
import { useI18n } from '../i18n';
import { useAppData } from './AppData';
import { download, labelFor, Segmented } from './common';
import { Donut } from './Donut';
import { SessionDialog } from './SessionDialog';

const PAGE_DAYS = 21;
const VIEW_KEY = 'timebank.logView';
type View = 'detail' | 'summary';

function loadView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === 'summary' ? 'summary' : 'detail';
  } catch {
    return 'detail';
  }
}

export function LogPage() {
  const { t, date, time, dur } = useI18n();
  const { profile, sessions, now } = useAppData();
  const [areaFilter, setAreaFilter] = useState('');
  const [thesisOnly, setThesisOnly] = useState(false);
  const [query, setQuery] = useState('');
  const [days, setDays] = useState(PAGE_DAYS);
  const [editing, setEditing] = useState<Session | 'new' | null>(null);
  const [view, setViewState] = useState<View>(loadView);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const setView = (v: View) => {
    setViewState(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* ignore */
    }
  };
  const showPauses = !areaFilter && !thesisOnly && !query.trim();
  const toggleDay = (day: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sessions
      .filter(
        (s) =>
          (!areaFilter || s.areaId === areaFilter) &&
          (!thesisOnly || s.thesisRelevant) &&
          (!q || s.note.toLowerCase().includes(q)),
      )
      .sort((a, b) => b.start - a.start);
  }, [sessions, areaFilter, thesisOnly, query]);

  const groups = useMemo(() => {
    const map = new Map<string, Session[]>();
    for (const s of filtered) {
      const d = toISODate(new Date(s.start));
      map.set(d, [...(map.get(d) ?? []), s]);
    }
    return [...map];
  }, [filtered]);

  function exportNotes() {
    const lines = [...filtered].reverse().map((s) => {
      const l = labelFor(profile, s.areaId, s.categoryId);
      return `- ${toISODate(new Date(s.start))} · ${l.area} / ${l.category} (${dur(sessionWorkMs(s, now) / 3_600_000)})${s.note ? `: ${s.note}` : ''}`;
    });
    download(
      `timebank-notes-${toISODate(new Date())}.md`,
      `# Notes\n\n${lines.join('\n')}\n`,
      'text/markdown',
    );
  }

  return (
    <div className="page">
      <div className="toolbar">
        <button className="btn primary" onClick={() => setEditing('new')}>
          + {t('log.add')}
        </button>
        <button className="btn" onClick={exportNotes} disabled={filtered.length === 0}>
          {t('log.exportNotes')}
        </button>
      </div>
      <div className="filters">
        <select
          value={areaFilter}
          onChange={(e) => setAreaFilter(e.target.value)}
          aria-label={t('log.filterArea')}
        >
          <option value="">
            {t('log.filterArea')}: {t('common.all')}
          </option>
          {profile.areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <input
          type="search"
          placeholder={t('log.search')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <label className="check">
          <input
            type="checkbox"
            checked={thesisOnly}
            onChange={(e) => setThesisOnly(e.target.checked)}
          />
          {t('log.thesisOnly')}
        </label>
      </div>

      <Segmented<View>
        value={view}
        onChange={setView}
        options={[
          { value: 'detail', label: t('log.viewDetail') },
          { value: 'summary', label: t('log.viewSummary') },
        ]}
      />

      {groups.length === 0 && <p className="muted center">{t('log.empty')}</p>}
      {groups.slice(0, days).map(([day, list]) => {
        const counting = (s: Session) =>
          profile.areas.find((a) => a.id === s.areaId)?.countsAsWork ?? false;
        const work = list.filter(counting).reduce((sum, s) => sum + sessionWorkMs(s, now), 0);
        const other = list
          .filter((s) => !counting(s))
          .reduce((sum, s) => sum + sessionWorkMs(s, now), 0);
        const open = expanded.has(day);
        const pauses = pausesOfDay(list, counting, now);
        const pauseMinutes = pauses.reduce((sum, p) => sum + p.minutes, 0);
        // Pauses only make sense on the unfiltered timeline of a day.
        const timeline: (
          { kind: 'session'; s: Session; at: number } | { kind: 'pause'; p: PauseItem; at: number }
        )[] = [
          ...list.map((s) => ({ kind: 'session' as const, s, at: s.start })),
          ...(showPauses ? pauses.map((p) => ({ kind: 'pause' as const, p, at: p.at })) : []),
        ].sort((a, b) => b.at - a.at || (a.kind === 'pause' ? -1 : 1));
        const byArea = profile.areas
          .map((a) => ({
            id: a.id,
            name: a.name,
            color: a.color,
            ms: list
              .filter((s) => s.areaId === a.id)
              .reduce((sum, s) => sum + sessionWorkMs(s, now), 0),
          }))
          .filter((a) => a.ms > 0);
        return (
          <section key={day} className={`day-group ${view}`}>
            {view === 'summary' ? (
              <button className="day-summary" onClick={() => toggleDay(day)} aria-expanded={open}>
                <span className="day-summary-main">
                  <span className="day-title">
                    {date(day, { weekday: 'long', day: '2-digit', month: '2-digit' })}
                  </span>
                  <span className="day-total">{dur(work / 3_600_000)}</span>
                  {other > 0 && (
                    <span className="muted small">
                      + {dur(other / 3_600_000)} {t('common.notCounted')}
                    </span>
                  )}
                  <span className="legend">
                    {byArea.map((a) => (
                      <span key={a.id} className="legend-item">
                        <span className="dot" style={{ background: a.color }} /> {a.name}{' '}
                        {dur(a.ms / 3_600_000)}
                      </span>
                    ))}
                    {showPauses && pauseMinutes >= 1 && (
                      <span className="legend-item">
                        <span className="dot pause-dot" /> {t('log.pause')} {dur(pauseMinutes / 60)}
                      </span>
                    )}
                  </span>
                </span>
                <Donut
                  segments={[
                    ...byArea.map((a) => ({
                      value: a.ms,
                      color: a.color,
                      label: `${a.name}: ${dur(a.ms / 3_600_000)}`,
                    })),
                    ...(showPauses && pauseMinutes >= 1
                      ? [
                          {
                            value: pauseMinutes * 60_000,
                            color: 'var(--pause)',
                            label: `${t('log.pause')}: ${dur(pauseMinutes / 60)}`,
                          },
                        ]
                      : []),
                  ]}
                />
              </button>
            ) : (
              <header>
                <span className="day-title">
                  {date(day, {
                    weekday: 'long',
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })}
                </span>
                <span className="day-sum">
                  <strong>{dur(work / 3_600_000)}</strong>
                  {other > 0 && ` + ${dur(other / 3_600_000)} ${t('common.notCounted')}`} ·{' '}
                  {t('log.breakShort', { min: dur(pauseMinutes / 60) })}
                </span>
              </header>
            )}
            {(view === 'detail' || open) && (
              <ul className="session-list">
                {timeline.map((entry) => {
                  if (entry.kind === 'pause') {
                    const p = entry.p;
                    const owner = p.sessionId ? list.find((x) => x.id === p.sessionId) : undefined;
                    const content = (
                      <>
                        <span className="dot pause-dot" />
                        <span className="session-main">
                          <span>
                            <strong>{t('log.pause')}</strong>
                            {p.running && <span className="badge">{t('log.running')}</span>}
                          </span>
                          {!p.sessionId && (
                            <span className="session-note">{t('log.pauseGap')}</span>
                          )}
                        </span>
                        <span className="session-time">
                          <span>{dur(p.minutes / 60)}</span>
                          <span className="muted">
                            {p.start === null
                              ? t('log.pauseNoTime')
                              : `${time(p.start)}–${p.end === null ? t('log.running') : time(p.end)}`}
                          </span>
                        </span>
                      </>
                    );
                    return (
                      <li key={`pause-${p.at}-${p.sessionId ?? 'gap'}`} className="pause-item">
                        {owner ? (
                          <button className="session-row" onClick={() => setEditing(owner)}>
                            {content}
                          </button>
                        ) : (
                          <div className="session-row">{content}</div>
                        )}
                      </li>
                    );
                  }
                  const s = entry.s;
                  const l = labelFor(profile, s.areaId, s.categoryId);
                  return (
                    <li key={s.id}>
                      <button className="session-row" onClick={() => setEditing(s)}>
                        <span className="dot" style={{ background: l.color }} />
                        <span className="session-main">
                          <span>
                            <strong>{l.area}</strong> · {l.category}
                            {s.thesisRelevant && <span className="badge">Thesis</span>}
                            {s.locationId && (
                              <span className="badge">
                                {profile.workLocations?.find((l) => l.id === s.locationId)?.name ??
                                  s.locationId}
                              </span>
                            )}
                          </span>
                          {s.note && <span className="session-note">{s.note}</span>}
                        </span>
                        <span className="session-time">
                          <span>{dur(sessionWorkMs(s, now) / 3_600_000)}</span>
                          <span className="muted">
                            {time(s.start)}–{s.end === null ? t('log.running') : time(s.end)}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
      {groups.length > days && (
        <button className="btn wide" onClick={() => setDays(days + PAGE_DAYS)}>
          {t('log.more')}
        </button>
      )}
      <SessionDialog session={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
