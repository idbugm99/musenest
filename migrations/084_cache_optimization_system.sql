-- Cache Optimization System Migration
-- Adds tables and infrastructure for ML-based cache optimization

USE musenest;

-- Cache optimization analysis results
CREATE TABLE IF NOT EXISTS cache_optimization_analysis (
    id INT PRIMARY KEY AUTO_INCREMENT,
    analysis_data JSON NOT NULL,
    overall_score DECIMAL(4,3) DEFAULT 0.000,
    recommendation_count INT DEFAULT 0,
    strategies_analyzed JSON,
    performance_impact JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_overall_score (overall_score),
    INDEX idx_created_at (created_at),
    INDEX idx_recommendation_count (recommendation_count)
);

-- Cache optimization recommendations
CREATE TABLE IF NOT EXISTS cache_optimization_recommendations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    recommendation_type ENUM('ttl_optimization', 'cache_warming', 'memory_optimization', 'access_pattern_optimization', 'tiered_caching') NOT NULL,
    strategy_name VARCHAR(100) NOT NULL,
    priority ENUM('low', 'medium', 'high', 'critical') NOT NULL,
    confidence_score DECIMAL(4,3) NOT NULL,
    current_metrics JSON NOT NULL,
    recommended_changes JSON NOT NULL,
    reasoning TEXT,
    implementation_plan JSON,
    expected_impact JSON,
    status ENUM('pending', 'implemented', 'rejected', 'expired') DEFAULT 'pending',
    implemented_at TIMESTAMP NULL,
    implementation_result JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_recommendation_type (recommendation_type),
    INDEX idx_strategy_name (strategy_name),
    INDEX idx_priority (priority),
    INDEX idx_confidence_score (confidence_score),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
);

-- Cache optimization implementation results
CREATE TABLE IF NOT EXISTS cache_optimization_results (
    id INT PRIMARY KEY AUTO_INCREMENT,
    recommendation_id INT,
    recommendation_type VARCHAR(100) NOT NULL,
    strategy_name VARCHAR(100) NOT NULL,
    implementation_data JSON NOT NULL,
    success BOOLEAN NOT NULL DEFAULT FALSE,
    performance_before JSON,
    performance_after JSON,
    measured_impact JSON,
    rollback_data JSON,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_recommendation_id (recommendation_id),
    INDEX idx_recommendation_type (recommendation_type),
    INDEX idx_strategy_name (strategy_name),
    INDEX idx_success (success),
    INDEX idx_created_at (created_at),
    
    FOREIGN KEY (recommendation_id) REFERENCES cache_optimization_recommendations(id) ON DELETE SET NULL
);

-- Cache strategy configurations
CREATE TABLE IF NOT EXISTS cache_strategies (
    id INT PRIMARY KEY AUTO_INCREMENT,
    strategy_name VARCHAR(100) NOT NULL UNIQUE,
    strategy_type ENUM('content_based', 'configuration', 'session', 'metrics', 'computed') NOT NULL,
    default_ttl INT NOT NULL DEFAULT 3600,
    min_ttl INT NOT NULL DEFAULT 300,
    max_ttl INT NOT NULL DEFAULT 86400,
    warm_threshold DECIMAL(3,2) DEFAULT 0.70,
    priority ENUM('low', 'medium', 'high') DEFAULT 'medium',
    configuration JSON,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_strategy_name (strategy_name),
    INDEX idx_strategy_type (strategy_type),
    INDEX idx_is_active (is_active)
);

