-- Image Quality Assessment and Computer Vision Migration
-- Adds comprehensive tables for automated image quality analysis,
-- technical assessment, aesthetic evaluation, and enhancement recommendations

USE phoenix4ge;

-- Image quality assessment results and scoring
CREATE TABLE IF NOT EXISTS image_quality_assessments (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    image_id VARCHAR(200) NOT NULL, -- Links to gallery_images.id or other image references
    image_path TEXT NOT NULL,
    
    -- Overall quality scoring
    overall_quality_score DECIMAL(6,4) NOT NULL, -- 0.0000 to 1.0000
    quality_category ENUM('professional', 'high_quality', 'good', 'acceptable', 'needs_improvement', 'poor') NOT NULL,
    confidence_score DECIMAL(6,4) NOT NULL,
    
    -- Technical quality assessment
    technical_score DECIMAL(6,4) NOT NULL,
    technical_category ENUM('excellent', 'good', 'acceptable', 'poor') NOT NULL,
    technical_issues JSON, -- Array of identified technical issues
    
    -- Aesthetic quality assessment
    aesthetic_score DECIMAL(6,4) NOT NULL,
    aesthetic_category ENUM('excellent', 'good', 'acceptable', 'poor') NOT NULL,
    aesthetic_strengths JSON, -- Identified aesthetic strengths
    aesthetic_improvements JSON, -- Areas for aesthetic improvement
    
    -- Assessment details
    assessment_details JSON NOT NULL, -- Complete assessment breakdown
    processing_metadata JSON, -- Processing information and model versions
    
    -- Processing information
    processing_time_ms INT,
    models_used JSON, -- Which models were used for assessment
    service_version VARCHAR(50),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_image_id (image_id),
    INDEX idx_overall_quality_score (overall_quality_score DESC),
    INDEX idx_quality_category (quality_category),
    INDEX idx_technical_score (technical_score DESC),
    INDEX idx_aesthetic_score (aesthetic_score DESC),
    INDEX idx_confidence_score (confidence_score DESC),
    INDEX idx_created_at (created_at DESC),
    INDEX idx_quality_scores (overall_quality_score DESC, technical_score DESC, aesthetic_score DESC),
    
    UNIQUE KEY unique_image_assessment (image_id) -- One assessment per image (can be updated)
);

-- Technical quality analysis breakdown
CREATE TABLE IF NOT EXISTS image_technical_analysis (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    quality_assessment_id BIGINT NOT NULL,
    
    -- Sharpness and focus analysis
    sharpness_score DECIMAL(6,4),
    sharpness_method VARCHAR(100),
    is_sharp BOOLEAN,
    blur_detected BOOLEAN,
    focus_regions JSON, -- Which regions are in focus
    
    -- Exposure analysis
    exposure_score DECIMAL(6,4),
    average_brightness DECIMAL(6,4),
    is_overexposed BOOLEAN,
    is_underexposed BOOLEAN,
    dynamic_range DECIMAL(8,2),
    highlight_clipping_percentage DECIMAL(6,4),
    shadow_detail_quality DECIMAL(6,4),
    
    -- Noise analysis
    noise_score DECIMAL(6,4),
    noise_level ENUM('minimal', 'low', 'moderate', 'high', 'severe') DEFAULT 'minimal',
    noise_types JSON, -- Types of noise detected
    noise_distribution JSON, -- Where noise is located in the image
    
    -- Color analysis
    color_score DECIMAL(6,4),
    white_balance_accuracy DECIMAL(6,4),
    color_cast_detected BOOLEAN,
    color_saturation_score DECIMAL(6,4),
    color_space VARCHAR(50),
    color_accuracy_score DECIMAL(6,4),
    
    -- Resolution and detail analysis
    resolution_score DECIMAL(6,4),
    effective_resolution JSON, -- Actual vs nominal resolution
    detail_preservation_score DECIMAL(6,4),
    upscaling_artifacts_detected BOOLEAN,
    pixel_density_assessment DECIMAL(6,4),
    
    analysis_confidence DECIMAL(6,4) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_quality_assessment_id (quality_assessment_id),
    INDEX idx_sharpness_score (sharpness_score DESC),
    INDEX idx_exposure_score (exposure_score DESC),
    INDEX idx_noise_score (noise_score DESC),
    INDEX idx_color_score (color_score DESC),
    INDEX idx_resolution_score (resolution_score DESC),
    INDEX idx_analysis_confidence (analysis_confidence DESC),
    
    FOREIGN KEY (quality_assessment_id) REFERENCES image_quality_assessments(id) ON DELETE CASCADE
);

