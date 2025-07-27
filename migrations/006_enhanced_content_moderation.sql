-- Enhanced Content Moderation Schema with Usage Intent & Appeal System
-- Migration: 006_enhanced_content_moderation.sql

-- Drop existing tables if they exist (for clean migration)
DROP TABLE IF EXISTS moderation_appeals;
DROP TABLE IF EXISTS moderation_rules_config;

-- Add new columns to existing content_moderation table
ALTER TABLE content_moderation 
ADD COLUMN usage_intent ENUM('public_site', 'paysite', 'store', 'private') DEFAULT 'public_site' AFTER context_type,
ADD COLUMN original_path VARCHAR(500) NULL AFTER image_path,
ADD COLUMN blurred_path VARCHAR(500) NULL AFTER original_path,
ADD COLUMN final_location ENUM('originals', 'public', 'public_blurred', 'paysite', 'store', 'rejected', 'private') DEFAULT 'originals' AFTER blurred_path,
ADD COLUMN flagged BOOLEAN DEFAULT FALSE AFTER human_review_required,
ADD COLUMN appeal_requested BOOLEAN DEFAULT FALSE AFTER flagged,
ADD COLUMN admin_override BOOLEAN DEFAULT FALSE AFTER appeal_requested,
ADD COLUMN auto_blocked BOOLEAN DEFAULT FALSE AFTER admin_override,
ADD COLUMN part_locations JSON NULL AFTER detected_parts,
ADD COLUMN blur_settings JSON NULL AFTER part_locations,
ADD COLUMN model_notes TEXT NULL AFTER blur_settings,
ADD COLUMN admin_notes TEXT NULL AFTER model_notes;

-- Create moderation appeals table
CREATE TABLE moderation_appeals (
    id INT PRIMARY KEY AUTO_INCREMENT,
    content_moderation_id INT NOT NULL,
    model_id INT NOT NULL,
    appeal_reason TEXT NOT NULL,
    appeal_message TEXT NULL,
    status ENUM('pending', 'approved', 'rejected', 'needs_info') DEFAULT 'pending',
    admin_response TEXT NULL,
    reviewed_by INT NULL,
    reviewed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (content_moderation_id) REFERENCES content_moderation(id) ON DELETE CASCADE,
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES admin_users(id) ON DELETE SET NULL,
    
    INDEX idx_appeals_status (status),
    INDEX idx_appeals_model (model_id),
    INDEX idx_appeals_created (created_at)
);

-- Create moderation rules configuration table
CREATE TABLE moderation_rules_config (
    id INT PRIMARY KEY AUTO_INCREMENT,
    usage_intent ENUM('public_site', 'paysite', 'store', 'private') NOT NULL,
    rule_name VARCHAR(100) NOT NULL,
    rule_type ENUM('nudity_threshold', 'blocked_labels', 'auto_approve', 'require_review') NOT NULL,
    rule_value JSON NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (created_by) REFERENCES admin_users(id) ON DELETE SET NULL,
    
    UNIQUE KEY unique_rule (usage_intent, rule_name),
    INDEX idx_rules_intent (usage_intent),
    INDEX idx_rules_active (is_active)
);

-- Insert default moderation rules
INSERT INTO moderation_rules_config (usage_intent, rule_name, rule_type, rule_value) VALUES
-- Public site rules (strict)
('public_site', 'nudity_threshold', 'nudity_threshold', '{"max_confidence": 20, "auto_flag": true}'),
('public_site', 'blocked_labels', 'blocked_labels', '["GENITALIA", "SEXUAL_ACTIVITY", "ANUS_EXPOSED"]'),
('public_site', 'auto_approve_threshold', 'auto_approve', '{"max_confidence": 10, "allowed_labels": ["COVERED", "CLOTHED"]}'),

