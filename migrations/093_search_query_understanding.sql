-- Search Query Understanding and NLP Migration
-- Adds comprehensive tables for natural language processing, semantic search,
-- query understanding, and intelligent search analytics

USE phoenix4ge;

-- Search query processing and understanding results
CREATE TABLE IF NOT EXISTS search_query_understanding (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NULL,
    session_id VARCHAR(100),
    original_query TEXT NOT NULL,
    processed_query TEXT,
    language_detected VARCHAR(10),
    language_confidence DECIMAL(6,4),
    
    -- Intent classification results
    primary_intent VARCHAR(100) NOT NULL,
    intent_confidence DECIMAL(6,4) NOT NULL,
    secondary_intents JSON, -- Array of {intent, probability}
    intent_signals JSON, -- Signals used for classification
    
    -- Named entity recognition
    extracted_entities JSON, -- Array of entities found
    entity_types JSON, -- Types of entities (PERSON, CATEGORY, etc.)
    entity_confidence_scores JSON,
    
    -- Sentiment and tone analysis
    query_sentiment ENUM('positive', 'negative', 'neutral', 'mixed') DEFAULT 'neutral',
    sentiment_score DECIMAL(6,4),
    query_tone JSON, -- Additional tone analysis
    
    -- Query processing metadata
    complexity_level ENUM('simple', 'moderate', 'complex') NOT NULL,
    processing_time_ms INT,
    models_used JSON, -- Which NLP models were used
    confidence_scores JSON, -- Overall confidence metrics
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_user_id (user_id),
    INDEX idx_session_id (session_id),
    INDEX idx_primary_intent (primary_intent),
    INDEX idx_intent_confidence (intent_confidence DESC),
    INDEX idx_language_detected (language_detected),
    INDEX idx_complexity_level (complexity_level),
    INDEX idx_created_at (created_at DESC),
    INDEX idx_user_intent_time (user_id, primary_intent, created_at DESC),
    
    FULLTEXT KEY ft_original_query (original_query),
    FULLTEXT KEY ft_processed_query (processed_query)
);

-- Semantic embeddings and vector representations
CREATE TABLE IF NOT EXISTS search_semantic_embeddings (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    content_type ENUM('query', 'content', 'model_profile', 'category', 'tag') NOT NULL,
    content_id VARCHAR(200) NOT NULL, -- ID of the content (query hash, content ID, etc.)
    content_text TEXT NOT NULL,
    
    -- Embedding vectors and metadata
    embedding_model VARCHAR(100) NOT NULL,
    embedding_dimensions INT NOT NULL,
    embedding_vector JSON NOT NULL, -- The actual vector
    embedding_norm DECIMAL(10,6), -- L2 norm for optimization
    
    -- Semantic clustering and similarity
    semantic_cluster_id INT NULL,
    similarity_hash VARCHAR(64), -- Hash for approximate similarity matching
    
    -- Quality and validation metrics
    embedding_quality_score DECIMAL(6,4),
    is_validated BOOLEAN DEFAULT FALSE,
    validation_method VARCHAR(100),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_content_type (content_type),
    INDEX idx_content_id (content_id),
    INDEX idx_embedding_model (embedding_model),
    INDEX idx_semantic_cluster_id (semantic_cluster_id),
    INDEX idx_similarity_hash (similarity_hash),
    INDEX idx_embedding_quality_score (embedding_quality_score DESC),
    INDEX idx_is_validated (is_validated),
    INDEX idx_created_at (created_at DESC),
    
    UNIQUE KEY unique_content_embedding (content_type, content_id, embedding_model),
    FULLTEXT KEY ft_content_text (content_text)
);

