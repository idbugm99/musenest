/**
 * Moderation Webhook API Routes
 * Part of Phase B.2: Moderation System Integration
 * Handles incoming webhook callbacks from the moderation system
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const ModerationCallbackHandler = require('../../src/services/ModerationCallbackHandler');

/**
 * Validate webhook signature for security
 * @param {string} signature - The provided signature header
 * @param {Object} payload - The webhook payload
 * @param {string} secret - The webhook secret
 * @returns {boolean} Whether the signature is valid
 */
function validateWebhookSignature(signature, payload, secret) {
    try {
        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(JSON.stringify(payload))
            .digest('hex');
        
        const providedSignature = signature.startsWith('sha256=') ? signature.slice(7) : signature;
        
        return crypto.timingSafeEqual(
            Buffer.from(expectedSignature, 'hex'),
            Buffer.from(providedSignature, 'hex')
        );
    } catch (error) {
        console.error('❌ Webhook signature validation error:', error.message);
        return false;
    }
}

// Initialize callback handler (will be set by middleware)
let callbackHandler = null;

// Middleware to initialize callback handler with database connection
router.use((req, res, next) => {
    if (!callbackHandler && req.db) {
        callbackHandler = new ModerationCallbackHandler(req.db);
        console.log('📞 ModerationCallbackHandler initialized for API routes');
    }
    next();
});

/**
 * POST /api/moderation-webhooks/result
 * Enhanced callback endpoint specifically for media library moderation results
 * Supports the MediaUploadService webhook integration
 */
router.post('/result', async (req, res) => {
    const startTime = Date.now();
    
    try {
        if (!callbackHandler) {
            console.error('❌ ModerationCallbackHandler not initialized');
            return res.status(500).json({
                success: false,
                error: 'Callback handler not initialized'
            });
        }

        const callbackData = req.body;
        console.log(`📥 Received media library moderation result`);
        console.log(`🔍 Result payload keys:`, Object.keys(callbackData));
        console.log(`📋 Tracking ID:`, callbackData.moderation_tracking_id);
        console.log(`📋 Batch ID:`, callbackData.batch_id);
        console.log(`⚖️ Moderation Status:`, callbackData.moderation_status);

        // Enhanced validation for media library callbacks
        if (!callbackData.moderation_tracking_id && !callbackData.batch_id) {
            return res.status(400).json({
                success: false,
                error: 'Missing required tracking or batch ID'
            });
        }

        // Validate webhook signature if configured
        const webhookSecret = process.env.MODERATION_WEBHOOK_SECRET || 'musenest_webhook_secret';
        const providedSignature = req.headers['x-webhook-signature'];
        if (providedSignature && !validateWebhookSignature(providedSignature, callbackData, webhookSecret)) {
            console.error('❌ Invalid webhook signature');
            return res.status(401).json({
                success: false,
                error: 'Invalid webhook signature'
            });
        }

        // Process the enhanced callback
        const result = await callbackHandler.processMediaLibraryCallback(callbackData);
        
        const totalTime = Date.now() - startTime;
        
        if (result.success) {
            console.log(`✅ Media library callback processed successfully in ${totalTime}ms`);
            console.log(`📊 Result: ${result.updated_media_count} media items updated to ${result.moderation_status}`);
            
            res.status(200).json({
                success: true,
                message: 'Media library callback processed successfully',
                tracking_id: result.tracking_id,
                batch_id: result.batch_id,
                updated_media_count: result.updated_media_count,
                moderation_status: result.moderation_status,
                moderation_score: result.moderation_score,
                processing_time_ms: result.processing_time_ms,
                files_moved: result.files_moved || 0
            });
        } else {
            console.error(`❌ Media library callback processing failed in ${totalTime}ms:`, result.error);
            
            // Return 200 to prevent webhook retries for invalid data
            // Return 500 only for temporary server issues
            const statusCode = result.error.includes('Invalid') || result.error.includes('already being processed') ? 200 : 500;
            
            res.status(statusCode).json({
                success: false,
                error: result.error,
                tracking_id: result.tracking_id,
                batch_id: result.batch_id,
                processing_time_ms: totalTime
            });
        }

    } catch (error) {
        const totalTime = Date.now() - startTime;
        console.error(`❌ Media library webhook callback error after ${totalTime}ms:`, error.message);
        console.error('Full error:', error);
        
        res.status(500).json({
            success: false,
            error: 'Internal server error processing media library callback',
            processing_time_ms: totalTime
        });
    }
});

/**
 * POST /api/moderation-webhooks/callback
 * Handle incoming moderation callback from EC2 server or BLIP analysis (legacy endpoint)
 */
