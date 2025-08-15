-- A/B Testing Framework Migration
-- Adds tables and infrastructure for automated A/B testing with statistical significance tracking

USE musenest;

-- A/B test experiments configuration and management
CREATE TABLE IF NOT EXISTS ab_test_experiments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    experiment_id VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    experiment_type ENUM('recommendation_algorithm', 'ui_component', 'pricing_strategy', 'content_optimization', 'other') NOT NULL,
    status ENUM('draft', 'running', 'paused', 'completed', 'cancelled') DEFAULT 'draft',
    variants JSON NOT NULL, -- Array of variant configurations
    traffic_allocation JSON NOT NULL, -- Traffic percentage per variant
    targeting_criteria JSON, -- User targeting rules
    primary_metric VARCHAR(100) NOT NULL,
    secondary_metrics JSON, -- Array of secondary metrics to track
    statistical_plan JSON NOT NULL, -- Statistical test configuration and requirements
    planned_duration_days INT DEFAULT 14,
    minimum_sample_size INT DEFAULT 100,
    calculated_sample_size INT, -- Calculated required sample size
    actual_sample_size INT DEFAULT 0,
    confidence_level DECIMAL(4,3) DEFAULT 0.950,
    statistical_power DECIMAL(4,3) DEFAULT 0.800,
    minimum_detectable_effect DECIMAL(6,4) DEFAULT 0.0500,
    start_date TIMESTAMP NULL,
    end_date TIMESTAMP NULL,
    planned_end_date TIMESTAMP NULL,
    conclusion TEXT,
    winning_variant VARCHAR(100),
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_experiment_id (experiment_id),
    INDEX idx_status (status),
    INDEX idx_experiment_type (experiment_type),
    INDEX idx_start_date (start_date),
    INDEX idx_end_date (end_date),
    INDEX idx_created_by (created_by)
);

-- Experiment variants configuration
CREATE TABLE IF NOT EXISTS ab_test_variants (
    id INT PRIMARY KEY AUTO_INCREMENT,
    experiment_id VARCHAR(100) NOT NULL,
    variant_name VARCHAR(100) NOT NULL,
    variant_type ENUM('control', 'treatment') DEFAULT 'treatment',
    configuration JSON NOT NULL, -- Variant-specific configuration
    traffic_percentage DECIMAL(5,2) NOT NULL, -- Expected traffic percentage
    actual_traffic_percentage DECIMAL(5,2), -- Actual traffic percentage received
    is_control BOOLEAN DEFAULT FALSE,
    participant_count INT DEFAULT 0,
    conversion_count INT DEFAULT 0,
    conversion_rate DECIMAL(8,6),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY idx_experiment_variant (experiment_id, variant_name),
    INDEX idx_experiment_id (experiment_id),
    INDEX idx_variant_type (variant_type),
    INDEX idx_is_control (is_control),
    
    FOREIGN KEY (experiment_id) REFERENCES ab_test_experiments(experiment_id) ON DELETE CASCADE
);

-- User assignments to experiment variants
CREATE TABLE IF NOT EXISTS ab_test_participants (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    experiment_id VARCHAR(100) NOT NULL,
    user_id VARCHAR(100) NOT NULL,
    variant_name VARCHAR(100) NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_context JSON, -- User context at time of assignment
    assignment_method ENUM('hash_based', 'random', 'manual') DEFAULT 'hash_based',
    is_excluded BOOLEAN DEFAULT FALSE,
    exclusion_reason VARCHAR(200),
    first_exposure TIMESTAMP NULL, -- First time user was exposed to variant
    last_activity TIMESTAMP NULL,
    total_sessions INT DEFAULT 0,
    
    UNIQUE KEY idx_experiment_user (experiment_id, user_id),
    INDEX idx_experiment_id (experiment_id),
    INDEX idx_user_id (user_id),
    INDEX idx_variant_name (variant_name),
    INDEX idx_assigned_at (assigned_at),
    INDEX idx_assignment_method (assignment_method),
    
    FOREIGN KEY (experiment_id) REFERENCES ab_test_experiments(experiment_id) ON DELETE CASCADE
);

