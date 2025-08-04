const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const bcrypt = require('bcrypt');
const mysql = require('mysql2');
const AccountNumberGenerator = require('../../utils/account-number-generator');
const ReferralCodeGenerator = require('../../utils/referral-code-generator');

// POST /api/clients/validate-email - Check if email already exists
router.post('/validate-email', async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({
                success: false,
                error: 'Email is required'
            });
        }
        
        // Check if email exists in users table
        const escapedEmail = mysql.escape(email.toLowerCase().trim());
        const [existingUsers] = await db.pool.query(`SELECT id FROM users WHERE email = ${escapedEmail}`);
        
        res.json({
            success: true,
            exists: existingUsers.length > 0,
            email: email.toLowerCase().trim()
        });
        
    } catch (error) {
        console.error('Email validation error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to validate email'
        });
    }
});

// POST /api/clients/test - Simple test endpoint
router.post('/test', async (req, res) => {
    try {
        console.log('Testing simple insert...');
        const testEmail = 'test' + Date.now() + '@example.com';
        const [result] = await db.pool.query(`INSERT INTO users (email, password_hash, role, created_at) VALUES ('${testEmail}', 'test', 'model', NOW())`);
        res.json({ success: true, insertId: result.insertId });
    } catch (error) {
        console.error('Test error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/clients - Create new client with onboarding data
router.post('/', async (req, res) => {
    try {
        const {
            name,
            email,
            phone,
            business_type,
            description,
            template_id,
            subscription_tier_id,
            ai_config,
            status = 'active',
            trial_days = 7,
            client_type = 'muse_owned',
            region_id = 1, // Default to US
            sales_channel_id = 30, // Default to manual
            referral_code = null // Optional referral code
        } = req.body;

        // Validate required fields
        if (!name || !email || !business_type) {
            return res.status(400).json({
                success: false,
                error: 'Name, email, and business type are required'
            });
        }

        // Check if email already exists
        const escapedEmailCheck = mysql.escape(email);
        const [existingUsers] = await db.pool.query(`SELECT id FROM users WHERE email = ${escapedEmailCheck}`);

        if (existingUsers.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Email address already exists'
            });
        }

        // Process referral code if provided
        let referralCodeData = null;
        let referrerUserId = null;
        
        if (referral_code && referral_code.trim()) {
            const trimmedCode = referral_code.trim().toUpperCase();
            
            // Validate referral code format
            const validation = ReferralCodeGenerator.validateCodeFormat(trimmedCode);
            if (!validation.valid) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid referral code format',
                    details: validation.errors
                });
            }
            
            // Look up referral code in database
            const escapedTrimmedCode = mysql.escape(trimmedCode);
            const [referralCodes] = await db.pool.query(`
                SELECT rc.*, u.email as referrer_email, u.id as referrer_user_id
                FROM referral_codes rc
                JOIN users u ON rc.client_id = u.id
                WHERE rc.code = ${escapedTrimmedCode} AND rc.is_active = true
            `);
            
            if (referralCodes.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Referral code not found or inactive'
                });
            }
            
            referralCodeData = referralCodes[0];
            referrerUserId = referralCodeData.referrer_user_id;
            
            // Check if referral code has expired
            if (referralCodeData.expires_at && new Date(referralCodeData.expires_at) < new Date()) {
                return res.status(400).json({
                    success: false,
                    error: 'Referral code has expired'
                });
            }
            
            // Check if referral code has reached usage limit
            if (referralCodeData.usage_limit && referralCodeData.usage_count >= referralCodeData.usage_limit) {
                return res.status(400).json({
                    success: false,
                    error: 'Referral code has reached its usage limit'
                });
            }
        }

        // Generate random password for initial setup
        const tempPassword = Math.random().toString(36).slice(-8);
        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        // Use raw SQL approach due to MySQL 9.3.0 prepared statement issues
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
        const modelSlug = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
        const accountNumber = await AccountNumberGenerator.generate(client_type, region_id, sales_channel_id);
        
        // Escape values for raw SQL
        const escapedEmailInsert = mysql.escape(email);
        const escapedHashedPassword = mysql.escape(hashedPassword);
        const isActive = status === 'active' ? 1 : 0;
        const escapedReferralCode = referral_code ? mysql.escape(referral_code.trim().toUpperCase()) : 'NULL';
        const escapedReferrerUserId = referrerUserId ? referrerUserId : 'NULL';
        const escapedNow = mysql.escape(now);

        // Execute the first query to get user ID
        const userSql = `INSERT INTO users (email, password_hash, role, is_active, referral_code_used, referred_by_user_id, created_at)
                         VALUES (${escapedEmailInsert}, ${escapedHashedPassword}, 'model', ${isActive}, ${escapedReferralCode}, ${escapedReferrerUserId}, ${escapedNow})`;
        
        const [userResult] = await db.pool.query(userSql);
        const userId = userResult.insertId;

        // Create model entry
        const escapedAccountNumber = mysql.escape(accountNumber);
        const escapedName = mysql.escape(name);
        const escapedModelSlug = mysql.escape(modelSlug + '_' + Date.now());
        const escapedStatus = mysql.escape(status);
        const escapedClientType = mysql.escape(client_type);
        
        const modelSql = `INSERT INTO models (account_number, name, slug, email, status, client_type, sales_channel_id, region_id, model_type, created_at, updated_at)
                          VALUES (${escapedAccountNumber}, ${escapedName}, ${escapedModelSlug}, ${escapedEmailInsert}, ${escapedStatus}, ${escapedClientType}, ${sales_channel_id}, ${region_id}, 'live', ${escapedNow}, ${escapedNow})`;
        
        const [modelResult] = await db.pool.query(modelSql);
        const modelId = modelResult.insertId;

        // Continue with the rest
        await db.pool.query(`INSERT INTO model_users (model_id, user_id, role, is_active, added_at) VALUES (${modelId}, ${userId}, 'owner', true, ${escapedNow})`);
        
        const escapedDescription = mysql.escape(description || `Welcome to ${name}'s site`);
        await db.pool.query(`INSERT INTO site_settings (model_id, site_name, model_name, tagline, created_at, updated_at) VALUES (${modelId}, ${escapedName}, ${escapedName}, ${escapedDescription}, ${escapedNow}, ${escapedNow})`);

        // Set template if provided
        if (template_id) {
            await db.pool.query(`INSERT INTO model_theme_sets (model_id, theme_set_id, is_active, applied_at) VALUES (${modelId}, ${template_id}, true, ${escapedNow})`);
        }

        // Create subscription if tier provided
        let subscriptionId = null;
        if (subscription_tier_id) {
            const trialEndDate = new Date();
            trialEndDate.setDate(trialEndDate.getDate() + (trial_days || 7));
            const escapedTrialEndDate = mysql.escape(trialEndDate.toISOString().slice(0, 19).replace('T', ' '));

            // Convert tier name to ID if needed
            let actualTierId = subscription_tier_id;
            if (isNaN(subscription_tier_id)) {
                // It's a tier name, look up the ID
                const escapedTierName = mysql.escape(subscription_tier_id);
                const [tierLookup] = await db.pool.query(`SELECT id FROM subscription_tiers WHERE display_name = ${escapedTierName} OR display_name LIKE ${mysql.escape('%' + subscription_tier_id + '%')}`);
                if (tierLookup.length === 0) {
                    return res.status(400).json({
                        success: false,
                        error: `Subscription tier "${subscription_tier_id}" not found`
                    });
                }
                actualTierId = tierLookup[0].id;
            }

            // Get tier price for trial
            const [tierInfo] = await db.pool.query(`SELECT monthly_price FROM subscription_tiers WHERE id = ${actualTierId}`);
            const monthlyPrice = tierInfo[0]?.monthly_price || 0;
            const [subResult] = await db.pool.query(`INSERT INTO user_subscriptions (user_id, tier_id, subscription_status, billing_cycle, amount_paid, started_at, expires_at, next_billing_date) VALUES (${userId}, ${actualTierId}, 'active', 'monthly', ${monthlyPrice}, ${escapedNow}, ${escapedTrialEndDate}, ${escapedTrialEndDate})`);
            subscriptionId = subResult.insertId;
        }

        // Create AI configuration if provided (skip if table doesn't exist)
        if (ai_config && Object.keys(ai_config).length > 0) {
            try {
                const aiSettings = {
                    auto_moderation: ai_config.auto_moderation === 'on' || ai_config.auto_moderation === true,
                    ai_chat: ai_config.ai_chat === 'on' || ai_config.ai_chat === true,
                    content_generation: ai_config.content_generation === 'on' || ai_config.content_generation === true,
                    smart_scheduling: ai_config.smart_scheduling === 'on' || ai_config.smart_scheduling === true,
                    moderation_level: ai_config.moderation_level || 'moderate',
                    ai_personality: ai_config.ai_personality || 'friendly'
                };

                const escapedAiSettings = mysql.escape(JSON.stringify(aiSettings));
                await db.pool.query(`INSERT INTO ai_configurations (model_id, user_id, config_name, config_data, is_active, created_at, updated_at) VALUES (${modelId}, ${userId}, 'onboarding_config', ${escapedAiSettings}, true, ${escapedNow}, ${escapedNow})`);
            } catch (error) {
                // Skip AI configuration if table doesn't exist or other error
                console.warn('Skipping AI configuration:', error.message);
            }
        }

        // Log referral usage if referral code was used
        if (referralCodeData) {
            const userAgent = req.get('User-Agent') || '';
            const clientIp = req.ip || req.connection.remoteAddress || '';
            const escapedUserAgent = mysql.escape(userAgent);
            const escapedClientIp = mysql.escape(clientIp);
            await db.pool.query(`INSERT INTO referral_usage_log (referral_code_id, referred_user_id, referrer_user_id, signup_ip, signup_user_agent, commission_eligible, used_at) VALUES (${referralCodeData.id}, ${userId}, ${referrerUserId}, ${escapedClientIp}, ${escapedUserAgent}, true, ${escapedNow})`);
        }

        res.json({
            success: true,
            message: 'Client created successfully',
            data: {
                user_id: userId,
                model_id: modelId,
                account_number: accountNumber,
                subscription_id: subscriptionId,
                temp_password: tempPassword,
                login_url: `/login?email=${encodeURIComponent(email)}`,
                site_url: `/${modelSlug}`,
                referral_info: referralCodeData ? {
                    code_used: referralCodeData.code,
                    referred_by: referralCodeData.referrer_email
                } : null
            }
        });

    } catch (error) {
        console.error('Error creating client:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create client account',
            details: error.message
        });
    }
});

