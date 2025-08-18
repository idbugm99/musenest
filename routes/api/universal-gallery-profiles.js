/**
 * Universal Gallery Profiles API Routes
 * API endpoints for profile management and business type assignments
 */

const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');

// Database connection
async function getDbConnection() {
    return mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_DATABASE || 'musenest',
        timezone: '+00:00'
    });
}

// GET /api/universal-gallery/profiles - Get all gallery profiles
router.get('/profiles', async (req, res) => {
    let db;
    try {
        db = await getDbConnection();
        
        const [profiles] = await db.execute(`
            SELECT * FROM gallery_profiles 
            ORDER BY is_system_default DESC, profile_display_name ASC
        `);
        
        res.json(profiles);
        
    } catch (error) {
        console.error('Error fetching gallery profiles:', error);
        res.status(500).json({ 
            error: 'Failed to fetch gallery profiles',
            message: error.message 
        });
    } finally {
        if (db) await db.end();
    }
});

// POST /api/universal-gallery/profiles - Create new gallery profile
router.post('/profiles', async (req, res) => {
    let db;
    try {
        db = await getDbConnection();
        
        const profileData = req.body;
        
        // Validate required fields
        if (!profileData.profileName || !profileData.profileDisplayName || !profileData.layoutType) {
            return res.status(400).json({
                error: 'Missing required fields',
                message: 'Profile name, display name, and layout type are required'
            });
        }

        // Check for duplicate profile names
        const [existing] = await db.execute(
            'SELECT id FROM gallery_profiles WHERE profile_name = ?',
            [profileData.profileName]
        );

        if (existing.length > 0) {
            return res.status(400).json({
                error: 'Duplicate profile name',
                message: 'A profile with this name already exists'
            });
        }

        // Insert new profile
        const [result] = await db.execute(`
            INSERT INTO gallery_profiles (
                profile_name, profile_display_name, profile_description,
                layout_type, images_per_page, grid_columns_desktop, grid_columns_tablet, grid_columns_mobile,
                aspect_ratio, lightbox_enabled, lightbox_fullscreen, lightbox_zoom, lightbox_animation,
                pagination_type, enable_search, enable_sorting, enable_filtering, show_captions, show_image_info,
                lazy_loading_enabled, prefetch_enabled, prefetch_strategy, respect_reduced_motion,
                keyboard_navigation, aria_labels, screen_reader_support,
                allow_carousel_timing_override, allow_visible_items_override, 
                allow_section_visibility_override, allow_caption_override,
                is_system_default, is_active, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        `, [
            profileData.profileName,
            profileData.profileDisplayName,
            profileData.profileDescription || null,
            profileData.layoutType,
            profileData.imagesPerPage || 20,
            profileData.gridColumnsDesktop || 4,
            profileData.gridColumnsTablet || 3,
            profileData.gridColumnsMobile || 2,
            profileData.aspectRatio || '4/3',
            profileData.lightboxEnabled !== false,
            profileData.lightboxFullscreen !== false,
            profileData.lightboxZoom !== false,
            profileData.lightboxAnimation || 'fade',
            profileData.paginationType || 'pagination',
            profileData.enableSearch === true,
            profileData.enableSorting === true,
            profileData.enableFiltering !== false,
            profileData.showCaptions !== false,
            profileData.showImageInfo === true,
            profileData.lazyLoadingEnabled !== false,
            profileData.prefetchEnabled !== false,
            profileData.prefetchStrategy || 'balanced',
            profileData.respectReducedMotion !== false,
            profileData.keyboardNavigation !== false,
            profileData.ariaLabels !== false,
            profileData.screenReaderSupport !== false,
            profileData.allowCarouselTimingOverride !== false,
            profileData.allowVisibleItemsOverride !== false,
            profileData.allowSectionVisibilityOverride !== false,
            profileData.allowCaptionOverride !== false,
            false, // is_system_default
            true   // is_active
        ]);

        // Fetch the created profile
        const [newProfile] = await db.execute(
            'SELECT * FROM gallery_profiles WHERE id = ?',
            [result.insertId]
        );

        res.json({
            success: true,
            message: 'Gallery profile created successfully',
            profile: newProfile[0]
        });
        
    } catch (error) {
        console.error('Error creating gallery profile:', error);
        res.status(500).json({ 
            error: 'Failed to create gallery profile',
            message: error.message 
        });
    } finally {
        if (db) await db.end();
    }
});