-- Event tracking for A/B test metrics
CREATE TABLE IF NOT EXISTS ab_test_events (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    experiment_id VARCHAR(100) NOT NULL,
    user_id VARCHAR(100) NOT NULL,
    variant_name VARCHAR(100) NOT NULL,
    event_type VARCHAR(100) NOT NULL, -- click_through_rate, conversion_rate, etc.
    event_data JSON, -- Additional event context
    event_value DECIMAL(15,6) DEFAULT 0, -- Numerical value (revenue, time, etc.)
    session_id VARCHAR(100),
    page_context VARCHAR(200),
    user_agent TEXT,
    ip_address VARCHAR(45),
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_experiment_id (experiment_id),
    INDEX idx_user_variant (user_id, variant_name),
    INDEX idx_event_type (event_type),
    INDEX idx_recorded_at (recorded_at),
    INDEX idx_experiment_event_date (experiment_id, event_type, recorded_at),
    
    FOREIGN KEY (experiment_id) REFERENCES ab_test_experiments(experiment_id) ON DELETE CASCADE
);

-- Statistical significance results and analysis
CREATE TABLE IF NOT EXISTS ab_test_statistical_results (
    id INT PRIMARY KEY AUTO_INCREMENT,
    experiment_id VARCHAR(100) NOT NULL,
    statistical_method ENUM('frequentist', 'bayesian', 'combined') NOT NULL,
    test_statistic DECIMAL(12,6),
    p_value DECIMAL(12,9),
    confidence_level DECIMAL(4,3) NOT NULL,
    effect_size DECIMAL(8,6), -- Cohen's d, relative difference, etc.
    effect_size_type ENUM('cohens_d', 'relative_difference', 'absolute_difference') DEFAULT 'relative_difference',
    confidence_interval_lower DECIMAL(12,6),
    confidence_interval_upper DECIMAL(12,6),
    bayesian_probability DECIMAL(6,4), -- Probability of superiority (Bayesian)
    credible_interval_lower DECIMAL(12,6), -- Bayesian credible interval
    credible_interval_upper DECIMAL(12,6),
    is_significant BOOLEAN DEFAULT FALSE,
    significance_threshold DECIMAL(4,3) DEFAULT 0.050,
    winning_variant VARCHAR(100),
    conclusion ENUM('significant_improvement', 'significant_decline', 'inconclusive', 'insufficient_data') DEFAULT 'insufficient_data',
    statistical_power DECIMAL(4,3), -- Achieved statistical power
    sample_sizes JSON NOT NULL, -- Sample sizes per variant
    variance_estimates JSON, -- Variance estimates per variant
    test_assumptions JSON, -- Assumptions validation results
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_experiment_id (experiment_id),
    INDEX idx_statistical_method (statistical_method),
    INDEX idx_is_significant (is_significant),
    INDEX idx_p_value (p_value),
    INDEX idx_calculated_at (calculated_at),
    
    FOREIGN KEY (experiment_id) REFERENCES ab_test_experiments(experiment_id) ON DELETE CASCADE
);

-- Multi-variate test interactions and correlations
CREATE TABLE IF NOT EXISTS ab_test_interactions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    experiment_id VARCHAR(100) NOT NULL,
    interaction_type ENUM('two_way', 'three_way', 'higher_order') NOT NULL,
    factors JSON NOT NULL, -- Array of interacting factors
    interaction_effect DECIMAL(8,6),
    interaction_p_value DECIMAL(12,9),
    is_significant BOOLEAN DEFAULT FALSE,
    interpretation TEXT,
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_experiment_id (experiment_id),
    INDEX idx_interaction_type (interaction_type),
    INDEX idx_is_significant (is_significant),
    
    FOREIGN KEY (experiment_id) REFERENCES ab_test_experiments(experiment_id) ON DELETE CASCADE
);

-- Sequential testing and early stopping tracking
CREATE TABLE IF NOT EXISTS ab_test_sequential_analysis (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    experiment_id VARCHAR(100) NOT NULL,
    analysis_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    cumulative_sample_size INT NOT NULL,
    cumulative_conversions INT NOT NULL,
    sequential_p_value DECIMAL(12,9), -- Adjusted p-value for sequential testing
    spending_function_value DECIMAL(8,6), -- Alpha spending function value
    futility_boundary DECIMAL(8,6), -- Futility boundary for early stopping
    efficacy_boundary DECIMAL(8,6), -- Efficacy boundary for early stopping
    should_stop_for_futility BOOLEAN DEFAULT FALSE,
    should_stop_for_efficacy BOOLEAN DEFAULT FALSE,
    recommendation ENUM('continue', 'stop_futility', 'stop_efficacy', 'stop_duration') NOT NULL,
    confidence_sequence JSON, -- Confidence sequence bounds
    
    INDEX idx_experiment_id (experiment_id),
    INDEX idx_analysis_time (analysis_time),
    INDEX idx_recommendation (recommendation),
    
    FOREIGN KEY (experiment_id) REFERENCES ab_test_experiments(experiment_id) ON DELETE CASCADE
);

