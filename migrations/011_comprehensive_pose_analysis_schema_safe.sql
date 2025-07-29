-- MuseNest Database Migration 011 - SAFE VERSION
-- Comprehensive Pose Analysis Schema for Adult/Child Content Safety
-- Run date: 2025-07-29

-- Drop existing tables if they exist (in reverse dependency order)
DROP VIEW IF EXISTS content_reports_dashboard;
DROP VIEW IF EXISTS human_review_queue;
DROP VIEW IF EXISTS content_moderation_dashboard;
DROP VIEW IF EXISTS ai_description_management;
DROP VIEW IF EXISTS body_part_violations_by_context;
DROP VIEW IF EXISTS complete_content_analysis;
DROP VIEW IF EXISTS flagged_pose_content;
DROP VIEW IF EXISTS pose_analysis_summary;

DROP TABLE IF EXISTS analysis_detected_keywords;
DROP TABLE IF EXISTS analysis_processing_queue;
DROP TABLE IF EXISTS moderation_appeals;
DROP TABLE IF EXISTS content_reports;
DROP TABLE IF EXISTS pose_approval_audit;
DROP TABLE IF EXISTS ai_image_descriptions;
DROP TABLE IF EXISTS image_analysis_keywords;
DROP TABLE IF EXISTS pose_context_config;
DROP TABLE IF EXISTS adult_pose_analysis;
DROP TABLE IF EXISTS age_pose_indicators;
DROP TABLE IF EXISTS body_part_combination_rules;
DROP TABLE IF EXISTS nudenet_analysis_summary;
DROP TABLE IF EXISTS body_part_allowances;
DROP TABLE IF EXISTS nudenet_detections;
DROP TABLE IF EXISTS pose_rule_evaluations;
DROP TABLE IF EXISTS pose_analysis_rules;
DROP TABLE IF EXISTS limb_analysis;
DROP TABLE IF EXISTS pose_metrics;
DROP TABLE IF EXISTS pose_landmarks;
DROP TABLE IF EXISTS image_moderation_queue;

-- ===================================
-- CORE CONTENT MODERATION WORKFLOW
-- ===================================

-- Main image moderation tracking table (workflow hub)
CREATE TABLE image_moderation_queue (
    id INT PRIMARY KEY AUTO_INCREMENT,
    image_id VARCHAR(255) NOT NULL UNIQUE, -- Unique identifier for the image
    model_id INT NOT NULL,
    slug VARCHAR(100) NOT NULL, -- Model slug for URL routing
    
    -- File information
    original_filename VARCHAR(255) NOT NULL,
    current_filename VARCHAR(255), -- Updates when client renames
    file_path VARCHAR(500) NOT NULL, -- Full path to image file
    file_hash VARCHAR(64) NOT NULL, -- SHA-256 for duplicate detection
    file_size_bytes INT DEFAULT 0,
    image_width INT DEFAULT 0,
    image_height INT DEFAULT 0,
    
    -- Processing workflow status
    status ENUM(
        'uploaded',           -- Just uploaded, pending analysis
        'analyzing',          -- Currently being processed by AI
        'ai_approved',        -- AI auto-approved for tier(s)
        'flagged',            -- Requires human review
        'human_approved',     -- Human reviewer approved
        'rejected',           -- Not suitable for any tier
        'appeals_pending',    -- Under appeal review
        'quarantined'         -- Immediate removal (CSAM suspected)
    ) DEFAULT 'uploaded',
    
    -- Analysis linkage
    analysis_id VARCHAR(255) UNIQUE, -- Links to pose_metrics table
    
    -- Tier approval status
    approved_for_tiers JSON, -- Array: ['public_gallery', 'private_content', 'paysite']
    auto_approved BOOLEAN DEFAULT FALSE,
    requires_blur JSON, -- Which body parts need blurring: ['female_breast', 'buttocks']
    
    -- Review and approval tracking
    approved_by_user_id INT, -- Who approved this content
    reviewed_by_user_id INT, -- Who did the human review
    approval_timestamp TIMESTAMP NULL,
    review_notes TEXT,
    
    -- Priority and risk assessment
    priority_level ENUM(
        'CRITICAL_CHILD_SAFETY',   -- Suspected minor + explicit content
        'HIGH_RISK_AGE_UNCERTAIN', -- Explicit content, age unclear
        'MEDIUM_RISK',             -- Flagged for standard review
        'LOW_RISK',                -- Minor policy violations
        'ROUTINE'                  -- Standard processing
    ) DEFAULT 'ROUTINE',
    
    risk_score DECIMAL(5,2) DEFAULT 0.0, -- 0-100 combined risk assessment
    child_safety_flag BOOLEAN DEFAULT FALSE, -- Special handling required
    
    -- Processing timestamps
    upload_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    analysis_start_timestamp TIMESTAMP NULL,
    analysis_complete_timestamp TIMESTAMP NULL,
    first_review_timestamp TIMESTAMP NULL,
    final_decision_timestamp TIMESTAMP NULL,
    
    -- Metadata
    upload_ip_address VARCHAR(45), -- For abuse tracking (supports IPv6)
    user_agent TEXT, -- Browser/client info
    
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by_user_id) REFERENCES users(id),
    FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id),
    
    INDEX idx_status (status),
    INDEX idx_model_id (model_id),
    INDEX idx_priority_level (priority_level),
    INDEX idx_child_safety_flag (child_safety_flag),
    INDEX idx_file_hash (file_hash),
    INDEX idx_analysis_id (analysis_id),
    INDEX idx_upload_timestamp (upload_timestamp),
    INDEX idx_final_decision_timestamp (final_decision_timestamp)
);

