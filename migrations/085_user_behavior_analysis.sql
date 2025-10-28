-- User Behavior Analysis System Migration
-- Adds tables and infrastructure for user behavior tracking and predictive loading

USE phoenix4ge;

-- User behavior events tracking
CREATE TABLE IF NOT EXISTS user_behavior_events (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id VARCHAR(100), -- Can be null for anonymous users
    session_id VARCHAR(100) NOT NULL,
    event_type ENUM('page_view', 'interaction', 'scroll', 'click', 'form_submit', 'search', 'filter', 'exit') NOT NULL,
    page_url VARCHAR(500) NOT NULL,
    page_type ENUM('home', 'gallery', 'model', 'theme', 'contact', 'rates', 'about', 'etiquette', 'other') NOT NULL,
    referrer_url VARCHAR(500),
    user_agent TEXT,
    device_type ENUM('desktop', 'mobile', 'tablet') NOT NULL,
    screen_resolution VARCHAR(20),
    connection_speed ENUM('slow', 'fast', 'unknown') DEFAULT 'unknown',
    event_metadata JSON,
    coordinates JSON, -- For click/touch events
    scroll_depth DECIMAL(5,2), -- Percentage of page scrolled
    time_on_page INT DEFAULT 0, -- Seconds spent on page
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_session_id (session_id),
    INDEX idx_user_id (user_id),
    INDEX idx_event_type (event_type),
    INDEX idx_page_type (page_type),
    INDEX idx_device_type (device_type),
    INDEX idx_created_at (created_at),
    INDEX idx_user_session_time (user_id, session_id, created_at)
);

-- User sessions aggregated data
CREATE TABLE IF NOT EXISTS user_sessions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    session_id VARCHAR(100) NOT NULL UNIQUE,
    user_id VARCHAR(100),
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NULL,
    duration_seconds INT DEFAULT 0,
    page_views INT DEFAULT 0,
    unique_pages INT DEFAULT 0,
    interaction_count INT DEFAULT 0,
    bounce_rate DECIMAL(3,2) DEFAULT 0.00,
    entry_page VARCHAR(500),
    exit_page VARCHAR(500),
    referrer_type ENUM('direct', 'search', 'social', 'referral', 'email', 'ads') DEFAULT 'direct',
    device_type ENUM('desktop', 'mobile', 'tablet') NOT NULL,
    user_agent TEXT,
    ip_address VARCHAR(45),
    country_code CHAR(2),
    city VARCHAR(100),
    conversion_events JSON,
    session_quality_score DECIMAL(4,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_session_id (session_id),
    INDEX idx_user_id (user_id),
    INDEX idx_device_type (device_type),
    INDEX idx_start_time (start_time),
    INDEX idx_duration (duration_seconds),
    INDEX idx_quality_score (session_quality_score)
);

-- User behavior patterns and predictions
CREATE TABLE IF NOT EXISTS user_behavior_patterns (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id VARCHAR(100),
    pattern_type ENUM('navigation', 'content_preference', 'temporal', 'device_specific') NOT NULL,
    pattern_data JSON NOT NULL,
    confidence_score DECIMAL(4,3) DEFAULT 0.000,
    sample_size INT DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE KEY idx_user_pattern (user_id, pattern_type),
    INDEX idx_pattern_type (pattern_type),
    INDEX idx_confidence_score (confidence_score),
    INDEX idx_last_updated (last_updated)
);

