const express = require('express');
const router = express.Router();
const { query } = require('../../config/database');

// Get model profile with theme and palette information
router.get('/:modelSlug/profile', async (req, res) => {
    try {
        const { modelSlug } = req.params;
        
        // Get model profile with theme and palette data using the same query as getModelBySlug
        const modelResult = await query(`
            SELECT m.id, m.name, m.slug, m.email, m.phone, m.status, m.theme_set_id, m.active_color_palette_id,
                   ts.name as theme_name, ts.display_name as theme_display_name, ts.default_palette_id,
                   cp.name as palette_name, cp.display_name as palette_display_name
            FROM models m
            LEFT JOIN theme_sets ts ON m.theme_set_id = ts.id
            LEFT JOIN color_palettes cp ON m.active_color_palette_id = cp.id
            WHERE m.slug = ? AND m.status IN ('active', 'trial', 'inactive')
            LIMIT 1
        `, [modelSlug]);
        
        if (modelResult.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Model not found or inactive'
            });
        }
        
        const model = modelResult[0];
        
        // Structure the response with organized theme and palette data
        const profileData = {
            id: model.id,
            name: model.name,
            slug: model.slug,
            email: model.email,
            phone: model.phone,
            status: model.status,
            theme: {
                set_id: model.theme_set_id,
                name: model.theme_name,
                display_name: model.theme_display_name,
                default_palette_id: model.default_palette_id
            },
            color_palette: {
                id: model.active_color_palette_id,
                name: model.palette_name,
                display_name: model.palette_display_name
            }
        };
        
        return res.status(200).json({
            success: true,
            data: profileData
        });
        
    } catch (error) {
        console.error('Error fetching model profile:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

// Alternative endpoint for backwards compatibility - returns raw format similar to getModelBySlug
router.get('/:modelSlug', async (req, res) => {
    try {
        const { modelSlug } = req.params;
        
        const modelResult = await query(`
            SELECT m.id, m.name, m.slug, m.email, m.phone, m.status, m.theme_set_id, m.active_color_palette_id,
                   ts.name as theme_name, ts.display_name as theme_display_name, ts.default_palette_id,
                   cp.name as palette_name, cp.display_name as palette_display_name
            FROM models m
            LEFT JOIN theme_sets ts ON m.theme_set_id = ts.id
            LEFT JOIN color_palettes cp ON m.active_color_palette_id = cp.id
            WHERE m.slug = ? AND m.status IN ('active', 'trial', 'inactive')
            LIMIT 1
        `, [modelSlug]);
        
        if (modelResult.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Model not found or inactive'
            });
        }
        
        return res.status(200).json({
            success: true,
            data: modelResult[0]
        });
        
    } catch (error) {
        console.error('Error fetching model:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

module.exports = router;