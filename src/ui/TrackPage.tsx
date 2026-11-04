import { useState } from 'react';
import { addDays, endOfWeek, startOfWeek } from '../core/dates';
import type { Session } from '../core/types';
import { dayWarnings, isUnusuallyLong } from '../core/warnings';
import { sessionBreakMs, sessionWorkMs } from '../core/worktime';
import { repo } from '../data/repo';
import { useI18n } from '../i18n';
import { useAppData, useNow } from './AppData';
import { Card, formatDuration, labelFor, Segmented, Stat, tone } from './common';
import { askNoteOnStart, NoteDialog, type NoteTarget } from './NoteDialog';
import { WarningList } from './WarningList';

export function TrackPage() {
  const { t, signed, dur, time, date } = useI18n();
  const { profile, running, ledger, today, sessions } = useAppData();
  const now = useNow(1000);
  // A session ended with the pause button (shown as "on break" until resumed).
  const onBreak = running ? undefined : sessions.filter((s) => s.onBreak).sort((a, b) => (b.end ?? 0) - (a.end ?? 0))[0];
  const [noteTarget, setNoteTarget] = useState<NoteTarget | null>(null);
  const locations = profile.workLocations ?? [];
  const [preferredLocation, setPreferredLocation] = useState(loadLocation);
  const location = locations.some((l) => l.id === preferredLocation) ? preferredLocation : locations[0]?.id;
  const shownLocation = running ? (running.locationId ?? '') : (location ?? '');

  async function start(areaId: string, categoryId: string) {
    if (running && running.areaId === areaId && running.categoryId === categoryId) return;
    // Time starts immediately; the note dialog opens afterwards.
    const stopped = await repo.start(areaId, categoryId, Date.now(), running?.locationId ?? location);
    const started = askNoteOnStart() ? await repo.running() : undefined;
    if (stopped || started) setNoteTarget({ finished: stopped, started });
  }

  async function chooseLocation(id: string) {
    setPreferredLocation(id);
    saveLocation(id);
    if (running) await repo.setRunningLocation(id);
  }

  async function stop() {
    const stopped = await repo.stop();
    if (stopped) setNoteTarget({ finished: stopped });
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

      <Card className={`timer ${running ? (running.pausedAt ? 'paused' : 'running') : onBreak ? 'paused' : 'idle'}`}>
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
            <button className={`timer-note ${running.note ? '' : 'empty'}`} onClick={() => setNoteTarget({ started: running })}>
              {running.note || `+ ${t('note.add')}`}
              {running.thesisRelevant && <span className="badge">Thesis</span>}
            </button>
            {profile.warnings.enabled && isUnusuallyLong(profile, running, now) && (
              <p className="warning">{t('track.longSession', { hours: dur(profile.warnings.longSessionHours) })}</p>
            )}
            <div className="timer-actions">
              <button className="btn big" onClick={() => (running.pausedAt ? repo.togglePause() : repo.pause())}>
                {running.pausedAt ? t('track.resume') : t('track.pause')}
              </button>
              <button className="btn big danger" onClick={stop}>
                {t('track.stop')}
              </button>
            </div>
          </>
        ) : onBreak && onBreak.end !== null ? (
          <BreakCard session={onBreak} now={now} />
        ) : (
          <p className="muted center">{t('track.idle')}</p>
        )}
      </Card>

      <div className="stats-row">
        <Stat label={t('track.today')} value={`${dur(day.actual)} / ${dur(day.target)}`} />
        <Stat label={t('track.week')} value={`${dur(week.actual)} / ${dur(week.target)}`} />
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

      <NoteDialog target={noteTarget} onClose={() => setNoteTarget(null)} />
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

/** Shown while on break: time since the pause started, resume or end the break. */
function BreakCard({ session, now }: { session: Session; now: number }) {
  const { t, time } = useI18n();
  const { profile } = useAppData();
  const label = labelFor(profile, session.areaId, session.categoryId);
  return (
    <>
      <div className="timer-label">
        <span className="dot pause-dot" />
        <strong>{t('track.onBreak')}</strong>
      </div>
      <div className="timer-clock" aria-live="polite">
        {formatDuration(now - (session.end ?? now))}
      </div>
      <div className="timer-meta">
        {t('track.breakSince', { time: time(session.end ?? now) })} · {t('track.resumeWith', { area: label.area, category: label.category })}
      </div>
      <div className="timer-actions">
        <button className="btn big primary" onClick={() => repo.resume()}>
          {t('track.resume')}
        </button>
        <button className="btn big" onClick={() => repo.endBreak()}>
          {t('track.endBreak')}
        </button>
      </div>
    </>
  );
}
