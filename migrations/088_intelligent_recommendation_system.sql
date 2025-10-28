-- Intelligent Content Recommendation System Migration
-- Adds tables and infrastructure for AI-powered content recommendations with collaborative filtering

USE phoenix4ge;

-- User interaction tracking for recommendation algorithms
CREATE TABLE IF NOT EXISTS user_interactions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id VARCHAR(100) NOT NULL,
    item_id BIGINT NOT NULL, -- References gallery_images.id or other content
    interaction_type ENUM('view', 'click', 'like', 'share', 'save', 'download', 'comment', 'rating', 'conversion') NOT NULL,
    interaction_value DECIMAL(4,2), -- For ratings, duration, etc.
    session_id VARCHAR(100),
    page_context VARCHAR(200), -- Where the interaction happened
    interaction_metadata JSON, -- Additional context data
    duration_seconds INT, -- Time spent on item
    scroll_depth DECIMAL(5,2), -- How much of content was viewed
    referrer_source VARCHAR(100),
    device_type ENUM('desktop', 'mobile', 'tablet') DEFAULT 'desktop',
    user_agent TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_user_id (user_id),
    INDEX idx_item_id (item_id),
    INDEX idx_interaction_type (interaction_type),
    INDEX idx_user_item (user_id, item_id),
    INDEX idx_created_at (created_at),
    INDEX idx_session_id (session_id),
    INDEX idx_user_time (user_id, created_at DESC)
);

-- User preference profiles derived from interactions
CREATE TABLE IF NOT EXISTS user_preference_profiles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id VARCHAR(100) NOT NULL UNIQUE,
    category_preferences JSON, -- Category weights and preferences
    tag_preferences JSON, -- Tag-based preferences
    style_preferences JSON, -- Visual style preferences
    temporal_patterns JSON, -- When user is most active
    interaction_patterns JSON, -- How user typically interacts
    similarity_groups JSON, -- Which user groups this user is similar to
    engagement_score DECIMAL(5,2) DEFAULT 0.00,
    diversity_preference DECIMAL(3,2) DEFAULT 0.50, -- 0=focused, 1=diverse
    novelty_preference DECIMAL(3,2) DEFAULT 0.50, -- 0=familiar, 1=novel
    quality_threshold DECIMAL(3,2) DEFAULT 0.60, -- Minimum quality preference
    last_interaction TIMESTAMP,
    profile_confidence DECIMAL(4,3) DEFAULT 0.000,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_user_id (user_id),
    INDEX idx_engagement_score (engagement_score DESC),
    INDEX idx_last_interaction (last_interaction DESC),
    INDEX idx_profile_confidence (profile_confidence DESC)
);

-- Item feature vectors for content-based filtering
CREATE TABLE IF NOT EXISTS item_feature_vectors (
    id INT PRIMARY KEY AUTO_INCREMENT,
    item_id BIGINT NOT NULL UNIQUE,
    item_type ENUM('gallery_image', 'gallery_set', 'model_profile', 'theme', 'other') DEFAULT 'gallery_image',
    category_features JSON, -- Category-based features
    visual_features JSON, -- Color, composition, style features
    text_features JSON, -- Title, description, tag features
    metadata_features JSON, -- Upload date, popularity, etc.
    quality_score DECIMAL(4,3) DEFAULT 0.500,
    popularity_score DECIMAL(4,3) DEFAULT 0.000,
    engagement_score DECIMAL(4,3) DEFAULT 0.000,
    feature_vector_hash VARCHAR(64), -- Hash of feature vector for change detection
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_item_id (item_id),
    INDEX idx_item_type (item_type),
    INDEX idx_quality_score (quality_score DESC),
    INDEX idx_popularity_score (popularity_score DESC),
    INDEX idx_last_updated (last_updated),
    
    FOREIGN KEY (item_id) REFERENCES gallery_images(id) ON DELETE CASCADE
);

