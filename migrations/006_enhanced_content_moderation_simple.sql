-- Enhanced Content Moderation Schema with Usage Intent & Appeal System (Simple)
-- Migration: 006_enhanced_content_moderation_simple.sql

-- Create moderation appeals table
CREATE TABLE IF NOT EXISTS moderation_appeals (
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
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
    
    INDEX idx_appeals_status (status),
    INDEX idx_appeals_model (model_id),
    INDEX idx_appeals_created (created_at)
);

-- Create moderation rules configuration table
CREATE TABLE IF NOT EXISTS moderation_rules_config (
    id INT PRIMARY KEY AUTO_INCREMENT,
    usage_intent ENUM('public_site', 'paysite', 'store', 'private') NOT NULL,
    rule_name VARCHAR(100) NOT NULL,
    rule_type ENUM('nudity_threshold', 'blocked_labels', 'auto_approve', 'require_review') NOT NULL,
    rule_value JSON NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    
    UNIQUE KEY unique_rule (usage_intent, rule_name),
    INDEX idx_rules_intent (usage_intent),
    INDEX idx_rules_active (is_active)
);

-- Insert default moderation rules
INSERT IGNORE INTO moderation_rules_config (usage_intent, rule_name, rule_type, rule_value) VALUES
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
('private', 'auto_approve_threshold', 'auto_approve', '{"max_confidence": 95, "allowed_labels": ["*"]}');

-- Create image file versions table
CREATE TABLE IF NOT EXISTS image_file_versions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    content_moderation_id INT NOT NULL,
    version_type ENUM('original', 'thumbnail', 'blurred', 'censored', 'watermarked') NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INT NULL,
    dimensions VARCHAR(20) NULL,
    processing_settings JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (content_moderation_id) REFERENCES content_moderation(id) ON DELETE CASCADE,
    
    INDEX idx_versions_content (content_moderation_id),
    INDEX idx_versions_type (version_type)
);

-- Success message
SELECT 'Enhanced Content Moderation Schema installed successfully!' as status;