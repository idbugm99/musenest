const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken: auth } = require('../middleware/auth');

// Helper function to get user's model ID (same as admin routes)
async function getUserModelId(userId) {
    try {
        const [models] = await db.execute(`
            SELECT m.id 
            FROM models m
            JOIN model_users mu ON m.id = mu.model_id
            WHERE mu.user_id = ? AND mu.is_active = true
            ORDER BY mu.role = 'owner' DESC
            LIMIT 1
        `, [userId]);
        
        return models.length > 0 ? models[0].id : null;
    } catch (error) {
        console.error('getUserModelId error:', error);
        return null;
    }
}

// Get all testimonials for authenticated model
router.get('/', auth, async (req, res) => {
    try {
        const modelId = await getUserModelId(req.user.id);
        if (!modelId) {
            return res.json({
                success: true,
                testimonials: []
            });
        }

        const [rows] = await db.execute(`
            SELECT * FROM testimonials 
            WHERE model_id = ? 
            ORDER BY created_at DESC
        `, [modelId]);

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
                   t.rating, t.created_at
            FROM testimonials t
            JOIN models m ON t.model_id = m.id
            WHERE m.slug = ? AND t.is_active = 1
            ORDER BY t.created_at DESC
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
            is_featured = false
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

        // Insert new testimonial
        const [result] = await db.execute(`
            INSERT INTO testimonials (
                model_id, testimonial_text, client_name, client_initial, 
                rating, is_featured, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            req.user.id, 
            testimonial_text.trim(), 
            client_name || null, 
            client_initial || null,
            rating || null,
            is_featured ? 1 : 0,
            1 // is_active = true by default
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
            is_featured,
            is_active
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
                rating = ?, is_featured = ?, is_active = ?
            WHERE id = ? AND model_id = ?
        `, [
            testimonial_text.trim(), 
            client_name || null, 
            client_initial || null,
            rating || null,
            is_featured !== undefined ? (is_featured ? 1 : 0) : 0,
            is_active !== undefined ? (is_active ? 1 : 0) : 1,
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

// Reorder testimonials - DISABLED (no sort_order column in current schema)
// router.post('/reorder', auth, async (req, res) => {
//     res.status(501).json({
//         success: false,
//         message: 'Reorder functionality not available in current schema'
//     });
// });

// Toggle testimonial featured status
router.patch('/:id/feature', auth, async (req, res) => {
    try {
        const testimonialId = req.params.id;

        // Verify testimonial ownership and get current status
        const [testimonialRows] = await db.execute(`
            SELECT id, is_featured FROM testimonials WHERE id = ? AND model_id = ?
        `, [testimonialId, req.user.id]);

        if (testimonialRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Testimonial not found'
            });
        }

        const newStatus = testimonialRows[0].is_featured ? 0 : 1;

        // Update status
        await db.execute(`
            UPDATE testimonials 
            SET is_featured = ?
            WHERE id = ? AND model_id = ?
        `, [newStatus, testimonialId, req.user.id]);

        // Get updated testimonial
        const [updatedRows] = await db.execute(`
            SELECT * FROM testimonials WHERE id = ?
        `, [testimonialId]);

        res.json({
            success: true,
            message: `Testimonial ${newStatus ? 'featured' : 'unfeatured'} successfully`,
            testimonial: updatedRows[0]
        });

    } catch (error) {
        console.error('Error toggling testimonial featured status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to toggle testimonial featured status'
        });
    }
});

// Toggle testimonial active status
router.patch('/:id/activate', auth, async (req, res) => {
    try {
        const testimonialId = req.params.id;

        // Verify testimonial ownership and get current status
        const [testimonialRows] = await db.execute(`
            SELECT id, is_active FROM testimonials WHERE id = ? AND model_id = ?
        `, [testimonialId, req.user.id]);

        if (testimonialRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Testimonial not found'
            });
        }

        const newStatus = testimonialRows[0].is_active ? 0 : 1;

        // Update status
        await db.execute(`
            UPDATE testimonials 
            SET is_active = ?
            WHERE id = ? AND model_id = ?
        `, [newStatus, testimonialId, req.user.id]);

        // Get updated testimonial
        const [updatedRows] = await db.execute(`
            SELECT * FROM testimonials WHERE id = ?
        `, [testimonialId]);

        res.json({
            success: true,
            message: `Testimonial ${newStatus ? 'activated' : 'deactivated'} successfully`,
            testimonial: updatedRows[0]
        });

    } catch (error) {
        console.error('Error toggling testimonial active status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to toggle testimonial active status'
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
            case 'feature':
                await db.execute(`
                    UPDATE testimonials 
                    SET is_featured = 1
                    WHERE id IN (${placeholders}) AND model_id = ?
                `, [...testimonialIds, req.user.id]);
                message = 'Testimonials featured successfully';
                break;

            case 'unfeature':
                await db.execute(`
                    UPDATE testimonials 
                    SET is_featured = 0
                    WHERE id IN (${placeholders}) AND model_id = ?
                `, [...testimonialIds, req.user.id]);
                message = 'Testimonials unfeatured successfully';
                break;

            case 'activate':
                await db.execute(`
                    UPDATE testimonials 
                    SET is_active = 1
                    WHERE id IN (${placeholders}) AND model_id = ?
                `, [...testimonialIds, req.user.id]);
                message = 'Testimonials activated successfully';
                break;

            case 'deactivate':
                await db.execute(`
                    UPDATE testimonials 
                    SET is_active = 0
                    WHERE id IN (${placeholders}) AND model_id = ?
                `, [...testimonialIds, req.user.id]);
                message = 'Testimonials deactivated successfully';
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
                    message: 'Invalid action. Use feature, unfeature, activate, deactivate, or delete'
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