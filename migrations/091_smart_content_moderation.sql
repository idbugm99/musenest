-- Smart Content Moderation with ML-Based Violation Detection Migration
-- Adds tables and infrastructure for comprehensive automated content violation detection
-- and policy-based enforcement with appeal processes

USE musenest;

-- Content violation detection results
CREATE TABLE IF NOT EXISTS content_violations (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    content_id BIGINT NOT NULL, -- References content_moderation.id
    violation_type ENUM('explicit_content', 'sexual_content', 'violence', 'weapons', 'gore', 'hate_speech', 'harassment', 'toxicity', 'spam', 'copyright_violation', 'trademark_violation') NOT NULL,
    severity ENUM('low', 'medium', 'high', 'critical') NOT NULL,
    confidence_score DECIMAL(6,4) NOT NULL,
    description TEXT NOT NULL,
    detected_elements JSON, -- Array of specific detected elements
    policy_violation VARCHAR(200), -- Which policy was violated
    detection_model VARCHAR(100), -- Which ML model detected this
    model_version VARCHAR(50),
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_by VARCHAR(100),
    resolved_at TIMESTAMP NULL,
    resolution_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_content_id (content_id),
    INDEX idx_violation_type (violation_type),
    INDEX idx_severity (severity),
    INDEX idx_confidence_score (confidence_score DESC),
    INDEX idx_is_resolved (is_resolved),
    INDEX idx_created_at (created_at),
    INDEX idx_content_severity (content_id, severity),
    
    FOREIGN KEY (content_id) REFERENCES content_moderation(id) ON DELETE CASCADE
);

-- Automated moderation actions and their results
CREATE TABLE IF NOT EXISTS moderation_actions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    content_id BIGINT NOT NULL,
    action_type ENUM('flag_for_review', 'temporary_removal', 'content_removal', 'immediate_removal_and_user_restriction', 'approve', 'no_action') NOT NULL,
    action_status ENUM('pending', 'executed', 'failed', 'cancelled', 'requires_approval') DEFAULT 'pending',
    severity_score DECIMAL(6,4) NOT NULL,
    risk_level ENUM('minimal', 'low', 'medium', 'high', 'critical') NOT NULL,
    violations_detected JSON NOT NULL, -- Array of violation objects
    auto_executed BOOLEAN DEFAULT FALSE,
    execution_timestamp TIMESTAMP NULL,
    failure_reason TEXT,
    duration_hours INT, -- For temporary actions
    escalated_to_admin BOOLEAN DEFAULT FALSE,
    escalation_reason TEXT,
    admin_notified_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_content_id (content_id),
    INDEX idx_action_type (action_type),
    INDEX idx_action_status (action_status),
    INDEX idx_severity_score (severity_score DESC),
    INDEX idx_risk_level (risk_level),
    INDEX idx_auto_executed (auto_executed),
    INDEX idx_escalated_to_admin (escalated_to_admin),
    INDEX idx_created_at (created_at),
    
    FOREIGN KEY (content_id) REFERENCES content_moderation(id) ON DELETE CASCADE
);

-- Content moderation appeal history and tracking
CREATE TABLE IF NOT EXISTS moderation_appeal_history (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    appeal_id INT NOT NULL,
    content_moderation_id BIGINT NOT NULL,
    previous_status ENUM('pending', 'approved', 'rejected', 'partial_approval') NOT NULL,
    new_status ENUM('pending', 'approved', 'rejected', 'partial_approval') NOT NULL,
    review_decision ENUM('approved', 'rejected', 'partial_approval') NOT NULL,
    reviewer_notes TEXT,
    reviewed_by VARCHAR(100) NOT NULL,
    processing_time_ms INT,
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_appeal_id (appeal_id),
    INDEX idx_content_moderation_id (content_moderation_id),
    INDEX idx_review_decision (review_decision),
    INDEX idx_reviewed_by (reviewed_by),
    INDEX idx_processed_at (processed_at),
    
    FOREIGN KEY (appeal_id) REFERENCES moderation_appeals(id) ON DELETE CASCADE,
    FOREIGN KEY (content_moderation_id) REFERENCES content_moderation(id) ON DELETE CASCADE
);

