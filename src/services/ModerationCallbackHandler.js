/**
 * Moderation Callback Handler Service
 * Part of Phase B.2: Moderation System Integration
 * Handles asynchronous callbacks from the moderation API when analysis is complete
 */

const path = require('path');
const fs = require('fs').promises;

class ModerationCallbackHandler {
    constructor(dbConnection) {
        this.db = dbConnection;
        this.callbackQueue = new Map(); // In-memory queue for callback processing
        this.processingCallbacks = new Set(); // Track callbacks currently being processed
        this.maxRetries = 5;
        this.retryDelay = 30000; // 30 seconds
        
        console.log('📞 ModerationCallbackHandler initialized');
    }

    /**
     * Process incoming webhook callback from moderation system
     * @param {Object} callbackData - The webhook payload
     * @returns {Object} Processing result
     */
    async processCallback(callbackData) {
        const startTime = Date.now();
        const batchId = callbackData.batch_id;
        
        console.log(`📥 Processing moderation callback for batch: ${batchId}`);
        console.log(`📊 Callback data preview:`, JSON.stringify(callbackData, null, 2).substring(0, 500) + '...');
        
        try {
            // Validate callback data
            if (!this.validateCallbackData(callbackData)) {
                throw new Error('Invalid callback data structure');
            }
            
            // Check if we're already processing this callback
            if (this.processingCallbacks.has(batchId)) {
                console.log(`⏳ Callback ${batchId} already being processed, skipping...`);
                return {
                    success: false,
                    error: 'Callback already being processed',
                    batch_id: batchId
                };
            }
            
            // Mark as processing
            this.processingCallbacks.add(batchId);
            
            try {
                // Find media items associated with this batch
                const mediaItems = await this.findMediaByBatchId(batchId);
                
                if (mediaItems.length === 0) {
                    console.log(`⚠️ No media items found for batch ${batchId}`);
                    return {
                        success: false,
                        error: 'No media items found for batch',
                        batch_id: batchId
                    };
                }
                
                console.log(`🔍 Found ${mediaItems.length} media items for batch ${batchId}`);
                
                // Extract moderation results from callback
                const moderationResult = this.extractModerationResult(callbackData);
                console.log(`📋 Extracted moderation result: status=${moderationResult.status}, score=${moderationResult.score}`);
                
                // Update all media items for this batch
                const updateResults = await this.updateMediaModerationStatus(
                    mediaItems,
                    moderationResult,
                    callbackData
                );
                
                // Update callback tracking
                await this.markCallbackComplete(batchId, callbackData, updateResults);
                
                const processingTime = Date.now() - startTime;
                console.log(`✅ Callback processed successfully in ${processingTime}ms`);
                console.log(`📈 Updated ${updateResults.updated_count} media items`);
                
                return {
                    success: true,
                    batch_id: batchId,
                    updated_media_count: updateResults.updated_count,
                    moderation_status: moderationResult.status,
                    moderation_score: moderationResult.score,
                    processing_time_ms: processingTime
                };
                
            } finally {
                // Always remove from processing set
                this.processingCallbacks.delete(batchId);
            }
            
        } catch (error) {
            const processingTime = Date.now() - startTime;
            console.error(`❌ Callback processing failed after ${processingTime}ms:`, error.message);
            
            // Log error for debugging
            await this.logCallbackError(batchId, callbackData, error);
            
            // Schedule retry if appropriate
            await this.scheduleCallbackRetry(batchId, callbackData, error);
            
            return {
                success: false,
                error: error.message,
                batch_id: batchId,
                processing_time_ms: processingTime
            };
        }
    }

    /**
     * Validate callback data structure
     * @param {Object} callbackData 
     * @returns {boolean}
     */
    validateCallbackData(callbackData) {
        const requiredFields = ['batch_id', 'moderation_status'];
        
        for (const field of requiredFields) {
            if (!callbackData[field]) {
                console.error(`❌ Missing required field: ${field}`);
                return false;
            }
        }
        
        // Validate moderation status values
        const validStatuses = ['approved', 'rejected', 'flagged', 'pending', 'error'];
        if (!validStatuses.includes(callbackData.moderation_status)) {
            console.error(`❌ Invalid moderation status: ${callbackData.moderation_status}`);
            return false;
        }
        
        // Validate nudity score if present
        if (callbackData.nudity_score !== undefined) {
            const score = parseFloat(callbackData.nudity_score);
            if (isNaN(score) || score < 0 || score > 100) {
                console.error(`❌ Invalid nudity score: ${callbackData.nudity_score}`);
                return false;
            }
        }
        
        console.log('✅ Callback data validation passed');
        return true;
    }