-- Page transition patterns (aggregated)
CREATE TABLE IF NOT EXISTS page_transition_patterns (
    id INT PRIMARY KEY AUTO_INCREMENT,
    from_page_type ENUM('home', 'gallery', 'model', 'theme', 'contact', 'rates', 'about', 'etiquette', 'other') NOT NULL,
    to_page_type ENUM('home', 'gallery', 'model', 'theme', 'contact', 'rates', 'about', 'etiquette', 'other') NOT NULL,
    transition_count BIGINT DEFAULT 0,
    avg_transition_time DECIMAL(8,2) DEFAULT 0.00,
    conversion_rate DECIMAL(5,4) DEFAULT 0.0000,
    device_type ENUM('desktop', 'mobile', 'tablet', 'all') DEFAULT 'all',
    user_segment ENUM('new_visitor', 'returning_visitor', 'engaged_user', 'power_user', 'all') DEFAULT 'all',
    confidence_score DECIMAL(4,3) DEFAULT 0.000,
    last_calculated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY idx_transition (from_page_type, to_page_type, device_type, user_segment),
    INDEX idx_from_page (from_page_type),
    INDEX idx_to_page (to_page_type),
    INDEX idx_transition_count (transition_count DESC),
    INDEX idx_confidence (confidence_score DESC)
);

-- Predictive loading configurations and results
CREATE TABLE IF NOT EXISTS predictive_loading_configs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    strategy_name VARCHAR(100) NOT NULL UNIQUE,
    strategy_type ENUM('aggressive', 'moderate', 'conservative') NOT NULL,
    confidence_threshold DECIMAL(4,3) DEFAULT 0.750,
    prefetch_depth TINYINT DEFAULT 2,
    max_prefetch_size BIGINT DEFAULT 5242880, -- 5MB in bytes
    max_concurrent_prefetch TINYINT DEFAULT 3,
    resource_limits JSON,
    target_segments JSON, -- Which user segments this applies to
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_strategy_name (strategy_name),
    INDEX idx_strategy_type (strategy_type),
    INDEX idx_is_active (is_active)
);

-- Prefetch execution logs
CREATE TABLE IF NOT EXISTS prefetch_executions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    session_id VARCHAR(100) NOT NULL,
    user_id VARCHAR(100),
    prefetch_type ENUM('page', 'content', 'api_data') NOT NULL,
    resource_url VARCHAR(500) NOT NULL,
    predicted_confidence DECIMAL(4,3),
    strategy_used VARCHAR(100),
    execution_time_ms INT DEFAULT 0,
    data_size_bytes BIGINT DEFAULT 0,
    cache_hit BOOLEAN DEFAULT FALSE,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    user_accessed BOOLEAN DEFAULT FALSE,
    access_time_after_prefetch INT, -- Seconds between prefetch and actual access
    bandwidth_saved BIGINT DEFAULT 0,
    user_experience_impact ENUM('positive', 'neutral', 'negative') DEFAULT 'neutral',
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_session_id (session_id),
    INDEX idx_user_id (user_id),
    INDEX idx_prefetch_type (prefetch_type),
    INDEX idx_success (success),
    INDEX idx_user_accessed (user_accessed),
    INDEX idx_executed_at (executed_at),
    INDEX idx_confidence_success (predicted_confidence, success)
);

-- User personalization profiles
CREATE TABLE IF NOT EXISTS user_personalization_profiles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id VARCHAR(100) NOT NULL UNIQUE,
    user_segment ENUM('new_visitor', 'returning_visitor', 'engaged_user', 'power_user') NOT NULL,
    preferred_content_types JSON,
    preferred_themes JSON,
    preferred_galleries JSON,
    interaction_patterns JSON,
    temporal_preferences JSON, -- Preferred times of day/week
    device_preferences JSON,
    engagement_score DECIMAL(5,2) DEFAULT 0.00,
    personalization_confidence DECIMAL(4,3) DEFAULT 0.000,
    last_model_update TIMESTAMP NULL,
    profile_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_user_id (user_id),
    INDEX idx_user_segment (user_segment),
    INDEX idx_engagement_score (engagement_score DESC),
    INDEX idx_personalization_confidence (personalization_confidence DESC)
);

