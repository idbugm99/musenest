# API Index (WIP)

Public endpoints:
- GET `/` — API info
- GET `/health` — DB health

Dev endpoints:
- GET `/_ai/health` — AI service health proxy
- GET `/_debug/routes` — Dynamic route listing

Admin APIs (selected):
- GET `/api/theme-management/models`
- PUT `/api/theme-management/models/:id/theme`
- GET `/api/theme-management/themes`
- GET `/api/content-management/models`
- GET `/api/page-types`
- GET `/api/content/:modelId/:pageTypeId`
- PUT `/api/content/:modelId/:pageTypeId`
- GET `/api/content/:modelId/:pageTypeId/export`
- GET `/api/content/statistics`

Notes:
- This index is curated; see `scripts/route-audit.js` for a generated list.
