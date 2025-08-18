-- Create Gallery Profiles System for Universal Gallery Admin
-- This creates named profiles that can be assigned to business types

-- Create gallery_profiles table for named profile configurations
CREATE TABLE IF NOT EXISTS gallery_profiles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    profile_name VARCHAR(100) NOT NULL UNIQUE,
    profile_display_name VARCHAR(150) NOT NULL,
    profile_description TEXT,
    
    -- Core functionality settings (System Admin only)
    layout_type ENUM('grid', 'masonry', 'carousel', 'lightbox_grid') NOT NULL DEFAULT 'masonry',
    
    -- Image sizing and display
    images_per_page INT NOT NULL DEFAULT 20,
    grid_columns_desktop INT NOT NULL DEFAULT 4,
    grid_columns_tablet INT NOT NULL DEFAULT 3,
    grid_columns_mobile INT NOT NULL DEFAULT 2,
    aspect_ratio VARCHAR(20) DEFAULT '4/3',
    
    -- Lightbox behavior (System Admin controls functionality)
    lightbox_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    lightbox_fullscreen BOOLEAN NOT NULL DEFAULT TRUE,
    lightbox_zoom BOOLEAN NOT NULL DEFAULT TRUE,
    lightbox_animation ENUM('fade', 'slide', 'zoom', 'none') NOT NULL DEFAULT 'fade',
    
    -- Navigation and interaction
    pagination_type ENUM('pagination', 'infinite_scroll', 'load_more') NOT NULL DEFAULT 'pagination',
    
    -- Feature availability (System Admin controls what's available)
    enable_search BOOLEAN NOT NULL DEFAULT FALSE,
    enable_sorting BOOLEAN NOT NULL DEFAULT FALSE,
    enable_filtering BOOLEAN NOT NULL DEFAULT TRUE,
    show_captions BOOLEAN NOT NULL DEFAULT TRUE,
    show_image_info BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Performance settings (System Admin only)
    lazy_loading_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    prefetch_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    prefetch_strategy ENUM('conservative', 'balanced', 'aggressive') NOT NULL DEFAULT 'balanced',
    respect_reduced_motion BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Accessibility settings (System Admin only)
    keyboard_navigation BOOLEAN NOT NULL DEFAULT TRUE,
    aria_labels BOOLEAN NOT NULL DEFAULT TRUE,
    screen_reader_support BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Model customization limits (what models can override)
    allow_carousel_timing_override BOOLEAN NOT NULL DEFAULT TRUE,
    allow_visible_items_override BOOLEAN NOT NULL DEFAULT TRUE,
    allow_section_visibility_override BOOLEAN NOT NULL DEFAULT TRUE,
    allow_caption_override BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- System metadata
    is_system_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_layout_type (layout_type),
    INDEX idx_active (is_active),
    INDEX idx_system_default (is_system_default)
);

-- Create many-to-many relationship between business types and gallery profiles
CREATE TABLE IF NOT EXISTS business_type_gallery_profiles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    business_type_id INT NOT NULL,
    gallery_profile_id INT NOT NULL,
    is_default_profile BOOLEAN NOT NULL DEFAULT FALSE,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (business_type_id) REFERENCES business_types(id) ON DELETE CASCADE,
    FOREIGN KEY (gallery_profile_id) REFERENCES gallery_profiles(id) ON DELETE CASCADE,
    
    UNIQUE KEY unique_business_profile (business_type_id, gallery_profile_id),
    INDEX idx_business_type (business_type_id),
    INDEX idx_gallery_profile (gallery_profile_id),
    INDEX idx_default (is_default_profile)
);

-- Migrate existing gallery_business_configs to gallery_profiles
-- Convert escort_professional config to "Professional Masonry" profile
INSERT INTO gallery_profiles (
    profile_name, profile_display_name, profile_description,
    layout_type, images_per_page, grid_columns_desktop, grid_columns_tablet, grid_columns_mobile,
    lightbox_enabled, lightbox_fullscreen, lightbox_zoom, lightbox_animation,
    pagination_type, enable_search, enable_sorting, enable_filtering, show_captions,
    lazy_loading_enabled, prefetch_enabled, prefetch_strategy, respect_reduced_motion,
    keyboard_navigation, aria_labels, screen_reader_support,
    is_system_default, is_active
) VALUES (
    'professional_masonry', 'Professional Masonry', 'Professional masonry layout optimized for escort portfolios',
    'masonry', 16, 3, 2, 1,
    TRUE, TRUE, TRUE, 'fade',
    'pagination', FALSE, FALSE, TRUE, TRUE,
    TRUE, TRUE, 'balanced', TRUE,
    TRUE, TRUE, TRUE,
    FALSE, TRUE
);

