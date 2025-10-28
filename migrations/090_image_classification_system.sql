-- AI-Powered Image Classification and Auto-Tagging System Migration
-- Adds tables and infrastructure for automated image analysis, classification, and intelligent tagging

USE phoenix4ge;

-- Image classification results and analysis
CREATE TABLE IF NOT EXISTS image_classification_results (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    image_id BIGINT NOT NULL,
    image_hash VARCHAR(64), -- SHA-256 hash of image content
    classifications JSON NOT NULL, -- Multi-model classification results
    generated_tags JSON NOT NULL, -- Array of automatically generated tags
    visual_features JSON, -- Extracted visual features (color, texture, shape, etc.)
    feature_vector JSON, -- Deep learning feature vector for similarity
    safety_analysis JSON NOT NULL, -- NSFW and content safety analysis
    quality_metrics JSON, -- Image quality and aesthetic scores
    processing_metadata JSON, -- Processing details, models used, timing
    confidence_score DECIMAL(4,3) DEFAULT 0.000,
    overall_category VARCHAR(100), -- Primary category from ensemble classification
    safety_score DECIMAL(4,3) DEFAULT 0.000, -- Overall safety score (0=unsafe, 1=safe)
    aesthetic_score DECIMAL(4,3) DEFAULT 0.000, -- Overall aesthetic/quality score
    user_modified BOOLEAN DEFAULT FALSE, -- Whether tags have been manually modified
    processing_version VARCHAR(20) DEFAULT '1.0.0',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY idx_image_id (image_id),
    INDEX idx_image_hash (image_hash),
    INDEX idx_overall_category (overall_category),
    INDEX idx_safety_score (safety_score),
    INDEX idx_aesthetic_score (aesthetic_score DESC),
    INDEX idx_confidence_score (confidence_score DESC),
    INDEX idx_user_modified (user_modified),
    INDEX idx_created_at (created_at),
    
    FOREIGN KEY (image_id) REFERENCES gallery_images(id) ON DELETE CASCADE
);

-- Individual classification predictions from different models
CREATE TABLE IF NOT EXISTS image_classification_predictions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    image_id BIGINT NOT NULL,
    model_name VARCHAR(100) NOT NULL,
    model_version VARCHAR(50),
    prediction_class VARCHAR(100) NOT NULL,
    confidence_score DECIMAL(6,4) NOT NULL,
    prediction_rank INT, -- Rank of this prediction among all predictions from this model
    raw_prediction_data JSON, -- Raw model output data
    feature_vector JSON, -- Model-specific feature vector
    processing_time_ms INT,
    predicted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_image_model (image_id, model_name),
    INDEX idx_model_class (model_name, prediction_class),
    INDEX idx_confidence_score (confidence_score DESC),
    INDEX idx_prediction_rank (prediction_rank),
    INDEX idx_predicted_at (predicted_at),
    
    FOREIGN KEY (image_id) REFERENCES gallery_images(id) ON DELETE CASCADE
);

-- Image tagging and tag management
CREATE TABLE IF NOT EXISTS image_tags (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    image_id BIGINT NOT NULL,
    tag_name VARCHAR(100) NOT NULL,
    tag_category ENUM('content', 'style', 'color', 'mood', 'technical', 'metadata', 'user_defined') NOT NULL,
    confidence_score DECIMAL(4,3),
    tag_source ENUM('classification', 'object_detection', 'text_extraction', 'metadata', 'user_input', 'ai_generated') NOT NULL,
    source_model VARCHAR(100), -- Which model/process generated this tag
    is_verified BOOLEAN DEFAULT FALSE, -- Whether tag has been verified by human
    verification_count INT DEFAULT 0, -- Number of users who verified this tag
    rejection_count INT DEFAULT 0, -- Number of users who rejected this tag
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY idx_image_tag (image_id, tag_name),
    INDEX idx_image_id (image_id),
    INDEX idx_tag_name (tag_name),
    INDEX idx_tag_category (tag_category),
    INDEX idx_confidence_score (confidence_score DESC),
    INDEX idx_tag_source (tag_source),
    INDEX idx_is_verified (is_verified),
    INDEX idx_source_model (source_model),
    
    FOREIGN KEY (image_id) REFERENCES gallery_images(id) ON DELETE CASCADE
);