-- A/B test performance and health monitoring
CREATE TABLE IF NOT EXISTS ab_test_monitoring (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    experiment_id VARCHAR(100) NOT NULL,
    monitoring_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sample_ratio_mismatch DECIMAL(6,4), -- Deviation from expected traffic allocation
    conversion_rate_anomaly DECIMAL(6,4), -- Unusual conversion rate patterns
    traffic_quality_score DECIMAL(4,3), -- Quality of traffic (bot detection, etc.)
    experiment_health_status ENUM('healthy', 'warning', 'critical') DEFAULT 'healthy',
    alerts_triggered JSON, -- Array of alerts that were triggered
    performance_metrics JSON, -- Various performance metrics
    recommendations JSON, -- Automated recommendations
    
    INDEX idx_experiment_id (experiment_id),
    INDEX idx_monitoring_time (monitoring_time),
    INDEX idx_health_status (experiment_health_status),
    
    FOREIGN KEY (experiment_id) REFERENCES ab_test_experiments(experiment_id) ON DELETE CASCADE
);

-- Machine learning models for experiment optimization
CREATE TABLE IF NOT EXISTS ab_test_ml_models (
    id INT PRIMARY KEY AUTO_INCREMENT,
    model_name VARCHAR(100) NOT NULL UNIQUE,
    model_type ENUM('traffic_allocation', 'early_stopping', 'effect_prediction', 'user_segmentation') NOT NULL,
    model_version VARCHAR(50),
    algorithm_details JSON NOT NULL,
    feature_importance JSON,
    model_performance JSON, -- Accuracy, precision, recall, etc.
    training_data_size INT DEFAULT 0,
    validation_accuracy DECIMAL(6,4),
    is_production BOOLEAN DEFAULT FALSE,
    model_file_path VARCHAR(500),
    trained_at TIMESTAMP NULL,
    deployed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_model_name (model_name),
    INDEX idx_model_type (model_type),
    INDEX idx_is_production (is_production),
    INDEX idx_trained_at (trained_at)
);

-- Experiment recommendations and insights
CREATE TABLE IF NOT EXISTS ab_test_insights (
    id INT PRIMARY KEY AUTO_INCREMENT,
    experiment_id VARCHAR(100) NOT NULL,
    insight_type ENUM('statistical', 'business', 'technical', 'recommendation') NOT NULL,
    insight_category VARCHAR(100), -- traffic, conversion, user_behavior, etc.
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    severity ENUM('info', 'warning', 'critical') DEFAULT 'info',
    confidence_score DECIMAL(4,3) DEFAULT 0.000,
    supporting_data JSON,
    actionable_recommendations JSON,
    generated_by ENUM('statistical_analysis', 'ml_model', 'rule_based', 'manual') DEFAULT 'statistical_analysis',
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_at TIMESTAMP NULL,
    acknowledged_by VARCHAR(100),
    
    INDEX idx_experiment_id (experiment_id),
    INDEX idx_insight_type (insight_type),
    INDEX idx_severity (severity),
    INDEX idx_generated_at (generated_at),
    INDEX idx_acknowledged (acknowledged),
    
    FOREIGN KEY (experiment_id) REFERENCES ab_test_experiments(experiment_id) ON DELETE CASCADE
);

-- Sample data for testing and examples
INSERT IGNORE INTO ab_test_experiments (
    experiment_id, name, description, experiment_type, status, variants, 
    traffic_allocation, primary_metric, secondary_metrics, statistical_plan
) VALUES (
    'exp_recommendation_test_001',
    'Recommendation Algorithm A/B Test',
    'Testing collaborative filtering vs content-based recommendations',
    'recommendation_algorithm',
    'draft',
    JSON_ARRAY(
        JSON_OBJECT('name', 'control', 'type', 'control', 'configuration', JSON_OBJECT('algorithm', 'collaborative_filtering')),
        JSON_OBJECT('name', 'treatment', 'type', 'treatment', 'configuration', JSON_OBJECT('algorithm', 'content_based'))
    ),
    JSON_OBJECT('control', 0.5, 'treatment', 0.5),
    'click_through_rate',
    JSON_ARRAY('conversion_rate', 'engagement_rate', 'user_satisfaction'),
    JSON_OBJECT('test_type', 'proportion_test', 'required_sample_size', 2000, 'minimum_detectable_effect', 0.05)
);

