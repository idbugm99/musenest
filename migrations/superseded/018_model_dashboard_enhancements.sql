-- Model Media Dashboard Enhancement Migration
-- Phase 1: Schema additions for model-centric views and violation tracking
-- Created: August 7, 2025
-- Status: Planning Phase

-- ==============================================
-- UNIFIED SCHEMA DESIGN FOR MODEL DASHBOARD
-- ==============================================

-- Add missing indexes to existing tables for performance
-- These are safe, non-breaking changes

-- Optimize media_review_queue for model-centric queries
ALTER TABLE media_review_queue 
    ADD INDEX idx_model_status (model_name, review_status, flagged_at),
    ADD INDEX idx_model_priority (model_id, priority, flagged_at),
    ADD INDEX idx_violation_tracking (model_name, review_status, reviewed_at);

-- Optimize content_moderation for dashboard aggregation
ALTER TABLE content_moderation
    ADD INDEX idx_model_moderation (model_id, moderation_status, created_at),
    ADD INDEX idx_model_location (model_id, final_location, created_at);

-- ==============================================
-- NEW TABLES FOR ENHANCED FUNCTIONALITY
-- ==============================================

-- Model violation history and analytics (60-day retention)
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
    
    -- Indexes for analytics queries
    INDEX idx_model_violations (model_id, violation_type, violation_date),
    INDEX idx_violation_severity (model_name, severity_score DESC, violation_date),
    INDEX idx_date_cleanup (violation_date), -- For 60-day retention cleanup
    
    -- Foreign key constraints
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE,
    FOREIGN KEY (content_moderation_id) REFERENCES content_moderation(id) ON DELETE SET NULL,
    FOREIGN KEY (review_queue_id) REFERENCES media_review_queue(id) ON DELETE SET NULL
);

-- Admin notification thresholds and alert system
CREATE TABLE IF NOT EXISTS admin_notification_thresholds (
    id INT AUTO_INCREMENT PRIMARY KEY,
    model_id INT NULL, -- NULL = global threshold, specific ID = model-specific
    model_name VARCHAR(100), -- Denormalized for performance
    threshold_type ENUM('daily_violations', 'weekly_violations', 'pending_items', 'high_severity_rate') NOT NULL,
    threshold_value INT NOT NULL,
    time_period_hours INT DEFAULT 24,
    notification_enabled BOOLEAN DEFAULT TRUE,
    alert_email VARCHAR(255),
    last_triggered TIMESTAMP NULL,
    trigger_count INT DEFAULT 0,
    created_by INT, -- Admin user who set the threshold
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_model_thresholds (model_id, threshold_type, notification_enabled),
    INDEX idx_global_thresholds (threshold_type, notification_enabled),
    
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE
);

-- Admin preview access audit log (30-day retention for compliance)
CREATE TABLE IF NOT EXISTS admin_preview_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    admin_user_id INT NOT NULL,
    admin_username VARCHAR(100), -- Denormalized for audit reports
    content_moderation_id INT,
    review_queue_id INT,
    model_name VARCHAR(100) NOT NULL,
    preview_type ENUM('thumbnail', 'full_image', 'lightbox', 'download') NOT NULL,
    image_path VARCHAR(255),
    access_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT,
    session_id VARCHAR(255),
    
    -- Audit and performance indexes
    INDEX idx_admin_access (admin_user_id, access_timestamp DESC),
    INDEX idx_content_access (content_moderation_id, access_timestamp),
    INDEX idx_model_access (model_name, access_timestamp),
    INDEX idx_cleanup_date (access_timestamp), -- For 30-day retention
    
    FOREIGN KEY (content_moderation_id) REFERENCES content_moderation(id) ON DELETE SET NULL,
    FOREIGN KEY (review_queue_id) REFERENCES media_review_queue(id) ON DELETE SET NULL
);

