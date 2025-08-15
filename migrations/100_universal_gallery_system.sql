-- Universal Gallery System Database Schema
-- Migration 100: Centralizes gallery configuration and theme styling
-- Created: August 15, 2025

-- ========================================
-- Universal Gallery Configuration Tables
-- ========================================

-- System-wide gallery configuration defaults
CREATE TABLE IF NOT EXISTS universal_gallery_config (
    id INT PRIMARY KEY AUTO_INCREMENT,
    config_name VARCHAR(100) NOT NULL UNIQUE,
    config_category ENUM('layout', 'lightbox', 'display', 'performance', 'accessibility', 'interaction') NOT NULL,
    config_value JSON NOT NULL,
    config_description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    KEY idx_category (config_category),
    KEY idx_active (is_active)
);

-- Gallery layout type definitions
CREATE TABLE IF NOT EXISTS gallery_layout_types (
    id INT PRIMARY KEY AUTO_INCREMENT,
    layout_name VARCHAR(50) NOT NULL UNIQUE,
    layout_display_name VARCHAR(100) NOT NULL,
    layout_description TEXT,
    default_settings JSON NOT NULL,
    supported_features JSON NOT NULL, -- carousel_controls, lightbox, search, filtering, etc.
    css_classes JSON NOT NULL,
    javascript_config JSON,
    responsive_breakpoints JSON,
    performance_settings JSON,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    KEY idx_active (is_active),
    KEY idx_name (layout_name)
);

-- Business model specific gallery configurations
CREATE TABLE IF NOT EXISTS gallery_business_configs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    business_model VARCHAR(50) NOT NULL, -- 'escort', 'camgirl', 'retail', 'photographer', etc.
    config_name VARCHAR(100) NOT NULL,
    gallery_settings JSON NOT NULL,
    layout_preferences JSON NOT NULL,
    visual_customizations JSON NOT NULL,
    interaction_settings JSON NOT NULL,
    content_policies JSON,
    seo_settings JSON,
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_business_config (business_model, config_name),
    KEY idx_business_model (business_model),
    KEY idx_default (is_default),
    KEY idx_active (is_active)
);

-- Theme-specific gallery styling configurations
CREATE TABLE IF NOT EXISTS theme_gallery_styles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    theme_set_id INT NOT NULL,
    theme_name VARCHAR(50) NOT NULL,
    css_variables JSON NOT NULL, -- Colors, fonts, spacing, etc.
    css_overrides TEXT, -- Additional CSS for complex styling
    javascript_overrides TEXT, -- Theme-specific JavaScript
    animation_settings JSON,
    responsive_overrides JSON,
    accessibility_enhancements JSON,
    performance_optimizations JSON,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_theme_style (theme_set_id, theme_name),
    KEY idx_theme_name (theme_name),
    KEY idx_active (is_active),
    
    FOREIGN KEY (theme_set_id) REFERENCES theme_sets(id) ON DELETE CASCADE
);

-- Model-specific gallery overrides
CREATE TABLE IF NOT EXISTS model_gallery_overrides (
    id INT PRIMARY KEY AUTO_INCREMENT,
    model_id INT NOT NULL,
    override_type ENUM('layout', 'styling', 'behavior', 'content') NOT NULL,
    override_config JSON NOT NULL,
    override_reason VARCHAR(255),
    applied_by INT, -- Admin user ID who applied the override
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_model_override (model_id, override_type),
    KEY idx_model_id (model_id),
    KEY idx_type (override_type),
    KEY idx_active (is_active),
    KEY idx_expires (expires_at),
    
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE
);

