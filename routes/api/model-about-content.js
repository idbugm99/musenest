const express = require('express');
const router = express.Router();
const { query } = require('../../config/database');

// Get about page content for a model
router.get('/:modelSlug/about', async (req, res) => {
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
        
        // Get about page content
        const contentResult = await query(
            'SELECT * FROM model_about_page_content WHERE model_id = ?',
            [modelId]
        );
        
        let content = {};
        if (contentResult.length > 0) {
            content = contentResult[0];
        } else {
            // Create default content if none exists
            await query(`
                INSERT INTO model_about_page_content 
                (model_id, page_title, page_subtitle, main_content_visible, services_visible, interests_visible, portrait_visible, quick_facts_visible, about_cta_visible)
                VALUES (?, 'About Me', NULL, 1, 1, 1, 1, 1, 1)
            `, [modelId]);
            
            const newContentResult = await query(
                'SELECT * FROM model_about_page_content WHERE model_id = ?',
                [modelId]
            );
            content = newContentResult[0] || {};
        }
        
        res.json({
            success: true,
            data: content
        });
        
    } catch (error) {
        console.error('Error fetching about content:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch about content'
        });
    }
});

// Update about page content for a model
router.put('/:modelSlug/about', async (req, res) => {
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
            'SELECT id FROM model_about_page_content WHERE model_id = ?',
            [modelId]
        );
        
        if (existingResult.length > 0) {
            // Update existing content
            const setClause = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
            const values = [...Object.values(updateData), modelId];
            
            await query(
                `UPDATE model_about_page_content SET ${setClause}, updated_at = NOW() WHERE model_id = ?`,
                values
            );
        } else {
            // Insert new content
            const fields = ['model_id', ...Object.keys(updateData)];
            const placeholders = fields.map(() => '?').join(', ');
            const values = [modelId, ...Object.values(updateData)];
            
            await query(
                `INSERT INTO model_about_page_content (${fields.join(', ')}) VALUES (${placeholders})`,
                values
            );
        }
        
        res.json({
            success: true,
            message: 'About content updated successfully'
        });
        
    } catch (error) {
        console.error('Error updating about content:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update about content'
        });
    }
});

// Update individual field for about page content (PATCH for auto-save functionality)
router.patch('/:modelSlug/about/:field', async (req, res) => {
    try {
        const { modelSlug, field } = req.params;
        const { value } = req.body;
        
        // Get model ID from slug
        const modelResult = await query('SELECT id FROM models WHERE slug = ?', [modelSlug]);
        if (modelResult.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Model not found'
            });
        }
        
        const modelId = modelResult[0].id;
        
        // Ensure content record exists
        const existingResult = await query(
            'SELECT id FROM model_about_page_content WHERE model_id = ?',
            [modelId]
        );
        
        if (existingResult.length === 0) {
            // Create default content first
            await query(`
                INSERT INTO model_about_page_content 
                (model_id, page_title, main_content_visible, services_visible, interests_visible, portrait_visible, quick_facts_visible, about_cta_visible)
                VALUES (?, 'About Me', 1, 1, 1, 1, 1, 1)
            `, [modelId]);
        }
        
        // Update the specific field
        await query(
            `UPDATE model_about_page_content SET ${field} = ?, updated_at = NOW() WHERE model_id = ?`,
            [value, modelId]
        );
        
        res.json({
            success: true,
            message: `${field} updated successfully`
        });
        
    } catch (error) {
        console.error('Error updating about field:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update about field'
        });
    }
});

module.exports = router;