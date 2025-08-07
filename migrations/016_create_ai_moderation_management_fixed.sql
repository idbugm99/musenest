-- Migration 016: Create AI Moderation Management System (Fixed)
-- Multi-server, multi-industry white-label platform management

USE musenest;

-- Drop existing tables if they exist (development only)
-- DROP TABLE IF EXISTS server_health_logs;
-- DROP TABLE IF EXISTS configuration_deployments;
-- DROP TABLE IF EXISTS site_configurations;
-- DROP TABLE IF EXISTS industry_templates;
-- DROP TABLE IF EXISTS ai_moderation_servers;

-- Table 1: AI Moderation Servers
CREATE TABLE IF NOT EXISTS ai_moderation_servers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL COMMENT 'Friendly server name',
    description TEXT COMMENT 'Server description/purpose',
    ip_address VARCHAR(45) NOT NULL COMMENT 'Server IP address (IPv4/IPv6)',
    port INT NOT NULL DEFAULT 5000 COMMENT 'Server port',
    protocol ENUM('http', 'https') DEFAULT 'http' COMMENT 'Connection protocol',
    status ENUM('active', 'inactive', 'maintenance', 'error') DEFAULT 'active',
    last_ping TIMESTAMP NULL COMMENT 'Last successful health check',
    response_time_ms INT DEFAULT NULL COMMENT 'Average response time',
    api_key VARCHAR(255) DEFAULT NULL COMMENT 'Server authentication key',
    max_concurrent_requests INT DEFAULT 10 COMMENT 'Max concurrent requests',
    
    -- Server capabilities
    supports_nudenet BOOLEAN DEFAULT TRUE,
    supports_blip BOOLEAN DEFAULT TRUE,
    supports_face_analysis BOOLEAN DEFAULT TRUE,
    server_version VARCHAR(50) DEFAULT NULL,
    
    -- Management
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT DEFAULT NULL,
    
    UNIQUE KEY unique_server_endpoint (ip_address, port),
    INDEX idx_status (status),
    INDEX idx_last_ping (last_ping)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table 2: Industry Templates
CREATE TABLE IF NOT EXISTS industry_templates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    industry_type VARCHAR(50) NOT NULL UNIQUE COMMENT 'Industry identifier',
    display_name VARCHAR(100) NOT NULL COMMENT 'Human-readable industry name',
    description TEXT COMMENT 'Industry description and use cases',
    
    -- NudeNet Configuration
    nudenet_config JSON NOT NULL COMMENT 'NudeNet detection settings',
    
    -- BLIP Configuration  
    blip_config JSON NOT NULL COMMENT 'BLIP analysis settings',
    
    -- General Moderation Rules
    moderation_rules JSON NOT NULL COMMENT 'General moderation parameters',
    
    -- Usage Intent Mappings
    usage_intents JSON NOT NULL COMMENT 'Supported usage intents and their configs',
    
    -- Legal/Compliance Settings
    compliance_rules JSON DEFAULT NULL COMMENT 'Legal compliance requirements',
    
    -- Template metadata
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT DEFAULT NULL,
    
    INDEX idx_industry_type (industry_type),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table 3: Site Configurations
