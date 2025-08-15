-- Performance Bottleneck Identification System Migration
-- Adds tables and infrastructure for real-time performance monitoring and bottleneck detection

USE musenest;

-- System performance metrics tracking
CREATE TABLE IF NOT EXISTS system_performance_metrics (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    component_name ENUM('web_server', 'database', 'cache', 'storage', 'memory', 'network', 'application') NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(15,6) NOT NULL,
    metric_unit VARCHAR(50),
    baseline_value DECIMAL(15,6),
    threshold_warning DECIMAL(15,6),
    threshold_critical DECIMAL(15,6),
    is_threshold_exceeded BOOLEAN DEFAULT FALSE,
    severity_level ENUM('normal', 'minor', 'warning', 'critical') DEFAULT 'normal',
    measurement_context JSON,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_component_metric (component_name, metric_name),
    INDEX idx_recorded_at (recorded_at),
    INDEX idx_threshold_exceeded (is_threshold_exceeded),
    INDEX idx_severity_level (severity_level),
    INDEX idx_component_time (component_name, recorded_at DESC)
);

-- Detected bottlenecks and performance issues
CREATE TABLE IF NOT EXISTS performance_bottlenecks (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    bottleneck_id VARCHAR(100) NOT NULL UNIQUE,
    bottleneck_type ENUM('threshold_violation', 'correlation_bottleneck', 'ml_anomaly', 'predicted_bottleneck') NOT NULL,
    component_name ENUM('web_server', 'database', 'cache', 'storage', 'memory', 'network', 'application', 'cross_component') NOT NULL,
    affected_metrics JSON, -- Array of affected metrics
    severity ENUM('minor', 'warning', 'critical') NOT NULL,
    severity_score INT DEFAULT 0,
    category ENUM('resource_exhaustion', 'performance_degradation', 'capacity_saturation', 'dependency_failure', 'anomaly_detection') NOT NULL,
    impact_score INT DEFAULT 0,
    detection_details JSON, -- Detailed detection information
    current_values JSON, -- Current metric values at detection time
    baseline_values JSON, -- Baseline values for comparison
    threshold_values JSON, -- Threshold values that were exceeded
    correlation_strength DECIMAL(4,3), -- For correlation-based bottlenecks
    anomaly_score DECIMAL(4,3), -- For ML-detected anomalies
    model_used VARCHAR(100), -- ML model used for detection
    confidence_score DECIMAL(4,3) DEFAULT 0.000,
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP NULL,
    resolution_method VARCHAR(200),
    duration_seconds INT, -- Calculated when resolved
    
    INDEX idx_bottleneck_id (bottleneck_id),
    INDEX idx_bottleneck_type (bottleneck_type),
    INDEX idx_component_name (component_name),
    INDEX idx_severity (severity),
    INDEX idx_category (category),
    INDEX idx_detected_at (detected_at),
    INDEX idx_resolved_at (resolved_at),
    INDEX idx_impact_score (impact_score DESC),
    INDEX idx_confidence_score (confidence_score DESC)
);

-- Root cause analysis results
CREATE TABLE IF NOT EXISTS bottleneck_root_causes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    bottleneck_id VARCHAR(100) NOT NULL,
    primary_cause TEXT NOT NULL,
    contributing_factors JSON, -- Array of contributing factors
    dependency_chain JSON, -- Dependency chain analysis
    correlation_analysis JSON, -- Correlation analysis results
    confidence_score DECIMAL(4,3) DEFAULT 0.000,
    analysis_method ENUM('rule_based', 'correlation', 'ml_inference', 'manual') DEFAULT 'rule_based',
    supporting_evidence JSON, -- Evidence supporting the root cause
    alternative_causes JSON, -- Alternative possible causes
    analysis_duration_ms INT,
    analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_bottleneck_id (bottleneck_id),
    INDEX idx_confidence_score (confidence_score DESC),
    INDEX idx_analysis_method (analysis_method),
    INDEX idx_analyzed_at (analyzed_at),
    
    FOREIGN KEY (bottleneck_id) REFERENCES performance_bottlenecks(bottleneck_id) ON DELETE CASCADE
);

