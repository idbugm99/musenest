const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const logger = require('../../utils/logger');

// Helper function to resolve model by slug
async function getModelBySlug(slug) {
    try {
        const rows = await db.query('SELECT id, slug, name FROM models WHERE slug = ? LIMIT 1', [slug]);
        return rows && rows[0] ? rows[0] : null;
    } catch (error) {
        logger.error('Error fetching model by slug:', error);
        return null;
    }
}

// Helper function to generate section slug
function generateSectionSlug(sectionName) {
    return sectionName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 100);
}

// Default layout settings for different layout types
const defaultLayoutSettings = {
    grid: {
        columns: 3,
        spacing: 20,
        aspectRatio: 'auto',
        enableLightbox: true,
        hoverEffect: 'zoom',
        showCaptions: true
    },
    masonry: {
        columns: 4,
        spacing: 15,
        enableLightbox: true,
        hoverEffect: 'fade',
        showCaptions: true,
        columnWidth: 'auto'
    },
    carousel: {
        autoplay: true,
        autoplayDelay: 5000,
        showNavigation: true,
        showDots: true,
        transitionEffect: 'slide',
        infiniteLoop: true,
        pauseOnHover: true
    },
    lightbox_grid: {
        thumbnailSize: 'small',
        columns: 6,
        spacing: 10,
        showCaptions: false,
        hoverEffect: 'brightness'
    }
};

// ===================================
// GALLERY SECTIONS API ROUTES
// ===================================

// GET /api/model-gallery-sections/:modelSlug
// List all gallery sections for a model
router.get('/:modelSlug', async (req, res) => {
    try {
        const { modelSlug } = req.params;
        const { page = 1, limit = 20, search = '' } = req.query;

        const model = await getModelBySlug(modelSlug);
        if (!model) return res.status(404).json({ success: false, message: 'Model not found' });

        const perPage = Math.max(1, Math.min(100, parseInt(limit)));
        const currentPage = Math.max(1, parseInt(page));
        const offset = (currentPage - 1) * perPage;

        // Build query conditions - use gallery_sections table instead
        const conditions = ['gs.model_id = (SELECT id FROM models WHERE slug = ?)'];
        const params = [modelSlug];

        if (search) {
            conditions.push('(gs.title LIKE ? OR gs.description LIKE ?)');
            params.push(`%${search}%`, `%${search}%`);
        }

        const whereClause = conditions.join(' AND ');

        // Get total count
        const countQuery = `SELECT COUNT(*) as total FROM gallery_sections gs WHERE ${whereClause}`;
        const countResult = await db.query(countQuery, params);
        const total = countResult[0]?.total || 0;

        // Get sections with image count
        const query = `
            SELECT 
                gs.id,
                gs.title as section_name,
                gs.description as section_description,
                gs.layout_type,
                gs.sort_order as section_order,
                gs.is_visible as is_published,
                gs.created_at as created_date,
                COUNT(gi.id) as media_count
            FROM gallery_sections gs
            LEFT JOIN gallery_images gi ON gs.id = gi.section_id AND gi.is_active = 1
            WHERE ${whereClause}
            GROUP BY gs.id
            ORDER BY gs.sort_order ASC, gs.created_at DESC
            LIMIT ? OFFSET ?
        `;

        params.push(perPage, offset);
        const sections = await db.query(query, params);

        // Format sections to match frontend expectations
        const formattedSections = sections.map(section => ({
            id: section.id,
            title: section.section_name,
            description: section.section_description,
            layout_type: section.layout_type,
            sort_order: section.section_order,
            is_visible: section.is_published,
            created_at: section.created_date,
            image_count: section.media_count,
            // Add layout settings if needed
            layout_settings: defaultLayoutSettings[section.layout_type] || {}
        }));

        // Calculate pagination
        const totalPages = Math.ceil(total / perPage);

        res.json({
            success: true,
            sections: formattedSections,
            pagination: {
                total,
                page: currentPage,
                pages: totalPages,
                limit: perPage,
                hasNext: currentPage < totalPages,
                hasPrev: currentPage > 1
            }
        });

    } catch (error) {
        logger.error('Error fetching gallery sections:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch gallery sections'
        });
    }
});

