const express = require('express');
const router = express.Router();
const db = require('../../../config/database');
const { requireApiAuth } = require('../../../middleware/apiAuth');

// Apply API auth to all routes
router.use(requireApiAuth);

// GET /api/v1/notes/:interactionId - Get notes for a client interaction
router.get('/:interactionId', async (req, res) => {
    try {
        const { modelId } = req.apiAuth;
        const { interactionId } = req.params;

        // Verify interaction belongs to this model and get notes
        const notesSql = `
            SELECT 
                cmi.notes_encrypted,
                cmi.updated_at,
                ec.client_identifier
            FROM client_model_interactions cmi
            JOIN escort_clients ec ON ec.id = cmi.escort_client_id
            WHERE cmi.id = ? AND cmi.model_id = ?`;

        const notes = await db.query(notesSql, [interactionId, modelId]);
        
        if (notes.length === 0) {
            return res.fail(404, 'Client interaction not found' );
        }

        res.json({
            success: true,
            data: {
                interaction_id: interactionId,
                client_identifier: notes[0].client_identifier,
                notes: notes[0].notes_encrypted || '',
                updated_at: notes[0].updated_at
            }
        });
    } catch (error) {
        console.error('Get notes error:', error);
        res.fail(500, 'Failed to retrieve notes' );
    }
});

// PUT /api/v1/notes/:interactionId - Update notes for a client interaction
router.put('/:interactionId', async (req, res) => {
    try {
        const { modelId } = req.apiAuth;
        const { interactionId } = req.params;
        const { notes } = req.body;

        if (notes === undefined) {
            return res.fail(400, 'notes field is required' );
        }

        // Verify interaction belongs to this model
        const interactionCheck = await db.query(
            'SELECT id FROM client_model_interactions WHERE id = ? AND model_id = ?',
            [interactionId, modelId]
        );

        if (interactionCheck.length === 0) {
            return res.fail(404, 'Client interaction not found' );
        }

        // Update notes
        const result = await db.query(
            'UPDATE client_model_interactions SET notes_encrypted = ?, updated_at = NOW() WHERE id = ? AND model_id = ?',
            [notes, interactionId, modelId]
        );

        if (result.affectedRows === 0) {
            return res.fail(404, 'Failed to update notes' );
        }

        res.json({
            success: true,
            data: {
                interaction_id: interactionId,
                notes: notes,
                updated_at: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Update notes error:', error);
        res.fail(500, 'Failed to update notes' );
    }
});

// DELETE /api/v1/notes/:interactionId - Clear notes for a client interaction
router.delete('/:interactionId', async (req, res) => {
    try {
        const { modelId } = req.apiAuth;
        const { interactionId } = req.params;

        // Verify interaction belongs to this model
        const interactionCheck = await db.query(
            'SELECT id FROM client_model_interactions WHERE id = ? AND model_id = ?',
            [interactionId, modelId]
        );

        if (interactionCheck.length === 0) {
            return res.fail(404, 'Client interaction not found' );
        }

        // Clear notes
        const result = await db.query(
            'UPDATE client_model_interactions SET notes_encrypted = NULL, updated_at = NOW() WHERE id = ? AND model_id = ?',
            [interactionId, modelId]
        );

        if (result.affectedRows === 0) {
            return res.fail(404, 'Failed to clear notes' );
        }

        res.json({
            success: true,
            data: {
                interaction_id: interactionId,
                notes: null,
                updated_at: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Clear notes error:', error);
        res.fail(500, 'Failed to clear notes' );
    }
});

module.exports = router;
