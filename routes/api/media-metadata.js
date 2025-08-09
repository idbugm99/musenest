/**
 * Media Metadata API Routes
 * Part of Phase C.3: Optimize media metadata handling
 * Provides efficient API endpoints for media metadata with caching
 */

const express = require('express');
const router = express.Router();
const MediaMetadataService = require('../../src/services/MediaMetadataService');
const GalleryCacheService = require('../../src/services/GalleryCacheService');

// Initialize services
let metadataService = null;

// Middleware to initialize metadata service
router.use((req, res, next) => {
    if (!metadataService && req.db) {
        const cacheService = new GalleryCacheService();
        metadataService = new MediaMetadataService(req.db, cacheService);
        console.log('📊 MediaMetadataService initialized for API routes');
    }
    next();
});

/**
 * GET /api/media-metadata/:modelSlug/:mediaId
 * Get metadata for a single media item
 */
router.get('/:modelSlug/:mediaId', async (req, res) => {
    try {
        if (!metadataService) {
            return res.status(500).json({
                success: false,
                error: 'Metadata service not initialized'
            });
        }

        const { modelSlug, mediaId } = req.params;
        const { extended = 'false', fresh = 'false' } = req.query;
        
        const includeExtraData = extended === 'true';
        const bypassCache = fresh === 'true';

        if (!modelSlug || !mediaId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters: modelSlug, mediaId'
            });
        }

        // If fresh data requested, invalidate cache first
        if (bypassCache) {
            await metadataService.invalidateMetadataCache(modelSlug, mediaId);
        }

        const result = await metadataService.getMediaMetadata(modelSlug, mediaId, includeExtraData);
        
        if (!result.success) {
            return res.status(404).json(result);
        }

        res.json({
            success: true,
            data: result.metadata,
            cached: result.cached,
            loadTime: result.loadTime,
            extended: includeExtraData
        });

    } catch (error) {
        console.error('❌ Error in media metadata API:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve media metadata'
        });
    }
});

/**
 * POST /api/media-metadata/:modelSlug/batch
 * Get metadata for multiple media items
 */
router.post('/:modelSlug/batch', async (req, res) => {
    try {
        if (!metadataService) {
            return res.status(500).json({
                success: false,
                error: 'Metadata service not initialized'
            });
        }

        const { modelSlug } = req.params;
        const { mediaIds, extended = false, fresh = false } = req.body;

        if (!modelSlug || !mediaIds || !Array.isArray(mediaIds)) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: modelSlug, mediaIds (array)'
            });
        }

        if (mediaIds.length === 0) {
            return res.json({
                success: true,
                data: [],
                totalRequested: 0,
                successful: 0,
                cached: 0,
                loadTime: 0
            });
        }

        if (mediaIds.length > 100) {
            return res.status(400).json({
                success: false,
                error: 'Maximum 100 media items per batch request'
            });
        }

        // If fresh data requested, invalidate cache first
        if (fresh) {
            await metadataService.invalidateMetadataCache(modelSlug, mediaIds);
        }

        const result = await metadataService.getBatchMediaMetadata(modelSlug, mediaIds, extended);

        res.json({
            success: result.success,
            data: result.results.map(r => ({
                mediaId: r.mediaId,
                success: r.success,
                metadata: r.metadata,
                cached: r.cached,
                error: r.error
            })),
            totalRequested: result.totalRequested,
            successful: result.successful,
            cached: result.cached,
            loadTime: result.loadTime,
            extended
        });

    } catch (error) {
        console.error('❌ Error in batch metadata API:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve batch metadata'
        });
    }
});

/**
 * PUT /api/media-metadata/:modelSlug/:mediaId
 * Update media metadata
 */
router.put('/:modelSlug/:mediaId', async (req, res) => {
    try {
        if (!metadataService) {
            return res.status(500).json({
                success: false,
                error: 'Metadata service not initialized'
            });
        }

        const { modelSlug, mediaId } = req.params;
        const updates = req.body;

        if (!modelSlug || !mediaId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters: modelSlug, mediaId'
            });
        }

        if (!updates || Object.keys(updates).length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No update data provided'
            });
        }

        const result = await metadataService.updateMediaMetadata(modelSlug, mediaId, updates);

        if (!result.success) {
            return res.status(400).json(result);
        }

        res.json({
            success: true,
            message: 'Media metadata updated successfully',
            updatedFields: result.updatedFields,
            affectedRows: result.affectedRows
        });

    } catch (error) {
        console.error('❌ Error updating media metadata:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to update media metadata'
        });
    }
});

