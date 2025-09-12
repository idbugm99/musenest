const express = require('express');
const router = express.Router();
const { query } = require('../../config/database');

// Get template path for a specific theme and page
router.get('/:themeId/page/:pageName', async (req, res) => {
    try {
        const { themeId, pageName } = req.params;
        
        // Get template file from theme_set_pages table
        const templateResults = await query(`
            SELECT tsp.template_file, ts.name as theme_name
            FROM theme_set_pages tsp
            JOIN page_types pt ON tsp.page_type_id = pt.id
            JOIN theme_sets ts ON tsp.theme_set_id = ts.id
            WHERE tsp.theme_set_id = ? AND pt.name = ?
            LIMIT 1
        `, [themeId, pageName]);
        
        if (templateResults.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Template not found for this theme and page'
            });
        }
        
        const result = templateResults[0];
        const templatePath = result.template_file || `${result.theme_name}/pages/${pageName}`;
        
        res.json({
            success: true,
            data: {
                template_file: result.template_file,
                template_path: templatePath,
                theme_name: result.theme_name,
                page_name: pageName
            }
        });
        
    } catch (error) {
        console.error('Error fetching theme template:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch theme template'
        });
    }
});

// Validate theme exists and is active (for preview mode)
router.get('/validate/:themeId', async (req, res) => {
    try {
        const { themeId } = req.params;
        
        // Verify theme exists and is active
        const themeCheck = await query(`
            SELECT id, name, display_name, default_palette_id 
            FROM theme_sets 
            WHERE id = ? AND is_active = 1
        `, [themeId]);
        
        if (themeCheck.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Theme not found or inactive'
            });
        }
        
        res.json({
            success: true,
            data: themeCheck[0]
        });
        
    } catch (error) {
        console.error('Error validating theme:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to validate theme'
        });
    }
});

// Validate color palette exists and is active (for preview mode)
router.get('/validate-palette/:paletteId', async (req, res) => {
    try {
        const { paletteId } = req.params;
        
        // Verify palette exists
        const paletteCheck = await query(`
            SELECT id, name, display_name 
            FROM color_palettes 
            WHERE id = ?
        `, [paletteId]);
        
        if (paletteCheck.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Color palette not found'
            });
        }
        
        res.json({
            success: true,
            data: paletteCheck[0]
        });
        
    } catch (error) {
        console.error('Error validating color palette:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to validate color palette'
        });
    }
});

module.exports = router;