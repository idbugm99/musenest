/**
 * Image Processing Queue Service
 * Part of Phase C.2: Background Processing Implementation
 * Handles background processing of image operations using in-memory queue
 */

const EventEmitter = require('events');

class ImageProcessingQueue extends EventEmitter {
    constructor(dbConnection, maxConcurrentJobs = 3) {
        super();
        this.db = dbConnection;
        this.maxConcurrentJobs = maxConcurrentJobs;
        this.runningJobs = new Map();
        this.pendingJobs = [];
        this.completedJobs = new Map();
        this.failedJobs = new Map();
        this.jobCounter = 0;
        this.isProcessing = false;
        
        console.log(`⚡ ImageProcessingQueue initialized (max concurrent: ${maxConcurrentJobs})`);
    }

    /**
     * Add a crop job to the queue
     * @param {Object} jobData - Job data
     * @returns {string} Job ID
     */
    addCropJob(jobData) {
        const { mediaId, cropParams, modelSlug, priority = 'normal' } = jobData;
        
        const job = {
            id: `crop_${++this.jobCounter}_${Date.now()}`,
            type: 'crop',
            mediaId,
            modelSlug,
            data: { cropParams },
            priority,
            status: 'pending',
            createdAt: new Date(),
            attempts: 0,
            maxAttempts: 3
        };

        this.pendingJobs.push(job);
        this.sortJobsByPriority();
        
        console.log(`📋 Added crop job: ${job.id} for media ${mediaId}`);
        
        // Start processing if not already running
        if (!this.isProcessing) {
            this.startProcessing();
        }

        return job.id;
    }

    /**
     * Add a watermark job to the queue
     * @param {Object} jobData - Job data
     * @returns {string} Job ID
     */
    addWatermarkJob(jobData) {
        const { mediaId, modelSlug, watermarkSettings, priority = 'normal' } = jobData;
        
        const job = {
            id: `watermark_${++this.jobCounter}_${Date.now()}`,
            type: 'watermark',
            mediaId,
            modelSlug,
            data: { watermarkSettings },
            priority,
            status: 'pending',
            createdAt: new Date(),
            attempts: 0,
            maxAttempts: 3
        };

        this.pendingJobs.push(job);
        this.sortJobsByPriority();
        
        console.log(`📋 Added watermark job: ${job.id} for media ${mediaId}`);
        
        if (!this.isProcessing) {
            this.startProcessing();
        }

        return job.id;
    }

    /**
     * Add a thumbnail generation job to the queue
     * @param {Object} jobData - Job data
     * @returns {string} Job ID
     */
    addThumbnailJob(jobData) {
        const { mediaId, modelSlug, sizes = ['400x400', '200x200', '100x100'], priority = 'low' } = jobData;
        
        const job = {
            id: `thumbnail_${++this.jobCounter}_${Date.now()}`,
            type: 'thumbnail',
            mediaId,
            modelSlug,
            data: { sizes },
            priority,
            status: 'pending',
            createdAt: new Date(),
            attempts: 0,
            maxAttempts: 2
        };

        this.pendingJobs.push(job);
        this.sortJobsByPriority();
        
        console.log(`📋 Added thumbnail job: ${job.id} for media ${mediaId}`);
        
        if (!this.isProcessing) {
            this.startProcessing();
        }

        return job.id;
    }

    /**
     * Add a batch processing job to the queue
     * @param {Object} jobData - Job data
     * @returns {string} Job ID
     */
    addBatchJob(jobData) {
        const { operation, mediaIds, modelSlug, params, priority = 'high' } = jobData;
        
        const job = {
            id: `batch_${operation}_${++this.jobCounter}_${Date.now()}`,
            type: 'batch',
            modelSlug,
            data: { operation, mediaIds, params },
            priority,
            status: 'pending',
            createdAt: new Date(),
            attempts: 0,
            maxAttempts: 2
        };

        this.pendingJobs.push(job);
        this.sortJobsByPriority();
        
        console.log(`📋 Added batch ${operation} job: ${job.id} for ${mediaIds.length} media items`);
        
        if (!this.isProcessing) {
            this.startProcessing();
        }

        return job.id;
    }