-- Cache access patterns and analytics
CREATE TABLE IF NOT EXISTS cache_access_patterns (
    id INT PRIMARY KEY AUTO_INCREMENT,
    cache_key_pattern VARCHAR(255) NOT NULL,
    strategy_name VARCHAR(100) NOT NULL,
    access_count INT DEFAULT 0,
    hit_count INT DEFAULT 0,
    miss_count INT DEFAULT 0,
    avg_response_time DECIMAL(8,3) DEFAULT 0.000,
    peak_hour TINYINT DEFAULT 0,
    peak_day TINYINT DEFAULT 0,
    predictability_score DECIMAL(4,3) DEFAULT 0.000,
    temporal_patterns JSON,
    geographical_patterns JSON,
    user_patterns JSON,
    last_analyzed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_cache_key_pattern (cache_key_pattern),
    INDEX idx_strategy_name (strategy_name),
    INDEX idx_predictability_score (predictability_score),
    INDEX idx_last_analyzed (last_analyzed),
    
    FOREIGN KEY (strategy_name) REFERENCES cache_strategies(strategy_name) ON DELETE CASCADE
);

-- Cache warming schedules and configurations
CREATE TABLE IF NOT EXISTS cache_warming_schedules (
    id INT PRIMARY KEY AUTO_INCREMENT,
    strategy_name VARCHAR(100) NOT NULL,
    schedule_type ENUM('time_based', 'event_based', 'predictive') NOT NULL,
    schedule_config JSON NOT NULL,
    warming_rules JSON,
    is_active BOOLEAN DEFAULT TRUE,
    last_execution TIMESTAMP NULL,
    next_execution TIMESTAMP NULL,
    execution_count INT DEFAULT 0,
    success_rate DECIMAL(4,3) DEFAULT 1.000,
    avg_execution_time INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_strategy_name (strategy_name),
    INDEX idx_schedule_type (schedule_type),
    INDEX idx_is_active (is_active),
    INDEX idx_next_execution (next_execution),
    
    FOREIGN KEY (strategy_name) REFERENCES cache_strategies(strategy_name) ON DELETE CASCADE
);

-- Cache warming execution logs
CREATE TABLE IF NOT EXISTS cache_warming_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    schedule_id INT NOT NULL,
    strategy_name VARCHAR(100) NOT NULL,
    execution_type ENUM('scheduled', 'manual', 'triggered') NOT NULL,
    keys_warmed INT DEFAULT 0,
    keys_failed INT DEFAULT 0,
    execution_time_ms INT DEFAULT 0,
    memory_used BIGINT DEFAULT 0,
    success BOOLEAN DEFAULT TRUE,
    error_details JSON,
    performance_impact JSON,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_schedule_id (schedule_id),
    INDEX idx_strategy_name (strategy_name),
    INDEX idx_execution_type (execution_type),
    INDEX idx_success (success),
    INDEX idx_executed_at (executed_at),
    
    FOREIGN KEY (schedule_id) REFERENCES cache_warming_schedules(id) ON DELETE CASCADE
);

-- Cache performance metrics
CREATE TABLE IF NOT EXISTS cache_performance_metrics (
    id INT PRIMARY KEY AUTO_INCREMENT,
    strategy_name VARCHAR(100) NOT NULL,
    metric_type ENUM('hit_rate', 'response_time', 'memory_usage', 'throughput', 'error_rate') NOT NULL,
    metric_value DECIMAL(10,4) NOT NULL,
    measurement_window ENUM('1min', '5min', '15min', '1hour', '1day') NOT NULL,
    context_data JSON,
    baseline_value DECIMAL(10,4),
    improvement_percentage DECIMAL(6,2),
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_strategy_name (strategy_name),
    INDEX idx_metric_type (metric_type),
    INDEX idx_measurement_window (measurement_window),
    INDEX idx_recorded_at (recorded_at),
    INDEX idx_metric_value (metric_value),
    
    FOREIGN KEY (strategy_name) REFERENCES cache_strategies(strategy_name) ON DELETE CASCADE
);

