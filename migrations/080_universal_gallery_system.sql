-- Universal Gallery System Database Migration
-- Creates system defaults table and initializes configuration

-- Create gallery system defaults table
CREATE TABLE IF NOT EXISTS gallery_system_defaults (
    id INT PRIMARY KEY AUTO_INCREMENT,
    setting_name VARCHAR(100) NOT NULL UNIQUE,
    setting_value JSON NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    version VARCHAR(20) DEFAULT '1.0.0',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insert default gallery configuration
INSERT IGNORE INTO gallery_system_defaults (setting_name, setting_value, description) VALUES
('default_gallery_config', '{
    "enable_lightbox": true,
    "enable_fullscreen": true,
    "show_captions": true,
    "show_image_info": false,
    "show_category_filter": true,
    "show_sort_options": false,
    "show_search": false,
    "default_layout": "masonry",
    "images_per_page": 20,
    "grid_columns": 4,
    "enable_keyboard_navigation": true,
    "enable_touch_navigation": true,
    "lightbox_animation": "fade",
    "gallery_animation": "slide",
    "enable_lazy_loading": true,
    "enable_prefetch": true,
    "respect_reduced_motion": true
}', 'Default gallery configuration for all new models and themes'),

('theme_validation_rules', '{
    "require_theme_prefix": true,
    "require_css_classes": ["gallery", "section", "item", "lightbox"],
    "max_custom_icons": 10,
    "max_breakpoints": 6,
    "validate_css_naming": true,
    "allow_custom_layouts": false
}', 'Validation rules for theme configuration files'),

('performance_budgets', '{
    "max_bundle_size_kb": 50,
    "max_css_size_kb": 20,
    "max_images_per_page": 50,
    "max_image_size_mb": 5,
    "target_lcp_ms": 2500,
    "target_cls": 0.1
}', 'Performance budget enforcement settings');

-- Ensure all existing models have gallery page content with proper defaults
INSERT IGNORE INTO model_gallery_page_content (
    model_id, 
    enable_lightbox, 
    enable_fullscreen, 
    show_captions, 
    show_image_info,
    show_category_filter,
    show_sort_options,
    show_search,
    default_layout,
    images_per_page,
    default_grid_columns,
    gallery_header_visible,
    enable_filters,
    show_categories
) 
SELECT 
    m.id, 
    1,    -- enable_lightbox (default TRUE)
    1,    -- enable_fullscreen (default TRUE)
    1,    -- show_captions (default TRUE)
    0,    -- show_image_info (default FALSE)
    1,    -- show_category_filter (default TRUE)
    0,    -- show_sort_options (default FALSE)
    0,    -- show_search (default FALSE)
    'masonry', -- default_layout
    20,   -- images_per_page
    4,    -- default_grid_columns
    1,    -- gallery_header_visible
    1,    -- enable_filters
    1     -- show_categories
FROM models m 
WHERE m.id NOT IN (
    SELECT model_id FROM model_gallery_page_content
);

-- Create index for efficient system defaults lookup
CREATE INDEX idx_gallery_system_defaults_active 
ON gallery_system_defaults(setting_name, is_active);

-- Create theme configuration cache table (optional optimization)
CREATE TABLE IF NOT EXISTS theme_config_cache (
    id INT PRIMARY KEY AUTO_INCREMENT,
    theme_id VARCHAR(50) NOT NULL UNIQUE,
    config_json JSON NOT NULL,
    config_hash VARCHAR(64) NOT NULL,
    validation_status ENUM('valid', 'invalid', 'warning') NOT NULL DEFAULT 'valid',
    validation_errors JSON,
    last_validated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX idx_theme_config_cache_theme 
ON theme_config_cache(theme_id);

CREATE INDEX idx_theme_config_cache_status 
ON theme_config_cache(validation_status);

-- Add version tracking for configuration changes (check if columns exist first)
-- ALTER TABLE model_gallery_page_content 
-- ADD COLUMN config_version VARCHAR(20) DEFAULT '1.0.0';

-- ALTER TABLE model_gallery_page_content 
-- ADD COLUMN defaults_applied_at TIMESTAMP NULL DEFAULT NULL;

-- Update existing records with version information (commented out until columns exist)
-- UPDATE model_gallery_page_content 
-- SET config_version = '1.0.0', 
--     defaults_applied_at = CURRENT_TIMESTAMP 
-- WHERE config_version IS NULL;

-- Create migration log table for tracking changes
CREATE TABLE IF NOT EXISTS gallery_migration_log (
    id INT PRIMARY KEY AUTO_INCREMENT,
    migration_name VARCHAR(100) NOT NULL,
    migration_version VARCHAR(20) NOT NULL,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    rollback_script TEXT,
    success BOOLEAN NOT NULL DEFAULT TRUE,
    error_message TEXT,
    affected_rows INT DEFAULT 0
);

-- Log this migration (simplified without column dependency)
INSERT INTO gallery_migration_log (migration_name, migration_version, affected_rows) VALUES
('universal_gallery_system', '1.0.0', (
    SELECT COUNT(*) FROM model_gallery_page_content
));

-- Grant necessary permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE ON gallery_system_defaults TO 'phoenix4ge_app'@'%';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON theme_config_cache TO 'phoenix4ge_app'@'%';
-- GRANT SELECT ON gallery_migration_log TO 'phoenix4ge_app'@'%';