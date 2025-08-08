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
    const rows = await db.query('SELECT * FROM testimonials WHERE model_id = ? ORDER BY created_at DESC', [model.id]);
    return res.success({ testimonials: rows });
  } catch (error) {
    logger.error('testimonials.list error', { error: error.message });
    return res.fail(500, 'Failed to load testimonials', error.message);
  }
});

router.post('/:modelSlug', async (req, res) => {
  try {
    const model = await getModelBySlug(req.params.modelSlug);
    if (!model) return res.fail(404, 'Model not found');
    const { client_name, rating = 5, testimonial_text, is_featured = 0 } = req.body || {};
    if (!client_name || !testimonial_text) return res.fail(400, 'client_name and testimonial_text required');
    const result = await db.query('INSERT INTO testimonials (model_id, client_name, rating, testimonial_text, is_featured) VALUES (?, ?, ?, ?, ?)', [model.id, client_name, parseInt(rating), testimonial_text, is_featured ? 1 : 0]);
    const rows = await db.query('SELECT * FROM testimonials WHERE id = ?', [result.insertId]);
    return res.success({ testimonial: rows[0] }, 201);
  } catch (error) {
    logger.error('testimonials.create error', { error: error.message });
    return res.fail(500, 'Failed to create testimonial', error.message);
  }
});

router.put('/:modelSlug/:id', async (req, res) => {
  try {
    const model = await getModelBySlug(req.params.modelSlug);
    if (!model) return res.fail(404, 'Model not found');
    const { client_name, rating, testimonial_text, is_featured } = req.body || {};
    await db.query('UPDATE testimonials SET client_name = COALESCE(?, client_name), rating = COALESCE(?, rating), testimonial_text = COALESCE(?, testimonial_text), is_featured = COALESCE(?, is_featured) WHERE id = ? AND model_id = ?', [client_name, rating, testimonial_text, typeof is_featured === 'undefined' ? null : (is_featured ? 1 : 0), parseInt(req.params.id), model.id]);
    const rows = await db.query('SELECT * FROM testimonials WHERE id = ?', [parseInt(req.params.id)]);
    return res.success({ testimonial: rows[0] });
  } catch (error) {
    logger.error('testimonials.update error', { error: error.message });
    return res.fail(500, 'Failed to update testimonial', error.message);
  }
});

router.delete('/:modelSlug/:id', async (req, res) => {
  try {
    const model = await getModelBySlug(req.params.modelSlug);
    if (!model) return res.fail(404, 'Model not found');
    await db.query('DELETE FROM testimonials WHERE id = ? AND model_id = ?', [parseInt(req.params.id), model.id]);
    return res.success({ deleted: true });
  } catch (error) {
    logger.error('testimonials.delete error', { error: error.message });
    return res.fail(500, 'Failed to delete testimonial', error.message);
  }
});

module.exports = router;


