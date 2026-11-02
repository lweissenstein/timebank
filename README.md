# Timebank

An offline-first progressive web app for tracking working hours against a weekly
target. It shows your overtime balance, compares it with a phase plan and forecasts
where you will end up.

**Live:** https://lweissenstein.github.io/timebank/

- **One-tap tracking:** start, pause, stop and switch between areas and categories
  without stopping first. After each session you can add an optional note and mark
  it as "thesis-relevant".
- **Balance rules:** weekly target hours; actual hours = work + vacation + sick days +
  public holidays on workdays. Areas can be excluded from working time, e.g. a thesis.
- **Plan & forecast:** phases with planned hours per week or `zero-balance`. The app
  shows the planned vs. the actual balance, forecasts for milestones and how many
  hours you still need to work to reach 0.
- **Days off:** a calendar for vacation and sick days (full or partial). The vacation
  account per year shows entitlement, days earned so far, taken, planned and remaining.
- **Holidays:** public holidays for 200+ countries and their regions come from
  [date-holidays](https://github.com/commenthol/date-holidays) and are calculated offline.
- **Reports:** hours per week, month, phase and total, broken down by area and
  category, plus a weekly table and warnings (daily maximum, legal breaks).
- **Your data, your control:** everything is stored in the browser (IndexedDB). You
  can export a JSON backup and CSV, and optionally sync through a private GitHub
  repository.
- **Work locations** (e.g. office / remote) per session, with hours and days per location.
- **Balance corrections:** dated adjustments, e.g. overtime carried over from before the period.
- **Migrations:** reproducible renaming/re-assignment of categories without losing history (see [`migrations/`](migrations/README.md)).
- English and German UI.

## Profiles

Everything personal lives in a **profile JSON**: the period, start balance, weekly
hours, workdays, vacation days, holiday region, areas and categories, phases,
milestones and warnings. Start from [`profiles/example.json`](profiles/example.json),
adapt it and import it under *Settings → Profile*. You can also use the quick setup
on first start. Keep your personal profile out of this repo (`*.personal.json` and
`personal/` are git-ignored).

```jsonc
{
  "period": { "start": "2027-01-04", "end": "2027-06-30", "startBalanceHours": 0 },
  "contract": { "weeklyHours": 20, "workdays": [1, 2, 3, 4, 5] },   // 1 = Monday
  "vacation": { "daysPerYear": 20, "proRata": true, "overrides": {} },
  "holidays": { "country": "DE", "region": "BE", "extra": [], "excluded": [] },
  "areas": [{ "id": "thesis", "name": "Thesis", "countsAsWork": false, "categories": [] }],
  "phases": [{ "id": "end", "name": "Wind down", "start": "2027-06-01", "end": "2027-06-30",
               "plannedHoursPerWeek": "zero-balance" }],
  "milestones": [{ "date": "2027-05-31", "name": "Submission" }],
  "balanceAdjustments": [{ "date": "2026-12-31", "hours": 5, "note": "carry-over" }],
  "workLocations": [{ "id": "office", "name": "Office" }, { "id": "remote", "name": "Remote" }]
}
```

Hours per day are derived as `weeklyHours / workdays`. Partial weeks at the start or
end of the period get a pro-rated target. Vacation and sick days credit one working
day unless you set other hours.

## Sync between devices (optional)

1. Create a **private** repository, e.g. `timebank-data`.
2. Create a [fine-grained token](https://github.com/settings/personal-access-tokens/new)
   with access to that repository only and the permission *Contents: Read and write*.
3. In the app, open *Settings → Sync* and enter the owner, repository and token. Do
   this on every device. On a new device you can connect sync from the welcome screen
   to pull your profile and data.

The app keeps one JSON file in that repo. Each device merges records by id and last
change, so deletions sync as well. The token is only stored in the browser.

## Development

Requires Node.js ≥ 20.

```bash
npm install
npm run dev        # dev server with hot reload
npm test           # unit tests (Vitest)
npm run lint
npm run build      # production build into dist/
npm run preview    # serve the build at http://localhost:4173/timebank/
```

To test on your phone in the same Wi-Fi, run `npm run dev -- --host` and open the
printed network URL. Service-worker features only work on `localhost` or HTTPS, so
use the GitHub Pages deployment to test installation and offline mode.

### Architecture

```
src/
  core/      pure TypeScript domain logic (ledger, plan, vacation, warnings, reports, csv, merge)
  profile/   zod schema for profile JSON
  data/      IndexedDB (Dexie), repository, holiday calendar adapter, GitHub sync
  i18n/      English and German strings
  ui/        React components and pages
profiles/    example profile
```

`core/` has no dependency on React or the database and is fully unit-tested
(`*.test.ts`). The `Ledger` class computes target and actual hours per day. Weeks,
months, phases and balances are sums of days.

### Deployment

GitHub Actions (`.github/workflows/ci.yml`) lints, tests, builds and deploys `main`
to GitHub Pages. To enable it, go to *Settings → Pages → Source* in the repository
and select **GitHub Actions**. For other hosts, set `BASE_PATH=/` when building.

## License

MIT
