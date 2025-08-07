-- Migration 009: Account Permissions and Subscription Management
-- This migration adds account-level permissions for theme sets and features

-- 1. Account Subscription Plans
CREATE TABLE subscription_plans (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    price_monthly DECIMAL(10,2) DEFAULT 0.00,
    price_yearly DECIMAL(10,2) DEFAULT 0.00,
    max_theme_sets INT DEFAULT 1, -- How many theme sets they can use
    allowed_pricing_tiers JSON, -- Which pricing tiers they can access
    max_premium_features INT DEFAULT 0,
    max_pages INT DEFAULT 5,
    max_storage_gb INT DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_subscription_plans_active (is_active)
);

-- 2. Model Subscriptions (Account Level Permissions)
CREATE TABLE model_subscriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    model_id INT NOT NULL,
    subscription_plan_id INT NOT NULL,
    status ENUM('active', 'cancelled', 'expired', 'trial') DEFAULT 'trial',
    trial_ends_at TIMESTAMP NULL,
    current_period_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    current_period_end TIMESTAMP NULL,
    auto_renew BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE,
    FOREIGN KEY (subscription_plan_id) REFERENCES subscription_plans(id) ON DELETE RESTRICT,
    INDEX idx_model_subscriptions_model (model_id),
    INDEX idx_model_subscriptions_status (status),
    INDEX idx_model_subscriptions_expires (current_period_end)
);

-- 3. Model Theme Set Permissions (Which specific theme sets this model can use)
CREATE TABLE model_theme_permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    model_id INT NOT NULL,
    theme_set_id INT NOT NULL,
    is_granted BOOLEAN DEFAULT TRUE,
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    granted_by ENUM('subscription', 'admin', 'purchase') DEFAULT 'subscription',
    expires_at TIMESTAMP NULL, -- For time-limited access
    
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE,
    FOREIGN KEY (theme_set_id) REFERENCES theme_sets(id) ON DELETE CASCADE,
    UNIQUE KEY unique_model_theme_permission (model_id, theme_set_id),
    INDEX idx_model_theme_permissions_model (model_id),
    INDEX idx_model_theme_permissions_expires (expires_at)
);

-- Insert default subscription plans
INSERT INTO subscription_plans (name, display_name, description, price_monthly, price_yearly, max_theme_sets, allowed_pricing_tiers, max_premium_features, max_pages, max_storage_gb) VALUES
('free', 'Free Plan', 'Basic features for getting started', 0.00, 0.00, 1, '["free"]', 0, 5, 1),
('starter', 'Starter Plan', 'Perfect for new models building their presence', 29.99, 299.99, 3, '["free", "premium"]', 2, 10, 5),
('professional', 'Professional Plan', 'Full-featured plan for established models', 59.99, 599.99, 5, '["free", "premium"]', 5, 20, 10),
('enterprise', 'Enterprise Plan', 'Complete solution with all features', 99.99, 999.99, -1, '["free", "premium", "enterprise"]', -1, -1, 50);

-- Set default subscription for existing model (trial professional plan)
INSERT INTO model_subscriptions (model_id, subscription_plan_id, status, trial_ends_at, current_period_end)
SELECT 5, sp.id, 'trial', DATE_ADD(NOW(), INTERVAL 30 DAY), DATE_ADD(NOW(), INTERVAL 30 DAY)
FROM subscription_plans sp 
WHERE sp.name = 'professional';

-- Grant theme permissions based on subscription (Professional plan gets premium themes)
INSERT INTO model_theme_permissions (model_id, theme_set_id, granted_by)
SELECT 5, ts.id, 'subscription'
FROM theme_sets ts 
WHERE ts.pricing_tier IN ('free', 'premium');

COMMIT;