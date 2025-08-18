const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const sharp = require('sharp');
const db = require('../config/database');
const { authenticateToken: auth } = require('../middleware/auth');

// Configure multer for image uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const modelSlug = req.user.slug;
        const uploadPath = path.join(__dirname, '..', 'public', 'uploads', modelSlug);
        
        try {
            await fs.mkdir(uploadPath, { recursive: true });
            cb(null, uploadPath);
        } catch (error) {
            cb(error);
        }
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('Only image files are allowed!'));
    }
};

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: fileFilter
});

// Get all gallery images for authenticated model
router.get('/images', auth, async (req, res) => {
    try {
        // Get the model ID - either from impersonation context or user's model
        let modelId;
        if (req.isImpersonating && req.impersonation) {
            modelId = req.impersonation.impersonated_model_id;
        } else {
            // Look up model ID for regular user
            const [userModel] = await db.execute(
                'SELECT model_id FROM model_users WHERE user_id = ? AND role = "owner" AND is_active = true',
                [req.user.id]
            );
            modelId = userModel.length > 0 ? userModel[0].model_id : null;
        }

        if (!modelId) {
            return res.status(404).json({
                success: false,
                message: 'No model found for user'
            });
        }

        const [rows] = await db.execute(`
            SELECT DISTINCT gi.*, gs.title as section_title, m.slug as model_slug,
                   cm.moderation_status
            FROM gallery_images gi
            LEFT JOIN gallery_sections gs ON gi.section_id = gs.id
            LEFT JOIN models m ON gi.model_id = m.id
            LEFT JOIN content_moderation cm ON cm.model_id = gi.model_id AND cm.original_path LIKE CONCAT('%', gi.filename)
            WHERE gi.model_id = ? 
            AND (cm.moderation_status = 'approved' OR cm.moderation_status IS NULL)
            AND gi.is_active = 1
            ORDER BY gi.section_id, gi.sort_order
        `, [modelId]);

        res.json({
            success: true,
            images: rows
        });
    } catch (error) {
        console.error('Error fetching gallery images:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch gallery images'
        });
    }
});

// Get gallery sections for authenticated model
router.get('/sections', auth, async (req, res) => {
    try {
        // Get the model ID - either from impersonation context or user's model
        let modelId;
        if (req.isImpersonating && req.impersonation) {
            modelId = req.impersonation.impersonated_model_id;
        } else {
            // Look up model ID for regular user
            const [userModel] = await db.execute(
                'SELECT model_id FROM model_users WHERE user_id = ? AND role = "owner" AND is_active = true',
                [req.user.id]
            );
            modelId = userModel.length > 0 ? userModel[0].model_id : null;
        }

        if (!modelId) {
            return res.status(404).json({
                success: false,
                message: 'No model found for user'
            });
        }

        const [sections] = await db.execute(`
            SELECT gs.*, COUNT(gi.id) as image_count
            FROM gallery_sections gs
            LEFT JOIN gallery_images gi ON gs.id = gi.section_id
            WHERE gs.model_id = ?
            GROUP BY gs.id
            ORDER BY gs.sort_order
        `, [modelId]);

        res.json({
            success: true,
            sections: sections
        });
    } catch (error) {
        console.error('Error fetching gallery sections:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch gallery sections'
        });
    }
});

// Upload new gallery image
router.post('/upload', auth, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No image file provided'
            });
        }

        const { caption, alt_text, section_id } = req.body;
        const filename = req.file.filename;
        const originalPath = req.file.path;

        // Create thumbnail
        const thumbsPath = path.join(path.dirname(originalPath), 'thumbs');
        await fs.mkdir(thumbsPath, { recursive: true });
        
        const thumbnailPath = path.join(thumbsPath, filename);
        await sharp(originalPath)
            .resize(300, 300, { fit: 'cover' })
            .jpeg({ quality: 80 })
            .toFile(thumbnailPath);

        // Get next sort order
        const [sortResult] = await db.execute(`
            SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order
            FROM gallery_images 
            WHERE model_id = ? AND section_id = ?
        `, [req.user.id, section_id || null]);

        const sortOrder = sortResult[0].next_order;

        // Insert into database
        const [result] = await db.execute(`
            INSERT INTO gallery_images (
                model_id, section_id, filename, caption, alt_text, 
                sort_order, is_featured, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, 0, NOW())
        `, [req.user.id, section_id || null, filename, caption || '', alt_text || '', sortOrder]);

        // Get the inserted image data
        const [imageRows] = await db.execute(`
            SELECT gi.*, gs.title as section_title 
            FROM gallery_images gi
            LEFT JOIN gallery_sections gs ON gi.section_id = gs.id
            WHERE gi.id = ?
        `, [result.insertId]);

        res.json({
            success: true,
            message: 'Image uploaded successfully',
            image: imageRows[0]
        });

    } catch (error) {
        console.error('Error uploading image:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to upload image'
        });
    }
});

// Update image details
router.put('/images/:id', auth, async (req, res) => {
    try {
        const imageId = req.params.id;
        const { caption, alt_text, section_id, is_featured } = req.body;

        // Verify image ownership
        const [ownershipCheck] = await db.execute(`
            SELECT id FROM gallery_images WHERE id = ? AND model_id = ?
        `, [imageId, req.user.id]);

        if (ownershipCheck.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Image not found'
            });
        }

        // Update image
        await db.execute(`
            UPDATE gallery_images 
            SET caption = ?, alt_text = ?, section_id = ?, is_featured = ?, updated_at = NOW()
            WHERE id = ? AND model_id = ?
        `, [caption || '', alt_text || '', section_id || null, is_featured ? 1 : 0, imageId, req.user.id]);

        // Get updated image data
        const [imageRows] = await db.execute(`
            SELECT gi.*, gs.title as section_title 
            FROM gallery_images gi
            LEFT JOIN gallery_sections gs ON gi.section_id = gs.id
            WHERE gi.id = ?
        `, [imageId]);

        res.json({
            success: true,
            message: 'Image updated successfully',
            image: imageRows[0]
        });

    } catch (error) {
        console.error('Error updating image:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update image'
        });
    }
});

