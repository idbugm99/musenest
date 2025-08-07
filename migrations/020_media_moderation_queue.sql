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

-- Add other columns referenced by application if missing
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='media_review_queue' AND COLUMN_NAME='original_path');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE media_review_queue ADD COLUMN original_path TEXT', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='media_review_queue' AND COLUMN_NAME='detected_parts');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE media_review_queue ADD COLUMN detected_parts JSON', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='media_review_queue' AND COLUMN_NAME='part_locations');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE media_review_queue ADD COLUMN part_locations JSON', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='media_review_queue' AND COLUMN_NAME='pose_classification');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE media_review_queue ADD COLUMN pose_classification VARCHAR(100)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='media_review_queue' AND COLUMN_NAME='explicit_pose_score');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE media_review_queue ADD COLUMN explicit_pose_score DECIMAL(5,2) DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='media_review_queue' AND COLUMN_NAME='combined_assessment');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE media_review_queue ADD COLUMN combined_assessment JSON', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='media_review_queue' AND COLUMN_NAME='final_risk_score');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE media_review_queue ADD COLUMN final_risk_score DECIMAL(5,2) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='media_review_queue' AND COLUMN_NAME='risk_level');
SET @sql := IF(@col_exists = 0, "ALTER TABLE media_review_queue ADD COLUMN risk_level ENUM('low','medium','high','critical') NULL", 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='media_review_queue' AND COLUMN_NAME='blur_settings');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE media_review_queue ADD COLUMN blur_settings JSON', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='media_review_queue' AND COLUMN_NAME='blurred_path');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE media_review_queue ADD COLUMN blurred_path TEXT', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='media_review_queue' AND COLUMN_NAME='blur_applied');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE media_review_queue ADD COLUMN blur_applied BOOLEAN DEFAULT FALSE', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='media_review_queue' AND COLUMN_NAME='final_location');
SET @sql := IF(@col_exists = 0, "ALTER TABLE media_review_queue ADD COLUMN final_location VARCHAR(100) DEFAULT 'originals'", 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='media_review_queue' AND COLUMN_NAME='file_moved');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE media_review_queue ADD COLUMN file_moved BOOLEAN DEFAULT FALSE', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='media_review_queue' AND COLUMN_NAME='moved_at');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE media_review_queue ADD COLUMN moved_at TIMESTAMP NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Appeal-related fields
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='media_review_queue' AND COLUMN_NAME='appeal_id');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE media_review_queue ADD COLUMN appeal_id INT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='media_review_queue' AND COLUMN_NAME='appeal_reason');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE media_review_queue ADD COLUMN appeal_reason VARCHAR(255)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='media_review_queue' AND COLUMN_NAME='appeal_message');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE media_review_queue ADD COLUMN appeal_message TEXT', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='media_review_queue' AND COLUMN_NAME='appeal_requested');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE media_review_queue ADD COLUMN appeal_requested BOOLEAN DEFAULT FALSE', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='media_review_queue' AND COLUMN_NAME='appeal_reviewed_at');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE media_review_queue ADD COLUMN appeal_reviewed_at TIMESTAMP NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Ensure indexes exist (portable across MySQL versions)
-- Drop/create indexes in a compatible way
-- Create idx_mrq_status only if column exists and index missing
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='media_review_queue' AND COLUMN_NAME='review_status');
SET @idx_exists := (SELECT COUNT(1) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'media_review_queue' AND INDEX_NAME = 'idx_mrq_status');
SET @sql := IF(@col_exists > 0 AND @idx_exists = 0, 'CREATE INDEX idx_mrq_status ON media_review_queue (review_status)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Composite index to support WHERE review_status AND ORDER BY flagged_at
SET @col1 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='media_review_queue' AND COLUMN_NAME='review_status');
SET @col2 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='media_review_queue' AND COLUMN_NAME='flagged_at');
SET @idx_exists := (SELECT COUNT(1) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'media_review_queue' AND INDEX_NAME = 'idx_mrq_status_flagged');
SET @sql := IF(@col1 > 0 AND @col2 > 0 AND @idx_exists = 0, 'CREATE INDEX idx_mrq_status_flagged ON media_review_queue (review_status, flagged_at)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Create idx_mrq_created_at only if column exists and index missing
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='media_review_queue' AND COLUMN_NAME='created_at');
SET @idx_exists := (SELECT COUNT(1) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'media_review_queue' AND INDEX_NAME = 'idx_mrq_created_at');
SET @sql := IF(@col_exists > 0 AND @idx_exists = 0, 'CREATE INDEX idx_mrq_created_at ON media_review_queue (created_at)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;