-- Gallery performance analytics
CREATE TABLE IF NOT EXISTS gallery_performance_metrics (
    id INT PRIMARY KEY AUTO_INCREMENT,
    model_slug VARCHAR(100) NOT NULL,
    theme_name VARCHAR(50) NOT NULL,
    layout_type VARCHAR(50) NOT NULL,
    page_load_time_ms INT NOT NULL,
    image_load_time_ms INT,
    javascript_execution_time_ms INT,
    css_render_time_ms INT,
    total_gallery_size_kb INT,
    images_count INT,
    interactions_count INT DEFAULT 0,
    user_session_duration_ms INT,
    bounce_rate DECIMAL(5,2),
    conversion_rate DECIMAL(5,2),
    accessibility_score DECIMAL(3,1),
    performance_score DECIMAL(3,1),
    user_agent TEXT,
    device_type ENUM('desktop', 'tablet', 'mobile') NOT NULL,
    connection_type VARCHAR(20),
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    KEY idx_model_slug (model_slug),
    KEY idx_theme (theme_name),
    KEY idx_layout (layout_type),
    KEY idx_device (device_type),
    KEY idx_recorded (recorded_at),
    
    FOREIGN KEY (model_slug) REFERENCES models(slug) ON DELETE CASCADE
);

-- Gallery configuration validation rules
CREATE TABLE IF NOT EXISTS gallery_validation_rules (
    id INT PRIMARY KEY AUTO_INCREMENT,
    rule_name VARCHAR(100) NOT NULL UNIQUE,
    rule_type ENUM('schema', 'performance', 'accessibility', 'content', 'security') NOT NULL,
    validation_config JSON NOT NULL,
    error_message TEXT NOT NULL,
    warning_message TEXT,
    severity ENUM('error', 'warning', 'info') NOT NULL DEFAULT 'error',
    auto_fix_available BOOLEAN DEFAULT FALSE,
    auto_fix_config JSON,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    KEY idx_type (rule_type),
    KEY idx_severity (severity),
    KEY idx_active (is_active)
);

-- ========================================
-- Insert Default Configuration Data
-- ========================================

-- System-wide default gallery configurations
INSERT INTO universal_gallery_config (config_name, config_category, config_value, config_description) VALUES
-- Layout configurations
('default_layout', 'layout', '{"type": "masonry", "images_per_page": 20, "grid_columns_desktop": 4, "grid_columns_tablet": 2, "grid_columns_mobile": 1}', 'Default gallery layout settings'),
('responsive_breakpoints', 'layout', '{"mobile": 480, "tablet": 768, "desktop": 1024, "large_desktop": 1440}', 'Standard responsive breakpoints'),

-- Lightbox configurations
('lightbox_settings', 'lightbox', '{"enabled": true, "fullscreen": true, "zoom": true, "animation": "fade", "keyboard_nav": true, "swipe_nav": true, "auto_focus": true}', 'Default lightbox behavior'),
('lightbox_performance', 'lightbox', '{"preload_adjacent": true, "lazy_load_threshold": 2, "image_quality": "high", "progressive_loading": true}', 'Lightbox performance optimizations'),

-- Display options
('display_options', 'display', '{"show_captions": true, "show_image_info": false, "show_category_filter": true, "enable_search": false, "show_sort_options": false}', 'Default display settings'),
('image_optimization', 'display', '{"webp_support": true, "responsive_images": true, "blur_placeholder": true, "aspect_ratio_preservation": true}', 'Image display optimizations'),

-- Performance settings
('performance_config', 'performance', '{"lazy_loading": true, "image_prefetch": true, "prefetch_strategy": "balanced", "reduce_motion_respect": true, "critical_css_inline": true}', 'Performance optimization settings'),
('caching_strategy', 'performance', '{"browser_cache": true, "service_worker": false, "cdn_enabled": true, "cache_duration_hours": 24}', 'Gallery content caching strategy'),

-- Accessibility settings
('accessibility_config', 'accessibility', '{"aria_labels": true, "keyboard_navigation": true, "screen_reader_support": true, "focus_indicators": true, "color_contrast_check": true}', 'Accessibility enhancements'),
('voice_interface', 'accessibility', '{"enabled": false, "commands": ["next", "previous", "zoom", "close"], "language": "en-US"}', 'Voice interface for accessibility'),

