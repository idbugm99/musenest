/**
 * Batch Operation Service
 * Part of Phase C.5: Enhanced batch operation processing
 * Provides efficient batch processing for media operations with progress tracking
 */

const EventEmitter = require('events');

class BatchOperationService extends EventEmitter {
    constructor(dbConnection, cacheService, processingQueue = null) {
        super();
        this.db = dbConnection;
        this.cacheService = cacheService;
        this.processingQueue = processingQueue;
        
        // Batch configuration
        this.maxBatchSize = 100; // Maximum items per batch
        this.batchProcessingDelay = 50; // Delay between batch items (ms)
        this.maxConcurrentBatches = 3; // Maximum concurrent batch operations
        this.activeBatches = new Map();
        this.batchHistory = new Map();
        
        // Progress tracking
        this.batchCounter = 0;
        
        console.log('📦 BatchOperationService initialized');
    }

    /**
     * Execute batch media operation with progress tracking
     * @param {string} operation - Operation type
     * @param {string} modelSlug 
     * @param {Array} mediaIds 
     * @param {Object} params - Operation parameters
     * @param {Object} options - Execution options
     * @returns {Object}
     */
    async executeBatchOperation(operation, modelSlug, mediaIds, params = {}, options = {}) {
        const batchId = `batch_${operation}_${++this.batchCounter}_${Date.now()}`;
        const startTime = Date.now();
        
        console.log(`📦 Starting batch ${operation} for ${mediaIds.length} items in ${modelSlug}`);

        try {
            // Validate batch size
            if (mediaIds.length > this.maxBatchSize) {
                throw new Error(`Batch size exceeds maximum allowed (${this.maxBatchSize})`);
            }

            // Check concurrent batch limit
            if (this.activeBatches.size >= this.maxConcurrentBatches) {
                throw new Error('Maximum concurrent batches reached');
            }

            // Initialize batch tracking
            const batchInfo = {
                id: batchId,
                operation,
                modelSlug,
                totalItems: mediaIds.length,
                processedItems: 0,
                successfulItems: 0,
                failedItems: 0,
                startTime,
                status: 'running',
                results: [],
                errors: []
            };

            this.activeBatches.set(batchId, batchInfo);
            this.emit('batchStarted', batchInfo);

            // Execute operation based on type
            let result;
            switch (operation) {
                case 'delete':
                    result = await this.executeBatchDelete(batchId, modelSlug, mediaIds, params, options);
                    break;
                case 'approve':
                    result = await this.executeBatchApprove(batchId, modelSlug, mediaIds, params, options);
                    break;
                case 'reject':
                    result = await this.executeBatchReject(batchId, modelSlug, mediaIds, params, options);
                    break;
                case 'set_category':
                    result = await this.executeBatchSetCategory(batchId, modelSlug, mediaIds, params, options);
                    break;
                case 'set_featured':
                    result = await this.executeBatchSetFeatured(batchId, modelSlug, mediaIds, params, options);
                    break;
                case 'regenerate_thumbnails':
                    result = await this.executeBatchRegenerateThumbnails(batchId, modelSlug, mediaIds, params, options);
                    break;
                case 'extract_metadata':
                    result = await this.executeBatchExtractMetadata(batchId, modelSlug, mediaIds, params, options);
                    break;
                default:
                    throw new Error(`Unsupported batch operation: ${operation}`);
            }

            // Complete batch processing
            batchInfo.status = result.success ? 'completed' : 'failed';
            batchInfo.completedAt = Date.now();
            batchInfo.processingTime = batchInfo.completedAt - batchInfo.startTime;
            batchInfo.successfulItems = result.successful;
            batchInfo.failedItems = result.failed;

            // Move to history
            this.activeBatches.delete(batchId);
            this.batchHistory.set(batchId, batchInfo);

            // Emit completion event
            this.emit('batchCompleted', batchInfo);

            console.log(`✅ Batch ${operation} completed: ${result.successful}/${mediaIds.length} successful (${batchInfo.processingTime}ms)`);

            return {
                success: result.success,
                batchId,
                operation,
                modelSlug,
                totalItems: mediaIds.length,
                successful: result.successful,
                failed: result.failed,
                processingTime: batchInfo.processingTime,
                results: result.results,
                errors: result.errors
            };

        } catch (error) {
            // Handle batch failure
            const batchInfo = this.activeBatches.get(batchId);
            if (batchInfo) {
                batchInfo.status = 'failed';
                batchInfo.error = error.message;
                batchInfo.completedAt = Date.now();
                batchInfo.processingTime = batchInfo.completedAt - batchInfo.startTime;
                
                this.activeBatches.delete(batchId);
                this.batchHistory.set(batchId, batchInfo);
                
                this.emit('batchFailed', batchInfo);
            }

            console.error(`❌ Batch ${operation} failed:`, error.message);
            return {
                success: false,
                batchId,
                error: error.message,
                operation,
                modelSlug,
                totalItems: mediaIds.length,
                processingTime: Date.now() - startTime
            };
        }
    }

