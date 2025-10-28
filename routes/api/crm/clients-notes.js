const express = require('express');
const router = express.Router();
const db = require('../../../config/database');

async function requireCRMAuth(req, res, next) {
  const { slug } = req.params;
  if (req.session.crm && req.session.crm.modelSlug === slug && req.session.crm.authenticated) return next();
  return res.status(401).json({ success: false, error: 'Unauthorized' });
}

// Save per-client notes on interaction
router.post('/:slug/clients/:interactionId/notes', requireCRMAuth, async (req, res) => {
  try {
    const { interactionId } = req.params;
    const notes = req.body.notes || null;
    await db.query(`UPDATE client_model_interactions SET notes_encrypted = ?, updated_at = NOW() WHERE id = ?`, [notes, interactionId]);
    res.json({ success: true });
  } catch (e) {
    console.error('Save notes error:', e);
    res.status(500).json({ success: false, error: 'Failed to save notes' });
  }
});

module.exports = router;