// Reorder images
router.post('/reorder', auth, async (req, res) => {
    try {
        const { imageOrders } = req.body; // Array of {id, sort_order}

        if (!Array.isArray(imageOrders)) {
            return res.status(400).json({
                success: false,
                message: 'imageOrders must be an array'
            });
        }

        // Update sort orders in a transaction
        await db.execute('START TRANSACTION');

        for (const item of imageOrders) {
            await db.execute(`
                UPDATE gallery_images 
                SET sort_order = ? 
                WHERE id = ? AND model_id = ?
            `, [item.sort_order, item.id, req.user.id]);
        }

        await db.execute('COMMIT');

        res.json({
            success: true,
            message: 'Images reordered successfully'
        });

    } catch (error) {
        await db.execute('ROLLBACK');
        console.error('Error reordering images:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reorder images'
        });
    }
});

// Delete image
router.delete('/images/:id', auth, async (req, res) => {
    try {
        const imageId = req.params.id;

        // Get image data first
        const [imageRows] = await db.execute(`
            SELECT filename FROM gallery_images WHERE id = ? AND model_id = ?
        `, [imageId, req.user.id]);

        if (imageRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Image not found'
            });
        }

        const filename = imageRows[0].filename;

        // Delete from database
        await db.execute(`
            DELETE FROM gallery_images WHERE id = ? AND model_id = ?
        `, [imageId, req.user.id]);

        // Delete files
        const modelSlug = req.user.slug;
        const imagePath = path.join(__dirname, '..', 'public', 'uploads', modelSlug, filename);
        const thumbnailPath = path.join(__dirname, '..', 'public', 'uploads', modelSlug, 'thumbs', filename);

        try {
            await fs.unlink(imagePath);
            await fs.unlink(thumbnailPath);
        } catch (fileError) {
            console.warn('Could not delete files:', fileError.message);
        }

        res.json({
            success: true,
            message: 'Image deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting image:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete image'
        });
    }
});

// Create gallery section
router.post('/sections', auth, async (req, res) => {
    try {
        const { title, description } = req.body;

        if (!title || title.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Section title is required'
            });
        }

        // Get next sort order
        const [sortResult] = await db.execute(`
            SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order
            FROM gallery_sections WHERE model_id = ?
        `, [req.user.id]);

        const sortOrder = sortResult[0].next_order;

        // Insert section
        const [result] = await db.execute(`
            INSERT INTO gallery_sections (model_id, title, description, sort_order, created_at)
            VALUES (?, ?, ?, ?, NOW())
        `, [req.user.id, title.trim(), description || '', sortOrder]);

        // Get the inserted section
        const [sectionRows] = await db.execute(`
            SELECT gs.*, COUNT(gi.id) as image_count
            FROM gallery_sections gs
            LEFT JOIN gallery_images gi ON gs.id = gi.section_id
            WHERE gs.id = ?
            GROUP BY gs.id
        `, [result.insertId]);

        res.json({
            success: true,
            message: 'Gallery section created successfully',
            section: sectionRows[0]
        });

    } catch (error) {
        console.error('Error creating gallery section:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create gallery section'
        });
    }
});

// Update gallery section
router.put('/sections/:id', auth, async (req, res) => {
    try {
        const sectionId = req.params.id;
        const { title, description } = req.body;

        if (!title || title.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Section title is required'
            });
        }

        // Verify section ownership
        const [ownershipCheck] = await db.execute(`
            SELECT id FROM gallery_sections WHERE id = ? AND model_id = ?
        `, [sectionId, req.user.id]);

        if (ownershipCheck.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Gallery section not found'
            });
        }

        // Update section
        await db.execute(`
            UPDATE gallery_sections 
            SET title = ?, description = ?, updated_at = NOW()
            WHERE id = ? AND model_id = ?
        `, [title.trim(), description || '', sectionId, req.user.id]);

        // Get updated section
        const [sectionRows] = await db.execute(`
            SELECT gs.*, COUNT(gi.id) as image_count
            FROM gallery_sections gs
            LEFT JOIN gallery_images gi ON gs.id = gi.section_id
            WHERE gs.id = ?
            GROUP BY gs.id
        `, [sectionId]);

        res.json({
            success: true,
            message: 'Gallery section updated successfully',
            section: sectionRows[0]
        });

    } catch (error) {
        console.error('Error updating gallery section:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update gallery section'
        });
    }
});

// Delete gallery section
router.delete('/sections/:id', auth, async (req, res) => {
    try {
        const sectionId = req.params.id;

        // Verify section ownership
        const [ownershipCheck] = await db.execute(`
            SELECT id FROM gallery_sections WHERE id = ? AND model_id = ?
        `, [sectionId, req.user.id]);

        if (ownershipCheck.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Gallery section not found'
            });
        }

        // Move images to uncategorized (section_id = NULL)
        await db.execute(`
            UPDATE gallery_images SET section_id = NULL WHERE section_id = ? AND model_id = ?
        `, [sectionId, req.user.id]);

        // Delete section
        await db.execute(`
            DELETE FROM gallery_sections WHERE id = ? AND model_id = ?
        `, [sectionId, req.user.id]);

        res.json({
            success: true,
            message: 'Gallery section deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting gallery section:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete gallery section'
        });
    }
});

module.exports = router;