-- Aesthetic quality analysis breakdown
CREATE TABLE IF NOT EXISTS image_aesthetic_analysis (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    quality_assessment_id BIGINT NOT NULL,
    
    -- Composition analysis
    composition_score DECIMAL(6,4),
    rule_of_thirds_compliance DECIMAL(6,4),
    leading_lines_detected BOOLEAN,
    symmetry_score DECIMAL(6,4),
    depth_of_field_quality DECIMAL(6,4),
    framing_quality DECIMAL(6,4),
    negative_space_score DECIMAL(6,4),
    
    -- Lighting analysis
    lighting_score DECIMAL(6,4),
    lighting_direction VARCHAR(100), -- front, side, back, mixed
    lighting_quality ENUM('professional', 'good', 'acceptable', 'poor') DEFAULT 'acceptable',
    shadow_quality DECIMAL(6,4),
    highlight_quality DECIMAL(6,4),
    contrast_score DECIMAL(6,4),
    mood_lighting_detected BOOLEAN,
    
    -- Color harmony analysis
    color_harmony_score DECIMAL(6,4),
    color_scheme_type VARCHAR(100), -- monochromatic, analogous, etc.
    color_temperature_consistency DECIMAL(6,4),
    color_psychology_impact DECIMAL(6,4),
    visual_impact_score DECIMAL(6,4),
    color_balance_score DECIMAL(6,4),
    
    -- Subject analysis
    subject_score DECIMAL(6,4),
    subject_clarity DECIMAL(6,4),
    subject_positioning DECIMAL(6,4),
    background_quality DECIMAL(6,4),
    subject_background_separation DECIMAL(6,4),
    facial_analysis JSON, -- If faces are detected
    pose_assessment DECIMAL(6,4),
    
    analysis_confidence DECIMAL(6,4) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_quality_assessment_id (quality_assessment_id),
    INDEX idx_composition_score (composition_score DESC),
    INDEX idx_lighting_score (lighting_score DESC),
    INDEX idx_color_harmony_score (color_harmony_score DESC),
    INDEX idx_subject_score (subject_score DESC),
    INDEX idx_analysis_confidence (analysis_confidence DESC),
    
    FOREIGN KEY (quality_assessment_id) REFERENCES image_quality_assessments(id) ON DELETE CASCADE
);

