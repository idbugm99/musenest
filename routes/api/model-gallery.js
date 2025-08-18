const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const logger = require('../../utils/logger');
const { analytics } = require('../../utils/gallery-picker-analytics');
const multer = require('multer');
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Resolve model id from slug helper
async function getModelBySlug(slug) {
  const rows = await db.query('SELECT id, slug, name FROM models WHERE slug = ? LIMIT 1', [slug]);
  return rows && rows[0] ? rows[0] : null;
}

// Multer storage to /public/uploads/:slug/originals
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const { modelSlug } = req.params;
      const dest = path.join(process.cwd(), 'public', 'uploads', modelSlug, 'originals');
      await fs.mkdir(dest, { recursive: true });
      cb(null, dest);
    } catch (e) {
      cb(e);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const base = path.basename(file.originalname || 'upload', ext).replace(/[^a-z0-9_-]+/gi, '_');
    cb(null, `${base}_${Date.now()}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 15 * 1024 * 1024 } });

// GET /api/model-gallery/:modelSlug/sections
router.get('/:modelSlug/sections', async (req, res) => {
  try {
    const { modelSlug } = req.params;
    const { page = 1, limit = 20, search = '' } = req.query;
    const perPage = Math.max(1, Math.min(100, parseInt(limit)));
    const currentPage = Math.max(1, parseInt(page));
    const offset = (currentPage - 1) * perPage;

    const model = await getModelBySlug(modelSlug);
    if (!model) return res.fail(404, 'Model not found');

    const where = ['model_id = ?'];
    const params = [model.id];
    if (search) { where.push('title LIKE ?'); params.push(`%${search}%`); }
    const whereSql = `WHERE ${where.join(' AND ')}`;

    const countRows = await db.query(`SELECT COUNT(*) as total FROM gallery_sections ${whereSql}`, params);
    const total = countRows[0]?.total || 0;

    const rows = await db.query(
      `SELECT gs.*, 
              (SELECT COUNT(*) FROM gallery_images gi WHERE gi.section_id = gs.id AND gi.model_id = gs.model_id) AS image_count,
              (SELECT COUNT(*) FROM gallery_images gi 
               JOIN content_moderation cm ON gi.filename = SUBSTRING_INDEX(cm.original_path, '/', -1)
               WHERE gi.section_id = gs.id AND gi.model_id = gs.model_id 
               AND cm.moderation_status != 'approved') AS unapproved_count,
              (SELECT COUNT(*) FROM gallery_images gi 
               JOIN content_moderation cm ON gi.filename = SUBSTRING_INDEX(cm.original_path, '/', -1)
               WHERE gi.section_id = gs.id AND gi.model_id = gs.model_id 
               AND cm.moderation_status = 'blurred') AS blurred_count,
              CASE 
                WHEN gs.require_auth = 1 THEN 'auth_required'
                WHEN gs.members_only = 1 THEN 'paywall'
                WHEN (SELECT COUNT(*) FROM gallery_images gi 
                      JOIN content_moderation cm ON gi.filename = SUBSTRING_INDEX(cm.original_path, '/', -1)
                      WHERE gi.section_id = gs.id AND gi.model_id = gs.model_id 
                      AND cm.moderation_status != 'approved') > 0 THEN 'private'
                ELSE 'public'
              END AS privacy_status
       FROM gallery_sections gs ${whereSql} ORDER BY gs.sort_order ASC, gs.created_at DESC LIMIT ${perPage} OFFSET ${offset}`,
      params
    );

    res.set('Cache-Control', 'private, max-age=15');
    return res.success({ sections: rows, pagination: { page: currentPage, limit: perPage, total, pages: Math.ceil(total / perPage) } });
  } catch (error) {
    logger.error('model-gallery.list-sections error', { error: error.message });
    return res.fail(500, 'Failed to load gallery sections', error.message);
  }
});

// GET /api/model-gallery/:modelSlug/sections/:id/images
router.get('/:modelSlug/sections/:id/images', async (req, res) => {
  try {
    const { modelSlug, id } = req.params;
    const { page = 1, limit = 24 } = req.query;
    const perPage = Math.max(1, Math.min(100, parseInt(limit)));
    const currentPage = Math.max(1, parseInt(page));
    const offset = (currentPage - 1) * perPage;
    const model = await getModelBySlug(modelSlug);
    if (!model) return res.fail(404, 'Model not found');
    const countRows = await db.query(
      `SELECT COUNT(*) as total FROM gallery_images gi 
       LEFT JOIN content_moderation cm ON cm.model_id = gi.model_id AND cm.original_path LIKE CONCAT('%', gi.filename)
       WHERE gi.model_id = ? AND gi.section_id = ? AND gi.is_active = 1 
       AND (cm.moderation_status = 'approved' OR cm.moderation_status IS NULL)`,
      [model.id, parseInt(id)]
    );
    const total = countRows[0]?.total || 0;
    const images = await db.query(
      `SELECT 
         gi.id, gi.section_id, gi.model_id, gi.filename, gi.caption, gi.tags, gi.is_active, gi.order_index, gi.created_at, gi.updated_at,
         cm.moderation_status,
         cm.blurred_path
       FROM gallery_images gi 
       LEFT JOIN content_moderation cm ON cm.model_id = gi.model_id AND cm.original_path LIKE CONCAT('%', gi.filename)
       WHERE gi.model_id = ? AND gi.section_id = ? AND gi.is_active = 1
       AND (cm.moderation_status = 'approved' OR cm.moderation_status IS NULL)
       ORDER BY gi.order_index ASC, gi.id ASC
       LIMIT ${perPage} OFFSET ${offset}`,
      [model.id, parseInt(id)]
    );
    res.set('Cache-Control', 'private, max-age=5');
    return res.success({ images, pagination: { page: currentPage, limit: perPage, total, pages: Math.ceil(total / perPage) } });
  } catch (error) {
    logger.error('model-gallery.list-images error', { error: error.message });
    return res.fail(500, 'Failed to load images', error.message);
  }
});

// GET /api/model-gallery/:modelSlug/media/all - Get all media files from all directories
router.get('/:modelSlug/media/all', async (req, res) => {
  try {
    const { modelSlug } = req.params;
    const { page = 1, limit = 24, sort = 'newest', filter = 'all' } = req.query;
    const perPage = Math.max(1, Math.min(100, parseInt(limit)));
    const currentPage = Math.max(1, parseInt(page));
    const offset = (currentPage - 1) * perPage;

    const model = await getModelBySlug(modelSlug);
    if (!model) return res.fail(404, 'Model not found');

    const uploadsPath = path.join(process.cwd(), 'public', 'uploads', modelSlug);
    const allMedia = [];

    // Scan only originals directory with hash-based deduplication
    const directories = ['originals'];
    const supportedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.mov', '.avi', '.ico', '.svg'];
    const seenHashes = new Set(); // Track file hashes to avoid duplicates
    
    // Helper function to calculate file hash
    async function getFileHash(filePath) {
      try {
        const fileBuffer = await fs.readFile(filePath);
        return crypto.createHash('md5').update(fileBuffer).digest('hex');
      } catch (e) {
        return null;
      }
    }

    for (const dir of directories) {
      try {
        const dirPath = path.join(uploadsPath, dir);
        
        // Check if directory exists
        try {
          await fs.access(dirPath);
        } catch {
          continue; // Skip if directory doesn't exist
        }

        // Read directory contents
        const files = await fs.readdir(dirPath);
        
        for (const file of files) {
          const ext = path.extname(file).toLowerCase();
          if (supportedExtensions.includes(ext)) {
            const filePath = path.join(dirPath, file);
            const stats = await fs.stat(filePath);
            
            // Calculate file hash for deduplication
            const fileHash = await getFileHash(filePath);
            if (!fileHash || seenHashes.has(fileHash)) {
              continue; // Skip duplicates or files we can't hash
            }
            seenHashes.add(fileHash);
            
            // Get moderation status if available
            let moderationStatus = 'unknown';
            try {
              const moderationRows = await db.query(
                'SELECT moderation_status FROM content_moderation WHERE model_id = ? AND original_path LIKE ? ORDER BY created_at DESC LIMIT 1',
                [model.id, `%${file}`]
              );
              if (moderationRows.length > 0) {
                moderationStatus = moderationRows[0].moderation_status;
              }
            } catch (e) {
              // Moderation status query failed, keep as unknown
            }

            allMedia.push({
              id: null, // No gallery_images ID for non-gallery files
              filename: file,
              directory: dir,
              path: `/uploads/${modelSlug}/${dir}/${file}`,
              extension: ext,
              size: stats.size,
              hash: fileHash, // Include hash for debugging/tracking
              created_at: stats.birthtime || stats.mtime,
              modified_at: stats.mtime,
              moderation_status: moderationStatus,
              is_video: ['.mp4', '.mov', '.avi'].includes(ext),
              is_system_file: ['favicon', 'logo', 'watermark', 'icon', 'system'].some(keyword => 
                file.toLowerCase().includes(keyword)
              )
            });
          }
        }
      } catch (err) {
        // Skip directory on error
        continue;
      }
    }

    // Apply filtering
    let filteredMedia = allMedia;
    if (filter === 'approved') {
      filteredMedia = allMedia.filter(m => m.moderation_status === 'approved');
    } else if (filter === 'pending') {
      filteredMedia = allMedia.filter(m => m.moderation_status === 'pending');
    } else if (filter === 'system') {
      filteredMedia = allMedia.filter(m => m.is_system_file);
    } else if (filter === 'videos') {
      filteredMedia = allMedia.filter(m => m.is_video);
    }

    // Apply sorting
    if (sort === 'newest') {
      filteredMedia.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } else if (sort === 'oldest') {
      filteredMedia.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    } else if (sort === 'name') {
      filteredMedia.sort((a, b) => a.filename.localeCompare(b.filename));
    } else if (sort === 'size') {
      filteredMedia.sort((a, b) => b.size - a.size);
    }

    // Apply pagination
    const total = filteredMedia.length;
    const paginatedMedia = filteredMedia.slice(offset, offset + perPage);

    res.set('Cache-Control', 'private, max-age=5');
    return res.success({ 
      media: paginatedMedia, 
      pagination: { 
        page: currentPage, 
        limit: perPage, 
        total, 
        pages: Math.ceil(total / perPage) 
      }
    });
  } catch (error) {
    logger.error('model-gallery.list-all-media error', { error: error.message });
    return res.fail(500, 'Failed to load media files', error.message);
  }
});

// POST /api/model-gallery/:modelSlug/sections/:id/upload (multipart form-data field: image)
router.post('/:modelSlug/sections/:id/upload', upload.single('image'), async (req, res) => {
  try {
    const { modelSlug, id } = req.params;
    const model = await getModelBySlug(modelSlug);
    if (!model) return res.fail(404, 'Model not found');
    if (!req.file) return res.fail(400, 'No image uploaded');

    const originalsPath = req.file.path; // filesystem temp in originals
    const filename = path.basename(originalsPath);
    const thumbsDir = path.join(process.cwd(), 'public', 'uploads', modelSlug, 'thumbs');
    await fs.mkdir(thumbsDir, { recursive: true });
    const thumbPath = path.join(thumbsDir, filename);
    await sharp(originalsPath).resize(480, 480, { fit: 'cover' }).jpeg({ quality: 80 }).toFile(thumbPath);

    // Derive public URL for gallery (store copies into public/gallery?)
    const publicGalleryDir = path.join(process.cwd(), 'public', 'uploads', modelSlug, 'public', 'gallery');
    await fs.mkdir(publicGalleryDir, { recursive: true });
    const publicFilePath = path.join(publicGalleryDir, filename);
    // Copy original into public gallery area (or use a move if desired)
    await fs.copyFile(originalsPath, publicFilePath);

    // Optional watermark application based on model settings
    try {
      const rows = await db.query('SELECT setting_value FROM model_settings WHERE model_id = ? AND setting_key = ?', [model.id, 'apply_watermark_default']);
      const shouldWatermark = (rows[0]?.setting_value || 'false') === 'true';
      if (shouldWatermark) {
        const wmPathRow = await db.query('SELECT setting_value FROM model_settings WHERE model_id = ? AND setting_key = ?', [model.id, 'watermark_image']);
        const wmPath = wmPathRow[0]?.setting_value;
        if (wmPath) {
          const publicRoot = path.join(process.cwd(), 'public');
          const absWatermark = wmPath.startsWith('/uploads/') ? path.join(publicRoot, wmPath.replace(/^\//,'')) : wmPath;
          const stampedPath = path.join(process.cwd(), 'public', 'uploads', modelSlug, 'public', 'gallery', `wm_${filename}`);
          try {
            await sharp(publicFilePath).composite([{ input: absWatermark, gravity: 'southeast', blend: 'overlay' }]).toFile(stampedPath);
            await fs.rename(stampedPath, publicFilePath);
          } catch (wmErr) { logger.warn('watermark failed', { error: wmErr.message }); }
        }
      }
    } catch (wmOuter) {}

    // Kick off moderation pipeline (analysis + blur + queue) without blocking UI
    try {
      const ContentModerationService = require('../../src/services/ContentModerationService');
      const moderation = new ContentModerationService(db);
      moderation.processUploadedImage({
        filePath: publicFilePath,
        originalName: filename,
        modelId: model.id,
        modelSlug,
        usageIntent: 'public_site',
        contextType: 'public_gallery'
      }).catch(err => logger.warn('model-gallery.moderation async error', { error: err.message }));
    } catch (e) {
      logger.warn('model-gallery.moderation service unavailable', { error: e.message });
    }

    // Insert DB record referencing filename (relative usage)
    const [{ nextOrder }] = await db.query(
      'SELECT COALESCE(MAX(order_index), -1) + 1 AS nextOrder FROM gallery_images WHERE model_id = ? AND section_id = ?',
      [model.id, parseInt(id)]
    );
    const result = await db.query(
      'INSERT INTO gallery_images (section_id, model_id, filename, caption, tags, is_active, order_index) VALUES (?, ?, ?, ?, ?, 1, ?)',
      [parseInt(id), model.id, filename, '', '', nextOrder || 0]
    );
    const imageId = result.insertId;
    const rows = await db.query('SELECT * FROM gallery_images WHERE id = ?', [imageId]);
    return res.success({ image: rows[0], thumb_url: `/uploads/${modelSlug}/thumbs/${filename}`, public_url: `/uploads/${modelSlug}/public/gallery/${filename}` }, 201);
  } catch (error) {
    logger.error('model-gallery.upload-image error', { error: error.message });
    return res.fail(500, 'Failed to upload image', error.message);
  }
});

// POST /api/model-gallery/:modelSlug/media/upload - Direct media upload (not tied to gallery sections)
router.post('/:modelSlug/media/upload', upload.single('file'), async (req, res) => {
  try {
    const { modelSlug } = req.params;
    const { is_system_file, gallery_section_id, apply_watermark } = req.body;
    
    const model = await getModelBySlug(modelSlug);
    if (!model) return res.fail(404, 'Model not found');
    if (!req.file) return res.fail(400, 'No file uploaded');

    const originalsPath = req.file.path;
    const filename = path.basename(originalsPath);
    const isSystemFile = is_system_file === 'true';
    
    // Determine destination directory
    let targetDir = 'public';
    if (isSystemFile) {
      targetDir = 'system';
      // Create system directory if it doesn't exist
      const systemDir = path.join(process.cwd(), 'public', 'uploads', modelSlug, 'system');
      await fs.mkdir(systemDir, { recursive: true });
    }

    const targetPath = path.join(process.cwd(), 'public', 'uploads', modelSlug, targetDir, filename);
    await fs.copyFile(originalsPath, targetPath);

    // Create thumbnail for images
    const ext = path.extname(filename).toLowerCase();
    const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
    
    if (isImage) {
      const thumbsDir = path.join(process.cwd(), 'public', 'uploads', modelSlug, 'thumbs');
      await fs.mkdir(thumbsDir, { recursive: true });
      const thumbPath = path.join(thumbsDir, filename);
      await sharp(originalsPath).resize(480, 480, { fit: 'cover' }).jpeg({ quality: 80 }).toFile(thumbPath);
      
      // Apply watermark if requested and not a system file
      if (apply_watermark === 'true' && !isSystemFile) {
        try {
          const wmPathRow = await db.query('SELECT setting_value FROM model_settings WHERE model_id = ? AND setting_key = ?', [model.id, 'watermark_image']);
          const wmPath = wmPathRow[0]?.setting_value;
          if (wmPath) {
            // Apply watermark logic here if needed
          }
        } catch (e) {
          logger.warn('Watermark application failed', { error: e.message });
        }
      }
    }

    // Add to content moderation if not bypassed
    if (!isSystemFile) {
      try {
        const ContentModerationService = require('../../services/ContentModerationService');
        const moderation = new ContentModerationService(db);
        moderation.processUploadedImage({
          filePath: targetPath,
          originalName: filename,
          modelId: model.id,
          modelSlug,
          usageIntent: 'public_site',
          contextType: 'media_library'
        }).catch(err => logger.warn('Media upload moderation async error', { error: err.message }));
      } catch (e) {
        logger.warn('Moderation service unavailable for media upload', { error: e.message });
      }
    }

    // Add to gallery section if specified
    if (gallery_section_id && gallery_section_id !== '') {
      try {
        const [{ nextOrder }] = await db.query(
          'SELECT COALESCE(MAX(order_index), -1) + 1 AS nextOrder FROM gallery_images WHERE model_id = ? AND section_id = ?',
          [model.id, parseInt(gallery_section_id)]
        );
        await db.query(
          'INSERT INTO gallery_images (section_id, model_id, filename, caption, tags, is_active, order_index) VALUES (?, ?, ?, ?, ?, 1, ?)',
          [parseInt(gallery_section_id), model.id, filename, '', '', nextOrder || 0]
        );
      } catch (e) {
        logger.warn('Failed to add uploaded media to gallery section', { error: e.message });
      }
    }

    const fileUrl = `/uploads/${modelSlug}/${targetDir}/${filename}`;
    return res.success({ 
      filename, 
      url: fileUrl,
      directory: targetDir,
      bypassed_moderation: isSystemFile,
      thumb_url: isImage ? `/uploads/${modelSlug}/thumbs/${filename}` : null
    }, 201);

  } catch (error) {
    logger.error('Direct media upload error', { error: error.message });
    return res.fail(500, 'Failed to upload media', error.message);
  }
});

// POST /api/model-gallery/:modelSlug/sections/:id/images/batch (batch add images with safety and deduplication)
router.post('/:modelSlug/sections/:id/images/batch', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { modelSlug, id } = req.params;
    const { filenames = [], caption = null, tags = null } = req.body || {};
    
    // Input validation
    if (!Array.isArray(filenames) || filenames.length === 0) {
      return res.fail(400, 'filenames array is required');
    }

    // Rate limiting protection - prevent abuse
    if (filenames.length > 100) {
      logger.warn('Batch add request exceeds limit', {
        model_slug: modelSlug,
        section_id: id,
        requested_count: filenames.length,
        ip: req.ip,
        user_agent: req.get('User-Agent')
      });
      return res.fail(400, 'Too many files requested (max 100 per batch)');
    }

    const model = await getModelBySlug(modelSlug);
    if (!model) return res.fail(404, 'Model not found');

    const sectionId = parseInt(id);

    // Get section info to determine if it's public or private
    const sections = await db.query(
      'SELECT id, title, is_visible FROM gallery_sections WHERE id = ? AND model_id = ?',
      [sectionId, model.id]
    );
    
    if (!sections || sections.length === 0) {
      return res.fail(404, 'Section not found');
    }

    const section = sections[0];
    const isPublicSection = section.is_visible === 1; // Assuming public sections are visible

    let added = 0, skipped = 0, failed = 0;
    const results = [];

    // Get next order index for this section
    const orderResult = await db.query(
      'SELECT COALESCE(MAX(order_index), -1) + 1 AS nextOrder FROM gallery_images WHERE model_id = ? AND section_id = ?',
      [model.id, sectionId]
    );
    let nextOrder = orderResult[0]?.nextOrder || 0;

    // Enhanced input validation and security checks
    const validatedFilenames = [];
    const securityViolations = [];

    for (const filename of filenames) {
      try {
        const trimmedFilename = filename.trim();
        
        // Basic validation
        if (!trimmedFilename) {
          results.push({ filename, status: 'failed', reason: 'Empty filename' });
          failed++;
          continue;
        }

        // Security: Validate filename format (prevent path traversal and injection)
        const filenameRegex = /^[a-zA-Z0-9_\-. ]+\.(jpg|jpeg|png|gif|webp)$/i;
        if (!filenameRegex.test(trimmedFilename)) {
          results.push({ 
            filename: trimmedFilename, 
            status: 'failed', 
            reason: 'Invalid filename format or unsupported file type' 
          });
          failed++;
          securityViolations.push(`Invalid filename format: ${trimmedFilename}`);
          continue;
        }

        // Security: Check for path traversal attempts
        if (trimmedFilename.includes('..') || trimmedFilename.includes('/') || trimmedFilename.includes('\\')) {
          results.push({ 
            filename: trimmedFilename, 
            status: 'failed', 
            reason: 'Security violation: Path traversal attempt detected' 
          });
          failed++;
          securityViolations.push(`Path traversal attempt: ${trimmedFilename}`);
          continue;
        }

        // Security: Filename length limit (prevent DoS)
        if (trimmedFilename.length > 255) {
          results.push({ 
            filename: trimmedFilename, 
            status: 'failed', 
            reason: 'Filename too long (max 255 characters)' 
          });
          failed++;
          continue;
        }

        validatedFilenames.push(trimmedFilename);

      } catch (error) {
        results.push({ 
          filename: filename, 
          status: 'failed', 
          reason: `Validation error: ${error.message}` 
        });
        failed++;
      }
    }

    // Log security violations if any
    if (securityViolations.length > 0) {
      logger.warn('Security violations detected in batch add operation', {
        model_slug: modelSlug,
        section_id: sectionId,
        violations: securityViolations,
        ip: req.ip,
        user_agent: req.get('User-Agent')
      });
    }

    for (const trimmedFilename of validatedFilenames) {
      try {

        // Security: Validate image exists and belongs to correct model
        const libraryImages = await db.query(
          'SELECT mml.id, mml.filename, mml.moderation_status, mml.usage_intent, mml.model_slug FROM model_media_library mml WHERE mml.model_slug = ? AND mml.filename = ? AND mml.is_deleted = 0',
          [modelSlug, trimmedFilename]
        );

        if (libraryImages.length === 0) {
          results.push({ filename: trimmedFilename, status: 'failed', reason: 'Image not found in library' });
          failed++;
          continue;
        }

        const libraryImage = libraryImages[0];

        // Security: Double-check model ownership (defense in depth)
        if (libraryImage.model_slug !== modelSlug) {
          results.push({ 
            filename: trimmedFilename, 
            status: 'failed', 
            reason: 'Security violation: Image does not belong to this model' 
          });
          failed++;
          securityViolations.push(`Model ownership violation: ${trimmedFilename} (belongs to ${libraryImage.model_slug}, not ${modelSlug})`);
          continue;
        }

        // Public safety enforcement - check both moderation status and usage intent
        if (isPublicSection) {
          const moderationStatus = libraryImage.moderation_status;
          const usageIntent = libraryImage.usage_intent;
          
          // Public sections only allow approved/approved_blurred content intended for public_site
          if (!['approved', 'approved_blurred'].includes(moderationStatus)) {
            results.push({ 
              filename: trimmedFilename, 
              status: 'failed', 
              reason: `Not safe for public section (status: ${moderationStatus})` 
            });
            failed++;
            
            // Log public safety violation
            logger.warn('Public safety violation - unsafe content blocked', {
              model_slug: modelSlug,
              section_id: sectionId,
              filename: trimmedFilename,
              moderation_status: moderationStatus,
              usage_intent: usageIntent,
              section_visibility: 'public',
              violation_type: 'unsafe_moderation_status',
              ip: req.ip
            });
            
            continue;
          }
          
          if (usageIntent !== 'public_site') {
            results.push({ 
              filename: trimmedFilename, 
              status: 'failed', 
              reason: `Not intended for public section (usage: ${usageIntent})` 
            });
            failed++;
            
            // Log public safety violation
            logger.warn('Public safety violation - inappropriate content blocked', {
              model_slug: modelSlug,
              section_id: sectionId,
              filename: trimmedFilename,
              moderation_status: moderationStatus,
              usage_intent: usageIntent,
              section_visibility: 'public',
              violation_type: 'inappropriate_usage_intent',
              ip: req.ip
            });
            
            continue;
          }
        }

        // Check if already in section (deduplication)
        const existingImages = await db.query(
          'SELECT id FROM gallery_images WHERE model_id = ? AND section_id = ? AND filename = ?',
          [model.id, sectionId, trimmedFilename]
        );

        if (existingImages.length > 0) {
          results.push({ filename: trimmedFilename, status: 'skipped', reason: 'Already in section' });
          skipped++;
          continue;
        }

        // Add to gallery_images
        await db.query(
          'INSERT INTO gallery_images (section_id, model_id, filename, caption, tags, is_active, order_index) VALUES (?, ?, ?, ?, ?, 1, ?)',
          [sectionId, model.id, trimmedFilename, caption, tags, nextOrder]
        );

        results.push({ filename: trimmedFilename, status: 'added', reason: null });
        added++;
        nextOrder++;

      } catch (error) {
        results.push({ filename: filename.trim(), status: 'failed', reason: error.message });
        failed++;
        logger.warn('batch-add-image error', { filename, error: error.message });
      }
    }

    const summary = { added, skipped, failed };
    
    // Comprehensive operation logging and metrics
    const operationMetrics = {
      model_slug: modelSlug,
      section_id: sectionId,
      section_title: section.title,
      section_visibility: isPublicSection ? 'public' : 'private',
      requested_count: filenames.length,
      validated_count: validatedFilenames.length,
      summary: summary,
      security_violations_count: securityViolations.length,
      processing_time_ms: Date.now() - Date.now(), // Would need to add start time tracking
      ip: req.ip,
      user_agent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    };

    // Log operation completion
    if (summary.added > 0 || summary.skipped > 0) {
      logger.info('Gallery batch add operation completed successfully', operationMetrics);
    }

    // Log failed operations for monitoring
    if (summary.failed > 0) {
      logger.warn('Gallery batch add operation had failures', {
        ...operationMetrics,
        failed_items: results.filter(r => r.status === 'failed').map(r => ({
          filename: r.filename,
          reason: r.reason
        }))
      });
    }

    // Emit metrics event for monitoring dashboards (if monitoring system exists)
    if (typeof global.emitMetric === 'function') {
      global.emitMetric('gallery.batch_add', {
        count: 1,
        tags: {
          model_slug: modelSlug,
          section_visibility: isPublicSection ? 'public' : 'private',
          success: summary.failed === 0
        },
        fields: {
          added: summary.added,
          skipped: summary.skipped,
          failed: summary.failed,
          security_violations: securityViolations.length
        }
      });
    }

    // Track batch add operation
    const responseTime = Date.now() - startTime;
    analytics.trackBatchOperation('add', summary.added, summary.skipped, summary.failed);
    analytics.trackRequest('batch.add', true, responseTime, {
      fileCount: filenames.length,
      successRate: summary.added / filenames.length * 100
    });
    
    return res.success({ summary, results });

  } catch (error) {
    // Track failed batch add operation
    const responseTime = Date.now() - startTime;
    analytics.trackRequest('batch.add', false, responseTime);
    analytics.trackError('batch', error, { endpoint: 'batch-add', modelSlug });
    
    logger.error('model-gallery.batch-add error', { error: error.message });
    return res.fail(500, 'Failed to add images', error.message);
  }
});

// DELETE /api/model-gallery/:modelSlug/sections/:id/images/batch (batch remove images)
router.delete('/:modelSlug/sections/:id/images/batch', async (req, res) => {
  try {
    const { modelSlug, id } = req.params;
    const { filenames = [], ids = [] } = req.body || {};
    
    if (!Array.isArray(filenames) && !Array.isArray(ids)) {
      return res.fail(400, 'filenames or ids array is required');
    }
    
    if (filenames.length === 0 && ids.length === 0) {
      return res.fail(400, 'At least one filename or id must be provided');
    }

    const model = await getModelBySlug(modelSlug);
    if (!model) return res.fail(404, 'Model not found');

    const sectionId = parseInt(id);

    // Verify section exists and belongs to model
    const sections = await db.query(
      'SELECT id, title FROM gallery_sections WHERE id = ? AND model_id = ?',
      [sectionId, model.id]
    );
    
    if (!sections || sections.length === 0) {
      return res.fail(404, 'Section not found');
    }

    let removedCount = 0;
    const results = [];

    // Handle removal by filenames
    if (filenames.length > 0) {
      for (const filename of filenames) {
        try {
          const trimmedFilename = filename.trim();
          if (!trimmedFilename) continue;

          const deleteResult = await db.query(
            'DELETE FROM gallery_images WHERE model_id = ? AND section_id = ? AND filename = ?',
            [model.id, sectionId, trimmedFilename]
          );

          if (deleteResult.affectedRows > 0) {
            removedCount++;
            results.push({ filename: trimmedFilename, status: 'removed' });
          } else {
            results.push({ filename: trimmedFilename, status: 'not_found', reason: 'Image not in section' });
          }
        } catch (error) {
          results.push({ filename: filename, status: 'failed', reason: error.message });
        }
      }
    }

    // Handle removal by IDs
    if (ids.length > 0) {
      for (const imageId of ids) {
        try {
          const id = parseInt(imageId);
          if (isNaN(id)) continue;

          const deleteResult = await db.query(
            'DELETE FROM gallery_images WHERE id = ? AND model_id = ? AND section_id = ?',
            [id, model.id, sectionId]
          );

          if (deleteResult.affectedRows > 0) {
            removedCount++;
            results.push({ id: id, status: 'removed' });
          } else {
            results.push({ id: id, status: 'not_found', reason: 'Image not found in section' });
          }
        } catch (error) {
          results.push({ id: imageId, status: 'failed', reason: error.message });
        }
      }
    }

    // Log the operation
    logger.info('Gallery batch remove operation completed', {
      model_slug: modelSlug,
      section_id: sectionId,
      requested_count: filenames.length + ids.length,
      removed_count: removedCount,
      ip: req.ip,
      timestamp: new Date().toISOString()
    });

    return res.success({ 
      removed: removedCount,
      total_requested: filenames.length + ids.length,
      results: results 
    });

  } catch (error) {
    logger.error('model-gallery.batch-remove error', { error: error.message });
    return res.fail(500, 'Failed to remove images', error.message);
  }
});

// POST /api/model-gallery/:modelSlug/sections/:id/images (add image by filename)
router.post('/:modelSlug/sections/:id/images', async (req, res) => {
  try {
    const { modelSlug, id } = req.params;
    const { filename, caption = null, tags = null } = req.body || {};
    if (!filename || !filename.trim()) return res.fail(400, 'filename is required');
    const model = await getModelBySlug(modelSlug);
    if (!model) return res.fail(404, 'Model not found');
    // Next order index in this section
    const [{ nextOrder }] = await db.query(
      'SELECT COALESCE(MAX(order_index), -1) + 1 AS nextOrder FROM gallery_images WHERE model_id = ? AND section_id = ?',
      [model.id, parseInt(id)]
    );
    const result = await db.query(
      'INSERT INTO gallery_images (section_id, model_id, filename, caption, tags, is_active, order_index) VALUES (?, ?, ?, ?, ?, 1, ?)',
      [parseInt(id), model.id, filename.trim(), caption, tags, nextOrder || 0]
    );
    const imageId = result.insertId;
    const rows = await db.query('SELECT * FROM gallery_images WHERE id = ?', [imageId]);
    return res.success({ image: rows[0] }, 201);
  } catch (error) {
    logger.error('model-gallery.add-image error', { error: error.message });
    return res.fail(500, 'Failed to add image', error.message);
  }
});

// PUT /api/model-gallery/:modelSlug/images/:imageId (update image metadata)
router.put('/:modelSlug/images/:imageId', async (req, res) => {
  try {
    const { modelSlug, imageId } = req.params;
    const updates = req.body || {};
    const model = await getModelBySlug(modelSlug);
    if (!model) return res.fail(404, 'Model not found');
    const fields = [];
    const params = [];
    const editable = { caption: 'caption', tags: 'tags', is_active: 'is_active' };
    for (const key of Object.keys(editable)) {
      if (updates[key] !== undefined) {
        fields.push(`${editable[key]} = ?`);
        params.push(updates[key]);
      }
    }
    if (!fields.length) return res.fail(400, 'No valid fields to update');
    params.push(model.id, parseInt(imageId));
    const result = await db.query(`UPDATE gallery_images SET ${fields.join(', ')} WHERE model_id = ? AND id = ?`, params);
    if (result.affectedRows === 0) return res.fail(404, 'Image not found');
    const rows = await db.query('SELECT * FROM gallery_images WHERE id = ?', [parseInt(imageId)]);
    return res.success({ image: rows[0] });
  } catch (error) {
    logger.error('model-gallery.update-image error', { error: error.message });
    return res.fail(500, 'Failed to update image', error.message);
  }
});

// PATCH /api/model-gallery/:modelSlug/images/:imageId/visibility (toggle is_active)
router.patch('/:modelSlug/images/:imageId/visibility', async (req, res) => {
  try {
    const { modelSlug, imageId } = req.params;
    const { is_active } = req.body || {};
    const model = await getModelBySlug(modelSlug);
    if (!model) return res.fail(404, 'Model not found');
    const desired = is_active ? 1 : 0;
    const result = await db.query('UPDATE gallery_images SET is_active = ? WHERE model_id = ? AND id = ?', [desired, model.id, parseInt(imageId)]);
    if (result.affectedRows === 0) return res.fail(404, 'Image not found');
    const rows = await db.query('SELECT * FROM gallery_images WHERE id = ?', [parseInt(imageId)]);
    return res.success({ image: rows[0] });
  } catch (error) {
    logger.error('model-gallery.visibility-image error', { error: error.message });
    return res.fail(500, 'Failed to update image visibility', error.message);
  }
});

// PATCH /api/model-gallery/:modelSlug/images/reorder { section_id, items:[{id, order_index}] }
router.patch('/:modelSlug/images/reorder', async (req, res) => {
  try {
    const { modelSlug } = req.params;
    const { section_id, items } = req.body || {};
    if (!Array.isArray(items) || !section_id) return res.fail(400, 'section_id and items are required');
    const model = await getModelBySlug(modelSlug);
    if (!model) return res.fail(404, 'Model not found');
    // Update order one by one (simple and safe)
    for (const it of items) {
      if (!it || typeof it.id === 'undefined' || typeof it.order_index === 'undefined') continue;
      await db.query('UPDATE gallery_images SET order_index = ? WHERE id = ? AND model_id = ? AND section_id = ?', [
        parseInt(it.order_index), parseInt(it.id), model.id, parseInt(section_id)
      ]);
    }
    const images = await db.query(
      'SELECT id, section_id, model_id, filename, caption, tags, is_active, order_index FROM gallery_images WHERE model_id = ? AND section_id = ? ORDER BY order_index ASC, id ASC',
      [model.id, parseInt(section_id)]
    );
    return res.success({ images });
  } catch (error) {
    logger.error('model-gallery.reorder-images error', { error: error.message });
    return res.fail(500, 'Failed to reorder images', error.message);
  }
});

// PATCH /api/model-gallery/:modelSlug/images/bulk  { action: 'show'|'hide'|'delete', ids: [] }
router.patch('/:modelSlug/images/bulk', async (req, res) => {
  try {
    const { modelSlug } = req.params;
    const { action, ids } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) return res.fail(400, 'ids[] required');
    const model = await getModelBySlug(modelSlug);
    if (!model) return res.fail(404, 'Model not found');

    const idInts = ids.map((v) => parseInt(v)).filter((v) => Number.isInteger(v));
    if (idInts.length === 0) return res.fail(400, 'No valid ids');
    const placeholders = idInts.map(() => '?').join(',');

    if (action === 'show' || action === 'hide') {
      const desired = action === 'show' ? 1 : 0;
      await db.query(
        `UPDATE gallery_images SET is_active = ? WHERE model_id = ? AND id IN (${placeholders})`,
        [desired, model.id, ...idInts]
      );
    } else if (action === 'delete') {
      await db.query(
        `DELETE FROM gallery_images WHERE model_id = ? AND id IN (${placeholders})`,
        [model.id, ...idInts]
      );
    } else if (action === 'move') {
      const { target_section_id } = req.body || {};
      if (!target_section_id) return res.fail(400, 'target_section_id is required for move');
      await db.query(
        `UPDATE gallery_images SET section_id = ? WHERE model_id = ? AND id IN (${placeholders})`,
        [parseInt(target_section_id), model.id, ...idInts]
      );
    } else {
      return res.fail(400, 'Invalid action');
    }

    return res.success({ updated: idInts.length, action });
  } catch (error) {
    logger.error('model-gallery.images-bulk error', { error: error.message });
    return res.fail(500, 'Failed to apply bulk action', error.message);
  }
});

// GET /api/model-gallery/:modelSlug/available-images (simplified endpoint for section management)
router.get('/:modelSlug/available-images', async (req, res) => {
  try {
    const { modelSlug } = req.params;
    const { section_id, status = 'approved', context = 'all', search = '' } = req.query;
    
    const model = await getModelBySlug(modelSlug);
    if (!model) return res.fail(404, 'Model not found');

    // Get all images from model_media_library
    let whereConditions = ['mml.model_slug = ?'];
    let queryParams = [modelSlug];

    // Status filter
    if (status !== 'all') {
      if (status === 'approved') {
        whereConditions.push("mml.moderation_status = 'approved'");
      } else if (status === 'approved_blurred') {
        whereConditions.push("mml.moderation_status IN ('approved', 'approved_blurred')");
      } else {
        whereConditions.push('mml.moderation_status = ?');
        queryParams.push(status);
      }
    }

    // Context filter
    if (context !== 'all') {
      const validContexts = ['public_site', 'paysite', 'private'];
      if (validContexts.includes(context)) {
        whereConditions.push('mml.usage_intent = ?');
        queryParams.push(context);
      }
    }

    // Search filter
    if (search.trim()) {
      whereConditions.push('mml.filename LIKE ?');
      queryParams.push(`%${search.trim()}%`);
    }

    // Only non-deleted images
    whereConditions.push('mml.is_deleted = 0');

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    // Get images with in_section detection
    let images;
    if (section_id) {
      // Check which images are already in this section
      images = await db.query(`
        SELECT 
          COALESCE(gi.id, mml.id) as id,
          mml.filename,
          mml.file_size as size,
          mml.image_width as width,
          mml.image_height as height,
          mml.moderation_status,
          mml.usage_intent,
          mml.upload_date as created_at,
          mml.caption,
          mml.alt_text,
          CASE WHEN gi.id IS NOT NULL THEN true ELSE false END as in_section
        FROM model_media_library mml
        LEFT JOIN gallery_images gi ON (gi.model_id = ? AND gi.filename = mml.filename AND gi.section_id = ?)
        ${whereClause}
        ORDER BY mml.upload_date DESC
      `, [model.id, parseInt(section_id), ...queryParams]);
    } else {
      // No section specified, just return all available images
      images = await db.query(`
        SELECT 
          COALESCE(gi.id, mml.id) as id,
          mml.filename,
          mml.file_size as size,
          mml.image_width as width,
          mml.image_height as height,
          mml.moderation_status,
          mml.usage_intent,
          mml.upload_date as created_at,
          mml.caption,
          mml.alt_text,
          false as in_section
        FROM model_media_library mml
        LEFT JOIN (
          SELECT DISTINCT model_id, filename, MAX(id) as id
          FROM gallery_images 
          GROUP BY model_id, filename
        ) gi ON (gi.model_id = ? AND gi.filename = mml.filename)
        ${whereClause}
        ORDER BY mml.upload_date DESC
      `, [model.id, ...queryParams]);
    }

    res.set('Cache-Control', 'private, max-age=30');
    return res.success({ 
      images,
      total: images.length
    });

  } catch (error) {
    logger.error('model-gallery.available-images error', { error: error.message });
    return res.fail(500, 'Failed to load available images', error.message);
  }
});

// GET /api/model-gallery/:modelSlug/library (new fast filterable library endpoint)
router.get('/:modelSlug/library', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { modelSlug } = req.params;
    const { 
      status = 'approved', 
      context = 'all', 
      search = '', 
      sort = 'newest', 
      page = 1, 
      limit = 24,
      section_id = null 
    } = req.query;
    
    const model = await getModelBySlug(modelSlug);
    if (!model) return res.fail(404, 'Model not found');

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    // Build WHERE conditions for filtering
    let whereConditions = ['mml.model_slug = ?'];
    let queryParams = [modelSlug];

    // Status filter
    if (status !== 'all') {
      if (status === 'approved') {
        whereConditions.push("mml.moderation_status = 'approved'");
      } else if (status === 'approved_blurred') {
        whereConditions.push("mml.moderation_status IN ('approved', 'approved_blurred')");
      } else {
        whereConditions.push('mml.moderation_status = ?');
        queryParams.push(status);
      }
    }

    // Context filter using usage_intent column
    if (context !== 'all') {
      const validContexts = ['public_site', 'paysite', 'private'];
      if (validContexts.includes(context)) {
        whereConditions.push('mml.usage_intent = ?');
        queryParams.push(context);
      }
    }

    // Search filter
    if (search.trim()) {
      whereConditions.push('mml.filename LIKE ?');
      queryParams.push(`%${search.trim()}%`);
    }

    // Only non-deleted images
    whereConditions.push('mml.is_deleted = 0');

    // Build ORDER BY clause
    let orderClause;
    switch (sort) {
      case 'oldest':
        orderClause = 'ORDER BY mml.upload_date ASC';
        break;
      case 'name':
        orderClause = 'ORDER BY mml.filename ASC';
        break;
      default: // newest
        orderClause = 'ORDER BY mml.upload_date DESC';
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    // Count total for pagination
    const countResult = await db.query(`
      SELECT COUNT(*) as total
      FROM model_media_library mml
      ${whereClause}
    `, queryParams);

    const total = countResult[0]?.total || 0;
    const pages = Math.ceil(total / limitNum);

    // Get images with in_section detection
    const sectionJoin = section_id ? 
      `LEFT JOIN gallery_images gi ON (gi.model_id = ? AND gi.filename = mml.filename AND gi.section_id = ?)` : 
      '';
    
    if (section_id) {
      queryParams.push(model.id, parseInt(section_id));
    }

    const images = await db.query(`
      SELECT 
        mml.id,
        mml.filename,
        mml.file_size as size,
        mml.image_width as width,
        mml.image_height as height,
        mml.moderation_status,
        mml.usage_intent,
        mml.upload_date as created_at,
        ${section_id ? 'CASE WHEN gi.id IS NOT NULL THEN true ELSE false END as in_section' : 'false as in_section'}
      FROM model_media_library mml
      ${sectionJoin}
      ${whereClause}
      ${orderClause}
      LIMIT ${limitNum} OFFSET ${offset}
    `, queryParams);

    // Track successful library request
    const responseTime = Date.now() - startTime;
    analytics.trackRequest('library', true, responseTime, {
      status,
      context,
      hasSearch: !!search.trim(),
      resultCount: images.length
    });
    
    res.set('Cache-Control', 'private, max-age=30');
    return res.success({ 
      images,
      pagination: { page: pageNum, limit: limitNum, total, pages }
    });

  } catch (error) {
    // Track failed library request
    const responseTime = Date.now() - startTime;
    analytics.trackRequest('library', false, responseTime);
    analytics.trackError('database', error, { endpoint: 'library', modelSlug });
    
    logger.error('model-gallery.library error', { error: error.message });
    return res.fail(500, 'Failed to load library', error.message);
  }
});

// GET /api/model-gallery/:modelSlug/image-picker (enhanced image picker with thumbnails and filtering)
router.get('/:modelSlug/image-picker', async (req, res) => {
  try {
    const { modelSlug } = req.params;
    const { search = '', filter = 'approved', sort = 'newest' } = req.query;
    
    const model = await getModelBySlug(modelSlug);
    if (!model) return res.fail(404, 'Model not found');

    // Build WHERE conditions based on filter
    let whereConditions = ['model_slug = ?'];
    let queryParams = [modelSlug];

    if (filter !== 'all') {
      if (filter === 'flagged') {
        whereConditions.push("(moderation_status = 'flagged' OR moderation_status = 'rejected')");
      } else {
        whereConditions.push('moderation_status = ?');
        queryParams.push(filter);
      }
    }

    if (search.trim()) {
      whereConditions.push('filename LIKE ?');
      queryParams.push(`%${search.trim()}%`);
    }

    // Build ORDER BY clause
    let orderClause;
    switch (sort) {
      case 'oldest':
        orderClause = 'ORDER BY upload_date ASC';
        break;
      case 'filename':
        orderClause = 'ORDER BY filename ASC';
        break;
      default: // newest
        orderClause = 'ORDER BY upload_date DESC';
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    const images = await db.query(`
      SELECT 
        filename,
        moderation_status,
        file_size,
        upload_date,
        is_deleted
      FROM model_media_library 
      ${whereClause}
      AND is_deleted = 0
      ${orderClause}
      LIMIT 100
    `, queryParams);

    return res.success({ images });
  } catch (error) {
    logger.error('model-gallery.image-picker error', { error: error.message });
    return res.fail(500, 'Failed to load images', error.message);
  }
});

// GET /api/model-gallery/:modelSlug/uploads-list?path=public (list available files under /public/uploads/:slug/<path>)
router.get('/:modelSlug/uploads-list', async (req, res) => {
  try {
    const { modelSlug } = req.params;
    const { sub = 'public' } = req.query; // default to public
    const safeSub = String(sub || 'public').replace(/\.\.+/g, '').replace(/^\//, '');
    const root = path.join(process.cwd(), 'public', 'uploads', modelSlug, safeSub);
    // Ensure directory exists, otherwise return empty
    try {
      await fs.access(root);
    } catch (e) {
      if (e && e.code === 'ENOENT') {
        return res.success({ files: [] });
      }
      throw e;
    }
    const entries = await fs.readdir(root, { withFileTypes: true });
    const files = entries
      .filter(e => e.isFile())
      .map(e => ({ name: e.name, path: `/uploads/${modelSlug}/${safeSub}/${e.name}` }));
    return res.success({ files });
  } catch (error) {
    logger.error('model-gallery.list-uploads error', { error: error.message });
    return res.fail(500, 'Failed to list uploads', error.message);
  }
});

// PATCH /api/model-gallery/:modelSlug/images/watermark { ids: [] }
router.patch('/:modelSlug/images/watermark', async (req, res) => {
  try {
    const { modelSlug } = req.params;
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) return res.fail(400, 'ids[] required');
    const model = await getModelBySlug(modelSlug);
    if (!model) return res.fail(404, 'Model not found');

    // Load watermark settings
    const settingsRows = await db.query(
      'SELECT setting_key, setting_value FROM model_settings WHERE model_id = ? AND setting_key IN ("watermark_image","wm_size","wm_opacity","wm_position")',
      [model.id]
    );
    const settings = Object.create(null);
    for (const r of settingsRows) settings[r.setting_key] = r.setting_value;
    if (!settings.watermark_image) return res.fail(400, 'watermark_image not set in settings');
    const publicRoot = path.join(process.cwd(), 'public');
    const wmAbs = settings.watermark_image.startsWith('/uploads/')
      ? path.join(publicRoot, settings.watermark_image.replace(/^\//, ''))
      : settings.watermark_image;

    // Fetch target images
    const idInts = ids.map(v => parseInt(v)).filter(v => Number.isInteger(v));
    if (!idInts.length) return res.fail(400, 'No valid ids');
    const placeholders = idInts.map(() => '?').join(',');
    const rows = await db.query(
      `SELECT id, filename FROM gallery_images WHERE model_id = ? AND id IN (${placeholders})`,
      [model.id, ...idInts]
    );
    if (!rows.length) return res.success({ processed: 0, ids: [] });

    // Prepare settings
    const sizePct = Math.max(5, Math.min(100, parseInt(settings.wm_size || '31')));
    const opacity = Math.max(0.05, Math.min(1.0, parseFloat(((settings.wm_opacity || '60')))/100));
    const positionMap = {
      'Bottom Right': 'southeast',
      'Bottom Left': 'southwest',
      'Top Right': 'northeast',
      'Top Left': 'northwest',
      'Center': 'center'
    };
    const gravity = positionMap[settings.wm_position || 'Bottom Right'] || 'southeast';

    let processed = 0;
    const processedIds = [];

    for (const img of rows) {
      try {
        const src = path.join(publicRoot, 'uploads', modelSlug, 'public', 'gallery', img.filename);
        // ensure file exists
        try { await fs.access(src); } catch { continue; }
        const meta = await sharp(src).metadata();
        const targetWidth = Math.max(20, Math.round((meta.width || 1000) * (sizePct / 100)));
        const overlayBuf = await sharp(wmAbs).resize({ width: targetWidth }).toBuffer();
        const tmp = src + '.wm_tmp';
        await sharp(src).composite([{ input: overlayBuf, gravity, blend: 'over', opacity }]).toFile(tmp);
        await fs.rename(tmp, src);
        processed++; processedIds.push(img.id);
      } catch (e) {
        logger.warn('watermark.apply error', { error: e.message, id: img.id });
      }
    }

    return res.success({ processed, ids: processedIds });
  } catch (error) {
    logger.error('model-gallery.watermark-batch error', { error: error.message });
    return res.fail(500, 'Failed to apply watermark', error.message);
  }
});

// DELETE /api/model-gallery/:modelSlug/images/:imageId
router.delete('/:modelSlug/images/:imageId', async (req, res) => {
  try {
    const { modelSlug, imageId } = req.params;
    const model = await getModelBySlug(modelSlug);
    if (!model) return res.fail(404, 'Model not found');

    // Get image info before deletion
    const [imageRows] = await db.query(
      'SELECT filename FROM gallery_images WHERE model_id = ? AND id = ?',
      [model.id, parseInt(imageId)]
    );
    
    if (!imageRows.length) return res.fail(404, 'Image not found');
    
    const filename = imageRows[0].filename;

    // Delete from database
    const result = await db.query(
      'DELETE FROM gallery_images WHERE model_id = ? AND id = ?',
      [model.id, parseInt(imageId)]
    );

    if (result.affectedRows === 0) return res.fail(404, 'Image not found');

    // Delete physical files
    const publicRoot = path.join(process.cwd(), 'public');
    const filesToDelete = [
      path.join(publicRoot, 'uploads', modelSlug, 'public', 'gallery', filename),
      path.join(publicRoot, 'uploads', modelSlug, 'thumbs', filename),
      path.join(publicRoot, 'uploads', modelSlug, 'originals', filename)
    ];

    for (const filePath of filesToDelete) {
      try {
        await fs.unlink(filePath);
      } catch (error) {
        // File might not exist, continue
        logger.warn('delete-image.unlink-file', { file: filePath, error: error.message });
      }
    }

    return res.success({ message: 'Image deleted successfully', filename });
  } catch (error) {
    logger.error('model-gallery.delete-image error', { error: error.message });
    return res.fail(500, 'Failed to delete image', error.message);
  }
});

// PATCH /api/model-gallery/:modelSlug/images/rename
router.patch('/:modelSlug/images/rename', async (req, res) => {
  try {
    const { modelSlug } = req.params;
    const { old_filename, new_filename } = req.body || {};
    
    if (!old_filename || !new_filename) {
      return res.fail(400, 'old_filename and new_filename are required');
    }
    
    const model = await getModelBySlug(modelSlug);
    if (!model) return res.fail(404, 'Model not found');

    // Sanitize new filename
    const sanitized = new_filename.replace(/[^\w\-_.]/g, '_');
    
    // Check if new filename already exists
    const [existing] = await db.query(
      'SELECT id FROM gallery_images WHERE model_id = ? AND filename = ?',
      [model.id, sanitized]
    );
    
    if (existing.length > 0) {
      return res.fail(400, 'Filename already exists');
    }

    // Update database
    const result = await db.query(
      'UPDATE gallery_images SET filename = ? WHERE model_id = ? AND filename = ?',
      [sanitized, model.id, old_filename]
    );

    if (result.affectedRows === 0) {
      return res.fail(404, 'Image not found');
    }

    // Rename physical files
    const publicRoot = path.join(process.cwd(), 'public');
    const fileTypes = [
      ['public', 'gallery'],
      ['thumbs'],
      ['originals']
    ];

    for (const pathSegments of fileTypes) {
      const oldPath = path.join(publicRoot, 'uploads', modelSlug, ...pathSegments, old_filename);
      const newPath = path.join(publicRoot, 'uploads', modelSlug, ...pathSegments, sanitized);
      
      try {
        await fs.access(oldPath);
        await fs.rename(oldPath, newPath);
      } catch (error) {
        // File might not exist in this location, continue
        logger.warn('rename-image.rename-file', { 
          old: oldPath, 
          new: newPath, 
          error: error.message 
        });
      }
    }

    return res.success({ 
      message: 'Image renamed successfully', 
      old_filename, 
      new_filename: sanitized 
    });
  } catch (error) {
    logger.error('model-gallery.rename-image error', { error: error.message });
    return res.fail(500, 'Failed to rename image', error.message);
  }
});

// POST /api/model-gallery/:modelSlug/images/crop
router.post('/:modelSlug/images/crop', async (req, res) => {
  try {
    const { modelSlug } = req.params;
    const { filename, crop_data } = req.body || {};
    
    if (!filename || !crop_data) {
      return res.fail(400, 'filename and crop_data are required');
    }
    
    const model = await getModelBySlug(modelSlug);
    if (!model) return res.fail(404, 'Model not found');

    const publicRoot = path.join(process.cwd(), 'public');
    const imagePath = path.join(publicRoot, 'uploads', modelSlug, 'public', 'gallery', filename);
    
    // Check if file exists
    try {
      await fs.access(imagePath);
    } catch (error) {
      return res.fail(404, 'Image file not found');
    }

    // Apply crop using Sharp
    const { x, y, width, height } = crop_data;
    const croppedBuffer = await sharp(imagePath)
      .extract({ 
        left: Math.round(x), 
        top: Math.round(y), 
        width: Math.round(width), 
        height: Math.round(height) 
      })
      .toBuffer();

    // Save cropped image (overwrite original)
    await fs.writeFile(imagePath, croppedBuffer);

    // Also update thumbnail
    const thumbPath = path.join(publicRoot, 'uploads', modelSlug, 'thumbs', filename);
    try {
      await sharp(croppedBuffer)
        .resize(480, 480, { fit: 'cover' })
        .jpeg({ quality: 80 })
        .toFile(thumbPath);
    } catch (thumbError) {
      logger.warn('crop-image.thumbnail-update', { error: thumbError.message });
    }

    return res.success({ message: 'Image cropped successfully', filename });
  } catch (error) {
    logger.error('model-gallery.crop-image error', { error: error.message });
    return res.fail(500, 'Failed to crop image', error.message);
  }
});

// POST /api/model-gallery/:modelSlug/images/rotate
router.post('/:modelSlug/images/rotate', async (req, res) => {
  try {
    const { modelSlug } = req.params;
    const { filename, degrees } = req.body || {};
    
    if (!filename || !degrees) {
      return res.fail(400, 'filename and degrees are required');
    }
    
    const model = await getModelBySlug(modelSlug);
    if (!model) return res.fail(404, 'Model not found');

    const publicRoot = path.join(process.cwd(), 'public');
    const imagePath = path.join(publicRoot, 'uploads', modelSlug, 'public', 'gallery', filename);
    
    // Check if file exists
    try {
      await fs.access(imagePath);
    } catch (error) {
      return res.fail(404, 'Image file not found');
    }

    // Apply rotation using Sharp
    const rotatedBuffer = await sharp(imagePath)
      .rotate(degrees)
      .toBuffer();

    // Save rotated image (overwrite original)
    await fs.writeFile(imagePath, rotatedBuffer);

    // Also update thumbnail
    const thumbPath = path.join(publicRoot, 'uploads', modelSlug, 'thumbs', filename);
    try {
      await sharp(rotatedBuffer)
        .resize(480, 480, { fit: 'cover' })
        .jpeg({ quality: 80 })
        .toFile(thumbPath);
    } catch (thumbError) {
      logger.warn('rotate-image.thumbnail-update', { error: thumbError.message });
    }

    return res.success({ message: `Image rotated ${degrees}°`, filename });
  } catch (error) {
    logger.error('model-gallery.rotate-image error', { error: error.message });
    return res.fail(500, 'Failed to rotate image', error.message);
  }
});

// POST /api/model-gallery/:modelSlug/images/resize
router.post('/:modelSlug/images/resize', async (req, res) => {
  try {
    const { modelSlug } = req.params;
    const { filename, width, height, maintain_aspect } = req.body || {};
    
    if (!filename || (!width && !height)) {
      return res.fail(400, 'filename and at least width or height are required');
    }
    
    const model = await getModelBySlug(modelSlug);
    if (!model) return res.fail(404, 'Model not found');

    const publicRoot = path.join(process.cwd(), 'public');
    const imagePath = path.join(publicRoot, 'uploads', modelSlug, 'public', 'gallery', filename);
    
    // Check if file exists
    try {
      await fs.access(imagePath);
    } catch (error) {
      return res.fail(404, 'Image file not found');
    }

    // Apply resize using Sharp
    let resizeOptions = {};
    if (width) resizeOptions.width = parseInt(width);
    if (height) resizeOptions.height = parseInt(height);
    
    if (!maintain_aspect) {
      resizeOptions.fit = 'fill';
    }

    const resizedBuffer = await sharp(imagePath)
      .resize(resizeOptions)
      .toBuffer();

    // Save resized image (overwrite original)
    await fs.writeFile(imagePath, resizedBuffer);

    // Also update thumbnail
    const thumbPath = path.join(publicRoot, 'uploads', modelSlug, 'thumbs', filename);
    try {
      await sharp(resizedBuffer)
        .resize(480, 480, { fit: 'cover' })
        .jpeg({ quality: 80 })
        .toFile(thumbPath);
    } catch (thumbError) {
      logger.warn('resize-image.thumbnail-update', { error: thumbError.message });
    }

    return res.success({ 
      message: 'Image resized successfully', 
      filename,
      new_dimensions: `${resizeOptions.width || 'auto'} × ${resizeOptions.height || 'auto'}`
    });
  } catch (error) {
    logger.error('model-gallery.resize-image error', { error: error.message });
    return res.fail(500, 'Failed to resize image', error.message);
  }
});

/**
 * PUT /api/model-gallery/:modelSlug/sections/:id/settings
 * 
 * Update gallery section settings with layout-specific configurations
 * 
 * @route PUT /api/model-gallery/:modelSlug/sections/:id/settings
 * @param {string} modelSlug - The model's unique slug identifier
 * @param {number} id - The gallery section ID
 * 
 * @body {Object} settings - Gallery section settings
 * @body {string} settings.layout_type - Layout type: 'grid', 'masonry', 'carousel', 'lightbox_grid'
 * @body {string} [settings.layout_settings] - JSON string containing layout-specific settings
 * @body {boolean} [settings.show_captions] - Whether to show image captions
 * @body {boolean} [settings.enable_download] - Whether to allow image downloads
 * @body {boolean} [settings.lazy_loading] - Whether to enable lazy loading
 * @body {boolean} [settings.is_visible] - Whether the section is visible
 * @body {boolean} [settings.show_in_nav] - Whether to show in navigation
 * @body {string} [settings.seo_description] - SEO description (max 500 chars)
 * @body {string} [settings.seo_keywords] - SEO keywords (max 255 chars)
 * @body {string} [settings.canonical_url] - Canonical URL (max 255 chars)
 * 
 * Layout-specific settings (stored in layout_settings as JSON):
 * 
 * Grid Layout:
 * - gridColumns: 2|3|4|6 (default: 3)
 * - gridGap: 0-50 pixels (default: 15)
 * - gridMaintainAspect: boolean (default: true)
 * - gridAlignment: 'start'|'center'|'end' (default: 'center')
 * - gridHoverEffects: boolean (default: true)
 * 
 * Masonry Layout:
 * - masonryColumns: 2-5 (default: 3)
 * - masonryGap: 5-40 pixels (default: 20)
 * - masonryProgressiveLoad: boolean (default: true)
 * - masonryBreakpoints: 'standard'|'compact'|'wide' (default: 'standard')
 * - masonryAnimationDuration: 100-1000ms (default: 300)
 * 
 * Carousel Layout:
 * - carouselItemsVisible: 1-4 (default: 1)
 * - carouselAutoplay: boolean (default: false)
 * - carouselSpeed: 1000-10000ms (default: 5000)
 * - carouselLoop: boolean (default: true)
 * - carouselDots: boolean (default: true)
 * - carouselArrows: boolean (default: true)
 * - carouselTransition: 'slide'|'fade'|'cube'|'flip' (default: 'slide')
 * - carouselTransitionDuration: 200-2000ms (default: 600)
 * 
 * Lightbox Grid Layout:
 * - lightboxColumns: 3-6 (default: 4)
 * - lightboxThumbnailSize: 'small'|'medium'|'large' (default: 'medium')
 * - lightboxZoom: boolean (default: true)
 * - lightboxSlideshow: boolean (default: true)
 * - lightboxThumbnails: boolean (default: true)
 * - lightboxFullscreen: boolean (default: true)
 * - lightboxTheme: 'dark'|'light'|'auto' (default: 'dark')
 * 
 * @returns {Object} Updated section data with layout_settings as parsed JSON object
 * 
 * @example
 * // Basic settings update
 * PUT /api/model-gallery/mymodel/sections/8/settings
 * {
 *   "layout_type": "grid",
 *   "show_captions": true,
 *   "is_visible": true
 * }
 * 
 * @example  
 * // Grid layout with specific settings
 * PUT /api/model-gallery/mymodel/sections/8/settings
 * {
 *   "layout_type": "grid",
 *   "layout_settings": "{\"gridColumns\":4,\"gridGap\":20,\"gridHoverEffects\":true}",
 *   "show_captions": false,
 *   "is_visible": true
 * }
 * 
 * @example
 * // Carousel layout with comprehensive settings
 * PUT /api/model-gallery/mymodel/sections/8/settings
 * {
 *   "layout_type": "carousel", 
 *   "layout_settings": "{\"carouselItemsVisible\":3,\"carouselAutoplay\":true,\"carouselSpeed\":4000,\"carouselLoop\":true,\"carouselDots\":true,\"carouselArrows\":true,\"carouselTransition\":\"slide\",\"carouselTransitionDuration\":600}",
 *   "show_captions": true,
 *   "lazy_loading": true,
 *   "is_visible": true
 * }
 * 
 * @example
 * // Success response
 * {
 *   "success": true,
 *   "data": {
 *     "section": {
 *       "id": 8,
 *       "layout_type": "carousel",
 *       "layout_settings": {
 *         "carouselItemsVisible": 3,
 *         "carouselAutoplay": true,
 *         "carouselSpeed": 4000,
 *         "carouselLoop": true,
 *         "carouselDots": true,
 *         "carouselArrows": true,
 *         "carouselTransition": "slide", 
 *         "carouselTransitionDuration": 600
 *       },
 *       "show_captions": true,
 *       "is_visible": true
 *     }
 *   }
 * }
 * 
 * @example
 * // Error responses
 * {
 *   "success": false,
 *   "error": "Model not found"
 * }
 * 
 * {
 *   "success": false,
 *   "error": "Section not found" 
 * }
 * 
 * {
 *   "success": false,
 *   "error": "No valid settings to update"
 * }
 * 
 * {
 *   "success": false,
 *   "error": "Failed to update section settings",
 *   "details": "Invalid JSON in layout_settings"
 * }
 */
router.put('/:modelSlug/sections/:id/settings', async (req, res) => {
  try {
    const { modelSlug, id } = req.params;
    const settings = req.body || {};
    const model = await getModelBySlug(modelSlug);
    if (!model) return res.fail(404, 'Model not found');

    // Validate section exists and belongs to model
    const sectionRows = await db.query(
      'SELECT id FROM gallery_sections WHERE id = ? AND model_id = ?',
      [parseInt(id), model.id]
    );
    if (sectionRows.length === 0) return res.fail(404, 'Section not found');

    const fields = [];
    const params = [];
    
    // Define all settable fields with validation
    const settableFields = {
      // Layout settings
      layout_type: (value) => ['grid', 'masonry', 'carousel', 'lightbox_grid'].includes(value) ? value : null,
      images_per_row: (value) => [2, 3, 4, 6].includes(parseInt(value)) ? parseInt(value) : 3,
      
      // Display options
      show_captions: (value) => Boolean(value),
      enable_lightbox: (value) => Boolean(value),
      show_image_count: (value) => Boolean(value),
      enable_download: (value) => Boolean(value),
      enable_zoom: (value) => Boolean(value),
      lazy_loading: (value) => Boolean(value),
      
      // Image configuration
      image_size: (value) => ['small', 'medium', 'large', 'original'].includes(value) ? value : 'medium',
      image_quality: (value) => {
        const num = parseInt(value);
        return (num >= 60 && num <= 100) ? num : 80;
      },
      image_sort_order: (value) => ['order_index', 'created_at', 'created_at_desc', 'filename', 'filename_desc'].includes(value) ? value : null,
      
      // Access control
      is_visible: (value) => Boolean(value),
      require_auth: (value) => Boolean(value),
      members_only: (value) => Boolean(value),
      show_in_nav: (value) => Boolean(value),
      
      // SEO settings
      seo_description: (value) => typeof value === 'string' ? value.trim().substring(0, 500) : '',
      seo_keywords: (value) => typeof value === 'string' ? value.trim().substring(0, 255) : '',
      canonical_url: (value) => typeof value === 'string' ? value.trim().substring(0, 255) : '',
      
      // Layout-specific settings as JSON with enhanced validation
      layout_settings: (value) => {
        if (typeof value === 'string') {
          try {
            const parsed = JSON.parse(value);
            
            // Validate that it's an object
            if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
              logger.warn('layout_settings validation failed: not an object', { value });
              return null;
            }
            
            // Basic validation for common settings patterns
            for (const [key, val] of Object.entries(parsed)) {
              // Ensure keys follow expected naming patterns
              if (!key.match(/^(grid|masonry|carousel|lightbox)[A-Z][a-zA-Z]*$/)) {
                logger.warn('layout_settings validation warning: unexpected key pattern', { key, value: val });
              }
              
              // Ensure values are reasonable types
              if (typeof val !== 'string' && typeof val !== 'number' && typeof val !== 'boolean') {
                logger.warn('layout_settings validation failed: invalid value type', { key, value: val, type: typeof val });
                return null;
              }
            }
            
            return value; // Return original string for database storage
          } catch (e) {
            logger.warn('layout_settings validation failed: invalid JSON', { value, error: e.message });
            return null;
          }
        }
        return null;
      }
    };

    // Process each setting
    for (const [key, validator] of Object.entries(settableFields)) {
      if (settings[key] !== undefined) {
        const validatedValue = validator(settings[key]);
        if (validatedValue !== null) {
          fields.push(`${key} = ?`);
          params.push(validatedValue);
        }
      }
    }

    if (fields.length === 0) {
      return res.fail(400, 'No valid settings to update');
    }

    // Update the section
    params.push(model.id, parseInt(id));
    await db.query(
      `UPDATE gallery_sections SET ${fields.join(', ')} WHERE model_id = ? AND id = ?`,
      params
    );

    // Return updated section with properly parsed layout_settings
    const updatedRows = await db.query(
      'SELECT * FROM gallery_sections WHERE model_id = ? AND id = ?',
      [model.id, parseInt(id)]
    );

    // Parse layout_settings JSON for the response
    if (updatedRows[0] && updatedRows[0].layout_settings) {
      try {
        updatedRows[0].layout_settings = JSON.parse(updatedRows[0].layout_settings);
      } catch (e) {
        // If parsing fails, keep as string but log warning
        logger.warn('Failed to parse layout_settings JSON in response', {
          section_id: parseInt(id),
          layout_settings: updatedRows[0].layout_settings,
          error: e.message
        });
      }
    }

    logger.info('Gallery section settings updated', {
      model_slug: modelSlug,
      section_id: parseInt(id),
      updated_fields: Object.keys(settableFields).filter(key => settings[key] !== undefined),
      layout_type: settings.layout_type,
      has_layout_settings: !!settings.layout_settings,
      ip: req.ip
    });

    return res.success({ section: updatedRows[0] });
  } catch (error) {
    logger.error('model-gallery.update-section-settings error', { error: error.message });
    return res.fail(500, 'Failed to update section settings', error.message);
  }
});
// POST /api/model-gallery/:modelSlug/sections  (create section)
router.post('/:modelSlug/sections', async (req, res) => {
  try {
    const { modelSlug } = req.params;
    const { title, layout_type = 'grid' } = req.body || {};
    if (!title || !title.trim()) return res.fail(400, 'Title is required');
    const model = await getModelBySlug(modelSlug);
    if (!model) return res.fail(404, 'Model not found');

    const allowedLayouts = new Set(['grid','masonry','carousel','lightbox_grid']);
    const layout = allowedLayouts.has(layout_type) ? layout_type : 'grid';

    const result = await db.query(
      'INSERT INTO gallery_sections (model_id, title, layout_type, sort_order) VALUES (?, ?, ?, ?)',
      [model.id, title.trim(), layout, 0]
    );

    const sectionId = result.insertId;
    const rows = await db.query('SELECT * FROM gallery_sections WHERE id = ?', [sectionId]);
    return res.success({ section: rows[0] }, 201);
  } catch (error) {
    logger.error('model-gallery.create-section error', { error: error.message });
    return res.fail(500, 'Failed to create section', error.message);
  }
});

// PUT /api/model-gallery/:modelSlug/sections/:id (update editable fields)
router.put('/:modelSlug/sections/:id', async (req, res) => {
  try {
    const { modelSlug, id } = req.params;
    const updates = req.body || {};
    const model = await getModelBySlug(modelSlug);
    if (!model) return res.fail(404, 'Model not found');

    const fields = [];
    const params = [];
    const editable = {
      title: 'title',
      layout_type: 'layout_type',
      grid_columns: 'grid_columns',
      enable_filters: 'enable_filters',
      enable_lightbox: 'enable_lightbox',
      enable_fullscreen: 'enable_fullscreen',
      default_filter: 'default_filter',
      is_visible: 'is_visible',
      sort_order: 'sort_order',
    };
    for (const key of Object.keys(editable)) {
      if (updates[key] !== undefined) {
        fields.push(`${editable[key]} = ?`);
        params.push(updates[key]);
      }
    }
    if (!fields.length) return res.fail(400, 'No valid fields to update');

    params.push(model.id, parseInt(id));
    await db.query(
      `UPDATE gallery_sections SET ${fields.join(', ')} WHERE model_id = ? AND id = ?`,
      params
    );

    const rows = await db.query('SELECT * FROM gallery_sections WHERE model_id = ? AND id = ?', [model.id, parseInt(id)]);
    if (!rows.length) return res.fail(404, 'Section not found');
    return res.success({ section: rows[0] });
  } catch (error) {
    logger.error('model-gallery.update-section error', { error: error.message });
    return res.fail(500, 'Failed to update section', error.message);
  }
});

// DELETE /api/model-gallery/:modelSlug/sections/:id
router.delete('/:modelSlug/sections/:id', async (req, res) => {
  try {
    const { modelSlug, id } = req.params;
    const model = await getModelBySlug(modelSlug);
    if (!model) return res.fail(404, 'Model not found');
    const result = await db.query('DELETE FROM gallery_sections WHERE model_id = ? AND id = ?', [model.id, parseInt(id)]);
    if (result.affectedRows === 0) return res.fail(404, 'Section not found');
    return res.success({ deleted: true });
  } catch (error) {
    logger.error('model-gallery.delete-section error', { error: error.message });
    return res.fail(500, 'Failed to delete section', error.message);
  }
});

// PATCH /api/model-gallery/:modelSlug/sections/reorder  { items:[{id, sort_order}] }
router.patch('/:modelSlug/sections/reorder', async (req, res) => {
  try {
    const { modelSlug } = req.params;
    const { items } = req.body || {};
    const model = await getModelBySlug(modelSlug);
    if (!model) return res.fail(404, 'Model not found');
    if (!Array.isArray(items) || !items.length) return res.fail(400, 'items[] required');
    for (const it of items) {
      if (typeof it?.id === 'undefined' || typeof it?.sort_order === 'undefined') continue;
      await db.query('UPDATE gallery_sections SET sort_order = ? WHERE id = ? AND model_id = ?', [
        parseInt(it.sort_order), parseInt(it.id), model.id
      ]);
    }
    const rows = await db.query('SELECT * FROM gallery_sections WHERE model_id = ? ORDER BY sort_order ASC, created_at DESC', [model.id]);
    return res.success({ sections: rows });
  } catch (error) {
    logger.error('model-gallery.sections-reorder error', { error: error.message });
    return res.fail(500, 'Failed to reorder sections', error.message);
  }
});

// PATCH /api/model-gallery/:modelSlug/sections/bulk { action: 'show'|'hide'|'delete', ids: [] }
router.patch('/:modelSlug/sections/bulk', async (req, res) => {
  try {
    const { modelSlug } = req.params;
    const { action, ids } = req.body || {};
    const model = await getModelBySlug(modelSlug);
    if (!model) return res.fail(404, 'Model not found');
    if (!Array.isArray(ids) || ids.length === 0) return res.fail(400, 'ids[] required');
    const idInts = ids.map((v) => parseInt(v)).filter((v) => Number.isInteger(v));
    const placeholders = idInts.map(() => '?').join(',');
    if (action === 'show' || action === 'hide') {
      const desired = action === 'show' ? 1 : 0;
      await db.query(`UPDATE gallery_sections SET is_visible = ? WHERE model_id = ? AND id IN (${placeholders})`, [desired, model.id, ...idInts]);
    } else if (action === 'delete') {
      await db.query(`DELETE FROM gallery_sections WHERE model_id = ? AND id IN (${placeholders})`, [model.id, ...idInts]);
    } else {
      return res.fail(400, 'Invalid action');
    }
    return res.success({ updated: idInts.length, action });
  } catch (error) {
    logger.error('model-gallery.sections-bulk error', { error: error.message });
    return res.fail(500, 'Failed to apply bulk action', error.message);
  }
});
// PATCH /api/model-gallery/:modelSlug/sections/:id/visibility (toggle visibility)
router.patch('/:modelSlug/sections/:id/visibility', async (req, res) => {
  try {
    const { modelSlug, id } = req.params;
    const { is_visible } = req.body || {};
    const model = await getModelBySlug(modelSlug);
    if (!model) return res.fail(404, 'Model not found');

    const desired = is_visible ? 1 : 0;
    const result = await db.query('UPDATE gallery_sections SET is_visible = ? WHERE model_id = ? AND id = ?', [desired, model.id, parseInt(id)]);
    if (result.affectedRows === 0) return res.fail(404, 'Section not found');

    const rows = await db.query('SELECT * FROM gallery_sections WHERE id = ?', [parseInt(id)]);
    return res.success({ section: rows[0] });
  } catch (error) {
    logger.error('model-gallery.visibility-section error', { error: error.message });
    return res.fail(500, 'Failed to update visibility', error.message);
  }
});

// PATCH /api/model-gallery/:modelSlug/sections/:id/paywall
router.patch('/:modelSlug/sections/:id/paywall', async (req, res) => {
  try {
    const { modelSlug, id } = req.params;
    const { members_only } = req.body || {};
    const model = await getModelBySlug(modelSlug);
    if (!model) return res.fail(404, 'Model not found');

    const desired = members_only ? 1 : 0;
    const result = await db.query('UPDATE gallery_sections SET members_only = ? WHERE model_id = ? AND id = ?', [desired, model.id, parseInt(id)]);
    if (result.affectedRows === 0) return res.fail(404, 'Section not found');

    const rows = await db.query('SELECT * FROM gallery_sections WHERE id = ?', [parseInt(id)]);
    
    logger.info('Gallery section paywall status updated', {
      model_slug: modelSlug,
      section_id: parseInt(id),
      members_only: desired,
      ip: req.ip
    });
    
    return res.success({ section: rows[0] });
  } catch (error) {
    logger.error('model-gallery.paywall-section error', { error: error.message });
    return res.fail(500, 'Failed to update paywall status', error.message);
  }
});

// GET /api/model-gallery/:modelSlug/image-seo-data/:filename
// Get SEO information for a specific image
router.get('/:modelSlug/image-seo-data/:filename', async (req, res) => {
  try {
    const { modelSlug, filename } = req.params;
    
    const model = await getModelBySlug(modelSlug);
    if (!model) return res.fail(404, 'Model not found');
    
    // Query both model_media_library and content_moderation for comprehensive SEO data
    const seoQuery = `
      SELECT 
        mml.id,
        mml.filename,
        mml.alt_text,
        mml.caption as description,
        mml.image_width as width,
        mml.image_height as height,
        mml.file_size,
        mml.moderation_status,
        cm.venice_seo_keywords,
        cm.venice_alt_text,
        cm.venice_brief_description,
        cm.venice_detailed_description,
        cm.description_text,
        cm.moderation_status as detailed_moderation_status,
        cm.created_at as moderation_date
      FROM model_media_library mml
      LEFT JOIN content_moderation cm ON (
        cm.model_id = ? 
        AND cm.original_path LIKE CONCAT('%', mml.filename)
      )
      WHERE mml.model_slug = ? 
        AND mml.filename = ?
        AND mml.is_deleted = 0
      ORDER BY cm.created_at DESC
      LIMIT 1
    `;
    
    const results = await db.query(seoQuery, [model.id, modelSlug, filename]);
    
    if (!results || results.length === 0) {
      return res.success({
        seoData: null,
        message: 'Image not found or no SEO data available'
      });
    }
    
    const imageData = results[0];
    
    // Parse Venice keywords if available
    let keywords = [];
    if (imageData.venice_seo_keywords) {
      try {
        keywords = JSON.parse(imageData.venice_seo_keywords);
      } catch (e) {
        console.warn('Failed to parse Venice SEO keywords:', e.message);
      }
    }
    
    // Determine the best alt text and description sources
    const seoData = {
      id: imageData.id,
      filename: imageData.filename,
      alt_text: imageData.venice_alt_text || imageData.alt_text || null,
      description: imageData.venice_brief_description || imageData.description || imageData.description_text || null,
      detailed_description: imageData.venice_detailed_description || null,
      keywords: keywords,
      width: imageData.width,
      height: imageData.height,
      file_size: imageData.file_size,
      moderation_status: imageData.moderation_status,
      has_venice_data: !!(imageData.venice_seo_keywords || imageData.venice_alt_text),
      moderation_date: imageData.moderation_date
    };
    
    res.set('Cache-Control', 'private, max-age=300'); // Cache for 5 minutes
    return res.success({ 
      seoData,
      debug: {
        model_id: model.id,
        query_filename: filename,
        venice_keywords_raw: imageData.venice_seo_keywords,
        has_moderation_data: !!imageData.moderation_date
      }
    });
    
  } catch (error) {
    logger.error('Error fetching image SEO data:', error);
    return res.fail(500, 'Failed to fetch SEO data', error.message);
  }
});

module.exports = router;

