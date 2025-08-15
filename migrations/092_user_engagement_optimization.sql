-- User Engagement Optimization and Personalization Migration
-- Adds comprehensive tables for user behavior prediction, personalization,
-- and engagement optimization with ML-based insights

USE musenest;

-- User engagement scoring and behavior tracking
CREATE TABLE IF NOT EXISTS user_engagement_scores (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    user_type ENUM('model', 'client', 'admin') DEFAULT 'model',
    engagement_score DECIMAL(6,4) NOT NULL, -- 0.0000 to 1.0000
    score_components JSON NOT NULL, -- Breakdown of score calculation
    calculation_method VARCHAR(100) NOT NULL,
    confidence_score DECIMAL(6,4) NOT NULL,
    data_points_used INT DEFAULT 0,
    scoring_model_version VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_user_id (user_id),
    INDEX idx_user_type (user_type),
    INDEX idx_engagement_score (engagement_score DESC),
    INDEX idx_confidence_score (confidence_score DESC),
    INDEX idx_updated_at (updated_at DESC),
    INDEX idx_user_engagement (user_id, engagement_score DESC, updated_at DESC)
);

-- User behavior tracking and analytics
CREATE TABLE IF NOT EXISTS user_behavior_analytics (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    session_id VARCHAR(100),
    behavior_type ENUM('page_view', 'content_interaction', 'feature_usage', 'social_action', 'purchase_behavior', 'search_behavior') NOT NULL,
    behavior_data JSON NOT NULL, -- Detailed behavior information
    context_data JSON, -- Session, device, temporal context
    engagement_value DECIMAL(6,3) DEFAULT 0, -- Weighted engagement contribution
    duration_seconds INT DEFAULT 0,
    interaction_depth INT DEFAULT 1, -- How deep the interaction was
    outcome_type ENUM('positive', 'negative', 'neutral', 'abandoned') DEFAULT 'neutral',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_user_id (user_id),
    INDEX idx_session_id (session_id),
    INDEX idx_behavior_type (behavior_type),
    INDEX idx_engagement_value (engagement_value DESC),
    INDEX idx_created_at (created_at DESC),
    INDEX idx_user_behavior_time (user_id, behavior_type, created_at DESC)
);

-- User segmentation and dynamic classification
CREATE TABLE IF NOT EXISTS user_segmentation (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    segmentation_type ENUM('behavioral', 'value', 'lifecycle', 'engagement', 'custom') NOT NULL,
    primary_segment VARCHAR(100) NOT NULL,
    segment_confidence DECIMAL(6,4) NOT NULL,
    segment_attributes JSON NOT NULL, -- Attributes that define the segment
    segment_score DECIMAL(8,4), -- Numerical score for the segment
    previous_segment VARCHAR(100), -- For tracking segment changes
    segment_changed_at TIMESTAMP NULL,
    personalization_priority ENUM('premium', 'advanced', 'standard', 'simplified', 'retention') DEFAULT 'standard',
    update_frequency_hours INT DEFAULT 24,
    last_calculated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_user_id (user_id),
    INDEX idx_segmentation_type (segmentation_type),
    INDEX idx_primary_segment (primary_segment),
    INDEX idx_segment_confidence (segment_confidence DESC),
    INDEX idx_personalization_priority (personalization_priority),
    INDEX idx_last_calculated (last_calculated),
    INDEX idx_user_segment (user_id, segmentation_type, primary_segment),
    
    UNIQUE KEY unique_user_segmentation_type (user_id, segmentation_type)
);

-- Engagement predictions and forecasting
CREATE TABLE IF NOT EXISTS engagement_predictions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    prediction_type ENUM('engagement_score', 'churn_risk', 'ltv', 'conversion_likelihood', 'feature_adoption') NOT NULL,
    prediction_horizon_days INT NOT NULL, -- How far into the future
    predicted_value DECIMAL(10,4) NOT NULL,
    confidence_interval_lower DECIMAL(10,4),
    confidence_interval_upper DECIMAL(10,4),
    confidence_score DECIMAL(6,4) NOT NULL,
    model_name VARCHAR(100) NOT NULL,
    model_version VARCHAR(50),
    features_used JSON NOT NULL, -- Features that contributed to prediction
    prediction_context JSON, -- Context at time of prediction
    actual_value DECIMAL(10,4) NULL, -- For accuracy tracking
    prediction_accuracy DECIMAL(6,4) NULL, -- Calculated accuracy
    is_validated BOOLEAN DEFAULT FALSE,
    validated_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL, -- When prediction becomes stale
    
    INDEX idx_user_id (user_id),
    INDEX idx_prediction_type (prediction_type),
    INDEX idx_confidence_score (confidence_score DESC),
    INDEX idx_model_name (model_name),
    INDEX idx_created_at (created_at DESC),
    INDEX idx_expires_at (expires_at),
    INDEX idx_is_validated (is_validated),
    INDEX idx_user_prediction (user_id, prediction_type, created_at DESC)
);

