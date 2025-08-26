-- TASK: Standardize color tokens across all theme sets and update DB
-- Goal: Create master token schema with industry-standard names

BEGIN;

-- 1) Backup existing data
CREATE TABLE IF NOT EXISTS theme_default_palettes_backup AS
SELECT * FROM theme_default_palettes WHERE 1=2;  -- structure only
INSERT INTO theme_default_palettes_backup SELECT * FROM theme_default_palettes;

-- 2) Create temporary master schema table
CREATE TEMPORARY TABLE tmp_master_tokens (
  token VARCHAR(50) PRIMARY KEY,
  description TEXT NOT NULL
);

-- 3) Load complete master schema (68 tokens)
INSERT INTO tmp_master_tokens (token, description) VALUES
('primary', 'Main brand or theme color'),
('secondary', 'Complementary color to primary'),
('accent', 'Highlight or accent color'),

('bg', 'Default background'),
('bg-light', 'Lighter background section'),
('bg-dark', 'Darker background section'),
('surface', 'Surface/background for cards, modals'),
('overlay', 'Semi-transparent overlay layer'),

('text', 'Default text color'),
('text-muted', 'Subtle/less prominent text'),
('text-light', 'Light text for dark backgrounds'),
('text-dark', 'Dark text for light backgrounds'),

('border', 'Default border'),
('border-light', 'Lighter border'),
('border-dark', 'Darker border'),
('divider', 'Divider/separator lines'),

('link', 'Link text'),
('link-hover', 'Link on hover'),
('link-visited', 'Link after visit'),
('link-active', 'Active link state'),
('focus-ring', 'Outline highlight for focus'),

('btn-bg', 'Button background'),
('btn-text', 'Button text'),
('btn-border', 'Button border'),
('btn-bg-hover', 'Button background hover'),
('btn-text-hover', 'Button text hover'),
('btn-disabled-bg', 'Disabled button background'),
('btn-disabled-text', 'Disabled button text'),

('disabled-bg', 'Disabled element background'),
('disabled-text', 'Disabled element text'),

('input-bg', 'Input field background'),
('input-text', 'Input text color'),
('input-border', 'Input border'),
('input-placeholder', 'Input placeholder text'),
('input-focus-ring', 'Input focus outline'),
('switch-on', 'Toggle/switch ON color'),
('switch-off', 'Toggle/switch OFF color'),

('card-bg', 'Card background'),
('card-text', 'Card text'),
('card-border', 'Card border'),
('card-shadow', 'Card shadow'),

('nav-bg', 'Navigation bar background'),
('nav-text', 'Navigation text'),
('nav-border', 'Navigation border'),

('footer-bg', 'Footer background'),
('footer-text', 'Footer text'),
('footer-border', 'Footer border'),

('hero-bg', 'Hero section background'),
('hero-text', 'Hero section text'),
('hero-overlay', 'Hero section overlay'),

('badge-bg', 'Badge background'),
('badge-text', 'Badge text'),
('tag-bg', 'Tag background'),
('tag-text', 'Tag text'),

('table-header-bg', 'Table header background'),
('table-header-text', 'Table header text'),
('table-row-bg', 'Table row background'),
('table-row-hover', 'Table row hover'),
('table-border', 'Table border'),

('alert-bg', 'Alert background'),
('alert-text', 'Alert text'),
('alert-border', 'Alert border'),
('success', 'Success/positive color'),
('warning', 'Warning color'),
('danger', 'Error/danger color'),
('info', 'Informational color'),

('tooltip-bg', 'Tooltip background'),
('tooltip-text', 'Tooltip text'),
('popover-bg', 'Popover background'),
('popover-text', 'Popover text'),
('modal-bg', 'Modal background'),
('modal-text', 'Modal text'),
('backdrop', 'Modal/page backdrop'),

