const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken: auth } = require('../middleware/auth');

// Get all FAQ items for authenticated model
router.get('/', auth, async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT * FROM faq_items 
            WHERE model_id = ? 
            ORDER BY sort_order, created_at
        `, [req.user.id]);

        res.json({
            success: true,
            faqs: rows
        });
    } catch (error) {
        console.error('Error fetching FAQ items:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch FAQ items'
        });
    }
});

// Get single FAQ item
router.get('/:id', auth, async (req, res) => {
    try {
        const faqId = req.params.id;

        const [rows] = await db.execute(`
            SELECT * FROM faq_items WHERE id = ? AND model_id = ?
        `, [faqId, req.user.id]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'FAQ item not found'
            });
        }

        res.json({
            success: true,
            faq: rows[0]
        });
    } catch (error) {
        console.error('Error fetching FAQ item:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch FAQ item'
        });
    }
});

// Create new FAQ item
router.post('/', auth, async (req, res) => {
    try {
        const { question, answer } = req.body;

        // Validate required fields
        if (!question || !answer) {
            return res.status(400).json({
                success: false,
                message: 'Question and answer are required'
            });
        }

        if (question.trim().length === 0 || answer.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Question and answer cannot be empty'
            });
        }

        // Get next sort order
        const [sortResult] = await db.execute(`
            SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order
            FROM faq_items WHERE model_id = ?
        `, [req.user.id]);

        const sortOrder = sortResult[0].next_order;

        // Insert new FAQ item
        const [result] = await db.execute(`
            INSERT INTO faq_items (model_id, question, answer, sort_order, is_active, created_at)
            VALUES (?, ?, ?, ?, 1, NOW())
        `, [req.user.id, question.trim(), answer.trim(), sortOrder]);

        // Get the inserted FAQ item
        const [faqRows] = await db.execute(`
            SELECT * FROM faq_items WHERE id = ?
        `, [result.insertId]);

        res.status(201).json({
            success: true,
            message: 'FAQ item created successfully',
            faq: faqRows[0]
        });

    } catch (error) {
        console.error('Error creating FAQ item:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create FAQ item'
        });
    }
});

// Update FAQ item
router.put('/:id', auth, async (req, res) => {
    try {
        const faqId = req.params.id;
        const { question, answer, is_active } = req.body;

        // Validate required fields
        if (!question || !answer) {
            return res.status(400).json({
                success: false,
                message: 'Question and answer are required'
            });
        }

        if (question.trim().length === 0 || answer.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Question and answer cannot be empty'
            });
        }

        // Verify FAQ ownership
        const [ownershipCheck] = await db.execute(`
            SELECT id FROM faq_items WHERE id = ? AND model_id = ?
        `, [faqId, req.user.id]);

        if (ownershipCheck.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'FAQ item not found'
            });
        }

        // Update FAQ item
        await db.execute(`
            UPDATE faq_items 
            SET question = ?, answer = ?, is_active = ?, updated_at = NOW()
            WHERE id = ? AND model_id = ?
        `, [
            question.trim(), 
            answer.trim(), 
            is_active !== undefined ? (is_active ? 1 : 0) : 1,
            faqId, 
            req.user.id
        ]);

        // Get updated FAQ item
        const [faqRows] = await db.execute(`
            SELECT * FROM faq_items WHERE id = ?
        `, [faqId]);

        res.json({
            success: true,
            message: 'FAQ item updated successfully',
            faq: faqRows[0]
        });

    } catch (error) {
        console.error('Error updating FAQ item:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update FAQ item'
        });
    }
});

// Reorder FAQ items
router.post('/reorder', auth, async (req, res) => {
    try {
        const { faqOrders } = req.body; // Array of {id, sort_order}

        if (!Array.isArray(faqOrders)) {
            return res.status(400).json({
                success: false,
                message: 'faqOrders must be an array'
            });
        }

        // Validate all FAQ items belong to the user
        const faqIds = faqOrders.map(item => item.id);
        const [ownershipCheck] = await db.execute(`
            SELECT COUNT(*) as count FROM faq_items 
            WHERE id IN (${faqIds.map(() => '?').join(',')}) AND model_id = ?
        `, [...faqIds, req.user.id]);

        if (ownershipCheck[0].count !== faqOrders.length) {
            return res.status(403).json({
                success: false,
                message: 'You can only reorder your own FAQ items'
            });
        }

        // Update sort orders in a transaction
        await db.execute('START TRANSACTION');

        for (const item of faqOrders) {
            await db.execute(`
                UPDATE faq_items 
                SET sort_order = ?, updated_at = NOW() 
                WHERE id = ? AND model_id = ?
            `, [item.sort_order, item.id, req.user.id]);
        }

        await db.execute('COMMIT');

        res.json({
            success: true,
            message: 'FAQ items reordered successfully'
        });

    } catch (error) {
        await db.execute('ROLLBACK');
        console.error('Error reordering FAQ items:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reorder FAQ items'
        });
    }
});

// Toggle FAQ active status
router.patch('/:id/toggle', auth, async (req, res) => {
    try {
        const faqId = req.params.id;

        // Verify FAQ ownership and get current status
        const [faqRows] = await db.execute(`
            SELECT id, is_active FROM faq_items WHERE id = ? AND model_id = ?
        `, [faqId, req.user.id]);

        if (faqRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'FAQ item not found'
            });
        }

        const newStatus = faqRows[0].is_active ? 0 : 1;

        // Update status
        await db.execute(`
            UPDATE faq_items 
            SET is_active = ?, updated_at = NOW()
            WHERE id = ? AND model_id = ?
        `, [newStatus, faqId, req.user.id]);

        // Get updated FAQ item
        const [updatedRows] = await db.execute(`
            SELECT * FROM faq_items WHERE id = ?
        `, [faqId]);

        res.json({
            success: true,
            message: `FAQ item ${newStatus ? 'activated' : 'deactivated'} successfully`,
            faq: updatedRows[0]
        });

    } catch (error) {
        console.error('Error toggling FAQ status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to toggle FAQ status'
        });
    }
});

// Delete FAQ item
router.delete('/:id', auth, async (req, res) => {
    try {
        const faqId = req.params.id;

        // Verify FAQ ownership
        const [ownershipCheck] = await db.execute(`
            SELECT id FROM faq_items WHERE id = ? AND model_id = ?
        `, [faqId, req.user.id]);

        if (ownershipCheck.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'FAQ item not found'
            });
        }

        // Delete FAQ item
        await db.execute(`
            DELETE FROM faq_items WHERE id = ? AND model_id = ?
        `, [faqId, req.user.id]);

        res.json({
            success: true,
            message: 'FAQ item deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting FAQ item:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete FAQ item'
        });
    }
});

// Bulk operations
router.post('/bulk', auth, async (req, res) => {
    try {
        const { action, faqIds } = req.body;

        if (!Array.isArray(faqIds) || faqIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'faqIds must be a non-empty array'
            });
        }

        // Verify all FAQ items belong to the user
        const [ownershipCheck] = await db.execute(`
            SELECT COUNT(*) as count FROM faq_items 
            WHERE id IN (${faqIds.map(() => '?').join(',')}) AND model_id = ?
        `, [...faqIds, req.user.id]);

        if (ownershipCheck[0].count !== faqIds.length) {
            return res.status(403).json({
                success: false,
                message: 'You can only modify your own FAQ items'
            });
        }

        let message = '';
        const placeholders = faqIds.map(() => '?').join(',');

        switch (action) {
            case 'activate':
                await db.execute(`
                    UPDATE faq_items 
                    SET is_active = 1, updated_at = NOW()
                    WHERE id IN (${placeholders}) AND model_id = ?
                `, [...faqIds, req.user.id]);
                message = 'FAQ items activated successfully';
                break;

            case 'deactivate':
                await db.execute(`
                    UPDATE faq_items 
                    SET is_active = 0, updated_at = NOW()
                    WHERE id IN (${placeholders}) AND model_id = ?
                `, [...faqIds, req.user.id]);
                message = 'FAQ items deactivated successfully';
                break;

            case 'delete':
                await db.execute(`
                    DELETE FROM faq_items 
                    WHERE id IN (${placeholders}) AND model_id = ?
                `, [...faqIds, req.user.id]);
                message = 'FAQ items deleted successfully';
                break;

            default:
                return res.status(400).json({
                    success: false,
                    message: 'Invalid action. Use activate, deactivate, or delete'
                });
        }

        res.json({
            success: true,
            message: message
        });

    } catch (error) {
        console.error('Error performing bulk FAQ operation:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to perform bulk operation'
        });
    }
});

module.exports = router;