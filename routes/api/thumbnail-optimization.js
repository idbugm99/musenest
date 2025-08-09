/**
 * Thumbnail Optimization API Routes
 * Part of Phase C.4: Thumbnail generation optimization
 * Provides API endpoints for intelligent thumbnail generation and management
 */

const express = require('express');
const router = express.Router();
const ThumbnailOptimizationService = require('../../src/services/ThumbnailOptimizationService');
const GalleryCacheService = require('../../src/services/GalleryCacheService');
const ImageProcessingQueue = require('../../src/services/ImageProcessingQueue');

// Initialize services
let thumbnailService = null;

// Middleware to initialize thumbnail service
router.use((req, res, next) => {
    if (!thumbnailService && req.db) {
        const cacheService = new GalleryCacheService();
        const processingQueue = new ImageProcessingQueue(req.db);
        thumbnailService = new ThumbnailOptimizationService(cacheService, processingQueue);
        console.log('📸 ThumbnailOptimizationService initialized for API routes');
    }
    next();
});

/**
 * POST /api/thumbnail-optimization/:modelSlug/:mediaId/generate
 * Generate optimized thumbnail for specific media
 */
router.post('/:modelSlug/:mediaId/generate', async (req, res) => {
    try {
        if (!thumbnailService) {
            return res.status(500).json({
                success: false,
                error: 'Thumbnail service not initialized'
            });
        }

        const { modelSlug, mediaId } = req.params;
        const { 
            size = 'medium',
            options = {},
            background = false 
        } = req.body;

        if (!modelSlug || !mediaId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters: modelSlug, mediaId'
            });
        }

        // Get media file path from database
        const [mediaRows] = await req.db.execute(`
            SELECT filename, file_path, model_slug
            FROM model_media_library 
            WHERE id = ? AND model_slug = ? AND is_deleted = 0
        `, [mediaId, modelSlug]);

        if (!mediaRows.length) {
            return res.status(404).json({
                success: false,
                error: 'Media not found'
            });
        }

        const media = mediaRows[0];
        const path = require('path');
        const originalPath = path.join(__dirname, '../../public/uploads', media.model_slug, 'originals', media.filename);

        if (background) {
            // Queue for background processing
            const jobId = await thumbnailService.queueThumbnailGeneration(
                modelSlug, 
                mediaId, 
                [size], 
                { ...options, priority: 'normal' }
            );

            res.json({
                success: true,
                message: 'Thumbnail generation queued for background processing',
                jobId,
                mediaId,
                size
            });
        } else {
            // Generate immediately
            const result = await thumbnailService.getOptimizedThumbnail(
                modelSlug, 
                originalPath, 
                size, 
                options
            );

            if (!result.success) {
                return res.status(500).json(result);
            }

            res.json({
                success: true,
                thumbnail: {
                    url: result.thumbnailUrl,
                    path: result.thumbnailPath,
                    size: result.size,
                    dimensions: result.dimensions,
                    fileSize: result.fileSize
                },
                cached: result.cached,
                processingTime: result.processingTime,
                mediaId,
                modelSlug
            });
        }

    } catch (error) {
        console.error('❌ Error in thumbnail generation API:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to generate thumbnail'
        });
    }
});

/**
 * POST /api/thumbnail-optimization/:modelSlug/:mediaId/generate-multiple
 * Generate multiple thumbnail sizes for media
 */
