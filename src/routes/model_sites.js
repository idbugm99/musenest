const express = require('express');
const db = require('../../config/database');

const router = express.Router();

// Helper function to format location display based on service type
function formatLocationDisplay(location, serviceType, radiusMiles) {
    if (!location) return 'Location TBD';
    
    const baseLocation = location;
    
    switch (serviceType) {
        case 'incall':
            return `${baseLocation} Incall`;
        
        case 'outcall':
            if (radiusMiles && radiusMiles > 0) {
                return `Outcall within ${radiusMiles} miles of ${baseLocation}`;
            }
            return `${baseLocation} Outcall`;
        
        case 'both':
            if (radiusMiles && radiusMiles > 0) {
                return `${baseLocation} Incall & Outcall within ${radiusMiles} miles`;
            }
            return `${baseLocation} Incall & Outcall`;
        
        default:
            return baseLocation;
    }
}

// Helper function to get model by slug with theme assignment
async function getModelBySlug(slug) {
    try {
        const [models] = await db.execute(`
            SELECT m.id, m.name, m.slug, m.email, m.phone, m.status, m.theme_set_id, m.active_color_palette_id,
                   ts.name as theme_name, ts.display_name as theme_display_name, ts.default_palette_id,
                   cp.name as palette_name, cp.display_name as palette_display_name
            FROM models m
            LEFT JOIN theme_sets ts ON m.theme_set_id = ts.id
            LEFT JOIN color_palettes cp ON m.active_color_palette_id = cp.id
            WHERE m.slug = ? AND m.status IN ('active', 'trial', 'inactive')
            LIMIT 1
        `, [slug]);

        return models.length > 0 ? models[0] : null;
    } catch (error) {
        console.error('Error fetching model:', error);
        return null;
    }
}

// Helper function to load dynamic colors from color palette database
async function loadColorPalette(paletteId, themeId) {
    try {
        if (!paletteId && !themeId) {
            console.log('🎨 No palette or theme ID provided, using fallback colors');
            return { primary: '#3B82F6', secondary: '#6B7280', text: '#1F2937', background: '#FFFFFF', accent: '#10B981' };
        }

        // If no explicit palette, try to get theme default palette
        let targetPaletteId = paletteId;
        if (!targetPaletteId && themeId) {
            const [themeRows] = await db.execute(`
                SELECT default_palette_id FROM theme_sets WHERE id = ? LIMIT 1
            `, [themeId]);
            
            if (themeRows.length > 0 && themeRows[0].default_palette_id) {
                targetPaletteId = themeRows[0].default_palette_id;
                console.log(`🎨 Using theme default palette ID: ${targetPaletteId}`);
            }
        }

        if (!targetPaletteId) {
            console.log('🎨 No palette ID available, using fallback colors');
            return { primary: '#3B82F6', secondary: '#6B7280', text: '#1F2937', background: '#FFFFFF', accent: '#10B981' };
        }

        // Load color values from the palette
        const [colorRows] = await db.execute(`
            SELECT token_name, token_value 
            FROM color_palette_values 
            WHERE palette_id = ?
        `, [targetPaletteId]);

        console.log(`🎨 Loaded ${colorRows.length} color tokens from palette ${targetPaletteId}`);

        if (colorRows.length === 0) {
            console.log('🎨 No colors found in palette, using fallback colors');
            return { primary: '#3B82F6', secondary: '#6B7280', text: '#1F2937', background: '#FFFFFF', accent: '#10B981' };
        }

        // Convert to color object and create backwards-compatible structure
        const colors = {};
        colorRows.forEach(row => {
            colors[row.token_name] = row.token_value;
        });

        // Normalize legacy/variant token names to canonical schema
        const aliasToCanonical = {
            // brand
            'theme-primary': 'primary', 'brand-primary': 'primary',
            'theme-secondary': 'secondary',
            'theme-accent': 'accent', 'highlight': 'accent',
            // background/surface/overlay
            'background': 'bg', 'theme-background': 'bg',
            'surface': 'surface', 'card-background': 'surface', 'theme-surface': 'surface',
            'bg-primary': 'bg', 'bg-secondary': 'bg-light', 'bg-tertiary': 'surface',
            'hero-overlay': 'overlay', 'backdrop': 'overlay', 'theme-overlay': 'overlay',
            // text
            'theme-text': 'text', 'body-text': 'text',
            'theme-text-light': 'text-light', 'light-text': 'text-light',
            'theme-text-dark': 'text-dark', 'dark-text': 'text-dark',
            'text-default': 'text',
            // borders
            'theme-border': 'border', 'border-default': 'border',
            'theme-border-light': 'border-light',
            // cards
            'card-bg': 'card-bg', 'card-text': 'card-text', 'card-border': 'card-border', 'card-shadow': 'card-shadow',
            // nav/footer
            'nav-bg': 'nav-bg', 'nav-text': 'nav-text', 'nav-border': 'nav-border',
            'footer-bg': 'footer-bg', 'footer-text': 'footer-text', 'footer-border': 'footer-border',
            // buttons
            'btn-bg': 'btn-bg', 'btn-text': 'btn-text', 'btn-border': 'btn-border',
            'btn-bg-hover': 'btn-bg-hover', 'btn-text-hover': 'btn-text-hover',
            'btn-disabled-bg': 'btn-disabled-bg', 'btn-disabled-text': 'btn-disabled-text',
            // inputs
            'input-bg': 'input-bg', 'input-text': 'input-text', 'input-border': 'input-border', 'input-placeholder': 'input-placeholder', 'input-focus-ring': 'input-focus-ring',
            // hero
            'hero-bg': 'hero-bg', 'hero-text': 'hero-text',
            // misc
            'focus-ring': 'focus-ring', 'info': 'info', 'success': 'success', 'warning': 'warning', 'danger': 'danger',
        };

        const normalized = { ...colors };
        Object.entries(aliasToCanonical).forEach(([alias, canonical]) => {
            if (colors[alias] && !normalized[canonical]) {
                normalized[canonical] = colors[alias];
            }
        });

        // Ensure key canonical tokens exist with sensible fallbacks
        const std = {
            primary: normalized['primary'] || '#3B82F6',
            secondary: normalized['secondary'] || '#6B7280',
            accent: normalized['accent'] || '#0EA5E9',
            bg: normalized['bg'] || normalized['surface'] || '#FFFFFF',
            'bg-light': normalized['bg-light'] || '#F8FAFC',
            'bg-dark': normalized['bg-dark'] || '#0B0B15',
            surface: normalized['surface'] || normalized['card-bg'] || '#FFFFFF',
            overlay: normalized['overlay'] || 'rgba(0,0,0,0.5)',
            text: normalized['text'] || '#1F2937',
            'text-light': normalized['text-light'] || '#E9E7F1',
            'text-dark': normalized['text-dark'] || '#0B0B15',
            border: normalized['border'] || '#E2E8F0',
            'border-light': normalized['border-light'] || '#C8D3E1',
            'card-bg': normalized['card-bg'] || normalized['surface'] || '#FFFFFF',
            'card-text': normalized['card-text'] || normalized['text'] || '#1F2937',
            'card-border': normalized['card-border'] || normalized['border'] || '#E2E8F0',
            'card-shadow': normalized['card-shadow'] || 'rgba(0,0,0,0.1)',
            'btn-bg': normalized['btn-bg'] || normalized['primary'] || '#3B82F6',
            'btn-bg-hover': normalized['btn-bg-hover'] || normalized['accent'] || '#2563EB',
            'btn-text': normalized['btn-text'] || '#FFFFFF',
            'btn-text-hover': normalized['btn-text-hover'] || '#0B0B15',
            'btn-border': normalized['btn-border'] || normalized['primary'] || '#3B82F6',
            'focus-ring': normalized['focus-ring'] || normalized['accent'] || '#3B82F6',
        };

        // Compose compatible colors used by legacy templates (do not overwrite canonical)
        const compatibleColors = {
            primary: std.primary,
            secondary: std.secondary,
            text: std.text,
            background: std.bg,
            accent: std.accent
        };

        console.log('🎨 Compatible colors:', compatibleColors);

        // Return full color object with both token-based and compatible colors
        return { ...normalized, ...std, ...compatibleColors };

    } catch (error) {
        console.error('Error loading color palette:', error);
        return { primary: '#3B82F6', secondary: '#6B7280', text: '#1F2937', background: '#FFFFFF', accent: '#10B981' };
    }
}

