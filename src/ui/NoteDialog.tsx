import { useEffect, useMemo, useState } from 'react';
import type { Session } from '../core/types';
import { sessionWorkMs } from '../core/worktime';
import { repo } from '../data/repo';
import { useI18n } from '../i18n';
import { useAppData } from './AppData';
import { allowsThesisFlag, Dialog, labelFor } from './common';

/**
 * Note dialog for one or two sessions:
 *  - `finished`: the session that just ended (review its note)
 *  - `started`:  the session that just started or is running (what are you doing?)
 * On a switch both are shown in one dialog with a single save button.
 */
export interface NoteTarget {
  finished?: Session;
  started?: Session;
}

interface Draft {
  note: string;
  thesis: boolean;
}

const ASK_ON_START_KEY = 'timebank.askNoteOnStart';

/** Per-device preference: show the note dialog when a session starts (default on). */
export function askNoteOnStart(): boolean {
  try {
    return localStorage.getItem(ASK_ON_START_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function setAskNoteOnStart(value: boolean) {
  try {
    localStorage.setItem(ASK_ON_START_KEY, String(value));
  } catch {
    /* ignore */
  }
}

export function NoteDialog({ target, onClose }: { target: NoteTarget | null; onClose: () => void }) {
  const { t } = useI18n();
  const [finished, setFinished] = useState<Draft>({ note: '', thesis: false });
  const [started, setStarted] = useState<Draft>({ note: '', thesis: false });

  useEffect(() => {
    setFinished({ note: target?.finished?.note ?? '', thesis: target?.finished?.thesisRelevant ?? false });
    setStarted({ note: target?.started?.note ?? '', thesis: target?.started?.thesisRelevant ?? false });
  }, [target]);

  async function save() {
    // Write on top of the latest stored version (timer, pause or sync may have changed it).
    for (const [session, draft] of [
      [target?.finished, finished],
      [target?.started, started],
    ] as const) {
      if (!session) continue;
      const latest = (await repo.getSession(session.id)) ?? session;
      const note = draft.note.trim();
      if (note !== latest.note || draft.thesis !== latest.thesisRelevant) {
        await repo.saveSession({ ...latest, note, thesisRelevant: draft.thesis });
      }
    }
    onClose();
  }

  const both = !!target?.finished && !!target?.started;
  const title = both
    ? t('note.titleSwitch')
    : target?.finished
      ? t('note.title')
      : target?.started?.end === null && target.started.start < Date.now() - 60_000
        ? t('note.titleEdit')
        : t('note.titleStart');

  return (
    <Dialog open={!!target && (!!target.finished || !!target.started)} title={title} onClose={onClose}>
      {target?.finished && (
        <NoteSection
          heading={both ? t('note.finished') : undefined}
          session={target.finished}
          draft={finished}
          onChange={setFinished}
          placeholder={t('note.placeholderDone')}
        />
      )}
      {both && <hr className="divider" />}
      {target?.started && (
        <NoteSection
          heading={both ? t('note.started') : undefined}
          session={target.started}
          draft={started}
          onChange={setStarted}
          placeholder={t('note.placeholder')}
          autoFocus={!target.finished}
        />
      )}
      <div className="dialog-actions">
        <button className="btn" onClick={onClose}>
          {t('common.skip')}
        </button>
        <button className="btn primary" onClick={save}>
          {t('common.save')}
        </button>
      </div>
    </Dialog>
  );
}

function NoteSection({
  heading,
  session,
  draft,
  onChange,
  placeholder,
  autoFocus,
}: {
  heading?: string;
  session: Session;
  draft: Draft;
  onChange: (d: Draft) => void;
  placeholder: string;
  autoFocus?: boolean;
}) {
  const { t, dur } = useI18n();
  const { profile, sessions } = useAppData();
  const label = labelFor(profile, session.areaId, session.categoryId);

  // Last distinct notes used in the same area and category.
  const suggestions = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const s of [...sessions].sort((a, b) => b.start - a.start)) {
      if (s.id === session.id || s.areaId !== session.areaId || s.categoryId !== session.categoryId) continue;
      const note = s.note.trim();
      if (!note || seen.has(note)) continue;
      seen.add(note);
      result.push(note);
      if (result.length === 3) break;
    }
    return result;
  }, [sessions, session]);

  return (
    <div className="note-section">
      {heading && <div className="note-heading">{heading}</div>}
      <p className="muted small note-label">
        <span className="dot" style={{ background: label.color }} /> {label.area} · {label.category}
        {session.end !== null && ` · ${dur(sessionWorkMs(session, Date.now()) / 3_600_000)}`}
      </p>
      <textarea rows={2} value={draft.note} placeholder={placeholder} autoFocus={autoFocus} onChange={(e) => onChange({ ...draft, note: e.target.value })} />
      {suggestions.length > 0 && (
        <div className="chips suggestions" aria-label={t('note.suggestions')}>
          {suggestions
            .filter((s) => s !== draft.note.trim())
            .map((s) => (
              <button key={s} className="chip small" onClick={() => onChange({ ...draft, note: s })} title={s}>
                {s.length > 40 ? `${s.slice(0, 40)}…` : s}
              </button>
            ))}
        </div>
      )}
      {allowsThesisFlag(profile, session.areaId) && (
        <label className="check">
          <input type="checkbox" checked={draft.thesis} onChange={(e) => onChange({ ...draft, thesis: e.target.checked })} />
          {t('note.thesis')}
        </label>
      )}
    </div>
  );
}
