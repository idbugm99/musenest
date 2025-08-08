# Content Management (SysAdmin) — Design Notes

Purpose: Allow ops to quickly view and edit a model's site content when a customer calls ("change XYZ on my site"), with a complete audit trail of who changed what and why.

## Scope (MVP)
- Read and update page content per model and page type.
- Require a reason note on any write.
- Log every field change to an audit table.
- Provide a recent changes view and one-click rollback per field.

## Data Model
- `content_templates` (existing): stores content by `(model_id, page_type_id, content_key, content_value)`.
- `content_change_log` (new):
  - `id` (PK)
  - `model_id`, `page_type_id`, `content_key`
  - `old_value`, `new_value`
  - `changed_by_user_id`
  - `changed_via` ENUM('sysadmin','impersonation')
  - `reason_note` TEXT
  - `ticket_ref` VARCHAR(255) NULL
  - `request_id` VARCHAR(64) NULL (from `X-Request-Id`)
  - `created_at` DATETIME
- Optional: `content_snapshots` for full-page backups and rollbacks.

## API (proposed)
- `GET /api/content/:modelId/:pageTypeId` → returns `{ content: { key: value, ... } }`
- `PUT /api/content/:modelId/:pageTypeId` → body `{ reason_note, ticket_ref?, changes: { key: value, ... } }`
  - Server computes diffs vs current values
  - Upserts changes into `content_templates`
  - Writes one row per changed key to `content_change_log`
  - Returns `{ success: true, updated: [keys], audit_count, request_id }`
- `GET /api/content/audit?model_id=&page_type_id=&user_id=&limit=&page=` → recent changes with pagination
- `POST /api/content/rollback` → body `{ model_id, page_type_id, content_key, change_id }`
  - Restores `old_value` from `content_change_log`.

## UI (SysAdmin)
- Search model → select page type → list editable fields.
- Save flow requires Reason (modal) and optional Ticket Ref.
- Right column: "Recent Changes" with diff (old → new), actor, reason, time, rollback action.
- Actions include Preview (renders a static preview or opens the model site with a temporary cache-buster).

## Audit/Observability
- All writes include `X-Request-Id` from `middleware/requestLogger`.
- Log structure uses standardized `logger` and returns standardized response envelopes.
- Optional webhook/email notify for changes affecting public pages.

## Security & Guardrails
- Only `sysadmin` (and approved admin roles) can write.
- Input sanitation: strip disallowed HTML, enforce allowed field types.
- Rate-limit writes and require `reason_note`.

## Future Steps
- Customer Admin: mirror the same endpoints, but record `changed_via = 'impersonation'` when staff act via impersonation.
- Content Snapshots: full-page diff/rollback and scheduled exports.
- Versioning: introduce semantic versions per page to group changes.

## Open Questions
- Field catalog: define canonical keys per page type.
- WYSIWYG vs structured fields: short-term use structured fields; long-term add safe WYSIWYG with sanitization.
- Preview strategy: static render vs live site flag.

## Implementation Plan (when we return)
1. Migration for `content_change_log`.
2. Extend existing `PUT /api/content/:modelId/:pageTypeId` to require `reason_note`, compute diffs, and write audit rows.
3. Add audit fetch + rollback endpoint.
4. Update sysadmin UI to prompt for reason, show audit panel, and add rollback.