-- Tag vocabulary and hierarchy management
CREATE TABLE IF NOT EXISTS tag_vocabulary (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tag_name VARCHAR(100) NOT NULL UNIQUE,
    tag_category ENUM('content', 'style', 'color', 'mood', 'technical', 'metadata') NOT NULL,
    parent_tag_id INT, -- For hierarchical tag relationships
    tag_description TEXT,
    synonyms JSON, -- Array of synonymous tags
    usage_count INT DEFAULT 0,
    confidence_threshold DECIMAL(4,3) DEFAULT 0.500, -- Minimum confidence to auto-apply this tag
    is_active BOOLEAN DEFAULT TRUE,
    is_blacklisted BOOLEAN DEFAULT FALSE,
    quality_score DECIMAL(4,3) DEFAULT 0.500, -- Quality/usefulness score of this tag
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_tag_name (tag_name),
    INDEX idx_tag_category (tag_category),
    INDEX idx_parent_tag_id (parent_tag_id),
    INDEX idx_usage_count (usage_count DESC),
    INDEX idx_is_active (is_active),
    INDEX idx_quality_score (quality_score DESC),
    
    FOREIGN KEY (parent_tag_id) REFERENCES tag_vocabulary(id) ON DELETE SET NULL
);

-- User feedback on image tags and classifications
CREATE TABLE IF NOT EXISTS image_tag_feedback (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    image_id BIGINT NOT NULL,
    user_id VARCHAR(100) NOT NULL,
    feedback_type ENUM('tag_addition', 'tag_removal', 'tag_correction', 'classification_correction', 'manual_tagging') NOT NULL,
    original_tags JSON, -- Tags before feedback
    user_tags JSON, -- Tags after user modification
    feedback_data JSON, -- Additional feedback context
    confidence_rating INT, -- User's confidence in their feedback (1-5)
    feedback_reason VARCHAR(200),
    is_expert_feedback BOOLEAN DEFAULT FALSE, -- Whether user is tagged as domain expert
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_image_id (image_id),
    INDEX idx_user_id (user_id),
    INDEX idx_feedback_type (feedback_type),
    INDEX idx_is_expert_feedback (is_expert_feedback),
    INDEX idx_created_at (created_at),
    
    FOREIGN KEY (image_id) REFERENCES gallery_images(id) ON DELETE CASCADE
);

-- Machine learning models for image classification
CREATE TABLE IF NOT EXISTS image_classification_models (
    id INT PRIMARY KEY AUTO_INCREMENT,
    model_name VARCHAR(100) NOT NULL UNIQUE,
    model_type ENUM('content_classifier', 'safety_classifier', 'aesthetic_classifier', 'domain_classifier', 'object_detector') NOT NULL,
    model_version VARCHAR(50) NOT NULL,
    model_architecture VARCHAR(100), -- ResNet, MobileNet, etc.
    training_dataset VARCHAR(200),
    model_accuracy DECIMAL(6,4),
    precision_score DECIMAL(6,4),
    recall_score DECIMAL(6,4),
    f1_score DECIMAL(6,4),
    model_size_mb DECIMAL(8,2),
    inference_time_ms DECIMAL(8,2),
    supported_classes JSON NOT NULL, -- Array of classes this model can predict
    confidence_calibration JSON, -- Calibration parameters for confidence scores
    is_production BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    model_file_path VARCHAR(500),
    preprocessing_config JSON,
    postprocessing_config JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_model_name (model_name),
    INDEX idx_model_type (model_type),
    INDEX idx_model_accuracy (model_accuracy DESC),
    INDEX idx_is_production (is_production),
    INDEX idx_is_active (is_active)
);

-- Visual similarity relationships between images
CREATE TABLE IF NOT EXISTS image_visual_similarity (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    image_a_id BIGINT NOT NULL,
    image_b_id BIGINT NOT NULL,
    similarity_score DECIMAL(6,4) NOT NULL, -- Cosine similarity or other metric
    similarity_method ENUM('deep_features', 'color_histogram', 'texture', 'combined') NOT NULL,
    feature_distance DECIMAL(12,6), -- Euclidean distance in feature space
    visual_hash_similarity DECIMAL(4,3), -- Perceptual hash similarity
    last_calculated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE KEY idx_image_pair (image_a_id, image_b_id),
    INDEX idx_image_a (image_a_id),
    INDEX idx_image_b (image_b_id),
    INDEX idx_similarity_score (similarity_score DESC),
    INDEX idx_similarity_method (similarity_method),
    INDEX idx_last_calculated (last_calculated),
    
    FOREIGN KEY (image_a_id) REFERENCES gallery_images(id) ON DELETE CASCADE,
    FOREIGN KEY (image_b_id) REFERENCES gallery_images(id) ON DELETE CASCADE
);