-- Interaction settings
('interaction_config', 'interaction', '{"touch_gestures": true, "mouse_interactions": true, "drag_and_drop": false, "right_click_protection": false}', 'User interaction settings'),
('analytics_tracking', 'interaction', '{"page_views": true, "image_views": true, "interaction_events": true, "performance_metrics": true, "user_behavior": false}', 'Analytics and tracking configuration');

-- Gallery layout types
INSERT INTO gallery_layout_types (layout_name, layout_display_name, layout_description, default_settings, supported_features, css_classes, javascript_config, responsive_breakpoints, performance_settings) VALUES
('masonry', 'Masonry Grid', 'Pinterest-style masonry layout with varying heights', 
 '{"columns": 3, "gap": "1.5rem", "item_spacing": "1rem", "min_item_width": "250px"}',
 '["lightbox", "lazy_loading", "infinite_scroll", "filtering", "search"]',
 '{"container": "masonry-grid", "item": "masonry-item", "image": "masonry-image"}',
 '{"library": "masonry", "animation": true, "auto_resize": true}',
 '{"mobile": 1, "tablet": 2, "desktop": 3, "large": 4}',
 '{"lazy_load": true, "image_optimization": true, "progressive_enhancement": true}'),

('grid', 'Responsive Grid', 'Equal-height grid layout with consistent spacing',
 '{"columns": 4, "gap": "1.5rem", "aspect_ratio": "4/3", "item_min_width": "200px"}',
 '["lightbox", "lazy_loading", "hover_effects", "filtering", "search", "sorting"]',
 '{"container": "grid-container", "item": "grid-item", "image": "grid-image"}',
 '{"css_grid": true, "flex_fallback": true, "animation_duration": "0.3s"}',
 '{"mobile": 1, "tablet": 2, "desktop": 3, "large": 4}',
 '{"css_transforms": true, "will_change": true, "gpu_acceleration": true}'),

('carousel', 'Image Carousel', 'Horizontal scrolling carousel with navigation controls',
 '{"visible_items": 1, "gap": "1rem", "auto_play": false, "auto_play_speed": 3000, "infinite_scroll": true}',
 '["navigation_arrows", "dots_indicator", "touch_swipe", "keyboard_nav", "auto_play"]',
 '{"container": "carousel-container", "track": "carousel-track", "item": "carousel-item", "nav": "carousel-nav"}',
 '{"swiper_js": true, "touch_enabled": true, "momentum": true, "snap_points": true}',
 '{"mobile": {"visible": 1}, "tablet": {"visible": 1.5}, "desktop": {"visible": 2}}',
 '{"hardware_acceleration": true, "debounced_resize": true, "efficient_updates": true}'),

('lightbox_grid', 'Lightbox Grid', 'Thumbnail grid optimized for lightbox viewing',
 '{"columns": 6, "gap": "0.5rem", "thumbnail_size": "150px", "hover_preview": true}',
 '["lightbox", "thumbnail_preview", "keyboard_nav", "fullscreen", "zoom"]',
 '{"container": "lightbox-grid-container", "item": "lightbox-thumbnail", "overlay": "lightbox-overlay"}',
 '{"lightbox_library": "custom", "preload_strategy": "adjacent", "zoom_levels": [1, 2, 4]}',
 '{"mobile": 3, "tablet": 4, "desktop": 6, "large": 8}',
 '{"image_preloading": true, "memory_management": true, "smooth_animations": true}');

-- Business model specific configurations
INSERT INTO gallery_business_configs (business_model, config_name, gallery_settings, layout_preferences, visual_customizations, interaction_settings, content_policies) VALUES
('escort', 'escort_professional', 
 '{"default_layout": "masonry", "images_per_page": 16, "enable_search": false, "show_captions": true, "lightbox_enabled": true}',
 '{"preferred_layouts": ["masonry", "grid"], "avoid_layouts": ["carousel"], "responsive_priority": "mobile_first"}',
 '{"elegant_styling": true, "professional_colors": true, "subtle_animations": true, "premium_effects": true}',
 '{"right_click_protection": false, "watermark_overlay": false, "download_prevention": false}',
 '{"content_moderation": "manual", "age_verification": true, "privacy_protection": "high"}'),