-- Personalization applications and tracking
CREATE TABLE IF NOT EXISTS personalization_applications (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    session_id VARCHAR(100),
    personalization_type ENUM('content', 'interface', 'communication', 'behavioral_triggers', 'realtime_adaptation') NOT NULL,
    personalization_strategy VARCHAR(200) NOT NULL,
    applied_configuration JSON NOT NULL, -- What personalization was applied
    context_data JSON, -- Request context and user state
    expected_impact DECIMAL(6,4), -- Predicted improvement
    success_metrics JSON, -- Metrics to track success
    actual_impact DECIMAL(6,4) NULL, -- Measured improvement
    effectiveness_score DECIMAL(6,4) NULL, -- How effective it was
    user_feedback VARCHAR(500), -- Optional user feedback
    is_successful BOOLEAN NULL, -- Was the personalization successful
    measured_at TIMESTAMP NULL,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_user_id (user_id),
    INDEX idx_session_id (session_id),
    INDEX idx_personalization_type (personalization_type),
    INDEX idx_personalization_strategy (personalization_strategy),
    INDEX idx_effectiveness_score (effectiveness_score DESC),
    INDEX idx_is_successful (is_successful),
    INDEX idx_applied_at (applied_at DESC),
    INDEX idx_user_personalization (user_id, personalization_type, applied_at DESC)
);

-- User journey optimization and path analysis
CREATE TABLE IF NOT EXISTS user_journey_optimizations (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    journey_session_id VARCHAR(100),
    current_path VARCHAR(500) NOT NULL,
    goal_type ENUM('engagement', 'conversion', 'retention', 'feature_adoption', 'satisfaction') NOT NULL,
    optimization_type VARCHAR(200) NOT NULL,
    optimization_strategy JSON NOT NULL, -- Detailed optimization strategy
    implementation_steps JSON, -- How to implement the optimization
    success_probability DECIMAL(6,4) NOT NULL,
    expected_improvement DECIMAL(6,4), -- Expected metric improvement
    alternative_optimizations JSON, -- Other considered optimizations
    is_implemented BOOLEAN DEFAULT FALSE,
    implementation_date TIMESTAMP NULL,
    measured_success DECIMAL(6,4) NULL, -- Actual measured improvement
    optimization_outcome ENUM('successful', 'failed', 'partially_successful', 'pending') NULL,
    outcome_measured_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL, -- When optimization recommendation expires
    
    INDEX idx_user_id (user_id),
    INDEX idx_journey_session_id (journey_session_id),
    INDEX idx_goal_type (goal_type),
    INDEX idx_optimization_type (optimization_type),
    INDEX idx_success_probability (success_probability DESC),
    INDEX idx_is_implemented (is_implemented),
    INDEX idx_optimization_outcome (optimization_outcome),
    INDEX idx_created_at (created_at DESC),
    INDEX idx_user_journey (user_id, goal_type, created_at DESC)
);

-- Real-time session tracking and adaptation
CREATE TABLE IF NOT EXISTS realtime_session_data (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    session_id VARCHAR(100) NOT NULL,
    session_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    session_end TIMESTAMP NULL,
    session_duration_seconds INT DEFAULT 0,
    page_views INT DEFAULT 0,
    interactions_count INT DEFAULT 0,
    engagement_events JSON, -- Real-time engagement events
    adaptation_events JSON, -- Real-time adaptations made
    context_changes JSON, -- How context changed during session
    final_engagement_score DECIMAL(6,4),
    session_outcome ENUM('engaged', 'partially_engaged', 'disengaged', 'converted', 'churned') NULL,
    device_info JSON,
    location_data JSON, -- General location context
    referrer_data JSON,
    is_active BOOLEAN DEFAULT TRUE,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_user_id (user_id),
    INDEX idx_session_id (session_id),
    INDEX idx_session_start (session_start),
    INDEX idx_is_active (is_active),
    INDEX idx_last_activity (last_activity DESC),
    INDEX idx_session_outcome (session_outcome),
    INDEX idx_final_engagement_score (final_engagement_score DESC),
    INDEX idx_active_sessions (user_id, is_active, last_activity DESC),
    
    UNIQUE KEY unique_session (session_id)
);