    /**
     * Find media items associated with a batch ID
     * @param {string} batchId 
     * @returns {Array} Media items
     */
    async findMediaByBatchId(batchId) {
        try {
            const query = `
                SELECT 
                    mml.id as media_id,
                    mml.model_slug,
                    mml.filename,
                    mml.original_filename,
                    mml.moderation_status as current_status,
                    mml.moderation_score as current_score,
                    mc.id as callback_id
                FROM model_media_library mml
                INNER JOIN media_moderation_links mml_link ON mml.id = mml_link.media_id
                LEFT JOIN moderation_callbacks mc ON mml.id = mc.media_id
                WHERE mml_link.batch_id = ? AND mml.is_deleted = 0
            `;
            
            const [rows] = await this.db.execute(query, [batchId]);
            
            console.log(`🔍 Found ${rows.length} media items for batch ${batchId}`);
            return rows;
            
        } catch (error) {
            console.error(`❌ Error finding media by batch ID ${batchId}:`, error.message);
            throw error;
        }
    }

    /**
     * Extract moderation result from callback data
     * @param {Object} callbackData 
     * @returns {Object} Moderation result
     */
    extractModerationResult(callbackData) {
        return {
            status: callbackData.moderation_status,
            score: parseFloat(callbackData.nudity_score || callbackData.final_risk_score || 0),
            risk_level: callbackData.risk_level || 'unknown',
            detected_parts: callbackData.detected_parts || {},
            face_analysis: callbackData.face_analysis || {},
            human_review_required: callbackData.human_review_required || false,
            flagged: callbackData.flagged || false,
            auto_rejected: callbackData.auto_rejected || false,
            rejection_reason: callbackData.rejection_reason || null,
            analysis_version: callbackData.analysis_version || 'webhook_callback',
            callback_timestamp: new Date().toISOString()
        };
    }

    /**
     * Update media moderation status for all items in batch
     * @param {Array} mediaItems 
     * @param {Object} moderationResult 
     * @param {Object} originalCallback
     * @returns {Object} Update results
     */
    async updateMediaModerationStatus(mediaItems, moderationResult, originalCallback) {
        let updatedCount = 0;
        const errors = [];
        
        try {
            // Start transaction for atomic updates
            await this.db.execute('START TRANSACTION');
            
            for (const mediaItem of mediaItems) {
                try {
                    // Update media library record
                    await this.db.execute(`
                        UPDATE model_media_library 
                        SET 
                            moderation_status = ?,
                            moderation_score = ?,
                            moderation_notes = ?,
                            last_modified = NOW()
                        WHERE id = ?
                    `, [
                        moderationResult.status,
                        moderationResult.score,
                        `Callback processed: ${moderationResult.analysis_version}`,
                        mediaItem.media_id
                    ]);
                    
                    // Update callback tracking if exists
                    if (mediaItem.callback_id) {
                        await this.db.execute(`
                            UPDATE moderation_callbacks
                            SET 
                                status = 'completed',
                                callback_received_at = NOW(),
                                callback_data = ?,
                                updated_at = NOW()
                            WHERE id = ?
                        `, [
                            JSON.stringify(originalCallback),
                            mediaItem.callback_id
                        ]);
                    }
                    
                    updatedCount++;
                    console.log(`✅ Updated media ${mediaItem.media_id} (${mediaItem.filename}): ${moderationResult.status}`);
                    
                } catch (itemError) {
                    console.error(`❌ Error updating media ${mediaItem.media_id}:`, itemError.message);
                    errors.push({
                        media_id: mediaItem.media_id,
                        error: itemError.message
                    });
                }
            }
            
            // Commit transaction
            await this.db.execute('COMMIT');
            
            console.log(`📊 Batch update complete: ${updatedCount} updated, ${errors.length} errors`);
            
            return {
                updated_count: updatedCount,
                error_count: errors.length,
                errors: errors
            };
            
        } catch (transactionError) {
            // Rollback on transaction error
            await this.db.execute('ROLLBACK');
            console.error('❌ Transaction error, rolled back:', transactionError.message);
            throw transactionError;
        }
    }

