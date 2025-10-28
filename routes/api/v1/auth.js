const express = require('express');
const router = express.Router();
const db = require('../../../config/database');
const { generateApiKey } = require('../../../middleware/apiAuth');

// POST /api/v1/auth/generate-key - Generate API key for model (requires CRM auth)
router.post('/generate-key', async (req, res) => {
    try {
        const { model_slug, password } = req.body;

        if (!model_slug || !password) {
            return res.fail(400, 'model_slug and password are required' );
        }

        // Verify model credentials (reuse CRM login logic)
        const modelSql = `
            SELECT m.id, m.slug, u.password_hash
            FROM models m
            JOIN model_users mu ON mu.model_id = m.id
            JOIN users u ON u.id = mu.user_id
            WHERE m.slug = ?`;

        const models = await db.query(modelSql, [model_slug]);
        
        if (models.length === 0) {
            return res.fail(401, 'Invalid model slug' );
        }

        const model = models[0];
        const bcrypt = require('bcrypt');
        const isValidPassword = await bcrypt.compare(password, model.password_hash);

        if (!isValidPassword) {
            return res.fail(401, 'Invalid password' );
        }

        // Generate API key
        const apiKey = await generateApiKey(model.id);

        res.json({
            success: true,
            data: {
                api_key: apiKey,
                model_id: model.id,
                model_slug: model.slug,
                expires: 'Never (revoke to disable)',
                note: 'Store this key securely - it will not be shown again'
            }
        });
    } catch (error) {
        console.error('Generate API key error:', error);
        res.fail(500, 'Failed to generate API key' );
    }
});

// POST /api/v1/auth/revoke-key - Revoke API key for model
router.post('/revoke-key', async (req, res) => {
    try {
        const { model_slug, password } = req.body;

        if (!model_slug || !password) {
            return res.fail(400, 'model_slug and password are required' );
        }

        // Verify model credentials
        const modelSql = `
            SELECT m.id, m.slug, u.password_hash
            FROM models m
            JOIN model_users mu ON mu.model_id = m.id
            JOIN users u ON u.id = mu.user_id
            WHERE m.slug = ?`;

        const models = await db.query(modelSql, [model_slug]);
        
        if (models.length === 0) {
            return res.fail(401, 'Invalid model slug' );
        }

        const model = models[0];
        const bcrypt = require('bcrypt');
        const isValidPassword = await bcrypt.compare(password, model.password_hash);

        if (!isValidPassword) {
            return res.fail(401, 'Invalid password' );
        }

        // Revoke API key
        await db.query(
            'UPDATE api_keys SET is_active = 0, updated_at = NOW() WHERE model_id = ?',
            [model.id]
        );

        res.json({
            success: true,
            message: 'API key revoked successfully'
        });
    } catch (error) {
        console.error('Revoke API key error:', error);
        res.fail(500, 'Failed to revoke API key' );
    }
});

module.exports = router;