-- Optimization recommendations generated for bottlenecks
CREATE TABLE IF NOT EXISTS bottleneck_recommendations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    bottleneck_id VARCHAR(100) NOT NULL,
    recommendation_type ENUM('optimization', 'configuration', 'scaling', 'system_optimization', 'investigation') NOT NULL,
    priority ENUM('low', 'medium', 'high', 'critical') NOT NULL,
    action_type VARCHAR(100) NOT NULL, -- Specific action to take
    description TEXT NOT NULL,
    implementation_details TEXT,
    estimated_impact VARCHAR(200),
    implementation_complexity ENUM('low', 'medium', 'high') DEFAULT 'medium',
    estimated_time_minutes INT,
    prerequisites JSON, -- Prerequisites for implementation
    side_effects JSON, -- Potential side effects
    confidence_score DECIMAL(4,3) DEFAULT 0.000,
    status ENUM('pending', 'in_progress', 'completed', 'failed', 'rejected') DEFAULT 'pending',
    implementation_start TIMESTAMP NULL,
    implementation_end TIMESTAMP NULL,
    actual_impact JSON, -- Measured impact after implementation
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_bottleneck_id (bottleneck_id),
    INDEX idx_recommendation_type (recommendation_type),
    INDEX idx_priority (priority),
    INDEX idx_status (status),
    INDEX idx_confidence_score (confidence_score DESC),
    INDEX idx_created_at (created_at),
    
    FOREIGN KEY (bottleneck_id) REFERENCES performance_bottlenecks(bottleneck_id) ON DELETE CASCADE
);

-- Anomaly detection model performance and results
CREATE TABLE IF NOT EXISTS anomaly_detection_results (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    detection_id VARCHAR(100) NOT NULL UNIQUE,
    model_name VARCHAR(100) NOT NULL,
    model_type ENUM('isolation_forest', 'time_series_forecasting', 'correlation_analysis', 'ensemble') NOT NULL,
    input_features JSON NOT NULL, -- Feature vector used for detection
    anomaly_score DECIMAL(4,3) NOT NULL,
    threshold_score DECIMAL(4,3) NOT NULL,
    is_anomaly BOOLEAN DEFAULT FALSE,
    anomaly_type ENUM('point_anomaly', 'pattern_anomaly', 'trend_anomaly') DEFAULT 'point_anomaly',
    affected_components JSON, -- Components affected by the anomaly
    contextual_factors JSON, -- Contextual information at time of detection
    prediction_confidence DECIMAL(4,3),
    false_positive BOOLEAN NULL, -- Set when validated
    validation_method VARCHAR(100),
    validated_at TIMESTAMP NULL,
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_detection_id (detection_id),
    INDEX idx_model_name (model_name),
    INDEX idx_anomaly_score (anomaly_score DESC),
    INDEX idx_is_anomaly (is_anomaly),
    INDEX idx_detected_at (detected_at),
    INDEX idx_false_positive (false_positive)
);

-- Performance baselines for comparison
CREATE TABLE IF NOT EXISTS performance_baselines (
    id INT PRIMARY KEY AUTO_INCREMENT,
    component_name ENUM('web_server', 'database', 'cache', 'storage', 'memory', 'network', 'application') NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    baseline_value DECIMAL(15,6) NOT NULL,
    baseline_type ENUM('historical_average', 'percentile_95', 'percentile_99', 'manual') DEFAULT 'historical_average',
    sample_size INT DEFAULT 0,
    confidence_interval_lower DECIMAL(15,6),
    confidence_interval_upper DECIMAL(15,6),
    seasonal_adjustment DECIMAL(6,3) DEFAULT 1.000,
    time_period_start TIMESTAMP NOT NULL,
    time_period_end TIMESTAMP NOT NULL,
    calculation_method TEXT,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE KEY idx_component_metric_baseline (component_name, metric_name),
    INDEX idx_component_name (component_name),
    INDEX idx_metric_name (metric_name),
    INDEX idx_last_updated (last_updated)
);

