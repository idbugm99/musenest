-- Migration 008: Escort CRM System
-- Comprehensive client management system for escorts with optional encryption

-- Enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- 1. Client Management Table
CREATE TABLE escort_clients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    model_id INT NOT NULL,
    client_identifier VARCHAR(255) NOT NULL COMMENT 'Encrypted: name, alias, etc.',
    phone_hash VARCHAR(64) COMMENT 'Hashed phone for matching (not encrypted)',
    email_hash VARCHAR(64) COMMENT 'Hashed email for matching (not encrypted)',
    phone_encrypted TEXT COMMENT 'Encrypted phone number',
    email_encrypted TEXT COMMENT 'Encrypted email address',
    screening_status ENUM('pending', 'approved', 'rejected', 'pending_references') DEFAULT 'pending',
    screening_method ENUM('none', 'references', 'job_validation', 'reference_sites', 'other') DEFAULT 'none',
    reference_sites JSON COMMENT 'Sites like P411, TheOtherBoard, etc.',
    communication_preference ENUM('contact_ok', 'no_contact', 'area_notifications_only') DEFAULT 'contact_ok',
    area_notifications BOOLEAN DEFAULT FALSE,
    notes_encrypted TEXT COMMENT 'Encrypted general notes',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_model_phone (model_id, phone_hash),
    INDEX idx_model_email (model_id, email_hash),
    INDEX idx_screening_status (model_id, screening_status),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Client Screening Table
