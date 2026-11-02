import { useState } from 'react';
import example from '../../profiles/example.json';
import type { Profile } from '../core/types';
import { repo } from '../data/repo';
import { parseProfile, parseProfileJson } from '../profile/schema';
import { useI18n } from '../i18n';
import { Dialog, download, pickTextFile } from './common';

/** Imports and validates a profile JSON, saving it on success. Returns errors on failure. */
export async function importProfileText(text: string): Promise<string[] | null> {
  const result = parseProfileJson(text);
  if (!result.ok) return result.errors;
  await repo.saveProfile(result.profile);
  return null;
}

export async function loadExampleProfile(): Promise<void> {
  const result = parseProfile(example);
  if (result.ok) await repo.saveProfile(result.profile);
}

export function exportProfile(profile: Profile) {
  const slug = profile.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'profile';
  download(`${slug}.timebank-profile.json`, JSON.stringify(profile, null, 2));
}

export function ImportProfileButton({ label, className = 'btn' }: { label: string; className?: string }) {
  const [errors, setErrors] = useState<string[] | null>(null);
  const { t } = useI18n();
  return (
    <>
      <button
        className={className}
        onClick={async () => {
          const text = await pickTextFile();
          if (text !== null) setErrors(await importProfileText(text));
        }}
      >
        {label}
      </button>
      <Dialog open={!!errors} title={t('common.error')} onClose={() => setErrors(null)}>
        <ul className="errors">{errors?.map((e) => <li key={e}>{e}</li>)}</ul>
        <div className="dialog-actions">
          <button className="btn" onClick={() => setErrors(null)}>
            {t('common.close')}
          </button>
        </div>
      </Dialog>
    </>
  );
}

/** Raw JSON editor for everything that has no dedicated form (period, phases, …). */
export function ProfileJsonDialog({ profile, open, onClose }: { profile: Profile; open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const [text, setText] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setText(JSON.stringify(profile, null, 2));
      setErrors([]);
    }
  }

  async function save() {
    const errs = await importProfileText(text);
    if (errs) setErrors(errs);
    else onClose();
  }

  return (
    <Dialog open={open} title={t('settings.editJson')} onClose={onClose}>
      <textarea className="code" rows={18} spellCheck={false} value={text} onChange={(e) => setText(e.target.value)} />
      {errors.length > 0 && <ul className="errors">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
      <div className="dialog-actions">
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