    /**
     * Execute batch delete operation
     */
    async executeBatchDelete(batchId, modelSlug, mediaIds, params, options) {
        const results = [];
        const errors = [];
        let successful = 0;
        let failed = 0;

        // Soft delete by default unless hard delete specified
        const hardDelete = params.hardDelete === true;
        const batchInfo = this.activeBatches.get(batchId);

        try {
            // Use transaction for consistency
            await this.db.execute('START TRANSACTION');

            for (const mediaId of mediaIds) {
                try {
                    if (hardDelete) {
                        // Hard delete - remove from database and files
                        const [mediaInfo] = await this.db.execute(`
                            SELECT filename, model_slug 
                            FROM model_media_library 
                            WHERE id = ? AND model_slug = ?
                        `, [mediaId, modelSlug]);

                        if (mediaInfo.length > 0) {
                            // Delete database record
                            await this.db.execute(`
                                DELETE FROM model_media_library 
                                WHERE id = ? AND model_slug = ?
                            `, [mediaId, modelSlug]);

                            // Queue file deletion if processing queue available
                            if (this.processingQueue) {
                                this.processingQueue.addBatchJob({
                                    operation: 'delete_files',
                                    mediaIds: [mediaId],
                                    modelSlug,
                                    params: { mediaInfo: mediaInfo[0] },
                                    priority: 'low'
                                });
                            }
                        }
                    } else {
                        // Soft delete - mark as deleted
                        await this.db.execute(`
                            UPDATE model_media_library 
                            SET is_deleted = 1, deleted_at = NOW(), last_modified = NOW()
                            WHERE id = ? AND model_slug = ?
                        `, [mediaId, modelSlug]);
                    }

                    results.push({
                        mediaId,
                        success: true,
                        action: hardDelete ? 'hard_deleted' : 'soft_deleted'
                    });
                    successful++;

                    // Invalidate cache for this media
                    await this.invalidateMediaCache(modelSlug, mediaId);

                    // Update progress
                    if (batchInfo) {
                        batchInfo.processedItems++;
                        batchInfo.successfulItems = successful;
                        this.emit('batchProgress', batchInfo);
                    }

                } catch (error) {
                    results.push({
                        mediaId,
                        success: false,
                        error: error.message
                    });
                    errors.push({ mediaId, error: error.message });
                    failed++;

                    if (batchInfo) {
                        batchInfo.processedItems++;
                        batchInfo.failedItems = failed;
                        this.emit('batchProgress', batchInfo);
                    }
                }

                // Add processing delay
                if (this.batchProcessingDelay > 0) {
                    await new Promise(resolve => setTimeout(resolve, this.batchProcessingDelay));
                }
            }

            await this.db.execute('COMMIT');

            // Invalidate gallery cache for the model
            await this.cacheService.invalidateGallery(modelSlug);

            return {
                success: true,
                successful,
                failed,
                results,
                errors
            };

        } catch (error) {
            await this.db.execute('ROLLBACK');
            throw error;
        }
    }