router.post('/callback', async (req, res) => {
    const startTime = Date.now();
    
    try {
        if (!callbackHandler) {
            console.error('❌ ModerationCallbackHandler not initialized');
            return res.status(500).json({
                success: false,
                error: 'Callback handler not initialized'
            });
        }

        const callbackData = req.body;
        console.log(`📥 Received moderation webhook callback`);
        console.log(`🔍 Callback payload keys:`, Object.keys(callbackData));
        console.log(`📋 Batch ID:`, callbackData.batch_id);
        console.log(`⚖️ Moderation Status:`, callbackData.moderation_status);

        // Validate required webhook headers/authentication if needed
        // const authHeader = req.headers['x-webhook-signature'];
        // if (!validateWebhookSignature(authHeader, callbackData)) {
        //     return res.status(401).json({ success: false, error: 'Invalid webhook signature' });
        // }

        // Process the callback
        const result = await callbackHandler.processCallback(callbackData);
        
        const totalTime = Date.now() - startTime;
        
        if (result.success) {
            console.log(`✅ Webhook callback processed successfully in ${totalTime}ms`);
            console.log(`📊 Result: ${result.updated_media_count} media items updated to ${result.moderation_status}`);
            
            res.status(200).json({
                success: true,
                message: 'Callback processed successfully',
                batch_id: result.batch_id,
                updated_media_count: result.updated_media_count,
                moderation_status: result.moderation_status,
                moderation_score: result.moderation_score,
                processing_time_ms: result.processing_time_ms
            });
        } else {
            console.error(`❌ Webhook callback processing failed in ${totalTime}ms:`, result.error);
            
            // Return 200 to prevent webhook retries for invalid data
            // Return 500 only for temporary server issues
            const statusCode = result.error.includes('Invalid') || result.error.includes('already being processed') ? 200 : 500;
            
            res.status(statusCode).json({
                success: false,
                error: result.error,
                batch_id: result.batch_id,
                processing_time_ms: totalTime
            });
        }

    } catch (error) {
        const totalTime = Date.now() - startTime;
        console.error(`❌ Webhook callback handler error after ${totalTime}ms:`, error.message);
        console.error('Full error:', error);
        
        res.status(500).json({
            success: false,
            error: 'Internal server error processing callback',
            processing_time_ms: totalTime
        });
    }
});

/**
 * GET /api/moderation-webhooks/statistics
 * Get callback processing statistics
 */
router.get('/statistics', async (req, res) => {
    try {
        if (!callbackHandler) {
            return res.status(500).json({
                success: false,
                error: 'Callback handler not initialized'
            });
        }

        const { model_slug } = req.query;
        const stats = await callbackHandler.getCallbackStatistics(model_slug);
        
        console.log(`📊 Retrieved callback statistics for ${model_slug || 'all models'}`);
        
        res.json(stats);

    } catch (error) {
        console.error('❌ Error getting callback statistics:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve callback statistics'
        });
    }
});

/**
 * POST /api/moderation-webhooks/process-retries
 * Manually trigger processing of pending retries
 */
router.post('/process-retries', async (req, res) => {
    try {
        if (!callbackHandler) {
            return res.status(500).json({
                success: false,
                error: 'Callback handler not initialized'
            });
        }

        console.log('🔄 Manual retry processing triggered via API');
        const results = await callbackHandler.processPendingRetries();
        
        console.log(`📊 Manual retry processing complete: ${results.processed} processed, ${results.errors} errors`);
        
        res.json({
            success: true,
            message: 'Retry processing completed',
            processed: results.processed,
            errors: results.errors
        });

    } catch (error) {
        console.error('❌ Error processing pending retries:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to process pending retries'
        });
    }
});

/**
 * GET /api/moderation-webhooks/pending-callbacks
 * Get list of pending callbacks for monitoring
 */
router.get('/pending-callbacks', async (req, res) => {
    try {
        const { limit = 50, model_slug } = req.query;
        
        let query = `
            SELECT 
                mc.batch_id,
                mc.model_slug,
                mc.status,
                mc.retry_count,
                mc.max_retries,
                mc.next_retry_at,
                mc.created_at,
                mc.updated_at,
                COUNT(mml.id) as media_count
            FROM moderation_callbacks mc
            LEFT JOIN media_moderation_links mml_link ON mc.batch_id = mml_link.batch_id
            LEFT JOIN model_media_library mml ON mml_link.media_id = mml.id
            WHERE mc.status IN ('pending', 'failed')
        `;
        
        const params = [];
        if (model_slug) {
            query += ' AND mc.model_slug = ?';
            params.push(model_slug);
        }
        
        query += `
            GROUP BY mc.id
            ORDER BY mc.created_at DESC
            LIMIT ?
        `;
        params.push(parseInt(limit));

        const [rows] = await req.db.execute(query, params);
        
        console.log(`📋 Retrieved ${rows.length} pending callbacks`);
        
        res.json({
            success: true,
            callbacks: rows.map(row => ({
                batch_id: row.batch_id,
                model_slug: row.model_slug,
                status: row.status,
                retry_count: row.retry_count,
                max_retries: row.max_retries,
                next_retry_at: row.next_retry_at,
                created_at: row.created_at,
                updated_at: row.updated_at,
                media_count: row.media_count || 0
            }))
        });

    } catch (error) {
        console.error('❌ Error getting pending callbacks:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve pending callbacks'
        });
    }
});

/**
 * POST /api/moderation-webhooks/test
 * Test endpoint for callback processing with sample data
 */
router.post('/test', async (req, res) => {
    try {
        if (!callbackHandler) {
            return res.status(500).json({
                success: false,
                error: 'Callback handler not initialized'
            });
        }

        // Sample test callback data
        const testCallback = {
            batch_id: `test_${Date.now()}`,
            moderation_status: 'approved',
            nudity_score: 15.5,
            detected_parts: {
                'CLOTHED_PERSON': 85.2
            },
            face_analysis: {
                face_count: 1,
                min_age: 25,
                underage_detected: false
            },
            risk_level: 'low',
            analysis_version: 'test_callback_v1',
            ...req.body // Allow override of test data
        };

        console.log('🧪 Processing test callback:', testCallback.batch_id);
        
        const result = await callbackHandler.processCallback(testCallback);
        
        res.json({
            success: true,
            message: 'Test callback processed',
            test_data: testCallback,
            result: result
        });

    } catch (error) {
        console.error('❌ Error processing test callback:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to process test callback'
        });
    }
});

module.exports = router;