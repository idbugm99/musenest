-- Migration 009: Industry-Specific Architecture
-- Adds support for business types and industry-specific page sets and themes

-- Create business_types table for industry classification
CREATE TABLE business_types (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    category ENUM('adult', 'beauty', 'hospitality', 'professional', 'retail', 'entertainment') DEFAULT 'professional',
    
    -- Industry-specific configuration
    default_page_sets JSON COMMENT 'Default page combinations for this industry',
    required_features JSON COMMENT 'Required features/modules for this industry',
    legal_requirements JSON COMMENT 'Legal considerations and requirements',
    payment_methods JSON COMMENT 'Supported payment methods for this industry',
    
    -- Regulatory and compliance
    age_verification_required BOOLEAN DEFAULT FALSE,
    content_warnings_required BOOLEAN DEFAULT FALSE,
    geographic_restrictions JSON COMMENT 'Geographic limitations if any',
    
    -- Business model settings
    subscription_tiers JSON COMMENT 'Available subscription tiers for this industry',
    pricing_model ENUM('subscription', 'commission', 'flat_rate', 'hybrid') DEFAULT 'subscription',
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_business_types_category (category),
    INDEX idx_business_types_active (is_active)
);

-- Create business_page_sets table for predefined page combinations
CREATE TABLE business_page_sets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    business_type_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(150) NOT NULL,
    description TEXT,
    
    -- Page set configuration
    included_pages JSON NOT NULL COMMENT 'Array of page_type names included in this set',
    tier ENUM('basic', 'professional', 'premium', 'enterprise') DEFAULT 'basic',
    pricing_tier ENUM('free', 'premium', 'enterprise') DEFAULT 'free',
    
    -- Features and capabilities
    features JSON COMMENT 'Special features included in this page set',
    integrations JSON COMMENT 'Third-party integrations available',
    
    -- Ordering and visibility
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (business_type_id) REFERENCES business_types(id) ON DELETE CASCADE,
    INDEX idx_business_page_sets_type (business_type_id),
    INDEX idx_business_page_sets_tier (tier),
    INDEX idx_business_page_sets_active (is_active)
);

-- Add business_type_id to existing page_types table
ALTER TABLE page_types 
ADD COLUMN business_type_id INT NULL AFTER category,
ADD COLUMN industry_specific BOOLEAN DEFAULT FALSE AFTER business_type_id,
ADD COLUMN alternative_names JSON COMMENT 'Industry-specific names for this page type' AFTER description,
ADD FOREIGN KEY (business_type_id) REFERENCES business_types(id) ON DELETE SET NULL,
ADD INDEX idx_page_types_business_type (business_type_id);

-- Add industry variant support to theme_sets table
ALTER TABLE theme_sets
ADD COLUMN business_type_id INT NULL AFTER pricing_tier,
ADD COLUMN industry_variant VARCHAR(50) NULL AFTER business_type_id,
ADD COLUMN industry_features JSON COMMENT 'Industry-specific theme features' AFTER features,
ADD FOREIGN KEY (business_type_id) REFERENCES business_types(id) ON DELETE SET NULL,
ADD INDEX idx_theme_sets_business_type (business_type_id),
ADD INDEX idx_theme_sets_variant (industry_variant);

-- Add business type to models table
ALTER TABLE models
ADD COLUMN business_type_id INT NULL AFTER slug,
ADD COLUMN page_set_id INT NULL AFTER business_type_id,
ADD FOREIGN KEY (business_type_id) REFERENCES business_types(id) ON DELETE SET NULL,
ADD FOREIGN KEY (page_set_id) REFERENCES business_page_sets(id) ON DELETE SET NULL,
ADD INDEX idx_models_business_type (business_type_id);

-- Insert initial business types
INSERT INTO business_types (name, display_name, description, category, default_page_sets, required_features, age_verification_required, content_warnings_required) VALUES
('escort', 'Escort Services', 'Professional companion and escort services', 'adult', 
 JSON_ARRAY('escort_professional', 'escort_premium'), 
 JSON_ARRAY('age_verification', 'screening', 'calendar_booking', 'secure_messaging'), 
 TRUE, TRUE),

