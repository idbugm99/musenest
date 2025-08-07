/**
 * AI Server Management API
 * Multi-server, multi-industry white-label platform management
 */

const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const db = require('../../config/database');

// ============================================================================
// SERVER MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * GET /api/ai-server-management/servers
 * Get all AI moderation servers with health status
 */
router.get('/servers', async (req, res) => {
    try {
        const query = `
            SELECT 
                s.*,
                COUNT(sc.id) as assigned_sites,
                AVG(shl.response_time_ms) as avg_response_time,
                MAX(shl.checked_at) as last_health_check,
                (SELECT status FROM server_health_logs WHERE server_id = s.id ORDER BY checked_at DESC LIMIT 1) as current_health_status
            FROM ai_moderation_servers s
            LEFT JOIN site_configurations sc ON s.id = sc.server_id AND sc.is_active = 1
            LEFT JOIN server_health_logs shl ON s.id = shl.server_id AND shl.checked_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
            GROUP BY s.id
            ORDER BY s.created_at ASC
        `;

        const [servers] = await db.execute(query);
        
        res.json({
            success: true,
            servers: servers,
            total: servers.length
        });

    } catch (error) {
        console.error('Error fetching servers:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/ai-server-management/servers
 * Add new AI moderation server
 */
router.post('/servers', async (req, res) => {
    try {
        const {
            name,
            description,
            ip_address,
            port = 5000,
            protocol = 'http',
            api_key,
            max_concurrent_requests = 10
        } = req.body;

        if (!name || !ip_address) {
            return res.status(400).json({
                error: 'name and ip_address are required'
            });
        }

        // Test server connectivity
        const testUrl = `${protocol}://${ip_address}:${port}/health`;
        let serverStatus = 'inactive';
        let responseTime = null;

        try {
            const startTime = Date.now();
            const response = await fetch(testUrl, { 
                timeout: 5000,
                headers: api_key ? { 'Authorization': `Bearer ${api_key}` } : {}
            });
            responseTime = Date.now() - startTime;
            serverStatus = response.ok ? 'active' : 'error';
        } catch (error) {
            console.log(`Server ${ip_address}:${port} not reachable during setup:`, error.message);
        }

        const insertQuery = `
            INSERT INTO ai_moderation_servers 
            (name, description, ip_address, port, protocol, status, response_time_ms, api_key, max_concurrent_requests, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const [result] = await db.execute(insertQuery, [
            name, description, ip_address, port, protocol, serverStatus, responseTime, api_key, max_concurrent_requests, 1
        ]);

        // Log initial health check
        if (responseTime !== null) {
            await db.execute(`
                INSERT INTO server_health_logs (server_id, status, response_time_ms, api_status)
                VALUES (?, ?, ?, ?)
            `, [result.insertId, serverStatus, responseTime, serverStatus === 'active' ? 'running' : 'error']);
        }

        res.json({
            success: true,
            server_id: result.insertId,
            message: `Server ${name} added successfully`,
            initial_status: serverStatus,
            response_time_ms: responseTime
        });

    } catch (error) {
        console.error('Error adding server:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * PUT /api/ai-server-management/servers/:id
 * Update AI moderation server
 */
router.put('/servers/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name,
            description,
            ip_address,
            port,
            protocol,
            status,
            api_key,
            max_concurrent_requests
        } = req.body;

        const updateQuery = `
            UPDATE ai_moderation_servers 
            SET name = ?, description = ?, ip_address = ?, port = ?, protocol = ?, 
                status = ?, api_key = ?, max_concurrent_requests = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;

        await db.execute(updateQuery, [
            name, description, ip_address, port, protocol, status, api_key, max_concurrent_requests, id
        ]);

        res.json({
            success: true,
            message: 'Server updated successfully'
        });

    } catch (error) {
        console.error('Error updating server:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * DELETE /api/ai-server-management/servers/:id
 * Remove AI moderation server
 */
router.delete('/servers/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Check if server has active site configurations
        const [activeSites] = await db.execute(
            'SELECT COUNT(*) as count FROM site_configurations WHERE server_id = ? AND is_active = 1',
            [id]
        );

        if (activeSites[0].count > 0) {
            return res.status(400).json({
                error: 'Cannot delete server with active site configurations',
                active_sites: activeSites[0].count
            });
        }

        await db.execute('DELETE FROM ai_moderation_servers WHERE id = ?', [id]);

        res.json({
            success: true,
            message: 'Server deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting server:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/ai-server-management/servers/:id/health-check
 * Perform health check on specific server
 */
router.post('/servers/:id/health-check', async (req, res) => {
    try {
        const { id } = req.params;

        // Get server details
        const [servers] = await db.execute(
            'SELECT * FROM ai_moderation_servers WHERE id = ?',
            [id]
        );

        if (servers.length === 0) {
            return res.status(404).json({ error: 'Server not found' });
        }

        const server = servers[0];
        const healthUrl = `${server.protocol}://${server.ip_address}:${server.port}/health`;

        let healthStatus = 'offline';
        let responseTime = null;
        let errorMessage = null;
        let serverResponse = null;

        try {
            const startTime = Date.now();
            const response = await fetch(healthUrl, {
                timeout: 10000,
                headers: server.api_key ? { 'Authorization': `Bearer ${server.api_key}` } : {}
            });
            responseTime = Date.now() - startTime;

            if (response.ok) {
                serverResponse = await response.text();
                try {
                    serverResponse = JSON.parse(serverResponse);
                    healthStatus = 'online';
                } catch (e) {
                    healthStatus = 'online';
                }
            } else {
                healthStatus = 'error';
                errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            }
        } catch (error) {
            healthStatus = 'offline';
            errorMessage = error.message;
        }

        // Log health check result
        await db.execute(`
            INSERT INTO server_health_logs 
            (server_id, status, response_time_ms, error_message, checked_at)
            VALUES (?, ?, ?, ?, NOW())
        `, [id, healthStatus, responseTime, errorMessage]);

        // Update server last ping
        await db.execute(`
            UPDATE ai_moderation_servers 
            SET last_ping = NOW(), response_time_ms = ?, status = ?
            WHERE id = ?
        `, [responseTime, healthStatus === 'online' ? 'active' : 'error', id]);

        res.json({
            success: true,
            server_id: id,
            health_status: healthStatus,
            response_time_ms: responseTime,
            error_message: errorMessage,
            server_response: serverResponse
        });

    } catch (error) {
        console.error('Error performing health check:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/ai-server-management/servers/:id/restart
 * Restart AI moderation server
 */
router.post('/servers/:id/restart', async (req, res) => {
    try {
        const { id } = req.params;
        const { force = false } = req.body;

        // Get server details
        const [servers] = await db.execute(
            'SELECT * FROM ai_moderation_servers WHERE id = ?',
            [id]
        );

        if (servers.length === 0) {
            return res.status(404).json({ error: 'Server not found' });
        }

        const server = servers[0];
        const restartUrl = `${server.protocol}://${server.ip_address}:${server.port}/restart`;

        console.log(`🔄 Attempting to restart server: ${server.name} (${server.ip_address}:${server.port})`);

        try {
            const response = await fetch(restartUrl, {
                method: 'POST',
                timeout: 30000,
                headers: {
                    'Content-Type': 'application/json',
                    ...(server.api_key ? { 'Authorization': `Bearer ${server.api_key}` } : {})
                },
                body: JSON.stringify({ force })
            });

            let serverResponse = null;
            try {
                serverResponse = await response.text();
                if (serverResponse) {
                    serverResponse = JSON.parse(serverResponse);
                }
            } catch (e) {
                // Response might not be JSON
            }

            if (response.ok) {
                console.log(`✅ Server restart successful: ${server.name}`);
                
                // Update server status
                await db.execute(`
                    UPDATE ai_moderation_servers 
                    SET status = 'maintenance', updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `, [id]);

                // Log restart event
                await db.execute(`
                    INSERT INTO server_health_logs 
                    (server_id, status, error_message, checked_at)
                    VALUES (?, 'online', 'Server restart initiated', NOW())
                `, [id]);

                res.json({
                    success: true,
                    message: `Server ${server.name} restart initiated successfully`,
                    server_response: serverResponse
                });
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

        } catch (error) {
            console.error(`❌ Server restart failed: ${server.name}`, error.message);
            
            // Log restart failure
            await db.execute(`
                INSERT INTO server_health_logs 
                (server_id, status, error_message, checked_at)
                VALUES (?, 'error', ?, NOW())
            `, [id, `Restart failed: ${error.message}`]);

            res.status(500).json({
                success: false,
                error: `Failed to restart server: ${error.message}`,
                server_name: server.name
            });
        }

    } catch (error) {
        console.error('Error restarting server:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// INDUSTRY TEMPLATES MANAGEMENT
// ============================================================================

/**
 * GET /api/ai-server-management/industry-templates
 * Get all industry templates
 */
router.get('/industry-templates', async (req, res) => {
    try {
        const [templates] = await db.execute(`
            SELECT 
                it.*,
                COUNT(sc.id) as sites_using_template
            FROM industry_templates it
            LEFT JOIN site_configurations sc ON it.id = sc.industry_template_id AND sc.is_active = 1
            WHERE it.is_active = 1
            GROUP BY it.id
            ORDER BY it.display_name
        `);

        res.json({
            success: true,
            templates: templates
        });

    } catch (error) {
        console.error('Error fetching industry templates:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/ai-server-management/industry-templates/:id
 * Get specific industry template
 */
router.get('/industry-templates/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const [templates] = await db.execute(
            'SELECT * FROM industry_templates WHERE id = ?',
            [id]
        );

        if (templates.length === 0) {
            return res.status(404).json({ error: 'Industry template not found' });
        }

        res.json({
            success: true,
            template: templates[0]
        });

    } catch (error) {
        console.error('Error fetching industry template:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/ai-server-management/industry-templates
 * Create new industry template
 */
router.post('/industry-templates', async (req, res) => {
    try {
        const {
            industry_type,
            display_name,
            description,
            nudenet_config,
            blip_config,
            moderation_rules,
            usage_intents,
            compliance_rules,
            is_default = false
        } = req.body;

        if (!industry_type || !display_name || !nudenet_config || !blip_config || !moderation_rules || !usage_intents) {
            return res.status(400).json({
                error: 'industry_type, display_name, nudenet_config, blip_config, moderation_rules, and usage_intents are required'
            });
        }

        const insertQuery = `
            INSERT INTO industry_templates 
            (industry_type, display_name, description, nudenet_config, blip_config, moderation_rules, usage_intents, compliance_rules, is_default, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const [result] = await db.execute(insertQuery, [
            industry_type, display_name, description, 
            JSON.stringify(nudenet_config), 
            JSON.stringify(blip_config), 
            JSON.stringify(moderation_rules), 
            JSON.stringify(usage_intents),
            compliance_rules ? JSON.stringify(compliance_rules) : null,
            is_default, 1
        ]);

        res.json({
            success: true,
            template_id: result.insertId,
            message: 'Industry template created successfully'
        });

    } catch (error) {
        console.error('Error creating industry template:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * PUT /api/ai-server-management/industry-templates/:id
 * Update industry template
 */
router.put('/industry-templates/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            display_name,
            description,
            nudenet_config,
            blip_config,
            moderation_rules,
            usage_intents,
            compliance_rules,
            is_active,
            is_default
        } = req.body;

        const updateQuery = `
            UPDATE industry_templates 
            SET display_name = ?, description = ?, nudenet_config = ?, blip_config = ?, 
                moderation_rules = ?, usage_intents = ?, compliance_rules = ?, 
                is_active = ?, is_default = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;

        await db.execute(updateQuery, [
            display_name, description,
            JSON.stringify(nudenet_config),
            JSON.stringify(blip_config),
            JSON.stringify(moderation_rules),
            JSON.stringify(usage_intents),
            compliance_rules ? JSON.stringify(compliance_rules) : null,
            is_active, is_default, id
        ]);

        res.json({
            success: true,
            message: 'Industry template updated successfully'
        });

    } catch (error) {
        console.error('Error updating industry template:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;