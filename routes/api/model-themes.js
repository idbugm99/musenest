const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const logger = require('../../utils/logger');

async function getModelBySlug(slug){
  const rows = await db.query('SELECT id, slug, name FROM models WHERE slug = ? LIMIT 1', [slug]);
  return rows && rows[0] ? rows[0] : null;
}

router.get('/:modelSlug', async (req, res) => {
  try {
    const model = await getModelBySlug(req.params.modelSlug);
    if (!model) return res.fail(404, 'Model not found');
    const rows = await db.query('SELECT * FROM model_themes WHERE model_id = ? ORDER BY created_at DESC', [model.id]);
    return res.success({ themes: rows });
  } catch (error) {
    logger.error('model-themes.list error', { error: error.message });
    return res.fail(500, 'Failed to load themes', error.message);
  }
});

router.post('/:modelSlug', async (req, res) => {
  try {
    const model = await getModelBySlug(req.params.modelSlug);
    if (!model) return res.fail(404, 'Model not found');
    const { theme_name, primary_color, secondary_color, accent_color } = req.body || {};
    if (!theme_name || !primary_color || !secondary_color || !accent_color) return res.fail(400, 'Missing fields');
    const result = await db.query('INSERT INTO model_themes (model_id, theme_name, primary_color, secondary_color, accent_color, is_active) VALUES (?, ?, ?, ?, ?, 1)', [model.id, theme_name, primary_color, secondary_color, accent_color]);
    const rows = await db.query('SELECT * FROM model_themes WHERE id = ?', [result.insertId]);
    return res.success({ theme: rows[0] }, 201);
  } catch (error) {
    logger.error('model-themes.create error', { error: error.message });
    return res.fail(500, 'Failed to create theme', error.message);
  }
});

router.put('/:modelSlug/:id', async (req, res) => {
  try {
    const model = await getModelBySlug(req.params.modelSlug);
    if (!model) return res.fail(404, 'Model not found');
    const { theme_name, primary_color, secondary_color, accent_color, is_active } = req.body || {};
    await db.query(
      'UPDATE model_themes SET theme_name = COALESCE(?, theme_name), primary_color = COALESCE(?, primary_color), secondary_color = COALESCE(?, secondary_color), accent_color = COALESCE(?, accent_color), is_active = COALESCE(?, is_active) WHERE id = ? AND model_id = ?',
      [theme_name, primary_color, secondary_color, accent_color, typeof is_active === 'undefined' ? null : (is_active ? 1 : 0), parseInt(req.params.id), model.id]
    );
    const rows = await db.query('SELECT * FROM model_themes WHERE id = ?', [parseInt(req.params.id)]);
    return res.success({ theme: rows[0] });
  } catch (error) {
    logger.error('model-themes.update error', { error: error.message });
    return res.fail(500, 'Failed to update theme', error.message);
  }
});

router.delete('/:modelSlug/:id', async (req, res) => {
  try {
    const model = await getModelBySlug(req.params.modelSlug);
    if (!model) return res.fail(404, 'Model not found');
    await db.query('DELETE FROM model_themes WHERE id = ? AND model_id = ?', [parseInt(req.params.id), model.id]);
    return res.success({ deleted: true });
  } catch (error) {
    logger.error('model-themes.delete error', { error: error.message });
    return res.fail(500, 'Failed to delete theme', error.message);
  }
});

module.exports = router;


