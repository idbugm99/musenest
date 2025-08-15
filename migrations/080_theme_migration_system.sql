-- Theme Migration System Database Schema
-- Supports progressive rollouts, A/B testing, and automated rollback

-- Main migrations table
CREATE TABLE IF NOT EXISTS theme_migrations (
    id VARCHAR(255) PRIMARY KEY,
    config JSON NOT NULL,
    status ENUM('preparing', 'in_progress', 'completed', 'rolled_back', 'failed') DEFAULT 'preparing',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB;

-- Track individual user migrations
CREATE TABLE IF NOT EXISTS user_theme_migrations (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    migration_id VARCHAR(255) NOT NULL,
    model_id BIGINT NOT NULL,
    user_id BIGINT NULL, -- NULL for model-level migrations
    old_theme_id BIGINT NOT NULL,
    new_theme_id BIGINT NOT NULL,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reverted_at TIMESTAMP NULL,
    status ENUM('active', 'reverted', 'completed') DEFAULT 'active',
    
    FOREIGN KEY (migration_id) REFERENCES theme_migrations(id) ON DELETE CASCADE,
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE,
    FOREIGN KEY (old_theme_id) REFERENCES theme_sets(id),
    FOREIGN KEY (new_theme_id) REFERENCES theme_sets(id),
    
    INDEX idx_migration_id (migration_id),
    INDEX idx_model_user (model_id, user_id),
    INDEX idx_status (status),
    INDEX idx_applied_at (applied_at)
) ENGINE=InnoDB;

-- Migration performance metrics
CREATE TABLE IF NOT EXISTS migration_metrics (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    migration_id VARCHAR(255) NOT NULL,
    phase_name VARCHAR(100) NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(10,4) NOT NULL,
    collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (migration_id) REFERENCES theme_migrations(id) ON DELETE CASCADE,
    
    INDEX idx_migration_phase (migration_id, phase_name),
    INDEX idx_metric_name (metric_name),
    INDEX idx_collected_at (collected_at)
) ENGINE=InnoDB;

-- User feedback for migrations
CREATE TABLE IF NOT EXISTS migration_user_feedback (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    migration_id VARCHAR(255) NOT NULL,
    model_id BIGINT NOT NULL,
    user_id BIGINT NULL,
    rating TINYINT NOT NULL, -- 1-5 rating
    feedback_text TEXT NULL,
    feedback_type ENUM('rating', 'complaint', 'compliment', 'suggestion') DEFAULT 'rating',
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (migration_id) REFERENCES theme_migrations(id) ON DELETE CASCADE,
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE,
    
    INDEX idx_migration_id (migration_id),
    INDEX idx_rating (rating),
    INDEX idx_feedback_type (feedback_type),
    INDEX idx_submitted_at (submitted_at)
) ENGINE=InnoDB;

-- A/B test configurations
CREATE TABLE IF NOT EXISTS ab_test_configs (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    migration_id VARCHAR(255) NULL, -- Link to migration if applicable
    control_theme_id BIGINT NOT NULL,
    variant_theme_id BIGINT NOT NULL,
    traffic_split DECIMAL(3,2) NOT NULL DEFAULT 0.50, -- 0.50 = 50/50 split
    target_models JSON NULL, -- Array of model IDs
    inclusion_criteria JSON NULL,
    exclusion_criteria JSON NULL,
    status ENUM('draft', 'active', 'paused', 'completed') DEFAULT 'draft',
    start_date TIMESTAMP NULL,
    end_date TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (migration_id) REFERENCES theme_migrations(id) ON DELETE SET NULL,
    FOREIGN KEY (control_theme_id) REFERENCES theme_sets(id),
    FOREIGN KEY (variant_theme_id) REFERENCES theme_sets(id),
    
    INDEX idx_status (status),
    INDEX idx_dates (start_date, end_date),
    INDEX idx_migration_id (migration_id)
) ENGINE=InnoDB;

-- A/B test assignments
CREATE TABLE IF NOT EXISTS ab_test_assignments (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    test_id VARCHAR(255) NOT NULL,
    model_id BIGINT NOT NULL,
    user_id BIGINT NULL,
    variant ENUM('control', 'variant') NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (test_id) REFERENCES ab_test_configs(id) ON DELETE CASCADE,
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE,
    
    UNIQUE KEY unique_assignment (test_id, model_id, user_id),
    INDEX idx_test_variant (test_id, variant),
    INDEX idx_assigned_at (assigned_at)
) ENGINE=InnoDB;

-- Migration rollback triggers
CREATE TABLE IF NOT EXISTS migration_rollback_triggers (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    migration_id VARCHAR(255) NOT NULL,
    trigger_type ENUM('error_rate', 'performance_degradation', 'user_satisfaction', 'manual') NOT NULL,
    trigger_value DECIMAL(10,4) NOT NULL,
    threshold_value DECIMAL(10,4) NOT NULL,
    severity ENUM('low', 'medium', 'high', 'critical') NOT NULL,
    triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP NULL,
    action_taken ENUM('ignore', 'pause', 'rollback', 'extend_monitoring') NULL,
    notes TEXT NULL,
    
    FOREIGN KEY (migration_id) REFERENCES theme_migrations(id) ON DELETE CASCADE,
    
    INDEX idx_migration_id (migration_id),
    INDEX idx_trigger_type (trigger_type),
    INDEX idx_severity (severity),
    INDEX idx_triggered_at (triggered_at)
) ENGINE=InnoDB;

-- Request logs enhanced for migration tracking
CREATE TABLE IF NOT EXISTS request_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    model_id BIGINT NOT NULL,
    user_id BIGINT NULL,
    request_path VARCHAR(255) NOT NULL,
    method ENUM('GET', 'POST', 'PUT', 'DELETE') NOT NULL,
    status_code SMALLINT NOT NULL,
    response_time_ms INT NOT NULL,
    user_agent TEXT NULL,
    ip_address VARCHAR(45) NULL,
    referer TEXT NULL,
    theme_id BIGINT NULL, -- Track which theme served the request
    migration_id VARCHAR(255) NULL, -- Track if part of migration
    level ENUM('info', 'warn', 'error') DEFAULT 'info',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE,
    FOREIGN KEY (theme_id) REFERENCES theme_sets(id) ON DELETE SET NULL,
    FOREIGN KEY (migration_id) REFERENCES theme_migrations(id) ON DELETE SET NULL,
    
    INDEX idx_model_timestamp (model_id, timestamp),
    INDEX idx_status_code (status_code),
    INDEX idx_migration_id (migration_id),
    INDEX idx_level (level),
    INDEX idx_timestamp (timestamp)
) ENGINE=InnoDB;

