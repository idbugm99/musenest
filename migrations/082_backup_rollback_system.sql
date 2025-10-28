-- Backup and Rollback System Database Schema
-- Extends existing BackupRecoveryService with comprehensive tracking and rollback capabilities

-- Backup records table for tracking all backup operations
CREATE TABLE IF NOT EXISTS backup_records (
    id VARCHAR(255) PRIMARY KEY,
    type ENUM('full', 'incremental', 'config_only', 'emergency') NOT NULL,
    status ENUM('preparing', 'in_progress', 'completed', 'failed', 'cancelled') NOT NULL DEFAULT 'preparing',
    reason TEXT,
    components JSON, -- Array of backed up components ['database', 'filesystem', 'configuration']
    files JSON, -- Map of component -> file information
    size_bytes BIGINT UNSIGNED DEFAULT 0,
    duration_ms INT UNSIGNED,
    checksum VARCHAR(64),
    compression_enabled BOOLEAN DEFAULT FALSE,
    encryption_enabled BOOLEAN DEFAULT FALSE,
    cloud_location VARCHAR(500),
    baseline_backup_id VARCHAR(255), -- For incremental backups
    triggered_by ENUM('manual', 'scheduled', 'pre_migration', 'pre_rollback', 'emergency') DEFAULT 'manual',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    
    INDEX idx_type (type),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at),
    INDEX idx_triggered_by (triggered_by),
    INDEX idx_baseline (baseline_backup_id),
    
    FOREIGN KEY (baseline_backup_id) REFERENCES backup_records(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Restore operations table for tracking recovery activities
CREATE TABLE IF NOT EXISTS restore_operations (
    id VARCHAR(255) PRIMARY KEY,
    backup_id VARCHAR(255) NOT NULL,
    type ENUM('full_restore', 'partial_restore', 'emergency_rollback', 'point_in_time') NOT NULL,
    status ENUM('preparing', 'in_progress', 'completed', 'failed', 'cancelled') NOT NULL DEFAULT 'preparing',
    components JSON, -- Components restored ['database', 'filesystem', 'configuration']
    restore_options JSON, -- Restore configuration options
    pre_restore_backup_id VARCHAR(255), -- Backup created before restore
    duration_ms INT UNSIGNED,
    initiated_by VARCHAR(100), -- User or system that initiated restore
    reason TEXT,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    
    INDEX idx_backup_id (backup_id),
    INDEX idx_type (type),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at),
    
    FOREIGN KEY (backup_id) REFERENCES backup_records(id),
    FOREIGN KEY (pre_restore_backup_id) REFERENCES backup_records(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Rollback points for system state tracking
CREATE TABLE IF NOT EXISTS rollback_points (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    backup_id VARCHAR(255) NOT NULL,
    system_state JSON, -- Snapshot of critical system state
    created_before ENUM('migration', 'deployment', 'configuration_change', 'manual', 'emergency') NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    verification_details JSON,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_name (name),
    INDEX idx_created_before (created_before),
    INDEX idx_created_at (created_at),
    INDEX idx_expires_at (expires_at),
    
    FOREIGN KEY (backup_id) REFERENCES backup_records(id)
) ENGINE=InnoDB;

-- Rollback execution history
CREATE TABLE IF NOT EXISTS rollback_executions (
    id VARCHAR(255) PRIMARY KEY,
    rollback_point_id VARCHAR(255) NOT NULL,
    restore_operation_id VARCHAR(255) NOT NULL,
    trigger_reason ENUM('migration_failure', 'system_failure', 'manual_request', 'automated_trigger', 'emergency') NOT NULL,
    execution_plan JSON, -- Detailed rollback execution steps
    verification_results JSON, -- Post-rollback verification results
    rollback_duration_ms INT UNSIGNED,
    success_rate DECIMAL(5,2), -- Percentage of successful rollback steps
    executed_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_rollback_point (rollback_point_id),
    INDEX idx_restore_operation (restore_operation_id),
    INDEX idx_trigger_reason (trigger_reason),
    INDEX idx_created_at (created_at),
    
    FOREIGN KEY (rollback_point_id) REFERENCES rollback_points(id),
    FOREIGN KEY (restore_operation_id) REFERENCES restore_operations(id)
) ENGINE=InnoDB;

-- Backup file integrity tracking
CREATE TABLE IF NOT EXISTS backup_file_integrity (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    backup_id VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_type ENUM('database_dump', 'filesystem_archive', 'configuration_export', 'metadata') NOT NULL,
    original_checksum VARCHAR(64) NOT NULL,
    current_checksum VARCHAR(64),
    file_size_bytes BIGINT UNSIGNED NOT NULL,
    last_verified_at TIMESTAMP NULL,
    verification_status ENUM('valid', 'corrupted', 'missing', 'pending') DEFAULT 'pending',
    error_details TEXT,
    
    INDEX idx_backup_id (backup_id),
    INDEX idx_file_type (file_type),
    INDEX idx_verification_status (verification_status),
    INDEX idx_last_verified (last_verified_at),
    
    FOREIGN KEY (backup_id) REFERENCES backup_records(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- System recovery procedures for automated rollback
CREATE TABLE IF NOT EXISTS recovery_procedures (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    trigger_conditions JSON, -- Conditions that trigger this procedure
    procedure_steps JSON, -- Ordered list of recovery steps
    verification_steps JSON, -- Steps to verify successful recovery
    execution_timeout_minutes INT DEFAULT 30,
    max_retries INT DEFAULT 3,
    is_active BOOLEAN DEFAULT TRUE,
    priority_level ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_name (name),
    INDEX idx_is_active (is_active),
    INDEX idx_priority_level (priority_level)
) ENGINE=InnoDB;

-- Recovery procedure execution log
CREATE TABLE IF NOT EXISTS recovery_procedure_executions (
    id VARCHAR(255) PRIMARY KEY,
    procedure_id VARCHAR(255) NOT NULL,
    trigger_event VARCHAR(255),
    execution_status ENUM('initiated', 'in_progress', 'completed', 'failed', 'timeout', 'cancelled') DEFAULT 'initiated',
    steps_completed INT DEFAULT 0,
    total_steps INT DEFAULT 0,
    current_step_details JSON,
    execution_log TEXT, -- Detailed execution log
    error_message TEXT,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    
    INDEX idx_procedure_id (procedure_id),
    INDEX idx_trigger_event (trigger_event),
    INDEX idx_execution_status (execution_status),
    INDEX idx_started_at (started_at),
    
    FOREIGN KEY (procedure_id) REFERENCES recovery_procedures(id)
) ENGINE=InnoDB;

-- Backup schedule configuration
CREATE TABLE IF NOT EXISTS backup_schedules (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    backup_type ENUM('full', 'incremental', 'config_only') NOT NULL,
    frequency ENUM('hourly', 'daily', 'weekly', 'monthly', 'custom') NOT NULL,
    cron_expression VARCHAR(100), -- For custom schedules
    retention_policy JSON, -- Retention rules for this schedule
    notification_settings JSON, -- Alert/notification configuration
    is_active BOOLEAN DEFAULT TRUE,
    last_execution_at TIMESTAMP NULL,
    next_execution_at TIMESTAMP NULL,
    consecutive_failures INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_frequency (frequency),
    INDEX idx_is_active (is_active),
    INDEX idx_next_execution (next_execution_at),
    INDEX idx_last_execution (last_execution_at)
) ENGINE=InnoDB;

-- Create views for backup and recovery reporting

-- Backup summary view
CREATE OR REPLACE VIEW v_backup_summary AS
SELECT 
    br.type,
    br.status,
    COUNT(*) as total_backups,
    SUM(br.size_bytes) as total_size_bytes,
    AVG(br.duration_ms) as avg_duration_ms,
    MIN(br.created_at) as first_backup,
    MAX(br.created_at) as latest_backup,
    SUM(CASE WHEN br.status = 'completed' THEN 1 ELSE 0 END) as successful_backups,
    SUM(CASE WHEN br.status = 'failed' THEN 1 ELSE 0 END) as failed_backups
FROM backup_records br
WHERE br.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY br.type, br.status;

-- Recovery operations summary
CREATE OR REPLACE VIEW v_recovery_summary AS
SELECT 
    ro.type,
    ro.status,
    COUNT(*) as total_operations,
    AVG(ro.duration_ms) as avg_duration_ms,
    SUM(CASE WHEN ro.status = 'completed' THEN 1 ELSE 0 END) as successful_operations,
    SUM(CASE WHEN ro.status = 'failed' THEN 1 ELSE 0 END) as failed_operations,
    MAX(ro.created_at) as latest_operation
FROM restore_operations ro
WHERE ro.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY ro.type, ro.status;

-- System rollback readiness view
CREATE OR REPLACE VIEW v_rollback_readiness AS
SELECT 
    rp.created_before,
    COUNT(*) as available_rollback_points,
    COUNT(CASE WHEN rp.is_verified = TRUE THEN 1 END) as verified_points,
    MIN(rp.created_at) as oldest_point,
    MAX(rp.created_at) as newest_point,
    COUNT(CASE WHEN rp.expires_at > NOW() THEN 1 END) as active_points
FROM rollback_points rp
GROUP BY rp.created_before;

-- Insert default recovery procedures
INSERT INTO recovery_procedures (
    id, name, description, trigger_conditions, procedure_steps, 
    verification_steps, execution_timeout_minutes, priority_level
) VALUES
-- Database corruption recovery
(
    'db_corruption_recovery',
    'Database Corruption Recovery',
    'Automated recovery procedure for database corruption scenarios',
    JSON_OBJECT(
        'database_errors', JSON_ARRAY('table_corrupt', 'index_corrupt', 'connection_failure'),
        'error_threshold', 5,
        'time_window_minutes', 10
    ),
    JSON_ARRAY(
        JSON_OBJECT('step', 'stop_application', 'timeout_seconds', 30),
        JSON_OBJECT('step', 'create_emergency_backup', 'timeout_seconds', 300),
        JSON_OBJECT('step', 'restore_from_latest_backup', 'timeout_seconds', 600),
        JSON_OBJECT('step', 'verify_database_integrity', 'timeout_seconds', 120),
        JSON_OBJECT('step', 'restart_application', 'timeout_seconds', 60)
    ),
    JSON_ARRAY(
        JSON_OBJECT('check', 'database_connectivity', 'expected', 'success'),
        JSON_OBJECT('check', 'table_integrity', 'expected', 'valid'),
        JSON_OBJECT('check', 'application_health', 'expected', 'healthy')
    ),
    45,
    'critical'
),

-- Theme system failure recovery
(
    'theme_system_recovery',
    'Theme System Failure Recovery',
    'Recovery procedure for theme rendering or migration failures',
    JSON_OBJECT(
        'theme_errors', JSON_ARRAY('render_failure', 'asset_missing', 'template_error'),
        'migration_failure', true,
        'rollback_required', true
    ),
    JSON_ARRAY(
        JSON_OBJECT('step', 'identify_failing_theme', 'timeout_seconds', 30),
        JSON_OBJECT('step', 'rollback_theme_migration', 'timeout_seconds', 300),
        JSON_OBJECT('step', 'restore_theme_configurations', 'timeout_seconds', 180),
        JSON_OBJECT('step', 'clear_theme_cache', 'timeout_seconds', 60),
        JSON_OBJECT('step', 'verify_theme_rendering', 'timeout_seconds', 120)
    ),
    JSON_ARRAY(
        JSON_OBJECT('check', 'theme_rendering', 'expected', 'success'),
        JSON_OBJECT('check', 'asset_loading', 'expected', 'complete'),
        JSON_OBJECT('check', 'user_experience_metrics', 'expected', 'within_baseline')
    ),
    30,
    'high'
),

-- Gallery system recovery
(
    'gallery_system_recovery',
    'Gallery System Recovery',
    'Recovery procedure for gallery performance or functionality issues',
    JSON_OBJECT(
        'gallery_errors', JSON_ARRAY('load_timeout', 'image_processing_failure', 'cache_corruption'),
        'performance_degradation', true,
        'error_rate_threshold', 0.1
    ),
    JSON_ARRAY(
        JSON_OBJECT('step', 'clear_gallery_cache', 'timeout_seconds', 120),
        JSON_OBJECT('step', 'restart_image_processing', 'timeout_seconds', 60),
        JSON_OBJECT('step', 'restore_gallery_configuration', 'timeout_seconds', 180),
        JSON_OBJECT('step', 'regenerate_thumbnails', 'timeout_seconds', 600),
        JSON_OBJECT('step', 'verify_gallery_performance', 'timeout_seconds', 300)
    ),
    JSON_ARRAY(
        JSON_OBJECT('check', 'gallery_load_time', 'expected', 'under_2000ms'),
        JSON_OBJECT('check', 'image_processing_queue', 'expected', 'empty'),
        JSON_OBJECT('check', 'cache_hit_rate', 'expected', 'above_80_percent')
    ),
    35,
    'high'
);

-- Insert default backup schedules
INSERT INTO backup_schedules (
    id, name, backup_type, frequency, retention_policy, 
    notification_settings, next_execution_at
) VALUES
-- Daily full backup
(
    'daily_full_backup',
    'Daily Full System Backup',
    'full',
    'daily',
    JSON_OBJECT(
        'keep_daily', 7,
        'keep_weekly', 4,
        'keep_monthly', 12,
        'compress', true,
        'encrypt', false
    ),
    JSON_OBJECT(
        'on_success', JSON_ARRAY('email'),
        'on_failure', JSON_ARRAY('email', 'alert'),
        'recipients', JSON_ARRAY('admin@phoenix4ge.com')
    ),
    DATE_ADD(DATE_ADD(CURDATE(), INTERVAL 1 DAY), INTERVAL 3 HOUR)
),

-- Hourly incremental backup
(
    'hourly_incremental_backup',
    'Hourly Incremental Backup',
    'incremental',
    'hourly',
    JSON_OBJECT(
        'keep_hours', 48,
        'keep_daily', 7,
        'compress', true,
        'encrypt', false
    ),
    JSON_OBJECT(
        'on_success', JSON_ARRAY('log'),
        'on_failure', JSON_ARRAY('email', 'alert'),
        'recipients', JSON_ARRAY('admin@phoenix4ge.com')
    ),
    DATE_ADD(NOW(), INTERVAL 1 HOUR)
),

-- Pre-migration backup
(
    'pre_migration_backup',
    'Pre-Migration Safety Backup',
    'full',
    'custom',
    JSON_OBJECT(
        'keep_count', 10,
        'compress', true,
        'encrypt', true,
        'priority', 'high'
    ),
    JSON_OBJECT(
        'on_success', JSON_ARRAY('email', 'log'),
        'on_failure', JSON_ARRAY('email', 'alert', 'slack'),
        'recipients', JSON_ARRAY('admin@phoenix4ge.com', 'dev-team@phoenix4ge.com')
    ),
    NULL -- Triggered manually before migrations
);

-- Create indexes for optimal performance
CREATE INDEX idx_backup_records_composite ON backup_records (type, status, created_at);
CREATE INDEX idx_restore_operations_composite ON restore_operations (type, status, created_at);
CREATE INDEX idx_rollback_points_composite ON rollback_points (created_before, is_verified, expires_at);
CREATE INDEX idx_backup_file_integrity_composite ON backup_file_integrity (backup_id, verification_status, last_verified_at);