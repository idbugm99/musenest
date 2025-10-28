-- Media Library & Gallery Sections Migration
-- Migration 067: Complete media management system for phoenix4ge
-- Based on RoseMastos functionality with phoenix4ge integration
-- Date: August 9, 2025

-- ===================================
-- MODEL MEDIA LIBRARY CORE TABLES
-- ===================================

-- Main media library table - stores all uploaded media files
CREATE TABLE IF NOT EXISTS model_media_library (
    id INT AUTO_INCREMENT PRIMARY KEY,
    model_slug VARCHAR(255) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INT NOT NULL,
    image_width INT,
    image_height INT,
    mime_type VARCHAR(100) NOT NULL,
    category_id INT NULL,
    
    -- Watermark and processing
    watermark_applied TINYINT(1) DEFAULT 0,
    processing_status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
    
    -- Integration with phoenix4ge moderation API
    moderation_status ENUM('pending', 'approved', 'rejected', 'reviewing') DEFAULT 'pending',
    moderation_id VARCHAR(255) NULL, -- External moderation system ID
    moderation_notes TEXT,
    moderation_score DECIMAL(3,2) NULL, -- 0.00 to 1.00
    
    -- File management
    is_deleted TINYINT(1) DEFAULT 0,
    temp_path VARCHAR(500) NULL, -- Temporary storage during moderation
    permanent_path VARCHAR(500) NULL, -- Final storage location after approval
    
    -- Thumbnails and variants
    thumbnail_path VARCHAR(500) NULL,
    medium_path VARCHAR(500) NULL,
    
    -- Metadata and EXIF data
    exif_data JSON NULL,
    alt_text VARCHAR(500) NULL,
    caption TEXT NULL,
    
    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    approved_date TIMESTAMP NULL,
    
    INDEX idx_model_slug (model_slug),
    INDEX idx_category (category_id),
    INDEX idx_moderation (moderation_status),
    INDEX idx_processing (processing_status),
    INDEX idx_upload_date (upload_date),
    INDEX idx_deleted (is_deleted),
    UNIQUE KEY unique_filename (model_slug, filename)
);

-- Media categories for organization
CREATE TABLE IF NOT EXISTS model_media_categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    model_slug VARCHAR(255) NOT NULL,
    category_name VARCHAR(255) NOT NULL,
    category_slug VARCHAR(255) NOT NULL,
    category_description TEXT,
    category_order INT DEFAULT 0,
    category_color VARCHAR(7) DEFAULT '#007bff', -- Hex color for UI
    is_active TINYINT(1) DEFAULT 1,
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    modified_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_model_slug (model_slug),
    INDEX idx_active (is_active),
    INDEX idx_order (category_order),
    UNIQUE KEY unique_category_slug (model_slug, category_slug),
    UNIQUE KEY unique_category_name (model_slug, category_name)
);

-- ===================================
-- GALLERY SECTIONS SYSTEM
-- ===================================

-- Gallery sections with different layout types
CREATE TABLE IF NOT EXISTS model_gallery_sections (
    id INT AUTO_INCREMENT PRIMARY KEY,
    model_slug VARCHAR(255) NOT NULL,
    section_name VARCHAR(255) NOT NULL,
    section_slug VARCHAR(255) NOT NULL,
    section_description TEXT,
    layout_type ENUM('grid', 'masonry', 'carousel', 'lightbox_grid') NOT NULL,
    
    -- Layout-specific settings stored as JSON
    layout_settings JSON,
    /* Example layout_settings structure:
    {
        "grid": {
            "columns": 3,
            "spacing": 20,
            "aspectRatio": "auto",
            "enableLightbox": true
        },
        "masonry": {
            "columns": 4,
            "spacing": 15,
            "enableLightbox": true
        },
        "carousel": {
            "autoplay": true,
            "autoplayDelay": 5000,
            "showNavigation": true,
            "showDots": true,
            "transitionEffect": "fade"
        },
        "lightbox_grid": {
            "thumbnailSize": "small",
            "columns": 6,
            "spacing": 10
        }
    }
    */
    
    section_order INT DEFAULT 0,
    is_published TINYINT(1) DEFAULT 1,
    is_featured TINYINT(1) DEFAULT 0,
    
    -- Access control
    requires_authentication TINYINT(1) DEFAULT 0,
    password_protected TINYINT(1) DEFAULT 0,
    section_password VARCHAR(255) NULL,
    
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    modified_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_model_slug (model_slug),
    INDEX idx_published (is_published),
    INDEX idx_featured (is_featured),
    INDEX idx_order (section_order),
    UNIQUE KEY unique_section_slug (model_slug, section_slug)
);