// PUT /api/universal-gallery/profiles/:id - Update gallery profile
router.put('/profiles/:id', async (req, res) => {
    let db;
    try {
        db = await getDbConnection();
        
        const profileId = req.params.id;
        const profileData = req.body;
        
        // Check if profile exists
        const [existing] = await db.execute(
            'SELECT * FROM gallery_profiles WHERE id = ?',
            [profileId]
        );

        if (existing.length === 0) {
            return res.status(404).json({
                error: 'Profile not found',
                message: 'The requested gallery profile does not exist'
            });
        }

        // Check for duplicate profile names (excluding current profile)
        const [duplicates] = await db.execute(
            'SELECT id FROM gallery_profiles WHERE profile_name = ? AND id != ?',
            [profileData.profileName, profileId]
        );

        if (duplicates.length > 0) {
            return res.status(400).json({
                error: 'Duplicate profile name',
                message: 'A profile with this name already exists'
            });
        }

        // Update profile
        await db.execute(`
            UPDATE gallery_profiles SET
                profile_name = ?, profile_display_name = ?, profile_description = ?,
                layout_type = ?, images_per_page = ?, grid_columns_desktop = ?, 
                grid_columns_tablet = ?, grid_columns_mobile = ?, aspect_ratio = ?,
                lightbox_enabled = ?, lightbox_fullscreen = ?, lightbox_zoom = ?, lightbox_animation = ?,
                pagination_type = ?, enable_search = ?, enable_sorting = ?, enable_filtering = ?, 
                show_captions = ?, show_image_info = ?,
                lazy_loading_enabled = ?, prefetch_enabled = ?, prefetch_strategy = ?, respect_reduced_motion = ?,
                keyboard_navigation = ?, aria_labels = ?, screen_reader_support = ?,
                allow_carousel_timing_override = ?, allow_visible_items_override = ?, 
                allow_section_visibility_override = ?, allow_caption_override = ?,
                updated_at = NOW()
            WHERE id = ?
        `, [
            profileData.profileName,
            profileData.profileDisplayName,
            profileData.profileDescription || null,
            profileData.layoutType,
            profileData.imagesPerPage || 20,
            profileData.gridColumnsDesktop || 4,
            profileData.gridColumnsTablet || 3,
            profileData.gridColumnsMobile || 2,
            profileData.aspectRatio || '4/3',
            profileData.lightboxEnabled !== false,
            profileData.lightboxFullscreen !== false,
            profileData.lightboxZoom !== false,
            profileData.lightboxAnimation || 'fade',
            profileData.paginationType || 'pagination',
            profileData.enableSearch === true,
            profileData.enableSorting === true,
            profileData.enableFiltering !== false,
            profileData.showCaptions !== false,
            profileData.showImageInfo === true,
            profileData.lazyLoadingEnabled !== false,
            profileData.prefetchEnabled !== false,
            profileData.prefetchStrategy || 'balanced',
            profileData.respectReducedMotion !== false,
            profileData.keyboardNavigation !== false,
            profileData.ariaLabels !== false,
            profileData.screenReaderSupport !== false,
            profileData.allowCarouselTimingOverride !== false,
            profileData.allowVisibleItemsOverride !== false,
            profileData.allowSectionVisibilityOverride !== false,
            profileData.allowCaptionOverride !== false,
            profileId
        ]);

        // Fetch updated profile
        const [updatedProfile] = await db.execute(
            'SELECT * FROM gallery_profiles WHERE id = ?',
            [profileId]
        );

        res.json({
            success: true,
            message: 'Gallery profile updated successfully',
            profile: updatedProfile[0]
        });
        
    } catch (error) {
        console.error('Error updating gallery profile:', error);
        res.status(500).json({ 
            error: 'Failed to update gallery profile',
            message: error.message 
        });
    } finally {
        if (db) await db.end();
    }
});