// Helper function to get model content for a specific page type from dedicated tables
async function getModelContent(modelId, pageType) {
    try {
        let content = {};
        
        if (pageType === 'home') {
            // Get home page content from model_home_page_content table
            const [homeRows] = await db.execute(`
                SELECT * FROM model_home_page_content WHERE model_id = ?
            `, [modelId]);
            
            if (homeRows.length > 0) {
                content = homeRows[0];
                
                // Get site settings for model name and tagline
                const [siteRows] = await db.execute(`
                    SELECT site_name, tagline FROM site_settings WHERE model_id = ?
                `, [modelId]);
                
                if (siteRows.length > 0) {
                    content.site_name = siteRows[0].site_name;
                    content.tagline = siteRows[0].tagline;
                }
            }
        } else if (pageType === 'about') {
            // Get about page content from model_about_page_content table
            const [aboutRows] = await db.execute(`
                SELECT * FROM model_about_page_content WHERE model_id = ?
            `, [modelId]);
            
            if (aboutRows.length > 0) {
                content = aboutRows[0];
                
                // Transform database field names to template field names
                content.factsVisible = content.quick_facts_visible;
                content.interestsVisible = content.interests_visible;
                content.ctaTitle = content.cta_title;
                content.ctaDescription = content.cta_description;
                content.ctaButton_1Text = content.cta_button_1_text;
                content.ctaButton_1Link = content.cta_button_1_link;
                content.ctaButton_2Text = content.cta_button_2_text;
                content.ctaButton_2Link = content.cta_button_2_link;
                content.servicesTitle = content.services_title;
                content.quickFactsTitle = content.quick_facts_title;
                // Note: portraitImageUrl will be set later when we have the model slug
                content.portraitAlt = content.portrait_alt;
                
                console.log('🔍 Field mapping - quick_facts_visible:', content.quick_facts_visible);
                console.log('🔍 Field mapping - factsVisible:', content.factsVisible);
                
                // Build Quick Facts array from existing qf_* fields
                content.quickFacts = [];
                if (content.qf_location) {
                    content.quickFacts.push({question: 'Location', answer: content.qf_location});
                }
                if (content.qf_languages) {
                    content.quickFacts.push({question: 'Languages', answer: content.qf_languages});
                }
                if (content.qf_education) {
                    content.quickFacts.push({question: 'Education', answer: content.qf_education});
                }
                if (content.qf_specialties) {
                    content.quickFacts.push({question: 'Specialties', answer: content.qf_specialties});
                }
                console.log(`📋 Built ${content.quickFacts.length} quick facts from qf_* fields:`, content.quickFacts);
            }
        } else if (pageType === 'rates') {
            // Get rates page content from model_rates_page_content table
            const [ratesRows] = await db.execute(`
                SELECT * FROM model_rates_page_content WHERE model_id = ?
            `, [modelId]);
            
            if (ratesRows.length > 0) {
                content = ratesRows[0];
                console.log(`💰 Loaded rates page content for model ${modelId}`);
            } else {
                console.log(`⚠️ No rates page content found for model ${modelId}`);
                content = {};
            }
        } else if (pageType === 'contact') {
            // Get contact page content from model_contact_page_content table
            const [contactRows] = await db.execute(`
                SELECT * FROM model_contact_page_content WHERE model_id = ?
            `, [modelId]);
            
            if (contactRows.length > 0) {
                const rawContent = contactRows[0];
                
                // Convert camelCase field names to snake_case for Handlebars template compatibility
                content = {};
                Object.keys(rawContent).forEach(key => {
                    // Convert camelCase to snake_case (e.g., contactHeaderVisible -> contact_header_visible)
                    const snakeKey = key.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
                    content[snakeKey] = rawContent[key];
                });
                
                // Add mapping for glamour theme variables
                content.location = rawContent.location_area_text || null;
                content.workingHours = rawContent.direct_response_text || null;
            }
        } else if (pageType === 'etiquette') {
            // Get etiquette page content from model_etiquette_page_content table
            const [etiquetteRows] = await db.execute(`
                SELECT * FROM model_etiquette_page_content WHERE model_id = ?
            `, [modelId]);
            
            if (etiquetteRows.length > 0) {
                const rawContent = etiquetteRows[0];
                
                // Convert camelCase field names to snake_case for Handlebars template compatibility
                content = {};
                Object.keys(rawContent).forEach(key => {
                    // Convert camelCase to snake_case (e.g., etiquetteHeaderVisible -> etiquette_header_visible)
                    const snakeKey = key.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
                    content[snakeKey] = rawContent[key];
                });
            }
        } else if (pageType === "calendar") {
            // Get calendar page content from model_calendar_page_content table
            const [calendarRows] = await db.execute(`
                SELECT * FROM model_calendar_page_content WHERE model_id = ?
            `, [modelId]);
            
            if (calendarRows.length > 0) {
                const rawContent = calendarRows[0];
                
                // Convert camelCase field names to snake_case for Handlebars template compatibility
                content = {};
                Object.keys(rawContent).forEach(key => {
                    // Convert camelCase to snake_case (e.g., pageTitle -> page_title)
                    const snakeKey = key.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();
                    content[snakeKey] = rawContent[key];
                });
                
                console.log(`📅 Loaded calendar page content for model ${modelId}`);
            } else {
                console.log(`⚠️ No calendar page content found for model ${modelId}`);
                content = {};
            }
        } else if (pageType === 'rates') {
            // Get rates page content from model_rates_page_content table
            const [ratesRows] = await db.execute(`
                SELECT * FROM model_rates_page_content WHERE model_id = ?
            `, [modelId]);
            
            if (ratesRows.length > 0) {
                content = ratesRows[0];
            }
        } else if (pageType === 'gallery') {
            // Get gallery page content for Universal Gallery System
            try {
                // Get gallery page content from model_gallery_page_content table
                const [pageContentRows] = await db.execute(`
                    SELECT * FROM model_gallery_page_content WHERE model_id = ?
                `, [modelId]);
                
                if (pageContentRows.length > 0) {
                    const rawContent = pageContentRows[0];
                    
                    // Convert camelCase field names to snake_case for Handlebars template compatibility
                    Object.keys(rawContent).forEach(key => {
                        // Convert camelCase to snake_case (e.g., galleryHeaderVisible -> gallery_header_visible)
                        const snakeKey = key.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
                        content[snakeKey] = rawContent[key];
                    });
                }
                
                console.log(`🎨 Gallery page content loaded for Universal Gallery System (model ${modelId})`);
                
            } catch (error) {
                console.error('Error loading gallery page content:', error);
                // If there's an error, fallback to empty content
                content = {};
            }
        } else {
            // Fallback to old content_templates system for other page types
            const [contentRows] = await db.execute(`
                SELECT ct.content_key, ct.content_value, ct.content_type
                FROM content_templates ct
                JOIN page_types pt ON ct.page_type_id = pt.id
                WHERE ct.model_id = ? AND pt.name = ?
            `, [modelId, pageType]);

            // Convert to key-value object
            contentRows.forEach(row => {
                if (row.content_type === 'json') {
                    try {
                        content[row.content_key] = JSON.parse(row.content_value);
                    } catch (e) {
                        content[row.content_key] = row.content_value;
                    }
                } else {
                    content[row.content_key] = row.content_value;
                }
            });
        }



        return content;
    } catch (error) {
        console.error('Error fetching content:', error);
        return {};
    }
}

