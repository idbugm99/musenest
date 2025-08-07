const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const router = express.Router();

// Database and logger
const db = require('../../config/database');
const logger = require('../../utils/logger');

// Configure multer for file uploads - simplified for proxy-upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, '../../public/uploads/temp');
        
        // Create directory if it doesn't exist
        fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        // Generate unique filename
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: function (req, file, cb) {
        console.log('Multer fileFilter - file:', file.originalname, 'mimetype:', file.mimetype);
        // Check file type
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

// AI Moderation Service Configuration
const AI_SERVICE_URL = process.env.AI_MODERATION_URL || 'http://52.15.235.216:5000';

// Mock AI results for testing when service is unavailable
const MOCK_AI_RESULTS = {
    'profile_pic': {
        nudity_score: 25.0,
        detected_parts: { breast: 20.0, buttocks: 5.0 },
        pose_classification: 'portrait',
        explicit_pose_score: 0.0,
        generated_caption: 'A professional headshot photograph',
        policy_violations: [],
        moderation_status: 'approved',
        human_review_required: false,
        confidence_score: 0.85
    },
    'public_gallery': {
        nudity_score: 45.0,
        detected_parts: { breast: 40.0, buttocks: 15.0 },
        pose_classification: 'artistic',
        explicit_pose_score: 15.0,
        generated_caption: 'An artistic photography with creative lighting',
        policy_violations: [],
        moderation_status: 'approved',
        human_review_required: false,
        confidence_score: 0.78
    },
    'premium_gallery': {
        nudity_score: 75.0,
        detected_parts: { breast: 70.0, buttocks: 30.0, genitalia: 5.0 },
        pose_classification: 'suggestive',
        explicit_pose_score: 45.0,
        generated_caption: 'A suggestive artistic photograph',
        policy_violations: [],
        moderation_status: 'flagged',
        human_review_required: true,
        confidence_score: 0.72
    },
    'private_content': {
        nudity_score: 85.0,
        detected_parts: { breast: 80.0, buttocks: 60.0, genitalia: 70.0 },
        pose_classification: 'explicit',
        explicit_pose_score: 85.0,
        generated_caption: 'An adult content photograph',
        policy_violations: [],
        moderation_status: 'approved',
        human_review_required: false,
        confidence_score: 0.91
    }
};

/**
 * Upload and moderate image
 * POST /api/content-moderation/upload
 */
router.post('/upload', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.fail(400, 'No file uploaded');

        const { model_id, context_type } = req.body;
        
        if (!model_id || !context_type) return res.fail(400, 'model_id and context_type are required');

        const imagePath = req.file.path;
        const relativePath = path.relative(path.join(__dirname, '../../public'), imagePath);

        // Call AI moderation service
        try {
            // First try with full image path for EC2 service
            const fullImagePath = path.join(__dirname, '../../public', relativePath);
            
            const moderationResponse = await axios.post(`${AI_SERVICE_URL}/analyze`, {
                image_path: fullImagePath,
                model_id: parseInt(model_id),
                context_type: context_type
            }, {
                timeout: 10000 // 10 second timeout
            });

            if (moderationResponse.data.success) {
                const result = moderationResponse.data.result;
                
                // Store moderation result in database (if available)
                if (db && db.query) {
                    try {
                        const query = `
                            INSERT INTO content_moderation (
                                image_path, model_id, context_type, nudity_score, detected_parts,
                                pose_classification, explicit_pose_score, generated_caption,
                                policy_violations, moderation_status, human_review_required, confidence_score
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `;
                        
                        const values = [
                            result.image_path,
                            result.model_id,
                            result.context_type,
                            result.nudity_score,
                            JSON.stringify(result.detected_parts),
                            result.pose_classification,
                            result.explicit_pose_score,
                            result.generated_caption,
                            JSON.stringify(result.policy_violations),
                            result.moderation_status,
                            result.human_review_required,
                            result.confidence_score
                        ];

                        await db.query(query, values);

                        // If flagged for human review, add to moderation queue
                        if (result.human_review_required) {
                            const queueQuery = `
                                INSERT INTO moderation_queue (content_moderation_id, priority)
                                VALUES (LAST_INSERT_ID(), 'medium')
                            `;
                            await db.query(queueQuery);
                        }
                    } catch (dbError) {
                        logger.error('content-moderation DB error', { error: dbError.message });
                    }
                }

                // Return result to client
                res.success({ file_path: relativePath, moderation_result: result });

            } else {
                // AI service failed, but file was uploaded
                res.success({
                    file_path: relativePath,
                    moderation_result: {
                        moderation_status: 'pending',
                        human_review_required: true,
                        error: 'AI moderation service unavailable'
                    }
                });
            }

        } catch (aiError) {
            logger.error('ai moderation service error', { error: aiError.message });
            
            // AI service unavailable, use mock results for demo
            const mockResult = MOCK_AI_RESULTS[context_type] || MOCK_AI_RESULTS['public_gallery'];
            const result = {
                image_path: relativePath,
                model_id: parseInt(model_id),
                context_type: context_type,
                ...mockResult
            };
            
            // Store mock result in database (if available)
            if (db && db.query) {
                try {
                    const query = `
                        INSERT INTO content_moderation (
                            image_path, model_id, context_type, nudity_score, detected_parts,
                            pose_classification, explicit_pose_score, generated_caption,
                            policy_violations, moderation_status, human_review_required, confidence_score
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `;
                    
                    const values = [
                        result.image_path,
                        result.model_id,
                        result.context_type,
                        result.nudity_score,
                        JSON.stringify(result.detected_parts),
                        result.pose_classification,
                        result.explicit_pose_score,
                        result.generated_caption,
                        JSON.stringify(result.policy_violations),
                        result.moderation_status,
                        result.human_review_required,
                        result.confidence_score
                    ];

                    await db.query(query, values);

                    // If flagged for human review, add to moderation queue
                    if (result.human_review_required) {
                        const queueQuery = `
                            INSERT INTO moderation_queue (content_moderation_id, priority)
                            VALUES (LAST_INSERT_ID(), 'medium')
                        `;
                        await db.query(queueQuery);
                    }
                } catch (dbError) {
                    logger.error('content-moderation DB mock error', { error: dbError.message });
                }
            }
            
            res.success({ file_path: relativePath, moderation_result: result, note: 'Using mock AI results (EC2 service not accessible)' });
        }

    } catch (error) {
        logger.error('content-moderation.upload error', { error: error.message });
        res.fail(500, 'Upload error', error.message);
    }
});