    /**
     * Execute batch approve operation
     */
    async executeBatchApprove(batchId, modelSlug, mediaIds, params, options) {
        const results = [];
        const errors = [];
        let successful = 0;
        let failed = 0;
        const batchInfo = this.activeBatches.get(batchId);

        try {
            await this.db.execute('START TRANSACTION');

            for (const mediaId of mediaIds) {
                try {
                    const [result] = await this.db.execute(`
                        UPDATE model_media_library 
                        SET moderation_status = 'approved', 
                            approved_at = NOW(), 
                            approved_by = ?,
                            last_modified = NOW()
                        WHERE id = ? AND model_slug = ? AND moderation_status != 'approved'
                    `, [params.approvedBy || 'system', mediaId, modelSlug]);

                    if (result.affectedRows > 0) {
                        results.push({
                            mediaId,
                            success: true,
                            action: 'approved',
                            previousStatus: 'pending' // Could be enhanced to track actual previous status
                        });
                        successful++;

                        // Invalidate cache
                        await this.invalidateMediaCache(modelSlug, mediaId);
                    } else {
                        results.push({
                            mediaId,
                            success: false,
                            error: 'Media not found or already approved'
                        });
                        failed++;
                    }

                    // Update progress
                    if (batchInfo) {
                        batchInfo.processedItems++;
                        batchInfo.successfulItems = successful;
                        batchInfo.failedItems = failed;
                        this.emit('batchProgress', batchInfo);
                    }

                } catch (error) {
                    results.push({
                        mediaId,
                        success: false,
                        error: error.message
                    });
                    errors.push({ mediaId, error: error.message });
                    failed++;
                }

                if (this.batchProcessingDelay > 0) {
                    await new Promise(resolve => setTimeout(resolve, this.batchProcessingDelay));
                }
            }

            await this.db.execute('COMMIT');
            await this.cacheService.invalidateGallery(modelSlug);

            return {
                success: true,
                successful,
                failed,
                results,
                errors
            };

        } catch (error) {
            await this.db.execute('ROLLBACK');
            throw error;
        }
    }

    /**
     * Execute batch reject operation
     */
    async executeBatchReject(batchId, modelSlug, mediaIds, params, options) {
        const results = [];
        const errors = [];
        let successful = 0;
        let failed = 0;
        const batchInfo = this.activeBatches.get(batchId);
        const rejectionReason = params.reason || 'Batch rejection';

        try {
            await this.db.execute('START TRANSACTION');

            for (const mediaId of mediaIds) {
                try {
                    const [result] = await this.db.execute(`
                        UPDATE model_media_library 
                        SET moderation_status = 'rejected', 
                            rejection_reason = ?,
                            rejected_at = NOW(), 
                            rejected_by = ?,
                            last_modified = NOW()
                        WHERE id = ? AND model_slug = ? AND moderation_status != 'rejected'
                    `, [rejectionReason, params.rejectedBy || 'system', mediaId, modelSlug]);

                    if (result.affectedRows > 0) {
                        results.push({
                            mediaId,
                            success: true,
                            action: 'rejected',
                            reason: rejectionReason
                        });
                        successful++;

                        await this.invalidateMediaCache(modelSlug, mediaId);
                    } else {
                        results.push({
                            mediaId,
                            success: false,
                            error: 'Media not found or already rejected'
                        });
                        failed++;
                    }

                    if (batchInfo) {
                        batchInfo.processedItems++;
                        batchInfo.successfulItems = successful;
                        batchInfo.failedItems = failed;
                        this.emit('batchProgress', batchInfo);
                    }

                } catch (error) {
                    results.push({
                        mediaId,
                        success: false,
                        error: error.message
                    });
                    errors.push({ mediaId, error: error.message });
                    failed++;
                }

                if (this.batchProcessingDelay > 0) {
                    await new Promise(resolve => setTimeout(resolve, this.batchProcessingDelay));
                }
            }

            await this.db.execute('COMMIT');
            await this.cacheService.invalidateGallery(modelSlug);

            return {
                success: true,
                successful,
                failed,
                results,
                errors
            };

        } catch (error) {
            await this.db.execute('ROLLBACK');
            throw error;
        }
    }

