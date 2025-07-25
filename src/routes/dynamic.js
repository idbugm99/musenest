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

// Helper function to get model's active theme
async function getModelTheme(modelId) {
    const themes = await db.query(`
        SELECT t.name, t.display_name, t.description
        FROM themes t
        JOIN model_themes mt ON t.id = mt.theme_id
        WHERE mt.model_id = ? AND mt.is_active = true AND t.is_active = true
        LIMIT 1
    `, [modelId]);

    return themes.length > 0 ? themes[0].name : 'basic';
}

// Helper function to get theme colors
async function getThemeColors(themeName) {
    const colors = await db.query(`
        SELECT tc.color_type, tc.color_value
        FROM theme_colors tc
        JOIN themes t ON tc.theme_id = t.id
        WHERE t.name = ?
    `, [themeName]);

    return colors.reduce((acc, color) => {
        acc[color.color_type] = color.color_value;
        return acc;
    }, {});
}

// Helper function to get menu items (future feature)
async function getMenuItems(modelId) {
    const menuItems = await db.query(`
        SELECT label, slug, url_path, is_external, sort_order
        FROM menu_items
        WHERE model_id = ? AND is_visible = true
        ORDER BY sort_order ASC
    `, [modelId]);

    return menuItems;
}

// Helper function to build template context
async function buildTemplateContext(model, user = null) {
    const theme = await getModelTheme(model.id);
    const colors = await getThemeColors(theme);
    const menuItems = await getMenuItems(model.id);

    return {
        model: model,
        site_settings: {
            site_name: model.site_name || model.name,
            model_name: model.model_name || model.name,
            tagline: model.tagline,
            city: model.city,
            contact_email: model.contact_email,
            contact_phone: model.contact_phone,
            header_image: model.header_image,
            watermark_text: model.watermark_text,
            watermark_image: model.watermark_image
        },
        theme: {
            name: theme,
            colors: colors
        },
        menu_items: menuItems,
        user: user,
        currentYear: new Date().getFullYear()
    };
}

// Model homepage route: /<slug>/
router.get('/:slug/', optionalAuth, async (req, res) => {
    try {
        const { slug } = req.params;

        // Get model
        const model = await getModelBySlug(slug);
        if (!model) {
            return res.status(404).json({
                error: 'Model not found',
                message: 'The requested model does not exist or is not active'
            });
        }

        // Get homepage content
        const homeContent = await db.query(`
            SELECT * FROM pages p
            JOIN page_types pt ON p.page_type_id = pt.id
            WHERE p.model_id = ? AND pt.slug = 'home' AND p.is_visible = true
            LIMIT 1
        `, [model.id]);

        // Get page sections for home page
        let pageSections = [];
        if (homeContent.length > 0) {
            pageSections = await db.query(`
                SELECT * FROM page_sections
                WHERE page_id = ? AND is_visible = true
                ORDER BY sort_order ASC
            `, [homeContent[0].id]);
        }

        // Get testimonials
        const testimonials = await db.query(`
            SELECT client_name, client_initial, testimonial_text, rating, is_featured
            FROM testimonials
            WHERE model_id = ? AND is_active = true AND is_featured = true
            ORDER BY created_at DESC
            LIMIT 6
        `, [model.id]);

        // Get gallery sections with images
        const gallerySections = await db.query(`
            SELECT * FROM gallery_sections
            WHERE model_id = ? AND is_visible = true
            ORDER BY sort_order ASC
            LIMIT 3
        `, [model.id]);

        // Get images for each gallery section
        for (let section of gallerySections) {
            const images = await db.query(`
                SELECT filename, caption, alt_text, is_featured, sort_order
                FROM gallery_images
                WHERE model_id = ? AND section_id = ? AND is_active = true
                ORDER BY sort_order ASC, created_at DESC
                LIMIT 12
            `, [model.id, section.id]);

            section.images = images;
        }

        // Build template context
        const context = await buildTemplateContext(model, req.user);
        context.current_page = 'home';
        context.home_content = homeContent.length > 0 ? homeContent[0] : {};
        context.page_sections = pageSections;
        context.testimonials = testimonials;
        context.gallery_sections = gallerySections;
        context.gallery_images = gallerySections.length > 0 ? gallerySections[0].images : [];

        // Get theme and render with navigation
        const theme = context.theme.name;
        const html = await templateEngine.renderPageWithNavigation(theme, 'index', context);

        res.send(html);

    } catch (error) {
        console.error('Model homepage error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Unable to load model page'
        });
    }
});

