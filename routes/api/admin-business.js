const express = require('express');
const router = express.Router();
const db = require('../../config/database');

// GET /api/admin-business/business-types - Get all business types for admin
router.get('/business-types', async (req, res) => {
    try {
        const [businessTypes] = await db.execute(`
            SELECT 
                bt.id,
                bt.name,
                bt.display_name,
                bt.description,
                bt.category,
                bt.default_page_sets,
                bt.required_features,
                bt.age_verification_required,
                bt.content_warnings_required,
                bt.pricing_model,
                bt.is_active,
                bt.created_at,
                bt.updated_at,
                COUNT(DISTINCT bps.id) as page_sets_count,
                COUNT(DISTINCT ts.id) as themes_count,
                COUNT(DISTINCT m.id) as models_count
            FROM business_types bt
            LEFT JOIN business_page_sets bps ON bt.id = bps.business_type_id
            LEFT JOIN theme_sets ts ON bt.id = ts.business_type_id
            LEFT JOIN models m ON bt.id = m.business_type_id
            GROUP BY bt.id
            ORDER BY bt.category, bt.display_name
        `);
        
        res.json({
            success: true,
            data: businessTypes
        });
    } catch (error) {
        console.error('Error fetching business types for admin:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch business types'
        });
    }
});

// POST /api/admin-business/business-types - Create new business type
router.post('/business-types', async (req, res) => {
    try {
        const {
            name,
            display_name,
            description,
            category,
            default_page_sets,
            required_features,
            age_verification_required,
            content_warnings_required,
            pricing_model
        } = req.body;

        // Validate required fields
        if (!name || !display_name || !category) {
            return res.status(400).json({
                success: false,
                error: 'Name, display name, and category are required'
            });
        }

        // Check if name already exists
        const [existing] = await db.execute(
            'SELECT id FROM business_types WHERE name = ?',
            [name]
        );

        if (existing.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Business type name already exists'
            });
        }

        const [result] = await db.execute(`
            INSERT INTO business_types (
                name, 
                display_name, 
                description, 
                category,
                default_page_sets,
                required_features,
                age_verification_required,
                content_warnings_required,
                pricing_model,
                is_active,
                created_at,
                updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, true, NOW(), NOW())
        `, [
            name,
            display_name,
            description,
            category,
            JSON.stringify(default_page_sets || []),
            JSON.stringify(required_features || []),
            age_verification_required || false,
            content_warnings_required || false,
            pricing_model || 'subscription'
        ]);

        res.json({
            success: true,
            data: {
                id: result.insertId,
                message: 'Business type created successfully'
            }
        });

    } catch (error) {
        console.error('Error creating business type:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create business type'
        });
    }
});

// PUT /api/admin-business/business-types/:id - Update business type
router.put('/business-types/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name,
            display_name,
            description,
            category,
            default_page_sets,
            required_features,
            age_verification_required,
            content_warnings_required,
            pricing_model,
            is_active
        } = req.body;

        // Check if business type exists
        const [existing] = await db.execute(
            'SELECT id FROM business_types WHERE id = ?',
            [id]
        );

        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Business type not found'
            });
        }

        await db.execute(`
            UPDATE business_types SET 
                name = ?,
                display_name = ?,
                description = ?,
                category = ?,
                default_page_sets = ?,
                required_features = ?,
                age_verification_required = ?,
                content_warnings_required = ?,
                pricing_model = ?,
                is_active = ?,
                updated_at = NOW()
            WHERE id = ?
        `, [
            name,
            display_name,
            description,
            category,
            JSON.stringify(default_page_sets || []),
            JSON.stringify(required_features || []),
            age_verification_required || false,
            content_warnings_required || false,
            pricing_model || 'subscription',
            is_active !== undefined ? is_active : true,
            id
        ]);

        res.json({
            success: true,
            data: {
                message: 'Business type updated successfully'
            }
        });

    } catch (error) {
        console.error('Error updating business type:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update business type'
        });
    }
});

// DELETE /api/admin-business/business-types/:id - Delete business type
router.delete('/business-types/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Check if business type has associated models
        const [models] = await db.execute(
            'SELECT COUNT(*) as count FROM models WHERE business_type_id = ?',
            [id]
        );

        if (models[0].count > 0) {
            return res.status(400).json({
                success: false,
                error: 'Cannot delete business type with associated models'
            });
        }

        // Delete business type (will cascade to page sets and themes)
        const [result] = await db.execute(
            'DELETE FROM business_types WHERE id = ?',
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                error: 'Business type not found'
            });
        }

        res.json({
            success: true,
            data: {
                message: 'Business type deleted successfully'
            }
        });

    } catch (error) {
        console.error('Error deleting business type:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete business type'
        });
    }
});

