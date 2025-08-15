const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');
const db = require('../../config/database');

// Database check endpoint - shows what was inserted
router.post('/database-check', async (req, res) => {
    try {
        const { content_moderation_id } = req.body;
        
        if (!content_moderation_id) {
            return res.fail(400, 'content_moderation_id is required');
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

        logger.debug('database-check query', { sql: sql_query.trim(), params: [content_moderation_id] });

        const result = await db.query(sql_query, [content_moderation_id]);

        if (result.length === 0) {
            return res.fail(404, 'No record found with that ID', sql_query.trim());
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

        res.success({ sql_query: sql_query.trim(), record }, { message: 'Database record found and verified' });

    } catch (error) {
        logger.error('database-check error', { error: error.message });
        res.fail(500, 'Database check error', error.message);
    }
});

// Database retrieve endpoint - simulates what the admin interface does
router.post('/database-retrieve', async (req, res) => {
    try {
        const { content_moderation_id } = req.body;
        
        if (!content_moderation_id) {
            return res.fail(400, 'content_moderation_id is required');
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

        logger.debug('database-retrieve query', { sql: sql_query.trim(), params: [content_moderation_id] });

        const result = await db.query(sql_query, [content_moderation_id]);

        if (result.length === 0) {
            return res.fail(404, 'No record found with that ID', sql_query.trim());
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

        res.success({ sql_query: sql_query.trim(), record }, { message: 'Database retrieval successful' });

    } catch (error) {
        logger.error('database-retrieve error', { error: error.message });
        res.fail(500, 'Database retrieve error', error.message);
    }
});

// Queue check endpoint - verifies trigger worked
router.post('/queue-check', async (req, res) => {
    try {
        const { content_moderation_id } = req.body;
        
        if (!content_moderation_id) {
            return res.fail(400, 'content_moderation_id is required');
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

        logger.debug('queue-check query', { sql: sql_query.trim(), params: [content_moderation_id] });

        const result = await db.query(sql_query, [content_moderation_id]);

        if (result.length === 0) {
            return res.fail(404, 'No queue record found - trigger may not have fired', sql_query.trim());
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

        res.success({ sql_query: sql_query.trim(), record }, { message: 'Queue record found' });

    } catch (error) {
        logger.error('queue-check error', { error: error.message });
        res.fail(500, 'Queue check error', error.message);
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

        console.log('🔍 Processing BLIP analysis internally for batch:', batch_id);

        // Check if we already have results in database
        const existingResults = await db.query(
            'SELECT image_description, description_text, image_path, original_path FROM content_moderation WHERE batch_id = ? AND description_text IS NOT NULL AND description_text != ""',
            [batch_id]
        );

        if (existingResults.length > 0 && existingResults[0].description_text) {
            console.log('✅ Found existing BLIP results');
            return res.json({
                success: true,
                description: existingResults[0].description_text,
                batch_id: batch_id,
                cached: true,
                message: 'BLIP description retrieved from cache'
            });
        }

        // Get the image record to send to local BLIP server
        const imageRecord = await db.query(
            'SELECT id, image_path, original_path FROM content_moderation WHERE batch_id = ?',
            [batch_id]
        );

        if (imageRecord.length === 0) {
            return res.json({
                success: false,
                error: 'No image record found for batch_id',
                batch_id: batch_id
            });
        }

        const record = imageRecord[0];
        console.log('📸 Found image record:', { id: record.id, path: record.image_path });

        // Call local BLIP server on port 5001
        console.log('🔍 Calling local BLIP server on port 5001...');
        
        const fs = require('fs');
        const path = require('path');
        const FormData = require('form-data');
        const axios = require('axios');
        
        try {
            // Construct full image path
            let imagePath = record.image_path || record.original_path;
            if (!imagePath) {
                return res.json({
                    success: false,
                    error: 'No image path found in database',
                    batch_id: batch_id
                });
            }

            // Convert database path to filesystem path
            if (imagePath.startsWith('/uploads/')) {
                imagePath = path.join(__dirname, '../../public', imagePath);
            } else if (!imagePath.startsWith('/Users/')) {
                imagePath = path.join(__dirname, '../../public/uploads', imagePath);
            }

            console.log('📁 Using image path:', imagePath);

            // Check if file exists
            if (!fs.existsSync(imagePath)) {
                return res.json({
                    success: false,
                    error: 'Image file not found on filesystem',
                    path: imagePath,
                    batch_id: batch_id
                });
            }

            // Create form data for BLIP server
            const form = new FormData();
            form.append('image', fs.createReadStream(imagePath));
            form.append('context_type', 'public_gallery');
            form.append('model_id', '1');

            const blipResponse = await axios.post('http://127.0.0.1:5001/analyze', form, {
                headers: {
                    ...form.getHeaders(),
                    'Content-Type': 'multipart/form-data'
                },
                timeout: 30000
            });

            const blipResult = blipResponse.data;
            console.log('🖼️ BLIP server response:', blipResult);

            if (blipResult.success && blipResult.image_analysis?.image_description?.description) {
                const description = blipResult.image_analysis.image_description.description;
                
                // Save to database
                await db.query(
                    'UPDATE content_moderation SET description_text = ?, image_description = ? WHERE batch_id = ?',
                    [description, JSON.stringify(blipResult), batch_id]
                );

                return res.json({
                    success: true,
                    description: description,
                    batch_id: batch_id,
                    cached: false,
                    message: 'BLIP description generated successfully'
                });
            } else {
                return res.json({
                    success: false,
                    error: 'BLIP server failed to analyze image',
                    details: blipResult,
                    batch_id: batch_id
                });
            }

        } catch (blipError) {
            console.error('❌ BLIP server connection error:', blipError);
            return res.json({
                success: false,
                error: 'Failed to connect to local BLIP server',
                message: 'Local BLIP server on port 5001 not responding. Make sure it\'s running.',
                details: blipError.message,
                batch_id: batch_id
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

// Venice AI image description endpoint
router.post('/request-venice', async (req, res) => {
    try {
        const { batch_id } = req.body;
        
        if (!batch_id) {
            return res.status(400).json({ 
                success: false, 
                error: 'batch_id is required' 
            });
        }

        console.log('🚀 Processing Venice.ai analysis for batch:', batch_id);

        // Check if we already have Venice results in database
        let existingResults = [];
        try {
            existingResults = await db.query(
                'SELECT venice_description, image_path, original_path FROM content_moderation WHERE batch_id = ? AND venice_description IS NOT NULL AND venice_description != ""',
                [batch_id]
            );
        } catch (dbError) {
            // Column might not exist, try to add it
            if (dbError.code === 'ER_BAD_FIELD_ERROR') {
                console.log('🔧 Adding venice_description column to database...');
                await db.query('ALTER TABLE content_moderation ADD COLUMN venice_description TEXT');
                existingResults = []; // No existing results if column didn't exist
            } else {
                throw dbError;
            }
        }

        if (existingResults.length > 0 && existingResults[0].venice_description) {
            console.log('✅ Found existing Venice.ai results');
            return res.json({
                success: true,
                description: existingResults[0].venice_description,
                batch_id: batch_id,
                cached: true,
                message: 'Venice.ai description retrieved from cache'
            });
        }

        // Get the image record to send to Venice.ai
        const imageRecord = await db.query(
            'SELECT id, image_path, original_path FROM content_moderation WHERE batch_id = ?',
            [batch_id]
        );

        if (imageRecord.length === 0) {
            return res.json({
                success: false,
                error: 'No image record found for batch_id',
                batch_id: batch_id
            });
        }

        const record = imageRecord[0];
        console.log('📸 Found image record:', { id: record.id, path: record.image_path });

        // Call Venice.ai API
        console.log('🌊 Calling Venice.ai API...');
        
        const fs = require('fs');
        const path = require('path');
        const FormData = require('form-data');
        const axios = require('axios');
        
        try {
            // Construct full image path
            let imagePath = record.image_path || record.original_path;
            if (!imagePath) {
                return res.json({
                    success: false,
                    error: 'No image path found in database',
                    batch_id: batch_id
                });
            }

            // Convert database path to filesystem path
            if (imagePath.startsWith('/uploads/')) {
                imagePath = path.join(__dirname, '../../public', imagePath);
            } else if (!imagePath.startsWith('/Users/')) {
                imagePath = path.join(__dirname, '../../public/uploads', imagePath);
            }

            console.log('📁 Using image path:', imagePath);

            // Check if file exists
            if (!fs.existsSync(imagePath)) {
                return res.json({
                    success: false,
                    error: 'Image file not found on filesystem',
                    path: imagePath,
                    batch_id: batch_id
                });
            }

            // Convert image to base64 for Venice.ai vision model and get orientation info
            const sharp = require('sharp');
            const imageMetadata = await sharp(imagePath, { autoRotate: false }).metadata();
            
            // Create properly oriented image for Venice.ai
            const orientedImageBuffer = await sharp(imagePath)
                .rotate() // Auto-rotate based on EXIF orientation
                .jpeg({ quality: 95 }) // High quality for vision analysis
                .toBuffer();
            
            const imageBase64 = orientedImageBuffer.toString('base64');
            const mimeType = 'image/jpeg'; // Always JPEG after Sharp processing
            
            // Add orientation context to help Venice.ai understand the corrected orientation
            let orientationContext = "";
            if (imageMetadata.orientation && imageMetadata.orientation !== 1) {
                orientationContext = " (Note: This image has been auto-rotated to correct orientation based on EXIF data - people should appear upright, not lying down.)";
            } else if (imageMetadata.height > imageMetadata.width) {
                orientationContext = " (This is a portrait/vertical image - people should be standing upright.)";
            }

            const venicePayload = {
                model: "mistral-31-24b", // Venice Medium with vision support
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: `Give me a detailed, clinical description of this image for content moderation purposes${orientationContext} Be specific about what you see including:
1. People (number, apparent age, gender, physical characteristics)
2. Clothing/nudity state (be explicit and clinical)
3. Activities, poses, and interactions - Explicitly describe what the person in the image is doing, focusing on their pose and any suggestive or explicit actions
4. Setting, lighting, and environment
5. Objects and props visible
6. Overall mood or context

Be very detailed and clinical. Don't censor anything - provide an uncensored, thorough description. Pay special attention to body positioning, hand placement, facial expressions, and any sexual or suggestive poses or activities.

After your detailed analysis, please also provide a separate brief description (1-2 sentences) suitable for image library display or hover text. Format your response as:

DETAILED DESCRIPTION:
[Your full clinical analysis here]

BRIEF DESCRIPTION:
[1-2 sentence summary suitable for general display]`
                            },
                            {
                                type: "image_url",
                                image_url: {
                                    url: `data:${mimeType};base64,${imageBase64}`
                                }
                            }
                        ]
                    }
                ],
                max_tokens: 500,
                temperature: 0.1,
                venice_parameters: {
                    include_venice_system_prompt: false
                }
            };

            const veniceResponse = await axios.post('https://api.venice.ai/api/v1/chat/completions', venicePayload, {
                headers: {
                    'Authorization': `Bearer ${process.env.VENICE_AI_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            });

            const veniceResult = veniceResponse.data;
            console.log('🌊 Venice.ai API response:', JSON.stringify(veniceResult, null, 2));

            if (veniceResult.choices && veniceResult.choices[0] && veniceResult.choices[0].message && veniceResult.choices[0].message.content) {
                const fullResponse = veniceResult.choices[0].message.content.trim();
                
                // Parse detailed and brief descriptions
                let detailedDescription = fullResponse;
                let briefDescription = "";
                
                // Look for the formatted response
                const detailedMatch = fullResponse.match(/DETAILED DESCRIPTION:\s*([\s\S]*?)\s*BRIEF DESCRIPTION:/);
                const briefMatch = fullResponse.match(/BRIEF DESCRIPTION:\s*([\s\S]*?)$/);
                
                if (detailedMatch && briefMatch) {
                    detailedDescription = detailedMatch[1].trim();
                    briefDescription = briefMatch[1].trim();
                } else if (fullResponse.includes('BRIEF DESCRIPTION:')) {
                    // Handle case where format is slightly different
                    const parts = fullResponse.split('BRIEF DESCRIPTION:');
                    if (parts.length > 1) {
                        detailedDescription = parts[0].replace(/DETAILED DESCRIPTION:\s*/, '').trim();
                        briefDescription = parts[1].trim();
                    }
                }
                
                // If no brief description found, create one from first sentence
                if (!briefDescription && detailedDescription) {
                    const sentences = detailedDescription.match(/[^\.!?]+[\.!?]+/g);
                    if (sentences && sentences.length > 0) {
                        briefDescription = sentences[0].trim();
                    }
                }
                
                // Save both descriptions to database
                try {
                    await db.query(
                        'UPDATE content_moderation SET venice_description = ?, venice_detailed_description = ?, venice_brief_description = ? WHERE batch_id = ?',
                        [fullResponse, detailedDescription, briefDescription, batch_id]
                    );
                } catch (dbError) {
                    // Columns might not exist, try to add them
                    if (dbError.code === 'ER_BAD_FIELD_ERROR') {
                        console.log('🔧 Adding venice description columns to database...');
                        await db.query(`
                            ALTER TABLE content_moderation 
                            ADD COLUMN IF NOT EXISTS venice_description TEXT,
                            ADD COLUMN IF NOT EXISTS venice_detailed_description TEXT,
                            ADD COLUMN IF NOT EXISTS venice_brief_description TEXT
                        `);
                        await db.query(
                            'UPDATE content_moderation SET venice_description = ?, venice_detailed_description = ?, venice_brief_description = ? WHERE batch_id = ?',
                            [fullResponse, detailedDescription, briefDescription, batch_id]
                        );
                    } else {
                        throw dbError;
                    }
                }

                return res.json({
                    success: true,
                    description: fullResponse,
                    detailed_description: detailedDescription,
                    brief_description: briefDescription,
                    batch_id: batch_id,
                    cached: false,
                    model: 'Venice Medium (Vision)',
                    tokens_used: veniceResult.usage || {},
                    message: 'Venice.ai descriptions generated successfully'
                });
            } else {
                return res.json({
                    success: false,
                    error: 'Venice.ai API returned unexpected response format',
                    details: veniceResult,
                    batch_id: batch_id
                });
            }

        } catch (veniceError) {
            console.error('❌ Venice.ai API error:', veniceError.response?.data || veniceError.message);
            return res.json({
                success: false,
                error: 'Failed to connect to Venice.ai API',
                message: 'Venice.ai API request failed. Check API key and quotas.',
                details: veniceError.response?.data || veniceError.message,
                batch_id: batch_id
            });
        }

    } catch (error) {
        console.error('❌ Venice.ai request error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            details: error.stack
        });
    }
});

module.exports = router;