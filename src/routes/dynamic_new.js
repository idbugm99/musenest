const express = require('express');
const db = require('../../config/database');
const templateEngine = require('../utils/templateEngine');
const { optionalAuth } = require('../../middleware/auth');

const router = express.Router();

// Helper function to get model by slug
async function getModelBySlug(slug) {
    const models = await db.query(`
        SELECT m.*, ss.site_name, ss.model_name, ss.tagline, ss.city,
               ss.contact_email, ss.contact_phone, ss.header_image,
               ss.watermark_text, ss.watermark_image
        FROM models m
        LEFT JOIN site_settings ss ON m.id = ss.model_id
        WHERE m.slug = ? AND m.status IN ('active', 'trial')
    `, [slug]);

    return models.length > 0 ? models[0] : null;
}

// Helper function to get model's active theme set
async function getModelThemeSet(modelId) {
    const themeSets = await db.query(`
        SELECT ts.name, ts.display_name, ts.description, ts.category,
               ts.default_color_scheme, ts.features,
               mts.custom_color_scheme
        FROM theme_sets ts
        JOIN model_theme_sets mts ON ts.id = mts.theme_set_id
        WHERE mts.model_id = ? AND mts.is_active = true AND ts.is_active = true
        ORDER BY mts.applied_at DESC
        LIMIT 1
    `, [modelId]);

    if (themeSets.length === 0) {
        // Fallback to basic theme set
        const basicTheme = await db.query(`
            SELECT name, display_name, description, category, default_color_scheme, features
            FROM theme_sets 
            WHERE name = 'basic' AND is_active = true
            LIMIT 1
        `);
        return basicTheme.length > 0 ? basicTheme[0] : null;
    }

    return themeSets[0];
}

// Helper function to get model's enabled pages
async function getModelEnabledPages(modelId) {
    const pages = await db.query(`
        SELECT pt.name, pt.display_name, pt.category,
               mep.custom_slug, mep.navigation_label, mep.sort_order
        FROM model_enabled_pages mep
        JOIN page_types pt ON mep.page_type_id = pt.id
        WHERE mep.model_id = ? AND mep.is_enabled = true AND pt.is_active = true
        ORDER BY mep.sort_order, pt.display_name
    `, [modelId]);

    return pages;
}

// Helper function to get navigation items
async function getNavigationItems(modelId, baseUrl) {
    const pages = await getModelEnabledPages(modelId);
    
    return pages.map(page => ({
        name: page.navigation_label || page.display_name,
        path: page.custom_slug || page.name,
        url: `${baseUrl}/${page.custom_slug || page.name}`,
        category: page.category
    }));
}

// Helper function to get theme colors (merged default + custom)
function getThemeColors(themeSet) {
    let defaultColors = themeSet.default_color_scheme;
    if (typeof defaultColors === 'string') {
        defaultColors = JSON.parse(defaultColors);
    }

    let customColors = themeSet.custom_color_scheme;
    if (customColors && typeof customColors === 'string') {
        customColors = JSON.parse(customColors);
    }

    return { ...defaultColors, ...(customColors || {}) };
}

// Helper function to get content data for a page
async function getPageContent(modelId, pageName) {
    const content = {};

    // Get general content for all pages
    const generalContent = await db.query(`
        SELECT content_key, content_value, content_type
        FROM content_templates
        WHERE model_id = ? AND page_type_id IS NULL
    `, [modelId]);

    generalContent.forEach(item => {
        content[item.content_key] = item.content_value;
    });

    // Get page-specific content
    const pageTypeResult = await db.query(`
        SELECT id FROM page_types WHERE name = ?
    `, [pageName]);

    if (pageTypeResult.length > 0) {
        const pageTypeId = pageTypeResult[0].id;
        const pageContent = await db.query(`
            SELECT content_key, content_value, content_type
            FROM content_templates
            WHERE model_id = ? AND page_type_id = ?
        `, [modelId, pageTypeId]);

        pageContent.forEach(item => {
            content[item.content_key] = item.content_value;
        });
    }

    return content;
}