-- ML model performance tracking for violation detection
CREATE TABLE IF NOT EXISTS violation_detection_models (
    id INT PRIMARY KEY AUTO_INCREMENT,
    model_name VARCHAR(100) NOT NULL UNIQUE,
    model_type ENUM('nsfw_classifier', 'violence_classifier', 'toxicity_classifier', 'spam_classifier', 'copyright_classifier') NOT NULL,
    model_version VARCHAR(50) NOT NULL,
    detection_categories JSON NOT NULL, -- Array of violation types this model detects
    confidence_threshold DECIMAL(4,3) DEFAULT 0.500,
    weight DECIMAL(4,3) DEFAULT 1.000, -- Weight in ensemble scoring
    enabled BOOLEAN DEFAULT TRUE,
    accuracy_score DECIMAL(6,4), -- Overall model accuracy
    precision_score DECIMAL(6,4),
    recall_score DECIMAL(6,4),
    f1_score DECIMAL(6,4),
    false_positive_rate DECIMAL(6,4),
    false_negative_rate DECIMAL(6,4),
    processing_time_avg_ms DECIMAL(8,2),
    last_evaluated TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_model_name (model_name),
    INDEX idx_model_type (model_type),
    INDEX idx_enabled (enabled),
    INDEX idx_accuracy_score (accuracy_score DESC),
    INDEX idx_last_evaluated (last_evaluated)
);

-- User restrictions and penalties from violations
CREATE TABLE IF NOT EXISTS user_restrictions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL, -- References models.id or admin users
    user_type ENUM('model', 'admin', 'client') DEFAULT 'model',
    restriction_type ENUM('content_upload_ban', 'account_suspension', 'feature_restriction', 'warning') NOT NULL,
    severity ENUM('low', 'medium', 'high', 'critical') NOT NULL,
    duration_hours INT, -- NULL for permanent restrictions
    start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_date TIMESTAMP NULL,
    violation_content_id BIGINT, -- Content that triggered the restriction
    violation_details JSON, -- Details of the violations
    restriction_reason TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    lifted_by VARCHAR(100),
    lifted_at TIMESTAMP NULL,
    lift_reason TEXT,
    created_by VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_user_id (user_id),
    INDEX idx_user_type (user_type),
    INDEX idx_restriction_type (restriction_type),
    INDEX idx_severity (severity),
    INDEX idx_is_active (is_active),
    INDEX idx_start_date (start_date),
    INDEX idx_end_date (end_date),
    INDEX idx_violation_content_id (violation_content_id),
    
    FOREIGN KEY (violation_content_id) REFERENCES content_moderation(id) ON DELETE SET NULL
);

-- Policy configuration for automated moderation
CREATE TABLE IF NOT EXISTS moderation_policies (
    id INT PRIMARY KEY AUTO_INCREMENT,
    policy_name VARCHAR(100) NOT NULL UNIQUE,
    policy_description TEXT,
    violation_types JSON NOT NULL, -- Array of violation types this policy covers
    severity_thresholds JSON NOT NULL, -- Threshold configurations for different severities
    automated_actions JSON NOT NULL, -- Actions to take for different risk levels
    is_active BOOLEAN DEFAULT TRUE,
    applies_to_content_types JSON, -- Array of content types this applies to
    model_weights JSON, -- Weights for different detection models
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_policy_name (policy_name),
    INDEX idx_is_active (is_active),
    INDEX idx_created_at (created_at)
);

-- Detection performance metrics and feedback
CREATE TABLE IF NOT EXISTS detection_feedback (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    content_id BIGINT NOT NULL,
    violation_id BIGINT, -- NULL for false negatives
    feedback_type ENUM('false_positive', 'false_negative', 'correct_detection', 'incorrect_severity') NOT NULL,
    original_prediction JSON, -- Original model prediction
    correct_classification JSON, -- Human-verified correct classification
    feedback_provider VARCHAR(100) NOT NULL,
    feedback_confidence ENUM('low', 'medium', 'high') DEFAULT 'medium',
    feedback_notes TEXT,
    model_names JSON, -- Models that made the prediction
    used_for_retraining BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_content_id (content_id),
    INDEX idx_violation_id (violation_id),
    INDEX idx_feedback_type (feedback_type),
    INDEX idx_feedback_provider (feedback_provider),
    INDEX idx_used_for_retraining (used_for_retraining),
    INDEX idx_created_at (created_at),
    
    FOREIGN KEY (content_id) REFERENCES content_moderation(id) ON DELETE CASCADE,
    FOREIGN KEY (violation_id) REFERENCES content_violations(id) ON DELETE SET NULL
);