-- Image clustering and grouping results
CREATE TABLE IF NOT EXISTS image_clusters (
    id INT PRIMARY KEY AUTO_INCREMENT,
    cluster_id VARCHAR(100) NOT NULL,
    clustering_method ENUM('kmeans', 'hierarchical', 'dbscan', 'spectral') NOT NULL,
    cluster_center JSON, -- Centroid coordinates in feature space
    cluster_size INT NOT NULL,
    intra_cluster_distance DECIMAL(8,4), -- Average distance within cluster
    cluster_quality_score DECIMAL(4,3), -- Silhouette score or similar metric
    dominant_features JSON, -- Most prominent visual features in this cluster
    representative_tags JSON, -- Most common tags in this cluster
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY idx_cluster_id (cluster_id),
    INDEX idx_clustering_method (clustering_method),
    INDEX idx_cluster_size (cluster_size DESC),
    INDEX idx_quality_score (cluster_quality_score DESC),
    INDEX idx_created_at (created_at)
);

-- Individual image assignments to clusters
CREATE TABLE IF NOT EXISTS image_cluster_assignments (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    image_id BIGINT NOT NULL,
    cluster_id VARCHAR(100) NOT NULL,
    assignment_confidence DECIMAL(4,3) NOT NULL,
    distance_to_center DECIMAL(8,4), -- Distance from cluster centroid
    is_cluster_representative BOOLEAN DEFAULT FALSE, -- Whether this image represents the cluster
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE KEY idx_image_cluster (image_id, cluster_id),
    INDEX idx_image_id (image_id),
    INDEX idx_cluster_id (cluster_id),
    INDEX idx_assignment_confidence (assignment_confidence DESC),
    INDEX idx_is_representative (is_cluster_representative),
    
    FOREIGN KEY (image_id) REFERENCES gallery_images(id) ON DELETE CASCADE,
    FOREIGN KEY (cluster_id) REFERENCES image_clusters(cluster_id) ON DELETE CASCADE
);

-- Processing queue for batch image analysis
CREATE TABLE IF NOT EXISTS image_processing_queue (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    image_id BIGINT NOT NULL,
    processing_type ENUM('classification', 'tagging', 'similarity', 'clustering', 'reprocessing') NOT NULL,
    priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
    status ENUM('pending', 'processing', 'completed', 'failed', 'cancelled') DEFAULT 'pending',
    processing_options JSON, -- Configuration for processing
    assigned_worker VARCHAR(100), -- Which worker/process is handling this
    attempts INT DEFAULT 0,
    max_attempts INT DEFAULT 3,
    error_message TEXT,
    processing_metadata JSON,
    queued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    
    UNIQUE KEY idx_image_processing_type (image_id, processing_type),
    INDEX idx_image_id (image_id),
    INDEX idx_processing_type (processing_type),
    INDEX idx_priority_status (priority, status),
    INDEX idx_status (status),
    INDEX idx_queued_at (queued_at),
    INDEX idx_assigned_worker (assigned_worker),
    
    FOREIGN KEY (image_id) REFERENCES gallery_images(id) ON DELETE CASCADE
);

