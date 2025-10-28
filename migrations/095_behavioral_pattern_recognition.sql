-- Behavioral Pattern Recognition and Fraud Detection Migration
-- Adds comprehensive tables for behavioral analysis, fraud detection, 
-- abuse pattern recognition, and security threat monitoring

USE phoenix4ge;

-- User behavior profiles and baselines
CREATE TABLE IF NOT EXISTS user_behavior_profiles (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    profile_type ENUM('individual', 'aggregate', 'segment') DEFAULT 'individual',
    
    -- Behavioral baselines and patterns
    behavior_baselines JSON NOT NULL, -- Statistical baselines for behavioral metrics
    behavior_patterns JSON, -- Identified behavioral patterns
    temporal_patterns JSON, -- Time-based behavior patterns
    interaction_patterns JSON, -- User interaction patterns
    navigation_patterns JSON, -- Site navigation patterns
    
    -- Risk assessment data
    base_risk_score DECIMAL(6,4) DEFAULT 0.0000,
    risk_factors JSON, -- Individual risk factor scores
    trust_score DECIMAL(6,4) DEFAULT 0.5000,
    reputation_score DECIMAL(6,4) DEFAULT 0.5000,
    
    -- Statistical data
    total_sessions INT DEFAULT 0,
    total_interactions BIGINT DEFAULT 0,
    data_quality_score DECIMAL(6,4) DEFAULT 0.0000,
    confidence_level DECIMAL(6,4) DEFAULT 0.0000,
    
    -- Profile metadata
    first_analyzed_at TIMESTAMP,
    last_analyzed_at TIMESTAMP,
    profile_version VARCHAR(20) DEFAULT '1.0',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_user_id (user_id),
    INDEX idx_profile_type (profile_type),
    INDEX idx_base_risk_score (base_risk_score DESC),
    INDEX idx_trust_score (trust_score DESC),
    INDEX idx_last_analyzed_at (last_analyzed_at DESC),
    INDEX idx_data_quality_score (data_quality_score DESC),
    
    UNIQUE KEY unique_user_profile (user_id, profile_type)
);

-- Behavioral pattern analysis results
CREATE TABLE IF NOT EXISTS behavior_pattern_analysis (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    analysis_session_id VARCHAR(100) NOT NULL, -- Unique session identifier
    
    -- Analysis input data
    behavior_data JSON NOT NULL, -- Raw behavioral data analyzed
    analysis_context JSON, -- Context and metadata for analysis
    
    -- Core analysis results
    anomaly_detection_results JSON, -- Anomaly detection outcomes
    fraud_analysis_results JSON, -- Fraud risk analysis
    abuse_analysis_results JSON, -- Abuse pattern detection
    security_assessment_results JSON, -- Security threat assessment
    
    -- Risk scoring and categorization
    composite_risk_score DECIMAL(6,4) NOT NULL,
    risk_level ENUM('low', 'medium', 'high', 'critical') NOT NULL,
    risk_category VARCHAR(100), -- fraud, abuse, security, anomaly
    confidence_score DECIMAL(6,4) NOT NULL,
    
    -- Behavioral insights
    behavioral_insights JSON, -- Generated insights and observations
    pattern_matches JSON, -- Matched behavioral patterns
    anomalies_detected JSON, -- List of detected anomalies
    
    -- Required actions
    immediate_actions_required JSON, -- Actions that need immediate attention
    recommended_actions JSON, -- Suggested follow-up actions
    escalation_required BOOLEAN DEFAULT FALSE,
    manual_review_required BOOLEAN DEFAULT FALSE,
    
    -- Processing metadata
    processing_time_ms INT,
    models_used JSON, -- ML models used for analysis
    service_version VARCHAR(50),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_user_id (user_id),
    INDEX idx_analysis_session_id (analysis_session_id),
    INDEX idx_composite_risk_score (composite_risk_score DESC),
    INDEX idx_risk_level (risk_level),
    INDEX idx_risk_category (risk_category),
    INDEX idx_confidence_score (confidence_score DESC),
    INDEX idx_escalation_required (escalation_required),
    INDEX idx_manual_review_required (manual_review_required),
    INDEX idx_created_at (created_at DESC),
    INDEX idx_high_risk_recent (risk_level, created_at DESC)
);

