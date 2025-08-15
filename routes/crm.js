const express = require('express');
const router = express.Router();
const path = require('path');
const crypto = require('crypto');

// Database connection - use existing MySQL connection
const db = require('../config/database');

// CRM Authentication Middleware
const requireCRMAuth = async (req, res, next) => {
    const { slug } = req.params;
    
    // Check if CRM session exists
    if (req.session.crm && req.session.crm.modelSlug === slug && req.session.crm.authenticated) {
        // Check if session hasn't expired
        if (req.session.crm.expiresAt && new Date() < new Date(req.session.crm.expiresAt)) {
            return next();
        }
    }
    
    // No valid CRM session, redirect to CRM login
    return res.redirect(`/${slug}/crm/login`);
};

// CRM Login Page
router.get('/login', async (req, res) => {
    const slug = req.crmSlug;
    
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
    const slug = req.crmSlug;
    const { password } = req.body;
    
    try {
        // Verify model and password
        const modelResult = await db.query(
            'SELECT id, name, slug, password_hash FROM models WHERE slug = ?',
            [slug]
        );
        
        if (modelResult.length === 0) {
            return res.redirect(`/${slug}/crm/login?error=invalid_credentials`);
        }
        
        const model = modelResult[0];
        
        // Verify password (assuming bcrypt or similar hashing)
        const isValidPassword = await verifyPassword(password, model.password_hash);
        
        if (!isValidPassword) {
            return res.redirect(`/${slug}/crm/login?error=invalid_credentials`);
        }
        
        // Create CRM session
        req.session.crm = {
            modelId: model.id,
            modelSlug: model.slug,
            modelName: model.name,
            authenticated: true,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
            createdAt: new Date()
        };
        
        res.redirect(`/${slug}/crm/dashboard`);
        
    } catch (error) {
        console.error('CRM Login Error:', error);
        res.redirect(`/${slug}/crm/login?error=server_error`);
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
        
        res.render('crm/dashboard', {
            layout: 'crm/main',
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
        // For now, show empty clients page
        // This will work once the database tables are created
        
        const clients = [];
        const pagination = {
            currentPage: 1,
            totalPages: 1,
            totalClients: 0,
            hasNext: false,
            hasPrev: false
        };
        const filters = { status: 'all', search: '' };
        
        res.render('crm/clients', {
            layout: 'crm/main',
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
        res.render('crm/test', {
            layout: 'crm/main',
            model: req.session.crm,
            currentPage: 'test',
            title: `${req.session.crm.modelName} - CRM Test`
        });
        
    } catch (error) {
        console.error('CRM Test Error:', error);
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
    // This should match your existing password verification logic
    // For now, returning true as placeholder
    return true;
}

module.exports = router;