-- User-initiated content reports
CREATE TABLE content_reports (
    id INT PRIMARY KEY AUTO_INCREMENT,
    image_id VARCHAR(255) NOT NULL, -- References image_moderation_queue.image_id
    
    -- Reporter information
    reporter_user_id INT, -- NULL if anonymous report
    reporter_email VARCHAR(200), -- For non-registered reporters
    reporter_ip_address VARCHAR(45) NOT NULL, -- For abuse tracking (supports IPv6)
    
    -- Report details
    report_category ENUM(
        'child_safety_concern',    -- Suspected underage individual
        'non_consensual_content',  -- Revenge porn, deepfakes
        'identity_theft',          -- Catfish/stolen photos
        'trademark_violation',     -- Unauthorized commercial use
        'platform_policy_violation', -- Other rule violations
        'spam_or_abuse',           -- Bulk uploads, fake content
        'copyright_infringement',   -- DMCA-related issues
        'other'                    -- Catch-all with required description
    ) NOT NULL,
    
    report_description TEXT NOT NULL, -- User's explanation
    supporting_evidence JSON, -- URLs, screenshots, additional context
    
    -- Processing status
    report_status ENUM(
        'submitted',     -- Just received
        'under_review',  -- Being investigated
        'resolved',      -- Action taken
        'dismissed',     -- No action needed
        'escalated'      -- Sent to higher authority
    ) DEFAULT 'submitted',
    
    -- Investigation details
    assigned_to_user_id INT, -- Moderator handling the case
    investigation_notes TEXT,
    resolution_action ENUM(
        'content_removed',
        'content_quarantined', 
        'no_violation_found',
        'warning_issued',
        'account_suspended',
        'law_enforcement_reported',
        'pending_further_review'
    ),
    
    -- Timestamps
    report_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    investigation_start_timestamp TIMESTAMP NULL,
    resolution_timestamp TIMESTAMP NULL,
    
    -- Follow-up tracking
    follow_up_required BOOLEAN DEFAULT FALSE,
    follow_up_date DATE,
    
    FOREIGN KEY (reporter_user_id) REFERENCES users(id),
    FOREIGN KEY (assigned_to_user_id) REFERENCES users(id),
    
    INDEX idx_image_id (image_id),
    INDEX idx_report_category (report_category),
    INDEX idx_report_status (report_status),
    INDEX idx_report_timestamp (report_timestamp),
    INDEX idx_assigned_to_user_id (assigned_to_user_id),
    INDEX idx_follow_up_required (follow_up_required, follow_up_date)
);

-- Content moderation appeals/challenges
CREATE TABLE moderation_appeals (
    id INT PRIMARY KEY AUTO_INCREMENT,
    image_id VARCHAR(255) NOT NULL, -- References image_moderation_queue.image_id
    
    -- Appellant information
    appellant_user_id INT NOT NULL, -- Usually the model owner
    appeal_type ENUM(
        'wrongful_rejection',      -- AI/human incorrectly rejected
        'incorrect_tier_assignment', -- Should be in different tier
        'false_positive_flag',     -- Incorrectly flagged for review
        'processing_error',        -- Technical issue during analysis
        'policy_clarification',    -- Unclear rule application
        'new_evidence'             -- Additional information provided
    ) NOT NULL,
    
    -- Appeal details
    appeal_description TEXT NOT NULL,
    additional_evidence JSON, -- New documentation, context, etc.
    requested_outcome ENUM(
        'full_approval',           -- Approve for all tiers
        'partial_approval',        -- Approve for specific tier(s)
        'tier_upgrade',            -- Move to higher tier
        'remove_blur_requirement', -- Don't require blurring
        'reprocess_analysis'       -- Run AI analysis again
    ) NOT NULL,
    requested_tiers JSON, -- Specific tiers requested: ['public_gallery']
    
    -- Processing status
    appeal_status ENUM(
        'submitted',
        'under_review',
        'additional_info_requested',
        'approved',
        'denied',
        'partially_approved'
    ) DEFAULT 'submitted',
    
    -- Review details
    reviewed_by_user_id INT,
    review_notes TEXT,
    decision_reasoning TEXT,
    new_tier_assignment JSON, -- Resulting tier access
    
    -- Timestamps
    appeal_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    review_start_timestamp TIMESTAMP NULL,
    decision_timestamp TIMESTAMP NULL,
    
    -- Outcome tracking
    outcome_applied BOOLEAN DEFAULT FALSE,
    outcome_application_timestamp TIMESTAMP NULL,
    
    FOREIGN KEY (appellant_user_id) REFERENCES users(id),
    FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id),
    
    INDEX idx_image_id (image_id),
    INDEX idx_appeal_type (appeal_type),
    INDEX idx_appeal_status (appeal_status),
    INDEX idx_appellant_user_id (appellant_user_id),
    INDEX idx_appeal_timestamp (appeal_timestamp)
);

-- Processing queue for automated analysis
CREATE TABLE analysis_processing_queue (
    id INT PRIMARY KEY AUTO_INCREMENT,
    image_id VARCHAR(255) NOT NULL,
    
    -- Queue management
    queue_priority TINYINT DEFAULT 5, -- 1=highest, 10=lowest
    processing_status ENUM(
        'queued',
        'processing',
        'completed',
        'failed',
        'retrying'
    ) DEFAULT 'queued',
    
    -- Processing attempts
    attempt_count TINYINT DEFAULT 0,
    max_attempts TINYINT DEFAULT 3,
    last_error_message TEXT,
    
    -- Worker assignment
    assigned_worker_id VARCHAR(100), -- Which AI worker/server is processing
    
    -- Timestamps
    queued_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processing_start_timestamp TIMESTAMP NULL,
    processing_end_timestamp TIMESTAMP NULL,
    
    INDEX idx_image_id (image_id),
    INDEX idx_processing_status (processing_status),
    INDEX idx_queue_priority (queue_priority, queued_timestamp),
    INDEX idx_assigned_worker_id (assigned_worker_id)
);

