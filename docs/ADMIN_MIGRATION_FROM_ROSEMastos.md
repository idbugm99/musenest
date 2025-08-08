# MuseNest Admin: Migration Plan from RoseMastos Admin

## Goals
- Parity: replicate the productive UX from `rosemastos` admin for content and gallery management.
- Consolidation: integrate with MuseNest sysadmin (`/sysadmin`) and future model admin (`/admin/:modelSlug`).
- Standards: use our response envelope, logging, pagination, auth, and `sysFetch`.

## Source Features Observed (RoseMastos)
- Dashboard quick stats and recent activity.
- Content sections navigation (home/about/gallery/rates/etiquette/contact) with hash routing and persistence.
- Collapsible sections with section behavior defaults.
- Auto-save fields with inline status (saving/saved/error) and debounce.
- Custom facts (draggable order, add/remove, inline edit, badge visibility toggles).
- Gallery management:
  - Create sections (grid/masonry/carousel/lightbox_grid) with per-layout options.
  - Manage images with visual picker and per-image inline edit (caption/tags/visibility), drag reordering, bulk actions.
  - Section visibility toggles with immediate feedback.

## Target Surfaces (MuseNest)
- System Admin (`/sysadmin`): includes Model Media Dashboard, Theme Management, Media Queue.
- New: Model Content Admin (`/admin/:modelId/content`) per `CONTENT_MANAGEMENT.md` design.
- New: Model Gallery Admin (`/admin/:modelId/gallery`) mirroring RoseMastos gallery UX.

## Information Architecture
- Left nav in `/sysadmin` gains anchors to open per-model admin pages in a new tab.
- Per-model admin uses Bootstrap layout and our component loader, not Flask.

## Data Model (MuseNest)
- Content:
  - `content_templates` + `content_change_log` (per `CONTENT_MANAGEMENT.md`).
- Gallery:
  - `gallery_sections` (id, model_id, title, layout_type, grid_columns, enable_filters, enable_lightbox, enable_fullscreen, default_filter, is_visible, sort_order, created_at, updated_at).
  - `gallery_images` (id, section_id, model_id, filename, caption, tags, is_active, order_index, created_at, updated_at).
  - Derivable public path: `/public/uploads/<modelSlug>/public/gallery/<filename>`.

## API Plan
- Base: `/api/model-gallery` (new router) mounted under `/api/sysadmin/gallery` for sysadmin access and `/api/model-gallery` for model-admin.
- Endpoints:
  - Sections
    - GET `/sections?model_id&search&page&limit`
    - POST `/sections` (create)
    - PUT `/sections/:id`
    - PATCH `/sections/:id/visibility` (toggle)
    - PATCH `/sections/bulk` (action: show|hide|delete, ids[])
  - Section Images
    - GET `/sections/:id/images`
    - POST `/sections/:id/images` (add image: filename, caption, tags)
    - PUT `/images/:id` (caption/tags/is_active)
    - PATCH `/images/:id/visibility`
    - PATCH `/images/bulk` (action: show|hide|delete, ids[])
    - PATCH `/images/reorder` (section_id, [{id, order}])
- All responses use `{ success, data, pagination?, message? }`.

## UI Plan (Bootstrap components)
- Model Gallery Admin page (`themes/admin/pages/model-gallery.handlebars`):
  - Header with model picker, quick stats (sections, images, visible).
  - Section creator card (layout select, conditional settings panel like RoseMastos, create button).
  - Existing sections list:
    - Section card with title, badges (layout, visible), counts, actions (Manage Images, Edit, Delete), visibility badge toggle.
    - Edit panel inline with layout-specific settings; auto-save on blur/change.
  - Scripts mirror RoseMastos behaviors: show/hide layout panels, default filter visibility, etc.
- Manage Images modal/page:
  - Visual picker of available images from `/uploads/<modelSlug>/public` (filter not in any section), click to add/remove.
  - Existing images grid with per-image controls (caption/tags inline autosave, visibility badge, drag to reorder, bulk actions).
  - Uses Bootstrap draggable handlers; updates order via `/images/reorder`.

## Reuse from Current MuseNest
- Component loader/execution in `dashboard.handlebars`.
- `sysFetch`, standardized logging, pagination helpers.
- Media preview/thumbnail pipeline; thumbnails shown in pickers.

## Security/Permissions
- Sysadmin can manage any model’s gallery.
- Future: model-auth scoped to own galleries.

## Migration/Backfill
- SQL migrations to create `gallery_sections` and `gallery_images` with indexes:
  - Indexes: sections(model_id, is_visible, sort_order); images(section_id, is_active, order_index), images(model_id), tags fulltext optional.
- Backfill script to ingest existing `/uploads/<modelSlug>/public` into a default section.

## Phased Implementation
- Phase 1: DB + Router scaffolding
  - Add migrations for new tables and indexes.
  - Create `routes/api/model-gallery.js` with stub endpoints returning envelope.
  - Mount under `/api/sysadmin/gallery` and `/api/model-gallery`.
- Phase 2: UI skeleton
  - Add `themes/admin/pages/model-gallery.handlebars` and `admin/js/model-gallery.js` with list/create sections.
  - Add to sysadmin dashboard loader.
- Phase 3: Manage Images
  - Implement visual picker, image list, inline autosave, visibility toggle, reordering.
  - Add bulk actions.
- Phase 4: Polishing
  - Hash routing, autosave statuses, debounce, notifications.
  - Tests in `tests/api/model-gallery.spec.js`.

## Endpoint Details
- GET `/sections` → `{ sections, pagination }` with counts per section.
- POST `/sections` validates title, layout, defaults; returns section.
- PUT `/sections/:id` updates editable fields.
- PATCH `/sections/:id/visibility` toggles flag.
- GET `/sections/:id/images` returns `{ images }` with caption, tags, is_active, order_index, thumbnail_url.
- POST `/sections/:id/images` validates filename exists in model uploads; inserts.
- PUT `/images/:id` updates caption/tags/is_active.
- PATCH `/images/:id/visibility` flips visibility.
- PATCH `/images/bulk` and `/sections/bulk` apply bulk operations.
- PATCH `/images/reorder` updates order with single multi-row statement.

## UX Notes
- Keep RoseMastos’ badge toggles, drag handles, and success microinteractions.
- Use Bootstrap to match current admin styling.
- Use tooltips and helper text similar to RoseMastos.

## Observability
- Log admin actions with `logger.info` including `admin_user_id`, `model_id`, `section_id`/`image_id`.
- Add `X-Request-Id` passthrough in UI logs for traceability.

## Risks & Mitigations
- File path drift: derive web vs filesystem consistently; reuse media-preview utilities.
- Large sections: paginate images server-side; lazy-load thumbnails.
- Concurrency on reorders: accept last-write-wins; optionally add version.

## Deliverables
- New migrations; new router; new admin page and JS.
- Docs update: link from `docs/ADMIN_SURFACES.md` and `docs/CONTENT_MANAGEMENT.md`.

## Timeline
- 1 day: Migrations + Router skeleton
- 1 day: Sections UI & flows
- 1–2 days: Image manager & bulk ops
- 0.5 day: Backfill & polish