CREATE TABLE IF NOT EXISTS site_configurations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    site_name VARCHAR(100) NOT NULL COMMENT 'Website/client name',
    site_domain VARCHAR(255) DEFAULT NULL COMMENT 'Primary domain',
    site_identifier VARCHAR(50) NOT NULL UNIQUE COMMENT 'Unique site ID',
    
    -- Server Assignment
    server_id INT NOT NULL COMMENT 'Assigned AI moderation server',
    
    -- Industry Classification
    industry_template_id INT NOT NULL COMMENT 'Base industry template',
    
    -- Custom Configuration Overrides
    custom_nudenet_config JSON DEFAULT NULL COMMENT 'Site-specific NudeNet overrides',
    custom_blip_config JSON DEFAULT NULL COMMENT 'Site-specific BLIP overrides',  
    custom_moderation_rules JSON DEFAULT NULL COMMENT 'Site-specific moderation overrides',
    custom_usage_intents JSON DEFAULT NULL COMMENT 'Site-specific usage intent configs',
    
    -- Deployment Status
    config_version INT DEFAULT 1 COMMENT 'Configuration version number',
    last_deployed_at TIMESTAMP NULL COMMENT 'Last successful deployment',
    deployment_status ENUM('pending', 'deployed', 'failed', 'outdated') DEFAULT 'pending',
    deployment_error TEXT DEFAULT NULL COMMENT 'Last deployment error if any',
    
    -- Site Management
    is_active BOOLEAN DEFAULT TRUE,
    webhook_url VARCHAR(500) DEFAULT NULL COMMENT 'Site webhook for results',
    contact_email VARCHAR(255) DEFAULT NULL COMMENT 'Site admin contact',
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT DEFAULT NULL,
    
    INDEX idx_site_identifier (site_identifier),
    INDEX idx_server_id (server_id),
    INDEX idx_industry_template (industry_template_id),
    INDEX idx_deployment_status (deployment_status),
    INDEX idx_is_active (is_active),
    FOREIGN KEY (server_id) REFERENCES ai_moderation_servers(id) ON DELETE RESTRICT,
    FOREIGN KEY (industry_template_id) REFERENCES industry_templates(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table 4: Configuration Deployments
CREATE TABLE IF NOT EXISTS configuration_deployments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    site_config_id INT NOT NULL,
    server_id INT NOT NULL,
    
    -- Deployment Details
    deployment_type ENUM('full', 'nudenet_only', 'blip_only', 'rules_only') DEFAULT 'full',
    config_snapshot JSON NOT NULL COMMENT 'Full configuration snapshot',
    deployment_status ENUM('pending', 'in_progress', 'success', 'failed', 'rolled_back') DEFAULT 'pending',
    
    -- Execution Details
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    execution_time_ms INT DEFAULT NULL,
    error_message TEXT DEFAULT NULL,
    
    -- Server Response
    server_response JSON DEFAULT NULL COMMENT 'Server response data',
    restart_required BOOLEAN DEFAULT TRUE,
    restart_completed BOOLEAN DEFAULT FALSE,
    restart_completed_at TIMESTAMP NULL,
    
    -- Deployment metadata
    deployed_by INT DEFAULT NULL,
    rollback_target_id INT DEFAULT NULL COMMENT 'Target deployment for rollback',
    
    INDEX idx_site_config (site_config_id),
    INDEX idx_server_id (server_id),
    INDEX idx_deployment_status (deployment_status),
    INDEX idx_started_at (started_at),
    FOREIGN KEY (site_config_id) REFERENCES site_configurations(id) ON DELETE CASCADE,
    FOREIGN KEY (server_id) REFERENCES ai_moderation_servers(id) ON DELETE CASCADE,
    FOREIGN KEY (rollback_target_id) REFERENCES configuration_deployments(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table 5: Server Health Monitoring
CREATE TABLE IF NOT EXISTS server_health_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    server_id INT NOT NULL,
    
    -- Health Check Results
    status ENUM('online', 'offline', 'degraded', 'error') NOT NULL,
    response_time_ms INT DEFAULT NULL,
    cpu_usage DECIMAL(5,2) DEFAULT NULL,
    memory_usage DECIMAL(5,2) DEFAULT NULL,
    disk_usage DECIMAL(5,2) DEFAULT NULL,
    
    -- Service Status
    nudenet_status ENUM('running', 'stopped', 'error') DEFAULT NULL,
    blip_status ENUM('running', 'stopped', 'error') DEFAULT NULL,
    api_status ENUM('running', 'stopped', 'error') DEFAULT NULL,
    
    -- Error Information
    error_message TEXT DEFAULT NULL,
    error_code VARCHAR(50) DEFAULT NULL,
    
    -- Timestamp
    checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_server_id (server_id),
    INDEX idx_status (status),
    INDEX idx_checked_at (checked_at),
    FOREIGN KEY (server_id) REFERENCES ai_moderation_servers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert/Update Industry Templates
INSERT INTO industry_templates (industry_type, display_name, description, nudenet_config, blip_config, moderation_rules, usage_intents) VALUES
('adult_entertainment', 'Adult Entertainment', 'General adult entertainment websites and platforms', 
JSON_OBJECT(
    'detection_threshold', 0.6,
    'body_parts', JSON_OBJECT(
        'EXPOSED_GENITALIA_F', 0.8,
        'EXPOSED_GENITALIA_M', 0.8,
        'EXPOSED_BREAST_F', 0.7,
        'EXPOSED_BUTTOCKS', 0.6,
        'EXPOSED_BELLY', 0.3,
        'COVERED_GENITALIA_F', 0.4,
        'COVERED_GENITALIA_M', 0.4,
        'COVERED_BREAST_F', 0.4
    )
), 
JSON_OBJECT(
    'child_keywords', JSON_ARRAY('child', 'kid', 'minor', 'young', 'teen', 'school', 'underage'),
    'risk_multiplier', 2.0,
    'enable_description', true
),
JSON_OBJECT(
    'auto_approve_threshold', 30.0,
    'auto_reject_threshold', 90.0,
    'require_human_review_threshold', 70.0
),
JSON_OBJECT(
    'public_site', JSON_OBJECT('approval_threshold', 20.0, 'rejection_threshold', 60.0),
    'paysite', JSON_OBJECT('approval_threshold', 50.0, 'rejection_threshold', 85.0),
    'store', JSON_OBJECT('approval_threshold', 40.0, 'rejection_threshold', 80.0),
    'private', JSON_OBJECT('approval_threshold', 70.0, 'rejection_threshold', 95.0)
)),

('swingers_lifestyle', 'Swingers & Lifestyle', 'Swinger and lifestyle community platforms',
JSON_OBJECT(
    'detection_threshold', 0.5,
    'body_parts', JSON_OBJECT(
        'EXPOSED_GENITALIA_F', 0.9,
        'EXPOSED_GENITALIA_M', 0.9,
        'EXPOSED_BREAST_F', 0.8,
        'EXPOSED_BUTTOCKS', 0.7,
        'EXPOSED_BELLY', 0.2,
        'COVERED_GENITALIA_F', 0.3,
        'COVERED_GENITALIA_M', 0.3,
        'COVERED_BREAST_F', 0.3
    )
),
JSON_OBJECT(
    'child_keywords', JSON_ARRAY('child', 'kid', 'minor', 'young', 'teen', 'school', 'underage', 'family'),
    'risk_multiplier', 3.0,
    'enable_description', true
),
JSON_OBJECT(
    'auto_approve_threshold', 40.0,
    'auto_reject_threshold', 85.0,
    'require_human_review_threshold', 65.0,
    'allow_artistic_nudity', true
),
JSON_OBJECT(
    'public_site', JSON_OBJECT('approval_threshold', 30.0, 'rejection_threshold', 70.0),
    'paysite', JSON_OBJECT('approval_threshold', 60.0, 'rejection_threshold', 90.0),
    'private', JSON_OBJECT('approval_threshold', 80.0, 'rejection_threshold', 95.0)
)),

('escort_services', 'Escort & Adult Services', 'Escort directories and adult service platforms',
JSON_OBJECT(
    'detection_threshold', 0.7,
    'body_parts', JSON_OBJECT(
        'EXPOSED_GENITALIA_F', 0.95,
        'EXPOSED_GENITALIA_M', 0.95,
        'EXPOSED_BREAST_F', 0.8,
        'EXPOSED_BUTTOCKS', 0.7,
        'EXPOSED_BELLY', 0.4,
        'COVERED_GENITALIA_F', 0.5,
        'COVERED_GENITALIA_M', 0.5,
        'COVERED_BREAST_F', 0.5
    )
),
JSON_OBJECT(
    'child_keywords', JSON_ARRAY('child', 'kid', 'minor', 'young', 'teen', 'school', 'underage', 'barely', 'fresh'),
    'risk_multiplier', 5.0,
    'enable_description', true
),
JSON_OBJECT(
    'auto_approve_threshold', 20.0,
    'auto_reject_threshold', 95.0,
    'require_human_review_threshold', 80.0,
    'strict_compliance', true
),
JSON_OBJECT(
    'public_site', JSON_OBJECT('approval_threshold', 15.0, 'rejection_threshold', 50.0),
    'paysite', JSON_OBJECT('approval_threshold', 35.0, 'rejection_threshold', 70.0),
    'store', JSON_OBJECT('approval_threshold', 25.0, 'rejection_threshold', 60.0)
)),

('conservative', 'Conservative/Mainstream', 'Conservative content standards for mainstream audiences',
JSON_OBJECT(
    'detection_threshold', 0.1,
    'body_parts', JSON_OBJECT(
        'EXPOSED_GENITALIA_F', 0.1,
        'EXPOSED_GENITALIA_M', 0.1,
        'EXPOSED_BREAST_F', 0.2,
        'EXPOSED_BUTTOCKS', 0.3,
        'EXPOSED_BELLY', 0.8,
        'COVERED_GENITALIA_F', 0.6,
        'COVERED_GENITALIA_M', 0.6,
        'COVERED_BREAST_F', 0.7
    )
),
JSON_OBJECT(
    'child_keywords', JSON_ARRAY('child', 'kid', 'minor', 'young', 'teen', 'school', 'underage'),
    'risk_multiplier', 10.0,
    'enable_description', true
),
JSON_OBJECT(
    'auto_approve_threshold', 5.0,
    'auto_reject_threshold', 20.0,
    'require_human_review_threshold', 10.0,
    'family_friendly', true
),
JSON_OBJECT(
    'public_site', JSON_OBJECT('approval_threshold', 2.0, 'rejection_threshold', 10.0),
    'private', JSON_OBJECT('approval_threshold', 15.0, 'rejection_threshold', 30.0)
))
ON DUPLICATE KEY UPDATE
    display_name = VALUES(display_name),
    description = VALUES(description),
    nudenet_config = VALUES(nudenet_config),
    blip_config = VALUES(blip_config),
    moderation_rules = VALUES(moderation_rules),
    usage_intents = VALUES(usage_intents),
    updated_at = CURRENT_TIMESTAMP;

-- Insert Default AI Moderation Server (current server)
INSERT INTO ai_moderation_servers (name, description, ip_address, port, protocol, status, created_by) VALUES
('Primary AI Server', 'Main AI moderation server for NudeNet and BLIP analysis', '18.221.22.72', 5000, 'http', 'active', 1)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    description = VALUES(description),
    status = VALUES(status),
    updated_at = CURRENT_TIMESTAMP;

SELECT 'AI Moderation Management System Created Successfully' as status;