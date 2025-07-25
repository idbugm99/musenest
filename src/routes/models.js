const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../../config/database');
const { authenticateToken, requireModelAccess, requireEditAccess, requireAdminAccess } = require('../middleware/auth');

const router = express.Router();

// Get all models for current user
router.get('/', authenticateToken, async (req, res) => {
    try {
        const models = await query(`
            SELECT m.id, m.name, m.slug, m.status, m.created_at, m.updated_at,
                   mu.role as access_role,
                   ss.site_name, ss.model_name
            FROM models m
            JOIN model_users mu ON m.id = mu.model_id
            LEFT JOIN site_settings ss ON m.id = ss.model_id
            WHERE mu.user_id = ? AND mu.is_active = true
            ORDER BY mu.role = 'owner' DESC, m.created_at ASC
        `, [req.user.id]);

        res.json({
            models: models,
            total: models.length
        });

    } catch (error) {
        console.error('Models fetch error:', error);
        res.status(500).json({
            error: 'Fetch failed',
            message: 'Unable to fetch models'
        });
    }
});

// Get specific model details
router.get('/:slug', authenticateToken, requireModelAccess, async (req, res) => {
    try {
        const modelId = req.model.id;

        // Get model details with site settings
        const modelDetails = await query(`
            SELECT m.*, ss.site_name, ss.model_name, ss.tagline, ss.city,
                   ss.contact_email, ss.contact_phone, ss.header_image,
                   ss.watermark_text, ss.watermark_image
            FROM models m
            LEFT JOIN site_settings ss ON m.id = ss.model_id
            WHERE m.id = ?
        `, [modelId]);

        if (modelDetails.length === 0) {
            return res.status(404).json({
                error: 'Model not found',
                message: 'Model does not exist'
            });
        }

        // Get model themes
        const themes = await query(`
            SELECT t.id, t.name, t.display_name, t.description, mt.is_active
            FROM themes t
            JOIN model_themes mt ON t.id = mt.theme_id
            WHERE mt.model_id = ?
        `, [modelId]);

        // Get gallery sections count
        const galleryStats = await query(`
            SELECT COUNT(*) as section_count,
                   (SELECT COUNT(*) FROM gallery_images WHERE model_id = ? AND is_active = true) as image_count
            FROM gallery_sections
            WHERE model_id = ? AND is_visible = true
        `, [modelId, modelId]);

        // Get FAQ count
        const faqStats = await query(`
            SELECT COUNT(*) as faq_count
            FROM faq_items
            WHERE model_id = ? AND is_visible = true
        `, [modelId]);

        // Get testimonials count
        const testimonialStats = await query(`
            SELECT COUNT(*) as testimonial_count
            FROM testimonials
            WHERE model_id = ? AND is_active = true
        `, [modelId]);

        const model = modelDetails[0];
        
        res.json({
            model: {
                ...model,
                themes: themes,
                stats: {
                    gallery_sections: galleryStats[0].section_count,
                    gallery_images: galleryStats[0].image_count,
                    faq_items: faqStats[0].faq_count,
                    testimonials: testimonialStats[0].testimonial_count
                }
            },
            access_role: req.modelAccess
        });

    } catch (error) {
        console.error('Model details fetch error:', error);
        res.status(500).json({
            error: 'Fetch failed',
            message: 'Unable to fetch model details'
        });
    }
});

// Update model basic information
router.put('/:slug', [
    authenticateToken,
    requireModelAccess,
    requireEditAccess,
    body('name')
        .optional()
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Name must be between 2 and 100 characters'),
    body('status')
        .optional()
        .isIn(['active', 'suspended', 'trial', 'inactive'])
        .withMessage('Invalid status')
], async (req, res) => {
    try {
        // Check validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                error: 'Validation failed',  
                message: 'Please check your input',
                details: errors.array()
            });
        }

        const modelId = req.model.id;
        const { name, status } = req.body;

        const updates = [];
        const values = [];

        if (name) {
            updates.push('name = ?');
            values.push(name);
        }

        if (status && req.modelAccess === 'owner') { // Only owners can change status
            updates.push('status = ?');
            values.push(status);
        }

        if (updates.length === 0) {
            return res.status(400).json({
                error: 'No updates provided',
                message: 'Please provide fields to update'
            });
        }

        updates.push('updated_at = NOW()');
        values.push(modelId);

        await query(`
            UPDATE models SET ${updates.join(', ')} WHERE id = ?
        `, values);

        res.json({
            message: 'Model updated successfully'
        });

    } catch (error) {
        console.error('Model update error:', error);
        res.status(500).json({
            error: 'Update failed',
            message: 'Unable to update model'
        });
    }
});