    /**
     * Execute batch set category operation
     */
    async executeBatchSetCategory(batchId, modelSlug, mediaIds, params, options) {
        const { categoryId } = params;
        if (!categoryId) {
            throw new Error('Category ID is required for set_category operation');
        }

        const results = [];
        const errors = [];
        let successful = 0;
        let failed = 0;
        const batchInfo = this.activeBatches.get(batchId);

        try {
            // Verify category exists
            const [categoryCheck] = await this.db.execute(`
                SELECT id FROM model_media_categories 
                WHERE id = ? AND model_slug = ?
            `, [categoryId, modelSlug]);

            if (!categoryCheck.length) {
                throw new Error(`Category ${categoryId} not found for model ${modelSlug}`);
            }

            await this.db.execute('START TRANSACTION');

            for (const mediaId of mediaIds) {
                try {
                    const [result] = await this.db.execute(`
                        UPDATE model_media_library 
                        SET category_id = ?, last_modified = NOW()
                        WHERE id = ? AND model_slug = ?
                    `, [categoryId, mediaId, modelSlug]);

                    if (result.affectedRows > 0) {
                        results.push({
                            mediaId,
                            success: true,
                            action: 'category_updated',
                            categoryId
                        });
                        successful++;

                        await this.invalidateMediaCache(modelSlug, mediaId);
                    } else {
                        results.push({
                            mediaId,
                            success: false,
                            error: 'Media not found'
                        });
                        failed++;
                    }

                    if (batchInfo) {
                        batchInfo.processedItems++;
                        batchInfo.successfulItems = successful;
                        batchInfo.failedItems = failed;
                        this.emit('batchProgress', batchInfo);
                    }

                } catch (error) {
                    results.push({
                        mediaId,
                        success: false,
                        error: error.message
                    });
                    errors.push({ mediaId, error: error.message });
                    failed++;
                }

                if (this.batchProcessingDelay > 0) {
                    await new Promise(resolve => setTimeout(resolve, this.batchProcessingDelay));
                }
            }

            await this.db.execute('COMMIT');
            await this.cacheService.invalidateGallery(modelSlug);

            return {
                success: true,
                successful,
                failed,
                results,
                errors
            };

        } catch (error) {
            await this.db.execute('ROLLBACK');
            throw error;
        }
    }

    /**
     * Execute batch set featured operation
     */
    async executeBatchSetFeatured(batchId, modelSlug, mediaIds, params, options) {
        const { featured = true } = params;
        const results = [];
        const errors = [];
        let successful = 0;
        let failed = 0;
        const batchInfo = this.activeBatches.get(batchId);

        try {
            await this.db.execute('START TRANSACTION');

            for (const mediaId of mediaIds) {
                try {
                    const [result] = await this.db.execute(`
                        UPDATE model_media_library 
                        SET is_featured = ?, last_modified = NOW()
                        WHERE id = ? AND model_slug = ?
                    `, [featured ? 1 : 0, mediaId, modelSlug]);

                    if (result.affectedRows > 0) {
                        results.push({
                            mediaId,
                            success: true,
                            action: featured ? 'set_featured' : 'unset_featured'
                        });
                        successful++;

                        await this.invalidateMediaCache(modelSlug, mediaId);
                    } else {
                        results.push({
                            mediaId,
                            success: false,
                            error: 'Media not found'
                        });
                        failed++;
                    }

                    if (batchInfo) {
                        batchInfo.processedItems++;
                        batchInfo.successfulItems = successful;
                        batchInfo.failedItems = failed;
                        this.emit('batchProgress', batchInfo);
                    }

                } catch (error) {
                    results.push({
                        mediaId,
                        success: false,
                        error: error.message
                    });
                    errors.push({ mediaId, error: error.message });
                    failed++;
                }

                if (this.batchProcessingDelay > 0) {
                    await new Promise(resolve => setTimeout(resolve, this.batchProcessingDelay));
                }
            }

            await this.db.execute('COMMIT');
            await this.cacheService.invalidateGallery(modelSlug);

            return {
                success: true,
                successful,
                failed,
                results,
                errors
            };

        } catch (error) {
            await this.db.execute('ROLLBACK');
            throw error;
        }
    }

    /**
     * Execute batch thumbnail regeneration
     */
    async executeBatchRegenerateThumbnails(batchId, modelSlug, mediaIds, params, options) {
        const { sizes = ['medium'] } = params;
        const results = [];
        const errors = [];
        let successful = 0;
        let failed = 0;
        const batchInfo = this.activeBatches.get(batchId);

        if (!this.processingQueue) {
            throw new Error('Processing queue not available for thumbnail regeneration');
        }

        try {
            for (const mediaId of mediaIds) {
                try {
                    // Queue thumbnail generation for this media
                    const jobId = this.processingQueue.addThumbnailJob({
                        mediaId,
                        modelSlug,
                        sizes,
                        priority: 'low' // Low priority for batch operations
                    });

                    results.push({
                        mediaId,
                        success: true,
                        action: 'thumbnail_queued',
                        jobId,
                        sizes
                    });
                    successful++;

                    if (batchInfo) {
                        batchInfo.processedItems++;
                        batchInfo.successfulItems = successful;
                        this.emit('batchProgress', batchInfo);
                    }

                } catch (error) {
                    results.push({
                        mediaId,
                        success: false,
                        error: error.message
                    });
                    errors.push({ mediaId, error: error.message });
                    failed++;
                }

                if (this.batchProcessingDelay > 0) {
                    await new Promise(resolve => setTimeout(resolve, this.batchProcessingDelay));
                }
            }

            return {
                success: true,
                successful,
                failed,
                results,
                errors
            };

        } catch (error) {
            throw error;
        }
    }