-- Image enhancement recommendations
CREATE TABLE IF NOT EXISTS image_enhancement_recommendations (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    quality_assessment_id BIGINT NOT NULL,
    
    -- Recommendation details
    recommendation_type ENUM('technical', 'aesthetic', 'composition', 'color', 'lighting', 'general') NOT NULL,
    recommendation_category VARCHAR(100) NOT NULL, -- sharpness, exposure, crop, etc.
    recommendation_title VARCHAR(200) NOT NULL,
    recommendation_description TEXT NOT NULL,
    
    -- Implementation details
    implementation_method VARCHAR(100), -- automatic, manual, hybrid
    implementation_complexity ENUM('trivial', 'easy', 'moderate', 'difficult', 'expert') DEFAULT 'moderate',
    estimated_improvement DECIMAL(6,4), -- Expected quality score improvement
    confidence_score DECIMAL(6,4) NOT NULL,
    
    -- Enhancement parameters
    enhancement_parameters JSON, -- Specific parameters for the enhancement
    before_after_preview JSON, -- Preview data if available
    
    -- Priority and feasibility
    priority_score DECIMAL(6,4) NOT NULL, -- How important this recommendation is
    feasibility_score DECIMAL(6,4) NOT NULL, -- How feasible it is to implement
    impact_assessment JSON, -- Expected impact on different quality aspects
    
    -- Tracking
    is_applied BOOLEAN DEFAULT FALSE,
    applied_at TIMESTAMP NULL,
    applied_method VARCHAR(100),
    actual_improvement DECIMAL(6,4), -- Measured improvement after application
    user_satisfaction DECIMAL(6,4), -- User feedback on the enhancement
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_quality_assessment_id (quality_assessment_id),
    INDEX idx_recommendation_type (recommendation_type),
    INDEX idx_recommendation_category (recommendation_category),
    INDEX idx_implementation_complexity (implementation_complexity),
    INDEX idx_priority_score (priority_score DESC),
    INDEX idx_feasibility_score (feasibility_score DESC),
    INDEX idx_confidence_score (confidence_score DESC),
    INDEX idx_is_applied (is_applied),
    INDEX idx_created_at (created_at DESC),
    
    FOREIGN KEY (quality_assessment_id) REFERENCES image_quality_assessments(id) ON DELETE CASCADE
);

-- Quality assessment model performance tracking
CREATE TABLE IF NOT EXISTS quality_model_performance (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    model_name VARCHAR(100) NOT NULL,
    model_type ENUM('technical_sharpness', 'technical_noise', 'technical_exposure', 'aesthetic_composition', 'aesthetic_lighting', 'aesthetic_harmony', 'overall_quality') NOT NULL,
    model_version VARCHAR(50) NOT NULL,
    
    -- Performance metrics
    performance_metric VARCHAR(100) NOT NULL, -- accuracy, precision, recall, mse, etc.
    metric_value DECIMAL(10,6) NOT NULL,
    evaluation_dataset_size INT,
    evaluation_method VARCHAR(100),
    
    -- Model characteristics
    model_architecture VARCHAR(100), -- CNN, ResNet, etc.
    input_dimensions JSON, -- Expected input size and format
    output_format VARCHAR(100), -- score, classification, regression
    processing_speed_ms DECIMAL(8,2), -- Average processing time
    
    -- Evaluation details
    validation_accuracy DECIMAL(6,4),
    test_accuracy DECIMAL(6,4),
    cross_validation_score DECIMAL(6,4),
    confusion_matrix JSON, -- For classification models
    feature_importance JSON, -- Important features or regions
    
    -- Model metadata
    training_data_info JSON, -- Information about training data
    model_configuration JSON, -- Model hyperparameters and configuration
    
    evaluated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active_model BOOLEAN DEFAULT TRUE,
    
    INDEX idx_model_name (model_name),
    INDEX idx_model_type (model_type),
    INDEX idx_performance_metric (performance_metric),
    INDEX idx_metric_value (metric_value DESC),
    INDEX idx_evaluation_dataset_size (evaluation_dataset_size DESC),
    INDEX idx_is_active_model (is_active_model),
    INDEX idx_evaluated_at (evaluated_at DESC)
);

-- Quality assessment batch processing jobs
CREATE TABLE IF NOT EXISTS quality_batch_jobs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    job_name VARCHAR(200) NOT NULL,
    job_type ENUM('quality_assessment', 'enhancement_generation', 'model_evaluation', 'analytics_generation') NOT NULL,
    job_status ENUM('pending', 'running', 'completed', 'failed', 'cancelled') DEFAULT 'pending',
    
    -- Job configuration
    job_parameters JSON NOT NULL, -- Job configuration and parameters
    target_images JSON, -- List of images to process (if applicable)
    processing_options JSON, -- Processing options and settings
    
    -- Progress tracking
    total_items INT DEFAULT 0,
    processed_items INT DEFAULT 0,
    failed_items INT DEFAULT 0,
    success_items INT DEFAULT 0,
    progress_percentage DECIMAL(6,2) DEFAULT 0,
    
    -- Results and output
    job_results JSON, -- Job results and output data
    error_details JSON, -- Error information if job failed
    performance_metrics JSON, -- Performance metrics for the job
    
    -- Timing information
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    estimated_completion TIMESTAMP NULL,
    processing_time_seconds INT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_job_name (job_name),
    INDEX idx_job_type (job_type),
    INDEX idx_job_status (job_status),
    INDEX idx_progress_percentage (progress_percentage DESC),
    INDEX idx_started_at (started_at DESC),
    INDEX idx_completed_at (completed_at DESC),
    INDEX idx_created_at (created_at DESC)
);

