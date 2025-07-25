const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../../config/database');
const { authenticateToken } = require('../../middleware/auth');

const router = express.Router();

// Middleware to ensure user is authenticated for all admin routes
router.use(authenticateToken);

// Helper function to get user's model ID
async function getUserModelId(userId) {
    try {
        const models = await query(`
            SELECT m.id 
            FROM models m
            JOIN model_users mu ON m.id = mu.model_id
            WHERE mu.user_id = ? AND mu.is_active = true
            ORDER BY mu.role = 'owner' DESC
            LIMIT 1
        `, [userId]);
        
        console.log('getUserModelId - userId:', userId, 'models:', models);
        return models.length > 0 ? models[0].id : null;
    } catch (error) {
        console.error('getUserModelId error:', error);
        return null;
    }
}

// Get page types
router.get('/pages/types', async (req, res) => {
    console.log('Page types endpoint called for user:', req.user.id, req.user.email);
    
    try {
        const modelId = await getUserModelId(req.user.id);
        console.log('Retrieved modelId for page types:', modelId);
        
        if (!modelId) {
            console.log('No model found, returning empty page types');
            return res.json([]);
        }

        // Get page types with section counts
        const pageTypes = await query(`
            SELECT 
                pt.id,
                pt.slug,
                pt.name,
                COUNT(ps.id) as section_count
            FROM page_types pt
            LEFT JOIN pages p ON pt.id = p.page_type_id AND p.model_id = ?
            LEFT JOIN page_sections ps ON p.id = ps.page_id
            GROUP BY pt.id, pt.slug, pt.name
            ORDER BY pt.name
        `, [modelId]);

        console.log('Page types found:', pageTypes.length);
        res.json(pageTypes);

    } catch (error) {
        console.error('Error fetching page types:', error);
        res.status(500).json({
            error: 'Failed to fetch page types',
            message: 'Unable to load page types'
        });
    }
});

// Get page sections
router.get('/pages/sections', async (req, res) => {
    console.log('Page sections endpoint called for user:', req.user.id, req.user.email);
    
    try {
        const modelId = await getUserModelId(req.user.id);
        console.log('Retrieved modelId for page sections:', modelId);
        
        if (!modelId) {
            console.log('No model found, returning empty page sections');
            return res.json([]);
        }

        // Get page sections with page type information
        const sections = await query(`
            SELECT 
                ps.id,
                ps.page_id,
                ps.section_type,
                ps.section_key,
                ps.title,
                ps.content,
                ps.sort_order,
                ps.is_visible,
                pt.name as page_type_name,
                pt.slug as page_type_slug,
                p.title as page_title
            FROM page_sections ps
            JOIN pages p ON ps.page_id = p.id
            JOIN page_types pt ON p.page_type_id = pt.id
            WHERE p.model_id = ?
            ORDER BY pt.name, ps.sort_order, ps.title
        `, [modelId]);

        console.log('Page sections found:', sections.length);
        res.json(sections);

    } catch (error) {
        console.error('Error fetching page sections:', error);
        res.status(500).json({
            error: 'Failed to fetch page sections',
            message: 'Unable to load page sections'
        });
    }
});

// Get specific page section
router.get('/pages/sections/:sectionId', async (req, res) => {
    try {
        const modelId = await getUserModelId(req.user.id);
        if (!modelId) {
            return res.status(404).json({
                error: 'Model not found',
                message: 'No model associated with this user'
            });
        }

        const { sectionId } = req.params;

        const sections = await query(`
            SELECT 
                ps.id,
                ps.page_id,
                ps.section_type,
                ps.section_key,
                ps.title,
                ps.content,
                ps.sort_order,
                ps.is_visible,
                pt.name as page_type_name,
                pt.slug as page_type_slug,
                p.title as page_title
            FROM page_sections ps
            JOIN pages p ON ps.page_id = p.id
            JOIN page_types pt ON p.page_type_id = pt.id
            WHERE ps.id = ? AND p.model_id = ?
        `, [sectionId, modelId]);

        if (sections.length === 0) {
            return res.status(404).json({
                error: 'Section not found',
                message: 'Page section not found or access denied'
            });
        }

        res.json(sections[0]);

    } catch (error) {
        console.error('Error fetching page section:', error);
        res.status(500).json({
            error: 'Failed to fetch page section',
            message: 'Unable to load page section'
        });
    }
});

