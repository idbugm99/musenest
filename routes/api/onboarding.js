const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcrypt');

// GET /api/onboarding/business-types - Get all available business types
router.get('/business-types', async (req, res) => {
    try {
        const [businessTypes] = await db.execute(`
            SELECT 
                id,
                name,
                display_name,
                description,
                category,
                age_verification_required,
                content_warnings_required
            FROM business_types 
            WHERE is_active = true 
            ORDER BY category, display_name
        `);
        
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

// GET /api/onboarding/page-sets/:businessTypeId - Get page sets for a business type
router.get('/page-sets/:businessTypeId', async (req, res) => {
    try {
        const { businessTypeId } = req.params;
        
        const [pageSets] = await db.execute(`
            SELECT 
                bps.id,
                bps.name,
                bps.display_name,
                bps.description,
                bps.included_pages,
                bps.tier,
                bps.pricing_tier,
                bps.features,
                bt.name as business_type_name
            FROM business_page_sets bps
            JOIN business_types bt ON bps.business_type_id = bt.id
            WHERE bps.business_type_id = ? AND bps.is_active = true
            ORDER BY 
                CASE bps.tier 
                    WHEN 'basic' THEN 1 
                    WHEN 'professional' THEN 2 
                    WHEN 'premium' THEN 3 
                    WHEN 'enterprise' THEN 4 
                END
        `, [businessTypeId]);
        
        res.json({
            success: true,
            data: pageSets
        });
    } catch (error) {
        console.error('Error fetching page sets:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch page sets'
        });
    }
});

// GET /api/onboarding/themes/:businessTypeId - Get themes for a business type
router.get('/themes/:businessTypeId', async (req, res) => {
    try {
        const { businessTypeId } = req.params;
        
        const [themes] = await db.execute(`
            SELECT 
                ts.id,
                ts.name,
                ts.display_name,
                ts.description,
                ts.category,
                ts.default_color_scheme,
                ts.features,
                ts.industry_features,
                ts.pricing_tier,
                ts.industry_variant,
                bt.name as business_type_name
            FROM theme_sets ts
            JOIN business_types bt ON ts.business_type_id = bt.id
            WHERE ts.business_type_id = ? AND ts.is_active = true
            ORDER BY ts.display_name
        `, [businessTypeId]);
        
        // Also get universal themes that work for any business type
        const [universalThemes] = await db.execute(`
            SELECT 
                ts.id,
                ts.name,
                ts.display_name,
                ts.description,
                ts.category,
                ts.default_color_scheme,
                ts.features,
                ts.industry_features,
                ts.pricing_tier,
                ts.industry_variant,
                'universal' as business_type_name
            FROM theme_sets ts
            WHERE ts.business_type_id IS NULL AND ts.is_active = true
            ORDER BY ts.display_name
        `);
        
        res.json({
            success: true,
            data: {
                industry_specific: themes,
                universal: universalThemes
            }
        });
    } catch (error) {
        console.error('Error fetching themes:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch themes'
        });
    }
});

// POST /api/onboarding/complete - Complete onboarding and create model
router.post('/complete', async (req, res) => {
    try {
        const {
            model_name,
            slug,
            business_type_id,
            page_set_id,
            theme_set_id,
            email,
            phone,
            // Additional contact information
            contact_email,
            secondary_phone,
            preferred_contact_method,
            // Personal information
            date_of_birth,
            nationality,
            current_location,
            // Business information
            client_type,
            status,
            // Referral information
            referral_code_used,
            // Account settings
            password
        } = req.body;

        // Validate required fields
        if (!model_name || !slug || !business_type_id || !page_set_id || !theme_set_id) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }

        // Check if slug is already taken
        const [existingModel] = await db.execute(
            'SELECT id FROM models WHERE slug = ?',
            [slug]
        );

        if (existingModel.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Slug already exists'
            });
        }

        // Process referral code if provided
        let referrerUserId = null;
        if (referral_code_used) {
            try {
                // Look up the referral code and get the owner
                const [referralCode] = await db.execute(`
                    SELECT rc.client_id as referrer_user_id 
                    FROM referral_codes rc 
                    WHERE rc.code = ? AND rc.is_active = true 
                    AND (rc.expires_at IS NULL OR rc.expires_at > NOW())
                    AND (rc.usage_limit IS NULL OR rc.usage_count < rc.usage_limit)
                `, [referral_code_used]);
                
                if (referralCode.length > 0) {
                    referrerUserId = referralCode[0].referrer_user_id;
                }
            } catch (referralError) {
                console.error('Error processing referral code:', referralError);
                // Don't fail onboarding if referral processing fails
            }
        }

        // Generate account number (format: 09 + random 10 digits)
        const account_number = '09' + Math.floor(Math.random() * 10000000000).toString().padStart(10, '0');

        // Create the model with complete information
        const [result] = await db.execute(`
            INSERT INTO models (
                name, 
                slug, 
                business_type_id, 
                page_set_id, 
                theme_set_id,
                email,
                contact_email,
                phone,
                secondary_phone,
                preferred_contact_method,
                date_of_birth,
                nationality,
                current_location,
                client_type,
                status,
                account_number,
                is_active,
                created_at,
                updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, true, NOW(), NOW())
        `, [
            model_name, 
            slug, 
            business_type_id, 
            page_set_id, 
            theme_set_id,
            email,
            contact_email || email, // Use main email as backup
            phone,
            secondary_phone,
            preferred_contact_method || 'email',
            date_of_birth,
            nationality,
            current_location,
            client_type || 'muse_owned', // Default to muse_owned
            status || 'trial', // Default to trial status
            account_number
        ]);

        const modelId = result.insertId;

        // Create user account if email is provided
        let userId = null;
        if (email) {
            try {
                const defaultPassword = password || 'welcome123'; // Default password if none provided
                const hashedPassword = await bcrypt.hash(defaultPassword, 12);

                const [userResult] = await db.execute(`
                    INSERT INTO users (
                        email,
                        password_hash,
                        role,
                        is_active,
                        referral_code_used,
                        referred_by_user_id,
                        created_at,
                        updated_at
                    ) VALUES (?, ?, 'model', true, ?, ?, NOW(), NOW())
                `, [email, hashedPassword, referral_code_used, referrerUserId]);

                userId = userResult.insertId;

                // Create model-user relationship
                await db.execute(`
                    INSERT INTO model_users (model_id, user_id, role, created_at)
                    VALUES (?, ?, 'owner', NOW())
                `, [modelId, userId]);

                // Log referral usage if applicable
                if (referral_code_used && referrerUserId) {
                    try {
                        const [referralCodeInfo] = await db.execute(`
                            SELECT id FROM referral_codes 
                            WHERE code = ? AND client_id = ?
                        `, [referral_code_used, referrerUserId]);

                        if (referralCodeInfo.length > 0) {
                            await db.execute(`
                                INSERT INTO referral_usage_log (
                                    referral_code_id,
                                    referred_user_id,
                                    referrer_user_id,
                                    signup_ip,
                                    commission_eligible,
                                    used_at
                                ) VALUES (?, ?, ?, ?, true, NOW())
                            `, [referralCodeInfo[0].id, userId, referrerUserId, req.ip || null]);
                        }
                    } catch (referralLogError) {
                        console.error('Error logging referral usage:', referralLogError);
                        // Don't fail onboarding if referral logging fails
                    }
                }

            } catch (userError) {
                console.error('Error creating user account:', userError);
                // Don't fail onboarding if user creation fails, just log it
                console.log('Model created successfully but user account creation failed');
            }
        }

        // Create model directories for uploads, images, and videos
        try {
            const baseUploadPath = path.join(__dirname, '../../public/uploads');
            const modelUploadPath = path.join(baseUploadPath, slug);
            const thumbsPath = path.join(modelUploadPath, 'thumbs');
            const videosPath = path.join(modelUploadPath, 'videos');
            
            // Create directories recursively
            await fs.mkdir(modelUploadPath, { recursive: true });
            await fs.mkdir(thumbsPath, { recursive: true });
            await fs.mkdir(videosPath, { recursive: true });
            
            console.log(`Created upload directories for model: ${slug}`);
            
            // Create a placeholder README file in the model directory
            const readmeContent = `# ${model_name} Media Directory\n\nCreated: ${new Date().toISOString()}\nModel ID: ${modelId}\nSlug: ${slug}\n\n## Directory Structure:\n- Main images: Place directly in this folder\n- Thumbnails: /thumbs/\n- Videos: /videos/\n`;
            await fs.writeFile(path.join(modelUploadPath, 'README.md'), readmeContent);
            
        } catch (dirError) {
            console.error('Error creating model directories:', dirError);
            // Don't fail the onboarding if directory creation fails, just log it
        }

        // TODO: Initialize default content based on selected page set and business type
        // This will be implemented when we create the content management system integration

        res.json({
            success: true,
            data: {
                model_id: modelId,
                user_id: userId,
                slug: slug,
                account_number: account_number,
                email: email,
                default_password: password || 'welcome123',
                referral_processed: !!(referral_code_used && referrerUserId),
                message: 'Onboarding completed successfully',
                directories_created: true,
                login_url: `${req.protocol}://${req.get('host')}/login`,
                website_url: `${req.protocol}://${req.get('host')}/${slug}`
            }
        });

    } catch (error) {
        console.error('Error completing onboarding:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to complete onboarding'
        });
    }
});

module.exports = router;