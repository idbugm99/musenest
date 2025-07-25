-- Migration 008: Theme Sets + Modular Pages Architecture
-- This migration redesigns the theme system to support complete design systems
-- with modular page management and theme-agnostic content storage

-- 1. Theme Sets Table (Complete Design Systems)
CREATE TABLE theme_sets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    category ENUM('professional', 'luxury', 'creative', 'business') DEFAULT 'professional',
    default_color_scheme JSON NOT NULL,
    features JSON, -- Available features like animations, parallax, etc.
    pricing_tier ENUM('free', 'premium', 'enterprise') DEFAULT 'free',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_theme_sets_category (category),
    INDEX idx_theme_sets_pricing (pricing_tier),
    INDEX idx_theme_sets_active (is_active)
);

-- 2. Page Types Table (Modular Pages)
CREATE TABLE page_types (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    category ENUM('core', 'optional', 'premium', 'business', 'adult') DEFAULT 'optional',
    content_structure JSON, -- Defines what content fields this page type uses
    required_data_tables JSON, -- Which tables this page needs (gallery, faq, etc.)
    pricing_tier ENUM('free', 'premium', 'enterprise') DEFAULT 'free',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_page_types_category (category),
    INDEX idx_page_types_pricing (pricing_tier)
);

-- 3. Theme Set Page Support (Which pages each theme set supports)
CREATE TABLE theme_set_pages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    theme_set_id INT NOT NULL,
    page_type_id INT NOT NULL,
    template_file VARCHAR(100) NOT NULL, -- e.g., 'glamour/blog.html'
    has_custom_layout BOOLEAN DEFAULT FALSE,
    features JSON, -- Page-specific features for this theme
    is_available BOOLEAN DEFAULT TRUE,
    
    FOREIGN KEY (theme_set_id) REFERENCES theme_sets(id) ON DELETE CASCADE,
    FOREIGN KEY (page_type_id) REFERENCES page_types(id) ON DELETE CASCADE,
    UNIQUE KEY unique_theme_page (theme_set_id, page_type_id),
    INDEX idx_theme_set_pages_theme (theme_set_id),
    INDEX idx_theme_set_pages_page (page_type_id)
);

-- 4. Model Theme Set Assignment (replaces model_themes)
CREATE TABLE model_theme_sets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    model_id INT NOT NULL,
    theme_set_id INT NOT NULL,
    custom_color_scheme JSON, -- Overrides for the default color scheme
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE,
    FOREIGN KEY (theme_set_id) REFERENCES theme_sets(id) ON DELETE CASCADE,
    INDEX idx_model_theme_sets_model (model_id),
    INDEX idx_model_theme_sets_active (model_id, is_active)
);

-- 5. Model Enabled Pages (Which pages each model has enabled)
CREATE TABLE model_enabled_pages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    model_id INT NOT NULL,
    page_type_id INT NOT NULL,
    is_enabled BOOLEAN DEFAULT TRUE,
    custom_slug VARCHAR(50), -- Optional custom URL slug
    sort_order INT DEFAULT 0,
    navigation_label VARCHAR(50), -- Custom navigation label
    enabled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE,
    FOREIGN KEY (page_type_id) REFERENCES page_types(id) ON DELETE CASCADE,
    UNIQUE KEY unique_model_page (model_id, page_type_id),
    INDEX idx_model_enabled_pages_model (model_id),
    INDEX idx_model_enabled_pages_sort (model_id, sort_order)
);

-- 6. Content Templates (Theme-agnostic content storage)
CREATE TABLE content_templates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    model_id INT NOT NULL,
    page_type_id INT NOT NULL,
    content_key VARCHAR(100) NOT NULL, -- e.g., 'hero_title', 'about_intro'
    content_value LONGTEXT,
    content_type ENUM('text', 'html', 'json', 'image', 'video') DEFAULT 'text',
    is_required BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE,
    FOREIGN KEY (page_type_id) REFERENCES page_types(id) ON DELETE CASCADE,
    UNIQUE KEY unique_model_page_content (model_id, page_type_id, content_key),
    INDEX idx_content_templates_model_page (model_id, page_type_id)
);

