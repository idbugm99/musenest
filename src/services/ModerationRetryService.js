/**
 * Moderation Retry Service
 * Part of Phase B.5: Retry Logic for Failed Moderation Operations
 * Handles retry logic for failed moderation operations and callbacks
 */

const MediaLogger = require('./MediaLogger');

class ModerationRetryService {
    constructor(dbConnection, options = {}) {
        this.db = dbConnection;
        this.logger = new MediaLogger(dbConnection, { enableDatabaseLogging: true });
        
        // Retry configuration
        this.config = {
            maxRetries: options.maxRetries || 5,
            initialDelayMs: options.initialDelayMs || 30000, // 30 seconds
            maxDelayMs: options.maxDelayMs || 300000, // 5 minutes
            backoffMultiplier: options.backoffMultiplier || 2.0,
            jitterMaxMs: options.jitterMaxMs || 5000, // 5 seconds
            retryIntervalMs: options.retryIntervalMs || 60000, // 1 minute
            batchSize: options.batchSize || 10
        };
        
        // Retry processing state
        this.isProcessing = false;
        this.processingQueue = new Set();
        
        // Start periodic retry processing if enabled
        if (options.enablePeriodicProcessing !== false) {
            this.startPeriodicProcessing();
        }
        
        console.log('🔄 ModerationRetryService initialized');
    }

    /**
     * Start periodic processing of failed operations
     */
    startPeriodicProcessing() {
        setInterval(async () => {
            if (!this.isProcessing) {
                await this.processPendingRetries();
            }
        }, this.config.retryIntervalMs);
        
        console.log(`⏰ Periodic retry processing started (${this.config.retryIntervalMs}ms interval)`);
    }

