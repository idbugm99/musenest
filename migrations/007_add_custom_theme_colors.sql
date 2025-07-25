-- Migration 007: Add Custom Theme Colors System
-- Allows users to customize colors for any theme beyond the defaults

-- Create custom theme colors table for model-specific customizations
CREATE TABLE model_theme_colors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    model_id INT NOT NULL,
    theme_id INT NOT NULL,
    color_type VARCHAR(50) NOT NULL,
    color_value VARCHAR(7) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE,
    FOREIGN KEY (theme_id) REFERENCES themes(id) ON DELETE CASCADE,
    
    -- Prevent duplicate color customizations
    UNIQUE KEY unique_model_theme_color (model_id, theme_id, color_type),
    
    INDEX idx_model_theme_colors_model (model_id),
    INDEX idx_model_theme_colors_theme (theme_id)
);

-- Create theme templates table for base template designs
CREATE TABLE theme_templates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    base_css_file VARCHAR(255) NOT NULL,
    preview_image VARCHAR(255),
    color_variables JSON, -- Defines which colors can be customized
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_theme_templates_active (is_active)
);

-- Insert base theme templates
INSERT INTO theme_templates (name, display_name, description, base_css_file, color_variables) VALUES
('basic', 'Basic', 'Clean and simple design perfect for any style', 'basic.css', 
 '{"primary": "#3B82F6", "secondary": "#6B7280", "accent": "#10B981", "background": "#FFFFFF", "text": "#1F2937"}'),
 
('glamour', 'Glamour', 'Elegant and sophisticated with luxury appeal', 'glamour.css',
 '{"primary": "#EC4899", "secondary": "#BE185D", "accent": "#F59E0B", "background": "#FDF2F8", "text": "#831843"}'),
 
('luxury', 'Luxury', 'Premium design with rich colors and textures', 'luxury.css',
 '{"primary": "#7C3AED", "secondary": "#5B21B6", "accent": "#F59E0B", "background": "#FAF5FF", "text": "#581C87"}'),
 
('modern', 'Modern', 'Contemporary design with clean lines', 'modern.css',
 '{"primary": "#06B6D4", "secondary": "#0891B2", "accent": "#10B981", "background": "#F0F9FF", "text": "#0C4A6E"}'),
 
('dark', 'Dark', 'Sophisticated dark theme for evening elegance', 'dark.css',
 '{"primary": "#8B5CF6", "secondary": "#7C3AED", "accent": "#F59E0B", "background": "#111827", "text": "#F9FAFB"}'),
 
('elegant', 'Elegant', 'Refined and tasteful with subtle sophistication', 'elegant.css',
 '{"primary": "#6366F1", "secondary": "#4F46E5", "accent": "#EC4899", "background": "#FAFAFA", "text": "#374151"}'),
 
('minimalist', 'Minimalist', 'Less is more - clean, uncluttered design', 'minimalist.css',
 '{"primary": "#000000", "secondary": "#6B7280", "accent": "#EF4444", "background": "#FFFFFF", "text": "#111827"}'),
 
('romantic', 'Romantic', 'Soft and dreamy with romantic appeal', 'romantic.css',
 '{"primary": "#F472B6", "secondary": "#EC4899", "accent": "#FBB6CE", "background": "#FEF7FF", "text": "#86198F"}');

-- Link existing themes to templates (map current themes to base templates)
UPDATE themes SET description = 'Basic template with default colors' WHERE name = 'basic';
UPDATE themes SET description = 'Glamour template with pink/gold colors' WHERE name = 'glamour';
UPDATE themes SET description = 'Luxury template with purple colors' WHERE name = 'luxury';
UPDATE themes SET description = 'Modern template with blue colors' WHERE name = 'modern';
UPDATE themes SET description = 'Dark template with purple accent' WHERE name = 'dark';