/**
 * DELETE /api/media-metadata/:modelSlug/:mediaId/cache
 * Invalidate metadata cache for specific media
 */
router.delete('/:modelSlug/:mediaId/cache', async (req, res) => {
    try {
        if (!metadataService) {
            return res.status(500).json({
                success: false,
                error: 'Metadata service not initialized'
            });
        }

        const { modelSlug, mediaId } = req.params;

        if (!modelSlug || !mediaId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters: modelSlug, mediaId'
            });
        }

        await metadataService.invalidateMetadataCache(modelSlug, mediaId);

        console.log(`🗑️ Cache invalidated via API for ${modelSlug}:${mediaId}`);

        res.json({
            success: true,
            message: 'Metadata cache invalidated successfully',
            modelSlug,
            mediaId
        });

    } catch (error) {
        console.error('❌ Error invalidating metadata cache:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to invalidate metadata cache'
        });
    }
});

/**
 * DELETE /api/media-metadata/:modelSlug/cache
 * Invalidate all metadata cache for a model
 */
router.delete('/:modelSlug/cache', async (req, res) => {
    try {
        if (!metadataService) {
            return res.status(500).json({
                success: false,
                error: 'Metadata service not initialized'
            });
        }

        const { modelSlug } = req.params;

        if (!modelSlug) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameter: modelSlug'
            });
        }

        // Invalidate all cache for the model
        await metadataService.cacheService.invalidateAllForModel(modelSlug);

        console.log(`🗑️ All cache invalidated via API for model: ${modelSlug}`);

        res.json({
            success: true,
            message: 'All metadata cache invalidated successfully for model',
            modelSlug
        });

    } catch (error) {
        console.error('❌ Error invalidating model metadata cache:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to invalidate model metadata cache'
        });
    }
});

/**
 * GET /api/media-metadata/statistics
 * Get metadata service statistics
 */
router.get('/statistics', async (req, res) => {
    try {
        if (!metadataService) {
            return res.status(500).json({
                success: false,
                error: 'Metadata service not initialized'
            });
        }

        const stats = await metadataService.getServiceStatistics();

        res.json({
            success: true,
            statistics: stats
        });

    } catch (error) {
        console.error('❌ Error getting metadata service statistics:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get service statistics'
        });
    }
});

/**
 * GET /api/media-metadata/:modelSlug/search
 * Search media by metadata criteria
 */
router.get('/:modelSlug/search', async (req, res) => {
    try {
        if (!metadataService) {
            return res.status(500).json({
                success: false,
                error: 'Metadata service not initialized'
            });
        }

        const { modelSlug } = req.params;
        const {
            status = 'all',
            category = 'all',
            featured = 'all',
            limit = 50,
            offset = 0,
            sortBy = 'upload_date',
            sortOrder = 'DESC'
        } = req.query;

        if (!modelSlug) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameter: modelSlug'
            });
        }

        // Build search query
        let whereConditions = ['model_slug = ? AND is_deleted = 0'];
        let queryParams = [modelSlug];

        // Add status filter
        if (status !== 'all') {
            whereConditions.push('moderation_status = ?');
            queryParams.push(status);
        }

        // Add category filter
        if (category !== 'all') {
            whereConditions.push('category_id = ?');
            queryParams.push(category);
        }

        // Add featured filter
        if (featured !== 'all') {
            whereConditions.push('is_featured = ?');
            queryParams.push(featured === 'true' ? 1 : 0);
        }

        // Build final query
        const searchQuery = `
            SELECT id 
            FROM model_media_library 
            WHERE ${whereConditions.join(' AND ')}
            ORDER BY ${sortBy} ${sortOrder}
            LIMIT ? OFFSET ?
        `;

        queryParams.push(parseInt(limit), parseInt(offset));

        const [rows] = await metadataService.db.execute(searchQuery, queryParams);
        const mediaIds = rows.map(row => row.id);

        if (mediaIds.length === 0) {
            return res.json({
                success: true,
                data: [],
                totalResults: 0,
                limit: parseInt(limit),
                offset: parseInt(offset)
            });
        }

        // Get metadata for found media
        const metadataResult = await metadataService.getBatchMediaMetadata(modelSlug, mediaIds, false);

        res.json({
            success: true,
            data: metadataResult.results.filter(r => r.success),
            totalResults: mediaIds.length,
            successful: metadataResult.successful,
            limit: parseInt(limit),
            offset: parseInt(offset),
            filters: { status, category, featured, sortBy, sortOrder }
        });

    } catch (error) {
        console.error('❌ Error in metadata search API:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to search media metadata'
        });
    }
});

module.exports = router;