const db = require('../config/database');

// Middleware to check if calendar is enabled for a model and add to template context
module.exports = async function calendarVisibilityMiddleware(req, res, next) {
  try {
    // Extract model slug from URL path
    const pathParts = req.path.split('/').filter(part => part);
    const modelSlug = pathParts[0];
    
    // Skip if no model slug or it's a system path
    if (!modelSlug || modelSlug === 'api' || modelSlug === 'admin' || modelSlug === 'sysadmin') {
      res.locals.calendarEnabled = false;
      return next();
    }

    // Get model by slug
    const modelRows = await db.query(
      'SELECT id FROM models WHERE slug = ? LIMIT 1',
      [modelSlug]
    );

    if (modelRows.length === 0) {
      res.locals.calendarEnabled = false;
      return next();
    }

    const modelId = modelRows[0].id;

    // Get calendar_enabled setting for this model
    const settingRows = await db.query(
      'SELECT setting_value FROM model_settings WHERE model_id = ? AND setting_key = ?',
      [modelId, 'calendar_enabled']
    );

    // Default to enabled if no setting exists (backwards compatibility)
    const calendarEnabled = settingRows.length > 0 ? (settingRows[0].setting_value === '1' || settingRows[0].setting_value === 1) : true;

    // Add to response locals for template access
    res.locals.calendarEnabled = calendarEnabled;

    next();
  } catch (error) {
    console.error('Calendar visibility middleware error:', error);
    // Default to enabled on error to avoid breaking sites
    res.locals.calendarEnabled = true;
    next();
  }
};