/**
 * Public Gallery API Routes
 * Part of Phase 5: Gallery Layouts Implementation
 * Provides gallery data for public model sites
 */

const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const logger = require('../../utils/logger');
const GalleryRenderingService = require('../../src/services/GalleryRenderingService');

// Initialize gallery rendering service
let galleryRenderer = null;

// Initialize service on first use
async function initializeGalleryRenderer() {
    if (!galleryRenderer) {
        galleryRenderer = new GalleryRenderingService(db);
        const result = await galleryRenderer.initialize();
        if (!result.success) {
            throw new Error(`Gallery renderer initialization failed: ${result.error}`);
        }
    }
    return galleryRenderer;
}

/**
 * GET /api/public-gallery/:modelSlug
 * Get all published gallery sections for a model (public endpoint)
 */
router.get('/:modelSlug', async (req, res) => {
    try {
        const { modelSlug } = req.params;
        const { format = 'json' } = req.query;

        // Validate model exists and is active
        const modelQuery = 'SELECT id, name, slug, status FROM models WHERE slug = ? AND status = "active"';
        const models = await db.query(modelQuery, [modelSlug]);
        
        if (!models || models.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Model not found or inactive'
            });
        }

        const model = models[0];

        // Initialize gallery renderer
        const renderer = await initializeGalleryRenderer();

        // Get published gallery sections
        const galleriesResult = await renderer.getPublishedGallerySections(modelSlug);

        if (!galleriesResult.success) {
            return res.status(500).json({
                success: false,
                message: 'Failed to load gallery sections',
                error: galleriesResult.error
            });
        }

        // Format response based on request
        if (format === 'html') {
            // Return complete HTML for galleries
            const galleryHtml = galleriesResult.sections.map(section => section.renderHtml).join('\n\n');
            const galleryScript = renderer.generateGalleryScript(galleriesResult.sections);
            
            const completeHtml = `
                <div class="model-galleries" data-model="${modelSlug}">
                    ${galleryHtml}
                </div>
                ${galleryScript}
            `;

            res.setHeader('Content-Type', 'text/html');
            return res.send(completeHtml);
        }

        // Return JSON data
        const response = {
            success: true,
            model: {
                id: model.id,
                name: model.name,
                slug: model.slug
            },
            galleries: {
                sections: galleriesResult.sections.map(section => ({
                    id: section.id,
                    name: section.section_name,
                    slug: section.section_slug,
                    layout_type: section.layout_type,
                    layout_settings: section.layout_settings,
                    section_order: section.section_order,
                    media_count: section.media.length,
                    media: section.media,
                    html: section.renderHtml
                })),
                totalSections: galleriesResult.totalSections,
                totalImages: galleriesResult.totalImages
            },
            generated_at: new Date().toISOString()
        };

        res.json(response);

    } catch (error) {
        logger.error('Public gallery API error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * GET /api/public-gallery/:modelSlug/:sectionSlug
 * Get a specific gallery section (public endpoint)
 */
router.get('/:modelSlug/:sectionSlug', async (req, res) => {
    try {
        const { modelSlug, sectionSlug } = req.params;
        const { format = 'json' } = req.query;

        // Validate model exists and is active
        const modelQuery = 'SELECT id, name, slug FROM models WHERE slug = ? AND status = "active"';
        const models = await db.query(modelQuery, [modelSlug]);
        
        if (!models || models.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Model not found or inactive'
            });
        }

        // Get specific section
        const sectionQuery = `
            SELECT id, section_name, section_slug, layout_type, layout_settings, section_order
            FROM model_gallery_sections 
            WHERE model_slug = ? AND section_slug = ? AND is_published = 1
        `;
        
        const sections = await db.query(sectionQuery, [modelSlug, sectionSlug]);
        
        if (!sections || sections.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Gallery section not found or not published'
            });
        }

        const section = sections[0];

        // Initialize gallery renderer
        const renderer = await initializeGalleryRenderer();

        // Get section media
        const mediaResult = await renderer.getSectionMedia(section.id);
        
        if (!mediaResult.success) {
            return res.status(500).json({
                success: false,
                message: 'Failed to load section media',
                error: mediaResult.error
            });
        }

        // Parse layout settings
        let layoutSettings = {};
        try {
            layoutSettings = typeof section.layout_settings === 'string' 
                ? JSON.parse(section.layout_settings) 
                : section.layout_settings || {};
        } catch (e) {
            console.warn(`Failed to parse layout settings for section ${section.id}:`, e);
            layoutSettings = {};
        }

        // Apply default settings
        const defaultSettings = renderer.defaultSettings[section.layout_type] || {};
        const mergedSettings = { ...defaultSettings, ...layoutSettings };

        // Render section HTML
        const sectionHtml = await renderer.renderSection(
            { ...section, layout_settings: mergedSettings }, 
            mediaResult.media, 
            mergedSettings
        );

        if (format === 'html') {
            const galleryScript = renderer.generateGalleryScript([{
                ...section,
                media: mediaResult.media
            }]);
            
            const completeHtml = sectionHtml + '\n' + galleryScript;
            
            res.setHeader('Content-Type', 'text/html');
            return res.send(completeHtml);
        }

        // Return JSON data
        const response = {
            success: true,
            section: {
                id: section.id,
                name: section.section_name,
                slug: section.section_slug,
                layout_type: section.layout_type,
                layout_settings: mergedSettings,
                section_order: section.section_order,
                media_count: mediaResult.media.length,
                media: mediaResult.media,
                html: sectionHtml
            },
            generated_at: new Date().toISOString()
        };

        res.json(response);

    } catch (error) {
        logger.error('Public gallery section API error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * GET /api/public-gallery/:modelSlug/stats
 * Get gallery statistics for a model (public endpoint)
 */
router.get('/:modelSlug/stats', async (req, res) => {
    try {
        const { modelSlug } = req.params;

        // Validate model exists and is active
        const modelQuery = 'SELECT id, name, slug FROM models WHERE slug = ? AND status = "active"';
        const models = await db.query(modelQuery, [modelSlug]);
        
        if (!models || models.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Model not found or inactive'
            });
        }

        // Get gallery statistics
        const statsQuery = `
            SELECT 
                COUNT(DISTINCT mgs.id) as total_sections,
                COUNT(DISTINCT mgsm.media_id) as total_images,
                COUNT(DISTINCT CASE WHEN mgs.layout_type = 'grid' THEN mgs.id END) as grid_sections,
                COUNT(DISTINCT CASE WHEN mgs.layout_type = 'masonry' THEN mgs.id END) as masonry_sections,
                COUNT(DISTINCT CASE WHEN mgs.layout_type = 'carousel' THEN mgs.id END) as carousel_sections,
                COUNT(DISTINCT CASE WHEN mgs.layout_type = 'lightbox_grid' THEN mgs.id END) as lightbox_sections,
                MIN(mgs.created_date) as first_section_created,
                MAX(mgs.modified_date) as last_section_updated
            FROM model_gallery_sections mgs
            LEFT JOIN model_gallery_section_media mgsm ON mgs.id = mgsm.section_id
            LEFT JOIN model_media_library mml ON mgsm.media_id = mml.id
            WHERE mgs.model_slug = ? 
              AND mgs.is_published = 1 
              AND (mml.id IS NULL OR (mml.is_deleted = 0 AND mml.moderation_status = 'approved'))
        `;

        const stats = await db.query(statsQuery, [modelSlug]);
        const statisticsData = stats[0] || {};

        const response = {
            success: true,
            model_slug: modelSlug,
            statistics: {
                total_sections: parseInt(statisticsData.total_sections) || 0,
                total_images: parseInt(statisticsData.total_images) || 0,
                layout_breakdown: {
                    grid: parseInt(statisticsData.grid_sections) || 0,
                    masonry: parseInt(statisticsData.masonry_sections) || 0,
                    carousel: parseInt(statisticsData.carousel_sections) || 0,
                    lightbox_grid: parseInt(statisticsData.lightbox_sections) || 0
                },
                first_section_created: statisticsData.first_section_created,
                last_section_updated: statisticsData.last_section_updated
            },
            generated_at: new Date().toISOString()
        };

        res.json(response);

    } catch (error) {
        logger.error('Public gallery stats API error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;