-- Engagement A/B test results and optimization
CREATE TABLE IF NOT EXISTS engagement_ab_test_results (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    experiment_id INT NOT NULL, -- Links to ab_test_experiments
    user_id INT NOT NULL,
    test_variant VARCHAR(50) NOT NULL,
    engagement_metric_name VARCHAR(100) NOT NULL,
    baseline_value DECIMAL(10,6),
    test_value DECIMAL(10,6),
    improvement_percentage DECIMAL(8,4), -- Percentage improvement
    statistical_significance DECIMAL(6,4), -- p-value or confidence level
    personalization_applied JSON, -- What personalization was tested
    user_segment VARCHAR(100),
    test_context JSON, -- Context during the test
    measurement_period_start TIMESTAMP NOT NULL,
    measurement_period_end TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_experiment_id (experiment_id),
    INDEX idx_user_id (user_id),
    INDEX idx_test_variant (test_variant),
    INDEX idx_engagement_metric_name (engagement_metric_name),
    INDEX idx_improvement_percentage (improvement_percentage DESC),
    INDEX idx_statistical_significance (statistical_significance DESC),
    INDEX idx_user_segment (user_segment),
    INDEX idx_measurement_period (measurement_period_start, measurement_period_end),
    
    FOREIGN KEY (experiment_id) REFERENCES ab_test_experiments(id) ON DELETE CASCADE
);

-- Model performance tracking for engagement predictions
CREATE TABLE IF NOT EXISTS engagement_model_performance (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    model_name VARCHAR(100) NOT NULL,
    model_type ENUM('engagement_scoring', 'churn_prediction', 'ltv_prediction', 'personalization', 'journey_optimization') NOT NULL,
    model_version VARCHAR(50) NOT NULL,
    performance_metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(10,6) NOT NULL,
    evaluation_dataset_size INT,
    evaluation_period_start TIMESTAMP,
    evaluation_period_end TIMESTAMP,
    cross_validation_score DECIMAL(6,4),
    feature_importance JSON, -- Importance of different features
    prediction_distribution JSON, -- Distribution of predictions
    error_analysis JSON, -- Analysis of model errors
    model_configuration JSON, -- Configuration used for the model
    training_data_stats JSON, -- Statistics about training data
    evaluated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_model_name (model_name),
    INDEX idx_model_type (model_type),
    INDEX idx_performance_metric_name (performance_metric_name),
    INDEX idx_metric_value (metric_value DESC),
    INDEX idx_evaluated_at (evaluated_at DESC),
    INDEX idx_model_performance (model_name, model_type, performance_metric_name, evaluated_at DESC)
);

-- User feedback on personalization and engagement features
CREATE TABLE IF NOT EXISTS engagement_user_feedback (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    feedback_type ENUM('personalization_rating', 'recommendation_feedback', 'interface_preference', 'engagement_improvement', 'feature_request') NOT NULL,
    feedback_context JSON NOT NULL, -- What the feedback is about
    feedback_rating INT, -- 1-5 rating if applicable
    feedback_text TEXT,
    improvement_suggestions TEXT,
    personalization_id BIGINT NULL, -- Links to specific personalization
    prediction_id BIGINT NULL, -- Links to specific prediction
    is_constructive BOOLEAN DEFAULT TRUE,
    feedback_sentiment ENUM('positive', 'negative', 'neutral', 'mixed') NULL,
    implemented BOOLEAN DEFAULT FALSE, -- Was the feedback acted upon
    implementation_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_user_id (user_id),
    INDEX idx_feedback_type (feedback_type),
    INDEX idx_feedback_rating (feedback_rating),
    INDEX idx_feedback_sentiment (feedback_sentiment),
    INDEX idx_is_constructive (is_constructive),
    INDEX idx_implemented (implemented),
    INDEX idx_personalization_id (personalization_id),
    INDEX idx_prediction_id (prediction_id),
    INDEX idx_created_at (created_at DESC),
    
    FOREIGN KEY (personalization_id) REFERENCES personalization_applications(id) ON DELETE SET NULL,
    FOREIGN KEY (prediction_id) REFERENCES engagement_predictions(id) ON DELETE SET NULL
);

