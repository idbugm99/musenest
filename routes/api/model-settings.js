const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const logger = require('../../utils/logger');

async function getModelBySlug(slug){
  const rows = await db.query('SELECT id, slug, name FROM models WHERE slug = ? LIMIT 1', [slug]);
  return rows && rows[0] ? rows[0] : null;
}

// GET all settings for a model
router.get('/:modelSlug', async (req, res) => {
  try {
    const model = await getModelBySlug(req.params.modelSlug);
    if (!model) return res.fail(404, 'Model not found');
    const rows = await db.query('SELECT setting_key, setting_value FROM model_settings WHERE model_id = ? ORDER BY setting_key ASC', [model.id]);
    const settings = {};
    for (const r of rows) settings[r.setting_key] = r.setting_value;
    return res.success({ settings, model: { id: model.id, slug: model.slug, name: model.name } });
  } catch (error) {
    logger.error('model-settings.list error', { error: error.message });
    return res.fail(500, 'Failed to load settings', error.message);
  }
});

// PUT bulk update
router.put('/:modelSlug', async (req, res) => {
  try {
    const model = await getModelBySlug(req.params.modelSlug);
    if (!model) return res.fail(404, 'Model not found');
    const updates = req.body || {};
    const keys = Object.keys(updates);
    for (const key of keys){
      const value = updates[key];
      await db.query(
        'INSERT INTO model_settings (model_id, setting_key, setting_value) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = CURRENT_TIMESTAMP',
        [model.id, key, value]
      );
    }
    return res.success({ saved: keys.length });
  } catch (error) {
    logger.error('model-settings.update error', { error: error.message });
    return res.fail(500, 'Failed to save settings', error.message);
  }
});

module.exports = router;