CREATE TABLE client_screening (
    id INT AUTO_INCREMENT PRIMARY KEY,
    client_id INT NOT NULL,
    screening_type ENUM('references', 'job_validation', 'reference_sites', 'other') NOT NULL,
    details_encrypted TEXT COMMENT 'Encrypted screening details',
    verification_status ENUM('pending', 'verified', 'failed', 'expired') DEFAULT 'pending',
    verified_at TIMESTAMP NULL,
    expires_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_client_id (client_id),
    INDEX idx_verification_status (verification_status),
    INDEX idx_expires_at (expires_at),
    FOREIGN KEY (client_id) REFERENCES escort_clients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Client References Table
CREATE TABLE client_references (
    id INT AUTO_INCREMENT PRIMARY KEY,
    client_id INT NOT NULL,
    reference_name_encrypted VARCHAR(255) COMMENT 'Encrypted reference name',
    reference_contact_encrypted TEXT COMMENT 'Encrypted contact info',
    reference_relationship VARCHAR(100) COMMENT 'How they know the client',
    reference_notes_encrypted TEXT COMMENT 'Encrypted reference notes',
    reference_status ENUM('pending', 'positive', 'negative', 'neutral') DEFAULT 'pending',
    contacted_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_client_id (client_id),
    INDEX idx_reference_status (reference_status),
    FOREIGN KEY (client_id) REFERENCES escort_clients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Client Visits Table
CREATE TABLE client_visits (
    id INT AUTO_INCREMENT PRIMARY KEY,
    client_id INT NOT NULL,
    visit_date DATE NOT NULL,
    visit_duration INT COMMENT 'Minutes',
    visit_type ENUM('incall', 'outcall', 'overnight', 'travel') DEFAULT 'incall',
    location_encrypted VARCHAR(255) COMMENT 'Encrypted location',
    rate_amount DECIMAL(10,2) COMMENT 'Amount charged',
    rate_type ENUM('hourly', 'fixed', 'overnight', 'travel') DEFAULT 'hourly',
    payment_method ENUM('cash', 'card', 'crypto', 'other') DEFAULT 'cash',
    payment_status ENUM('paid', 'pending', 'partial', 'cancelled') DEFAULT 'paid',
    
    -- Visit details (encrypted)
    notes_encrypted TEXT COMMENT 'Encrypted visit notes',
    preferences_encrypted TEXT COMMENT 'Encrypted client preferences',
    body_characteristics_encrypted TEXT COMMENT 'Encrypted physical notes',
    would_see_again BOOLEAN DEFAULT TRUE,
    client_rating INT CHECK (client_rating >= 1 AND client_rating <= 5),
    
    -- Financial tracking (not encrypted for forecasting)
    actual_amount_received DECIMAL(10,2),
    expenses DECIMAL(10,2),
    net_revenue DECIMAL(10,2),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_client_date (client_id, visit_date),
    INDEX idx_visit_date (visit_date),
    INDEX idx_revenue (visit_date, net_revenue),
    INDEX idx_payment_status (payment_status),
    INDEX idx_visit_type (visit_type),
    FOREIGN KEY (client_id) REFERENCES escort_clients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Client Revenue Summary Table
CREATE TABLE client_revenue_summary (
    id INT AUTO_INCREMENT PRIMARY KEY,
    client_id INT NOT NULL,
    total_visits INT DEFAULT 0,
    total_revenue DECIMAL(12,2) DEFAULT 0.00,
    average_rate DECIMAL(10,2) DEFAULT 0.00,
    last_visit_date DATE NULL,
    first_visit_date DATE NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_client (client_id),
    INDEX idx_total_revenue (total_revenue),
    INDEX idx_last_visit (last_visit_date),
    FOREIGN KEY (client_id) REFERENCES escort_clients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Monthly Revenue Tracking Table
CREATE TABLE monthly_revenue (
    id INT AUTO_INCREMENT PRIMARY KEY,
    model_id INT NOT NULL,
    year_month VARCHAR(7) NOT NULL COMMENT 'Format: YYYY-MM',
    total_revenue DECIMAL(12,2) DEFAULT 0.00,
    total_visits INT DEFAULT 0,
    unique_clients INT DEFAULT 0,
    average_rate DECIMAL(10,2) DEFAULT 0.00,
    
    UNIQUE KEY unique_model_month (model_id, year_month),
    INDEX idx_model_month (model_id, year_month),
    INDEX idx_total_revenue (total_revenue),
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Model Encryption Settings Table
CREATE TABLE model_encryption_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    model_id INT NOT NULL UNIQUE,
    encryption_enabled BOOLEAN DEFAULT FALSE,
    encryption_key_hash VARCHAR(255) COMMENT 'Hashed encryption key',
    encryption_salt VARCHAR(255) COMMENT 'Salt for key derivation',
    encryption_algorithm VARCHAR(50) DEFAULT 'AES-256-GCM',
    last_key_entered TIMESTAMP NULL,
    session_expires_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_encryption_enabled (encryption_enabled),
    INDEX idx_session_expires (session_expires_at),
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Encryption Audit Log Table
CREATE TABLE encryption_audit_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    model_id INT NOT NULL,
    action ENUM('enable', 'disable', 'key_change', 'session_start', 'session_expire') NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_model_id (model_id),
    INDEX idx_action (action),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Area Notifications Table
CREATE TABLE area_notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    client_id INT NOT NULL,
    area_name VARCHAR(255) NOT NULL,
    notification_type ENUM('email', 'sms', 'both') DEFAULT 'email',
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_client_id (client_id),
    INDEX idx_area_name (area_name),
    INDEX idx_active (active),
    FOREIGN KEY (client_id) REFERENCES escort_clients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Communication Log Table
CREATE TABLE communication_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    client_id INT NOT NULL,
    communication_type ENUM('email', 'sms', 'call', 'text_app') NOT NULL,
    direction ENUM('inbound', 'outbound') NOT NULL,
    subject_encrypted VARCHAR(255) COMMENT 'Encrypted subject/topic',
    content_encrypted TEXT COMMENT 'Encrypted message content',
    communication_date TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_client_id (client_id),
    INDEX idx_communication_type (communication_type),
    INDEX idx_direction (direction),
    INDEX idx_communication_date (communication_date),
    FOREIGN KEY (client_id) REFERENCES escort_clients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default encryption settings for existing models
INSERT INTO model_encryption_settings (model_id, encryption_enabled, encryption_algorithm)
SELECT id, FALSE, 'AES-256-GCM' FROM models;

-- Create triggers for revenue summary updates
DELIMITER //

CREATE TRIGGER after_client_visit_insert
AFTER INSERT ON client_visits
FOR EACH ROW
BEGIN
    INSERT INTO client_revenue_summary (client_id, total_visits, total_revenue, average_rate, last_visit_date, first_visit_date)
    VALUES (NEW.client_id, 1, NEW.net_revenue, NEW.net_revenue, NEW.visit_date, NEW.visit_date)
    ON DUPLICATE KEY UPDATE
        total_visits = total_visits + 1,
        total_revenue = total_revenue + NEW.net_revenue,
        average_rate = total_revenue / total_visits,
        last_visit_date = NEW.visit_date,
        first_visit_date = LEAST(first_visit_date, NEW.visit_date);
        
    -- Update monthly revenue
    INSERT INTO monthly_revenue (model_id, year_month, total_revenue, total_visits, unique_clients, average_rate)
    SELECT 
        ec.model_id,
        DATE_FORMAT(NEW.visit_date, '%Y-%m'),
        NEW.net_revenue,
        1,
        1,
        NEW.net_revenue
    FROM escort_clients ec WHERE ec.id = NEW.client_id
    ON DUPLICATE KEY UPDATE
        total_revenue = total_revenue + NEW.net_revenue,
        total_visits = total_visits + 1,
        unique_clients = (
            SELECT COUNT(DISTINCT client_id) 
            FROM client_visits cv 
            JOIN escort_clients ec2 ON cv.client_id = ec2.id 
            WHERE ec2.model_id = monthly_revenue.model_id 
            AND DATE_FORMAT(cv.visit_date, '%Y-%m') = monthly_revenue.year_month
        ),
        average_rate = total_revenue / total_visits;
END//

CREATE TRIGGER after_client_visit_update
AFTER UPDATE ON client_visits
FOR EACH ROW
BEGIN
    -- Update revenue summary if amount changed
    IF OLD.net_revenue != NEW.net_revenue THEN
        UPDATE client_revenue_summary 
        SET 
            total_revenue = total_revenue - OLD.net_revenue + NEW.net_revenue,
            average_rate = (total_revenue - OLD.net_revenue + NEW.net_revenue) / total_visits
        WHERE client_id = NEW.client_id;
        
        -- Update monthly revenue
        UPDATE monthly_revenue 
        SET 
            total_revenue = total_revenue - OLD.net_revenue + NEW.net_revenue,
            average_rate = total_revenue / total_visits
        WHERE 
            model_id = (SELECT model_id FROM escort_clients WHERE id = NEW.client_id)
            AND year_month = DATE_FORMAT(NEW.visit_date, '%Y-%m');
    END IF;
END//

DELIMITER ;

-- Add comments to tables
ALTER TABLE escort_clients COMMENT = 'Main client management table for escorts with optional encryption';
ALTER TABLE client_screening COMMENT = 'Client screening and verification details';
ALTER TABLE client_references COMMENT = 'Reference contacts for client screening';
ALTER TABLE client_visits COMMENT = 'Visit records with encrypted details and financial tracking';
ALTER TABLE client_revenue_summary COMMENT = 'Client revenue summaries for forecasting';
ALTER TABLE monthly_revenue COMMENT = 'Monthly revenue tracking for models';
ALTER TABLE model_encryption_settings COMMENT = 'Model-specific encryption settings and session management';
ALTER TABLE encryption_audit_log COMMENT = 'Audit log for encryption-related actions';
ALTER TABLE area_notifications COMMENT = 'Area-based notification preferences for clients';
ALTER TABLE communication_log COMMENT = 'Encrypted communication history';

-- Insert sample reference sites
INSERT INTO escort_clients (model_id, client_identifier, screening_method, reference_sites, communication_preference)
VALUES 
(1, 'Sample Client', 'reference_sites', '["P411", "TheOtherBoard", "Private Delights"]', 'contact_ok');

COMMIT;
