const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');
const db = require('../../config/database');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

// Get system statistics
router.get('/stats', async (req, res) => {
    try {
        // Total clients (only MuseNest-owned clients for business metrics)
        const [totalClients] = await db.execute(
            'SELECT COUNT(*) as count FROM models WHERE client_type = "muse_owned"'
        );
        
        // Active subscriptions (MuseNest-owned only)
        const [activeSubscriptions] = await db.execute(
            'SELECT COUNT(*) as count FROM models WHERE subscription_status = "active" AND client_type = "muse_owned"'
        );
        
        // Trial accounts (MuseNest-owned only)
        const [trialAccounts] = await db.execute(
            'SELECT COUNT(*) as count FROM models WHERE status = "trial" AND client_type = "muse_owned"'
        );
        
        // Monthly revenue estimation (placeholder - would integrate with Stripe in production)
        const [revenueData] = await db.execute(`
            SELECT COUNT(*) * 29.99 as estimated_revenue 
            FROM models 
            WHERE subscription_status = "active" AND client_type = "muse_owned"
        `);

        // Additional metrics by client type for future expansion
        const [whiteLabelCount] = await db.execute(
            'SELECT COUNT(*) as count FROM models WHERE client_type = "white_label"'
        );
        
        const [subClientCount] = await db.execute(
            'SELECT COUNT(*) as count FROM models WHERE client_type = "sub_client"'
        );

        res.success({
                // Primary MuseNest business metrics
                total_clients: totalClients[0].count,
                active_subscriptions: activeSubscriptions[0].count,
                trial_accounts: trialAccounts[0].count,
                monthly_revenue: revenueData[0].estimated_revenue || 0,
                
                // Client type breakdown for advanced analytics
                client_types: {
                    muse_owned: totalClients[0].count,
                    white_label: whiteLabelCount[0].count,
                    sub_clients: subClientCount[0].count
                }
        });

    } catch (error) {
        logger.error('system stats error', { error: error.message });
        res.fail(500, 'Failed to fetch system statistics', error.message);
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
            subscription_status = '',
            client_type = '', // New filter for client type
            include_admin = 'false' // Option to include admin models
        } = req.query;

        const offset = (page - 1) * limit;
        
        // Build WHERE clause based on filters
        let whereClause = 'WHERE 1=1';
        if (include_admin === 'false') {
            whereClause += ' AND client_type != "admin"';
        }
        if (client_type) {
            whereClause += ` AND client_type = "${client_type}"`;
        }
        if (status) {
            whereClause += ` AND status = "${status}"`;
        }
        if (subscription_status) {
            whereClause += ` AND subscription_status = "${subscription_status}"`;
        }
        if (search) {
            whereClause += ` AND (name LIKE "%${search}%" OR email LIKE "%${search}%")`;
        }

        // Get total count with same filters
        const [totalResult] = await db.execute(`SELECT COUNT(*) as total FROM models ${whereClause}`);
        const total = totalResult[0].total;

        // Get clients with pagination - use template literal for now to avoid parameter binding issues
        const limitNum = parseInt(limit);
        const offsetNum = parseInt(offset);
        
        // Build WHERE clause for main query (with table aliases)
        let mainWhereClause = whereClause.replace(/\b(client_type|status|subscription_status|name|email)\b/g, 'm.$1');

        const [clients] = await db.execute(`
            SELECT 
                m.id,
                m.name,
                m.slug,
                m.email,
                m.phone,
                m.status,
                m.client_type,
                m.account_number,
                m.parent_client_id,
                m.subscription_status,
                m.stripe_customer_id,
                m.stripe_subscription_id,
                m.trial_ends_at,
                m.next_billing_at,
                m.balance_due,
                m.created_at,
                m.updated_at,
                bt.display_name as business_type,
                bt.id as business_type_id,
                parent.name as parent_client_name
            FROM models m
            LEFT JOIN business_types bt ON m.business_type_id = bt.id
            LEFT JOIN models parent ON m.parent_client_id = parent.id
            ${mainWhereClause}
            ORDER BY m.created_at DESC
            LIMIT ${limitNum} OFFSET ${offsetNum}
        `);

        res.set('Cache-Control', 'private, max-age=30');
        res.success({
            clients,
            pagination: {
                current_page: parseInt(page),
                per_page: parseInt(limit),
                total: total,
                total_pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        logger.error('clients list error', { error: error.message });
        res.fail(500, 'Failed to fetch clients', error.message);
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
                u.is_active as user_active,
                u.referral_code_used,
                u.referred_by_user_id,
                referrer.email as referrer_email,
                referrer_model.name as referrer_name
            FROM models m
            LEFT JOIN business_types bt ON m.business_type_id = bt.id
            LEFT JOIN users u ON m.email = u.email
            LEFT JOIN users referrer ON u.referred_by_user_id = referrer.id
            LEFT JOIN model_users mu ON referrer.id = mu.user_id AND mu.role = 'owner'
            LEFT JOIN models referrer_model ON mu.model_id = referrer_model.id
            WHERE m.id = ?
        `, [id]);

        if (client.length === 0) {
            return res.fail(404, 'Client not found');
        }

        res.success(client[0]);

    } catch (error) {
        logger.error('client detail error', { error: error.message });
        res.fail(500, 'Failed to fetch client details', error.message);
    }
});

// DELETE /api/system-management/clients/:id - Delete a client
router.delete('/clients/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Get client info before deletion for cleanup
        const [clientInfo] = await db.execute(`
                SELECT m.slug, m.email, u.id as user_id 
                FROM models m 
                LEFT JOIN users u ON m.email = u.email 
                WHERE m.id = ?
        `, [id]);
        
        if (clientInfo.length === 0) {
            return res.fail(404, 'Client not found');
        }
            
        const client = clientInfo[0];
        
        // Delete related records first (foreign key constraints)
        
        // Delete referral usage logs
        if (client.user_id) {
            await db.execute('DELETE FROM referral_usage_log WHERE referred_user_id = ? OR referrer_user_id = ?', [client.user_id, client.user_id]);
        }
        
        // Delete referral codes
        if (client.user_id) {
            await db.execute('DELETE FROM referral_codes WHERE client_id = ?', [client.user_id]);
        }
        
        // Delete model-user relationships
        await db.execute('DELETE FROM model_users WHERE model_id = ?', [id]);
        
        // Delete user subscriptions
        if (client.user_id) {
            await db.execute('DELETE FROM user_subscriptions WHERE user_id = ?', [client.user_id]);
        }
        
        // Delete user account
        if (client.user_id) {
            await db.execute('DELETE FROM users WHERE id = ?', [client.user_id]);
        }
        
        // Delete model record
        await db.execute('DELETE FROM models WHERE id = ?', [id]);
            
        // TODO: Clean up file system directories for the client
        // This would include removing /public/uploads/{slug}/ directory
        
        res.success({ deleted_slug: client.slug }, { message: 'Client deleted successfully' });
        
    } catch (error) {
        logger.error('delete client error', { error: error.message });
        res.fail(500, 'Failed to delete client', error.message);
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
            password,
            status,
            business_type_id,
            subscription_status,
            stripe_customer_id,
            stripe_subscription_id,
            trial_ends_at,
            next_billing_at,
            balance_due,
            // Additional profile fields (will be handled separately if needed)
            date_of_birth,
            nationality,
            current_location,
            contact_email,
            preferred_contact_method,
            secondary_phone
        } = req.body;

        // Check if slug is unique (excluding current record)
        if (slug) {
            const [existingSlug] = await db.execute(
                'SELECT id FROM models WHERE slug = ? AND id != ?',
                [slug, id]
            );

            if (existingSlug.length > 0) {
                return res.fail(400, 'Slug already exists');
            }
        }

        // Build dynamic UPDATE query based on provided fields
        let updateFields = [];
        let updateParams = [];
        
        if (name !== undefined) { updateFields.push('name = ?'); updateParams.push(name); }
        if (slug !== undefined) { updateFields.push('slug = ?'); updateParams.push(slug); }
        if (email !== undefined) { updateFields.push('email = ?'); updateParams.push(email); }
        if (phone !== undefined) { updateFields.push('phone = ?'); updateParams.push(phone); }
        if (contact_email !== undefined) { updateFields.push('contact_email = ?'); updateParams.push(contact_email); }
        if (secondary_phone !== undefined) { updateFields.push('secondary_phone = ?'); updateParams.push(secondary_phone); }
        if (preferred_contact_method !== undefined) { updateFields.push('preferred_contact_method = ?'); updateParams.push(preferred_contact_method); }
        if (date_of_birth !== undefined) { updateFields.push('date_of_birth = ?'); updateParams.push(date_of_birth); }
        if (nationality !== undefined) { updateFields.push('nationality = ?'); updateParams.push(nationality); }
        if (current_location !== undefined) { updateFields.push('current_location = ?'); updateParams.push(current_location); }
        if (status !== undefined) { updateFields.push('status = ?'); updateParams.push(status); }
        if (business_type_id !== undefined) { updateFields.push('business_type_id = ?'); updateParams.push(business_type_id); }
        if (subscription_status !== undefined) { updateFields.push('subscription_status = ?'); updateParams.push(subscription_status); }
        if (stripe_customer_id !== undefined) { updateFields.push('stripe_customer_id = ?'); updateParams.push(stripe_customer_id); }
        if (stripe_subscription_id !== undefined) { updateFields.push('stripe_subscription_id = ?'); updateParams.push(stripe_subscription_id); }
        if (trial_ends_at !== undefined) { updateFields.push('trial_ends_at = ?'); updateParams.push(trial_ends_at); }
        if (next_billing_at !== undefined) { updateFields.push('next_billing_at = ?'); updateParams.push(next_billing_at); }
        if (balance_due !== undefined) { updateFields.push('balance_due = ?'); updateParams.push(balance_due); }
        
        // Always add updated_at
        updateFields.push('updated_at = NOW()');
        updateParams.push(id);
        
        if (updateFields.length > 1) { // More than just updated_at
            await db.execute(`
                UPDATE models SET ${updateFields.join(', ')} WHERE id = ?
            `, updateParams);
        }

        // Update corresponding user record if email is provided
        if (email) {
            // First get the current email from the model
            const [currentModel] = await db.execute('SELECT email FROM models WHERE id = ?', [id]);
            
            if (currentModel.length > 0) {
                if (currentModel[0].email) {
                    // Update existing user record with the new email
                    await db.execute(`
                        UPDATE users SET 
                            email = ?,
                            updated_at = NOW()
                        WHERE email = ?
                    `, [email, currentModel[0].email]);
                } else {
                    // No existing email - create new user account
                    const defaultPassword = await bcrypt.hash('defaultpassword123', 10);
                    await db.execute(`
                        INSERT INTO users (email, password_hash, role, is_active, created_at, updated_at)
                        VALUES (?, ?, 'model', 1, NOW(), NOW())
                    `, [email, defaultPassword]);
                }
            }
        }

        // Update password if provided
        if (password) {
            // Use the email from the form data (since it might be newly set) or get from model
            let emailToUse = email;
            if (!emailToUse) {
                const [currentModel] = await db.execute('SELECT email FROM models WHERE id = ?', [id]);
                emailToUse = currentModel.length > 0 ? currentModel[0].email : null;
            }
            
            if (emailToUse) {
                const hashedPassword = await bcrypt.hash(password, 10);
                await db.execute(`
                    UPDATE users SET 
                        password_hash = ?,
                        updated_at = NOW()
                    WHERE email = ?
                `, [hashedPassword, emailToUse]);
            }
        }

        res.success({}, { message: 'Client updated successfully' });

    } catch (error) {
        logger.error('update client error', { error: error.message });
        res.fail(500, 'Failed to update client', error.message);
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
            return res.fail(400, 'Name, slug, and email are required');
        }

        // Check if slug and email are unique
        const [existingSlug] = await db.execute('SELECT id FROM models WHERE slug = ?', [slug]);
        const [existingEmail] = await db.execute('SELECT id FROM users WHERE email = ?', [email]);

        if (existingSlug.length > 0) {
            return res.fail(400, 'Slug already exists');
        }

        if (existingEmail.length > 0) {
            return res.fail(400, 'Email already exists');
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

        res.success({
            model_id: modelResult.insertId,
            user_id: userResult.insertId
        }, { message: 'Client created successfully' });

    } catch (error) {
        logger.error('create client error', { error: error.message });
        res.fail(500, 'Failed to create client', error.message);
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
            return res.fail(404, 'Client not found');
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

        res.success({ new_password: password }, { message: 'Password reset successfully' });

    } catch (error) {
        logger.error('reset password error', { error: error.message });
        res.fail(500, 'Failed to reset password', error.message);
    }
});

// Bulk operations
router.post('/clients/bulk', async (req, res) => {
    try {
        const { action, client_ids } = req.body;

        if (!action || !client_ids || !Array.isArray(client_ids) || client_ids.length === 0) {
            return res.fail(400, 'Action and client_ids array are required');
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
                return res.fail(400, 'Invalid action');
        }

        await db.execute(query, client_ids);

        res.success({ affected_count: client_ids.length }, { message: successMessage });

    } catch (error) {
        logger.error('bulk clients error', { error: error.message });
        res.fail(500, 'Failed to perform bulk operation', error.message);
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
        logger.error('export clients error', { error: error.message });
        res.fail(500, 'Failed to export client data', error.message);
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

        res.success({
            subscription_breakdown: subscriptionBreakdown,
            monthly_revenue: monthlyRevenue,
            trial_stats: trialStats[0]
        });

    } catch (error) {
        logger.error('subscription analytics error', { error: error.message });
        res.fail(500, 'Failed to fetch subscription analytics', error.message);
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
                return res.fail(400, 'Invalid subscription action');
        }

        res.success({}, { message: 'Subscription updated successfully' });

    } catch (error) {
        logger.error('manage subscription error', { error: error.message });
        res.fail(500, 'Failed to manage subscription', error.message);
    }
});

// Get business types for dropdown
router.get('/business-types', async (req, res) => {
    try {
        const [businessTypes] = await db.execute(
            'SELECT id, name, display_name FROM business_types ORDER BY display_name'
        );

        res.success(businessTypes);

    } catch (error) {
        logger.error('business types list error', { error: error.message });
        res.fail(500, 'Failed to fetch business types', error.message);
    }
});

// Get all theme sets for template builder
router.get('/theme-sets', async (req, res) => {
    try {
        const { page = 1, limit = 50 } = req.query;
        const perPage = Math.max(1, Math.min(200, parseInt(limit)));
        const offset = (Math.max(1, parseInt(page)) - 1) * perPage;
        const [themeSets] = await db.execute(`
            SELECT 
                ts.*,
                bt.display_name as business_type_name
            FROM theme_sets ts
            LEFT JOIN business_types bt ON ts.business_type_id = bt.id
            WHERE ts.is_active = 1
            ORDER BY ts.category, ts.display_name
            LIMIT ${perPage} OFFSET ${offset}
        `);

        // Parse JSON fields
        const processedThemeSets = themeSets.map(theme => ({
            ...theme,
            default_color_scheme: typeof theme.default_color_scheme === 'string' 
                ? JSON.parse(theme.default_color_scheme) 
                : theme.default_color_scheme,
            features: typeof theme.features === 'string' 
                ? JSON.parse(theme.features) 
                : theme.features,
            industry_features: typeof theme.industry_features === 'string' 
                ? JSON.parse(theme.industry_features) 
                : theme.industry_features
        }));

        const [[{ total }]] = await db.query(`SELECT COUNT(*) as total FROM theme_sets WHERE is_active = 1`);
        res.success(processedThemeSets, { pagination: { page: parseInt(page), limit: perPage, total, pages: Math.ceil(total / perPage) } });

    } catch (error) {
        logger.error('theme sets list error', { error: error.message });
        res.fail(500, 'Failed to fetch theme sets', error.message);
    }
});

// Get all page sets for template builder
router.get('/page-sets', async (req, res) => {
    try {
        const { page = 1, limit = 50 } = req.query;
        const perPage = Math.max(1, Math.min(200, parseInt(limit)));
        const offset = (Math.max(1, parseInt(page)) - 1) * perPage;
        const [pageSets] = await db.execute(`
            SELECT 
                bps.*,
                bt.display_name as business_type_name
            FROM business_page_sets bps
            LEFT JOIN business_types bt ON bps.business_type_id = bt.id
            WHERE bps.is_active = 1
            ORDER BY bt.display_name, bps.tier, bps.display_name
            LIMIT ${perPage} OFFSET ${offset}
        `);

        // Parse JSON fields
        const processedPageSets = pageSets.map(pageSet => ({
            ...pageSet,
            included_pages: typeof pageSet.included_pages === 'string' 
                ? JSON.parse(pageSet.included_pages) 
                : pageSet.included_pages,
            features: typeof pageSet.features === 'string' 
                ? JSON.parse(pageSet.features) 
                : pageSet.features,
            integrations: typeof pageSet.integrations === 'string' 
                ? JSON.parse(pageSet.integrations) 
                : pageSet.integrations
        }));

        const [[{ total }]] = await db.query(`SELECT COUNT(*) as total FROM business_page_sets WHERE is_active = 1`);
        res.success(processedPageSets, { pagination: { page: parseInt(page), limit: perPage, total, pages: Math.ceil(total / perPage) } });

    } catch (error) {
        logger.error('page sets list error', { error: error.message });
        res.fail(500, 'Failed to fetch page sets', error.message);
    }
});

module.exports = router;