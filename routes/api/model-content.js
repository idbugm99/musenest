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
    const defRows = await db.query(
      'SELECT DISTINCT page_type_id FROM content_field_definitions WHERE model_id IS NULL OR model_id = ? ORDER BY page_type_id ASC',
      [model.id]
    );
    const tplRows = await db.query(
      'SELECT DISTINCT page_type_id FROM content_templates WHERE model_id = ? ORDER BY page_type_id ASC',
      [model.id]
    );
    const set = new Set();
    defRows.forEach(r => set.add(r.page_type_id));
    tplRows.forEach(r => set.add(r.page_type_id));
    let ids = Array.from(set);
    if (ids.length === 0) ids = [1,2,3,5,16]; // sensible defaults
    ids.sort((a,b)=>a-b);
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
    const pid = parseInt(pageTypeId);
    // Prefer definitions-first so pages render even without existing content rows
    let rows = await db.query(
      `SELECT 
         cfd.content_key,
         COALESCE(ct.content_value, '') AS content_value,
         COALESCE(cfd.input_type, ct.content_type, 'text') AS input_type,
         COALESCE(cfd.label, cfd.content_key) AS label,
         cfd.help_text,
         cfd.is_required,
         cfd.group_label,
         cfd.section_order,
         cfd.field_order,
         cfd.options_json
       FROM content_field_definitions cfd
       LEFT JOIN content_templates ct
         ON ct.model_id = ? AND ct.page_type_id = cfd.page_type_id AND ct.content_key = cfd.content_key
       WHERE (cfd.model_id IS NULL OR cfd.model_id = ?)
         AND cfd.page_type_id = ?
       ORDER BY cfd.section_order ASC, cfd.field_order ASC, cfd.content_key ASC`,
      [model.id, model.id, pid]
    );
    // If definitions exist, also include any extra saved keys that don't yet have a definition
    if (rows.length) {
      const defKeys = new Set(rows.map(r => r.content_key));
      const extra = await db.query(
        `SELECT ct.content_key,
                ct.content_value,
                ct.content_type AS input_type,
                ct.content_key AS label,
                NULL AS help_text,
                0 AS is_required,
                NULL AS group_label,
                999 AS section_order,
                999 AS field_order,
                NULL AS options_json
         FROM content_templates ct
         WHERE ct.model_id = ? AND ct.page_type_id = ?`,
        [model.id, pid]
      );
      for (const r of extra) {
        if (!defKeys.has(r.content_key)) rows.push(r);
      }
    }
    // Fallback: if no definitions at all, return whatever exists as before
    if (!rows.length) {
      rows = await db.query(
        `SELECT ct.content_key, ct.content_value, ct.content_type AS input_type,
                ct.content_key AS label, NULL AS help_text, 0 AS is_required,
                NULL AS group_label, 0 AS section_order, 0 AS field_order, NULL AS options_json
         FROM content_templates ct
         WHERE ct.model_id = ? AND ct.page_type_id = ?
         ORDER BY ct.content_key ASC`,
        [model.id, pid]
      );
    }
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

// Rollback a change by log id
router.post('/:modelSlug/rollback', async (req, res) => {
  try {
    const { modelSlug } = req.params;
    const { log_id, reason = 'rollback' } = req.body || {};
    if (!log_id) return res.fail(400, 'log_id is required');
    const model = await getModelBySlug(modelSlug);
    if (!model) return res.fail(404, 'Model not found');
    const rows = await db.query('SELECT * FROM content_change_log WHERE id = ? AND model_id = ? LIMIT 1', [parseInt(log_id), model.id]);
    if (!rows.length) return res.fail(404, 'Change not found');
    const entry = rows[0];
    // Upsert previous_value back into content_templates
    const existing = await db.query(
      'SELECT id FROM content_templates WHERE model_id = ? AND page_type_id = ? AND content_key = ? LIMIT 1',
      [model.id, entry.page_type_id, entry.content_key]
    );
    if (existing.length) {
      await db.query('UPDATE content_templates SET content_value = ?, updated_at = NOW() WHERE id = ?', [entry.previous_value, existing[0].id]);
    } else {
      await db.query(
        'INSERT INTO content_templates (model_id, page_type_id, content_key, content_value, content_type, updated_at) VALUES (?, ?, ?, ?, ?, NOW())',
        [model.id, entry.page_type_id, entry.content_key, entry.previous_value, 'text']
      );
    }
    // Log the rollback action (new log row)
    await db.query(
      'INSERT INTO content_change_log (model_id, page_type_id, content_key, previous_value, new_value, reason, admin_user_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [model.id, entry.page_type_id, entry.content_key, entry.new_value, entry.previous_value, `rollback:${reason}`, null]
    );
    return res.success({ rolled_back: true });
  } catch (error) {
    logger.error('model-content.rollback error', { error: error.message });
    return res.fail(500, 'Failed to rollback change', error.message);
  }
});

module.exports = router;

