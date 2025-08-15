const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// Database connection - use existing MySQL connection
const db = require('../../../config/database');

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
    
    return res.status(401).json({ error: 'Unauthorized' });
};

// Get all clients for a model
router.get('/:slug/clients', requireCRMAuth, async (req, res) => {
    const { slug } = req.params;
    const { modelId } = req.session.crm;
    const { page = 1, limit = 20, status, search, sortBy = 'created_at', sortOrder = 'desc' } = req.query;
    
    try {
        let whereClause = 'WHERE ec.model_id = $1';
        let params = [modelId];
        let paramCount = 1;
        
        if (status && status !== 'all') {
            paramCount++;
            whereClause += ` AND ec.screening_status = $${paramCount}`;
            params.push(status);
        }
        
        if (search) {
            paramCount++;
            whereClause += ` AND (ec.client_identifier ILIKE $${paramCount} OR ec.phone_hash ILIKE $${paramCount} OR ec.email_hash ILIKE $${paramCount})`;
            params.push(`%${search}%`);
        }
        
        // Get total count
        const countResult = await pool.query(
            `SELECT COUNT(*) FROM escort_clients ec ${whereClause}`,
            params
        );
        
        const totalClients = parseInt(countResult.rows[0].count);
        const totalPages = Math.ceil(totalClients / limit);
        const offset = (page - 1) * limit;
        
        // Validate sort parameters
        const allowedSortFields = ['created_at', 'client_identifier', 'screening_status', 'last_visit_date'];
        const allowedSortOrders = ['asc', 'desc'];
        
        if (!allowedSortFields.includes(sortBy)) sortBy = 'created_at';
        if (!allowedSortOrders.includes(sortOrder)) sortOrder = 'desc';
        
        // Get clients with pagination
        const clientsResult = await pool.query(`
            SELECT 
                ec.*,
                crs.total_visits,
                crs.total_revenue,
                crs.last_visit_date,
                crs.average_rate,
                COUNT(cr.id) as reference_count,
                COUNT(cv.id) as visit_count
            FROM escort_clients ec
            LEFT JOIN client_revenue_summary crs ON ec.id = crs.client_id
            LEFT JOIN client_references cr ON ec.id = cr.client_id
            LEFT JOIN client_visits cv ON ec.id = cv.client_id
            ${whereClause}
            GROUP BY ec.id, crs.total_visits, crs.total_revenue, crs.last_visit_date, crs.average_rate
            ORDER BY ec.${sortBy} ${sortOrder.toUpperCase()}
            LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
        `, [...params, limit, offset]);
        
        const clients = clientsResult.rows;
        
        res.json({
            success: true,
            data: {
                clients,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages,
                    totalClients,
                    hasNext: page < totalPages,
                    hasPrev: page > 1,
                    limit: parseInt(limit)
                },
                filters: { status, search, sortBy, sortOrder }
            }
        });
        
    } catch (error) {
        console.error('Get Clients Error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error' 
        });
    }
});

// Get a specific client
router.get('/:slug/clients/:clientId', requireCRMAuth, async (req, res) => {
    const { slug, clientId } = req.params;
    const { modelId } = req.session.crm;
    
    try {
        // Get client details
        const clientResult = await pool.query(`
            SELECT 
                ec.*,
                crs.total_visits,
                crs.total_revenue,
                crs.last_visit_date,
                crs.first_visit_date,
                crs.average_rate
            FROM escort_clients ec
            LEFT JOIN client_revenue_summary crs ON ec.id = crs.client_id
            WHERE ec.id = $1 AND ec.model_id = $2
        `, [clientId, modelId]);
        
        if (clientResult.rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Client not found' 
            });
        }
        
        const client = clientResult.rows[0];
        
        // Get client visits
        const visitsResult = await pool.query(`
            SELECT 
                id, visit_date, visit_duration, visit_type, rate_amount,
                payment_method, payment_status, client_rating, would_see_again,
                actual_amount_received, expenses, net_revenue
            FROM client_visits
            WHERE client_id = $1
            ORDER BY visit_date DESC
        `, [clientId]);
        
        // Get client references
        const referencesResult = await pool.query(`
            SELECT id, reference_relationship, reference_status, contacted_at
            FROM client_references
            WHERE client_id = $1
            ORDER BY created_at DESC
        `, [clientId]);
        
        // Get client screening
        const screeningResult = await pool.query(`
            SELECT id, screening_type, verification_status, verified_at, expires_at
            FROM client_screening
            WHERE client_id = $1
            ORDER BY created_at DESC
        `, [clientId]);
        
        client.visits = visitsResult.rows;
        client.references = referencesResult.rows;
        client.screening = screeningResult.rows;
        
        res.json({
            success: true,
            data: client
        });
        
    } catch (error) {
        console.error('Get Client Error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error' 
        });
    }
});

