const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const logger = require('../../utils/logger');

async function getModelBySlug(slug) {
  const rows = await db.query('SELECT id, slug, name FROM models WHERE slug = ? LIMIT 1', [slug]);
  return rows && rows[0] ? rows[0] : null;
}

// GET /:slug/active - Get the model's currently active theme
router.get('/:slug/active', async (req, res) => {
  try {
    const model = await getModelBySlug(req.params.slug);
    if (!model) {
      return res.fail(404, 'Model not found');
    }

    // Get model's active theme from models table
    const modelRows = await db.query(`
      SELECT theme_set_id 
      FROM models 
      WHERE id = ? 
      LIMIT 1
    `, [model.id]);

    const themeSetId = modelRows && modelRows.length > 0 ? modelRows[0].theme_set_id : null;

    return res.success({
      theme_set_id: themeSetId
    });

  } catch (error) {
    logger.error('model-theme-settings.active error', { 
      slug: req.params.slug, 
      error: error.message 
    });
    return res.fail(500, 'Failed to load active theme', error.message);
  }
});

// GET /:slug - Get current theme settings for a model
router.get('/:slug', async (req, res) => {
  try {
    const model = await getModelBySlug(req.params.slug);
    if (!model) {
      return res.fail(404, 'Model not found');
    }

    // Get model's current theme and color palette settings
    const themeRows = await db.query(`
      SELECT 
        m.theme_set_id, 
        m.active_color_palette_id,
        ts.name as theme_name,
        ts.display_name as theme_display_name,
        cp.name as palette_name,
        cp.display_name as palette_display_name,
        cp.is_system_palette
      FROM models m
      JOIN theme_sets ts ON m.theme_set_id = ts.id
      LEFT JOIN color_palettes cp ON m.active_color_palette_id = cp.id
      WHERE m.id = ?
    `, [model.id]);

    let themeData = {
      theme_set_id: null,
      theme_name: null,
      active_color_palette_id: null,
      palette_name: null,
      is_custom_palette: false
    };

    if (themeRows && themeRows.length > 0) {
      const row = themeRows[0];
      themeData = {
        theme_set_id: row.theme_set_id,
        theme_name: row.theme_display_name || row.theme_name,
        active_color_palette_id: row.active_color_palette_id,
        palette_name: row.palette_display_name || row.palette_name,
        is_custom_palette: !row.is_system_palette
      };
    }

    return res.success({
      success: true,
      data: themeData
    });

  } catch (error) {
    logger.error('model-theme-settings.get error', { 
      slug: req.params.slug, 
      error: error.message 
    });
    return res.fail(500, 'Failed to load theme settings', error.message);
  }
});

// POST /:slug - Save theme settings for a model
router.post('/:slug', async (req, res) => {
  try {
    const model = await getModelBySlug(req.params.slug);
    if (!model) {
      return res.fail(404, 'Model not found');
    }

    const { theme_set_id, custom_colors } = req.body;

    // Validate theme_set_id
    if (!theme_set_id) {
      return res.fail(400, 'theme_set_id is required');
    }

    // Verify theme exists
    const themeExists = await db.query(
      'SELECT id FROM theme_sets WHERE id = ? LIMIT 1', 
      [theme_set_id]
    );
    
    if (!themeExists || themeExists.length === 0) {
      return res.fail(400, 'Invalid theme_set_id');
    }

    // Validate custom_colors structure
    let colorsToSave = {};
    if (custom_colors && typeof custom_colors === 'object') {
      // Validate hex colors
      const validColorProps = ['primary', 'secondary', 'accent', 'background', 'text'];
      const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;
      
      for (const [key, value] of Object.entries(custom_colors)) {
        if (validColorProps.includes(key) && typeof value === 'string' && hexColorRegex.test(value)) {
          colorsToSave[key] = value;
        }
      }
    }

    // Check if model already has theme settings
    const existingRows = await db.query(
      'SELECT id FROM model_theme_sets WHERE model_id = ? LIMIT 1',
      [model.id]
    );

    const colorsJson = JSON.stringify(colorsToSave);

    if (existingRows && existingRows.length > 0) {
      // Update existing record
      await db.query(`
        UPDATE model_theme_sets 
        SET theme_set_id = ?, custom_color_scheme = ?, applied_at = NOW()
        WHERE model_id = ?
      `, [theme_set_id, colorsJson, model.id]);
      
      logger.info('Updated model theme settings', { 
        model_id: model.id, 
        theme_set_id, 
        custom_colors: Object.keys(colorsToSave) 
      });
    } else {
      // Insert new record
      await db.query(`
        INSERT INTO model_theme_sets (model_id, theme_set_id, custom_color_scheme, applied_at) 
        VALUES (?, ?, ?, NOW())
      `, [model.id, theme_set_id, colorsJson]);
      
      logger.info('Created model theme settings', { 
        model_id: model.id, 
        theme_set_id, 
        custom_colors: Object.keys(colorsToSave) 
      });
    }

    return res.success({
      success: true,
      message: 'Theme settings saved successfully',
      data: {
        theme_set_id: theme_set_id,
        custom_colors: colorsToSave
      }
    });

  } catch (error) {
    logger.error('model-theme-settings.post error', { 
      slug: req.params.slug, 
      error: error.message 
    });
    return res.fail(500, 'Failed to save theme settings', error.message);
  }
});

// POST /:slug/activate - Activate theme for live use
router.post('/:slug/activate', async (req, res) => {
  try {
    const model = await getModelBySlug(req.params.slug);
    if (!model) {
      return res.fail(404, 'Model not found');
    }

    const { theme_set_id } = req.body;
    if (!theme_set_id) {
      return res.fail(400, 'theme_set_id is required');
    }

    // Verify theme exists
    const themeExists = await db.query(
      'SELECT id FROM theme_sets WHERE id = ? LIMIT 1', 
      [theme_set_id]
    );
    
    if (!themeExists || themeExists.length === 0) {
      return res.fail(400, 'Invalid theme_set_id');
    }

    // Update the model's active theme
    await db.query(
      'UPDATE models SET theme_set_id = ? WHERE id = ?',
      [theme_set_id, model.id]
    );

    logger.info('Activated theme for model', { 
      model_id: model.id, 
      theme_set_id 
    });

    return res.success({
      success: true,
      message: 'Theme activated successfully',
      data: {
        theme_set_id: theme_set_id
      }
    });

  } catch (error) {
    logger.error('model-theme-settings.activate error', { 
      slug: req.params.slug, 
      error: error.message 
    });
    return res.fail(500, 'Failed to activate theme', error.message);
  }
});

// DELETE /:slug/reset - Reset model to theme defaults (remove custom colors)
router.delete('/:slug/reset', async (req, res) => {
  try {
    const model = await getModelBySlug(req.params.slug);
    if (!model) {
      return res.fail(404, 'Model not found');
    }

    // Reset custom colors to empty object but keep theme selection
    await db.query(`
      UPDATE model_theme_sets 
      SET custom_color_scheme = '{}', applied_at = NOW()
      WHERE model_id = ?
    `, [model.id]);

    logger.info('Reset model theme colors', { model_id: model.id });

    return res.success({
      success: true,
      message: 'Theme colors reset to defaults'
    });

  } catch (error) {
    logger.error('model-theme-settings.reset error', { 
      slug: req.params.slug, 
      error: error.message 
    });
    return res.fail(500, 'Failed to reset theme settings', error.message);
  }
});

module.exports = router;