-- ===================================
-- AI ANALYSIS TABLES
-- ===================================

-- MediaPipe landmark positions (33 keypoints per person)
CREATE TABLE pose_landmarks (
    id INT PRIMARY KEY AUTO_INCREMENT,
    analysis_id VARCHAR(255) NOT NULL, -- Links to content moderation analysis
    landmark_id TINYINT NOT NULL, -- 0-32 (MediaPipe landmark indices)
    landmark_name VARCHAR(50) NOT NULL, -- e.g., 'nose', 'left_shoulder', 'right_hip'
    x_coordinate DECIMAL(8,6) NOT NULL, -- Normalized 0-1 coordinates
    y_coordinate DECIMAL(8,6) NOT NULL,
    z_coordinate DECIMAL(8,6) NOT NULL,
    visibility DECIMAL(4,3) NOT NULL, -- 0-1 confidence score
    presence DECIMAL(4,3) NOT NULL, -- 0-1 presence confidence
    
    INDEX idx_analysis_id (analysis_id),
    INDEX idx_landmark_id (landmark_id),
    UNIQUE KEY unique_analysis_landmark (analysis_id, landmark_id)
);

-- Calculated pose metrics from landmarks
CREATE TABLE pose_metrics (
    id INT PRIMARY KEY AUTO_INCREMENT,
    analysis_id VARCHAR(255) NOT NULL UNIQUE,
    
    -- Torso analysis
    torso_angle DECIMAL(6,2) NOT NULL, -- Degrees from vertical
    torso_bend_angle DECIMAL(6,2) NOT NULL, -- Forward/backward bend
    shoulder_width DECIMAL(8,6) NOT NULL, -- Normalized distance
    hip_width DECIMAL(8,6) NOT NULL, -- Normalized distance
    torso_height DECIMAL(8,6) NOT NULL, -- Shoulder to hip distance
    
    -- Hip and pelvis analysis
    hip_bend_angle DECIMAL(6,2) NOT NULL, -- Hip flexion angle
    hip_rotation DECIMAL(6,2) NOT NULL, -- Left/right rotation
    pelvis_tilt DECIMAL(6,2) NOT NULL, -- Anterior/posterior tilt
    
    -- Leg analysis
    leg_spread DECIMAL(8,6) NOT NULL, -- Ankle separation distance
    left_knee_angle DECIMAL(6,2) NOT NULL, -- Knee flexion
    right_knee_angle DECIMAL(6,2) NOT NULL,
    left_hip_knee_angle DECIMAL(6,2) NOT NULL, -- Hip-knee alignment
    right_hip_knee_angle DECIMAL(6,2) NOT NULL,
    stance_width DECIMAL(8,6) NOT NULL, -- Foot separation
    
    -- Arm analysis
    left_arm_elevation DECIMAL(6,2) NOT NULL, -- Shoulder elevation angle
    right_arm_elevation DECIMAL(6,2) NOT NULL,
    left_elbow_angle DECIMAL(6,2) NOT NULL, -- Elbow flexion
    right_elbow_angle DECIMAL(6,2) NOT NULL,
    left_wrist_position_x DECIMAL(8,6) NOT NULL, -- Wrist coordinates
    left_wrist_position_y DECIMAL(8,6) NOT NULL,
    right_wrist_position_x DECIMAL(8,6) NOT NULL,
    right_wrist_position_y DECIMAL(8,6) NOT NULL,
    
    -- Overall body analysis
    body_orientation ENUM('facing_camera', 'facing_left', 'facing_right', 'side_view', 'back_view') NOT NULL,
    pose_symmetry DECIMAL(4,3) NOT NULL, -- 0-1 symmetry score
    center_of_mass_x DECIMAL(8,6) NOT NULL, -- Calculated body center
    center_of_mass_y DECIMAL(8,6) NOT NULL,
    
    -- Advanced pose classifications
    is_horizontal_pose BOOLEAN DEFAULT FALSE,
    is_sitting BOOLEAN DEFAULT FALSE,
    is_lying_down BOOLEAN DEFAULT FALSE,
    is_crouching BOOLEAN DEFAULT FALSE,
    is_bending_over BOOLEAN DEFAULT FALSE,
    is_arms_raised BOOLEAN DEFAULT FALSE,
    is_legs_spread BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_analysis_id (analysis_id)
);

-- NudeNet body parts detection results storage
CREATE TABLE nudenet_detections (
    id INT PRIMARY KEY AUTO_INCREMENT,
    analysis_id VARCHAR(255) NOT NULL,
    body_part ENUM(
        'female_breast_exposed', 'male_breast_exposed', 
        'female_genitalia_exposed', 'male_genitalia_exposed',
        'buttocks_exposed', 'anus_exposed',
        'belly_exposed', 'feet_exposed', 'armpits_exposed',
        'face_female', 'face_male'
    ) NOT NULL,
    confidence_score DECIMAL(5,2) NOT NULL, -- 0-100 percentage
    
    -- Bounding box coordinates (normalized 0-1)
    bbox_x DECIMAL(8,6) NOT NULL,
    bbox_y DECIMAL(8,6) NOT NULL, 
    bbox_width DECIMAL(8,6) NOT NULL,
    bbox_height DECIMAL(8,6) NOT NULL,
    
    -- Detection metadata
    detection_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    model_version VARCHAR(50) DEFAULT 'nudenet_v2',
    
    INDEX idx_analysis_id (analysis_id),
    INDEX idx_body_part (body_part),
    INDEX idx_confidence (confidence_score)
);