// DELETE /api/universal-gallery/profiles/:id - Delete gallery profile
router.delete('/profiles/:id', async (req, res) => {
    let db;
    try {
        db = await getDbConnection();
        
        const profileId = req.params.id;
        
        // Check if profile exists and is not system default
        const [existing] = await db.execute(
            'SELECT * FROM gallery_profiles WHERE id = ?',
            [profileId]
        );

        if (existing.length === 0) {
            return res.status(404).json({
                error: 'Profile not found',
                message: 'The requested gallery profile does not exist'
            });
        }

        if (existing[0].is_system_default) {
            return res.status(400).json({
                error: 'Cannot delete system default',
                message: 'System default profiles cannot be deleted'
            });
        }

        // Check if profile is assigned to any business types
        const [assignments] = await db.execute(
            'SELECT COUNT(*) as count FROM business_type_gallery_profiles WHERE gallery_profile_id = ?',
            [profileId]
        );

        if (assignments[0].count > 0) {
            // Remove assignments first
            await db.execute(
                'DELETE FROM business_type_gallery_profiles WHERE gallery_profile_id = ?',
                [profileId]
            );
        }

        // Delete profile
        await db.execute('DELETE FROM gallery_profiles WHERE id = ?', [profileId]);

        res.json({
            success: true,
            message: 'Gallery profile deleted successfully'
        });
        
    } catch (error) {
        console.error('Error deleting gallery profile:', error);
        res.status(500).json({ 
            error: 'Failed to delete gallery profile',
            message: error.message 
        });
    } finally {
        if (db) await db.end();
    }
});

// GET /api/universal-gallery/business-types - Get all business types
router.get('/business-types', async (req, res) => {
    let db;
    try {
        db = await getDbConnection();
        
        const [businessTypes] = await db.execute(`
            SELECT id, name, display_name, description 
            FROM business_types 
            WHERE is_active = 1 
            ORDER BY display_name ASC
        `);
        
        res.json(businessTypes);
        
    } catch (error) {
        console.error('Error fetching business types:', error);
        res.status(500).json({ 
            error: 'Failed to fetch business types',
            message: error.message 
        });
    } finally {
        if (db) await db.end();
    }
});

// GET /api/universal-gallery/assignments - Get assignment matrix
router.get('/assignments', async (req, res) => {
    let db;
    try {
        db = await getDbConnection();
        
        const [assignments] = await db.execute(`
            SELECT btgp.business_type_id, btgp.gallery_profile_id, btgp.is_default_profile, btgp.display_order,
                   gp.profile_name, gp.profile_display_name, gp.layout_type
            FROM business_type_gallery_profiles btgp
            JOIN gallery_profiles gp ON btgp.gallery_profile_id = gp.id
            ORDER BY btgp.business_type_id ASC, btgp.display_order ASC
        `);
        
        // Group by business type ID
        const matrix = {};
        assignments.forEach(assignment => {
            if (!matrix[assignment.business_type_id]) {
                matrix[assignment.business_type_id] = [];
            }
            matrix[assignment.business_type_id].push(assignment);
        });
        
        res.json(matrix);
        
    } catch (error) {
        console.error('Error fetching assignment matrix:', error);
        res.status(500).json({ 
            error: 'Failed to fetch assignment matrix',
            message: error.message 
        });
    } finally {
        if (db) await db.end();
    }
});

// POST /api/universal-gallery/assignments/default - Update default profile for business type
router.post('/assignments/default', async (req, res) => {
    let db;
    try {
        db = await getDbConnection();
        
        const { business_type_id, gallery_profile_id } = req.body;
        
        // Clear existing defaults for this business type
        await db.execute(
            'UPDATE business_type_gallery_profiles SET is_default_profile = 0 WHERE business_type_id = ?',
            [business_type_id]
        );
        
        // Set new default if provided
        if (gallery_profile_id) {
            // Check if assignment exists
            const [existing] = await db.execute(
                'SELECT id FROM business_type_gallery_profiles WHERE business_type_id = ? AND gallery_profile_id = ?',
                [business_type_id, gallery_profile_id]
            );
            
            if (existing.length === 0) {
                // Create assignment if it doesn't exist
                await db.execute(`
                    INSERT INTO business_type_gallery_profiles 
                    (business_type_id, gallery_profile_id, is_default_profile, display_order, created_at, updated_at)
                    VALUES (?, ?, 1, 1, NOW(), NOW())
                `, [business_type_id, gallery_profile_id]);
            } else {
                // Update existing assignment to be default
                await db.execute(
                    'UPDATE business_type_gallery_profiles SET is_default_profile = 1, updated_at = NOW() WHERE business_type_id = ? AND gallery_profile_id = ?',
                    [business_type_id, gallery_profile_id]
                );
            }
        }

        res.json({
            success: true,
            message: 'Default profile updated successfully'
        });
        
    } catch (error) {
        console.error('Error updating default profile:', error);
        res.status(500).json({ 
            error: 'Failed to update default profile',
            message: error.message 
        });
    } finally {
        if (db) await db.end();
    }
});

