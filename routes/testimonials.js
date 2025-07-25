const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken: auth } = require('../middleware/auth');

// Get all testimonials for authenticated model
router.get('/', auth, async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT * FROM testimonials 
            WHERE model_id = ? 
            ORDER BY sort_order, created_at DESC
        `, [req.user.id]);

        res.json({
            success: true,
            testimonials: rows
        });
    } catch (error) {
        console.error('Error fetching testimonials:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch testimonials'
        });
    }
});

// Get published testimonials (public endpoint - no auth required)
router.get('/public/:modelSlug', async (req, res) => {
    try {
        const modelSlug = req.params.modelSlug;

        const [rows] = await db.execute(`
            SELECT t.id, t.testimonial_text, t.client_name, t.client_initial, 
                   t.rating, t.location, t.created_at
            FROM testimonials t
            JOIN models m ON t.model_id = m.id
            WHERE m.slug = ? AND t.is_published = 1 AND t.is_approved = 1
            ORDER BY t.sort_order, t.created_at DESC
        `, [modelSlug]);

        res.json({
            success: true,
            testimonials: rows
        });
    } catch (error) {
        console.error('Error fetching public testimonials:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch testimonials'
        });
    }
});

// Get single testimonial
router.get('/:id', auth, async (req, res) => {
    try {
        const testimonialId = req.params.id;

        const [rows] = await db.execute(`
            SELECT * FROM testimonials WHERE id = ? AND model_id = ?
        `, [testimonialId, req.user.id]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Testimonial not found'
            });
        }

        res.json({
            success: true,
            testimonial: rows[0]
        });
    } catch (error) {
        console.error('Error fetching testimonial:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch testimonial'
        });
    }
});

// Create new testimonial
router.post('/', auth, async (req, res) => {
    try {
        const { 
            testimonial_text, 
            client_name, 
            client_initial, 
            rating, 
            location,
            is_published = false,
            is_approved = false
        } = req.body;

        // Validate required fields
        if (!testimonial_text) {
            return res.status(400).json({
                success: false,
                message: 'Testimonial text is required'
            });
        }

        if (testimonial_text.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Testimonial text cannot be empty'
            });
        }

        // Validate rating if provided
        if (rating !== undefined && (rating < 1 || rating > 5)) {
            return res.status(400).json({
                success: false,
                message: 'Rating must be between 1 and 5'
            });
        }

        // Get next sort order
        const [sortResult] = await db.execute(`
            SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order
            FROM testimonials WHERE model_id = ?
        `, [req.user.id]);

        const sortOrder = sortResult[0].next_order;

        // Insert new testimonial
        const [result] = await db.execute(`
            INSERT INTO testimonials (
                model_id, testimonial_text, client_name, client_initial, 
                rating, location, sort_order, is_published, is_approved, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `, [
            req.user.id, 
            testimonial_text.trim(), 
            client_name || null, 
            client_initial || null,
            rating || null,
            location || null,
            sortOrder,
            is_published ? 1 : 0,
            is_approved ? 1 : 0
        ]);

        // Get the inserted testimonial
        const [testimonialRows] = await db.execute(`
            SELECT * FROM testimonials WHERE id = ?
        `, [result.insertId]);

        res.status(201).json({
            success: true,
            message: 'Testimonial created successfully',
            testimonial: testimonialRows[0]
        });

    } catch (error) {
        console.error('Error creating testimonial:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create testimonial'
        });
    }
});

// Update testimonial
router.put('/:id', auth, async (req, res) => {
    try {
        const testimonialId = req.params.id;
        const { 
            testimonial_text, 
            client_name, 
            client_initial, 
            rating, 
            location,
            is_published,
            is_approved
        } = req.body;

        // Validate required fields
        if (!testimonial_text) {
            return res.status(400).json({
                success: false,
                message: 'Testimonial text is required'
            });
        }

        if (testimonial_text.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Testimonial text cannot be empty'
            });
        }

        // Validate rating if provided
        if (rating !== undefined && rating !== null && (rating < 1 || rating > 5)) {
            return res.status(400).json({
                success: false,
                message: 'Rating must be between 1 and 5'
            });
        }

        // Verify testimonial ownership
        const [ownershipCheck] = await db.execute(`
            SELECT id FROM testimonials WHERE id = ? AND model_id = ?
        `, [testimonialId, req.user.id]);

        if (ownershipCheck.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Testimonial not found'
            });
        }

        // Update testimonial
        await db.execute(`
            UPDATE testimonials 
            SET testimonial_text = ?, client_name = ?, client_initial = ?, 
                rating = ?, location = ?, is_published = ?, is_approved = ?, updated_at = NOW()
            WHERE id = ? AND model_id = ?
        `, [
            testimonial_text.trim(), 
            client_name || null, 
            client_initial || null,
            rating || null,
            location || null,
            is_published !== undefined ? (is_published ? 1 : 0) : undefined,
            is_approved !== undefined ? (is_approved ? 1 : 0) : undefined,
            testimonialId, 
            req.user.id
        ]);

        // Get updated testimonial
        const [testimonialRows] = await db.execute(`
            SELECT * FROM testimonials WHERE id = ?
        `, [testimonialId]);

        res.json({
            success: true,
            message: 'Testimonial updated successfully',
            testimonial: testimonialRows[0]
        });

    } catch (error) {
        console.error('Error updating testimonial:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update testimonial'
        });
    }
});

// Reorder testimonials
router.post('/reorder', auth, async (req, res) => {
    try {
        const { testimonialOrders } = req.body; // Array of {id, sort_order}

        if (!Array.isArray(testimonialOrders)) {
            return res.status(400).json({
                success: false,
                message: 'testimonialOrders must be an array'
            });
        }

        // Validate all testimonials belong to the user
        const testimonialIds = testimonialOrders.map(item => item.id);
        const [ownershipCheck] = await db.execute(`
            SELECT COUNT(*) as count FROM testimonials 
            WHERE id IN (${testimonialIds.map(() => '?').join(',')}) AND model_id = ?
        `, [...testimonialIds, req.user.id]);

        if (ownershipCheck[0].count !== testimonialOrders.length) {
            return res.status(403).json({
                success: false,
                message: 'You can only reorder your own testimonials'
            });
        }

        // Update sort orders in a transaction
        await db.execute('START TRANSACTION');

        for (const item of testimonialOrders) {
            await db.execute(`
                UPDATE testimonials 
                SET sort_order = ?, updated_at = NOW() 
                WHERE id = ? AND model_id = ?
            `, [item.sort_order, item.id, req.user.id]);
        }

        await db.execute('COMMIT');

        res.json({
            success: true,
            message: 'Testimonials reordered successfully'
        });

    } catch (error) {
        await db.execute('ROLLBACK');
        console.error('Error reordering testimonials:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reorder testimonials'
        });
    }
});

// Toggle testimonial published status
router.patch('/:id/publish', auth, async (req, res) => {
    try {
        const testimonialId = req.params.id;

        // Verify testimonial ownership and get current status
        const [testimonialRows] = await db.execute(`
            SELECT id, is_published FROM testimonials WHERE id = ? AND model_id = ?
        `, [testimonialId, req.user.id]);

        if (testimonialRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Testimonial not found'
            });
        }

        const newStatus = testimonialRows[0].is_published ? 0 : 1;

        // Update status
        await db.execute(`
            UPDATE testimonials 
            SET is_published = ?, updated_at = NOW()
            WHERE id = ? AND model_id = ?
        `, [newStatus, testimonialId, req.user.id]);

        // Get updated testimonial
        const [updatedRows] = await db.execute(`
            SELECT * FROM testimonials WHERE id = ?
        `, [testimonialId]);

        res.json({
            success: true,
            message: `Testimonial ${newStatus ? 'published' : 'unpublished'} successfully`,
            testimonial: updatedRows[0]
        });

    } catch (error) {
        console.error('Error toggling testimonial publish status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to toggle testimonial publish status'
        });
    }
});

// Toggle testimonial approved status
router.patch('/:id/approve', auth, async (req, res) => {
    try {
        const testimonialId = req.params.id;

        // Verify testimonial ownership and get current status
        const [testimonialRows] = await db.execute(`
            SELECT id, is_approved FROM testimonials WHERE id = ? AND model_id = ?
        `, [testimonialId, req.user.id]);

        if (testimonialRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Testimonial not found'
            });
        }

        const newStatus = testimonialRows[0].is_approved ? 0 : 1;

        // Update status
        await db.execute(`
            UPDATE testimonials 
            SET is_approved = ?, updated_at = NOW()
            WHERE id = ? AND model_id = ?
        `, [newStatus, testimonialId, req.user.id]);

        // Get updated testimonial
        const [updatedRows] = await db.execute(`
            SELECT * FROM testimonials WHERE id = ?
        `, [testimonialId]);

        res.json({
            success: true,
            message: `Testimonial ${newStatus ? 'approved' : 'unapproved'} successfully`,
            testimonial: updatedRows[0]
        });

    } catch (error) {
        console.error('Error toggling testimonial approval status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to toggle testimonial approval status'
        });
    }
});

// Delete testimonial
router.delete('/:id', auth, async (req, res) => {
    try {
        const testimonialId = req.params.id;

        // Verify testimonial ownership
        const [ownershipCheck] = await db.execute(`
            SELECT id FROM testimonials WHERE id = ? AND model_id = ?
        `, [testimonialId, req.user.id]);

        if (ownershipCheck.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Testimonial not found'
            });
        }

        // Delete testimonial
        await db.execute(`
            DELETE FROM testimonials WHERE id = ? AND model_id = ?
        `, [testimonialId, req.user.id]);

        res.json({
            success: true,
            message: 'Testimonial deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting testimonial:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete testimonial'
        });
    }
});

// Bulk operations
router.post('/bulk', auth, async (req, res) => {
    try {
        const { action, testimonialIds } = req.body;

        if (!Array.isArray(testimonialIds) || testimonialIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'testimonialIds must be a non-empty array'
            });
        }

        // Verify all testimonials belong to the user
        const [ownershipCheck] = await db.execute(`
            SELECT COUNT(*) as count FROM testimonials 
            WHERE id IN (${testimonialIds.map(() => '?').join(',')}) AND model_id = ?
        `, [...testimonialIds, req.user.id]);

        if (ownershipCheck[0].count !== testimonialIds.length) {
            return res.status(403).json({
                success: false,
                message: 'You can only modify your own testimonials'
            });
        }

        let message = '';
        const placeholders = testimonialIds.map(() => '?').join(',');

        switch (action) {
            case 'publish':
                await db.execute(`
                    UPDATE testimonials 
                    SET is_published = 1, updated_at = NOW()
                    WHERE id IN (${placeholders}) AND model_id = ?
                `, [...testimonialIds, req.user.id]);
                message = 'Testimonials published successfully';
                break;

            case 'unpublish':
                await db.execute(`
                    UPDATE testimonials 
                    SET is_published = 0, updated_at = NOW()
                    WHERE id IN (${placeholders}) AND model_id = ?
                `, [...testimonialIds, req.user.id]);
                message = 'Testimonials unpublished successfully';
                break;

            case 'approve':
                await db.execute(`
                    UPDATE testimonials 
                    SET is_approved = 1, updated_at = NOW()
                    WHERE id IN (${placeholders}) AND model_id = ?
                `, [...testimonialIds, req.user.id]);
                message = 'Testimonials approved successfully';
                break;

            case 'unapprove':
                await db.execute(`
                    UPDATE testimonials 
                    SET is_approved = 0, updated_at = NOW()
                    WHERE id IN (${placeholders}) AND model_id = ?
                `, [...testimonialIds, req.user.id]);
                message = 'Testimonials unapproved successfully';
                break;

            case 'delete':
                await db.execute(`
                    DELETE FROM testimonials 
                    WHERE id IN (${placeholders}) AND model_id = ?
                `, [...testimonialIds, req.user.id]);
                message = 'Testimonials deleted successfully';
                break;

            default:
                return res.status(400).json({
                    success: false,
                    message: 'Invalid action. Use publish, unpublish, approve, unapprove, or delete'
                });
        }

        res.json({
            success: true,
            message: message
        });

    } catch (error) {
        console.error('Error performing bulk testimonial operation:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to perform bulk operation'
        });
    }
});

module.exports = router;