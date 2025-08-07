-- Migration 020: Media Moderation Queue Normalization (Planned - Placeholder)
-- Intent: normalize media_review_queue schema, add indexes and constraints.
-- This placeholder reserves the number and documents scope. No-op for now.

-- Example (to be finalized):
-- ALTER TABLE media_review_queue
--   ADD COLUMN IF NOT EXISTS queue_type VARCHAR(50) DEFAULT 'ai_flagged',
--   ADD INDEX IF NOT EXISTS idx_mrq_status (status),
--   ADD INDEX IF NOT EXISTS idx_mrq_created_at (created_at);

SET @migration_020_media_queue_placeholder = 'reserved';


