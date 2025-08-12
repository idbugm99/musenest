const express = require('express');
const db = require('../../config/database');

const router = express.Router();

// Helper function to get model by slug with theme assignment
async function getModelBySlug(slug) {
    try {
        const [models] = await db.execute(`
            SELECT m.id, m.name, m.slug, m.email, m.status, m.theme_set_id,
                   ts.name as theme_name, ts.display_name as theme_display_name,
                   ts.default_color_scheme
            FROM models m
            LEFT JOIN theme_sets ts ON m.theme_set_id = ts.id
            WHERE m.slug = ? AND m.status IN ('active', 'trial', 'inactive')
            LIMIT 1
        `, [slug]);

        return models.length > 0 ? models[0] : null;
    } catch (error) {
        console.error('Error fetching model:', error);
        return null;
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
            }
        } else if (pageType === 'contact') {
            // Get contact page content from model_contact_page_content table
            const [contactRows] = await db.execute(`
                SELECT * FROM model_contact_page_content WHERE model_id = ?
            `, [modelId]);
            
            if (contactRows.length > 0) {
                content = contactRows[0];
            }
        } else if (pageType === 'etiquette') {
            // Get etiquette page content from model_etiquette_page_content table
            const [etiquetteRows] = await db.execute(`
                SELECT * FROM model_etiquette_page_content WHERE model_id = ?
            `, [modelId]);
            
            if (etiquetteRows.length > 0) {
                content = etiquetteRows[0];
            }
        } else if (pageType === 'rates') {
            // Get rates page content from model_rates_page_content table
            const [ratesRows] = await db.execute(`
                SELECT * FROM model_rates_page_content WHERE model_id = ?
            `, [modelId]);
            
            if (ratesRows.length > 0) {
                content = ratesRows[0];
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
        console.log(`🌐 Route hit: /${slug}/${page} with query:`, req.query);
        
        // Skip admin route
        if (slug === 'admin') {
            return res.redirect('/admin');
        }
        
        // Skip CRM route
        if (page === 'crm') {
            return; // Let the request continue to other routes
        }
        
        console.log(`🔍 Accessing model site: ${slug}/${page}`);
        
        // Get model data
        const model = await getModelBySlug(slug);
        if (!model) {
            console.log(`❌ Model not found: ${slug}`);
            return res.status(404).send('Model not found');
        }
        
        console.log(`✅ Found model: ${model.name} with theme: ${model.theme_name || 'basic'}`);
        
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
        
        // Check for theme preview parameter
        const previewThemeId = req.query.preview_theme;
        let previewTheme = null;
        
        if (previewThemeId) {
            try {
                console.log(`🔍 Preview theme requested: ${previewThemeId}`);
                const [previewRows] = await db.execute(`
                    SELECT id, name, display_name, default_color_scheme 
                    FROM theme_sets 
                    WHERE id = ? AND is_active = 1 
                    LIMIT 1
                `, [previewThemeId]);
                
                console.log(`📋 Preview query results:`, previewRows);
                
                if (previewRows.length > 0) {
                    previewTheme = previewRows[0];
                    console.log(`👁️  Found preview theme: ${previewTheme.display_name || previewTheme.name} (${previewTheme.name})`);
                } else {
                    console.log(`❌ No preview theme found with ID: ${previewThemeId}`);
                }
            } catch (error) {
                console.error('❌ Error loading preview theme:', error);
            }
        }
        
        // Check for palette color parameters (for custom palette preview)
        console.log('🔍 All query parameters:', req.query);
        console.log('🔍 Looking for palette parameters...');
        
        let paletteColors = null;
        const paletteParams = ['primary', 'secondary', 'accent', 'background', 'text'];
        const hasPaletteColors = paletteParams.some(param => {
            const hasParam = req.query[`palette_${param}`];
            console.log(`🔍 Checking palette_${param}:`, hasParam);
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
        
        // Get content for this page
        const rawContent = await getModelContent(model.id, page);
        console.log(`📄 Content loaded for ${page}:`, Object.keys(rawContent));
        
        // Transform content keys to camelCase for template compatibility and load image URLs
        const pageContent = {};
        Object.keys(rawContent).forEach(key => {
            // Convert snake_case to camelCase
            const camelKey = key.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
            pageContent[camelKey] = rawContent[key];
        });
        
        // Load actual image URLs if IDs are provided
        if (pageContent.portraitImageId) {
            try {
                const [portraitImage] = await db.execute(`
                    SELECT filename FROM gallery_images 
                    WHERE id = ? AND model_id = ? AND is_active = 1
                    LIMIT 1
                `, [pageContent.portraitImageId, model.id]);
                
                if (portraitImage.length > 0) {
                    pageContent.portraitImageUrl = `/uploads/models/${model.slug}/${portraitImage[0].filename}`;
                    console.log(`🖼️ Loaded portrait image: ${pageContent.portraitImageUrl}`);
                }
            } catch (error) {
                console.error('Error loading portrait image:', error);
            }
        }
        
        if (pageContent.heroBackgroundImageId) {
            try {
                const [heroImage] = await db.execute(`
                    SELECT filename FROM gallery_images 
                    WHERE id = ? AND model_id = ? AND is_active = 1
                    LIMIT 1
                `, [pageContent.heroBackgroundImageId, model.id]);
                
                if (heroImage.length > 0) {
                    pageContent.heroBackgroundImageUrl = `/uploads/models/${model.slug}/${heroImage[0].filename}`;
                    console.log(`🖼️ Loaded hero background image: ${pageContent.heroBackgroundImageUrl}`);
                }
            } catch (error) {
                console.error('Error loading hero background image:', error);
            }
        }
        
        console.log(`🔄 Transformed keys:`, Object.keys(pageContent));
        
        // Map theme set names to our Handlebars theme names
        const themeMapping = {
            'basic': 'basic',
            'glamour': 'glamour',
            'escort_glamour': 'glamour',
            'camgirl_glamour': 'glamour', 
            'salon_glamour': 'glamour',
            'luxury': 'luxury',
            'modern': 'modern',
            'dark': 'dark'
        };
        
        // Use preview theme if available, otherwise use model's assigned theme
        const activeTheme = previewTheme || model;
        const activeThemeName = previewTheme ? previewTheme.name : model.theme_name;
        const themeName = themeMapping[activeThemeName] || 'basic';
        
        if (previewTheme) {
            console.log(`👁️  PREVIEW MODE:`);
            console.log(`   - Database theme name: "${activeThemeName}"`);
            console.log(`   - Mapped to handlebars theme: "${themeName}"`);
            console.log(`   - Display name: "${previewTheme.display_name}"`);
        } else {
            console.log(`🎨 Using assigned theme: ${themeName} (mapped from "${activeThemeName}")`);
        }
        
        // Parse theme colors from database (use preview theme colors if available)
        let themeColors = { primary: '#3B82F6', secondary: '#6B7280', text: '#1F2937', background: '#FFFFFF', accent: '#10B981' };
        const colorScheme = previewTheme ? previewTheme.default_color_scheme : model.default_color_scheme;
        
        if (colorScheme) {
            try {
                // Check if it's already an object or needs parsing
                themeColors = typeof colorScheme === 'string' 
                    ? JSON.parse(colorScheme) 
                    : colorScheme;
            } catch (error) {
                console.error('Error parsing theme colors:', error);
            }
        }
        console.log(`🎨 Theme colors:`, themeColors);

        // Pre-load testimonials data for home pages
        let testimonialsData = null;
        if (page === 'home') {
            try {
                const [testimonials] = await db.execute(`
                    SELECT name, text, rating, display_order
                    FROM testimonials 
                    WHERE model_id = ? AND is_visible = 1 
                    ORDER BY display_order ASC, created_at ASC
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
                const [services] = await db.execute(`
                    SELECT s.id, s.name, s.description, s.icon, mr.price, mr.duration
                    FROM services s 
                    LEFT JOIN model_rates mr ON s.id = mr.service_id AND mr.model_id = ?
                    WHERE s.model_id = ? AND s.is_active = 1 
                    ORDER BY s.display_order ASC, s.created_at ASC
                    LIMIT 10
                `, [model.id, model.id]);
                
                servicesData = services || [];
                console.log(`💼 Loaded ${servicesData.length} services for ${model.slug}`);
            } catch (error) {
                console.error('Error loading services:', error);
                servicesData = [];
            }
        }

        // Pre-load gallery images for home page preview
        let galleryImages = null;
        if (page === 'home') {
            try {
                const [images] = await db.execute(`
                    SELECT filename, caption
                    FROM gallery_images 
                    WHERE model_id = ? AND is_active = 1 
                    ORDER BY created_at DESC
                    LIMIT 5
                `, [model.id]);
                
                galleryImages = images || [];
                console.log(`🖼️ Loaded ${galleryImages.length} gallery images for home preview`);
            } catch (error) {
                console.error('Error loading gallery images:', error);
                galleryImages = [];
            }
        }

        // Pre-load upcoming calendar events for home pages (next 7 days)
        let upcomingEvents = null;
        if (page === 'home') {
            try {
                // Get calendar events for the next 7 days
                const [events] = await db.execute(`
                    SELECT 
                        ce.id,
                        ce.title,
                        ce.start_date as date,
                        ce.start_time,
                        ce.end_time,
                        ce.status,
                        ce.notes,
                        (ce.status = 'available') as is_available
                    FROM calendar_events ce
                    WHERE ce.model_id = ? 
                        AND ce.start_date >= CURDATE() 
                        AND ce.start_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
                        AND ce.is_visible = 1
                    ORDER BY ce.start_date ASC, ce.start_time ASC
                    LIMIT 15
                `, [model.id]);
                
                // Group events by location for travel schedule display
                const eventsByLocation = {};
                events.forEach(event => {
                    const location = event.location || 'Local Area';
                    if (!eventsByLocation[location]) {
                        eventsByLocation[location] = {
                            location: location,
                            title: event.title,
                            dates: [],
                            notes: event.notes,
                            is_available: event.is_available
                        };
                    }
                    eventsByLocation[location].dates.push(event.date);
                });
                
                // Format events for display with date ranges
                upcomingEvents = Object.values(eventsByLocation).map(event => {
                    // Sort dates and create display format
                    event.dates.sort((a, b) => new Date(a) - new Date(b));
                    const startDate = event.dates[0];
                    const endDate = event.dates[event.dates.length - 1];
                    
                    // Use start date for template compatibility, but store date range info
                    return {
                        ...event,
                        date: startDate,
                        start_date: startDate,
                        end_date: endDate,
                        dateRange: startDate.toDateString() === endDate.toDateString() ? 
                            startDate.toDateString() : 
                            `${startDate.toDateString()} - ${endDate.toDateString()}`
                    };
                }).slice(0, 6); // Show max 6 locations
                console.log(`📅 Loaded ${upcomingEvents.length} upcoming calendar days for ${model.slug}`);
            } catch (error) {
                console.error('Error loading calendar events:', error);
                upcomingEvents = [];
            }
        }

        // Pre-load gallery data for gallery pages (Phase 5: Gallery Layouts)
        let galleryData = null;
        if (page === 'gallery') {
            try {
                const galleryHelper = require('../../utils/galleryHelper');
                
                // Check if model has galleries
                const hasGalleries = await galleryHelper.hasGalleries(model.slug);
                
                if (hasGalleries) {
                    // Get gallery data
                    const galleries = await galleryHelper.getGalleryData(model.slug);
                    
                    // Render galleries HTML
                    const renderHtml = await galleryHelper.renderGalleries(model.slug);
                    
                    // Get featured images
                    const featuredImages = await galleryHelper.getFeaturedGalleryImages(model.slug, 6);
                    
                    galleryData = {
                        hasGalleries: true,
                        sections: galleries ? galleries.sections : [],
                        totalSections: galleries ? galleries.totalSections : 0,
                        totalImages: galleries ? galleries.totalImages : 0,
                        renderHtml: renderHtml,
                        featuredImages: featuredImages
                    };
                    
                    console.log(`🖼️ Loaded gallery data: ${galleryData.totalSections} sections, ${galleryData.totalImages} images`);
                } else {
                    galleryData = {
                        hasGalleries: false,
                        sections: [],
                        totalSections: 0,
                        totalImages: 0,
                        renderHtml: '<div class="galleries-empty">No galleries available</div>',
                        featuredImages: []
                    };
                    
                    console.log(`🖼️ No galleries found for model: ${model.slug}`);
                }
            } catch (error) {
                console.error('❌ Error loading gallery data:', error);
                galleryData = {
                    hasGalleries: false,
                    sections: [],
                    totalSections: 0,
                    totalImages: 0,
                    renderHtml: '<div class="galleries-error">Error loading galleries</div>',
                    featuredImages: []
                };
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
            // Template variables expected by themes
            siteName: model.name,
            modelSlug: model.slug,
            modelName: model.name,
            modelId: model.id,
            // Contact information for contact page
            contactEmail: model.email || `${model.slug}@musenest.com`,
            contactPhone: pageContent.contactPhone || null,
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
                console.log('🎨 Final theme colors being passed to template:', finalColors);
                console.log('🎨 Using palette colors:', hasValidPalette, hasValidPalette ? 'Custom palette applied' : 'Default theme colors');
                if (hasValidPalette) {
                    console.log('🎨 Palette colors applied:', paletteColors);
                }
                return {};
            })(),
            
            // Navigation structure
            navigation: [
                { name: 'Home', url: `/${slug}${buildPreviewUrl('', previewTheme, paletteColors)}`, active: page === 'home' },
                { name: 'About', url: `/${slug}/about${buildPreviewUrl('', previewTheme, paletteColors)}`, active: page === 'about' },
                { name: 'Gallery', url: `/${slug}/gallery${buildPreviewUrl('', previewTheme, paletteColors)}`, active: page === 'gallery' },
                ...(res.locals.calendarEnabled ? [{ name: 'Calendar', url: `/${slug}/calendar${buildPreviewUrl('', previewTheme, paletteColors)}`, active: page === 'calendar' }] : []),
                { name: 'Contact', url: `/${slug}/contact${buildPreviewUrl('', previewTheme, paletteColors)}`, active: page === 'contact' },
                { name: 'Rates', url: `/${slug}/rates${buildPreviewUrl('', previewTheme, paletteColors)}`, active: page === 'rates' }
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
        const templatePath = `${themeName}/pages/${page}`;
        const layoutPath = `${themeName}/layouts/main`;
        console.log(`🖼️  Rendering template: ${templatePath} with layout: ${layoutPath}`);
        
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
                renderGalleries: function(modelSlug) {
                    return this.galleries ? this.galleries.renderHtml : '<div class="galleries-empty">No galleries available</div>';
                },
                renderGallerySection: function(modelSlug, sectionSlug) {
                    const section = this.galleries && this.galleries.sections ? 
                        this.galleries.sections.find(s => s.slug === sectionSlug) : null;
                    return section ? section.renderHtml : `<div class="gallery-not-found">Gallery section "${sectionSlug}" not found</div>`;
                },
                renderGalleryByType: function(modelSlug, layoutType) {
                    const section = this.galleries && this.galleries.sections ? 
                        this.galleries.sections.find(s => s.layout_type === layoutType) : null;
                    return section ? section.renderHtml : `<div class="gallery-not-found">No ${layoutType} gallery found</div>`;
                },
                hasGalleries: function(modelSlug) {
                    return this.galleries && this.galleries.sections && this.galleries.sections.length > 0;
                },
                getFeaturedGalleryImages: function(modelSlug, limit = 6) {
                    return this.galleries && this.galleries.featuredImages ? 
                        this.galleries.featuredImages.slice(0, limit) : [];
                }
            }
        });
        
        // Render with theme-specific engine
        const viewPath = path.join(__dirname, `../../themes/${templatePath}.handlebars`);
        themeEngine(viewPath, {
            ...templateData,
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