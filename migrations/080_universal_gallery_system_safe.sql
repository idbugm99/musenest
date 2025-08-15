-- Universal Gallery System Database Migration (Safe Version)
-- Creates system defaults table and initializes configuration

-- Create gallery system defaults table (safe)
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

-- Insert default gallery configuration (using INSERT IGNORE for safety)
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

-- Create universal gallery configurations table (system-level configs)
CREATE TABLE IF NOT EXISTS universal_gallery_configs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    config_name VARCHAR(100) NOT NULL UNIQUE,
    config_json JSON NOT NULL,
    description TEXT,
    version VARCHAR(20) DEFAULT '1.0.0',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

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

-- Insert universal gallery configurations
INSERT IGNORE INTO universal_gallery_configs (config_name, config_json, description) VALUES
('rose_theme_config', '{
    "theme": "rose",
    "layout": {
        "masonry": {
            "columnWidth": 300,
            "gutter": 24,
            "staggerDelay": 100,
            "organicSpacing": true
        },
        "grid": {
            "aspectRatio": "auto",
            "gaps": "1.5rem",
            "borderRadius": "12px"
        }
    },
    "animations": {
        "hover": {
            "transform": "scale(1.05) rotate(1deg)",
            "filter": "brightness(1.1) saturate(1.2)",
            "transition": "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
        },
        "lightbox": {
            "open": {
                "keyframes": "roseBloomOpen",
                "duration": "600ms",
                "easing": "cubic-bezier(0.68, -0.55, 0.265, 1.55)"
            },
            "close": {
                "keyframes": "roseBloomClose",
                "duration": "400ms",
                "easing": "ease-in-out"
            }
        }
    },
    "colors": {
        "primary": "#ff1493",
        "secondary": "#ffe4e1",
        "accent": "#ffc0cb"
    }
}', 'Rose theme default configuration'),

('modern_theme_config', '{
    "theme": "modern",
    "layout": {
        "grid": {
            "aspectRatio": "16:9",
            "gaps": "1rem",
            "borderRadius": "8px"
        }
    },
    "animations": {
        "hover": {
            "transform": "scale(1.02)",
            "transition": "all 0.2s ease-out"
        }
    },
    "colors": {
        "primary": "#6366f1",
        "secondary": "#f1f5f9",
        "accent": "#e2e8f0"
    }
}', 'Modern theme default configuration');

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

-- Log this migration 
INSERT INTO gallery_migration_log (migration_name, migration_version, affected_rows, success) VALUES
('universal_gallery_system_safe', '1.0.0', (
    SELECT COUNT(*) FROM model_gallery_page_content
), TRUE);

-- Show successful completion
SELECT 'Universal Gallery System migration completed successfully' as status,
       (SELECT COUNT(*) FROM gallery_system_defaults WHERE is_active = 1) as system_defaults,
       (SELECT COUNT(*) FROM model_gallery_page_content) as models_with_gallery_config;