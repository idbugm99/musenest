const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

// Get system statistics
router.get('/stats', async (req, res) => {
    try {
        // Total clients
        const [totalClients] = await db.execute('SELECT COUNT(*) as count FROM models');
        
        // Active subscriptions
        const [activeSubscriptions] = await db.execute(
            'SELECT COUNT(*) as count FROM models WHERE subscription_status = "active"'
        );
        
        // Trial accounts
        const [trialAccounts] = await db.execute(
            'SELECT COUNT(*) as count FROM models WHERE status = "trial"'
        );
        
        // Monthly revenue estimation (placeholder - would integrate with Stripe in production)
        const [revenueData] = await db.execute(`
            SELECT COUNT(*) * 29.99 as estimated_revenue 
            FROM models 
            WHERE subscription_status = "active"
        `);

        res.json({
            success: true,
            data: {
                total_clients: totalClients[0].count,
                active_subscriptions: activeSubscriptions[0].count,
                trial_accounts: trialAccounts[0].count,
                monthly_revenue: revenueData[0].estimated_revenue || 0
            }
        });

    } catch (error) {
        console.error('Error fetching system stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch system statistics'
        });
    }
});

// Get all clients with filtering and pagination
router.get('/clients', async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            search = '',
            status = '',
            subscription_status = ''
        } = req.query;

        const offset = (page - 1) * limit;
        
        // Simple query without complex WHERE conditions for now
        const [totalResult] = await db.execute('SELECT COUNT(*) as total FROM models');
        const total = totalResult[0].total;

        // Get clients with pagination - use template literal for now to avoid parameter binding issues
        const limitNum = parseInt(limit);
        const offsetNum = parseInt(offset);
        
        const [clients] = await db.execute(`
            SELECT 
                m.id,
                m.name,
                m.slug,
                m.email,
                m.phone,
                m.status,
                m.subscription_status,
                m.stripe_customer_id,
                m.stripe_subscription_id,
                m.trial_ends_at,
                m.next_billing_at,
                m.balance_due,
                m.created_at,
                m.updated_at,
                bt.display_name as business_type,
                bt.id as business_type_id
            FROM models m
            LEFT JOIN business_types bt ON m.business_type_id = bt.id
            ORDER BY m.created_at DESC
            LIMIT ${limitNum} OFFSET ${offsetNum}
        `);

        res.json({
            success: true,
            data: {
                clients,
                pagination: {
                    current_page: parseInt(page),
                    per_page: parseInt(limit),
                    total: total,
                    total_pages: Math.ceil(total / limit)
                }
            }
        });

    } catch (error) {
        console.error('Error fetching clients:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch clients'
        });
    }
});

