const express = require('express');
const router = express.Router();
const db = require('../../../config/database');
const FileUploadService = require('../../../services/FileUploadService');

async function requireCRMAuth(req, res, next) {
    const { slug } = req.params;
    if (req.session.crm && req.session.crm.modelSlug === slug && req.session.crm.authenticated) {
        return next();
    }
    return res.status(401).json({ success: false, error: 'Unauthorized' });
}

// List threads for a client interaction
router.get('/:slug/clients/:interactionId/threads', requireCRMAuth, async (req, res) => {
    try {
        const { interactionId } = req.params;
        const { modelId } = req.session.crm;
        const status = (req.query.status || 'active').toLowerCase();
        const tag = (req.query.tag || '').trim();
        const q = (req.query.q || '').trim();

        const rows = await db.query(`
            SELECT c.id AS conversation_id,
                   c.subject,
                   c.chat_status,
                   c.updated_at AS last_activity,
                   COALESCE(cms.is_archived, 0) AS is_archived,
                   COALESCE(cms.unread_count, 0) AS unread_count,
                   COALESCE(cms.tags, '[]') AS tags
            FROM conversations c
            LEFT JOIN conversation_model_state cms
              ON cms.conversation_id = c.id AND cms.model_id = ?
            WHERE c.client_model_interaction_id = ?
              AND (? = 'all' OR (? = 'active' AND COALESCE(cms.is_archived,0) = 0) OR (? = 'archived' AND COALESCE(cms.is_archived,0) = 1))
              AND (? = '' OR JSON_CONTAINS(COALESCE(cms.tags,'[]'), JSON_QUOTE(?)))
              AND (? = '' OR EXISTS (
                   SELECT 1 FROM messages m WHERE m.conversation_id = c.id AND m.message LIKE CONCAT('%', ?, '%') LIMIT 1
              ))
            ORDER BY c.updated_at DESC
        `, [modelId, interactionId, status, status, status, tag, tag, q, q]);

        res.json({ success: true, data: rows });
    } catch (e) {
        console.error('List threads error:', e);
        res.status(500).json({ success: false, error: 'Failed to list threads' });
    }
});

// Archive/unarchive a thread for this model
router.post('/:slug/threads/:conversationId/archive', requireCRMAuth, async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { modelId } = req.session.crm;
        const archived = req.body.archived ? 1 : 0;

        // Ensure a row exists
        await db.query(`
            INSERT INTO conversation_model_state (conversation_id, model_id, client_model_interaction_id, is_archived, is_hidden, unread_count, tags, created_at, updated_at)
            SELECT c.id, ?, c.client_model_interaction_id, ?, 0, 0, '[]', NOW(), NOW()
            FROM conversations c
            WHERE c.id = ?
            ON DUPLICATE KEY UPDATE is_archived = VALUES(is_archived), updated_at = NOW()
        `, [modelId, archived, conversationId]);

        res.json({ success: true });
    } catch (e) {
        console.error('Archive thread error:', e);
        res.status(500).json({ success: false, error: 'Failed to archive thread' });
    }
});

// Tag/untag a thread
router.post('/:slug/threads/:conversationId/tag', requireCRMAuth, async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { modelId } = req.session.crm;
        const add = Array.isArray(req.body.add) ? req.body.add : [];
        const remove = Array.isArray(req.body.remove) ? req.body.remove : [];

        // Upsert row first
        await db.query(`
            INSERT INTO conversation_model_state (conversation_id, model_id, client_model_interaction_id, is_archived, is_hidden, unread_count, tags, created_at, updated_at)
            SELECT c.id, ?, c.client_model_interaction_id, 0, 0, 0, '[]', NOW(), NOW()
            FROM conversations c WHERE c.id = ?
            ON DUPLICATE KEY UPDATE updated_at = NOW()
        `, [modelId, conversationId]);

        const rows = await db.query(`SELECT tags FROM conversation_model_state WHERE conversation_id = ? AND model_id = ?`, [conversationId, modelId]);
        let tags = [];
        try { tags = JSON.parse(rows[0]?.tags || '[]'); } catch (_) { tags = []; }
        const set = new Set(tags);
        add.forEach(t => set.add(String(t)));
        remove.forEach(t => set.delete(String(t)));
        const out = JSON.stringify(Array.from(set));

        await db.query(`UPDATE conversation_model_state SET tags = ?, updated_at = NOW() WHERE conversation_id = ? AND model_id = ?`, [out, conversationId, modelId]);
        res.json({ success: true, tags: JSON.parse(out) });
    } catch (e) {
        console.error('Tag thread error:', e);
        res.status(500).json({ success: false, error: 'Failed to tag thread' });
    }
});

// Mark as read (clear unread_count)
router.post('/:slug/threads/:conversationId/read', requireCRMAuth, async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { modelId } = req.session.crm;
        await db.query(`
            INSERT INTO conversation_model_state (conversation_id, model_id, client_model_interaction_id, is_archived, is_hidden, unread_count, tags, last_viewed_at, created_at, updated_at)
            SELECT c.id, ?, c.client_model_interaction_id, 0, 0, 0, '[]', NOW(), NOW(), NOW()
            FROM conversations c WHERE c.id = ?
            ON DUPLICATE KEY UPDATE unread_count = 0, last_viewed_at = NOW(), updated_at = NOW()
        `, [modelId, conversationId]);
        res.json({ success: true });
    } catch (e) {
        console.error('Mark read error:', e);
        res.status(500).json({ success: false, error: 'Failed to mark read' });
    }
});

module.exports = router;

// List conversation files (attachments)
router.get('/:slug/threads/:conversationId/files', requireCRMAuth, async (req, res) => {
    try {
        const { conversationId } = req.params;
        // Use FileUploadService to enumerate files if available
        try {
            const svc = new FileUploadService();
            const files = await svc.getConversationFiles(conversationId, false);
            return res.json({ success: true, files });
        } catch (e) {
            // Fallback: no service available
            return res.json({ success: true, files: [] });
        }
    } catch (e) {
        console.error('List files error:', e);
        res.status(500).json({ success: false, error: 'Failed to list files' });
    }
});


