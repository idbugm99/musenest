const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const logger = require('../../utils/logger');
const multer = require('multer');
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

// Import existing services
const ContentModerationAPI = require('../../src/services/ContentModerationAPI');
const AdminWatermarkService = require('../../src/services/AdminWatermarkService');
const MediaUploadService = require('../../src/services/MediaUploadService');
const ImageProcessingService = require('../../src/services/ImageProcessingService');

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

// Helper function to generate secure filename
function generateSecureFilename(originalFilename) {
    const ext = path.extname(originalFilename || '').toLowerCase();
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const base = path.basename(originalFilename || 'upload', ext)
        .replace(/[^a-z0-9_-]+/gi, '_')
        .substring(0, 50);
    return `${timestamp}_${random}_${base}${ext}`;
}

// Multer configuration for media library uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        try {
            const { modelSlug } = req.params;
            const dest = path.join(process.cwd(), 'public', 'uploads', modelSlug, 'media-temp');
            await fs.mkdir(dest, { recursive: true });
            cb(null, dest);
        } catch (error) {
            logger.error('Multer destination error:', error);
            cb(error);
        }
    },
    filename: (req, file, cb) => {
        cb(null, generateSecureFilename(file.originalname));
    }
});

const upload = multer({ 
    storage, 
    limits: { 
        fileSize: 50 * 1024 * 1024, // 50MB max file size
        files: 20 // Max 20 files per upload
    },
    fileFilter: (req, file, cb) => {
        // Accept only image files
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'), false);
        }
    }
});

// ===================================
// MEDIA LIBRARY API ROUTES
// ===================================

// GET /api/model-media-library/:modelSlug
// List all media with pagination, filtering, and search
router.get('/:modelSlug', async (req, res) => {
    try {
        const { modelSlug } = req.params;
        const { 
            page = 1, 
            limit = 24, 
            search = '', 
            category = '', 
            status = 'approved',  // Default to approved images only
            sort = 'newest'
        } = req.query;

        const model = await getModelBySlug(modelSlug);
        if (!model) return res.status(404).json({ success: false, message: 'Model not found' });

        const perPage = Math.max(1, Math.min(100, parseInt(limit)));
        const currentPage = Math.max(1, parseInt(page));
        const offset = (currentPage - 1) * perPage;

        // Build query conditions
        const conditions = ['mml.model_slug = ?', 'mml.is_deleted = 0'];
        const params = [modelSlug];

        if (search) {
            conditions.push('(mml.original_filename LIKE ? OR mml.alt_text LIKE ? OR mml.caption LIKE ?)');
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        if (category && category !== 'all') {
            conditions.push('mml.category_id = ?');
            params.push(parseInt(category));
        }

        if (status && status !== 'all') {
            conditions.push('mml.moderation_status = ?');
            params.push(status);
        }

        // Sort options
        let orderBy = 'mml.upload_date DESC';
        switch (sort) {
            case 'oldest':
                orderBy = 'mml.upload_date ASC';
                break;
            case 'name':
                orderBy = 'mml.original_filename ASC';
                break;
            case 'size':
                orderBy = 'mml.file_size DESC';
                break;
            case 'newest':
            default:
                orderBy = 'mml.upload_date DESC';
                break;
        }

        const whereClause = conditions.join(' AND ');

        // Get total count
        const countQuery = `SELECT COUNT(*) as total FROM model_media_library mml WHERE ${whereClause}`;
        const countResult = await db.query(countQuery, params);
        const total = countResult[0]?.total || 0;

        // Get media items
        const query = `
            SELECT 
                mml.*,
                mmc.category_name,
                mmc.category_color,
                CONCAT('/uploads/', mml.model_slug, '/media/', mml.filename) as file_url,
                CONCAT('/uploads/', mml.model_slug, '/media/thumbs/', mml.filename) as thumbnail_url
            FROM model_media_library mml
            LEFT JOIN model_media_categories mmc ON mml.category_id = mmc.id
            WHERE ${whereClause}
            ORDER BY ${orderBy}
            LIMIT ? OFFSET ?
        `;

        params.push(perPage, offset);
        const media = await db.query(query, params);

        // Calculate pagination
        const totalPages = Math.ceil(total / perPage);
        const hasNext = currentPage < totalPages;
        const hasPrev = currentPage > 1;

        res.json({
            success: true,
            media: media || [],
            pagination: {
                total,
                page: currentPage,
                pages: totalPages,
                limit: perPage,
                hasNext,
                hasPrev
            }
        });

    } catch (error) {
        logger.error('Error loading media library:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load media library'
        });
    }
});

