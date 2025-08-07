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

// Helper function to get model content for a specific page type
async function getModelContent(modelId, pageType) {
    try {
        const [content] = await db.execute(`
            SELECT ct.content_key, ct.content_value, ct.content_type
            FROM content_templates ct
            JOIN page_types pt ON ct.page_type_id = pt.id
            WHERE ct.model_id = ? AND pt.name = ?
        `, [modelId, pageType]);

        // Convert to key-value object
        const contentObj = {};
        content.forEach(row => {
            if (row.content_type === 'json') {
                try {
                    contentObj[row.content_key] = JSON.parse(row.content_value);
                } catch (e) {
                    contentObj[row.content_key] = row.content_value;
                }
            } else {
                contentObj[row.content_key] = row.content_value;
            }
        });

        return contentObj;
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
        
        console.log(`🔍 Accessing model site: ${slug}/${page}`);
        
        // Get model data
        const model = await getModelBySlug(slug);
        if (!model) {
            console.log(`❌ Model not found: ${slug}`);
            return res.status(404).send('Model not found');
        }
        
        console.log(`✅ Found model: ${model.name} with theme: ${model.theme_name || 'basic'}`);
        
        // Get content for this page
        const rawContent = await getModelContent(model.id, page);
        console.log(`📄 Content loaded for ${page}:`, Object.keys(rawContent));
        
        // Transform content keys to camelCase for template compatibility
        const pageContent = {};
        Object.keys(rawContent).forEach(key => {
            // Convert snake_case to camelCase
            const camelKey = key.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
            pageContent[camelKey] = rawContent[key];
        });
        console.log(`🔄 Transformed keys:`, Object.keys(pageContent));
        
        // Map theme set names to our Handlebars theme names
        const themeMapping = {
            'basic': 'basic',
            'glamour': 'glamour', 
            'luxury': 'luxury',
            'modern': 'modern',
            'dark': 'dark'
        };
        
        const themeName = themeMapping[model.theme_name] || 'basic';
        console.log(`🎨 Using theme: ${themeName}`);
        
        // Parse theme colors from database
        let themeColors = { primary: '#3B82F6', secondary: '#6B7280', text: '#1F2937', background: '#FFFFFF', accent: '#10B981' };
        if (model.default_color_scheme) {
            try {
                // Check if it's already an object or needs parsing
                themeColors = typeof model.default_color_scheme === 'string' 
                    ? JSON.parse(model.default_color_scheme) 
                    : model.default_color_scheme;
            } catch (error) {
                console.error('Error parsing theme colors:', error);
            }
        }
        console.log(`🎨 Theme colors:`, themeColors);

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
            // Theme colors for CSS variables (from database)
            theme: {
                name: themeName,
                colors: themeColors
            },
            // Navigation structure
            navigation: [
                { name: 'Home', url: `/${slug}`, active: page === 'home' },
                { name: 'About', url: `/${slug}/about`, active: page === 'about' },
                { name: 'Gallery', url: `/${slug}/gallery`, active: page === 'gallery' },
                { name: 'Contact', url: `/${slug}/contact`, active: page === 'contact' },
                { name: 'Rates', url: `/${slug}/rates`, active: page === 'rates' }
            ],
            // Current page info
            currentPage: page,
            siteUrl: `/${slug}`,
            year: new Date().getFullYear()
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
                truncate: (str, length = 100) => str && str.length > length ? str.substring(0, length) + '...' : str
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