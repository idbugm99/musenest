-- Beautiful Roses Theme Database Setup
-- Generated following theme design guidelines and proper schema

START TRANSACTION;

-- Insert theme set
INSERT INTO `theme_sets` (
    `name`,
    `display_name`,
    `description`,
    `category`,
    `features`,
    `industry_features`,
    `pricing_tier`,
    `is_active`
) VALUES (
    'beautiful-roses',
    'Beautiful Roses',
    'An elegant rose garden theme featuring graceful design, light colors, and sophisticated typography. Perfect for creating memorable experiences.',
    'luxury',
    '{"parallax": true, "animations": "scale", "responsive": true, "accessibility": "AAA", "google_fonts": true}',
    '{"escort_friendly": true, "professional_design": true, "elegant_styling": true}',
    'premium',
    1
);

-- Get the theme set ID
SET @theme_set_id = LAST_INSERT_ID();

-- Insert theme set pages
INSERT INTO `theme_set_pages` (
    `theme_set_id`,
    `page_type_id`,
    `template_file`,
    `has_custom_layout`,
    `features`,
    `is_available`
) VALUES 
    (@theme_set_id, 1, 'beautiful-roses/pages/home', 1, '{"parallax": true, "hero_section": true, "services": true, "testimonials": true}', 1),
    (@theme_set_id, 2, 'beautiful-roses/pages/about', 1, '{"portrait": true, "services": true, "facts": true}', 1),
    (@theme_set_id, 3, 'beautiful-roses/pages/contact', 1, '{"contact_form": true, "guidelines": true}', 1),
    (@theme_set_id, 4, 'beautiful-roses/pages/gallery', 1, '{"masonry": true, "lightbox": true}', 1),
    (@theme_set_id, 5, 'beautiful-roses/pages/rates', 1, '{"pricing_tables": true, "services": true}', 1),
    (@theme_set_id, 9, 'beautiful-roses/pages/calendar', 1, '{"calendar_grid": true, "availability": true}', 1),
    (@theme_set_id, 16, 'beautiful-roses/pages/etiquette', 1, '{"guidelines": true, "policies": true}', 1);

-- Insert color palette
INSERT INTO `color_palettes` (
    `name`,
    `display_name`,
    `description`,
    `is_system_palette`,
    `theme_set_id`,
    `is_public`
) VALUES (
    'beautiful-roses-default',
    'Beautiful Roses Default',
    'Elegant rose garden color palette with AAA accessibility compliance. Light theme with graceful rose and sage green tones.',
    1,
    @theme_set_id,
    1
);

-- Get the palette ID
SET @palette_id = LAST_INSERT_ID();

-- Insert all 17 color palette values (AAA compliant)
INSERT INTO `color_palette_values` (
    `palette_id`,
    `token_name`,
    `token_value`,
    `token_description`
) VALUES 
    (@palette_id, 'primary', '#b91c5c', 'Deep Rose - Primary brand color (AAA compliant)'),
    (@palette_id, 'secondary', '#4a5d3a', 'Deep Sage Green - Secondary color (AAA compliant)'),
    (@palette_id, 'accent', '#ec4899', 'Rose Pink - Accent color for highlights'),
    (@palette_id, 'bg', '#fefefe', 'Soft White - Main background color'),
    (@palette_id, 'bg-alt', '#f9fafb', 'Very Light Gray - Alternative background'),
    (@palette_id, 'surface', '#ffffff', 'Pure White - Card and surface backgrounds'),
    (@palette_id, 'overlay', 'rgba(185, 28, 92, 0.05)', 'Soft Rose Overlay - For layered elements'),
    (@palette_id, 'text', '#1f2937', 'Dark Charcoal - Primary text (AAA: 7:1 contrast)'),
    (@palette_id, 'text-subtle', '#4b5563', 'Medium Gray - Secondary text (AAA compliant)'),
    (@palette_id, 'link', '#b91c5c', 'Deep Rose - Link color'),
    (@palette_id, 'link-hover', '#9f1c5c', 'Darker Rose - Link hover state'),
    (@palette_id, 'focus', '#fce7f3', 'Light Pink - Focus ring color'),
    (@palette_id, 'success', '#166534', 'Dark Garden Green - Success messages (AAA)'),
    (@palette_id, 'warning', '#a16207', 'Dark Golden - Warning messages (AAA)'),
    (@palette_id, 'error', '#b91c1c', 'Dark Rose Red - Error messages (AAA)'),
    (@palette_id, 'border', '#d1d5db', 'Light Gray - Standard borders'),
    (@palette_id, 'border-muted', '#e5e7eb', 'Very Light Gray - Subtle borders');

COMMIT;

-- Verification queries
SELECT 'Beautiful Roses theme setup completed successfully!' as status;
SELECT id, name, display_name FROM theme_sets WHERE name = 'beautiful-roses';
SELECT id, name, display_name FROM color_palettes WHERE theme_set_id = @theme_set_id;
SELECT COUNT(*) as token_count FROM color_palette_values WHERE palette_id = @palette_id;