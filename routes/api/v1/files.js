const express = require('express');
const router = express.Router();
const db = require('../../../config/database');
const { requireApiAuth } = require('../../../middleware/apiAuth');
const path = require('path');
const fs = require('fs');

// Apply API auth to all routes
router.use(requireApiAuth);

// GET /api/v1/files - List files for a conversation
router.get('/', async (req, res) => {
    try {
        const { modelId } = req.apiAuth;
        const { conversation_id } = req.query;

        if (!conversation_id) {
            return res.fail(400, 'conversation_id is required' );
        }

        // Verify conversation belongs to this model
        const convCheck = await db.query(
            'SELECT c.id FROM conversations c JOIN client_model_interactions cmi ON cmi.id = c.client_model_interaction_id WHERE c.id = ? AND cmi.model_id = ?',
            [conversation_id, modelId]
        );

        if (convCheck.length === 0) {
            return res.fail(404, 'Conversation not found' );
        }

        // Get files from messages
        const filesSql = `
            SELECT 
                m.id AS message_id,
                m.file_path,
                m.file_name,
                m.file_size,
                m.timestamp,
                m.sender_type,
                m.sender_id,
                CASE 
                    WHEN m.sender_type = 'model' THEN ml.slug
                    WHEN m.sender_type = 'client' THEN ec.client_identifier
                    ELSE 'system'
                END AS sender_name
            FROM messages m
            LEFT JOIN models ml ON ml.id = m.sender_id AND m.sender_type = 'model'
            LEFT JOIN conversations c ON c.id = m.conversation_id
            LEFT JOIN client_model_interactions cmi ON cmi.id = c.client_model_interaction_id
            LEFT JOIN escort_clients ec ON ec.id = cmi.escort_client_id AND m.sender_type = 'client'
            WHERE m.conversation_id = ? AND m.file_path IS NOT NULL
            ORDER BY m.timestamp DESC`;

        const files = await db.query(filesSql, [conversation_id]);

        // Add file metadata and check if file exists
        const filesWithMeta = files.map(file => {
            const filePath = path.join(__dirname, '../../../', file.file_path);
            const exists = fs.existsSync(filePath);
            
            return {
                ...file,
                file_exists: exists,
                file_url: exists ? `/uploads/${path.basename(path.dirname(file.file_path))}/${file.file_name}` : null,
                file_extension: path.extname(file.file_name).toLowerCase(),
                is_image: ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(path.extname(file.file_name).toLowerCase())
            };
        });

        res.success(filesWithMeta
        );
    } catch (error) {
        console.error('Get files error:', error);
        res.fail(500, 'Failed to retrieve files' );
    }
});

// GET /api/v1/files/:messageId - Get specific file info
router.get('/:messageId', async (req, res) => {
    try {
        const { modelId } = req.apiAuth;
        const { messageId } = req.params;

        // Get file from message and verify access
        const fileSql = `
            SELECT 
                m.id AS message_id,
                m.file_path,
                m.file_name,
                m.file_size,
                m.timestamp,
                m.sender_type,
                m.sender_id,
                m.conversation_id
            FROM messages m
            JOIN conversations c ON c.id = m.conversation_id
            JOIN client_model_interactions cmi ON cmi.id = c.client_model_interaction_id
            WHERE m.id = ? AND cmi.model_id = ? AND m.file_path IS NOT NULL`;

        const files = await db.query(fileSql, [messageId, modelId]);
        
        if (files.length === 0) {
            return res.fail(404, 'File not found' );
        }

        const file = files[0];
        const filePath = path.join(__dirname, '../../../', file.file_path);
        const exists = fs.existsSync(filePath);

        res.json({
            success: true,
            data: {
                ...file,
                file_exists: exists,
                file_url: exists ? `/uploads/${path.basename(path.dirname(file.file_path))}/${file.file_name}` : null,
                file_extension: path.extname(file.file_name).toLowerCase(),
                is_image: ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(path.extname(file.file_name).toLowerCase())
            }
        });
    } catch (error) {
        console.error('Get file error:', error);
        res.fail(500, 'Failed to retrieve file' );
    }
});

// GET /api/v1/files/:messageId/download - Download file
router.get('/:messageId/download', async (req, res) => {
    try {
        const { modelId } = req.apiAuth;
        const { messageId } = req.params;

        // Get file from message and verify access
        const fileSql = `
            SELECT 
                m.file_path,
                m.file_name
            FROM messages m
            JOIN conversations c ON c.id = m.conversation_id
            JOIN client_model_interactions cmi ON cmi.id = c.client_model_interaction_id
            WHERE m.id = ? AND cmi.model_id = ? AND m.file_path IS NOT NULL`;

        const files = await db.query(fileSql, [messageId, modelId]);
        
        if (files.length === 0) {
            return res.fail(404, 'File not found' );
        }

        const file = files[0];
        const filePath = path.join(__dirname, '../../../', file.file_path);

        if (!fs.existsSync(filePath)) {
            return res.fail(404, 'File not found on disk' );
        }

        res.download(filePath, file.file_name);
    } catch (error) {
        console.error('Download file error:', error);
        res.fail(500, 'Failed to download file' );
    }
});

// GET /api/v1/files/screening/:interactionId - List screening files for client
router.get('/screening/:interactionId', async (req, res) => {
    try {
        const { modelId } = req.apiAuth;
        const { interactionId } = req.params;

        // Verify interaction belongs to this model
        const interactionCheck = await db.query(
            'SELECT escort_client_id FROM client_model_interactions WHERE id = ? AND model_id = ?',
            [interactionId, modelId]
        );

        if (interactionCheck.length === 0) {
            return res.fail(404, 'Client interaction not found' );
        }

        // Get screening files
        const filesSql = `
            SELECT 
                id,
                file_name,
                file_path,
                file_size,
                file_type,
                uploaded_at
            FROM client_screening_files 
            WHERE client_model_interaction_id = ?
            ORDER BY uploaded_at DESC`;
        
        const files = await db.query(filesSql, [interactionId]);

        // Add file metadata and check if file exists
        const filesWithMeta = files.map(file => {
            const exists = fs.existsSync(file.file_path);
            const escortClientId = interactionCheck[0].escort_client_id;
            
            return {
                ...file,
                file_exists: exists,
                file_url: exists ? `/uploads/screening/${escortClientId}/${file.file_name}` : null,
                file_extension: path.extname(file.file_name).toLowerCase(),
                is_image: ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(path.extname(file.file_name).toLowerCase())
            };
        });

        res.success(filesWithMeta
        );
    } catch (error) {
        console.error('Get screening files error:', error);
        res.fail(500, 'Failed to retrieve screening files' );
    }
});

module.exports = router;