-- Bottleneck prediction models and accuracy tracking
CREATE TABLE IF NOT EXISTS bottleneck_prediction_models (
    id INT PRIMARY KEY AUTO_INCREMENT,
    model_name VARCHAR(100) NOT NULL UNIQUE,
    model_type ENUM('time_series_forecasting', 'regression', 'classification', 'ensemble') NOT NULL,
    target_component ENUM('web_server', 'database', 'cache', 'storage', 'memory', 'network', 'application', 'system_wide') NOT NULL,
    prediction_horizon_minutes INT DEFAULT 15,
    feature_set JSON NOT NULL,
    hyperparameters JSON,
    model_accuracy DECIMAL(4,3) DEFAULT 0.000,
    precision_score DECIMAL(4,3),
    recall_score DECIMAL(4,3),
    f1_score DECIMAL(4,3),
    training_data_size INT DEFAULT 0,
    validation_data_size INT DEFAULT 0,
    last_trained TIMESTAMP NULL,
    training_duration_minutes INT,
    model_version VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_model_name (model_name),
    INDEX idx_model_type (model_type),
    INDEX idx_target_component (target_component),
    INDEX idx_model_accuracy (model_accuracy DESC),
    INDEX idx_is_active (is_active),
    INDEX idx_last_trained (last_trained)
);

-- Bottleneck predictions and validation
CREATE TABLE IF NOT EXISTS bottleneck_predictions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    prediction_id VARCHAR(100) NOT NULL UNIQUE,
    model_name VARCHAR(100) NOT NULL,
    component_name ENUM('web_server', 'database', 'cache', 'storage', 'memory', 'network', 'application') NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    current_value DECIMAL(15,6) NOT NULL,
    predicted_value DECIMAL(15,6) NOT NULL,
    threshold_value DECIMAL(15,6),
    time_to_threshold_minutes INT, -- Predicted time until threshold breach
    predicted_severity ENUM('warning', 'critical') NOT NULL,
    confidence_score DECIMAL(4,3) NOT NULL,
    prediction_horizon_minutes INT NOT NULL,
    trend_slope DECIMAL(10,6), -- Rate of change
    trend_acceleration DECIMAL(10,6), -- Rate of change of rate of change
    input_features JSON NOT NULL,
    contextual_factors JSON,
    prediction_method VARCHAR(100),
    actual_outcome ENUM('true_positive', 'false_positive', 'true_negative', 'false_negative') NULL,
    actual_value DECIMAL(15,6) NULL, -- Actual value at predicted time
    actual_threshold_breach_time TIMESTAMP NULL,
    validation_notes TEXT,
    predicted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    validated_at TIMESTAMP NULL,
    
    INDEX idx_prediction_id (prediction_id),
    INDEX idx_model_name (model_name),
    INDEX idx_component_metric (component_name, metric_name),
    INDEX idx_time_to_threshold (time_to_threshold_minutes ASC),
    INDEX idx_confidence_score (confidence_score DESC),
    INDEX idx_predicted_at (predicted_at),
    INDEX idx_actual_outcome (actual_outcome),
    
    FOREIGN KEY (model_name) REFERENCES bottleneck_prediction_models(model_name) ON DELETE CASCADE
);

-- System component dependencies and relationships
CREATE TABLE IF NOT EXISTS system_component_dependencies (
    id INT PRIMARY KEY AUTO_INCREMENT,
    source_component ENUM('web_server', 'database', 'cache', 'storage', 'memory', 'network', 'application') NOT NULL,
    target_component ENUM('web_server', 'database', 'cache', 'storage', 'memory', 'network', 'application') NOT NULL,
    dependency_type ENUM('direct', 'indirect', 'bidirectional') DEFAULT 'direct',
    dependency_strength DECIMAL(4,3) DEFAULT 0.500, -- 0-1 scale
    latency_impact_ms INT DEFAULT 0,
    failure_propagation_probability DECIMAL(4,3) DEFAULT 0.300,
    is_critical_path BOOLEAN DEFAULT FALSE,
    monitoring_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY idx_dependency (source_component, target_component),
    INDEX idx_source_component (source_component),
    INDEX idx_target_component (target_component),
    INDEX idx_dependency_strength (dependency_strength DESC),
    INDEX idx_is_critical_path (is_critical_path)
);