-- Quality analytics and trends
CREATE TABLE IF NOT EXISTS quality_analytics (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    analysis_period_start TIMESTAMP NOT NULL,
    analysis_period_end TIMESTAMP NOT NULL,
    analysis_type ENUM('quality_distribution', 'quality_trends', 'common_issues', 'model_performance', 'enhancement_effectiveness') NOT NULL,
    
    -- Analytics data
    analytics_data JSON NOT NULL, -- Detailed analytics results
    summary_metrics JSON, -- Key summary metrics
    insights JSON, -- Generated insights and observations
    recommendations JSON, -- Recommendations based on analysis
    
    -- Analysis metadata
    images_analyzed INT DEFAULT 0,
    data_quality_score DECIMAL(6,4), -- Quality of the analysis data
    confidence_level DECIMAL(6,4), -- Statistical confidence
    analysis_method VARCHAR(100),
    
    -- Trend information
    trend_direction ENUM('improving', 'stable', 'declining', 'volatile') NULL,
    trend_significance DECIMAL(6,4), -- Statistical significance of trends
    seasonal_patterns JSON, -- Identified seasonal patterns
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_analysis_period (analysis_period_start, analysis_period_end),
    INDEX idx_analysis_type (analysis_type),
    INDEX idx_images_analyzed (images_analyzed DESC),
    INDEX idx_data_quality_score (data_quality_score DESC),
    INDEX idx_trend_direction (trend_direction),
    INDEX idx_created_at (created_at DESC)
);

-- Quality assessment alerts and monitoring
CREATE TABLE IF NOT EXISTS quality_alerts (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    alert_type ENUM('quality_degradation', 'model_performance_drop', 'processing_errors', 'unusual_patterns', 'batch_job_failure') NOT NULL,
    severity ENUM('info', 'warning', 'critical', 'emergency') NOT NULL,
    
    alert_title VARCHAR(200) NOT NULL,
    alert_description TEXT NOT NULL,
    alert_data JSON, -- Additional context and data
    
    -- Threshold information
    threshold_breached DECIMAL(10,4), -- Value that triggered the alert
    threshold_value DECIMAL(10,4), -- The threshold setting
    measurement_period VARCHAR(50), -- Time period for measurement
    
    -- Impact assessment
    affected_images INT, -- Number of images affected
    affected_assessments INT, -- Number of assessments affected
    quality_impact_score DECIMAL(6,4), -- Impact on overall quality
    
    -- Recommended actions
    recommended_actions JSON, -- Suggested remediation steps
    urgency_score DECIMAL(6,4), -- How urgent this alert is
    estimated_resolution_time INT, -- Estimated time to resolve (minutes)
    
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
    INDEX idx_quality_impact_score (quality_impact_score DESC),
    INDEX idx_urgency_score (urgency_score DESC),
    INDEX idx_is_acknowledged (is_acknowledged),
    INDEX idx_is_resolved (is_resolved),
    INDEX idx_created_at (created_at DESC),
    INDEX idx_alert_status (alert_type, severity, is_resolved, created_at DESC)
);

