const db = require('../config/database');
const crypto = require('crypto');

// Generate API key for a model
async function generateApiKey(modelId) {
    const apiKey = 'pk_' + crypto.randomBytes(32).toString('hex');
    const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');
    
    await db.query(
        'INSERT INTO api_keys (model_id, key_hash, created_at) VALUES (?, ?, NOW()) ON DUPLICATE KEY UPDATE key_hash = VALUES(key_hash), updated_at = NOW()',
        [modelId, hashedKey]
    );
    
    return apiKey;
}

// Middleware to authenticate API requests
async function requireApiAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Missing or invalid authorization header' });
        }

        const apiKey = authHeader.substring(7);
        if (!apiKey.startsWith('pk_')) {
            return res.status(401).json({ error: 'Invalid API key format' });
        }

        const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');
        
        const rows = await db.query(
            'SELECT ak.model_id, m.slug FROM api_keys ak JOIN models m ON ak.model_id = m.id WHERE ak.key_hash = ? AND ak.is_active = 1',
            [hashedKey]
        );

        if (rows.length === 0) {
            return res.status(401).json({ error: 'Invalid API key' });
        }

        req.apiAuth = {
            modelId: rows[0].model_id,
            modelSlug: rows[0].slug
        };

        next();
    } catch (error) {
        console.error('API auth error:', error);
        res.status(500).json({ error: 'Authentication failed' });
    }
}

module.exports = {
    generateApiKey,
    requireApiAuth
};
