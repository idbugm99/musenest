-- Migration: Referral Tracking System
-- Date: 2025-08-04
-- Description: Adds comprehensive referral code tracking and commission system

-- ===================================
-- REFERRAL CODES TABLE
-- ===================================

-- Core referral codes table - tracks who created what codes
CREATE TABLE referral_codes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    client_id INT NOT NULL,                         -- The user who created/owns this code
    code VARCHAR(12) UNIQUE NOT NULL,               -- The actual referral code (e.g., "MAYA2025")
    code_name VARCHAR(100) DEFAULT NULL,            -- Optional friendly name for the code
    usage_limit INT DEFAULT NULL,                   -- Optional maximum uses (NULL = unlimited)
    usage_count INT DEFAULT 0,                      -- Current number of times used
    expires_at DATETIME DEFAULT NULL,               -- Optional expiry date
    is_active BOOLEAN DEFAULT TRUE,                 -- Enable/disable code
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign key to users table (not models, since referrals track individuals)
    FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Indexes for performance
    INDEX idx_code (code),
    INDEX idx_client_id (client_id),
    INDEX idx_active_codes (is_active, expires_at),
    INDEX idx_usage_tracking (usage_count, usage_limit)
);

-- ===================================
-- CLIENT REFERRAL TRACKING
-- ===================================

-- Add referral tracking columns to users table
ALTER TABLE users 
ADD COLUMN referral_code_used VARCHAR(12) NULL AFTER password_hash,
ADD COLUMN referred_by_user_id INT NULL AFTER referral_code_used;

-- Add foreign key constraint for referrer tracking
ALTER TABLE users 
ADD CONSTRAINT fk_referred_by_user 
    FOREIGN KEY (referred_by_user_id) REFERENCES users(id) ON DELETE SET NULL;

-- Add indexes for referral queries
CREATE INDEX idx_referral_code_used ON users(referral_code_used);
CREATE INDEX idx_referred_by_user ON users(referred_by_user_id);

-- ===================================
-- REFERRAL ANALYTICS & COMMISSION TRACKING
-- ===================================

-- Referral usage log (for detailed analytics)
CREATE TABLE referral_usage_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    referral_code_id INT NOT NULL,                  -- Which code was used
    referred_user_id INT NOT NULL,                  -- Who used the code (new signup)
    referrer_user_id INT NOT NULL,                  -- Who owned the code
    signup_ip VARCHAR(45) DEFAULT NULL,             -- IP tracking for fraud prevention
    signup_user_agent TEXT DEFAULT NULL,            -- Browser info for analytics
    commission_eligible BOOLEAN DEFAULT TRUE,       -- Future: whether this qualifies for commission
    commission_amount DECIMAL(10,2) DEFAULT 0.00,   -- Future: commission earned
    commission_paid BOOLEAN DEFAULT FALSE,          -- Future: whether commission was paid
    used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (referral_code_id) REFERENCES referral_codes(id) ON DELETE CASCADE,
    FOREIGN KEY (referred_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (referrer_user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_referral_code_id (referral_code_id),
    INDEX idx_referred_user_id (referred_user_id),
    INDEX idx_referrer_user_id (referrer_user_id),
    INDEX idx_used_at (used_at),
    INDEX idx_commission_tracking (commission_eligible, commission_paid)
);

-- ===================================
-- REFERRAL CAMPAIGNS (Future Enhancement)
-- ===================================

-- Optional: Referral campaigns for special promotions
CREATE TABLE referral_campaigns (
    id INT AUTO_INCREMENT PRIMARY KEY,
    campaign_name VARCHAR(100) NOT NULL,
    description TEXT,
    commission_type ENUM('percentage', 'flat_rate', 'tier_based') DEFAULT 'percentage',
    commission_value DECIMAL(10,2) DEFAULT 0.00,    -- % or $ amount
    bonus_threshold INT DEFAULT NULL,                -- Bonus after X referrals
    bonus_amount DECIMAL(10,2) DEFAULT 0.00,
    starts_at DATETIME DEFAULT NULL,
    ends_at DATETIME DEFAULT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_active_campaigns (is_active, starts_at, ends_at)
);

-- Link referral codes to campaigns (optional)
ALTER TABLE referral_codes 
ADD COLUMN campaign_id INT DEFAULT NULL AFTER client_id,
ADD CONSTRAINT fk_referral_campaign 
    FOREIGN KEY (campaign_id) REFERENCES referral_campaigns(id) ON DELETE SET NULL;

-- ===================================
-- DEFAULT DATA SEEDING
-- ===================================

-- Create a default "organic" campaign for general referrals
INSERT INTO referral_campaigns (
    campaign_name, description, commission_type, commission_value, 
    is_active, created_at
) VALUES (
    'General Referral Program', 
    'Standard referral rewards for new client signups',
    'percentage', 
    10.00,  -- 10% commission
    true, 
    NOW()
);

-- ===================================
-- REFERRAL ANALYTICS VIEWS
-- ===================================

-- View for referral performance analytics
CREATE VIEW referral_performance AS
SELECT 
    rc.id as referral_code_id,
    rc.code,
    rc.code_name,
    u.email as referrer_email,
    u.id as referrer_user_id,
    rc.usage_count,
    rc.usage_limit,
    rc.created_at as code_created_at,
    COUNT(rul.id) as total_signups,
    SUM(CASE WHEN rul.commission_eligible = true THEN 1 ELSE 0 END) as eligible_signups,
    SUM(rul.commission_amount) as total_commission_earned,
    SUM(CASE WHEN rul.commission_paid = true THEN rul.commission_amount ELSE 0 END) as commission_paid,
    (SUM(rul.commission_amount) - SUM(CASE WHEN rul.commission_paid = true THEN rul.commission_amount ELSE 0 END)) as commission_pending
FROM referral_codes rc
JOIN users u ON rc.client_id = u.id
LEFT JOIN referral_usage_log rul ON rc.id = rul.referral_code_id
WHERE rc.is_active = true
GROUP BY rc.id, rc.code, rc.code_name, u.email, u.id, rc.usage_count, rc.usage_limit, rc.created_at;

-- ===================================
-- TRIGGERS FOR AUTOMATION
-- ===================================

-- Trigger to update usage_count when referral is used
DELIMITER $$

CREATE TRIGGER update_referral_usage_count
AFTER INSERT ON referral_usage_log
FOR EACH ROW
BEGIN
    UPDATE referral_codes 
    SET usage_count = usage_count + 1,
        updated_at = NOW()
    WHERE id = NEW.referral_code_id;
END$$

DELIMITER ;

-- ===================================
-- COMMENTS FOR DOCUMENTATION
-- ===================================

ALTER TABLE referral_codes 
MODIFY COLUMN code VARCHAR(12) UNIQUE NOT NULL 
COMMENT 'Referral code (6-12 chars, uppercase alphanumeric, no confusing chars)';

ALTER TABLE referral_codes 
MODIFY COLUMN usage_limit INT DEFAULT NULL 
COMMENT 'Maximum uses allowed (NULL = unlimited)';

ALTER TABLE users 
MODIFY COLUMN referral_code_used VARCHAR(12) NULL 
COMMENT 'The referral code this user entered during signup';

ALTER TABLE users 
MODIFY COLUMN referred_by_user_id INT NULL 
COMMENT 'User ID who referred this user (owner of the referral code)';