/**
 * Proxy upload to EC2 NudeNet service via SSH
 * POST /api/content-moderation/proxy-upload
 */
router.post('/proxy-upload', (req, res, next) => {
    console.log('=== PROXY-UPLOAD ROUTE HIT ===');
    console.log('URL:', req.url);
    console.log('Method:', req.method);
    console.log('Headers:', req.headers);
    next();
}, upload.single('file'), async (req, res) => {
    try {
        const { spawn } = require('child_process');
        const fs = require('fs');
        const path = require('path');
        
        console.log('=== PROXY UPLOAD DEBUG ===');
        console.log('req.file:', req.file);
        console.log('req.body:', req.body);
        console.log('req.files:', req.files);
        
        if (!req.file) return res.fail(400, 'No image file provided');
        
        const contextType = req.body.context_type || 'public_gallery';
        const modelId = req.body.model_id || 1;
        
        // Copy file to EC2 and analyze via SSH
        const remoteFilePath = `/tmp/upload_${Date.now()}_${req.file.originalname}`;
        
        console.log('Copying file to EC2...');
        console.log(`Local file: ${req.file.path}`);
        console.log(`Remote file: ${remoteFilePath}`);
        
        const scpCommand = spawn('scp', [
            '-i', '/Users/programmer/Projects/nudenet-key.pem',
            '-o', 'ConnectTimeout=10',
            '-o', 'StrictHostKeyChecking=no',
            req.file.path,
            `ubuntu@52.15.235.216:${remoteFilePath}`
        ]);
        
        let scpError = '';
        scpCommand.stderr.on('data', (data) => {
            scpError += data.toString();
        });
        
        scpCommand.on('close', (scpCode) => {
            console.log(`SCP exit code: ${scpCode}`);
            if (scpError) console.log(`SCP error output: ${scpError}`);
            
                if (scpCode !== 0) return res.fail(500, 'Failed to copy file to EC2', scpError || `code ${scpCode}`);
            
            console.log('File copied, analyzing...');
            // Analyze via SSH
            const analysisData = JSON.stringify({
                image_path: remoteFilePath,
                context_type: contextType,
                model_id: parseInt(modelId)
            });
            
            const sshCommand = spawn('ssh', [
                '-i', '/Users/programmer/Projects/nudenet-key.pem',
                '-o', 'ConnectTimeout=10',
                '-o', 'StrictHostKeyChecking=no',
                'ubuntu@52.15.235.216',
                `curl -s -X POST "http://localhost:5000/analyze" -H "Content-Type: application/json" -d '${analysisData}'`
            ]);
            
            let output = '';
            let sshError = '';
            
            sshCommand.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            sshCommand.stderr.on('data', (data) => {
                sshError += data.toString();
            });
            
            sshCommand.on('close', (sshCode) => {
                console.log(`SSH exit code: ${sshCode}`);
                if (sshError) console.log(`SSH error output: ${sshError}`);
                console.log(`Analysis output: ${output}`);
                
                if (sshCode !== 0) return res.fail(500, 'Failed to analyze image on EC2', sshError || `code ${sshCode}`);
                try {
                    const result = JSON.parse(output);
                    
                    // Clean up uploaded file
                    fs.unlink(req.file.path, (err) => {
                        if (err) console.log('Failed to delete local file:', err.message);
                    });
                    
                    // Clean up remote file
                    spawn('ssh', [
                        '-i', '/Users/programmer/Projects/nudenet-key.pem',
                        '-o', 'ConnectTimeout=5',
                        'ubuntu@52.15.235.216',
                        `rm -f ${remoteFilePath}`
                    ]);
                    
                    console.log('Analysis complete:', result);
                    res.success(result);
                } catch (parseError) {
                    console.error('Parse error:', parseError.message);
                    console.error('Raw output:', output);
                    console.error('SSH error output:', sshError);
                    
                    // Clean up files even on error
                    fs.unlink(req.file.path, () => {});
                    spawn('ssh', [
                        '-i', '/Users/programmer/Projects/nudenet-key.pem',
                        'ubuntu@52.15.235.216',
                        `rm -f ${remoteFilePath}`
                    ]);
                    
                    res.fail(500, 'Failed to parse AI response', parseError.message);
                }
            });
        });
        
    } catch (error) {
        logger.error('content-moderation.proxy-upload error', { error: error.message });
        res.fail(500, 'Proxy upload error', error.message);
    }
});