-- User-User similarity matrix for collaborative filtering
CREATE TABLE IF NOT EXISTS user_similarity_matrix (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_a_id VARCHAR(100) NOT NULL,
    user_b_id VARCHAR(100) NOT NULL,
    similarity_score DECIMAL(6,4) NOT NULL, -- Cosine similarity, Pearson correlation, etc.
    similarity_method ENUM('cosine', 'pearson', 'jaccard', 'euclidean') DEFAULT 'cosine',
    common_items_count INT DEFAULT 0,
    confidence_score DECIMAL(4,3) DEFAULT 0.000,
    last_calculated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE KEY idx_user_pair (user_a_id, user_b_id),
    INDEX idx_user_a (user_a_id),
    INDEX idx_user_b (user_b_id),
    INDEX idx_similarity_score (similarity_score DESC),
    INDEX idx_confidence_score (confidence_score DESC),
    INDEX idx_last_calculated (last_calculated)
);

-- Item-Item similarity matrix for collaborative filtering
CREATE TABLE IF NOT EXISTS item_similarity_matrix (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    item_a_id BIGINT NOT NULL,
    item_b_id BIGINT NOT NULL,
    similarity_score DECIMAL(6,4) NOT NULL,
    similarity_method ENUM('content_based', 'collaborative', 'hybrid') DEFAULT 'content_based',
    common_users_count INT DEFAULT 0,
    content_similarity DECIMAL(6,4), -- Content-based similarity component
    collaborative_similarity DECIMAL(6,4), -- Collaborative similarity component
    confidence_score DECIMAL(4,3) DEFAULT 0.000,
    last_calculated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE KEY idx_item_pair (item_a_id, item_b_id),
    INDEX idx_item_a (item_a_id),
    INDEX idx_item_b (item_b_id),
    INDEX idx_similarity_score (similarity_score DESC),
    INDEX idx_content_similarity (content_similarity DESC),
    INDEX idx_collaborative_similarity (collaborative_similarity DESC),
    INDEX idx_last_calculated (last_calculated),
    
    FOREIGN KEY (item_a_id) REFERENCES gallery_images(id) ON DELETE CASCADE,
    FOREIGN KEY (item_b_id) REFERENCES gallery_images(id) ON DELETE CASCADE
);

-- Generated recommendations log
CREATE TABLE IF NOT EXISTS generated_recommendations (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    recommendation_id VARCHAR(100) NOT NULL UNIQUE,
    user_id VARCHAR(100) NOT NULL,
    recommendation_type ENUM('homepage_feed', 'gallery_related', 'user_profile_suggested', 'email_digest', 'similar_items', 'trending', 'personalized') NOT NULL,
    algorithm_combination JSON, -- Which algorithms contributed
    items_recommended JSON, -- Array of recommended items with scores
    generation_context JSON, -- Context when recommendation was generated
    diversity_score DECIMAL(4,3), -- How diverse the recommendations are
    novelty_score DECIMAL(4,3), -- How novel/fresh the recommendations are
    confidence_score DECIMAL(4,3), -- Overall confidence in recommendations
    user_segment VARCHAR(50), -- Which user segment was targeted
    generation_latency_ms INT, -- Time taken to generate
    expiry_time TIMESTAMP, -- When these recommendations expire
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_recommendation_id (recommendation_id),
    INDEX idx_user_id (user_id),
    INDEX idx_recommendation_type (recommendation_type),
    INDEX idx_user_segment (user_segment),
    INDEX idx_created_at (created_at),
    INDEX idx_expiry_time (expiry_time),
    INDEX idx_confidence_score (confidence_score DESC)
);

-- Recommendation interaction tracking
CREATE TABLE IF NOT EXISTS recommendation_interactions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id VARCHAR(100) NOT NULL,
    item_id BIGINT NOT NULL,
    recommendation_id VARCHAR(100), -- Links to generated_recommendations
    interaction_type ENUM('impression', 'click', 'view', 'like', 'share', 'save', 'conversion', 'skip', 'dismiss') NOT NULL,
    recommendation_algorithm VARCHAR(100), -- Which algorithm recommended this item
    recommendation_score DECIMAL(4,3), -- Original recommendation score
    recommendation_rank INT, -- Position in recommendation list
    recommendation_context JSON, -- Context of the recommendation
    interaction_value DECIMAL(8,2), -- Monetary value if applicable
    session_id VARCHAR(100),
    page_context VARCHAR(200),
    time_to_interaction_ms BIGINT, -- Time from recommendation to interaction
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_user_id (user_id),
    INDEX idx_item_id (item_id),
    INDEX idx_recommendation_id (recommendation_id),
    INDEX idx_interaction_type (interaction_type),
    INDEX idx_recommendation_algorithm (recommendation_algorithm),
    INDEX idx_user_item (user_id, item_id),
    INDEX idx_created_at (created_at),
    
    FOREIGN KEY (item_id) REFERENCES gallery_images(id) ON DELETE CASCADE
);