// GET /api/clients - Get all clients with pagination and filtering
router.get('/', async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            search = '',
            status = '',
            sort = 'created_at'
        } = req.query;

        const offset = (page - 1) * limit;
        let whereClause = 'WHERE 1=1';
        let params = [];

        // Add search filter
        if (search) {
            whereClause += ' AND (u.email LIKE ? OR m.name LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        // Add status filter
        if (status) {
            whereClause += ' AND u.role = ?';
            params.push(status);
        }

        // Get total count
        const [countResult] = await db.pool.query(`
            SELECT COUNT(*) as total
            FROM users u
            JOIN model_users mu ON u.id = mu.user_id
            JOIN models m ON mu.model_id = m.id
            ${whereClause}
        `, params);

        const total = countResult[0].total;

        // Get paginated results (simplified query for now)
        const [clients] = await db.pool.query(`
            SELECT 
                u.id,
                u.email,
                u.email as name,
                u.role as status,
                u.created_at,
                m.id as model_id,
                m.name as model_name,
                m.slug as model_slug
            FROM users u
            JOIN model_users mu ON u.id = mu.user_id AND mu.role = 'owner'
            JOIN models m ON mu.model_id = m.id
            WHERE u.role = 'model'
            ORDER BY u.created_at DESC
            LIMIT 20
        `);

        res.json({
            success: true,
            data: clients,
            clients: clients, // For backward compatibility
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: total,
                pages: Math.ceil(total / limit)
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

// GET /api/clients/templates - Get available templates for onboarding
router.get('/templates', async (req, res) => {
    try {
        const [templates] = await db.pool.query(`
            SELECT 
                ts.id,
                ts.name,
                ts.display_name as name,
                ts.description,
                CONCAT('/assets/theme-previews/', ts.name, '.jpg') as preview_image,
                ts.category as style,
                ts.category,
                bt.display_name as business_type
            FROM theme_sets ts
            LEFT JOIN business_types bt ON ts.business_type_id = bt.id
            WHERE ts.is_active = true
            ORDER BY ts.category, ts.display_name
        `);

        res.json({
            success: true,
            templates: templates
        });

    } catch (error) {
        console.error('Error fetching templates:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch templates'
        });
    }
});

// GET /api/clients/:id - Get specific client details
router.get('/:id', async (req, res) => {
    try {
        const clientId = req.params.id;

        const [clients] = await db.pool.query(`
            SELECT 
                u.id,
                u.email,
                u.email as name,
                u.role as status,
                u.created_at,
                m.id as model_id,
                m.name as model_name,
                m.slug as model_slug,
                m.status as model_status,
                ss.site_name,
                ss.model_name as display_name,
                ss.tagline,
                ss.city,
                ss.contact_email,
                ss.contact_phone,
                s.id as subscription_id,
                s.tier_id,
                st.display_name as subscription_tier,
                st.monthly_price as subscription_price,
                s.subscription_status,
                s.expires_at as trial_end_date,
                s.next_billing_date,
                s.billing_cycle
            FROM users u
            JOIN model_users mu ON u.id = mu.user_id AND mu.role = 'owner'
            JOIN models m ON mu.model_id = m.id
            LEFT JOIN site_settings ss ON m.id = ss.model_id
            LEFT JOIN user_subscriptions s ON u.id = s.user_id AND s.subscription_status IN ('active', 'cancelled')
            LEFT JOIN subscription_tiers st ON s.tier_id = st.id
            WHERE u.id = ?
        `, [clientId]);

        if (clients.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Client not found'
            });
        }

        const client = clients[0];

        // Get AI configuration
        const [aiConfigs] = await db.pool.query(`
            SELECT config_data, is_active, updated_at
            FROM ai_configurations
            WHERE model_id = ? AND is_active = true
            ORDER BY updated_at DESC
            LIMIT 1
        `, [client.model_id]);

        if (aiConfigs.length > 0) {
            try {
                client.ai_config = JSON.parse(aiConfigs[0].config_data);
            } catch (e) {
                client.ai_config = {};
            }
        } else {
            client.ai_config = {};
        }

        res.json({
            success: true,
            data: client
        });

    } catch (error) {
        console.error('Error fetching client details:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch client details'
        });
    }
});