-- ML model performance tracking for behavior prediction
CREATE TABLE IF NOT EXISTS behavior_prediction_models (
    id INT PRIMARY KEY AUTO_INCREMENT,
    model_name VARCHAR(100) NOT NULL UNIQUE,
    model_type ENUM('next_page_prediction', 'content_preference', 'session_duration', 'conversion_likelihood') NOT NULL,
    algorithm_type ENUM('sequence_prediction', 'collaborative_filtering', 'regression', 'classification') NOT NULL,
    feature_vector JSON NOT NULL,
    model_accuracy DECIMAL(4,3) DEFAULT 0.000,
    precision_score DECIMAL(4,3),
    recall_score DECIMAL(4,3),
    f1_score DECIMAL(4,3),
    training_samples INT DEFAULT 0,
    validation_samples INT DEFAULT 0,
    last_trained TIMESTAMP NULL,
    model_version VARCHAR(50),
    hyperparameters JSON,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_model_name (model_name),
    INDEX idx_model_type (model_type),
    INDEX idx_model_accuracy (model_accuracy DESC),
    INDEX idx_is_active (is_active),
    INDEX idx_last_trained (last_trained)
);

-- Behavior prediction results
CREATE TABLE IF NOT EXISTS behavior_predictions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    session_id VARCHAR(100) NOT NULL,
    user_id VARCHAR(100),
    model_name VARCHAR(100) NOT NULL,
    prediction_type ENUM('next_page', 'content_preference', 'session_duration', 'conversion_likelihood') NOT NULL,
    input_features JSON NOT NULL,
    prediction_result JSON NOT NULL,
    confidence_score DECIMAL(4,3),
    actual_outcome JSON, -- Filled in when the prediction can be validated
    prediction_accuracy DECIMAL(4,3), -- Calculated when outcome is known
    was_used_for_prefetch BOOLEAN DEFAULT FALSE,
    prefetch_success BOOLEAN,
    user_benefit_score DECIMAL(3,2), -- How much this helped the user experience
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    validated_at TIMESTAMP NULL,
    
    INDEX idx_session_id (session_id),
    INDEX idx_user_id (user_id),
    INDEX idx_model_name (model_name),
    INDEX idx_prediction_type (prediction_type),
    INDEX idx_confidence_score (confidence_score DESC),
    INDEX idx_was_used_for_prefetch (was_used_for_prefetch),
    INDEX idx_created_at (created_at),
    
    FOREIGN KEY (model_name) REFERENCES behavior_prediction_models(model_name) ON DELETE CASCADE
);

-- Real-time user activity tracking (for active sessions)
CREATE TABLE IF NOT EXISTS real_time_user_activity (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    session_id VARCHAR(100) NOT NULL,
    user_id VARCHAR(100),
    current_page VARCHAR(500),
    time_on_current_page INT DEFAULT 0,
    scroll_progress DECIMAL(5,2) DEFAULT 0.00,
    interaction_count_current_page INT DEFAULT 0,
    predicted_next_pages JSON,
    prefetch_queue JSON,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    session_start TIMESTAMP NOT NULL,
    
    UNIQUE KEY idx_session_id (session_id),
    INDEX idx_user_id (user_id),
    INDEX idx_last_activity (last_activity),
    INDEX idx_session_start (session_start)
);

-- Insert default predictive loading configurations
INSERT IGNORE INTO predictive_loading_configs (strategy_name, strategy_type, confidence_threshold, prefetch_depth, max_concurrent_prefetch) VALUES
('aggressive_prefetch', 'aggressive', 0.600, 3, 4),
('moderate_prefetch', 'moderate', 0.750, 2, 3),
('conservative_prefetch', 'conservative', 0.850, 1, 2);

-- Insert initial behavior prediction models
INSERT IGNORE INTO behavior_prediction_models (model_name, model_type, algorithm_type, feature_vector, model_accuracy) VALUES
('next_page_predictor', 'next_page_prediction', 'sequence_prediction', 
 JSON_ARRAY('current_page', 'session_duration', 'previous_pages', 'user_type', 'time_of_day'), 0.750),