-- Model dashboard statistics cache (for performance)
CREATE TABLE IF NOT EXISTS model_dashboard_stats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    model_id INT NOT NULL UNIQUE,
    model_name VARCHAR(100) NOT NULL,
    
    -- Media counts by status
    total_media_count INT DEFAULT 0,
    pending_review_count INT DEFAULT 0,
    approved_count INT DEFAULT 0,
    approved_blurred_count INT DEFAULT 0,
    rejected_count INT DEFAULT 0,
    
    -- Violation statistics  
    total_violations_30d INT DEFAULT 0,
    severity_score_avg DECIMAL(3,1) DEFAULT 0.0,
    last_violation_date DATE NULL,
    violation_trend ENUM('increasing', 'stable', 'decreasing') DEFAULT 'stable',
    
    -- Activity metrics
    last_upload_date TIMESTAMP NULL,
    last_review_date TIMESTAMP NULL,
    avg_review_time_hours DECIMAL(5,1) DEFAULT 0.0,
    
    -- Cache metadata
    last_calculated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    calculation_version INT DEFAULT 1,
    
    INDEX idx_model_activity (last_upload_date DESC, last_review_date DESC),
    INDEX idx_violations (total_violations_30d DESC, severity_score_avg DESC),
    INDEX idx_pending_work (pending_review_count DESC, last_upload_date DESC),
    
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE
);

-- ==============================================
-- ENHANCED COLUMNS FOR EXISTING TABLES
-- ==============================================

-- Add watermark tracking to content_moderation
ALTER TABLE content_moderation 
    ADD COLUMN admin_preview_watermarked BOOLEAN DEFAULT FALSE,
    ADD COLUMN watermark_generated_at TIMESTAMP NULL,
    ADD COLUMN preview_access_count INT DEFAULT 0;

-- Add violation categorization to media_review_queue
ALTER TABLE media_review_queue
    ADD COLUMN violation_category ENUM('content', 'age', 'policy', 'technical') NULL,
    ADD COLUMN violation_severity DECIMAL(3,1) DEFAULT 0.0,
    ADD COLUMN requires_manual_review BOOLEAN DEFAULT FALSE,
    ADD COLUMN escalation_reason TEXT NULL;

-- ==============================================
-- STORED PROCEDURES FOR MAINTENANCE
-- ==============================================

-- Procedure to clean up old violation history (60-day retention)
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS CleanupViolationHistory()
BEGIN
    DELETE FROM model_violation_history 
    WHERE violation_date < DATE_SUB(CURRENT_DATE, INTERVAL 60 DAY);
    
    DELETE FROM admin_preview_log 
    WHERE access_timestamp < DATE_SUB(NOW(), INTERVAL 30 DAY);
    
    -- Log cleanup activity
    INSERT INTO admin_preview_log (admin_user_id, admin_username, model_name, preview_type, image_path, ip_address) 
    VALUES (0, 'SYSTEM_CLEANUP', 'SYSTEM', 'download', 'cleanup_completed', '127.0.0.1');
END //
DELIMITER ;