    /**
     * Start processing jobs
     */
    async startProcessing() {
        if (this.isProcessing) {
            return;
        }

        this.isProcessing = true;
        console.log('⚡ Starting job processing...');

        while (this.pendingJobs.length > 0 || this.runningJobs.size > 0) {
            // Start new jobs if we have capacity
            while (this.runningJobs.size < this.maxConcurrentJobs && this.pendingJobs.length > 0) {
                const job = this.pendingJobs.shift();
                this.processJob(job);
            }

            // Wait a bit before checking again
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        this.isProcessing = false;
        console.log('⚡ Job processing completed');
        this.emit('processingComplete');
    }

    /**
     * Process a single job
     * @param {Object} job - Job to process
     */
    async processJob(job) {
        job.status = 'running';
        job.startedAt = new Date();
        this.runningJobs.set(job.id, job);
        
        console.log(`⚡ Processing job: ${job.id} (${job.type})`);
        
        try {
            let result;
            
            switch (job.type) {
                case 'crop':
                    result = await this.processCropJob(job);
                    break;
                case 'watermark':
                    result = await this.processWatermarkJob(job);
                    break;
                case 'thumbnail':
                    result = await this.processThumbnailJob(job);
                    break;
                case 'batch':
                    result = await this.processBatchJob(job);
                    break;
                default:
                    throw new Error(`Unknown job type: ${job.type}`);
            }

            // Job completed successfully
            job.status = 'completed';
            job.completedAt = new Date();
            job.result = result;
            job.processingTime = job.completedAt - job.startedAt;
            
            this.runningJobs.delete(job.id);
            this.completedJobs.set(job.id, job);
            
            console.log(`✅ Job completed: ${job.id} (${job.processingTime}ms)`);
            this.emit('jobCompleted', job);

        } catch (error) {
            job.attempts++;
            job.lastError = error.message;
            job.lastAttemptAt = new Date();
            
            console.error(`❌ Job failed: ${job.id} (attempt ${job.attempts}/${job.maxAttempts}):`, error.message);
            
            if (job.attempts < job.maxAttempts) {
                // Retry the job
                job.status = 'pending';
                this.runningJobs.delete(job.id);
                this.pendingJobs.unshift(job); // Add to front for retry
                console.log(`🔄 Retrying job: ${job.id}`);
            } else {
                // Job failed permanently
                job.status = 'failed';
                job.failedAt = new Date();
                job.processingTime = job.failedAt - job.startedAt;
                
                this.runningJobs.delete(job.id);
                this.failedJobs.set(job.id, job);
                
                console.error(`💥 Job failed permanently: ${job.id}`);
                this.emit('jobFailed', job);
            }
        }
    }

    /**
     * Process a crop job
     * @param {Object} job - Crop job
     * @returns {Object} Result
     */
    async processCropJob(job) {
        const { mediaId, data: { cropParams } } = job;
        
        // Get media file info
        const [mediaRows] = await this.db.execute(`
            SELECT file_path, filename, model_slug
            FROM model_media_library 
            WHERE id = ?
        `, [mediaId]);
        
        if (!mediaRows.length) {
            throw new Error(`Media not found: ${mediaId}`);
        }
        
        const media = mediaRows[0];
        const sharp = require('sharp');
        const path = require('path');
        const fs = require('fs').promises;
        
        // Generate cropped filename
        const ext = path.extname(media.filename);
        const baseName = path.basename(media.filename, ext);
        const croppedFilename = `${baseName}_cropped_${Date.now()}${ext}`;
        
        // Determine file paths
        const baseUploadPath = path.join(__dirname, '../../public/uploads');
        const originalPath = path.join(baseUploadPath, media.model_slug, 'originals', media.filename);
        const croppedPath = path.join(baseUploadPath, media.model_slug, 'media', croppedFilename);
        
        // Perform crop using Sharp
        await sharp(originalPath)
            .extract({
                left: Math.round(cropParams.x),
                top: Math.round(cropParams.y),
                width: Math.round(cropParams.width),
                height: Math.round(cropParams.height)
            })
            .jpeg({ quality: 90 })
            .toFile(croppedPath);
        
        // Update database with cropped version
        await this.db.execute(`
            UPDATE model_media_library 
            SET file_path = ?, filename = ?, last_modified = NOW()
            WHERE id = ?
        `, [
            `/uploads/${media.model_slug}/media/${croppedFilename}`,
            croppedFilename,
            mediaId
        ]);
        
        return {
            success: true,
            croppedFilename,
            croppedPath: `/uploads/${media.model_slug}/media/${croppedFilename}`,
            cropParams
        };
    }

    /**
     * Process a watermark job
     * @param {Object} job - Watermark job
     * @returns {Object} Result
     */
    async processWatermarkJob(job) {
        const { mediaId, modelSlug, data: { watermarkSettings } } = job;
        
        // Use existing watermark service
        const AdminWatermarkService = require('./AdminWatermarkService');
        const watermarkService = new AdminWatermarkService();
        
        // Get media info
        const [mediaRows] = await this.db.execute(`
            SELECT file_path, filename FROM model_media_library WHERE id = ?
        `, [mediaId]);
        
        if (!mediaRows.length) {
            throw new Error(`Media not found: ${mediaId}`);
        }
        
        const media = mediaRows[0];
        const path = require('path');
        const baseUploadPath = path.join(__dirname, '../../public/uploads');
        const imagePath = path.join(baseUploadPath, modelSlug, 'originals', media.filename);
        
        // Apply watermark
        const watermarkResult = await watermarkService.applyWatermark(imagePath, modelSlug, watermarkSettings);
        
        if (!watermarkResult.success) {
            throw new Error(watermarkResult.error);
        }
        
        return {
            success: true,
            watermarkedPath: watermarkResult.watermarkedPath,
            settings: watermarkSettings
        };
    }

    /**
     * Process a thumbnail job
     * @param {Object} job - Thumbnail job
     * @returns {Object} Result
     */
    async processThumbnailJob(job) {
        const { mediaId, modelSlug, data: { sizes } } = job;
        
        // Get media info
        const [mediaRows] = await this.db.execute(`
            SELECT file_path, filename FROM model_media_library WHERE id = ?
        `, [mediaId]);
        
        if (!mediaRows.length) {
            throw new Error(`Media not found: ${mediaId}`);
        }
        
        const media = mediaRows[0];
        const sharp = require('sharp');
        const path = require('path');
        
        const baseUploadPath = path.join(__dirname, '../../public/uploads');
        const originalPath = path.join(baseUploadPath, modelSlug, 'originals', media.filename);
        const thumbsDir = path.join(baseUploadPath, modelSlug, 'media', 'thumbs');
        
        // Ensure thumbs directory exists
        const fs = require('fs').promises;
        await fs.mkdir(thumbsDir, { recursive: true });
        
        const generatedThumbs = [];
        
        // Generate thumbnails for each size
        for (const size of sizes) {
            const [width, height] = size.split('x').map(Number);
            const ext = path.extname(media.filename);
            const baseName = path.basename(media.filename, ext);
            const thumbFilename = `${baseName}_${size}${ext}`;
            const thumbPath = path.join(thumbsDir, thumbFilename);
            
            await sharp(originalPath)
                .resize(width, height, {
                    fit: 'cover',
                    position: 'center'
                })
                .jpeg({ quality: 85 })
                .toFile(thumbPath);
            
            generatedThumbs.push({
                size,
                filename: thumbFilename,
                path: `/uploads/${modelSlug}/media/thumbs/${thumbFilename}`
            });
        }
        
        return {
            success: true,
            thumbnails: generatedThumbs
        };
    }

    /**
     * Process a batch job
     * @param {Object} job - Batch job
     * @returns {Object} Result
     */
    async processBatchJob(job) {
        const { data: { operation, mediaIds, params } } = job;
        
        const results = [];
        let successful = 0;
        let failed = 0;
        
        for (const mediaId of mediaIds) {
            try {
                let result;
                
                switch (operation) {
                    case 'delete':
                        await this.db.execute(`
                            UPDATE model_media_library 
                            SET is_deleted = 1, last_modified = NOW()
                            WHERE id = ?
                        `, [mediaId]);
                        result = { success: true, mediaId };
                        break;
                        
                    case 'approve':
                        await this.db.execute(`
                            UPDATE model_media_library 
                            SET moderation_status = 'approved', last_modified = NOW()
                            WHERE id = ?
                        `, [mediaId]);
                        result = { success: true, mediaId };
                        break;
                        
                    case 'set_category':
                        await this.db.execute(`
                            UPDATE model_media_library 
                            SET category_id = ?, last_modified = NOW()
                            WHERE id = ?
                        `, [params.categoryId, mediaId]);
                        result = { success: true, mediaId, categoryId: params.categoryId };
                        break;
                        
                    default:
                        throw new Error(`Unknown batch operation: ${operation}`);
                }
                
                results.push(result);
                successful++;
                
            } catch (error) {
                results.push({ success: false, mediaId, error: error.message });
                failed++;
            }
        }
        
        return {
            success: true,
            operation,
            total: mediaIds.length,
            successful,
            failed,
            results
        };
    }

    /**
     * Sort jobs by priority
     */
    sortJobsByPriority() {
        const priorityOrder = { high: 3, normal: 2, low: 1 };
        
        this.pendingJobs.sort((a, b) => {
            const aPriority = priorityOrder[a.priority] || 2;
            const bPriority = priorityOrder[b.priority] || 2;
            
            if (aPriority !== bPriority) {
                return bPriority - aPriority; // Higher priority first
            }
            
            // Same priority, sort by creation time
            return a.createdAt - b.createdAt;
        });
    }

    /**
     * Get job status
     * @param {string} jobId - Job ID
     * @returns {Object|null} Job status
     */
    getJobStatus(jobId) {
        // Check running jobs
        if (this.runningJobs.has(jobId)) {
            return this.runningJobs.get(jobId);
        }
        
        // Check completed jobs
        if (this.completedJobs.has(jobId)) {
            return this.completedJobs.get(jobId);
        }
        
        // Check failed jobs
        if (this.failedJobs.has(jobId)) {
            return this.failedJobs.get(jobId);
        }
        
        // Check pending jobs
        const pendingJob = this.pendingJobs.find(job => job.id === jobId);
        if (pendingJob) {
            return pendingJob;
        }
        
        return null;
    }

    /**
     * Get queue statistics
     * @returns {Object} Queue stats
     */
    getQueueStatistics() {
        return {
            pending: this.pendingJobs.length,
            running: this.runningJobs.size,
            completed: this.completedJobs.size,
            failed: this.failedJobs.size,
            isProcessing: this.isProcessing,
            maxConcurrentJobs: this.maxConcurrentJobs,
            totalProcessed: this.completedJobs.size + this.failedJobs.size
        };
    }

    /**
     * Clear completed jobs (cleanup memory)
     */
    clearCompletedJobs() {
        const clearedCount = this.completedJobs.size;
        this.completedJobs.clear();
        console.log(`🧹 Cleared ${clearedCount} completed jobs from memory`);
        return clearedCount;
    }

    /**
     * Clear failed jobs (cleanup memory)
     */
    clearFailedJobs() {
        const clearedCount = this.failedJobs.size;
        this.failedJobs.clear();
        console.log(`🧹 Cleared ${clearedCount} failed jobs from memory`);
        return clearedCount;
    }
}

module.exports = ImageProcessingQueue;