-- Recommendation algorithm performance tracking
CREATE TABLE IF NOT EXISTS recommendation_algorithm_performance (
    id INT PRIMARY KEY AUTO_INCREMENT,
    algorithm_name VARCHAR(100) NOT NULL,
    metric_type ENUM('ctr', 'conversion_rate', 'diversity', 'novelty', 'coverage', 'precision', 'recall', 'f1_score') NOT NULL,
    metric_value DECIMAL(8,4) NOT NULL,
    sample_size INT NOT NULL,
    confidence_interval_lower DECIMAL(8,4),
    confidence_interval_upper DECIMAL(8,4),
    user_segment VARCHAR(50), -- Performance per user segment
    recommendation_type VARCHAR(100), -- Performance per recommendation type
    time_period_start TIMESTAMP NOT NULL,
    time_period_end TIMESTAMP NOT NULL,
    baseline_value DECIMAL(8,4), -- Baseline metric for comparison
    statistical_significance DECIMAL(4,3), -- p-value
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_algorithm_name (algorithm_name),
    INDEX idx_metric_type (metric_type),
    INDEX idx_metric_value (metric_value DESC),
    INDEX idx_user_segment (user_segment),
    INDEX idx_time_period (time_period_start, time_period_end),
    INDEX idx_statistical_significance (statistical_significance)
);

-- A/B test experiments for recommendation algorithms
CREATE TABLE IF NOT EXISTS recommendation_ab_tests (
    id INT PRIMARY KEY AUTO_INCREMENT,
    experiment_name VARCHAR(200) NOT NULL UNIQUE,
    experiment_description TEXT,
    status ENUM('draft', 'running', 'paused', 'completed', 'cancelled') DEFAULT 'draft',
    control_algorithm JSON, -- Control algorithm configuration
    treatment_algorithms JSON, -- Array of treatment algorithm configurations
    traffic_allocation JSON, -- How traffic is split between variants
    target_metrics JSON, -- Primary and secondary metrics to track
    success_criteria JSON, -- Criteria for experiment success
    user_segment_filters JSON, -- Which users are included
    recommendation_type_filters JSON, -- Which recommendation types are included
    minimum_sample_size INT DEFAULT 1000,
    minimum_duration_days INT DEFAULT 7,
    maximum_duration_days INT DEFAULT 30,
    statistical_power DECIMAL(3,2) DEFAULT 0.80,
    significance_level DECIMAL(3,2) DEFAULT 0.05,
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_experiment_name (experiment_name),
    INDEX idx_status (status),
    INDEX idx_start_date (start_date),
    INDEX idx_end_date (end_date),
    INDEX idx_created_by (created_by)
);

-- A/B test participant assignments
CREATE TABLE IF NOT EXISTS recommendation_ab_test_assignments (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    experiment_name VARCHAR(200) NOT NULL,
    user_id VARCHAR(100) NOT NULL,
    variant_name VARCHAR(100) NOT NULL, -- control, treatment_a, treatment_b, etc.
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    first_exposure TIMESTAMP NULL,
    last_exposure TIMESTAMP NULL,
    total_exposures INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    
    UNIQUE KEY idx_experiment_user (experiment_name, user_id),
    INDEX idx_experiment_name (experiment_name),
    INDEX idx_user_id (user_id),
    INDEX idx_variant_name (variant_name),
    INDEX idx_assigned_at (assigned_at),
    
    FOREIGN KEY (experiment_name) REFERENCES recommendation_ab_tests(experiment_name) ON DELETE CASCADE
);