-- Search query expansion and synonyms
CREATE TABLE IF NOT EXISTS search_query_expansions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    original_query_hash VARCHAR(64) NOT NULL,
    original_query TEXT NOT NULL,
    
    -- Expansion types and methods
    expansion_type ENUM('synonym', 'semantic', 'contextual', 'personalized', 'trending') NOT NULL,
    expansion_method VARCHAR(100) NOT NULL,
    expanded_terms JSON NOT NULL, -- Array of expanded terms with scores
    
    -- Expansion quality and performance
    expansion_confidence DECIMAL(6,4) NOT NULL,
    usage_frequency INT DEFAULT 0,
    success_rate DECIMAL(6,4) DEFAULT 0,
    improvement_score DECIMAL(6,4), -- How much this expansion improves results
    
    -- Context and personalization
    user_segment VARCHAR(100), -- Which user segment this expansion works for
    context_factors JSON, -- What context factors influenced expansion
    language_code VARCHAR(10),
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_used TIMESTAMP NULL,
    
    INDEX idx_original_query_hash (original_query_hash),
    INDEX idx_expansion_type (expansion_type),
    INDEX idx_expansion_confidence (expansion_confidence DESC),
    INDEX idx_usage_frequency (usage_frequency DESC),
    INDEX idx_success_rate (success_rate DESC),
    INDEX idx_user_segment (user_segment),
    INDEX idx_language_code (language_code),
    INDEX idx_is_active (is_active),
    INDEX idx_last_used (last_used DESC),
    
    FULLTEXT KEY ft_original_query (original_query)
);

-- Search result interactions and feedback
CREATE TABLE IF NOT EXISTS search_result_interactions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    query_understanding_id BIGINT NOT NULL,
    user_id INT NULL,
    session_id VARCHAR(100),
    
    -- Search execution details
    search_results_count INT NOT NULL,
    search_strategy VARCHAR(100) NOT NULL,
    ranking_algorithm VARCHAR(100) NOT NULL,
    processing_time_ms INT,
    
    -- User interaction tracking
    results_clicked JSON, -- Array of clicked result IDs and positions
    click_through_rate DECIMAL(6,4),
    dwell_time_seconds INT, -- Time spent on search results page
    bounce_rate DECIMAL(6,4), -- Did user leave without clicking
    refinement_queries JSON, -- Follow-up queries in same session
    
    -- Satisfaction and success metrics
    user_satisfaction_score DECIMAL(6,4), -- Explicit or implicit satisfaction
    search_success BOOLEAN, -- Did user find what they were looking for
    conversion_achieved BOOLEAN DEFAULT FALSE, -- Did search lead to conversion
    
    -- Result quality assessment
    result_relevance_scores JSON, -- Relevance scores for returned results
    result_diversity_score DECIMAL(6,4),
    personalization_effectiveness DECIMAL(6,4),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_query_understanding_id (query_understanding_id),
    INDEX idx_user_id (user_id),
    INDEX idx_session_id (session_id),
    INDEX idx_click_through_rate (click_through_rate DESC),
    INDEX idx_user_satisfaction_score (user_satisfaction_score DESC),
    INDEX idx_search_success (search_success),
    INDEX idx_conversion_achieved (conversion_achieved),
    INDEX idx_created_at (created_at DESC),
    INDEX idx_user_search_performance (user_id, search_success, user_satisfaction_score DESC),
    
    FOREIGN KEY (query_understanding_id) REFERENCES search_query_understanding(id) ON DELETE CASCADE
);

-- Search auto-complete and suggestions
CREATE TABLE IF NOT EXISTS search_autocomplete_suggestions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    suggestion_text VARCHAR(500) NOT NULL,
    suggestion_type ENUM('popular', 'semantic', 'personalized', 'trending', 'contextual') NOT NULL,
    
    -- Suggestion quality metrics
    suggestion_score DECIMAL(8,4) NOT NULL, -- Relevance/quality score
    popularity_score DECIMAL(6,4), -- How popular this suggestion is
    recency_score DECIMAL(6,4), -- How recent/trending this suggestion is
    personalization_score DECIMAL(6,4), -- How personalized this is
    
    -- Usage and performance tracking
    usage_count INT DEFAULT 0,
    acceptance_rate DECIMAL(6,4) DEFAULT 0, -- How often users select this
    conversion_rate DECIMAL(6,4) DEFAULT 0, -- How often it leads to success
    
    -- Targeting and context
    target_user_segments JSON, -- Which user segments this suggestion is for
    context_keywords JSON, -- Keywords that trigger this suggestion
    language_code VARCHAR(10),
    
    -- Expected search results
    estimated_result_count INT,
    result_quality_estimate DECIMAL(6,4),
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_suggested TIMESTAMP NULL,
    
    INDEX idx_suggestion_text (suggestion_text),
    INDEX idx_suggestion_type (suggestion_type),
    INDEX idx_suggestion_score (suggestion_score DESC),
    INDEX idx_popularity_score (popularity_score DESC),
    INDEX idx_acceptance_rate (acceptance_rate DESC),
    INDEX idx_language_code (language_code),
    INDEX idx_is_active (is_active),
    INDEX idx_last_suggested (last_suggested DESC),
    
    FULLTEXT KEY ft_suggestion_text (suggestion_text)
);

