-- Migration: 010_impersonation_system.sql
-- Add impersonation audit and session management tables

-- Impersonation audit log table
CREATE TABLE IF NOT EXISTS impersonation_audit (
    id INT AUTO_INCREMENT PRIMARY KEY,
    admin_user_id INT NOT NULL,
    impersonated_model_id INT NOT NULL,
    session_id VARCHAR(128) NOT NULL,
    action_type ENUM('start', 'end', 'activity') NOT NULL,
    action_details JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    route_accessed VARCHAR(255),
    request_method VARCHAR(10),
    request_data JSON,
    restrictions_applied JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_admin_user (admin_user_id),
    INDEX idx_impersonated_model (impersonated_model_id),
    INDEX idx_session (session_id),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (impersonated_model_id) REFERENCES models(id) ON DELETE CASCADE
);

-- Active impersonation sessions table
CREATE TABLE IF NOT EXISTS active_impersonations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(128) UNIQUE NOT NULL,
    admin_user_id INT NOT NULL,
    impersonated_model_id INT NOT NULL,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    restrictions JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    expires_at TIMESTAMP DEFAULT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    INDEX idx_session (session_id),
    INDEX idx_admin_user (admin_user_id),
    INDEX idx_impersonated_model (impersonated_model_id),
    INDEX idx_active (is_active),
    FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (impersonated_model_id) REFERENCES models(id) ON DELETE CASCADE
);

-- Add impersonation permissions to users table (check if column exists first)
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'phoenix4ge' AND TABLE_NAME = 'users' AND COLUMN_NAME = 'can_impersonate');
SET @sql = IF(@col_exists = 0, 
    'ALTER TABLE users ADD COLUMN can_impersonate BOOLEAN DEFAULT FALSE',
    'SELECT "can_impersonate column already exists"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Grant impersonation rights to admin and sysadmin roles
UPDATE users SET can_impersonate = TRUE WHERE role IN ('admin', 'sysadmin');

-- Impersonation restrictions template (for future token system)
CREATE TABLE IF NOT EXISTS impersonation_restrictions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    restriction_rules JSON NOT NULL,
    applies_to_roles JSON,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insert default restriction templates
INSERT IGNORE INTO impersonation_restrictions (name, description, restriction_rules, applies_to_roles) VALUES 
('full_access', 'Full access with audit logging only', '{"blocked_routes": [], "blocked_actions": [], "read_only_fields": []}', '["sysadmin"]'),
('limited_admin', 'Limited access for regular admins', '{"blocked_routes": ["/api/admin/delete", "/api/billing/charges"], "blocked_actions": ["delete", "charge"], "read_only_fields": ["stripe_customer_id", "balance_due"]}', '["admin"]'),
('read_only', 'Read-only access for support staff', '{"blocked_routes": ["/api/*/delete", "/api/*/update", "/api/billing/*"], "blocked_actions": ["create", "update", "delete"], "read_only_fields": ["*"]}', '["support"]');

-- Security log for impersonation attempts
CREATE TABLE IF NOT EXISTS impersonation_security_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    attempted_model_id INT,
    attempt_type ENUM('authorized', 'unauthorized', 'suspicious') NOT NULL,
    failure_reason VARCHAR(255),
    ip_address VARCHAR(45),
    user_agent TEXT,
    request_details JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user (user_id),
    INDEX idx_attempt_type (attempt_type),
    INDEX idx_created_at (created_at)
);