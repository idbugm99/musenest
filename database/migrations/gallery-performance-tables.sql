-- Gallery Performance Monitoring Database Schema
-- Creates tables for storing performance analytics and monitoring data

-- Main performance sessions table
CREATE TABLE IF NOT EXISTS gallery_performance_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL UNIQUE,
    timestamp DATETIME NOT NULL,
    session_duration INT NOT NULL, -- in milliseconds
    url TEXT,
    user_agent TEXT,
    viewport_width INT,
    viewport_height INT,
    device_pixel_ratio DECIMAL(3,2),
    connection_type VARCHAR(50),
    connection_downlink DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_timestamp (timestamp),
    INDEX idx_session_id (session_id),
    INDEX idx_created_at (created_at)
);

-- Core Web Vitals metrics
CREATE TABLE IF NOT EXISTS gallery_core_web_vitals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL,
    lcp_value DECIMAL(8,2), -- Largest Contentful Paint in ms
    lcp_rating ENUM('good', 'needs-improvement', 'poor', 'unknown') DEFAULT 'unknown',
    fid_value DECIMAL(8,2), -- First Input Delay in ms
    fid_rating ENUM('good', 'needs-improvement', 'poor', 'unknown') DEFAULT 'unknown',
    cls_value DECIMAL(6,4), -- Cumulative Layout Shift
    cls_rating ENUM('good', 'needs-improvement', 'poor', 'unknown') DEFAULT 'unknown',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (session_id) REFERENCES gallery_performance_sessions(id) ON DELETE CASCADE,
    INDEX idx_session_id (session_id),
    INDEX idx_lcp_value (lcp_value),
    INDEX idx_fid_value (fid_value),
    INDEX idx_cls_value (cls_value)
);

-- Image loading performance metrics
CREATE TABLE IF NOT EXISTS gallery_image_metrics (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL,
    total_images INT DEFAULT 0,
    loaded_images INT DEFAULT 0,
    failed_images INT DEFAULT 0,
    average_load_time DECIMAL(8,2), -- in ms
    largest_image_size BIGINT, -- in bytes
    total_data_transfer BIGINT, -- in bytes
    success_rate DECIMAL(5,2), -- percentage
    average_image_size DECIMAL(10,2), -- in bytes
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (session_id) REFERENCES gallery_performance_sessions(id) ON DELETE CASCADE,
    INDEX idx_session_id (session_id),
    INDEX idx_success_rate (success_rate),
    INDEX idx_average_load_time (average_load_time)
);

-- User interaction analytics
CREATE TABLE IF NOT EXISTS gallery_user_interactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL,
    gallery_views INT DEFAULT 0,
    image_clicks INT DEFAULT 0,
    lightbox_opens INT DEFAULT 0,
    scroll_depth INT DEFAULT 0, -- percentage
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (session_id) REFERENCES gallery_performance_sessions(id) ON DELETE CASCADE,
    INDEX idx_session_id (session_id),
    INDEX idx_gallery_views (gallery_views),
    INDEX idx_image_clicks (image_clicks)
);

-- Cache performance metrics
CREATE TABLE IF NOT EXISTS gallery_cache_metrics (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL,
    cache_hits INT DEFAULT 0,
    cache_misses INT DEFAULT 0,
    prefetch_hits INT DEFAULT 0,
    hit_rate DECIMAL(5,2), -- percentage
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (session_id) REFERENCES gallery_performance_sessions(id) ON DELETE CASCADE,
    INDEX idx_session_id (session_id),
    INDEX idx_hit_rate (hit_rate)
);

-- Detailed performance timeline for real-time metrics
CREATE TABLE IF NOT EXISTS gallery_performance_timeline (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL,
    category VARCHAR(100) NOT NULL, -- e.g., 'core_web_vitals', 'image_performance', etc.
    metric_data JSON, -- flexible storage for metric details
    metric_timestamp DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (session_id) REFERENCES gallery_performance_sessions(id) ON DELETE CASCADE,
    INDEX idx_session_id (session_id),
    INDEX idx_category (category),
    INDEX idx_metric_timestamp (metric_timestamp)
);

-- Performance recommendations and alerts
CREATE TABLE IF NOT EXISTS gallery_performance_recommendations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL,
    category VARCHAR(100) NOT NULL, -- e.g., 'LCP', 'Images', 'Caching'
    severity ENUM('low', 'medium', 'high') NOT NULL,
    message TEXT NOT NULL,
    metric_value VARCHAR(255), -- current metric value
    suggestion TEXT, -- specific improvement suggestion
    is_resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP NULL,
    
    FOREIGN KEY (session_id) REFERENCES gallery_performance_sessions(id) ON DELETE CASCADE,
    INDEX idx_session_id (session_id),
    INDEX idx_category (category),
    INDEX idx_severity (severity),
    INDEX idx_is_resolved (is_resolved)
);

