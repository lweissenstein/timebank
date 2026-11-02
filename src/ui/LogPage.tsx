import { useMemo, useState } from 'react';
import { toISODate } from '../core/dates';
import type { Session } from '../core/types';
import { breakMinutesOf, sessionWorkMs } from '../core/worktime';
import { useI18n } from '../i18n';
import { useAppData } from './AppData';
import { download, formatDuration, labelFor } from './common';
import { SessionDialog } from './SessionDialog';

const PAGE_DAYS = 21;

export function LogPage() {
  const { t, date, time } = useI18n();
  const { profile, sessions, now } = useAppData();
  const [areaFilter, setAreaFilter] = useState('');
  const [thesisOnly, setThesisOnly] = useState(false);
  const [query, setQuery] = useState('');
  const [days, setDays] = useState(PAGE_DAYS);
  const [editing, setEditing] = useState<Session | 'new' | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sessions
      .filter((s) => (!areaFilter || s.areaId === areaFilter) && (!thesisOnly || s.thesisRelevant) && (!q || s.note.toLowerCase().includes(q)))
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
    const lines = [...filtered]
      .reverse()
      .map((s) => {
        const l = labelFor(profile, s.areaId, s.categoryId);
        return `- ${toISODate(new Date(s.start))} · ${l.area} / ${l.category} (${formatDuration(sessionWorkMs(s, now), false)} h)${s.note ? `: ${s.note}` : ''}`;
      });
    download(`timebank-notes-${toISODate(new Date())}.md`, `# Notes\n\n${lines.join('\n')}\n`, 'text/markdown');
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
        <select value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)} aria-label={t('log.filterArea')}>
          <option value="">
            {t('log.filterArea')}: {t('common.all')}
          </option>
          {profile.areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <input type="search" placeholder={t('log.search')} value={query} onChange={(e) => setQuery(e.target.value)} />
        <label className="check">
          <input type="checkbox" checked={thesisOnly} onChange={(e) => setThesisOnly(e.target.checked)} />
          {t('log.thesisOnly')}
        </label>
      </div>

      {groups.length === 0 && <p className="muted center">{t('log.empty')}</p>}
      {groups.slice(0, days).map(([day, list]) => {
        const total = list.reduce((sum, s) => sum + sessionWorkMs(s, now), 0);
        return (
          <section key={day} className="day-group">
            <header>
              <span>{date(day, { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
              <span>
                {formatDuration(total, false)} h · {t('log.breakShort', { min: Math.round(breakMinutesOf(list, now)) })}
              </span>
            </header>
            <ul className="session-list">
              {list.map((s) => {
                const l = labelFor(profile, s.areaId, s.categoryId);
                return (
                  <li key={s.id}>
                    <button className="session-row" onClick={() => setEditing(s)}>
                      <span className="dot" style={{ background: l.color }} />
                      <span className="session-main">
                        <span>
                          <strong>{l.area}</strong> · {l.category}
                          {s.thesisRelevant && <span className="badge">Thesis</span>}
                        </span>
                        {s.note && <span className="session-note">{s.note}</span>}
                      </span>
                      <span className="session-time">
                        <span>{formatDuration(sessionWorkMs(s, now), false)}</span>
                        <span className="muted">
                          {time(s.start)}–{s.end === null ? t('log.running') : time(s.end)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
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