-- Procedure to update model dashboard statistics cache
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS UpdateModelDashboardStats(IN target_model_id INT)
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE model_cursor CURSOR FOR 
        SELECT id, name FROM models WHERE (target_model_id IS NULL OR id = target_model_id);
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
    
    DECLARE current_model_id INT;
    DECLARE current_model_name VARCHAR(100);
    
    OPEN model_cursor;
    
    model_loop: LOOP
        FETCH model_cursor INTO current_model_id, current_model_name;
        IF done THEN
            LEAVE model_loop;
        END IF;
        
        -- Upsert statistics for this model
        INSERT INTO model_dashboard_stats (
            model_id, model_name,
            total_media_count, pending_review_count, approved_count, 
            approved_blurred_count, rejected_count,
            total_violations_30d, last_violation_date, last_upload_date
        )
        SELECT 
            current_model_id,
            current_model_name,
            COALESCE(media_counts.total_count, 0),
            COALESCE(media_counts.pending_count, 0),
            COALESCE(media_counts.approved_count, 0),
            COALESCE(media_counts.approved_blurred_count, 0),
            COALESCE(media_counts.rejected_count, 0),
            COALESCE(violation_stats.violation_count, 0),
            violation_stats.last_violation,
            media_counts.last_upload
        FROM (
            SELECT 
                COUNT(*) as total_count,
                SUM(CASE WHEN review_status = 'pending' THEN 1 ELSE 0 END) as pending_count,
                SUM(CASE WHEN review_status = 'approved' THEN 1 ELSE 0 END) as approved_count,
                SUM(CASE WHEN review_status = 'approved_blurred' THEN 1 ELSE 0 END) as approved_blurred_count,
                SUM(CASE WHEN review_status = 'rejected' THEN 1 ELSE 0 END) as rejected_count,
                MAX(flagged_at) as last_upload
            FROM media_review_queue 
            WHERE model_id = current_model_id
        ) media_counts
        LEFT JOIN (
            SELECT 
                COUNT(*) as violation_count,
                MAX(violation_date) as last_violation
            FROM model_violation_history 
            WHERE model_id = current_model_id 
            AND violation_date >= DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY)
        ) violation_stats ON 1=1
        ON DUPLICATE KEY UPDATE
            total_media_count = VALUES(total_media_count),
            pending_review_count = VALUES(pending_review_count),
            approved_count = VALUES(approved_count),
            approved_blurred_count = VALUES(approved_blurred_count),
            rejected_count = VALUES(rejected_count),
            total_violations_30d = VALUES(total_violations_30d),
            last_violation_date = VALUES(last_violation_date),
            last_upload_date = VALUES(last_upload_date);
            
    END LOOP;
    
    CLOSE model_cursor;
END //
DELIMITER ;

-- ==============================================
-- ROLLBACK SCRIPT (SAFETY)
-- ==============================================

/*
-- ROLLBACK COMMANDS (DO NOT EXECUTE UNLESS NEEDED)

DROP PROCEDURE IF EXISTS UpdateModelDashboardStats;
DROP PROCEDURE IF EXISTS CleanupViolationHistory;

DROP TABLE IF EXISTS model_dashboard_stats;
DROP TABLE IF EXISTS admin_preview_log;
DROP TABLE IF EXISTS admin_notification_thresholds;
DROP TABLE IF EXISTS model_violation_history;

ALTER TABLE content_moderation 
    DROP COLUMN IF EXISTS preview_access_count,
    DROP COLUMN IF EXISTS watermark_generated_at,
    DROP COLUMN IF EXISTS admin_preview_watermarked;

ALTER TABLE media_review_queue
    DROP COLUMN IF EXISTS escalation_reason,
    DROP COLUMN IF EXISTS requires_manual_review,
    DROP COLUMN IF EXISTS violation_severity,
    DROP COLUMN IF EXISTS violation_category;

ALTER TABLE media_review_queue 
    DROP INDEX IF EXISTS idx_violation_tracking,
    DROP INDEX IF EXISTS idx_model_priority,
    DROP INDEX IF EXISTS idx_model_status;

ALTER TABLE content_moderation
    DROP INDEX IF EXISTS idx_model_location,
    DROP INDEX IF EXISTS idx_model_moderation;
*/

-- ==============================================
-- INITIAL DATA SETUP
-- ==============================================

-- Set up default notification thresholds
INSERT IGNORE INTO admin_notification_thresholds (
    model_id, threshold_type, threshold_value, time_period_hours, 
    notification_enabled, alert_email
) VALUES
(NULL, 'daily_violations', 5, 24, TRUE, 'admin@musenest.com'),
(NULL, 'weekly_violations', 20, 168, TRUE, 'admin@musenest.com'),
(NULL, 'pending_items', 50, 24, TRUE, 'admin@musenest.com'),
(NULL, 'high_severity_rate', 3, 24, TRUE, 'admin@musenest.com');

-- Initialize dashboard stats for existing models
CALL UpdateModelDashboardStats(NULL);

-- ==============================================
-- MIGRATION COMPLETE
-- ==============================================