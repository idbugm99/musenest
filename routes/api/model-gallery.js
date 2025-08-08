const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const logger = require('../../utils/logger');
const multer = require('multer');
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

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
      `SELECT * FROM gallery_sections ${whereSql} ORDER BY sort_order ASC, created_at DESC LIMIT ${perPage} OFFSET ${offset}`,
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
      'SELECT COUNT(*) as total FROM gallery_images WHERE model_id = ? AND section_id = ?',
      [model.id, parseInt(id)]
    );
    const total = countRows[0]?.total || 0;
    const images = await db.query(
      `SELECT 
         gi.id, gi.section_id, gi.model_id, gi.filename, gi.caption, gi.tags, gi.is_active, gi.order_index, gi.created_at, gi.updated_at,
         (
           SELECT cm.moderation_status 
           FROM content_moderation cm 
           WHERE cm.model_id = gi.model_id 
             AND (cm.image_path LIKE CONCAT('%/', gi.filename) OR cm.final_location LIKE CONCAT('%/', gi.filename))
           ORDER BY cm.created_at DESC 
           LIMIT 1
         ) AS moderation_status,
         (
           SELECT cm.blurred_path
           FROM content_moderation cm 
           WHERE cm.model_id = gi.model_id 
             AND (cm.image_path LIKE CONCAT('%/', gi.filename) OR cm.final_location LIKE CONCAT('%/', gi.filename))
           ORDER BY cm.created_at DESC 
           LIMIT 1
         ) AS blurred_path
       FROM gallery_images gi 
       WHERE gi.model_id = ? AND gi.section_id = ? 
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

// GET /api/model-gallery/:modelSlug/uploads-list?path=public (list available files under /public/uploads/:slug/<path>)
router.get('/:modelSlug/uploads-list', async (req, res) => {
  try {
    const { modelSlug } = req.params;
    const { sub = 'public' } = req.query; // default to public
    const safeSub = String(sub || 'public').replace(/\.\.+/g, '').replace(/^\//, '');
    const root = path.join(process.cwd(), 'public', 'uploads', modelSlug, safeSub);
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

module.exports = router;
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

