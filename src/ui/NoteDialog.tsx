import { useEffect, useState } from 'react';
import type { Session } from '../core/types';
import { sessionWorkMs } from '../core/worktime';
import { repo } from '../data/repo';
import { useI18n } from '../i18n';
import { useAppData } from './AppData';
import { Dialog, formatDuration, labelFor } from './common';

/** Optional note + thesis flag right after a session ended. */
export function NoteDialog({ session, onClose }: { session: Session | null; onClose: () => void }) {
  const { t } = useI18n();
  const { profile } = useAppData();
  const [note, setNote] = useState('');
  const [thesis, setThesis] = useState(false);

  useEffect(() => {
    setNote(session?.note ?? '');
    setThesis(session?.thesisRelevant ?? false);
  }, [session]);

  async function save() {
    if (session) await repo.saveSession({ ...session, note: note.trim(), thesisRelevant: thesis });
    onClose();
  }

  const label = session && labelFor(profile, session.areaId, session.categoryId);
  return (
    <Dialog open={!!session} title={t('note.title')} onClose={onClose}>
      {session && label && (
        <p className="muted">
          {label.area} · {label.category} · {formatDuration(sessionWorkMs(session, Date.now()), false)} h
        </p>
      )}
      <textarea rows={3} value={note} placeholder={t('note.placeholder')} onChange={(e) => setNote(e.target.value)} />
      <label className="check">
        <input type="checkbox" checked={thesis} onChange={(e) => setThesis(e.target.checked)} />
        {t('note.thesis')}
      </label>
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
