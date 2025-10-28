-- AI Performance Prediction System Migration
-- Adds tables and infrastructure for machine learning-based performance prediction

USE phoenix4ge;

-- Performance prediction models tracking
CREATE TABLE IF NOT EXISTS ml_models (
    id INT PRIMARY KEY AUTO_INCREMENT,
    model_name VARCHAR(100) NOT NULL UNIQUE,
    model_type ENUM('linear_regression', 'time_series', 'isolation_forest', 'neural_network') NOT NULL,
    features JSON NOT NULL,
    accuracy DECIMAL(4,3) DEFAULT 0.500,
    confidence_threshold DECIMAL(4,3) DEFAULT 0.600,
    last_trained_at TIMESTAMP NULL,
    training_data_size INT DEFAULT 0,
    model_config JSON DEFAULT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_model_name (model_name),
    INDEX idx_model_type (model_type),
    INDEX idx_is_active (is_active),
    INDEX idx_last_trained (last_trained_at)
);

-- Performance predictions cache
CREATE TABLE IF NOT EXISTS performance_predictions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    prediction_type ENUM('load_time', 'resource_usage', 'anomaly_detection', 'optimization') NOT NULL,
    model_name VARCHAR(100) NOT NULL,
    input_features JSON NOT NULL,
    prediction_result JSON NOT NULL,
    confidence_score DECIMAL(4,3),
    model_version VARCHAR(50),
    prediction_key VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE KEY idx_prediction_key (prediction_key),
    INDEX idx_prediction_type (prediction_type),
    INDEX idx_model_name (model_name),
    INDEX idx_expires_at (expires_at),
    INDEX idx_created_at (created_at),
    
    FOREIGN KEY (model_name) REFERENCES ml_models(model_name) ON DELETE CASCADE
);

-- Training data for ML models
CREATE TABLE IF NOT EXISTS ml_training_data (
    id INT PRIMARY KEY AUTO_INCREMENT,
    model_name VARCHAR(100) NOT NULL,
    data_source VARCHAR(100) NOT NULL, -- e.g., 'production_metrics', 'gallery_analytics'
    features JSON NOT NULL,
    target_value DECIMAL(10,4),
    data_quality_score DECIMAL(3,2) DEFAULT 1.00,
    is_validation_set BOOLEAN DEFAULT FALSE,
    collected_at TIMESTAMP NOT NULL,
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_model_name (model_name),
    INDEX idx_data_source (data_source),
    INDEX idx_collected_at (collected_at),
    INDEX idx_validation_set (is_validation_set),
    INDEX idx_quality_score (data_quality_score),
    
    FOREIGN KEY (model_name) REFERENCES ml_models(model_name) ON DELETE CASCADE
);

-- Model performance tracking and validation
CREATE TABLE IF NOT EXISTS ml_model_performance (
    id INT PRIMARY KEY AUTO_INCREMENT,
    model_name VARCHAR(100) NOT NULL,
    evaluation_date TIMESTAMP NOT NULL,
    accuracy DECIMAL(4,3),
    precision_score DECIMAL(4,3),
    recall_score DECIMAL(4,3),
    f1_score DECIMAL(4,3),
    mae DECIMAL(8,4), -- Mean Absolute Error
    mse DECIMAL(8,4), -- Mean Squared Error
    validation_samples INT,
    training_duration_ms INT,
    evaluation_metrics JSON,
    
    INDEX idx_model_name (model_name),
    INDEX idx_evaluation_date (evaluation_date),
    INDEX idx_accuracy (accuracy),
    
    FOREIGN KEY (model_name) REFERENCES ml_models(model_name) ON DELETE CASCADE
);

-- Performance optimization recommendations
CREATE TABLE IF NOT EXISTS optimization_recommendations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    model_id VARCHAR(100),
    theme_id INT,
    recommendation_type ENUM('cache', 'database', 'image', 'cdn', 'code', 'infrastructure') NOT NULL,
    priority ENUM('low', 'medium', 'high', 'critical') NOT NULL,
    impact_level ENUM('low', 'medium', 'high') NOT NULL,
    effort_level ENUM('low', 'medium', 'high') NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    actions JSON NOT NULL,
    expected_improvement JSON,
    confidence_score DECIMAL(4,3),
    status ENUM('pending', 'in_progress', 'completed', 'rejected') DEFAULT 'pending',
    implemented_at TIMESTAMP NULL,
    measured_impact JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_model_id (model_id),
    INDEX idx_theme_id (theme_id),
    INDEX idx_recommendation_type (recommendation_type),
    INDEX idx_priority (priority),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
);

