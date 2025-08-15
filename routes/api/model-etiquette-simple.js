const express = require('express');
const router = express.Router();
const { query } = require('../../config/database');

// Get etiquette page content for a model (simple structure)
router.get('/:modelSlug/etiquette', async (req, res) => {
    try {
        const { modelSlug } = req.params;
        
        // Get model ID from slug
        const modelResult = await query('SELECT id FROM models WHERE slug = ?', [modelSlug]);
        if (modelResult.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Model not found'
            });
        }
        
        const modelId = modelResult[0].id;
        
        // Get etiquette page content
        const contentResult = await query(
            'SELECT * FROM model_etiquette_page_content WHERE model_id = ?',
            [modelId]
        );
        
        let content = {};
        if (contentResult.length > 0) {
            content = contentResult[0];
        } else {
            // Create default content if none exists
            await query(`
                INSERT INTO model_etiquette_page_content 
                (model_id, page_title, etiquette_header_visible, section_1_visible, section_2_visible, section_3_visible, cta_visible)
                VALUES (?, 'Etiquette & Guidelines', 1, 1, 1, 1, 1)
            `, [modelId]);
            
            const newContentResult = await query(
                'SELECT * FROM model_etiquette_page_content WHERE model_id = ?',
                [modelId]
            );
            content = newContentResult[0] || {};
        }
        
        res.json({
            success: true,
            data: content
        });
        
    } catch (error) {
        console.error('Error fetching etiquette content:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch etiquette content'
        });
    }
});

// Update etiquette page content for a model (simple structure)
router.put('/:modelSlug/etiquette', async (req, res) => {
    try {
        const { modelSlug } = req.params;
        const updateData = req.body;
        
        // Get model ID from slug
        const modelResult = await query('SELECT id FROM models WHERE slug = ?', [modelSlug]);
        if (modelResult.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Model not found'
            });
        }
        
        const modelId = modelResult[0].id;
        
        // Check if content exists
        const existingResult = await query(
            'SELECT id FROM model_etiquette_page_content WHERE model_id = ?',
            [modelId]
        );
        
        if (existingResult.length > 0) {
            // Update existing content
            const setClause = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
            const values = [...Object.values(updateData), modelId];
            
            await query(
                `UPDATE model_etiquette_page_content SET ${setClause}, updated_at = NOW() WHERE model_id = ?`,
                values
            );
        } else {
            // Insert new content
            const fields = ['model_id', ...Object.keys(updateData)];
            const placeholders = fields.map(() => '?').join(', ');
            const values = [modelId, ...Object.values(updateData)];
            
            await query(
                `INSERT INTO model_etiquette_page_content (${fields.join(', ')}) VALUES (${placeholders})`,
                values
            );
        }
        
        res.json({
            success: true,
            message: 'Etiquette content updated successfully'
        });
        
    } catch (error) {
        console.error('Error updating etiquette content:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update etiquette content'
        });
    }
});

module.exports = router;