-- Junction table for gallery section media assignments
CREATE TABLE IF NOT EXISTS model_gallery_section_media (
    id INT AUTO_INCREMENT PRIMARY KEY,
    section_id INT NOT NULL,
    media_id INT NOT NULL,
    display_order INT DEFAULT 0,
    custom_caption TEXT,
    custom_alt_text VARCHAR(500) NULL,
    is_featured TINYINT(1) DEFAULT 0,
    is_cover_image TINYINT(1) DEFAULT 0,
    
    -- Display settings per media item
    display_settings JSON NULL,
    /* Example display_settings:
    {
        "cropSettings": {"x": 0, "y": 0, "width": 100, "height": 100},
        "filterSettings": {"brightness": 1.0, "contrast": 1.0, "saturation": 1.0},
        "overlayText": "Featured Image"
    }
    */
    
    added_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    modified_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (section_id) REFERENCES model_gallery_sections(id) ON DELETE CASCADE,
    FOREIGN KEY (media_id) REFERENCES model_media_library(id) ON DELETE CASCADE,
    INDEX idx_section (section_id),
    INDEX idx_media (media_id),
    INDEX idx_order (display_order),
    INDEX idx_featured (is_featured),
    UNIQUE KEY unique_section_media (section_id, media_id)
);

-- ===================================
-- MEDIA PROCESSING & HISTORY
-- ===================================

-- Track all image editing operations (crop, rotate, resize, etc.)
CREATE TABLE IF NOT EXISTS model_media_edit_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    media_id INT NOT NULL,
    operation_type ENUM('crop', 'rotate', 'resize', 'rename', 'watermark', 'filter') NOT NULL,
    operation_data JSON NOT NULL,
    /* Example operation_data:
    {
        "crop": {"x": 100, "y": 150, "width": 800, "height": 600},
        "rotate": {"degrees": 90},
        "resize": {"width": 1920, "height": 1080, "maintainAspect": true},
        "rename": {"oldName": "image1.jpg", "newName": "portfolio_shot.jpg"},
        "watermark": {"position": "bottom-right", "opacity": 0.8},
        "filter": {"brightness": 1.2, "contrast": 1.1}
    }
    */
    original_file_path VARCHAR(500),
    new_file_path VARCHAR(500),
    operation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (media_id) REFERENCES model_media_library(id) ON DELETE CASCADE,
    INDEX idx_media (media_id),
    INDEX idx_operation (operation_type),
    INDEX idx_date (operation_date)
);

-- Batch operation tracking
CREATE TABLE IF NOT EXISTS model_media_batch_operations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    model_slug VARCHAR(255) NOT NULL,
    operation_type ENUM('approve', 'reject', 'categorize', 'delete', 'watermark') NOT NULL,
    operation_data JSON,
    media_count INT DEFAULT 0,
    completed_count INT DEFAULT 0,
    failed_count INT DEFAULT 0,
    status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
    started_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_date TIMESTAMP NULL,
    
    INDEX idx_model_slug (model_slug),
    INDEX idx_status (status),
    INDEX idx_type (operation_type)
);

-- ===================================
-- WATERMARK MANAGEMENT
-- ===================================

-- Model-specific watermark settings
CREATE TABLE IF NOT EXISTS model_watermark_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    model_slug VARCHAR(255) NOT NULL,
    watermark_enabled TINYINT(1) DEFAULT 1,
    watermark_file_path VARCHAR(500) NULL,
    watermark_position ENUM('top-left', 'top-right', 'bottom-left', 'bottom-right', 'center') DEFAULT 'bottom-right',
    watermark_opacity DECIMAL(3,2) DEFAULT 0.80, -- 0.00 to 1.00
    watermark_size_percent INT DEFAULT 15, -- Percentage of image size
    apply_to_uploads TINYINT(1) DEFAULT 1,
    apply_to_existing TINYINT(1) DEFAULT 0,
    
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    modified_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_model_watermark (model_slug),
    INDEX idx_model_slug (model_slug)
);

-- ===================================
-- MEDIA ANALYTICS & STATISTICS
-- ===================================