-- 7. Premium Features (Add-on functionality)
CREATE TABLE premium_features (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    feature_type ENUM('paysite', 'video_downloads', 'live_chat', 'booking_system', 'members_area') NOT NULL,
    pricing_tier ENUM('premium', 'enterprise') NOT NULL,
    configuration_schema JSON, -- What settings this feature needs
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_premium_features_type (feature_type),
    INDEX idx_premium_features_pricing (pricing_tier)
);

-- 8. Model Premium Features (Which premium features each model has)
CREATE TABLE model_premium_features (
    id INT AUTO_INCREMENT PRIMARY KEY,
    model_id INT NOT NULL,
    premium_feature_id INT NOT NULL,
    configuration JSON, -- Feature-specific settings
    is_enabled BOOLEAN DEFAULT TRUE,
    enabled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL, -- For subscription-based features
    
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE,
    FOREIGN KEY (premium_feature_id) REFERENCES premium_features(id) ON DELETE CASCADE,
    UNIQUE KEY unique_model_feature (model_id, premium_feature_id),
    INDEX idx_model_premium_features_model (model_id),
    INDEX idx_model_premium_features_expires (expires_at)
);

-- Insert default theme sets
INSERT INTO theme_sets (name, display_name, description, category, default_color_scheme, features, pricing_tier) VALUES
('basic', 'Basic Professional', 'Clean, functional design perfect for professional services', 'business', 
 '{"primary": "#3B82F6", "secondary": "#6B7280", "accent": "#10B981", "text": "#1F2937", "background": "#FFFFFF"}',
 '{"animations": false, "parallax": false, "interactive_elements": "minimal"}', 'free'),

('glamour', 'Glamour Elite', 'Sophisticated design with elegant animations and luxury appeal', 'luxury',
 '{"primary": "#EC4899", "secondary": "#BE185D", "accent": "#F59E0B", "text": "#831843", "background": "#FDF2F8"}',
 '{"animations": true, "parallax": true, "interactive_elements": "advanced", "video_backgrounds": true}', 'premium'),

('luxury', 'Luxury Premium', 'Ultra-premium design for exclusive high-end clientele', 'luxury',
 '{"primary": "#7C3AED", "secondary": "#5B21B6", "accent": "#F59E0B", "text": "#581C87", "background": "#FAF5FF"}',
 '{"animations": true, "parallax": true, "interactive_elements": "premium", "exclusive_features": true}', 'enterprise'),

('modern', 'Modern Contemporary', 'Contemporary design with clean lines and subtle interactions', 'professional',
 '{"primary": "#06B6D4", "secondary": "#0891B2", "accent": "#10B981", "text": "#0C4A6E", "background": "#F0F9FF"}',
 '{"animations": true, "parallax": false, "interactive_elements": "modern", "glass_effects": true}', 'premium'),

('dark', 'Dark Sophisticated', 'Sophisticated dark theme for evening elegance', 'creative',
 '{"primary": "#8B5CF6", "secondary": "#7C3AED", "accent": "#F59E0B", "text": "#F9FAFB", "background": "#111827"}',
 '{"animations": true, "parallax": true, "interactive_elements": "atmospheric", "ambient_effects": true}', 'premium');

-- Insert default page types
INSERT INTO page_types (name, display_name, description, category, content_structure, required_data_tables, pricing_tier) VALUES
('home', 'Home Page', 'Main landing page with hero section and overview', 'core',
 '["hero_title", "hero_subtitle", "about_preview", "services_preview", "cta_text"]', '["gallery_images"]', 'free'),

('about', 'About Page', 'Personal information and background', 'core',
 '["main_content", "personal_info", "values", "experience"]', '[]', 'free'),

('contact', 'Contact Page', 'Contact information and inquiry form', 'core',
 '["contact_intro", "contact_info", "booking_policy", "rates_preview"]', '[]', 'free'),

