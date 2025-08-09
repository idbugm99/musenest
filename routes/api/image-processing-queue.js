/**
 * Image Processing Queue API Routes
 * Part of Phase C.2: Background Processing Implementation
 * Provides API endpoints for managing background image processing jobs
 */

const express = require('express');
const router = express.Router();
const ImageProcessingQueue = require('../../src/services/ImageProcessingQueue');

// Initialize processing queue (will be set by middleware)
let processingQueue = null;

// Middleware to initialize processing queue with database connection
router.use((req, res, next) => {
    if (!processingQueue && req.db) {
        processingQueue = new ImageProcessingQueue(req.db, 3); // Max 3 concurrent jobs
        console.log('⚡ ImageProcessingQueue initialized for API routes');
    }
    next();
});

/**
 * POST /api/image-processing-queue/crop
 * Add a crop job to the background processing queue
 */
router.post('/crop', async (req, res) => {
    try {
        if (!processingQueue) {
            return res.status(500).json({
                success: false,
                error: 'Processing queue not initialized'
            });
        }

        const { mediaId, cropParams, modelSlug, priority = 'normal' } = req.body;

        if (!mediaId || !cropParams || !modelSlug) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: mediaId, cropParams, modelSlug'
            });
        }

        const jobId = processingQueue.addCropJob({
            mediaId,
            cropParams,
            modelSlug,
            priority
        });

        console.log(`📋 Added crop job via API: ${jobId} for media ${mediaId}`);

        res.json({
            success: true,
            message: 'Crop job added to processing queue',
            jobId,
            estimatedWaitTime: processingQueue.getQueueStatistics().pending * 10 // Rough estimate
        });

    } catch (error) {
        console.error('❌ Error adding crop job:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to add crop job to queue'
        });
    }
});

/**
 * POST /api/image-processing-queue/watermark
 * Add a watermark job to the background processing queue
 */
router.post('/watermark', async (req, res) => {
    try {
        if (!processingQueue) {
            return res.status(500).json({
                success: false,
                error: 'Processing queue not initialized'
            });
        }

        const { mediaId, modelSlug, watermarkSettings, priority = 'normal' } = req.body;

        if (!mediaId || !modelSlug) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: mediaId, modelSlug'
            });
        }

        const jobId = processingQueue.addWatermarkJob({
            mediaId,
            modelSlug,
            watermarkSettings: watermarkSettings || {},
            priority
        });

        console.log(`📋 Added watermark job via API: ${jobId} for media ${mediaId}`);

        res.json({
            success: true,
            message: 'Watermark job added to processing queue',
            jobId,
            estimatedWaitTime: processingQueue.getQueueStatistics().pending * 15
        });

    } catch (error) {
        console.error('❌ Error adding watermark job:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to add watermark job to queue'
        });
    }
});

/**
 * POST /api/image-processing-queue/thumbnails
 * Add a thumbnail generation job to the background processing queue
 */
router.post('/thumbnails', async (req, res) => {
    try {
        if (!processingQueue) {
            return res.status(500).json({
                success: false,
                error: 'Processing queue not initialized'
            });
        }

        const { mediaId, modelSlug, sizes = ['400x400', '200x200', '100x100'], priority = 'low' } = req.body;

        if (!mediaId || !modelSlug) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: mediaId, modelSlug'
            });
        }

        const jobId = processingQueue.addThumbnailJob({
            mediaId,
            modelSlug,
            sizes,
            priority
        });

        console.log(`📋 Added thumbnail job via API: ${jobId} for media ${mediaId}`);

        res.json({
            success: true,
            message: 'Thumbnail generation job added to processing queue',
            jobId,
            sizes,
            estimatedWaitTime: processingQueue.getQueueStatistics().pending * 8
        });

    } catch (error) {
        console.error('❌ Error adding thumbnail job:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to add thumbnail job to queue'
        });
    }
});

/**
 * POST /api/image-processing-queue/batch
 * Add a batch processing job to the queue
 */
router.post('/batch', async (req, res) => {
    try {
        if (!processingQueue) {
            return res.status(500).json({
                success: false,
                error: 'Processing queue not initialized'
            });
        }

        const { operation, mediaIds, modelSlug, params = {}, priority = 'high' } = req.body;

        if (!operation || !mediaIds || !Array.isArray(mediaIds) || !modelSlug) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: operation, mediaIds (array), modelSlug'
            });
        }

        const validOperations = ['delete', 'approve', 'set_category'];
        if (!validOperations.includes(operation)) {
            return res.status(400).json({
                success: false,
                error: `Invalid operation. Must be one of: ${validOperations.join(', ')}`
            });
        }

        const jobId = processingQueue.addBatchJob({
            operation,
            mediaIds,
            modelSlug,
            params,
            priority
        });

        console.log(`📋 Added batch ${operation} job via API: ${jobId} for ${mediaIds.length} items`);

        res.json({
            success: true,
            message: `Batch ${operation} job added to processing queue`,
            jobId,
            operation,
            mediaCount: mediaIds.length,
            estimatedWaitTime: processingQueue.getQueueStatistics().pending * 20
        });

    } catch (error) {
        console.error('❌ Error adding batch job:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to add batch job to queue'
        });
    }
});

