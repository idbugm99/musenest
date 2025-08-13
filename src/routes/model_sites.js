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
                
                // Load Quick Facts for about page
                try {
                    console.log('🔍 Loading quick facts for model ID:', modelId);
                    console.log('🔍 Database connection type:', typeof db.execute);
                    
                    const query = `
                        SELECT id, question, answer, display_order 
                        FROM quick_facts 
                        WHERE model_id = ? AND is_active = 1
                        ORDER BY display_order ASC, id ASC
                    `;
                    console.log('🔍 SQL Query:', query);
                    console.log('🔍 Query parameters:', [modelId]);
                    
                    const [quickFacts] = await db.execute(query, [modelId]);
                    
                    console.log('🔍 Raw query result:', quickFacts);
                    content.quickFacts = quickFacts || [];
                    console.log(`📋 Loaded ${quickFacts.length} quick facts for about page:`, quickFacts);
                } catch (error) {
                    console.log('⚠️  Quick facts table not found or error loading quick facts:', error.message);
                    console.log('⚠️  Full error:', error);
                    content.quickFacts = [];
                }
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
        } else if (pageType === 'gallery') {
            // Get gallery page content and sections
            try {
                
                // First, get the gallery page content to see which sections are selected
                const [pageContentRows] = await db.execute(`
                    SELECT selected_sections FROM model_gallery_page_content WHERE model_id = ?
                `, [modelId]);
                
                let selectedSectionIds = [];
                if (pageContentRows.length > 0 && pageContentRows[0].selected_sections) {
                    try {
                        const rawSections = pageContentRows[0].selected_sections;
                                                  // Check if it's already an array or needs parsing
                          if (Array.isArray(rawSections)) {
                              selectedSectionIds = rawSections;
                          } else if (typeof rawSections === 'string') {
                              selectedSectionIds = JSON.parse(rawSections);
                          }
                    } catch (e) {
                        // If parsing fails, fall back to empty array
                        selectedSectionIds = [];
                    }
                }
                
                // If no sections are selected, show all visible sections (fallback)
                if (!selectedSectionIds || selectedSectionIds.length === 0) {
                    const [allSections] = await db.execute(`
                        SELECT gs.*, COUNT(gi.id) as image_count
                        FROM gallery_sections gs
                        LEFT JOIN gallery_images gi ON gs.id = gi.section_id AND gi.is_active = 1
                        WHERE gs.model_id = ? AND gs.is_visible = 1
                        GROUP BY gs.id
                        ORDER BY gs.sort_order ASC, gs.id ASC
                    `, [modelId]);
                    selectedSectionIds = allSections.map(s => s.id);
                }
                
                // Load only the selected gallery sections (ignore visibility since they're explicitly selected)
                // Ensure selectedSectionIds is an array (JSON.parse sometimes returns single values as primitives)
                if (!Array.isArray(selectedSectionIds)) {
                    selectedSectionIds = selectedSectionIds ? [selectedSectionIds] : [];
                }
                
                const [sections] = await db.execute(`
                    SELECT gs.*, COUNT(gi.id) as image_count
                    FROM gallery_sections gs
                    LEFT JOIN gallery_images gi ON gs.id = gi.section_id AND gi.is_active = 1
                    WHERE gs.id IN (${selectedSectionIds.map(() => '?').join(',')})
                    GROUP BY gs.id
                    ORDER BY FIELD(gs.id, ${selectedSectionIds.map(() => '?').join(',')})
                `, [...selectedSectionIds, ...selectedSectionIds]);
                
                content.gallerySections = sections;
                
                // Load images for each section
                for (const section of sections) {
                    const [images] = await db.execute(`
                        SELECT id, filename, caption, alt_text, sort_order, order_index
                        FROM gallery_images 
                        WHERE section_id = ? AND is_active = 1
                        ORDER BY sort_order ASC, order_index ASC
                    `, [section.id]);
                    
                    section.images = images;
                }
                
            } catch (error) {
                // If there's an error, fallback to empty sections
                content.gallerySections = [];
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

        // Debug what's being returned for rates page
        if (pageType === 'rates') {
            console.log('🔧 getModelContent RETURNING:');
            console.log('🔧 content keys:', Object.keys(content));
            console.log('🔧 content.rates exists:', !!content.rates);
            if (content.rates) {
                console.log('🔧 content.rates keys:', Object.keys(content.rates));
                console.log('🔧 content.rates.incall length:', content.rates.incall?.length || 0);
            }
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
        
        // Check for theme preview parameter
        const previewThemeId = req.query.preview_theme;
        let previewTheme = null;
        
        if (previewThemeId) {
            try {

                const [previewRows] = await db.execute(`
                    SELECT id, name, display_name, default_color_scheme 
                    FROM theme_sets 
                    WHERE id = ? AND is_active = 1 
                    LIMIT 1
                `, [previewThemeId]);
                
                console.log(`📋 Preview query results:`, previewRows);
                
                if (previewRows.length > 0) {
                    previewTheme = previewRows[0];

                } else {
                    console.log(`❌ No preview theme found with ID: ${previewThemeId}`);
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
            'dark': 'dark'
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

        // Pre-load rates data for rates page
        if (page === 'rates' && rawContent) {
            console.log(`💰 Attempting to load rates data...`);
            console.log(`💰 Model object:`, model ? 'exists' : 'undefined');
            console.log(`💰 Model ID:`, model ? model.id : 'N/A');
            try {
                if (!model) {
                    throw new Error('Model object is undefined');
                }
                console.log(`💰 Loading rates for model ID ${model.id}...`);
                const [allRates] = await db.execute(`
                    SELECT rate_type, service_name, duration, price, sort_order
                    FROM model_rates 
                    WHERE model_id = ? AND is_visible = 1
                    ORDER BY rate_type, sort_order ASC, id ASC
                `, [model.id]);
                
                console.log(`💰 Raw rates data:`, allRates);
                
                // Group rates by type
                const groupedRates = {
                    incall: allRates.filter(r => r.rate_type === 'incall'),
                    outcall: allRates.filter(r => r.rate_type === 'outcall'),
                    extended: allRates.filter(r => r.rate_type === 'extended')
                };
                
                console.log(`💰 Grouped rates:`, {
                    incall: groupedRates.incall.length,
                    outcall: groupedRates.outcall.length,
                    extended: groupedRates.extended.length
                });
                
                // Add rates to content
                rawContent.rates = groupedRates;
                console.log(`💰 Rates added to content successfully`);
                console.log(`💰 rawContent.rates verified:`, !!rawContent.rates);
                console.log(`💰 rawContent.rates.incall length:`, rawContent.rates?.incall?.length || 0);
            } catch (error) {
                console.error('💰 Error loading rates data:', error);
                rawContent.rates = { incall: [], outcall: [], extended: [] };
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

        // Transform content keys to camelCase for template compatibility (after all data loading)
        const pageContent = {};
        Object.keys(rawContent).forEach(key => {
            // Convert snake_case to camelCase
            const camelKey = key.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
            pageContent[camelKey] = rawContent[key];
        });
        
        // Debug rates transformation after all data loading
        if (page === 'rates') {
            console.log('🔧 FINAL rawContent keys:', Object.keys(rawContent));
            console.log('🔧 FINAL pageContent keys:', Object.keys(pageContent));
            console.log('🔧 FINAL rawContent.rates exists:', !!rawContent.rates);
            console.log('🔧 FINAL pageContent.rates exists:', !!pageContent.rates);
            if (pageContent.rates) {
                console.log('🔧 FINAL pageContent.rates.incall length:', pageContent.rates.incall?.length || 0);
            }
        }

        // Load actual image URLs if IDs are provided (after camelCase transformation)
        if (pageContent.portraitImageId) {
            try {
                // First, let's check if the image exists at all
                const [allImages] = await db.execute(`
                    SELECT id, filename, model_id, is_active FROM gallery_images WHERE id = ?
                `, [pageContent.portraitImageId]);
                
                console.log(`🔍 Found ${allImages.length} images with ID ${pageContent.portraitImageId}:`, allImages);
                
                const [portraitImage] = await db.execute(`
                    SELECT filename FROM gallery_images 
                    WHERE id = ? AND model_id = ? AND is_active = 1
                    LIMIT 1
                `, [pageContent.portraitImageId, model.id]);
                
                console.log(`🔍 Portrait query result: ${portraitImage.length} images found`);
                if (portraitImage.length > 0) {
                    pageContent.portraitImageUrl = `/uploads/${model.slug}/public/gallery/${portraitImage[0].filename}`;
                    console.log(`🖼️ Loaded portrait image: ${pageContent.portraitImageUrl}`);
                } else {
                    console.log(`❌ No portrait image found for ID ${pageContent.portraitImageId} with model_id ${model.id} and is_active=1`);
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
                    pageContent.heroBackgroundImageUrl = `/uploads/${model.slug}/public/gallery/${heroImage[0].filename}`;
                    console.log(`🖼️ Loaded hero background image: ${pageContent.heroBackgroundImageUrl}`);
                }
            } catch (error) {
                console.error('Error loading hero background image:', error);
            }
        }

        // Set portrait image URL if we have a portrait image ID (legacy support)
        if (pageContent.portrait_image_id) {
            pageContent.portraitImageUrl = `/uploads/${slug}/public/gallery/${pageContent.portrait_image_id}`;
            console.log('🖼️  Set portrait image URL:', pageContent.portraitImageUrl);
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
            // Pass etiquette content directly for etiquette page
            ...(page === 'etiquette' ? pageContent : {}),
            
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
                        
                        if (section.images && section.images.length > 0) {
                            if (section.layout_type === 'carousel') {
                                // Get carousel-specific settings
                                const visibleItems = parseInt(settings.carouselItemsVisible || '1');
                                const itemWidth = 300;
                                const itemGap = 16;
                                
                                // Calculate container width based on visible items
                                const containerWidth = (itemWidth * visibleItems) + (itemGap * (visibleItems - 1));
                                
                                // Calculate total track width (all items + gaps)
                                const totalTrackWidth = (itemWidth * section.images.length) + (itemGap * (section.images.length - 1));
                                
                                // Generate carousel HTML with navigation
                                imagesHtml = `
                                    <div class="carousel-wrapper" style="width: ${containerWidth}px; margin: 0 auto; overflow: hidden; position: relative;">
                                        <div class="carousel-track" id="carousel-${sectionIndex}" style="width: ${totalTrackWidth}px; transform: translateX(0px);">
                                            ${section.images.map((img, index) => {
                                                const imageUrl = `/uploads/${modelSlug}/public/gallery/${img.filename}`;
                                                const isLastItem = index === section.images.length - 1;
                                                return `
                                                    <div class="carousel-item" style="flex: 0 0 ${itemWidth}px; ${!isLastItem ? `margin-right: ${itemGap}px;` : ''}">
                                                        <div class="gallery-item" data-aos="fade-up" data-aos-delay="${Math.random() * 300}">
                                                            <img src="${imageUrl}" 
                                                                 alt="${img.alt_text || img.caption || 'Gallery Image'}"
                                                                 data-full="${imageUrl}"
                                                                 class="gallery-image cursor-pointer hover:scale-105 transition-transform duration-300"
                                                                 onclick="openLightbox('${imageUrl}', '${img.alt_text || img.caption || 'Gallery Image'}')"
                                                                 loading="lazy">
                                                            ${img.caption ? `<div class="image-caption">${img.caption}</div>` : ''}
                                                        </div>
                                                    </div>
                                                `;
                                            }).join('')}
                                        </div>
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
                                
                                // Add dots if enabled
                                if (showDots) {
                                    navigationParts.push(`
                                        <div class="carousel-dots">
                                            ${section.images.map((_, imgIndex) => `
                                                <div class="carousel-dot ${imgIndex === 0 ? 'active' : ''}" 
                                                     onclick="goToCarouselSlide(${sectionIndex}, ${imgIndex})" 
                                                     data-slide="${imgIndex}"></div>
                                            `).join('')}
                                        </div>
                                    `);
                                }
                                
                                navigationHtml = navigationParts.join('');
                            } else {
                                // Generate regular grid/masonry HTML
                                imagesHtml = section.images.map(img => {
                                    const imageUrl = `/uploads/${modelSlug}/public/gallery/${img.filename}`;
                                    return `
                                        <div class="gallery-item" data-aos="fade-up" data-aos-delay="${Math.random() * 300}">
                                            <img src="${imageUrl}" 
                                                 alt="${img.alt_text || img.caption || 'Gallery Image'}"
                                                 data-full="${imageUrl}"
                                                 class="gallery-image cursor-pointer hover:scale-105 transition-transform duration-300"
                                                 onclick="openLightbox('${imageUrl}', '${img.alt_text || img.caption || 'Gallery Image'}')"
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
                        
                        return `
                            <div class="gallery-section mb-12">
                                <div class="text-center mb-8">
                                    <h2 class="text-3xl font-bold text-blue-600 mb-2">${section.title}</h2>
                                    ${section.description ? `<p class="text-gray-600 max-w-2xl mx-auto">${section.description}</p>` : ''}
                                    <div class="text-sm text-gray-500 mt-2">${section.images ? section.images.length : 0} images • ${section.layout_type} layout</div>
                                </div>
                                <div class="${layoutClass}"${autoplayAttr}>
                                    ${imagesHtml}
                                    ${navigationHtml}
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
        
        // Debug rates data for rates page
        if (page === 'rates') {
            console.log('🔧 TEMPLATE DEBUG - Rates page data:');
            console.log('🔧 pageContent.rates:', pageContent.rates ? 'exists' : 'missing');
            console.log('🔧 templateData.rates:', templateData.rates ? 'exists' : 'missing');
            if (templateData.rates) {
                console.log('🔧 templateData.rates.incall length:', templateData.rates.incall?.length || 0);
                console.log('🔧 templateData.rates.outcall length:', templateData.rates.outcall?.length || 0);
            }
        }
        

        
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