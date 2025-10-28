# phoenix4ge Documentation Index

- Roadmap & Status: `docs/ROADMAP_STATUS.md`
- Admin Surfaces: `docs/ADMIN_SURFACES.md`
- AI Local Setup (BLIP/NudeNet): `docs/AI_LOCAL_SETUP.md`
- API Index: `docs/API_INDEX.md`
- Migration Policy: `docs/MIGRATION_POLICY.md`
- Logging & Errors: `docs/LOGGING_AND_ERRORS.md`
- API Standards: `docs/API_STANDARDS.md`
- Testing: `docs/TESTING.md`
- Content Management Design: `docs/CONTENT_MANAGEMENT.md`

## Useful Commands
- `npm run dev` — start server with nodemon
- `npm run verify-db` — DB connectivity and required tables
- `npm run route-audit` — best-effort route listing from server.js
- `npm run verify-migrations` — detect duplicate/variant migrations
- `npm run verify-api-mounts` — ensure routers are mounted
- `npm run check` — composite verification
- `npm run ai:smoke` — AI service smoke test

## Health/Debug Endpoints
- `/_ping` — quick ping
- `/health` — DB connectivity & stats
- `/_ai/health` — AI service health (if configured)
- `/_debug/routes` — dynamic route listing

## Standards
- Response envelope: `res.success(data, extra)` / `res.fail(status, error, details)`
- Request logging: `middleware/requestLogger.js` (adds `X-Request-Id`, logs start/end)
- Error handling: global handler with standardized JSON payloads