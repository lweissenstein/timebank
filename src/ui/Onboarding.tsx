import { useState } from 'react';
import { addDays, today } from '../core/dates';
import { repo } from '../data/repo';
import { listCountries, listRegions } from '../data/holidayCalendar';
import { parseProfile } from '../profile/schema';
import { useI18n, type Lang } from '../i18n';
import { Card, pickTextFile } from './common';
import { ImportProfileButton, loadExampleProfile } from './ProfileTools';
import { SyncSettings } from './SyncSettings';

export function Onboarding() {
  const { t, lang, setLang } = useI18n();
  const [form, setForm] = useState({
    name: '',
    start: today(),
    end: addDays(today(), 364),
    weeklyHours: 40,
    vacationDays: 25,
    startBalance: 0,
    country: 'DE',
    region: '',
  });
  const [errors, setErrors] = useState<string[]>([]);

  async function createProfile() {
    const r = parseProfile({
      name: form.name || 'Timebank',
      locale: lang,
      period: { start: form.start, end: form.end, startBalanceHours: form.startBalance },
      contract: { weeklyHours: form.weeklyHours },
      vacation: { daysPerYear: form.vacationDays },
      holidays: { country: form.country, region: form.region || undefined },
      areas: [
        {
          id: 'work',
          name: t('onboarding.defaultArea'),
          categories: [
            { id: 'development', name: lang === 'de' ? 'Entwicklung' : 'Development' },
            { id: 'meetings', name: 'Meetings' },
            { id: 'other', name: lang === 'de' ? 'Sonstiges' : 'Other' },
          ],
        },
      ],
    });
    if (r.ok) await repo.saveProfile(r.profile);
    else setErrors(r.errors);
  }

  async function restore() {
    const text = await pickTextFile();
    if (text === null) return;
    try {
      await repo.importBackup(JSON.parse(text), 'replace');
    } catch (e) {
      setErrors([(e as Error).message]);
    }
  }

  const regions = listRegions(form.country, lang);

  return (
    <div className="page onboarding">
      <div className="lang-switch">
        <select value={lang} onChange={(e) => setLang(e.target.value as Lang)} aria-label="Language">
          <option value="en">English</option>
          <option value="de">Deutsch</option>
        </select>
      </div>
      <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width={72} height={72} />
      <h1>{t('onboarding.title')}</h1>
      <p>{t('onboarding.text')}</p>

      <div className="stack">
        <ImportProfileButton label={t('onboarding.import')} className="btn primary wide" />
        <button className="btn wide" onClick={loadExampleProfile}>
          {t('onboarding.example')}
        </button>
        <button className="btn wide" onClick={restore}>
          {t('onboarding.restore')}
        </button>
      </div>
      {errors.length > 0 && <ul className="errors">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}

      <Card>
        <details>
          <summary>{t('onboarding.sync')}</summary>
          <SyncSettings />
        </details>
      </Card>

      <Card>
        <details>
          <summary>{t('onboarding.quick')}</summary>
          <div className="form-grid">
            <label>
              {t('onboarding.name')}
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <div className="row">
              <label>
                {t('cal.from')}
                <input type="date" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
              </label>
              <label>
                {t('cal.to')}
                <input type="date" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
              </label>
            </div>
            <div className="row">
              <label>
                {t('onboarding.weeklyHours')}
                <input type="number" min={0} value={form.weeklyHours} onChange={(e) => setForm({ ...form, weeklyHours: Number(e.target.value) })} />
              </label>
              <label>
                {t('onboarding.vacationDays')}
                <input type="number" min={0} value={form.vacationDays} onChange={(e) => setForm({ ...form, vacationDays: Number(e.target.value) })} />
              </label>
              <label>
                {t('onboarding.startBalance')}
                <input type="number" value={form.startBalance} onChange={(e) => setForm({ ...form, startBalance: Number(e.target.value) })} />
              </label>
            </div>
            <div className="row">
              <label>
                {t('settings.country')}
                <select value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value, region: '' })}>
                  <option value="">{t('settings.none')}</option>
                  {listCountries(lang).map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              {regions.length > 0 && (
                <label>
                  {t('settings.region')}
                  <select value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })}>
                    <option value="">{t('settings.none')}</option>
                    {regions.map((r) => (
                      <option key={r.code} value={r.code}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <button className="btn primary" onClick={createProfile}>
              {t('onboarding.create')}
            </button>
          </div>
        </details>
      </Card>
    </div>
  );
}