// Create a new client
router.post('/:slug/clients', requireCRMAuth, async (req, res) => {
    const { slug } = req.params;
    const { modelId } = req.session.crm;
    const { 
        client_identifier, 
        phone, 
        email, 
        screening_method, 
        reference_sites, 
        communication_preference,
        notes 
    } = req.body;
    
    try {
        // Generate hashes for phone and email (for matching)
        const phone_hash = phone ? crypto.createHash('sha256').update(phone).digest('hex') : null;
        const email_hash = email ? crypto.createHash('sha256').update(email).digest('hex') : null;
        
        // Check if client already exists (by phone or email hash)
        if (phone_hash || email_hash) {
            const existingClient = await pool.query(`
                SELECT id FROM escort_clients 
                WHERE model_id = $1 AND (phone_hash = $2 OR email_hash = $3)
            `, [modelId, phone_hash, email_hash]);
            
            if (existingClient.rows.length > 0) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Client with this phone or email already exists' 
                });
            }
        }
        
        // Encrypt sensitive data if encryption is enabled
        let phone_encrypted = null;
        let email_encrypted = null;
        let notes_encrypted = null;
        
        if (req.session.crm.encryptionEnabled) {
            // This would use the encryption service
            // For now, storing as-is (implement encryption later)
            phone_encrypted = phone;
            email_encrypted = email;
            notes_encrypted = notes;
        }
        
        // Insert new client
        const insertResult = await pool.query(`
            INSERT INTO escort_clients (
                model_id, client_identifier, phone_hash, email_hash,
                phone_encrypted, email_encrypted, screening_method,
                reference_sites, communication_preference, notes_encrypted
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id, client_identifier, created_at
        `, [
            modelId, client_identifier, phone_hash, email_hash,
            phone_encrypted, email_encrypted, screening_method,
            reference_sites ? JSON.stringify(reference_sites) : null,
            communication_preference, notes_encrypted
        ]);
        
        const newClient = insertResult.rows[0];
        
        // Initialize revenue summary
        await pool.query(`
            INSERT INTO client_revenue_summary (client_id, total_visits, total_revenue, average_rate)
            VALUES ($1, 0, 0.00, 0.00)
        `, [newClient.id]);
        
        res.status(201).json({
            success: true,
            data: newClient,
            message: 'Client created successfully'
        });
        
    } catch (error) {
        console.error('Create Client Error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error' 
        });
    }
});