-- Insert default quality model configurations
INSERT IGNORE INTO quality_model_performance (
    model_name, model_type, model_version, performance_metric, 
    metric_value, evaluation_dataset_size, model_architecture, evaluated_at
) VALUES
-- Technical Quality Models
('sharpness_cnn_v2', 'technical_sharpness', '2.0.0', 'accuracy', 0.920, 5000, 'CNN', NOW()),
('sharpness_cnn_v2', 'technical_sharpness', '2.0.0', 'precision', 0.890, 5000, 'CNN', NOW()),
('sharpness_cnn_v2', 'technical_sharpness', '2.0.0', 'recall', 0.875, 5000, 'CNN', NOW()),

('noise_classification_v1', 'technical_noise', '1.0.0', 'accuracy', 0.850, 3000, 'ResNet', NOW()),
('noise_classification_v1', 'technical_noise', '1.0.0', 'precision', 0.830, 3000, 'ResNet', NOW()),
('noise_classification_v1', 'technical_noise', '1.0.0', 'recall', 0.810, 3000, 'ResNet', NOW()),

('exposure_assessment_v1', 'technical_exposure', '1.0.0', 'mse', 0.025, 4000, 'CNN', NOW()),
('exposure_assessment_v1', 'technical_exposure', '1.0.0', 'mae', 0.120, 4000, 'CNN', NOW()),

-- Aesthetic Quality Models
('composition_assessment_v2', 'aesthetic_composition', '2.0.0', 'accuracy', 0.780, 6000, 'ResNet50', NOW()),
('composition_assessment_v2', 'aesthetic_composition', '2.0.0', 'precision', 0.750, 6000, 'ResNet50', NOW()),

('aesthetic_quality_v1', 'overall_quality', '1.0.0', 'correlation', 0.820, 8000, 'EfficientNet', NOW()),
('aesthetic_quality_v1', 'overall_quality', '1.0.0', 'mae', 0.085, 8000, 'EfficientNet', NOW()),

('color_harmony_v1', 'aesthetic_harmony', '1.0.0', 'accuracy', 0.730, 4500, 'VisionTransformer', NOW()),
('color_harmony_v1', 'aesthetic_harmony', '1.0.0', 'f1_score', 0.710, 4500, 'VisionTransformer', NOW());

-- Create views for quality analytics
CREATE OR REPLACE VIEW v_quality_assessment_summary AS
SELECT 
    DATE(iqa.created_at) as assessment_date,
    iqa.quality_category,
    COUNT(*) as assessment_count,
    AVG(iqa.overall_quality_score) as avg_overall_score,
    AVG(iqa.technical_score) as avg_technical_score,
    AVG(iqa.aesthetic_score) as avg_aesthetic_score,
    AVG(iqa.confidence_score) as avg_confidence,
    AVG(iqa.processing_time_ms) as avg_processing_time,
    COUNT(CASE WHEN iqa.overall_quality_score >= 0.8 THEN 1 END) as high_quality_count,
    COUNT(CASE WHEN iqa.overall_quality_score < 0.6 THEN 1 END) as low_quality_count
FROM image_quality_assessments iqa
WHERE iqa.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY DATE(iqa.created_at), iqa.quality_category
ORDER BY assessment_date DESC, avg_overall_score DESC;

CREATE OR REPLACE VIEW v_quality_model_health AS
SELECT 
    qmp.model_name,
    qmp.model_type,
    AVG(CASE WHEN qmp.performance_metric = 'accuracy' THEN qmp.metric_value END) as accuracy,
    AVG(CASE WHEN qmp.performance_metric = 'precision' THEN qmp.metric_value END) as precision,
    AVG(CASE WHEN qmp.performance_metric = 'recall' THEN qmp.metric_value END) as recall,
    AVG(CASE WHEN qmp.performance_metric = 'f1_score' THEN qmp.metric_value END) as f1_score,
    AVG(CASE WHEN qmp.performance_metric = 'mse' THEN qmp.metric_value END) as mse,
    AVG(qmp.processing_speed_ms) as avg_processing_time,
    MAX(qmp.evaluated_at) as last_evaluated,
    qmp.is_active_model