router.post('/:modelSlug/:mediaId/generate-multiple', async (req, res) => {
    try {
        if (!thumbnailService) {
            return res.status(500).json({
                success: false,
                error: 'Thumbnail service not initialized'
            });
        }

        const { modelSlug, mediaId } = req.params;
        const { 
            sizes = ['small', 'medium', 'large'],
            options = {},
            background = false 
        } = req.body;

        if (!modelSlug || !mediaId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters: modelSlug, mediaId'
            });
        }

        if (!Array.isArray(sizes) || sizes.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Sizes must be a non-empty array'
            });
        }

        if (sizes.length > 10) {
            return res.status(400).json({
                success: false,
                error: 'Maximum 10 thumbnail sizes per request'
            });
        }

        // Get media file path from database
        const [mediaRows] = await req.db.execute(`
            SELECT filename, file_path, model_slug
            FROM model_media_library 
            WHERE id = ? AND model_slug = ? AND is_deleted = 0
        `, [mediaId, modelSlug]);

        if (!mediaRows.length) {
            return res.status(404).json({
                success: false,
                error: 'Media not found'
            });
        }

        const media = mediaRows[0];
        const path = require('path');
        const originalPath = path.join(__dirname, '../../public/uploads', media.model_slug, 'originals', media.filename);

        if (background) {
            // Queue for background processing
            const jobId = await thumbnailService.queueThumbnailGeneration(
                modelSlug, 
                mediaId, 
                sizes, 
                { ...options, priority: 'high' } // Higher priority for multi-generation
            );

            res.json({
                success: true,
                message: 'Multiple thumbnail generation queued for background processing',
                jobId,
                mediaId,
                sizes,
                totalSizes: sizes.length
            });
        } else {
            // Generate immediately
            const result = await thumbnailService.generateMultipleThumbnails(
                modelSlug, 
                originalPath, 
                sizes, 
                options
            );

            res.json({
                success: result.success,
                thumbnails: result.results.map(r => ({
                    size: r.size,
                    success: r.success,
                    url: r.thumbnailUrl,
                    dimensions: r.dimensions,
                    fileSize: r.fileSize,
                    cached: r.cached,
                    error: r.error
                })),
                successful: result.successful,
                failed: result.failed,
                totalProcessingTime: result.totalProcessingTime,
                mediaId,
                modelSlug
            });
        }

    } catch (error) {
        console.error('❌ Error in multiple thumbnail generation API:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to generate multiple thumbnails'
        });
    }
});

/**
 * POST /api/thumbnail-optimization/:modelSlug/batch-generate
 * Generate thumbnails for multiple media items
 */
router.post('/:modelSlug/batch-generate', async (req, res) => {
    try {
        if (!thumbnailService) {
            return res.status(500).json({
                success: false,
                error: 'Thumbnail service not initialized'
            });
        }

        const { modelSlug } = req.params;
        const { 
            mediaIds,
            sizes = ['medium'],
            options = {},
            background = true // Default to background for batch operations
        } = req.body;

        if (!modelSlug || !mediaIds || !Array.isArray(mediaIds)) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: modelSlug, mediaIds (array)'
            });
        }

        if (mediaIds.length === 0) {
            return res.json({
                success: true,
                jobs: [],
                message: 'No media IDs provided'
            });
        }

        if (mediaIds.length > 50) {
            return res.status(400).json({
                success: false,
                error: 'Maximum 50 media items per batch request'
            });
        }

        // Verify media exists
        const placeholders = mediaIds.map(() => '?').join(',');
        const [mediaRows] = await req.db.execute(`
            SELECT id, filename, model_slug
            FROM model_media_library 
            WHERE id IN (${placeholders}) AND model_slug = ? AND is_deleted = 0
        `, [...mediaIds, modelSlug]);

        const foundMediaIds = mediaRows.map(row => row.id);
        const missingIds = mediaIds.filter(id => !foundMediaIds.includes(parseInt(id)));

        if (background) {
            // Queue each media item for background processing
            const jobs = [];
            
            for (const mediaId of foundMediaIds) {
                try {
                    const jobId = await thumbnailService.queueThumbnailGeneration(
                        modelSlug, 
                        mediaId, 
                        sizes, 
                        { ...options, priority: 'low' } // Lower priority for batch
                    );
                    
                    jobs.push({
                        mediaId,
                        jobId,
                        success: true
                    });
                } catch (error) {
                    jobs.push({
                        mediaId,
                        success: false,
                        error: error.message
                    });
                }
            }

            res.json({
                success: true,
                message: 'Batch thumbnail generation queued',
                jobs,
                totalRequested: mediaIds.length,
                queued: jobs.filter(j => j.success).length,
                failed: jobs.filter(j => !j.success).length,
                missingMediaIds: missingIds,
                sizes
            });

        } else {
            return res.status(400).json({
                success: false,
                error: 'Synchronous batch generation not supported. Use background=true for batch operations.'
            });
        }

    } catch (error) {
        console.error('❌ Error in batch thumbnail generation API:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to queue batch thumbnail generation'
        });
    }
});

