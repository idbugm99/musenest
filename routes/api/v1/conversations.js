const express = require('express');
const router = express.Router();
const db = require('../../../config/database');
const { requireApiAuth } = require('../../../middleware/apiAuth');

// Apply API auth to all routes
router.use(requireApiAuth);

// GET /api/v1/conversations - List conversations for authenticated model
router.get('/', async (req, res) => {
    try {
        const { modelId } = req.apiAuth;
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        const offset = (page - 1) * limit;
        const status = req.query.status || 'active'; // active, archived, all
        const interactionId = req.query.interaction_id;

        let whereClause = 'WHERE cmi.model_id = ?';
        let params = [modelId];

        if (interactionId) {
            whereClause += ' AND c.client_model_interaction_id = ?';
            params.push(interactionId);
        }

        if (status !== 'all') {
            if (status === 'active') {
                whereClause += ' AND COALESCE(cms.is_archived, 0) = 0';
            } else if (status === 'archived') {
                whereClause += ' AND COALESCE(cms.is_archived, 0) = 1';
            }
        }

        const conversationsSql = `
            SELECT 
                c.id,
                c.subject,
                c.chat_status,
                c.created_at,
                c.updated_at,
                c.client_model_interaction_id,
                ec.client_identifier,
                COALESCE(cms.is_archived, 0) AS is_archived,
                COALESCE(cms.unread_count, 0) AS unread_count,
                COALESCE(cms.tags, '[]') AS tags,
                cms.last_viewed_at,
                (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count
            FROM conversations c
            JOIN client_model_interactions cmi ON cmi.id = c.client_model_interaction_id
            JOIN escort_clients ec ON ec.id = cmi.escort_client_id
            LEFT JOIN conversation_model_state cms ON cms.conversation_id = c.id AND cms.model_id = ?
            ${whereClause}
            ORDER BY c.updated_at DESC
            LIMIT ? OFFSET ?`;

        const conversations = await db.query(conversationsSql, [modelId, ...params, limit, offset]);

        // Parse tags JSON
        conversations.forEach(conv => {
            try {
                conv.tags = JSON.parse(conv.tags);
            } catch (e) {
                conv.tags = [];
            }
        });

        res.success(conversations, {
            pagination: {
                page,
                limit,
                total: conversations.length,
                pages: Math.ceil(conversations.length / limit)
            }
        });
    } catch (error) {
        console.error('Get conversations error:', error);
        res.fail(500, 'Failed to retrieve conversations');
    }
});

// GET /api/v1/conversations/:id - Get specific conversation
router.get('/:id', async (req, res) => {
    try {
        const { modelId } = req.apiAuth;
        const { id } = req.params;

        const conversationSql = `
            SELECT 
                c.*,
                ec.client_identifier,
                COALESCE(cms.is_archived, 0) AS is_archived,
                COALESCE(cms.unread_count, 0) AS unread_count,
                COALESCE(cms.tags, '[]') AS tags,
                cms.last_viewed_at
            FROM conversations c
            JOIN client_model_interactions cmi ON cmi.id = c.client_model_interaction_id
            JOIN escort_clients ec ON ec.id = cmi.escort_client_id
            LEFT JOIN conversation_model_state cms ON cms.conversation_id = c.id AND cms.model_id = ?
            WHERE c.id = ? AND cmi.model_id = ?`;

        const conversations = await db.query(conversationSql, [modelId, id, modelId]);
        
        if (conversations.length === 0) {
            return res.fail(404, 'Conversation not found');
        }

        const conversation = conversations[0];
        try {
            conversation.tags = JSON.parse(conversation.tags);
        } catch (e) {
            conversation.tags = [];
        }

        res.success(conversation);
    } catch (error) {
        console.error('Get conversation error:', error);
        res.fail(500, 'Failed to retrieve conversation');
    }
});

