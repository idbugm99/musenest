const express = require('express');
const router = express.Router();
const db = require('../../src/config/db');
const logger = require('../../utils/logger');

// Resolve model id from slug helper
async function getModelBySlug(slug) {
  const [rows] = await db.execute('SELECT id, slug, name FROM models WHERE slug = ? LIMIT 1', [slug]);
  return rows[0] || null;
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

    const [countRows] = await db.execute(`SELECT COUNT(*) as total FROM gallery_sections ${whereSql}`, params);
    const total = countRows[0]?.total || 0;

    const [rows] = await db.execute(
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

