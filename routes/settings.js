const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken: auth } = require('../middleware/auth');

// Get all settings for authenticated model
router.get('/', auth, async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT * FROM site_settings WHERE model_id = ?
        `, [req.user.id]);

        // Convert array to object for easier access
        const settings = {};
        rows.forEach(setting => {
            settings[setting.setting_key] = {
                value: setting.setting_value,
                category: setting.category,
                updated_at: setting.updated_at
            };
        });

        res.json({
            success: true,
            settings: settings
        });
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch settings'
        });
    }
});

// Get settings by category
router.get('/category/:category', auth, async (req, res) => {
    try {
        const category = req.params.category;
        
        const [rows] = await db.execute(`
            SELECT * FROM site_settings 
            WHERE model_id = ? AND category = ?
            ORDER BY setting_key
        `, [req.user.id, category]);

        const settings = {};
        rows.forEach(setting => {
            settings[setting.setting_key] = {
                value: setting.setting_value,
                category: setting.category,
                updated_at: setting.updated_at
            };
        });

        res.json({
            success: true,
            category: category,
            settings: settings
        });
    } catch (error) {
        console.error('Error fetching category settings:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch category settings'
        });
    }
});

// Get single setting
router.get('/:key', auth, async (req, res) => {
    try {
        const settingKey = req.params.key;

        const [rows] = await db.execute(`
            SELECT * FROM site_settings 
            WHERE model_id = ? AND setting_key = ?
        `, [req.user.id, settingKey]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Setting not found'
            });
        }

        res.json({
            success: true,
            setting: {
                key: rows[0].setting_key,
                value: rows[0].setting_value,
                category: rows[0].category,
                updated_at: rows[0].updated_at
            }
        });
    } catch (error) {
        console.error('Error fetching setting:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch setting'
        });
    }
});

// Update or create single setting
router.put('/:key', auth, async (req, res) => {
    try {
        const settingKey = req.params.key;
        const { value, category } = req.body;

        if (value === undefined || value === null) {
            return res.status(400).json({
                success: false,
                message: 'Setting value is required'
            });
        }

        // Convert value to string for storage
        const stringValue = String(value);
        const settingCategory = category || 'general';

        // Use ON DUPLICATE KEY UPDATE for upsert operation
        await db.execute(`
            INSERT INTO site_settings (model_id, setting_key, setting_value, category, created_at, updated_at)
            VALUES (?, ?, ?, ?, NOW(), NOW())
            ON DUPLICATE KEY UPDATE 
                setting_value = VALUES(setting_value),
                category = VALUES(category),
                updated_at = NOW()
        `, [req.user.id, settingKey, stringValue, settingCategory]);

        // Get the updated setting
        const [rows] = await db.execute(`
            SELECT * FROM site_settings 
            WHERE model_id = ? AND setting_key = ?
        `, [req.user.id, settingKey]);

        res.json({
            success: true,
            message: 'Setting updated successfully',
            setting: {
                key: rows[0].setting_key,
                value: rows[0].setting_value,
                category: rows[0].category,
                updated_at: rows[0].updated_at
            }
        });

    } catch (error) {
        console.error('Error updating setting:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update setting'
        });
    }
});

// Bulk update settings
router.post('/bulk', auth, async (req, res) => {
    try {
        const { settings } = req.body;

        if (!settings || typeof settings !== 'object') {
            return res.status(400).json({
                success: false,
                message: 'Settings object is required'
            });
        }

        // Start transaction
        await db.execute('START TRANSACTION');

        const updatedSettings = {};

        for (const [key, settingData] of Object.entries(settings)) {
            const value = settingData.value !== undefined ? settingData.value : settingData;
            const category = settingData.category || 'general';
            const stringValue = String(value);

            await db.execute(`
                INSERT INTO site_settings (model_id, setting_key, setting_value, category, created_at, updated_at)
                VALUES (?, ?, ?, ?, NOW(), NOW())
                ON DUPLICATE KEY UPDATE 
                    setting_value = VALUES(setting_value),
                    category = VALUES(category),
                    updated_at = NOW()
            `, [req.user.id, key, stringValue, category]);

            updatedSettings[key] = {
                value: stringValue,
                category: category
            };
        }

        await db.execute('COMMIT');

        res.json({
            success: true,
            message: 'Settings updated successfully',
            updated_count: Object.keys(updatedSettings).length,
            settings: updatedSettings
        });

    } catch (error) {
        await db.execute('ROLLBACK');
        console.error('Error bulk updating settings:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update settings'
        });
    }
});

// Delete setting
router.delete('/:key', auth, async (req, res) => {
    try {
        const settingKey = req.params.key;

        // Check if setting exists
        const [existingRows] = await db.execute(`
            SELECT id FROM site_settings 
            WHERE model_id = ? AND setting_key = ?
        `, [req.user.id, settingKey]);

        if (existingRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Setting not found'
            });
        }

        // Delete setting
        await db.execute(`
            DELETE FROM site_settings 
            WHERE model_id = ? AND setting_key = ?
        `, [req.user.id, settingKey]);

        res.json({
            success: true,
            message: 'Setting deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting setting:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete setting'
        });
    }
});

// Get available categories
router.get('/meta/categories', auth, async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT DISTINCT category, COUNT(*) as setting_count
            FROM site_settings 
            WHERE model_id = ?
            GROUP BY category
            ORDER BY category
        `, [req.user.id]);

        res.json({
            success: true,
            categories: rows
        });
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch categories'
        });
    }
});

