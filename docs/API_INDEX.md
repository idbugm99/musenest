# API Index

Public endpoints:
- GET `/` — API info
- GET `/health` — DB health

Dev endpoints:
- GET `/_ai/health` — AI service health proxy
- GET `/_debug/routes` — Dynamic route listing
 - GET `/_ping` — Server ping

Admin APIs (consolidated under `/api/sysadmin`):
- GET `/api/sysadmin/system/stats`
- GET `/api/sysadmin/system/clients?page&limit`
- GET `/api/sysadmin/models/`
- GET `/api/sysadmin/ai-servers/servers`
- GET `/api/sysadmin/media-review/queue?status&page&limit`
- GET `/api/sysadmin/site-configuration/sites?page&limit` (join)
- GET `/api/sysadmin/site-configuration/sites-basic?page&limit` (resilient)

Other selected APIs:
- GET `/api/content-moderation/queue?page&limit`
- GET `/api/clients?page&limit`
- GET `/api/blip-webhook/test`
- GET `/api/enhanced-content-moderation/rules/:usage_intent`

Standards:
- All responses use envelope: `{ success: true, data: ... }` or `{ success: false, error, details? }`
- Lists accept `page` and `limit` with sensible clamps; many set short `Cache-Control` headers

Notes:
- This index is curated; see `scripts/route-audit.js` for a generated list.