/**
 * Get moderation results for a model
 * GET /api/content-moderation/results/:model_id
 */
router.get('/results/:model_id', async (req, res) => {
    try {
        const { model_id } = req.params;
        const { context_type, status } = req.query;

        let query = `
            SELECT cm.*, mq.priority as queue_priority, mq.assigned_to, mq.notes
            FROM content_moderation cm
            LEFT JOIN moderation_queue mq ON cm.id = mq.content_moderation_id
            WHERE cm.model_id = ?
        `;
        const params = [model_id];

        if (context_type) {
            query += ` AND cm.context_type = ?`;
            params.push(context_type);
        }

        if (status) {
            query += ` AND cm.moderation_status = ?`;
            params.push(status);
        }

        query += ` ORDER BY cm.created_at DESC`;

        const [results] = await db.query(query, params);
        
        // Parse JSON fields
        const processedResults = results.map(row => ({
            ...row,
            detected_parts: JSON.parse(row.detected_parts || '{}'),
            policy_violations: JSON.parse(row.policy_violations || '[]')
        }));

        res.success({ results: processedResults });

    } catch (error) {
        logger.error('content-moderation.results error', { error: error.message });
        res.fail(500, 'Failed to get results', error.message);
    }
});

/**
 * Get moderation queue (items requiring human review)
 * GET /api/content-moderation/queue
 */