-- Fraud detection cases and incidents
CREATE TABLE IF NOT EXISTS fraud_detection_cases (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    case_id VARCHAR(100) UNIQUE NOT NULL, -- Human-readable case ID
    user_id BIGINT NOT NULL,
    behavior_analysis_id BIGINT, -- Links to behavior_pattern_analysis
    
    -- Case classification
    fraud_type ENUM('account_takeover', 'payment_fraud', 'identity_fraud', 'bot_behavior', 'social_engineering', 'other') NOT NULL,
    fraud_category VARCHAR(100), -- Specific fraud category
    severity ENUM('low', 'medium', 'high', 'critical') NOT NULL,
    
    -- Fraud indicators and evidence
    fraud_indicators JSON NOT NULL, -- Specific fraud indicators detected
    evidence_data JSON, -- Supporting evidence and data
    pattern_signatures JSON, -- Behavioral pattern signatures
    
    -- Risk assessment
    fraud_probability DECIMAL(6,4) NOT NULL, -- Probability this is fraud (0-1)
    confidence_level DECIMAL(6,4) NOT NULL, -- Confidence in assessment
    false_positive_risk DECIMAL(6,4), -- Estimated risk of false positive
    
    -- Case status and resolution
    case_status ENUM('open', 'investigating', 'confirmed_fraud', 'false_positive', 'resolved', 'escalated') DEFAULT 'open',
    investigation_assigned_to VARCHAR(100), -- Assigned investigator
    resolution_method VARCHAR(100), -- How case was resolved
    resolution_notes TEXT,
    
    -- Actions taken
    immediate_actions_taken JSON, -- Actions immediately executed
    prevention_measures_applied JSON, -- Prevention measures implemented
    user_notification_sent BOOLEAN DEFAULT FALSE,
    account_restrictions_applied JSON, -- Any account restrictions
    
    -- Timing and workflow
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    investigation_started_at TIMESTAMP NULL,
    resolved_at TIMESTAMP NULL,
    time_to_detection_hours DECIMAL(8,2), -- Time from fraud start to detection
    time_to_resolution_hours DECIMAL(8,2), -- Time from detection to resolution
    
    -- Impact assessment
    financial_impact DECIMAL(12,2), -- Estimated financial impact
    user_impact_score DECIMAL(6,4), -- Impact on affected users
    reputation_impact_score DECIMAL(6,4), -- Impact on platform reputation
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_case_id (case_id),
    INDEX idx_user_id (user_id),
    INDEX idx_behavior_analysis_id (behavior_analysis_id),
    INDEX idx_fraud_type (fraud_type),
    INDEX idx_severity (severity),
    INDEX idx_fraud_probability (fraud_probability DESC),
    INDEX idx_case_status (case_status),
    INDEX idx_detected_at (detected_at DESC),
    INDEX idx_investigation_assigned_to (investigation_assigned_to),
    INDEX idx_resolved_at (resolved_at DESC),
    INDEX idx_high_priority_cases (severity, case_status, detected_at DESC),
    
    FOREIGN KEY (behavior_analysis_id) REFERENCES behavior_pattern_analysis(id) ON DELETE SET NULL
);

