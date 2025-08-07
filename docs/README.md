# MuseNest Documentation Index

- Roadmap & Status: `docs/ROADMAP_STATUS.md`
- Admin Surfaces: `docs/ADMIN_SURFACES.md`
- AI Local Setup (BLIP/NudeNet): `docs/AI_LOCAL_SETUP.md`
- API Documentation (legacy): `API_DOCUMENTATION.md`, `API_DOCUMENTATION_SERVER.md`
- Backend Infrastructure: `BACKEND_INFRASTRUCTURE_DOCUMENTATION.md`
- Component Library: `COMPONENT_LIBRARY.md`
- Migrations Index: `migrations/INDEX.md` (to be created)

## Useful Commands
- `npm run dev` — start server with nodemon
- `npm run verify-db` — check DB connectivity and required tables
- `npm run route-audit` — best-effort route listing from server.js
- `npm run check` — run both verification steps

## Health/Debug Endpoints
- `/health` — DB connectivity & timestamp
- `/_ai/health` — AI service health (if configured)
- `/_debug/routes` — Dynamic route listing