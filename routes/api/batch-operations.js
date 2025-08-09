/**
 * Batch Operations API Routes
 * Part of Phase C.5: Enhanced batch operation processing
 * Provides API endpoints for efficient batch media operations with progress tracking
 */

const express = require('express');
const router = express.Router();
const BatchOperationService = require('../../src/services/BatchOperationService');
const GalleryCacheService = require('../../src/services/GalleryCacheService');
const ImageProcessingQueue = require('../../src/services/ImageProcessingQueue');

// Initialize services
let batchService = null;

// Middleware to initialize batch service
router.use((req, res, next) => {
    if (!batchService && req.db) {
        const cacheService = new GalleryCacheService();
        const processingQueue = new ImageProcessingQueue(req.db);
        batchService = new BatchOperationService(req.db, cacheService, processingQueue);
        console.log('📦 BatchOperationService initialized for API routes');
    }
    next();
});

/**
 * POST /api/batch-operations/:modelSlug/execute
 * Execute a batch operation on multiple media items
 */
router.post('/:modelSlug/execute', async (req, res) => {
    try {
        if (!batchService) {
            return res.status(500).json({
                success: false,
                error: 'Batch service not initialized'
            });
        }

        const { modelSlug } = req.params;
        const { 
            operation, 
            mediaIds, 
            params = {}, 
            options = {} 
        } = req.body;

        if (!modelSlug || !operation || !mediaIds) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: modelSlug, operation, mediaIds'
            });
        }

        if (!Array.isArray(mediaIds) || mediaIds.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'mediaIds must be a non-empty array'
            });
        }

        // Validate operation type
        const validOperations = [
            'delete', 'approve', 'reject', 'set_category', 
            'set_featured', 'regenerate_thumbnails', 'extract_metadata'
        ];

        if (!validOperations.includes(operation)) {
            return res.status(400).json({
                success: false,
                error: `Invalid operation. Must be one of: ${validOperations.join(', ')}`
            });
        }

        // Execute batch operation
        const result = await batchService.executeBatchOperation(
            operation, 
            modelSlug, 
            mediaIds, 
            params, 
            options
        );

        res.json({
            success: result.success,
            batchId: result.batchId,
            operation: result.operation,
            modelSlug: result.modelSlug,
            totalItems: result.totalItems,
            successful: result.successful,
            failed: result.failed,
            processingTime: result.processingTime,
            results: result.results,
            errors: result.errors?.slice(0, 10) || [], // Limit error details
            message: result.success ? 
                `Batch ${operation} completed successfully` : 
                `Batch ${operation} completed with errors`
        });

    } catch (error) {
        console.error('❌ Error in batch operation API:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to execute batch operation'
        });
    }
});

/**
 * POST /api/batch-operations/:modelSlug/delete
 * Batch delete media items (convenience endpoint)
 */
router.post('/:modelSlug/delete', async (req, res) => {
    try {
        if (!batchService) {
            return res.status(500).json({
                success: false,
                error: 'Batch service not initialized'
            });
        }

        const { modelSlug } = req.params;
        const { mediaIds, hardDelete = false } = req.body;

        if (!modelSlug || !mediaIds || !Array.isArray(mediaIds)) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: modelSlug, mediaIds (array)'
            });
        }

        const result = await batchService.executeBatchOperation(
            'delete',
            modelSlug,
            mediaIds,
            { hardDelete },
            {}
        );

        res.json({
            success: result.success,
            batchId: result.batchId,
            modelSlug,
            totalItems: result.totalItems,
            deleted: result.successful,
            failed: result.failed,
            hardDelete,
            processingTime: result.processingTime
        });

    } catch (error) {
        console.error('❌ Error in batch delete API:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to execute batch delete'
        });
    }
});

/**
 * POST /api/batch-operations/:modelSlug/approve
 * Batch approve media items (convenience endpoint)
 */
router.post('/:modelSlug/approve', async (req, res) => {
    try {
        if (!batchService) {
            return res.status(500).json({
                success: false,
                error: 'Batch service not initialized'
            });
        }

        const { modelSlug } = req.params;
        const { mediaIds, approvedBy = 'api' } = req.body;

        if (!modelSlug || !mediaIds || !Array.isArray(mediaIds)) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: modelSlug, mediaIds (array)'
            });
        }

        const result = await batchService.executeBatchOperation(
            'approve',
            modelSlug,
            mediaIds,
            { approvedBy },
            {}
        );

        res.json({
            success: result.success,
            batchId: result.batchId,
            modelSlug,
            totalItems: result.totalItems,
            approved: result.successful,
            failed: result.failed,
            approvedBy,
            processingTime: result.processingTime
        });

    } catch (error) {
        console.error('❌ Error in batch approve API:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to execute batch approve'
        });
    }
});