-- Insert sample variants
INSERT IGNORE INTO ab_test_variants (experiment_id, variant_name, variant_type, configuration, traffic_percentage, is_control) VALUES
('exp_recommendation_test_001', 'control', 'control', JSON_OBJECT('algorithm', 'collaborative_filtering'), 50.0, TRUE),
('exp_recommendation_test_001', 'treatment', 'treatment', JSON_OBJECT('algorithm', 'content_based'), 50.0, FALSE);

-- Insert sample ML models for A/B testing optimization
INSERT IGNORE INTO ab_test_ml_models (model_name, model_type, algorithm_details, validation_accuracy, is_production) VALUES
('traffic_allocation_optimizer_v1', 'traffic_allocation', 
 JSON_OBJECT('algorithm', 'multi_armed_bandit', 'exploration_rate', 0.1, 'optimization_metric', 'conversion_rate'), 
 0.850, TRUE),
('early_stopping_predictor_v1', 'early_stopping',
 JSON_OBJECT('algorithm', 'gradient_boosting', 'features', JSON_ARRAY('sample_size', 'effect_size', 'p_value_trend')),
 0.920, TRUE),
('user_segmentation_model_v1', 'user_segmentation',
 JSON_OBJECT('algorithm', 'clustering', 'n_clusters', 5, 'features', JSON_ARRAY('engagement_score', 'conversion_history')),
 0.780, TRUE);

-- Create views for easier A/B test analysis
CREATE OR REPLACE VIEW v_experiment_summary AS
SELECT 
    e.experiment_id,
    e.name,
    e.experiment_type,
    e.status,
    e.primary_metric,
    e.start_date,
    e.end_date,
    e.planned_end_date,
    COUNT(DISTINCT p.user_id) as total_participants,
    COUNT(DISTINCT ev.user_id) as converted_users,
    COUNT(DISTINCT ev.user_id) / COUNT(DISTINCT p.user_id) as overall_conversion_rate,
    sr.is_significant,
    sr.p_value,
    sr.winning_variant,
    sr.conclusion
FROM ab_test_experiments e
LEFT JOIN ab_test_participants p ON e.experiment_id = p.experiment_id
LEFT JOIN ab_test_events ev ON e.experiment_id = ev.experiment_id AND ev.event_type = e.primary_metric
LEFT JOIN ab_test_statistical_results sr ON e.experiment_id = sr.experiment_id
GROUP BY e.experiment_id, e.name, e.experiment_type, e.status, e.primary_metric, 
         e.start_date, e.end_date, e.planned_end_date, sr.is_significant, sr.p_value, 
         sr.winning_variant, sr.conclusion;

CREATE OR REPLACE VIEW v_variant_performance AS
SELECT 
    v.experiment_id,
    v.variant_name,
    v.is_control,
    v.traffic_percentage as expected_traffic,
    COUNT(DISTINCT p.user_id) as participants,
    COUNT(DISTINCT p.user_id) / (
        SELECT COUNT(DISTINCT user_id) 
        FROM ab_test_participants 
        WHERE experiment_id = v.experiment_id
    ) * 100 as actual_traffic_percentage,
    COUNT(DISTINCT ev.user_id) as conversions,
    COALESCE(COUNT(DISTINCT ev.user_id) / NULLIF(COUNT(DISTINCT p.user_id), 0), 0) as conversion_rate,
    COALESCE(SUM(ev.event_value), 0) as total_value,
    COALESCE(AVG(ev.event_value), 0) as avg_value_per_conversion,
    COALESCE(SUM(ev.event_value) / NULLIF(COUNT(DISTINCT p.user_id), 0), 0) as avg_value_per_user
FROM ab_test_variants v
LEFT JOIN ab_test_participants p ON v.experiment_id = p.experiment_id AND v.variant_name = p.variant_name
LEFT JOIN ab_test_events ev ON p.experiment_id = ev.experiment_id AND p.user_id = ev.user_id AND p.variant_name = ev.variant_name
    AND ev.event_type = (SELECT primary_metric FROM ab_test_experiments WHERE experiment_id = v.experiment_id)
GROUP BY v.experiment_id, v.variant_name, v.is_control, v.traffic_percentage;

