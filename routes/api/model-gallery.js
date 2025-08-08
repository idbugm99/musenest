const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const logger = require('../../utils/logger');

// Resolve model id from slug helper
async function getModelBySlug(slug) {
  const rows = await db.query('SELECT id, slug, name FROM models WHERE slug = ? LIMIT 1', [slug]);
  return rows && rows[0] ? rows[0] : null;
}

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
    const model = await getModelBySlug(modelSlug);
    if (!model) return res.fail(404, 'Model not found');
    const images = await db.query(
      'SELECT id, section_id, model_id, filename, caption, tags, is_active, order_index, created_at, updated_at FROM gallery_images WHERE model_id = ? AND section_id = ? ORDER BY order_index ASC, id ASC',
      [model.id, parseInt(id)]
    );
    res.set('Cache-Control', 'private, max-age=10');
    return res.success({ images });
  } catch (error) {
    logger.error('model-gallery.list-images error', { error: error.message });
    return res.fail(500, 'Failed to load images', error.message);
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

