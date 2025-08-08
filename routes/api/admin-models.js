/**
 * Models API - Get available models for admin interfaces
 */

const express = require('express');
const db = require('../../config/database');
const logger = require('../../utils/logger');
const router = express.Router();

/**
 * Get all active models
 * GET /api/models
 */
router.get('/', async (req, res) => {
    try {
        const [models] = await db.execute(`
            SELECT id, name, slug, status, model_type 
            FROM models 
            WHERE is_active = 1 
            ORDER BY name
        `);
        
        res.set('Cache-Control', 'private, max-age=30');
        res.success({ models });
    } catch (error) {
        logger.error('admin-models.list error', { error: error.message });
        res.fail(500, 'Failed to fetch models', error.message);
    }
});

module.exports = router;