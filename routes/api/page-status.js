const express = require('express');
const router = express.Router();
const { query } = require('../../config/database');

// Get publication status for all pages of a model
router.get('/:modelSlug/status', async (req, res) => {
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
        
        // Map of page names to their corresponding table names
        const pageTableMap = {
            'home': 'model_home_page_content',
            'about': 'model_about_page_content',
            'rates': 'model_rates_page_content',
            'gallery': 'model_gallery_page_content',
            'contact': 'model_contact_page_content',
            'etiquette': 'model_etiquette_page_content',
            'calendar': 'model_calendar_page_content'
        };
        
        const pageStatus = {};
        
        // Check publication status for each page
        for (const [pageName, tableName] of Object.entries(pageTableMap)) {
            try {
                const pageContentRows = await query(`
                    SELECT page_published FROM ${tableName} WHERE model_id = ?
                `, [modelId]);
                
                if (pageContentRows.length > 0) {
                    pageStatus[pageName] = pageContentRows[0].page_published !== 0; // Consider null/undefined as published
                } else {
                    pageStatus[pageName] = true; // Default to published if no content record exists
                }
            } catch (error) {
                // If table doesn't exist or query fails, assume published
                console.warn(`Warning: Could not check publication status for ${pageName}:`, error.message);
                pageStatus[pageName] = true;
            }
        }
        
        res.json({
            success: true,
            data: {
                model_id: modelId,
                model_slug: modelSlug,
                pages: pageStatus
            }
        });
        
    } catch (error) {
        console.error('Error fetching page status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch page status'
        });
    }
});

// Get publication status for a specific page
router.get('/:modelSlug/status/:pageName', async (req, res) => {
    try {
        const { modelSlug, pageName } = req.params;
        
        // Get model ID from slug
        const modelResult = await query('SELECT id FROM models WHERE slug = ?', [modelSlug]);
        if (modelResult.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Model not found'
            });
        }
        
        const modelId = modelResult[0].id;
        
        // Map of page names to their corresponding table names
        const pageTableMap = {
            'home': 'model_home_page_content',
            'about': 'model_about_page_content', 
            'rates': 'model_rates_page_content',
            'gallery': 'model_gallery_page_content',
            'contact': 'model_contact_page_content',
            'etiquette': 'model_etiquette_page_content',
            'calendar': 'model_calendar_page_content'
        };
        
        const tableName = pageTableMap[pageName];
        if (!tableName) {
            return res.status(400).json({
                success: false,
                message: `Invalid page name: ${pageName}`
            });
        }
        
        let isPublished = true; // Default to published
        
        try {
            const pageContentRows = await query(`
                SELECT page_published FROM ${tableName} WHERE model_id = ?
            `, [modelId]);
            
            if (pageContentRows.length > 0) {
                isPublished = pageContentRows[0].page_published !== 0; // Consider null/undefined as published
            }
        } catch (error) {
            // If table doesn't exist or query fails, assume published
            console.warn(`Warning: Could not check publication status for ${pageName}:`, error.message);
        }
        
        res.json({
            success: true,
            data: {
                model_id: modelId,
                model_slug: modelSlug,
                page_name: pageName,
                is_published: isPublished
            }
        });
        
    } catch (error) {
        console.error('Error fetching page status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch page status'
        });
    }
});

module.exports = router;