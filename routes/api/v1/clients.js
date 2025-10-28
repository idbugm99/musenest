const express = require('express');
const router = express.Router();
const db = require('../../../config/database');
const { requireApiAuth } = require('../../../middleware/apiAuth');
const ClientResolverService = require('../../../services/ClientResolverService');

// Apply API auth to all routes
router.use(requireApiAuth);

// GET /api/v1/clients - List clients for authenticated model
router.get('/', async (req, res) => {
    try {
        const { modelId } = req.apiAuth;
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        const offset = (page - 1) * limit;
        const search = req.query.search || '';
        const status = req.query.status || 'all'; // all, screened, unscreened, subscriber

        let whereClause = 'WHERE cmi.model_id = ?';
        let params = [modelId, modelId];

        if (search) {
            whereClause += ' AND (ec.client_identifier LIKE ? OR ec.email_hash LIKE ? OR ec.phone_hash LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        if (status !== 'all') {
            whereClause += ' AND cmi.client_category = ?';
            params.push(status);
        }

        const clientsSql = `
            SELECT 
                ec.id,
                ec.client_identifier,
                ec.email_hash,
                ec.phone_hash,
                ec.created_at,
                cmi.id AS interaction_id,
                cmi.screening_status,
                cmi.client_category,
                cmi.subscription_status,
                cmi.last_contacted_at,
                COALESCE(cms.unread_count, 0) AS unread_count,
                COUNT(DISTINCT c.id) AS conversation_count
            FROM escort_clients ec
            JOIN client_model_interactions cmi ON cmi.escort_client_id = ec.id
            LEFT JOIN conversations c ON c.client_model_interaction_id = cmi.id
            LEFT JOIN (
               SELECT c.client_model_interaction_id, SUM(COALESCE(s.unread_count,0)) AS unread_count
               FROM conversations c
               LEFT JOIN conversation_model_state s ON s.conversation_id = c.id AND s.model_id = ?
               GROUP BY c.client_model_interaction_id
            ) cms ON cms.client_model_interaction_id = cmi.id
            ${whereClause}
            GROUP BY ec.id, cmi.id, cms.unread_count
            ORDER BY ec.created_at DESC
            LIMIT ? OFFSET ?`;

        const clients = await db.query(clientsSql, [...params, limit, offset]);

        // Get total count
        const countSql = `
            SELECT COUNT(DISTINCT ec.id) as total
            FROM escort_clients ec
            JOIN client_model_interactions cmi ON cmi.escort_client_id = ec.id
            ${whereClause}`;
        const countResult = await db.query(countSql, params.slice(1));
        const total = countResult[0].total;

        res.success(clients, {
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get clients error:', error);
        res.fail(500, 'Failed to retrieve clients');
    }
});

// GET /api/v1/clients/:interactionId - Get specific client
router.get('/:interactionId', async (req, res) => {
    try {
        const { modelId } = req.apiAuth;
        const { interactionId } = req.params;

        const clientSql = `
            SELECT 
                ec.*,
                cmi.id AS interaction_id,
                cmi.screening_status,
                cmi.client_category,
                cmi.subscription_status,
                cmi.notes_encrypted,
                cmi.last_contacted_at,
                cmi.created_at AS interaction_created_at
            FROM escort_clients ec
            JOIN client_model_interactions cmi ON cmi.escort_client_id = ec.id
            WHERE cmi.id = ? AND cmi.model_id = ?`;

        const clients = await db.query(clientSql, [interactionId, modelId]);
        
        if (clients.length === 0) {
            return res.fail(404, 'Client not found');
        }

        res.success(clients[0]);
    } catch (error) {
        console.error('Get client error:', error);
        res.fail(500, 'Failed to retrieve client');
    }
});

// POST /api/v1/clients - Create or resolve client
router.post('/', async (req, res) => {
    try {
        const { modelId } = req.apiAuth;
        const { email, phone, client_identifier } = req.body;

        if (!email && !phone && !client_identifier) {
            return res.fail(400, 'Email, phone, or client_identifier required');
        }

        const client = await ClientResolverService.resolveOrCreateClient({
            email,
            phone,
            client_identifier
        });

        const interaction = await ClientResolverService.resolveOrCreateInteraction(
            client.id,
            modelId
        );

        res.success({
            client_id: client.id,
            interaction_id: interaction.id,
            created: client.created || interaction.created
        });
    } catch (error) {
        console.error('Create client error:', error);
        res.fail(500, 'Failed to create client');
    }
});

// PUT /api/v1/clients/:interactionId - Update client interaction
router.put('/:interactionId', async (req, res) => {
    try {
        const { modelId } = req.apiAuth;
        const { interactionId } = req.params;
        const { screening_status, client_category, subscription_status, notes_encrypted } = req.body;

        const updateFields = [];
        const params = [];

        if (screening_status) {
            updateFields.push('screening_status = ?');
            params.push(screening_status);
        }
        if (client_category) {
            updateFields.push('client_category = ?');
            params.push(client_category);
        }
        if (subscription_status) {
            updateFields.push('subscription_status = ?');
            params.push(subscription_status);
        }
        if (notes_encrypted !== undefined) {
            updateFields.push('notes_encrypted = ?');
            params.push(notes_encrypted);
        }

        if (updateFields.length === 0) {
            return res.fail(400, 'No fields to update');
        }

        updateFields.push('updated_at = NOW()');
        params.push(interactionId, modelId);

        const updateSql = `
            UPDATE client_model_interactions 
            SET ${updateFields.join(', ')}
            WHERE id = ? AND model_id = ?`;

        const result = await db.query(updateSql, params);

        if (result.affectedRows === 0) {
            return res.fail(404, 'Client interaction not found');
        }

        res.success({});
    } catch (error) {
        console.error('Update client error:', error);
        res.fail(500, 'Failed to update client');
    }
});

module.exports = router;