-- Cache optimization ML model data
CREATE TABLE IF NOT EXISTS cache_ml_training_data (
    id INT PRIMARY KEY AUTO_INCREMENT,
    strategy_name VARCHAR(100) NOT NULL,
    feature_vector JSON NOT NULL,
    optimization_target ENUM('hit_rate', 'response_time', 'memory_efficiency', 'cost') NOT NULL,
    target_value DECIMAL(10,4) NOT NULL,
    context_features JSON,
    temporal_features JSON,
    outcome_measured BOOLEAN DEFAULT FALSE,
    actual_outcome DECIMAL(10,4),
    model_accuracy DECIMAL(4,3),
    data_quality_score DECIMAL(3,2) DEFAULT 1.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_strategy_name (strategy_name),
    INDEX idx_optimization_target (optimization_target),
    INDEX idx_outcome_measured (outcome_measured),
    INDEX idx_data_quality_score (data_quality_score),
    INDEX idx_created_at (created_at),
    
    FOREIGN KEY (strategy_name) REFERENCES cache_strategies(strategy_name) ON DELETE CASCADE
);

-- Insert default cache strategies
INSERT IGNORE INTO cache_strategies (strategy_name, strategy_type, default_ttl, min_ttl, max_ttl, warm_threshold, priority, configuration) VALUES
('gallery_images', 'content_based', 3600, 300, 86400, 0.70, 'high', JSON_OBJECT(
    'compression', true,
    'lazy_loading', true,
    'prefetch_enabled', true,
    'max_size_mb', 10
)),
('theme_configs', 'configuration', 7200, 600, 604800, 0.80, 'medium', JSON_OBJECT(
    'version_aware', true,
    'hierarchical_cache', true,
    'invalidation_cascading', true
)),
('user_sessions', 'session', 1800, 300, 7200, 0.60, 'high', JSON_OBJECT(
    'sliding_expiration', true,
    'secure_storage', true,
    'cleanup_interval', 3600
)),
('performance_metrics', 'metrics', 300, 60, 3600, 0.50, 'low', JSON_OBJECT(
    'aggregation_enabled', true,
    'compression', true,
    'retention_hours', 72
)),
('api_responses', 'computed', 1200, 120, 14400, 0.75, 'medium', JSON_OBJECT(
    'conditional_caching', true,
    'etag_enabled', true,
    'vary_headers', JSON_ARRAY('Accept', 'Accept-Language')
));

-- Insert baseline performance metrics for each strategy
INSERT IGNORE INTO cache_performance_metrics (strategy_name, metric_type, metric_value, measurement_window, baseline_value) VALUES
('gallery_images', 'hit_rate', 0.650, '1hour', 0.650),
('gallery_images', 'response_time', 45.500, '1hour', 45.500),
('gallery_images', 'memory_usage', 150000000, '1hour', 150000000),
('theme_configs', 'hit_rate', 0.820, '1hour', 0.820),
('theme_configs', 'response_time', 25.200, '1hour', 25.200),
('theme_configs', 'memory_usage', 50000000, '1hour', 50000000),
('user_sessions', 'hit_rate', 0.750, '1hour', 0.750),
('user_sessions', 'response_time', 15.800, '1hour', 15.800),
('user_sessions', 'memory_usage', 80000000, '1hour', 80000000),
('performance_metrics', 'hit_rate', 0.580, '1hour', 0.580),
('performance_metrics', 'response_time', 35.400, '1hour', 35.400),
('api_responses', 'hit_rate', 0.720, '1hour', 0.720),
('api_responses', 'response_time', 65.300, '1hour', 65.300);

-- Create views for easier cache optimization analysis
CREATE OR REPLACE VIEW v_cache_strategy_performance AS
SELECT 
    cs.strategy_name,
    cs.strategy_type,
    cs.priority,
    cs.default_ttl,
    cs.warm_threshold,
    AVG(CASE WHEN cpm.metric_type = 'hit_rate' THEN cpm.metric_value END) as current_hit_rate,
    AVG(CASE WHEN cpm.metric_type = 'response_time' THEN cpm.metric_value END) as avg_response_time,
    AVG(CASE WHEN cpm.metric_type = 'memory_usage' THEN cpm.metric_value END) as memory_usage,
    COUNT(cor.id) as optimization_count,
    MAX(cor.created_at) as last_optimization