/**
 * POST /api/batch-operations/:modelSlug/reject
 * Batch reject media items (convenience endpoint)
 */
router.post('/:modelSlug/reject', async (req, res) => {
    try {
        if (!batchService) {
            return res.status(500).json({
                success: false,
                error: 'Batch service not initialized'
            });
        }

        const { modelSlug } = req.params;
        const { mediaIds, reason = 'Batch rejection', rejectedBy = 'api' } = req.body;

        if (!modelSlug || !mediaIds || !Array.isArray(mediaIds)) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: modelSlug, mediaIds (array)'
            });
        }

        const result = await batchService.executeBatchOperation(
            'reject',
            modelSlug,
            mediaIds,
            { reason, rejectedBy },
            {}
        );

        res.json({
            success: result.success,
            batchId: result.batchId,
            modelSlug,
            totalItems: result.totalItems,
            rejected: result.successful,
            failed: result.failed,
            reason,
            rejectedBy,
            processingTime: result.processingTime
        });

    } catch (error) {
        console.error('❌ Error in batch reject API:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to execute batch reject'
        });
    }
});

/**
 * POST /api/batch-operations/:modelSlug/set-category
 * Batch set category for media items
 */
router.post('/:modelSlug/set-category', async (req, res) => {
    try {
        if (!batchService) {
            return res.status(500).json({
                success: false,
                error: 'Batch service not initialized'
            });
        }

        const { modelSlug } = req.params;
        const { mediaIds, categoryId } = req.body;

        if (!modelSlug || !mediaIds || !Array.isArray(mediaIds) || !categoryId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: modelSlug, mediaIds (array), categoryId'
            });
        }

        const result = await batchService.executeBatchOperation(
            'set_category',
            modelSlug,
            mediaIds,
            { categoryId },
            {}
        );

        res.json({
            success: result.success,
            batchId: result.batchId,
            modelSlug,
            totalItems: result.totalItems,
            updated: result.successful,
            failed: result.failed,
            categoryId,
            processingTime: result.processingTime
        });

    } catch (error) {
        console.error('❌ Error in batch set category API:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to execute batch set category'
        });
    }
});

/**
 * POST /api/batch-operations/:modelSlug/set-featured
 * Batch set featured status for media items
 */
router.post('/:modelSlug/set-featured', async (req, res) => {
    try {
        if (!batchService) {
            return res.status(500).json({
                success: false,
                error: 'Batch service not initialized'
            });
        }

        const { modelSlug } = req.params;
        const { mediaIds, featured = true } = req.body;

        if (!modelSlug || !mediaIds || !Array.isArray(mediaIds)) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: modelSlug, mediaIds (array)'
            });
        }

        const result = await batchService.executeBatchOperation(
            'set_featured',
            modelSlug,
            mediaIds,
            { featured },
            {}
        );

        res.json({
            success: result.success,
            batchId: result.batchId,
            modelSlug,
            totalItems: result.totalItems,
            updated: result.successful,
            failed: result.failed,
            featured,
            processingTime: result.processingTime
        });

    } catch (error) {
        console.error('❌ Error in batch set featured API:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to execute batch set featured'
        });
    }
});

/**
 * POST /api/batch-operations/:modelSlug/regenerate-thumbnails
 * Batch regenerate thumbnails for media items
 */
router.post('/:modelSlug/regenerate-thumbnails', async (req, res) => {
    try {
        if (!batchService) {
            return res.status(500).json({
                success: false,
                error: 'Batch service not initialized'
            });
        }

        const { modelSlug } = req.params;
        const { mediaIds, sizes = ['medium'] } = req.body;

        if (!modelSlug || !mediaIds || !Array.isArray(mediaIds)) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: modelSlug, mediaIds (array)'
            });
        }

        if (!Array.isArray(sizes) || sizes.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'sizes must be a non-empty array'
            });
        }

        const result = await batchService.executeBatchOperation(
            'regenerate_thumbnails',
            modelSlug,
            mediaIds,
            { sizes },
            {}
        );

        res.json({
            success: result.success,
            batchId: result.batchId,
            modelSlug,
            totalItems: result.totalItems,
            queued: result.successful,
            failed: result.failed,
            sizes,
            processingTime: result.processingTime,
            message: 'Thumbnail regeneration jobs have been queued for background processing'
        });

    } catch (error) {
        console.error('❌ Error in batch regenerate thumbnails API:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to execute batch thumbnail regeneration'
        });
    }
});