-- Performance baselines for different contexts
CREATE TABLE IF NOT EXISTS performance_baselines (
    id INT PRIMARY KEY AUTO_INCREMENT,
    baseline_name VARCHAR(100) NOT NULL,
    context_type ENUM('theme', 'model', 'global', 'device_type') NOT NULL,
    context_id VARCHAR(100),
    metric_name VARCHAR(100) NOT NULL,
    baseline_value DECIMAL(10,4) NOT NULL,
    confidence_interval_lower DECIMAL(10,4),
    confidence_interval_upper DECIMAL(10,4),
    sample_size INT,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    
    UNIQUE KEY idx_baseline_context (baseline_name, context_type, context_id),
    INDEX idx_context_type (context_type),
    INDEX idx_metric_name (metric_name),
    INDEX idx_is_active (is_active)
);

-- Anomaly detection results
CREATE TABLE IF NOT EXISTS performance_anomalies (
    id INT PRIMARY KEY AUTO_INCREMENT,
    model_name VARCHAR(100) NOT NULL,
    anomaly_type ENUM('load_time_spike', 'resource_exhaustion', 'error_rate_increase', 'throughput_drop') NOT NULL,
    severity ENUM('low', 'medium', 'high', 'critical') NOT NULL,
    affected_metrics JSON NOT NULL,
    detection_confidence DECIMAL(4,3),
    anomaly_score DECIMAL(6,3),
    context_data JSON,
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP NULL,
    resolution_notes TEXT,
    false_positive BOOLEAN DEFAULT FALSE,
    
    INDEX idx_model_name (model_name),
    INDEX idx_anomaly_type (anomaly_type),
    INDEX idx_severity (severity),
    INDEX idx_detected_at (detected_at),
    INDEX idx_resolved_at (resolved_at),
    
    FOREIGN KEY (model_name) REFERENCES ml_models(model_name) ON DELETE CASCADE
);

-- Predictive scaling recommendations
CREATE TABLE IF NOT EXISTS scaling_predictions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    prediction_horizon ENUM('1h', '6h', '24h', '7d') NOT NULL,
    resource_type ENUM('cpu', 'memory', 'database', 'cdn', 'storage') NOT NULL,
    current_utilization DECIMAL(5,2),
    predicted_utilization DECIMAL(5,2),
    confidence_score DECIMAL(4,3),
    scaling_recommendation ENUM('scale_up', 'scale_down', 'maintain', 'monitor') NOT NULL,
    recommended_capacity JSON,
    triggers JSON, -- Conditions that triggered this prediction
    cost_impact DECIMAL(10,2),
    predicted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    prediction_key VARCHAR(255),
    
    INDEX idx_prediction_horizon (prediction_horizon),
    INDEX idx_resource_type (resource_type),
    INDEX idx_predicted_at (predicted_at),
    INDEX idx_prediction_key (prediction_key)
);

-- Insert initial ML models
INSERT IGNORE INTO ml_models (model_name, model_type, features, accuracy, confidence_threshold) VALUES
('load_time_prediction', 'linear_regression', 
 JSON_ARRAY('image_count', 'total_size', 'theme_complexity', 'user_connection_speed', 'cache_hit_rate'), 
 0.750, 0.700),
('resource_usage_prediction', 'time_series',
 JSON_ARRAY('cpu_usage', 'memory_usage', 'db_connections', 'concurrent_users'),
 0.680, 0.650),
('anomaly_detection', 'isolation_forest',
 JSON_ARRAY('response_time', 'error_rate', 'throughput', 'resource_usage'),
 0.820, 0.750),
('optimization_recommendation', 'neural_network',
 JSON_ARRAY('performance_metrics', 'resource_usage', 'user_patterns', 'system_config'),
 0.700, 0.600);

-- Insert performance baselines for AI predictions
INSERT IGNORE INTO performance_baselines (baseline_name, context_type, context_id, metric_name, baseline_value, confidence_interval_lower, confidence_interval_upper, sample_size) VALUES
('global_load_time', 'global', NULL, 'gallery_load_time', 1.500, 1.200, 2.000, 1000),
('global_cpu_usage', 'global', NULL, 'cpu_usage_percent', 45.0, 35.0, 65.0, 500),
('global_memory_usage', 'global', NULL, 'memory_usage_percent', 60.0, 50.0, 75.0, 500),
('mobile_load_time', 'device_type', 'mobile', 'gallery_load_time', 2.200, 1.800, 3.000, 300),
('desktop_load_time', 'device_type', 'desktop', 'gallery_load_time', 1.200, 0.900, 1.600, 700),
('luxury_theme_load_time', 'theme', '3', 'gallery_load_time', 1.800, 1.500, 2.200, 150),
('modern_theme_load_time', 'theme', '4', 'gallery_load_time', 1.300, 1.100, 1.600, 200),
('glamour_theme_load_time', 'theme', '5', 'gallery_load_time', 2.000, 1.700, 2.400, 180),
('rose_theme_load_time', 'theme', '17', 'gallery_load_time', 1.600, 1.300, 2.000, 100);