('camgirl', 'camgirl_interactive',
 '{"default_layout": "grid", "images_per_page": 20, "enable_search": true, "show_captions": true, "lightbox_enabled": true, "sorting_options": true}',
 '{"preferred_layouts": ["grid", "lightbox_grid"], "carousel_autoplay": true, "infinite_scroll": true}',
 '{"vibrant_colors": true, "playful_animations": true, "eye_catching_effects": true, "dynamic_hover": true}',
 '{"social_sharing": true, "favorites_system": true, "interactive_elements": true}',
 '{"content_moderation": "automated_plus_manual", "age_verification": true, "privacy_protection": "standard"}'),

('retail', 'retail_product_showcase',
 '{"default_layout": "grid", "images_per_page": 24, "enable_search": true, "show_captions": true, "category_filtering": true}',
 '{"preferred_layouts": ["grid", "carousel"], "product_zoom": true, "360_view_support": false}',
 '{"clean_design": true, "product_focus": true, "conversion_optimized": true, "trust_indicators": true}',
 '{"add_to_cart": false, "wishlist": false, "price_display": false, "stock_indicators": false}',
 '{"content_moderation": "minimal", "product_guidelines": true, "return_policy_display": true}'),

('photographer', 'photographer_portfolio',
 '{"default_layout": "masonry", "images_per_page": 15, "enable_search": false, "show_captions": true, "artist_branding": true}',
 '{"preferred_layouts": ["masonry", "lightbox_grid"], "artistic_presentation": true, "full_screen_priority": true}',
 '{"artistic_styling": true, "minimalist_design": true, "image_focus": true, "elegant_transitions": true}',
 '{"right_click_protection": true, "watermark_overlay": true, "download_prevention": true, "print_options": false}',
 '{"content_moderation": "self_managed", "copyright_protection": "high", "client_privacy": "high"}');

-- Theme-specific gallery styles (for existing themes)
INSERT INTO theme_gallery_styles (theme_set_id, theme_name, css_variables, css_overrides, javascript_overrides, animation_settings, responsive_overrides) VALUES
-- Basic Theme (assuming theme_set_id 1)
(1, 'basic', 
 '{"primary_color": "#2563eb", "secondary_color": "#64748b", "accent_color": "#0ea5e9", "background": "#ffffff", "text": "#1e293b", "border_radius": "8px", "shadow": "0 2px 8px rgba(0,0,0,0.1)"}',
 '.gallery-item:hover { transform: translateY(-2px); }',
 NULL,
 '{"duration": "0.3s", "easing": "ease", "hover_lift": "2px"}',
 '{"mobile_gap": "1rem", "tablet_columns": 2}'),

-- Glamour Theme (assuming theme_set_id 2)
(2, 'glamour',
 '{"primary_color": "#E9C77A", "secondary_color": "#D08770", "accent_color": "#EBCB8B", "background": "linear-gradient(145deg, #171228, #1E1632)", "text": "#F3EFE7", "border_radius": "15px", "shadow": "0 8px 25px rgba(212,175,55,0.2)"}',
 '.gallery-item { backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1); } .gallery-item:hover { transform: translateY(-10px); box-shadow: 0 25px 50px rgba(212,175,55,0.4); }',
 'container.addEventListener("mouseenter", () => { container.style.boxShadow = "0 25px 60px rgba(212, 175, 55, 0.3)"; });',
 '{"duration": "0.4s", "easing": "cubic-bezier(0.4, 0, 0.2, 1)", "hover_lift": "10px", "scale": "1.02"}',
 '{"mobile_columns": 1, "tablet_columns": 2, "reduce_motion": true}'),