// PUT /api/clients/:id - Update client information
router.put('/:id', async (req, res) => {
    try {
        const clientId = req.params.id;
        const {
            name,
            email,
            phone,
            status,
            business_type,
            site_name,
            tagline
        } = req.body;

        // Start transaction
        const connection = await db.pool.getConnection();
        await connection.beginTransaction();

        try {
            // Update user information
            if (name || email || phone || status) {
                const updateFields = [];
                const updateParams = [];

                if (name) {
                    updateFields.push('full_name = ?');
                    updateParams.push(name);
                }
                if (email) {
                    updateFields.push('email = ?');
                    updateParams.push(email);
                }
                if (phone) {
                    updateFields.push('phone = ?');
                    updateParams.push(phone);
                }
                if (status) {
                    updateFields.push('status = ?');
                    updateParams.push(status);
                }

                updateParams.push(clientId);

                await connection.execute(`
                    UPDATE users 
                    SET ${updateFields.join(', ')}, updated_at = NOW()
                    WHERE id = ?
                `, updateParams);
            }

            // Update model business type if provided
            if (business_type) {
                await connection.execute(`
                    UPDATE models m
                    JOIN model_users mu ON m.id = mu.model_id
                    SET m.business_type_id = (SELECT id FROM business_types WHERE name = ? LIMIT 1)
                    WHERE mu.user_id = ? AND mu.role = 'owner'
                `, [business_type, clientId]);
            }

            // Update site settings if provided
            if (site_name || tagline) {
                const siteUpdateFields = [];
                const siteUpdateParams = [];

                if (site_name) {
                    siteUpdateFields.push('site_name = ?');
                    siteUpdateParams.push(site_name);
                }
                if (tagline) {
                    siteUpdateFields.push('tagline = ?');
                    siteUpdateParams.push(tagline);
                }

                siteUpdateParams.push(clientId);

                await connection.execute(`
                    UPDATE site_settings ss
                    JOIN models m ON ss.model_id = m.id
                    JOIN model_users mu ON m.id = mu.model_id
                    SET ${siteUpdateFields.join(', ')}, ss.updated_at = NOW()
                    WHERE mu.user_id = ? AND mu.role = 'owner'
                `, siteUpdateParams);
            }

            await connection.commit();

            res.json({
                success: true,
                message: 'Client updated successfully'
            });

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            // Always release the connection
            connection.release();
        }

    } catch (error) {
        console.error('Error updating client:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update client'
        });
    }
});