// GET /api/admin-business/page-sets - Get all page sets with business type info
router.get('/page-sets', async (req, res) => {
    try {
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
                bps.integrations,
                bps.sort_order,
                bps.is_active,
                bps.is_default,
                bps.created_at,
                bps.updated_at,
                bt.name as business_type_name,
                bt.display_name as business_type_display,
                COUNT(m.id) as models_using_count
            FROM business_page_sets bps
            JOIN business_types bt ON bps.business_type_id = bt.id
            LEFT JOIN models m ON bps.id = m.page_set_id
            GROUP BY bps.id
            ORDER BY bt.display_name, bps.sort_order, bps.display_name
        `);
        
        res.json({
            success: true,
            data: pageSets
        });
    } catch (error) {
        console.error('Error fetching page sets for admin:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch page sets'
        });
    }
});

// POST /api/admin-business/page-sets - Create new page set
router.post('/page-sets', async (req, res) => {
    try {
        const {
            business_type_id,
            name,
            display_name,
            description,
            included_pages,
            tier,
            pricing_tier,
            features,
            integrations,
            sort_order,
            is_default
        } = req.body;

        // Validate required fields
        if (!business_type_id || !name || !display_name || !included_pages) {
            return res.status(400).json({
                success: false,
                error: 'Business type ID, name, display name, and included pages are required'
            });
        }

        // Check if name already exists for this business type
        const [existing] = await db.execute(
            'SELECT id FROM business_page_sets WHERE business_type_id = ? AND name = ?',
            [business_type_id, name]
        );

        if (existing.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Page set name already exists for this business type'
            });
        }

        const [result] = await db.execute(`
            INSERT INTO business_page_sets (
                business_type_id,
                name,
                display_name,
                description,
                included_pages,
                tier,
                pricing_tier,
                features,
                integrations,
                sort_order,
                is_active,
                is_default,
                created_at,
                updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, true, ?, NOW(), NOW())
        `, [
            business_type_id,
            name,
            display_name,
            description,
            JSON.stringify(included_pages),
            tier || 'basic',
            pricing_tier || 'free',
            JSON.stringify(features || []),
            JSON.stringify(integrations || []),
            sort_order || 0,
            is_default || false
        ]);

        res.json({
            success: true,
            data: {
                id: result.insertId,
                message: 'Page set created successfully'
            }
        });

    } catch (error) {
        console.error('Error creating page set:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create page set'
        });
    }
});

// PUT /api/admin-business/page-sets/:id - Update page set
router.put('/page-sets/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name,
            display_name,
            description,
            included_pages,
            tier,
            pricing_tier,
            features,
            integrations,
            sort_order,
            is_active,
            is_default
        } = req.body;

        // Check if page set exists
        const [existing] = await db.execute(
            'SELECT id FROM business_page_sets WHERE id = ?',
            [id]
        );

        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Page set not found'
            });
        }

        await db.execute(`
            UPDATE business_page_sets SET 
                name = ?,
                display_name = ?,
                description = ?,
                included_pages = ?,
                tier = ?,
                pricing_tier = ?,
                features = ?,
                integrations = ?,
                sort_order = ?,
                is_active = ?,
                is_default = ?,
                updated_at = NOW()
            WHERE id = ?
        `, [
            name,
            display_name,
            description,
            JSON.stringify(included_pages),
            tier,
            pricing_tier,
            JSON.stringify(features || []),
            JSON.stringify(integrations || []),
            sort_order || 0,
            is_active !== undefined ? is_active : true,
            is_default || false,
            id
        ]);

        res.json({
            success: true,
            data: {
                message: 'Page set updated successfully'
            }
        });

    } catch (error) {
        console.error('Error updating page set:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update page set'
        });
    }
});

// DELETE /api/admin-business/page-sets/:id - Delete page set
router.delete('/page-sets/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Check if page set has associated models
        const [models] = await db.execute(
            'SELECT COUNT(*) as count FROM models WHERE page_set_id = ?',
            [id]
        );

        if (models[0].count > 0) {
            return res.status(400).json({
                success: false,
                error: 'Cannot delete page set with associated models'
            });
        }

        const [result] = await db.execute(
            'DELETE FROM business_page_sets WHERE id = ?',
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                error: 'Page set not found'
            });
        }

        res.json({
            success: true,
            data: {
                message: 'Page set deleted successfully'
            }
        });

    } catch (error) {
        console.error('Error deleting page set:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete page set'
        });
    }
});

module.exports = router;