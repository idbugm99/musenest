-- Voice Interface and Accessibility Features Migration
-- Adds comprehensive tables for voice interface capabilities, accessibility preferences,
-- user accessibility profiles, voice command history, and accessibility analytics

USE phoenix4ge;

-- User accessibility profiles and preferences
CREATE TABLE IF NOT EXISTS user_accessibility_profiles (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    profile_name VARCHAR(200) DEFAULT 'Default Profile',
    
    -- Voice recognition settings
    voice_recognition_enabled BOOLEAN DEFAULT FALSE,
    voice_language VARCHAR(10) DEFAULT 'en-US',
    voice_confidence_threshold DECIMAL(4,2) DEFAULT 0.70,
    continuous_listening BOOLEAN DEFAULT FALSE,
    activation_phrases JSON, -- Custom activation phrases
    
    -- Text-to-speech settings
    speech_synthesis_enabled BOOLEAN DEFAULT FALSE,
    speech_rate DECIMAL(4,2) DEFAULT 1.00, -- 0.1 to 10.0
    speech_pitch DECIMAL(4,2) DEFAULT 1.00, -- 0 to 2.0
    speech_volume DECIMAL(4,2) DEFAULT 1.00, -- 0 to 1.0
    preferred_voice VARCHAR(100) DEFAULT 'system_default',
    auto_read_new_content BOOLEAN DEFAULT FALSE,
    
    -- Visual accessibility settings
    high_contrast_mode BOOLEAN DEFAULT FALSE,
    dark_mode BOOLEAN DEFAULT FALSE,
    font_size_multiplier DECIMAL(4,2) DEFAULT 1.00, -- 0.5 to 3.0
    font_family VARCHAR(100) DEFAULT 'system-default',
    reduced_motion BOOLEAN DEFAULT FALSE,
    focus_enhancement BOOLEAN DEFAULT FALSE,
    color_inversion BOOLEAN DEFAULT FALSE,
    
    -- Color accessibility
    colorblind_friendly_mode BOOLEAN DEFAULT FALSE,
    colorblind_type ENUM('none', 'protanopia', 'deuteranopia', 'tritanopia') DEFAULT 'none',
    alternative_color_indicators BOOLEAN DEFAULT FALSE,
    
    -- Keyboard navigation settings
    keyboard_navigation_enabled BOOLEAN DEFAULT TRUE,
    tab_navigation_enhanced BOOLEAN DEFAULT FALSE,
    keyboard_shortcuts_enabled BOOLEAN DEFAULT TRUE,
    custom_keyboard_shortcuts JSON, -- Custom shortcut mappings
    focus_indicators_enhanced BOOLEAN DEFAULT FALSE,
    
    -- Motor accessibility settings
    increased_click_targets BOOLEAN DEFAULT FALSE,
    hover_alternatives BOOLEAN DEFAULT FALSE,
    drag_drop_alternatives BOOLEAN DEFAULT TRUE,
    click_delay_ms INT DEFAULT 0, -- 0 to 2000ms
    hover_delay_ms INT DEFAULT 500, -- 0 to 5000ms
    sticky_keys_support BOOLEAN DEFAULT FALSE,
    
    -- Cognitive accessibility settings
    simplified_interface BOOLEAN DEFAULT FALSE,
    reduced_distractions BOOLEAN DEFAULT FALSE,
    reading_guide BOOLEAN DEFAULT FALSE,
    text_highlighting BOOLEAN DEFAULT FALSE,
    progress_indicators_enhanced BOOLEAN DEFAULT TRUE,
    confirmation_dialogs_enabled BOOLEAN DEFAULT TRUE,
    
    -- Screen reader settings
    screen_reader_optimized BOOLEAN DEFAULT FALSE,
    aria_descriptions_verbose BOOLEAN DEFAULT TRUE,
    skip_links_enabled BOOLEAN DEFAULT TRUE,
    landmark_navigation_enabled BOOLEAN DEFAULT TRUE,
    content_structure_announcements BOOLEAN DEFAULT TRUE,
    
    -- Performance and compatibility settings
    performance_mode ENUM('battery_saver', 'balanced', 'performance') DEFAULT 'balanced',
    bandwidth_considerations BOOLEAN DEFAULT TRUE,
    compatibility_mode BOOLEAN DEFAULT FALSE,
    
    -- Profile metadata
    settings_version INT DEFAULT 1,
    profile_active BOOLEAN DEFAULT TRUE,
    last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_user_id (user_id),
    INDEX idx_profile_active (profile_active),
    INDEX idx_voice_recognition (voice_recognition_enabled),
    INDEX idx_speech_synthesis (speech_synthesis_enabled),
    INDEX idx_high_contrast (high_contrast_mode),
    INDEX idx_keyboard_navigation (keyboard_navigation_enabled),
    INDEX idx_screen_reader (screen_reader_optimized),
    INDEX idx_last_used_at (last_used_at DESC),
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Voice command history and analytics
CREATE TABLE IF NOT EXISTS voice_command_history (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    session_id VARCHAR(100), -- Voice session identifier
    
    -- Voice input details
    original_voice_input TEXT,
    processed_voice_input TEXT,
    voice_language VARCHAR(10) DEFAULT 'en-US',
    voice_confidence DECIMAL(6,4), -- Speech recognition confidence
    
    -- Command analysis
    detected_command VARCHAR(200),
    command_category ENUM('navigation', 'application', 'accessibility', 'content', 'system') NOT NULL,
    command_intent VARCHAR(100),
    command_parameters JSON, -- Extracted parameters from command
    
    -- Command execution
    command_executed BOOLEAN DEFAULT FALSE,
    execution_success BOOLEAN DEFAULT FALSE,
    execution_result JSON, -- Result of command execution
    execution_time_ms INT, -- Time to execute command
    error_message TEXT, -- Error if execution failed
    
    -- Context and metadata
    page_context VARCHAR(500), -- Page/section where command was issued
    user_context JSON, -- User context at time of command
    device_context JSON, -- Device/browser context
    
    -- User feedback
    user_feedback ENUM('helpful', 'not_helpful', 'partially_helpful') DEFAULT NULL,
    user_feedback_text TEXT,
    feedback_timestamp TIMESTAMP NULL,
    
    -- Performance metrics
    processing_time_ms INT, -- Total processing time
    accuracy_score DECIMAL(6,4), -- Command accuracy score
    user_satisfaction_score DECIMAL(4,2), -- 1.0 to 5.0
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_user_id (user_id),
    INDEX idx_session_id (session_id),
    INDEX idx_command_category (command_category),
    INDEX idx_detected_command (detected_command),
    INDEX idx_execution_success (execution_success),
    INDEX idx_created_at (created_at DESC),
    INDEX idx_user_feedback (user_feedback),
    INDEX idx_command_performance (accuracy_score DESC, user_satisfaction_score DESC),
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Speech synthesis history and performance
CREATE TABLE IF NOT EXISTS speech_synthesis_history (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    session_id VARCHAR(100),
    
    -- Text input
    original_text TEXT NOT NULL,
    processed_text TEXT NOT NULL,
    text_language VARCHAR(10) DEFAULT 'en',
    text_length INT, -- Character count
    word_count INT,
    
    -- Speech synthesis settings
    synthesis_voice VARCHAR(100),
    synthesis_rate DECIMAL(4,2),
    synthesis_pitch DECIMAL(4,2),
    synthesis_volume DECIMAL(4,2),
    synthesis_method ENUM('web_speech_api', 'neural_tts', 'cloud_tts') DEFAULT 'web_speech_api',
    
    -- Audio output
    audio_duration_ms INT,
    audio_quality_score DECIMAL(6,4),
    audio_file_size_bytes BIGINT,
    audio_format VARCHAR(20) DEFAULT 'wav',
    
    -- Performance metrics
    synthesis_time_ms INT, -- Time to generate speech
    synthesis_success BOOLEAN DEFAULT TRUE,
    synthesis_error_message TEXT,
    
    -- Context and usage
    content_type ENUM('page_content', 'notification', 'error_message', 'help_text', 'user_interface') NOT NULL,
    triggered_by ENUM('user_request', 'auto_read', 'accessibility_feature', 'system_notification') NOT NULL,
    
    -- User interaction
    playback_completed BOOLEAN DEFAULT FALSE,
    playback_interrupted BOOLEAN DEFAULT FALSE,
    playback_paused_count INT DEFAULT 0,
    user_rating ENUM('excellent', 'good', 'satisfactory', 'poor') DEFAULT NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_user_id (user_id),
    INDEX idx_session_id (session_id),
    INDEX idx_content_type (content_type),
    INDEX idx_triggered_by (triggered_by),
    INDEX idx_synthesis_success (synthesis_success),
    INDEX idx_synthesis_method (synthesis_method),
    INDEX idx_created_at (created_at DESC),
    INDEX idx_audio_quality (audio_quality_score DESC),
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Accessibility feature usage analytics
CREATE TABLE IF NOT EXISTS accessibility_feature_usage (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    
    -- Feature identification
    feature_name VARCHAR(200) NOT NULL,
    feature_category ENUM('voice_interface', 'visual_accessibility', 'motor_accessibility', 
                         'keyboard_navigation', 'screen_reader', 'cognitive_accessibility') NOT NULL,
    feature_type ENUM('toggle', 'adjustment', 'command', 'automation') NOT NULL,
    
    -- Usage details
    feature_enabled BOOLEAN,
    feature_value TEXT, -- Setting value (for adjustments)
    usage_frequency INT DEFAULT 1, -- Number of times used in session
    session_duration_minutes INT, -- How long feature was active
    
    -- Context
    page_context VARCHAR(500),
    device_context JSON,
    browser_context JSON,
    
    -- Impact measurement
    task_completion_improved BOOLEAN DEFAULT NULL,
    user_effort_reduced BOOLEAN DEFAULT NULL,
    accessibility_barrier_removed BOOLEAN DEFAULT NULL,
    error_rate_reduced BOOLEAN DEFAULT NULL,
    
    -- User feedback
    feature_helpfulness_score DECIMAL(4,2), -- 1.0 to 5.0
    feature_ease_of_use_score DECIMAL(4,2), -- 1.0 to 5.0
    would_recommend BOOLEAN DEFAULT NULL,
    user_comments TEXT,
    
    -- Performance impact
    page_load_time_impact_ms INT DEFAULT 0,
    battery_usage_impact_percentage DECIMAL(6,4) DEFAULT 0.0000,
    cpu_usage_impact_percentage DECIMAL(6,4) DEFAULT 0.0000,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_user_id (user_id),
    INDEX idx_feature_name (feature_name),
    INDEX idx_feature_category (feature_category),
    INDEX idx_feature_enabled (feature_enabled),
    INDEX idx_created_at (created_at DESC),
    INDEX idx_helpfulness_score (feature_helpfulness_score DESC),
    INDEX idx_ease_of_use_score (feature_ease_of_use_score DESC),
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Accessibility compliance and validation
CREATE TABLE IF NOT EXISTS accessibility_compliance_checks (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    
    -- Check identification
    check_id VARCHAR(100) UNIQUE NOT NULL,
    check_name VARCHAR(300) NOT NULL,
    check_description TEXT,
    
    -- Compliance standards
    wcag_level ENUM('A', 'AA', 'AAA') NOT NULL,
    wcag_guideline VARCHAR(20), -- e.g., "1.4.3", "2.1.1"
    compliance_standard ENUM('WCAG_2.1', 'WCAG_2.2', 'Section_508', 'ADA', 'EN_301_549') DEFAULT 'WCAG_2.1',
    
    -- Check details
    check_type ENUM('automated', 'manual', 'user_testing') NOT NULL,
    severity ENUM('critical', 'serious', 'moderate', 'minor') NOT NULL,
    impact_areas JSON, -- Areas impacted (vision, hearing, motor, cognitive)
    
    -- Validation criteria
    validation_method TEXT,
    success_criteria TEXT,
    failure_conditions TEXT,
    
    -- Check execution
    last_checked_at TIMESTAMP,
    check_frequency ENUM('daily', 'weekly', 'monthly', 'on_demand') DEFAULT 'weekly',
    automated_check_enabled BOOLEAN DEFAULT TRUE,
    
    -- Results tracking
    total_checks_performed BIGINT DEFAULT 0,
    total_passes BIGINT DEFAULT 0,
    total_failures BIGINT DEFAULT 0,
    current_compliance_status ENUM('compliant', 'non_compliant', 'needs_review', 'not_applicable') DEFAULT 'needs_review',
    
    -- Improvement tracking
    remediation_priority INT DEFAULT 50, -- 1-100
    estimated_fix_effort_hours DECIMAL(6,2),
    remediation_status ENUM('not_started', 'in_progress', 'completed', 'deferred') DEFAULT 'not_started',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_check_id (check_id),
    INDEX idx_wcag_level (wcag_level),
    INDEX idx_check_type (check_type),
    INDEX idx_severity (severity),
    INDEX idx_compliance_status (current_compliance_status),
    INDEX idx_remediation_status (remediation_status),
    INDEX idx_last_checked_at (last_checked_at DESC),
    
    UNIQUE KEY unique_check_name (check_name)
);

-- Voice interface sessions and analytics
CREATE TABLE IF NOT EXISTS voice_interface_sessions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    session_id VARCHAR(100) UNIQUE NOT NULL,
    
    -- Session details
    session_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    session_end TIMESTAMP NULL,
    session_duration_seconds INT DEFAULT 0,
    session_status ENUM('active', 'completed', 'interrupted', 'error') DEFAULT 'active',
    
    -- Voice configuration used
    voice_language VARCHAR(10),
    confidence_threshold DECIMAL(4,2),
    synthesis_voice VARCHAR(100),
    speech_rate DECIMAL(4,2),
    
    -- Session metrics
    total_commands_issued INT DEFAULT 0,
    successful_commands INT DEFAULT 0,
    failed_commands INT DEFAULT 0,
    average_command_confidence DECIMAL(6,4),
    average_processing_time_ms DECIMAL(8,2),
    
    -- Audio metrics
    total_audio_generated_seconds INT DEFAULT 0,
    audio_playback_interruptions INT DEFAULT 0,
    audio_quality_issues INT DEFAULT 0,
    
    -- User interaction
    user_initiated_end BOOLEAN DEFAULT FALSE,
    accessibility_barriers_encountered INT DEFAULT 0,
    help_requested_count INT DEFAULT 0,
    
    -- Performance metrics
    cpu_usage_percentage DECIMAL(6,4),
    memory_usage_mb DECIMAL(8,2),
    battery_drain_percentage DECIMAL(6,4),
    network_usage_kb DECIMAL(10,2),
    
    -- Session context
    device_capabilities JSON,
    browser_support JSON,
    accessibility_features_used JSON,
    
    -- User feedback
    session_satisfaction_rating DECIMAL(4,2), -- 1.0 to 5.0
    session_effectiveness_rating DECIMAL(4,2), -- 1.0 to 5.0
    would_use_again BOOLEAN DEFAULT NULL,
    session_feedback_text TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_user_id (user_id),
    INDEX idx_session_id (session_id),
    INDEX idx_session_status (session_status),
    INDEX idx_session_start (session_start DESC),
    INDEX idx_session_satisfaction (session_satisfaction_rating DESC),
    INDEX idx_session_effectiveness (session_effectiveness_rating DESC),
    INDEX idx_successful_commands (successful_commands DESC),
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Insert default accessibility compliance checks
INSERT IGNORE INTO accessibility_compliance_checks (
    check_id, check_name, check_description, wcag_level, wcag_guideline, 
    check_type, severity, impact_areas, validation_method
) VALUES
('WCAG_1_1_1_IMG_ALT', 'Images have alternative text', 'All informative images must have meaningful alternative text', 'A', '1.1.1', 'automated', 'critical', '["vision"]', 'Check for img elements without alt attributes or empty alt text'),
('WCAG_1_4_3_CONTRAST', 'Color contrast meets AA standards', 'Text and background colors must have sufficient contrast ratio', 'AA', '1.4.3', 'automated', 'serious', '["vision"]', 'Calculate contrast ratios for all text elements'),
('WCAG_2_1_1_KEYBOARD', 'All functionality keyboard accessible', 'All interactive elements must be operable via keyboard', 'A', '2.1.1', 'manual', 'critical', '["motor"]', 'Test keyboard navigation through all interactive elements'),
('WCAG_2_4_1_SKIP_LINKS', 'Skip navigation links provided', 'Skip links must be provided to bypass repetitive content', 'A', '2.4.1', 'automated', 'moderate', '["motor", "vision"]', 'Check for skip link presence and functionality'),
('WCAG_3_1_1_PAGE_LANGUAGE', 'Page language specified', 'Page language must be programmatically specified', 'A', '3.1.1', 'automated', 'moderate', '["hearing", "vision"]', 'Check for lang attribute on html element'),
('WCAG_4_1_2_NAME_ROLE_VALUE', 'Name, role, value available', 'UI components must have accessible names, roles, and values', 'A', '4.1.2', 'automated', 'critical', '["vision", "motor"]', 'Validate ARIA attributes and semantic markup');

-- Insert default user accessibility profile for system defaults
INSERT IGNORE INTO user_accessibility_profiles (
    user_id, profile_name, voice_recognition_enabled, speech_synthesis_enabled,
    high_contrast_mode, keyboard_navigation_enabled, screen_reader_optimized,
    profile_active
) VALUES 
(0, 'System Default Profile', FALSE, FALSE, FALSE, TRUE, FALSE, TRUE);

-- Create views for accessibility analytics
CREATE OR REPLACE VIEW v_accessibility_usage_summary AS
SELECT 
    DATE(afu.created_at) as usage_date,
    afu.feature_category,
    COUNT(*) as total_usage_events,
    COUNT(DISTINCT afu.user_id) as unique_users,
    AVG(afu.feature_helpfulness_score) as avg_helpfulness,
    AVG(afu.feature_ease_of_use_score) as avg_ease_of_use,
    COUNT(CASE WHEN afu.task_completion_improved = TRUE THEN 1 END) as improved_task_completion,
    COUNT(CASE WHEN afu.accessibility_barrier_removed = TRUE THEN 1 END) as barriers_removed,
    AVG(afu.session_duration_minutes) as avg_session_duration
FROM accessibility_feature_usage afu
WHERE afu.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY DATE(afu.created_at), afu.feature_category
ORDER BY usage_date DESC, total_usage_events DESC;

CREATE OR REPLACE VIEW v_voice_interface_performance AS
SELECT 
    DATE(vis.session_start) as session_date,
    COUNT(*) as total_sessions,
    AVG(vis.session_duration_seconds) as avg_session_duration,
    AVG(vis.successful_commands) as avg_successful_commands,
    AVG(vis.average_command_confidence) as avg_command_confidence,
    AVG(vis.session_satisfaction_rating) as avg_satisfaction,
    COUNT(CASE WHEN vis.session_status = 'completed' THEN 1 END) as completed_sessions,
    COUNT(CASE WHEN vis.session_status = 'interrupted' THEN 1 END) as interrupted_sessions,
    AVG(vis.cpu_usage_percentage) as avg_cpu_usage,
    AVG(vis.battery_drain_percentage) as avg_battery_drain
FROM voice_interface_sessions vis
WHERE vis.session_start >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY DATE(vis.session_start)
ORDER BY session_date DESC;

CREATE OR REPLACE VIEW v_accessibility_compliance_status AS
SELECT 
    acc.wcag_level,
    acc.compliance_standard,
    COUNT(*) as total_checks,
    COUNT(CASE WHEN acc.current_compliance_status = 'compliant' THEN 1 END) as compliant_checks,
    COUNT(CASE WHEN acc.current_compliance_status = 'non_compliant' THEN 1 END) as non_compliant_checks,
    COUNT(CASE WHEN acc.current_compliance_status = 'needs_review' THEN 1 END) as needs_review_checks,
    ROUND((COUNT(CASE WHEN acc.current_compliance_status = 'compliant' THEN 1 END) / COUNT(*)) * 100, 2) as compliance_percentage,
    AVG(acc.estimated_fix_effort_hours) as avg_fix_effort,
    COUNT(CASE WHEN acc.remediation_status = 'completed' THEN 1 END) as remediation_completed
FROM accessibility_compliance_checks acc
GROUP BY acc.wcag_level, acc.compliance_standard
ORDER BY acc.wcag_level, compliance_percentage DESC;

-- Create stored procedures for voice and accessibility operations
DELIMITER $$

CREATE PROCEDURE StartVoiceInterfaceSession(
    IN p_user_id BIGINT,
    IN p_voice_language VARCHAR(10) DEFAULT 'en-US',
    IN p_device_capabilities JSON DEFAULT NULL
)
BEGIN
    DECLARE v_session_id VARCHAR(100);
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    -- Generate session ID
    SET v_session_id = CONCAT('VOICE_', UNIX_TIMESTAMP(), '_', p_user_id, '_', SUBSTRING(MD5(RAND()), 1, 6));
    
    -- Create voice interface session
    INSERT INTO voice_interface_sessions (
        user_id,
        session_id,
        voice_language,
        device_capabilities
    ) VALUES (
        p_user_id,
        v_session_id,
        p_voice_language,
        p_device_capabilities
    );
    
    SELECT v_session_id as session_id, 'Voice interface session started' as message;
    
    COMMIT;
END$$

CREATE PROCEDURE GetAccessibilityAnalytics(
    IN p_start_date DATE DEFAULT NULL,
    IN p_end_date DATE DEFAULT NULL,
    IN p_user_id BIGINT DEFAULT NULL
)
BEGIN
    DECLARE v_start_date DATE DEFAULT COALESCE(p_start_date, DATE_SUB(CURDATE(), INTERVAL 30 DAY));
    DECLARE v_end_date DATE DEFAULT COALESCE(p_end_date, CURDATE());
    
    -- Accessibility feature usage summary
    SELECT 
        'Feature Usage Summary' as section,
        feature_category,
        COUNT(*) as usage_events,
        COUNT(DISTINCT user_id) as unique_users,
        AVG(feature_helpfulness_score) as avg_helpfulness,
        AVG(feature_ease_of_use_score) as avg_ease_of_use
    FROM accessibility_feature_usage
    WHERE DATE(created_at) BETWEEN v_start_date AND v_end_date
      AND (p_user_id IS NULL OR user_id = p_user_id)
    GROUP BY feature_category
    ORDER BY usage_events DESC;
    
    -- Voice interface performance
    SELECT 
        'Voice Interface Performance' as section,
        COUNT(*) as total_sessions,
        AVG(session_duration_seconds) as avg_duration_seconds,
        AVG(successful_commands) as avg_successful_commands,
        AVG(session_satisfaction_rating) as avg_satisfaction
    FROM voice_interface_sessions
    WHERE DATE(session_start) BETWEEN v_start_date AND v_end_date
      AND (p_user_id IS NULL OR user_id = p_user_id);
    
    -- Compliance status overview
    SELECT 
        'Compliance Status' as section,
        wcag_level,
        COUNT(*) as total_checks,
        SUM(CASE WHEN current_compliance_status = 'compliant' THEN 1 ELSE 0 END) as compliant,
        SUM(CASE WHEN current_compliance_status = 'non_compliant' THEN 1 ELSE 0 END) as non_compliant,
        ROUND((SUM(CASE WHEN current_compliance_status = 'compliant' THEN 1 ELSE 0 END) / COUNT(*)) * 100, 2) as compliance_percentage
    FROM accessibility_compliance_checks
    GROUP BY wcag_level
    ORDER BY wcag_level;
END$$

DELIMITER ;

-- Create indexes for optimal voice and accessibility query performance
ALTER TABLE user_accessibility_profiles ADD INDEX idx_accessibility_features (voice_recognition_enabled, speech_synthesis_enabled, high_contrast_mode, keyboard_navigation_enabled);
ALTER TABLE voice_command_history ADD INDEX idx_command_performance (execution_success, accuracy_score DESC, user_satisfaction_score DESC);
ALTER TABLE speech_synthesis_history ADD INDEX idx_synthesis_performance (synthesis_success, audio_quality_score DESC, user_rating);
ALTER TABLE accessibility_feature_usage ADD INDEX idx_feature_impact (task_completion_improved, accessibility_barrier_removed, feature_helpfulness_score DESC);

-- Grant permissions for voice and accessibility service
-- Note: In production, create dedicated service users
-- GRANT SELECT, INSERT, UPDATE, DELETE ON phoenix4ge.user_accessibility_profiles TO 'accessibility_service'@'localhost';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON phoenix4ge.voice_command_history TO 'accessibility_service'@'localhost';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON phoenix4ge.speech_synthesis_history TO 'accessibility_service'@'localhost';
-- GRANT EXECUTE ON PROCEDURE phoenix4ge.StartVoiceInterfaceSession TO 'accessibility_service'@'localhost';
-- GRANT EXECUTE ON PROCEDURE phoenix4ge.GetAccessibilityAnalytics TO 'accessibility_service'@'localhost';

SELECT 'Voice Interface and Accessibility Features system migration completed successfully' as status;