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
    const rows = await db.query('SELECT * FROM calendar_availability WHERE model_id = ? ORDER BY start_date ASC', [model.id]);
    return res.success({ periods: rows });
  } catch (error) {
    logger.error('calendar.list error', { error: error.message });
    return res.fail(500, 'Failed to load calendar', error.message);
  }
});

router.post('/:modelSlug', async (req, res) => {
  try {
    const model = await getModelBySlug(req.params.modelSlug);
    if (!model) return res.fail(404, 'Model not found');
    const { start_date, end_date, all_day = 1, location = null, status = 'available', color = null, notes = null } = req.body || {};
    if (!start_date || !end_date) return res.fail(400, 'start_date and end_date required');
    const result = await db.query('INSERT INTO calendar_availability (model_id, start_date, end_date, all_day, location, status, color, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [model.id, start_date, end_date, all_day ? 1 : 0, location, status, color, notes]);
    const rows = await db.query('SELECT * FROM calendar_availability WHERE id = ?', [result.insertId]);
    return res.success({ period: rows[0] }, 201);
  } catch (error) {
    logger.error('calendar.create error', { error: error.message });
    return res.fail(500, 'Failed to add period', error.message);
  }
});

router.delete('/:modelSlug/:id', async (req, res) => {
  try {
    const model = await getModelBySlug(req.params.modelSlug);
    if (!model) return res.fail(404, 'Model not found');
    await db.query('DELETE FROM calendar_availability WHERE id = ? AND model_id = ?', [parseInt(req.params.id), model.id]);
    return res.success({ deleted: true });
  } catch (error) {
    logger.error('calendar.delete error', { error: error.message });
    return res.fail(500, 'Failed to delete period', error.message);
  }
});

module.exports = router;