('content_preference_model', 'content_preference', 'collaborative_filtering',
 JSON_ARRAY('user_interactions', 'content_type', 'engagement_time', 'device_type'), 0.680),
('session_duration_predictor', 'session_duration', 'regression',
 JSON_ARRAY('entry_point', 'user_type', 'previous_sessions', 'content_quality'), 0.720),
('conversion_predictor', 'conversion_likelihood', 'classification',
 JSON_ARRAY('page_views', 'time_spent', 'interaction_count', 'referrer_type'), 0.810);

-- Insert sample page transition patterns (based on common user flows)
INSERT IGNORE INTO page_transition_patterns (from_page_type, to_page_type, transition_count, avg_transition_time, conversion_rate, confidence_score) VALUES
('home', 'gallery', 1500, 45.50, 0.7500, 0.950),
('home', 'about', 800, 35.25, 0.4200, 0.850),
('gallery', 'model', 2200, 55.75, 0.8200, 0.980),
('model', 'contact', 1800, 42.30, 0.6500, 0.920),
('model', 'rates', 1400, 38.15, 0.5800, 0.880),
('gallery', 'contact', 900, 48.90, 0.7200, 0.780),
('about', 'gallery', 600, 52.40, 0.6800, 0.750),
('rates', 'contact', 1200, 35.60, 0.8500, 0.890);

-- Create views for easier behavior analysis
CREATE OR REPLACE VIEW v_user_behavior_summary AS
SELECT 
    us.user_id,
    us.session_id,
    us.device_type,
    us.duration_seconds,
    us.page_views,
    us.interaction_count,
    us.session_quality_score,
    COUNT(DISTINCT ube.page_type) as unique_page_types,
    AVG(ube.time_on_page) as avg_time_per_page,
    MAX(ube.scroll_depth) as max_scroll_depth,
    GROUP_CONCAT(DISTINCT ube.page_type ORDER BY ube.created_at) as page_journey
FROM user_sessions us
LEFT JOIN user_behavior_events ube ON us.session_id = ube.session_id
WHERE us.start_time >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY us.user_id, us.session_id, us.device_type, us.duration_seconds, us.page_views, us.interaction_count, us.session_quality_score;

CREATE OR REPLACE VIEW v_prefetch_effectiveness AS
SELECT 
    pe.strategy_used,
    pe.prefetch_type,
    COUNT(*) as total_prefetches,
    COUNT(CASE WHEN pe.success = TRUE THEN 1 END) as successful_prefetches,
    COUNT(CASE WHEN pe.user_accessed = TRUE THEN 1 END) as accessed_prefetches,
    AVG(pe.predicted_confidence) as avg_confidence,
    AVG(CASE WHEN pe.user_accessed = TRUE THEN pe.access_time_after_prefetch END) as avg_access_time,
    SUM(pe.bandwidth_saved) / 1024 / 1024 as total_bandwidth_saved_mb,
    AVG(pe.data_size_bytes) / 1024 as avg_prefetch_size_kb
FROM prefetch_executions pe
WHERE pe.executed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY pe.strategy_used, pe.prefetch_type;

CREATE OR REPLACE VIEW v_user_engagement_metrics AS
SELECT 
    upp.user_id,
    upp.user_segment,
    upp.engagement_score,
    AVG(us.duration_seconds) as avg_session_duration,
    AVG(us.page_views) as avg_page_views_per_session,
    COUNT(DISTINCT us.session_id) as total_sessions,
    MAX(us.start_time) as last_session,
    AVG(us.session_quality_score) as avg_session_quality
FROM user_personalization_profiles upp
LEFT JOIN user_sessions us ON upp.user_id = us.user_id
    AND us.start_time >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY upp.user_id, upp.user_segment, upp.engagement_score;