-- Performance correlation matrix for cross-component analysis
CREATE TABLE IF NOT EXISTS performance_correlations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    component_a ENUM('web_server', 'database', 'cache', 'storage', 'memory', 'network', 'application') NOT NULL,
    metric_a VARCHAR(100) NOT NULL,
    component_b ENUM('web_server', 'database', 'cache', 'storage', 'memory', 'network', 'application') NOT NULL,
    metric_b VARCHAR(100) NOT NULL,
    correlation_coefficient DECIMAL(6,4) NOT NULL, -- -1 to 1
    correlation_type ENUM('positive', 'negative', 'none') NOT NULL,
    statistical_significance DECIMAL(4,3), -- p-value
    sample_size INT NOT NULL,
    time_lag_seconds INT DEFAULT 0, -- Time lag for correlation
    correlation_strength ENUM('weak', 'moderate', 'strong', 'very_strong') NOT NULL,
    last_calculated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    calculation_period_start TIMESTAMP NOT NULL,
    calculation_period_end TIMESTAMP NOT NULL,
    
    UNIQUE KEY idx_correlation_pair (component_a, metric_a, component_b, metric_b),
    INDEX idx_correlation_coefficient (correlation_coefficient DESC),
    INDEX idx_correlation_strength (correlation_strength),
    INDEX idx_last_calculated (last_calculated)
);

-- Insert default performance baselines (these would typically be calculated from historical data)
INSERT IGNORE INTO performance_baselines (component_name, metric_name, baseline_value, baseline_type, time_period_start, time_period_end) VALUES
-- Web Server baselines
('web_server', 'request_rate', 50.0, 'historical_average', DATE_SUB(NOW(), INTERVAL 30 DAY), NOW()),
('web_server', 'response_time', 500.0, 'percentile_95', DATE_SUB(NOW(), INTERVAL 30 DAY), NOW()),
('web_server', 'active_connections', 100.0, 'historical_average', DATE_SUB(NOW(), INTERVAL 30 DAY), NOW()),
('web_server', 'cpu_usage', 40.0, 'historical_average', DATE_SUB(NOW(), INTERVAL 30 DAY), NOW()),

-- Database baselines
('database', 'query_time', 200.0, 'percentile_95', DATE_SUB(NOW(), INTERVAL 30 DAY), NOW()),
('database', 'connection_count', 50.0, 'historical_average', DATE_SUB(NOW(), INTERVAL 30 DAY), NOW()),
('database', 'lock_contention', 5.0, 'percentile_99', DATE_SUB(NOW(), INTERVAL 30 DAY), NOW()),
('database', 'io_wait', 50.0, 'percentile_95', DATE_SUB(NOW(), INTERVAL 30 DAY), NOW()),

-- Cache baselines
('cache', 'hit_rate', 85.0, 'historical_average', DATE_SUB(NOW(), INTERVAL 30 DAY), NOW()),
('cache', 'memory_usage', 60.0, 'historical_average', DATE_SUB(NOW(), INTERVAL 30 DAY), NOW()),
('cache', 'eviction_rate', 10.0, 'historical_average', DATE_SUB(NOW(), INTERVAL 30 DAY), NOW()),
('cache', 'response_time', 5.0, 'percentile_95', DATE_SUB(NOW(), INTERVAL 30 DAY), NOW()),

-- Memory baselines
('memory', 'usage_percentage', 70.0, 'historical_average', DATE_SUB(NOW(), INTERVAL 30 DAY), NOW()),
('memory', 'gc_frequency', 15.0, 'historical_average', DATE_SUB(NOW(), INTERVAL 30 DAY), NOW()),

-- Storage baselines
('storage', 'io_utilization', 40.0, 'historical_average', DATE_SUB(NOW(), INTERVAL 30 DAY), NOW()),
('storage', 'queue_depth', 5.0, 'percentile_95', DATE_SUB(NOW(), INTERVAL 30 DAY), NOW()),
('storage', 'latency', 20.0, 'percentile_95', DATE_SUB(NOW(), INTERVAL 30 DAY), NOW());

