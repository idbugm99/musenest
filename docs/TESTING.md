# Testing & Checks

## Checks
- `npm run check` → verify-db + route-audit + verify-migrations + verify-api-mounts

## Useful curls
```
curl -sS http://127.0.0.1:3000/_ping
curl -sS http://127.0.0.1:3000/health
curl -sS http://127.0.0.1:3000/_debug/routes
curl -sS http://127.0.0.1:3000/api/sysadmin/system/stats
curl -sS 'http://127.0.0.1:3000/api/sysadmin/system/clients?page=1&limit=2'
curl -sS 'http://127.0.0.1:3000/api/sysadmin/media-review/queue?status=pending&page=1&limit=2'
curl -sS 'http://127.0.0.1:3000/api/content-moderation/queue?page=1&limit=2'
```

## AI smoke
- `npm run ai:smoke` (ensure AI server URL set in `.env`)
