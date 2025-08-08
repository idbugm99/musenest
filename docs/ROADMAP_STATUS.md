# MuseNest Cleanup and Integration Roadmap

Status: In Progress
Owner: Dev Team
Updated: 2025-08-08

## Objectives
- Consolidate admin surfaces (sysadmin canonical, legacy admin read-only)
- Move test/playground code into a dedicated structure
- Stabilize DB migrations and add verification tooling
- Add route audit, health, and AI (BLIP/NudeNet) local testing
- Consolidate documentation into a single index
- Standardize logging and API response envelopes

## Phases

### Phase A — Organize test/dev assets
- Create `tests/` and `playground/`
- Move `test_*`, `debug_*`, `test-*.js`, `test-*.sql`, `test-*.html` accordingly
- Leave README pointers in old locations

Status: In Progress (majority moved; final sweep pending)

### Phase B — Admin Surfaces
- Sysadmin at `/sysadmin` (Handlebars) is canonical
- Legacy `/admin` remains read-only; add banner and redirects where possible
- Document mapping in `docs/ADMIN_SURFACES.md`

Status: Mostly Done

### Phase C — DB Drift Control
- Create `migrations/INDEX.md`
- Add `scripts/verify-db.js` to check schema health
- Add `scripts/verify-migrations.js` to detect duplicate/variant migrations
- Add `npm run verify-db` and `npm run check`
 - Add consolidation notice migration `019_consolidation_notice.sql`

Status: Done (renumbering of `pending_renumber/` queued)

### Phase D — Route/Component Hygiene
- Add `scripts/route-audit.js` (list and flag overlaps)
- Add `utils/componentRegistry.js` warning helper

Status: Done

### Phase E — Documentation Consolidation
- Create `docs/README.md` index
- Generate/curate `docs/API_INDEX.md`

Status: In Progress (new docs below pending in this update)

### Phase F — Sysadmin Data Reliability
- Ensure all sysadmin pages render with null-safe locals (placeholders)
- Add dev-only banner (route + DB status)

Status: Done (core)

### Phase G — AI (BLIP/NudeNet) Local Integration
- Run Python AI service on `http://localhost:5005`
- Add `/_ai/health` proxy and `.env` usage (`AI_SERVER_URL`)
- Add smoke tests and `docs/AI_LOCAL_SETUP.md`

Status: Mostly Done (extend E2E tests as needed)

## Commands
- `npm run verify-db`
- `npm run route-audit`
- `npm run verify-migrations`
- `npm run verify-api-mounts`
- `npm run check`
- `npm run ai:smoke`

## Notes
- DB: MySQL 9.3 (Homebrew) locally; standardize on `mysql2` for production
- `/admin` future: per-model self-service (not yet implemented) 