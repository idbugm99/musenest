-- phoenix4ge Database Migration 005
-- Seed Data for Default Themes and Page Types
-- Run date: 2025-07-24

-- ===================================
-- SEED DATA
-- ===================================

-- Insert default themes
INSERT INTO themes (name, display_name, description) VALUES
('basic', 'Basic', 'Clean and minimal design'),
('luxury', 'Luxury', 'Elegant and sophisticated'),
('glamour', 'Glamour', 'Dark theme with golden accents'),
('modern', 'Modern', 'Contemporary and sleek'),
('dark', 'Dark', 'Dark mode variant');

-- Insert default page types
INSERT INTO page_types (slug, name, description) VALUES
('home', 'Home Page', 'Landing page with hero section'),
('about', 'About Page', 'Personal information and services'),
('gallery', 'Gallery Page', 'Photo galleries and portfolios'),
('rates', 'Rates Page', 'Services and pricing information'),
('contact', 'Contact Page', 'Contact forms and information'),
('calendar', 'Calendar Page', 'Availability and booking'),
('etiquette', 'Etiquette Page', 'Guidelines and policies'),
('faq', 'FAQ Page', 'Frequently asked questions');

-- Insert basic theme colors for glamour theme
INSERT INTO theme_colors (theme_id, color_type, color_value) 
SELECT 
    t.id,
    color_type,
    color_value
FROM themes t
CROSS JOIN (
    SELECT 'primary' as color_type, '#D4AF37' as color_value UNION ALL
    SELECT 'secondary', '#B8860B' UNION ALL
    SELECT 'background', '#000000' UNION ALL
    SELECT 'text', '#FFFFFF' UNION ALL
    SELECT 'accent', '#FFD700' UNION ALL
    SELECT 'border', '#333333'
) colors
WHERE t.name = 'glamour';

-- Insert basic theme colors for luxury theme
INSERT INTO theme_colors (theme_id, color_type, color_value) 
SELECT 
    t.id,
    color_type,
    color_value
FROM themes t
CROSS JOIN (
    SELECT 'primary' as color_type, '#8B7355' as color_value UNION ALL
    SELECT 'secondary', '#6B5B47' UNION ALL
    SELECT 'background', '#FFFFFF' UNION ALL
    SELECT 'text', '#333333' UNION ALL
    SELECT 'accent', '#D4AF37' UNION ALL
    SELECT 'border', '#E5E7EB'
) colors
WHERE t.name = 'luxury';

-- Insert basic theme colors for basic theme
INSERT INTO theme_colors (theme_id, color_type, color_value) 
SELECT 
    t.id,
    color_type,
    color_value
FROM themes t
CROSS JOIN (
    SELECT 'primary' as color_type, '#3B82F6' as color_value UNION ALL
    SELECT 'secondary', '#1E40AF' UNION ALL
    SELECT 'background', '#FFFFFF' UNION ALL
    SELECT 'text', '#111827' UNION ALL
    SELECT 'accent', '#F59E0B' UNION ALL
    SELECT 'border', '#D1D5DB'
) colors
WHERE t.name = 'basic';

-- Insert basic theme colors for modern theme
INSERT INTO theme_colors (theme_id, color_type, color_value) 
SELECT 
    t.id,
    color_type,
    color_value
FROM themes t
CROSS JOIN (
    SELECT 'primary' as color_type, '#10B981' as color_value UNION ALL
    SELECT 'secondary', '#059669' UNION ALL
    SELECT 'background', '#F9FAFB' UNION ALL
    SELECT 'text', '#1F2937' UNION ALL
    SELECT 'accent', '#8B5CF6' UNION ALL
    SELECT 'border', '#E5E7EB'
) colors
WHERE t.name = 'modern';

-- Insert basic theme colors for dark theme
INSERT INTO theme_colors (theme_id, color_type, color_value) 
SELECT 
    t.id,
    color_type,
    color_value
FROM themes t
CROSS JOIN (
    SELECT 'primary' as color_type, '#6366F1' as color_value UNION ALL
    SELECT 'secondary', '#4F46E5' UNION ALL
    SELECT 'background', '#111827' UNION ALL
    SELECT 'text', '#F9FAFB' UNION ALL
    SELECT 'accent', '#F59E0B' UNION ALL
    SELECT 'border', '#374151'
) colors
WHERE t.name = 'dark';