-- Content tier body part allowances (configurable per context)
CREATE TABLE body_part_allowances (
    id INT PRIMARY KEY AUTO_INCREMENT,
    context_name VARCHAR(50) NOT NULL, -- 'public_gallery', 'private_content', 'paysite', etc.
    body_part ENUM(
        'female_breast_exposed', 'male_breast_exposed', 
        'female_genitalia_exposed', 'male_genitalia_exposed',
        'buttocks_exposed', 'anus_exposed',
        'belly_exposed', 'feet_exposed', 'armpits_exposed',
        'face_female', 'face_male'
    ) NOT NULL,
    
    -- Allowance settings
    is_allowed BOOLEAN DEFAULT FALSE,
    max_confidence_threshold DECIMAL(5,2) DEFAULT 0.0, -- Max allowed confidence %
    requires_blur BOOLEAN DEFAULT TRUE, -- Must be blurred if detected
    requires_human_review BOOLEAN DEFAULT TRUE, -- Needs manual review
    auto_reject_threshold DECIMAL(5,2) DEFAULT 90.0, -- Auto-reject if confidence above this
    
    -- Blur requirements when allowed
    default_blur_strength TINYINT DEFAULT 5, -- 1-10 blur intensity
    blur_shape ENUM('rectangular', 'oval', 'rounded') DEFAULT 'rounded',
    blur_opacity DECIMAL(3,2) DEFAULT 0.8, -- 0-1 blur overlay opacity
    
    -- Age-related restrictions
    requires_age_verification BOOLEAN DEFAULT FALSE,
    minor_detection_multiplier DECIMAL(3,2) DEFAULT 2.0, -- Stricter for potential minors
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_context_part (context_name, body_part),
    INDEX idx_context_name (context_name),
    INDEX idx_is_allowed (is_allowed)
);

-- Age-related pose analysis (for child safety)
CREATE TABLE age_pose_indicators (
    id INT PRIMARY KEY AUTO_INCREMENT,
    analysis_id VARCHAR(255) NOT NULL UNIQUE,
    
    -- Physical proportion indicators
    head_to_body_ratio DECIMAL(6,4) NOT NULL, -- Children have larger head ratios
    limb_proportion_score DECIMAL(4,3) NOT NULL, -- 0-1 adult-like proportions
    torso_length_ratio DECIMAL(6,4) NOT NULL, -- Torso to total height
    
    -- Posture maturity indicators
    posture_stability_score DECIMAL(4,3) NOT NULL, -- 0-1 stable adult posture
    coordination_score DECIMAL(4,3) NOT NULL, -- 0-1 coordinated movement
    flexibility_score DECIMAL(4,3) NOT NULL, -- 0-1 adult-like flexibility limits
    
    -- Size estimation
    estimated_height_category ENUM('child_small', 'child_medium', 'teen', 'adult_short', 'adult_medium', 'adult_tall') NOT NULL,
    body_mass_index_category ENUM('underweight', 'normal_child', 'normal_adult', 'overweight', 'unknown') NOT NULL,
    
    -- Age prediction
    estimated_age_min TINYINT, -- Minimum estimated age
    estimated_age_max TINYINT, -- Maximum estimated age
    age_confidence DECIMAL(4,3) NOT NULL, -- 0-1 confidence in age estimate
    
    -- Safety flags
    potential_minor_flag BOOLEAN DEFAULT FALSE,
    requires_human_review BOOLEAN DEFAULT FALSE,
    
    FOREIGN KEY (analysis_id) REFERENCES pose_metrics(analysis_id) ON DELETE CASCADE,
    INDEX idx_minor_flag (potential_minor_flag),
    INDEX idx_human_review (requires_human_review)
);

-- Adult content pose analysis
CREATE TABLE adult_pose_analysis (
    id INT PRIMARY KEY AUTO_INCREMENT,
    analysis_id VARCHAR(255) NOT NULL UNIQUE,
    
    -- Suggestive pose scoring
    suggestive_score DECIMAL(4,3) NOT NULL, -- 0-1 overall suggestiveness
    explicit_score DECIMAL(4,3) NOT NULL, -- 0-1 explicit positioning
    artistic_score DECIMAL(4,3) NOT NULL, -- 0-1 artistic merit
    
    -- Specific pose classifications
    is_bent_over BOOLEAN DEFAULT FALSE,
    is_legs_spread_wide BOOLEAN DEFAULT FALSE,
    is_provocative_arm_position BOOLEAN DEFAULT FALSE,
    is_revealing_pose BOOLEAN DEFAULT FALSE,
    is_intimate_positioning BOOLEAN DEFAULT FALSE,
    
    -- Combined with nudity context
    nudity_pose_multiplier DECIMAL(4,3) DEFAULT 1.0, -- How pose amplifies nudity risk
    context_appropriateness ENUM('appropriate', 'questionable', 'inappropriate', 'explicit') NOT NULL,
    
    -- Final recommendations
    recommended_action ENUM('auto_approve', 'human_review', 'auto_reject', 'age_verify') NOT NULL,
    risk_level ENUM('minimal', 'low', 'medium', 'high', 'critical') NOT NULL,
    
    FOREIGN KEY (analysis_id) REFERENCES pose_metrics(analysis_id) ON DELETE CASCADE,
    INDEX idx_suggestive_score (suggestive_score),
    INDEX idx_recommended_action (recommended_action),
    INDEX idx_risk_level (risk_level)
);