// POST /api/v1/conversations - Create new conversation
router.post('/', async (req, res) => {
    try {
        const { modelId } = req.apiAuth;
        const { interaction_id, subject, message } = req.body;

        if (!interaction_id || !subject) {
            return res.fail(400, 'interaction_id and subject are required' );
        }

        // Verify interaction belongs to this model
        const interactionCheck = await db.query(
            'SELECT id FROM client_model_interactions WHERE id = ? AND model_id = ?',
            [interaction_id, modelId]
        );

        if (interactionCheck.length === 0) {
            return res.fail(404, 'Client interaction not found' );
        }

        // Create conversation
        const conversationResult = await db.query(
            'INSERT INTO conversations (subject, client_model_interaction_id, chat_status, created_at, updated_at) VALUES (?, ?, "active", NOW(), NOW())',
            [subject, interaction_id]
        );

        const conversationId = conversationResult.insertId;

        // Add initial message if provided
        if (message) {
            await db.query(
                'INSERT INTO messages (conversation_id, sender_type, sender_id, message, timestamp) VALUES (?, "model", ?, ?, NOW())',
                [conversationId, modelId, message]
            );
        }

        res.success({
            id: conversationId,
            subject,
            interaction_id,
            created: true
        });
    } catch (error) {
        console.error('Create conversation error:', error);
        res.fail(500, 'Failed to create conversation');
    }
});

// PUT /api/v1/conversations/:id/archive - Archive/unarchive conversation
router.put('/:id/archive', async (req, res) => {
    try {
        const { modelId } = req.apiAuth;
        const { id } = req.params;
        const { archived } = req.body;

        // Verify conversation belongs to this model
        const convCheck = await db.query(
            'SELECT c.id FROM conversations c JOIN client_model_interactions cmi ON cmi.id = c.client_model_interaction_id WHERE c.id = ? AND cmi.model_id = ?',
            [id, modelId]
        );

        if (convCheck.length === 0) {
            return res.fail(404, 'Conversation not found');
        }

        // Update or create conversation_model_state
        await db.query(`
            INSERT INTO conversation_model_state (conversation_id, model_id, client_model_interaction_id, is_archived)
            SELECT ?, ?, c.client_model_interaction_id, ?
            FROM conversations c
            WHERE c.id = ?
            ON DUPLICATE KEY UPDATE is_archived = VALUES(is_archived), updated_at = NOW()
        `, [id, modelId, archived ? 1 : 0, id]);

        res.success({});
    } catch (error) {
        console.error('Archive conversation error:', error);
        res.fail(500, 'Failed to archive conversation');
    }
});

// PUT /api/v1/conversations/:id/tags - Update conversation tags
router.put('/:id/tags', async (req, res) => {
    try {
        const { modelId } = req.apiAuth;
        const { id } = req.params;
        const { tags } = req.body;

        if (!Array.isArray(tags)) {
            return res.fail(400, 'Tags must be an array' );
        }

        // Verify conversation belongs to this model
        const convCheck = await db.query(
            'SELECT c.id FROM conversations c JOIN client_model_interactions cmi ON cmi.id = c.client_model_interaction_id WHERE c.id = ? AND cmi.model_id = ?',
            [id, modelId]
        );

        if (convCheck.length === 0) {
            return res.fail(404, 'Conversation not found');
        }

        const tagsJson = JSON.stringify(tags);

        // Update or create conversation_model_state
        await db.query(`
            INSERT INTO conversation_model_state (conversation_id, model_id, client_model_interaction_id, tags)
            SELECT ?, ?, c.client_model_interaction_id, ?
            FROM conversations c
            WHERE c.id = ?
            ON DUPLICATE KEY UPDATE tags = VALUES(tags), updated_at = NOW()
        `, [id, modelId, tagsJson, id]);

        res.success({});
    } catch (error) {
        console.error('Update tags error:', error);
        res.fail(500, 'Failed to update tags');
    }
});

// PUT /api/v1/conversations/:id/read - Mark conversation as read
router.put('/:id/read', async (req, res) => {
    try {
        const { modelId } = req.apiAuth;
        const { id } = req.params;

        // Verify conversation belongs to this model
        const convCheck = await db.query(
            'SELECT c.id FROM conversations c JOIN client_model_interactions cmi ON cmi.id = c.client_model_interaction_id WHERE c.id = ? AND cmi.model_id = ?',
            [id, modelId]
        );

        if (convCheck.length === 0) {
            return res.fail(404, 'Conversation not found');
        }

        // Update or create conversation_model_state
        await db.query(`
            INSERT INTO conversation_model_state (conversation_id, model_id, client_model_interaction_id, unread_count, last_viewed_at)
            SELECT ?, ?, c.client_model_interaction_id, 0, NOW()
            FROM conversations c
            WHERE c.id = ?
            ON DUPLICATE KEY UPDATE unread_count = 0, last_viewed_at = NOW(), updated_at = NOW()
        `, [id, modelId, id]);

        res.success({});
    } catch (error) {
        console.error('Mark read error:', error);
        res.fail(500, 'Failed to mark as read');
    }
});

module.exports = router;