/**
 * GET /api/batch-operations/batch/:batchId/status
 * Get status of a specific batch operation
 */
router.get('/batch/:batchId/status', (req, res) => {
    try {
        if (!batchService) {
            return res.status(500).json({
                success: false,
                error: 'Batch service not initialized'
            });
        }

        const { batchId } = req.params;

        if (!batchId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameter: batchId'
            });
        }

        const batchStatus = batchService.getBatchStatus(batchId);

        if (!batchStatus) {
            return res.status(404).json({
                success: false,
                error: 'Batch operation not found'
            });
        }

        // Calculate progress percentage
        const progressPercentage = batchStatus.totalItems > 0 ? 
            Math.round((batchStatus.processedItems / batchStatus.totalItems) * 100) : 0;

        res.json({
            success: true,
            batch: {
                id: batchStatus.id,
                operation: batchStatus.operation,
                modelSlug: batchStatus.modelSlug,
                status: batchStatus.status,
                totalItems: batchStatus.totalItems,
                processedItems: batchStatus.processedItems,
                successfulItems: batchStatus.successfulItems,
                failedItems: batchStatus.failedItems,
                progressPercentage,
                startTime: batchStatus.startTime,
                completedAt: batchStatus.completedAt,
                processingTime: batchStatus.processingTime,
                error: batchStatus.error
            }
        });

    } catch (error) {
        console.error('❌ Error getting batch status:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get batch status'
        });
    }
});

/**
 * GET /api/batch-operations/active
 * Get all active batch operations
 */
router.get('/active', (req, res) => {
    try {
        if (!batchService) {
            return res.status(500).json({
                success: false,
                error: 'Batch service not initialized'
            });
        }

        const activeBatches = batchService.getActiveBatches();

        const formattedBatches = activeBatches.map(batch => ({
            id: batch.id,
            operation: batch.operation,
            modelSlug: batch.modelSlug,
            status: batch.status,
            totalItems: batch.totalItems,
            processedItems: batch.processedItems,
            successfulItems: batch.successfulItems,
            failedItems: batch.failedItems,
            progressPercentage: batch.totalItems > 0 ? 
                Math.round((batch.processedItems / batch.totalItems) * 100) : 0,
            startTime: batch.startTime,
            elapsedTime: Date.now() - batch.startTime
        }));

        res.json({
            success: true,
            activeBatches: formattedBatches,
            totalActive: formattedBatches.length
        });

    } catch (error) {
        console.error('❌ Error getting active batches:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get active batches'
        });
    }
});

/**
 * GET /api/batch-operations/history
 * Get batch operation history
 */
router.get('/history', (req, res) => {
    try {
        if (!batchService) {
            return res.status(500).json({
                success: false,
                error: 'Batch service not initialized'
            });
        }

        const { limit = 20 } = req.query;
        const batchHistory = batchService.getBatchHistory(parseInt(limit));

        const formattedHistory = batchHistory.map(batch => ({
            id: batch.id,
            operation: batch.operation,
            modelSlug: batch.modelSlug,
            status: batch.status,
            totalItems: batch.totalItems,
            successfulItems: batch.successfulItems,
            failedItems: batch.failedItems,
            startTime: batch.startTime,
            completedAt: batch.completedAt,
            processingTime: batch.processingTime,
            error: batch.error
        }));

        res.json({
            success: true,
            history: formattedHistory,
            totalReturned: formattedHistory.length,
            limit: parseInt(limit)
        });

    } catch (error) {
        console.error('❌ Error getting batch history:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get batch history'
        });
    }
});

/**
 * GET /api/batch-operations/statistics
 * Get batch service statistics
 */
router.get('/statistics', (req, res) => {
    try {
        if (!batchService) {
            return res.status(500).json({
                success: false,
                error: 'Batch service not initialized'
            });
        }

        const stats = batchService.getServiceStatistics();

        res.json({
            success: true,
            statistics: {
                ...stats,
                supportedOperations: [
                    'delete', 'approve', 'reject', 'set_category', 
                    'set_featured', 'regenerate_thumbnails', 'extract_metadata'
                ],
                uptime: process.uptime()
            }
        });

    } catch (error) {
        console.error('❌ Error getting batch service statistics:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get service statistics'
        });
    }
});

module.exports = router;