// Update a client
router.put('/:slug/clients/:clientId', requireCRMAuth, async (req, res) => {
    const { slug, clientId } = req.params;
    const { modelId } = req.session.crm;
    const updateData = req.body;
    
    try {
        // Verify client belongs to model
        const clientCheck = await pool.query(`
            SELECT id FROM escort_clients WHERE id = $1 AND model_id = $2
        `, [clientId, modelId]);
        
        if (clientCheck.rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Client not found' 
            });
        }
        
        // Prepare update fields
        const updateFields = [];
        const updateValues = [];
        let paramCount = 0;
        
        // Handle different field types
        if (updateData.client_identifier !== undefined) {
            paramCount++;
            updateFields.push(`client_identifier = $${paramCount}`);
            updateValues.push(updateData.client_identifier);
        }
        
        if (updateData.screening_status !== undefined) {
            paramCount++;
            updateFields.push(`screening_status = $${paramCount}`);
            updateValues.push(updateData.screening_status);
        }
        
        if (updateData.screening_method !== undefined) {
            paramCount++;
            updateFields.push(`screening_method = $${paramCount}`);
            updateValues.push(updateData.screening_method);
        }
        
        if (updateData.reference_sites !== undefined) {
            paramCount++;
            updateFields.push(`reference_sites = $${paramCount}`);
            updateValues.push(JSON.stringify(updateData.reference_sites));
        }
        
        if (updateData.communication_preference !== undefined) {
            paramCount++;
            updateFields.push(`communication_preference = $${paramCount}`);
            updateValues.push(updateData.communication_preference);
        }
        
        if (updateData.area_notifications !== undefined) {
            paramCount++;
            updateFields.push(`area_notifications = $${paramCount}`);
            updateValues.push(updateData.area_notifications);
        }
        
        if (updateData.notes !== undefined) {
            paramCount++;
            updateFields.push(`notes_encrypted = $${paramCount}`);
            // Encrypt notes if encryption is enabled
            updateValues.push(updateData.notes);
        }
        
        if (updateFields.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'No valid fields to update' 
            });
        }
        
        // Add client ID and model ID to values
        updateValues.push(clientId, modelId);
        
        // Update client
        const updateResult = await pool.query(`
            UPDATE escort_clients 
            SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
            WHERE id = $${paramCount + 1} AND model_id = $${paramCount + 2}
            RETURNING id, client_identifier, updated_at
        `, updateValues);
        
        res.json({
            success: true,
            data: updateResult.rows[0],
            message: 'Client updated successfully'
        });
        
    } catch (error) {
        console.error('Update Client Error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error' 
        });
    }
});

// Delete a client
router.delete('/:slug/clients/:clientId', requireCRMAuth, async (req, res) => {
    const { slug, clientId } = req.params;
    const { modelId } = req.session.crm;
    
    try {
        // Verify client belongs to model
        const clientCheck = await pool.query(`
            SELECT id FROM escort_clients WHERE id = $1 AND model_id = $2
        `, [clientId, modelId]);
        
        if (clientCheck.rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Client not found' 
            });
        }
        
        // Delete client (cascade will handle related records)
        await pool.query(`
            DELETE FROM escort_clients WHERE id = $1 AND model_id = $2
        `, [clientId, modelId]);
        
        res.json({
            success: true,
            message: 'Client deleted successfully'
        });
        
    } catch (error) {
        console.error('Delete Client Error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error' 
        });
    }
});

// Search clients
router.get('/:slug/clients/search/:query', requireCRMAuth, async (req, res) => {
    const { slug, query } = req.params;
    const { modelId } = req.session.crm;
    const { limit = 10 } = req.query;
    
    try {
        const searchResult = await pool.query(`
            SELECT 
                ec.id, ec.client_identifier, ec.screening_status,
                ec.screening_method, ec.created_at,
                crs.total_visits, crs.total_revenue, crs.last_visit_date
            FROM escort_clients ec
            LEFT JOIN client_revenue_summary crs ON ec.id = crs.client_id
            WHERE ec.model_id = $1 
            AND (
                ec.client_identifier ILIKE $2 
                OR ec.phone_hash ILIKE $3 
                OR ec.email_hash ILIKE $3
            )
            ORDER BY 
                CASE WHEN ec.client_identifier ILIKE $2 THEN 1 ELSE 2 END,
                ec.created_at DESC
            LIMIT $4
        `, [modelId, `%${query}%`, crypto.createHash('sha256').update(query).digest('hex'), limit]);
        
        res.json({
            success: true,
            data: searchResult.rows,
            query,
            total: searchResult.rows.length
        });
        
    } catch (error) {
        console.error('Search Clients Error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error' 
        });
    }
});

module.exports = router;