('gallery', 'Photo Gallery', 'Professional photo portfolio', 'core',
 '["gallery_intro", "categories"]', '["gallery_images"]', 'free'),

('rates', 'Rates & Services', 'Service packages and pricing information', 'optional',
 '["rates_intro", "packages", "policies", "payment_terms"]', '[]', 'free'),

('blog', 'Blog/News', 'Blog posts and updates', 'optional',
 '["blog_intro", "featured_posts"]', '["blog_posts"]', 'free'),

('faq', 'FAQ', 'Frequently asked questions', 'optional',
 '["faq_intro"]', '["faq_items"]', 'free'),

('testimonials', 'Testimonials', 'Client testimonials and reviews', 'optional',
 '["testimonials_intro"]', '["testimonials"]', 'free'),

('calendar', 'Availability Calendar', 'Booking calendar and availability', 'business',
 '["calendar_intro", "booking_instructions"]', '["calendar_events"]', 'premium'),

('paysite', 'Premium Content Site', 'OnlyFans-style premium content platform', 'premium',
 '["paysite_intro", "subscription_tiers", "content_previews"]', '["premium_content", "subscriptions"]', 'enterprise'),

('video_downloads', 'Video Store', 'ManyVids-style video download store', 'premium',
 '["store_intro", "featured_videos", "categories"]', '["video_products", "purchases"]', 'enterprise'),

('members_area', 'Members Area', 'Private members-only content and features', 'premium',
 '["members_intro", "exclusive_content"]', '["member_content", "memberships"]', 'enterprise');

-- Create theme set page support mappings
INSERT INTO theme_set_pages (theme_set_id, page_type_id, template_file, has_custom_layout, features) 
SELECT ts.id, pt.id, CONCAT(ts.name, '/', pt.name, '.html'), 
       CASE WHEN ts.name IN ('glamour', 'luxury', 'dark') THEN TRUE ELSE FALSE END,
       CASE 
           WHEN ts.name = 'glamour' THEN '{"parallax": true, "animations": "elegant"}'
           WHEN ts.name = 'luxury' THEN '{"parallax": true, "animations": "premium", "exclusive": true}'
           WHEN ts.name = 'modern' THEN '{"animations": "subtle", "glass_effects": true}'
           WHEN ts.name = 'dark' THEN '{"ambient_lighting": true, "atmospheric": true}'
           ELSE '{}'
       END
FROM theme_sets ts
CROSS JOIN page_types pt
WHERE (pt.pricing_tier = 'free' OR 
       (pt.pricing_tier = 'premium' AND ts.pricing_tier IN ('premium', 'enterprise')) OR
       (pt.pricing_tier = 'enterprise' AND ts.pricing_tier = 'enterprise'));

-- Update existing model to use new system (migrate existing data)
-- Set model 5 (escortmodel) to use modern theme set with all core pages enabled
INSERT INTO model_theme_sets (model_id, theme_set_id, custom_color_scheme)
SELECT 5, ts.id, '{"primary": "#0EA5E9", "secondary": "#0284C7", "accent": "#06B6D4", "text": "#0C4A6E", "background": "#F0F9FF"}'
FROM theme_sets ts WHERE ts.name = 'modern';

-- Enable core pages for the model
INSERT INTO model_enabled_pages (model_id, page_type_id, navigation_label, sort_order)
SELECT 5, pt.id, pt.display_name, 
       CASE pt.name
           WHEN 'home' THEN 1
           WHEN 'about' THEN 2
           WHEN 'gallery' THEN 3
           WHEN 'rates' THEN 4
           WHEN 'contact' THEN 5
           ELSE 10
       END
FROM page_types pt 
WHERE pt.name IN ('home', 'about', 'gallery', 'rates', 'contact');

-- Migrate existing content to new content_templates structure
-- This would need to be done carefully based on existing data structure
-- For now, we'll create placeholder entries

COMMIT;