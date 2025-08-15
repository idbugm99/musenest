const express = require('express');
const router = express.Router();
const db = require('../../config/database');

// Get all quick facts for a model
router.get('/:modelSlug', async (req, res) => {
    try {
        const { modelSlug } = req.params;
        
        // Get model ID
        const models = await db.query('SELECT id FROM models WHERE slug = ?', [modelSlug]);
        if (models.length === 0) {
            return res.status(404).json({ success: false, message: 'Model not found' });
        }
        
        const modelId = models[0].id;
        
        // Get quick facts
        const facts = await db.query(`
            SELECT id, question, answer, display_order, is_active, created_at, updated_at
            FROM quick_facts 
            WHERE model_id = ? AND is_active = 1
            ORDER BY display_order ASC, created_at ASC
        `, [modelId]);
        
        res.json({ success: true, data: facts });
        
    } catch (error) {
        console.error('Error fetching quick facts:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Create a new quick fact
router.post('/', async (req, res) => {
    try {
        const { question, answer, model_slug } = req.body;
        
        if (!question || !answer || !model_slug) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }
        
        // Get model ID
        const models = await db.query('SELECT id FROM models WHERE slug = ?', [model_slug]);
        if (models.length === 0) {
            return res.status(404).json({ success: false, message: 'Model not found' });
        }
        
        const modelId = models[0].id;
        
        // Get next display order
        const orderResult = await db.query(`
            SELECT COALESCE(MAX(display_order), 0) + 1 as next_order
            FROM quick_facts 
            WHERE model_id = ?
        `, [modelId]);
        
        const nextOrder = orderResult[0].next_order;
        
        // Insert new fact
        const result = await db.query(`
            INSERT INTO quick_facts (model_id, question, answer, display_order)
            VALUES (?, ?, ?, ?)
        `, [modelId, question, answer, nextOrder]);
        
        res.json({ 
            success: true, 
            message: 'Quick fact added successfully',
            data: { id: result.insertId, question, answer, display_order: nextOrder }
        });
        
    } catch (error) {
        console.error('Error creating quick fact:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Update a quick fact
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { question, answer } = req.body;
        
        if (!question || !answer) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }
        
        // Update fact
        const result = await db.query(`
            UPDATE quick_facts 
            SET question = ?, answer = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [question, answer, id]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Quick fact not found' });
        }
        
        res.json({ success: true, message: 'Quick fact updated successfully' });
        
    } catch (error) {
        console.error('Error updating quick fact:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Delete a quick fact
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Soft delete (set is_active to 0)
        const result = await db.query(`
            UPDATE quick_facts 
            SET is_active = 0, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [id]);
        
        if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: 'Quick fact not found' });
        }
        
        res.json({ success: true, message: 'Quick fact deleted successfully' });
        
    } catch (error) {
        console.error('Error deleting quick fact:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Reorder quick facts
router.put('/:id/reorder', async (req, res) => {
    try {
        const { id } = req.params;
        const { newOrder } = req.body;
        
        if (typeof newOrder !== 'number') {
            return res.status(400).json({ success: false, message: 'Invalid order value' });
        }
        
        // Update display order
        const result = await db.query(`
            UPDATE quick_facts 
            SET display_order = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [newOrder, id]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Quick fact not found' });
        }
        
        res.json({ success: true, message: 'Quick fact reordered successfully' });
        
    } catch (error) {
        console.error('Error reordering quick fact:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

module.exports = router;