FROM cache_strategies cs
LEFT JOIN cache_performance_metrics cpm ON cs.strategy_name = cpm.strategy_name 
    AND cpm.recorded_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
LEFT JOIN cache_optimization_results cor ON cs.strategy_name = cor.strategy_name
WHERE cs.is_active = TRUE
GROUP BY cs.strategy_name, cs.strategy_type, cs.priority, cs.default_ttl, cs.warm_threshold;

CREATE OR REPLACE VIEW v_cache_optimization_summary AS
SELECT 
    DATE(created_at) as optimization_date,
    recommendation_type,
    COUNT(*) as total_recommendations,
    COUNT(CASE WHEN status = 'implemented' THEN 1 END) as implemented_count,
    AVG(confidence_score) as avg_confidence,
    COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_priority_count
FROM cache_optimization_recommendations 
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY DATE(created_at), recommendation_type
ORDER BY optimization_date DESC, recommendation_type;

CREATE OR REPLACE VIEW v_cache_warming_effectiveness AS
SELECT 
    cws.strategy_name,
    cws.schedule_type,
    cws.success_rate,
    AVG(cwl.keys_warmed) as avg_keys_warmed,
    AVG(cwl.execution_time_ms) as avg_execution_time,
    COUNT(cwl.id) as total_executions,
    COUNT(CASE WHEN cwl.success = TRUE THEN 1 END) as successful_executions,
    MAX(cwl.executed_at) as last_execution
FROM cache_warming_schedules cws
LEFT JOIN cache_warming_logs cwl ON cws.id = cwl.schedule_id
    AND cwl.executed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
WHERE cws.is_active = TRUE
GROUP BY cws.strategy_name, cws.schedule_type, cws.success_rate;

-- Create stored procedures for cache optimization operations
DELIMITER $$

