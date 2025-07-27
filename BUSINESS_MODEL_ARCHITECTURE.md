# MuseNest Business Model & Database Architecture

## Business Model Summary

### Subscription Tiers
- **Basic ($9.99/month):** 2-page site with minimal features
- **Premium ($39.95/month):** Full website control and advanced features

### Add-On Services
- CRM System
- Accounting Tools  
- Social Media Manager
- Ad Refresher

### Revenue Sharing Models
- **Paysite (OnlyFans model):** 80/20 split (model/platform)
- **Video Sales (ManyVid model):** 80/20 split (model/platform)
- **Whitelabel Partners:** 3% revenue share

---

## Database Schema Design

### 1. Subscription Plans Table
```sql
CREATE TABLE subscription_plans (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) NOT NULL,                    -- 'basic', 'premium'
    display_name VARCHAR(100) NOT NULL,           -- 'Basic Plan', 'Premium Plan'
    monthly_price DECIMAL(8,2) NOT NULL,          -- 9.99, 39.95
    annual_price DECIMAL(8,2),                    -- Optional annual pricing
    max_pages INT,                                -- Page limit (2 for basic, unlimited for premium)
    max_images INT,                               -- Image storage limit
    features JSON,                                -- Array of included features
    stripe_price_id VARCHAR(100),                 -- Stripe price ID
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 2. Add-On Services Table
```sql
CREATE TABLE addon_services (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) NOT NULL,                    -- 'crm', 'accounting', 'social_media', 'ad_refresher'
    display_name VARCHAR(100) NOT NULL,           -- 'CRM System', 'Accounting Tools'
    monthly_price DECIMAL(8,2) NOT NULL,
    description TEXT,
    stripe_price_id VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 3. Model Subscriptions Table (Enhanced)
```sql
CREATE TABLE model_subscriptions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    model_id INT NOT NULL,
    plan_id INT NOT NULL,
    stripe_subscription_id VARCHAR(100),
    status ENUM('active', 'past_due', 'canceled', 'incomplete', 'trialing', 'unpaid') DEFAULT 'trialing',
    current_period_start TIMESTAMP,
    current_period_end TIMESTAMP,
    trial_ends_at TIMESTAMP NULL,
    canceled_at TIMESTAMP NULL,
    whitelabel_partner_id INT NULL,               -- Reference to partner who referred this customer
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE,
    FOREIGN KEY (plan_id) REFERENCES subscription_plans(id),
    FOREIGN KEY (whitelabel_partner_id) REFERENCES whitelabel_partners(id),
    INDEX idx_model_subscription (model_id, status)
);
```

### 4. Model Add-On Subscriptions Table
```sql
CREATE TABLE model_addon_subscriptions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    model_id INT NOT NULL,
    addon_id INT NOT NULL,
    stripe_subscription_id VARCHAR(100),
    status ENUM('active', 'past_due', 'canceled', 'incomplete') DEFAULT 'active',
    current_period_start TIMESTAMP,
    current_period_end TIMESTAMP,
    canceled_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE,
    FOREIGN KEY (addon_id) REFERENCES addon_services(id),
    UNIQUE KEY unique_model_addon (model_id, addon_id),
    INDEX idx_model_addon (model_id, status)
);
```

