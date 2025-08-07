# Migration Policy

- Never edit applied migrations; add a new migration instead.
- Use numeric prefixes in order; reserve numbers with placeholder migrations if needed.
- Consolidate duplicate/variant migrations by selecting a canonical file and marking others as superseded in `migrations/INDEX.md`.
- If two independent features share a number, plan a renumber and create a consolidation notice migration.
- Migrations must be idempotent-safe in dev: guard with IF EXISTS/IF NOT EXISTS where possible.
- After adding migrations, update `migrations/INDEX.md` and run `npm run verify-migrations`.