CREATE OR REPLACE VIEW v_experiment_health AS
SELECT 
    e.experiment_id,
    e.name,
    e.status,
    DATEDIFF(COALESCE(e.end_date, NOW()), e.start_date) as days_running,
    COUNT(DISTINCT p.user_id) as total_participants,
    e.minimum_sample_size,
    COUNT(DISTINCT p.user_id) / e.minimum_sample_size as sample_progress,
    m.sample_ratio_mismatch,
    m.traffic_quality_score,
    m.experiment_health_status,
    sr.is_significant,
    sr.p_value,
    CASE 
        WHEN e.status = 'running' AND COUNT(DISTINCT p.user_id) >= e.minimum_sample_size AND sr.is_significant = TRUE THEN 'ready_to_conclude'
        WHEN e.status = 'running' AND DATEDIFF(NOW(), e.start_date) >= e.planned_duration_days THEN 'duration_complete'
        WHEN e.status = 'running' AND m.experiment_health_status = 'critical' THEN 'needs_attention'
        WHEN e.status = 'running' THEN 'healthy_running'
        ELSE LOWER(e.status)
    END as experiment_state
FROM ab_test_experiments e
LEFT JOIN ab_test_participants p ON e.experiment_id = p.experiment_id
LEFT JOIN ab_test_monitoring m ON e.experiment_id = m.experiment_id 
    AND m.monitoring_time = (SELECT MAX(monitoring_time) FROM ab_test_monitoring WHERE experiment_id = e.experiment_id)
LEFT JOIN ab_test_statistical_results sr ON e.experiment_id = sr.experiment_id
    AND sr.calculated_at = (SELECT MAX(calculated_at) FROM ab_test_statistical_results WHERE experiment_id = e.experiment_id)
GROUP BY e.experiment_id, e.name, e.status, e.start_date, e.end_date, e.planned_duration_days, 
         e.minimum_sample_size, m.sample_ratio_mismatch, m.traffic_quality_score, 
         m.experiment_health_status, sr.is_significant, sr.p_value;

CREATE OR REPLACE VIEW v_statistical_power_analysis AS
SELECT 
    sr.experiment_id,
    sr.statistical_method,
    sr.effect_size,
    sr.statistical_power,
    sr.confidence_level,
    sr.p_value,
    sr.is_significant,
    JSON_UNQUOTE(JSON_EXTRACT(sr.sample_sizes, '$.control')) as control_sample_size,
    JSON_UNQUOTE(JSON_EXTRACT(sr.sample_sizes, '$.treatment')) as treatment_sample_size,
    CASE 
        WHEN sr.statistical_power >= 0.8 THEN 'adequate'
        WHEN sr.statistical_power >= 0.6 THEN 'marginal'
        ELSE 'insufficient'
    END as power_assessment,
    CASE 
        WHEN sr.p_value <= 0.01 THEN 'highly_significant'
        WHEN sr.p_value <= 0.05 THEN 'significant'
        WHEN sr.p_value <= 0.1 THEN 'marginally_significant'
        ELSE 'not_significant'
    END as significance_level
FROM ab_test_statistical_results sr;

-- Create stored procedures for A/B test management
DELIMITER $$

CREATE PROCEDURE GetExperimentDashboard(
    IN p_status VARCHAR(50) DEFAULT NULL
)
BEGIN
    -- Get experiment overview
    SELECT 
        'Experiment Overview' as section,
        experiment_id,
        name,
        experiment_type,
        status,
        total_participants,
        overall_conversion_rate,
        is_significant,
        p_value,
        winning_variant,
        conclusion
    FROM v_experiment_summary
    WHERE p_status IS NULL OR status = p_status
    ORDER BY 
        CASE status 
            WHEN 'running' THEN 1 
            WHEN 'completed' THEN 2 
            ELSE 3 
        END,
        start_date DESC;
    
    -- Get experiment health summary
    SELECT 
        'Health Summary' as section,
        experiment_state,
        COUNT(*) as experiment_count,
        AVG(sample_progress) as avg_sample_progress,
        AVG(traffic_quality_score) as avg_traffic_quality
    FROM v_experiment_health
    WHERE p_status IS NULL OR status = p_status
    GROUP BY experiment_state
    ORDER BY 
        CASE experiment_state
            WHEN 'needs_attention' THEN 1
            WHEN 'ready_to_conclude' THEN 2
            WHEN 'healthy_running' THEN 3
            ELSE 4
        END;
    
    -- Get recent insights
    SELECT 
        'Recent Insights' as section,
        i.experiment_id,
        e.name as experiment_name,
        i.insight_type,
        i.title,
        i.severity,
        i.confidence_score,
        i.generated_at
    FROM ab_test_insights i
    JOIN ab_test_experiments e ON i.experiment_id = e.experiment_id
    WHERE i.generated_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      AND (p_status IS NULL OR e.status = p_status)
      AND i.acknowledged = FALSE
    ORDER BY i.severity DESC, i.confidence_score DESC, i.generated_at DESC
    LIMIT 10;
