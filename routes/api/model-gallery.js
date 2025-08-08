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

