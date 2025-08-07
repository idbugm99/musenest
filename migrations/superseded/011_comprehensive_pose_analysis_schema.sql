-- MuseNest Database Migration 011
-- Comprehensive Pose Analysis Schema for Adult/Child Content Safety
-- Run date: 2025-07-29

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
-- POSE ANALYSIS TABLES
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

-- Limb-specific detailed analysis
CREATE TABLE limb_analysis (
    id INT PRIMARY KEY AUTO_INCREMENT,
    analysis_id VARCHAR(255) NOT NULL,
    limb_type ENUM('left_arm', 'right_arm', 'left_leg', 'right_leg', 'torso', 'head') NOT NULL,
    
    -- Joint angles (in degrees)
    proximal_joint_angle DECIMAL(6,2), -- e.g., shoulder angle for arm
    middle_joint_angle DECIMAL(6,2), -- e.g., elbow angle for arm
    distal_joint_angle DECIMAL(6,2), -- e.g., wrist angle for arm
    
    -- Limb positioning
    limb_length DECIMAL(8,6), -- Normalized limb length
    limb_angle_from_vertical DECIMAL(6,2), -- Degrees from vertical
    limb_extension DECIMAL(4,3), -- 0-1 extension score
    
    -- Spatial relationships
    distance_from_torso DECIMAL(8,6), -- Distance from torso center
    relative_height DECIMAL(8,6), -- Height relative to body center
    occlusion_score DECIMAL(4,3), -- 0-1 how much is hidden
    
    -- Movement indicators
    is_extended BOOLEAN DEFAULT FALSE,
    is_flexed BOOLEAN DEFAULT FALSE,
    is_crossed BOOLEAN DEFAULT FALSE,
    is_raised BOOLEAN DEFAULT FALSE,
    is_behind_body BOOLEAN DEFAULT FALSE,
    
    FOREIGN KEY (analysis_id) REFERENCES pose_metrics(analysis_id) ON DELETE CASCADE,
    INDEX idx_analysis_limb (analysis_id, limb_type)
);

-- Configurable analysis thresholds and rules
CREATE TABLE pose_analysis_rules (
    id INT PRIMARY KEY AUTO_INCREMENT,
    rule_name VARCHAR(100) NOT NULL UNIQUE,
    rule_description TEXT,
    rule_category ENUM('age_detection', 'pose_classification', 'suggestive_detection', 'safety_check') NOT NULL,
    
    -- Threshold values
    threshold_type ENUM('angle', 'distance', 'ratio', 'boolean', 'score') NOT NULL,
    min_threshold DECIMAL(8,4),
    max_threshold DECIMAL(8,4),
    target_value DECIMAL(8,4),
    
    -- Rule logic
    comparison_operator ENUM('>', '<', '>=', '<=', '=', '!=', 'between', 'outside') NOT NULL,
    weight DECIMAL(4,3) DEFAULT 1.0, -- Rule importance 0-1
    
    -- Context application
    applies_to_context JSON, -- ['public_gallery', 'private_content', etc.]
    is_active BOOLEAN DEFAULT TRUE,
    is_critical BOOLEAN DEFAULT FALSE, -- Critical rules cause immediate flagging
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_rule_category (rule_category),
    INDEX idx_is_active (is_active)
);

-- Rule evaluation results
CREATE TABLE pose_rule_evaluations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    analysis_id VARCHAR(255) NOT NULL,
    rule_id INT NOT NULL,
    
    -- Evaluation results
    rule_triggered BOOLEAN NOT NULL,
    confidence_score DECIMAL(4,3) NOT NULL, -- 0-1 confidence
    calculated_value DECIMAL(8,4), -- The actual measured value
    threshold_used DECIMAL(8,4), -- The threshold it was compared against
    
    -- Context
    evaluation_context VARCHAR(50), -- 'public_gallery', 'private_content', etc.
    evaluation_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (rule_id) REFERENCES pose_analysis_rules(id) ON DELETE CASCADE,
    INDEX idx_analysis_id (analysis_id),
    INDEX idx_rule_triggered (rule_triggered),
    INDEX idx_analysis_rule (analysis_id, rule_id)
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

