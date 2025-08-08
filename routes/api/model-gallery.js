const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const logger = require('../../utils/logger');

// Sections list
router.get('/sections', async (req, res) => {
  try {
    const { model_id, page = 1, limit = 20, search = '' } = req.query;
    const perPage = Math.max(1, Math.min(100, parseInt(limit)));
    const currentPage = Math.max(1, parseInt(page));
    const offset = (currentPage - 1) * perPage;
    const params = [];
    const where = [];
    if (model_id) { where.push('model_id = ?'); params.push(parseInt(model_id)); }
    if (search) { where.push('title LIKE ?'); params.push(`%${search}%`); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [countRows] = await db.execute(`SELECT COUNT(*) as total FROM gallery_sections ${whereSql}`, params);
    const total = countRows[0]?.total || 0;
    const [rows] = await db.execute(
      `SELECT * FROM gallery_sections ${whereSql} ORDER BY sort_order ASC, created_at DESC LIMIT ${perPage} OFFSET ${offset}`,
      params
    );
    res.set('Cache-Control', 'private, max-age=10');
    return res.success({ sections: rows, pagination: { page: currentPage, limit: perPage, total, pages: Math.ceil(total / perPage) } });
  } catch (error) {
    logger.error('model-gallery.sections error', { error: error.message });
    return res.fail(500, 'Failed to load sections', error.message);
  }
});

module.exports = router;