// Update site settings
router.put('/:slug/settings', [
    authenticateToken,
    requireModelAccess,
    requireEditAccess,
    body('site_name')
        .optional()
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Site name must be between 2 and 100 characters'),
    body('model_name')
        .optional()
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Model name must be between 2 and 100 characters'),
    body('tagline')
        .optional()
        .trim()
        .isLength({ max: 255 })
        .withMessage('Tagline must be 255 characters or less'),
    body('city')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('City must be 100 characters or less'),
    body('contact_email')
        .optional()
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email address'),
    body('contact_phone')
        .optional()
        .trim()
        .isLength({ max: 20 })
        .withMessage('Phone must be 20 characters or less')
], async (req, res) => {
    try {
        // Check validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                error: 'Validation failed',
                message: 'Please check your input',
                details: errors.array()
            });
        }

        const modelId = req.model.id;
        const {
            site_name,
            model_name,
            tagline,
            city,
            contact_email,
            contact_phone,
            watermark_text
        } = req.body;

        const updates = [];
        const values = [];

        if (site_name !== undefined) {
            updates.push('site_name = ?');
            values.push(site_name);
        }

        if (model_name !== undefined) {
            updates.push('model_name = ?');
            values.push(model_name);
        }

        if (tagline !== undefined) {
            updates.push('tagline = ?');
            values.push(tagline);
        }

        if (city !== undefined) {
            updates.push('city = ?');
            values.push(city);
        }

        if (contact_email !== undefined) {
            updates.push('contact_email = ?');
            values.push(contact_email);
        }

        if (contact_phone !== undefined) {
            updates.push('contact_phone = ?');
            values.push(contact_phone);
        }

        if (watermark_text !== undefined) {
            updates.push('watermark_text = ?');
            values.push(watermark_text);
        }

        if (updates.length === 0) {
            return res.status(400).json({
                error: 'No updates provided',
                message: 'Please provide fields to update'
            });
        }

        updates.push('updated_at = NOW()');
        values.push(modelId);

        // Check if settings exist
        const existingSettings = await query(
            'SELECT id FROM site_settings WHERE model_id = ?',
            [modelId]
        );

        if (existingSettings.length === 0) {
            // Create new settings
            const fields = ['model_id', ...updates.map(u => u.split(' = ')[0])];
            const placeholders = ['?', ...updates.map(() => '?')];
            const insertValues = [modelId, ...values.slice(0, -1)]; // Remove model_id from end

            await query(`
                INSERT INTO site_settings (${fields.join(', ')})
                VALUES (${placeholders.join(', ')})
            `, insertValues);
        } else {
            // Update existing settings
            await query(`
                UPDATE site_settings SET ${updates.join(', ')} WHERE model_id = ?
            `, values);
        }

        res.json({
            message: 'Settings updated successfully'
        });

    } catch (error) {
        console.error('Settings update error:', error);
        res.status(500).json({
            error: 'Update failed',
            message: 'Unable to update settings'
        });
    }
});

// Set model theme
router.post('/:slug/theme', [
    authenticateToken,
    requireModelAccess,
    requireEditAccess,
    body('theme_id')
        .isInt({ min: 1 })
        .withMessage('Valid theme ID is required')
], async (req, res) => {
    try {
        // Check validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                error: 'Validation failed',
                message: 'Please check your input',
                details: errors.array()
            });
        }

        const modelId = req.model.id;
        const { theme_id } = req.body;

        // Check if theme exists
        const themes = await query(
            'SELECT id FROM themes WHERE id = ? AND is_active = true',
            [theme_id]
        );

        if (themes.length === 0) {
            return res.status(404).json({
                error: 'Theme not found',
                message: 'The specified theme does not exist or is not active'
            });
        }

        // Deactivate all current themes for this model
        await query(
            'UPDATE model_themes SET is_active = false WHERE model_id = ?',
            [modelId]
        );

        // Check if relationship exists
        const existing = await query(
            'SELECT id FROM model_themes WHERE model_id = ? AND theme_id = ?',
            [modelId, theme_id]
        );

        if (existing.length > 0) {
            // Reactivate existing relationship
            await query(
                'UPDATE model_themes SET is_active = true, applied_at = NOW() WHERE model_id = ? AND theme_id = ?',
                [modelId, theme_id]
            );
        } else {
            // Create new relationship
            await query(
                'INSERT INTO model_themes (model_id, theme_id, is_active, applied_at) VALUES (?, ?, true, NOW())',
                [modelId, theme_id]
            );
        }

        res.json({
            message: 'Theme applied successfully'
        });

    } catch (error) {
        console.error('Theme application error:', error);
        res.status(500).json({
            error: 'Theme application failed',
            message: 'Unable to apply theme'
        });
    }
});

// Get available themes
router.get('/:slug/themes', authenticateToken, requireModelAccess, async (req, res) => {
    try {
        const modelId = req.model.id;

        // Get all available themes with current model selection
        const themes = await query(`
            SELECT t.id, t.name, t.display_name, t.description, t.is_active,
                   CASE WHEN mt.is_active = true THEN true ELSE false END as is_selected
            FROM themes t
            LEFT JOIN model_themes mt ON t.id = mt.theme_id AND mt.model_id = ?
            WHERE t.is_active = true
            ORDER BY t.name
        `, [modelId]);

        // Get theme colors for each theme
        for (let theme of themes) {
            const colors = await query(`
                SELECT color_type, color_value
                FROM theme_colors
                WHERE theme_id = ?
            `, [theme.id]);

            theme.colors = colors.reduce((acc, color) => {
                acc[color.color_type] = color.color_value;
                return acc;
            }, {});
        }

        res.json({
            themes: themes
        });

    } catch (error) {
        console.error('Themes fetch error:', error);
        res.status(500).json({
            error: 'Fetch failed',
            message: 'Unable to fetch themes'
        });
    }
});

// Delete model (owner only)
router.delete('/:slug', [
    authenticateToken,
    requireModelAccess,
    requireAdminAccess
], async (req, res) => {
    try {
        const modelId = req.model.id;

        // Only allow owners to delete
        if (req.modelAccess !== 'owner') {
            return res.status(403).json({
                error: 'Insufficient permissions',
                message: 'Only model owners can delete models'
            });
        }

        // Soft delete by setting status to inactive
        await query(
            'UPDATE models SET status = ?, updated_at = NOW() WHERE id = ?',
            ['inactive', modelId]
        );

        res.json({
            message: 'Model deleted successfully'
        });

    } catch (error) {
        console.error('Model deletion error:', error);
        res.status(500).json({
            error: 'Deletion failed',
            message: 'Unable to delete model'
        });
    }
});

module.exports = router;