/**
 * GET /api/thumbnail-optimization/:modelSlug/statistics
 * Get thumbnail statistics for a model
 */
router.get('/:modelSlug/statistics', async (req, res) => {
    try {
        if (!thumbnailService) {
            return res.status(500).json({
                success: false,
                error: 'Thumbnail service not initialized'
            });
        }

        const { modelSlug } = req.params;

        if (!modelSlug) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameter: modelSlug'
            });
        }

        const stats = await thumbnailService.getThumbnailStatistics(modelSlug);

        res.json({
            success: stats.success,
            statistics: stats.success ? {
                modelSlug: stats.modelSlug,
                totalThumbnails: stats.totalThumbnails,
                totalSize: stats.totalSize,
                totalSizeFormatted: `${Math.round(stats.totalSize / 1024)} KB`,
                averageSize: stats.averageSize,
                averageSizeFormatted: `${Math.round(stats.averageSize / 1024)} KB`,
                sizesByType: stats.sizesByType,
                activeGenerations: stats.activeGenerations
            } : null,
            error: stats.error
        });

    } catch (error) {
        console.error('❌ Error getting thumbnail statistics:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get thumbnail statistics'
        });
    }
});

/**
 * DELETE /api/thumbnail-optimization/:modelSlug/cleanup
 * Clean up old thumbnails for a model
 */
router.delete('/:modelSlug/cleanup', async (req, res) => {
    try {
        if (!thumbnailService) {
            return res.status(500).json({
                success: false,
                error: 'Thumbnail service not initialized'
            });
        }

        const { modelSlug } = req.params;
        const { maxAge = 30, dryRun = false } = req.query;

        if (!modelSlug) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameter: modelSlug'
            });
        }

        const maxAgeDays = parseInt(maxAge);
        if (isNaN(maxAgeDays) || maxAgeDays < 1) {
            return res.status(400).json({
                success: false,
                error: 'maxAge must be a positive number of days'
            });
        }

        if (dryRun === 'true') {
            // Just return statistics without cleaning
            const stats = await thumbnailService.getThumbnailStatistics(modelSlug);
            
            res.json({
                success: true,
                dryRun: true,
                message: `Would clean thumbnails older than ${maxAgeDays} days`,
                currentStats: stats,
                parameters: { modelSlug, maxAge: maxAgeDays }
            });
        } else {
            const result = await thumbnailService.cleanupOldThumbnails(modelSlug, maxAgeDays);

            res.json({
                success: result.success,
                message: `Cleaned up old thumbnails for ${modelSlug}`,
                cleaned: result.cleaned,
                freedSpace: result.freedSpace,
                freedSpaceFormatted: `${Math.round(result.freedSpace / 1024)} KB`,
                processingTime: result.processingTime,
                parameters: { modelSlug, maxAge: maxAgeDays }
            });
        }

    } catch (error) {
        console.error('❌ Error in thumbnail cleanup API:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to cleanup thumbnails'
        });
    }
});

/**
 * GET /api/thumbnail-optimization/service-info
 * Get thumbnail service configuration and status
 */
router.get('/service-info', (req, res) => {
    try {
        if (!thumbnailService) {
            return res.status(500).json({
                success: false,
                error: 'Thumbnail service not initialized'
            });
        }

        res.json({
            success: true,
            serviceInfo: {
                availableSizes: Object.keys(thumbnailService.thumbnailSizes),
                sizeConfigurations: thumbnailService.thumbnailSizes,
                maxConcurrency: thumbnailService.generateConcurrency,
                cacheSettings: {
                    defaultTTL: thumbnailService.thumbnailCacheTTL,
                    ttlFormatted: `${Math.round(thumbnailService.thumbnailCacheTTL / 3600)} hours`
                },
                currentStatus: {
                    activeGenerations: thumbnailService.activeGenerations.size,
                    uptime: process.uptime()
                }
            }
        });

    } catch (error) {
        console.error('❌ Error getting service info:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get service information'
        });
    }
});

module.exports = router;