-- Machine learning model metadata for recommendations
CREATE TABLE IF NOT EXISTS recommendation_ml_models (
    id INT PRIMARY KEY AUTO_INCREMENT,
    model_name VARCHAR(100) NOT NULL UNIQUE,
    model_type ENUM('collaborative_filtering', 'content_based', 'matrix_factorization', 'deep_learning', 'ensemble') NOT NULL,
    algorithm_details JSON, -- Algorithm parameters and configuration
    feature_importance JSON, -- Feature importance scores
    training_data_size INT,
    validation_data_size INT,
    test_data_size INT,
    model_accuracy DECIMAL(6,4),
    precision_score DECIMAL(6,4),
    recall_score DECIMAL(6,4),
    f1_score DECIMAL(6,4),
    auc_score DECIMAL(6,4),
    training_time_minutes INT,
    model_size_mb DECIMAL(8,2),
    inference_time_ms DECIMAL(8,2),
    model_version VARCHAR(50),
    model_file_path VARCHAR(500),
    hyperparameters JSON,
    cross_validation_scores JSON,
    is_production BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    trained_at TIMESTAMP NULL,
    deployed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_model_name (model_name),
    INDEX idx_model_type (model_type),
    INDEX idx_model_accuracy (model_accuracy DESC),
    INDEX idx_is_production (is_production),
    INDEX idx_is_active (is_active),
    INDEX idx_trained_at (trained_at)
);

-- Content popularity and trending tracking
CREATE TABLE IF NOT EXISTS content_popularity_metrics (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    item_id BIGINT NOT NULL,
    metric_date DATE NOT NULL,
    view_count INT DEFAULT 0,
    unique_viewers INT DEFAULT 0,
    interaction_count INT DEFAULT 0,
    like_count INT DEFAULT 0,
    share_count INT DEFAULT 0,
    conversion_count INT DEFAULT 0,
    average_view_duration DECIMAL(8,2) DEFAULT 0.00,
    bounce_rate DECIMAL(4,3) DEFAULT 0.000,
    quality_score DECIMAL(4,3) DEFAULT 0.500,
    trending_score DECIMAL(8,4) DEFAULT 0.0000,
    velocity_score DECIMAL(8,4) DEFAULT 0.0000, -- Rate of engagement growth
    peak_hour TINYINT, -- Hour of day with peak engagement
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE KEY idx_item_date (item_id, metric_date),
    INDEX idx_item_id (item_id),
    INDEX idx_metric_date (metric_date),
    INDEX idx_trending_score (trending_score DESC),
    INDEX idx_velocity_score (velocity_score DESC),
    INDEX idx_view_count (view_count DESC),
    
    FOREIGN KEY (item_id) REFERENCES gallery_images(id) ON DELETE CASCADE
);

-- Insert sample user preference profiles
INSERT IGNORE INTO user_preference_profiles (user_id, category_preferences, engagement_score, diversity_preference) VALUES
('user_1', JSON_OBJECT('portraits', 0.8, 'nature', 0.6, 'abstract', 0.3), 75.5, 0.7),
('user_2', JSON_OBJECT('fashion', 0.9, 'lifestyle', 0.7, 'beauty', 0.8), 82.3, 0.5),
('user_3', JSON_OBJECT('art', 0.9, 'abstract', 0.8, 'creative', 0.7), 91.2, 0.9);

-- Insert sample item feature vectors
INSERT IGNORE INTO item_feature_vectors (item_id, category_features, quality_score, popularity_score) VALUES
(1, JSON_OBJECT('category', 'portrait', 'style', 'professional', 'mood', 'elegant'), 0.85, 0.72),
(2, JSON_OBJECT('category', 'fashion', 'style', 'casual', 'mood', 'playful'), 0.78, 0.68),
(3, JSON_OBJECT('category', 'art', 'style', 'abstract', 'mood', 'mysterious'), 0.92, 0.45);

-- Insert initial ML models
INSERT IGNORE INTO recommendation_ml_models (model_name, model_type, model_accuracy, precision_score, recall_score, f1_score, is_active) VALUES
('user_collaborative_v1', 'collaborative_filtering', 0.7250, 0.6800, 0.7100, 0.6950, TRUE),
('item_collaborative_v1', 'collaborative_filtering', 0.7480, 0.7200, 0.6900, 0.7050, TRUE),
('content_based_v1', 'content_based', 0.6920, 0.7100, 0.6500, 0.6800, TRUE),
('hybrid_ensemble_v1', 'ensemble', 0.7850, 0.7600, 0.7400, 0.7500, TRUE);