// POST /api/universal-gallery/assignments/toggle - Toggle profile assignment
router.post('/assignments/toggle', async (req, res) => {
    let db;
    try {
        db = await getDbConnection();
        
        const { business_type_id, gallery_profile_id, is_assigned } = req.body;
        
        if (is_assigned) {
            // Check if assignment already exists
            const [existing] = await db.execute(
                'SELECT id FROM business_type_gallery_profiles WHERE business_type_id = ? AND gallery_profile_id = ?',
                [business_type_id, gallery_profile_id]
            );
            
            if (existing.length === 0) {
                // Get next display order
                const [maxOrder] = await db.execute(
                    'SELECT COALESCE(MAX(display_order), 0) + 1 as next_order FROM business_type_gallery_profiles WHERE business_type_id = ?',
                    [business_type_id]
                );
                
                // Create new assignment
                await db.execute(`
                    INSERT INTO business_type_gallery_profiles 
                    (business_type_id, gallery_profile_id, is_default_profile, display_order, created_at, updated_at)
                    VALUES (?, ?, 0, ?, NOW(), NOW())
                `, [business_type_id, gallery_profile_id, maxOrder[0].next_order]);
            }
        } else {
            // Remove assignment
            await db.execute(
                'DELETE FROM business_type_gallery_profiles WHERE business_type_id = ? AND gallery_profile_id = ?',
                [business_type_id, gallery_profile_id]
            );
        }

        res.json({
            success: true,
            message: 'Profile assignment updated successfully'
        });
        
    } catch (error) {
        console.error('Error toggling profile assignment:', error);
        res.status(500).json({ 
            error: 'Failed to update profile assignment',
            message: error.message 
        });
    } finally {
        if (db) await db.end();
    }
});

// POST /api/universal-gallery/profiles/validate - Validate all profiles
router.post('/profiles/validate', async (req, res) => {
    let db;
    try {
        db = await getDbConnection();
        
        const [profiles] = await db.execute('SELECT * FROM gallery_profiles WHERE is_active = 1');
        
        const errors = [];
        
        profiles.forEach(profile => {
            // Validate required fields
            if (!profile.profile_name || !profile.profile_display_name || !profile.layout_type) {
                errors.push(`Profile ${profile.id}: Missing required fields`);
            }
            
            // Validate images per page
            if (profile.images_per_page < 1 || profile.images_per_page > 100) {
                errors.push(`Profile ${profile.profile_display_name}: Invalid images per page (${profile.images_per_page})`);
            }
            
            // Validate grid columns
            if (profile.grid_columns_desktop < 1 || profile.grid_columns_desktop > 10) {
                errors.push(`Profile ${profile.profile_display_name}: Invalid desktop columns (${profile.grid_columns_desktop})`);
            }
        });

        res.json({
            isValid: errors.length === 0,
            profileCount: profiles.length,
            errors: errors
        });
        
    } catch (error) {
        console.error('Error validating profiles:', error);
        res.status(500).json({ 
            error: 'Failed to validate profiles',
            message: error.message 
        });
    } finally {
        if (db) await db.end();
    }
});

// GET /api/universal-gallery/profiles/export - Export profiles as JSON
router.get('/profiles/export', async (req, res) => {
    let db;
    try {
        db = await getDbConnection();
        
        const [profiles] = await db.execute('SELECT * FROM gallery_profiles ORDER BY id ASC');
        const [assignments] = await db.execute(`
            SELECT btgp.*, bt.name as business_type_name, gp.profile_name
            FROM business_type_gallery_profiles btgp
            JOIN business_types bt ON btgp.business_type_id = bt.id
            JOIN gallery_profiles gp ON btgp.gallery_profile_id = gp.id
            ORDER BY btgp.business_type_id ASC, btgp.display_order ASC
        `);

        const exportData = {
            exported_at: new Date().toISOString(),
            profiles: profiles,
            assignments: assignments,
            version: '1.0'
        };

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=gallery_profiles_${new Date().toISOString().split('T')[0]}.json`);
        res.json(exportData);
        
    } catch (error) {
        console.error('Error exporting profiles:', error);
        res.status(500).json({ 
            error: 'Failed to export profiles',
            message: error.message 
        });
    } finally {
        if (db) await db.end();
    }
});

module.exports = router;