-- Performance tracking for classification models
CREATE TABLE IF NOT EXISTS model_performance_metrics (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    model_name VARCHAR(100) NOT NULL,
    metric_type ENUM('accuracy', 'precision', recall', 'f1_score', 'inference_time', 'memory_usage') NOT NULL,
    metric_value DECIMAL(12,6) NOT NULL,
    sample_size INT,
    test_dataset VARCHAR(200),
    measurement_context JSON, -- Additional context about the measurement
    measured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_model_name (model_name),
    INDEX idx_metric_type (metric_type),
    INDEX idx_metric_value (metric_value DESC),
    INDEX idx_measured_at (measured_at),
    
    FOREIGN KEY (model_name) REFERENCES image_classification_models(model_name) ON DELETE CASCADE
);

-- Insert sample classification models
INSERT IGNORE INTO image_classification_models (
    model_name, model_type, model_version, model_architecture, 
    supported_classes, model_accuracy, is_production, is_active
) VALUES
('resnet152_imagenet', 'content_classifier', '1.0.0', 'ResNet-152',
 JSON_ARRAY('person', 'vehicle', 'animal', 'object', 'scene', 'activity'), 0.8450, TRUE, TRUE),

('nsfw_mobilenet_v2', 'safety_classifier', '2.1.0', 'MobileNet-V2',
 JSON_ARRAY('safe', 'questionable', 'unsafe', 'explicit'), 0.9200, TRUE, TRUE),

('aesthetic_mobilenet', 'aesthetic_classifier', '1.5.0', 'MobileNet-V1',
 JSON_ARRAY('portrait', 'landscape', 'abstract', 'fashion', 'artistic'), 0.7800, TRUE, TRUE),

('custom_gallery_classifier', 'domain_classifier', '3.0.0', 'EfficientNet-B4',
 JSON_ARRAY('model_photo', 'lifestyle', 'professional', 'artistic', 'casual'), 0.8650, TRUE, TRUE);

-- Insert sample tag vocabulary
INSERT IGNORE INTO tag_vocabulary (tag_name, tag_category, tag_description, usage_count, quality_score) VALUES
-- Content tags
('portrait', 'content', 'Image primarily featuring a person or people', 0, 0.90),
('landscape', 'content', 'Scenic outdoor or nature photography', 0, 0.85),
('fashion', 'content', 'Clothing, style, or fashion-related imagery', 0, 0.80),
('artistic', 'content', 'Creative or artistic photography', 0, 0.75),
('professional', 'content', 'High-quality professional photography', 0, 0.85),

-- Style tags
('black_and_white', 'style', 'Monochrome photography', 0, 0.80),
('color', 'style', 'Full color photography', 0, 0.70),
('vintage', 'style', 'Retro or vintage aesthetic', 0, 0.75),
('modern', 'style', 'Contemporary photographic style', 0, 0.70),
('minimalist', 'style', 'Clean, simple composition', 0, 0.80),

-- Color tags
('warm_tones', 'color', 'Predominantly warm color palette', 0, 0.70),
('cool_tones', 'color', 'Predominantly cool color palette', 0, 0.70),
('high_contrast', 'color', 'Strong contrast between elements', 0, 0.75),
('soft_lighting', 'color', 'Gentle, diffused lighting', 0, 0.75),

-- Mood tags
('dramatic', 'mood', 'Strong emotional or dramatic feeling', 0, 0.70),
('serene', 'mood', 'Peaceful or calm atmosphere', 0, 0.70),
('energetic', 'mood', 'Dynamic or high-energy feeling', 0, 0.70),
('intimate', 'mood', 'Personal or intimate atmosphere', 0, 0.75),

-- Technical tags
('high_quality', 'technical', 'Technically excellent image quality', 0, 0.80),
('sharp_focus', 'technical', 'Crisp, well-focused imagery', 0, 0.75),
('good_composition', 'technical', 'Well-composed according to photographic principles', 0, 0.80),
('proper_exposure', 'technical', 'Correctly exposed image', 0, 0.75);

-- Create views for easier image classification analysis
CREATE OR REPLACE VIEW v_image_classification_summary AS
SELECT 
    icr.image_id,
    gi.title,
    gi.image_url,
    gi.category as gallery_category,
    icr.overall_category,
    icr.confidence_score,
    icr.safety_score,
    icr.aesthetic_score,
    icr.user_modified,
    COUNT(DISTINCT it.tag_name) as tag_count,
    COUNT(DISTINCT icp.model_name) as models_used,
    MAX(icr.updated_at) as last_processed,
    CASE 
        WHEN icr.safety_score >= 0.9 THEN 'safe'
        WHEN icr.safety_score >= 0.7 THEN 'questionable'
        WHEN icr.safety_score >= 0.5 THEN 'unsafe'
        ELSE 'explicit'
    END as safety_rating,
    CASE 
        WHEN icr.aesthetic_score >= 0.8 THEN 'excellent'
        WHEN icr.aesthetic_score >= 0.6 THEN 'good'
        WHEN icr.aesthetic_score >= 0.4 THEN 'average'
        ELSE 'poor'
    END as quality_rating
FROM image_classification_results icr
JOIN gallery_images gi ON icr.image_id = gi.id
LEFT JOIN image_tags it ON icr.image_id = it.image_id
LEFT JOIN image_classification_predictions icp ON icr.image_id = icp.image_id
WHERE gi.is_active = TRUE
GROUP BY icr.image_id, gi.title, gi.image_url, gi.category, icr.overall_category, 
         icr.confidence_score, icr.safety_score, icr.aesthetic_score, icr.user_modified;

CREATE OR REPLACE VIEW v_tag_performance AS
SELECT 
    tv.tag_name,
    tv.tag_category,
    tv.usage_count,
    tv.quality_score,
    COUNT(DISTINCT it.image_id) as images_tagged,
    AVG(it.confidence_score) as avg_confidence,
    COUNT(CASE WHEN it.is_verified = TRUE THEN 1 END) as verified_count,
    COUNT(DISTINCT itf.id) as feedback_count,
    tv.is_active,
    tv.created_at
FROM tag_vocabulary tv
LEFT JOIN image_tags it ON tv.tag_name = it.tag_name
LEFT JOIN image_tag_feedback itf ON JSON_CONTAINS(itf.user_tags, JSON_QUOTE(tv.tag_name))
GROUP BY tv.tag_name, tv.tag_category, tv.usage_count, tv.quality_score, tv.is_active, tv.created_at
ORDER BY tv.usage_count DESC, avg_confidence DESC;

CREATE OR REPLACE VIEW v_model_accuracy_summary AS
SELECT 
    icm.model_name,
    icm.model_type,
    icm.model_version,
    icm.model_accuracy,
    icm.is_production,
    COUNT(DISTINCT icp.image_id) as images_processed,
    AVG(icp.confidence_score) as avg_prediction_confidence,
    COUNT(CASE WHEN icp.confidence_score >= 0.8 THEN 1 END) as high_confidence_predictions,
    AVG(icp.processing_time_ms) as avg_processing_time_ms,
    MAX(icp.predicted_at) as last_used,
    COUNT(DISTINCT mpm.id) as performance_measurements
FROM image_classification_models icm
LEFT JOIN image_classification_predictions icp ON icm.model_name = icp.model_name
LEFT JOIN model_performance_metrics mpm ON icm.model_name = mpm.model_name
WHERE icm.is_active = TRUE
GROUP BY icm.model_name, icm.model_type, icm.model_version, icm.model_accuracy, icm.is_production
ORDER BY icm.model_accuracy DESC, images_processed DESC;

CREATE OR REPLACE VIEW v_image_similarity_network AS
SELECT 
    ivs.image_a_id,
    ivs.image_b_id,
    ivs.similarity_score,
    ivs.similarity_method,
    gi_a.title as image_a_title,
    gi_a.category as image_a_category,
    gi_b.title as image_b_title,
    gi_b.category as image_b_category,
    CASE 
        WHEN ivs.similarity_score >= 0.9 THEN 'very_high'
        WHEN ivs.similarity_score >= 0.8 THEN 'high'
        WHEN ivs.similarity_score >= 0.7 THEN 'medium'
        WHEN ivs.similarity_score >= 0.6 THEN 'low'
        ELSE 'very_low'
    END as similarity_level
FROM image_visual_similarity ivs
JOIN gallery_images gi_a ON ivs.image_a_id = gi_a.id
JOIN gallery_images gi_b ON ivs.image_b_id = gi_b.id
WHERE gi_a.is_active = TRUE AND gi_b.is_active = TRUE
  AND ivs.similarity_score >= 0.6
ORDER BY ivs.similarity_score DESC;

-- Create stored procedures for image classification operations
DELIMITER $$

CREATE PROCEDURE GetImageClassificationStats()
BEGIN
    -- Overall processing statistics
    SELECT 
        'Processing Statistics' as stats_type,
        COUNT(*) as total_images_processed,
        COUNT(CASE WHEN safety_score >= 0.9 THEN 1 END) as safe_images,
        COUNT(CASE WHEN aesthetic_score >= 0.8 THEN 1 END) as high_quality_images,
        COUNT(CASE WHEN user_modified = TRUE THEN 1 END) as user_modified_images,
        AVG(confidence_score) as avg_confidence,
        AVG(safety_score) as avg_safety_score,
        AVG(aesthetic_score) as avg_aesthetic_score
    FROM image_classification_results;
    
    -- Tag usage statistics
    SELECT 
        'Tag Usage' as stats_type,
        COUNT(*) as total_unique_tags,
        COUNT(CASE WHEN usage_count > 0 THEN 1 END) as used_tags,
        AVG(usage_count) as avg_usage_per_tag,
        MAX(usage_count) as max_usage,
        AVG(quality_score) as avg_tag_quality
    FROM tag_vocabulary
    WHERE is_active = TRUE;
    
    -- Model performance summary
    SELECT 
        'Model Performance' as stats_type,
        model_name,
        model_type,
        images_processed,
        avg_prediction_confidence,
        high_confidence_predictions,
        avg_processing_time_ms
    FROM v_model_accuracy_summary
    ORDER BY images_processed DESC;
    
    -- Classification category distribution
    SELECT 
        'Category Distribution' as stats_type,
        overall_category,
        COUNT(*) as image_count,
        AVG(confidence_score) as avg_confidence,
        AVG(safety_score) as avg_safety,
        AVG(aesthetic_score) as avg_quality
    FROM image_classification_results
    WHERE overall_category IS NOT NULL
    GROUP BY overall_category
    ORDER BY image_count DESC;
END$$

CREATE PROCEDURE AnalyzeTaggingPerformance(
    IN p_days_back INT DEFAULT 30
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    -- Tag accuracy analysis
    SELECT 
        'Tag Accuracy' as analysis_type,
        it.tag_name,
        it.tag_category,
        COUNT(*) as usage_count,
        AVG(it.confidence_score) as avg_confidence,
        COUNT(CASE WHEN it.is_verified = TRUE THEN 1 END) as verified_count,
        (COUNT(CASE WHEN it.is_verified = TRUE THEN 1 END) / COUNT(*)) as verification_rate,
        tv.quality_score as vocabulary_quality
    FROM image_tags it
    JOIN tag_vocabulary tv ON it.tag_name = tv.tag_name
    WHERE it.created_at >= DATE_SUB(NOW(), INTERVAL p_days_back DAY)
    GROUP BY it.tag_name, it.tag_category, tv.quality_score
    HAVING usage_count >= 5
    ORDER BY verification_rate DESC, avg_confidence DESC;
    
    -- User feedback analysis
    SELECT 
        'User Feedback' as analysis_type,
        feedback_type,
        COUNT(*) as feedback_count,
        COUNT(DISTINCT image_id) as unique_images,
        COUNT(DISTINCT user_id) as unique_users,
        AVG(confidence_rating) as avg_user_confidence
    FROM image_tag_feedback
    WHERE created_at >= DATE_SUB(NOW(), INTERVAL p_days_back DAY)
    GROUP BY feedback_type
    ORDER BY feedback_count DESC;
    
    -- Model prediction accuracy
    SELECT 
        'Model Accuracy' as analysis_type,
        icp.model_name,
        COUNT(*) as total_predictions,
        AVG(icp.confidence_score) as avg_confidence,
        COUNT(CASE WHEN it.is_verified = TRUE THEN 1 END) as verified_matches,
        (COUNT(CASE WHEN it.is_verified = TRUE THEN 1 END) / COUNT(*)) as accuracy_rate
    FROM image_classification_predictions icp
    LEFT JOIN image_tags it ON icp.image_id = it.image_id 
        AND FIND_IN_SET(icp.prediction_class, REPLACE(it.tag_name, '_', ' ')) > 0
    WHERE icp.predicted_at >= DATE_SUB(NOW(), INTERVAL p_days_back DAY)
    GROUP BY icp.model_name
    ORDER BY accuracy_rate DESC;
    
    COMMIT;
END$$

DELIMITER ;

-- Create indexes for optimal query performance
ALTER TABLE image_classification_results ADD INDEX idx_category_safety_aesthetic (overall_category, safety_score DESC, aesthetic_score DESC);
ALTER TABLE image_tags ADD INDEX idx_category_confidence_verified (tag_category, confidence_score DESC, is_verified);
ALTER TABLE image_classification_predictions ADD INDEX idx_model_confidence_time (model_name, confidence_score DESC, predicted_at DESC);
ALTER TABLE image_visual_similarity ADD INDEX idx_similarity_method_score (similarity_method, similarity_score DESC);

-- Grant permissions for image classification service
-- Note: In production, create a dedicated image classification service user
-- GRANT SELECT, INSERT, UPDATE, DELETE ON phoenix4ge.image_* TO 'image_classification_service'@'localhost';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON phoenix4ge.tag_* TO 'image_classification_service'@'localhost';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON phoenix4ge.model_* TO 'image_classification_service'@'localhost';
-- GRANT EXECUTE ON PROCEDURE phoenix4ge.GetImageClassificationStats TO 'image_classification_service'@'localhost';
-- GRANT EXECUTE ON PROCEDURE phoenix4ge.AnalyzeTaggingPerformance TO 'image_classification_service'@'localhost';

SELECT 'AI-Powered Image Classification and Auto-Tagging System migration completed successfully' as status;