// ===================================
// REFERRAL CODE MANAGEMENT ENDPOINTS
// ===================================

// POST /api/clients/:id/referral-codes - Create new referral code for client
router.post('/:id/referral-codes', async (req, res) => {
    try {
        const clientId = req.params.id;
        const {
            code_name,
            usage_limit = null,
            expires_at = null,
            custom_code = null
        } = req.body;

        // Get client info for code generation
        const [clients] = await db.pool.query(`
            SELECT u.email, ss.model_name
            FROM users u
            LEFT JOIN model_users mu ON u.id = mu.user_id AND mu.role = 'owner'
            LEFT JOIN models m ON mu.model_id = m.id
            LEFT JOIN site_settings ss ON m.id = ss.model_id
            WHERE u.id = ?
        `, [clientId]);

        if (clients.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Client not found'
            });
        }

        const client = clients[0];

        // Create referral code
        const referralCode = await ReferralCodeGenerator.createReferralCode(clientId, {
            name: client.model_name || client.email.split('@')[0],
            email: client.email,
            codeName: code_name,
            usageLimit: usage_limit,
            expiresAt: expires_at,
            customCode: custom_code
        });

        res.json({
            success: true,
            message: 'Referral code created successfully',
            data: referralCode
        });

    } catch (error) {
        console.error('Error creating referral code:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create referral code',
            details: error.message
        });
    }
});

