const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const logger = require('../../utils/logger');

// Consolidated sysadmin API surface
// This aggregates existing routers under a single, consistent namespace.
// Legacy mounts remain available for backward compatibility.

// Temporary shim: provide a resilient sites listing to avoid 500s from complex join route
router.get('/site-configuration/sites', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const currentPage = Math.max(1, parseInt(page));
    const perPage = Math.max(1, Math.min(100, parseInt(limit)));
    const offset = (currentPage - 1) * perPage;
    const countRows = await db.query('SELECT COUNT(*) as total FROM site_configurations WHERE is_active = 1');
    const total = (countRows && countRows[0] && countRows[0].total) ? countRows[0].total : 0;
    const rows = await db.query(`SELECT * FROM site_configurations WHERE is_active = 1 ORDER BY created_at DESC LIMIT ${perPage} OFFSET ${offset}`);
    res.set('Cache-Control', 'private, max-age=15');
    return res.success({
      sites: rows,
      pagination: { page: currentPage, limit: perPage, total, pages: Math.ceil(total / perPage) }
    });
  } catch (error) {
    logger.error('sysadmin.shim site-configuration list error', { error: error.message });
    return res.fail(500, 'Failed to fetch site configurations', error.message);
  }
});

// Basic sites listing endpoint to guarantee availability
router.get('/site-configuration/sites-basic', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const currentPage = Math.max(1, parseInt(page));
    const perPage = Math.max(1, Math.min(100, parseInt(limit)));
    const offset = (currentPage - 1) * perPage;
    const countRows = await db.query('SELECT COUNT(*) as total FROM site_configurations WHERE is_active = 1');
    const total = (countRows && countRows[0] && countRows[0].total) ? countRows[0].total : 0;
    const rows = await db.query(`SELECT id, site_name, site_identifier, is_active, created_at, updated_at FROM site_configurations WHERE is_active = 1 ORDER BY created_at DESC LIMIT ${perPage} OFFSET ${offset}`);
    res.set('Cache-Control', 'private, max-age=15');
    return res.success({
      sites: rows,
      pagination: { page: currentPage, limit: perPage, total, pages: Math.ceil(total / perPage) }
    });
  } catch (error) {
    logger.error('sysadmin.basic site-configuration list error', { error: error.message });
    return res.fail(500, 'Failed to fetch site configurations', error.message);
  }
});

router.use('/system', require('./system-management'));
router.use('/business', require('./admin-business'));
router.use('/models', require('./admin-models'));
router.use('/ai-servers', require('./ai-server-management'));
router.use('/media-review', require('./media-review-queue'));
router.use('/site-configuration', require('./site-configuration'));
router.use('/model-dashboard', require('./model-dashboard'));

// Temporary shim: provide a resilient sites listing to avoid 500s from complex join route (single definition)
router.get('/site-configuration/sites', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const currentPage = Math.max(1, parseInt(page));
    const perPage = Math.max(1, Math.min(100, parseInt(limit)));
    const offset = (currentPage - 1) * perPage;
    const countRows = await db.query('SELECT COUNT(*) as total FROM site_configurations WHERE is_active = 1');
    const total = (countRows && countRows[0] && countRows[0].total) ? countRows[0].total : 0;
    const rows = await db.query(`SELECT * FROM site_configurations WHERE is_active = 1 ORDER BY created_at DESC LIMIT ${perPage} OFFSET ${offset}`);
    res.set('Cache-Control', 'private, max-age=15');
    return res.success({
      sites: rows,
      pagination: { page: currentPage, limit: perPage, total, pages: Math.ceil(total / perPage) }
    });
  } catch (error) {
    logger.error('sysadmin.shim site-configuration list error', { error: error.message });
    return res.fail(500, 'Failed to fetch site configurations', error.message);
  }
});

module.exports = router;


