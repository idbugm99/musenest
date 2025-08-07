-- Migration 020: Media Moderation Queue Normalization
-- Intent: normalize media_review_queue schema, add indexes and constraints.

-- Ensure table exists
CREATE TABLE IF NOT EXISTS media_review_queue (
    id INT AUTO_INCREMENT PRIMARY KEY,
    content_moderation_id INT NOT NULL,
    model_id INT NOT NULL,
    model_name VARCHAR(255) NOT NULL,
    image_path TEXT NOT NULL,
    original_path TEXT NOT NULL,
    thumbnail_path TEXT,
    nudity_score DECIMAL(5,2) DEFAULT 0,
    detected_parts JSON,
    part_locations JSON,
    pose_classification VARCHAR(100),
    explicit_pose_score DECIMAL(5,2) DEFAULT 0,
    policy_violations JSON,
    usage_intent ENUM('public_site', 'paysite', 'store', 'private') NOT NULL DEFAULT 'public_site',
    context_type VARCHAR(100) DEFAULT 'public_gallery',
    review_status ENUM('pending', 'approved', 'approved_blurred', 'rejected', 'appealed') DEFAULT 'pending',
    priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
    queue_type ENUM('auto_flagged', 'manual_review', 'appeal', 'admin_override') DEFAULT 'auto_flagged',
    reviewed_by INT NULL,
    reviewed_at TIMESTAMP NULL,
    admin_notes TEXT,
    blur_settings JSON,
    blurred_path TEXT,
    blur_applied BOOLEAN DEFAULT FALSE,
    appeal_id INT NULL,
    appeal_reason VARCHAR(255),
    appeal_message TEXT,
    appeal_requested BOOLEAN DEFAULT FALSE,
    appeal_reviewed_at TIMESTAMP NULL,
    final_location VARCHAR(100) DEFAULT 'originals',
    file_moved BOOLEAN DEFAULT FALSE,
    moved_at TIMESTAMP NULL,
    flagged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_review_status (review_status),
    INDEX idx_priority (priority),
    INDEX idx_queue_type (queue_type),
    INDEX idx_model_id (model_id),
    INDEX idx_usage_intent (usage_intent),
    INDEX idx_flagged_at (flagged_at),
    INDEX idx_nudity_score (nudity_score)
);

-- Add missing columns/indexes for existing installs
-- Add columns only if missing (compat across MySQL versions)
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='media_review_queue' AND COLUMN_NAME='queue_type');
SET @sql := IF(@col_exists = 0, "ALTER TABLE media_review_queue ADD COLUMN queue_type ENUM('auto_flagged','manual_review','appeal','admin_override') DEFAULT 'auto_flagged'", 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='media_review_queue' AND COLUMN_NAME='thumbnail_path');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE media_review_queue ADD COLUMN thumbnail_path TEXT', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='media_review_queue' AND COLUMN_NAME='policy_violations');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE media_review_queue ADD COLUMN policy_violations JSON', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Ensure indexes exist (portable across MySQL versions)
-- Drop/create indexes in a compatible way
SET @idx_exists := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.STATISTICS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'media_review_queue' AND INDEX_NAME = 'idx_mrq_status'
);
SET @sql := IF(@idx_exists > 0, 'SELECT 1', 'CREATE INDEX idx_mrq_status ON media_review_queue (review_status)');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.STATISTICS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'media_review_queue' AND INDEX_NAME = 'idx_mrq_created_at'
);
SET @sql := IF(@idx_exists > 0, 'SELECT 1', 'CREATE INDEX idx_mrq_created_at ON media_review_queue (created_at)');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;