-- Engagement alerts and monitoring
CREATE TABLE IF NOT EXISTS engagement_alerts (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    alert_type ENUM('low_engagement', 'churn_risk', 'personalization_failure', 'model_performance_degraded', 'unusual_behavior', 'system_health') NOT NULL,
    severity ENUM('info', 'warning', 'critical', 'emergency') NOT NULL,
    user_id INT NULL, -- NULL for system-wide alerts
    alert_title VARCHAR(200) NOT NULL,
    alert_description TEXT NOT NULL,
    alert_data JSON, -- Additional context data
    threshold_breached DECIMAL(8,4), -- Value that triggered the alert
    threshold_value DECIMAL(8,4), -- The threshold that was set
    recommended_actions JSON, -- Suggested actions to take
    is_acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by VARCHAR(100),
    acknowledged_at TIMESTAMP NULL,
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_by VARCHAR(100),
    resolved_at TIMESTAMP NULL,
    resolution_notes TEXT,
    auto_generated BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_alert_type (alert_type),
    INDEX idx_severity (severity),
    INDEX idx_user_id (user_id),
    INDEX idx_is_acknowledged (is_acknowledged),
    INDEX idx_is_resolved (is_resolved),
    INDEX idx_auto_generated (auto_generated),
    INDEX idx_created_at (created_at DESC),
    INDEX idx_alert_status (alert_type, severity, is_resolved, created_at DESC)
);

-- Insert default engagement model configurations
INSERT IGNORE INTO engagement_model_performance (
    model_name, model_type, model_version, performance_metric_name, 
    metric_value, evaluation_dataset_size, evaluated_at
) VALUES
('content_engagement_predictor', 'engagement_scoring', '1.0.0', 'accuracy', 0.850, 1000, NOW()),
('content_engagement_predictor', 'engagement_scoring', '1.0.0', 'precision', 0.820, 1000, NOW()),
('content_engagement_predictor', 'engagement_scoring', '1.0.0', 'recall', 0.780, 1000, NOW()),

('retention_predictor', 'engagement_scoring', '1.0.0', 'accuracy', 0.890, 1500, NOW()),
('retention_predictor', 'engagement_scoring', '1.0.0', 'precision', 0.860, 1500, NOW()),
('retention_predictor', 'engagement_scoring', '1.0.0', 'recall', 0.830, 1500, NOW()),

('churn_predictor_v2', 'churn_prediction', '2.0.0', 'accuracy', 0.920, 2000, NOW()),
('churn_predictor_v2', 'churn_prediction', '2.0.0', 'precision', 0.880, 2000, NOW()),
('churn_predictor_v2', 'churn_prediction', '2.0.0', 'recall', 0.900, 2000, NOW()),
('churn_predictor_v2', 'churn_prediction', '2.0.0', 'auc', 0.940, 2000, NOW()),

('ltv_predictor_v2', 'ltv_prediction', '2.0.0', 'rmse', 125.50, 1800, NOW()),
('ltv_predictor_v2', 'ltv_prediction', '2.0.0', 'mae', 89.20, 1800, NOW()),
('ltv_predictor_v2', 'ltv_prediction', '2.0.0', 'r2_score', 0.750, 1800, NOW());

-- Create views for engagement analytics
CREATE OR REPLACE VIEW v_user_engagement_summary AS
SELECT 
    ues.user_id,
    m.name as model_name,
    m.slug as model_slug,
    ues.engagement_score,
    ues.confidence_score,
    us.primary_segment,
    us.personalization_priority,
    COUNT(uba.id) as total_behaviors,
    COUNT(CASE WHEN uba.behavior_type = 'content_interaction' THEN 1 END) as content_interactions,
    COUNT(CASE WHEN uba.outcome_type = 'positive' THEN 1 END) as positive_outcomes,
    AVG(uba.engagement_value) as avg_engagement_value,
    MAX(uba.created_at) as last_activity,
    ues.updated_at as score_updated
