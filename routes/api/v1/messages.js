const express = require('express');
const router = express.Router();
const db = require('../../../config/database');
const { requireApiAuth } = require('../../../middleware/apiAuth');

// Apply API auth to all routes
router.use(requireApiAuth);

// GET /api/v1/messages - List messages for a conversation
router.get('/', async (req, res) => {
    try {
        const { modelId } = req.apiAuth;
        const { conversation_id } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        const offset = (page - 1) * limit;

        if (!conversation_id) {
            return res.fail(400, 'conversation_id is required');
        }

        // Verify conversation belongs to this model
        const convCheck = await db.query(
            'SELECT c.id FROM conversations c JOIN client_model_interactions cmi ON cmi.id = c.client_model_interaction_id WHERE c.id = ? AND cmi.model_id = ?',
            [conversation_id, modelId]
        );

        if (convCheck.length === 0) {
            return res.fail(404, 'Conversation not found');
        }

        const messagesSql = `
            SELECT 
                m.id,
                m.sender_type,
                m.sender_id,
                m.message,
                m.timestamp,
                m.message_type,
                m.file_path,
                m.file_name,
                m.file_size,
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
            WHERE m.conversation_id = ?
            ORDER BY m.timestamp ASC
            LIMIT ? OFFSET ?`;

        const messages = await db.query(messagesSql, [conversation_id, limit, offset]);

        res.success(messages, {
            pagination: {
                page,
                limit,
                total: messages.length,
                pages: Math.ceil(messages.length / limit)
            }
        });
    } catch (error) {
        console.error('Get messages error:', error);
        res.fail(500, 'Failed to retrieve messages');
    }
});

// POST /api/v1/messages - Send a message
router.post('/', async (req, res) => {
    try {
        const { modelId } = req.apiAuth;
        const { conversation_id, message, message_type = 'text' } = req.body;

        if (!conversation_id || !message) {
            return res.fail(400, 'conversation_id and message are required');
        }

        // Verify conversation belongs to this model
        const convCheck = await db.query(
            'SELECT c.id FROM conversations c JOIN client_model_interactions cmi ON cmi.id = c.client_model_interaction_id WHERE c.id = ? AND cmi.model_id = ?',
            [conversation_id, modelId]
        );

        if (convCheck.length === 0) {
            return res.fail(404, 'Conversation not found');
        }

        // Insert message
        const messageResult = await db.query(
            'INSERT INTO messages (conversation_id, sender_type, sender_id, message, message_type, timestamp) VALUES (?, "model", ?, ?, ?, NOW())',
            [conversation_id, modelId, message, message_type]
        );

        // Update conversation timestamp
        await db.query(
            'UPDATE conversations SET updated_at = NOW() WHERE id = ?',
            [conversation_id]
        );

        // Increment unread count for client (if conversation_model_state exists for other models)
        await db.query(`
            UPDATE conversation_model_state 
            SET unread_count = unread_count + 1, updated_at = NOW()
            WHERE conversation_id = ? AND model_id != ?
        `, [conversation_id, modelId]);

        res.success({
            id: messageResult.insertId,
            conversation_id,
            message,
            message_type,
            sender_type: 'model',
            sender_id: modelId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Send message error:', error);
        res.fail(500, 'Failed to send message');
    }
});

// GET /api/v1/messages/:id - Get specific message
router.get('/:id', async (req, res) => {
    try {
        const { modelId } = req.apiAuth;
        const { id } = req.params;

        const messageSql = `
            SELECT 
                m.*,
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
            WHERE m.id = ? AND cmi.model_id = ?`;

        const messages = await db.query(messageSql, [id, modelId]);
        
        if (messages.length === 0) {
            return res.fail(404, 'Message not found');
        }

        res.success(messages[0]);
    } catch (error) {
        console.error('Get message error:', error);
        res.fail(500, 'Failed to retrieve message');
    }
});

module.exports = router;