-- AI-generated image descriptions based on analysis keywords
CREATE TABLE ai_image_descriptions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    analysis_id VARCHAR(255) NOT NULL UNIQUE,
    
    -- Analysis keywords that generated the description
    detected_keywords JSON NOT NULL, -- Array of keywords from pose/body part analysis
    keyword_confidence_scores JSON NOT NULL, -- Confidence scores for each keyword
    
    -- AI-generated descriptions
    short_description TEXT, -- Brief 1-2 sentence description
    detailed_description TEXT, -- Comprehensive paragraph description
    content_summary TEXT, -- High-level categorization (e.g., "artistic nude", "portrait", etc.)
    
    -- Scene analysis
    pose_keywords JSON, -- Array of pose-related keywords ["standing", "facing_camera", "arms_crossed"]
    body_part_keywords JSON, -- Array of detected body parts ["female_breast", "face", "torso"]
    setting_keywords JSON, -- Array of setting/background keywords (future expansion)
    clothing_keywords JSON, -- Array of clothing/nudity keywords (future expansion)
    
    -- Context-sensitive descriptions (different descriptions for different tiers)
    public_description TEXT, -- Safe description for public contexts
    private_description TEXT, -- More detailed for private contexts
    clinical_description TEXT, -- Medical/clinical terminology for analysis
    
    -- AI model information
    ai_model_used VARCHAR(100) DEFAULT 'gpt-4', -- Which AI model generated the description
    generation_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    generation_confidence DECIMAL(4,3) DEFAULT 0.0, -- 0-1 confidence in description accuracy
    
    -- Quality control
    human_reviewed BOOLEAN DEFAULT FALSE,
    human_approved BOOLEAN DEFAULT FALSE,
    human_reviewer_id INT,
    human_review_notes TEXT,
    human_review_timestamp TIMESTAMP NULL,
    
    -- Usage tracking
    description_used_count INT DEFAULT 0, -- How many times this description was displayed
    last_used_timestamp TIMESTAMP NULL,
    
    FOREIGN KEY (human_reviewer_id) REFERENCES users(id),
    INDEX idx_analysis_id (analysis_id),
    INDEX idx_generation_timestamp (generation_timestamp),
    INDEX idx_human_approved (human_approved)
);

-- Keyword library for standardized AI descriptions
CREATE TABLE image_analysis_keywords (
    id INT PRIMARY KEY AUTO_INCREMENT,
    keyword VARCHAR(100) NOT NULL UNIQUE,
    category ENUM('pose', 'body_part', 'clothing', 'setting', 'activity', 'emotion', 'age_indicator', 'safety_flag') NOT NULL,
    
    -- Keyword properties
    severity_level ENUM('neutral', 'mild', 'moderate', 'explicit', 'critical') DEFAULT 'neutral',
    child_safety_flag BOOLEAN DEFAULT FALSE, -- Keywords that indicate potential child safety issues
    
    -- Context appropriateness
    public_appropriate BOOLEAN DEFAULT TRUE,
    private_appropriate BOOLEAN DEFAULT TRUE,
    clinical_appropriate BOOLEAN DEFAULT TRUE,
    
    -- Alternative terms for description generation
    public_synonym VARCHAR(100), -- More appropriate term for public contexts
    clinical_synonym VARCHAR(100), -- Medical terminology equivalent
    
    -- Usage in descriptions
    description_priority TINYINT DEFAULT 5, -- 1-10, how important this keyword is in descriptions
    auto_include BOOLEAN DEFAULT FALSE, -- Should be included in all descriptions when detected
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_category (category),
    INDEX idx_severity_level (severity_level),
    INDEX idx_child_safety (child_safety_flag),
    INDEX idx_public_appropriate (public_appropriate)
);

-- Track which keywords were detected in each analysis
CREATE TABLE analysis_detected_keywords (
    id INT PRIMARY KEY AUTO_INCREMENT,
    analysis_id VARCHAR(255) NOT NULL,
    keyword_id INT NOT NULL,
    
    -- Detection details
    confidence_score DECIMAL(4,3) NOT NULL, -- 0-1 confidence that this keyword applies
    detection_source ENUM('pose_analysis', 'nudenet_detection', 'combination_rule', 'manual_tag') NOT NULL,
    detection_context JSON, -- Additional context about how this keyword was detected
    
    -- Usage in AI descriptions
    used_in_description BOOLEAN DEFAULT FALSE,
    description_weight DECIMAL(3,2) DEFAULT 1.0, -- How heavily this keyword influenced the description
    
    detection_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (keyword_id) REFERENCES image_analysis_keywords(id) ON DELETE CASCADE,
    INDEX idx_analysis_id (analysis_id),
    INDEX idx_keyword_id (keyword_id),
    INDEX idx_confidence (confidence_score),
    UNIQUE KEY unique_analysis_keyword (analysis_id, keyword_id)
);

-- Audit trail for approved content with pose descriptions
CREATE TABLE pose_approval_audit (
    id INT PRIMARY KEY AUTO_INCREMENT,
    analysis_id VARCHAR(255) NOT NULL,
    
    -- Review details
    reviewed_by_user_id INT,
    review_action ENUM('approved', 'rejected', 'flagged', 'age_verified') NOT NULL,
    review_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    review_notes TEXT,
    
    -- AI-generated descriptions (reference to ai_image_descriptions table)
    ai_description_id INT, -- Links to ai_image_descriptions table
    pose_description TEXT, -- Natural language description of pose
    safety_assessment TEXT, -- Why it was deemed safe/unsafe
    age_assessment_notes TEXT, -- Specific age-related observations
    
    -- Override information
    rule_overrides JSON, -- Which rules were manually overridden
    override_justification TEXT,
    
    -- Quality assurance
    qa_reviewed BOOLEAN DEFAULT FALSE,
    qa_reviewer_id INT,
    qa_timestamp TIMESTAMP NULL,
    qa_notes TEXT,
    
    FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id),
    FOREIGN KEY (qa_reviewer_id) REFERENCES users(id),
    FOREIGN KEY (ai_description_id) REFERENCES ai_image_descriptions(id),
    INDEX idx_analysis_id (analysis_id),
    INDEX idx_review_action (review_action),
    INDEX idx_review_timestamp (review_timestamp)
);