// Model page route: /<slug>/<page>
router.get('/:slug/:page', optionalAuth, async (req, res) => {
    try {
        const { slug, page } = req.params;

        // Get model
        const model = await getModelBySlug(slug);
        if (!model) {
            return res.status(404).json({
                error: 'Model not found',
                message: 'The requested model does not exist or is not active'
            });
        }

        // Build base template context
        const context = await buildTemplateContext(model, req.user);

        // Handle different page types
        let templateName = page;
        let pageContent = {};

        switch (page) {
            case 'faq':
                // Get FAQ items
                const faqItems = await db.query(`
                    SELECT question, answer, sort_order, is_visible
                    FROM faq_items
                    WHERE model_id = ? AND is_visible = true
                    ORDER BY sort_order ASC, created_at ASC
                `, [model.id]);

                pageContent.faq_items = faqItems;
                break;

            case 'gallery':
                // Get all gallery sections with images
                const sections = await db.query(`
                    SELECT * FROM gallery_sections
                    WHERE model_id = ? AND is_visible = true
                    ORDER BY sort_order ASC
                `, [model.id]);

                for (let section of sections) {
                    const images = await db.query(`
                        SELECT filename, caption, alt_text, is_featured, sort_order
                        FROM gallery_images
                        WHERE model_id = ? AND section_id = ? AND is_active = true
                        ORDER BY sort_order ASC, created_at DESC
                    `, [model.id, section.id]);

                    section.images = images;
                }

                pageContent.gallery_sections = sections;
                break;

            case 'about':
                // Get about page content from page_sections
                const aboutPage = await db.query(`
                    SELECT p.* FROM pages p
                    JOIN page_types pt ON p.page_type_id = pt.id
                    WHERE p.model_id = ? AND pt.slug = 'about' AND p.is_visible = true
                    LIMIT 1
                `, [model.id]);

                if (aboutPage.length > 0) {
                    const aboutSections = await db.query(`
                        SELECT * FROM page_sections
                        WHERE page_id = ? AND is_visible = true
                        ORDER BY sort_order ASC
                    `, [aboutPage[0].id]);

                    pageContent.about_content = aboutPage[0];
                    pageContent.about_sections = aboutSections;
                }
                break;

            case 'contact':
                // Get contact page content
                const contactPage = await db.query(`
                    SELECT p.* FROM pages p
                    JOIN page_types pt ON p.page_type_id = pt.id
                    WHERE p.model_id = ? AND pt.slug = 'contact' AND p.is_visible = true
                    LIMIT 1
                `, [model.id]);

                if (contactPage.length > 0) {
                    const contactSections = await db.query(`
                        SELECT * FROM page_sections
                        WHERE page_id = ? AND is_visible = true
                        ORDER BY sort_order ASC
                    `, [contactPage[0].id]);

                    pageContent.contact_content = contactPage[0];
                    pageContent.contact_sections = contactSections;
                }
                break;

            case 'rates':
                // Get services and rates
                const serviceCategories = await db.query(`
                    SELECT * FROM service_categories
                    WHERE model_id = ? AND is_visible = true
                    ORDER BY sort_order ASC
                `, [model.id]);

                for (let category of serviceCategories) {
                    const services = await db.query(`
                        SELECT * FROM services
                        WHERE model_id = ? AND category_id = ? AND is_active = true
                        ORDER BY sort_order ASC
                    `, [model.id, category.id]);

                    category.services = services;
                }

                pageContent.service_categories = serviceCategories;
                break;

            default:
                // Try to find a matching page type
                const customPage = await db.query(`
                    SELECT p.*, pt.slug as page_type FROM pages p
                    JOIN page_types pt ON p.page_type_id = pt.id
                    WHERE p.model_id = ? AND pt.slug = ? AND p.is_visible = true
                    LIMIT 1
                `, [model.id, page]);

                if (customPage.length === 0) {
                    return res.status(404).json({
                        error: 'Page not found',
                        message: 'The requested page does not exist'
                    });
                }

                const customSections = await db.query(`
                    SELECT * FROM page_sections
                    WHERE page_id = ? AND is_visible = true
                    ORDER BY sort_order ASC
                `, [customPage[0].id]);

                pageContent.page_content = customPage[0];
                pageContent.page_sections = customSections;
                templateName = customPage[0].page_type;
                break;
        }

        // Add page content to context
        Object.assign(context, pageContent);
        context.current_page = page;

        // Get theme and render with navigation
        const theme = context.theme.name;
        const html = await templateEngine.renderPageWithNavigation(theme, templateName, context);

        res.send(html);

    } catch (error) {
        console.error('Model page error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Unable to load page'
        });
    }
});

module.exports = router;