### 5. Revenue Sharing Configuration Table
```sql
CREATE TABLE revenue_share_config (
    id INT PRIMARY KEY AUTO_INCREMENT,
    revenue_type ENUM('paysite', 'video_sales', 'tips', 'custom') NOT NULL,
    platform_percentage DECIMAL(5,2) NOT NULL,   -- 20.00 for 20%
    model_percentage DECIMAL(5,2) NOT NULL,      -- 80.00 for 80%
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    effective_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 6. Revenue Transactions Table
```sql
CREATE TABLE revenue_transactions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    model_id INT NOT NULL,
    transaction_type ENUM('paysite', 'video_sales', 'tips', 'subscription', 'addon') NOT NULL,
    gross_amount DECIMAL(10,2) NOT NULL,         -- Total amount received
    platform_fee DECIMAL(10,2) NOT NULL,        -- Amount kept by platform
    model_payout DECIMAL(10,2) NOT NULL,        -- Amount paid to model
    whitelabel_fee DECIMAL(10,2) DEFAULT 0.00,  -- 3% to whitelabel partner
    stripe_fee DECIMAL(10,2) DEFAULT 0.00,      -- Stripe processing fees
    chargeback_risk_fee DECIMAL(10,2) DEFAULT 0.00, -- Risk mitigation fee
    net_platform_revenue DECIMAL(10,2) NOT NULL, -- Final platform revenue after all fees
    
    stripe_payment_intent_id VARCHAR(100),
    external_transaction_id VARCHAR(100),        -- OnlyFans, ManyVid transaction ID
    transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    payout_date TIMESTAMP NULL,                  -- When model was paid
    status ENUM('pending', 'completed', 'failed', 'disputed', 'refunded') DEFAULT 'pending',
    
    whitelabel_partner_id INT NULL,
    notes TEXT,
    
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE,
    FOREIGN KEY (whitelabel_partner_id) REFERENCES whitelabel_partners(id),
    INDEX idx_model_transactions (model_id, transaction_date),
    INDEX idx_transaction_type (transaction_type, transaction_date)
);
```

### 7. Whitelabel Partners Table
```sql
CREATE TABLE whitelabel_partners (
    id INT PRIMARY KEY AUTO_INCREMENT,
    partner_name VARCHAR(100) NOT NULL,
    contact_email VARCHAR(120) NOT NULL,
    contact_name VARCHAR(100),
    revenue_share_percentage DECIMAL(5,2) DEFAULT 3.00, -- 3% default
    stripe_account_id VARCHAR(100),                      -- For direct payouts
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Branding customization
    custom_domain VARCHAR(100),
    logo_url VARCHAR(255),
    brand_colors JSON,                                   -- Custom color scheme
    
    -- Tracking
    referral_code VARCHAR(20) UNIQUE,                   -- Unique tracking code
    total_referrals INT DEFAULT 0,
    total_revenue_generated DECIMAL(12,2) DEFAULT 0.00,
    total_commissions_earned DECIMAL(12,2) DEFAULT 0.00,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_referral_code (referral_code),
    INDEX idx_partner_status (is_active)
);
```

### 8. Partner Commission Tracking Table
```sql
CREATE TABLE partner_commissions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    partner_id INT NOT NULL,
    model_id INT NOT NULL,
    transaction_id INT NOT NULL,                         -- References revenue_transactions
    commission_amount DECIMAL(10,2) NOT NULL,
    commission_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    payout_date TIMESTAMP NULL,
    status ENUM('pending', 'paid', 'disputed') DEFAULT 'pending',
    
    FOREIGN KEY (partner_id) REFERENCES whitelabel_partners(id),
    FOREIGN KEY (model_id) REFERENCES models(id),
    FOREIGN KEY (transaction_id) REFERENCES revenue_transactions(id),
    INDEX idx_partner_commissions (partner_id, commission_date),
    INDEX idx_commission_status (status, commission_date)
);
```

### 9. Enhanced Models Table (Add financial tracking)
```sql
-- Add columns to existing models table
ALTER TABLE models ADD COLUMN (
    total_revenue_generated DECIMAL(12,2) DEFAULT 0.00,
    total_platform_fees DECIMAL(12,2) DEFAULT 0.00,
    current_balance DECIMAL(10,2) DEFAULT 0.00,          -- Amount owed to model
    last_payout_date TIMESTAMP NULL,
    payout_method ENUM('stripe_transfer', 'paypal', 'check', 'wire') DEFAULT 'stripe_transfer',
    payout_details JSON,                                  -- Store payout account info
    tax_id VARCHAR(50),                                   -- For 1099 reporting
    business_type ENUM('individual', 'business') DEFAULT 'individual'
);
```

---

## Key Features & Benefits

### Financial Tracking
- **Real-time Revenue:** Track all income streams per model
- **Automated Splits:** Calculate 80/20 splits automatically
- **Partner Commissions:** Track 3% whitelabel partner revenue
- **Chargeback Protection:** Built-in risk management

### Scalable Architecture
- **Multiple Revenue Streams:** Support for paysite, video sales, tips
- **Flexible Add-ons:** Easy to add new services
- **Partner Management:** Complete whitelabel system
- **Stripe Integration:** Professional payment processing

### Business Intelligence
- **Revenue Analytics:** Track performance across all models
- **Partner Performance:** Monitor whitelabel partner success
- **Chargeback Monitoring:** Risk assessment and mitigation
- **Tax Reporting:** Built-in 1099 support

---

## Implementation Priority

### Phase 1: Core Subscription System
1. Subscription plans and model subscriptions
2. Stripe integration for recurring billing
3. Basic revenue tracking

### Phase 2: Add-On Services
1. Add-on service definitions
2. Add-on subscription management
3. Feature gating based on subscriptions

### Phase 3: Revenue Sharing
1. Revenue transaction tracking
2. Automated payout calculations
3. Model dashboard for earnings

### Phase 4: Whitelabel System
1. Partner registration and management
2. Commission tracking and payouts
3. Custom branding system

---

*Created: July 26, 2025*  
*Business Model: SaaS + Revenue Sharing + Whitelabel*