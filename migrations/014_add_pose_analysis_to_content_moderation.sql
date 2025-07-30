-- Migration 014: Add pose analysis fields to content_moderation table
-- This ensures the source table has all the fields that the trigger needs

-- Add columns to content_moderation table
ALTER TABLE content_moderation
ADD COLUMN pose_analysis JSON DEFAULT NULL COMMENT 'Complete pose analysis data from AI';

ALTER TABLE content_moderation
ADD COLUMN final_risk_score DECIMAL(5,2) DEFAULT NULL COMMENT 'Combined risk score (0-100)';

ALTER TABLE content_moderation
ADD COLUMN risk_level ENUM('minimal', 'low', 'medium', 'high') DEFAULT NULL COMMENT 'Risk classification';

ALTER TABLE content_moderation
ADD COLUMN combined_assessment JSON DEFAULT NULL COMMENT 'Combined assessment details';

ALTER TABLE content_moderation
ADD COLUMN pose_category VARCHAR(50) DEFAULT NULL COMMENT 'Pose classification category';

-- Add indexes for performance
CREATE INDEX idx_content_moderation_risk_level ON content_moderation(risk_level);
CREATE INDEX idx_content_moderation_final_risk_score ON content_moderation(final_risk_score);