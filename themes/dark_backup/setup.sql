-- Dark Sophisticated Boudoir Theme Setup SQL
-- Theme ID: 5 (existing theme rebuild)
-- Generated: 2025-09-02

START TRANSACTION;

-- Update existing theme_sets entry
UPDATE `theme_sets` SET
    `name` = 'dark',
    `display_name` = 'Dark Sophisticated Boudoir',
    `description` = 'Upscale evening elegance inspired by silk dresses, boudoir luxury, and sophisticated evening wear. Features rich golds, midnight purples, and cream accents for a refined aesthetic.',
    `category` = 'luxury',
    `features` = JSON_OBJECT(
        'parallax', JSON_ARRAY('home', 'about'),
        'typography', JSON_OBJECT(
            'display', 'Playfair Display',
            'body', 'Inter', 
            'accent', 'Dancing Script'
        ),
        'animations', JSON_ARRAY('subtle', 'fades'),
        'style_keywords', JSON_ARRAY('boudoir', 'silk', 'evening-gown', 'luxury', 'sophisticated', 'upscale'),
        'color_scheme', 'dark',
        'inspiration', 'black silk dresses, evening gowns, boudoir photography'
    ),
    `industry_features` = JSON_OBJECT(
        'escort', JSON_OBJECT('testimonials_limit', 3, 'gallery_masonry', true),
        'camgirl', JSON_OBJECT('streaming_integration', false),
        'photographer', JSON_OBJECT('portfolio_emphasis', true)
    ),
    `pricing_tier` = 'premium',
    `is_active` = 1
WHERE `id` = 5;

-- Update existing color palette
UPDATE `color_palettes` SET
    `name` = 'dark-boudoir',
    `display_name` = 'Dark Boudoir Sophistication',
    `description` = 'Rich golds, midnight purples, and cream silk tones for upscale evening elegance',
    `is_system_palette` = 1,
    `theme_set_id` = 5,
    `is_public` = 1
WHERE `id` = 11;

-- Update color palette values with boudoir color scheme
UPDATE `color_palette_values` SET
    `token_value` = CASE 
        WHEN `token_name` = 'primary' THEN '#D4AF37'      -- Rich Gold
        WHEN `token_name` = 'secondary' THEN '#2D1B69'    -- Deep Midnight Purple  
        WHEN `token_name` = 'accent' THEN '#E8B4CB'       -- Soft Rose Gold
        WHEN `token_name` = 'bg' THEN '#0A0A0F'           -- Rich Black
        WHEN `token_name` = 'bg-alt' THEN '#1A1625'       -- Charcoal
        WHEN `token_name` = 'surface' THEN '#2A2438'      -- Dark Plum
        WHEN `token_name` = 'overlay' THEN 'rgba(42, 36, 56, 0.9)'
        WHEN `token_name` = 'text' THEN '#F5F1E8'         -- Cream Silk
        WHEN `token_name` = 'text-subtle' THEN '#C9B991'  -- Muted Gold
        WHEN `token_name` = 'link' THEN '#E8B4CB'         -- Rose Gold
        WHEN `token_name` = 'link-hover' THEN '#D4AF37'   -- Gold Hover
        WHEN `token_name` = 'focus' THEN '#D4AF37'        -- Gold Focus
        WHEN `token_name` = 'success' THEN '#22C55E'      -- Success Green
        WHEN `token_name` = 'warning' THEN '#F59E0B'      -- Warning Amber
        WHEN `token_name` = 'error' THEN '#EF4444'        -- Error Red
        WHEN `token_name` = 'border' THEN '#3D3447'       -- Dark Bronze
        WHEN `token_name` = 'border-muted' THEN '#2A2438' -- Muted Border
        ELSE `token_value`
    END,
    `token_description` = CASE
        WHEN `token_name` = 'primary' THEN 'Rich gold for luxury accents and CTAs'
        WHEN `token_name` = 'secondary' THEN 'Deep midnight purple for sophisticated depth'
        WHEN `token_name` = 'accent' THEN 'Soft rose gold for highlights and decorative elements'
        WHEN `token_name` = 'bg' THEN 'Rich black background inspired by silk evening wear'
        WHEN `token_name` = 'bg-alt' THEN 'Charcoal secondary background for layered sections'
        WHEN `token_name` = 'surface' THEN 'Dark plum surface for cards and elevated content'
        WHEN `token_name` = 'text' THEN 'Cream silk text for optimal readability on dark backgrounds'
        WHEN `token_name` = 'text-subtle' THEN 'Muted gold for secondary text and descriptions'
        ELSE `token_description`
    END
WHERE `palette_id` = 11;

-- Update theme_set_pages with proper template paths
UPDATE `theme_set_pages` SET
    `template_file` = CASE
        WHEN `page_type_id` = 1 THEN 'dark/pages/home.handlebars'        -- Home
        WHEN `page_type_id` = 2 THEN 'dark/pages/about.handlebars'       -- About  
        WHEN `page_type_id` = 3 THEN 'dark/pages/contact.handlebars'     -- Contact
        WHEN `page_type_id` = 4 THEN 'dark/pages/gallery.handlebars'     -- Gallery
        WHEN `page_type_id` = 5 THEN 'dark/pages/rates.handlebars'       -- Rates
        WHEN `page_type_id` = 9 THEN 'dark/pages/calendar.handlebars'    -- Calendar
        WHEN `page_type_id` = 16 THEN 'dark/pages/etiquette.handlebars'  -- Etiquette
        ELSE `template_file`
    END,
    `features` = JSON_OBJECT(
        'parallax_enabled', CASE WHEN `page_type_id` IN (1, 2) THEN true ELSE false END,
        'animations', JSON_ARRAY('fade-up', 'fade-left', 'fade-right', 'zoom-in'),
        'sections', JSON_ARRAY('hero', 'content', 'cta')
    )
WHERE `theme_set_id` = 5;

COMMIT;