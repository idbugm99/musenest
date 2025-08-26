const express = require('express');
const router = express.Router();
const db = require('../../config/database');

/**
 * GET /api/models/:id/colors
 * Get model's current color scheme with theme and palette information
 */
router.get('/models/:id/colors', async (req, res) => {
    try {
        const modelId = req.params.id;
        
        // Get model's current theme and active color palette
        const modelData = await db.query(`
            SELECT 
                m.id, 
                m.name, 
                m.slug,
                m.theme_set_id,
                m.active_color_palette_id,
                ts.name as theme_name,
                ts.display_name as theme_display_name,
                cp.name as palette_name,
                cp.display_name as palette_display_name,
                cp.is_system_palette,
                cp.created_by_model_id
            FROM models m
            JOIN theme_sets ts ON m.theme_set_id = ts.id
            LEFT JOIN color_palettes cp ON m.active_color_palette_id = cp.id
            WHERE m.id = ?
        `, [modelId]);

        if (!modelData.length) {
            return res.status(404).json({ error: 'Model not found' });
        }

        const model = modelData[0];

        // Get all color tokens for the active palette
        const colorTokens = await db.query(`
            SELECT token_name, token_value, token_description
            FROM color_palette_values
            WHERE palette_id = ?
            ORDER BY token_name
        `, [model.active_color_palette_id]);

        // Convert to key-value object for easier template usage
        const colors = {};
        colorTokens.forEach(token => {
            colors[token.token_name] = token.token_value;
        });

        // Determine if this is a custom palette
        const isCustom = model.created_by_model_id === parseInt(modelId);

        res.json({
            theme: {
                id: model.theme_set_id,
                name: model.theme_name,
                display_name: model.theme_display_name
            },
            palette: {
                id: model.active_color_palette_id,
                name: model.palette_name,
                display_name: model.palette_display_name,
                is_custom: isCustom
            },
            colors: colors,
            token_count: colorTokens.length
        });

    } catch (error) {
        console.error('Error fetching model colors:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/models/:id/palettes
 * Get all available palettes for a model (system palettes + their custom ones)
 */
router.get('/models/:id/palettes', async (req, res) => {
    try {
        const modelId = req.params.id;

        // Get all system palettes + model's custom palettes
        const palettes = await db.query(`
            SELECT 
                id,
                name,
                display_name,
                description,
                is_system_palette,
                created_by_model_id,
                theme_set_id,
                created_at
            FROM color_palettes
            WHERE is_system_palette = 1 
               OR created_by_model_id = ?
            ORDER BY 
                is_system_palette DESC,
                created_at DESC
        `, [modelId]);

        // Get preview colors for each palette (first 6 tokens for UI preview)
        const palettesWithColors = await Promise.all(palettes.map(async (palette) => {
            const previewColors = await db.query(`
                SELECT token_name, token_value
                FROM color_palette_values
                WHERE palette_id = ?
                  AND token_name IN ('primary', 'secondary', 'accent', 'bg', 'text', 'nav-bg')
                ORDER BY 
                    CASE token_name
                        WHEN 'primary' THEN 1
                        WHEN 'secondary' THEN 2
                        WHEN 'accent' THEN 3
                        WHEN 'bg' THEN 4
                        WHEN 'text' THEN 5
                        WHEN 'nav-bg' THEN 6
                    END
            `, [palette.id]);

            const colors = {};
            previewColors.forEach(token => {
                colors[token.token_name] = token.token_value;
            });

            return {
                ...palette,
                preview_colors: colors,
                is_custom: palette.created_by_model_id === parseInt(modelId)
            };
        }));

        res.json({
            palettes: palettesWithColors
        });

    } catch (error) {
        console.error('Error fetching model palettes:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PUT /api/models/:id/palette
 * Update model's active palette
 */
router.put('/models/:id/palette', async (req, res) => {
    try {
        const modelId = req.params.id;
        const { palette_id } = req.body;

        if (!palette_id) {
            return res.status(400).json({ error: 'palette_id is required' });
        }

        // Verify palette exists and model has access to it
        const paletteCheck = await db.query(`
            SELECT id, is_system_palette, created_by_model_id
            FROM color_palettes
            WHERE id = ?
              AND (is_system_palette = 1 OR created_by_model_id = ?)
        `, [palette_id, modelId]);

        if (!paletteCheck.length) {
            return res.status(404).json({ error: 'Palette not found or access denied' });
        }

        // Update model's active palette
        await db.query(`
            UPDATE models 
            SET active_color_palette_id = ?
            WHERE id = ?
        `, [palette_id, modelId]);

        res.json({
            success: true,
            message: 'Active palette updated successfully',
            palette_id: parseInt(palette_id)
        });

    } catch (error) {
        console.error('Error updating model palette:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/models/:id/palettes/custom
 * Create custom palette from edits
 */
router.post('/models/:id/palettes/custom', async (req, res) => {
    try {
        const modelId = req.params.id;
        const { name, color_edits } = req.body;

        if (!name || !color_edits || typeof color_edits !== 'object') {
            return res.status(400).json({ 
                error: 'name and color_edits object are required' 
            });
        }

        // Get model's current theme and palette info for cloning
        const modelData = await db.query(`
            SELECT 
                m.theme_set_id,
                m.active_color_palette_id,
                m.slug
            FROM models m
            WHERE m.id = ?
        `, [modelId]);

        if (!modelData.length) {
            return res.status(404).json({ error: 'Model not found' });
        }

        const model = modelData[0];
        
        // Create new custom palette
        const customPaletteName = name || `custom-${model.slug}-palette`;
        const paletteResult = await db.query(`
            INSERT INTO color_palettes (
                name, 
                display_name,
                description,
                is_system_palette, 
                created_by_model_id, 
                theme_set_id,
                created_at,
                updated_at
            ) VALUES (?, ?, ?, 0, ?, ?, NOW(), NOW())
        `, [
            customPaletteName,
            name,
            `Custom palette created by ${model.slug}`,
            modelId,
            model.theme_set_id
        ]);

        const newPaletteId = paletteResult.insertId;

        // Clone all tokens from current palette
        const currentTokens = await db.query(`
            SELECT token_name, token_value, token_description
            FROM color_palette_values
            WHERE palette_id = ?
        `, [model.active_color_palette_id]);

        // Insert cloned tokens with edits applied
        const tokenInserts = currentTokens.map(token => {
            const editedValue = color_edits[token.token_name] || token.token_value;
            return [
                newPaletteId,
                token.token_name,
                editedValue,
                token.token_description
            ];
        });

        if (tokenInserts.length > 0) {
            await db.query(`
                INSERT INTO color_palette_values (palette_id, token_name, token_value, token_description)
                VALUES ${tokenInserts.map(() => '(?, ?, ?, ?)').join(', ')}
            `, tokenInserts.flat());
        }

        // Update model to use new custom palette
        await db.query(`
            UPDATE models 
            SET active_color_palette_id = ?
            WHERE id = ?
        `, [newPaletteId, modelId]);

        res.json({
            success: true,
            message: 'Custom palette created successfully',
            palette: {
                id: newPaletteId,
                name: customPaletteName,
                display_name: name,
                is_custom: true,
                token_count: tokenInserts.length
            }
        });

    } catch (error) {
        console.error('Error creating custom palette:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PUT /api/palettes/:id/colors
 * Update custom palette colors (only for palettes created by current model)
 */
router.put('/palettes/:id/colors', async (req, res) => {
    try {
        const paletteId = req.params.id;
        const colorUpdates = req.body;

        if (!colorUpdates || typeof colorUpdates !== 'object') {
            return res.status(400).json({ 
                error: 'Color updates object is required' 
            });
        }

        // Verify this is a custom palette (not system palette)
        const paletteCheck = await db.query(`
            SELECT id, is_system_palette, created_by_model_id
            FROM color_palettes
            WHERE id = ? AND is_system_palette = 0
        `, [paletteId]);

        if (!paletteCheck.length) {
            return res.status(404).json({ 
                error: 'Custom palette not found or cannot modify system palette' 
            });
        }

        // Update each color token
        const updates = Object.entries(colorUpdates);
        if (updates.length === 0) {
            return res.status(400).json({ error: 'No color updates provided' });
        }

        for (const [tokenName, tokenValue] of updates) {
            await db.query(`
                UPDATE color_palette_values
                SET token_value = ?, updated_at = NOW()
                WHERE palette_id = ? AND token_name = ?
            `, [tokenValue, paletteId, tokenName]);
        }

        // Update palette modified timestamp
        await db.query(`
            UPDATE color_palettes
            SET updated_at = NOW()
            WHERE id = ?
        `, [paletteId]);

        res.json({
            success: true,
            message: 'Palette colors updated successfully',
            updated_tokens: updates.length
        });

    } catch (error) {
        console.error('Error updating palette colors:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;