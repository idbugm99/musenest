const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const logger = require('../../utils/logger');

async function getModelBySlug(slug) {
  const rows = await db.query('SELECT id, slug, name FROM models WHERE slug = ? LIMIT 1', [slug]);
  return rows && rows[0] ? rows[0] : null;
}

// List distinct pages for a model
router.get('/:modelSlug/pages', async (req, res) => {
  try {
    const { modelSlug } = req.params;
    const model = await getModelBySlug(modelSlug);
    if (!model) return res.fail(404, 'Model not found');
    const rows = await db.query(
      'SELECT DISTINCT page_type_id FROM content_templates WHERE model_id = ? ORDER BY page_type_id ASC',
      [model.id]
    );
    const defaults = [1,2,3,4,5];
    const ids = rows.length ? rows.map(r => r.page_type_id) : defaults;
    return res.success({ pages: ids });
  } catch (error) {
    logger.error('model-content.list-pages error', { error: error.message });
    return res.fail(500, 'Failed to load pages', error.message);
  }
});

// List content keys for a page type
router.get('/:modelSlug/pages/:pageTypeId', async (req, res) => {
  try {
    const { modelSlug, pageTypeId } = req.params;
    const model = await getModelBySlug(modelSlug);
    if (!model) return res.fail(404, 'Model not found');
    const rows = await db.query(
      'SELECT content_key, content_value, content_type FROM content_templates WHERE model_id = ? AND page_type_id = ? ORDER BY content_key ASC',
      [model.id, parseInt(pageTypeId)]
    );
    res.set('Cache-Control', 'private, max-age=10');
    return res.success({ items: rows });
  } catch (error) {
    logger.error('model-content.get-page error', { error: error.message });
    return res.fail(500, 'Failed to load content', error.message);
  }
});

// Upsert a content key (with audit)
router.put('/:modelSlug/pages/:pageTypeId/:contentKey', async (req, res) => {
  try {
    const { modelSlug, pageTypeId, contentKey } = req.params;
    const { content_value, reason = null, admin_user_id = null, content_type = 'text' } = req.body || {};
    if (typeof content_value === 'undefined') return res.fail(400, 'content_value is required');
    const model = await getModelBySlug(modelSlug);
    if (!model) return res.fail(404, 'Model not found');

    const existing = await db.query(
      'SELECT id, content_value FROM content_templates WHERE model_id = ? AND page_type_id = ? AND content_key = ? LIMIT 1',
      [model.id, parseInt(pageTypeId), contentKey]
    );
    const previousValue = existing[0]?.content_value || null;
    if (existing.length) {
      await db.query(
        'UPDATE content_templates SET content_value = ?, content_type = ?, updated_at = NOW() WHERE id = ?',
        [content_value, content_type, existing[0].id]
      );
    } else {
      await db.query(
        'INSERT INTO content_templates (model_id, page_type_id, content_key, content_value, content_type, updated_at) VALUES (?, ?, ?, ?, ?, NOW())',
        [model.id, parseInt(pageTypeId), contentKey, content_value, content_type]
      );
    }
    // Audit log
    await db.query(
      'INSERT INTO content_change_log (model_id, page_type_id, content_key, previous_value, new_value, reason, admin_user_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [model.id, parseInt(pageTypeId), contentKey, previousValue, content_value, reason, admin_user_id]
    );
    return res.success({ saved: true });
  } catch (error) {
    logger.error('model-content.upsert error', { error: error.message });
    return res.fail(500, 'Failed to save content', error.message);
  }
});

// Audit list
router.get('/:modelSlug/audit', async (req, res) => {
  try {
    const { modelSlug } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const perPage = Math.max(1, Math.min(100, parseInt(limit)));
    const currentPage = Math.max(1, parseInt(page));
    const offset = (currentPage - 1) * perPage;
    const model = await getModelBySlug(modelSlug);
    if (!model) return res.fail(404, 'Model not found');
    const countRows = await db.query('SELECT COUNT(*) as total FROM content_change_log WHERE model_id = ?', [model.id]);
    const total = countRows[0]?.total || 0;
    const rows = await db.query(
      `SELECT * FROM content_change_log WHERE model_id = ? ORDER BY created_at DESC LIMIT ${perPage} OFFSET ${offset}`,
      [model.id]
    );
    return res.success({ audit: rows, pagination: { page: currentPage, limit: perPage, total, pages: Math.ceil(total / perPage) } });
  } catch (error) {
    logger.error('model-content.audit error', { error: error.message });
    return res.fail(500, 'Failed to load audit', error.message);
  }
});

module.exports = router;