-- Performance alerts for real-time monitoring
CREATE TABLE IF NOT EXISTS gallery_performance_alerts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    alert_type VARCHAR(100) NOT NULL, -- e.g., 'high_lcp', 'memory_usage', etc.
    threshold_value DECIMAL(10,2) NOT NULL,
    current_value DECIMAL(10,2) NOT NULL,
    severity ENUM('low', 'medium', 'high', 'critical') NOT NULL,
    message TEXT NOT NULL,
    url TEXT,
    is_acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by VARCHAR(255),
    acknowledged_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_alert_type (alert_type),
    INDEX idx_severity (severity),
    INDEX idx_is_acknowledged (is_acknowledged),
    INDEX idx_created_at (created_at)
);

-- Performance optimization history
CREATE TABLE IF NOT EXISTS gallery_performance_optimizations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    optimization_type VARCHAR(100) NOT NULL, -- e.g., 'image_compression', 'cache_improvement'
    description TEXT NOT NULL,
    before_value DECIMAL(10,2),
    after_value DECIMAL(10,2),
    improvement_percentage DECIMAL(5,2),
    applied_by VARCHAR(255),
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_optimization_type (optimization_type),
    INDEX idx_applied_at (applied_at),
    INDEX idx_improvement_percentage (improvement_percentage)
);

-- Performance benchmarks for comparison
CREATE TABLE IF NOT EXISTS gallery_performance_benchmarks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    benchmark_name VARCHAR(255) NOT NULL,
    metric_category VARCHAR(100) NOT NULL,
    target_value DECIMAL(10,2) NOT NULL,
    good_threshold DECIMAL(10,2) NOT NULL,
    poor_threshold DECIMAL(10,2) NOT NULL,
    unit VARCHAR(50) NOT NULL, -- e.g., 'ms', 'bytes', '%'
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_benchmark (benchmark_name, metric_category),
    INDEX idx_metric_category (metric_category),
    INDEX idx_is_active (is_active)
);

-- Insert default performance benchmarks
INSERT INTO gallery_performance_benchmarks 
    (benchmark_name, metric_category, target_value, good_threshold, poor_threshold, unit, description) 
VALUES 
    ('LCP Target', 'lcp', 1800, 2500, 4000, 'ms', 'Largest Contentful Paint benchmark'),
    ('FID Target', 'fid', 50, 100, 300, 'ms', 'First Input Delay benchmark'),
    ('CLS Target', 'cls', 0.05, 0.1, 0.25, 'score', 'Cumulative Layout Shift benchmark'),
    ('Image Load Time', 'image_load_time', 800, 1500, 3000, 'ms', 'Average image loading time'),
    ('Cache Hit Rate', 'cache_hit_rate', 90, 80, 60, '%', 'Cache efficiency benchmark'),
    ('Image Success Rate', 'image_success_rate', 99, 95, 90, '%', 'Image loading success rate'),
    ('Memory Usage', 'memory_usage', 70, 85, 95, '%', 'JavaScript heap memory usage'),
    ('Session Duration', 'session_duration', 120, 60, 30, 's', 'User engagement benchmark')
ON DUPLICATE KEY UPDATE 
    target_value = VALUES(target_value),
    good_threshold = VALUES(good_threshold),
    poor_threshold = VALUES(poor_threshold),
    updated_at = CURRENT_TIMESTAMP;

-- Create indexes for performance optimization
CREATE INDEX idx_sessions_date_url ON gallery_performance_sessions(created_at, url(100));
CREATE INDEX idx_cwv_ratings ON gallery_core_web_vitals(lcp_rating, fid_rating, cls_rating);
CREATE INDEX idx_recommendations_unresolved ON gallery_performance_recommendations(is_resolved, severity, created_at);

-- Add comments to tables for documentation
ALTER TABLE gallery_performance_sessions COMMENT = 'Stores main performance session data and browser information';
ALTER TABLE gallery_core_web_vitals COMMENT = 'Core Web Vitals metrics (LCP, FID, CLS) for each session';
ALTER TABLE gallery_image_metrics COMMENT = 'Image loading performance metrics and statistics';
ALTER TABLE gallery_user_interactions COMMENT = 'User interaction analytics and engagement metrics';
ALTER TABLE gallery_cache_metrics COMMENT = 'Cache performance and efficiency metrics';
ALTER TABLE gallery_performance_timeline COMMENT = 'Detailed timeline of performance events';
ALTER TABLE gallery_performance_recommendations COMMENT = 'Generated performance recommendations and suggestions';
ALTER TABLE gallery_performance_alerts COMMENT = 'Real-time performance alerts and thresholds';
ALTER TABLE gallery_performance_optimizations COMMENT = 'History of applied performance optimizations';
ALTER TABLE gallery_performance_benchmarks COMMENT = 'Performance benchmarks and target thresholds';