// Helper function to get data tables needed for a page
async function getPageData(modelId, pageName) {
    const data = {};

    // Get required data tables for this page type
    const pageTypeResult = await db.query(`
        SELECT required_data_tables FROM page_types WHERE name = ?
    `, [pageName]);

    if (pageTypeResult.length === 0) {
        return data;
    }

    let requiredTables = pageTypeResult[0].required_data_tables;
    if (typeof requiredTables === 'string') {
        requiredTables = JSON.parse(requiredTables);
    }

    // Load data from required tables
    for (const tableName of requiredTables) {
        switch (tableName) {
            case 'gallery_images':
                data.gallery_images = await db.query(`
                    SELECT filename, alt_text, caption, sort_order
                    FROM gallery_images
                    WHERE model_id = ? AND is_active = true
                    ORDER BY sort_order, created_at DESC
                `, [modelId]);
                break;

            case 'faq_items':
                data.faq_items = await db.query(`
                    SELECT question, answer, category_id, sort_order
                    FROM faq_items
                    WHERE model_id = ? AND is_visible = true
                    ORDER BY sort_order, created_at
                `, [modelId]);
                break;

            case 'testimonials':
                data.testimonials = await db.query(`
                    SELECT client_name, review_text, rating, created_at
                    FROM testimonials
                    WHERE model_id = ? AND is_approved = true
                    ORDER BY created_at DESC
                `, [modelId]);
                break;

            case 'calendar_events':
                data.calendar_events = await db.query(`
                    SELECT title, description, start_date, end_date, start_time, end_time, 
                           all_day, location, status, color
                    FROM calendar_events
                    WHERE model_id = ? AND is_visible = true
                    AND start_date >= CURDATE()
                    ORDER BY start_date, start_time
                `, [modelId]);
                break;

            case 'blog_posts':
                data.blog_posts = await db.query(`
                    SELECT title, slug, excerpt, content, published_at, category
                    FROM blog_posts
                    WHERE model_id = ? AND status = 'published'
                    ORDER BY published_at DESC
                    LIMIT 10
                `, [modelId]);
                break;
        }
    }

    return data;
}

// Main route handler for model pages
router.get('/:slug/:page?', optionalAuth, async (req, res) => {
    try {
        const { slug, page = 'home' } = req.params;

        // Get model data
        const model = await getModelBySlug(slug);
        if (!model) {
            return res.status(404).send('Model not found');
        }

        // Get theme set
        const themeSet = await getModelThemeSet(model.id);
        if (!themeSet) {
            return res.status(500).send('No theme set configured');
        }

        // Check if the requested page is enabled for this model
        const enabledPages = await getModelEnabledPages(model.id);
        const requestedPage = enabledPages.find(p => 
            (p.custom_slug || p.name) === page
        );

        if (!requestedPage) {
            return res.status(404).send('Page not found');
        }

        // Get navigation items
        const navItems = await getNavigationItems(model.id, `/${slug}`);

        // Get theme colors
        const colors = getThemeColors(themeSet);

        // Get page content
        const pageContent = await getPageContent(model.id, requestedPage.name);

        // Get page data
        const pageData = await getPageData(model.id, requestedPage.name);

        // Prepare template data
        const templateData = {
            model,
            theme: {
                name: themeSet.name,
                display_name: themeSet.display_name,
                colors
            },
            navigation: {
                nav_items: navItems,
                base_url: `/${slug}`,
                user: req.user || null
            },
            site_settings: {
                site_name: model.site_name || `${model.model_name} Portfolio`,
                model_name: model.model_name || model.name,
                tagline: model.tagline,
                city: model.city,
                contact_email: model.contact_email,
                contact_phone: model.contact_phone,
                header_image: model.header_image,
                watermark_text: model.watermark_text,
                watermark_image: model.watermark_image,
                meta_description: pageContent.meta_description || `${model.model_name} - Professional services`
            },
            // Page-specific content
            ...pageContent,
            // Page data
            ...pageData
        };

        // Determine template name (map home -> index)
        const templateName = requestedPage.name === 'home' ? 'index' : requestedPage.name;

        // Render template with theme
        const html = await templateEngine.renderWithTheme(themeSet.name, templateName, templateData);
        res.send(html);

    } catch (error) {
        console.error('Dynamic route error:', error);
        
        // Try fallback to basic theme
        try {
            const fallbackTemplateName = req.params.page === 'home' || !req.params.page ? 'index' : req.params.page;
            const fallbackData = {
                model: { slug: req.params.slug, name: 'Portfolio' },
                theme: { name: 'basic', colors: {} },
                navigation: { nav_items: [], base_url: `/${req.params.slug}` },
                site_settings: { site_name: 'Portfolio', model_name: 'Portfolio' }
            };
            
            const html = await templateEngine.renderWithTheme('basic', fallbackTemplateName, fallbackData);
            res.send(html);
        } catch (fallbackError) {
            console.error('Fallback template error:', fallbackError);
            res.status(500).send('Template rendering failed');
        }
    }
});

// Route for homepage (redirects to model page)
router.get('/:slug', optionalAuth, async (req, res) => {
    res.redirect(`/${req.params.slug}/home`);
});

module.exports = router;