// Get single client details
router.get('/clients/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const [client] = await db.execute(`
            SELECT 
                m.*,
                bt.display_name as business_type_name,
                u.role as user_role,
                u.is_active as user_active
            FROM models m
            LEFT JOIN business_types bt ON m.business_type_id = bt.id
            LEFT JOIN users u ON m.email = u.email
            WHERE m.id = ?
        `, [id]);

        if (client.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Client not found'
            });
        }

        res.json({
            success: true,
            data: client[0]
        });

    } catch (error) {
        console.error('Error fetching client:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch client details'
        });
    }
});

// Update client information
router.put('/clients/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name,
            slug,
            email,
            phone,
            status,
            business_type_id,
            subscription_status,
            stripe_customer_id,
            stripe_subscription_id,
            trial_ends_at,
            next_billing_at,
            balance_due
        } = req.body;

        // Check if slug is unique (excluding current record)
        if (slug) {
            const [existingSlug] = await db.execute(
                'SELECT id FROM models WHERE slug = ? AND id != ?',
                [slug, id]
            );

            if (existingSlug.length > 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Slug already exists'
                });
            }
        }

        // Update model record
        await db.execute(`
            UPDATE models SET
                name = COALESCE(?, name),
                slug = COALESCE(?, slug),
                email = COALESCE(?, email),
                phone = COALESCE(?, phone),
                status = COALESCE(?, status),
                business_type_id = COALESCE(?, business_type_id),
                subscription_status = COALESCE(?, subscription_status),
                stripe_customer_id = COALESCE(?, stripe_customer_id),
                stripe_subscription_id = COALESCE(?, stripe_subscription_id),
                trial_ends_at = COALESCE(?, trial_ends_at),
                next_billing_at = COALESCE(?, next_billing_at),
                balance_due = COALESCE(?, balance_due),
                updated_at = NOW()
            WHERE id = ?
        `, [
            name, slug, email, phone, status, business_type_id,
            subscription_status, stripe_customer_id, stripe_subscription_id,
            trial_ends_at, next_billing_at, balance_due, id
        ]);

        // Update corresponding user record if email is provided
        if (email) {
            await db.execute(`
                UPDATE users SET 
                    email = ?,
                    updated_at = NOW()
                WHERE email = (SELECT email FROM models WHERE id = ?)
            `, [email, id]);
        }

        res.json({
            success: true,
            message: 'Client updated successfully'
        });

    } catch (error) {
        console.error('Error updating client:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update client'
        });
    }
});

// Create new client
router.post('/clients', async (req, res) => {
    try {
        const {
            name,
            slug,
            email,
            phone,
            business_type_id,
            page_set_id,
            theme_set_id,
            password
        } = req.body;

        // Validate required fields
        if (!name || !slug || !email) {
            return res.status(400).json({
                success: false,
                error: 'Name, slug, and email are required'
            });
        }

        // Check if slug and email are unique
        const [existingSlug] = await db.execute('SELECT id FROM models WHERE slug = ?', [slug]);
        const [existingEmail] = await db.execute('SELECT id FROM users WHERE email = ?', [email]);

        if (existingSlug.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Slug already exists'
            });
        }

        if (existingEmail.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Email already exists'
            });
        }

        // Create user record first
        const hashedPassword = password ? await bcrypt.hash(password, 10) : await bcrypt.hash('defaultpassword123', 10);
        
        const [userResult] = await db.execute(`
            INSERT INTO users (email, password_hash, role, is_active, created_at, updated_at)
            VALUES (?, ?, 'model', 1, NOW(), NOW())
        `, [email, hashedPassword]);

        // Create model record
        const [modelResult] = await db.execute(`
            INSERT INTO models (
                name, slug, business_type_id, page_set_id, theme_set_id, 
                email, phone, is_active, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'trial', NOW(), NOW())
        `, [name, slug, business_type_id, page_set_id, theme_set_id, email, phone]);

        res.json({
            success: true,
            message: 'Client created successfully',
            data: {
                model_id: modelResult.insertId,
                user_id: userResult.insertId
            }
        });

    } catch (error) {
        console.error('Error creating client:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create client'
        });
    }
});

// Reset client password
router.post('/clients/:id/reset-password', async (req, res) => {
    try {
        const { id } = req.params;
        const { new_password } = req.body;

        // Get client email
        const [client] = await db.execute('SELECT email FROM models WHERE id = ?', [id]);
        
        if (client.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Client not found'
            });
        }

        // Generate password if not provided
        const password = new_password || crypto.randomBytes(8).toString('hex');
        const hashedPassword = await bcrypt.hash(password, 10);

        // Update user password
        await db.execute(`
            UPDATE users SET 
                password_hash = ?,
                updated_at = NOW()
            WHERE email = ?
        `, [hashedPassword, client[0].email]);

        res.json({
            success: true,
            message: 'Password reset successfully',
            data: {
                new_password: password
            }
        });

    } catch (error) {
        console.error('Error resetting password:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to reset password'
        });
    }
});

// Bulk operations
router.post('/clients/bulk', async (req, res) => {
    try {
        const { action, client_ids } = req.body;

        if (!action || !client_ids || !Array.isArray(client_ids) || client_ids.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Action and client_ids array are required'
            });
        }

        const placeholders = client_ids.map(() => '?').join(',');
        let query;
        let successMessage;

        switch (action) {
            case 'activate':
                query = `UPDATE models SET status = 'active', updated_at = NOW() WHERE id IN (${placeholders})`;
                successMessage = 'Clients activated successfully';
                break;
            case 'suspend':
                query = `UPDATE models SET status = 'suspended', updated_at = NOW() WHERE id IN (${placeholders})`;
                successMessage = 'Clients suspended successfully';
                break;
            case 'trial':
                query = `UPDATE models SET status = 'trial', updated_at = NOW() WHERE id IN (${placeholders})`;
                successMessage = 'Clients set to trial successfully';
                break;
            case 'inactive':
                query = `UPDATE models SET status = 'inactive', updated_at = NOW() WHERE id IN (${placeholders})`;
                successMessage = 'Clients set to inactive successfully';
                break;
            case 'delete':
                // First delete from users table
                await db.execute(`
                    DELETE u FROM users u 
                    INNER JOIN models m ON u.email = m.email 
                    WHERE m.id IN (${placeholders})
                `, client_ids);
                
                // Then delete from models table
                query = `DELETE FROM models WHERE id IN (${placeholders})`;
                successMessage = 'Clients deleted successfully';
                break;
            default:
                return res.status(400).json({
                    success: false,
                    error: 'Invalid action'
                });
        }

        await db.execute(query, client_ids);

        res.json({
            success: true,
            message: successMessage,
            affected_count: client_ids.length
        });

    } catch (error) {
        console.error('Error performing bulk operation:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to perform bulk operation'
        });
    }
});

// Export clients data
router.get('/clients/export/csv', async (req, res) => {
    try {
        const [clients] = await db.execute(`
            SELECT 
                m.name,
                m.slug,
                m.email,
                m.phone,
                m.status,
                m.subscription_status,
                m.created_at,
                bt.display_name as business_type
            FROM models m
            LEFT JOIN business_types bt ON m.business_type_id = bt.id
            ORDER BY m.created_at DESC
        `);

        // Convert to CSV
        const headers = ['Name', 'Slug', 'Email', 'Phone', 'Status', 'Subscription Status', 'Created At', 'Business Type'];
        const csvData = [
            headers.join(','),
            ...clients.map(client => [
                client.name,
                client.slug,
                client.email || '',
                client.phone || '',
                client.status,
                client.subscription_status || '',
                client.created_at,
                client.business_type || ''
            ].map(field => `"${field}"`).join(','))
        ].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="musenest-clients.csv"');
        res.send(csvData);

    } catch (error) {
        console.error('Error exporting clients:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to export client data'
        });
    }
});

// Get subscription analytics
router.get('/subscriptions/analytics', async (req, res) => {
    try {
        // Subscription status breakdown
        const [subscriptionBreakdown] = await db.execute(`
            SELECT 
                subscription_status,
                COUNT(*) as count,
                ROUND(AVG(balance_due), 2) as avg_balance
            FROM models 
            WHERE subscription_status IS NOT NULL
            GROUP BY subscription_status
        `);

        // Revenue by month (last 12 months)
        const [monthlyRevenue] = await db.execute(`
            SELECT 
                DATE_FORMAT(next_billing_at, '%Y-%m') as month,
                COUNT(*) * 29.99 as estimated_revenue,
                COUNT(*) as active_subscriptions
            FROM models 
            WHERE subscription_status = 'active' 
                AND next_billing_at IS NOT NULL
                AND next_billing_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
            GROUP BY DATE_FORMAT(next_billing_at, '%Y-%m')
            ORDER BY month DESC
        `);

        // Trial conversions
        const [trialStats] = await db.execute(`
            SELECT 
                COUNT(CASE WHEN status = 'trial' THEN 1 END) as current_trials,
                COUNT(CASE WHEN status = 'active' AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as recent_conversions
            FROM models
        `);

        res.json({
            success: true,
            data: {
                subscription_breakdown: subscriptionBreakdown,
                monthly_revenue: monthlyRevenue,
                trial_stats: trialStats[0]
            }
        });

    } catch (error) {
        console.error('Error fetching subscription analytics:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch subscription analytics'
        });
    }
});

// Manage client subscription
router.post('/clients/:id/subscription', async (req, res) => {
    try {
        const { id } = req.params;
        const { action, subscription_data } = req.body;

        switch (action) {
            case 'activate':
                await db.execute(`
                    UPDATE models SET 
                        subscription_status = 'active',
                        status = 'active',
                        trial_ends_at = NULL,
                        next_billing_at = DATE_ADD(NOW(), INTERVAL 1 MONTH),
                        updated_at = NOW()
                    WHERE id = ?
                `, [id]);
                break;

            case 'cancel':
                await db.execute(`
                    UPDATE models SET 
                        subscription_status = 'canceled',
                        updated_at = NOW()
                    WHERE id = ?
                `, [id]);
                break;

            case 'extend_trial':
                const days = subscription_data?.trial_days || 7;
                await db.execute(`
                    UPDATE models SET 
                        trial_ends_at = DATE_ADD(NOW(), INTERVAL ? DAY),
                        updated_at = NOW()
                    WHERE id = ?
                `, [days, id]);
                break;

            case 'update_billing':
                await db.execute(`
                    UPDATE models SET 
                        next_billing_at = ?,
                        updated_at = NOW()
                    WHERE id = ?
                `, [subscription_data.next_billing_at, id]);
                break;

            default:
                return res.status(400).json({
                    success: false,
                    error: 'Invalid subscription action'
                });
        }

        res.json({
            success: true,
            message: 'Subscription updated successfully'
        });

    } catch (error) {
        console.error('Error managing subscription:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to manage subscription'
        });
    }
});

// Get business types for dropdown
router.get('/business-types', async (req, res) => {
    try {
        const [businessTypes] = await db.execute(
            'SELECT id, name, display_name FROM business_types ORDER BY display_name'
        );

        res.json({
            success: true,
            data: businessTypes
        });

    } catch (error) {
        console.error('Error fetching business types:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch business types'
        });
    }
});

module.exports = router;