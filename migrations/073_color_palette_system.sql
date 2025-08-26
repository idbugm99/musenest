-- Color Palette System Migration
-- This creates the database structure for the dynamic color system

-- 1. Theme default palettes table
CREATE TABLE IF NOT EXISTS theme_default_palettes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    theme_set_id INT NOT NULL,
    token_name VARCHAR(50) NOT NULL,
    token_value VARCHAR(100) NOT NULL,
    confidence ENUM('high', 'medium', 'low', 'generated') DEFAULT 'medium',
    source_count INT DEFAULT 0,
    example_files TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (theme_set_id) REFERENCES theme_sets(id) ON DELETE CASCADE,
    UNIQUE KEY unique_theme_token (theme_set_id, token_name),
    INDEX idx_theme_tokens (theme_set_id, token_name)
);

-- 2. Custom color palettes table
CREATE TABLE IF NOT EXISTS color_palettes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    is_system_palette BOOLEAN DEFAULT FALSE,
    theme_set_id INT NULL, -- NULL means universal palette
    created_by_model_id INT NULL,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (theme_set_id) REFERENCES theme_sets(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by_model_id) REFERENCES models(id) ON DELETE SET NULL,
    INDEX idx_palette_theme (theme_set_id),
    INDEX idx_palette_creator (created_by_model_id)
);

-- 3. Color palette values table
CREATE TABLE IF NOT EXISTS color_palette_values (
    id INT AUTO_INCREMENT PRIMARY KEY,
    palette_id INT NOT NULL,
    token_name VARCHAR(50) NOT NULL,
    token_value VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (palette_id) REFERENCES color_palettes(id) ON DELETE CASCADE,
    UNIQUE KEY unique_palette_token (palette_id, token_name),
    INDEX idx_palette_tokens (palette_id, token_name)
);

-- 4. Add color palette assignment to models table
ALTER TABLE models 
ADD COLUMN active_color_palette_id INT NULL,
ADD FOREIGN KEY fk_model_palette (active_color_palette_id) REFERENCES color_palettes(id) ON DELETE SET NULL;

-- 5. Insert default palettes for existing themes
-- Get the theme IDs we know exist
INSERT IGNORE INTO theme_default_palettes (theme_set_id, token_name, token_value, confidence, source_count, example_files) VALUES
-- Basic Theme (ID 1) - Professional blue
(1, 'primary', '#2563eb', 'generated', 0, 'default'),
(1, 'secondary', '#64748b', 'generated', 0, 'default'),
(1, 'accent', '#0ea5e9', 'generated', 0, 'default'),
(1, 'bg', '#ffffff', 'generated', 0, 'default'),
(1, 'bg-light', '#f8fafc', 'generated', 0, 'default'),
(1, 'text', '#1e293b', 'generated', 0, 'default'),
(1, 'text-muted', '#64748b', 'generated', 0, 'default'),
(1, 'border', '#e2e8f0', 'generated', 0, 'default'),

-- Glamour Theme (ID 2) - Pink and elegant
(2, 'primary', '#ec4899', 'generated', 0, 'default'),
(2, 'secondary', '#8b5cf6', 'generated', 0, 'default'),
(2, 'accent', '#f97316', 'generated', 0, 'default'),
(2, 'bg', '#ffffff', 'generated', 0, 'default'),
(2, 'bg-light', '#fdf2f8', 'generated', 0, 'default'),
(2, 'text', '#1e293b', 'generated', 0, 'default'),
(2, 'text-muted', '#64748b', 'generated', 0, 'default'),
(2, 'border', '#f3e8ff', 'generated', 0, 'default'),

-- Luxury Theme (ID 3) - Gold and premium
(3, 'primary', '#d97706', 'generated', 0, 'default'),
(3, 'secondary', '#92400e', 'generated', 0, 'default'),
(3, 'accent', '#f59e0b', 'generated', 0, 'default'),
(3, 'bg', '#ffffff', 'generated', 0, 'default'),
(3, 'bg-light', '#fffbeb', 'generated', 0, 'default'),
(3, 'text', '#1e293b', 'generated', 0, 'default'),
(3, 'text-muted', '#64748b', 'generated', 0, 'default'),
(3, 'border', '#fed7aa', 'generated', 0, 'default'),

-- Modern Theme (ID 4) - Contemporary blue
(4, 'primary', '#3b82f6', 'generated', 0, 'default'),
(4, 'secondary', '#6b7280', 'generated', 0, 'default'),
(4, 'accent', '#06b6d4', 'generated', 0, 'default'),
(4, 'bg', '#ffffff', 'generated', 0, 'default'),
(4, 'bg-light', '#f1f5f9', 'generated', 0, 'default'),
(4, 'text', '#1e293b', 'generated', 0, 'default'),
(4, 'text-muted', '#64748b', 'generated', 0, 'default'),
(4, 'border', '#e2e8f0', 'generated', 0, 'default'),