-- Track media usage and performance
CREATE TABLE IF NOT EXISTS model_media_analytics (
    id INT AUTO_INCREMENT PRIMARY KEY,
    media_id INT NOT NULL,
    event_type ENUM('view', 'download', 'lightbox_open', 'share', 'like') NOT NULL,
    event_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_ip VARCHAR(45) NULL,
    user_agent TEXT NULL,
    referrer_url VARCHAR(500) NULL,
    
    FOREIGN KEY (media_id) REFERENCES model_media_library(id) ON DELETE CASCADE,
    INDEX idx_media (media_id),
    INDEX idx_event_type (event_type),
    INDEX idx_event_date (event_date)
);

-- Daily aggregated statistics
CREATE TABLE IF NOT EXISTS model_media_daily_stats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    model_slug VARCHAR(255) NOT NULL,
    stat_date DATE NOT NULL,
    total_views INT DEFAULT 0,
    total_downloads INT DEFAULT 0,
    total_lightbox_opens INT DEFAULT 0,
    total_shares INT DEFAULT 0,
    unique_visitors INT DEFAULT 0,
    
    PRIMARY KEY (model_slug, stat_date),
    INDEX idx_model_slug (model_slug),
    INDEX idx_date (stat_date)
);

-- ===================================
-- SEED DEFAULT CATEGORIES
-- ===================================

-- Insert default media categories for new models
-- These will be created automatically when a model first accesses the media library
INSERT IGNORE INTO model_media_categories (model_slug, category_name, category_slug, category_description, category_order, category_color) VALUES
('__DEFAULT__', 'Portfolio', 'portfolio', 'Professional portfolio images', 1, '#007bff'),
('__DEFAULT__', 'Behind the Scenes', 'behind-scenes', 'Casual and behind-the-scenes content', 2, '#28a745'),
('__DEFAULT__', 'Events', 'events', 'Special events and occasions', 3, '#ffc107'),
('__DEFAULT__', 'Lifestyle', 'lifestyle', 'Lifestyle and casual photography', 4, '#17a2b8'),
('__DEFAULT__', 'Professional', 'professional', 'Business and professional content', 5, '#6c757d');

-- ===================================
-- FOREIGN KEY CONSTRAINTS
-- ===================================

-- Add foreign key constraint for media categories
ALTER TABLE model_media_library 
ADD CONSTRAINT fk_media_category 
FOREIGN KEY (category_id) REFERENCES model_media_categories(id) 
ON DELETE SET NULL;

-- ===================================
-- INDEXES FOR PERFORMANCE
-- ===================================

-- Composite indexes for common query patterns
CREATE INDEX idx_model_status_date ON model_media_library (model_slug, moderation_status, upload_date);
CREATE INDEX idx_model_category_date ON model_media_library (model_slug, category_id, upload_date);
CREATE INDEX idx_section_order_featured ON model_gallery_section_media (section_id, display_order, is_featured);

-- ===================================
-- TRIGGERS FOR DATA INTEGRITY
-- ===================================

-- Auto-create default categories when first media is uploaded for a model
DELIMITER //
CREATE TRIGGER after_media_insert 
AFTER INSERT ON model_media_library
FOR EACH ROW
BEGIN
    -- Check if this is the first media for this model
    IF (SELECT COUNT(*) FROM model_media_categories WHERE model_slug = NEW.model_slug) = 0 THEN
        -- Copy default categories for this model
        INSERT INTO model_media_categories (model_slug, category_name, category_slug, category_description, category_order, category_color)
        SELECT NEW.model_slug, category_name, category_slug, category_description, category_order, category_color
        FROM model_media_categories 
        WHERE model_slug = '__DEFAULT__';
    END IF;
END//
DELIMITER ;

-- Auto-create default watermark settings for new models
DELIMITER //
CREATE TRIGGER after_first_media_watermark
AFTER INSERT ON model_media_library
FOR EACH ROW
BEGIN
    -- Create default watermark settings if they don't exist
    INSERT IGNORE INTO model_watermark_settings (model_slug, watermark_enabled, watermark_position, watermark_opacity, watermark_size_percent)
    VALUES (NEW.model_slug, 1, 'bottom-right', 0.80, 15);
END//
DELIMITER ;

-- Migration completed successfully
-- This migration adds comprehensive media library functionality to phoenix4ge
-- including file management, gallery sections, watermarking, and analytics.