-- ===================================
-- SEED DATA FOR BODY PART ALLOWANCES
-- ===================================

-- Public gallery allowances (most restrictive)
INSERT INTO body_part_allowances (context_name, body_part, is_allowed, max_confidence_threshold, requires_blur, requires_human_review, auto_reject_threshold, default_blur_strength, requires_age_verification) VALUES
('public_gallery', 'female_breast_exposed', FALSE, 0.0, TRUE, TRUE, 30.0, 8, TRUE),
('public_gallery', 'male_breast_exposed', TRUE, 60.0, FALSE, FALSE, 85.0, 3, FALSE),
('public_gallery', 'female_genitalia_exposed', FALSE, 0.0, TRUE, TRUE, 10.0, 10, TRUE),
('public_gallery', 'male_genitalia_exposed', FALSE, 0.0, TRUE, TRUE, 10.0, 10, TRUE),
('public_gallery', 'buttocks_exposed', FALSE, 0.0, TRUE, TRUE, 40.0, 7, TRUE),
('public_gallery', 'anus_exposed', FALSE, 0.0, TRUE, TRUE, 5.0, 10, TRUE),
('public_gallery', 'belly_exposed', TRUE, 80.0, FALSE, FALSE, 95.0, 2, FALSE),
('public_gallery', 'feet_exposed', TRUE, 95.0, FALSE, FALSE, 99.0, 1, FALSE),
('public_gallery', 'armpits_exposed', TRUE, 90.0, FALSE, FALSE, 98.0, 1, FALSE),
('public_gallery', 'face_female', TRUE, 95.0, FALSE, FALSE, 99.0, 1, FALSE),
('public_gallery', 'face_male', TRUE, 95.0, FALSE, FALSE, 99.0, 1, FALSE);

-- Private content allowances (moderate restrictions)
INSERT INTO body_part_allowances (context_name, body_part, is_allowed, max_confidence_threshold, requires_blur, requires_human_review, auto_reject_threshold, default_blur_strength, requires_age_verification) VALUES
('private_content', 'female_breast_exposed', TRUE, 70.0, TRUE, TRUE, 60.0, 5, TRUE),
('private_content', 'male_breast_exposed', TRUE, 85.0, FALSE, FALSE, 95.0, 2, FALSE),
('private_content', 'female_genitalia_exposed', FALSE, 0.0, TRUE, TRUE, 20.0, 10, TRUE),
('private_content', 'male_genitalia_exposed', FALSE, 0.0, TRUE, TRUE, 20.0, 10, TRUE),
('private_content', 'buttocks_exposed', TRUE, 60.0, TRUE, TRUE, 70.0, 6, TRUE),
('private_content', 'anus_exposed', FALSE, 0.0, TRUE, TRUE, 15.0, 10, TRUE),
('private_content', 'belly_exposed', TRUE, 90.0, FALSE, FALSE, 98.0, 1, FALSE),
('private_content', 'feet_exposed', TRUE, 98.0, FALSE, FALSE, 99.5, 1, FALSE),
('private_content', 'armpits_exposed', TRUE, 95.0, FALSE, FALSE, 99.0, 1, FALSE),
('private_content', 'face_female', TRUE, 98.0, FALSE, FALSE, 99.5, 1, FALSE),
('private_content', 'face_male', TRUE, 98.0, FALSE, FALSE, 99.5, 1, FALSE);

-- Paysite content allowances (least restrictive for adult content)
INSERT INTO body_part_allowances (context_name, body_part, is_allowed, max_confidence_threshold, requires_blur, requires_human_review, auto_reject_threshold, default_blur_strength, requires_age_verification) VALUES
('paysite_content', 'female_breast_exposed', TRUE, 85.0, FALSE, FALSE, 90.0, 3, TRUE),
('paysite_content', 'male_breast_exposed', TRUE, 95.0, FALSE, FALSE, 98.0, 1, FALSE),
('paysite_content', 'female_genitalia_exposed', TRUE, 60.0, TRUE, TRUE, 40.0, 8, TRUE),
('paysite_content', 'male_genitalia_exposed', TRUE, 60.0, TRUE, TRUE, 40.0, 8, TRUE),
('paysite_content', 'buttocks_exposed', TRUE, 80.0, FALSE, FALSE, 90.0, 4, FALSE),
('paysite_content', 'anus_exposed', TRUE, 40.0, TRUE, TRUE, 50.0, 9, TRUE),
('paysite_content', 'belly_exposed', TRUE, 95.0, FALSE, FALSE, 99.0, 1, FALSE),
('paysite_content', 'feet_exposed', TRUE, 99.0, FALSE, FALSE, 99.8, 1, FALSE),
('paysite_content', 'armpits_exposed', TRUE, 98.0, FALSE, FALSE, 99.5, 1, FALSE),
('paysite_content', 'face_female', TRUE, 99.0, FALSE, FALSE, 99.8, 1, FALSE),
('paysite_content', 'face_male', TRUE, 99.0, FALSE, FALSE, 99.8, 1, FALSE);