-- Create views for easier ML model management
CREATE OR REPLACE VIEW v_active_ml_models AS
SELECT 
    m.model_name,
    m.model_type,
    m.accuracy,
    m.last_trained_at,
    m.training_data_size,
    COUNT(p.id) as cached_predictions,
    MAX(mp.accuracy) as latest_accuracy
FROM ml_models m
LEFT JOIN performance_predictions p ON m.model_name = p.model_name 
    AND p.expires_at > NOW()
LEFT JOIN ml_model_performance mp ON m.model_name = mp.model_name 
    AND mp.evaluation_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
WHERE m.is_active = TRUE
GROUP BY m.model_name, m.model_type, m.accuracy, m.last_trained_at, m.training_data_size;

CREATE OR REPLACE VIEW v_prediction_accuracy_summary AS
SELECT 
    model_name,
    prediction_type,
    COUNT(*) as total_predictions,
    AVG(confidence_score) as avg_confidence,
    MIN(confidence_score) as min_confidence,
    MAX(confidence_score) as max_confidence,
    COUNT(CASE WHEN confidence_score >= 0.8 THEN 1 END) as high_confidence_predictions
FROM performance_predictions 
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
GROUP BY model_name, prediction_type;

CREATE OR REPLACE VIEW v_optimization_impact AS
SELECT 
    recommendation_type,
    priority,
    COUNT(*) as total_recommendations,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as implemented_count,
    AVG(confidence_score) as avg_confidence,
    AVG(CASE WHEN measured_impact IS NOT NULL THEN 
        JSON_UNQUOTE(JSON_EXTRACT(measured_impact, '$.load_time_improvement')) 
    END) as avg_load_time_improvement
FROM optimization_recommendations 
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY recommendation_type, priority;

-- Create stored procedures for ML operations
DELIMITER $$

CREATE PROCEDURE UpdateModelAccuracy(
    IN p_model_name VARCHAR(100),
    IN p_accuracy DECIMAL(4,3),
    IN p_validation_samples INT
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    UPDATE ml_models 
    SET accuracy = p_accuracy,
        last_trained_at = NOW(),
        training_data_size = p_validation_samples
    WHERE model_name = p_model_name;
    
    INSERT INTO ml_model_performance (
        model_name, evaluation_date, accuracy, validation_samples
    ) VALUES (
        p_model_name, NOW(), p_accuracy, p_validation_samples
    );
    
    COMMIT;
END$$

CREATE PROCEDURE CleanupExpiredPredictions()
BEGIN
    DELETE FROM performance_predictions 
    WHERE expires_at IS NOT NULL 
      AND expires_at < NOW();
      
    DELETE FROM ml_training_data 
    WHERE processed_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
      AND is_validation_set = FALSE;
END$$

CREATE PROCEDURE GetModelTrainingStatus()
BEGIN
    SELECT 
        m.model_name,
        m.model_type,
        m.accuracy,
        m.last_trained_at,
        TIMESTAMPDIFF(HOUR, m.last_trained_at, NOW()) as hours_since_training,
        COUNT(td.id) as available_training_samples,
        CASE 
            WHEN m.last_trained_at IS NULL THEN 'needs_initial_training'
            WHEN TIMESTAMPDIFF(HOUR, m.last_trained_at, NOW()) > 48 THEN 'needs_retraining'
            WHEN m.accuracy < 0.7 THEN 'needs_improvement'
            ELSE 'healthy'
        END as training_status
    FROM ml_models m
    LEFT JOIN ml_training_data td ON m.model_name = td.model_name
        AND td.collected_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    WHERE m.is_active = TRUE
    GROUP BY m.model_name, m.model_type, m.accuracy, m.last_trained_at;
END$$

DELIMITER ;

-- Create indexes for optimal ML query performance
ALTER TABLE ml_training_data ADD INDEX idx_model_collected (model_name, collected_at DESC);
ALTER TABLE performance_predictions ADD INDEX idx_type_created (prediction_type, created_at DESC);
ALTER TABLE optimization_recommendations ADD INDEX idx_priority_status (priority DESC, status);

-- Grant permissions for ML service
-- Note: In production, create a dedicated ML service user
-- GRANT SELECT, INSERT, UPDATE, DELETE ON phoenix4ge.ml_* TO 'ml_service'@'localhost';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON phoenix4ge.performance_* TO 'ml_service'@'localhost';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON phoenix4ge.optimization_* TO 'ml_service'@'localhost';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON phoenix4ge.scaling_* TO 'ml_service'@'localhost';
-- GRANT EXECUTE ON PROCEDURE phoenix4ge.UpdateModelAccuracy TO 'ml_service'@'localhost';
-- GRANT EXECUTE ON PROCEDURE phoenix4ge.CleanupExpiredPredictions TO 'ml_service'@'localhost';
-- GRANT EXECUTE ON PROCEDURE phoenix4ge.GetModelTrainingStatus TO 'ml_service'@'localhost';

SELECT 'AI Performance Prediction System migration completed successfully' as status;