// POST /api/model-gallery-sections/:modelSlug
// Create new gallery section
router.post('/:modelSlug', async (req, res) => {
    try {
        const { modelSlug } = req.params;
        const { 
            section_name, 
            section_description = '', 
            layout_type, 
            layout_settings = null,
            is_published = 1,
            is_featured = 0,
            requires_authentication = 0,
            password_protected = 0,
            section_password = null
        } = req.body;

        // Validation
        if (!section_name || section_name.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Section name is required'
            });
        }

        const validLayoutTypes = ['grid', 'masonry', 'carousel', 'lightbox_grid'];
        if (!validLayoutTypes.includes(layout_type)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid layout type'
            });
        }

        const model = await getModelBySlug(modelSlug);
        if (!model) return res.status(404).json({ success: false, message: 'Model not found' });

        // Generate unique section slug
        const baseSlug = generateSectionSlug(section_name);
        let sectionSlug = baseSlug;
        let counter = 1;

        // Check for duplicate slugs
        while (true) {
            const existingQuery = 'SELECT id FROM model_gallery_sections WHERE model_slug = ? AND section_slug = ?';
            const existing = await db.query(existingQuery, [modelSlug, sectionSlug]);
            
            if (!existing || existing.length === 0) break;
            
            sectionSlug = `${baseSlug}-${counter}`;
            counter++;
        }

        // Get next section order
        const orderQuery = 'SELECT COALESCE(MAX(section_order), 0) + 1 as next_order FROM model_gallery_sections WHERE model_slug = ?';
        const orderResult = await db.query(orderQuery, [modelSlug]);
        const nextOrder = orderResult[0]?.next_order || 1;

        // Prepare layout settings
        let finalLayoutSettings = layout_settings;
        if (!finalLayoutSettings || Object.keys(finalLayoutSettings).length === 0) {
            finalLayoutSettings = defaultLayoutSettings[layout_type] || {};
        }

        // Insert section
        const insertQuery = `
            INSERT INTO model_gallery_sections (
                model_slug, section_name, section_slug, section_description,
                layout_type, layout_settings, section_order, is_published,
                is_featured, requires_authentication, password_protected, section_password
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const insertParams = [
            modelSlug,
            section_name.trim(),
            sectionSlug,
            section_description.trim(),
            layout_type,
            JSON.stringify(finalLayoutSettings),
            nextOrder,
            is_published ? 1 : 0,
            is_featured ? 1 : 0,
            requires_authentication ? 1 : 0,
            password_protected ? 1 : 0,
            section_password
        ];

        const result = await db.query(insertQuery, insertParams);

        res.json({
            success: true,
            message: 'Gallery section created successfully',
            section: {
                id: result.insertId,
                model_slug: modelSlug,
                section_name: section_name.trim(),
                section_slug: sectionSlug,
                section_description: section_description.trim(),
                layout_type,
                layout_settings: finalLayoutSettings,
                section_order: nextOrder,
                is_published: is_published ? 1 : 0,
                is_featured: is_featured ? 1 : 0,
                media_count: 0
            }
        });

    } catch (error) {
        logger.error('Error creating gallery section:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create gallery section'
        });
    }
});

// GET /api/model-gallery-sections/:modelSlug/:sectionId
// Get specific gallery section with its media
router.get('/:modelSlug/:sectionId', async (req, res) => {
    try {
        const { modelSlug, sectionId } = req.params;
        const { include_media = 'true' } = req.query;

        const model = await getModelBySlug(modelSlug);
        if (!model) return res.status(404).json({ success: false, message: 'Model not found' });

        // Get section details
        const sectionQuery = `
            SELECT * FROM model_gallery_sections 
            WHERE id = ? AND model_slug = ?
        `;
        const sections = await db.query(sectionQuery, [sectionId, modelSlug]);

        if (!sections || sections.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Gallery section not found'
            });
        }

        const section = {
            ...sections[0],
            layout_settings: sections[0].layout_settings && typeof sections[0].layout_settings === 'object'
                ? sections[0].layout_settings 
                : sections[0].layout_settings 
                    ? JSON.parse(sections[0].layout_settings) 
                    : {}
        };

        // Get section media if requested
        if (include_media === 'true') {
            const mediaQuery = `
                SELECT 
                    mml.id,
                    mml.filename,
                    mml.original_filename,
                    mml.image_width,
                    mml.image_height,
                    mml.moderation_status,
                    mgsm.display_order,
                    mgsm.custom_caption,
                    mgsm.custom_alt_text,
                    mgsm.is_featured as section_featured,
                    mgsm.is_cover_image,
                    mgsm.display_settings,
                    CONCAT('/uploads/', mml.model_slug, '/media/', mml.filename) as file_url,
                    CONCAT('/uploads/', mml.model_slug, '/media/thumbs/', mml.filename) as thumbnail_url,
                    mmc.category_name,
                    mmc.category_color
                FROM model_gallery_section_media mgsm
                JOIN model_media_library mml ON mgsm.media_id = mml.id
                LEFT JOIN model_media_categories mmc ON mml.category_id = mmc.id
                WHERE mgsm.section_id = ? AND mml.is_deleted = 0 AND mml.moderation_status = 'approved'
                ORDER BY mgsm.display_order ASC, mgsm.added_date ASC
            `;
            const media = await db.query(mediaQuery, [sectionId]);

            section.media = media.map(item => ({
                ...item,
                display_settings: item.display_settings ? JSON.parse(item.display_settings) : {}
            }));
        }

        res.json({
            success: true,
            section
        });

    } catch (error) {
        logger.error('Error fetching gallery section:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch gallery section'
        });
    }
});

// PUT /api/model-gallery-sections/:modelSlug/:sectionId
// Update gallery section
router.put('/:modelSlug/:sectionId', async (req, res) => {
    try {
        const { modelSlug, sectionId } = req.params;
        const updates = req.body;

        const model = await getModelBySlug(modelSlug);
        if (!model) return res.status(404).json({ success: false, message: 'Model not found' });

        // Check if section exists
        const checkQuery = 'SELECT id FROM model_gallery_sections WHERE id = ? AND model_slug = ?';
        const existing = await db.query(checkQuery, [sectionId, modelSlug]);

        if (!existing || existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Gallery section not found'
            });
        }

        // Build update query
        const allowedFields = [
            'section_name', 'section_description', 'layout_type', 
            'layout_settings', 'section_order', 'is_published',
            'is_featured', 'requires_authentication', 'password_protected', 
            'section_password'
        ];

        const updateFields = [];
        const updateParams = [];

        for (const [field, value] of Object.entries(updates)) {
            if (allowedFields.includes(field) && value !== undefined) {
                if (field === 'layout_settings' && typeof value === 'object') {
                    updateFields.push(`${field} = ?`);
                    updateParams.push(JSON.stringify(value));
                } else if (field === 'section_name' && value) {
                    // Update slug if name changes
                    const newSlug = generateSectionSlug(value);
                    updateFields.push(`${field} = ?, section_slug = ?`);
                    updateParams.push(value.trim(), newSlug);
                } else {
                    updateFields.push(`${field} = ?`);
                    updateParams.push(value);
                }
            }
        }

        if (updateFields.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No valid fields to update'
            });
        }

        updateFields.push('modified_date = CURRENT_TIMESTAMP');
        updateParams.push(sectionId, modelSlug);

        const updateQuery = `
            UPDATE model_gallery_sections 
            SET ${updateFields.join(', ')} 
            WHERE id = ? AND model_slug = ?
        `;

        await db.query(updateQuery, updateParams);

        res.json({
            success: true,
            message: 'Gallery section updated successfully'
        });

    } catch (error) {
        logger.error('Error updating gallery section:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update gallery section'
        });
    }
});

// DELETE /api/model-gallery-sections/:modelSlug/:sectionId
// Delete gallery section
router.delete('/:modelSlug/:sectionId', async (req, res) => {
    try {
        const { modelSlug, sectionId } = req.params;

        const model = await getModelBySlug(modelSlug);
        if (!model) return res.status(404).json({ success: false, message: 'Model not found' });

        // Check if section exists
        const checkQuery = 'SELECT id FROM model_gallery_sections WHERE id = ? AND model_slug = ?';
        const existing = await db.query(checkQuery, [sectionId, modelSlug]);

        if (!existing || existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Gallery section not found'
            });
        }

        // Delete section (cascade will remove media assignments)
        const deleteQuery = 'DELETE FROM model_gallery_sections WHERE id = ? AND model_slug = ?';
        await db.query(deleteQuery, [sectionId, modelSlug]);

        res.json({
            success: true,
            message: 'Gallery section deleted successfully'
        });

    } catch (error) {
        logger.error('Error deleting gallery section:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete gallery section'
        });
    }
});

// ===================================
// SECTION MEDIA MANAGEMENT
// ===================================

// POST /api/model-gallery-sections/:modelSlug/:sectionId/media
// Add media to gallery section
router.post('/:modelSlug/:sectionId/media', async (req, res) => {
    try {
        const { modelSlug, sectionId } = req.params;
        const { media_ids = [], custom_caption = null, is_featured = 0, is_cover_image = 0 } = req.body;

        if (!Array.isArray(media_ids) || media_ids.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Media IDs are required'
            });
        }

        const model = await getModelBySlug(modelSlug);
        if (!model) return res.status(404).json({ success: false, message: 'Model not found' });

        // Check if section exists
        const sectionCheck = await db.query(
            'SELECT id FROM model_gallery_sections WHERE id = ? AND model_slug = ?',
            [sectionId, modelSlug]
        );

        if (!sectionCheck || sectionCheck.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Gallery section not found'
            });
        }

        const addedMedia = [];
        const errors = [];

        for (const mediaId of media_ids) {
            try {
                // Check if media exists and belongs to this model
                const mediaCheck = await db.query(
                    'SELECT id FROM model_media_library WHERE id = ? AND model_slug = ? AND is_deleted = 0',
                    [mediaId, modelSlug]
                );

                if (!mediaCheck || mediaCheck.length === 0) {
                    errors.push({ media_id: mediaId, error: 'Media not found' });
                    continue;
                }

                // Check if already in this section
                const existingCheck = await db.query(
                    'SELECT id FROM model_gallery_section_media WHERE section_id = ? AND media_id = ?',
                    [sectionId, mediaId]
                );

                if (existingCheck && existingCheck.length > 0) {
                    errors.push({ media_id: mediaId, error: 'Already in section' });
                    continue;
                }

                // Get next display order
                const orderQuery = 'SELECT COALESCE(MAX(display_order), 0) + 1 as next_order FROM model_gallery_section_media WHERE section_id = ?';
                const orderResult = await db.query(orderQuery, [sectionId]);
                const nextOrder = orderResult[0]?.next_order || 1;

                // Add to section
                const insertQuery = `
                    INSERT INTO model_gallery_section_media (
                        section_id, media_id, display_order, custom_caption, 
                        is_featured, is_cover_image
                    ) VALUES (?, ?, ?, ?, ?, ?)
                `;

                await db.query(insertQuery, [
                    sectionId, 
                    mediaId, 
                    nextOrder, 
                    custom_caption, 
                    is_featured ? 1 : 0, 
                    is_cover_image ? 1 : 0
                ]);

                addedMedia.push({ media_id: mediaId, display_order: nextOrder });

            } catch (mediaError) {
                logger.error(`Error adding media ${mediaId} to section:`, mediaError);
                errors.push({ media_id: mediaId, error: 'Database error' });
            }
        }

        res.json({
            success: addedMedia.length > 0,
            message: `${addedMedia.length} media items added to section${errors.length > 0 ? `, ${errors.length} failed` : ''}`,
            added: addedMedia,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error) {
        logger.error('Error adding media to section:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add media to section'
        });
    }
});

// DELETE /api/model-gallery-sections/:modelSlug/:sectionId/media/:mediaId
// Remove media from gallery section
router.delete('/:modelSlug/:sectionId/media/:mediaId', async (req, res) => {
    try {
        const { modelSlug, sectionId, mediaId } = req.params;

        const model = await getModelBySlug(modelSlug);
        if (!model) return res.status(404).json({ success: false, message: 'Model not found' });

        // Remove from section
        const deleteQuery = `
            DELETE mgsm FROM model_gallery_section_media mgsm
            JOIN model_gallery_sections mgs ON mgsm.section_id = mgs.id
            WHERE mgsm.section_id = ? AND mgsm.media_id = ? AND mgs.model_slug = ?
        `;

        const result = await db.query(deleteQuery, [sectionId, mediaId, modelSlug]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Media not found in this section'
            });
        }

        res.json({
            success: true,
            message: 'Media removed from section successfully'
        });

    } catch (error) {
        logger.error('Error removing media from section:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to remove media from section'
        });
    }
});

// PUT /api/model-gallery-sections/:modelSlug/:sectionId/reorder
// Reorder media within a section
router.put('/:modelSlug/:sectionId/reorder', async (req, res) => {
    try {
        const { modelSlug, sectionId } = req.params;
        const { media_order = [] } = req.body; // Array of {media_id, display_order} objects

        if (!Array.isArray(media_order) || media_order.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Media order array is required'
            });
        }

        const model = await getModelBySlug(modelSlug);
        if (!model) return res.status(404).json({ success: false, message: 'Model not found' });

        // Update display orders
        for (const item of media_order) {
            const { media_id, display_order } = item;
            
            if (!media_id || display_order === undefined) continue;

            const updateQuery = `
                UPDATE model_gallery_section_media mgsm
                JOIN model_gallery_sections mgs ON mgsm.section_id = mgs.id
                SET mgsm.display_order = ?
                WHERE mgsm.section_id = ? AND mgsm.media_id = ? AND mgs.model_slug = ?
            `;

            await db.query(updateQuery, [display_order, sectionId, media_id, modelSlug]);
        }

        res.json({
            success: true,
            message: 'Media order updated successfully'
        });

    } catch (error) {
        logger.error('Error reordering section media:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reorder media'
        });
    }
});

module.exports = router;