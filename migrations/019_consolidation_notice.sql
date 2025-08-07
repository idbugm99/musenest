-- Migration 019: Consolidation & Renumber Plan (No-Op)
-- This migration documents canonical selections for variant groups and a plan
-- to renumber independent features that share the same numeric prefix.
--
-- Canonical picks documented in migrations/INDEX.md:
--  - 006: use *_fixed; supersede base/simple; calendar to be renumbered
--  - 007: use media_review_queue
--  - 008: use *_clean
--  - 009: use industry_specific_architecture_fixed; review account_permissions
--  - 011: use *_safe
--  - 016: use create_ai_moderation_management_fixed; review clean_v1
--  - 017: use analysis_configuration_system
--  - 018: use model_dashboard_enhancements_safe; referral_tracking to renumber
--
-- No schema changes are applied by this migration. It exists to mark intent and
-- provide a stable point in the migration history while consolidation proceeds.

-- No-op statement to keep some migration runners satisfied
SET @migration_019_consolidation_notice = 'applied';


