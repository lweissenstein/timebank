import { useEffect, useState } from 'react';
import { CSV_DEFAULT, sessionsToCsv, weeksToCsv, type CsvOptions } from '../core/csv';
import { toISODate } from '../core/dates';
import { listCountries, listRegions } from '../data/holidayCalendar';
import { repo } from '../data/repo';
import { useI18n, type Lang } from '../i18n';
import { useAppData } from './AppData';
import { AreasEditor } from './AreasEditor';
import { Card, download, pickTextFile } from './common';
import { exportProfile, ImportProfileButton, loadExampleProfile, ProfileJsonDialog } from './ProfileTools';
import { SyncSettings } from './SyncSettings';

export function SettingsPage() {
  const { t, lang, setLang, date, num } = useI18n();
  const { profile, sessions, ledger, now } = useAppData();
  const [jsonOpen, setJsonOpen] = useState(false);
  const [germanCsv, setGermanCsv] = useState(lang === 'de');
  const [persisted, setPersisted] = useState<boolean | null>(null);

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted, () => setPersisted(null));
  }, []);

  const csvOpts: CsvOptions = germanCsv ? { delimiter: ';', decimal: ',' } : CSV_DEFAULT;
  const stamp = toISODate(new Date());

  async function exportBackup() {
    download(`timebank-backup-${stamp}.json`, JSON.stringify(await repo.snapshot()));
  }

  async function importBackup() {
    const text = await pickTextFile();
    if (text === null) return;
    try {
      await repo.importBackup(JSON.parse(text), confirm(t('settings.importMode')) ? 'merge' : 'replace');
      alert(t('settings.imported'));
    } catch (e) {
      alert(`${t('common.error')}: ${(e as Error).message}`);
    }
  }

  function exportWeeks() {
    const weeks = ledger.weeks();
    download(`timebank-weeks-${stamp}.csv`, weeksToCsv(weeks, weeks.map((w) => ledger.balanceAt(w.to)), csvOpts), 'text/csv');
  }

  async function deleteAll() {
    if (confirm(t('settings.deleteAllConfirm'))) {
      await repo.clearAll();
      location.reload();
    }
  }

  const countries = listCountries(lang);
  const regions = listRegions(profile.holidays.country, lang);
  const setHolidays = (patch: Partial<typeof profile.holidays>) => repo.saveProfile({ ...profile, holidays: { ...profile.holidays, ...patch } });

  return (
    <div className="page">
      <Card title={t('settings.language')}>
        <select value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
          <option value="en">English</option>
          <option value="de">Deutsch</option>
        </select>
      </Card>

      <Card title={t('settings.profile')}>
        <p>
          <strong>{profile.name}</strong>
        </p>
        <p className="muted small">
          {t('settings.summary', {
            from: date(profile.period.start, { day: '2-digit', month: '2-digit', year: 'numeric' }),
            to: date(profile.period.end, { day: '2-digit', month: '2-digit', year: 'numeric' }),
            week: num(profile.contract.weeklyHours),
            day: num(ledger.perDay, 2),
            balance: num(profile.period.startBalanceHours),
            vacation: num(profile.vacation.daysPerYear),
          })}
        </p>
        <p className="hint">{t('settings.profileHint')}</p>
        <div className="toolbar wrap">
          <button className="btn" onClick={() => exportProfile(profile)}>
            {t('settings.exportProfile')}
          </button>
          <ImportProfileButton label={t('settings.importProfile')} />
          <button className="btn" onClick={() => setJsonOpen(true)}>
            {t('settings.editJson')}
          </button>
          <button className="btn" onClick={() => confirm(t('settings.replaceProfile')) && loadExampleProfile()}>
            {t('settings.loadExample')}
          </button>
        </div>
        <ProfileJsonDialog profile={profile} open={jsonOpen} onClose={() => setJsonOpen(false)} />
      </Card>

      <Card title={t('settings.areas')}>
        <AreasEditor profile={profile} />
      </Card>

      <Card title={t('settings.holidays')}>
        <div className="row">
          <label>
            {t('settings.country')}
            <select value={profile.holidays.country} onChange={(e) => setHolidays({ country: e.target.value, region: undefined })}>
              <option value="">{t('settings.none')}</option>
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          {regions.length > 0 && (
            <label>
              {t('settings.region')}
              <select value={profile.holidays.region ?? ''} onChange={(e) => setHolidays({ region: e.target.value || undefined })}>
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
      </Card>

      <Card title={t('settings.warnings')}>
        <label className="check">
          <input
            type="checkbox"
            checked={profile.warnings.enabled}
            onChange={(e) => repo.saveProfile({ ...profile, warnings: { ...profile.warnings, enabled: e.target.checked } })}
          />
          {t('settings.warningsEnabled')}
        </label>
      </Card>

      <Card title={t('settings.sync')}>
        <SyncSettings />
      </Card>

      <Card title={t('settings.data')}>
        <div className="toolbar wrap">
          <button className="btn" onClick={exportBackup}>
            {t('settings.exportBackup')}
          </button>
          <button className="btn" onClick={importBackup}>
            {t('settings.importBackup')}
          </button>
          <button className="btn" onClick={() => download(`timebank-sessions-${stamp}.csv`, sessionsToCsv(sessions, profile.areas, now, csvOpts), 'text/csv')}>
            {t('settings.csvSessions')}
          </button>
          <button className="btn" onClick={exportWeeks}>
            {t('settings.csvWeeks')}
          </button>
        </div>
        <label className="check">
          <input type="checkbox" checked={germanCsv} onChange={(e) => setGermanCsv(e.target.checked)} />
          {t('settings.csvGerman')}
        </label>
        <p className="small">
          {t('settings.persist')}: {persisted ? t('settings.persistOn') : t('settings.persistOff')}{' '}
          {!persisted && navigator.storage?.persist && (
            <button className="btn small" onClick={() => navigator.storage.persist().then(setPersisted)}>
              {t('settings.persistAsk')}
            </button>
          )}
        </p>
      </Card>

      <Card title={t('settings.danger')}>
        <button className="btn danger" onClick={deleteAll}>
          {t('settings.deleteAll')}
        </button>
      </Card>

      <p className="muted small center">
        Timebank · <a href="https://github.com/lweissenstein/timebank">GitHub</a> · MIT
      </p>
    </div>
  );
}
