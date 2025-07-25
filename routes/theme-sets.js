const express = require('express');
const router = express.Router();
const { query, transaction } = require('../config/database');
const { authenticateToken: auth } = require('../middleware/auth');

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
        
        return models.length > 0 ? models[0].id : null;
    } catch (error) {
        console.error('getUserModelId error:', error);
        return null;
    }
}

// Get all available theme sets with their features and pricing (filtered by permissions)
router.get('/available', auth, async (req, res) => {
    try {
        // Get user's model ID
        const modelId = await getUserModelId(req.user.id);
        
        if (!modelId) {
            return res.json({
                success: true,
                theme_sets: []
            });
        }
        
        // Get theme sets the model has permission to use
        const themesets = await query(`
            SELECT DISTINCT ts.id, ts.name, ts.display_name, ts.description, ts.category,
                   ts.default_color_scheme, ts.features, ts.pricing_tier, ts.is_active
            FROM theme_sets ts
            LEFT JOIN model_theme_permissions mtp ON ts.id = mtp.theme_set_id AND mtp.model_id = ?
            LEFT JOIN model_subscriptions ms ON ms.model_id = ?
            LEFT JOIN subscription_plans sp ON ms.subscription_plan_id = sp.id
            WHERE ts.is_active = true
            AND (
                -- Free themes are always available
                ts.pricing_tier = 'free'
                -- Or user has explicit permission
                OR (mtp.is_granted = true AND (mtp.expires_at IS NULL OR mtp.expires_at > NOW()))
                -- Or subscription plan allows this pricing tier
                OR (ms.status = 'active' AND JSON_CONTAINS(sp.allowed_pricing_tiers, JSON_QUOTE(ts.pricing_tier)))
            )
            ORDER BY 
                CASE ts.pricing_tier 
                    WHEN 'free' THEN 1 
                    WHEN 'premium' THEN 2 
                    WHEN 'enterprise' THEN 3 
                END,
                ts.display_name
        `, [modelId, modelId]);

        // Parse JSON fields
        const themesetsWithParsedData = themesets.map(ts => ({
            ...ts,
            default_color_scheme: typeof ts.default_color_scheme === 'string' 
                ? JSON.parse(ts.default_color_scheme) 
                : ts.default_color_scheme,
            features: typeof ts.features === 'string' 
                ? JSON.parse(ts.features) 
                : ts.features
        }));

        res.json({
            success: true,
            theme_sets: themesetsWithParsedData
        });

    } catch (error) {
        console.error('Error fetching theme sets:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch theme sets'
        });
    }
});

// Get available page types with their requirements
router.get('/page-types', auth, async (req, res) => {
    try {
        const pageTypes = await query(`
            SELECT 
                id, name, display_name, description, category,
                content_structure, required_data_tables, pricing_tier, is_active
            FROM page_types 
            WHERE is_active = true
            ORDER BY 
                CASE category 
                    WHEN 'core' THEN 1 
                    WHEN 'optional' THEN 2 
                    WHEN 'business' THEN 3 
                    WHEN 'premium' THEN 4 
                    WHEN 'adult' THEN 5 
                END,
                display_name
        `);

        // Parse JSON fields
        const pageTypesWithParsedData = pageTypes.map(pt => ({
            ...pt,
            content_structure: typeof pt.content_structure === 'string' 
                ? JSON.parse(pt.content_structure) 
                : pt.content_structure,
            required_data_tables: typeof pt.required_data_tables === 'string' 
                ? JSON.parse(pt.required_data_tables) 
                : pt.required_data_tables
        }));

        res.json({
            success: true,
            page_types: pageTypesWithParsedData
        });

    } catch (error) {
        console.error('Error fetching page types:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch page types'
        });
    }
});

// Get current model's theme set and enabled pages
router.get('/current', auth, async (req, res) => {
    try {
        const modelId = await getUserModelId(req.user.id);
        if (!modelId) {
            return res.status(404).json({
                success: false,
                message: 'No model found for user'
            });
        }

        // Get current theme set
        const themeSetResult = await query(`
            SELECT 
                ts.id, ts.name, ts.display_name, ts.description, ts.category,
                ts.default_color_scheme, ts.features, ts.pricing_tier,
                mts.custom_color_scheme, mts.applied_at
            FROM model_theme_sets mts
            JOIN theme_sets ts ON mts.theme_set_id = ts.id
            WHERE mts.model_id = ? AND mts.is_active = true
            ORDER BY mts.applied_at DESC
            LIMIT 1
        `, [modelId]);

        // Get enabled pages
        const enabledPages = await query(`
            SELECT 
                pt.id, pt.name, pt.display_name, pt.category,
                mep.is_enabled, mep.custom_slug, mep.sort_order, mep.navigation_label
            FROM model_enabled_pages mep
            JOIN page_types pt ON mep.page_type_id = pt.id
            WHERE mep.model_id = ? AND mep.is_enabled = true
            ORDER BY mep.sort_order, pt.display_name
        `, [modelId]);

        let currentThemeSet = null;
        if (themeSetResult.length > 0) {
            const ts = themeSetResult[0];
            currentThemeSet = {
                ...ts,
                default_color_scheme: typeof ts.default_color_scheme === 'string' 
                    ? JSON.parse(ts.default_color_scheme) 
                    : ts.default_color_scheme,
                custom_color_scheme: ts.custom_color_scheme 
                    ? (typeof ts.custom_color_scheme === 'string' 
                        ? JSON.parse(ts.custom_color_scheme) 
                        : ts.custom_color_scheme)
                    : null,
                features: typeof ts.features === 'string' 
                    ? JSON.parse(ts.features) 
                    : ts.features
            };
        }

        res.json({
            success: true,
            current_theme_set: currentThemeSet,
            enabled_pages: enabledPages
        });

    } catch (error) {
        console.error('Error fetching current theme set:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch current theme set'
        });
    }
});