-- Modern Theme (assuming theme_set_id 3)
(3, 'modern',
 '{"primary_gradient": "linear-gradient(135deg, #6366f1, #06b6d4)", "secondary_gradient": "linear-gradient(135deg, #0f172a, #334155)", "accent_color": "#6366f1", "background": "linear-gradient(135deg, #f8fafc, #ffffff)", "text": "#0f172a", "border_radius": "16px", "shadow": "0 8px 25px rgba(99,102,241,0.1)"}',
 '.gallery-item::before { background: linear-gradient(135deg, #6366f1, #06b6d4); opacity: 0; transition: opacity 0.4s ease; } .gallery-item:hover::before { opacity: 1; } .gallery-item:hover { transform: translateY(-8px) scale(1.02); box-shadow: 0 20px 50px rgba(99,102,241,0.2); }',
 'const visibleItems = window.innerWidth <= 480 ? 1 : window.innerWidth <= 768 ? 1 : window.innerWidth <= 1024 ? 1.5 : 2;',
 '{"duration": "0.4s", "easing": "cubic-bezier(0.4, 0, 0.2, 1)", "hover_lift": "8px", "scale": "1.02", "gradient_animation": true}',
 '{"mobile_single_column": true, "tablet_partial_view": 1.5, "desktop_multi_view": 2}'),

-- Luxury Theme (assuming theme_set_id 4)
(4, 'luxury',
 '{"primary_color": "#ffd700", "secondary_color": "#cd9500", "accent_color": "#ffed4e", "background": "linear-gradient(135deg, #f8f6f0, #e8dcc0)", "text": "#1a1a2e", "border_radius": "12px", "shadow": "0 4px 20px rgba(255,215,0,0.3)"}',
 '.gallery-item::before { background: linear-gradient(45deg, #ffd700, #ffed4e, #ffd700); z-index: -1; opacity: 0; transition: opacity 0.4s ease; } .gallery-item:hover::before { opacity: 1; } .gallery-item:hover { transform: translateY(-8px) scale(1.02); box-shadow: 0 15px 40px rgba(255,215,0,0.3); }',
 'carousel.style.boxShadow = "0 15px 35px rgba(255, 215, 0, 0.5)";',
 '{"duration": "0.4s", "easing": "ease", "hover_lift": "8px", "scale": "1.02", "floating_elements": true, "royal_effects": true}',
 '{"mobile_hide_floating": true, "tablet_reduced_effects": true, "performance_mode": true}');

-- Validation rules
INSERT INTO gallery_validation_rules (rule_name, rule_type, validation_config, error_message, severity, auto_fix_available) VALUES
('theme_css_variables_complete', 'schema', '{"required_variables": ["primary_color", "background", "text", "border_radius"], "theme_types": ["basic", "glamour", "modern", "luxury"]}', 'Theme is missing required CSS variables for gallery styling', 'error', FALSE),
('layout_performance_check', 'performance', '{"max_images_per_page": 50, "max_css_size_kb": 100, "max_js_size_kb": 50}', 'Gallery configuration may cause performance issues', 'warning', TRUE),
('accessibility_compliance', 'accessibility', '{"aria_labels": true, "keyboard_nav": true, "color_contrast": 4.5, "focus_indicators": true}', 'Gallery does not meet accessibility standards', 'error', TRUE),
('responsive_layout_valid', 'schema', '{"required_breakpoints": ["mobile", "tablet", "desktop"], "min_mobile_width": 320, "max_desktop_width": 1920}', 'Responsive layout configuration is incomplete or invalid', 'error', FALSE),
('content_policy_compliance', 'content', '{"age_verification": true, "content_warnings": true, "privacy_protection": true}', 'Gallery content policy settings do not meet business model requirements', 'warning', FALSE);

-- ========================================
-- Create Views for Easy Data Access
-- ========================================