// POST /api/model-media-library/:modelSlug/upload
// Upload multiple files with watermark and moderation integration using MediaUploadService
router.post('/:modelSlug/upload', upload.array('files'), async (req, res) => {
    try {
        const { modelSlug } = req.params;
        const { 
            apply_watermark = 'true', 
            category_id = null,
            usage_intent = 'public_site',
            context_type = 'media_library',
            title = null,
            description = null
        } = req.body;
        const files = req.files || [];

        if (files.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No files provided'
            });
        }

        // Initialize MediaUploadService
        const uploadService = new MediaUploadService(db);
        const initResult = await uploadService.initialize();
        
        if (!initResult.success) {
            return res.status(500).json({
                success: false,
                message: 'Upload service initialization failed',
                error: initResult.error
            });
        }

        // Process upload using MediaUploadService
        const uploadResult = await uploadService.uploadFiles(files, {
            modelSlug,
            categoryId: category_id,
            applyWatermark: apply_watermark === 'true' || apply_watermark === '1',
            usageIntent: usage_intent,
            contextType: context_type,
            title,
            description
        });

        // Format response to match expected API format
        const successful = uploadResult.results.filter(r => r.success);
        const failed = uploadResult.results.filter(r => !r.success);

        const response = {
            success: uploadResult.success,
            message: uploadResult.message,
            uploaded: successful.map(r => ({
                id: r.mediaId,
                filename: r.filename,
                original_filename: r.originalFilename,
                file_url: r.fileUrl,
                thumbnail_url: r.thumbnailUrl,
                moderation_status: r.moderationStatus,
                processing_status: 'completed',
                watermark_applied: r.watermarkApplied,
                dimensions: r.dimensions,
                file_size: r.fileSize,
                processing_time: r.processingTime
            })),
            failed: failed.length > 0 ? failed.map(r => ({
                filename: r.originalFilename,
                error: r.error,
                processing_stage: r.processingStage || 'unknown'
            })) : undefined,
            summary: {
                total: uploadResult.totalFiles,
                successful: uploadResult.successfulUploads,
                failed: uploadResult.failedUploads
            }
        };

        res.json(response);

    } catch (error) {
        logger.error('Media upload error:', error);
        res.status(500).json({
            success: false,
            message: 'Upload failed',
            error: error.message
        });
    }
});

// ===================================
// MEDIA CATEGORIES API
// ===================================

// GET /api/model-media-library/:modelSlug/categories
router.get('/:modelSlug/categories', async (req, res) => {
    try {
        const { modelSlug } = req.params;

        const model = await getModelBySlug(modelSlug);
        if (!model) return res.status(404).json({ success: false, message: 'Model not found' });

        const query = `
            SELECT 
                id, category_name, category_slug, category_description, 
                category_color, category_order,
                (SELECT COUNT(*) FROM model_media_library WHERE category_id = mmc.id AND is_deleted = 0) as media_count
            FROM model_media_categories mmc
            WHERE model_slug = ? AND is_active = 1
            ORDER BY category_order ASC, category_name ASC
        `;

        const categories = await db.query(query, [modelSlug]);

        res.json({
            success: true,
            categories: categories || []
        });

    } catch (error) {
        logger.error('Error fetching categories:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch categories'
        });
    }
});

// POST /api/model-media-library/:modelSlug/categories
router.post('/:modelSlug/categories', async (req, res) => {
    try {
        const { modelSlug } = req.params;
        const { category_name, category_description = '', category_color = '#007bff' } = req.body;

        if (!category_name || category_name.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Category name is required'
            });
        }

        const model = await getModelBySlug(modelSlug);
        if (!model) return res.status(404).json({ success: false, message: 'Model not found' });

        // Generate slug
        const category_slug = category_name.toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .substring(0, 50);

        // Check for duplicate
        const existingQuery = 'SELECT id FROM model_media_categories WHERE model_slug = ? AND (category_name = ? OR category_slug = ?)';
        const existing = await db.query(existingQuery, [modelSlug, category_name.trim(), category_slug]);

        if (existing && existing.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Category name already exists'
            });
        }

        // Get next order
        const orderQuery = 'SELECT COALESCE(MAX(category_order), 0) + 1 as next_order FROM model_media_categories WHERE model_slug = ?';
        const orderResult = await db.query(orderQuery, [modelSlug]);
        const nextOrder = orderResult[0]?.next_order || 1;

        // Insert category
        const insertQuery = `
            INSERT INTO model_media_categories (
                model_slug, category_name, category_slug, 
                category_description, category_color, category_order
            ) VALUES (?, ?, ?, ?, ?, ?)
        `;

        const result = await db.query(insertQuery, [
            modelSlug, 
            category_name.trim(), 
            category_slug, 
            category_description.trim(), 
            category_color, 
            nextOrder
        ]);

        res.json({
            success: true,
            message: 'Category created successfully',
            category: {
                id: result.insertId,
                category_name: category_name.trim(),
                category_slug,
                category_description: category_description.trim(),
                category_color,
                category_order: nextOrder
            }
        });

    } catch (error) {
        logger.error('Error creating category:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create category'
        });
    }
});