-- ===================================
-- SEED DATA FOR IMAGE ANALYSIS KEYWORDS
-- ===================================

-- Pose-related keywords
INSERT INTO image_analysis_keywords (keyword, category, severity_level, child_safety_flag, public_appropriate, private_appropriate, clinical_appropriate, public_synonym, clinical_synonym, description_priority, auto_include) VALUES
-- Body positioning
('standing', 'pose', 'neutral', FALSE, TRUE, TRUE, TRUE, 'upright', 'standing_position', 6, TRUE),
('sitting', 'pose', 'neutral', FALSE, TRUE, TRUE, TRUE, 'seated', 'sitting_position', 6, TRUE),
('lying_down', 'pose', 'mild', FALSE, TRUE, TRUE, TRUE, 'reclining', 'recumbent_position', 7, TRUE),
('horizontal_pose', 'pose', 'moderate', FALSE, FALSE, TRUE, TRUE, 'reclining', 'horizontal_positioning', 8, TRUE),
('bent_over', 'pose', 'explicit', FALSE, FALSE, TRUE, TRUE, 'leaning_forward', 'forward_flexion', 9, TRUE),
('legs_spread', 'pose', 'explicit', TRUE, FALSE, TRUE, TRUE, 'legs_apart', 'lower_extremity_abduction', 9, TRUE),
('arms_raised', 'pose', 'mild', FALSE, TRUE, TRUE, TRUE, 'arms_elevated', 'upper_extremity_elevation', 5, FALSE),
('facing_camera', 'pose', 'neutral', FALSE, TRUE, TRUE, TRUE, 'front_facing', 'anterior_view', 4, FALSE),
('side_view', 'pose', 'neutral', FALSE, TRUE, TRUE, TRUE, 'profile_view', 'lateral_view', 4, FALSE),

-- Body parts (clinical terminology)
('female_breast', 'body_part', 'moderate', TRUE, FALSE, TRUE, TRUE, 'chest_area', 'mammary_tissue', 8, TRUE),
('male_chest', 'body_part', 'mild', FALSE, TRUE, TRUE, TRUE, 'chest', 'thoracic_region', 3, FALSE),
('genitalia', 'body_part', 'critical', TRUE, FALSE, FALSE, TRUE, 'intimate_area', 'genital_region', 10, TRUE),
('buttocks', 'body_part', 'moderate', FALSE, FALSE, TRUE, TRUE, 'posterior', 'gluteal_region', 7, TRUE),
('face_visible', 'body_part', 'neutral', TRUE, TRUE, TRUE, TRUE, 'portrait', 'facial_features', 8, TRUE),
('torso', 'body_part', 'mild', FALSE, TRUE, TRUE, TRUE, 'upper_body', 'trunk_region', 4, FALSE),

-- Age indicators (critical for child safety)
('youthful_appearance', 'age_indicator', 'critical', TRUE, FALSE, FALSE, TRUE, 'young_looking', 'juvenile_characteristics', 10, TRUE),
('adult_proportions', 'age_indicator', 'neutral', FALSE, TRUE, TRUE, TRUE, 'mature_build', 'adult_body_habitus', 6, FALSE),
('developed_physique', 'age_indicator', 'mild', FALSE, TRUE, TRUE, TRUE, 'athletic_build', 'mature_development', 5, FALSE),

-- Safety flags
('potential_minor', 'safety_flag', 'critical', TRUE, FALSE, FALSE, TRUE, 'age_verification_needed', 'requires_age_assessment', 10, TRUE),
('explicit_content', 'safety_flag', 'explicit', FALSE, FALSE, TRUE, TRUE, 'adult_content', 'explicit_material', 9, TRUE),
('suggestive_pose', 'safety_flag', 'moderate', FALSE, FALSE, TRUE, TRUE, 'artistic_pose', 'provocative_positioning', 7, FALSE),

-- Activity keywords
('artistic_pose', 'activity', 'neutral', FALSE, TRUE, TRUE, TRUE, 'art_modeling', 'figure_study', 6, FALSE),
('portrait_style', 'activity', 'neutral', FALSE, TRUE, TRUE, TRUE, 'headshot', 'portraiture', 5, FALSE),
('intimate_photography', 'activity', 'explicit', FALSE, FALSE, TRUE, TRUE, 'private_photo', 'intimate_imaging', 8, TRUE),

-- Emotion/expression keywords
('confident_expression', 'emotion', 'neutral', FALSE, TRUE, TRUE, TRUE, 'assured', 'confident_demeanor', 4, FALSE),
('vulnerable_pose', 'emotion', 'moderate', TRUE, FALSE, TRUE, TRUE, 'delicate_pose', 'exposed_positioning', 7, FALSE),
('professional_modeling', 'emotion', 'neutral', FALSE, TRUE, TRUE, TRUE, 'model_pose', 'professional_photography', 6, FALSE);

-- ===================================
-- MANAGEMENT VIEWS
-- ===================================

