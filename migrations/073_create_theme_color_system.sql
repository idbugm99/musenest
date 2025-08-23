-- ===================================
-- Theme Color Override System Migration
-- File: 073_create_theme_color_system.sql
-- ===================================

-- Create theme_color_overrides table for flexible color management
CREATE TABLE IF NOT EXISTS theme_color_overrides (
    id INT AUTO_INCREMENT PRIMARY KEY,
    theme_set_id INT NOT NULL,
    variable_name VARCHAR(50) NOT NULL COMMENT 'CSS variable name (e.g., --theme-accent, --basic-primary)',
    variable_value VARCHAR(20) NOT NULL COMMENT 'Color value (hex, rgb, hsl)',
    variable_category ENUM('primary', 'secondary', 'accent', 'background', 'text', 'border') NOT NULL DEFAULT 'primary',
    variable_description VARCHAR(200) NULL COMMENT 'Human readable description',
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    display_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (theme_set_id) REFERENCES theme_sets(id) ON DELETE CASCADE,
    UNIQUE KEY unique_theme_variable (theme_set_id, variable_name),
    INDEX idx_theme_active (theme_set_id, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Theme color overrides for flexible theme customization';

-- Insert Victorian Boudoir color overrides for Template 5 (Dark Sophisticated)
INSERT INTO theme_color_overrides (theme_set_id, variable_name, variable_value, variable_category, variable_description, display_order) VALUES
-- Primary Brand Colors
(5, '--basic-primary', '#b8860b', 'primary', 'Victorian antique gold - main brand color', 1),
(5, '--basic-secondary', '#9a7209', 'primary', 'Victorian deep gold - secondary brand', 2),
(5, '--basic-accent', '#f8f6f0', 'accent', 'Victorian pearl - accent highlights', 3),
(5, '--primary', '#b8860b', 'primary', 'Primary color variable', 4),
(5, '--primary-700', '#9a7209', 'primary', 'Primary color dark variant', 5),

-- Theme Color System
(5, '--theme-accent', '#b8860b', 'accent', 'Victorian antique gold accent', 6),
(5, '--theme-accent-hover', '#9a7209', 'accent', 'Victorian deep gold hover state', 7),
(5, '--theme-accent-light', '#f4c2c2', 'accent', 'Light blush accent', 8),
(5, '--theme-accent-burgundy', '#8b3a3a', 'accent', 'Burgundy accent color', 9),

-- Background Colors
(5, '--theme-bg-primary', '#1a1a1a', 'background', 'Deep charcoal primary background', 10),
(5, '--theme-bg-secondary', '#2d2625', 'background', 'Warm dark brown secondary background', 11),
(5, '--theme-bg-tertiary', '#3d3532', 'background', 'Card backgrounds with warmth', 12),
(5, '--theme-bg-light', '#4a453f', 'background', 'Lighter warm elements', 13),
(5, '--theme-bg-surface', '#2d2625', 'background', 'Surface elements', 14),

-- Text Colors
(5, '--theme-text-primary', '#f8f4f0', 'text', 'Warm white for headers', 15),
(5, '--theme-text-secondary', '#e8ddd4', 'text', 'Warm cream for body text', 16),
(5, '--theme-text-muted', '#d4c4b0', 'text', 'Warm muted text', 17),
(5, '--theme-text-subtle', '#b8a690', 'text', 'Subtle warm text', 18),
(5, '--theme-text-inverted', '#1a1a1a', 'text', 'Dark text on light backgrounds', 19),

-- Border Colors
(5, '--theme-border-primary', '#4a453f', 'border', 'Warm borders', 20),
(5, '--theme-border-light', '#5d5449', 'border', 'Light warm borders', 21),
(5, '--theme-border-subtle', '#3d3532', 'border', 'Subtle warm borders', 22),
(5, '--theme-border-metallic', '#b8860b', 'border', 'Victorian antique gold borders', 23),

-- Boudoir Palette
(5, '--boudoir-blush', '#f4c2c2', 'accent', 'Soft blush pink', 24),
(5, '--boudoir-dusty-rose', '#d4a5a5', 'accent', 'Dusty rose', 25),
(5, '--boudoir-mauve', '#c49a9a', 'accent', 'Mauve', 26),
(5, '--boudoir-rose-gold', '#b8860b', 'accent', 'Victorian antique gold', 27),
(5, '--boudoir-champagne', '#f7e7ce', 'accent', 'Champagne', 28),
(5, '--boudoir-burgundy', '#8b3a3a', 'accent', 'Deep burgundy', 29),
(5, '--boudoir-deep-burgundy', '#6b2c2c', 'accent', 'Deeper burgundy', 30),

-- Victorian Specific Colors
(5, '--victorian-antique-gold', '#b8860b', 'primary', 'Victorian antique gold', 31),
(5, '--victorian-deep-gold', '#9a7209', 'primary', 'Victorian deep gold', 32),
(5, '--victorian-pearl', '#f8f6f0', 'accent', 'Victorian pearl', 33),
(5, '--victorian-velvet', '#722f37', 'accent', 'Victorian velvet', 34),
(5, '--victorian-burgundy', '#800020', 'accent', 'Victorian burgundy', 35),
(5, '--victorian-ivory', '#fffff0', 'accent', 'Victorian ivory', 36),
(5, '--victorian-amber', '#ffbf00', 'accent', 'Victorian amber', 37),

-- Override Tailwind/Bootstrap Colors for Consistency
(5, '--blue-600', '#b8860b', 'primary', 'Victorian override for blue-600', 38),
(5, '--blue-500', '#b8860b', 'primary', 'Victorian override for blue-500', 39),
(5, '--green-400', '#b8860b', 'primary', 'Victorian override for green-400', 40),
(5, '--green-600', '#b8860b', 'primary', 'Victorian override for green-600', 41),
(5, '--purple-600', '#b8860b', 'primary', 'Victorian override for purple-600', 42),

-- Success/Warning/Error States
(5, '--theme-success', '#6b8b3a', 'accent', 'Warm success green', 43),
(5, '--theme-warning', '#b8860b', 'accent', 'Victorian gold warning', 44),
(5, '--theme-error', '#8b3a3a', 'accent', 'Burgundy error', 45);

-- Update the default_color_scheme JSON for Template 5
UPDATE theme_sets 
SET default_color_scheme = JSON_OBJECT(
    'primary', '#b8860b',
    'secondary', '#9a7209', 
    'accent', '#f8f6f0',
    'background', '#1a1a1a',
    'surface', '#2d2625',
    'text_primary', '#f8f4f0',
    'text_secondary', '#e8ddd4',
    'border', '#4a453f',
    'boudoir_rose_gold', '#b8860b',
    'victorian_antique_gold', '#b8860b',
    'victorian_pearl', '#f8f6f0',
    'theme_name', 'Victorian Boudoir'
)
WHERE id = 5;

-- Create index for performance
CREATE INDEX idx_theme_color_category ON theme_color_overrides(variable_category, is_active);
CREATE INDEX idx_theme_color_order ON theme_color_overrides(theme_set_id, display_order);