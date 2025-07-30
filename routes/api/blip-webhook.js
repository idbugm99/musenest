/**
 * BLIP Webhook Endpoint
 * Receives BLIP analysis results from AI moderation server
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
 * Receive BLIP analysis results webhook
 * POST /api/blip/webhook
 */
router.post('/webhook', async (req, res) => {
    try {
        console.log('📨 BLIP webhook received:', JSON.stringify(req.body, null, 2));
        
        // Validate request
        if (!req.is('json')) {
            return res.status(400).json({
                error: 'Content-Type must be application/json'
            });
        }

        const data = req.body;
        const requiredFields = ['batch_id'];

        for (const field of requiredFields) {
            if (!data[field]) {
                return res.status(400).json({
                    error: `Missing required field: ${field}`
                });
            }
        }

        const batchId = data.batch_id;
        const imageDescription = data.image_description || {};
        const timestamp = data.timestamp;

        console.log(`📨 Processing BLIP webhook for batch_id: ${batchId}`);

        // Check for child-related content in BLIP data
        const description = imageDescription.description || '';
        const tags = imageDescription.tags || [];
        
        const childKeywords = ['child', 'children', 'kid', 'kids', 'baby', 'infant', 'toddler', 'minor', 'young', 'school', 'girl', 'boy', 'little girl', 'little boy', 'small child'];
        const familyKeywords = ['family', 'parent', 'mother', 'father', 'mom', 'dad'];
        
        const descriptionLower = description.toLowerCase();
        const allTags = tags.map(tag => tag.toLowerCase());
        
        const hasChildContent = childKeywords.some(keyword => 
            descriptionLower.includes(keyword) || allTags.includes(keyword)
        );
        
        const hasFamilyContent = familyKeywords.some(keyword => 
            descriptionLower.includes(keyword) || allTags.includes(keyword)
        );
        
        console.log(`🔍 Description: "${descriptionLower}"`);
        console.log(`🔍 Tags: ${JSON.stringify(allTags)}`);
        console.log(`🔍 Child keywords checked: ${JSON.stringify(childKeywords)}`);
        console.log(`🔍 Child content detection: ${hasChildContent}`);
        console.log(`👨‍👩‍👧‍👦 Family content detection: ${hasFamilyContent}`);
        
        // Debug individual keyword matches
        childKeywords.forEach(keyword => {
            if (descriptionLower.includes(keyword)) {
                console.log(`✅ Found child keyword: "${keyword}" in description`);
            }
        });
        
        // Determine new moderation status based on BLIP analysis
        let newModerationStatus = null;
        let newRiskLevel = null;
        let newFinalRiskScore = null;
        let statusChangeReason = null;
        
        if (hasChildContent) {
            newModerationStatus = 'rejected';
            newRiskLevel = 'high';
            newFinalRiskScore = 100;
            statusChangeReason = 'BLIP_CHILD_CONTENT_DETECTED';
            console.log('🚨 CHILD CONTENT DETECTED - Setting status to REJECTED');
        } else if (hasFamilyContent) {
            newModerationStatus = 'flagged';
            newRiskLevel = 'high';
            statusChangeReason = 'BLIP_FAMILY_CONTENT_DETECTED';
            console.log('⚠️ FAMILY CONTENT DETECTED - Setting status to FLAGGED for human review');
        }
        
        // Update content_moderation record with BLIP data and potentially new status
        let updateQuery, values;
        
        if (newModerationStatus) {
            updateQuery = `
                UPDATE content_moderation 
                SET 
                    image_description = ?,
                    description_text = ?,
                    description_tags = ?,
                    moderation_status = ?,
                    risk_level = ?,
                    final_risk_score = COALESCE(?, final_risk_score),
                    human_review_required = ?,
                    auto_rejected = ?,
                    rejection_reason = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE JSON_EXTRACT(risk_reasoning, '$') LIKE ?
            `;
            
            values = [
                JSON.stringify(imageDescription),
                imageDescription.description || '',
                JSON.stringify(imageDescription.tags || []),
                newModerationStatus,
                newRiskLevel,
                newFinalRiskScore,
                true, // human_review_required
                newModerationStatus === 'rejected' ? true : false,
                statusChangeReason,
                `%batch_id_${batchId}%`
            ];
        } else {
            updateQuery = `
                UPDATE content_moderation 
                SET 
                    image_description = ?,
                    description_text = ?,
                    description_tags = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE JSON_EXTRACT(risk_reasoning, '$') LIKE ?
            `;
            
            values = [
                JSON.stringify(imageDescription),
                imageDescription.description || '',
                JSON.stringify(imageDescription.tags || []),
                `%batch_id_${batchId}%`
            ];
        }

        console.log('📝 Updating content_moderation with BLIP data...');
        const result = await db.query(updateQuery, values);

        if (result.affectedRows > 0) {
            console.log(`✅ Updated ${result.affectedRows} content_moderation record(s) with BLIP data`);
            
            // Log the BLIP data for debugging
            console.log(`📝 BLIP Description: "${imageDescription.description}"`);
            console.log(`🏷️ BLIP Tags: ${JSON.stringify(imageDescription.tags)}`);
            
            if (newModerationStatus) {
                console.log(`🔄 Moderation status changed to: ${newModerationStatus} (${statusChangeReason})`);
            }
            
        } else {
            console.log(`⚠️ No content_moderation records found for batch_id: ${batchId}`);
        }

        res.json({
            status: 'received',
            batch_id: batchId,
            records_updated: result.affectedRows,
            message: 'BLIP data processed successfully'
        });

    } catch (error) {
        console.error('❌ BLIP webhook error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
});

/**
 * Get BLIP data for a specific batch_id (manual retrieval)
 * GET /api/blip/:batch_id
 */
router.get('/:batch_id', async (req, res) => {
    try {
        const batchId = req.params.batch_id;
        
        console.log(`🔍 Manual BLIP retrieval requested for batch_id: ${batchId}`);

        // Try to get from database first
        const dbQuery = `
            SELECT image_description, description_text, description_tags, updated_at
            FROM content_moderation 
            WHERE JSON_EXTRACT(risk_reasoning, '$') LIKE ?
            LIMIT 1
        `;

        const dbResult = await db.query(dbQuery, [`%batch_id_${batchId}%`]);

        if (dbResult.length > 0) {
            const record = dbResult[0];
            return res.json({
                success: true,
                batch_id: batchId,
                source: 'database',
                image_description: JSON.parse(record.image_description || '{}'),
                description_text: record.description_text,
                description_tags: JSON.parse(record.description_tags || '[]'),
                updated_at: record.updated_at
            });
        }

        // If not in database, try to fetch from AI server
        const http = require('http');
        
        const options = {
            hostname: '18.221.22.72',
            port: 5000,
            path: `/blip/${batchId}`,
            method: 'GET',
            timeout: 5000
        };

        const aiRequest = http.request(options, (aiResponse) => {
            let data = '';
            
            aiResponse.on('data', (chunk) => {
                data += chunk;
            });
            
            aiResponse.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    
                    if (aiResponse.statusCode === 200 && result.success) {
                        res.json({
                            success: true,
                            batch_id: batchId,
                            source: 'ai_server',
                            ...result
                        });
                    } else {
                        res.status(404).json({
                            success: false,
                            batch_id: batchId,
                            error: result.error || 'BLIP data not found'
                        });
                    }
                } catch (parseError) {
                    res.status(500).json({
                        success: false,
                        batch_id: batchId,
                        error: 'Failed to parse AI server response'
                    });
                }
            });
        });

        aiRequest.on('error', (error) => {
            console.error(`❌ AI server request failed: ${error.message}`);
            res.status(503).json({
                success: false,
                batch_id: batchId,
                error: 'AI server unavailable'
            });
        });

        aiRequest.end();

    } catch (error) {
        console.error('❌ BLIP retrieval error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;