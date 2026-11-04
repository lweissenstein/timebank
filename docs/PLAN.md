# Plan & status

## Decisions
- PWA (React + TypeScript + Vite) on GitHub Pages, offline via service worker, data in IndexedDB.
- Generic app; everything personal is in an importable profile JSON.
- Sync via a private GitHub repository (contents API, merge by id/updatedAt).
- UI in English and German.
- Holidays from `date-holidays` (country + region) plus manual extras/exclusions.
- Vacation: days per year, pro-rated by months in the period, overridable per year. Vacation/sick days credit hours per day (= weekly hours / workdays), partial days possible.
- Partial weeks get a pro-rated target. The start balance is configurable.

## Milestones
| # | Scope | Status |
|---|-------|--------|
| M0 | Tooling, CI, Pages deploy, README | done |
| M1 | Core logic + tests (all example weeks) | done |
| M2 | Profile schema, import/export, example, i18n | done |
| M3 | Timer: start/stop/pause/switch, note dialog | done |
| M4 | Edit/delete/add sessions, long-session hint | done |
| M5 | Vacation/sick calendar, vacation account, areas editor | done |
| M6 | Reports per week/month/phase/total, weekly table | done |
| M7 | Plan-vs-actual chart, forecasts, required hours | done |
| M8 | Warnings, CSV, backup/import, thesis-note filter/export | done |
| M9 | GitHub sync | done |
| M10 | Phone test, polish | in progress (user testing) |

## Changes after launch
- Headline balance shows the state at the end of yesterday; today is shown separately.
- Daily break total in the log.
- Category migrations (`src/core/migrate.ts`, `npm run migrate`, *Settings → Apply migration*).
- Balance adjustments (`balanceAdjustments`) and work locations (`workLocations`, `Session.locationId`).

- Stats simplified: no phase plan in the UI anymore. The forecast is
  `balance until yesterday + Σ(assumed work + entered absences + holidays − target)`
  with assumed weekly hours (default: average of the last 4 completed weeks),
  see `src/core/projection.ts`. `phases` stay in the profile schema for
  compatibility but are not used by the UI (`core/plan.ts` is legacy).
- Week/month totals and the weekly table count target and difference only up to today.

- Breaks: the pause button ends the current block; "resume" starts a new block
  with the same area, category, location and note. A break is the gap between
  two sessions (confirmed when created by pause/resume, otherwise detected
  automatically). Older in-session pauses are converted on start/sync/import
  (`core/breaks.ts`); untimed totals can be placed via "Insert break".

## Later
- Optional per-category default for "thesis-relevant" (`thesisDefault`).
- Excel export into the employer template (ExcelJS; needs the template). `core/worktime.workByDay` and the session data already give per-day start/end/break.
- Optional: Capacitor wrapper for a notification with start/stop controls.
- Optional: lazy-load holiday data to reduce the bundle size.
