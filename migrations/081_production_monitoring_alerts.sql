-- Production Monitoring & Alerting System Database Schema
-- Supports alert history tracking, escalation management, and performance monitoring

-- Alert history table for tracking all sent alerts
CREATE TABLE IF NOT EXISTS alert_history (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    alert_id VARCHAR(255) NOT NULL,
    alert_type VARCHAR(100) NOT NULL,
    severity ENUM('low', 'medium', 'high', 'critical') NOT NULL,
    source VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    metadata JSON,
    channels_sent VARCHAR(255),
    successful_channels INT DEFAULT 0,
    failed_channels INT DEFAULT 0,
    escalated_at TIMESTAMP NULL,
    resolved_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_alert_id (alert_id),
    INDEX idx_alert_type (alert_type),
    INDEX idx_severity (severity),
    INDEX idx_source (source),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB;

-- Production monitoring metrics (extends existing migration_metrics)
CREATE TABLE IF NOT EXISTS production_metrics (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    metric_category ENUM('system', 'database', 'api', 'gallery', 'theme', 'user_experience', 'migration') NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(15,4) NOT NULL,
    metric_unit VARCHAR(50),
    tags JSON, -- Additional metadata (e.g., {"server": "web-01", "region": "us-east"})
    collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_category_name (metric_category, metric_name),
    INDEX idx_collected_at (collected_at),
    INDEX idx_category_time (metric_category, collected_at)
) ENGINE=InnoDB;

-- Health check results tracking
CREATE TABLE IF NOT EXISTS health_check_results (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    check_name VARCHAR(100) NOT NULL,
    check_category ENUM('database', 'gallery_api', 'theme_system', 'image_service', 'migration_system', 'external_api') NOT NULL,
    status ENUM('healthy', 'degraded', 'unhealthy') NOT NULL,
    response_time_ms INT NOT NULL,
    error_message TEXT NULL,
    additional_data JSON,
    checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_check_name (check_name),
    INDEX idx_category (check_category),
    INDEX idx_status (status),
    INDEX idx_checked_at (checked_at)
) ENGINE=InnoDB;

-- Alert escalation tracking
CREATE TABLE IF NOT EXISTS alert_escalations (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    alert_id VARCHAR(255) NOT NULL,
    original_severity ENUM('low', 'medium', 'high', 'critical') NOT NULL,
    escalated_to_severity ENUM('low', 'medium', 'high', 'critical') NOT NULL,
    escalation_rule VARCHAR(100) NOT NULL,
    trigger_value DECIMAL(10,4) NOT NULL,
    threshold_value DECIMAL(10,4) NOT NULL,
    escalated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP NULL,
    
    FOREIGN KEY (alert_id) REFERENCES alert_history(alert_id),
    
    INDEX idx_alert_id (alert_id),
    INDEX idx_escalated_at (escalated_at),
    INDEX idx_severity_escalation (original_severity, escalated_to_severity)
) ENGINE=InnoDB;

-- Alert channel delivery tracking
CREATE TABLE IF NOT EXISTS alert_deliveries (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    alert_id VARCHAR(255) NOT NULL,
    channel_name ENUM('email', 'slack', 'webhook', 'sms', 'pagerduty') NOT NULL,
    delivery_status ENUM('sent', 'failed', 'pending', 'rate_limited') NOT NULL,
    response_code INT NULL,
    response_message TEXT NULL,
    delivery_time_ms INT NULL,
    attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    delivered_at TIMESTAMP NULL,
    
    INDEX idx_alert_id (alert_id),
    INDEX idx_channel (channel_name),
    INDEX idx_status (delivery_status),
    INDEX idx_attempted_at (attempted_at)
) ENGINE=InnoDB;

-- Performance baselines for comparison
CREATE TABLE IF NOT EXISTS performance_baselines (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    baseline_name VARCHAR(100) NOT NULL,
    metric_category VARCHAR(100) NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    baseline_value DECIMAL(15,4) NOT NULL,
    acceptable_variance_percent DECIMAL(5,2) NOT NULL DEFAULT 10.00,
    warning_threshold DECIMAL(15,4) NOT NULL,
    critical_threshold DECIMAL(15,4) NOT NULL,
    measurement_window_minutes INT NOT NULL DEFAULT 60,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_baseline (baseline_name, metric_category, metric_name),
    INDEX idx_category_metric (metric_category, metric_name),
    INDEX idx_active (is_active)
) ENGINE=InnoDB;

-- System uptime tracking
CREATE TABLE IF NOT EXISTS system_uptime (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    component_name VARCHAR(100) NOT NULL,
    uptime_start TIMESTAMP NOT NULL,
    uptime_end TIMESTAMP NULL,
    downtime_duration_seconds INT NULL,
    downtime_reason TEXT NULL,
    recovery_time_seconds INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_component (component_name),
    INDEX idx_uptime_start (uptime_start),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB;

-- Create views for monitoring dashboard

-- Current system health overview
CREATE OR REPLACE VIEW v_system_health_overview AS
SELECT 
    hcr.check_category,
    COUNT(*) as total_checks,
    SUM(CASE WHEN hcr.status = 'healthy' THEN 1 ELSE 0 END) as healthy_checks,
    SUM(CASE WHEN hcr.status = 'degraded' THEN 1 ELSE 0 END) as degraded_checks,
    SUM(CASE WHEN hcr.status = 'unhealthy' THEN 1 ELSE 0 END) as unhealthy_checks,
    AVG(hcr.response_time_ms) as avg_response_time,
    MAX(hcr.checked_at) as last_check_time
FROM health_check_results hcr
WHERE hcr.checked_at >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
GROUP BY hcr.check_category;

-- Alert summary statistics
CREATE OR REPLACE VIEW v_alert_statistics AS
SELECT 
    DATE(ah.created_at) as alert_date,
    ah.severity,
    ah.source,
    COUNT(*) as alert_count,
    COUNT(CASE WHEN ah.resolved_at IS NOT NULL THEN 1 END) as resolved_count,
    AVG(TIMESTAMPDIFF(MINUTE, ah.created_at, ah.resolved_at)) as avg_resolution_time_minutes,
    COUNT(CASE WHEN ae.id IS NOT NULL THEN 1 END) as escalated_count
FROM alert_history ah
LEFT JOIN alert_escalations ae ON ah.alert_id = ae.alert_id
WHERE ah.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY DATE(ah.created_at), ah.severity, ah.source;

-- Performance metrics trend view
CREATE OR REPLACE VIEW v_performance_trends AS
SELECT 
    pm.metric_category,
    pm.metric_name,
    DATE(pm.collected_at) as metric_date,
    HOUR(pm.collected_at) as metric_hour,
    AVG(pm.metric_value) as avg_value,
    MIN(pm.metric_value) as min_value,
    MAX(pm.metric_value) as max_value,
    COUNT(*) as sample_count,
    pb.warning_threshold,
    pb.critical_threshold
FROM production_metrics pm
LEFT JOIN performance_baselines pb ON pm.metric_category = pb.metric_category 
    AND pm.metric_name = pb.metric_name 
    AND pb.is_active = TRUE
WHERE pm.collected_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
GROUP BY pm.metric_category, pm.metric_name, DATE(pm.collected_at), HOUR(pm.collected_at);

-- Active alerts view
CREATE OR REPLACE VIEW v_active_alerts AS
SELECT 
    ah.alert_id,
    ah.alert_type,
    ah.severity,
    ah.source,
    ah.title,
    ah.description,
    ah.created_at,
    TIMESTAMPDIFF(MINUTE, ah.created_at, NOW()) as minutes_active,
    COUNT(ad.id) as delivery_attempts,
    SUM(CASE WHEN ad.delivery_status = 'sent' THEN 1 ELSE 0 END) as successful_deliveries
FROM alert_history ah
LEFT JOIN alert_deliveries ad ON ah.alert_id = ad.alert_id
WHERE ah.resolved_at IS NULL
GROUP BY ah.alert_id;

-- Insert initial performance baselines
INSERT INTO performance_baselines (
    baseline_name, metric_category, metric_name, baseline_value, 
    warning_threshold, critical_threshold, measurement_window_minutes
) VALUES
    -- System performance baselines
    ('System CPU Usage', 'system', 'cpu_usage_percent', 45.0, 75.0, 90.0, 5),
    ('System Memory Usage', 'system', 'memory_usage_percent', 60.0, 80.0, 95.0, 5),
    ('System Disk Usage', 'system', 'disk_usage_percent', 50.0, 85.0, 95.0, 60),
    
    -- Database performance baselines
    ('Database Response Time', 'database', 'avg_query_time_ms', 150.0, 500.0, 1000.0, 5),
    ('Database Connection Pool', 'database', 'connection_pool_usage_percent', 40.0, 80.0, 95.0, 5),
    ('Database Error Rate', 'database', 'error_rate_percent', 0.1, 2.0, 5.0, 15),
    
    -- API performance baselines  
    ('API Response Time', 'api', 'avg_response_time_ms', 300.0, 1000.0, 3000.0, 5),
    ('API Error Rate', 'api', 'error_rate_percent', 0.5, 2.0, 5.0, 15),
    ('API Throughput', 'api', 'requests_per_second', 100.0, 50.0, 20.0, 15), -- Lower is worse for throughput
    
    -- Gallery performance baselines
    ('Gallery Load Time', 'gallery', 'page_load_time_ms', 800.0, 1500.0, 3000.0, 15),
    ('Gallery Image Load Time', 'gallery', 'image_load_time_ms', 500.0, 1200.0, 2500.0, 15),
    ('Gallery Cache Hit Rate', 'gallery', 'cache_hit_rate_percent', 85.0, 70.0, 50.0, 30), -- Lower is worse
    
    -- Theme performance baselines
    ('Theme Render Time', 'theme', 'render_time_ms', 200.0, 500.0, 1000.0, 15),
    ('Theme Asset Load Time', 'theme', 'asset_load_time_ms', 300.0, 800.0, 1500.0, 15),
    
    -- User experience baselines (Core Web Vitals)
    ('Largest Contentful Paint', 'user_experience', 'lcp_ms', 1500.0, 2500.0, 4000.0, 30),
    ('First Input Delay', 'user_experience', 'fid_ms', 50.0, 100.0, 300.0, 30),
    ('Cumulative Layout Shift', 'user_experience', 'cls_score', 0.05, 0.1, 0.25, 30);

-- Insert initial system components for uptime tracking
INSERT INTO system_uptime (component_name, uptime_start) VALUES
    ('web_server', NOW()),
    ('database_server', NOW()),
    ('image_processing', NOW()),
    ('gallery_system', NOW()),
    ('theme_engine', NOW()),
    ('migration_system', NOW())
ON DUPLICATE KEY UPDATE uptime_start = NOW();

-- Create indexes for better performance
CREATE INDEX idx_production_metrics_composite ON production_metrics (metric_category, metric_name, collected_at);
CREATE INDEX idx_alert_history_composite ON alert_history (source, severity, created_at);
CREATE INDEX idx_health_checks_composite ON health_check_results (check_category, status, checked_at);