-- Paysite rules (moderate)
('paysite', 'nudity_threshold', 'nudity_threshold', '{"max_confidence": 80, "auto_flag": true}'),
('paysite', 'blocked_labels', 'blocked_labels', '["SEXUAL_ACTIVITY", "ILLEGAL_CONTENT"]'),
('paysite', 'auto_approve_threshold', 'auto_approve', '{"max_confidence": 60, "allowed_labels": ["BREAST_EXPOSED", "BUTTOCKS_EXPOSED"]}'),

-- Store rules (lenient)
('store', 'nudity_threshold', 'nudity_threshold', '{"max_confidence": 90, "auto_flag": true}'),
('store', 'blocked_labels', 'blocked_labels', '["ILLEGAL_CONTENT", "VIOLENCE"]'),
('store', 'auto_approve_threshold', 'auto_approve', '{"max_confidence": 85, "allowed_labels": ["GENITALIA", "BREAST_EXPOSED", "BUTTOCKS_EXPOSED"]}'),

-- Private rules (minimal restrictions)
('private', 'nudity_threshold', 'nudity_threshold', '{"max_confidence": 95, "auto_flag": false}'),
('private', 'blocked_labels', 'blocked_labels', '["ILLEGAL_CONTENT"]'),
('private', 'auto_approve_threshold', 'auto_approve', '{"max_confidence": 95, "allowed_labels": ["*"]});

-- Create image file versions table (tracks different processed versions)
CREATE TABLE image_file_versions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    content_moderation_id INT NOT NULL,
    version_type ENUM('original', 'thumbnail', 'blurred', 'censored', 'watermarked') NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INT NULL,
    dimensions VARCHAR(20) NULL, -- e.g., "1920x1080"
    processing_settings JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (content_moderation_id) REFERENCES content_moderation(id) ON DELETE CASCADE,
    
    INDEX idx_versions_content (content_moderation_id),
    INDEX idx_versions_type (version_type)
);

-- Update moderation_queue table to include appeal information
ALTER TABLE moderation_queue 
ADD COLUMN appeal_id INT NULL AFTER content_moderation_id,
ADD COLUMN queue_type ENUM('auto_flagged', 'manual_review', 'appeal', 'admin_override') DEFAULT 'auto_flagged' AFTER priority,
ADD COLUMN model_id INT NULL AFTER assigned_to,
ADD FOREIGN KEY (appeal_id) REFERENCES moderation_appeals(id) ON DELETE SET NULL,
ADD FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE;

-- Create indexes for performance
CREATE INDEX idx_content_moderation_usage_intent ON content_moderation(usage_intent);
CREATE INDEX idx_content_moderation_flagged ON content_moderation(flagged);
CREATE INDEX idx_content_moderation_appeal_requested ON content_moderation(appeal_requested);
CREATE INDEX idx_content_moderation_final_location ON content_moderation(final_location);
CREATE INDEX idx_moderation_queue_type ON moderation_queue(queue_type);

-- Create view for admin dashboard
CREATE VIEW admin_moderation_dashboard AS
SELECT 
    cm.id,
    cm.model_id,
    m.name as model_name,
    cm.image_path,
    cm.original_path,
    cm.blurred_path,
    cm.usage_intent,
    cm.nudity_score,
    cm.detected_parts,
    cm.part_locations,
    cm.moderation_status,
    cm.flagged,
    cm.appeal_requested,
    cm.final_location,
    cm.created_at,
    ma.id as appeal_id,
    ma.appeal_reason,
    ma.status as appeal_status,
    mq.priority as queue_priority,
    mq.queue_type
FROM content_moderation cm
LEFT JOIN models m ON cm.model_id = m.id
LEFT JOIN moderation_appeals ma ON cm.id = ma.content_moderation_id
LEFT JOIN moderation_queue mq ON cm.id = mq.content_moderation_id
WHERE cm.flagged = TRUE OR cm.appeal_requested = TRUE OR mq.id IS NOT NULL
ORDER BY mq.priority DESC, cm.created_at ASC;

-- Success message
SELECT 'Enhanced Content Moderation Schema installed successfully!' as status;