-- Convert camgirl_interactive config to "Interactive Grid" profile  
INSERT INTO gallery_profiles (
    profile_name, profile_display_name, profile_description,
    layout_type, images_per_page, grid_columns_desktop, grid_columns_tablet, grid_columns_mobile,
    lightbox_enabled, lightbox_fullscreen, lightbox_zoom, lightbox_animation,
    pagination_type, enable_search, enable_sorting, enable_filtering, show_captions,
    lazy_loading_enabled, prefetch_enabled, prefetch_strategy, respect_reduced_motion,
    keyboard_navigation, aria_labels, screen_reader_support,
    is_system_default, is_active
) VALUES (
    'interactive_grid', 'Interactive Grid', 'Interactive grid layout with search and sorting for cam models',
    'grid', 20, 4, 3, 2,
    TRUE, TRUE, TRUE, 'slide',
    'infinite_scroll', TRUE, TRUE, TRUE, TRUE,
    TRUE, TRUE, 'aggressive', TRUE,
    TRUE, TRUE, TRUE,
    FALSE, TRUE
);

-- Create standard profiles based on layout types
INSERT INTO gallery_profiles (
    profile_name, profile_display_name, profile_description,
    layout_type, images_per_page, grid_columns_desktop, grid_columns_tablet, grid_columns_mobile,
    lightbox_enabled, lightbox_fullscreen, lightbox_zoom, lightbox_animation,
    pagination_type, enable_search, enable_sorting, enable_filtering, show_captions,
    lazy_loading_enabled, prefetch_enabled, prefetch_strategy, respect_reduced_motion,
    keyboard_navigation, aria_labels, screen_reader_support,
    is_system_default, is_active
) VALUES 
-- Standard Grid Profile
(
    'standard_grid', 'Standard Grid', 'Basic responsive grid layout suitable for most use cases',
    'grid', 20, 4, 3, 2,
    TRUE, TRUE, TRUE, 'fade',
    'pagination', FALSE, FALSE, TRUE, TRUE,
    TRUE, TRUE, 'balanced', TRUE,
    TRUE, TRUE, TRUE,
    TRUE, TRUE
),
-- Luxury Carousel Profile
(
    'luxury_carousel', 'Luxury Carousel', 'Elegant carousel with smooth transitions for premium presentations',
    'carousel', 12, 1, 1, 1,
    TRUE, TRUE, TRUE, 'slide',
    'pagination', FALSE, FALSE, FALSE, TRUE,
    TRUE, TRUE, 'conservative', TRUE,
    TRUE, TRUE, TRUE,
    FALSE, TRUE
),
-- Lightbox Grid Profile
(
    'lightbox_grid', 'Lightbox Grid', 'Thumbnail grid optimized for lightbox viewing experience',
    'lightbox_grid', 24, 6, 4, 3,
    TRUE, TRUE, TRUE, 'zoom',
    'load_more', FALSE, FALSE, TRUE, FALSE,
    TRUE, TRUE, 'balanced', TRUE,
    TRUE, TRUE, TRUE,
    FALSE, TRUE
);

-- Assign profiles to business types based on existing configs
-- Get business type IDs
SET @escort_id = (SELECT id FROM business_types WHERE name = 'escort');
SET @camgirl_id = (SELECT id FROM business_types WHERE name = 'camgirl');

-- Assign Professional Masonry to escort (based on existing escort_professional config)
INSERT INTO business_type_gallery_profiles (business_type_id, gallery_profile_id, is_default_profile, display_order)
SELECT @escort_id, id, TRUE, 1 FROM gallery_profiles WHERE profile_name = 'professional_masonry';

-- Assign Standard Grid to escort as secondary option
INSERT INTO business_type_gallery_profiles (business_type_id, gallery_profile_id, is_default_profile, display_order)
SELECT @escort_id, id, FALSE, 2 FROM gallery_profiles WHERE profile_name = 'standard_grid';

-- Assign Luxury Carousel to escort
INSERT INTO business_type_gallery_profiles (business_type_id, gallery_profile_id, is_default_profile, display_order)
SELECT @escort_id, id, FALSE, 3 FROM gallery_profiles WHERE profile_name = 'luxury_carousel';

-- Assign Interactive Grid to camgirl (based on existing camgirl_interactive config)
INSERT INTO business_type_gallery_profiles (business_type_id, gallery_profile_id, is_default_profile, display_order)
SELECT @camgirl_id, id, TRUE, 1 FROM gallery_profiles WHERE profile_name = 'interactive_grid';

-- Assign Standard Grid to camgirl as secondary option
INSERT INTO business_type_gallery_profiles (business_type_id, gallery_profile_id, is_default_profile, display_order)
SELECT @camgirl_id, id, FALSE, 2 FROM gallery_profiles WHERE profile_name = 'standard_grid';

-- Assign Lightbox Grid to camgirl
INSERT INTO business_type_gallery_profiles (business_type_id, gallery_profile_id, is_default_profile, display_order)
SELECT @camgirl_id, id, FALSE, 3 FROM gallery_profiles WHERE profile_name = 'lightbox_grid';

SELECT 'Gallery profiles system created and migrated successfully' as status;