    /**
     * Mark callback as complete in tracking table
     * @param {string} batchId 
     * @param {Object} callbackData 
     * @param {Object} updateResults
     */
    async markCallbackComplete(batchId, callbackData, updateResults) {
        try {
            // Use stored procedure for atomic callback completion
            await this.db.query('CALL ProcessModerationCallback(?, ?, ?, ?)', [
                batchId,
                JSON.stringify({
                    ...callbackData,
                    processed_at: new Date().toISOString(),
                    update_results: updateResults
                }),
                callbackData.moderation_status,
                parseFloat(callbackData.nudity_score || callbackData.final_risk_score || 0)
            ]);
            
            console.log(`✅ Marked callback complete for batch ${batchId}`);
        } catch (error) {
            console.error(`⚠️ Error marking callback complete for batch ${batchId}:`, error.message);
            // Don't throw - this is logging only
        }
    }

    /**
     * Log callback processing errors
     * @param {string} batchId 
     * @param {Object} callbackData 
     * @param {Error} error
     */
    async logCallbackError(batchId, callbackData, error) {
        try {
            const errorLogQuery = `
                INSERT INTO callback_error_log (
                    batch_id, callback_data, error_message, error_stack, created_at
                ) VALUES (?, ?, ?, ?, NOW())
            `;
            
            await this.db.execute(errorLogQuery, [
                batchId,
                JSON.stringify(callbackData),
                error.message,
                error.stack || null
            ]);
            
            console.log(`📝 Logged callback error for batch ${batchId}`);
        } catch (logError) {
            console.error('⚠️ Failed to log callback error:', logError.message);
            // Don't throw - logging failures shouldn't break callback processing
        }
    }

    /**
     * Schedule callback retry for failed processing
     * @param {string} batchId 
     * @param {Object} callbackData 
     * @param {Error} error
     */
    async scheduleCallbackRetry(batchId, callbackData, error) {
        try {
            // Check current retry count
            const [retryRows] = await this.db.execute(`
                SELECT retry_count, max_retries 
                FROM moderation_callbacks 
                WHERE batch_id = ?
            `, [batchId]);
            
            if (retryRows.length === 0) {
                console.log(`ℹ️ No callback record found for batch ${batchId}, skipping retry scheduling`);
                return;
            }
            
            const { retry_count, max_retries } = retryRows[0];
            
            if (retry_count >= max_retries) {
                console.log(`❌ Max retries (${max_retries}) exceeded for batch ${batchId}`);
                
                // Mark as failed
                await this.db.execute(`
                    UPDATE moderation_callbacks
                    SET 
                        status = 'failed',
                        updated_at = NOW()
                    WHERE batch_id = ?
                `, [batchId]);
                
                return;
            }
            
            // Schedule next retry
            const nextRetryAt = new Date(Date.now() + (this.retryDelay * Math.pow(2, retry_count)));
            
            await this.db.execute(`
                UPDATE moderation_callbacks
                SET 
                    retry_count = retry_count + 1,
                    next_retry_at = ?,
                    updated_at = NOW()
                WHERE batch_id = ?
            `, [nextRetryAt, batchId]);
            
            console.log(`⏰ Scheduled retry ${retry_count + 1}/${max_retries} for batch ${batchId} at ${nextRetryAt}`);
            
        } catch (retryError) {
            console.error(`⚠️ Failed to schedule retry for batch ${batchId}:`, retryError.message);
            // Don't throw - retry scheduling failures shouldn't break callback processing
        }
    }