CREATE PROCEDURE AnalyzeCachePerformance(
    IN p_strategy_name VARCHAR(100),
    IN p_time_window INT DEFAULT 24
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    -- Get current performance metrics
    SELECT 
        strategy_name,
        AVG(CASE WHEN metric_type = 'hit_rate' THEN metric_value END) as hit_rate,
        AVG(CASE WHEN metric_type = 'response_time' THEN metric_value END) as response_time,
        AVG(CASE WHEN metric_type = 'memory_usage' THEN metric_value END) as memory_usage,
        AVG(CASE WHEN metric_type = 'throughput' THEN metric_value END) as throughput,
        COUNT(*) as measurement_count
    FROM cache_performance_metrics 
    WHERE (p_strategy_name IS NULL OR strategy_name = p_strategy_name)
      AND recorded_at >= DATE_SUB(NOW(), INTERVAL p_time_window HOUR)
    GROUP BY strategy_name;
    
    -- Get access patterns
    SELECT 
        strategy_name,
        AVG(predictability_score) as avg_predictability,
        AVG(access_count) as avg_access_count,
        AVG(hit_count / NULLIF(access_count, 0)) as calculated_hit_rate
    FROM cache_access_patterns 
    WHERE (p_strategy_name IS NULL OR strategy_name = p_strategy_name)
      AND last_analyzed >= DATE_SUB(NOW(), INTERVAL p_time_window HOUR)
    GROUP BY strategy_name;
    
    COMMIT;
END$$

CREATE PROCEDURE GenerateOptimizationRecommendation(
    IN p_strategy_name VARCHAR(100),
    IN p_recommendation_type VARCHAR(100),
    IN p_confidence_score DECIMAL(4,3),
    IN p_current_metrics JSON,
    IN p_recommended_changes JSON,
    IN p_reasoning TEXT
)
BEGIN
    DECLARE v_priority ENUM('low', 'medium', 'high', 'critical');
    
    -- Determine priority based on confidence and impact
    IF p_confidence_score >= 0.9 THEN
        SET v_priority = 'critical';
    ELSEIF p_confidence_score >= 0.8 THEN
        SET v_priority = 'high';
    ELSEIF p_confidence_score >= 0.6 THEN
        SET v_priority = 'medium';
    ELSE
        SET v_priority = 'low';
    END IF;
    
    INSERT INTO cache_optimization_recommendations (
        recommendation_type,
        strategy_name,
        priority,
        confidence_score,
        current_metrics,
        recommended_changes,
        reasoning,
        status
    ) VALUES (
        p_recommendation_type,
        p_strategy_name,
        v_priority,
        p_confidence_score,
        p_current_metrics,
        p_recommended_changes,
        p_reasoning,
        'pending'
    );
    
    SELECT LAST_INSERT_ID() as recommendation_id;
END$$

CREATE PROCEDURE UpdateCacheStrategy(
    IN p_strategy_name VARCHAR(100),
    IN p_new_ttl INT,
    IN p_optimization_result JSON
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    -- Update strategy configuration
    UPDATE cache_strategies 
    SET default_ttl = p_new_ttl,
        updated_at = NOW()
    WHERE strategy_name = p_strategy_name;
    
    -- Log the optimization result
    INSERT INTO cache_optimization_results (
        recommendation_type,
        strategy_name,
        implementation_data,
        success,
        created_at
    ) VALUES (
        'ttl_optimization',
        p_strategy_name,
        p_optimization_result,
        TRUE,
        NOW()
    );
    
    COMMIT;
END$$

CREATE PROCEDURE CleanupOldCacheData()
BEGIN
    -- Clean up old performance metrics (keep 30 days)
    DELETE FROM cache_performance_metrics 
    WHERE recorded_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
    
    -- Clean up old warming logs (keep 14 days)
    DELETE FROM cache_warming_logs 
    WHERE executed_at < DATE_SUB(NOW(), INTERVAL 14 DAY);
    
    -- Clean up old ML training data (keep 90 days)
    DELETE FROM cache_ml_training_data 
    WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY);
    
    -- Clean up expired recommendations
    UPDATE cache_optimization_recommendations 
    SET status = 'expired' 
    WHERE status = 'pending' 
      AND created_at < DATE_SUB(NOW(), INTERVAL 7 DAY);
      
    SELECT 
        'Cleanup completed' as status,
        ROW_COUNT() as expired_recommendations,
        NOW() as cleanup_time;
END$$

DELIMITER ;

-- Create indexes for optimal performance
ALTER TABLE cache_optimization_analysis ADD INDEX idx_overall_score_created (overall_score, created_at);
ALTER TABLE cache_optimization_recommendations ADD INDEX idx_strategy_priority_status (strategy_name, priority, status);
ALTER TABLE cache_performance_metrics ADD INDEX idx_strategy_type_recorded (strategy_name, metric_type, recorded_at);
ALTER TABLE cache_access_patterns ADD INDEX idx_strategy_predictability (strategy_name, predictability_score DESC);

-- Grant permissions for cache optimization service
-- Note: In production, create a dedicated cache optimization user
-- GRANT SELECT, INSERT, UPDATE, DELETE ON musenest.cache_* TO 'cache_optimizer'@'localhost';
-- GRANT EXECUTE ON PROCEDURE musenest.AnalyzeCachePerformance TO 'cache_optimizer'@'localhost';
-- GRANT EXECUTE ON PROCEDURE musenest.GenerateOptimizationRecommendation TO 'cache_optimizer'@'localhost';
-- GRANT EXECUTE ON PROCEDURE musenest.UpdateCacheStrategy TO 'cache_optimizer'@'localhost';
-- GRANT EXECUTE ON PROCEDURE musenest.CleanupOldCacheData TO 'cache_optimizer'@'localhost';

SELECT 'Cache Optimization System migration completed successfully' as status;