-- Create views for easier recommendation analysis
CREATE OR REPLACE VIEW v_user_engagement_summary AS
SELECT 
    ui.user_id,
    COUNT(*) as total_interactions,
    COUNT(DISTINCT ui.item_id) as unique_items,
    COUNT(DISTINCT ui.interaction_type) as interaction_types,
    AVG(CASE WHEN ui.interaction_value IS NOT NULL THEN ui.interaction_value END) as avg_rating,
    MAX(ui.created_at) as last_interaction,
    DATEDIFF(NOW(), MAX(ui.created_at)) as days_since_last_interaction,
    upp.engagement_score,
    upp.diversity_preference,
    upp.novelty_preference
FROM user_interactions ui
LEFT JOIN user_preference_profiles upp ON ui.user_id = upp.user_id
WHERE ui.created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)
GROUP BY ui.user_id, upp.engagement_score, upp.diversity_preference, upp.novelty_preference;

CREATE OR REPLACE VIEW v_item_performance_summary AS
SELECT 
    ifv.item_id,
    ifv.quality_score,
    ifv.popularity_score,
    ifv.engagement_score,
    COUNT(DISTINCT ui.user_id) as unique_viewers,
    COUNT(ui.id) as total_interactions,
    AVG(CASE WHEN ui.interaction_value IS NOT NULL THEN ui.interaction_value END) as avg_rating,
    COUNT(CASE WHEN ui.interaction_type = 'like' THEN 1 END) as like_count,
    COUNT(CASE WHEN ui.interaction_type = 'share' THEN 1 END) as share_count,
    COUNT(CASE WHEN ui.interaction_type = 'conversion' THEN 1 END) as conversion_count,
    MAX(ui.created_at) as last_interaction
FROM item_feature_vectors ifv
LEFT JOIN user_interactions ui ON ifv.item_id = ui.item_id
    AND ui.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY ifv.item_id, ifv.quality_score, ifv.popularity_score, ifv.engagement_score;

CREATE OR REPLACE VIEW v_recommendation_performance AS
SELECT 
    ri.recommendation_algorithm,
    ri.recommendation_rank,
    COUNT(*) as total_recommendations,
    COUNT(CASE WHEN ri.interaction_type != 'impression' THEN 1 END) as engaged_recommendations,
    COUNT(CASE WHEN ri.interaction_type = 'click' THEN 1 END) as clicked_recommendations,
    COUNT(CASE WHEN ri.interaction_type = 'conversion' THEN 1 END) as converted_recommendations,
    AVG(ri.recommendation_score) as avg_recommendation_score,
    AVG(ri.time_to_interaction_ms) as avg_time_to_interaction_ms,
    (COUNT(CASE WHEN ri.interaction_type != 'impression' THEN 1 END) / COUNT(*)) as engagement_rate,
    (COUNT(CASE WHEN ri.interaction_type = 'click' THEN 1 END) / COUNT(*)) as click_through_rate,
    (COUNT(CASE WHEN ri.interaction_type = 'conversion' THEN 1 END) / COUNT(*)) as conversion_rate
FROM recommendation_interactions ri
WHERE ri.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY ri.recommendation_algorithm, ri.recommendation_rank
ORDER BY engagement_rate DESC, click_through_rate DESC;

CREATE OR REPLACE VIEW v_trending_content AS
SELECT 
    cpm.item_id,
    gi.title,
    gi.category,
    cpm.trending_score,
    cpm.velocity_score,
    cpm.view_count,
    cpm.unique_viewers,
    cpm.interaction_count,
    cpm.average_view_duration,
    ifv.quality_score,
    RANK() OVER (ORDER BY cpm.trending_score DESC) as trending_rank,
    cpm.metric_date
FROM content_popularity_metrics cpm
JOIN gallery_images gi ON cpm.item_id = gi.id
JOIN item_feature_vectors ifv ON cpm.item_id = ifv.item_id
WHERE cpm.metric_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
  AND cpm.trending_score > 0
ORDER BY cpm.trending_score DESC, cpm.velocity_score DESC;

-- Create stored procedures for recommendation operations
DELIMITER $$

