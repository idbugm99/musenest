-- phoenix4ge Database Migration 001
-- Initial normalized schema migration
-- Run date: 2025-07-24

-- ===================================
-- CORE SYSTEM TABLES
-- ===================================

-- Users and Authentication
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(120) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('model', 'admin', 'sysadmin') NOT NULL DEFAULT 'model',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_email (email),
    INDEX idx_role (role)
);

-- Models (main entities)
CREATE TABLE models (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    status ENUM('active', 'suspended', 'trial', 'inactive') DEFAULT 'trial',
    
    -- Billing info
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    subscription_status ENUM('active', 'past_due', 'canceled', 'incomplete', 'trialing'),
    trial_ends_at TIMESTAMP NULL,
    next_billing_at TIMESTAMP NULL,
    balance_due DECIMAL(10,2) DEFAULT 0.00,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_slug (slug),
    INDEX idx_status (status)
);

-- Model-User relationships (multi-user support)
CREATE TABLE model_users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    model_id INT NOT NULL,
    user_id INT NOT NULL,
    role ENUM('owner', 'admin', 'editor', 'viewer') DEFAULT 'editor',
    is_active BOOLEAN DEFAULT TRUE,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_model_user (model_id, user_id),
    INDEX idx_model_id (model_id),
    INDEX idx_user_id (user_id)
);

-- ===================================
-- THEMING SYSTEM
-- ===================================

-- Themes (normalized - no JSON)
CREATE TABLE themes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Theme colors (separate table instead of JSON)
CREATE TABLE theme_colors (
    id INT PRIMARY KEY AUTO_INCREMENT,
    theme_id INT NOT NULL,
    color_type ENUM('primary', 'secondary', 'background', 'text', 'accent', 'border') NOT NULL,
    color_value VARCHAR(7) NOT NULL, -- hex color
    
    FOREIGN KEY (theme_id) REFERENCES themes(id) ON DELETE CASCADE,
    UNIQUE KEY unique_theme_color (theme_id, color_type),
    INDEX idx_theme_id (theme_id)
);

-- Model theme assignments
CREATE TABLE model_themes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    model_id INT NOT NULL,
    theme_id INT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE,
    FOREIGN KEY (theme_id) REFERENCES themes(id) ON DELETE CASCADE,
    INDEX idx_model_id (model_id)
);

-- ===================================
-- CONTENT MANAGEMENT
-- ===================================

-- Site settings (normalized)
CREATE TABLE site_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    model_id INT NOT NULL,
    
    -- Basic info
    site_name VARCHAR(100),
    model_name VARCHAR(100),
    tagline VARCHAR(255),
    city VARCHAR(100),
    
    -- Contact
    contact_email VARCHAR(100),
    contact_phone VARCHAR(20),
    
    -- Images
    header_image VARCHAR(255),
    favicon_url VARCHAR(255),
    apple_touch_icon_url VARCHAR(255),
    
    -- Watermark settings (normalized from JSON)
    watermark_text TEXT,
    watermark_image VARCHAR(255),
    watermark_size INT DEFAULT 24,
    watermark_opacity INT DEFAULT 50,
    watermark_position ENUM('top-left', 'top-right', 'bottom-left', 'bottom-right', 'center') DEFAULT 'bottom-right',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE,
    UNIQUE KEY unique_model_settings (model_id)
);

-- SMTP settings (separate table for security)
CREATE TABLE smtp_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    model_id INT NOT NULL,
    smtp_server VARCHAR(200),
    smtp_port INT DEFAULT 587,
    smtp_username VARCHAR(200),
    smtp_password VARCHAR(200), -- Should be encrypted
    smtp_use_tls BOOLEAN DEFAULT TRUE,
    smtp_use_ssl BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT FALSE,
    
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE,
    UNIQUE KEY unique_model_smtp (model_id)
);

-- ===================================
-- PAGE CONTENT (Normalized structure)
-- ===================================

-- Page types
CREATE TABLE page_types (
    id INT PRIMARY KEY AUTO_INCREMENT,
    slug VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE
);

-- Pages
CREATE TABLE pages (
    id INT PRIMARY KEY AUTO_INCREMENT,
    model_id INT NOT NULL,
    page_type_id INT NOT NULL,
    title VARCHAR(200),
    subtitle TEXT,
    is_visible BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE,
    FOREIGN KEY (page_type_id) REFERENCES page_types(id),
    INDEX idx_model_page (model_id, page_type_id)
);

-- Page sections (replaces large content tables)
CREATE TABLE page_sections (
    id INT PRIMARY KEY AUTO_INCREMENT,
    page_id INT NOT NULL,
    section_type ENUM('text', 'image', 'gallery', 'form', 'cta', 'list') NOT NULL,
    section_key VARCHAR(100) NOT NULL, -- e.g., 'hero', 'about', 'services'
    title VARCHAR(200),
    content TEXT,
    image_url VARCHAR(255),
    is_visible BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    
    FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE,
    INDEX idx_page_sections (page_id, section_key)
);

-- Section metadata (for flexible attributes without JSON)
CREATE TABLE section_metadata (
    id INT PRIMARY KEY AUTO_INCREMENT,
    section_id INT NOT NULL,
    meta_key VARCHAR(100) NOT NULL,
    meta_value TEXT,
    
    FOREIGN KEY (section_id) REFERENCES page_sections(id) ON DELETE CASCADE,
    UNIQUE KEY unique_section_meta (section_id, meta_key),
    INDEX idx_section_id (section_id)
);