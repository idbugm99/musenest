-- Migration: Add Hero Background and Enhanced Content Fields
-- Description: Adds parallax hero background support and advanced content management fields
-- Date: August 12, 2025

-- Add hero background image and parallax fields to content_templates table
ALTER TABLE content_templates ADD COLUMN hero_background_image VARCHAR(255) NULL COMMENT 'Background image filename for parallax hero section';
ALTER TABLE content_templates ADD COLUMN hero_background_opacity DECIMAL(3,2) DEFAULT 0.6 COMMENT 'Overlay opacity for hero background (0.0 to 1.0)';

-- Add dynamic button link fields
ALTER TABLE content_templates ADD COLUMN hero_button_1_link VARCHAR(50) DEFAULT 'contact' COMMENT 'Destination page for first hero button';
ALTER TABLE content_templates ADD COLUMN hero_button_2_link VARCHAR(50) DEFAULT 'about' COMMENT 'Destination page for second hero button';
ALTER TABLE content_templates ADD COLUMN cta_button_1_link VARCHAR(50) DEFAULT 'calendar' COMMENT 'Destination page for first CTA button';
ALTER TABLE content_templates ADD COLUMN cta_button_2_link VARCHAR(50) DEFAULT 'contact' COMMENT 'Destination page for second CTA button';

-- Add section visibility controls
ALTER TABLE content_templates ADD COLUMN hero_section_visible BOOLEAN DEFAULT TRUE COMMENT 'Show/hide hero section';
ALTER TABLE content_templates ADD COLUMN about_section_visible BOOLEAN DEFAULT TRUE COMMENT 'Show/hide about preview section';
ALTER TABLE content_templates ADD COLUMN gallery_section_visible BOOLEAN DEFAULT TRUE COMMENT 'Show/hide gallery preview section';
ALTER TABLE content_templates ADD COLUMN testimonials_section_visible BOOLEAN DEFAULT TRUE COMMENT 'Show/hide testimonials section';
ALTER TABLE content_templates ADD COLUMN cta_section_visible BOOLEAN DEFAULT TRUE COMMENT 'Show/hide call-to-action section';

-- Add portrait section visibility control
ALTER TABLE content_templates ADD COLUMN portrait_section_visible BOOLEAN DEFAULT TRUE COMMENT 'Show/hide portrait image in about section';

-- Create testimonials table for dynamic testimonial management
CREATE TABLE IF NOT EXISTS testimonials (
    id INT PRIMARY KEY AUTO_INCREMENT,
    model_id INT NOT NULL,
    name VARCHAR(100) NOT NULL COMMENT 'Client name (initials or pseudonym)',
    text TEXT NOT NULL COMMENT 'Testimonial quote text',
    rating INT DEFAULT 5 CHECK (rating >= 1 AND rating <= 5) COMMENT 'Star rating (1-5)',
    is_visible BOOLEAN DEFAULT TRUE COMMENT 'Show/hide this testimonial',
    display_order INT DEFAULT 0 COMMENT 'Order for displaying testimonials',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE,
    INDEX idx_model_visible (model_id, is_visible),
    INDEX idx_display_order (display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Model testimonials for homepage display';

-- Insert sample testimonials for existing models
INSERT IGNORE INTO testimonials (model_id, name, text, rating, display_order) 
SELECT 
    m.id,
    CASE 
        WHEN m.slug = 'escort-example' THEN 'Michael D.'
        WHEN m.slug = 'escort-model' THEN 'James S.'
        ELSE 'Robert T.'
    END,
    CASE 
        WHEN m.slug = 'escort-example' THEN 'Absolutely wonderful experience. Professional, elegant, and truly caring. An unforgettable encounter.'
        WHEN m.slug = 'escort-model' THEN 'Discretion and class personified. Made our evening truly magical and sophisticated.'
        ELSE 'Exceptional service and genuine warmth. Highly recommended for discerning gentlemen.'
    END,
    5,
    1
FROM models m 
WHERE m.status IN ('active', 'trial')
AND NOT EXISTS (SELECT 1 FROM testimonials t WHERE t.model_id = m.id);

-- Add second testimonial for each model
INSERT IGNORE INTO testimonials (model_id, name, text, rating, display_order) 
SELECT 
    m.id,
    CASE 
        WHEN m.slug = 'escort-example' THEN 'Alexander K.'
        WHEN m.slug = 'escort-model' THEN 'Christopher B.'
        ELSE 'David M.'
    END,
    CASE 
        WHEN m.slug = 'escort-example' THEN 'Sophisticated companion who exceeded all expectations. Perfect for business dinners and social events.'
        WHEN m.slug = 'escort-model' THEN 'Elegance and intelligence combined. A truly remarkable person with impeccable taste and conversation.'
        ELSE 'Professional excellence at its finest. Discrete, charming, and absolutely delightful company.'
    END,
    5,
    2
FROM models m 
WHERE m.status IN ('active', 'trial')
AND (SELECT COUNT(*) FROM testimonials t WHERE t.model_id = m.id) < 2;

-- Add third testimonial for each model
INSERT IGNORE INTO testimonials (model_id, name, text, rating, display_order) 
SELECT 
    m.id,
    CASE 
        WHEN m.slug = 'escort-example' THEN 'Thomas W.'
        WHEN m.slug = 'escort-model' THEN 'Nicholas H.'
        ELSE 'Jonathan L.'
    END,
    CASE 
        WHEN m.slug = 'escort-example' THEN 'Refined, articulate, and genuinely engaging. A perfect evening companion who makes every moment special.'
        WHEN m.slug = 'escort-model' THEN 'Combines beauty with intelligence effortlessly. Exceptional taste and conversation make for perfect company.'
        ELSE 'Discrete professionalism with warmth and charm. An absolute pleasure to spend time with for any occasion.'
    END,
    5,
    3
FROM models m 
WHERE m.status IN ('active', 'trial')
AND (SELECT COUNT(*) FROM testimonials t WHERE t.model_id = m.id) < 3;

-- Update existing home content with enhanced default values for better UX
UPDATE content_templates 
SET 
    hero_background_opacity = 0.4,
    hero_button_1_link = 'contact',
    hero_button_2_link = 'about',
    cta_button_1_link = 'calendar',
    cta_button_2_link = 'contact'
WHERE page_type_id = (SELECT id FROM page_types WHERE name = 'home')
AND content_key IN ('heroTitle', 'heroSubtitle', 'ctaTitle', 'ctaSubtitle');

-- Verify migration success
SELECT 
    'Migration completed successfully' as status,
    COUNT(*) as models_updated,
    (SELECT COUNT(*) FROM testimonials) as testimonials_created
FROM models WHERE status IN ('active', 'trial');