CREATE PROCEDURE UpdateUserPreferenceProfile(
    IN p_user_id VARCHAR(100)
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    -- Calculate category preferences
    SET @category_prefs = (
        SELECT JSON_OBJECTAGG(
            COALESCE(gi.category, 'uncategorized'),
            interaction_weight
        )
        FROM (
            SELECT 
                gi.category,
                SUM(
                    CASE ui.interaction_type
                        WHEN 'like' THEN 3.0
                        WHEN 'share' THEN 2.5
                        WHEN 'save' THEN 2.0
                        WHEN 'view' THEN 1.0
                        WHEN 'click' THEN 0.5
                        ELSE 0.1
                    END
                ) / COUNT(*) as interaction_weight
            FROM user_interactions ui
            JOIN gallery_images gi ON ui.item_id = gi.id
            WHERE ui.user_id = p_user_id
              AND ui.created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)
            GROUP BY gi.category
            HAVING COUNT(*) >= 3
        ) category_data
    );
    
    -- Calculate engagement score
    SET @engagement_score = (
        SELECT 
            LEAST(100, (
                (COUNT(*) * 0.3) + 
                (COUNT(DISTINCT item_id) * 0.4) +
                (AVG(COALESCE(interaction_value, 1)) * 20) +
                (COUNT(DISTINCT interaction_type) * 5)
            ))
        FROM user_interactions
        WHERE user_id = p_user_id
          AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    );
    
    -- Update or insert preference profile
    INSERT INTO user_preference_profiles (
        user_id,
        category_preferences,
        engagement_score,
        last_interaction,
        profile_confidence,
        updated_at
    ) VALUES (
        p_user_id,
        COALESCE(@category_prefs, JSON_OBJECT()),
        COALESCE(@engagement_score, 0),
        (SELECT MAX(created_at) FROM user_interactions WHERE user_id = p_user_id),
        LEAST(1.0, COALESCE(@engagement_score, 0) / 100),
        NOW()
    ) ON DUPLICATE KEY UPDATE
        category_preferences = COALESCE(@category_prefs, JSON_OBJECT()),
        engagement_score = COALESCE(@engagement_score, 0),
        last_interaction = (SELECT MAX(created_at) FROM user_interactions WHERE user_id = p_user_id),
        profile_confidence = LEAST(1.0, COALESCE(@engagement_score, 0) / 100),
        updated_at = NOW();
    
    SELECT 
        'Profile Updated' as status,
        p_user_id as user_id,
        @engagement_score as engagement_score,
        @category_prefs as category_preferences;
    
    COMMIT;
END$$

CREATE PROCEDURE CalculateItemPopularity(
    IN p_date DATE
)
BEGIN
    -- Calculate daily popularity metrics for all items
    INSERT INTO content_popularity_metrics (
        item_id,
        metric_date,
        view_count,
        unique_viewers,
        interaction_count,
        like_count,
        share_count,
        average_view_duration,
        trending_score
    )
    SELECT 
        ui.item_id,
        p_date,
        COUNT(CASE WHEN ui.interaction_type = 'view' THEN 1 END) as view_count,
        COUNT(DISTINCT CASE WHEN ui.interaction_type = 'view' THEN ui.user_id END) as unique_viewers,
        COUNT(*) as interaction_count,
        COUNT(CASE WHEN ui.interaction_type = 'like' THEN 1 END) as like_count,
        COUNT(CASE WHEN ui.interaction_type = 'share' THEN 1 END) as share_count,
        AVG(COALESCE(ui.duration_seconds, 30)) as average_view_duration,
        -- Trending score: recent activity weighted more heavily
        (COUNT(*) * 0.4 + 
         COUNT(DISTINCT ui.user_id) * 0.3 + 
         COUNT(CASE WHEN ui.interaction_type IN ('like', 'share') THEN 1 END) * 0.3) as trending_score
    FROM user_interactions ui
    WHERE DATE(ui.created_at) = p_date
    GROUP BY ui.item_id
    ON DUPLICATE KEY UPDATE
        view_count = VALUES(view_count),
        unique_viewers = VALUES(unique_viewers),
        interaction_count = VALUES(interaction_count),
        like_count = VALUES(like_count),
        share_count = VALUES(share_count),
        average_view_duration = VALUES(average_view_duration),
        trending_score = VALUES(trending_score);
        
    SELECT CONCAT('Popularity metrics calculated for ', ROW_COUNT(), ' items on ', p_date) as result;