-- View for complete gallery configuration by model
CREATE OR REPLACE VIEW v_model_gallery_config AS
SELECT 
    m.id as model_id,
    m.slug as model_slug,
    m.name as model_name,
    ts.name as theme_name,
    ts.id as theme_set_id,
    
    -- Get business config (with fallback to default)
    COALESCE(gbc.gallery_settings, '{}') as business_gallery_settings,
    COALESCE(gbc.layout_preferences, '{}') as business_layout_preferences,
    COALESCE(gbc.visual_customizations, '{}') as business_visual_customizations,
    
    -- Get theme styling
    COALESCE(tgs.css_variables, '{}') as theme_css_variables,
    tgs.css_overrides as theme_css_overrides,
    tgs.javascript_overrides as theme_javascript_overrides,
    
    -- Get model overrides
    GROUP_CONCAT(
        CASE WHEN mgo.override_type IS NOT NULL 
        THEN CONCAT(mgo.override_type, ':', mgo.override_config) 
        END SEPARATOR '|'
    ) as model_overrides,
    
    -- Get system defaults
    (SELECT JSON_OBJECT(
        'layout', JSON_EXTRACT(config_value, '$'),
        'lightbox', (SELECT config_value FROM universal_gallery_config WHERE config_name = 'lightbox_settings'),
        'display', (SELECT config_value FROM universal_gallery_config WHERE config_name = 'display_options'),
        'performance', (SELECT config_value FROM universal_gallery_config WHERE config_name = 'performance_config')
    ) FROM universal_gallery_config WHERE config_name = 'default_layout') as system_defaults

FROM models m
JOIN theme_sets ts ON m.theme_set_id = ts.id
LEFT JOIN business_types bt ON bt.id = m.business_type_id
LEFT JOIN gallery_business_configs gbc ON gbc.business_model = bt.name AND gbc.is_default = TRUE
LEFT JOIN theme_gallery_styles tgs ON tgs.theme_set_id = ts.id
LEFT JOIN model_gallery_overrides mgo ON mgo.model_id = m.id AND mgo.is_active = TRUE
GROUP BY m.id, ts.id;

-- View for gallery performance analytics summary
CREATE OR REPLACE VIEW v_gallery_performance_summary AS
SELECT 
    model_slug,
    theme_name,
    layout_type,
    device_type,
    AVG(page_load_time_ms) as avg_page_load_ms,
    AVG(image_load_time_ms) as avg_image_load_ms,
    AVG(total_gallery_size_kb) as avg_gallery_size_kb,
    AVG(images_count) as avg_images_count,
    AVG(user_session_duration_ms) as avg_session_duration_ms,
    AVG(bounce_rate) as avg_bounce_rate,
    AVG(conversion_rate) as avg_conversion_rate,
    AVG(accessibility_score) as avg_accessibility_score,
    AVG(performance_score) as avg_performance_score,
    COUNT(*) as total_sessions,
    DATE(recorded_at) as session_date
FROM gallery_performance_metrics 
WHERE recorded_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
GROUP BY model_slug, theme_name, layout_type, device_type, DATE(recorded_at)
ORDER BY session_date DESC, avg_performance_score DESC;

-- ========================================
-- Indexes for Optimal Performance
-- ========================================

-- Additional indexes for common queries
CREATE INDEX idx_gallery_config_lookup ON universal_gallery_config(config_category, is_active);
CREATE INDEX idx_business_config_lookup ON gallery_business_configs(business_model, is_default, is_active);
CREATE INDEX idx_theme_style_lookup ON theme_gallery_styles(theme_name, is_active);
CREATE INDEX idx_model_override_lookup ON model_gallery_overrides(model_id, is_active, expires_at);
CREATE INDEX idx_performance_analytics ON gallery_performance_metrics(model_slug, theme_name, device_type, recorded_at);
CREATE INDEX idx_validation_active ON gallery_validation_rules(rule_type, severity, is_active);

-- ========================================
-- Migration Complete
-- ========================================

-- Universal Gallery System migration completed successfully
-- Version: 100
-- Description: Centralized configuration and theme styling