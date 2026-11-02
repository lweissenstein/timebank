/**
 * Applies a category migration to a Timebank backup file and verifies that
 * worked hours and the overtime balance are unchanged.
 *
 *   npm run migrate -- <backup.json> <migration.json> [out.json] [--today=YYYY-MM-DD]
 *
 * Without an output path it is a dry run. The original backup is never modified.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { today as todayOf } from '../src/core/dates';
import { isSnapshot } from '../src/core/merge';
import { applyMigration, snapshotTotals, type Migration } from '../src/core/migrate';
import { holidaysForProfile } from '../src/data/holidayCalendar';
import { parseProfile } from '../src/profile/schema';

function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const todayArg = process.argv.find((a) => a.startsWith('--today='))?.slice(8);
  const [backupPath, migrationPath, outPath] = args;
  if (!backupPath || !migrationPath) {
    console.error('Usage: npm run migrate -- <backup.json> <migration.json> [out.json] [--today=YYYY-MM-DD]');
    process.exit(1);
  }
  const backup = JSON.parse(readFileSync(backupPath, 'utf8'));
  if (!isSnapshot(backup)) throw new Error('Not a Timebank backup');
  const migration = JSON.parse(readFileSync(migrationPath, 'utf8')) as Migration;

  // Evaluate running sessions at the export time so before/after are comparable.
  const now = backup.exportedAt;
  const today = todayArg ?? todayOf(new Date(now));
  const { snapshot, report } = applyMigration(backup, migration);
  const check = parseProfile(snapshot.profile!.value);
  if (!check.ok) throw new Error(`Migrated profile is invalid:\n${check.errors.join('\n')}`);

  const before = snapshotTotals(backup, holidaysForProfile(backup.profile!.value), today, now);
  const after = snapshotTotals(snapshot, holidaysForProfile(snapshot.profile!.value), today, now);
  console.log(`Migration "${migration.id}" (today = ${today})`);
  console.log('Sessions before:', report.before);
  console.log('Sessions after: ', report.after);
  console.log(`Moved sessions: ${report.movedSessions}`);
  console.log('Hidden categories:', report.hiddenCategories);
  console.log('Added categories: ', report.addedCategories);
  console.log('Added areas:      ', report.addedAreas);
  console.table({ before, after });

  const same = JSON.stringify(before) === JSON.stringify(after);
  console.log(same ? 'OK: worked hours and balance are identical.' : 'DIFFERENCE detected!');
  if (outPath) {
    writeFileSync(outPath, JSON.stringify(snapshot));
    console.log(`Written: ${outPath}`);
  }
  if (!same && !migration.profilePatch) process.exit(2);
}

main();
