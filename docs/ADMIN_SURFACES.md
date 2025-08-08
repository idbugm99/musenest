# Admin Surfaces

## Overview
- Sysadmin (global): `/sysadmin`
  - System-wide functions: clients, themes, media queue, model media dashboard, health
  - Uses standardized API envelope and `sysFetch`
- Model Admin (per model): `/:slug/admin`
  - Dashboard, Content, Gallery for an individual model
  - Distinct from sysadmin; no cross-tenant controls

## Routes
- Sysadmin UI
  - `/sysadmin` — dashboard
  - Related APIs under `/api/sysadmin/*`
- Model Admin UI
  - `/:slug/admin` — dashboard
  - `/:slug/admin/content` — content manager
  - `/:slug/admin/gallery` — gallery manager
  - Related APIs:
    - `/api/model-content/:modelSlug/*`
    - `/api/model-gallery/:modelSlug/*`

## Current Features
- Content Manager
  - Metadata-driven fields (labels, input types, help, required)
  - Rich text (Quill) for HTML
  - Autosave with per-field status; audit trail and rollback
  - Unsaved edit guard, Cmd/Ctrl+S save, Esc clear statuses
  - Audit pagination
- Gallery Manager
  - Sections CRUD, visibility toggle, reorder, search
  - Image list with blurred-preferred thumbnails
  - Upload (multer) → thumbnails → moderation pipeline
  - Inline caption/tags, visibility toggle
  - Drag-and-drop reorder; bulk show/hide/delete/move; pagination
  - Keyboard shortcuts (A, Delete, R, Esc); toast notifications

## Navigation
- `themes/admin/partials/model_sidebar.handlebars` renders model admin sidebar based on `isModelAdmin` flag.
- `themes/admin/layouts/main.handlebars` chooses sidebar (`admin_sidebar` vs `model_sidebar`).

## Notes
- Keep `/sysadmin` and `/:slug/admin` strictly separated in UI and API.
- Prefer blurred assets for admin previews when available.

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
| /admin/* | admin/ | Read-only | Banner to point to /sysadmin |

## Actions
- Do not modify legacy static HTML; use /sysadmin routes/templates.
- Pagination controls and standardized envelopes are used across sysadmin list views.
- Add redirects in server.js where 1:1 mapping exists.

## Future `/admin` Portal
- Scope: model-authenticated, per-model content, theme options, bookings.
- Separate route namespace and controllers; do not reuse sysadmin handlers. 