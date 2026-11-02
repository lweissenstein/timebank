import { useState } from 'react';
import { toISODate } from '../core/dates';
import { snapshotTotals, type Migration, type MigrationReport } from '../core/migrate';
import { holidaysForProfile } from '../data/holidayCalendar';
import { repo } from '../data/repo';
import { parseProfile } from '../profile/schema';
import { useI18n } from '../i18n';
import { Dialog, download, pickTextFile } from './common';

type Totals = ReturnType<typeof snapshotTotals>;

interface Result {
  id: string;
  report: MigrationReport;
  before: Totals;
  after: Totals;
}

/** Applies a migration file to the local data. A backup is downloaded first. */
export function MigrationButton() {
  const { t, dur, signed } = useI18n();
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setError(null);
    const text = await pickTextFile();
    if (text === null) return;
    try {
      const migration = JSON.parse(text) as Migration;
      if (!migration.id || !Array.isArray(migration.areas) || !Array.isArray(migration.moves)) {
        throw new Error('Not a Timebank migration file');
      }
      const now = Date.now();
      const today = toISODate(new Date(now));
      const backup = await repo.snapshot();
      download(`timebank-backup-before-${migration.id}.json`, JSON.stringify(backup));
      const { before, after, report } = await repo.migrate(migration, now);
      const check = parseProfile(after.profile?.value);
      if (!check.ok) {
        await repo.restore(before);
        throw new Error(check.errors.join('\n'));
      }
      setResult({
        id: migration.id,
        report,
        before: snapshotTotals(before, holidaysForProfile(before.profile!.value), today, now),
        after: snapshotTotals(after, holidaysForProfile(after.profile!.value), today, now),
      });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const same = result && JSON.stringify(result.before) === JSON.stringify(result.after);

  return (
    <>
      <button className="btn" onClick={run}>
        {t('settings.migrate')}
      </button>
      {error && <p className="warning">{error}</p>}
      <Dialog open={!!result} title={t('settings.migrateDone', { id: result?.id ?? '' })} onClose={() => setResult(null)}>
        {result && (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th />
                  <th>{t('settings.before')}</th>
                  <th>{t('settings.after')}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{t('stats.worked')}</td>
                  <td>{dur(result.before.workedHours)}</td>
                  <td>{dur(result.after.workedHours)}</td>
                </tr>
                <tr>
                  <td>{t('track.balance')}</td>
                  <td>{signed(result.before.balanceToday)}</td>
                  <td>{signed(result.after.balanceToday)}</td>
                </tr>
              </tbody>
            </table>
            <p className={same ? 'pos' : 'warning'}>{same ? t('settings.migrateSame') : t('settings.migrateDiff')}</p>
            <p className="small muted">
              {t('settings.migrateMoved', { n: result.report.movedSessions })} · {t('settings.migrateHidden', { n: result.report.hiddenCategories.length })}
            </p>
          </>
        )}
        <div className="dialog-actions">
          <button className="btn primary" onClick={() => setResult(null)}>
            {t('common.close')}
          </button>
        </div>
      </Dialog>
    </>
  );
}