-- Abuse detection and monitoring
CREATE TABLE IF NOT EXISTS abuse_detection_incidents (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    incident_id VARCHAR(100) UNIQUE NOT NULL,
    user_id BIGINT NOT NULL,
    behavior_analysis_id BIGINT,
    
    -- Abuse classification
    abuse_type ENUM('content_abuse', 'platform_abuse', 'harassment_abuse', 'financial_abuse', 'other') NOT NULL,
    abuse_category VARCHAR(100), -- Specific abuse category
    abuse_severity ENUM('minor', 'moderate', 'serious', 'severe') NOT NULL,
    
    -- Abuse details
    abuse_patterns JSON NOT NULL, -- Detected abuse patterns
    abuse_evidence JSON, -- Evidence of abusive behavior
    affected_users JSON, -- Other users affected by this abuse
    content_involved JSON, -- Content involved in abuse (if any)
    
    -- Detection and assessment
    detection_method ENUM('automated', 'user_report', 'manual_review', 'hybrid') DEFAULT 'automated',
    detection_confidence DECIMAL(6,4) NOT NULL,
    pattern_match_strength DECIMAL(6,4), -- How strongly patterns match known abuse
    
    -- Incident status and handling
    incident_status ENUM('detected', 'investigating', 'confirmed', 'false_positive', 'resolved', 'appealed') DEFAULT 'detected',
    handling_priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
    assigned_moderator VARCHAR(100),
    moderation_actions_taken JSON, -- Actions taken by moderators
    
    -- Response and mitigation
    automated_response JSON, -- Automated responses triggered
    user_warnings_issued INT DEFAULT 0,
    content_actions JSON, -- Actions taken on content (remove, flag, etc.)
    account_actions JSON, -- Actions taken on user account
    
    -- Appeal and resolution
    appeal_submitted BOOLEAN DEFAULT FALSE,
    appeal_details JSON, -- Appeal information if submitted
    final_resolution VARCHAR(200), -- Final resolution of incident
    resolution_notes TEXT,
    
    -- Timeline
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    investigation_started_at TIMESTAMP NULL,
    resolved_at TIMESTAMP NULL,
    appealed_at TIMESTAMP NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_incident_id (incident_id),
    INDEX idx_user_id (user_id),
    INDEX idx_behavior_analysis_id (behavior_analysis_id),
    INDEX idx_abuse_type (abuse_type),
    INDEX idx_abuse_severity (abuse_severity),
    INDEX idx_detection_confidence (detection_confidence DESC),
    INDEX idx_incident_status (incident_status),
    INDEX idx_handling_priority (handling_priority),
    INDEX idx_assigned_moderator (assigned_moderator),
    INDEX idx_detected_at (detected_at DESC),
    INDEX idx_resolved_at (resolved_at DESC),
    INDEX idx_active_incidents (incident_status, handling_priority, detected_at DESC),
    
    FOREIGN KEY (behavior_analysis_id) REFERENCES behavior_pattern_analysis(id) ON DELETE SET NULL
);

-- Security threat monitoring and alerts
CREATE TABLE IF NOT EXISTS security_threat_monitoring (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    threat_id VARCHAR(100) UNIQUE NOT NULL,
    user_id BIGINT,
    behavior_analysis_id BIGINT,
    
    -- Threat classification
    threat_type ENUM('login_anomalies', 'privilege_escalation', 'data_exfiltration', 'brute_force_attempts', 'session_hijacking', 'api_abuse', 'unauthorized_access') NOT NULL,
    threat_category VARCHAR(100),
    threat_severity ENUM('info', 'low', 'medium', 'high', 'critical') NOT NULL,
    
    -- Threat details
    threat_indicators JSON NOT NULL, -- Specific threat indicators
    threat_evidence JSON, -- Evidence of security threat
    attack_vectors JSON, -- Identified attack vectors
    vulnerability_exploited VARCHAR(200), -- Vulnerability being exploited (if known)
    
    -- Risk assessment
    threat_probability DECIMAL(6,4) NOT NULL, -- Probability this is a real threat
    impact_assessment JSON, -- Potential impact assessment
    urgency_score DECIMAL(6,4) NOT NULL, -- Urgency of response needed
    
    -- Detection and intelligence
    detection_source ENUM('behavioral_analysis', 'network_monitoring', 'threat_intelligence', 'user_report', 'system_alert') DEFAULT 'behavioral_analysis',
    threat_intelligence_match JSON, -- Matching threat intelligence data
    geolocation_data JSON, -- Geographic information related to threat
    device_fingerprint_data JSON, -- Device fingerprinting information
    
    -- Response and mitigation
    threat_status ENUM('detected', 'investigating', 'confirmed', 'mitigated', 'false_positive', 'ongoing') DEFAULT 'detected',
    automated_response JSON, -- Automated security responses triggered
    manual_interventions JSON, -- Manual security interventions
    containment_measures JSON, -- Measures taken to contain threat
    
    -- Investigation and resolution
    investigation_notes TEXT, -- Investigation findings and notes
    assigned_security_analyst VARCHAR(100), -- Assigned security analyst
    escalation_level INT DEFAULT 0, -- Escalation level (0 = not escalated)
    resolution_summary TEXT, -- Summary of how threat was resolved
    
    -- Timeline tracking
    threat_first_seen TIMESTAMP, -- When threat was first observed
    threat_last_seen TIMESTAMP, -- When threat was last observed
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    investigation_started_at TIMESTAMP NULL,
    mitigated_at TIMESTAMP NULL,
    
    -- Impact and metrics
    affected_systems JSON, -- Systems affected by threat
    data_accessed JSON, -- Data potentially accessed by threat
    business_impact_score DECIMAL(6,4), -- Business impact assessment
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_threat_id (threat_id),
    INDEX idx_user_id (user_id),
    INDEX idx_behavior_analysis_id (behavior_analysis_id),
    INDEX idx_threat_type (threat_type),
    INDEX idx_threat_severity (threat_severity),
    INDEX idx_threat_probability (threat_probability DESC),
    INDEX idx_threat_status (threat_status),
    INDEX idx_urgency_score (urgency_score DESC),
    INDEX idx_assigned_security_analyst (assigned_security_analyst),
    INDEX idx_detected_at (detected_at DESC),
    INDEX idx_threat_timeline (threat_first_seen, threat_last_seen),
    INDEX idx_active_threats (threat_status, threat_severity, detected_at DESC),
    INDEX idx_escalation_level (escalation_level DESC),
    
    FOREIGN KEY (behavior_analysis_id) REFERENCES behavior_pattern_analysis(id) ON DELETE SET NULL
);

