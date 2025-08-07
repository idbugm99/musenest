/**
 * BLIP Analysis Webhook Handler for Child Detection Updates
 * Receives final child_detected boolean from AI server after BLIP processing
 */

const express = require('express');
const router = express.Router();

// Database connection
let db;
try {
    db = require('../../config/database');
} catch (error) {
    console.error('Database connection error:', error.message);
}

/**
 * POST /api/blip/webhook
 * Receives updates from AI server when BLIP processing completes
 */
router.post('/webhook', async (req, res) => {
    
    try {
        const {
            batch_id,
            timestamp,
            status,
            child_detected,
            image_description,
            combined_assessment
        } = req.body;

        // Validate required fields
        if (!batch_id) {
            return res.status(400).json({
                success: false,
                error: 'batch_id is required'
            });
        }

        // Find the content moderation record by batch_id
        const findQuery = `
            SELECT id, child_detected, moderation_status
            FROM content_moderation 
            WHERE batch_id = ? OR id = ?
            LIMIT 1
        `;
        
        const [records] = await db.execute(findQuery, [batch_id, batch_id]);
        
        if (records.length === 0) {
            console.warn(`⚠️ No content moderation record found for batch_id: ${batch_id}`);
            return res.status(404).json({
                success: false,
                error: 'Content moderation record not found',
                batch_id: batch_id
            });
        }

        const record = records[0];

        // Prepare update data
        const updates = {
            child_detected: child_detected === true ? 1 : 0
        };

        // Add description data if provided
        if (image_description && image_description.description) {
            updates.description_text = image_description.description;
        }

        // Add assessment data if provided
        if (combined_assessment) {
            if (combined_assessment.final_risk_score) {
                updates.final_risk_score = combined_assessment.final_risk_score;
            }
            if (combined_assessment.risk_level) {
                updates.risk_level = combined_assessment.risk_level;
            }
        }

        // Build dynamic update query
        const updateFields = Object.keys(updates).map(field => `${field} = ?`).join(', ');
        const updateValues = Object.values(updates);
        updateValues.push(record.id); // Add ID for WHERE clause

        const updateQuery = `
            UPDATE content_moderation 
            SET ${updateFields}
            WHERE id = ?
        `;

        await db.execute(updateQuery, updateValues);

        // If child detected, update priority and queue type
        if (child_detected === true) {
            
            // Check if record exists in media_review_queue
            const queueCheckQuery = `
                SELECT id FROM media_review_queue 
                WHERE content_moderation_id = ?
            `;
            const [queueRecords] = await db.execute(queueCheckQuery, [record.id]);
            
            if (queueRecords.length > 0) {
                // Update existing queue record
                const queueUpdateQuery = `
                    UPDATE media_review_queue 
                    SET priority = 'critical',
                        queue_type = 'child_content_review',
                        child_detected = 1,
                        updated_at = NOW()
                    WHERE content_moderation_id = ?
                `;
                await db.execute(queueUpdateQuery, [record.id]);
            } else {
                // Insert new queue record
                const queueInsertQuery = `
                    INSERT INTO media_review_queue 
                    (content_moderation_id, priority, queue_type, child_detected, created_at)
                    VALUES (?, 'critical', 'child_content_review', 1, NOW())
                `;
                await db.execute(queueInsertQuery, [record.id]);
            }

            // TODO: Add notification system for critical child content
            // notifyModerators(record.id, 'CHILD_CONTENT_DETECTED');
        }

        // Log successful processing for audit purposes
        console.log(`✅ BLIP webhook processed: batch_id=${batch_id}, child_detected=${child_detected}, content_id=${record.id}`);

        // Send success response
        res.json({
            success: true,
            message: 'Child detection status updated successfully',
            data: {
                content_moderation_id: record.id,
                batch_id: batch_id,
                child_detected: child_detected,
                previous_value: record.child_detected,
                updated_fields: Object.keys(updates)
            }
        });

    } catch (error) {
        console.error('❌ BLIP Webhook processing error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * GET /api/blip/test
 * Test endpoint to verify webhook is working
 */
router.get('/test', (req, res) => {
    res.json({
        success: true,
        message: 'BLIP webhook endpoint is working',
        timestamp: new Date().toISOString(),
        endpoint: '/api/blip-webhook'
    });
});

/**
 * Catch-all route for unmatched requests
 */
router.all('*', (req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `The requested resource ${req.method} ${req.originalUrl} could not be found.`,
        available_endpoints: [
            'POST /api/blip/webhook',
            'GET /api/blip/test'
        ]
    });
});

module.exports = router;