-- Insert default system component dependencies
INSERT IGNORE INTO system_component_dependencies (source_component, target_component, dependency_type, dependency_strength, latency_impact_ms, failure_propagation_probability, is_critical_path) VALUES
('web_server', 'database', 'direct', 0.900, 100, 0.800, TRUE),
('web_server', 'cache', 'direct', 0.700, 10, 0.300, FALSE),
('web_server', 'storage', 'indirect', 0.400, 50, 0.200, FALSE),
('database', 'storage', 'direct', 0.950, 200, 0.900, TRUE),
('database', 'memory', 'direct', 0.800, 5, 0.700, TRUE),
('cache', 'memory', 'direct', 0.900, 5, 0.600, FALSE),
('web_server', 'network', 'direct', 0.600, 20, 0.400, FALSE),
('database', 'network', 'indirect', 0.300, 30, 0.200, FALSE);

-- Insert default prediction models
INSERT IGNORE INTO bottleneck_prediction_models (model_name, model_type, target_component, prediction_horizon_minutes, feature_set, model_accuracy) VALUES
('web_server_response_predictor', 'time_series_forecasting', 'web_server', 15, 
 JSON_ARRAY('request_rate', 'active_connections', 'cpu_usage', 'response_time_trend'), 0.750),
('database_performance_predictor', 'regression', 'database', 15,
 JSON_ARRAY('connection_count', 'query_complexity', 'io_wait', 'lock_contention'), 0.820),
('memory_exhaustion_predictor', 'classification', 'memory', 10,
 JSON_ARRAY('usage_percentage', 'allocation_rate', 'gc_frequency', 'heap_growth'), 0.880),
('cache_degradation_predictor', 'ensemble', 'cache', 20,
 JSON_ARRAY('hit_rate_trend', 'memory_usage', 'eviction_rate', 'request_pattern'), 0.790),
('system_wide_bottleneck_predictor', 'ensemble', 'system_wide', 30,
 JSON_ARRAY('overall_utilization', 'component_correlations', 'historical_patterns', 'load_trends'), 0.720);

-- Create views for easier bottleneck analysis
CREATE OR REPLACE VIEW v_active_bottlenecks AS
SELECT 
    pb.bottleneck_id,
    pb.bottleneck_type,
    pb.component_name,
    pb.severity,
    pb.severity_score,
    pb.category,
    pb.impact_score,
    pb.confidence_score,
    pb.detected_at,
    TIMESTAMPDIFF(SECOND, pb.detected_at, COALESCE(pb.resolved_at, NOW())) as duration_seconds,
    brc.primary_cause,
    brc.confidence_score as root_cause_confidence,
    COUNT(br.id) as recommendation_count
FROM performance_bottlenecks pb
LEFT JOIN bottleneck_root_causes brc ON pb.bottleneck_id = brc.bottleneck_id
LEFT JOIN bottleneck_recommendations br ON pb.bottleneck_id = br.bottleneck_id
WHERE pb.resolved_at IS NULL
GROUP BY pb.bottleneck_id, pb.bottleneck_type, pb.component_name, pb.severity, pb.severity_score, 
         pb.category, pb.impact_score, pb.confidence_score, pb.detected_at, brc.primary_cause, brc.confidence_score;

CREATE OR REPLACE VIEW v_bottleneck_trends AS
SELECT 
    component_name,
    category,
    severity,
    DATE(detected_at) as date,
    COUNT(*) as bottleneck_count,
    AVG(severity_score) as avg_severity_score,
    AVG(impact_score) as avg_impact_score,
    AVG(COALESCE(duration_seconds, TIMESTAMPDIFF(SECOND, detected_at, NOW()))) as avg_duration_seconds,
    COUNT(CASE WHEN resolved_at IS NOT NULL THEN 1 END) as resolved_count
FROM performance_bottlenecks
WHERE detected_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY component_name, category, severity, DATE(detected_at)
ORDER BY date DESC, component_name, category;