    /**
     * Process all pending retry operations
     * @returns {Object} Processing results
     */
    async processPendingRetries() {
        if (this.isProcessing) {
            console.log('⏳ Retry processing already in progress, skipping...');
            return { processed: 0, errors: 0, message: 'Already processing' };
        }
        
        this.isProcessing = true;
        const startTime = Date.now();
        
        try {
            console.log('🔄 Starting retry processing for failed operations');
            
            // Get pending retry operations
            const pendingOperations = await this.getPendingRetryOperations();
            
            if (pendingOperations.length === 0) {
                console.log('✅ No pending retry operations found');
                return { processed: 0, errors: 0, message: 'No pending operations' };
            }
            
            console.log(`🔍 Found ${pendingOperations.length} pending retry operations`);
            
            let processed = 0;
            let errors = 0;
            
            // Process operations in batches
            for (let i = 0; i < pendingOperations.length; i += this.config.batchSize) {
                const batch = pendingOperations.slice(i, i + this.config.batchSize);
                
                for (const operation of batch) {
                    try {
                        const result = await this.processRetryOperation(operation);
                        if (result.success) {
                            processed++;
                        } else {
                            errors++;
                        }
                    } catch (error) {
                        console.error(`❌ Retry processing error for operation ${operation.id}:`, error.message);
                        errors++;
                        
                        // Log the retry error
                        await this.logger.logError({
                            operation: 'retry_processing',
                            errorType: 'retry_operation_error',
                            error: error.message,
                            errorStack: error.stack,
                            trackingId: operation.tracking_id,
                            batchId: operation.batch_id,
                            escalationPriority: 'medium',
                            contextData: { operationId: operation.id, operationType: operation.operation_type }
                        });
                    }
                }
                
                // Small delay between batches
                if (i + this.config.batchSize < pendingOperations.length) {
                    await this.sleep(1000); // 1 second between batches
                }
            }
            
            const processingTime = Date.now() - startTime;
            console.log(`✅ Retry processing completed: ${processed} processed, ${errors} errors in ${processingTime}ms`);
            
            // Log performance metrics
            await this.logger.logPerformance({
                operation: 'retry_processing_batch',
                processingTime,
                throughput: Math.round((processed / processingTime) * 1000 * 3600), // per hour
                errorRate: errors / (processed + errors),
                activeUploads: 0,
                queueDepth: pendingOperations.length
            });
            
            return {
                processed,
                errors,
                totalOperations: pendingOperations.length,
                processingTime,
                message: `Processed ${processed}/${pendingOperations.length} retry operations`
            };
            
        } catch (error) {
            const processingTime = Date.now() - startTime;
            console.error(`💥 Retry processing failed after ${processingTime}ms:`, error.message);
            
            await this.logger.logError({
                operation: 'retry_processing',
                errorType: 'retry_batch_error',
                error: error.message,
                errorStack: error.stack,
                processingTime,
                escalationPriority: 'high',
                requiresManualReview: true
            });
            
            return {
                processed: 0,
                errors: 1,
                processingTime,
                error: error.message
            };
            
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Get pending retry operations from database
     * @returns {Array} Pending operations
     */
    async getPendingRetryOperations() {
        try {
            const now = new Date();
            
            const query = `
                SELECT 
                    mro.id,
                    mro.operation_type,
                    mro.tracking_id,
                    mro.batch_id,
                    mro.model_slug,
                    mro.media_id,
                    mro.retry_count,
                    mro.max_retries,
                    mro.next_retry_at,
                    mro.last_error,
                    mro.operation_data,
                    mro.created_at,
                    mro.updated_at
                FROM moderation_retry_operations mro
                WHERE mro.status = 'pending'
                  AND mro.next_retry_at <= ?
                  AND mro.retry_count < mro.max_retries
                ORDER BY mro.priority DESC, mro.created_at ASC
                LIMIT ?
            `;
            
            const rows = await this.db.query(query, [now.toISOString(), this.config.batchSize * 3]);
            return rows || [];
            
        } catch (error) {
            console.error('❌ Error getting pending retry operations:', error.message);
            throw error;
        }
    }

    /**
     * Process a single retry operation
     * @param {Object} operation - Retry operation data
     * @returns {Object} Processing result
     */
    async processRetryOperation(operation) {
        const startTime = Date.now();
        
        try {
            console.log(`🔄 Processing retry operation ${operation.id} (${operation.operation_type}) - attempt ${operation.retry_count + 1}/${operation.max_retries}`);
            
            // Check if already processing this operation
            if (this.processingQueue.has(operation.id)) {
                return { success: false, error: 'Already processing this operation' };
            }
            
            this.processingQueue.add(operation.id);
            
            try {
                let result = { success: false, error: 'Unknown operation type' };
                
                // Route to appropriate retry handler based on operation type
                switch (operation.operation_type) {
                    case 'moderation_upload':
                        result = await this.retryModerationUpload(operation);
                        break;
                    case 'moderation_callback':
                        result = await this.retryModerationCallback(operation);
                        break;
                    case 'file_storage_move':
                        result = await this.retryFileStorageMove(operation);
                        break;
                    case 'webhook_notification':
                        result = await this.retryWebhookNotification(operation);
                        break;
                    default:
                        console.warn(`⚠️ Unknown retry operation type: ${operation.operation_type}`);
                        result = { success: false, error: `Unknown operation type: ${operation.operation_type}` };
                }
                
                const processingTime = Date.now() - startTime;
                
                if (result.success) {
                    // Mark operation as completed
                    await this.markOperationCompleted(operation.id, result, processingTime);
                    console.log(`✅ Retry operation ${operation.id} completed successfully in ${processingTime}ms`);
                } else {
                    // Increment retry count and schedule next retry
                    await this.scheduleNextRetry(operation, result.error, processingTime);
                    console.log(`⚠️ Retry operation ${operation.id} failed, scheduled for next retry`);
                }
                
                return result;
                
            } finally {
                this.processingQueue.delete(operation.id);
            }
            
        } catch (error) {
            const processingTime = Date.now() - startTime;
            console.error(`❌ Error processing retry operation ${operation.id}:`, error.message);
            
            // Schedule next retry for unexpected errors
            await this.scheduleNextRetry(operation, error.message, processingTime);
            
            return { success: false, error: error.message, processingTime };
        }
    }

    /**
     * Retry a failed moderation upload
     * @param {Object} operation - Operation data
     * @returns {Object} Retry result
     */
    async retryModerationUpload(operation) {
        try {
            const operationData = JSON.parse(operation.operation_data);
            
            // Re-initialize upload service for retry
            const MediaUploadService = require('./MediaUploadService');
            const uploadService = new MediaUploadService(this.db);
            await uploadService.initialize();
            
            // Attempt to reprocess the failed upload
            const result = await uploadService.submitToModeration(operationData.imagePath, {
                modelId: operationData.modelId,
                modelSlug: operation.model_slug,
                originalName: operationData.originalName,
                usageIntent: operationData.usageIntent,
                contextType: operationData.contextType,
                title: operationData.title,
                description: operationData.description
            });
            
            return {
                success: result.success,
                error: result.error,
                moderationStatus: result.moderation_status,
                trackingId: result.moderationTrackingId
            };
            
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Retry a failed moderation callback
     * @param {Object} operation - Operation data
     * @returns {Object} Retry result
     */
    async retryModerationCallback(operation) {
        try {
            const operationData = JSON.parse(operation.operation_data);
            
            // Re-initialize callback handler
            const ModerationCallbackHandler = require('./ModerationCallbackHandler');
            const callbackHandler = new ModerationCallbackHandler(this.db);
            
            // Attempt to reprocess the callback
            const result = await callbackHandler.processMediaLibraryCallback(operationData.callbackData);
            
            return {
                success: result.success,
                error: result.error,
                updatedMediaCount: result.updated_media_count
            };
            
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Retry a failed file storage move operation
     * @param {Object} operation - Operation data
     * @returns {Object} Retry result
     */
    async retryFileStorageMove(operation) {
        try {
            const operationData = JSON.parse(operation.operation_data);
            
            // Re-initialize file storage service
            const FileStorageService = require('./FileStorageService');
            const fileStorage = new FileStorageService();
            
            // Attempt to retry the file move
            const result = await fileStorage.moveMediaFile(
                operationData.mediaData,
                operationData.moderationStatus
            );
            
            return {
                success: result.success,
                error: result.error,
                filesMovedCount: result.filesMovedCount
            };
            
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Retry a failed webhook notification
     * @param {Object} operation - Operation data
     * @returns {Object} Retry result
     */
    async retryWebhookNotification(operation) {
        try {
            const operationData = JSON.parse(operation.operation_data);
            
            // Attempt to resend webhook notification
            const fetch = require('node-fetch');
            const response = await fetch(operationData.webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Webhook-Signature': operationData.signature || 'retry'
                },
                body: JSON.stringify(operationData.payload),
                timeout: 30000 // 30 second timeout
            });
            
            if (response.ok) {
                return { success: true, statusCode: response.status };
            } else {
                return { 
                    success: false, 
                    error: `Webhook failed with status: ${response.status}`,
                    statusCode: response.status
                };
            }
            
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Mark retry operation as completed
     * @param {number} operationId - Operation ID
     * @param {Object} result - Operation result
     * @param {number} processingTime - Processing time
     */
    async markOperationCompleted(operationId, result, processingTime) {
        try {
            const updateQuery = `
                UPDATE moderation_retry_operations 
                SET 
                    status = 'completed',
                    completed_at = NOW(),
                    updated_at = NOW(),
                    final_result = ?,
                    total_processing_time_ms = ?
                WHERE id = ?
            `;
            
            await this.db.execute(updateQuery, [
                JSON.stringify(result),
                processingTime,
                operationId
            ]);
            
        } catch (error) {
            console.error('⚠️ Failed to mark operation as completed:', error.message);
        }
    }

    /**
     * Schedule next retry for a failed operation
     * @param {Object} operation - Operation data
     * @param {string} error - Error message
     * @param {number} processingTime - Processing time
     */
    async scheduleNextRetry(operation, error, processingTime) {
        try {
            const newRetryCount = operation.retry_count + 1;
            
            if (newRetryCount >= operation.max_retries) {
                // Mark as permanently failed
                await this.markOperationFailed(operation.id, error, processingTime);
                return;
            }
            
            // Calculate next retry time with exponential backoff and jitter
            const baseDelay = Math.min(
                this.config.initialDelayMs * Math.pow(this.config.backoffMultiplier, newRetryCount - 1),
                this.config.maxDelayMs
            );
            
            const jitter = Math.random() * this.config.jitterMaxMs;
            const totalDelay = baseDelay + jitter;
            const nextRetryAt = new Date(Date.now() + totalDelay);
            
            const updateQuery = `
                UPDATE moderation_retry_operations 
                SET 
                    retry_count = ?,
                    next_retry_at = ?,
                    last_error = ?,
                    last_retry_at = NOW(),
                    updated_at = NOW(),
                    last_processing_time_ms = ?
                WHERE id = ?
            `;
            
            await this.db.execute(updateQuery, [
                newRetryCount,
                nextRetryAt.toISOString(),
                error,
                processingTime,
                operation.id
            ]);
            
            console.log(`⏰ Scheduled retry ${newRetryCount}/${operation.max_retries} for operation ${operation.id} at ${nextRetryAt.toISOString()}`);
            
        } catch (dbError) {
            console.error('⚠️ Failed to schedule next retry:', dbError.message);
        }
    }

    /**
     * Mark operation as permanently failed
     * @param {number} operationId - Operation ID
     * @param {string} finalError - Final error message
     * @param {number} processingTime - Processing time
     */
    async markOperationFailed(operationId, finalError, processingTime) {
        try {
            const updateQuery = `
                UPDATE moderation_retry_operations 
                SET 
                    status = 'failed',
                    final_error = ?,
                    failed_at = NOW(),
                    updated_at = NOW(),
                    total_processing_time_ms = ?
                WHERE id = ?
            `;
            
            await this.db.execute(updateQuery, [
                finalError,
                processingTime,
                operationId
            ]);
            
            console.error(`💥 Operation ${operationId} marked as permanently failed: ${finalError}`);
            
            // Log high-priority error for failed operation
            await this.logger.logError({
                operation: 'retry_operation_permanent_failure',
                errorType: 'max_retries_exceeded',
                error: `Operation ${operationId} permanently failed: ${finalError}`,
                escalationPriority: 'high',
                requiresManualReview: true,
                contextData: { operationId, finalError, processingTime }
            });
            
        } catch (error) {
            console.error('⚠️ Failed to mark operation as failed:', error.message);
        }
    }

    /**
     * Add a new retry operation to the queue
     * @param {Object} retryData - Retry operation data
     * @returns {Object} Add result
     */
    async addRetryOperation(retryData) {
        try {
            const insertQuery = `
                INSERT INTO moderation_retry_operations (
                    operation_type, tracking_id, batch_id, model_slug, media_id,
                    operation_data, max_retries, next_retry_at, priority, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            `;
            
            const nextRetryAt = new Date(Date.now() + this.config.initialDelayMs);
            
            const result = await this.db.execute(insertQuery, [
                retryData.operationType,
                retryData.trackingId,
                retryData.batchId,
                retryData.modelSlug,
                retryData.mediaId,
                JSON.stringify(retryData.operationData),
                retryData.maxRetries || this.config.maxRetries,
                nextRetryAt.toISOString(),
                retryData.priority || 'medium'
            ]);
            
            console.log(`📝 Added retry operation: ${retryData.operationType} (ID: ${result.insertId})`);
            
            return {
                success: true,
                operationId: result.insertId,
                nextRetryAt: nextRetryAt.toISOString()
            };
            
        } catch (error) {
            console.error('❌ Failed to add retry operation:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get retry operation statistics
     * @returns {Object} Statistics
     */
    async getRetryStatistics() {
        try {
            const statsQuery = `
                SELECT 
                    operation_type,
                    status,
                    COUNT(*) as count,
                    AVG(retry_count) as avg_retries,
                    MAX(retry_count) as max_retries,
                    AVG(total_processing_time_ms) as avg_processing_time
                FROM moderation_retry_operations
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
                GROUP BY operation_type, status
                ORDER BY operation_type, status
            `;
            
            const stats = await this.db.query(statsQuery);
            
            return {
                success: true,
                statistics: stats || [],
                generatedAt: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('❌ Error getting retry statistics:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Clean up old completed retry operations
     * @returns {Object} Cleanup results
     */
    async cleanupOldOperations() {
        try {
            const retentionDays = 7; // Keep completed operations for 7 days
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
            
            const deleteQuery = `
                DELETE FROM moderation_retry_operations 
                WHERE status IN ('completed', 'failed') 
                  AND (completed_at < ? OR failed_at < ?)
            `;
            
            const result = await this.db.execute(deleteQuery, [
                cutoffDate.toISOString(),
                cutoffDate.toISOString()
            ]);
            
            const cleanedCount = result.affectedRows || 0;
            console.log(`🧹 Cleaned ${cleanedCount} old retry operations`);
            
            return {
                success: true,
                cleanedOperations: cleanedCount,
                cutoffDate: cutoffDate.toISOString()
            };
            
        } catch (error) {
            console.error('❌ Error cleaning old operations:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Sleep for specified milliseconds
     * @param {number} ms - Milliseconds to sleep
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = ModerationRetryService;