('chart-1', 'Chart data series 1'),
('chart-2', 'Chart data series 2'),
('chart-3', 'Chart data series 3'),
('chart-4', 'Chart data series 4'),
('chart-5', 'Chart data series 5'),
('chart-6', 'Chart data series 6');

-- 4) Ensure every theme_set_id has every token (insert missing)
INSERT IGNORE INTO theme_default_palettes (theme_set_id, token_name, token_description, token_value, source_count, example_files, created_at, updated_at)
SELECT 
    ts.id as theme_set_id,
    m.token as token_name,
    m.description as token_description,
    '' as token_value,
    0 as source_count,
    'system_required' as example_files,
    NOW() as created_at,
    NOW() as updated_at
FROM theme_sets ts
CROSS JOIN tmp_master_tokens m
LEFT JOIN theme_default_palettes existing 
    ON ts.id = existing.theme_set_id AND m.token = existing.token_name
WHERE existing.id IS NULL;

-- 5) Fill missing/empty descriptions on existing rows to standard
UPDATE theme_default_palettes tdp
JOIN tmp_master_tokens m ON tdp.token_name = m.token
SET tdp.token_description = m.description,
    tdp.updated_at = NOW()
WHERE tdp.token_description IS NULL 
   OR TRIM(tdp.token_description) = '';

-- 6) Strengthen default set (theme_set_id=1) with sensible fallback values
-- Only fill where token_value is empty/NULL

-- Core brand colors
UPDATE theme_default_palettes
SET token_value = '#3b82f6', example_files = 'default', updated_at = NOW()
WHERE theme_set_id = 1 AND token_name = 'primary'
  AND (token_value IS NULL OR TRIM(token_value) = '');

UPDATE theme_default_palettes
SET token_value = '#64748b', example_files = 'default', updated_at = NOW()
WHERE theme_set_id = 1 AND token_name = 'secondary'
  AND (token_value IS NULL OR TRIM(token_value) = '');

UPDATE theme_default_palettes
SET token_value = '#0ea5e9', example_files = 'default', updated_at = NOW()
WHERE theme_set_id = 1 AND token_name = 'accent'
  AND (token_value IS NULL OR TRIM(token_value) = '');

-- Background colors
UPDATE theme_default_palettes
SET token_value = '#ffffff', example_files = 'default', updated_at = NOW()
WHERE theme_set_id = 1 AND token_name IN ('bg', 'surface', 'card-bg', 'modal-bg', 'popover-bg', 'tooltip-bg', 'input-bg', 'table-row-bg')
  AND (token_value IS NULL OR TRIM(token_value) = '');

UPDATE theme_default_palettes
SET token_value = '#f8fafc', example_files = 'default', updated_at = NOW()
WHERE theme_set_id = 1 AND token_name IN ('bg-light', 'footer-bg', 'badge-bg', 'disabled-bg', 'table-header-bg')
  AND (token_value IS NULL OR TRIM(token_value) = '');

UPDATE theme_default_palettes
SET token_value = '#0f172a', example_files = 'default', updated_at = NOW()
WHERE theme_set_id = 1 AND token_name IN ('bg-dark')
  AND (token_value IS NULL OR TRIM(token_value) = '');

-- Text colors
UPDATE theme_default_palettes
SET token_value = '#1e293b', example_files = 'default', updated_at = NOW()
WHERE theme_set_id = 1 AND token_name IN ('text', 'nav-text', 'card-text', 'modal-text', 'input-text')
  AND (token_value IS NULL OR TRIM(token_value) = '');

UPDATE theme_default_palettes
SET token_value = '#64748b', example_files = 'default', updated_at = NOW()
WHERE theme_set_id = 1 AND token_name IN ('text-muted', 'footer-text', 'disabled-text', 'input-placeholder')
  AND (token_value IS NULL OR TRIM(token_value) = '');

UPDATE theme_default_palettes
SET token_value = '#ffffff', example_files = 'default', updated_at = NOW()
WHERE theme_set_id = 1 AND token_name IN ('text-light', 'btn-text', 'hero-text', 'btn-text-hover', 'tooltip-text', 'popover-text', 'badge-text', 'tag-text', 'table-header-text')
  AND (token_value IS NULL OR TRIM(token_value) = '');