-- Pattern recognition model performance and training
CREATE TABLE IF NOT EXISTS behavioral_model_performance (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    model_name VARCHAR(100) NOT NULL,
    model_type ENUM('anomaly_detection', 'fraud_classification', 'abuse_detection', 'security_monitoring', 'risk_scoring') NOT NULL,
    model_version VARCHAR(50) NOT NULL,
    
    -- Performance metrics
    performance_metric VARCHAR(100) NOT NULL, -- accuracy, precision, recall, f1, auc, etc.
    metric_value DECIMAL(10,6) NOT NULL,
    evaluation_dataset_size INT,
    test_dataset_size INT,
    
    -- Model characteristics
    algorithm_type VARCHAR(100), -- random_forest, neural_network, svm, etc.
    training_features JSON, -- Features used for training
    hyperparameters JSON, -- Model hyperparameters
    
    -- Training information
    training_data_period_start TIMESTAMP,
    training_data_period_end TIMESTAMP,
    training_duration_minutes INT,
    training_samples_count BIGINT,
    
    -- Validation and testing
    cross_validation_scores JSON, -- Cross-validation results
    confusion_matrix JSON, -- For classification models
    feature_importance JSON, -- Feature importance scores
    model_complexity_score DECIMAL(6,4), -- Complexity assessment
    
    -- Production performance
    false_positive_rate DECIMAL(6,4), -- Observed false positive rate in production
    false_negative_rate DECIMAL(6,4), -- Observed false negative rate in production
    detection_accuracy DECIMAL(6,4), -- Real-world detection accuracy
    avg_processing_time_ms DECIMAL(8,2), -- Average processing time
    
    -- Model lifecycle
    model_status ENUM('training', 'validation', 'production', 'deprecated', 'archived') DEFAULT 'training',
    deployment_date TIMESTAMP NULL,
    deprecation_date TIMESTAMP NULL,
    replacement_model_id BIGINT NULL, -- References id of replacement model
    
    -- Quality assurance
    validation_passed BOOLEAN DEFAULT FALSE,
    production_ready BOOLEAN DEFAULT FALSE,
    performance_degradation_detected BOOLEAN DEFAULT FALSE,
    last_performance_check TIMESTAMP,
    
    evaluated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_model_name (model_name),
    INDEX idx_model_type (model_type),
    INDEX idx_model_version (model_version),
    INDEX idx_performance_metric (performance_metric),
    INDEX idx_metric_value (metric_value DESC),
    INDEX idx_model_status (model_status),
    INDEX idx_production_ready (production_ready),
    INDEX idx_performance_degradation_detected (performance_degradation_detected),
    INDEX idx_evaluated_at (evaluated_at DESC),
    INDEX idx_model_performance (model_name, model_type, metric_value DESC),
    
    FOREIGN KEY (replacement_model_id) REFERENCES behavioral_model_performance(id) ON DELETE SET NULL
);