// Update page section
router.put('/pages/sections/:sectionId', [
    body('title')
        .trim()
        .isLength({ min: 1, max: 255 })
        .withMessage('Title must be between 1 and 255 characters'),
    body('content')
        .custom((value) => {
            try {
                JSON.parse(value);
                return true;
            } catch (e) {
                throw new Error('Content must be valid JSON');
            }
        }),
    body('sort_order')
        .isInt({ min: 0, max: 100 })
        .withMessage('Sort order must be between 0 and 100'),
    body('is_visible')
        .isBoolean()
        .withMessage('Visibility must be true or false')
], async (req, res) => {
    try {
        // Check validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                error: 'Validation failed',
                message: 'Please check your input',
                details: errors.array()
            });
        }

        const modelId = await getUserModelId(req.user.id);
        if (!modelId) {
            return res.status(404).json({
                error: 'Model not found',
                message: 'No model associated with this user'
            });
        }

        const { sectionId } = req.params;
        const { title, content, sort_order, is_visible } = req.body;

        // Verify section exists and belongs to user
        const existingSections = await query(`
            SELECT ps.id
            FROM page_sections ps
            JOIN pages p ON ps.page_id = p.id
            WHERE ps.id = ? AND p.model_id = ?
        `, [sectionId, modelId]);

        if (existingSections.length === 0) {
            return res.status(404).json({
                error: 'Section not found',
                message: 'Page section not found or access denied'
            });
        }

        // Update page section
        await query(`
            UPDATE page_sections 
            SET title = ?, content = ?, sort_order = ?, is_visible = ?
            WHERE id = ?
        `, [title, content, sort_order, is_visible, sectionId]);

        res.json({
            message: 'Page section updated successfully',
            section: {
                id: sectionId,
                title,
                content,
                sort_order,
                is_visible
            }
        });

    } catch (error) {
        console.error('Error updating page section:', error);
        res.status(500).json({
            error: 'Failed to update page section',
            message: 'Unable to update page section'
        });
    }
});

// Delete page section
router.delete('/pages/sections/:sectionId', async (req, res) => {
    try {
        const modelId = await getUserModelId(req.user.id);
        if (!modelId) {
            return res.status(404).json({
                error: 'Model not found',
                message: 'No model associated with this user'
            });
        }

        const { sectionId } = req.params;

        // Verify section exists and belongs to user
        const existingSections = await query(`
            SELECT ps.id, ps.title
            FROM page_sections ps
            JOIN pages p ON ps.page_id = p.id
            WHERE ps.id = ? AND p.model_id = ?
        `, [sectionId, modelId]);

        if (existingSections.length === 0) {
            return res.status(404).json({
                error: 'Section not found',
                message: 'Page section not found or access denied'
            });
        }

        // Delete page section
        await query('DELETE FROM page_sections WHERE id = ?', [sectionId]);

        res.json({
            message: 'Page section deleted successfully',
            deleted_section: existingSections[0]
        });

    } catch (error) {
        console.error('Error deleting page section:', error);
        res.status(500).json({
            error: 'Failed to delete page section',
            message: 'Unable to delete page section'
        });
    }
});