// GET /api/clients/:id/referral-codes - Get client's referral codes
router.get('/:id/referral-codes', async (req, res) => {
    try {
        const clientId = req.params.id;

        const [referralCodes] = await db.pool.query(`
            SELECT 
                rc.*,
                COUNT(rul.id) as actual_usage_count,
                SUM(CASE WHEN rul.commission_eligible = true THEN 1 ELSE 0 END) as eligible_referrals,
                SUM(rul.commission_amount) as total_commission_earned
            FROM referral_codes rc
            LEFT JOIN referral_usage_log rul ON rc.id = rul.referral_code_id
            WHERE rc.client_id = ?
            GROUP BY rc.id
            ORDER BY rc.created_at DESC
        `, [clientId]);

        res.json({
            success: true,
            data: referralCodes
        });

    } catch (error) {
        console.error('Error fetching referral codes:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch referral codes'
        });
    }
});

// GET /api/referral-codes/validate/:code - Validate referral code
router.get('/referral-codes/validate/:code', async (req, res) => {
    try {
        const code = req.params.code.toUpperCase();

        // Validate format first
        const validation = ReferralCodeGenerator.validateCodeFormat(code);
        if (!validation.valid) {
            return res.json({
                valid: false,
                error: 'Invalid code format',
                details: validation.errors
            });
        }

        // Check database
        const [referralCodes] = await db.pool.query(`
            SELECT 
                rc.*,
                u.email as referrer_email,
                ss.model_name as referrer_name
            FROM referral_codes rc
            JOIN users u ON rc.client_id = u.id
            LEFT JOIN model_users mu ON u.id = mu.user_id AND mu.role = 'owner'
            LEFT JOIN models m ON mu.model_id = m.id
            LEFT JOIN site_settings ss ON m.id = ss.model_id
            WHERE rc.code = ? AND rc.is_active = true
        `, [code]);

        if (referralCodes.length === 0) {
            return res.json({
                valid: false,
                error: 'Referral code not found or inactive'
            });
        }

        const referralCode = referralCodes[0];

        // Check expiry
        if (referralCode.expires_at && new Date(referralCode.expires_at) < new Date()) {
            return res.json({
                valid: false,
                error: 'Referral code has expired'
            });
        }

        // Check usage limit
        if (referralCode.usage_limit && referralCode.usage_count >= referralCode.usage_limit) {
            return res.json({
                valid: false,
                error: 'Referral code has reached its usage limit'
            });
        }

        res.json({
            valid: true,
            data: {
                code: referralCode.code,
                code_name: referralCode.code_name,
                referrer_email: referralCode.referrer_email,
                referrer_name: referralCode.referrer_name || referralCode.referrer_email.split('@')[0],
                usage_count: referralCode.usage_count,
                usage_limit: referralCode.usage_limit,
                expires_at: referralCode.expires_at
            }
        });

    } catch (error) {
        console.error('Error validating referral code:', error);
        res.status(500).json({
            valid: false,
            error: 'Failed to validate referral code'
        });
    }
});