-- Behavioral analytics and reporting
CREATE TABLE IF NOT EXISTS behavioral_analytics (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    analysis_period_start TIMESTAMP NOT NULL,
    analysis_period_end TIMESTAMP NOT NULL,
    analysis_type ENUM('risk_trends', 'fraud_patterns', 'abuse_patterns', 'security_threats', 'user_behavior_trends', 'model_performance') NOT NULL,
    
    -- Analytics data
    analytics_data JSON NOT NULL, -- Detailed analytics results
    summary_metrics JSON NOT NULL, -- Key summary metrics
    trend_analysis JSON, -- Trend analysis results
    comparative_analysis JSON, -- Comparisons with previous periods
    
    -- Key findings
    key_insights JSON, -- Important insights discovered
    risk_assessment_summary JSON, -- Overall risk assessment
    recommendations JSON, -- Action recommendations
    alerts_generated JSON, -- Any alerts generated from analysis
    
    -- Data quality and confidence
    data_quality_score DECIMAL(6,4), -- Quality of underlying data
    analysis_confidence DECIMAL(6,4), -- Confidence in analysis results
    sample_size BIGINT, -- Number of records analyzed
    coverage_percentage DECIMAL(6,4), -- Percentage of total data covered
    
    -- Performance metrics
    analysis_processing_time_minutes INT, -- Time taken to generate analytics
    computation_complexity_score DECIMAL(6,4), -- Computational complexity
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_analysis_period (analysis_period_start, analysis_period_end),
    INDEX idx_analysis_type (analysis_type),
    INDEX idx_data_quality_score (data_quality_score DESC),
    INDEX idx_analysis_confidence (analysis_confidence DESC),
    INDEX idx_sample_size (sample_size DESC),
    INDEX idx_created_at (created_at DESC)
);

-- System configuration and thresholds
CREATE TABLE IF NOT EXISTS behavioral_system_config (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    config_category ENUM('risk_thresholds', 'model_parameters', 'alert_settings', 'processing_limits', 'feature_flags') NOT NULL,
    config_name VARCHAR(100) NOT NULL,
    config_value JSON NOT NULL,
    
    -- Configuration metadata
    config_description TEXT,
    default_value JSON, -- Default configuration value
    value_type ENUM('numeric', 'boolean', 'string', 'object', 'array') NOT NULL,
    validation_rules JSON, -- Rules for validating configuration values
    
    -- Environment and scope
    environment ENUM('development', 'staging', 'production', 'all') DEFAULT 'all',
    scope ENUM('global', 'user_segment', 'model_specific', 'feature_specific') DEFAULT 'global',
    target_identifier VARCHAR(200), -- Specific target (user segment, model name, etc.)
    
    -- Change management
    is_active BOOLEAN DEFAULT TRUE,
    requires_restart BOOLEAN DEFAULT FALSE,
    impact_assessment TEXT, -- Assessment of changing this configuration
    change_reason TEXT, -- Reason for configuration change
    
    -- Approval and auditing
    approved_by VARCHAR(100), -- Who approved this configuration
    approved_at TIMESTAMP NULL,
    last_modified_by VARCHAR(100), -- Who last modified this configuration
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_config_category (config_category),
    INDEX idx_config_name (config_name),
    INDEX idx_environment (environment),
    INDEX idx_scope (scope),
    INDEX idx_is_active (is_active),
    INDEX idx_target_identifier (target_identifier),
    INDEX idx_updated_at (updated_at DESC),
    
    UNIQUE KEY unique_config (config_category, config_name, environment, scope, target_identifier)
);

-- Insert default configurations
INSERT IGNORE INTO behavioral_system_config (config_category, config_name, config_value, config_description, value_type, environment) VALUES
-- Risk thresholds
('risk_thresholds', 'low_risk_threshold', '0.3', 'Threshold for low risk classification', 'numeric', 'all'),
('risk_thresholds', 'medium_risk_threshold', '0.6', 'Threshold for medium risk classification', 'numeric', 'all'),
('risk_thresholds', 'high_risk_threshold', '0.8', 'Threshold for high risk classification', 'numeric', 'all'),
('risk_thresholds', 'critical_risk_threshold', '0.95', 'Threshold for critical risk classification', 'numeric', 'all'),

-- Model parameters
('model_parameters', 'anomaly_detection_sensitivity', '3.0', 'Standard deviations for anomaly detection', 'numeric', 'all'),
('model_parameters', 'fraud_confidence_threshold', '0.8', 'Minimum confidence for fraud classification', 'numeric', 'all'),
('model_parameters', 'abuse_detection_threshold', '0.75', 'Threshold for abuse pattern detection', 'numeric', 'all'),