// Apply a theme set to the model
router.post('/apply', auth, async (req, res) => {
    try {
        const modelId = await getUserModelId(req.user.id);
        if (!modelId) {
            return res.status(404).json({
                success: false,
                message: 'No model found for user'
            });
        }

        const { themeSetId, customColorScheme, enabledPageIds } = req.body;

        if (!themeSetId) {
            return res.status(400).json({
                success: false,
                message: 'Theme set ID is required'
            });
        }

        // Verify theme set exists
        const themeSetCheck = await query(`
            SELECT id, display_name FROM theme_sets WHERE id = ? AND is_active = true
        `, [themeSetId]);

        if (themeSetCheck.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Theme set not found'
            });
        }

        const queries = [];

        // Deactivate current theme set
        queries.push({
            sql: 'UPDATE model_theme_sets SET is_active = false WHERE model_id = ?',
            params: [modelId]
        });

        // Apply new theme set
        queries.push({
            sql: `INSERT INTO model_theme_sets (model_id, theme_set_id, custom_color_scheme, is_active, applied_at)
                  VALUES (?, ?, ?, true, NOW())`,
            params: [modelId, themeSetId, customColorScheme ? JSON.stringify(customColorScheme) : null]
        });

        // If enabled pages are provided, update them
        if (enabledPageIds && Array.isArray(enabledPageIds)) {
            // Clear existing enabled pages
            queries.push({
                sql: 'DELETE FROM model_enabled_pages WHERE model_id = ?',
                params: [modelId]
            });

            // Add new enabled pages
            enabledPageIds.forEach((pageTypeId, index) => {
                queries.push({
                    sql: `INSERT INTO model_enabled_pages (model_id, page_type_id, sort_order, is_enabled)
                          VALUES (?, ?, ?, true)`,
                    params: [modelId, pageTypeId, index]
                });
            });
        }

        // Execute all queries in transaction
        await transaction(queries);

        res.json({
            success: true,
            message: `Theme set "${themeSetCheck[0].display_name}" applied successfully`,
            theme_set: themeSetCheck[0]
        });

    } catch (error) {
        console.error('Error applying theme set:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to apply theme set'
        });
    }
});

// Update model's enabled pages
router.post('/pages/update', auth, async (req, res) => {
    try {
        const modelId = await getUserModelId(req.user.id);
        if (!modelId) {
            return res.status(404).json({
                success: false,
                message: 'No model found for user'
            });
        }

        const { enabledPages } = req.body;

        if (!enabledPages || !Array.isArray(enabledPages)) {
            return res.status(400).json({
                success: false,
                message: 'Enabled pages array is required'
            });
        }

        const queries = [];

        // Clear existing enabled pages
        queries.push({
            sql: 'DELETE FROM model_enabled_pages WHERE model_id = ?',
            params: [modelId]
        });

        // Add new enabled pages
        enabledPages.forEach(page => {
            queries.push({
                sql: `INSERT INTO model_enabled_pages 
                      (model_id, page_type_id, is_enabled, custom_slug, sort_order, navigation_label)
                      VALUES (?, ?, ?, ?, ?, ?)`,
                params: [
                    modelId,
                    page.page_type_id,
                    page.is_enabled !== false,
                    page.custom_slug || null,
                    page.sort_order || 0,
                    page.navigation_label || null
                ]
            });
        });

        // Execute all queries in transaction
        await transaction(queries);

        res.json({
            success: true,
            message: 'Pages updated successfully',
            updated_count: enabledPages.length
        });

    } catch (error) {
        console.error('Error updating pages:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update pages'
        });
    }
});

// Generate CSS for current theme set and custom colors
router.get('/css/:modelId?', async (req, res) => {
    try {
        const modelId = req.params.modelId || (req.user ? await getUserModelId(req.user.id) : null);
        
        if (!modelId) {
            return res.status(404).json({
                success: false,
                message: 'Model not found'
            });
        }

        // Get current theme set with colors
        const themeResult = await query(`
            SELECT 
                ts.name as theme_name, ts.default_color_scheme,
                mts.custom_color_scheme
            FROM model_theme_sets mts
            JOIN theme_sets ts ON mts.theme_set_id = ts.id
            WHERE mts.model_id = ? AND mts.is_active = true
            ORDER BY mts.applied_at DESC
            LIMIT 1
        `, [modelId]);

        if (themeResult.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No active theme set found'
            });
        }

        const theme = themeResult[0];
        
        // Parse color schemes
        let defaultColors = theme.default_color_scheme;
        if (typeof defaultColors === 'string') {
            defaultColors = JSON.parse(defaultColors);
        }

        let customColors = theme.custom_color_scheme;
        if (customColors && typeof customColors === 'string') {
            customColors = JSON.parse(customColors);
        }

        // Merge colors (custom overrides default)
        const finalColors = { ...defaultColors, ...(customColors || {}) };

        // Generate CSS variables
        let cssVariables = ':root {\n';
        Object.entries(finalColors).forEach(([key, value]) => {
            cssVariables += `  --color-${key}: ${value};\n`;
        });
        cssVariables += '}\n';

        res.setHeader('Content-Type', 'text/css');
        res.send(cssVariables);

    } catch (error) {
        console.error('Error generating CSS:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate CSS'
        });
    }
});

module.exports = router;