FROM quality_model_performance qmp
WHERE qmp.evaluated_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY qmp.model_name, qmp.model_type, qmp.is_active_model
ORDER BY accuracy DESC, f1_score DESC;

CREATE OR REPLACE VIEW v_enhancement_effectiveness AS
SELECT 
    ier.recommendation_type,
    ier.recommendation_category,
    COUNT(*) as total_recommendations,
    COUNT(CASE WHEN ier.is_applied = TRUE THEN 1 END) as applied_count,
    AVG(ier.estimated_improvement) as avg_estimated_improvement,
    AVG(CASE WHEN ier.actual_improvement IS NOT NULL THEN ier.actual_improvement END) as avg_actual_improvement,
    AVG(CASE WHEN ier.user_satisfaction IS NOT NULL THEN ier.user_satisfaction END) as avg_user_satisfaction,
    AVG(ier.priority_score) as avg_priority,
    AVG(ier.feasibility_score) as avg_feasibility,
    CASE 
        WHEN COUNT(*) > 0 THEN 
            COUNT(CASE WHEN ier.is_applied = TRUE THEN 1 END) / COUNT(*)
        ELSE 0 
    END as application_rate
FROM image_enhancement_recommendations ier
WHERE ier.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY ier.recommendation_type, ier.recommendation_category
HAVING COUNT(*) >= 5
ORDER BY avg_actual_improvement DESC, application_rate DESC;

-- Create stored procedures for quality analytics
DELIMITER $$