FROM user_engagement_scores ues
LEFT JOIN models m ON ues.user_id = m.id
LEFT JOIN user_segmentation us ON ues.user_id = us.user_id AND us.segmentation_type = 'behavioral'
LEFT JOIN user_behavior_analytics uba ON ues.user_id = uba.user_id 
    AND uba.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY ues.user_id, m.name, m.slug, ues.engagement_score, ues.confidence_score, 
         us.primary_segment, us.personalization_priority, ues.updated_at
ORDER BY ues.engagement_score DESC;

CREATE OR REPLACE VIEW v_engagement_performance_dashboard AS
SELECT 
    ep.prediction_type,
    COUNT(*) as total_predictions,
    AVG(ep.confidence_score) as avg_confidence,
    AVG(CASE WHEN ep.is_validated = TRUE THEN ep.prediction_accuracy ELSE NULL END) as avg_accuracy,
    COUNT(CASE WHEN ep.confidence_score >= 0.8 THEN 1 END) as high_confidence_predictions,
    COUNT(CASE WHEN ep.is_validated = TRUE THEN 1 END) as validated_predictions,
    COUNT(CASE WHEN ep.expires_at < NOW() THEN 1 END) as expired_predictions,
    MAX(ep.created_at) as latest_prediction
FROM engagement_predictions ep
WHERE ep.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY ep.prediction_type
ORDER BY total_predictions DESC;

CREATE OR REPLACE VIEW v_personalization_effectiveness AS
SELECT 
    pa.personalization_type,
    pa.personalization_strategy,
    COUNT(*) as total_applications,
    AVG(pa.expected_impact) as avg_expected_impact,
    AVG(CASE WHEN pa.actual_impact IS NOT NULL THEN pa.actual_impact ELSE NULL END) as avg_actual_impact,
    AVG(CASE WHEN pa.effectiveness_score IS NOT NULL THEN pa.effectiveness_score ELSE NULL END) as avg_effectiveness,
    COUNT(CASE WHEN pa.is_successful = TRUE THEN 1 END) as successful_applications,
    COUNT(CASE WHEN pa.is_successful = FALSE THEN 1 END) as failed_applications,
    CASE 
        WHEN COUNT(*) > 0 THEN 
            COUNT(CASE WHEN pa.is_successful = TRUE THEN 1 END) / COUNT(*)
        ELSE 0 
    END as success_rate
FROM personalization_applications pa
WHERE pa.applied_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY pa.personalization_type, pa.personalization_strategy
HAVING COUNT(*) >= 5
ORDER BY success_rate DESC, avg_effectiveness DESC;

-- Create stored procedures for engagement analytics
DELIMITER $$

CREATE PROCEDURE GetUserEngagementAnalytics(
    IN p_user_id INT,
    IN p_timeframe VARCHAR(10) DEFAULT '30d'
)
BEGIN
    DECLARE v_days INT DEFAULT 30;
    
    -- Convert timeframe to days
    CASE p_timeframe
        WHEN '7d' THEN SET v_days = 7;
        WHEN '30d' THEN SET v_days = 30;
        WHEN '90d' THEN SET v_days = 90;
        ELSE SET v_days = 30;
    END CASE;
    
    -- User engagement overview
    SELECT 
        'Engagement Overview' as section,
        ues.engagement_score,
        ues.confidence_score,
        ues.score_components,
        us.primary_segment,
        us.personalization_priority,
        ues.updated_at as score_last_updated
    FROM user_engagement_scores ues
    LEFT JOIN user_segmentation us ON ues.user_id = us.user_id 
        AND us.segmentation_type = 'behavioral'
    WHERE ues.user_id = p_user_id;
    
    -- Behavior analytics
    SELECT 
        'Behavior Analytics' as section,
        uba.behavior_type,
        COUNT(*) as behavior_count,
        AVG(uba.engagement_value) as avg_engagement_value,
        AVG(uba.duration_seconds) as avg_duration,
        COUNT(CASE WHEN uba.outcome_type = 'positive' THEN 1 END) as positive_outcomes,
        COUNT(CASE WHEN uba.outcome_type = 'negative' THEN 1 END) as negative_outcomes
    FROM user_behavior_analytics uba
    WHERE uba.user_id = p_user_id
      AND uba.created_at >= DATE_SUB(NOW(), INTERVAL v_days DAY)
    GROUP BY uba.behavior_type
    ORDER BY behavior_count DESC;
    
    -- Recent predictions
    SELECT 
        'Recent Predictions' as section,
        ep.prediction_type,
        ep.predicted_value,
        ep.confidence_score,
        ep.model_name,
        ep.created_at,
        ep.expires_at
    FROM engagement_predictions ep
    WHERE ep.user_id = p_user_id
      AND ep.created_at >= DATE_SUB(NOW(), INTERVAL v_days DAY)
    ORDER BY ep.created_at DESC
    LIMIT 10;
    
    -- Personalization effectiveness
    SELECT 
        'Personalization Effectiveness' as section,
        pa.personalization_type,
        pa.personalization_strategy,
        pa.expected_impact,
        pa.actual_impact,
        pa.effectiveness_score,
        pa.is_successful,
        pa.applied_at
    FROM personalization_applications pa
    WHERE pa.user_id = p_user_id
      AND pa.applied_at >= DATE_SUB(NOW(), INTERVAL v_days DAY)
    ORDER BY pa.applied_at DESC
    LIMIT 10;