/**
 * GET /api/image-processing-queue/job/:jobId
 * Get status of a specific job
 */
router.get('/job/:jobId', (req, res) => {
    try {
        if (!processingQueue) {
            return res.status(500).json({
                success: false,
                error: 'Processing queue not initialized'
            });
        }

        const { jobId } = req.params;
        const job = processingQueue.getJobStatus(jobId);

        if (!job) {
            return res.status(404).json({
                success: false,
                error: 'Job not found'
            });
        }

        // Clean up job data for API response
        const cleanJob = {
            id: job.id,
            type: job.type,
            status: job.status,
            priority: job.priority,
            mediaId: job.mediaId,
            modelSlug: job.modelSlug,
            createdAt: job.createdAt,
            startedAt: job.startedAt,
            completedAt: job.completedAt,
            failedAt: job.failedAt,
            processingTime: job.processingTime,
            attempts: job.attempts,
            maxAttempts: job.maxAttempts,
            lastError: job.lastError
        };

        // Add result if completed
        if (job.status === 'completed' && job.result) {
            cleanJob.result = job.result;
        }

        res.json({
            success: true,
            job: cleanJob
        });

    } catch (error) {
        console.error('❌ Error getting job status:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get job status'
        });
    }
});

/**
 * GET /api/image-processing-queue/statistics
 * Get queue statistics
 */
router.get('/statistics', (req, res) => {
    try {
        if (!processingQueue) {
            return res.status(500).json({
                success: false,
                error: 'Processing queue not initialized'
            });
        }

        const stats = processingQueue.getQueueStatistics();

        res.json({
            success: true,
            statistics: {
                ...stats,
                averageProcessingTime: stats.totalProcessed > 0 
                    ? Math.round(stats.totalProcessed / 10) // Rough average
                    : 0,
                queueHealthy: stats.failed / Math.max(stats.totalProcessed, 1) < 0.1 // Less than 10% failure rate
            }
        });

    } catch (error) {
        console.error('❌ Error getting queue statistics:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get queue statistics'
        });
    }
});

/**
 * POST /api/image-processing-queue/cleanup
 * Clean up completed and failed jobs from memory
 */
router.post('/cleanup', (req, res) => {
    try {
        if (!processingQueue) {
            return res.status(500).json({
                success: false,
                error: 'Processing queue not initialized'
            });
        }

        const completedCleared = processingQueue.clearCompletedJobs();
        const failedCleared = processingQueue.clearFailedJobs();

        console.log(`🧹 Queue cleanup via API: ${completedCleared} completed, ${failedCleared} failed jobs cleared`);

        res.json({
            success: true,
            message: 'Queue cleanup completed',
            clearedJobs: {
                completed: completedCleared,
                failed: failedCleared,
                total: completedCleared + failedCleared
            }
        });

    } catch (error) {
        console.error('❌ Error cleaning up queue:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to cleanup queue'
        });
    }
});

/**
 * GET /api/image-processing-queue/jobs
 * Get list of jobs with optional filtering
 */
router.get('/jobs', (req, res) => {
    try {
        if (!processingQueue) {
            return res.status(500).json({
                success: false,
                error: 'Processing queue not initialized'
            });
        }

        const { status, type, limit = 50 } = req.query;
        const maxLimit = Math.min(parseInt(limit), 100);
        
        let jobs = [];

        // Get jobs based on status filter
        if (!status || status === 'running') {
            jobs.push(...Array.from(processingQueue.runningJobs.values()));
        }
        
        if (!status || status === 'pending') {
            jobs.push(...processingQueue.pendingJobs);
        }
        
        if (!status || status === 'completed') {
            jobs.push(...Array.from(processingQueue.completedJobs.values()));
        }
        
        if (!status || status === 'failed') {
            jobs.push(...Array.from(processingQueue.failedJobs.values()));
        }

        // Filter by type if specified
        if (type) {
            jobs = jobs.filter(job => job.type === type);
        }

        // Sort by creation time (newest first)
        jobs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Apply limit
        jobs = jobs.slice(0, maxLimit);

        // Clean up job data for API response
        const cleanJobs = jobs.map(job => ({
            id: job.id,
            type: job.type,
            status: job.status,
            priority: job.priority,
            mediaId: job.mediaId,
            modelSlug: job.modelSlug,
            createdAt: job.createdAt,
            startedAt: job.startedAt,
            completedAt: job.completedAt,
            failedAt: job.failedAt,
            processingTime: job.processingTime,
            attempts: job.attempts,
            lastError: job.status === 'failed' ? job.lastError : undefined
        }));

        res.json({
            success: true,
            jobs: cleanJobs,
            total: jobs.length,
            filters: { status, type, limit: maxLimit }
        });

    } catch (error) {
        console.error('❌ Error getting jobs list:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get jobs list'
        });
    }
});

module.exports = router;