    /**
     * Execute batch metadata extraction
     */
    async executeBatchExtractMetadata(batchId, modelSlug, mediaIds, params, options) {
        const results = [];
        const errors = [];
        let successful = 0;
        let failed = 0;
        const batchInfo = this.activeBatches.get(batchId);

        try {
            for (const mediaId of mediaIds) {
                try {
                    // Get media file path
                    const [mediaInfo] = await this.db.execute(`
                        SELECT filename, file_path 
                        FROM model_media_library 
                        WHERE id = ? AND model_slug = ?
                    `, [mediaId, modelSlug]);

                    if (mediaInfo.length === 0) {
                        throw new Error('Media not found');
                    }

                    // Extract metadata using Sharp (simplified example)
                    const sharp = require('sharp');
                    const path = require('path');
                    const filePath = path.join(__dirname, '../../public/uploads', modelSlug, 'originals', mediaInfo[0].filename);
                    
                    const metadata = await sharp(filePath).metadata();
                    
                    // Update database with extracted metadata
                    await this.db.execute(`
                        UPDATE model_media_library 
                        SET image_width = ?, image_height = ?, file_size = ?, last_modified = NOW()
                        WHERE id = ? AND model_slug = ?
                    `, [metadata.width, metadata.height, metadata.size || 0, mediaId, modelSlug]);

                    results.push({
                        mediaId,
                        success: true,
                        action: 'metadata_extracted',
                        metadata: {
                            width: metadata.width,
                            height: metadata.height,
                            format: metadata.format,
                            size: metadata.size
                        }
                    });
                    successful++;

                    // Invalidate cache
                    await this.invalidateMediaCache(modelSlug, mediaId);

                    if (batchInfo) {
                        batchInfo.processedItems++;
                        batchInfo.successfulItems = successful;
                        this.emit('batchProgress', batchInfo);
                    }

                } catch (error) {
                    results.push({
                        mediaId,
                        success: false,
                        error: error.message
                    });
                    errors.push({ mediaId, error: error.message });
                    failed++;
                }

                if (this.batchProcessingDelay > 0) {
                    await new Promise(resolve => setTimeout(resolve, this.batchProcessingDelay));
                }
            }

            return {
                success: true,
                successful,
                failed,
                results,
                errors
            };

        } catch (error) {
            throw error;
        }
    }

    /**
     * Get batch operation status
     * @param {string} batchId 
     * @returns {Object}
     */
    getBatchStatus(batchId) {
        const activeBatch = this.activeBatches.get(batchId);
        const historicalBatch = this.batchHistory.get(batchId);
        
        return activeBatch || historicalBatch || null;
    }

    /**
     * Get all active batches
     * @returns {Array}
     */
    getActiveBatches() {
        return Array.from(this.activeBatches.values());
    }

    /**
     * Get batch history
     * @param {number} limit 
     * @returns {Array}
     */
    getBatchHistory(limit = 20) {
        const history = Array.from(this.batchHistory.values());
        history.sort((a, b) => b.startTime - a.startTime);
        return history.slice(0, limit);
    }

    /**
     * Get service statistics
     * @returns {Object}
     */
    getServiceStatistics() {
        return {
            activeBatches: this.activeBatches.size,
            totalBatchesProcessed: this.batchHistory.size,
            maxConcurrentBatches: this.maxConcurrentBatches,
            maxBatchSize: this.maxBatchSize,
            batchProcessingDelay: this.batchProcessingDelay
        };
    }

    /**
     * Helper: Invalidate media cache
     */
    async invalidateMediaCache(modelSlug, mediaId) {
        try {
            // Invalidate both basic and extended metadata cache
            await this.cacheService.invalidateMedia(modelSlug, `${mediaId}:basic`);
            await this.cacheService.invalidateMedia(modelSlug, `${mediaId}:extended`);
        } catch (error) {
            console.warn('⚠️ Failed to invalidate media cache:', error.message);
        }
    }
}

module.exports = BatchOperationService;