-- Search vocabulary and domain-specific terms
CREATE TABLE IF NOT EXISTS search_vocabulary (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    term VARCHAR(200) NOT NULL,
    term_type ENUM('keyword', 'synonym', 'category', 'entity', 'concept', 'domain_specific') NOT NULL,
    
    -- Term relationships and mappings
    canonical_term VARCHAR(200), -- The preferred/canonical form
    synonyms JSON, -- Array of synonyms
    related_terms JSON, -- Semantically related terms
    category_mapping JSON, -- Which categories this term belongs to
    
    -- Term statistics and importance
    term_frequency INT DEFAULT 0, -- How often this term appears in queries
    document_frequency INT DEFAULT 0, -- How many documents contain this term
    idf_score DECIMAL(10,6), -- Inverse document frequency
    term_importance_score DECIMAL(6,4),
    
    -- Language and localization
    language_code VARCHAR(10) DEFAULT 'en',
    language_specific_variants JSON,
    
    -- Quality and validation
    is_validated BOOLEAN DEFAULT FALSE,
    validation_source VARCHAR(100), -- How this term was validated
    quality_score DECIMAL(6,4),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_term (term),
    INDEX idx_term_type (term_type),
    INDEX idx_canonical_term (canonical_term),
    INDEX idx_term_frequency (term_frequency DESC),
    INDEX idx_term_importance_score (term_importance_score DESC),
    INDEX idx_language_code (language_code),
    INDEX idx_is_validated (is_validated),
    INDEX idx_quality_score (quality_score DESC),
    
    UNIQUE KEY unique_term_language (term, term_type, language_code),
    FULLTEXT KEY ft_term (term)
);

-- Search pattern analysis and trends
CREATE TABLE IF NOT EXISTS search_pattern_analysis (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    analysis_period_start TIMESTAMP NOT NULL,
    analysis_period_end TIMESTAMP NOT NULL,
    
    -- Pattern identification
    pattern_type ENUM('trending_queries', 'seasonal_patterns', 'user_behavior', 'intent_shifts', 'performance_trends') NOT NULL,
    pattern_description TEXT,
    pattern_data JSON NOT NULL, -- Detailed pattern data
    
    -- Pattern strength and confidence
    pattern_strength DECIMAL(6,4) NOT NULL, -- How strong/significant this pattern is
    confidence_level DECIMAL(6,4) NOT NULL, -- Statistical confidence
    sample_size INT, -- How many data points support this pattern
    
    -- Pattern insights and implications
    business_implications JSON, -- What this pattern means for the business
    recommended_actions JSON, -- Suggested actions based on this pattern
    impact_assessment JSON, -- Expected impact of acting on this pattern
    
    -- Pattern tracking
    is_active_pattern BOOLEAN DEFAULT TRUE,
    pattern_lifecycle ENUM('emerging', 'active', 'declining', 'dormant') DEFAULT 'emerging',
    last_validated TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_analysis_period (analysis_period_start, analysis_period_end),
    INDEX idx_pattern_type (pattern_type),
    INDEX idx_pattern_strength (pattern_strength DESC),
    INDEX idx_confidence_level (confidence_level DESC),
    INDEX idx_is_active_pattern (is_active_pattern),
    INDEX idx_pattern_lifecycle (pattern_lifecycle),
    INDEX idx_created_at (created_at DESC)
);

