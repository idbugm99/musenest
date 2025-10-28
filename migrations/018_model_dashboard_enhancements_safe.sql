-- Model Media Dashboard Enhancement Migration - SAFE VERSION
-- Phase 2: Backend Infrastructure
-- Created: August 7, 2025

-- Check and add indexes safely (ignore if they exist)
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
     WHERE table_schema = 'phoenix4ge' 
     AND table_name = 'media_review_queue' 
     AND index_name = 'idx_model_status') = 0,
    'ALTER TABLE media_review_queue ADD INDEX idx_model_status (model_name, review_status, flagged_at)',
    'SELECT "Index idx_model_status already exists" as status'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
     WHERE table_schema = 'phoenix4ge' 
     AND table_name = 'media_review_queue' 
     AND index_name = 'idx_model_priority') = 0,
    'ALTER TABLE media_review_queue ADD INDEX idx_model_priority (model_id, priority, flagged_at)',
    'SELECT "Index idx_model_priority already exists" as status'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Create new tables
CREATE TABLE IF NOT EXISTS model_violation_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    model_id INT NOT NULL,
    model_name VARCHAR(100) NOT NULL,
    violation_date DATE NOT NULL,
    violation_type ENUM('nudity_high', 'underage_detected', 'policy_violation', 'terms_violation', 'multiple_flags') NOT NULL,
    violation_count INT DEFAULT 1,
    severity_score DECIMAL(3,1) DEFAULT 0.0,
    content_moderation_id INT,
    review_queue_id INT,
    admin_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_model_violations (model_id, violation_type, violation_date),
    INDEX idx_violation_severity (model_name, severity_score, violation_date),
    INDEX idx_date_cleanup (violation_date)
);

CREATE TABLE IF NOT EXISTS admin_notification_thresholds (
    id INT AUTO_INCREMENT PRIMARY KEY,
    model_id INT NULL,
    model_name VARCHAR(100),
    threshold_type ENUM('daily_violations', 'weekly_violations', 'pending_items', 'high_severity_rate') NOT NULL,
    threshold_value INT NOT NULL,
    time_period_hours INT DEFAULT 24,
    notification_enabled BOOLEAN DEFAULT TRUE,
    alert_email VARCHAR(255),
    last_triggered TIMESTAMP NULL,
    trigger_count INT DEFAULT 0,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_model_thresholds (model_id, threshold_type, notification_enabled),
    INDEX idx_global_thresholds (threshold_type, notification_enabled)
);

CREATE TABLE IF NOT EXISTS admin_preview_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    admin_user_id INT NOT NULL,
    admin_username VARCHAR(100),
    content_moderation_id INT,
    review_queue_id INT,
    model_name VARCHAR(100) NOT NULL,
    preview_type ENUM('thumbnail', 'full_image', 'lightbox', 'download') NOT NULL,
    image_path VARCHAR(255),
    access_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT,
    session_id VARCHAR(255),
    
    INDEX idx_admin_access (admin_user_id, access_timestamp),
    INDEX idx_content_access (content_moderation_id, access_timestamp),
    INDEX idx_model_access (model_name, access_timestamp),
    INDEX idx_cleanup_date (access_timestamp)
);

CREATE TABLE IF NOT EXISTS model_dashboard_stats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    model_id INT NOT NULL UNIQUE,
    model_name VARCHAR(100) NOT NULL,
    
    total_media_count INT DEFAULT 0,
    pending_review_count INT DEFAULT 0,
    approved_count INT DEFAULT 0,
    approved_blurred_count INT DEFAULT 0,
    rejected_count INT DEFAULT 0,
    
    total_violations_30d INT DEFAULT 0,
    severity_score_avg DECIMAL(3,1) DEFAULT 0.0,
    last_violation_date DATE NULL,
    violation_trend ENUM('increasing', 'stable', 'decreasing') DEFAULT 'stable',
    
    last_upload_date TIMESTAMP NULL,
    last_review_date TIMESTAMP NULL,
    avg_review_time_hours DECIMAL(5,1) DEFAULT 0.0,
    
    last_calculated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    calculation_version INT DEFAULT 1,
    
    INDEX idx_model_activity (last_upload_date, last_review_date),
    INDEX idx_violations (total_violations_30d, severity_score_avg),
    INDEX idx_pending_work (pending_review_count, last_upload_date)
);

-- Add new columns to existing tables (safe)
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE table_schema = 'phoenix4ge' 
     AND table_name = 'content_moderation' 
     AND column_name = 'admin_preview_watermarked') = 0,
    'ALTER TABLE content_moderation ADD COLUMN admin_preview_watermarked BOOLEAN DEFAULT FALSE',
    'SELECT "Column admin_preview_watermarked already exists" as status'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE table_schema = 'phoenix4ge' 
     AND table_name = 'content_moderation' 
     AND column_name = 'watermark_generated_at') = 0,
    'ALTER TABLE content_moderation ADD COLUMN watermark_generated_at TIMESTAMP NULL',
    'SELECT "Column watermark_generated_at already exists" as status'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE table_schema = 'phoenix4ge' 
     AND table_name = 'content_moderation' 
     AND column_name = 'preview_access_count') = 0,
    'ALTER TABLE content_moderation ADD COLUMN preview_access_count INT DEFAULT 0',
    'SELECT "Column preview_access_count already exists" as status'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Insert default notification thresholds
INSERT IGNORE INTO admin_notification_thresholds (
    model_id, threshold_type, threshold_value, time_period_hours, 
    notification_enabled, alert_email
) VALUES
(NULL, 'daily_violations', 5, 24, TRUE, 'admin@phoenix4ge.com'),
(NULL, 'weekly_violations', 20, 168, TRUE, 'admin@phoenix4ge.com'),
(NULL, 'pending_items', 50, 24, TRUE, 'admin@phoenix4ge.com'),
(NULL, 'high_severity_rate', 3, 24, TRUE, 'admin@phoenix4ge.com');

-- Initialize dashboard stats for existing models
INSERT IGNORE INTO model_dashboard_stats (model_id, model_name)
SELECT id, name FROM models;

SELECT 'Model Dashboard Enhancement Migration Completed Successfully' as status;