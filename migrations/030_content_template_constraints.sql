-- Migration 030: Content Template Constraints (Planned - Placeholder)
-- Intent: add NOT NULLs + defaults for robustness to content_templates and related tables.
-- This placeholder reserves the number and documents scope. No-op for now.

-- Example (to be finalized):
-- ALTER TABLE content_templates
--   MODIFY COLUMN model_id INT NOT NULL,
--   MODIFY COLUMN page_type_id INT NOT NULL,
--   MODIFY COLUMN content JSON NOT NULL,
--   ADD INDEX IF NOT EXISTS idx_ct_model_page (model_id, page_type_id);

SET @migration_030_ct_constraints_placeholder = 'reserved';