-- NLP model performance tracking
CREATE TABLE IF NOT EXISTS nlp_model_performance (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    model_name VARCHAR(100) NOT NULL,
    model_type ENUM('intent_classifier', 'entity_recognizer', 'sentiment_analyzer', 'semantic_embedder', 'translation_model') NOT NULL,
    model_version VARCHAR(50) NOT NULL,
    
    -- Performance metrics
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(10,6) NOT NULL,
    metric_type ENUM('accuracy', 'precision', 'recall', 'f1_score', 'auc', 'latency', 'throughput') NOT NULL,
    
    -- Evaluation details
    evaluation_dataset_size INT,
    evaluation_method VARCHAR(100),
    cross_validation_folds INT,
    test_set_performance DECIMAL(6,4),
    
    -- Feature analysis
    feature_importance JSON, -- Importance of different features
    confusion_matrix JSON, -- For classification models
    error_analysis JSON, -- Analysis of model errors
    
    -- Model configuration
    hyperparameters JSON, -- Model hyperparameters used
    training_details JSON, -- Training process details
    
    evaluated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    evaluation_duration_ms INT,
    
    INDEX idx_model_name (model_name),
    INDEX idx_model_type (model_type),
    INDEX idx_metric_name (metric_name),
    INDEX idx_metric_value (metric_value DESC),
    INDEX idx_metric_type (metric_type),
    INDEX idx_evaluated_at (evaluated_at DESC),
    INDEX idx_model_performance (model_name, model_type, metric_name, evaluated_at DESC)
);

-- Search alerts and monitoring
CREATE TABLE IF NOT EXISTS search_alerts (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    alert_type ENUM('performance_degradation', 'accuracy_drop', 'unusual_query_pattern', 'high_error_rate', 'low_satisfaction', 'model_drift') NOT NULL,
    severity ENUM('info', 'warning', 'critical', 'emergency') NOT NULL,
    
    alert_title VARCHAR(200) NOT NULL,
    alert_description TEXT NOT NULL,
    alert_data JSON, -- Additional context and data
    
    -- Threshold information
    threshold_breached DECIMAL(10,4), -- Value that triggered the alert
    threshold_value DECIMAL(10,4), -- The threshold that was set
    measurement_period VARCHAR(50), -- Time period for the measurement
    
    -- Alert context
    affected_models JSON, -- Which models are affected
    affected_queries INT, -- Number of queries affected
    affected_users INT, -- Number of users affected
    
    -- Recommended actions
    recommended_actions JSON, -- Suggested remediation actions
    urgency_score DECIMAL(6,4), -- How urgent this alert is (0-1)
    
    -- Alert lifecycle
    is_acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by VARCHAR(100),
    acknowledged_at TIMESTAMP NULL,
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_by VARCHAR(100),
    resolved_at TIMESTAMP NULL,
    resolution_notes TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_alert_type (alert_type),
    INDEX idx_severity (severity),
    INDEX idx_urgency_score (urgency_score DESC),
    INDEX idx_is_acknowledged (is_acknowledged),
    INDEX idx_is_resolved (is_resolved),
    INDEX idx_created_at (created_at DESC),
    INDEX idx_alert_status (alert_type, severity, is_resolved, created_at DESC)
);

-- Insert default NLP model configurations
INSERT IGNORE INTO nlp_model_performance (
    model_name, model_type, model_version, metric_name, 
    metric_value, metric_type, evaluation_dataset_size, evaluated_at
) VALUES
-- Intent Classification Model
('intent_classifier_v1', 'intent_classifier', '1.0.0', 'accuracy', 0.890, 'accuracy', 5000, NOW()),
('intent_classifier_v1', 'intent_classifier', '1.0.0', 'precision', 0.875, 'precision', 5000, NOW()),
('intent_classifier_v1', 'intent_classifier', '1.0.0', 'recall', 0.850, 'recall', 5000, NOW()),
('intent_classifier_v1', 'intent_classifier', '1.0.0', 'f1_score', 0.862, 'f1_score', 5000, NOW()),

-- Named Entity Recognition Model  
('ner_model_v1', 'entity_recognizer', '1.0.0', 'accuracy', 0.920, 'accuracy', 3000, NOW()),
('ner_model_v1', 'entity_recognizer', '1.0.0', 'precision', 0.900, 'precision', 3000, NOW()),
('ner_model_v1', 'entity_recognizer', '1.0.0', 'recall', 0.885, 'recall', 3000, NOW()),
('ner_model_v1', 'entity_recognizer', '1.0.0', 'f1_score', 0.892, 'f1_score', 3000, NOW()),

-- Sentiment Analysis Model
('sentiment_bert_v1', 'sentiment_analyzer', '1.0.0', 'accuracy', 0.875, 'accuracy', 4000, NOW()),
('sentiment_bert_v1', 'sentiment_analyzer', '1.0.0', 'precision', 0.860, 'precision', 4000, NOW()),
('sentiment_bert_v1', 'sentiment_analyzer', '1.0.0', 'recall', 0.845, 'recall', 4000, NOW()),

