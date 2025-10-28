const express = require('express');
const router = express.Router();
const { query } = require('../../../config/database');

async function requireCRMAuth(req, res, next) {
    const { slug } = req.params;
    if (req.session.crm && req.session.crm.modelSlug === slug && req.session.crm.authenticated) {
        return next();
    }
    return res.status(401).json({ success: false, error: 'Unauthorized' });
}

// List messages for a client_model_interaction
router.get('/:slug/messages/:interactionId', requireCRMAuth, async (req, res) => {
    try {
        const { interactionId } = req.params;
        const limit = Math.min(parseInt(req.query.limit || '100', 10), 500);

        const rows = await query(`
            SELECT m.id, m.message_type, m.message_type_extended, m.subject, m.message,
                   m.sender_name, m.sender_email, m.created_at
            FROM messages m
            JOIN conversations c ON m.conversation_id = c.id
            WHERE c.client_model_interaction_id = ?
            ORDER BY m.created_at DESC
            LIMIT ?
        `, [interactionId, limit]);

        res.json({ success: true, data: rows });
    } catch (e) {
        console.error('CRM list messages error:', e);
        res.status(500).json({ success: false, error: 'Failed to list messages' });
    }
});

// Send a message from model to client
router.post('/:slug/messages/:interactionId', requireCRMAuth, async (req, res) => {
    try {
        const { interactionId } = req.params;
        const { modelId, modelName } = req.session.crm;
        const { text } = req.body;
        if (!text || !text.trim()) {
            return res.status(400).json({ success: false, error: 'Message text required' });
        }

        // Find or create conversation bound to this interaction
        let conv = await query(`SELECT id FROM conversations WHERE client_model_interaction_id = ? ORDER BY updated_at DESC LIMIT 1`, [interactionId]);
        let conversationId;
        if (conv.length === 0) {
            const ins = await query(`
                INSERT INTO conversations (
                    contact_id, subject, model_id, is_live_chat, chat_status,
                    last_seen_by_model, updated_at, client_model_interaction_id
                ) VALUES (NULL, ?, ?, TRUE, 'active', NOW(), NOW(), ?)
            `, ['CRM messages', modelId, interactionId]);
            conversationId = ins.insertId;
        } else {
            conversationId = conv[0].id;
        }

        const inserted = await query(`
            INSERT INTO messages (
                conversation_id, message_type, message_type_extended, message,
                sender_name, sender_email, ip_address, user_agent,
                is_read_by_contact, is_read_by_model, read_at_contact, read_at_model
            ) VALUES (?, 'internal_note', 'crm_outbound', ?, ?, NULL, NULL, NULL, 0, 1, NULL, NOW())
        `, [conversationId, text, modelName]);

        await query(`UPDATE conversations SET updated_at = NOW() WHERE id = ?`, [conversationId]);

        res.json({ success: true, messageId: inserted.insertId, conversationId });
    } catch (e) {
        console.error('CRM send message error:', e);
        res.status(500).json({ success: false, error: 'Failed to send message' });
    }
});

module.exports = router;