// GET /api/model-media-library/:modelSlug/:mediaId
// Get specific media item details
router.get('/:modelSlug/:mediaId', async (req, res) => {
    try {
        const { modelSlug, mediaId } = req.params;

        const model = await getModelBySlug(modelSlug);
        if (!model) return res.status(404).json({ success: false, message: 'Model not found' });

        const query = `
            SELECT 
                mml.*,
                mmc.category_name,
                mmc.category_color,
                CONCAT('/uploads/', mml.model_slug, '/media/', mml.filename) as file_url,
                CONCAT('/uploads/', mml.model_slug, '/media/thumbs/', mml.filename) as thumbnail_url
            FROM model_media_library mml
            LEFT JOIN model_media_categories mmc ON mml.category_id = mmc.id
            WHERE mml.id = ? AND mml.model_slug = ? AND mml.is_deleted = 0
        `;

        const media = await db.query(query, [mediaId, modelSlug]);

        if (!media || media.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Media not found'
            });
        }

        res.json({
            success: true,
            media: media[0]
        });

    } catch (error) {
        logger.error('Error fetching media details:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch media details'
        });
    }
});

// DELETE /api/model-media-library/:modelSlug/:mediaId
// Soft delete media item
router.delete('/:modelSlug/:mediaId', async (req, res) => {
    try {
        const { modelSlug, mediaId } = req.params;

        const model = await getModelBySlug(modelSlug);
        if (!model) return res.status(404).json({ success: false, message: 'Model not found' });

        // Check if media exists
        const checkQuery = 'SELECT id, filename FROM model_media_library WHERE id = ? AND model_slug = ? AND is_deleted = 0';
        const media = await db.query(checkQuery, [mediaId, modelSlug]);

        if (!media || media.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Media not found'
            });
        }

        // Soft delete (mark as deleted)
        const deleteQuery = 'UPDATE model_media_library SET is_deleted = 1, last_modified = CURRENT_TIMESTAMP WHERE id = ? AND model_slug = ?';
        await db.query(deleteQuery, [mediaId, modelSlug]);

        // Remove from all gallery sections
        await db.query('DELETE FROM model_gallery_section_media WHERE media_id = ?', [mediaId]);

        res.json({
            success: true,
            message: 'Media deleted successfully'
        });

    } catch (error) {
        logger.error('Error deleting media:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete media'
        });
    }
});

// ===================================
// IMAGE PROCESSING API ROUTES
// ===================================

// POST /api/model-media-library/:modelSlug/:mediaId/crop
// Crop image to specified dimensions
router.post('/:modelSlug/:mediaId/crop', async (req, res) => {
    try {
        const { modelSlug, mediaId } = req.params;
        const { x, y, width, height, output_format = 'jpeg', quality = null } = req.body;

        // Validate required parameters
        if (typeof x !== 'number' || typeof y !== 'number' || typeof width !== 'number' || typeof height !== 'number') {
            return res.status(400).json({
                success: false,
                message: 'Invalid crop parameters. x, y, width, and height must be numbers.'
            });
        }

        // Verify model exists
        const model = await getModelBySlug(modelSlug);
        if (!model) return res.status(404).json({ success: false, message: 'Model not found' });

        // Initialize and process image
        const imageProcessor = new ImageProcessingService(db);
        const initResult = await imageProcessor.initialize();
        
        if (!initResult.success) {
            return res.status(500).json({
                success: false,
                message: 'Image processing service initialization failed',
                error: initResult.error
            });
        }

        // Perform crop operation
        const cropResult = await imageProcessor.cropImage(mediaId, {
            x, y, width, height, outputFormat: output_format, quality
        });

        if (cropResult.success) {
            res.json({
                success: true,
                message: 'Image cropped successfully',
                result: cropResult
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'Crop operation failed',
                error: cropResult.error
            });
        }

    } catch (error) {
        logger.error('Crop operation error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error during crop operation',
            error: error.message
        });
    }
});