CREATE OR REPLACE VIEW v_prediction_accuracy_tracking AS
SELECT 
    bp.model_name,
    bp.prediction_type,
    COUNT(*) as total_predictions,
    COUNT(CASE WHEN bp.actual_outcome IS NOT NULL THEN 1 END) as validated_predictions,
    AVG(bp.confidence_score) as avg_confidence,
    AVG(CASE WHEN bp.actual_outcome IS NOT NULL THEN bp.prediction_accuracy END) as avg_accuracy,
    COUNT(CASE WHEN bp.was_used_for_prefetch = TRUE THEN 1 END) as used_for_prefetch,
    AVG(CASE WHEN bp.was_used_for_prefetch = TRUE THEN bp.user_benefit_score END) as avg_user_benefit
FROM behavior_predictions bp
WHERE bp.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY bp.model_name, bp.prediction_type;

-- Create stored procedures for behavior analysis
DELIMITER $$

CREATE PROCEDURE AnalyzeUserBehaviorPatterns(
    IN p_user_id VARCHAR(100),
    IN p_days_back INT DEFAULT 30
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    -- Get navigation patterns
    SELECT 
        'navigation_patterns' as analysis_type,
        from_page_type,
        to_page_type,
        COUNT(*) as frequency,
        AVG(time_on_page) as avg_time_on_page
    FROM user_behavior_events ube1
    JOIN user_behavior_events ube2 ON ube1.session_id = ube2.session_id
        AND ube2.created_at > ube1.created_at
        AND NOT EXISTS (
            SELECT 1 FROM user_behavior_events ube3 
            WHERE ube3.session_id = ube1.session_id 
              AND ube3.created_at > ube1.created_at 
              AND ube3.created_at < ube2.created_at
        )
    WHERE (p_user_id IS NULL OR ube1.user_id = p_user_id)
      AND ube1.created_at >= DATE_SUB(NOW(), INTERVAL p_days_back DAY)
    GROUP BY from_page_type, to_page_type
    HAVING frequency >= 3
    ORDER BY frequency DESC;
    
    -- Get content preferences
    SELECT 
        'content_preferences' as analysis_type,
        page_type,
        COUNT(*) as visit_count,
        AVG(time_on_page) as avg_time_spent,
        AVG(scroll_depth) as avg_scroll_depth,
        SUM(CASE WHEN JSON_EXTRACT(event_metadata, '$.interaction_type') IS NOT NULL THEN 1 ELSE 0 END) as interaction_count
    FROM user_behavior_events
    WHERE (p_user_id IS NULL OR user_id = p_user_id)
      AND created_at >= DATE_SUB(NOW(), INTERVAL p_days_back DAY)
      AND event_type = 'page_view'
    GROUP BY page_type
    ORDER BY visit_count DESC, avg_time_spent DESC;
    
    COMMIT;
END$$

CREATE PROCEDURE UpdateUserPersonalizationProfile(
    IN p_user_id VARCHAR(100)
)
BEGIN
    DECLARE v_engagement_score DECIMAL(5,2) DEFAULT 0.00;
    DECLARE v_user_segment VARCHAR(20);
    DECLARE v_session_count INT DEFAULT 0;
    DECLARE v_avg_duration DECIMAL(8,2) DEFAULT 0.00;
    
    -- Calculate engagement metrics
    SELECT 
        COUNT(DISTINCT session_id),
        AVG(duration_seconds),
        AVG(session_quality_score) * 20 -- Convert to 0-100 scale
    INTO v_session_count, v_avg_duration, v_engagement_score
    FROM user_sessions
    WHERE user_id = p_user_id
      AND start_time >= DATE_SUB(NOW(), INTERVAL 30 DAY);
    
    -- Determine user segment
    IF v_session_count >= 20 THEN
        SET v_user_segment = 'power_user';
    ELSEIF v_session_count >= 6 THEN
        SET v_user_segment = 'engaged_user';
    ELSEIF v_session_count >= 2 THEN
        SET v_user_segment = 'returning_visitor';
    ELSE
        SET v_user_segment = 'new_visitor';
    END IF;
    
    -- Update or insert profile
    INSERT INTO user_personalization_profiles (
        user_id, user_segment, engagement_score, personalization_confidence
    ) VALUES (
        p_user_id, v_user_segment, v_engagement_score, LEAST(1.000, v_session_count / 10.0)
    ) ON DUPLICATE KEY UPDATE
        user_segment = v_user_segment,
        engagement_score = v_engagement_score,
        personalization_confidence = LEAST(1.000, v_session_count / 10.0),
        last_updated = NOW();
        
    SELECT 
        user_id,
        user_segment,
        engagement_score,
        personalization_confidence,
        'Profile updated successfully' as status
    FROM user_personalization_profiles
    WHERE user_id = p_user_id;
END$$

CREATE PROCEDURE CalculatePrefetchEffectiveness()
BEGIN
    -- Calculate overall prefetch statistics
    SELECT 
        'Overall Effectiveness' as metric_type,
        COUNT(*) as total_prefetches,
        AVG(predicted_confidence) as avg_confidence,
        COUNT(CASE WHEN success = TRUE THEN 1 END) / COUNT(*) as success_rate,
        COUNT(CASE WHEN user_accessed = TRUE THEN 1 END) / COUNT(*) as access_rate,
        AVG(CASE WHEN user_accessed = TRUE THEN access_time_after_prefetch END) as avg_access_time_seconds,
        SUM(bandwidth_saved) / 1024 / 1024 as total_bandwidth_saved_mb
    FROM prefetch_executions
    WHERE executed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY);
    
    -- Effectiveness by strategy
    SELECT 
        CONCAT('Strategy: ', strategy_used) as metric_type,
        COUNT(*) as total_prefetches,
        AVG(predicted_confidence) as avg_confidence,
        COUNT(CASE WHEN success = TRUE THEN 1 END) / COUNT(*) as success_rate,
        COUNT(CASE WHEN user_accessed = TRUE THEN 1 END) / COUNT(*) as access_rate
    FROM prefetch_executions
    WHERE executed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      AND strategy_used IS NOT NULL
    GROUP BY strategy_used;
