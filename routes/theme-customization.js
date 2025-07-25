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

// Get all available theme templates
router.get('/templates', auth, async (req, res) => {
    try {
        const templates = await query(`
            SELECT 
                id, name, display_name, description, 
                default_color_scheme as color_variables, 
                null as preview_image, is_active
            FROM theme_sets 
            WHERE is_active = true
            ORDER BY display_name
        `);

        // Parse JSON color variables
        const templatesWithColors = templates.map(template => {
            let colorVariables = template.color_variables;
            
            // Handle both string and object cases
            if (typeof colorVariables === 'string') {
                try {
                    colorVariables = JSON.parse(colorVariables);
                } catch (error) {
                    console.error('JSON parse error for template', template.name, ':', error);
                    colorVariables = {};
                }
            } else if (!colorVariables || typeof colorVariables !== 'object') {
                colorVariables = {};
            }
            
            return {
                ...template,
                color_variables: colorVariables
            };
        });

        res.json({
            success: true,
            templates: templatesWithColors
        });

    } catch (error) {
        console.error('Error fetching theme templates:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch theme templates'
        });
    }
});

// Get current theme and customizations for model
router.get('/current', auth, async (req, res) => {
    try {
        const modelId = await getUserModelId(req.user.id);
        if (!modelId) {
            return res.status(404).json({
                success: false,
                message: 'No model found for user'
            });
        }

        // Get current active theme
        const currentThemeResult = await query(`
            SELECT ts.id, ts.name, ts.display_name, ts.default_color_scheme as color_variables
            FROM model_theme_sets mts 
            JOIN theme_sets ts ON mts.theme_set_id = ts.id
            WHERE mts.model_id = ? AND mts.is_active = 1 
            ORDER BY mts.applied_at DESC 
            LIMIT 1
        `, [modelId]);

        if (currentThemeResult.length === 0) {
            return res.json({
                success: true,
                theme: null,
                customColors: {}
            });
        }

        const currentTheme = currentThemeResult[0];
        
        // Get custom colors for this theme from model_theme_sets
        const customColors = await query(`
            SELECT mts.custom_color_scheme
            FROM model_theme_sets mts 
            WHERE mts.model_id = ? AND mts.theme_set_id = ?
        `, [modelId, currentTheme.id]);

        let customColorsObj = {};
        if (customColors.length > 0 && customColors[0].custom_color_scheme) {
            try {
                customColorsObj = typeof customColors[0].custom_color_scheme === 'string' 
                    ? JSON.parse(customColors[0].custom_color_scheme)
                    : customColors[0].custom_color_scheme;
            } catch (error) {
                console.error('Error parsing custom colors:', error);
                customColorsObj = {};
            }
        }

        // Handle color variables parsing
        let colorVariables = currentTheme.color_variables;
        if (typeof colorVariables === 'string') {
            try {
                colorVariables = JSON.parse(colorVariables);
            } catch (error) {
                console.error('JSON parse error for current theme:', error);
                colorVariables = {};
            }
        } else if (!colorVariables || typeof colorVariables !== 'object') {
            colorVariables = {};
        }

        res.json({
            success: true,
            theme: {
                ...currentTheme,
                color_variables: colorVariables
            },
            customColors: customColorsObj
        });

    } catch (error) {
        console.error('Error fetching current theme:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch current theme'
        });
    }
});

// Update custom colors for current theme
router.post('/colors', auth, async (req, res) => {
    try {
        const modelId = await getUserModelId(req.user.id);
        if (!modelId) {
            return res.status(404).json({
                success: false,
                message: 'No model found for user'
            });
        }

        const { themeId, colors } = req.body;

        if (!themeId || !colors || typeof colors !== 'object') {
            return res.status(400).json({
                success: false,
                message: 'Theme ID and colors object are required'
            });
        }

        // Verify theme set exists and is accessible
        const themeCheck = await query(`
            SELECT id FROM theme_sets WHERE id = ? AND is_active = 1
        `, [themeId]);

        if (themeCheck.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Theme not found'
            });
        }

        // Update custom colors in model_theme_sets
        await query(`
            UPDATE model_theme_sets 
            SET custom_color_scheme = ?
            WHERE model_id = ? AND theme_set_id = ? AND is_active = 1
        `, [JSON.stringify(colors), modelId, themeId]);

        res.json({
            success: true,
            message: 'Theme colors updated successfully',
            colors: colors
        });

    } catch (error) {
        console.error('Error updating theme colors:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update theme colors'
        });
    }
});