CREATE OR REPLACE VIEW v_prediction_accuracy AS
SELECT 
    bpm.model_name,
    bpm.model_type,
    bpm.target_component,
    COUNT(bp.id) as total_predictions,
    COUNT(CASE WHEN bp.actual_outcome IS NOT NULL THEN 1 END) as validated_predictions,
    COUNT(CASE WHEN bp.actual_outcome IN ('true_positive', 'true_negative') THEN 1 END) as accurate_predictions,
    AVG(bp.confidence_score) as avg_confidence,
    COUNT(CASE WHEN bp.actual_outcome = 'true_positive' THEN 1 END) as true_positives,
    COUNT(CASE WHEN bp.actual_outcome = 'false_positive' THEN 1 END) as false_positives,
    COUNT(CASE WHEN bp.actual_outcome = 'true_negative' THEN 1 END) as true_negatives,
    COUNT(CASE WHEN bp.actual_outcome = 'false_negative' THEN 1 END) as false_negatives,
    bpm.last_trained,
    bpm.model_accuracy as model_reported_accuracy
FROM bottleneck_prediction_models bpm
LEFT JOIN bottleneck_predictions bp ON bpm.model_name = bp.model_name
    AND bp.predicted_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY bpm.model_name, bpm.model_type, bpm.target_component, bpm.last_trained, bpm.model_accuracy;

CREATE OR REPLACE VIEW v_component_health_summary AS
SELECT 
    spm.component_name,
    COUNT(DISTINCT spm.metric_name) as monitored_metrics,
    COUNT(CASE WHEN spm.is_threshold_exceeded = TRUE THEN 1 END) as metrics_over_threshold,
    AVG(CASE WHEN pb.baseline_value IS NOT NULL THEN spm.metric_value / pb.baseline_value ELSE 1 END) as avg_baseline_ratio,
    COUNT(CASE WHEN pbs.severity = 'critical' THEN 1 END) as critical_bottlenecks,
    COUNT(CASE WHEN pbs.severity = 'warning' THEN 1 END) as warning_bottlenecks,
    MAX(spm.recorded_at) as last_measurement,
    CASE 
        WHEN COUNT(CASE WHEN pbs.severity = 'critical' THEN 1 END) > 0 THEN 'critical'
        WHEN COUNT(CASE WHEN pbs.severity = 'warning' THEN 1 END) > 0 THEN 'warning'
        WHEN COUNT(CASE WHEN spm.is_threshold_exceeded = TRUE THEN 1 END) > 0 THEN 'degraded'
        ELSE 'healthy'
    END as health_status
FROM system_performance_metrics spm
LEFT JOIN performance_baselines pb ON spm.component_name = pb.component_name AND spm.metric_name = pb.metric_name
LEFT JOIN performance_bottlenecks pbs ON spm.component_name = pbs.component_name AND pbs.resolved_at IS NULL
WHERE spm.recorded_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
GROUP BY spm.component_name;

-- Create stored procedures for bottleneck analysis
DELIMITER $$

