const express = require('express');
const router = express.Router();
const db = require('../../config/database');

// Database check endpoint - shows what was inserted
router.post('/database-check', async (req, res) => {
    try {
        const { content_moderation_id } = req.body;
        
        if (!content_moderation_id) {
            return res.status(400).json({ 
                success: false, 
                error: 'content_moderation_id is required' 
            });
        }

        const sql_query = `
            SELECT 
                id, image_path, original_path, model_id, context_type, usage_intent,
                nudity_score, detected_parts, part_locations, has_nudity,
                face_analysis, face_count, min_detected_age, max_detected_age, 
                underage_detected, age_risk_multiplier,
                image_description, description_text, description_tags, 
                contains_children, description_risk,
                final_risk_score, risk_level, risk_reasoning,
                moderation_status, human_review_required, flagged, 
                auto_rejected, rejection_reason, final_location, created_at
            FROM content_moderation 
            WHERE id = ?
        `;

        console.log('🔍 Database check SQL:', sql_query.trim());
        console.log('🔍 Parameters:', [content_moderation_id]);

        const result = await db.query(sql_query, [content_moderation_id]);

        if (result.length === 0) {
            return res.json({
                success: false,
                error: 'No record found with that ID',
                sql_query: sql_query.trim()
            });
        }

        const record = result[0];
        
        // Parse JSON fields for display
        try {
            record.detected_parts_parsed = JSON.parse(record.detected_parts || '{}');
            record.part_locations_parsed = JSON.parse(record.part_locations || '{}');
            record.policy_violations_parsed = JSON.parse(record.policy_violations || '[]');
            record.combined_assessment_parsed = JSON.parse(record.combined_assessment || '{}');
            record.pose_analysis_parsed = JSON.parse(record.pose_analysis || '{}');
        } catch (parseError) {
            console.log('⚠️ JSON parsing warning:', parseError.message);
        }

        res.json({
            success: true,
            sql_query: sql_query.trim(),
            data: record,
            message: 'Database record found and verified'
        });

    } catch (error) {
        console.error('❌ Database check error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Database retrieve endpoint - simulates what the admin interface does
router.post('/database-retrieve', async (req, res) => {
    try {
        const { content_moderation_id } = req.body;
        
        if (!content_moderation_id) {
            return res.status(400).json({ 
                success: false, 
                error: 'content_moderation_id is required' 
            });
        }

        const sql_query = `
            SELECT 
                cm.id, cm.image_path, cm.original_path, cm.nudity_score,
                cm.detected_parts, cm.part_locations, cm.final_risk_score, cm.risk_level,
                cm.face_analysis, cm.face_count, cm.min_detected_age, cm.max_detected_age,
                cm.underage_detected, cm.image_description, cm.description_text,
                cm.moderation_status, cm.human_review_required, cm.flagged, cm.final_location,
                cm.created_at, m.name as model_name
            FROM content_moderation cm
            LEFT JOIN models m ON cm.model_id = m.id
            WHERE cm.id = ?
        `;

        console.log('🔍 Database retrieve SQL:', sql_query.trim());
        console.log('🔍 Parameters:', [content_moderation_id]);

        const result = await db.query(sql_query, [content_moderation_id]);

        if (result.length === 0) {
            return res.json({
                success: false,
                error: 'No record found with that ID',
                sql_query: sql_query.trim()
            });
        }

        const record = result[0];
        
        // Parse JSON fields for v3.0 schema
        try {
            record.detected_parts_parsed = JSON.parse(record.detected_parts || '{}');
            record.part_locations_parsed = JSON.parse(record.part_locations || '{}');
            record.face_analysis_parsed = JSON.parse(record.face_analysis || '{}');
            record.image_description_parsed = JSON.parse(record.image_description || '{}');
        } catch (parseError) {
            console.log('⚠️ JSON parsing warning:', parseError.message);
        }

        res.json({
            success: true,
            sql_query: sql_query.trim(),
            data: record,
            message: 'Database retrieval successful - this is what admin interface would see'
        });

    } catch (error) {
        console.error('❌ Database retrieve error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Queue check endpoint - verifies trigger worked
router.post('/queue-check', async (req, res) => {
    try {
        const { content_moderation_id } = req.body;
        
        if (!content_moderation_id) {
            return res.status(400).json({ 
                success: false, 
                error: 'content_moderation_id is required' 
            });
        }

        const sql_query = `
            SELECT 
                id, content_moderation_id, model_id, model_name, image_path,
                nudity_score, detected_parts, part_locations, 
                final_risk_score, risk_level,
                review_status, priority, queue_type, flagged_at, created_at
            FROM media_review_queue 
            WHERE content_moderation_id = ?
            ORDER BY created_at DESC
            LIMIT 1
        `;

        console.log('🔍 Queue check SQL:', sql_query.trim());
        console.log('🔍 Parameters:', [content_moderation_id]);

        const result = await db.query(sql_query, [content_moderation_id]);

        if (result.length === 0) {
            return res.json({
                success: false,
                error: 'No queue record found - trigger may not have fired',
                sql_query: sql_query.trim()
            });
        }

        const record = result[0];
        
        // Parse JSON fields
        try {
            record.detected_parts_parsed = JSON.parse(record.detected_parts || '{}');
            record.part_locations_parsed = JSON.parse(record.part_locations || '{}');
            record.combined_assessment_parsed = JSON.parse(record.combined_assessment || '{}');
        } catch (parseError) {
            console.log('⚠️ JSON parsing warning:', parseError.message);
        }

        res.json({
            success: true,
            sql_query: sql_query.trim(),
            data: record,
            message: 'Queue record found - trigger worked correctly'
        });

    } catch (error) {
        console.error('❌ Queue check error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// BLIP batch request endpoint - requests analysis for a specific batch_id
router.post('/request-blip', async (req, res) => {
    try {
        const { batch_id } = req.body;
        
        if (!batch_id) {
            return res.status(400).json({ 
                success: false, 
                error: 'batch_id is required' 
            });
        }

        // Make request to webhook server for BLIP analysis
        const webhookUrl = 'http://18.221.22.72:5000/retrieve-blip';
        
        const requestPayload = {
            batch_id: batch_id,
            request_timestamp: new Date().toISOString(),
            source: 'musenest_test_interface'
        };

        console.log('🔍 Requesting BLIP analysis for batch:', batch_id);
        console.log('🌍 Target URL:', webhookUrl);
        console.log('📤 Request payload:', requestPayload);

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ batch_id: batch_id })
        });

        const responseText = await response.text();
        let serverResponse;
        
        try {
            serverResponse = JSON.parse(responseText);
        } catch (parseError) {
            serverResponse = { raw_response: responseText };
        }

        console.log('📥 BLIP server response:', serverResponse);

        if (response.ok) {
            res.json({
                success: true,
                message: 'BLIP analysis request sent successfully',
                request_details: requestPayload,
                server_response: serverResponse,
                webhook_url: webhookUrl,
                response_status: response.status
            });
        } else {
            res.json({
                success: false,
                error: `Server responded with status ${response.status}`,
                request_details: requestPayload,
                server_response: serverResponse,
                webhook_url: webhookUrl,
                response_status: response.status
            });
        }

    } catch (error) {
        console.error('❌ BLIP request error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            details: error.stack
        });
    }
});

module.exports = router;