    /**
     * Process pending retry callbacks
     * This method should be called periodically (e.g., via cron job)
     */
    async processPendingRetries() {
        console.log('🔄 Processing pending callback retries...');
        
        try {
            // Find callbacks ready for retry
            const [retryRows] = await this.db.execute(`
                SELECT 
                    mc.batch_id,
                    mc.callback_data,
                    mc.retry_count,
                    mc.max_retries
                FROM moderation_callbacks mc
                WHERE mc.status = 'pending' 
                AND mc.next_retry_at IS NOT NULL 
                AND mc.next_retry_at <= NOW()
                AND mc.retry_count < mc.max_retries
                ORDER BY mc.next_retry_at
                LIMIT 10
            `);
            
            if (retryRows.length === 0) {
                console.log('ℹ️ No callbacks ready for retry');
                return { processed: 0, errors: 0 };
            }
            
            console.log(`🔄 Found ${retryRows.length} callbacks ready for retry`);
            
            let processed = 0;
            let errors = 0;
            
            for (const row of retryRows) {
                try {
                    const callbackData = JSON.parse(row.callback_data || '{}');
                    callbackData.batch_id = row.batch_id; // Ensure batch_id is set
                    
                    console.log(`🔄 Retrying callback for batch ${row.batch_id} (attempt ${row.retry_count + 1}/${row.max_retries})`);
                    
                    const result = await this.processCallback(callbackData);
                    if (result.success) {
                        processed++;
                        console.log(`✅ Retry successful for batch ${row.batch_id}`);
                    } else {
                        errors++;
                        console.log(`❌ Retry failed for batch ${row.batch_id}: ${result.error}`);
                    }
                    
                } catch (retryError) {
                    errors++;
                    console.error(`❌ Error processing retry for batch ${row.batch_id}:`, retryError.message);
                }
            }
            
            console.log(`🔄 Retry processing complete: ${processed} successful, ${errors} errors`);
            
            return { processed, errors };
            
        } catch (error) {
            console.error('❌ Error processing pending retries:', error.message);
            throw error;
        }
    }

