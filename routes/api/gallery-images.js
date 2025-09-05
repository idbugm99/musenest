const express = require('express');
const router = express.Router();
const { query } = require('../../config/database');

// Get approved gallery images for a model (for home page preview)
router.get('/:modelSlug/approved', async (req, res) => {
    try {
        const { modelSlug } = req.params;
        const limit = parseInt(req.query.limit) || 10;
        
        // Get model ID from slug
        const modelResult = await query('SELECT id FROM models WHERE slug = ?', [modelSlug]);
        if (modelResult.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Model not found'
            });
        }
        
        const modelId = modelResult[0].id;
        
        // Get approved gallery images
        const images = await query(`
            SELECT gi.id, gi.filename, gi.caption
            FROM gallery_images gi
            LEFT JOIN content_moderation cm ON cm.model_id = gi.model_id AND cm.original_path LIKE CONCAT('%', gi.filename)
            WHERE gi.model_id = ? AND gi.is_active = 1 
            AND (cm.moderation_status = 'approved' OR cm.moderation_status IS NULL)
            ORDER BY gi.sort_order ASC, gi.created_at DESC
            LIMIT ?
        `, [modelId, limit]);
        
        res.json({
            success: true,
            data: images
        });
        
    } catch (error) {
        console.error('Error fetching approved gallery images:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch gallery images'
        });
    }
});

// Get specific image by ID (for portrait/hero background loading)
router.get('/:modelSlug/image/:imageId', async (req, res) => {
    try {
        const { modelSlug, imageId } = req.params;
        
        // Get model ID from slug
        const modelResult = await query('SELECT id FROM models WHERE slug = ?', [modelSlug]);
        if (modelResult.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Model not found'
            });
        }
        
        const modelId = modelResult[0].id;
        
        // Get specific image with moderation check
        const images = await query(`
            SELECT gi.id, gi.filename, gi.caption, gi.model_id, gi.is_active
            FROM gallery_images gi
            LEFT JOIN content_moderation cm ON cm.model_id = gi.model_id AND cm.original_path LIKE CONCAT('%', gi.filename)
            WHERE gi.id = ? AND gi.model_id = ? AND gi.is_active = 1
            AND (cm.moderation_status = 'approved' OR cm.moderation_status IS NULL)
            LIMIT 1
        `, [imageId, modelId]);
        
        if (images.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Image not found or not approved'
            });
        }
        
        res.json({
            success: true,
            data: images[0]
        });
        
    } catch (error) {
        console.error('Error fetching gallery image:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch gallery image'
        });
    }
});

// Get image by ID without moderation check (for debugging)
router.get('/debug/:imageId', async (req, res) => {
    try {
        const { imageId } = req.params;
        
        // Get image without moderation filtering
        const images = await query(`
            SELECT id, filename, model_id, is_active FROM gallery_images WHERE id = ?
        `, [imageId]);
        
        res.json({
            success: true,
            data: images
        });
        
    } catch (error) {
        console.error('Error fetching image debug info:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch image debug info'
        });
    }
});

// Get home page hero background image for a model
router.get('/:modelSlug/hero-background', async (req, res) => {
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
        
        // Get home page hero background image ID
        const homeContent = await query(`
            SELECT hero_background_image_id FROM model_home_page_content WHERE model_id = ?
        `, [modelId]);
        
        if (homeContent.length === 0 || !homeContent[0].hero_background_image_id) {
            return res.status(404).json({
                success: false,
                message: 'No hero background image set'
            });
        }
        
        // Get the actual image
        const heroImage = await query(`
            SELECT gi.filename FROM gallery_images gi
            WHERE gi.id = ? AND gi.model_id = ? AND gi.is_active = 1
            LIMIT 1
        `, [homeContent[0].hero_background_image_id, modelId]);
        
        if (heroImage.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Hero background image not found'
            });
        }
        
        res.json({
            success: true,
            data: {
                id: homeContent[0].hero_background_image_id,
                filename: heroImage[0].filename
            }
        });
        
    } catch (error) {
        console.error('Error fetching hero background image:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch hero background image'
        });
    }
});

module.exports = router;