// Reset colors to theme defaults
router.delete('/colors/:themeId', auth, async (req, res) => {
    try {
        const modelId = await getUserModelId(req.user.id);
        if (!modelId) {
            return res.status(404).json({
                success: false,
                message: 'No model found for user'
            });
        }

        const { themeId } = req.params;

        // Reset custom colors to null in model_theme_sets
        const result = await query(`
            UPDATE model_theme_sets 
            SET custom_color_scheme = NULL
            WHERE model_id = ? AND theme_set_id = ?
        `, [modelId, themeId]);

        res.json({
            success: true,
            message: 'Theme colors reset to defaults',
            deletedCount: result.affectedRows
        });

    } catch (error) {
        console.error('Error resetting theme colors:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reset theme colors'
        });
    }
});

// Apply theme with optional custom colors
router.post('/apply', auth, async (req, res) => {
    try {
        const modelId = await getUserModelId(req.user.id);
        if (!modelId) {
            return res.status(404).json({
                success: false,
                message: 'No model found for user'
            });
        }

        const { themeId, customColors } = req.body;

        if (!themeId) {
            return res.status(400).json({
                success: false,
                message: 'Theme ID is required'
            });
        }

        // Verify theme set exists
        const themeCheck = await query(`
            SELECT id, display_name FROM theme_sets WHERE id = ? AND is_active = 1
        `, [themeId]);

        if (themeCheck.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Theme not found'
            });
        }

        // Deactivate current theme sets
        await query('UPDATE model_theme_sets SET is_active = 0 WHERE model_id = ?', [modelId]);

        // Apply new theme set
        await query(`
            INSERT INTO model_theme_sets (model_id, theme_set_id, is_active, applied_at, custom_color_scheme)
            VALUES (?, ?, 1, NOW(), ?)
        `, [modelId, themeId, customColors ? JSON.stringify(customColors) : null]);

        res.json({
            success: true,
            message: `Theme "${themeCheck[0].display_name}" applied successfully`,
            theme: themeCheck[0]
        });

    } catch (error) {
        console.error('Error applying theme:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to apply theme'
        });
    }
});

// Generate CSS for current theme with custom colors
router.get('/css/:modelId?', async (req, res) => {
    try {
        const modelId = req.params.modelId || (req.user ? await getUserModelId(req.user.id) : null);
        
        if (!modelId) {
            return res.status(404).json({
                success: false,
                message: 'Model not found'
            });
        }

        // Get current theme and template
        const themeResult = await query(`
            SELECT ts.name as theme_name, ts.default_color_scheme as color_variables
            FROM model_theme_sets mts 
            JOIN theme_sets ts ON mts.theme_set_id = ts.id
            WHERE mts.model_id = ? AND mts.is_active = 1 
            ORDER BY mts.applied_at DESC 
            LIMIT 1
        `, [modelId]);

        if (themeResult.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No active theme found'
            });
        }

        const theme = themeResult[0];
        
        // Handle color variables parsing
        let defaultColors = theme.color_variables;
        if (typeof defaultColors === 'string') {
            try {
                defaultColors = JSON.parse(defaultColors);
            } catch (error) {
                console.error('JSON parse error for CSS generation:', error);
                defaultColors = {};
            }
        } else if (!defaultColors || typeof defaultColors !== 'object') {
            defaultColors = {};
        }

        // Get custom colors from current theme set
        const customColorsResult = await query(`
            SELECT mts.custom_color_scheme
            FROM model_theme_sets mts 
            WHERE mts.model_id = ? AND mts.is_active = 1
        `, [modelId]);

        let customColors = {};
        if (customColorsResult.length > 0 && customColorsResult[0].custom_color_scheme) {
            try {
                customColors = typeof customColorsResult[0].custom_color_scheme === 'string' 
                    ? JSON.parse(customColorsResult[0].custom_color_scheme)
                    : customColorsResult[0].custom_color_scheme;
            } catch (error) {
                console.error('Error parsing custom colors for CSS:', error);
                customColors = {};
            }
        }

        // Merge default and custom colors
        const finalColors = { ...defaultColors, ...customColors };

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