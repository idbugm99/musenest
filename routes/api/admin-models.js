/**
 * Models API - Get available models for admin interfaces
 */

const express = require('express');
const db = require('../../config/database');
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
        
        res.json({
            success: true,
            models: models
        });
    } catch (error) {
        console.error('Error fetching models:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch models'
        });
    }
});

module.exports = router;