UPDATE theme_default_palettes
SET token_value = '#0f172a', example_files = 'default', updated_at = NOW()
WHERE theme_set_id = 1 AND token_name IN ('text-dark')
  AND (token_value IS NULL OR TRIM(token_value) = '');

-- Border colors
UPDATE theme_default_palettes
SET token_value = '#e2e8f0', example_files = 'default', updated_at = NOW()
WHERE theme_set_id = 1 AND token_name IN ('border', 'border-light', 'divider', 'card-border', 'nav-border', 'footer-border', 'input-border', 'table-border', 'alert-border', 'btn-border')
  AND (token_value IS NULL OR TRIM(token_value) = '');

UPDATE theme_default_palettes
SET token_value = '#cbd5e1', example_files = 'default', updated_at = NOW()
WHERE theme_set_id = 1 AND token_name IN ('border-dark')
  AND (token_value IS NULL OR TRIM(token_value) = '');

-- Interactive elements
UPDATE theme_default_palettes
SET token_value = '#3b82f6', example_files = 'default', updated_at = NOW()
WHERE theme_set_id = 1 AND token_name IN ('link', 'info', 'focus-ring', 'input-focus-ring')
  AND (token_value IS NULL OR TRIM(token_value) = '');

UPDATE theme_default_palettes
SET token_value = '#2563eb', example_files = 'default', updated_at = NOW()
WHERE theme_set_id = 1 AND token_name IN ('link-hover', 'btn-bg-hover', 'link-active')
  AND (token_value IS NULL OR TRIM(token_value) = '');

UPDATE theme_default_palettes
SET token_value = '#8b5cf6', example_files = 'default', updated_at = NOW()
WHERE theme_set_id = 1 AND token_name IN ('link-visited')
  AND (token_value IS NULL OR TRIM(token_value) = '');

-- Button colors (using CSS variables for dynamic theming)
UPDATE theme_default_palettes
SET token_value = 'var(--primary)', example_files = 'default', updated_at = NOW()
WHERE theme_set_id = 1 AND token_name IN ('btn-bg')
  AND (token_value IS NULL OR TRIM(token_value) = '');

-- Switch colors
UPDATE theme_default_palettes
SET token_value = '#10b981', example_files = 'default', updated_at = NOW()
WHERE theme_set_id = 1 AND token_name IN ('switch-on')
  AND (token_value IS NULL OR TRIM(token_value) = '');

UPDATE theme_default_palettes
SET token_value = '#d1d5db', example_files = 'default', updated_at = NOW()
WHERE theme_set_id = 1 AND token_name IN ('switch-off')
  AND (token_value IS NULL OR TRIM(token_value) = '');

-- Disabled states
UPDATE theme_default_palettes
SET token_value = '#9ca3af', example_files = 'default', updated_at = NOW()
WHERE theme_set_id = 1 AND token_name IN ('btn-disabled-bg', 'btn-disabled-text')
  AND (token_value IS NULL OR TRIM(token_value) = '');

-- Hero section
UPDATE theme_default_palettes
SET token_value = 'var(--primary)', example_files = 'default', updated_at = NOW()
WHERE theme_set_id = 1 AND token_name IN ('hero-bg')
  AND (token_value IS NULL OR TRIM(token_value) = '');

-- Table hover
UPDATE theme_default_palettes
SET token_value = '#f1f5f9', example_files = 'default', updated_at = NOW()
WHERE theme_set_id = 1 AND token_name IN ('table-row-hover')
  AND (token_value IS NULL OR TRIM(token_value) = '');

-- Alert backgrounds
UPDATE theme_default_palettes
SET token_value = '#fef2f2', example_files = 'default', updated_at = NOW()
WHERE theme_set_id = 1 AND token_name IN ('alert-bg')
  AND (token_value IS NULL OR TRIM(token_value) = '');

