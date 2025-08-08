# Migrations Index

Canonical applied migrations (by number):
- 019_consolidation_notice.sql (documentation/no-op)
- 020_media_moderation_queue.sql (normalize table + indexes)
- 030_content_template_constraints.sql (constraints + index)
- 040_perf_indexes.sql (performance indexes)

Superseded variants moved to `migrations/superseded/`.
Independent features awaiting renumbering in `migrations/pending_renumber/`.

Policy: see `docs/MIGRATION_POLICY.md`.