router.get('/queue', async (req, res) => {
    try {
        const { priority, assigned_to, page = 1, limit = 20 } = req.query;

        const currentPage = Math.max(1, parseInt(page));
        const perPage = Math.max(1, Math.min(100, parseInt(limit)));
        const offset = (currentPage - 1) * perPage;

        let baseSelect = `
            SELECT 
                mq.*,
                cm.image_path,
                cm.model_id,
                cm.context_type,
                cm.moderation_status,
                cm.nudity_score,
                cm.generated_caption,
                cm.confidence_score,
                m.name as model_name
            FROM moderation_queue mq
            JOIN content_moderation cm ON mq.content_moderation_id = cm.id
            LEFT JOIN models m ON cm.model_id = m.id
            WHERE 1=1
        `;
        let baseCount = `
            SELECT COUNT(*) as total
            FROM moderation_queue mq
            JOIN content_moderation cm ON mq.content_moderation_id = cm.id
            LEFT JOIN models m ON cm.model_id = m.id
            WHERE 1=1
        `;
        const params = [];
        const countParams = [];

        if (priority) {
            baseSelect += ` AND mq.priority = ?`;
            baseCount += ` AND mq.priority = ?`;
            params.push(priority);
            countParams.push(priority);
        }

        if (assigned_to) {
            baseSelect += ` AND mq.assigned_to = ?`;
            baseCount += ` AND mq.assigned_to = ?`;
            params.push(assigned_to);
            countParams.push(assigned_to);
        }

        const orderBy = ` ORDER BY 
            FIELD(mq.priority, 'urgent', 'high', 'medium', 'low'),
            mq.created_at ASC`;

        const pagedQuery = `${baseSelect}${orderBy} LIMIT ? OFFSET ?`;
        const [countRows] = await db.query(baseCount, countParams);
        const total = countRows[0]?.total || 0;
        const [results] = await db.query(pagedQuery, [...params, perPage, offset]);

        res.success({ queue: results, pagination: { page: currentPage, limit: perPage, total, pages: Math.ceil(total / perPage) } });

    } catch (error) {
        logger.error('content-moderation.queue error', { error: error.message });
        res.fail(500, 'Failed to get queue', error.message);
    }
});

/**
 * Update moderation status (human review)
 * PUT /api/content-moderation/review/:id
 */
router.put('/review/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { moderation_status, notes, reviewed_by } = req.body;

        if (!moderation_status || !reviewed_by) return res.fail(400, 'moderation_status and reviewed_by are required');

        // Update content moderation record
        const updateQuery = `
            UPDATE content_moderation 
            SET moderation_status = ?, reviewed_by = ?, reviewed_at = NOW()
            WHERE id = ?
        `;
        await db.query(updateQuery, [moderation_status, reviewed_by, id]);

        // Update/remove from moderation queue
        if (notes) {
            const queueUpdateQuery = `
                UPDATE moderation_queue 
                SET notes = ?, assigned_to = ?
                WHERE content_moderation_id = ?
            `;
            await db.query(queueUpdateQuery, [notes, reviewed_by, id]);
        }

        // If approved/rejected, remove from queue
        if (moderation_status === 'approved' || moderation_status === 'rejected') {
            const removeQueueQuery = `
                DELETE FROM moderation_queue 
                WHERE content_moderation_id = ?
            `;
            await db.query(removeQueueQuery, [id]);
        }

        res.success({}, { message: 'Moderation status updated successfully' });

    } catch (error) {
        logger.error('content-moderation.review error', { error: error.message });
        res.fail(500, 'Failed to update moderation status', error.message);
    }
});

/**
 * Get moderation rules
 * GET /api/content-moderation/rules
 */
router.get('/rules', async (req, res) => {
    try {
        const { context_type } = req.query;

        let query = `
            SELECT * FROM moderation_rules
            WHERE is_active = 1
        `;
        const params = [];

        if (context_type) {
            query += ` AND context_type = ?`;
            params.push(context_type);
        }

        query += ` ORDER BY context_type, rule_name`;

        const [results] = await db.query(query, params);

        // Parse JSON rule values
        const processedResults = results.map(row => ({
            ...row,
            rule_value: JSON.parse(row.rule_value)
        }));

        res.success({ rules: processedResults });

    } catch (error) {
        logger.error('content-moderation.rules error', { error: error.message });
        res.fail(500, 'Failed to get moderation rules', error.message);
    }
});

/**
 * Test AI moderation service connection
 * GET /api/content-moderation/test
 */
router.get('/test', async (req, res) => {
    try {
        const healthResponse = await axios.get(`${AI_SERVICE_URL}/health`, {
            timeout: 5000
        });

        res.success({ ai_service_status: 'connected', ai_service_response: healthResponse.data });

    } catch (error) {
        res.fail(200, 'AI service disconnected', error.message);
    }
});

module.exports = router;