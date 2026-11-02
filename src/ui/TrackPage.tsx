import { useState } from 'react';
import { addDays, endOfWeek, startOfWeek } from '../core/dates';
import type { Session } from '../core/types';
import { dayWarnings, isUnusuallyLong } from '../core/warnings';
import { sessionBreakMs, sessionWorkMs } from '../core/worktime';
import { repo } from '../data/repo';
import { useI18n } from '../i18n';
import { useAppData, useNow } from './AppData';
import { Card, formatDuration, labelFor, Segmented, Stat, tone } from './common';
import { NoteDialog } from './NoteDialog';
import { WarningList } from './WarningList';

export function TrackPage() {
  const { t, signed, num, time, date } = useI18n();
  const { profile, running, ledger, today, sessions } = useAppData();
  const now = useNow(1000);
  const [finished, setFinished] = useState<Session | null>(null);
  const locations = profile.workLocations ?? [];
  const [preferredLocation, setPreferredLocation] = useState(loadLocation);
  const location = locations.some((l) => l.id === preferredLocation) ? preferredLocation : locations[0]?.id;
  const shownLocation = running ? (running.locationId ?? '') : (location ?? '');

  async function start(areaId: string, categoryId: string) {
    if (running && running.areaId === areaId && running.categoryId === categoryId) return;
    const stopped = await repo.start(areaId, categoryId, Date.now(), running?.locationId ?? location);
    if (stopped) setFinished(stopped);
  }

  async function chooseLocation(id: string) {
    setPreferredLocation(id);
    saveLocation(id);
    if (running) await repo.setRunningLocation(id);
  }

  async function stop() {
    const stopped = await repo.stop();
    if (stopped) setFinished(stopped);
  }

  const week = ledger.week(startOfWeek(today));
  const day = ledger.day(today);
  const label = running && labelFor(profile, running.areaId, running.categoryId);
  const inPeriod = ledger.inPeriod(today);
  const closedBalance = ledger.balanceAt(addDays(today, -1));
  const todayWarnings = dayWarnings(profile, sessions, now).filter((w) => w.date === today);

  return (
    <div className="page">
      {!inPeriod && (
        <p className="notice">
          {t('track.outsidePeriod', { from: date(profile.period.start), to: date(profile.period.end) })}
        </p>
      )}

      <Card className={`timer ${running ? (running.pausedAt ? 'paused' : 'running') : 'idle'}`}>
        {running && label ? (
          <>
            <div className="timer-label">
              <span className="dot" style={{ background: label.color }} />
              <span>
                <strong>{label.area}</strong> · {label.category}
              </span>
            </div>
            <div className="timer-clock" aria-live="polite">
              {formatDuration(sessionWorkMs(running, now))}
            </div>
            <div className="timer-meta">
              {running.pausedAt ? t('track.paused') : t('track.running')} · {t('track.since', { time: time(running.start) })}
              {running.locationId && ` · ${locations.find((l) => l.id === running.locationId)?.name ?? running.locationId}`}
              {sessionBreakMs(running, now) > 0 && ` · ${t('track.break', { min: Math.round(sessionBreakMs(running, now) / 60000) })}`}
            </div>
            {profile.warnings.enabled && isUnusuallyLong(profile, running, now) && (
              <p className="warning">{t('track.longSession', { hours: profile.warnings.longSessionHours })}</p>
            )}
            <div className="timer-actions">
              <button className="btn big" onClick={() => repo.togglePause()}>
                {running.pausedAt ? t('track.resume') : t('track.pause')}
              </button>
              <button className="btn big danger" onClick={stop}>
                {t('track.stop')}
              </button>
            </div>
          </>
        ) : (
          <p className="muted center">{t('track.idle')}</p>
        )}
      </Card>

      <div className="stats-row">
        <Stat label={t('track.today')} value={`${num(day.actual)} / ${num(day.target)} h`} />
        <Stat label={t('track.week')} value={`${num(week.actual)} / ${num(week.target)} h`} />
        <Stat label={t('track.balanceYesterday')} value={signed(closedBalance)} tone={tone(closedBalance)} />
      </div>

      {profile.warnings.enabled && <WarningList warnings={todayWarnings} />}

      {locations.length > 0 && (
        <div className="location">
          <span className="hint">{t('track.location')}</span>
          <Segmented value={shownLocation} onChange={chooseLocation} options={locations.map((l) => ({ value: l.id, label: l.name }))} />
        </div>
      )}

      <p className="hint">{t('track.tapToSwitch')}</p>
      {profile.areas
        .filter((a) => !a.hidden)
        .map((area) => (
          <Card
            key={area.id}
            className="area-card"
            title={
              <>
                <span className="dot" style={{ background: area.color }} /> {area.name}
                {!area.countsAsWork && <span className="badge">{t('common.notCounted')}</span>}
              </>
            }
          >
            <div className="chips">
              {area.categories
                .filter((c) => !c.hidden)
                .map((c) => {
                  const active = running?.areaId === area.id && running.categoryId === c.id;
                  return (
                    <button
                      key={c.id}
                      className={`chip ${active ? 'active' : ''}`}
                      style={active ? { background: area.color, borderColor: area.color } : { borderColor: area.color }}
                      onClick={() => start(area.id, c.id)}
                    >
                      {c.name}
                    </button>
                  );
                })}
            </div>
          </Card>
        ))}
      <p className="hint muted">
        {date(startOfWeek(today))} – {date(endOfWeek(today))}: {signed(week.delta)}
      </p>

      <NoteDialog session={finished} onClose={() => setFinished(null)} />
    </div>
  );
}

const LOCATION_KEY = 'timebank.location';

function loadLocation(): string | undefined {
  try {
    return localStorage.getItem(LOCATION_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

function saveLocation(id: string) {
  try {
    localStorage.setItem(LOCATION_KEY, id);
  } catch {
    /* ignore */
  }
}
