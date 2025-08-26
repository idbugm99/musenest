-- Update Color Palette Schema Migration
-- Remove confidence column and add token_description

-- 1. Add the new token_description column
ALTER TABLE theme_default_palettes 
ADD COLUMN token_description TEXT AFTER token_name;

-- 2. Drop the confidence column
ALTER TABLE theme_default_palettes 
DROP COLUMN confidence;

-- 3. Update descriptions for existing tokens
UPDATE theme_default_palettes SET token_description = 'Main brand or theme color' WHERE token_name = 'primary';
UPDATE theme_default_palettes SET token_description = 'Complementary color to primary' WHERE token_name = 'secondary';
UPDATE theme_default_palettes SET token_description = 'Highlight or accent color' WHERE token_name = 'accent';
UPDATE theme_default_palettes SET token_description = 'Default background' WHERE token_name = 'bg';
UPDATE theme_default_palettes SET token_description = 'Lighter background section' WHERE token_name = 'bg-light';
UPDATE theme_default_palettes SET token_description = 'Darker background section' WHERE token_name = 'bg-dark';
UPDATE theme_default_palettes SET token_description = 'Default text color' WHERE token_name = 'text';
UPDATE theme_default_palettes SET token_description = 'Subtle/less prominent text' WHERE token_name = 'text-muted';
UPDATE theme_default_palettes SET token_description = 'Dark text for light backgrounds' WHERE token_name = 'text-dark';
UPDATE theme_default_palettes SET token_description = 'Light text for dark backgrounds' WHERE token_name = 'text-light';
UPDATE theme_default_palettes SET token_description = 'Default border' WHERE token_name = 'border';
UPDATE theme_default_palettes SET token_description = 'Lighter border' WHERE token_name = 'border-light';
UPDATE theme_default_palettes SET token_description = 'Darker border' WHERE token_name = 'border-dark';
UPDATE theme_default_palettes SET token_description = 'Button background' WHERE token_name = 'btn-bg';
UPDATE theme_default_palettes SET token_description = 'Button text' WHERE token_name = 'btn-text';
UPDATE theme_default_palettes SET token_description = 'Link text' WHERE token_name = 'link';
UPDATE theme_default_palettes SET token_description = 'Link on hover' WHERE token_name = 'link-hover';
UPDATE theme_default_palettes SET token_description = 'Navigation bar background' WHERE token_name = 'nav-bg';
UPDATE theme_default_palettes SET token_description = 'Navigation text' WHERE token_name = 'nav-text';
UPDATE theme_default_palettes SET token_description = 'Footer background' WHERE token_name = 'footer-bg';
UPDATE theme_default_palettes SET token_description = 'Footer text' WHERE token_name = 'footer-text';
UPDATE theme_default_palettes SET token_description = 'Card background' WHERE token_name = 'card-bg';
UPDATE theme_default_palettes SET token_description = 'Card border' WHERE token_name = 'card-border';
UPDATE theme_default_palettes SET token_description = 'Hero section background' WHERE token_name = 'hero-bg';
UPDATE theme_default_palettes SET token_description = 'Hero section text' WHERE token_name = 'hero-text';
UPDATE theme_default_palettes SET token_description = 'Hero section overlay' WHERE token_name = 'hero-overlay';
UPDATE theme_default_palettes SET token_description = 'Badge background' WHERE token_name = 'badge-bg';
UPDATE theme_default_palettes SET token_description = 'Badge text' WHERE token_name = 'badge-text';
UPDATE theme_default_palettes SET token_description = 'Alert background' WHERE token_name = 'alert-bg';
UPDATE theme_default_palettes SET token_description = 'Alert text' WHERE token_name = 'alert-text';
UPDATE theme_default_palettes SET token_description = 'Success/positive color' WHERE token_name = 'success';
UPDATE theme_default_palettes SET token_description = 'Warning color' WHERE token_name = 'warning';
UPDATE theme_default_palettes SET token_description = 'Error/danger color' WHERE token_name = 'danger';
UPDATE theme_default_palettes SET token_description = 'Informational color' WHERE token_name = 'info';

-- 4. Now create a comprehensive insert for all missing tokens for all themes
-- Get all theme IDs first and insert all required tokens

-- Create temporary table with all required tokens
CREATE TEMPORARY TABLE required_tokens (
    token_name VARCHAR(50),
    token_description TEXT
);

INSERT INTO required_tokens VALUES
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

-- Insert missing tokens for all themes (with empty token_value where not exists)
INSERT IGNORE INTO theme_default_palettes (theme_set_id, token_name, token_description, token_value, source_count, example_files)
SELECT 
    ts.id as theme_set_id,
    rt.token_name,
    rt.token_description,
    '' as token_value,
    0 as source_count,
    'system_required' as example_files
FROM theme_sets ts
CROSS JOIN required_tokens rt
LEFT JOIN theme_default_palettes existing ON ts.id = existing.theme_set_id AND rt.token_name = existing.token_name
WHERE existing.id IS NULL;

-- Drop temporary table
DROP TEMPORARY TABLE required_tokens;

-- 5. Update color_palette_values table to add descriptions too
ALTER TABLE color_palette_values 
ADD COLUMN token_description TEXT AFTER token_name;

-- Update descriptions for color_palette_values
UPDATE color_palette_values cpv 
JOIN (
    SELECT DISTINCT token_name, token_description 
    FROM theme_default_palettes 
    WHERE token_description IS NOT NULL
) descriptions ON cpv.token_name = descriptions.token_name
SET cpv.token_description = descriptions.token_description;