-- Human review queue (prioritized for moderators)
CREATE VIEW human_review_queue AS
SELECT 
    imq.image_id,
    imq.model_id,
    imq.slug,
    imq.original_filename,
    imq.status,
    imq.priority_level,
    imq.risk_score,
    imq.child_safety_flag,
    
    -- Why it needs human review
    CASE 
        WHEN imq.child_safety_flag = TRUE THEN 'Potential minor detected'
        WHEN api.potential_minor_flag = TRUE THEN 'Age verification required'
        WHEN apa.risk_level = 'critical' THEN 'High-risk pose detected'
        WHEN COUNT(cr.id) > 0 THEN 'User reports received'
        ELSE 'Standard policy review'
    END as review_reason,
    
    -- Analysis summary for quick review
    COALESCE(aid.short_description, 'No AI description available') as ai_summary,
    pm.body_orientation,
    pm.is_horizontal_pose,
    
    -- Timing information
    imq.upload_timestamp,
    TIMESTAMPDIFF(HOUR, imq.upload_timestamp, NOW()) as hours_pending,
    
    -- SLA compliance
    CASE imq.priority_level
        WHEN 'CRITICAL_CHILD_SAFETY' THEN 1 -- Immediate
        WHEN 'HIGH_RISK_AGE_UNCERTAIN' THEN 24 -- 24 hours
        WHEN 'MEDIUM_RISK' THEN 72 -- 72 hours  
        WHEN 'LOW_RISK' THEN 168 -- 7 days
        ELSE 168
    END as sla_hours,
    
    CASE 
        WHEN TIMESTAMPDIFF(HOUR, imq.upload_timestamp, NOW()) > 
             CASE imq.priority_level
                 WHEN 'CRITICAL_CHILD_SAFETY' THEN 1
                 WHEN 'HIGH_RISK_AGE_UNCERTAIN' THEN 24
                 WHEN 'MEDIUM_RISK' THEN 72
                 WHEN 'LOW_RISK' THEN 168
                 ELSE 168
             END
        THEN TRUE
        ELSE FALSE
    END as sla_breached,
    
    -- Report information
    COUNT(cr.id) as report_count

FROM image_moderation_queue imq
LEFT JOIN pose_metrics pm ON imq.analysis_id = pm.analysis_id
LEFT JOIN age_pose_indicators api ON imq.analysis_id = api.analysis_id
LEFT JOIN adult_pose_analysis apa ON imq.analysis_id = apa.analysis_id  
LEFT JOIN ai_image_descriptions aid ON imq.analysis_id = aid.analysis_id
LEFT JOIN content_reports cr ON imq.image_id = cr.image_id AND cr.report_status IN ('submitted', 'under_review')
WHERE imq.status IN ('flagged', 'appeals_pending')
   OR imq.child_safety_flag = TRUE
   OR EXISTS (
       SELECT 1 FROM content_reports cr2 
       WHERE cr2.image_id = imq.image_id 
       AND cr2.report_status IN ('submitted', 'under_review')
   )
GROUP BY imq.image_id
ORDER BY 
    imq.child_safety_flag DESC,
    CASE imq.priority_level
        WHEN 'CRITICAL_CHILD_SAFETY' THEN 1
        WHEN 'HIGH_RISK_AGE_UNCERTAIN' THEN 2  
        WHEN 'MEDIUM_RISK' THEN 3
        WHEN 'LOW_RISK' THEN 4
        ELSE 5
    END,
    sla_breached DESC,
    hours_pending DESC;

-- Content moderation dashboard
CREATE VIEW content_moderation_dashboard AS
SELECT 
    imq.image_id,
    imq.model_id,
    imq.slug,
    imq.original_filename,
    imq.current_filename,
    imq.status as workflow_status,
    imq.priority_level,
    imq.risk_score,
    imq.child_safety_flag,
    imq.approved_for_tiers,
    imq.auto_approved,
    imq.requires_blur,
    
    -- Analysis results
    pm.body_orientation,
    pm.is_horizontal_pose,
    pm.is_bending_over,
    api.potential_minor_flag,
    api.age_confidence,
    apa.suggestive_score,
    apa.risk_level as pose_risk_level,
    
    -- AI descriptions
    aid.short_description,
    aid.public_description,
    aid.human_approved as description_approved,
    
    -- Workflow timestamps
    imq.upload_timestamp,
    imq.analysis_complete_timestamp,
    imq.final_decision_timestamp,
    
    -- Review information  
    imq.reviewed_by_user_id,
    imq.approved_by_user_id,
    imq.review_notes,
    
    -- Reports and appeals
    COUNT(cr.id) as report_count,
    COUNT(ma.id) as appeal_count,
    
    -- Processing time metrics
    TIMESTAMPDIFF(SECOND, imq.upload_timestamp, imq.analysis_complete_timestamp) as analysis_duration_seconds,
    TIMESTAMPDIFF(HOUR, imq.upload_timestamp, imq.final_decision_timestamp) as total_processing_hours,
    
    -- Status flags for easy filtering
    CASE 
        WHEN imq.status = 'quarantined' THEN TRUE
        WHEN imq.child_safety_flag = TRUE THEN TRUE
        ELSE FALSE
    END as requires_immediate_attention,
    
    CASE 
        WHEN imq.status IN ('flagged', 'appeals_pending') THEN TRUE
        ELSE FALSE  
    END as requires_human_review

FROM image_moderation_queue imq
LEFT JOIN pose_metrics pm ON imq.analysis_id = pm.analysis_id
LEFT JOIN age_pose_indicators api ON imq.analysis_id = api.analysis_id  
LEFT JOIN adult_pose_analysis apa ON imq.analysis_id = apa.analysis_id
LEFT JOIN ai_image_descriptions aid ON imq.analysis_id = aid.analysis_id
LEFT JOIN content_reports cr ON imq.image_id = cr.image_id
LEFT JOIN moderation_appeals ma ON imq.image_id = ma.image_id
GROUP BY imq.image_id
ORDER BY 
    requires_immediate_attention DESC,
    imq.priority_level = 'CRITICAL_CHILD_SAFETY' DESC,
    imq.priority_level = 'HIGH_RISK_AGE_UNCERTAIN' DESC,
    imq.upload_timestamp DESC;