('camgirl', 'Cam Model / Content Creator', 'Adult cam modeling and content creation', 'adult',
 JSON_ARRAY('camgirl_streamer', 'camgirl_content'), 
 JSON_ARRAY('age_verification', 'streaming_integration', 'tip_system', 'content_management'), 
 TRUE, TRUE),

('salon', 'Hair Salon / Beauty', 'Hair salon and beauty services', 'beauty',
 JSON_ARRAY('salon_basic', 'salon_premium'), 
 JSON_ARRAY('appointment_booking', 'service_catalog', 'staff_management'), 
 FALSE, FALSE),

('massage', 'Massage Therapy', 'Professional massage and wellness services', 'beauty',
 JSON_ARRAY('massage_professional', 'massage_wellness'), 
 JSON_ARRAY('appointment_booking', 'service_catalog', 'certification_display'), 
 FALSE, FALSE),

('restaurant', 'Restaurant / Dining', 'Restaurant and food service establishments', 'hospitality',
 JSON_ARRAY('restaurant_basic', 'restaurant_premium'), 
 JSON_ARRAY('menu_management', 'reservation_system', 'ordering_system'), 
 FALSE, FALSE),

('professional', 'Professional Services', 'General professional and business services', 'professional',
 JSON_ARRAY('professional_basic', 'professional_corporate'), 
 JSON_ARRAY('contact_forms', 'portfolio_display', 'testimonials'), 
 FALSE, FALSE);

-- Insert business page sets for escort industry
INSERT INTO business_page_sets (business_type_id, name, display_name, description, included_pages, tier, features) VALUES
((SELECT id FROM business_types WHERE name = 'escort'), 'escort_basic', 'Escort Basic', 'Essential pages for escort services',
 JSON_ARRAY('home', 'about', 'contact', 'rates'), 'basic',
 JSON_ARRAY('basic_contact', 'rate_display')),

((SELECT id FROM business_types WHERE name = 'escort'), 'escort_professional', 'Escort Professional', 'Complete professional escort website',
 JSON_ARRAY('home', 'about', 'gallery', 'rates', 'etiquette', 'contact', 'calendar'), 'professional',
 JSON_ARRAY('photo_gallery', 'availability_calendar', 'screening_forms', 'etiquette_guidelines')),

((SELECT id FROM business_types WHERE name = 'escort'), 'escort_premium', 'Escort Premium', 'Full-featured escort website with advanced tools',
 JSON_ARRAY('home', 'about', 'gallery', 'rates', 'etiquette', 'contact', 'calendar', 'testimonials', 'blog', 'faq'), 'premium',
 JSON_ARRAY('advanced_gallery', 'client_testimonials', 'blog_system', 'faq_system', 'advanced_booking'));

-- Insert business page sets for camgirl industry  
INSERT INTO business_page_sets (business_type_id, name, display_name, description, included_pages, tier, features) VALUES
((SELECT id FROM business_types WHERE name = 'camgirl'), 'camgirl_basic', 'Cam Model Basic', 'Essential pages for cam modeling',
 JSON_ARRAY('home', 'about', 'contact', 'schedule'), 'basic',
 JSON_ARRAY('streaming_schedule', 'tip_goals')),

((SELECT id FROM business_types WHERE name = 'camgirl'), 'camgirl_streamer', 'Cam Model Streamer', 'Complete streaming-focused website',
 JSON_ARRAY('home', 'about', 'gallery', 'schedule', 'tips', 'contact', 'wishlist'), 'professional',
 JSON_ARRAY('streaming_integration', 'tip_system', 'content_previews', 'fan_interaction')),

((SELECT id FROM business_types WHERE name = 'camgirl'), 'camgirl_content', 'Content Creator Premium', 'Full content creator platform',
 JSON_ARRAY('home', 'about', 'gallery', 'content', 'schedule', 'tips', 'contact', 'blog', 'store'), 'premium',
 JSON_ARRAY('content_management', 'subscription_system', 'digital_store', 'fan_messaging'));

