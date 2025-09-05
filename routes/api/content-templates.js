const express = require('express');
const router = express.Router();
const { query } = require('../../config/database');

// Get content from legacy content_templates system
router.get('/:modelSlug/:pageType', async (req, res) => {
    try {
        const { modelSlug, pageType } = req.params;
        
        // Get model ID from slug
        const modelResult = await query('SELECT id FROM models WHERE slug = ?', [modelSlug]);
        if (modelResult.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Model not found'
            });
        }
        
        const modelId = modelResult[0].id;
        
        // Get content from content_templates system
        const contentRows = await query(`
            SELECT ct.content_key, ct.content_value, ct.content_type
            FROM content_templates ct
            JOIN page_types pt ON ct.page_type_id = pt.id
            WHERE ct.model_id = ? AND pt.name = ?
        `, [modelId, pageType]);
        
        // Convert to key-value object
        const content = {};
        contentRows.forEach(row => {
            if (row.content_type === 'json') {
                try {
                    content[row.content_key] = JSON.parse(row.content_value);
                } catch (parseError) {
                    console.error(`Error parsing JSON for key ${row.content_key}:`, parseError);
                    content[row.content_key] = row.content_value; // Fallback to raw string
                }
            } else {
                content[row.content_key] = row.content_value;
            }
        });
        
        res.json({
            success: true,
            data: content,
            meta: {
                source: 'content_templates',
                model_id: modelId,
                page_type: pageType,
                items_count: contentRows.length
            }
        });
        
    } catch (error) {
        console.error('Error fetching content templates:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch content templates'
        });
    }
});

module.exports = router;