-- Real-time monitoring and alerting for moderation
CREATE TABLE IF NOT EXISTS moderation_alerts (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    alert_type ENUM('high_violation_rate', 'model_performance_degraded', 'manual_review_backlog', 'policy_breach', 'system_error') NOT NULL,
    severity ENUM('info', 'warning', 'critical', 'emergency') NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    alert_data JSON, -- Additional alert context
    affected_content_ids JSON, -- Array of affected content IDs
    threshold_breached DECIMAL(8,4), -- Value that breached the threshold
    threshold_value DECIMAL(8,4), -- The threshold that was set
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
    INDEX idx_is_acknowledged (is_acknowledged),
    INDEX idx_is_resolved (is_resolved),
    INDEX idx_created_at (created_at DESC),
    INDEX idx_severity_unresolved (severity, is_resolved)
);

-- Insert default violation detection models
INSERT IGNORE INTO violation_detection_models (
    model_name, model_type, model_version, detection_categories, 
    confidence_threshold, weight, accuracy_score, enabled
) VALUES
('nsfw_mobilenet_v2', 'nsfw_classifier', '2.1.0', 
 JSON_ARRAY('explicit_content', 'sexual_content'), 0.700, 0.8, 0.920, TRUE),

('violence_detector_v1', 'violence_classifier', '1.0.0',
 JSON_ARRAY('violence', 'weapons', 'gore'), 0.600, 0.9, 0.850, TRUE),

('toxicity_bert_v2', 'toxicity_classifier', '2.0.0',
 JSON_ARRAY('hate_speech', 'harassment', 'toxicity'), 0.800, 0.7, 0.880, TRUE),

('spam_detector_v1', 'spam_classifier', '1.0.0',
 JSON_ARRAY('spam'), 0.700, 0.6, 0.750, TRUE),

('copyright_detector_v1', 'copyright_classifier', '1.0.0',
 JSON_ARRAY('copyright_violation', 'trademark_violation'), 0.800, 1.0, 0.800, TRUE);

-- Insert default moderation policy
INSERT IGNORE INTO moderation_policies (
    policy_name, policy_description, violation_types, severity_thresholds, automated_actions, created_by
) VALUES (
    'default_content_policy',
    'Default content moderation policy with standard violation detection and automated actions',
    JSON_ARRAY('explicit_content', 'violence', 'hate_speech', 'spam', 'copyright_violation'),
    JSON_OBJECT(
        'low', 0.3,
        'medium', 0.6, 
        'high', 0.8,
        'critical', 0.95
    ),
    JSON_OBJECT(
        'minimal', JSON_OBJECT('action', 'approve', 'auto_execute', TRUE),
        'low', JSON_OBJECT('action', 'flag_for_review', 'auto_execute', FALSE),
        'medium', JSON_OBJECT('action', 'temporary_removal', 'auto_execute', TRUE, 'duration_hours', 24),
        'high', JSON_OBJECT('action', 'content_removal', 'auto_execute', TRUE, 'escalate_to_admin', TRUE),
        'critical', JSON_OBJECT('action', 'immediate_removal_and_user_restriction', 'auto_execute', TRUE, 'restrict_user_hours', 72)
    ),
    'system'
);

-- Create views for easier violation analysis
CREATE OR REPLACE VIEW v_violation_summary AS
SELECT 
    cv.content_id,
    cm.model_id,
    m.name as model_name,
    COUNT(*) as total_violations,
    COUNT(CASE WHEN cv.severity = 'critical' THEN 1 END) as critical_violations,
    COUNT(CASE WHEN cv.severity = 'high' THEN 1 END) as high_violations,
    COUNT(CASE WHEN cv.severity = 'medium' THEN 1 END) as medium_violations,
    COUNT(CASE WHEN cv.severity = 'low' THEN 1 END) as low_violations,
    AVG(cv.confidence_score) as avg_confidence,
    MAX(cv.confidence_score) as max_confidence,
    GROUP_CONCAT(DISTINCT cv.violation_type) as violation_types,
    cv.created_at as first_detected,
    MAX(cv.updated_at) as last_updated,
    COUNT(CASE WHEN cv.is_resolved = TRUE THEN 1 END) as resolved_violations,
    cm.moderation_status