-- Semantic Embedding Model
('sentence_transformer_v2', 'semantic_embedder', '2.0.0', 'accuracy', 0.940, 'accuracy', 10000, NOW()),
('sentence_transformer_v2', 'semantic_embedder', '2.0.0', 'latency', 45.50, 'latency', 10000, NOW()),
('sentence_transformer_v2', 'semantic_embedder', '2.0.0', 'throughput', 1200.0, 'throughput', 10000, NOW());

-- Insert common search vocabulary terms
INSERT IGNORE INTO search_vocabulary (
    term, term_type, canonical_term, term_frequency, term_importance_score, language_code
) VALUES
-- Content categories
('model', 'category', 'model', 1000, 0.95, 'en'),
('profile', 'category', 'profile', 800, 0.90, 'en'),
('gallery', 'category', 'gallery', 900, 0.92, 'en'),
('photo', 'category', 'photo', 750, 0.88, 'en'),
('image', 'synonym', 'photo', 650, 0.85, 'en'),
('picture', 'synonym', 'photo', 600, 0.82, 'en'),

-- Search intent keywords
('find', 'keyword', 'find', 500, 0.80, 'en'),
('search', 'keyword', 'search', 480, 0.78, 'en'),
('show', 'keyword', 'show', 450, 0.75, 'en'),
('browse', 'keyword', 'browse', 400, 0.72, 'en'),
('discover', 'keyword', 'discover', 350, 0.70, 'en'),

-- Domain-specific terms
('premium', 'domain_specific', 'premium', 300, 0.85, 'en'),
('exclusive', 'domain_specific', 'exclusive', 280, 0.83, 'en'),
('featured', 'domain_specific', 'featured', 250, 0.80, 'en'),
('popular', 'domain_specific', 'popular', 320, 0.78, 'en'),
('trending', 'domain_specific', 'trending', 290, 0.82, 'en');

-- Create views for search analytics
CREATE OR REPLACE VIEW v_search_performance_summary AS
SELECT 
    DATE(squ.created_at) as search_date,
    squ.primary_intent,
    COUNT(*) as query_count,
    AVG(squ.intent_confidence) as avg_intent_confidence,
    AVG(squ.processing_time_ms) as avg_processing_time,
    COUNT(CASE WHEN sri.search_success = TRUE THEN 1 END) as successful_searches,
    COUNT(CASE WHEN sri.conversion_achieved = TRUE THEN 1 END) as conversion_searches,
    AVG(CASE WHEN sri.user_satisfaction_score IS NOT NULL THEN sri.user_satisfaction_score END) as avg_satisfaction,
    AVG(CASE WHEN sri.click_through_rate IS NOT NULL THEN sri.click_through_rate END) as avg_ctr
FROM search_query_understanding squ
LEFT JOIN search_result_interactions sri ON squ.id = sri.query_understanding_id
WHERE squ.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY DATE(squ.created_at), squ.primary_intent
ORDER BY search_date DESC, query_count DESC;

CREATE OR REPLACE VIEW v_popular_search_queries AS
SELECT 
    squ.processed_query,
    squ.primary_intent,
    COUNT(*) as query_frequency,
    AVG(squ.intent_confidence) as avg_confidence,
    AVG(CASE WHEN sri.user_satisfaction_score IS NOT NULL THEN sri.user_satisfaction_score END) as avg_satisfaction,
    COUNT(CASE WHEN sri.search_success = TRUE THEN 1 END) as success_count,
    CASE 
        WHEN COUNT(*) > 0 THEN 
            COUNT(CASE WHEN sri.search_success = TRUE THEN 1 END) / COUNT(*)
        ELSE 0 
    END as success_rate,
    MAX(squ.created_at) as last_searched
FROM search_query_understanding squ
LEFT JOIN search_result_interactions sri ON squ.id = sri.query_understanding_id
WHERE squ.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY squ.processed_query, squ.primary_intent
HAVING COUNT(*) >= 3
ORDER BY query_frequency DESC, avg_satisfaction DESC
LIMIT 100;