// Reset settings to defaults (optional - for testing)
router.post('/reset', auth, async (req, res) => {
    try {
        const { category } = req.body;

        if (category) {
            // Reset specific category
            await db.execute(`
                DELETE FROM site_settings 
                WHERE model_id = ? AND category = ?
            `, [req.user.id, category]);
        } else {
            // Reset all settings
            await db.execute(`
                DELETE FROM site_settings WHERE model_id = ?
            `, [req.user.id]);
        }

        // Insert default settings
        const defaultSettings = [
            { key: 'site_name', value: req.user.name, category: 'general' },
            { key: 'model_name', value: req.user.name, category: 'general' },
            { key: 'tagline', value: 'Elegance. Discretion. Desire.', category: 'general' },
            { key: 'meta_description', value: 'Professional companion services', category: 'seo' },
            { key: 'theme', value: 'basic', category: 'appearance' },
            { key: 'contact_email', value: '', category: 'contact' },
            { key: 'contact_phone', value: '', category: 'contact' },
            { key: 'city', value: '', category: 'contact' }
        ];

        for (const setting of defaultSettings) {
            if (!category || setting.category === category) {
                await db.execute(`
                    INSERT INTO site_settings (model_id, setting_key, setting_value, category, created_at, updated_at)
                    VALUES (?, ?, ?, ?, NOW(), NOW())
                `, [req.user.id, setting.key, setting.value, setting.category]);
            }
        }

        res.json({
            success: true,
            message: category 
                ? `Settings for category "${category}" reset to defaults`
                : 'All settings reset to defaults'
        });

    } catch (error) {
        console.error('Error resetting settings:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reset settings'
        });
    }
});

// Update model theme (special endpoint for theme switching)
router.post('/theme', auth, async (req, res) => {
    try {
        const { theme } = req.body;

        if (!theme) {
            return res.status(400).json({
                success: false,
                message: 'Theme name is required'
            });
        }

        // List of available themes (you can expand this)
        const availableThemes = ['basic', 'glamour', 'luxury', 'winter', 'modern', 'dark'];
        
        if (!availableThemes.includes(theme)) {
            return res.status(400).json({
                success: false,
                message: `Invalid theme. Available themes: ${availableThemes.join(', ')}`
            });
        }

        // Update theme setting
        await db.execute(`
            INSERT INTO site_settings (model_id, setting_key, setting_value, category, created_at, updated_at)
            VALUES (?, 'theme', ?, 'appearance', NOW(), NOW())
            ON DUPLICATE KEY UPDATE 
                setting_value = VALUES(setting_value),
                updated_at = NOW()
        `, [req.user.id, theme]);

        // Also update the models table theme field
        await db.execute(`
            UPDATE models SET theme = ?, updated_at = NOW() WHERE id = ?
        `, [theme, req.user.id]);

        res.json({
            success: true,
            message: `Theme changed to "${theme}" successfully`,
            theme: theme
        });

    } catch (error) {
        console.error('Error updating theme:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update theme'
        });
    }
});

module.exports = router;