END$$

CREATE PROCEDURE AnalyzeExperimentPerformance(
    IN p_experiment_id VARCHAR(100)
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    -- Get variant performance comparison
    SELECT 
        'Variant Performance' as analysis_type,
        variant_name,
        is_control,
        participants,
        conversions,
        conversion_rate,
        total_value,
        avg_value_per_user,
        actual_traffic_percentage,
        expected_traffic
    FROM v_variant_performance
    WHERE experiment_id = p_experiment_id
    ORDER BY is_control DESC, conversion_rate DESC;
    
    -- Get statistical significance analysis
    SELECT 
        'Statistical Analysis' as analysis_type,
        statistical_method,
        effect_size,
        statistical_power,
        p_value,
        is_significant,
        confidence_interval_lower,
        confidence_interval_upper,
        winning_variant,
        conclusion
    FROM ab_test_statistical_results
    WHERE experiment_id = p_experiment_id
    ORDER BY calculated_at DESC
    LIMIT 1;
    
    -- Get time series performance
    SELECT 
        'Time Series' as analysis_type,
        DATE(ev.recorded_at) as date,
        ev.variant_name,
        COUNT(*) as daily_events,
        COUNT(DISTINCT ev.user_id) as daily_unique_users,
        AVG(ev.event_value) as avg_daily_value
    FROM ab_test_events ev
    WHERE ev.experiment_id = p_experiment_id
    GROUP BY DATE(ev.recorded_at), ev.variant_name
    ORDER BY date, ev.variant_name;
    
    -- Get user segmentation insights
    SELECT 
        'User Segmentation' as analysis_type,
        p.variant_name,
        JSON_UNQUOTE(JSON_EXTRACT(p.user_context, '$.user_segment')) as user_segment,
        COUNT(*) as segment_participants,
        COUNT(DISTINCT ev.user_id) as segment_conversions,
        COUNT(DISTINCT ev.user_id) / COUNT(*) as segment_conversion_rate
    FROM ab_test_participants p
    LEFT JOIN ab_test_events ev ON p.experiment_id = ev.experiment_id AND p.user_id = ev.user_id
    WHERE p.experiment_id = p_experiment_id
      AND JSON_EXTRACT(p.user_context, '$.user_segment') IS NOT NULL
    GROUP BY p.variant_name, JSON_UNQUOTE(JSON_EXTRACT(p.user_context, '$.user_segment'))
    HAVING segment_participants >= 10
    ORDER BY p.variant_name, segment_conversion_rate DESC;
    
    COMMIT;
END$$

DELIMITER ;

-- Create indexes for optimal query performance
ALTER TABLE ab_test_events ADD INDEX idx_experiment_variant_event_date (experiment_id, variant_name, event_type, recorded_at DESC);
ALTER TABLE ab_test_participants ADD INDEX idx_experiment_variant_assignment (experiment_id, variant_name, assigned_at DESC);
ALTER TABLE ab_test_statistical_results ADD INDEX idx_experiment_method_calculated (experiment_id, statistical_method, calculated_at DESC);
ALTER TABLE ab_test_monitoring ADD INDEX idx_experiment_health_time (experiment_id, experiment_health_status, monitoring_time DESC);

-- Grant permissions for A/B testing framework service
-- Note: In production, create a dedicated A/B testing service user
-- GRANT SELECT, INSERT, UPDATE, DELETE ON musenest.ab_test_* TO 'ab_test_service'@'localhost';
-- GRANT EXECUTE ON PROCEDURE musenest.GetExperimentDashboard TO 'ab_test_service'@'localhost';
-- GRANT EXECUTE ON PROCEDURE musenest.AnalyzeExperimentPerformance TO 'ab_test_service'@'localhost';

SELECT 'A/B Testing Framework migration completed successfully' as status;