CREATE OR REPLACE VIEW v_nlp_model_health AS
SELECT 
    nmp.model_name,
    nmp.model_type,
    AVG(CASE WHEN nmp.metric_type = 'accuracy' THEN nmp.metric_value END) as accuracy,
    AVG(CASE WHEN nmp.metric_type = 'precision' THEN nmp.metric_value END) as precision,
    AVG(CASE WHEN nmp.metric_type = 'recall' THEN nmp.metric_value END) as recall,
    AVG(CASE WHEN nmp.metric_type = 'f1_score' THEN nmp.metric_value END) as f1_score,
    AVG(CASE WHEN nmp.metric_type = 'latency' THEN nmp.metric_value END) as avg_latency,
    MAX(nmp.evaluated_at) as last_evaluated,
    COUNT(DISTINCT nmp.metric_name) as metrics_tracked
FROM nlp_model_performance nmp
WHERE nmp.evaluated_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY nmp.model_name, nmp.model_type
ORDER BY accuracy DESC, f1_score DESC;

-- Create stored procedures for search analytics
DELIMITER $$

CREATE PROCEDURE GetSearchAnalytics(
    IN p_timeframe VARCHAR(10) DEFAULT '24h',
    IN p_user_id INT DEFAULT NULL
)
BEGIN
    DECLARE v_days INT DEFAULT 1;
    
    -- Convert timeframe to days
    CASE p_timeframe
        WHEN '7d' THEN SET v_days = 7;
        WHEN '30d' THEN SET v_days = 30;
        WHEN '90d' THEN SET v_days = 90;
        ELSE SET v_days = 1;
    END CASE;
    
    -- Query volume and intent distribution
    SELECT 
        'Query Volume by Intent' as section,
        squ.primary_intent,
        COUNT(*) as query_count,
        AVG(squ.intent_confidence) as avg_confidence,
        COUNT(DISTINCT squ.user_id) as unique_users,
        AVG(squ.processing_time_ms) as avg_processing_time
    FROM search_query_understanding squ
    WHERE squ.created_at >= DATE_SUB(NOW(), INTERVAL v_days DAY)
      AND (p_user_id IS NULL OR squ.user_id = p_user_id)
    GROUP BY squ.primary_intent
    ORDER BY query_count DESC;
    
    -- Search performance metrics
    SELECT 
        'Search Performance' as section,
        COUNT(squ.id) as total_queries,
        COUNT(CASE WHEN sri.search_success = TRUE THEN 1 END) as successful_searches,
        AVG(CASE WHEN sri.user_satisfaction_score IS NOT NULL THEN sri.user_satisfaction_score END) as avg_satisfaction,
        AVG(CASE WHEN sri.click_through_rate IS NOT NULL THEN sri.click_through_rate END) as avg_ctr,
        COUNT(CASE WHEN sri.conversion_achieved = TRUE THEN 1 END) as conversions,
        AVG(sri.dwell_time_seconds) as avg_dwell_time
    FROM search_query_understanding squ
    LEFT JOIN search_result_interactions sri ON squ.id = sri.query_understanding_id
    WHERE squ.created_at >= DATE_SUB(NOW(), INTERVAL v_days DAY)
      AND (p_user_id IS NULL OR squ.user_id = p_user_id);
    
    -- Language distribution
    SELECT 
        'Language Distribution' as section,
        squ.language_detected,
        COUNT(*) as query_count,
        AVG(squ.language_confidence) as avg_confidence
    FROM search_query_understanding squ
    WHERE squ.created_at >= DATE_SUB(NOW(), INTERVAL v_days DAY)
      AND (p_user_id IS NULL OR squ.user_id = p_user_id)
      AND squ.language_detected IS NOT NULL
    GROUP BY squ.language_detected
    ORDER BY query_count DESC;
    
    -- Top performing queries
    SELECT 
        'Top Performing Queries' as section,
        squ.processed_query,
        COUNT(*) as frequency,
        AVG(CASE WHEN sri.user_satisfaction_score IS NOT NULL THEN sri.user_satisfaction_score END) as avg_satisfaction,
        COUNT(CASE WHEN sri.search_success = TRUE THEN 1 END) as success_count
    FROM search_query_understanding squ
    LEFT JOIN search_result_interactions sri ON squ.id = sri.query_understanding_id
    WHERE squ.created_at >= DATE_SUB(NOW(), INTERVAL v_days DAY)
      AND (p_user_id IS NULL OR squ.user_id = p_user_id)
    GROUP BY squ.processed_query
    HAVING COUNT(*) >= 2
    ORDER BY avg_satisfaction DESC, success_count DESC
    LIMIT 20;