// GET /api/clients/:id/referral-analytics - Get referral performance analytics
router.get('/:id/referral-analytics', async (req, res) => {
    try {
        const clientId = req.params.id;

        // Get referral performance data
        const [analytics] = await db.pool.query(`
            SELECT 
                rc.id,
                rc.code,
                rc.code_name,
                rc.created_at,
                rc.usage_count,
                rc.usage_limit,
                COUNT(rul.id) as total_signups,
                COUNT(CASE WHEN rul.used_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as signups_last_30_days,
                COUNT(CASE WHEN rul.used_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as signups_last_7_days,
                SUM(rul.commission_amount) as total_commission_earned,
                SUM(CASE WHEN rul.commission_paid = true THEN rul.commission_amount ELSE 0 END) as commission_paid
            FROM referral_codes rc
            LEFT JOIN referral_usage_log rul ON rc.id = rul.referral_code_id
            WHERE rc.client_id = ?
            GROUP BY rc.id
            ORDER BY total_signups DESC, rc.created_at DESC
        `, [clientId]);

        // Get recent referrals
        const [recentReferrals] = await db.pool.query(`
            SELECT 
                rul.used_at,
                rul.signup_ip,
                u.email as referred_user_email,
                rc.code as referral_code_used,
                rul.commission_amount,
                rul.commission_eligible
            FROM referral_usage_log rul
            JOIN referral_codes rc ON rul.referral_code_id = rc.id
            JOIN users u ON rul.referred_user_id = u.id
            WHERE rc.client_id = ?
            ORDER BY rul.used_at DESC
            LIMIT 10
        `, [clientId]);

        res.json({
            success: true,
            data: {
                codes: analytics,
                recent_referrals: recentReferrals,
                summary: {
                    total_codes: analytics.length,
                    active_codes: analytics.filter(code => code.usage_limit === null || code.usage_count < code.usage_limit).length,
                    total_referrals: analytics.reduce((sum, code) => sum + code.total_signups, 0),
                    total_commission_earned: analytics.reduce((sum, code) => sum + (parseFloat(code.total_commission_earned) || 0), 0),
                    commission_pending: analytics.reduce((sum, code) => 
                        sum + ((parseFloat(code.total_commission_earned) || 0) - (parseFloat(code.commission_paid) || 0)), 0
                    )
                }
            }
        });

    } catch (error) {
        console.error('Error fetching referral analytics:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch referral analytics'
        });
    }
});

// POST /api/clients/:id/referral-codes/suggestions - Generate referral code suggestions
router.post('/:id/referral-codes/suggestions', async (req, res) => {
    try {
        const clientId = req.params.id;

        // Get client info
        const [clients] = await db.pool.query(`
            SELECT u.email, ss.model_name
            FROM users u
            LEFT JOIN model_users mu ON u.id = mu.user_id AND mu.role = 'owner'
            LEFT JOIN models m ON mu.model_id = m.id
            LEFT JOIN site_settings ss ON m.id = ss.model_id
            WHERE u.id = ?
        `, [clientId]);

        if (clients.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Client not found'
            });
        }

        const client = clients[0];

        // Generate suggestions
        const suggestions = await ReferralCodeGenerator.generateSuggestions({
            name: client.model_name || client.email.split('@')[0],
            email: client.email
        });

        res.json({
            success: true,
            suggestions: suggestions
        });

    } catch (error) {
        console.error('Error generating referral code suggestions:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate suggestions'
        });
    }
});

module.exports = router;