UPDATE theme_default_palettes
SET token_value = '#991b1b', example_files = 'default', updated_at = NOW()
WHERE theme_set_id = 1 AND token_name IN ('alert-text')
  AND (token_value IS NULL OR TRIM(token_value) = '');

-- Semantic state colors
UPDATE theme_default_palettes
SET token_value = '#10b981', example_files = 'default', updated_at = NOW()
WHERE theme_set_id = 1 AND token_name IN ('success')
  AND (token_value IS NULL OR TRIM(token_value) = '');

UPDATE theme_default_palettes
SET token_value = '#f59e0b', example_files = 'default', updated_at = NOW()
WHERE theme_set_id = 1 AND token_name IN ('warning')
  AND (token_value IS NULL OR TRIM(token_value) = '');

UPDATE theme_default_palettes
SET token_value = '#ef4444', example_files = 'default', updated_at = NOW()
WHERE theme_set_id = 1 AND token_name IN ('danger')
  AND (token_value IS NULL OR TRIM(token_value) = '');

-- Overlays and shadows
UPDATE theme_default_palettes
SET token_value = 'rgba(0,0,0,0.5)', example_files = 'default', updated_at = NOW()
WHERE theme_set_id = 1 AND token_name IN ('overlay', 'hero-overlay', 'backdrop')
  AND (token_value IS NULL OR TRIM(token_value) = '');

UPDATE theme_default_palettes
SET token_value = 'rgba(0,0,0,0.1)', example_files = 'default', updated_at = NOW()
WHERE theme_set_id = 1 AND token_name IN ('card-shadow')
  AND (token_value IS NULL OR TRIM(token_value) = '');

-- Tag colors
UPDATE theme_default_palettes
SET token_value = '#f1f5f9', example_files = 'default', updated_at = NOW()
WHERE theme_set_id = 1 AND token_name IN ('tag-bg')
  AND (token_value IS NULL OR TRIM(token_value) = '');

UPDATE theme_default_palettes
SET token_value = '#475569', example_files = 'default', updated_at = NOW()
WHERE theme_set_id = 1 AND token_name IN ('tag-text')
  AND (token_value IS NULL OR TRIM(token_value) = '');

-- Chart data series colors (diverse palette for data visualization)
UPDATE theme_default_palettes
SET token_value = '#3b82f6', example_files = 'default', updated_at = NOW()
WHERE theme_set_id = 1 AND token_name = 'chart-1'
  AND (token_value IS NULL OR TRIM(token_value) = '');

UPDATE theme_default_palettes
SET token_value = '#10b981', example_files = 'default', updated_at = NOW()
WHERE theme_set_id = 1 AND token_name = 'chart-2'
  AND (token_value IS NULL OR TRIM(token_value) = '');

UPDATE theme_default_palettes
SET token_value = '#f59e0b', example_files = 'default', updated_at = NOW()
WHERE theme_set_id = 1 AND token_name = 'chart-3'
  AND (token_value IS NULL OR TRIM(token_value) = '');

UPDATE theme_default_palettes
SET token_value = '#ef4444', example_files = 'default', updated_at = NOW()
WHERE theme_set_id = 1 AND token_name = 'chart-4'
  AND (token_value IS NULL OR TRIM(token_value) = '');

UPDATE theme_default_palettes
SET token_value = '#8b5cf6', example_files = 'default', updated_at = NOW()
WHERE theme_set_id = 1 AND token_name = 'chart-5'
  AND (token_value IS NULL OR TRIM(token_value) = '');

UPDATE theme_default_palettes
SET token_value = '#ec4899', example_files = 'default', updated_at = NOW()
WHERE theme_set_id = 1 AND token_name = 'chart-6'
  AND (token_value IS NULL OR TRIM(token_value) = '');

-- Drop temporary table
DROP TEMPORARY TABLE tmp_master_tokens;

COMMIT;