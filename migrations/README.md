# Migrations

A migration file changes areas and categories reproducibly and re-assigns
sessions without touching their times, notes or flags (see `src/core/migrate.ts`).

```jsonc
{
  "id": "2026-11-new-categories",
  "areas": [
    { "id": "project-a", "name": "Project A", "color": "#1f6f5c", "countsAsWork": true,
      "categories": [{ "id": "development", "name": "Development" }] }
  ],
  "moves": [{ "areaId": "project-a", "from": "coding", "to": "development" }],
  "profilePatch": { "workLocations": [{ "id": "office", "name": "Office" }] }
}
```

- Listed categories are created or renamed (matched by `id`).
- Existing categories that are not listed are **hidden**, never deleted.
- `moves` only work within one area, so counted working time cannot change.

Apply it in one of two ways:

- **In the app:** *Settings → Data → Apply migration*. The app first downloads a backup.
- **On a backup file (dry run / verification):**
  `npm run migrate -- backup.json migration.json [migrated.json]`.
  This prints session counts, worked hours and the balance before and after.

Keep personal migration files out of this public repo.
