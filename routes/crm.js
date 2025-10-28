const express = require('express');
const router = express.Router({ mergeParams: true });
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

// Database connection - use existing MySQL connection
const db = require('../config/database');

// CRM Authentication Middleware
const requireCRMAuth = async (req, res, next) => {
    const slug = req.crmSlug || req.params.slug;
    
    // Check if CRM session exists
    if (req.session.crm && req.session.crm.modelSlug === slug && req.session.crm.authenticated) {
        // Check if session hasn't expired
        if (req.session.crm.expiresAt && new Date() < new Date(req.session.crm.expiresAt)) {
            return next();
        }
    }
    
    // No valid CRM session, redirect to CRM login
    return res.redirect(`/${slug || 'modelexample'}/crm/login`);
};

// CRM Login Page
router.get('/login', async (req, res) => {
    let slug = req.crmSlug || req.params.slug;
    if (!slug || slug === 'undefined') {
        return res.redirect(`/modelexample/crm/login`);
    }
    
    try {
        // Check if model exists
        const modelResult = await db.query(
            'SELECT id, name, slug FROM models WHERE slug = ?',
            [slug]
        );
        
        if (modelResult.length === 0) {
            return res.status(404).send('Model not found');
        }
        
        const model = modelResult[0];
        
        res.render('crm/pages/login', {
            layout: 'crm/layouts/main',
            model,
            title: `${model.name} - CRM Login`,
            error: req.query.error || null
        });
        
    } catch (error) {
        console.error('CRM Login Error:', error);
        res.status(500).send('Internal server error');
    }
});

// CRM Login Handler
router.post('/login', async (req, res) => {
    let slug = req.crmSlug || req.params.slug;
    if (!slug || slug === 'undefined') {
        return res.redirect(`/modelexample/crm/login?error=invalid_credentials`);
    }
    const { password } = req.body;
    
    try {
        // Find the model and its primary (owner) user to validate password against
        const rows = await db.query(`
            SELECT 
                m.id               AS model_id,
                m.name             AS model_name,
                m.slug             AS model_slug,
                u.id               AS user_id,
                u.password_hash    AS password_hash
            FROM models m
            JOIN model_users mu ON mu.model_id = m.id AND mu.is_active = TRUE
            JOIN users u ON u.id = mu.user_id AND u.is_active = TRUE
            WHERE m.slug = ?
            ORDER BY (mu.role = 'owner') DESC, mu.added_at ASC
            LIMIT 1
        `, [slug]);

        if (rows.length === 0) {
            return res.redirect(`/${slug}/crm/login?error=invalid_credentials`);
        }

        const rec = rows[0];

        // Verify password (bcrypt)
        const isValidPassword = await verifyPassword(password, rec.password_hash);
        if (!isValidPassword) {
            return res.redirect(`/${slug}/crm/login?error=invalid_credentials`);
        }

        // Create CRM session
        req.session.crm = {
            modelId: rec.model_id,
            modelSlug: rec.model_slug,
            modelName: rec.model_name,
            authenticated: true,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
            createdAt: new Date()
        };

        return res.redirect(`/${slug}/crm/dashboard`);

    } catch (error) {
        console.error('CRM Login Error:', error);
        return res.redirect(`/${slug}/crm/login?error=server_error`);
    }
});

// CRM Dashboard
router.get('/dashboard', requireCRMAuth, async (req, res) => {
    const slug = req.crmSlug;
    const { modelId } = req.session.crm;
    
    try {
        // For now, show basic dashboard without database queries
        // This will work once the database tables are created
        
        const stats = {
            total_clients: 0,
            approved_clients: 0,
            pending_clients: 0,
            total_revenue: 0,
            total_visits: 0
        };
        
        const recentVisits = [];
        const monthlyRevenue = [];
        
        res.render('crm/pages/dashboard', {
            layout: 'crm/layouts/main',
            model: req.session.crm,
            stats,
            recentVisits,
            monthlyRevenue,
            title: `${req.session.crm.modelName} - CRM Dashboard`
        });
        
    } catch (error) {
        console.error('CRM Dashboard Error:', error);
        res.status(500).send('Internal server error');
    }
});

// CRM Clients List
router.get('/clients', requireCRMAuth, async (req, res) => {
    const slug = req.crmSlug;
    const { modelId } = req.session.crm;
    
    try {
        const page = 1;
        const limit = 50;
        const offset = 0;
        const filters = { status: 'all', search: '' };

        // Fetch clients joined to interactions for this model
        const countRows = await db.query(`
            SELECT COUNT(*) AS count
            FROM escort_clients ec
            JOIN client_model_interactions cmi ON cmi.escort_client_id = ec.id AND cmi.model_id = ?
        `, [modelId]);

        const totalClients = parseInt(countRows[0]?.count || 0);
        const totalPages = 1;

        const clients = await db.query(`
            SELECT ec.id, ec.client_identifier, ec.screening_status, ec.screening_method, ec.created_at,
                   cmi.id AS client_model_interaction_id,
                   COALESCE(crs.total_visits,0) AS total_visits,
                   COALESCE(crs.total_revenue,0) AS total_revenue,
                   crs.last_visit_date
            FROM escort_clients ec
            JOIN client_model_interactions cmi ON cmi.escort_client_id = ec.id AND cmi.model_id = ?
            LEFT JOIN client_revenue_summary crs ON crs.client_id = ec.id
            ORDER BY ec.created_at DESC
            LIMIT ? OFFSET ?
        `, [modelId, limit, offset]);

        const pagination = {
            currentPage: page,
            totalPages,
            totalClients,
            hasNext: false,
            hasPrev: false
        };
        
        res.render('crm/pages/clients', {
            layout: 'crm/layouts/main',
            model: req.session.crm,
            currentPage: 'clients',
            clients,
            pagination,
            filters,
            title: `${req.session.crm.modelName} - CRM Clients`
        });
        
    } catch (error) {
        console.error('CRM Clients Error:', error);
        res.status(500).send('Internal server error');
    }
});

// CRM Test Page
router.get('/test', requireCRMAuth, async (req, res) => {
    const slug = req.crmSlug;
    
    try {
        res.render('crm/pages/test', {
            layout: 'crm/layouts/main',
            model: req.session.crm,
            currentPage: 'test',
            title: `${req.session.crm.modelName} - CRM Test`
        });
        
    } catch (error) {
        console.error('CRM Test Error:', error);
        res.status(500).send('Internal server error');
    }
});

// CRM Client Profile (threads view)
router.get('/clients/:interactionId', requireCRMAuth, async (req, res) => {
    try {
        res.render('crm/pages/client-profile', {
            layout: 'crm/layouts/main',
            model: req.session.crm,
            interactionId: req.params.interactionId,
            currentPage: 'clients',
            title: `${req.session.crm.modelName} - Client Profile`
        });
    } catch (e) {
        console.error('CRM Client Profile Error:', e);
        res.status(500).send('Internal server error');
    }
});

// CRM Logout
router.get('/logout', (req, res) => {
    const slug = req.crmSlug;
    
    // Clear CRM session
    if (req.session.crm) {
        delete req.session.crm;
    }
    
    res.redirect(`/${slug}/crm/login`);
});

// Default CRM route - redirect to login
router.get('/', (req, res) => {
    const slug = req.crmSlug;
    res.redirect(`/${slug}/crm/login`);
});

// Helper function to verify password (implement based on your password hashing)
async function verifyPassword(password, hash) {
    if (!hash || !password) return false;
    try {
        return await bcrypt.compare(password, hash);
    } catch (e) {
        return false;
    }
}

module.exports = router;