FROM content_violations cv
JOIN content_moderation cm ON cv.content_id = cm.id
LEFT JOIN models m ON cm.model_id = m.id
GROUP BY cv.content_id, cm.model_id, m.name, cm.moderation_status, cv.created_at;

CREATE OR REPLACE VIEW v_moderation_performance AS
SELECT 
    vdm.model_name,
    vdm.model_type,
    vdm.enabled,
    vdm.accuracy_score,
    COUNT(cv.id) as violations_detected,
    AVG(cv.confidence_score) as avg_violation_confidence,
    COUNT(df.id) as feedback_received,
    COUNT(CASE WHEN df.feedback_type = 'false_positive' THEN 1 END) as false_positives,
    COUNT(CASE WHEN df.feedback_type = 'false_negative' THEN 1 END) as false_negatives,
    COUNT(CASE WHEN df.feedback_type = 'correct_detection' THEN 1 END) as correct_detections,
    CASE 
        WHEN COUNT(df.id) > 0 THEN 
            COUNT(CASE WHEN df.feedback_type = 'correct_detection' THEN 1 END) / COUNT(df.id)
        ELSE vdm.accuracy_score 
    END as real_world_accuracy
FROM violation_detection_models vdm
LEFT JOIN content_violations cv ON vdm.model_name = cv.detection_model
LEFT JOIN detection_feedback df ON cv.id = df.violation_id
GROUP BY vdm.model_name, vdm.model_type, vdm.enabled, vdm.accuracy_score
ORDER BY real_world_accuracy DESC;

CREATE OR REPLACE VIEW v_alert_dashboard AS
SELECT 
    alert_type,
    severity,
    COUNT(*) as alert_count,
    COUNT(CASE WHEN is_acknowledged = FALSE THEN 1 END) as unacknowledged_count,
    COUNT(CASE WHEN is_resolved = FALSE THEN 1 END) as unresolved_count,
    MAX(created_at) as latest_alert,
    AVG(TIMESTAMPDIFF(MINUTE, created_at, acknowledged_at)) as avg_ack_time_minutes,
    AVG(TIMESTAMPDIFF(MINUTE, created_at, resolved_at)) as avg_resolution_time_minutes
FROM moderation_alerts
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
GROUP BY alert_type, severity
ORDER BY 
    CASE severity 
        WHEN 'emergency' THEN 1
        WHEN 'critical' THEN 2 
        WHEN 'warning' THEN 3
        ELSE 4 
    END,
    unresolved_count DESC;

-- Create stored procedures for violation analytics
DELIMITER $$

CREATE PROCEDURE GetViolationAnalytics(
    IN p_timeframe VARCHAR(10) DEFAULT '24h'
)
BEGIN
    DECLARE v_days INT DEFAULT 1;
    
    -- Convert timeframe to days
    CASE p_timeframe
        WHEN '7d' THEN SET v_days = 7;
        WHEN '30d' THEN SET v_days = 30;
        ELSE SET v_days = 1;
    END CASE;
    
    -- Overall violation statistics
    SELECT 
        'Violation Overview' as section,
        COUNT(*) as total_violations,
        COUNT(DISTINCT content_id) as unique_content_flagged,
        COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_violations,
        COUNT(CASE WHEN severity = 'high' THEN 1 END) as high_violations,
        COUNT(CASE WHEN severity = 'medium' THEN 1 END) as medium_violations,
        COUNT(CASE WHEN severity = 'low' THEN 1 END) as low_violations,
        AVG(confidence_score) as avg_confidence_score,
        COUNT(CASE WHEN is_resolved = TRUE THEN 1 END) as resolved_violations
    FROM content_violations
    WHERE created_at >= DATE_SUB(NOW(), INTERVAL v_days DAY);
    
    -- Violation types breakdown
    SELECT 
        'Violation Types' as section,
        violation_type,
        COUNT(*) as count,
        AVG(confidence_score) as avg_confidence,
        COUNT(CASE WHEN severity IN ('high', 'critical') THEN 1 END) as high_severity_count
    FROM content_violations
    WHERE created_at >= DATE_SUB(NOW(), INTERVAL v_days DAY)
    GROUP BY violation_type
    ORDER BY count DESC;
    
    -- Model performance
    SELECT 
        'Model Performance' as section,
        detection_model,
        COUNT(*) as violations_detected,
        AVG(confidence_score) as avg_confidence,
        COUNT(CASE WHEN severity IN ('high', 'critical') THEN 1 END) as high_severity_detections
    FROM content_violations
    WHERE created_at >= DATE_SUB(NOW(), INTERVAL v_days DAY)
      AND detection_model IS NOT NULL
    GROUP BY detection_model
    ORDER BY violations_detected DESC;
    
    -- Action effectiveness
    SELECT 
        'Action Effectiveness' as section,
        ma.action_type,
        ma.risk_level,
        COUNT(*) as actions_taken,
        COUNT(CASE WHEN ma.action_status = 'executed' THEN 1 END) as successfully_executed,
        COUNT(CASE WHEN ma.escalated_to_admin = TRUE THEN 1 END) as escalated_to_admin,
        AVG(ma.severity_score) as avg_severity_score
    FROM moderation_actions ma
    WHERE ma.created_at >= DATE_SUB(NOW(), INTERVAL v_days DAY)
    GROUP BY ma.action_type, ma.risk_level
    ORDER BY ma.risk_level DESC, actions_taken DESC;
