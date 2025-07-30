-- Migration 012: Add missing pose analysis fields to media_review_queue
-- This adds the essential fields needed to store comprehensive moderation data

-- Add columns to media_review_queue table
ALTER TABLE media_review_queue 
ADD COLUMN pose_analysis JSON DEFAULT NULL COMMENT 'Complete pose analysis data from AI';

ALTER TABLE media_review_queue 
ADD COLUMN final_risk_score DECIMAL(5,2) DEFAULT NULL COMMENT 'Combined risk score (0-100)';

ALTER TABLE media_review_queue 
ADD COLUMN risk_level ENUM('minimal', 'low', 'medium', 'high') DEFAULT NULL COMMENT 'Risk classification';

ALTER TABLE media_review_queue 
ADD COLUMN combined_assessment JSON DEFAULT NULL COMMENT 'Combined assessment details';

ALTER TABLE media_review_queue 
ADD COLUMN pose_category VARCHAR(50) DEFAULT NULL COMMENT 'Pose classification category';

-- Add indexes for performance on new fields
CREATE INDEX idx_media_review_queue_risk_level ON media_review_queue(risk_level);
CREATE INDEX idx_media_review_queue_final_risk_score ON media_review_queue(final_risk_score);
CREATE INDEX idx_media_review_queue_pose_category ON media_review_queue(pose_category);