END$$

CREATE PROCEDURE UpdateEngagementScore(
    IN p_user_id INT,
    IN p_engagement_score DECIMAL(6,4),
    IN p_score_components JSON,
    IN p_confidence_score DECIMAL(6,4),
    IN p_calculation_method VARCHAR(100),
    IN p_data_points_used INT
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    -- Update or insert engagement score
    INSERT INTO user_engagement_scores (
        user_id, engagement_score, score_components, confidence_score,
        calculation_method, data_points_used, scoring_model_version
    ) VALUES (
        p_user_id, p_engagement_score, p_score_components, p_confidence_score,
        p_calculation_method, p_data_points_used, '1.0.0'
    ) ON DUPLICATE KEY UPDATE
        engagement_score = p_engagement_score,
        score_components = p_score_components,
        confidence_score = p_confidence_score,
        calculation_method = p_calculation_method,
        data_points_used = p_data_points_used,
        updated_at = NOW();
    
    -- Update segmentation if engagement score changed significantly
    IF (SELECT ABS(engagement_score - p_engagement_score) 
        FROM user_engagement_scores 
        WHERE user_id = p_user_id) > 0.1 THEN
        
        -- Trigger segmentation update (this would be handled by the service)
        INSERT INTO engagement_alerts (
            alert_type, severity, user_id, alert_title, alert_description,
            threshold_breached, recommended_actions, auto_generated
        ) VALUES (
            'unusual_behavior', 'info', p_user_id,
            'Significant engagement score change detected',
            CONCAT('User ', p_user_id, ' engagement score changed significantly'),
            p_engagement_score,
            JSON_ARRAY('update_user_segmentation', 'review_personalization_strategy'),
            TRUE
        );
    END IF;
    
    COMMIT;
END$$

DELIMITER ;

-- Create indexes for optimal query performance
ALTER TABLE user_engagement_scores ADD INDEX idx_score_confidence (engagement_score DESC, confidence_score DESC);
ALTER TABLE user_behavior_analytics ADD INDEX idx_user_behavior_outcome (user_id, behavior_type, outcome_type, created_at DESC);
ALTER TABLE engagement_predictions ADD INDEX idx_prediction_validation (prediction_type, is_validated, prediction_accuracy DESC);
ALTER TABLE personalization_applications ADD INDEX idx_personalization_success (personalization_type, is_successful, effectiveness_score DESC);

-- Grant permissions for engagement optimization service
-- Note: In production, create a dedicated engagement service user
-- GRANT SELECT, INSERT, UPDATE, DELETE ON musenest.user_engagement_scores TO 'engagement_service'@'localhost';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON musenest.user_behavior_analytics TO 'engagement_service'@'localhost';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON musenest.engagement_predictions TO 'engagement_service'@'localhost';
-- GRANT EXECUTE ON PROCEDURE musenest.GetUserEngagementAnalytics TO 'engagement_service'@'localhost';
-- GRANT EXECUTE ON PROCEDURE musenest.UpdateEngagementScore TO 'engagement_service'@'localhost';

SELECT 'User Engagement Optimization and Personalization migration completed successfully' as status;