-- Performance snapshots for comparison
CREATE TABLE IF NOT EXISTS theme_performance_snapshots (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    theme_id BIGINT NOT NULL,
    model_id BIGINT NULL, -- NULL for system-wide snapshots
    snapshot_type ENUM('baseline', 'migration', 'post_migration') NOT NULL,
    migration_id VARCHAR(255) NULL,
    metrics JSON NOT NULL, -- Core Web Vitals and other metrics
    sample_size INT NOT NULL,
    measurement_duration_minutes INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (theme_id) REFERENCES theme_sets(id) ON DELETE CASCADE,
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE,
    FOREIGN KEY (migration_id) REFERENCES theme_migrations(id) ON DELETE SET NULL,
    
    INDEX idx_theme_model (theme_id, model_id),
    INDEX idx_migration_id (migration_id),
    INDEX idx_snapshot_type (snapshot_type),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB;

-- Feature flags for progressive rollout control
CREATE TABLE IF NOT EXISTS feature_flags (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    flag_type ENUM('boolean', 'percentage', 'variant') NOT NULL DEFAULT 'boolean',
    default_value JSON NOT NULL,
    target_models JSON NULL, -- Array of model IDs
    user_criteria JSON NULL, -- Targeting criteria
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_name (name),
    INDEX idx_is_active (is_active),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB;

-- Feature flag evaluations cache
CREATE TABLE IF NOT EXISTS feature_flag_evaluations (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    flag_id VARCHAR(255) NOT NULL,
    model_id BIGINT NOT NULL,
    user_id BIGINT NULL,
    evaluated_value JSON NOT NULL,
    evaluation_context JSON NULL,
    ttl_expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (flag_id) REFERENCES feature_flags(id) ON DELETE CASCADE,
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE,
    
    UNIQUE KEY unique_evaluation (flag_id, model_id, user_id),
    INDEX idx_ttl_expires (ttl_expires_at),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB;

-- Create views for easier querying

-- Active migrations view
CREATE OR REPLACE VIEW v_active_migrations AS
SELECT 
    tm.id,
    tm.config->>'$.name' as name,
    tm.config->>'$.sourceTheme' as source_theme,
    tm.config->>'$.targetTheme' as target_theme,
    tm.config->>'$.currentPhase' as current_phase,
    tm.status,
    tm.created_at,
    tm.updated_at,
    COUNT(utm.id) as affected_users,
    COUNT(CASE WHEN utm.status = 'active' THEN 1 END) as active_users,
    COUNT(CASE WHEN utm.status = 'reverted' THEN 1 END) as reverted_users
FROM theme_migrations tm
LEFT JOIN user_theme_migrations utm ON tm.id = utm.migration_id
WHERE tm.status IN ('preparing', 'in_progress')
GROUP BY tm.id;

-- Migration performance view
CREATE OR REPLACE VIEW v_migration_performance AS
SELECT 
    mm.migration_id,
    mm.phase_name,
    AVG(CASE WHEN mm.metric_name = 'error_rate' THEN mm.metric_value END) as avg_error_rate,
    AVG(CASE WHEN mm.metric_name = 'response_time' THEN mm.metric_value END) as avg_response_time,
    AVG(CASE WHEN mm.metric_name = 'user_satisfaction' THEN mm.metric_value END) as avg_satisfaction,
    COUNT(DISTINCT DATE(mm.collected_at)) as measurement_days,
    MAX(mm.collected_at) as last_measured
FROM migration_metrics mm
GROUP BY mm.migration_id, mm.phase_name;

-- User migration history view
CREATE OR REPLACE VIEW v_user_migration_history AS
SELECT 
    utm.model_id,
    utm.user_id,
    tm.config->>'$.name' as migration_name,
    ts1.name as old_theme_name,
    ts2.name as new_theme_name,
    utm.applied_at,
    utm.reverted_at,
    utm.status,
    TIMESTAMPDIFF(HOUR, utm.applied_at, COALESCE(utm.reverted_at, NOW())) as duration_hours
FROM user_theme_migrations utm
JOIN theme_migrations tm ON utm.migration_id = tm.id  
JOIN theme_sets ts1 ON utm.old_theme_id = ts1.id
JOIN theme_sets ts2 ON utm.new_theme_id = ts2.id
ORDER BY utm.applied_at DESC;

-- Insert initial feature flags for migration control
INSERT INTO feature_flags (id, name, description, flag_type, default_value, is_active) VALUES
('progressive_rollout_enabled', 'Progressive Rollout System', 'Enable progressive theme rollout system', 'boolean', 'true', TRUE),
('ab_testing_enabled', 'A/B Testing', 'Enable A/B testing for theme comparisons', 'boolean', 'true', TRUE),
('auto_rollback_enabled', 'Automatic Rollback', 'Enable automatic rollback on failure criteria', 'boolean', 'true', TRUE),
('migration_monitoring_enabled', 'Migration Monitoring', 'Enable detailed migration performance monitoring', 'boolean', 'true', TRUE),
('user_feedback_collection', 'User Feedback Collection', 'Collect user feedback during migrations', 'boolean', 'true', TRUE);

-- Add initial performance thresholds as configuration
INSERT INTO feature_flags (id, name, description, flag_type, default_value, is_active) VALUES
('migration_error_threshold', 'Migration Error Threshold', 'Maximum error rate before rollback trigger', 'percentage', '0.05', TRUE),
('migration_performance_threshold', 'Performance Degradation Threshold', 'Maximum performance degradation before rollback', 'percentage', '0.15', TRUE),
('migration_satisfaction_threshold', 'User Satisfaction Threshold', 'Minimum user satisfaction score', 'percentage', '0.80', TRUE);