# Migrations Index

This file tracks migration files, order, and notes on drift.

Existing (auto-listed):
- 006_add_calendar_events.sql
- 006_enhanced_content_moderation_fixed.sql
- 006_enhanced_content_moderation_simple.sql
- 006_enhanced_content_moderation.sql
- 007_add_custom_theme_colors.sql
- 007_media_review_queue.sql
- 008_theme_sets_architecture_clean.sql
- 008_theme_sets_architecture.sql
- 009_account_permissions.sql
- 009_industry_specific_architecture_fixed.sql
- 009_industry_specific_architecture.sql
- 010_impersonation_system.sql
- 011_comprehensive_pose_analysis_schema_safe.sql
- 011_comprehensive_pose_analysis_schema.sql
- 012_add_pose_analysis_fields.sql
- 013_update_content_moderation_trigger.sql
- 014_add_pose_analysis_to_content_moderation.sql
- 015_pipeline_v3_schema.sql
- 016_clean_v1_schema.sql
- 016_create_ai_moderation_management_fixed.sql
- 016_create_ai_moderation_management.sql
- 017_analysis_configuration_system.sql
- 017_component_registry.sql
- 018_model_dashboard_enhancements_safe.sql
- 018_model_dashboard_enhancements.sql
- 018_referral_tracking_system.sql
- add_account_numbers.sql
- add_client_types.sql
- INDEX.md


Variants (to consolidate):
- 006: `006_enhanced_content_moderation.sql`, `006_enhanced_content_moderation_simple.sql`, `006_enhanced_content_moderation_fixed.sql` (choose 1 canonical; mark others superseded)
- 007: `007_add_custom_theme_colors.sql`, `007_media_review_queue.sql`
- 008: `008_theme_sets_architecture.sql`, `008_theme_sets_architecture_clean.sql`
- 009: `009_account_permissions.sql`, `009_industry_specific_architecture.sql`, `009_industry_specific_architecture_fixed.sql`
- 011: `011_comprehensive_pose_analysis_schema.sql`, `011_comprehensive_pose_analysis_schema_safe.sql`
- 016: `016_clean_v1_schema.sql`, `016_create_ai_moderation_management.sql`, `016_create_ai_moderation_management_fixed.sql`
- 017: `017_analysis_configuration_system.sql`, `017_component_registry.sql`
- 018: `018_model_dashboard_enhancements.sql`, `018_model_dashboard_enhancements_safe.sql`, `018_referral_tracking_system.sql`


Planned:
- 020_media_moderation_queue.sql — Normalize media_review_queue
- 030_content_template_constraints.sql — Add NOT NULL + defaults

Rules:
- Never edit applied migrations; add a new migration instead.
- Each migration must be idempotent-safe on dev (guards to skip if already applied).
- Update this index whenever a new migration is added.