END$$

CREATE PROCEDURE ProcessViolationFeedback(
    IN p_content_id BIGINT,
    IN p_violation_id BIGINT,
    IN p_feedback_type VARCHAR(20),
    IN p_feedback_provider VARCHAR(100),
    IN p_feedback_notes TEXT
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    -- Insert feedback record
    INSERT INTO detection_feedback (
        content_id, violation_id, feedback_type, feedback_provider, feedback_notes
    ) VALUES (
        p_content_id, p_violation_id, p_feedback_type, p_feedback_provider, p_feedback_notes
    );
    
    -- Update model performance metrics if this is quality feedback
    IF p_feedback_type IN ('false_positive', 'false_negative', 'correct_detection') THEN
        -- Update violation detection model accuracy based on feedback
        UPDATE violation_detection_models vdm
        SET 
            false_positive_rate = (
                SELECT COUNT(CASE WHEN df.feedback_type = 'false_positive' THEN 1 END) / COUNT(*) 
                FROM detection_feedback df 
                JOIN content_violations cv ON df.violation_id = cv.id
                WHERE cv.detection_model = vdm.model_name
            ),
            false_negative_rate = (
                SELECT COUNT(CASE WHEN df.feedback_type = 'false_negative' THEN 1 END) / COUNT(*) 
                FROM detection_feedback df 
                JOIN content_violations cv ON df.violation_id = cv.id
                WHERE cv.detection_model = vdm.model_name
            ),
            last_evaluated = NOW()
        WHERE vdm.model_name = (
            SELECT cv.detection_model 
            FROM content_violations cv 
            WHERE cv.id = p_violation_id
        );
    END IF;
    
    COMMIT;
END$$

DELIMITER ;

-- Create indexes for optimal query performance
ALTER TABLE content_violations ADD INDEX idx_content_severity_date (content_id, severity, created_at DESC);
ALTER TABLE moderation_actions ADD INDEX idx_risk_status_date (risk_level, action_status, created_at DESC);
ALTER TABLE detection_feedback ADD INDEX idx_feedback_model_date (feedback_type, created_at DESC);
ALTER TABLE moderation_alerts ADD INDEX idx_severity_resolved_date (severity, is_resolved, created_at DESC);

-- Grant permissions for smart content moderation service
-- Note: In production, create a dedicated smart moderation service user
-- GRANT SELECT, INSERT, UPDATE, DELETE ON musenest.content_violations TO 'smart_moderation_service'@'localhost';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON musenest.moderation_actions TO 'smart_moderation_service'@'localhost';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON musenest.detection_feedback TO 'smart_moderation_service'@'localhost';
-- GRANT EXECUTE ON PROCEDURE musenest.GetViolationAnalytics TO 'smart_moderation_service'@'localhost';
-- GRANT EXECUTE ON PROCEDURE musenest.ProcessViolationFeedback TO 'smart_moderation_service'@'localhost';

SELECT 'Smart Content Moderation with ML-Based Violation Detection migration completed successfully' as status;