// Create new page section
router.post('/pages/sections', [
    body('page_type_slug')
        .trim()
        .isLength({ min: 1 })
        .withMessage('Page type is required'),
    body('section_key')
        .trim()
        .isLength({ min: 1, max: 100 })
        .matches(/^[a-z0-9_]+$/)
        .withMessage('Section key must contain only lowercase letters, numbers, and underscores'),
    body('title')
        .trim()
        .isLength({ min: 1, max: 255 })
        .withMessage('Title must be between 1 and 255 characters'),
    body('content')
        .custom((value) => {
            try {
                JSON.parse(value);
                return true;
            } catch (e) {
                throw new Error('Content must be valid JSON');
            }
        }),
    body('sort_order')
        .isInt({ min: 0, max: 100 })
        .withMessage('Sort order must be between 0 and 100'),
    body('is_visible')
        .isBoolean()
        .withMessage('Visibility must be true or false')
], async (req, res) => {
    try {
        // Check validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                error: 'Validation failed',
                message: 'Please check your input',
                details: errors.array()
            });
        }

        const modelId = await getUserModelId(req.user.id);
        if (!modelId) {
            return res.status(404).json({
                error: 'Model not found',
                message: 'No model associated with this user'
            });
        }

        const { page_type_slug, section_key, title, content, sort_order, is_visible } = req.body;

        // Get or create page for this page type
        const pageTypes = await query('SELECT id FROM page_types WHERE slug = ?', [page_type_slug]);
        if (pageTypes.length === 0) {
            return res.status(400).json({
                error: 'Invalid page type',
                message: 'Page type not found'
            });
        }

        const pageTypeId = pageTypes[0].id;

        // Check if page exists for this model and page type
        let pages = await query(`
            SELECT id FROM pages 
            WHERE model_id = ? AND page_type_id = ?
        `, [modelId, pageTypeId]);

        let pageId;
        if (pages.length === 0) {
            // Create new page
            const pageResult = await query(`
                INSERT INTO pages (model_id, page_type_id, title, is_visible, created_at, updated_at)
                VALUES (?, ?, ?, true, NOW(), NOW())
            `, [modelId, pageTypeId, page_type_slug.charAt(0).toUpperCase() + page_type_slug.slice(1)]);
            pageId = pageResult.insertId;
        } else {
            pageId = pages[0].id;
        }

        // Check if section key already exists for this page
        const existingSections = await query(`
            SELECT id FROM page_sections 
            WHERE page_id = ? AND section_key = ?
        `, [pageId, section_key]);

        if (existingSections.length > 0) {
            return res.status(409).json({
                error: 'Section key exists',
                message: 'A section with this key already exists for this page'
            });
        }

        // Create new page section
        const result = await query(`
            INSERT INTO page_sections (page_id, section_type, section_key, title, content, sort_order, is_visible)
            VALUES (?, 'text', ?, ?, ?, ?, ?)
        `, [pageId, section_key, title, content, sort_order, is_visible]);

        res.status(201).json({
            message: 'Page section created successfully',
            section: {
                id: result.insertId,
                page_id: pageId,
                section_key,
                title,
                content,
                sort_order,
                is_visible
            }
        });

    } catch (error) {
        console.error('Error creating page section:', error);
        res.status(500).json({
            error: 'Failed to create page section',
            message: 'Unable to create page section'
        });
    }
});