-- Alert settings
('alert_settings', 'enable_realtime_alerts', 'true', 'Enable real-time behavioral alerts', 'boolean', 'all'),
('alert_settings', 'alert_escalation_timeout_minutes', '30', 'Minutes before alert escalation', 'numeric', 'all'),
('alert_settings', 'max_alerts_per_user_per_hour', '5', 'Maximum alerts per user per hour', 'numeric', 'all'),

-- Processing limits
('processing_limits', 'max_concurrent_analyses', '10', 'Maximum concurrent behavioral analyses', 'numeric', 'all'),
('processing_limits', 'analysis_timeout_seconds', '120', 'Timeout for behavioral analysis', 'numeric', 'all'),
('processing_limits', 'batch_processing_size', '100', 'Size of batch processing groups', 'numeric', 'all'),

-- Feature flags
('feature_flags', 'enable_fraud_detection', 'true', 'Enable fraud detection capabilities', 'boolean', 'all'),
('feature_flags', 'enable_abuse_detection', 'true', 'Enable abuse pattern detection', 'boolean', 'all'),
('feature_flags', 'enable_security_monitoring', 'true', 'Enable security threat monitoring', 'boolean', 'all'),
('feature_flags', 'enable_behavioral_profiling', 'true', 'Enable behavioral profiling', 'boolean', 'all');

-- Create views for operational monitoring
CREATE OR REPLACE VIEW v_high_risk_users AS
SELECT 
    ubp.user_id,
    ubp.base_risk_score,
    ubp.trust_score,
    ubp.reputation_score,
    COUNT(bpa.id) as recent_analyses,
    MAX(bpa.composite_risk_score) as max_recent_risk_score,
    MAX(bpa.created_at) as last_analysis_date,
    COUNT(CASE WHEN bpa.risk_level IN ('high', 'critical') THEN 1 END) as high_risk_analyses,
    COUNT(CASE WHEN bpa.escalation_required = TRUE THEN 1 END) as escalations_required
FROM user_behavior_profiles ubp
LEFT JOIN behavior_pattern_analysis bpa ON ubp.user_id = bpa.user_id 
    AND bpa.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
WHERE ubp.base_risk_score >= 0.6 OR ubp.trust_score <= 0.3
GROUP BY ubp.user_id, ubp.base_risk_score, ubp.trust_score, ubp.reputation_score
ORDER BY ubp.base_risk_score DESC, max_recent_risk_score DESC;

CREATE OR REPLACE VIEW v_fraud_case_summary AS
SELECT 
    DATE(fdc.detected_at) as detection_date,
    fdc.fraud_type,
    fdc.severity,
    COUNT(*) as case_count,
    COUNT(CASE WHEN fdc.case_status = 'confirmed_fraud' THEN 1 END) as confirmed_cases,
    COUNT(CASE WHEN fdc.case_status = 'false_positive' THEN 1 END) as false_positives,
    AVG(fdc.fraud_probability) as avg_fraud_probability,
    AVG(fdc.time_to_detection_hours) as avg_detection_time_hours,
    AVG(fdc.time_to_resolution_hours) as avg_resolution_time_hours,
    SUM(COALESCE(fdc.financial_impact, 0)) as total_financial_impact
FROM fraud_detection_cases fdc
WHERE fdc.detected_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY DATE(fdc.detected_at), fdc.fraud_type, fdc.severity
ORDER BY detection_date DESC, case_count DESC;

CREATE OR REPLACE VIEW v_security_threat_dashboard AS
SELECT 
    stm.threat_type,
    stm.threat_severity,
    COUNT(*) as threat_count,
    COUNT(CASE WHEN stm.threat_status IN ('detected', 'investigating') THEN 1 END) as active_threats,
    COUNT(CASE WHEN stm.threat_status = 'confirmed' THEN 1 END) as confirmed_threats,
    AVG(stm.threat_probability) as avg_threat_probability,
    AVG(stm.urgency_score) as avg_urgency_score,
    MAX(stm.detected_at) as last_detection,
    COUNT(CASE WHEN stm.escalation_level > 0 THEN 1 END) as escalated_threats
FROM security_threat_monitoring stm
WHERE stm.detected_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY stm.threat_type, stm.threat_severity
ORDER BY threat_count DESC, avg_urgency_score DESC;

-- Create stored procedures for common operations
DELIMITER $$