END$$

CREATE PROCEDURE AnalyzeRecommendationPerformance(
    IN p_algorithm VARCHAR(100),
    IN p_days_back INT DEFAULT 7
)
BEGIN
    -- Comprehensive recommendation performance analysis
    SELECT 
        'Algorithm Performance' as analysis_type,
        ri.recommendation_algorithm,
        COUNT(*) as total_recommendations,
        COUNT(DISTINCT ri.user_id) as unique_users,
        COUNT(DISTINCT ri.item_id) as unique_items,
        AVG(ri.recommendation_score) as avg_score,
        COUNT(CASE WHEN ri.interaction_type != 'impression' THEN 1 END) as engagements,
        COUNT(CASE WHEN ri.interaction_type = 'conversion' THEN 1 END) as conversions,
        (COUNT(CASE WHEN ri.interaction_type != 'impression' THEN 1 END) / COUNT(*)) as engagement_rate,
        (COUNT(CASE WHEN ri.interaction_type = 'conversion' THEN 1 END) / COUNT(*)) as conversion_rate,
        AVG(ri.time_to_interaction_ms) as avg_interaction_time_ms
    FROM recommendation_interactions ri
    WHERE ri.created_at >= DATE_SUB(NOW(), INTERVAL p_days_back DAY)
      AND (p_algorithm IS NULL OR ri.recommendation_algorithm = p_algorithm)
    GROUP BY ri.recommendation_algorithm
    ORDER BY engagement_rate DESC, conversion_rate DESC;
    
    -- Performance by recommendation rank (position)
    SELECT 
        'Performance by Rank' as analysis_type,
        ri.recommendation_rank,
        COUNT(*) as total_recommendations,
        (COUNT(CASE WHEN ri.interaction_type != 'impression' THEN 1 END) / COUNT(*)) as engagement_rate,
        (COUNT(CASE WHEN ri.interaction_type = 'click' THEN 1 END) / COUNT(*)) as click_rate,
        AVG(ri.time_to_interaction_ms) as avg_interaction_time_ms
    FROM recommendation_interactions ri
    WHERE ri.created_at >= DATE_SUB(NOW(), INTERVAL p_days_back DAY)
      AND (p_algorithm IS NULL OR ri.recommendation_algorithm = p_algorithm)
      AND ri.recommendation_rank IS NOT NULL
    GROUP BY ri.recommendation_rank
    ORDER BY ri.recommendation_rank;
END$$

DELIMITER ;

-- Create indexes for optimal query performance
ALTER TABLE user_interactions ADD INDEX idx_user_interaction_time_type (user_id, interaction_type, created_at DESC);
ALTER TABLE recommendation_interactions ADD INDEX idx_user_algorithm_time (user_id, recommendation_algorithm, created_at DESC);
ALTER TABLE item_feature_vectors ADD INDEX idx_quality_popularity (quality_score DESC, popularity_score DESC);
ALTER TABLE user_similarity_matrix ADD INDEX idx_similarity_confidence (similarity_score DESC, confidence_score DESC);

-- Grant permissions for intelligent recommendation service
-- Note: In production, create a dedicated recommendation service user
-- GRANT SELECT, INSERT, UPDATE, DELETE ON phoenix4ge.user_interactions TO 'recommendation_service'@'localhost';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON phoenix4ge.user_preference_profiles TO 'recommendation_service'@'localhost';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON phoenix4ge.item_feature_vectors TO 'recommendation_service'@'localhost';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON phoenix4ge.generated_recommendations TO 'recommendation_service'@'localhost';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON phoenix4ge.recommendation_interactions TO 'recommendation_service'@'localhost';
-- GRANT EXECUTE ON PROCEDURE phoenix4ge.UpdateUserPreferenceProfile TO 'recommendation_service'@'localhost';
-- GRANT EXECUTE ON PROCEDURE phoenix4ge.CalculateItemPopularity TO 'recommendation_service'@'localhost';

SELECT 'Intelligent Content Recommendation System migration completed successfully' as status;