CREATE PROCEDURE AnalyzeBottleneckPatterns(
    IN p_component VARCHAR(50),
    IN p_days_back INT DEFAULT 7
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    -- Bottleneck frequency analysis
    SELECT 
        'Bottleneck Frequency' as analysis_type,
        category,
        severity,
        COUNT(*) as occurrence_count,
        AVG(severity_score) as avg_severity_score,
        AVG(impact_score) as avg_impact_score,
        AVG(duration_seconds) as avg_duration_seconds
    FROM performance_bottlenecks
    WHERE detected_at >= DATE_SUB(NOW(), INTERVAL p_days_back DAY)
      AND (p_component IS NULL OR component_name = p_component)
    GROUP BY category, severity
    ORDER BY occurrence_count DESC, avg_severity_score DESC;
    
    -- Root cause patterns
    SELECT 
        'Root Cause Patterns' as analysis_type,
        brc.primary_cause,
        COUNT(*) as occurrence_count,
        AVG(brc.confidence_score) as avg_confidence,
        GROUP_CONCAT(DISTINCT pb.component_name) as affected_components
    FROM bottleneck_root_causes brc
    JOIN performance_bottlenecks pb ON brc.bottleneck_id = pb.bottleneck_id
    WHERE brc.analyzed_at >= DATE_SUB(NOW(), INTERVAL p_days_back DAY)
      AND (p_component IS NULL OR pb.component_name = p_component)
    GROUP BY brc.primary_cause
    HAVING occurrence_count >= 2
    ORDER BY occurrence_count DESC, avg_confidence DESC;
    
    -- Resolution effectiveness
    SELECT 
        'Resolution Effectiveness' as analysis_type,
        pb.category,
        COUNT(*) as total_bottlenecks,
        COUNT(CASE WHEN pb.resolved_at IS NOT NULL THEN 1 END) as resolved_bottlenecks,
        AVG(CASE WHEN pb.resolved_at IS NOT NULL THEN pb.duration_seconds END) as avg_resolution_time,
        COUNT(CASE WHEN br.status = 'completed' THEN 1 END) as successful_recommendations
    FROM performance_bottlenecks pb
    LEFT JOIN bottleneck_recommendations br ON pb.bottleneck_id = br.bottleneck_id
    WHERE pb.detected_at >= DATE_SUB(NOW(), INTERVAL p_days_back DAY)
      AND (p_component IS NULL OR pb.component_name = p_component)
    GROUP BY pb.category
    ORDER BY resolved_bottlenecks DESC;
    
    COMMIT;
END$$

CREATE PROCEDURE GetBottleneckInsights(
    IN p_time_window_hours INT DEFAULT 24
)
BEGIN
    -- Current system health overview
    SELECT 
        'System Health Overview' as insight_type,
        component_name,
        health_status,
        monitored_metrics,
        metrics_over_threshold,
        critical_bottlenecks,
        warning_bottlenecks,
        ROUND(avg_baseline_ratio, 2) as performance_ratio
    FROM v_component_health_summary
    ORDER BY 
        CASE health_status 
            WHEN 'critical' THEN 1 
            WHEN 'warning' THEN 2 
            WHEN 'degraded' THEN 3 
            ELSE 4 
        END;
    
    -- Recent critical bottlenecks
    SELECT 
        'Critical Bottlenecks' as insight_type,
        bottleneck_id,
        component_name,
        category,
        severity_score,
        impact_score,
        primary_cause,
        recommendation_count,
        ROUND(duration_seconds / 60, 1) as duration_minutes
    FROM v_active_bottlenecks
    WHERE severity = 'critical'
    ORDER BY severity_score DESC, impact_score DESC;
    
    -- Prediction accuracy summary
    SELECT 
        'Prediction Accuracy' as insight_type,
        model_name,
        target_component,
        total_predictions,
        validated_predictions,
        CASE 
            WHEN validated_predictions > 0 
            THEN ROUND((accurate_predictions / validated_predictions) * 100, 1) 
            ELSE NULL 
        END as accuracy_percentage,
        ROUND(avg_confidence, 3) as avg_confidence
    FROM v_prediction_accuracy
    WHERE total_predictions > 0
    ORDER BY accuracy_percentage DESC;
END$$

DELIMITER ;

-- Create indexes for optimal query performance
ALTER TABLE system_performance_metrics ADD INDEX idx_component_metric_time_severity (component_name, metric_name, recorded_at DESC, severity_level);
ALTER TABLE performance_bottlenecks ADD INDEX idx_category_severity_impact (category, severity, impact_score DESC);
ALTER TABLE bottleneck_predictions ADD INDEX idx_model_component_confidence (model_name, component_name, confidence_score DESC);
ALTER TABLE anomaly_detection_results ADD INDEX idx_model_anomaly_time (model_name, is_anomaly, detected_at DESC);

-- Grant permissions for performance bottleneck identification service
-- Note: In production, create a dedicated performance monitoring service user
-- GRANT SELECT, INSERT, UPDATE, DELETE ON musenest.system_performance_* TO 'performance_monitor'@'localhost';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON musenest.performance_bottlenecks TO 'performance_monitor'@'localhost';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON musenest.bottleneck_* TO 'performance_monitor'@'localhost';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON musenest.anomaly_detection_results TO 'performance_monitor'@'localhost';
-- GRANT EXECUTE ON PROCEDURE musenest.AnalyzeBottleneckPatterns TO 'performance_monitor'@'localhost';
-- GRANT EXECUTE ON PROCEDURE musenest.GetBottleneckInsights TO 'performance_monitor'@'localhost';

SELECT 'Performance Bottleneck Identification System migration completed successfully' as status;