CREATE PROCEDURE GetUserRiskAssessment(
    IN p_user_id BIGINT,
    IN p_analysis_days INT DEFAULT 30
)
BEGIN
    -- Get user behavior profile
    SELECT 
        ubp.*,
        COUNT(bpa.id) as recent_analyses,
        AVG(bpa.composite_risk_score) as avg_recent_risk_score,
        MAX(bpa.composite_risk_score) as max_recent_risk_score,
        COUNT(CASE WHEN bpa.risk_level IN ('high', 'critical') THEN 1 END) as high_risk_count,
        COUNT(fdc.id) as fraud_cases_count,
        COUNT(adi.id) as abuse_incidents_count,
        COUNT(stm.id) as security_threats_count
    FROM user_behavior_profiles ubp
    LEFT JOIN behavior_pattern_analysis bpa ON ubp.user_id = bpa.user_id 
        AND bpa.created_at >= DATE_SUB(NOW(), INTERVAL p_analysis_days DAY)
    LEFT JOIN fraud_detection_cases fdc ON ubp.user_id = fdc.user_id 
        AND fdc.detected_at >= DATE_SUB(NOW(), INTERVAL p_analysis_days DAY)
    LEFT JOIN abuse_detection_incidents adi ON ubp.user_id = adi.user_id 
        AND adi.detected_at >= DATE_SUB(NOW(), INTERVAL p_analysis_days DAY)
    LEFT JOIN security_threat_monitoring stm ON ubp.user_id = stm.user_id 
        AND stm.detected_at >= DATE_SUB(NOW(), INTERVAL p_analysis_days DAY)
    WHERE ubp.user_id = p_user_id
    GROUP BY ubp.id;
END$$

CREATE PROCEDURE UpdateUserBehaviorProfile(
    IN p_user_id BIGINT,
    IN p_behavior_baselines JSON,
    IN p_base_risk_score DECIMAL(6,4),
    IN p_trust_score DECIMAL(6,4),
    IN p_data_quality_score DECIMAL(6,4)
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    INSERT INTO user_behavior_profiles (
        user_id, behavior_baselines, base_risk_score, trust_score, 
        data_quality_score, first_analyzed_at, last_analyzed_at
    ) VALUES (
        p_user_id, p_behavior_baselines, p_base_risk_score, p_trust_score,
        p_data_quality_score, NOW(), NOW()
    ) ON DUPLICATE KEY UPDATE
        behavior_baselines = p_behavior_baselines,
        base_risk_score = p_base_risk_score,
        trust_score = p_trust_score,
        data_quality_score = p_data_quality_score,
        last_analyzed_at = NOW(),
        total_sessions = total_sessions + 1,
        updated_at = NOW();
    
    COMMIT;
END$$

DELIMITER ;

-- Create performance indexes for optimal query execution
ALTER TABLE user_behavior_profiles ADD INDEX idx_risk_assessment (base_risk_score DESC, trust_score ASC, last_analyzed_at DESC);
ALTER TABLE behavior_pattern_analysis ADD INDEX idx_risk_analysis (user_id, composite_risk_score DESC, created_at DESC);
ALTER TABLE fraud_detection_cases ADD INDEX idx_fraud_monitoring (user_id, fraud_type, case_status, detected_at DESC);
ALTER TABLE abuse_detection_incidents ADD INDEX idx_abuse_monitoring (user_id, abuse_type, incident_status, detected_at DESC);
ALTER TABLE security_threat_monitoring ADD INDEX idx_threat_monitoring (user_id, threat_type, threat_status, detected_at DESC);

-- Grant permissions for behavioral pattern recognition service
-- Note: In production, create a dedicated behavioral analysis service user
-- GRANT SELECT, INSERT, UPDATE, DELETE ON phoenix4ge.user_behavior_profiles TO 'behavioral_service'@'localhost';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON phoenix4ge.behavior_pattern_analysis TO 'behavioral_service'@'localhost';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON phoenix4ge.fraud_detection_cases TO 'behavioral_service'@'localhost';
-- GRANT EXECUTE ON PROCEDURE phoenix4ge.GetUserRiskAssessment TO 'behavioral_service'@'localhost';
-- GRANT EXECUTE ON PROCEDURE phoenix4ge.UpdateUserBehaviorProfile TO 'behavioral_service'@'localhost';

SELECT 'Behavioral Pattern Recognition and Fraud Detection migration completed successfully' as status;