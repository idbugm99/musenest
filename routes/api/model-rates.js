const express = require('express');
const router = express.Router();
const db = require('../../config/database');

async function getModel(slug){
  const rows = await db.query('SELECT id FROM models WHERE slug = ? LIMIT 1', [slug]);
  return rows[0];
}

// List all rates and terms
router.get('/:slug', async (req, res) => {
  try{
    const m = await getModel(req.params.slug);
    if (!m) return res.fail(404, 'Model not found');
    const [incall, outcall, extended, payment, additional] = await Promise.all([
      db.query('SELECT * FROM model_rates WHERE model_id = ? AND rate_type = "incall" ORDER BY sort_order, id', [m.id]),
      db.query('SELECT * FROM model_rates WHERE model_id = ? AND rate_type = "outcall" ORDER BY sort_order, id', [m.id]),
      db.query('SELECT * FROM model_rates WHERE model_id = ? AND rate_type = "extended" ORDER BY sort_order, id', [m.id]),
      db.query('SELECT * FROM model_rate_terms WHERE model_id = ? AND category = "payment" ORDER BY sort_order, id', [m.id]),
      db.query('SELECT * FROM model_rate_terms WHERE model_id = ? AND category = "additional" ORDER BY sort_order, id', [m.id])
    ]);
    return res.success({ incall, outcall, extended, payment, additional });
  }catch(e){ return res.fail(500, 'Failed to load rates', e.message); }
});

// Create a rate
router.post('/:slug/rate', async (req, res) => {
  try{
    const m = await getModel(req.params.slug);
    if (!m) return res.fail(404, 'Model not found');
    const { rate_type, service_name = null, duration = null, price, sort_order = 0, is_visible = 1 } = req.body || {};
    if (!rate_type || !price) return res.fail(400, 'rate_type and price are required');
    await db.query('INSERT INTO model_rates (model_id, rate_type, service_name, duration, price, sort_order, is_visible) VALUES (?,?,?,?,?,?,?)',
      [m.id, rate_type, service_name, duration, price, parseInt(sort_order), is_visible ? 1 : 0]);
    return res.success({ created: true });
  }catch(e){ return res.fail(500, 'Failed to create rate', e.message); }
});

// Update a rate
router.put('/:slug/rate/:id', async (req, res) => {
  try{
    const m = await getModel(req.params.slug);
    if (!m) return res.fail(404, 'Model not found');
    const { id } = req.params;
    const { service_name, duration, price, sort_order, is_visible } = req.body || {};
    await db.query('UPDATE model_rates SET service_name = COALESCE(?, service_name), duration = COALESCE(?, duration), price = COALESCE(?, price), sort_order = COALESCE(?, sort_order), is_visible = COALESCE(?, is_visible) WHERE id = ? AND model_id = ?',
      [service_name, duration, price, sort_order, typeof is_visible === 'undefined' ? null : (is_visible ? 1 : 0), parseInt(id), m.id]);
    return res.success({ updated: true });
  }catch(e){ return res.fail(500, 'Failed to update rate', e.message); }
});

// Delete rate
router.delete('/:slug/rate/:id', async (req, res) => {
  try{
    const m = await getModel(req.params.slug);
    if (!m) return res.fail(404, 'Model not found');
    await db.query('DELETE FROM model_rates WHERE id = ? AND model_id = ?', [parseInt(req.params.id), m.id]);
    return res.success({ deleted: true });
  }catch(e){ return res.fail(500, 'Failed to delete rate', e.message); }
});

// Create term
router.post('/:slug/term', async (req, res) => {
  try{
    const m = await getModel(req.params.slug);
    if (!m) return res.fail(404, 'Model not found');
    const { category, term_text, sort_order = 0, is_visible = 1 } = req.body || {};
    if (!category || !term_text) return res.fail(400, 'category and term_text are required');
    await db.query('INSERT INTO model_rate_terms (model_id, category, term_text, sort_order, is_visible) VALUES (?,?,?,?,?)',
      [m.id, category, term_text, parseInt(sort_order), is_visible ? 1 : 0]);
    return res.success({ created: true });
  }catch(e){ return res.fail(500, 'Failed to create term', e.message); }
});

// Update term
router.put('/:slug/term/:id', async (req, res) => {
  try{
    const m = await getModel(req.params.slug);
    if (!m) return res.fail(404, 'Model not found');
    const { id } = req.params;
    const { term_text, sort_order, is_visible } = req.body || {};
    await db.query('UPDATE model_rate_terms SET term_text = COALESCE(?, term_text), sort_order = COALESCE(?, sort_order), is_visible = COALESCE(?, is_visible) WHERE id = ? AND model_id = ?',
      [term_text, sort_order, typeof is_visible === 'undefined' ? null : (is_visible ? 1 : 0), parseInt(id), m.id]);
    return res.success({ updated: true });
  }catch(e){ return res.fail(500, 'Failed to update term', e.message); }
});

// Delete term
router.delete('/:slug/term/:id', async (req, res) => {
  try{
    const m = await getModel(req.params.slug);
    if (!m) return res.fail(404, 'Model not found');
    await db.query('DELETE FROM model_rate_terms WHERE id = ? AND model_id = ?', [parseInt(req.params.id), m.id]);
    return res.success({ deleted: true });
  }catch(e){ return res.fail(500, 'Failed to delete term', e.message); }
});

module.exports = router;