END$$

DELIMITER ;

-- Create indexes for optimal query performance
ALTER TABLE user_behavior_events ADD INDEX idx_user_session_page (user_id, session_id, page_type);
ALTER TABLE user_sessions ADD INDEX idx_user_device_quality (user_id, device_type, session_quality_score DESC);
ALTER TABLE prefetch_executions ADD INDEX idx_session_confidence_success (session_id, predicted_confidence DESC, success);
ALTER TABLE behavior_predictions ADD INDEX idx_model_confidence_accuracy (model_name, confidence_score DESC, prediction_accuracy DESC);

-- Grant permissions for user behavior analysis service
-- Note: In production, create a dedicated user behavior service user
-- GRANT SELECT, INSERT, UPDATE, DELETE ON phoenix4ge.user_behavior_* TO 'behavior_analyzer'@'localhost';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON phoenix4ge.user_sessions TO 'behavior_analyzer'@'localhost';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON phoenix4ge.user_personalization_profiles TO 'behavior_analyzer'@'localhost';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON phoenix4ge.prefetch_executions TO 'behavior_analyzer'@'localhost';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON phoenix4ge.behavior_prediction* TO 'behavior_analyzer'@'localhost';
-- GRANT EXECUTE ON PROCEDURE phoenix4ge.AnalyzeUserBehaviorPatterns TO 'behavior_analyzer'@'localhost';
-- GRANT EXECUTE ON PROCEDURE phoenix4ge.UpdateUserPersonalizationProfile TO 'behavior_analyzer'@'localhost';
-- GRANT EXECUTE ON PROCEDURE phoenix4ge.CalculatePrefetchEffectiveness TO 'behavior_analyzer'@'localhost';

SELECT 'User Behavior Analysis System migration completed successfully' as status;