-- Insert business page sets for salon industry
INSERT INTO business_page_sets (business_type_id, name, display_name, description, included_pages, tier, features) VALUES
((SELECT id FROM business_types WHERE name = 'salon'), 'salon_basic', 'Salon Basic', 'Essential pages for hair salon',
 JSON_ARRAY('home', 'about', 'services', 'contact', 'booking'), 'basic',
 JSON_ARRAY('service_listing', 'basic_booking')),

((SELECT id FROM business_types WHERE name = 'salon'), 'salon_premium', 'Salon Premium', 'Complete salon website with advanced features',
 JSON_ARRAY('home', 'about', 'services', 'gallery', 'staff', 'booking', 'contact', 'testimonials'), 'premium',
 JSON_ARRAY('staff_profiles', 'portfolio_gallery', 'advanced_booking', 'client_reviews'));

-- Insert industry-specific page types for escort
INSERT INTO page_types (name, display_name, description, category, business_type_id, industry_specific, content_structure, required_data_tables) VALUES
('rates', 'Rates & Services', 'Service rates and package information', 'core', 
 (SELECT id FROM business_types WHERE name = 'escort'), TRUE,
 JSON_OBJECT('sections', JSON_ARRAY('rates_header', 'service_packages', 'payment_methods', 'booking_info')),
 JSON_ARRAY('rates', 'service_packages')),

('etiquette', 'Etiquette & Guidelines', 'Client etiquette and service guidelines', 'core',
 (SELECT id FROM business_types WHERE name = 'escort'), TRUE,
 JSON_OBJECT('sections', JSON_ARRAY('guidelines_header', 'booking_etiquette', 'meeting_guidelines', 'boundaries')),
 JSON_ARRAY('etiquette_content')),

('screening', 'Screening Information', 'Client screening requirements and process', 'optional',
 (SELECT id FROM business_types WHERE name = 'escort'), TRUE,
 JSON_OBJECT('sections', JSON_ARRAY('screening_intro', 'requirements', 'process', 'verification')),
 JSON_ARRAY('screening_requirements'));

-- Insert industry-specific page types for camgirl
INSERT INTO page_types (name, display_name, description, category, business_type_id, industry_specific, content_structure, required_data_tables) VALUES
('schedule', 'Streaming Schedule', 'Live streaming schedule and availability', 'core',
 (SELECT id FROM business_types WHERE name = 'camgirl'), TRUE,
 JSON_OBJECT('sections', JSON_ARRAY('schedule_header', 'weekly_schedule', 'special_shows', 'timezone_info')),
 JSON_ARRAY('streaming_schedule')),

('tips', 'Tips & Goals', 'Tip menu and show goals', 'core',
 (SELECT id FROM business_types WHERE name = 'camgirl'), TRUE,
 JSON_OBJECT('sections', JSON_ARRAY('tip_menu', 'show_goals', 'payment_methods', 'special_requests')),
 JSON_ARRAY('tip_menu', 'show_goals')),

('content', 'Premium Content', 'Premium content and subscription offerings', 'premium',
 (SELECT id FROM business_types WHERE name = 'camgirl'), TRUE,
 JSON_OBJECT('sections', JSON_ARRAY('content_preview', 'subscription_tiers', 'content_catalog', 'access_info')),
 JSON_ARRAY('content_library', 'subscription_plans')),

('wishlist', 'Wishlist & Gifts', 'Gift wishlist and fan interaction', 'optional',
 (SELECT id FROM business_types WHERE name = 'camgirl'), TRUE,
 JSON_OBJECT('sections', JSON_ARRAY('wishlist_header', 'gift_items', 'thank_you', 'shipping_info')),
 JSON_ARRAY('wishlist_items'));

-- Insert industry-specific page types for salon
INSERT INTO page_types (name, display_name, description, category, business_type_id, industry_specific, content_structure, required_data_tables) VALUES
('services', 'Services & Pricing', 'Hair and beauty services with pricing', 'core',
 (SELECT id FROM business_types WHERE name = 'salon'), TRUE,
 JSON_OBJECT('sections', JSON_ARRAY('services_header', 'service_categories', 'pricing_table', 'booking_cta')),
 JSON_ARRAY('services', 'service_categories')),

