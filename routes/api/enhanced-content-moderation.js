/**
 * Enhanced Content Moderation API with Usage Intent & Auto-Rules
 * Implements the refined workflow for model uploads with flexible approval system
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// Import the content moderation service
const ContentModerationService = require('../../src/services/ContentModerationService');

// Database connection
let db;
try {
    db = require('../../config/database');
} catch (error) {
    console.error('Database connection error:', error.message);
}

// Initialize content moderation service
const moderationService = new ContentModerationService(db);

// Configure multer for temporary uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const tempPath = path.join(__dirname, '../../temp_uploads');
        fs.mkdirSync(tempPath, { recursive: true });
        cb(null, tempPath);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'temp-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 16 * 1024 * 1024 }, // 16MB limit
    fileFilter: function (req, file, cb) {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

/**
 * Upload image with usage intent (Step 1 & 2 of workflow)
 * POST /api/enhanced-content-moderation/upload
 */
router.post('/upload', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const {
            model_id,
            model_slug,
            usage_intent = 'public_site', // public_site, paysite, store, private
            context_type = 'public_gallery',
            title,
            description
        } = req.body;

        console.log('Received upload request:', {
            model_id,
            model_slug,
            usage_intent,
            context_type,
            file: req.file ? req.file.originalname : 'no file'
        });

        if (!model_id || !model_slug) {
            return res.status(400).json({ 
                error: 'model_id and model_slug are required',
                received: { model_id, model_slug }
            });
        }

        console.log(`🚀 Processing upload for model ${model_slug} with intent: ${usage_intent}`);
        const processStartTime = Date.now();

        // Process through moderation workflow
        const result = await moderationService.processUploadedImage({
            filePath: req.file.path,
            originalName: req.file.originalname,
            modelId: parseInt(model_id),
            modelSlug: model_slug,
            usageIntent: usage_intent,
            contextType: context_type,
            title,
            description
        });

        const processTime = Date.now() - processStartTime;
        console.log(`✅ Upload processing completed in ${processTime}ms`);
        console.log(`📊 Result: success=${result.success}, status=${result.moderation_status}, nudity=${result.nudity_score}`);

        // Clean up temp file
        fs.unlink(req.file.path, () => {});

        if (result.success) {
            console.log('📤 Sending successful response to client...');
            const response = {
                success: true,
                message: getStatusMessage(result),
                data: {
                    content_moderation_id: result.contentModerationId,
                    moderation_status: result.moderation_status,
                    usage_intent: result.usage_intent,
                    nudity_score: result.nudity_score,
                    flagged: result.flagged,
                    human_review_required: result.human_review_required,
                    final_location: result.final_location,
                    detected_parts: result.detected_parts,
                    part_locations: result.part_locations,
                    
                    // Include pose analysis data from MediaPipe
                    pose_analysis: result.pose_analysis || null,
                    pose_category: result.pose_category || 'unknown',
                    explicit_pose_score: result.explicit_pose_score || 0,
                    final_risk_score: result.final_risk_score || result.nudity_score,
                    risk_level: result.risk_level || 'unknown',
                    combined_assessment: result.combined_assessment || null
                }
            };
            
            res.json(response);
            console.log('✅ Response sent successfully');
        } else {
            console.log('❌ Sending error response to client...');
            res.status(500).json({
                success: false,
                error: result.error,
                message: 'Upload processing failed'
            });
            console.log('✅ Error response sent');
        }

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get moderation rules for specific usage intent
 * GET /api/enhanced-content-moderation/rules/:usage_intent
 */
router.get('/rules/:usage_intent', async (req, res) => {
    try {
        const { usage_intent } = req.params;
        const rules = await moderationService.loadModerationRules(usage_intent);
        
        res.json({
            success: true,
            usage_intent,
            rules
        });
    } catch (error) {
        console.error('Error fetching rules:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Create appeal for flagged content
 * POST /api/enhanced-content-moderation/appeal
 */
router.post('/appeal', async (req, res) => {
    try {
        const { content_moderation_id, model_id, reason, message } = req.body;

        if (!content_moderation_id || !model_id || !reason) {
            return res.status(400).json({
                error: 'content_moderation_id, model_id, and reason are required'
            });
        }

        const appealId = await moderationService.createAppeal(
            content_moderation_id,
            model_id,
            { reason, message }
        );

        res.json({
            success: true,
            appeal_id: appealId,
            message: 'Appeal submitted successfully'
        });

    } catch (error) {
        console.error('Appeal error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Admin: Get moderation queue
 * GET /api/enhanced-content-moderation/admin/queue
 */
router.get('/admin/queue', async (req, res) => {
    try {
        const { queue_type, priority, model_id } = req.query;
        
        let query = `
            SELECT 
                cm.id,
                cm.model_id,
                m.name as model_name,
                m.slug as model_slug,
                cm.image_path,
                cm.original_path,
                cm.usage_intent,
                cm.nudity_score,
                cm.detected_parts,
                cm.part_locations,
                cm.moderation_status,
                cm.flagged,
                cm.appeal_requested,
                cm.created_at,
                mq.priority,
                mq.queue_type,
                ma.id as appeal_id,
                ma.appeal_reason,
                ma.appeal_message,
                ma.status as appeal_status
            FROM moderation_queue mq
            JOIN content_moderation cm ON mq.content_moderation_id = cm.id
            JOIN models m ON cm.model_id = m.id
            LEFT JOIN moderation_appeals ma ON mq.appeal_id = ma.id
            WHERE 1=1
        `;
        
        const params = [];
        
        if (queue_type) {
            query += ' AND mq.queue_type = ?';
            params.push(queue_type);
        }
        
        if (priority) {
            query += ' AND mq.priority = ?';
            params.push(priority);
        }
        
        if (model_id) {
            query += ' AND cm.model_id = ?';
            params.push(model_id);
        }
        
        query += ' ORDER BY FIELD(mq.priority, "urgent", "high", "medium", "low"), cm.created_at ASC';
        
        const [results] = await db.execute(query, params);
        
        // Parse JSON fields safely
        const processedResults = results.map(row => {
            let detectedParts = {};
            let partLocations = {};
            
            try {
                detectedParts = typeof row.detected_parts === 'string' ? 
                    JSON.parse(row.detected_parts) : (row.detected_parts || {});
            } catch (e) {
                console.error('Error parsing detected_parts:', e);
                detectedParts = {};
            }
            
            try {
                partLocations = typeof row.part_locations === 'string' ? 
                    JSON.parse(row.part_locations) : (row.part_locations || {});
            } catch (e) {
                console.error('Error parsing part_locations:', e);
                partLocations = {};
            }
            
            return {
                ...row,
                detected_parts: detectedParts,
                part_locations: partLocations
            };
        });
        
        res.json({
            success: true,
            queue: processedResults,
            total: processedResults.length
        });
        
    } catch (error) {
        console.error('Queue fetch error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Admin: Approve content with blur
 * POST /api/enhanced-content-moderation/admin/approve-with-blur
 */
router.post('/admin/approve-with-blur', async (req, res) => {
    try {
        const { 
            content_moderation_id, 
            blur_settings, 
            admin_notes, 
            reviewed_by 
        } = req.body;

        if (!content_moderation_id || !reviewed_by) {
            return res.status(400).json({
                error: 'content_moderation_id and reviewed_by are required'
            });
        }

        await moderationService.approveWithBlur(
            content_moderation_id,
            blur_settings || {},
            admin_notes || '',
            reviewed_by
        );

        res.json({
            success: true,
            message: 'Content approved with blur settings'
        });

    } catch (error) {
        console.error('Approve with blur error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Admin: Approve content without blur
 * POST /api/enhanced-content-moderation/admin/approve
 */
router.post('/admin/approve', async (req, res) => {
    try {
        const { content_moderation_id, admin_notes, reviewed_by, final_location } = req.body;

        if (!content_moderation_id || !reviewed_by) {
            return res.status(400).json({
                error: 'content_moderation_id and reviewed_by are required'
            });
        }

        const updateQuery = `
            UPDATE content_moderation 
            SET moderation_status = 'approved',
                final_location = ?,
                admin_notes = ?,
                reviewed_by = ?,
                reviewed_at = NOW(),
                flagged = FALSE,
                human_review_required = FALSE
            WHERE id = ?
        `;

        await db.execute(updateQuery, [
            final_location || 'public',
            admin_notes || '',
            reviewed_by,
            content_moderation_id
        ]);

        // Remove from moderation queue
        await db.execute(
            'DELETE FROM moderation_queue WHERE content_moderation_id = ?',
            [content_moderation_id]
        );

        res.json({
            success: true,
            message: 'Content approved successfully'
        });

    } catch (error) {
        console.error('Approve error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Admin: Reject content
 * POST /api/enhanced-content-moderation/admin/reject
 */
router.post('/admin/reject', async (req, res) => {
    try {
        const { content_moderation_id, admin_notes, reviewed_by } = req.body;

        if (!content_moderation_id || !reviewed_by) {
            return res.status(400).json({
                error: 'content_moderation_id and reviewed_by are required'
            });
        }

        const updateQuery = `
            UPDATE content_moderation 
            SET moderation_status = 'rejected',
                final_location = 'rejected',
                admin_notes = ?,
                reviewed_by = ?,
                reviewed_at = NOW(),
                human_review_required = FALSE
            WHERE id = ?
        `;

        await db.execute(updateQuery, [
            admin_notes || '',
            reviewed_by,
            content_moderation_id
        ]);

        // Remove from moderation queue
        await db.execute(
            'DELETE FROM moderation_queue WHERE content_moderation_id = ?',
            [content_moderation_id]
        );

        res.json({
            success: true,
            message: 'Content rejected'
        });

    } catch (error) {
        console.error('Reject error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get model's content status
 * GET /api/enhanced-content-moderation/model/:model_id/status
 */
router.get('/model/:model_id/status', async (req, res) => {
    try {
        const { model_id } = req.params;
        const { usage_intent } = req.query;

        let query = `
            SELECT 
                usage_intent,
                moderation_status,
                final_location,
                flagged,
                appeal_requested,
                COUNT(*) as count
            FROM content_moderation 
            WHERE model_id = ?
        `;
        
        const params = [model_id];
        
        if (usage_intent) {
            query += ' AND usage_intent = ?';
            params.push(usage_intent);
        }
        
        query += ' GROUP BY usage_intent, moderation_status, final_location, flagged, appeal_requested';
        
        const [results] = await db.execute(query, params);
        
        res.json({
            success: true,
            model_id,
            status_summary: results
        });
        
    } catch (error) {
        console.error('Status fetch error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Helper function to get status message
 */
function getStatusMessage(result) {
    if (result.moderation_status === 'approved') {
        return `Image approved for ${result.usage_intent} and moved to ${result.final_location}`;
    } else if (result.flagged) {
        return `Image flagged for manual review due to ${result.auto_blocked ? 'automatic rules' : 'manual flagging'}`;
    } else {
        return 'Image processed successfully';
    }
}

module.exports = router;