END$$

CREATE PROCEDURE AnalyzeSearchTrends(
    IN p_analysis_period_days INT DEFAULT 30
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    -- Analyze trending search intents
    INSERT INTO search_pattern_analysis (
        analysis_period_start, analysis_period_end, pattern_type, pattern_description,
        pattern_data, pattern_strength, confidence_level, sample_size
    )
    SELECT 
        DATE_SUB(NOW(), INTERVAL p_analysis_period_days DAY),
        NOW(),
        'trending_queries',
        CONCAT('Trending search intent: ', primary_intent),
        JSON_OBJECT(
            'intent', primary_intent,
            'query_count', COUNT(*),
            'growth_rate', (COUNT(*) - LAG(COUNT(*), 1) OVER (ORDER BY DATE(created_at))) / LAG(COUNT(*), 1) OVER (ORDER BY DATE(created_at)),
            'top_queries', JSON_ARRAYAGG(processed_query)
        ),
        (COUNT(*) / (SELECT COUNT(*) FROM search_query_understanding WHERE created_at >= DATE_SUB(NOW(), INTERVAL p_analysis_period_days DAY))) * 4.0,
        0.85,
        COUNT(*)
    FROM search_query_understanding
    WHERE created_at >= DATE_SUB(NOW(), INTERVAL p_analysis_period_days DAY)
    GROUP BY primary_intent
    HAVING COUNT(*) >= 10;
    
    -- Analyze user behavior patterns
    INSERT INTO search_pattern_analysis (
        analysis_period_start, analysis_period_end, pattern_type, pattern_description,
        pattern_data, pattern_strength, confidence_level, sample_size
    )
    SELECT 
        DATE_SUB(NOW(), INTERVAL p_analysis_period_days DAY),
        NOW(),
        'user_behavior',
        'Search success rate patterns',
        JSON_OBJECT(
            'overall_success_rate', AVG(CASE WHEN search_success = TRUE THEN 1.0 ELSE 0.0 END),
            'avg_satisfaction', AVG(user_satisfaction_score),
            'conversion_rate', AVG(CASE WHEN conversion_achieved = TRUE THEN 1.0 ELSE 0.0 END),
            'avg_click_through_rate', AVG(click_through_rate)
        ),
        AVG(CASE WHEN search_success = TRUE THEN 1.0 ELSE 0.0 END),
        0.90,
        COUNT(*)
    FROM search_result_interactions
    WHERE created_at >= DATE_SUB(NOW(), INTERVAL p_analysis_period_days DAY);
    
    COMMIT;
END$$

DELIMITER ;

-- Create indexes for optimal query performance
ALTER TABLE search_query_understanding ADD INDEX idx_intent_language_time (primary_intent, language_detected, created_at DESC);
ALTER TABLE search_semantic_embeddings ADD INDEX idx_content_model_quality (content_type, embedding_model, embedding_quality_score DESC);
ALTER TABLE search_result_interactions ADD INDEX idx_success_satisfaction (search_success, user_satisfaction_score DESC, created_at DESC);
ALTER TABLE search_autocomplete_suggestions ADD INDEX idx_type_score_active (suggestion_type, suggestion_score DESC, is_active);

-- Grant permissions for search query understanding service
-- Note: In production, create a dedicated search service user
-- GRANT SELECT, INSERT, UPDATE, DELETE ON phoenix4ge.search_query_understanding TO 'search_service'@'localhost';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON phoenix4ge.search_semantic_embeddings TO 'search_service'@'localhost';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON phoenix4ge.search_result_interactions TO 'search_service'@'localhost';
-- GRANT EXECUTE ON PROCEDURE phoenix4ge.GetSearchAnalytics TO 'search_service'@'localhost';
-- GRANT EXECUTE ON PROCEDURE phoenix4ge.AnalyzeSearchTrends TO 'search_service'@'localhost';

SELECT 'Search Query Understanding and NLP migration completed successfully' as status;