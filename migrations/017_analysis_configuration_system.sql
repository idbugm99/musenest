-- Analysis Configuration System
-- Allows remote management of NudeNet/BLIP detection settings per usage intent

-- API Keys for remote configuration management
CREATE TABLE IF NOT EXISTS api_keys (
    id INT PRIMARY KEY AUTO_INCREMENT,
    key_name VARCHAR(255) NOT NULL UNIQUE,
    api_key VARCHAR(255) NOT NULL UNIQUE,
    permissions JSON NOT NULL, -- What endpoints this key can access
    is_active BOOLEAN DEFAULT true,
    created_by VARCHAR(255),
    expires_at TIMESTAMP NULL,
    last_used_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_api_key (api_key),
    INDEX idx_active (is_active),
    INDEX idx_expires (expires_at)
);

-- Analysis Configurations - What to detect and how to score it
CREATE TABLE IF NOT EXISTS analysis_configurations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    usage_intent ENUM('public_site', 'paysite', 'store', 'private') NOT NULL,
    model_id INT NULL, -- NULL = global rule for usage_intent, specific model overrides global
    
    -- What body parts/components to detect (true/false flags)
    detection_config JSON NOT NULL,
    
    -- How detections affect the final nudity score
    scoring_config JSON NOT NULL,
    
    -- BLIP analysis settings (age estimation, child detection, etc.)
    blip_config JSON NOT NULL,
    
    -- Control flags
    is_active BOOLEAN DEFAULT true,
    version INT DEFAULT 1,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Ensure only one active config per usage_intent+model combination
    UNIQUE KEY unique_active_config (usage_intent, model_id, is_active),
    
    INDEX idx_usage_intent (usage_intent),
    INDEX idx_model_id (model_id),
    INDEX idx_active (is_active),
    INDEX idx_version (version),
    
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE
);

-- Audit trail for configuration changes
CREATE TABLE IF NOT EXISTS analysis_config_audit (
    id INT PRIMARY KEY AUTO_INCREMENT,
    config_id INT,
    action ENUM('create', 'update', 'delete', 'activate', 'deactivate') NOT NULL,
    
    -- Who made the change
    changed_by VARCHAR(255), -- API key name or user identifier
    api_key_used VARCHAR(255), -- Which API key was used
    source_ip VARCHAR(45),
    user_agent TEXT,
    
    -- What changed
    changes JSON, -- New values
    previous_values JSON, -- Old values (for updates)
    
    -- Context
    usage_intent VARCHAR(50),
    model_id INT NULL,
    
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_config_id (config_id),
    INDEX idx_timestamp (timestamp),
    INDEX idx_changed_by (changed_by),
    INDEX idx_usage_intent (usage_intent),
    INDEX idx_action (action),
    
    FOREIGN KEY (config_id) REFERENCES analysis_configurations(id) ON DELETE SET NULL
);

-- Default API key for phoenix4ge (you can change this)
INSERT IGNORE INTO api_keys (key_name, api_key, permissions, is_active, created_by) VALUES (
    'phoenix4ge_config_manager',
    'mns_config_2025_secure_key_change_me_immediately',
    JSON_OBJECT(
        'analysis_config', JSON_ARRAY('read', 'write', 'delete'),
        'audit_trail', JSON_ARRAY('read')
    ),
    true,
    'system_initial_setup'
);

-- Example configuration structures (commented for reference)
/*
detection_config format:
{
  "nudenet_components": {
    "breast_detection": true,
    "genitalia_detection": true,
    "buttocks_detection": true,
    "anus_detection": false,
    "face_detection": true
  },
  "blip_components": {
    "age_estimation": true,
    "child_content_detection": true,
    "image_description": false
  }
}

scoring_config format:
{
  "detection_weights": {
    "BREAST_EXPOSED": 25,
    "GENITALIA": 85,
    "BUTTOCKS_EXPOSED": 20,
    "ANUS_EXPOSED": 60,
    "FACE_DETECTED": 0
  },
  "thresholds": {
    "auto_approve_under": 15,
    "auto_flag_over": 70,
    "auto_reject_over": 90
  },
  "risk_multipliers": {
    "underage_detected": 10.0,
    "child_content_blip": 5.0
  }
}

blip_config format:
{
  "enabled": true,
  "child_detection_keywords": ["child", "kid", "baby", "toddler", "minor"],
  "age_estimation_threshold": 18,
  "description_analysis": false,
  "webhook_delivery": true
}
*/