// Get admin dashboard stats
router.get('/stats', async (req, res) => {
    console.log('Stats endpoint called for user:', req.user.id, req.user.email);
    
    try {
        const modelId = await getUserModelId(req.user.id);
        console.log('Retrieved modelId:', modelId);
        
        if (!modelId) {
            console.log('No model found, returning zero stats');
            return res.json({
                gallery_images: 0,
                faq_items: 0,
                testimonials: 0,
                page_sections: 0,
                current_theme: 'basic'
            });
        }

        console.log('Executing queries for model:', modelId);
        
        // Execute queries individually with proper error handling
        let galleryCount = 0;
        let faqCount = 0;
        let testimonialsCount = 0;
        let pageSectionsCount = 0;
        let calendarEventsCount = 0;
        let currentTheme = 'basic';

        try {
            const galleryResult = await query('SELECT COUNT(*) as count FROM gallery_images WHERE model_id = ? AND is_active = true', [modelId]);
            galleryCount = galleryResult[0]?.count || 0;
            console.log('Gallery count:', galleryCount);
        } catch (err) {
            console.error('Gallery query error:', err);
        }

        try {
            const faqResult = await query('SELECT COUNT(*) as count FROM faq_items WHERE model_id = ? AND is_visible = true', [modelId]);
            faqCount = faqResult[0]?.count || 0;
            console.log('FAQ count:', faqCount);
        } catch (err) {
            console.error('FAQ query error:', err);
        }

        try {
            const testimonialsResult = await query('SELECT COUNT(*) as count FROM testimonials WHERE model_id = ? AND is_active = true', [modelId]);
            testimonialsCount = testimonialsResult[0]?.count || 0;
            console.log('Testimonials count:', testimonialsCount);
        } catch (err) {
            console.error('Testimonials query error:', err);
        }

        try {
            const pageResult = await query('SELECT COUNT(*) as count FROM page_sections ps JOIN pages p ON ps.page_id = p.id WHERE p.model_id = ?', [modelId]);
            pageSectionsCount = pageResult[0]?.count || 0;
            console.log('Page sections count:', pageSectionsCount);
        } catch (err) {
            console.error('Page sections query error:', err);
        }

        try {
            const calendarResult = await query('SELECT COUNT(*) as count FROM calendar_events WHERE model_id = ? AND is_visible = true', [modelId]);
            calendarEventsCount = calendarResult[0]?.count || 0;
            console.log('Calendar events count:', calendarEventsCount);
        } catch (err) {
            console.error('Calendar events query error:', err);
        }

        try {
            const themeResult = await query(`
                SELECT ts.name as theme_name 
                FROM model_theme_sets mts 
                JOIN theme_sets ts ON mts.theme_set_id = ts.id 
                WHERE mts.model_id = ? AND mts.is_active = 1 
                ORDER BY mts.applied_at DESC 
                LIMIT 1
            `, [modelId]);
            currentTheme = themeResult.length > 0 ? themeResult[0].theme_name : 'basic';
            console.log('Current theme:', currentTheme);
        } catch (err) {
            console.error('Theme query error:', err);
        }

        const stats = {
            gallery_images: galleryCount,
            faq_items: faqCount,
            testimonials: testimonialsCount,
            page_sections: pageSectionsCount,
            calendar_events: calendarEventsCount,
            current_theme: currentTheme
        };

        console.log('Returning stats:', stats);
        res.json(stats);

    } catch (error) {
        console.error('Error fetching admin stats:', error);
        res.status(500).json({
            error: 'Failed to fetch stats',
            message: 'Unable to load dashboard statistics'
        });
    }
});

// Get all available themes
router.get('/themes', async (req, res) => {
    try {
        console.log('*** THEMES ENDPOINT HIT ***');
        console.log('Themes endpoint called for user:', req.user.id, req.user.email);
        
        const modelId = await getUserModelId(req.user.id);
        console.log('Retrieved modelId for themes:', modelId);
        
        // Get themes the model has permission to use
        const themes = await query(`
            SELECT DISTINCT ts.id, ts.name, ts.display_name, ts.description, ts.category,
                   ts.default_color_scheme, ts.features, ts.pricing_tier, ts.is_active
            FROM theme_sets ts
            LEFT JOIN model_theme_permissions mtp ON ts.id = mtp.theme_set_id AND mtp.model_id = ?
            LEFT JOIN model_subscriptions ms ON ms.model_id = ?
            LEFT JOIN subscription_plans sp ON ms.subscription_plan_id = sp.id
            WHERE ts.is_active = 1
            AND (
                -- Free themes are always available
                ts.pricing_tier = 'free'
                -- Or user has explicit permission
                OR (mtp.is_granted = true AND (mtp.expires_at IS NULL OR mtp.expires_at > NOW()))
                -- Or subscription plan allows this pricing tier
                OR (ms.status = 'active' AND JSON_CONTAINS(sp.allowed_pricing_tiers, JSON_QUOTE(ts.pricing_tier)))
            )
            ORDER BY ts.display_name
        `, [modelId, modelId]);

        // Parse JSON fields and get current theme for model
        const currentThemeResult = await query(`
            SELECT ts.name as current_theme
            FROM model_theme_sets mts 
            JOIN theme_sets ts ON mts.theme_set_id = ts.id 
            WHERE mts.model_id = ? AND mts.is_active = 1 
            ORDER BY mts.applied_at DESC 
            LIMIT 1
        `, [modelId]);
        
        const currentThemeName = currentThemeResult.length > 0 ? currentThemeResult[0].current_theme : 'basic';

        // Parse JSON fields for each theme
        for (let theme of themes) {
            // Parse default color scheme
            if (typeof theme.default_color_scheme === 'string') {
                try {
                    theme.colors = JSON.parse(theme.default_color_scheme);
                } catch (error) {
                    theme.colors = {};
                }
            } else {
                theme.colors = theme.default_color_scheme || {};
            }
            
            // Parse features
            if (typeof theme.features === 'string') {
                try {
                    theme.features = JSON.parse(theme.features);
                } catch (error) {
                    theme.features = {};
                }
            }
        }

        // Use the current theme we already determined
        const currentTheme = currentThemeName;

        console.log('Themes found:', themes.length, 'Current theme:', currentTheme);
        
        res.json({
            themes: themes,
            current_theme: currentTheme
        });

    } catch (error) {
        console.error('Error fetching themes:', error);
        res.status(500).json({
            error: 'Failed to fetch themes',
            message: 'Unable to load themes'
        });
    }
});