// POST /api/model-media-library/:modelSlug/:mediaId/rotate
// Rotate image by specified angle
router.post('/:modelSlug/:mediaId/rotate', async (req, res) => {
    try {
        const { modelSlug, mediaId } = req.params;
        const { angle, output_format = 'jpeg', quality = null } = req.body;

        // Validate required parameters
        if (typeof angle !== 'number') {
            return res.status(400).json({
                success: false,
                message: 'Invalid rotation angle. Must be a number.'
            });
        }

        // Verify model exists
        const model = await getModelBySlug(modelSlug);
        if (!model) return res.status(404).json({ success: false, message: 'Model not found' });

        // Initialize and process image
        const imageProcessor = new ImageProcessingService(db);
        const initResult = await imageProcessor.initialize();
        
        if (!initResult.success) {
            return res.status(500).json({
                success: false,
                message: 'Image processing service initialization failed',
                error: initResult.error
            });
        }

        // Perform rotation operation
        const rotateResult = await imageProcessor.rotateImage(mediaId, {
            angle, outputFormat: output_format, quality
        });

        if (rotateResult.success) {
            res.json({
                success: true,
                message: 'Image rotated successfully',
                result: rotateResult
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'Rotation operation failed',
                error: rotateResult.error
            });
        }

    } catch (error) {
        logger.error('Rotation operation error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error during rotation operation',
            error: error.message
        });
    }
});

// POST /api/model-media-library/:modelSlug/:mediaId/resize
// Resize image to specified dimensions
router.post('/:modelSlug/:mediaId/resize', async (req, res) => {
    try {
        const { modelSlug, mediaId } = req.params;
        const { 
            width, 
            height, 
            fit = 'cover', 
            position = 'center', 
            background = { r: 255, g: 255, b: 255 },
            output_format = 'jpeg', 
            quality = null 
        } = req.body;

        // Validate required parameters
        if (typeof width !== 'number' || typeof height !== 'number') {
            return res.status(400).json({
                success: false,
                message: 'Invalid dimensions. width and height must be numbers.'
            });
        }

        // Verify model exists
        const model = await getModelBySlug(modelSlug);
        if (!model) return res.status(404).json({ success: false, message: 'Model not found' });

        // Initialize and process image
        const imageProcessor = new ImageProcessingService(db);
        const initResult = await imageProcessor.initialize();
        
        if (!initResult.success) {
            return res.status(500).json({
                success: false,
                message: 'Image processing service initialization failed',
                error: initResult.error
            });
        }

        // Perform resize operation
        const resizeResult = await imageProcessor.resizeImage(mediaId, {
            width, height, fit, position, background, outputFormat: output_format, quality
        });

        if (resizeResult.success) {
            res.json({
                success: true,
                message: 'Image resized successfully',
                result: resizeResult
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'Resize operation failed',
                error: resizeResult.error
            });
        }

    } catch (error) {
        logger.error('Resize operation error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error during resize operation',
            error: error.message
        });
    }
});

// POST /api/model-media-library/:modelSlug/:mediaId/filter
// Apply filters to image
router.post('/:modelSlug/:mediaId/filter', async (req, res) => {
    try {
        const { modelSlug, mediaId } = req.params;
        const { 
            brightness = 1.0,
            contrast = 1.0,
            saturation = 1.0,
            blur = 0,
            sharpen = 0,
            gamma = 1.0,
            output_format = 'jpeg',
            quality = null 
        } = req.body;

        // Verify model exists
        const model = await getModelBySlug(modelSlug);
        if (!model) return res.status(404).json({ success: false, message: 'Model not found' });

        // Initialize and process image
        const imageProcessor = new ImageProcessingService(db);
        const initResult = await imageProcessor.initialize();
        
        if (!initResult.success) {
            return res.status(500).json({
                success: false,
                message: 'Image processing service initialization failed',
                error: initResult.error
            });
        }

        // Perform filter operation
        const filterResult = await imageProcessor.applyFilters(mediaId, {
            brightness, contrast, saturation, blur, sharpen, gamma, outputFormat: output_format, quality
        });

        if (filterResult.success) {
            res.json({
                success: true,
                message: 'Filters applied successfully',
                result: filterResult
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'Filter operation failed',
                error: filterResult.error
            });
        }

    } catch (error) {
        logger.error('Filter operation error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error during filter operation',
            error: error.message
        });
    }
});

// GET /api/model-media-library/:modelSlug/:mediaId/history
// Get edit history for a media item
router.get('/:modelSlug/:mediaId/history', async (req, res) => {
    try {
        const { modelSlug, mediaId } = req.params;

        // Verify model exists
        const model = await getModelBySlug(modelSlug);
        if (!model) return res.status(404).json({ success: false, message: 'Model not found' });

        // Initialize image processor
        const imageProcessor = new ImageProcessingService(db);
        const initResult = await imageProcessor.initialize();
        
        if (!initResult.success) {
            return res.status(500).json({
                success: false,
                message: 'Image processing service initialization failed',
                error: initResult.error
            });
        }

        // Get edit history
        const historyResult = await imageProcessor.getEditHistory(mediaId);

        if (historyResult.success) {
            res.json({
                success: true,
                history: historyResult.history
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve edit history',
                error: historyResult.error
            });
        }

    } catch (error) {
        logger.error('Edit history retrieval error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error retrieving edit history',
            error: error.message
        });
    }
});

module.exports = router;