CREATE PROCEDURE GetQualityAnalytics(
    IN p_timeframe VARCHAR(10) DEFAULT '30d',
    IN p_quality_category VARCHAR(50) DEFAULT NULL
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
    
    -- Quality distribution overview
    SELECT 
        'Quality Distribution' as section,
        iqa.quality_category,
        COUNT(*) as assessment_count,
        AVG(iqa.overall_quality_score) as avg_quality_score,
        AVG(iqa.confidence_score) as avg_confidence,
        COUNT(*) / (SELECT COUNT(*) FROM image_quality_assessments WHERE created_at >= DATE_SUB(NOW(), INTERVAL v_days DAY)) * 100 as percentage
    FROM image_quality_assessments iqa
    WHERE iqa.created_at >= DATE_SUB(NOW(), INTERVAL v_days DAY)
      AND (p_quality_category IS NULL OR iqa.quality_category = p_quality_category)
    GROUP BY iqa.quality_category
    ORDER BY avg_quality_score DESC;
    
    -- Technical vs Aesthetic scores
    SELECT 
        'Technical vs Aesthetic' as section,
        AVG(iqa.technical_score) as avg_technical_score,
        AVG(iqa.aesthetic_score) as avg_aesthetic_score,
        AVG(iqa.overall_quality_score) as avg_overall_score,
        STDDEV(iqa.technical_score) as technical_score_stddev,
        STDDEV(iqa.aesthetic_score) as aesthetic_score_stddev,
        COUNT(*) as total_assessments
    FROM image_quality_assessments iqa
    WHERE iqa.created_at >= DATE_SUB(NOW(), INTERVAL v_days DAY)
      AND (p_quality_category IS NULL OR iqa.quality_category = p_quality_category);
    
    -- Common enhancement recommendations
    SELECT 
        'Enhancement Recommendations' as section,
        ier.recommendation_category,
        COUNT(*) as recommendation_count,
        AVG(ier.priority_score) as avg_priority,
        AVG(ier.estimated_improvement) as avg_estimated_improvement,
        COUNT(CASE WHEN ier.is_applied = TRUE THEN 1 END) as applied_count
    FROM image_enhancement_recommendations ier
    JOIN image_quality_assessments iqa ON ier.quality_assessment_id = iqa.id
    WHERE iqa.created_at >= DATE_SUB(NOW(), INTERVAL v_days DAY)
      AND (p_quality_category IS NULL OR iqa.quality_category = p_quality_category)
    GROUP BY ier.recommendation_category
    ORDER BY recommendation_count DESC
    LIMIT 10;
    
    -- Processing performance
    SELECT 
        'Processing Performance' as section,
        AVG(iqa.processing_time_ms) as avg_processing_time,
        MIN(iqa.processing_time_ms) as min_processing_time,
        MAX(iqa.processing_time_ms) as max_processing_time,
        STDDEV(iqa.processing_time_ms) as processing_time_stddev,
        COUNT(*) as total_processed
    FROM image_quality_assessments iqa
    WHERE iqa.created_at >= DATE_SUB(NOW(), INTERVAL v_days DAY)
      AND (p_quality_category IS NULL OR iqa.quality_category = p_quality_category);
END$$

CREATE PROCEDURE UpdateQualityAssessment(
    IN p_image_id VARCHAR(200),
    IN p_overall_quality_score DECIMAL(6,4),
    IN p_quality_category VARCHAR(50),
    IN p_technical_score DECIMAL(6,4),
    IN p_aesthetic_score DECIMAL(6,4),
    IN p_assessment_details JSON,
    IN p_processing_metadata JSON
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    -- Insert or update quality assessment
    INSERT INTO image_quality_assessments (
        image_id, overall_quality_score, quality_category, technical_score,
        aesthetic_score, assessment_details, processing_metadata, confidence_score
    ) VALUES (
        p_image_id, p_overall_quality_score, p_quality_category, p_technical_score,
        p_aesthetic_score, p_assessment_details, p_processing_metadata, 0.85
    ) ON DUPLICATE KEY UPDATE
        overall_quality_score = p_overall_quality_score,
        quality_category = p_quality_category,
        technical_score = p_technical_score,
        aesthetic_score = p_aesthetic_score,
        assessment_details = p_assessment_details,
        processing_metadata = p_processing_metadata,
        updated_at = NOW();
    
    -- Generate alert if quality score is unusually low
    IF p_overall_quality_score < 0.3 THEN
        INSERT INTO quality_alerts (
            alert_type, severity, alert_title, alert_description,
            threshold_breached, threshold_value, affected_images, recommended_actions
        ) VALUES (
            'quality_degradation', 'warning',
            CONCAT('Low quality score detected for image ', p_image_id),
            CONCAT('Image quality score of ', p_overall_quality_score, ' is below acceptable threshold'),
            p_overall_quality_score,
            0.3,
            1,
            JSON_ARRAY('review_image_manually', 'check_enhancement_recommendations', 'verify_image_source')
        );
    END IF;
    
    COMMIT;
END$$

DELIMITER ;

-- Create indexes for optimal query performance
ALTER TABLE image_quality_assessments ADD INDEX idx_quality_confidence (overall_quality_score DESC, confidence_score DESC, created_at DESC);
ALTER TABLE image_technical_analysis ADD INDEX idx_technical_scores (sharpness_score DESC, exposure_score DESC, noise_score DESC);
ALTER TABLE image_aesthetic_analysis ADD INDEX idx_aesthetic_scores (composition_score DESC, lighting_score DESC, color_harmony_score DESC);
ALTER TABLE image_enhancement_recommendations ADD INDEX idx_recommendation_priority (priority_score DESC, feasibility_score DESC, is_applied);

-- Grant permissions for image quality assessment service
-- Note: In production, create a dedicated quality service user
-- GRANT SELECT, INSERT, UPDATE, DELETE ON phoenix4ge.image_quality_assessments TO 'quality_service'@'localhost';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON phoenix4ge.image_technical_analysis TO 'quality_service'@'localhost';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON phoenix4ge.image_aesthetic_analysis TO 'quality_service'@'localhost';
-- GRANT EXECUTE ON PROCEDURE phoenix4ge.GetQualityAnalytics TO 'quality_service'@'localhost';
-- GRANT EXECUTE ON PROCEDURE phoenix4ge.UpdateQualityAssessment TO 'quality_service'@'localhost';

SELECT 'Image Quality Assessment and Computer Vision migration completed successfully' as status;