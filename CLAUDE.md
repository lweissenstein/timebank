# Timebank – notes for Claude Code

- **Language:** code, comments, commit messages and docs in English. Answer the user in **German**.
- **Stack:** Vite + React 19 + TypeScript PWA, Dexie (IndexedDB), zod, recharts, date-holidays, Vitest.
- **Commands:** `npm test`, `npm run lint`, `npx tsc -b`, `npm run build`. Run all of them before committing.
- **Layers:** `src/core` holds pure logic with no React or DB imports, and every rule change needs a test. `src/data` is persistence and sync. `src/ui` holds components. Keep the balance rules in `core/ledger.ts`.
- **Balance rules (must stay true):** target = hours/day × contractual workdays in the period; actual = work in `countsAsWork` areas + vacation + sick + holidays on workdays; delta = actual − target. The required example weeks are covered in `src/core/ledger.test.ts`.
- **i18n:** every UI string lives in `src/i18n/en.ts` with a German counterpart in `de.ts` (typed, so missing keys fail the build).
- **Privacy:** never commit personal profiles or data. Profiles are imported at runtime.
- **Plan & status:** see `docs/PLAN.md`.
