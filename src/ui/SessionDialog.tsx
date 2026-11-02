import { useEffect, useState } from 'react';
import { addDays, dayStartMs, MS_PER_MINUTE, toISODate } from '../core/dates';
import type { Session } from '../core/types';
import { repo } from '../data/repo';
import { useI18n } from '../i18n';
import { useAppData } from './AppData';
import { Dialog } from './common';

function hhmm(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function at(date: string, time: string): number {
  const [h, m] = time.split(':').map(Number);
  const d = new Date(dayStartMs(date));
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

interface Form {
  date: string;
  start: string;
  end: string;
  areaId: string;
  categoryId: string;
  breakMinutes: number;
  note: string;
  thesisRelevant: boolean;
}

/** Edit an existing session or add one manually (`session === 'new'`). */
export function SessionDialog({ session, onClose }: { session: Session | 'new' | null; onClose: () => void }) {
  const { t } = useI18n();
  const { profile, today } = useAppData();
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    if (!session) return setForm(null);
    if (session === 'new') {
      const area = profile.areas.find((a) => !a.hidden) ?? profile.areas[0];
      setForm({
        date: today,
        start: '09:00',
        end: '13:00',
        areaId: area.id,
        categoryId: area.categories.find((c) => !c.hidden)?.id ?? '',
        breakMinutes: 0,
        note: '',
        thesisRelevant: false,
      });
    } else {
      setForm({
        date: toISODate(new Date(session.start)),
        start: hhmm(session.start),
        end: session.end === null ? '' : hhmm(session.end),
        areaId: session.areaId,
        categoryId: session.categoryId,
        breakMinutes: Math.round(session.breakMinutes),
        note: session.note,
        thesisRelevant: session.thesisRelevant,
      });
    }
  }, [session, profile, today]);

  if (!form) return <Dialog open={false} title="" onClose={onClose}>{null}</Dialog>;
  const running = session !== 'new' && session?.end === null;
  const area = profile.areas.find((a) => a.id === form.areaId);
  const startMs = at(form.date, form.start);
  let endMs = form.end ? at(form.date, form.end) : null;
  const overnight = endMs !== null && endMs <= startMs;
  if (overnight && endMs !== null) endMs = at(addDays(form.date, 1), form.end);

  const update = (patch: Partial<Form>) => setForm({ ...form, ...patch });

  async function save() {
    if (!form || !session) return;
    if (!running && (endMs === null || endMs - startMs <= form.breakMinutes * MS_PER_MINUTE)) {
      setError(t('session.invalid'));
      return;
    }
    const data = {
      areaId: form.areaId,
      categoryId: form.categoryId,
      start: startMs,
      end: running ? null : endMs,
      breakMinutes: Math.max(0, form.breakMinutes),
      note: form.note.trim(),
      thesisRelevant: form.thesisRelevant,
    };
    if (session === 'new') await repo.addManualSession(data);
    else await repo.saveSession({ ...session, ...data });
    onClose();
  }

  async function remove() {
    if (session && session !== 'new' && confirm(t('common.confirmDelete'))) {
      await repo.deleteSession(session.id);
      onClose();
    }
  }

  return (
    <Dialog open title={session === 'new' ? t('session.new') : t('session.edit')} onClose={onClose}>
      <div className="form-grid">
        <label>
          {t('session.date')}
          <input type="date" value={form.date} onChange={(e) => update({ date: e.target.value })} />
        </label>
        <div className="row">
          <label>
            {t('session.start')}
            <input type="time" value={form.start} onChange={(e) => update({ start: e.target.value })} />
          </label>
          {!running && (
            <label>
              {t('session.end')}
              <input type="time" value={form.end} onChange={(e) => update({ end: e.target.value })} />
            </label>
          )}
          <label>
            {t('session.breakMinutes')}
            <input type="number" min={0} step={5} value={form.breakMinutes} onChange={(e) => update({ breakMinutes: Number(e.target.value) })} />
          </label>
        </div>
        {overnight && <p className="hint">{t('session.overnight')}</p>}
        <label>
          {t('session.area')}
          <select
            value={form.areaId}
            onChange={(e) => {
              const a = profile.areas.find((x) => x.id === e.target.value);
              update({ areaId: e.target.value, categoryId: a?.categories.find((c) => !c.hidden)?.id ?? '' });
            }}
          >
            {profile.areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('session.category')}
          <select value={form.categoryId} onChange={(e) => update({ categoryId: e.target.value })}>
            {area?.categories
              .filter((c) => !c.hidden || c.id === form.categoryId)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          {t('session.note')}
          <textarea rows={3} value={form.note} onChange={(e) => update({ note: e.target.value })} />
        </label>
        <label className="check">
          <input type="checkbox" checked={form.thesisRelevant} onChange={(e) => update({ thesisRelevant: e.target.checked })} />
          {t('session.thesis')}
        </label>
        {error && <p className="warning">{error}</p>}
      </div>
      <div className="dialog-actions">
        {session !== 'new' && (
          <button className="btn danger-text" onClick={remove}>
            {t('common.delete')}
          </button>
        )}
        <span className="spacer" />
        <button className="btn" onClick={onClose}>
          {t('common.cancel')}
        </button>
        <button className="btn primary" onClick={save}>
          {t('common.save')}
        </button>
      </div>
    </Dialog>
  );
}
