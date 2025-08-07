# Admin Surfaces

## Canonical Surfaces (Current)
- **SysAdmin** (system operations): `/sysadmin` (Handlebars under `themes/admin`)
- **Legacy Admin** (static HTML): `/admin/*` (kept read-only; redirects where possible)

## Intent
- `/sysadmin` = Business manager and system administration (current)
- `/admin` = Future per-model portal for site owners to manage their own sites (not implemented)

## Mapping
| URL | Source | Status | Notes |
|-----|--------|--------|-------|
| /sysadmin | server.js + Handlebars | Canonical | System admin dashboard |
| /admin/musenest-business-manager.html | admin/ | Redirect → /sysadmin | Legacy |
| /admin/media-queue-review.html | admin/ | Read-only | Use sysadmin equivalents where available |
| /admin/* | admin/ | Read-only | Banner to point to /sysadmin; Dev redirects to /sysadmin (middleware) |

## Actions
- Do not modify legacy static HTML; use /sysadmin routes/templates. In development, legacy routes redirect to `/sysadmin`.
- Add redirects in server.js where 1:1 mapping exists.

## Future `/admin` Portal
- Scope: model-authenticated, per-model content, theme options, bookings.
- Separate route namespace and controllers; do not reuse sysadmin handlers. 