-- Configuration for different content contexts
CREATE TABLE pose_context_config (
    id INT PRIMARY KEY AUTO_INCREMENT,
    context_name VARCHAR(50) NOT NULL UNIQUE, -- 'public_gallery', 'private_content', 'paysite', etc.
    
    -- Threshold adjustments
    age_detection_sensitivity DECIMAL(4,3) DEFAULT 0.8, -- 0-1 sensitivity level
    suggestive_threshold DECIMAL(4,3) DEFAULT 0.5, -- 0-1 threshold for suggestive content
    explicit_threshold DECIMAL(4,3) DEFAULT 0.3, -- 0-1 threshold for explicit content
    
    -- Auto-action thresholds
    auto_approve_threshold DECIMAL(4,3) DEFAULT 0.2,
    auto_reject_threshold DECIMAL(4,3) DEFAULT 0.8,
    
    -- Age-specific settings
    minor_detection_threshold DECIMAL(4,3) DEFAULT 0.3, -- Threshold for potential minor flag
    require_age_verification BOOLEAN DEFAULT TRUE,
    
    -- Rule set application
    active_rule_categories JSON, -- Which rule categories apply to this context
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ===================================
-- NUDENET BODY PARTS CONFIGURATION
-- ===================================

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

-- Body part combination rules (some combinations are more restrictive)
CREATE TABLE body_part_combination_rules (
    id INT PRIMARY KEY AUTO_INCREMENT,
    rule_name VARCHAR(100) NOT NULL,
    context_name VARCHAR(50) NOT NULL,
    
    -- Body parts involved in this combination
    required_parts JSON NOT NULL, -- Array of body parts that trigger this rule
    minimum_parts_count TINYINT DEFAULT 1, -- How many parts must be detected
    
    -- Combined scoring
    combined_confidence_threshold DECIMAL(5,2) DEFAULT 50.0,
    severity_multiplier DECIMAL(3,2) DEFAULT 1.5, -- How much more severe combinations are
    
    -- Actions for combinations
    force_human_review BOOLEAN DEFAULT TRUE,
    auto_reject_threshold DECIMAL(5,2) DEFAULT 70.0, -- Lower threshold for combinations
    recommended_action ENUM('auto_approve', 'human_review', 'auto_reject', 'age_verify') DEFAULT 'human_review',
    
    -- Specific to adult/child safety
    child_safety_priority BOOLEAN DEFAULT FALSE, -- Flag for child safety rules
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_context_name (context_name),
    INDEX idx_child_safety (child_safety_priority)
);

-- Track which body parts were detected in each analysis for rule evaluation
CREATE TABLE nudenet_analysis_summary (
    id INT PRIMARY KEY AUTO_INCREMENT,
    analysis_id VARCHAR(255) NOT NULL UNIQUE,
    
    -- Overall detection summary
    total_parts_detected TINYINT DEFAULT 0,
    max_confidence DECIMAL(5,2) DEFAULT 0.0,
    has_explicit_content BOOLEAN DEFAULT FALSE,
    
    -- Part-specific flags for quick querying
    has_female_breast BOOLEAN DEFAULT FALSE,
    has_male_breast BOOLEAN DEFAULT FALSE,
    has_female_genitalia BOOLEAN DEFAULT FALSE,
    has_male_genitalia BOOLEAN DEFAULT FALSE,
    has_buttocks BOOLEAN DEFAULT FALSE,
    has_anus BOOLEAN DEFAULT FALSE,
    has_belly BOOLEAN DEFAULT FALSE,
    has_feet BOOLEAN DEFAULT FALSE,
    has_armpits BOOLEAN DEFAULT FALSE,
    has_face_female BOOLEAN DEFAULT FALSE,
    has_face_male BOOLEAN DEFAULT FALSE,
    
    -- Risk assessment based on detections
    nudity_risk_score DECIMAL(5,2) DEFAULT 0.0, -- 0-100 overall nudity risk
    context_appropriateness ENUM('appropriate', 'questionable', 'inappropriate', 'explicit') DEFAULT 'appropriate',
    
    -- Final decision factors
    triggered_combination_rules JSON, -- Array of combination rule IDs that were triggered
    recommended_blur_parts JSON, -- Array of body parts recommended for blurring
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_analysis_id (analysis_id),
    INDEX idx_has_explicit (has_explicit_content),
    INDEX idx_risk_score (nudity_risk_score)
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
-- BODY PART COMBINATION RULES
-- ===================================

-- Critical combinations for child safety
INSERT INTO body_part_combination_rules (rule_name, context_name, required_parts, minimum_parts_count, combined_confidence_threshold, severity_multiplier, force_human_review, auto_reject_threshold, child_safety_priority) VALUES
('genitalia_face_combination', 'public_gallery', '["female_genitalia_exposed", "male_genitalia_exposed", "face_female", "face_male"]', 2, 20.0, 3.0, TRUE, 25.0, TRUE),
('genitalia_face_combination', 'private_content', '["female_genitalia_exposed", "male_genitalia_exposed", "face_female", "face_male"]', 2, 30.0, 2.5, TRUE, 35.0, TRUE),
('genitalia_face_combination', 'paysite_content', '["female_genitalia_exposed", "male_genitalia_exposed", "face_female", "face_male"]', 2, 40.0, 2.0, TRUE, 45.0, TRUE),

('multiple_explicit_parts', 'public_gallery', '["female_genitalia_exposed", "male_genitalia_exposed", "anus_exposed"]', 2, 15.0, 2.5, TRUE, 20.0, TRUE),
('multiple_explicit_parts', 'private_content', '["female_genitalia_exposed", "male_genitalia_exposed", "anus_exposed"]', 2, 25.0, 2.0, TRUE, 30.0, TRUE),
('multiple_explicit_parts', 'paysite_content', '["female_genitalia_exposed", "male_genitalia_exposed", "anus_exposed"]', 2, 35.0, 1.5, TRUE, 40.0, TRUE),

('breast_genitalia_combination', 'public_gallery', '["female_breast_exposed", "female_genitalia_exposed", "male_genitalia_exposed"]', 2, 20.0, 2.0, TRUE, 30.0, FALSE),
('breast_genitalia_combination', 'private_content', '["female_breast_exposed", "female_genitalia_exposed", "male_genitalia_exposed"]', 2, 40.0, 1.8, TRUE, 50.0, FALSE),
('breast_genitalia_combination', 'paysite_content', '["female_breast_exposed", "female_genitalia_exposed", "male_genitalia_exposed"]', 2, 60.0, 1.3, FALSE, 70.0, FALSE);

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
-- SEED DATA FOR POSE ANALYSIS RULES
-- ===================================

-- Insert basic pose analysis rules
INSERT INTO pose_analysis_rules (rule_name, rule_description, rule_category, threshold_type, min_threshold, max_threshold, comparison_operator, weight, applies_to_context, is_critical) VALUES
-- Age detection rules
('child_head_ratio', 'Child-like head to body proportions', 'age_detection', 'ratio', 0.18, NULL, '>', 0.9, '["public_gallery", "private_content", "paysite"]', TRUE),
('adult_limb_proportions', 'Adult-like limb proportions', 'age_detection', 'score', 0.7, NULL, '<', 0.8, '["public_gallery", "private_content", "paysite"]', TRUE),
('posture_maturity', 'Mature posture stability', 'age_detection', 'score', 0.6, NULL, '<', 0.7, '["public_gallery", "private_content", "paysite"]', TRUE),

-- Suggestive pose detection
('extreme_leg_spread', 'Very wide leg spread indicating suggestive pose', 'suggestive_detection', 'distance', 0.4, NULL, '>', 0.6, '["public_gallery"]', FALSE),
('bent_over_pose', 'Forward bending pose with hip flexion', 'pose_classification', 'angle', NULL, 100, '<', 0.7, '["public_gallery"]', FALSE),
('provocative_arm_position', 'Arms positioned suggestively', 'suggestive_detection', 'score', 0.3, NULL, '>', 0.5, '["public_gallery"]', FALSE),

-- Safety checks
('horizontal_pose_check', 'Horizontal/lying poses require extra scrutiny', 'safety_check', 'boolean', 1, NULL, '=', 0.8, '["public_gallery", "private_content"]', FALSE),
('extreme_flexibility', 'Unnaturally flexible poses that may indicate manipulation', 'safety_check', 'score', 0.9, NULL, '>', 0.9, '["public_gallery", "private_content", "paysite"]', TRUE);

-- Insert context configurations
INSERT INTO pose_context_config (context_name, age_detection_sensitivity, suggestive_threshold, explicit_threshold, auto_approve_threshold, auto_reject_threshold, minor_detection_threshold, active_rule_categories) VALUES
('public_gallery', 0.9, 0.3, 0.2, 0.15, 0.7, 0.2, '["age_detection", "suggestive_detection", "safety_check"]'),
('private_content', 0.8, 0.5, 0.3, 0.3, 0.8, 0.3, '["age_detection", "safety_check"]'),
('paysite_content', 0.85, 0.6, 0.4, 0.4, 0.85, 0.25, '["age_detection", "safety_check"]');

-- ===================================
-- INDEXES FOR PERFORMANCE
-- ===================================

-- Additional performance indexes
CREATE INDEX idx_pose_metrics_orientation ON pose_metrics(body_orientation);
CREATE INDEX idx_pose_metrics_horizontal ON pose_metrics(is_horizontal_pose);
CREATE INDEX idx_pose_metrics_bending ON pose_metrics(is_bending_over);
CREATE INDEX idx_age_indicators_minor_flag ON age_pose_indicators(potential_minor_flag, age_confidence);
CREATE INDEX idx_adult_analysis_risk ON adult_pose_analysis(risk_level, suggestive_score);
CREATE INDEX idx_audit_review_action ON pose_approval_audit(review_action, review_timestamp);

-- ===================================
-- VIEWS FOR COMMON QUERIES
-- ===================================

-- View for complete pose analysis summary
CREATE VIEW pose_analysis_summary AS
SELECT 
    pm.analysis_id,
    pm.body_orientation,
    pm.torso_angle,
    pm.hip_bend_angle,
    pm.leg_spread,
    pm.is_horizontal_pose,
    pm.is_bending_over,
    api.potential_minor_flag,
    api.age_confidence,
    api.estimated_age_min,
    api.estimated_age_max,
    apa.suggestive_score,
    apa.risk_level,
    apa.recommended_action,
    COUNT(pre.id) as triggered_rules_count,
    COUNT(CASE WHEN par.is_critical = TRUE THEN 1 END) as critical_rules_triggered
FROM pose_metrics pm
LEFT JOIN age_pose_indicators api ON pm.analysis_id = api.analysis_id
LEFT JOIN adult_pose_analysis apa ON pm.analysis_id = apa.analysis_id
LEFT JOIN pose_rule_evaluations pre ON pm.analysis_id = pre.analysis_id AND pre.rule_triggered = TRUE
LEFT JOIN pose_analysis_rules par ON pre.rule_id = par.id
GROUP BY pm.analysis_id;

-- View for flagged content requiring review
CREATE VIEW flagged_pose_content AS
SELECT 
    pm.analysis_id,
    pm.body_orientation,
    api.potential_minor_flag,
    api.requires_human_review as age_review_required,
    apa.risk_level,
    apa.recommended_action,
    COUNT(CASE WHEN par.is_critical = TRUE THEN 1 END) as critical_violations,
    MAX(pre.confidence_score) as max_rule_confidence,
    pm.created_at as analysis_timestamp
FROM pose_metrics pm
LEFT JOIN age_pose_indicators api ON pm.analysis_id = api.analysis_id
LEFT JOIN adult_pose_analysis apa ON pm.analysis_id = apa.analysis_id
LEFT JOIN pose_rule_evaluations pre ON pm.analysis_id = pre.analysis_id AND pre.rule_triggered = TRUE
LEFT JOIN pose_analysis_rules par ON pre.rule_id = par.id
WHERE (
    api.potential_minor_flag = TRUE 
    OR api.requires_human_review = TRUE
    OR apa.recommended_action IN ('human_review', 'auto_reject', 'age_verify')
    OR EXISTS (
        SELECT 1 FROM pose_rule_evaluations pre2 
        JOIN pose_analysis_rules par2 ON pre2.rule_id = par2.id 
        WHERE pre2.analysis_id = pm.analysis_id 
        AND pre2.rule_triggered = TRUE 
        AND par2.is_critical = TRUE
    )
)
GROUP BY pm.analysis_id
ORDER BY critical_violations DESC, max_rule_confidence DESC, pm.created_at DESC;

-- View for complete content analysis (pose + body parts + AI descriptions)
CREATE VIEW complete_content_analysis AS
SELECT 
    pm.analysis_id,
    
    -- Pose Analysis
    pm.body_orientation,
    pm.torso_angle,
    pm.hip_bend_angle,
    pm.leg_spread,
    pm.is_horizontal_pose,
    pm.is_bending_over,
    
    -- Age Analysis
    api.potential_minor_flag,
    api.age_confidence,
    api.estimated_age_min,
    api.estimated_age_max,
    api.requires_human_review as age_requires_review,
    
    -- Adult Content Analysis
    apa.suggestive_score,
    apa.explicit_score,
    apa.risk_level,
    apa.recommended_action as pose_recommended_action,
    
    -- NudeNet Body Parts
    nas.total_parts_detected,
    nas.max_confidence as max_body_part_confidence,
    nas.has_explicit_content,
    nas.has_female_breast,
    nas.has_male_breast,
    nas.has_female_genitalia,
    nas.has_male_genitalia,
    nas.has_buttocks,
    nas.has_anus,
    nas.nudity_risk_score,
    nas.context_appropriateness,
    
    -- AI-Generated Descriptions
    aid.short_description,
    aid.detailed_description,
    aid.content_summary,
    aid.public_description,
    aid.private_description,
    aid.clinical_description,
    aid.ai_model_used,
    aid.generation_confidence,
    aid.human_approved as description_approved,
    
    -- Detected Keywords Summary
    aid.detected_keywords,
    aid.pose_keywords,
    aid.body_part_keywords,
    COUNT(adk.keyword_id) as total_detected_keywords,
    COUNT(CASE WHEN iak.child_safety_flag = TRUE THEN 1 END) as child_safety_keywords,
    
    -- Rule Violations
    COUNT(CASE WHEN par.is_critical = TRUE AND pre.rule_triggered = TRUE THEN 1 END) as critical_pose_violations,
    COUNT(CASE WHEN par.child_safety_priority = TRUE AND pre.rule_triggered = TRUE THEN 1 END) as child_safety_violations,
    nas.triggered_combination_rules,
    
    -- Overall Risk Assessment
    CASE 
        WHEN api.potential_minor_flag = TRUE THEN 'CRITICAL_CHILD_SAFETY'
        WHEN nas.has_explicit_content = TRUE AND api.age_confidence < 0.8 THEN 'HIGH_RISK_AGE_UNCERTAIN'
        WHEN apa.risk_level = 'critical' OR nas.nudity_risk_score > 90 THEN 'CRITICAL_ADULT_CONTENT'
        WHEN apa.risk_level = 'high' OR nas.nudity_risk_score > 70 THEN 'HIGH_RISK'
        WHEN apa.risk_level = 'medium' OR nas.nudity_risk_score > 40 THEN 'MEDIUM_RISK'
        ELSE 'LOW_RISK'
    END as overall_risk_level,
    
    -- Timestamps
    pm.created_at as analysis_timestamp,
    aid.generation_timestamp as description_generated_at,
    
    -- Audit Trail
    paa.review_action as human_review_decision,
    paa.reviewed_by_user_id,
    paa.review_timestamp
    
FROM pose_metrics pm
LEFT JOIN age_pose_indicators api ON pm.analysis_id = api.analysis_id
LEFT JOIN adult_pose_analysis apa ON pm.analysis_id = apa.analysis_id
LEFT JOIN nudenet_analysis_summary nas ON pm.analysis_id = nas.analysis_id
LEFT JOIN ai_image_descriptions aid ON pm.analysis_id = aid.analysis_id
LEFT JOIN analysis_detected_keywords adk ON pm.analysis_id = adk.analysis_id
LEFT JOIN image_analysis_keywords iak ON adk.keyword_id = iak.id
LEFT JOIN pose_rule_evaluations pre ON pm.analysis_id = pre.analysis_id AND pre.rule_triggered = TRUE
LEFT JOIN pose_analysis_rules par ON pre.rule_id = par.id
LEFT JOIN pose_approval_audit paa ON pm.analysis_id = paa.analysis_id
GROUP BY pm.analysis_id
ORDER BY 
    CASE overall_risk_level
        WHEN 'CRITICAL_CHILD_SAFETY' THEN 1
        WHEN 'HIGH_RISK_AGE_UNCERTAIN' THEN 2
        WHEN 'CRITICAL_ADULT_CONTENT' THEN 3
        WHEN 'HIGH_RISK' THEN 4
        WHEN 'MEDIUM_RISK' THEN 5
        ELSE 6
    END,
    pm.created_at DESC;

-- View for body part allowance violations per context
CREATE VIEW body_part_violations_by_context AS
SELECT 
    nd.analysis_id,
    nd.body_part,
    nd.confidence_score,
    bpa.context_name,
    bpa.is_allowed,
    bpa.max_confidence_threshold,
    bpa.requires_blur,
    bpa.requires_human_review,
    bpa.auto_reject_threshold,
    bpa.default_blur_strength,
    bpa.requires_age_verification,
    
    -- Violation flags
    CASE 
        WHEN bpa.is_allowed = FALSE AND nd.confidence_score > 5.0 THEN TRUE
        WHEN bpa.is_allowed = TRUE AND nd.confidence_score > bpa.max_confidence_threshold THEN TRUE
        ELSE FALSE
    END as is_violation,
    
    CASE 
        WHEN nd.confidence_score >= bpa.auto_reject_threshold THEN TRUE
        ELSE FALSE
    END as should_auto_reject,
    
    CASE 
        WHEN bpa.requires_age_verification = TRUE AND api.age_confidence < 0.8 THEN TRUE
        ELSE FALSE
    END as requires_age_check,
    
    nd.detection_timestamp,
    api.potential_minor_flag,
    api.age_confidence
    
FROM nudenet_detections nd
CROSS JOIN body_part_allowances bpa ON nd.body_part = bpa.body_part
LEFT JOIN age_pose_indicators api ON nd.analysis_id = api.analysis_id
WHERE nd.confidence_score > 1.0  -- Only include meaningful detections
ORDER BY 
    is_violation DESC, 
    should_auto_reject DESC, 
    nd.confidence_score DESC,
    nd.detection_timestamp DESC;

-- View for AI description management and quality control
CREATE VIEW ai_description_management AS
SELECT 
    aid.analysis_id,
    aid.short_description,
    aid.detailed_description,
    aid.content_summary,
    aid.public_description,
    aid.private_description,
    aid.clinical_description,
    
    -- AI Generation Details
    aid.ai_model_used,
    aid.generation_confidence,
    aid.generation_timestamp,
    
    -- Quality Control Status
    aid.human_reviewed,
    aid.human_approved,
    aid.human_reviewer_id,
    aid.human_review_notes,
    aid.human_review_timestamp,
    
    -- Usage Statistics
    aid.description_used_count,
    aid.last_used_timestamp,
    
    -- Keywords Summary
    aid.detected_keywords,
    aid.pose_keywords,
    aid.body_part_keywords,
    
    -- Analysis Context
    api.potential_minor_flag,
    nas.has_explicit_content,
    nas.context_appropriateness,
    
    -- Keyword Breakdown
    COUNT(adk.keyword_id) as total_keywords,
    COUNT(CASE WHEN iak.child_safety_flag = TRUE THEN 1 END) as child_safety_keywords,
    COUNT(CASE WHEN iak.severity_level = 'critical' THEN 1 END) as critical_keywords,
    COUNT(CASE WHEN iak.severity_level = 'explicit' THEN 1 END) as explicit_keywords,
    COUNT(CASE WHEN iak.public_appropriate = FALSE THEN 1 END) as non_public_keywords,
    
    -- Quality Flags
    CASE 
        WHEN aid.human_approved = TRUE THEN 'APPROVED'
        WHEN aid.human_reviewed = TRUE AND aid.human_approved = FALSE THEN 'REJECTED'
        WHEN aid.human_reviewed = FALSE AND aid.generation_confidence > 0.8 THEN 'PENDING_HIGH_CONFIDENCE'
        WHEN aid.human_reviewed = FALSE AND aid.generation_confidence < 0.5 THEN 'NEEDS_REVIEW_LOW_CONFIDENCE'
        ELSE 'PENDING_REVIEW'
    END as quality_status,
    
    -- Description Completeness
    CASE 
        WHEN aid.public_description IS NOT NULL AND aid.private_description IS NOT NULL AND aid.clinical_description IS NOT NULL THEN 'COMPLETE'
        WHEN aid.short_description IS NOT NULL AND aid.detailed_description IS NOT NULL THEN 'PARTIAL'
        ELSE 'INCOMPLETE'
    END as description_completeness
    
FROM ai_image_descriptions aid
LEFT JOIN age_pose_indicators api ON aid.analysis_id = api.analysis_id
LEFT JOIN nudenet_analysis_summary nas ON aid.analysis_id = nas.analysis_id
LEFT JOIN analysis_detected_keywords adk ON aid.analysis_id = adk.analysis_id
LEFT JOIN image_analysis_keywords iak ON adk.keyword_id = iak.id
GROUP BY aid.analysis_id
ORDER BY 
    CASE quality_status
        WHEN 'NEEDS_REVIEW_LOW_CONFIDENCE' THEN 1
        WHEN 'PENDING_REVIEW' THEN 2
        WHEN 'PENDING_HIGH_CONFIDENCE' THEN 3
        WHEN 'REJECTED' THEN 4
        WHEN 'APPROVED' THEN 5
    END,
    aid.generation_timestamp DESC;

-- ===================================
-- WORKFLOW MANAGEMENT VIEWS  
-- ===================================

-- Master view combining workflow status with analysis results
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
    nas.has_explicit_content,
    nas.nudity_risk_score,
    
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
    MAX(cr.report_timestamp) as latest_report_date,
    MAX(ma.appeal_timestamp) as latest_appeal_date,
    
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
    END as requires_human_review,
    
    CASE
        WHEN imq.final_decision_timestamp IS NULL AND imq.upload_timestamp < DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN TRUE
        ELSE FALSE
    END as processing_overdue

FROM image_moderation_queue imq
LEFT JOIN pose_metrics pm ON imq.analysis_id = pm.analysis_id
LEFT JOIN age_pose_indicators api ON imq.analysis_id = api.analysis_id  
LEFT JOIN adult_pose_analysis apa ON imq.analysis_id = apa.analysis_id
LEFT JOIN nudenet_analysis_summary nas ON imq.analysis_id = nas.analysis_id
LEFT JOIN ai_image_descriptions aid ON imq.analysis_id = aid.analysis_id
LEFT JOIN content_reports cr ON imq.image_id = cr.image_id
LEFT JOIN moderation_appeals ma ON imq.image_id = ma.image_id
GROUP BY imq.image_id
ORDER BY 
    requires_immediate_attention DESC,
    imq.priority_level = 'CRITICAL_CHILD_SAFETY' DESC,
    imq.priority_level = 'HIGH_RISK_AGE_UNCERTAIN' DESC,
    processing_overdue DESC,
    imq.upload_timestamp DESC;

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
        WHEN nas.has_explicit_content = TRUE AND api.age_confidence < 0.8 THEN 'Explicit content with uncertain age'
        WHEN apa.risk_level = 'critical' THEN 'High-risk pose detected'
        WHEN nas.nudity_risk_score > 90 THEN 'High nudity confidence'
        WHEN COUNT(cr.id) > 0 THEN 'User reports received'
        ELSE 'Standard policy review'
    END as review_reason,
    
    -- Analysis summary for quick review
    COALESCE(aid.short_description, 'No AI description available') as ai_summary,
    nas.has_female_breast,
    nas.has_male_breast, 
    nas.has_female_genitalia,
    nas.has_male_genitalia,
    nas.has_buttocks,
    nas.has_anus,
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
    COUNT(cr.id) as report_count,
    MAX(cr.report_category) as latest_report_category

FROM image_moderation_queue imq
LEFT JOIN pose_metrics pm ON imq.analysis_id = pm.analysis_id
LEFT JOIN age_pose_indicators api ON imq.analysis_id = api.analysis_id
LEFT JOIN adult_pose_analysis apa ON imq.analysis_id = apa.analysis_id  
LEFT JOIN nudenet_analysis_summary nas ON imq.analysis_id = nas.analysis_id
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

-- Reports management view
CREATE VIEW content_reports_dashboard AS
SELECT 
    cr.id as report_id,
    cr.image_id,
    cr.report_category,
    cr.report_description,
    cr.report_status,
    cr.resolution_action,
    
    -- Reporter info (anonymized for privacy)
    CASE 
        WHEN cr.reporter_user_id IS NOT NULL THEN 'Registered User'
        ELSE 'Anonymous'
    END as reporter_type,
    cr.reporter_email,
    
    -- Image context
    imq.model_id,
    imq.slug,
    imq.original_filename,
    imq.status as image_status,
    imq.child_safety_flag,
    
    -- Assignment and investigation
    cr.assigned_to_user_id,
    u.email as assigned_to_email,
    cr.investigation_notes,
    
    -- Timing
    cr.report_timestamp,
    cr.investigation_start_timestamp,
    cr.resolution_timestamp,
    TIMESTAMPDIFF(HOUR, cr.report_timestamp, COALESCE(cr.resolution_timestamp, NOW())) as investigation_hours,
    
    -- Priority scoring based on category
    CASE cr.report_category
        WHEN 'child_safety_concern' THEN 1
        WHEN 'non_consensual_content' THEN 2
        WHEN 'identity_theft' THEN 3
        WHEN 'copyright_infringement' THEN 4
        ELSE 5
    END as investigation_priority,
    
    -- SLA compliance
    CASE 
        WHEN cr.report_category = 'child_safety_concern' AND 
             TIMESTAMPDIFF(HOUR, cr.report_timestamp, COALESCE(cr.resolution_timestamp, NOW())) > 1 THEN TRUE
        WHEN cr.report_category = 'non_consensual_content' AND
             TIMESTAMPDIFF(HOUR, cr.report_timestamp, COALESCE(cr.resolution_timestamp, NOW())) > 24 THEN TRUE
        WHEN cr.report_category = 'identity_theft' AND
             TIMESTAMPDIFF(HOUR, cr.report_timestamp, COALESCE(cr.resolution_timestamp, NOW())) > 72 THEN TRUE
        ELSE FALSE
    END as sla_breached

FROM content_reports cr
LEFT JOIN image_moderation_queue imq ON cr.image_id = imq.image_id
LEFT JOIN users u ON cr.assigned_to_user_id = u.id
ORDER BY 
    investigation_priority,
    sla_breached DESC,
    cr.report_timestamp DESC;