// Main route handler for model pages
router.get('/:slug/:page?', async (req, res) => {
    try {
        const { slug, page = 'home' } = req.params;


        
        // Skip admin route
        if (slug === 'admin') {
            return res.redirect('/admin');
        }
        
        // Skip CRM route
        if (page === 'crm') {
            return; // Let the request continue to other routes
        }
        

        
        // Get model data
        const model = await getModelBySlug(slug);
        if (!model) {
            console.log(`❌ Model not found: ${slug}`);
            return res.status(404).send('Model not found');
        }
        

        
        // Store model in req for calendar visibility middleware
        req.model = model;
        
        // Check if calendar page is requested and if it's disabled
        if (page === 'calendar' && !res.locals.calendarEnabled) {
            console.log(`🚫 Calendar access denied for ${slug} - calendar is disabled`);
            return res.status(404).send('Page not found');
        }
        
        // Helper function to build preview URLs with theme and palette parameters
        function buildPreviewUrl(path = '', previewTheme = null, paletteColors = null) {
            if (!previewTheme && !paletteColors) return path;
            
            const params = new URLSearchParams();
            if (previewTheme) {
                params.append('preview_theme', previewTheme.id);
            }
            if (paletteColors) {
                Object.entries(paletteColors).forEach(([key, value]) => {
                    params.append(`palette_${key}`, value);
                });
            }
            
            return `${path}?${params.toString()}`;
        }
        
        // Check for theme preview parameter (supports both ID and name)
        const previewThemeParam = req.query.preview_theme;
        let previewTheme = null;
        
        if (previewThemeParam) {
            try {
                // Check if it's a number (ID) or string (name)
                const isNumeric = !isNaN(previewThemeParam) && !isNaN(parseFloat(previewThemeParam));
                
                let query, params;
                if (isNumeric) {
                    // Query by ID (legacy support)
                    query = `
                        SELECT ts.id, ts.name, ts.display_name, 
                               cp.id as palette_id, cp.name as palette_name, cp.display_name as palette_display_name
                        FROM theme_sets ts
                        LEFT JOIN color_palettes cp ON cp.theme_set_id = ts.id AND cp.is_system_palette = 1
                        WHERE ts.id = ? AND ts.is_active = 1 
                        LIMIT 1
                    `;
                    params = [previewThemeParam];
                } else {
                    // Query by name (new support for "royal-gem", etc.)
                    query = `
                        SELECT ts.id, ts.name, ts.display_name,
                               cp.id as palette_id, cp.name as palette_name, cp.display_name as palette_display_name
                        FROM theme_sets ts
                        LEFT JOIN color_palettes cp ON cp.theme_set_id = ts.id AND cp.is_system_palette = 1
                        WHERE ts.name = ? AND ts.is_active = 1
                        LIMIT 1
                    `;
                    params = [previewThemeParam];
                }

                const [previewRows] = await db.execute(query, params);
                
                console.log(`📋 Preview query results:`, previewRows);
                
                if (previewRows.length > 0) {
                    previewTheme = previewRows[0];
                    console.log(`✅ Found preview theme: ${previewTheme.display_name} (${previewTheme.name})`);
                } else {
                    console.log(`❌ No preview theme found with parameter: ${previewThemeParam}`);
                }
            } catch (error) {
                console.error('❌ Error loading preview theme:', error);
            }
        }
        
        // Check for palette color parameters (for custom palette preview)


        
        let paletteColors = null;
        const paletteParams = ['primary', 'secondary', 'accent', 'background', 'text'];
        const hasPaletteColors = paletteParams.some(param => {
            const hasParam = req.query[`palette_${param}`];

            return hasParam;
        });
        
        if (hasPaletteColors) {
            paletteColors = {};
            paletteParams.forEach(param => {
                let colorValue = req.query[`palette_${param}`];
                // Handle URL encoding - decode if needed
                if (colorValue && colorValue.includes('%23')) {
                    colorValue = decodeURIComponent(colorValue);
                }
                console.log(`🎨 Raw palette_${param}: ${req.query[`palette_${param}`]} -> Decoded: ${colorValue}`);
                
                if (colorValue && /^#[0-9A-Fa-f]{6}$/.test(colorValue)) {
                    paletteColors[param] = colorValue;
                    console.log(`🎨 ✅ Processing palette color ${param}: ${colorValue}`);
                } else {
                    console.log(`🎨 ❌ Invalid color format for ${param}: ${colorValue}`);
                }
            });
            console.log('🎨 Final custom palette colors:', paletteColors);
            console.log('🎨 Will override theme colors:', paletteColors ? 'YES' : 'NO');
        }
        
        // Check publication status for all pages (for both navigation and access control)
        const pageStatus = {
            home: true,
            about: true,
            gallery: true,
            rates: true,
            etiquette: true,
            calendar: true,
            contact: true
        };

        // Define page to table mapping
        const pageTableMap = {
            home: 'model_home_page_content',
            about: 'model_about_page_content',
            gallery: 'model_gallery_page_content',
            rates: 'model_rates_page_content',
            etiquette: 'model_etiquette_page_content',
            calendar: 'model_calendar_page_content',
            contact: 'model_contact_page_content'
        };

        // Check publication status for each page
        for (const [pageName, tableName] of Object.entries(pageTableMap)) {
            try {
                const [pageContentRows] = await db.execute(`
                    SELECT page_published FROM ${tableName} WHERE model_id = ?
                `, [model.id]);
                
                if (pageContentRows.length > 0) {
                    pageStatus[pageName] = pageContentRows[0].page_published !== 0; // Consider null/undefined as published
                }
            } catch (error) {
                console.error(`Error checking ${pageName} page publish status:`, error);
                // If there's an error checking, allow the page (fail open)
                pageStatus[pageName] = true;
            }
        }

        // If requesting a specific page that's unpublished, return 404
        if (!pageStatus[page]) {
            console.log(`🚫 ${page.charAt(0).toUpperCase() + page.slice(1)} page for model ${model.id} is unpublished`);
            return res.status(404).send(`${page.charAt(0).toUpperCase() + page.slice(1)} page is not available`);
        }
        
        // Get content for this page
        const rawContent = await getModelContent(model.id, page);
        

        
        // Map theme set names to our Handlebars theme names
        const themeMapping = {
            'basic': 'basic',
            'glamour': 'glamour',
            'escort_glamour': 'glamour',
            'camgirl_glamour': 'glamour', 
            'salon_glamour': 'glamour',
            'luxury': 'luxury',
            'modern': 'modern',
            'dark': 'dark',
            'rose': 'rose',
            'bdsm': 'bdsm',
            'royal-gem': 'royal-gem',
            'simple-elegance': 'simple-elegance'
        };
        
        // Use preview theme if available, otherwise use model's assigned theme
        const activeTheme = previewTheme || model;
        const activeThemeName = previewTheme ? previewTheme.name : model.theme_name;
        const themeName = themeMapping[activeThemeName] || 'basic';
        
        if (previewTheme) {

            console.log(`   - Database theme name: "${activeThemeName}"`);
            console.log(`   - Mapped to handlebars theme: "${themeName}"`);
            console.log(`   - Display name: "${previewTheme.display_name}"`);
        } else {
            console.log(`🎨 Using assigned theme: ${themeName} (mapped from "${activeThemeName}")`);
        }
        
        // Load dynamic colors from color palette database (use preview theme palette if available)
        let paletteId = null;
        let themeId = null;

        if (previewTheme) {
            // For preview themes, use the theme's default palette
            paletteId = previewTheme.palette_id;
            themeId = previewTheme.id;
            console.log(`🎨 Preview mode - using theme ${themeId} (${previewTheme.name}) default palette ${paletteId}`);
        } else {
            // For regular mode, use model's active palette or theme default
            paletteId = model.active_color_palette_id;
            themeId = model.theme_set_id;
            console.log(`🎨 Regular mode - model palette ${paletteId}, theme ${themeId}`);
        }

        // Load dynamic colors from database
        const themeColors = await loadColorPalette(paletteId, themeId);


        // Pre-load testimonials data for home pages
        let testimonialsData = null;
        if (page === 'home') {
            try {
                const [testimonials] = await db.execute(`
                    SELECT client_name as name, testimonial_text as text, rating, created_at
                    FROM testimonials 
                    WHERE model_id = ? AND is_featured = 1 
                    ORDER BY created_at DESC
                    LIMIT 10
                `, [model.id]);
                
                testimonialsData = testimonials || [];
                console.log(`📣 Loaded ${testimonialsData.length} testimonials for ${model.slug}`);
            } catch (error) {
                console.error('Error loading testimonials:', error);
                testimonialsData = [];
            }
        }

        // Pre-load services/rates data for home pages
        let servicesData = null;
        if (page === 'home') {
            try {
                // Use rates data as services for home page preview
                const [services] = await db.execute(`
                    SELECT rate_type as name, service_name as description, price, duration
                    FROM model_rates 
                    WHERE model_id = ?
                    ORDER BY sort_order ASC, id ASC
                    LIMIT 6
                `, [model.id]);
                
                servicesData = services || [];
                console.log(`💼 Loaded ${servicesData.length} services for ${model.slug}`);
            } catch (error) {
                console.error('Error loading services:', error);
                servicesData = [];
            }
        }

        // Pre-load rates data for rates page
        if (page === 'rates' && rawContent) {
            try {
                if (!model) {
                    throw new Error('Model object is undefined');
                }
                const [allRates] = await db.execute(`
                    SELECT rate_type, service_name, duration, price, sort_order, 
                           highlight_badge, highlight_badge_text, rate_icon, rate_description,
                           is_most_popular
                    FROM model_rates 
                    WHERE model_id = ? AND is_visible = 1
                    ORDER BY rate_type, sort_order ASC, id ASC
                `, [model.id]);
                
                // Group rates by type
                const groupedRates = {
                    incall: allRates.filter(r => r.rate_type === 'incall'),
                    outcall: allRates.filter(r => r.rate_type === 'outcall'),
                    extended: allRates.filter(r => r.rate_type === 'extended')
                };
                
                // Convert rate field names to camelCase for Handlebars template compatibility
                const convertRateToHandlebars = (rate) => {
                    const converted = {};
                    Object.keys(rate).forEach(key => {
                        const camelKey = key.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
                        converted[camelKey] = rate[key];
                    });
                    return converted;
                };

                const convertedRates = {
                    incall: groupedRates.incall.map(convertRateToHandlebars),
                    outcall: groupedRates.outcall.map(convertRateToHandlebars),
                    extended: groupedRates.extended.map(convertRateToHandlebars)
                };

                // Add rates to content
                rawContent.rates = convertedRates;
            } catch (error) {
                console.error('Error loading rates data:', error);
                rawContent.rates = { incall: [], outcall: [], extended: [] };
            }
        }

        // Pre-load gallery images for home page preview
        let galleryImages = null;
        if (page === 'home') {
            try {
                const [images] = await db.execute(`
                    SELECT gi.filename, gi.caption
                    FROM gallery_images gi
                    LEFT JOIN content_moderation cm ON cm.model_id = gi.model_id AND cm.original_path LIKE CONCAT('%', gi.filename)
                    WHERE gi.model_id = ? AND gi.is_active = 1 
                    AND (cm.moderation_status = 'approved' OR cm.moderation_status IS NULL)
                    ORDER BY gi.created_at DESC
                    LIMIT 5
                `, [model.id]);
                
                galleryImages = images || [];
                console.log(`🖼️ Loaded ${galleryImages.length} gallery images for home preview`);
            } catch (error) {
                console.error('Error loading gallery images:', error);
                galleryImages = [];
            }
        }

        // Pre-load upcoming calendar events for home pages (configurable count)
        let upcomingEvents = null;
        if (page === 'home') {
            try {
                // Get display count from content settings (default to 3 if not set)
                const displayCount = parseInt(rawContent.travel_display_count || 3);
                
                // Get upcoming calendar events
                const [events] = await db.execute(`
                    SELECT 
                        ce.id,
                        ce.location,
                        ce.service_type,
                        ce.radius_miles,
                        ce.location_details,
                        ce.start_date,
                        ce.end_date,
                        ce.status,
                        ce.notes,
                        (ce.status = 'available') as is_available
                    FROM calendar_availability ce
                    WHERE ce.model_id = ? 
                        AND ce.start_date >= CURDATE() 
                        AND ce.is_visible = 1
                    ORDER BY ce.start_date ASC
                    LIMIT ${displayCount}
                `, [model.id]);
                
                // Format individual events for display (no grouping by location)
                upcomingEvents = events.map(event => {
                    const displayLocation = formatLocationDisplay(
                        event.location, 
                        event.service_type || 'incall', 
                        event.radius_miles
                    );
                    
                    const startDate = new Date(event.start_date);
                    const endDate = new Date(event.end_date);
                    
                    // Create user-friendly date range display
                    let dateRange;
                    if (startDate.toDateString() === endDate.toDateString()) {
                        // Single day
                        dateRange = startDate.toLocaleDateString('en-US', { 
                            month: 'long', 
                            day: 'numeric',
                            year: 'numeric'
                        });
                    } else {
                        // Date range - check if same month/year for shorter format
                        const sameMonth = startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear();
                        const sameYear = startDate.getFullYear() === endDate.getFullYear();
                        
                        if (sameMonth) {
                            // Same month: "August 12-13, 2025"
                            const monthName = startDate.toLocaleDateString('en-US', { month: 'long' });
                            const year = startDate.getFullYear();
                            const startDay = startDate.getDate();
                            const endDay = endDate.getDate();
                            dateRange = `${monthName} ${startDay}-${endDay}, ${year}`;
                        } else if (sameYear) {
                            // Same year, different months: "August 31 - September 2, 2025"
                            const startStr = startDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
                            const endStr = endDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
                            const year = startDate.getFullYear();
                            dateRange = `${startStr} - ${endStr}, ${year}`;
                        } else {
                            // Different years: "December 30, 2024 - January 2, 2025"
                            const startStr = startDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
                            const endStr = endDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
                            dateRange = `${startStr} - ${endStr}`;
                        }
                    }
                    
                    return {
                        id: event.id,
                        location: displayLocation,
                        baseLocation: event.location,
                        service_type: event.service_type,
                        radius_miles: event.radius_miles,
                        location_details: event.location_details,
                        date: startDate,
                        start_date: startDate,
                        end_date: endDate,
                        dateRange: dateRange,
                        notes: event.notes,
                        is_available: event.is_available,
                        status: event.status
                    };
                }); // Show exactly 3 events
                console.log(`📅 Loaded ${upcomingEvents.length} upcoming calendar events for ${model.slug}`);
                console.log('📅 Calendar events:', upcomingEvents.map(e => ({ 
                    location: e.location, 
                    date: e.date, 
                    dateRange: e.dateRange
                })));
            } catch (error) {
                console.error('Error loading calendar events:', error);
                upcomingEvents = [];
            }
        }

        // Gallery data is now loaded through getModelContent for gallery pages
        let galleryData = null;

        // Transform content keys for template compatibility (after all data loading)  
        // Exception: etiquette, contact, about, rates, gallery, and home pages use snake_case field names for Handlebars templates
        const pageContent = {};
        if (page === 'etiquette' || page === 'contact' || page === 'about' || page === 'rates' || page === 'gallery' || page === 'home' || page === 'calendar') {
            // These pages use snake_case field names directly - no conversion needed
            Object.keys(rawContent).forEach(key => {
                pageContent[key] = rawContent[key];
            });
        } else {
            // Other pages need snake_case to camelCase conversion
            Object.keys(rawContent).forEach(key => {
                // Convert snake_case to camelCase
                const camelKey = key.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
                pageContent[camelKey] = rawContent[key];
            });
        }
        
        // Load actual image URLs if IDs are provided (after field name transformation)
        const portraitIdKey = pageContent.portrait_image_id || pageContent.portraitImageId;
        if (portraitIdKey) {
            try {
                // First, let's check if the image exists at all
                const [allImages] = await db.execute(`
                    SELECT id, filename, model_id, is_active FROM gallery_images WHERE id = ?
                `, [portraitIdKey]);
                
                console.log(`🔍 Found ${allImages.length} images with ID ${portraitIdKey}:`, allImages);
                
                const [portraitImage] = await db.execute(`
                    SELECT gi.filename FROM gallery_images gi
                    LEFT JOIN content_moderation cm ON cm.model_id = gi.model_id AND cm.original_path LIKE CONCAT('%', gi.filename)
                    WHERE gi.id = ? AND gi.model_id = ? AND gi.is_active = 1
                    AND (cm.moderation_status = 'approved' OR cm.moderation_status IS NULL)
                    LIMIT 1
                `, [portraitIdKey, model.id]);
                
                console.log(`🔍 Portrait query result: ${portraitImage.length} images found`);
                if (portraitImage.length > 0) {
                    // Set both naming conventions for compatibility
                    const imageUrl = `/uploads/${model.slug}/public/gallery/${portraitImage[0].filename}`;
                    pageContent.portrait_image_url = imageUrl;
                    pageContent.portraitImageUrl = imageUrl;
                    console.log(`🖼️ Loaded portrait image: ${imageUrl}`);
                } else {
                    console.log(`❌ No portrait image found for ID ${portraitIdKey} with model_id ${model.id} and is_active=1`);
                }
            } catch (error) {
                console.error('Error loading portrait image:', error);
            }
        }
        
        const heroIdKey = pageContent.hero_background_image_id || pageContent.heroBackgroundImageId;
        if (heroIdKey) {
            try {
                const [heroImage] = await db.execute(`
                    SELECT gi.filename FROM gallery_images gi
                    LEFT JOIN content_moderation cm ON cm.model_id = gi.model_id AND cm.original_path LIKE CONCAT('%', gi.filename)
                    WHERE gi.id = ? AND gi.model_id = ? AND gi.is_active = 1
                    AND (cm.moderation_status = 'approved' OR cm.moderation_status IS NULL)
                    LIMIT 1
                `, [heroIdKey, model.id]);
                
                if (heroImage.length > 0) {
                    // Set both naming conventions for compatibility
                    const imageUrl = `/uploads/${model.slug}/public/gallery/${heroImage[0].filename}`;
                    pageContent.hero_background_image_url = imageUrl;
                    pageContent.heroBackgroundImageUrl = imageUrl;
                    console.log(`🖼️ Loaded hero background image: ${imageUrl}`);
                }
            } catch (error) {
                console.error('Error loading hero background image:', error);
            }
        }

        // Fallback: Use home page hero background for all pages if no specific background is set
        if (!pageContent.heroBackgroundImageUrl) {
            try {
                const [homeContent] = await db.execute(`
                    SELECT hero_background_image_id FROM model_home_page_content WHERE model_id = ?
                `, [model.id]);
                
                if (homeContent.length > 0 && homeContent[0].hero_background_image_id) {
                    const [heroImage] = await db.execute(`
                        SELECT gi.filename FROM gallery_images gi
                        WHERE gi.id = ? AND gi.model_id = ? AND gi.is_active = 1
                        LIMIT 1
                    `, [homeContent[0].hero_background_image_id, model.id]);
                    
                    if (heroImage.length > 0) {
                        const imageUrl = `/uploads/${model.slug}/public/gallery/${heroImage[0].filename}`;
                        pageContent.hero_background_image_url = imageUrl;
                        pageContent.heroBackgroundImageUrl = imageUrl;
                        console.log(`🖼️ Loaded fallback hero background image: ${imageUrl}`);
                    }
                }
            } catch (error) {
                console.error('Error loading fallback hero background image:', error);
            }
        }

        // Load portrait image for About page (snake_case field)
        if (pageContent.portrait_image_id) {
            try {
                const [portraitImage] = await db.execute(`
                    SELECT gi.filename FROM gallery_images gi
                    LEFT JOIN content_moderation cm ON cm.model_id = gi.model_id AND cm.original_path LIKE CONCAT('%', gi.filename)
                    WHERE gi.id = ? AND gi.model_id = ? AND gi.is_active = 1
                    AND (cm.moderation_status = 'approved' OR cm.moderation_status IS NULL)
                    LIMIT 1
                `, [pageContent.portrait_image_id, model.id]);
                
                console.log(`🔍 About portrait query result: ${portraitImage.length} images found`);
                if (portraitImage.length > 0) {
                    pageContent.portraitImageUrl = `/uploads/${model.slug}/public/gallery/${portraitImage[0].filename}`;
                    console.log(`🖼️ Loaded about portrait image: ${pageContent.portraitImageUrl}`);
                } else {
                    console.log(`❌ No about portrait image found for ID ${pageContent.portrait_image_id} with model_id ${model.id} and is_active=1`);
                }
            } catch (error) {
                console.error('Error loading about portrait image:', error);
            }
        }
        
        // Prepare template data with real content
        const templateData = {
            model: {
                id: model.id,
                name: model.name,
                slug: model.slug,
                email: model.email || `${model.slug}@musenest.com`
            },
            content: pageContent,
            // Pass gallery sections directly to template context for gallery pages
            ...(page === 'gallery' && pageContent.gallerySections ? {
                gallerySections: pageContent.gallerySections
            } : {}),
            // Pass rates data directly for rates page  
            ...(page === 'rates' && pageContent.rates ? {
                rates: pageContent.rates
            } : {}),
            // Pass home content for home page
            ...(page === 'home' ? { 
                home_content: pageContent && Object.keys(pageContent).length > 0 ? pageContent : {
                    hero_section_visible: true,
                    hero_title: siteName || 'Welcome to Glamour',
                    hero_subtitle: 'Welcome to my exclusive world',
                    hero_cta_visible: true,
                    hero_cta_text: 'Discover More',
                    hero_cta_link: `/{{modelSlug}}/contact`,
                    about_section_visible: true,
                    about_title: 'About Me',
                    about_description: 'Experience the finest in luxury companionship with professional elegance.',
                    about_cta_visible: true,
                    about_cta_text: 'Learn More',
                    services_section_visible: true,
                    services_title: 'My Services',
                    services_subtitle: 'Exclusive experiences tailored for you',
                    service_1_visible: true,
                    service_1_title: 'Premium Service',
                    service_1_description: 'Luxury companionship experience',
                    service_2_visible: true,
                    service_2_title: 'Exclusive Experience', 
                    service_2_description: 'Personalized attention and care',
                    service_3_visible: true,
                    service_3_title: 'VIP Treatment',
                    service_3_description: 'The ultimate premium experience',
                    services_cta_visible: true,
                    services_cta_text: 'View All Services',
                    cta_section_visible: true,
                    cta_title: 'Ready for the VIP Experience?',
                    cta_subtitle: 'Let me provide you with an unforgettable experience',
                    cta_primary_text: 'Book Now',
                    cta_secondary_text: 'View Rates'
                }
            } : {}),
            // Pass about content for about page
            ...(page === 'about' ? { about_content: pageContent } : {}),
            // Pass rates content for rates page
            ...(page === 'rates' ? { rates_content: pageContent } : {}),
            // Pass etiquette content for etiquette page
            ...(page === 'etiquette' ? { etiquette_content: pageContent } : {}),
            // Pass contact content for contact page
            ...(page === 'contact' ? { contact_content: pageContent } : {}),
            // Pass calendar content for calendar page
            ...(page === "calendar" ? { calendar_content: pageContent } : {}),
            // Pass gallery content for gallery page
            ...(page === 'gallery' ? { gallery_content: pageContent } : {}),
            
            // Template variables expected by themes
            siteName: model.name,
            modelSlug: model.slug,
            modelName: model.name,
            modelId: model.id,
            // Contact information for contact page
            contactEmail: model.email || `${model.slug}@musenest.com`,
            contactPhone: model.phone || null,
            location: pageContent.location || null,
            workingHours: pageContent.workingHours || null,
            // Theme colors for CSS variables (from database or palette override)
            theme: {
                name: themeName,
                colors: (paletteColors && Object.keys(paletteColors).length > 0) ? paletteColors : themeColors, // Use palette colors if provided and not empty, otherwise theme default
                isPreview: !!previewTheme,
                previewThemeId: previewTheme ? previewTheme.id : null,
                previewThemeName: previewTheme ? previewTheme.display_name : null,
                hasCustomPalette: !!(paletteColors && Object.keys(paletteColors).length > 0) // Flag to indicate custom palette is applied
            },
            
            // Debug log the colors being used
            ...(() => {
                const finalColors = (paletteColors && Object.keys(paletteColors).length > 0) ? paletteColors : themeColors;
                const hasValidPalette = !!(paletteColors && Object.keys(paletteColors).length > 0);


                if (hasValidPalette) {
                    console.log('🎨 Palette colors applied:', paletteColors);
                }
                return {};
            })(),
            
            // Navigation structure
            navigation: [
                ...(pageStatus.home ? [{ name: 'Home', url: `/${slug}${buildPreviewUrl('', previewTheme, paletteColors)}`, active: page === 'home' }] : []),
                ...(pageStatus.about ? [{ name: 'About', url: `/${slug}/about${buildPreviewUrl('', previewTheme, paletteColors)}`, active: page === 'about' }] : []),
                ...(pageStatus.gallery ? [{ name: 'Gallery', url: `/${slug}/gallery${buildPreviewUrl('', previewTheme, paletteColors)}`, active: page === 'gallery' }] : []),
                ...(pageStatus.rates ? [{ name: 'Rates', url: `/${slug}/rates${buildPreviewUrl('', previewTheme, paletteColors)}`, active: page === 'rates' }] : []),
                ...(pageStatus.etiquette ? [{ name: 'Etiquette', url: `/${slug}/etiquette${buildPreviewUrl('', previewTheme, paletteColors)}`, active: page === 'etiquette' }] : []),
                ...(res.locals.calendarEnabled && pageStatus.calendar ? [{ name: 'Calendar', url: `/${slug}/calendar${buildPreviewUrl('', previewTheme, paletteColors)}`, active: page === 'calendar' }] : []),
                ...(pageStatus.contact ? [{ name: 'Contact', url: `/${slug}/contact${buildPreviewUrl('', previewTheme, paletteColors)}`, active: page === 'contact' }] : [])
            ],
            // Current page info
            currentPage: page,
            siteUrl: `/${slug}${buildPreviewUrl('', previewTheme, paletteColors)}`,
            // Helper for links that need preview parameter
            previewParam: buildPreviewUrl('', previewTheme, paletteColors),
            year: new Date().getFullYear(),
            // Gallery data (pre-loaded for gallery pages)
            galleries: galleryData,
            // Testimonials data (pre-loaded for home pages)
            testimonials: testimonialsData,
            // Services data (pre-loaded for home pages)
            services: servicesData,
            // Gallery images for home page preview
            galleryImages: galleryImages,
            // Upcoming calendar events for home page preview
            upcomingEvents: upcomingEvents
        };
        
        // Render using the assigned theme with layout and theme-specific partials
        
        // Query for the correct template file from theme_set_pages table
        let templatePath = `${themeName}/pages/${page}`;
        try {
            const [themePageResults] = await db.execute(`
                SELECT tsp.template_file 
                FROM theme_set_pages tsp
                JOIN page_types pt ON tsp.page_type_id = pt.id
                WHERE tsp.theme_set_id = ? AND pt.name = ?
                LIMIT 1
            `, [model.theme_set_id, page]);
            
            if (themePageResults.length > 0) {
                // Remove leading slash, themes/ prefix, and .handlebars extension for templatePath
                const templateFile = themePageResults[0].template_file;
                templatePath = templateFile
                    .replace(/^\//, '')           // Remove leading slash
                    .replace(/^themes\//, '')     // Remove themes/ prefix 
                    .replace(/\.handlebars$/, ''); // Remove .handlebars extension
                console.log(`🎨 Using database template: ${templateFile} -> ${templatePath}`);
            } else {
                console.log(`🎨 No database template found for ${page}, using default: ${templatePath}`);
            }
        } catch (error) {
            console.error('❌ Error querying theme template:', error);
            console.log(`🎨 Falling back to default template: ${templatePath}`);
        }
        
        const layoutPath = `${themeName}/layouts/main`;

        
        // Create theme-specific app instance for proper partials resolution
        const { engine } = require('express-handlebars');
        const path = require('path');
        
        // Create a temporary Handlebars engine with theme-specific partials
        const themeEngine = engine({
            layoutsDir: path.join(__dirname, '../../themes'),
            partialsDir: path.join(__dirname, `../../themes/${themeName}/partials`),
            defaultLayout: false,
            extname: '.handlebars',
            helpers: {
                eq: (a, b) => a === b,
                ne: (a, b) => a !== b,
                lt: (a, b) => a < b,
                gt: (a, b) => a > b,
                and: (a, b) => a && b,
                or: (a, b) => a || b,
                json: (context) => JSON.stringify(context),
                formatDate: (date) => new Date(date).toLocaleDateString(),
                formatCurrency: (amount) => `$${parseFloat(amount).toFixed(2)}`,
                truncate: (str, length = 100) => str && str.length > length ? str.substring(0, length) + '...' : str,
                // String helpers
                split: (str, delimiter) => str ? str.split(delimiter) : [],
                trim: (str) => str ? str.trim() : '',
                // Mathematical helpers
                multiply: (a, b) => a * b,
                times: function(n, options) {
                    let result = '';
                    for (let i = 0; i < n; i++) {
                        result += options.fn(this);
                    }
                    return result;
                },
                
                // Gallery helpers (Phase 5: Gallery Layouts)
                hasGalleries: function(modelSlug) {
                    return this.gallerySections && this.gallerySections.length > 0;
                },
                renderGalleries: function(modelSlug) {
                    if (!this.gallerySections) {
                        return '<div class="text-center py-16 text-gray-500">No gallery sections available</div>';
                    }
                    
                    return this.gallerySections.map((section, sectionIndex) => {
                        const layoutClass = section.layout_type === 'masonry' ? 'masonry-grid' : 
                                          section.layout_type === 'carousel' ? 'carousel-container' : 'grid-container';
                        
                        // Get carousel settings (available for all layout types)
                        const settings = section.layout_settings || {};
                        
                        let imagesHtml = '';
                        let navigationHtml = '';
                        
                        // Calculate carousel-specific values (even for non-carousel, set defaults)
                        const visibleItems = parseInt(settings.carouselItemsVisible || '1');
                        const itemWidth = 320;
                        const itemGap = 24;
                        // Calculate container width: (itemWidth * visibleItems) + gaps + padding
                        // Add extra space to ensure both images fit comfortably
                        const containerWidth = (itemWidth * visibleItems) + (itemGap * (visibleItems - 1)) + 100; // +100px for padding and safety
                        
                        if (section.images && section.images.length > 0) {
                            if (section.layout_type === 'carousel') {
                                
                                // Calculate total track width (all items + gaps)
                                const totalTrackWidth = (itemWidth * section.images.length) + (itemGap * (section.images.length - 1));
                                
                                // Generate carousel HTML with proper structure for multiple visible items
                                imagesHtml = `
                                    <div class="carousel-track" id="carousel-${sectionIndex}" data-current-index="0" 
                                         data-visible-items="${visibleItems}" data-item-width="${itemWidth}" data-item-gap="${itemGap}" style="gap: ${itemGap}px;">
                                        ${section.images.map((img, index) => {
                                            const imageUrl = `/uploads/${modelSlug}/public/gallery/${img.filename}`;
                                            const captionRaw = img.alt_text || img.caption || 'Gallery Image';
                                            const captionSafe = String(captionRaw).replace(/'/g, "\\'");
                                            return `
                                                <div class="carousel-item" style="width: ${itemWidth}px; max-width: ${itemWidth}px;">
                                                    <img src="${imageUrl}" 
                                                         alt="${captionRaw}"
                                                         data-full="${imageUrl}"
                                                         class="gallery-image"
                                                         onclick="(window.openLightbox||window.openDarkGalleryLightbox||window.openModernGalleryLightbox) && (window.openLightbox||window.openDarkGalleryLightbox||window.openModernGalleryLightbox)('${imageUrl}', '${captionSafe}')"
                                                         loading="lazy">
                                                    ${img.caption ? `<div class="image-caption">${img.caption}</div>` : ''}
                                                </div>
                                            `;
                                        }).join('')}
                                    </div>
                                `;
                                
                                // Add carousel navigation based on settings (support both old and new property names)
                                const showArrows = (settings.carouselArrows !== false) && (settings.carousel_controls !== false); // Default to true if not specified
                                const showDots = (settings.carouselDots !== false) && (settings.carousel_indicators !== false); // Default to true if not specified
                                
                                let navigationParts = [];
                                
                                // Add arrows if enabled
                                if (showArrows) {
                                    navigationParts.push(`
                                        <button class="carousel-nav prev" onclick="moveCarousel(${sectionIndex}, -1)" aria-label="Previous">
                                            <i class="fas fa-chevron-left"></i>
                                        </button>
                                        <button class="carousel-nav next" onclick="moveCarousel(${sectionIndex}, 1)" aria-label="Next">
                                            <i class="fas fa-chevron-right"></i>
                                        </button>
                                    `);
                                }
                                
                                // Add dots if enabled (calculate based on visible items)
                                if (showDots) {
                                    const totalPages = Math.ceil(section.images.length / visibleItems);
                                    const dotsArray = Array.from({length: totalPages}, (_, pageIndex) => {
                                        const slideIndex = pageIndex * visibleItems;
                                        return `
                                            <div class="carousel-dot ${pageIndex === 0 ? 'active' : ''}" 
                                                 onclick="goToCarouselSlide(${sectionIndex}, ${slideIndex})" 
                                                 data-slide="${slideIndex}"></div>
                                        `;
                                    });
                                    
                                    navigationParts.push(`
                                        <div class="carousel-dots">
                                            ${dotsArray.join('')}
                                        </div>
                                    `);
                                }
                                
                                navigationHtml = navigationParts.join('');
                            } else {
                                // Generate regular grid/masonry HTML
                                imagesHtml = section.images.map(img => {
                                    const imageUrl = `/uploads/${modelSlug}/public/gallery/${img.filename}`;
                                    const captionRaw = img.alt_text || img.caption || 'Gallery Image';
                                    const captionSafe = String(captionRaw).replace(/'/g, "\\'");
                                    return `
                                        <div class="gallery-item" data-aos="fade-up" data-aos-delay="${Math.random() * 300}">
                                            <img src="${imageUrl}" 
                                                 alt="${captionRaw}"
                                                 data-full="${imageUrl}"
                                                 class="gallery-image cursor-pointer hover:scale-105 transition-transform duration-300"
                                                 onclick="(window.openLightbox||window.openDarkGalleryLightbox||window.openModernGalleryLightbox) && (window.openLightbox||window.openDarkGalleryLightbox||window.openModernGalleryLightbox)('${imageUrl}', '${captionSafe}')"
                                                 loading="lazy">
                                            ${img.caption ? `<div class="image-caption">${img.caption}</div>` : ''}
                                        </div>
                                    `;
                                }).join('');
                            }
                        } else {
                            imagesHtml = '<div class="text-center py-8 text-gray-400">No images in this section</div>';
                        }
                        
                        // Generate data-autoplay attribute for carousel
                        let autoplayAttr = '';
                        if (section.layout_type === 'carousel') {
                            const autoplayEnabled = settings.carouselAutoplay || settings.carousel_autoplay;
                            const autoplaySpeed = settings.carouselSpeed || settings.carousel_speed || '5000';
                            autoplayAttr = autoplayEnabled ? ` data-autoplay="${autoplaySpeed}"` : ' data-autoplay="0"';
                        }
                        
                        // If carousel: wrap track in a viewport with explicit width and overflow hidden
                        const contentHtml = section.layout_type === 'carousel'
                            ? `<div class="carousel-viewport" style="width: ${containerWidth}px; margin: 0 auto; overflow: hidden;">${imagesHtml}</div>${navigationHtml}`
                            : `${imagesHtml}${navigationHtml}`;
                        
                        return `
                            <div class="gallery-section mb-12">
                                <div class="text-center mb-8">
                                    <h2 class="text-3xl font-bold text-blue-600 mb-2">${section.title}</h2>
                                    ${section.description ? `<p class="text-gray-600 max-w-2xl mx-auto">${section.description}</p>` : ''}
                                    <div class="text-sm text-gray-500 mt-2">${section.images ? section.images.length : 0} images • ${section.layout_type} layout</div>
                                </div>
                                <div class="${layoutClass}"${autoplayAttr}>
                                    ${contentHtml}
                                </div>
                            </div>
                        `;
                    }).join('');
                },
                renderGallerySection: function(modelSlug, sectionSlug) {
                    const section = this.gallerySections ? 
                        this.gallerySections.find(s => s.slug === sectionSlug) : null;
                    return section ? this.renderGalleries(modelSlug) : `<div class="gallery-not-found">Gallery section "${sectionSlug}" not found</div>`;
                },
                renderGalleryByType: function(modelSlug, layoutType) {
                    const section = this.gallerySections ? 
                        this.gallerySections.find(s => s.layout_type === layoutType) : null;
                    return section ? this.renderGalleries(modelSlug) : `<div class="gallery-not-found">No ${layoutType} gallery found</div>`;
                },
                getFeaturedGalleryImages: function(modelSlug, limit = 6) {
                    if (!this.gallerySections) return [];
                    
                    const allImages = [];
                    this.gallerySections.forEach(section => {
                        if (section.images) {
                            allImages.push(...section.images);
                        }
                    });
                    
                    return allImages.slice(0, limit);
                }
            }
        });
        
        // Render with theme-specific engine
        const viewPath = path.join(__dirname, `../../themes/${templatePath}.handlebars`);
        
        // Debug completed - field name conversion fix applied

        
        themeEngine(viewPath, {
            ...templateData,
            // Add heroBackgroundImageUrl at top level for BDSM theme compatibility
            heroBackgroundImageUrl: pageContent.heroBackgroundImageUrl,
            layout: layoutPath
        }, (err, html) => {
            if (err) {
                console.error('❌ Template rendering error:', err);
                res.status(500).send('Template rendering error');
            } else {
                res.send(html);
            }
        });
        
    } catch (error) {
        console.error('❌ Error in model site route:', error);
        res.status(500).send('Internal server error');
    }
});

// Route for homepage (redirects to home page)
router.get('/:slug', async (req, res) => {
    res.redirect(`/${req.params.slug}/home`);
});

module.exports = router;