('staff', 'Our Stylists', 'Staff profiles and specialties', 'optional',
 (SELECT id FROM business_types WHERE name = 'salon'), TRUE,
 JSON_OBJECT('sections', JSON_ARRAY('staff_header', 'stylist_profiles', 'specialties', 'booking_with_stylist')),
 JSON_ARRAY('staff_members')),

('booking', 'Book Appointment', 'Online appointment booking system', 'core',
 (SELECT id FROM business_types WHERE name = 'salon'), TRUE,
 JSON_OBJECT('sections', JSON_ARRAY('booking_header', 'service_selection', 'time_slots', 'contact_info')),
 JSON_ARRAY('appointments', 'available_slots'));

-- Update existing theme_sets to include industry variants
UPDATE theme_sets SET 
    industry_variant = CONCAT(name, '_general'),
    industry_features = JSON_OBJECT('universal', true, 'industry_specific', false)
WHERE business_type_id IS NULL;

-- Create industry-specific theme variants
INSERT INTO theme_sets (name, display_name, description, category, default_color_scheme, features, industry_features, pricing_tier, business_type_id, industry_variant, is_active) VALUES
-- Escort Glamour Theme
('glamour', 'Glamour Escort', 'Luxury glamour theme designed for escort services', 'luxury',
 JSON_OBJECT('primary', '#EC4899', 'secondary', '#BE185D', 'accent', '#F59E0B', 'text', '#831843', 'background', '#FDF2F8'),
 JSON_OBJECT('animations', true, 'parallax', true, 'luxury_effects', true, 'gallery_lightbox', true),
 JSON_OBJECT('escort_features', true, 'discretion_mode', true, 'age_gate', true, 'contact_encryption', true),
 'premium', (SELECT id FROM business_types WHERE name = 'escort'), 'glamour_escort', true),

-- Camgirl Glamour Theme  
('glamour', 'Glamour Cam Model', 'Glamour theme optimized for cam models and content creators', 'creative',
 JSON_OBJECT('primary', '#FF1493', 'secondary', '#FF69B4', 'accent', '#FFD700', 'text', '#8B008B', 'background', '#FFF0F5'),
 JSON_OBJECT('animations', true, 'streaming_integration', true, 'interactive_elements', true, 'tip_animations', true),
 JSON_OBJECT('streaming_optimized', true, 'tip_integration', true, 'content_preview', true, 'fan_interaction', true),
 'premium', (SELECT id FROM business_types WHERE name = 'camgirl'), 'glamour_camgirl', true),

-- Salon Glamour Theme
('glamour', 'Glamour Salon', 'Sophisticated glamour theme for beauty salons', 'professional', 
 JSON_OBJECT('primary', '#D4AF37', 'secondary', '#B8860B', 'accent', '#FFD700', 'text', '#2F1B14', 'background', '#FFFEF7'),
 JSON_OBJECT('booking_integration', true, 'service_showcase', true, 'staff_profiles', true, 'gallery_focus', true),
 JSON_OBJECT('appointment_system', true, 'service_catalog', true, 'staff_booking', true, 'beauty_focused', true),
 'premium', (SELECT id FROM business_types WHERE name = 'salon'), 'glamour_salon', true);

-- Add constraints and indexes for data integrity
ALTER TABLE business_page_sets 
ADD CONSTRAINT unique_business_page_set UNIQUE (business_type_id, name);

ALTER TABLE theme_sets 
ADD CONSTRAINT unique_industry_theme UNIQUE (name, business_type_id, industry_variant);

-- Create view for easy industry-specific theme lookup
CREATE VIEW industry_themes AS
SELECT 
    ts.id,
    ts.name as theme_name,
    ts.display_name,
    ts.industry_variant,
    bt.name as business_type,
    bt.display_name as business_display_name,
    ts.default_color_scheme,
    ts.features,
    ts.industry_features,
    ts.pricing_tier,
    ts.is_active
FROM theme_sets ts
LEFT JOIN business_types bt ON ts.business_type_id = bt.id
WHERE ts.is_active = true
ORDER BY bt.name, ts.name, ts.industry_variant;