-- Dark Theme (ID 5) - Cyberpunk colors
(5, 'primary', '#00ff88', 'generated', 0, 'default'),
(5, 'secondary', '#ff0088', 'generated', 0, 'default'),
(5, 'accent', '#00ccff', 'generated', 0, 'default'),
(5, 'bg', '#0a0a0a', 'generated', 0, 'default'),
(5, 'bg-light', '#1a1a1a', 'generated', 0, 'default'),
(5, 'text', '#ffffff', 'generated', 0, 'default'),
(5, 'text-muted', '#a3a3a3', 'generated', 0, 'default'),
(5, 'border', '#404040', 'generated', 0, 'default');

-- Add common tokens for all themes
INSERT IGNORE INTO theme_default_palettes (theme_set_id, token_name, token_value, confidence) 
SELECT ts.id, 'btn-bg', 'var(--primary)', 'generated'
FROM theme_sets ts WHERE ts.id IN (1,2,3,4,5);

INSERT IGNORE INTO theme_default_palettes (theme_set_id, token_name, token_value, confidence) 
SELECT ts.id, 'btn-text', '#ffffff', 'generated'
FROM theme_sets ts WHERE ts.id IN (1,2,3,4,5);

INSERT IGNORE INTO theme_default_palettes (theme_set_id, token_name, token_value, confidence) 
SELECT ts.id, 'link', 'var(--primary)', 'generated'
FROM theme_sets ts WHERE ts.id IN (1,2,3,4,5);

INSERT IGNORE INTO theme_default_palettes (theme_set_id, token_name, token_value, confidence) 
SELECT ts.id, 'link-hover', 'var(--secondary)', 'generated'
FROM theme_sets ts WHERE ts.id IN (1,2,3,4,5);

-- 6. Create default system palettes
INSERT INTO color_palettes (name, display_name, description, is_system_palette, is_public) VALUES
('ocean-blue', 'Ocean Blue', 'Calming ocean blue palette with teals and blues', TRUE, TRUE),
('sunset-orange', 'Sunset Orange', 'Warm sunset palette with oranges and corals', TRUE, TRUE),
('forest-green', 'Forest Green', 'Natural forest palette with greens and earth tones', TRUE, TRUE),
('royal-purple', 'Royal Purple', 'Regal purple palette with deep purples and violets', TRUE, TRUE),
('rose-gold', 'Rose Gold', 'Elegant rose gold palette with pinks and golds', TRUE, TRUE),
('monochrome', 'Monochrome', 'Classic black and white with grays', TRUE, TRUE);

-- Ocean Blue palette values
INSERT INTO color_palette_values (palette_id, token_name, token_value) 
SELECT p.id, token, value FROM color_palettes p, (
    SELECT 'primary' as token, '#0ea5e9' as value UNION ALL
    SELECT 'secondary', '#0891b2' UNION ALL
    SELECT 'accent', '#06b6d4' UNION ALL
    SELECT 'bg', '#ffffff' UNION ALL
    SELECT 'bg-light', '#f0f9ff' UNION ALL
    SELECT 'text', '#0c4a6e' UNION ALL
    SELECT 'text-muted', '#0369a1' UNION ALL
    SELECT 'border', '#bae6fd'
) colors WHERE p.name = 'ocean-blue';

-- Sunset Orange palette values
INSERT INTO color_palette_values (palette_id, token_name, token_value) 
SELECT p.id, token, value FROM color_palettes p, (
    SELECT 'primary' as token, '#f97316' as value UNION ALL
    SELECT 'secondary', '#ea580c' UNION ALL
    SELECT 'accent', '#fb923c' UNION ALL
    SELECT 'bg', '#ffffff' UNION ALL
    SELECT 'bg-light', '#fff7ed' UNION ALL
    SELECT 'text', '#9a3412' UNION ALL
    SELECT 'text-muted', '#c2410c' UNION ALL
    SELECT 'border', '#fed7aa'
) colors WHERE p.name = 'sunset-orange';

-- Add common tokens for system palettes
INSERT INTO color_palette_values (palette_id, token_name, token_value) 
SELECT p.id, 'btn-bg', 'var(--primary)' FROM color_palettes p WHERE p.is_system_palette = TRUE;

INSERT INTO color_palette_values (palette_id, token_name, token_value) 
SELECT p.id, 'btn-text', '#ffffff' FROM color_palettes p WHERE p.is_system_palette = TRUE;

INSERT INTO color_palette_values (palette_id, token_name, token_value) 
SELECT p.id, 'link', 'var(--primary)' FROM color_palettes p WHERE p.is_system_palette = TRUE;

INSERT INTO color_palette_values (palette_id, token_name, token_value) 
SELECT p.id, 'link-hover', 'var(--secondary)' FROM color_palettes p WHERE p.is_system_palette = TRUE;