    /**
     * Get callback statistics for monitoring
     * @param {string} modelSlug - Optional model filter
     * @returns {Object} Statistics
     */
    async getCallbackStatistics(modelSlug = null) {
        try {
            let query = `
                SELECT 
                    COUNT(*) as total_callbacks,
                    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_callbacks,
                    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_callbacks,
                    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_callbacks,
                    COUNT(CASE WHEN status = 'timeout' THEN 1 END) as timeout_callbacks,
                    AVG(retry_count) as avg_retry_count,
                    MAX(retry_count) as max_retry_count,
                    COUNT(CASE WHEN next_retry_at IS NOT NULL AND next_retry_at <= NOW() THEN 1 END) as ready_for_retry
                FROM moderation_callbacks
            `;
            
            const params = [];
            if (modelSlug) {
                query += ' WHERE model_slug = ?';
                params.push(modelSlug);
            }
            
            const [rows] = await this.db.execute(query, params);
            const stats = rows[0];
            
            return {
                success: true,
                statistics: {
                    total_callbacks: stats.total_callbacks || 0,
                    pending_callbacks: stats.pending_callbacks || 0,
                    completed_callbacks: stats.completed_callbacks || 0,
                    failed_callbacks: stats.failed_callbacks || 0,
                    timeout_callbacks: stats.timeout_callbacks || 0,
                    avg_retry_count: Math.round((stats.avg_retry_count || 0) * 100) / 100,
                    max_retry_count: stats.max_retry_count || 0,
                    ready_for_retry: stats.ready_for_retry || 0,
                    success_rate: stats.total_callbacks > 0 
                        ? Math.round((stats.completed_callbacks / stats.total_callbacks) * 100) 
                        : 0
                }
            };
            
        } catch (error) {
            console.error('❌ Error getting callback statistics:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Process enhanced media library callback with file management
     * @param {Object} callbackData - Enhanced callback data from MediaUploadService
     * @returns {Object} Processing result
     */
    async processMediaLibraryCallback(callbackData) {
        const startTime = Date.now();
        const trackingId = callbackData.moderation_tracking_id;
        const batchId = callbackData.batch_id;
        
        console.log(`📥 Processing enhanced media library callback for tracking: ${trackingId} / batch: ${batchId}`);
        
        try {
            // Validate enhanced callback data
            if (!this.validateMediaLibraryCallback(callbackData)) {
                throw new Error('Invalid media library callback data structure');
            }
            
            // Check if already processing this specific callback
            const processingKey = trackingId || batchId;
            if (this.processingCallbacks.has(processingKey)) {
                console.log(`⏳ Callback ${processingKey} already being processed, skipping...`);
                return {
                    success: false,
                    error: 'Callback already being processed',
                    tracking_id: trackingId,
                    batch_id: batchId
                };
            }
            
            // Mark as processing
            this.processingCallbacks.add(processingKey);
            
            try {
                // Find media items using tracking ID or batch ID
                const mediaItems = await this.findMediaByTrackingId(trackingId, batchId);
                
                if (mediaItems.length === 0) {
                    console.log(`⚠️ No media items found for tracking: ${trackingId} / batch: ${batchId}`);
                    return {
                        success: false,
                        error: 'No media items found for tracking/batch ID',
                        tracking_id: trackingId,
                        batch_id: batchId
                    };
                }
                
                console.log(`🔍 Found ${mediaItems.length} media items for tracking: ${trackingId}`);
                
                // Extract comprehensive moderation results
                const moderationResult = this.extractEnhancedModerationResult(callbackData);
                console.log(`📋 Enhanced moderation result: status=${moderationResult.status}, score=${moderationResult.score}, risk=${moderationResult.risk_level}`);
                
                // Update media items with enhanced data
                const updateResults = await this.updateMediaWithEnhancedResults(
                    mediaItems,
                    moderationResult,
                    callbackData
                );
                
                // Handle file storage management based on moderation result
                const fileResults = await this.handleFileStorageActions(mediaItems, moderationResult);
                
                // Update callback tracking with enhanced data
                await this.markEnhancedCallbackComplete(trackingId, batchId, callbackData, updateResults);
                
                const processingTime = Date.now() - startTime;
                console.log(`✅ Enhanced callback processed successfully in ${processingTime}ms`);
                console.log(`📈 Updated ${updateResults.updated_count} media items, moved ${fileResults.files_moved} files`);
                
                return {
                    success: true,
                    tracking_id: trackingId,
                    batch_id: batchId,
                    updated_media_count: updateResults.updated_count,
                    moderation_status: moderationResult.status,
                    moderation_score: moderationResult.score,
                    risk_level: moderationResult.risk_level,
                    files_moved: fileResults.files_moved,
                    processing_time_ms: processingTime
                };
                
            } finally {
                // Always remove from processing set
                this.processingCallbacks.delete(processingKey);
            }
            
        } catch (error) {
            const processingTime = Date.now() - startTime;
            console.error(`❌ Enhanced callback processing failed after ${processingTime}ms:`, error.message);
            console.error('Full error stack:', error);
            
            // Log the error for monitoring
            await this.logCallbackError(trackingId, batchId, error, callbackData);
            
            return {
                success: false,
                error: error.message,
                tracking_id: trackingId,
                batch_id: batchId,
                processing_time_ms: processingTime
            };
        }
    }

    /**
     * Validate enhanced media library callback data
     * @param {Object} callbackData - Callback data to validate
     * @returns {boolean} Whether the data is valid
     */
    validateMediaLibraryCallback(callbackData) {
        const required = ['moderation_status'];
        const optional = ['moderation_tracking_id', 'batch_id', 'moderation_score', 'risk_level', 'detected_parts', 'face_analysis'];
        
        // Must have either tracking ID or batch ID
        if (!callbackData.moderation_tracking_id && !callbackData.batch_id) {
            console.error('❌ Missing both moderation_tracking_id and batch_id');
            return false;
        }
        
        // Check required fields
        for (const field of required) {
            if (!callbackData[field]) {
                console.error(`❌ Missing required field: ${field}`);
                return false;
            }
        }
        
        // Validate moderation status
        const validStatuses = ['approved', 'rejected', 'flagged', 'pending', 'error'];
        if (!validStatuses.includes(callbackData.moderation_status)) {
            console.error(`❌ Invalid moderation_status: ${callbackData.moderation_status}`);
            return false;
        }
        
        console.log(`✅ Enhanced callback data validation passed`);
        return true;
    }

    /**
     * Find media items by tracking ID or batch ID
     * @param {string} trackingId - Moderation tracking ID
     * @param {string} batchId - Batch ID (fallback)
     * @returns {Array} Media items found
     */
    async findMediaByTrackingId(trackingId, batchId) {
        try {
            let query = `
                SELECT 
                    mml.*,
                    mml_link.content_moderation_id,
                    mml_link.batch_id as linked_batch_id
                FROM model_media_library mml
                LEFT JOIN media_moderation_links mml_link ON mml.id = mml_link.media_id
                WHERE mml.is_deleted = 0
            `;
            
            const params = [];
            
            if (trackingId) {
                query += ` AND (mml_link.moderation_tracking_id = ? OR mml.moderation_tracking_id = ?)`;
                params.push(trackingId, trackingId);
            } else if (batchId) {
                query += ` AND mml_link.batch_id = ?`;
                params.push(batchId);
            } else {
                return [];
            }
            
            const rows = await this.db.query(query, params);
            console.log(`🔍 Found ${rows.length} media items for tracking: ${trackingId} / batch: ${batchId}`);
            
            return rows || [];
            
        } catch (error) {
            console.error('❌ Error finding media by tracking ID:', error.message);
            throw error;
        }
    }

    /**
     * Extract enhanced moderation result from callback data
     * @param {Object} callbackData - Raw callback data
     * @returns {Object} Structured moderation result
     */
    extractEnhancedModerationResult(callbackData) {
        return {
            status: callbackData.moderation_status,
            score: parseFloat(callbackData.moderation_score) || 0,
            confidence_score: parseFloat(callbackData.confidence_score) || 0,
            risk_level: callbackData.risk_level || 'unknown',
            notes: callbackData.moderation_notes || null,
            human_review_required: callbackData.human_review_required === true || callbackData.human_review_required === 'true',
            detected_parts: callbackData.detected_parts || {},
            face_analysis: callbackData.face_analysis || {},
            violation_types: callbackData.violation_types || [],
            image_quality_score: parseFloat(callbackData.image_quality_score) || null,
            technical_issues: callbackData.technical_issues || [],
            analysis_version: callbackData.analysis_version || 'unknown'
        };
    }

    /**
     * Update media items with enhanced moderation results
     * @param {Array} mediaItems - Media items to update
     * @param {Object} moderationResult - Moderation result data
     * @param {Object} callbackData - Full callback data
     * @returns {Object} Update results
     */
    async updateMediaWithEnhancedResults(mediaItems, moderationResult, callbackData) {
        let updated_count = 0;
        
        try {
            for (const media of mediaItems) {
                const updateQuery = `
                    UPDATE model_media_library 
                    SET 
                        moderation_status = ?,
                        moderation_notes = ?,
                        moderation_score = ?,
                        confidence_score = ?,
                        risk_level = ?,
                        human_review_required = ?,
                        image_quality_score = ?,
                        moderation_completed_at = NOW(),
                        last_modified = NOW()
                    WHERE id = ?
                `;
                
                const params = [
                    moderationResult.status,
                    moderationResult.notes,
                    moderationResult.score,
                    moderationResult.confidence_score,
                    moderationResult.risk_level,
                    moderationResult.human_review_required ? 1 : 0,
                    moderationResult.image_quality_score,
                    media.id
                ];
                
                await this.db.execute(updateQuery, params);
                
                // Store detailed analysis data if available
                if (Object.keys(moderationResult.detected_parts).length > 0 || Object.keys(moderationResult.face_analysis).length > 0) {
                    await this.storeDetailedAnalysis(media.id, moderationResult, callbackData);
                }
                
                updated_count++;
                console.log(`✅ Updated media ${media.id} to status: ${moderationResult.status}`);
            }
            
            return {
                success: true,
                updated_count
            };
            
        } catch (error) {
            console.error('❌ Error updating media with enhanced results:', error.message);
            throw error;
        }
    }

    /**
     * Store detailed analysis data for media item
     * @param {number} mediaId - Media item ID
     * @param {Object} moderationResult - Moderation result
     * @param {Object} callbackData - Full callback data
     */
    async storeDetailedAnalysis(mediaId, moderationResult, callbackData) {
        try {
            const insertQuery = `
                INSERT INTO media_analysis_details (
                    media_id, detected_parts, face_analysis, violation_types,
                    technical_issues, analysis_version, raw_callback_data,
                    created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE
                detected_parts = VALUES(detected_parts),
                face_analysis = VALUES(face_analysis),
                violation_types = VALUES(violation_types),
                technical_issues = VALUES(technical_issues),
                analysis_version = VALUES(analysis_version),
                raw_callback_data = VALUES(raw_callback_data),
                updated_at = NOW()
            `;
            
            const params = [
                mediaId,
                JSON.stringify(moderationResult.detected_parts),
                JSON.stringify(moderationResult.face_analysis),
                JSON.stringify(moderationResult.violation_types),
                JSON.stringify(moderationResult.technical_issues),
                moderationResult.analysis_version,
                JSON.stringify(callbackData)
            ];
            
            await this.db.execute(insertQuery, params);
            console.log(`📊 Stored detailed analysis for media ${mediaId}`);
            
        } catch (error) {
            console.error('⚠️ Failed to store detailed analysis:', error.message);
            // Don't throw - this is supplementary data
        }
    }

    /**
     * Handle file storage actions based on moderation result
     * @param {Array} mediaItems - Media items
     * @param {Object} moderationResult - Moderation result
     * @returns {Object} File operation results
     */
    async handleFileStorageActions(mediaItems, moderationResult) {
        let files_moved = 0;
        
        try {
            // Only move files if we have a definitive approved/rejected status
            if (moderationResult.status === 'approved' || moderationResult.status === 'rejected') {
                const FileStorageService = require('./FileStorageService');
                const fileStorage = new FileStorageService();
                
                for (const media of mediaItems) {
                    try {
                        const moveResult = await fileStorage.moveMediaFile(media, moderationResult.status);
                        if (moveResult.success) {
                            files_moved++;
                            console.log(`📁 Moved file for media ${media.id} to ${moderationResult.status} folder`);
                        }
                    } catch (fileError) {
                        console.error(`⚠️ Failed to move file for media ${media.id}:`, fileError.message);
                        // Continue processing other files
                    }
                }
            }
            
            return { files_moved };
            
        } catch (error) {
            console.error('⚠️ Error in file storage actions:', error.message);
            return { files_moved: 0 };
        }
    }

    /**
     * Mark enhanced callback as complete with comprehensive tracking
     * @param {string} trackingId - Tracking ID
     * @param {string} batchId - Batch ID
     * @param {Object} callbackData - Callback data
     * @param {Object} updateResults - Update results
     */
    async markEnhancedCallbackComplete(trackingId, batchId, callbackData, updateResults) {
        try {
            const completeQuery = `
                UPDATE moderation_callbacks 
                SET 
                    status = 'completed',
                    completed_at = NOW(),
                    updated_at = NOW(),
                    final_status = ?,
                    processing_notes = ?,
                    media_updated_count = ?
                WHERE (moderation_tracking_id = ? OR batch_id = ?) 
                  AND status IN ('pending', 'processing')
            `;
            
            const processingNotes = `Callback processed successfully. Updated ${updateResults.updated_count} media items to status: ${callbackData.moderation_status}`;
            
            await this.db.execute(completeQuery, [
                callbackData.moderation_status,
                processingNotes,
                updateResults.updated_count,
                trackingId,
                batchId
            ]);
            
            console.log(`✅ Marked enhanced callback complete for tracking: ${trackingId} / batch: ${batchId}`);
            
        } catch (error) {
            console.error('⚠️ Failed to mark enhanced callback complete:', error.message);
            // Don't throw - the main processing succeeded
        }
    }

    /**
     * Log callback processing errors for monitoring
     * @param {string} trackingId - Tracking ID
     * @param {string} batchId - Batch ID
     * @param {Error} error - Error that occurred
     * @param {Object} callbackData - Original callback data
     */
    async logCallbackError(trackingId, batchId, error, callbackData) {
        try {
            const errorQuery = `
                INSERT INTO moderation_callback_errors (
                    moderation_tracking_id, batch_id, error_message, error_stack,
                    callback_data, created_at
                ) VALUES (?, ?, ?, ?, ?, NOW())
            `;
            
            await this.db.execute(errorQuery, [
                trackingId,
                batchId,
                error.message,
                error.stack,
                JSON.stringify(callbackData)
            ]);
            
            console.log(`📝 Logged callback error for tracking: ${trackingId} / batch: ${batchId}`);
            
        } catch (logError) {
            console.error('⚠️ Failed to log callback error:', logError.message);
        }
    }
}

module.exports = ModerationCallbackHandler;