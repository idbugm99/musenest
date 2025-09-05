/**
 * ✨ THEME COLORS API ✨
 * API endpoints for database-driven theme color management
 */

const express = require('express');
const router = express.Router();
const ThemeColorService = require('../../services/ThemeColorService');

/**
 * GET /api/theme-colors/:themeSetId
 * Get all color overrides for a theme set
 */
router.get('/:themeSetId', async (req, res) => {
    try {
        const themeSetId = parseInt(req.params.themeSetId);
        
        if (!themeSetId || themeSetId <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid theme set ID'
            });
        }

        const colors = await ThemeColorService.getThemeColors(themeSetId);
        
        res.json({
            success: true,
            data: colors,
            count: colors.length
        });
    } catch (error) {
        console.error('Error fetching theme colors:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

/**
 * GET /api/theme-colors/:themeSetId/css
 * Get complete CSS for theme injection
 */
router.get('/:themeSetId/css', async (req, res) => {
    try {
        const themeSetId = parseInt(req.params.themeSetId);
        
        if (!themeSetId || themeSetId <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid theme set ID'
            });
        }

        const css = await ThemeColorService.getThemeCSS(themeSetId);
        
        res.setHeader('Content-Type', 'text/css');
        res.send(css);
    } catch (error) {
        console.error('Error generating theme CSS:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

/**
 * PUT /api/theme-colors/:themeSetId/:variableName
 * Update a specific theme color variable
 */
router.put('/:themeSetId/:variableName', async (req, res) => {
    try {
        const themeSetId = parseInt(req.params.themeSetId);
        const variableName = req.params.variableName;
        const { variableValue } = req.body;
        
        if (!themeSetId || themeSetId <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid theme set ID'
            });
        }

        if (!variableName || !variableValue) {
            return res.status(400).json({
                success: false,
                error: 'Variable name and value are required'
            });
        }

        // Ensure variable name has -- prefix
        const formattedVariableName = variableName.startsWith('--') ? variableName : `--${variableName}`;
        
        const success = await ThemeColorService.updateThemeColor(
            themeSetId, 
            formattedVariableName, 
            variableValue
        );
        
        if (success) {
            res.json({
                success: true,
                message: 'Theme color updated successfully'
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to update theme color'
            });
        }
    } catch (error) {
        console.error('Error updating theme color:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

/**
 * DELETE /api/theme-colors/cache/:themeSetId?
 * Clear theme color cache
 */
router.delete('/cache/:themeSetId?', async (req, res) => {
    try {
        const themeSetId = req.params.themeSetId ? parseInt(req.params.themeSetId) : null;
        
        ThemeColorService.clearCache(themeSetId);
        
        res.json({
            success: true,
            message: themeSetId 
                ? `Cache cleared for theme ${themeSetId}` 
                : 'All theme caches cleared'
        });
    } catch (error) {
        console.error('Error clearing cache:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

module.exports = router;