// Apply theme to model
router.post('/themes/:themeId/apply', async (req, res) => {
    try {
        const themeId = req.params.themeId;
        const modelId = await getUserModelId(req.user.id);
        
        if (!modelId) {
            return res.status(404).json({
                error: 'Model not found',
                message: 'No model associated with this user'
            });
        }

        // Verify theme set exists
        const themeCheck = await query('SELECT id, display_name FROM theme_sets WHERE id = ? AND is_active = 1', [themeId]);
        if (themeCheck.length === 0) {
            return res.status(404).json({
                error: 'Theme not found',
                message: 'The specified theme does not exist'
            });
        }

        // Deactivate current theme
        await query('UPDATE model_theme_sets SET is_active = 0 WHERE model_id = ?', [modelId]);

        // Apply new theme
        await query(`
            INSERT INTO model_theme_sets (model_id, theme_set_id, is_active, applied_at)
            VALUES (?, ?, 1, NOW())
        `, [modelId, themeId]);

        res.json({
            message: 'Theme applied successfully',
            theme: themeCheck[0]
        });

    } catch (error) {
        console.error('Error applying theme:', error);
        res.status(500).json({
            error: 'Failed to apply theme',
            message: 'Unable to apply theme'
        });
    }
});

// Simple test endpoint
router.get('/test', async (req, res) => {
    res.json({
        message: 'Test endpoint working',
        user: req.user,
        timestamp: new Date().toISOString()
    });
});

// Test themes endpoint access
router.get('/themes-test', async (req, res) => {
    console.log('*** THEMES-TEST ENDPOINT HIT ***');
    res.json({
        message: 'Themes test endpoint working',
        user: req.user,
        timestamp: new Date().toISOString()
    });
});

// Debug endpoint
router.get('/debug', async (req, res) => {
    try {
        const modelId = await getUserModelId(req.user.id);
        
        // Test each query individually
        const galleryTest = await query('SELECT COUNT(*) as count FROM gallery_images WHERE model_id = ? AND is_active = true', [modelId]);
        const faqTest = await query('SELECT COUNT(*) as count FROM faq_items WHERE model_id = ? AND is_visible = true', [modelId]);
        const pageTest = await query('SELECT COUNT(*) as count FROM page_sections ps JOIN pages p ON ps.page_id = p.id WHERE p.model_id = ?', [modelId]);
        
        res.json({
            user_id: req.user.id,
            user_email: req.user.email,
            model_id: modelId,
            gallery_test: galleryTest,
            faq_test: faqTest,
            page_test: pageTest,
            debug: 'Working'
        });
    } catch (error) {
        res.status(500).json({
            error: error.message,
            stack: error.stack
        });
    }
});

module.exports = router;