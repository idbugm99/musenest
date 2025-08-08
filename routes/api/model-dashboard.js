/**
 * Model Dashboard API - Model-Centric Media Management
 * Provides endpoints for the new model dashboard interface
 * Created: August 7, 2025 - Phase 2 Backend Infrastructure
 */

const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const logger = require('../../utils/logger');

/**
 * Get paginated model cards with statistics
 * GET /api/model-dashboard/models?page=1&limit=20&search=&sort=newest
 */
router.get('/models', async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            search = '',
            sort = 'newest', // newest, oldest, most_violations, most_pending
            filter = 'all' // all, has_pending, has_violations, active_7d
        } = req.query;

        const limitValue = Math.max(1, Math.min(100, parseInt(limit)));
        const offsetValue = Math.max(0, (parseInt(page) - 1) * limitValue);

        // Build WHERE clause for search and filters
        let whereConditions = [];
        let queryParams = [];

        if (search) {
            whereConditions.push('(m.name LIKE ? OR m.display_name LIKE ?)');
            queryParams.push(`%${search}%`, `%${search}%`);
        }

        // Apply filters
        switch (filter) {
            case 'has_pending':
                whereConditions.push('mds.pending_review_count > 0');
                break;
            case 'has_violations':
                whereConditions.push('mds.total_violations_30d > 0');
                break;
            case 'active_7d':
                whereConditions.push('mds.last_upload_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)');
                break;
        }

        const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

        // Build ORDER BY clause
        let orderClause = '';
        switch (sort) {
            case 'oldest':
                orderClause = 'ORDER BY m.created_at ASC';
                break;
            case 'most_violations':
                orderClause = 'ORDER BY mds.total_violations_30d DESC, mds.severity_score_avg DESC';
                break;
            case 'most_pending':
                orderClause = 'ORDER BY mds.pending_review_count DESC, mds.last_upload_date DESC';
                break;
            case 'newest':
            default:
                orderClause = 'ORDER BY m.created_at DESC';
                break;
        }

        // Main query for model cards
        const modelsQuery = `
            SELECT 
                m.id,
                m.name,
                m.name as display_name, -- Using name as display_name fallback
                CONCAT('/public/uploads/profiles/', m.slug, '/profile.jpg') as profile_image_url, -- Constructed path
                m.status,
                m.created_at,
                m.updated_at,
                
                -- Statistics from cache
                COALESCE(mds.total_media_count, 0) as total_media_count,
                COALESCE(mds.pending_review_count, 0) as pending_review_count,
                COALESCE(mds.approved_count, 0) as approved_count,
                COALESCE(mds.approved_blurred_count, 0) as approved_blurred_count,
                COALESCE(mds.rejected_count, 0) as rejected_count,
                
                -- Violation metrics
                COALESCE(mds.total_violations_30d, 0) as violations_30d,
                COALESCE(mds.severity_score_avg, 0.0) as avg_severity_score,
                mds.last_violation_date,
                mds.violation_trend,
                
                -- Activity metrics
                mds.last_upload_date,
                mds.last_review_date,
                COALESCE(mds.avg_review_time_hours, 0.0) as avg_review_time_hours,
                
                -- Calculated fields
                CASE 
                    WHEN mds.last_upload_date >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 'active'
                    WHEN mds.last_upload_date >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 'recent'
                    ELSE 'inactive'
                END as activity_status,
                
                CASE
                    WHEN mds.pending_review_count > 10 THEN 'high'
                    WHEN mds.pending_review_count > 3 THEN 'medium'
                    WHEN mds.pending_review_count > 0 THEN 'low'
                    ELSE 'none'
                END as pending_priority
                
            FROM models m
            LEFT JOIN model_dashboard_stats mds ON m.id = mds.model_id
            ${whereClause}
            ${orderClause}
            LIMIT ${limitValue} OFFSET ${offsetValue}
        `;

        // Count query for pagination
        const countQuery = `
            SELECT COUNT(*) as total
            FROM models m
            LEFT JOIN model_dashboard_stats mds ON m.id = mds.model_id
            ${whereClause}
        `;

        // Execute queries
        const [models] = await db.execute(modelsQuery, queryParams);
        const [countResult] = await db.execute(countQuery, queryParams);
        const total = countResult[0].total;

        // Calculate pagination metadata
        const totalPages = Math.ceil(total / limitValue);
        const hasNext = page < totalPages;
        const hasPrev = page > 1;

        res.set('Cache-Control', 'private, max-age=15');
        res.success({
            models: models,
            pagination: {
                current_page: parseInt(page),
                total_pages: totalPages,
                total_models: total,
                per_page: limitValue,
                has_next: hasNext,
                has_prev: hasPrev
            },
            filters_applied: { search: search || null, sort, filter }
        });

    } catch (error) {
        logger.error('model-dashboard.list error', { error: error.message });
        res.fail(500, 'Failed to load model dashboard', error.message);
    }
});

/**
 * Get detailed media breakdown for a specific model
 * GET /api/model-dashboard/models/:id/media?category=all&page=1&limit=50
 */
router.get('/models/:id/media', async (req, res) => {
    try {
        const modelId = parseInt(req.params.id);
        const {
            category = 'all', // all, pending, approved, approved_blurred, rejected
            page = 1,
            limit = 50
        } = req.query;

        if (!modelId) return res.fail(400, 'Invalid model ID');

        const limitValue = Math.max(1, Math.min(200, parseInt(limit)));
        const offsetValue = Math.max(0, (parseInt(page) - 1) * limitValue);

        // Build category filter
        let categoryFilter = '';
        let queryParams = [modelId];

        if (category !== 'all') {
            categoryFilter = 'AND review_status = ?';
            queryParams.push(category);
        }

        // Get model info first
        const [modelInfo] = await db.execute(`
            SELECT id, name, name as display_name, CONCAT('/public/uploads/profiles/', slug, '/profile.jpg') as profile_image_url, status
            FROM models WHERE id = ?
        `, [modelId]);

        if (modelInfo.length === 0) return res.fail(404, 'Model not found');

        // Get media items
        const mediaQuery = `
            SELECT 
                mrq.id,
                mrq.content_moderation_id,
                mrq.image_path,
                mrq.original_path,
                mrq.nudity_score,
                mrq.detected_parts,
                mrq.usage_intent,
                mrq.context_type,
                mrq.review_status,
                mrq.priority,
                mrq.flagged_at,
                mrq.reviewed_at,
                /* Not all schemas have explicit violation fields */
                NULL as violation_category,
                0.0 as violation_severity,
                
                -- Get thumbnail path (simplified for now)
                CONCAT('/api/media-preview/', mrq.id, '/thumbnail') as thumbnail_url,
                
                -- Moderation details
                cm.final_location,
                cm.moderation_status,
                cm.final_risk_score,
                cm.risk_level
                
            FROM media_review_queue mrq
            LEFT JOIN content_moderation cm ON mrq.content_moderation_id = cm.id
            WHERE mrq.model_id = ?
            ${categoryFilter}
            ORDER BY mrq.flagged_at DESC
            LIMIT ${limitValue} OFFSET ${offsetValue}
        `;

        // Count query
        const countQuery = `
            SELECT COUNT(*) as total
            FROM media_review_queue mrq
            WHERE mrq.model_id = ?
            ${categoryFilter}
        `;

        const [mediaItems] = await db.execute(mediaQuery, queryParams);
        const [countResult] = await db.execute(countQuery, queryParams);
        const total = countResult[0].total;

        // Get category breakdown
        const [categoryStats] = await db.execute(`
            SELECT 
                review_status,
                COUNT(*) as count
            FROM media_review_queue
            WHERE model_id = ?
            GROUP BY review_status
        `, [modelId]);

        // Process media items
        const processedItems = mediaItems.map(item => ({
            ...item,
            detected_parts: typeof item.detected_parts === 'string' 
                ? JSON.parse(item.detected_parts || '{}') 
                : item.detected_parts || {},
            nudity_score: parseFloat(item.nudity_score) || 0,
            violation_severity: parseFloat(item.violation_severity || 0) || 0.0,
            final_risk_score: parseFloat(item.final_risk_score) || null
        }));

        res.set('Cache-Control', 'private, max-age=15');
        res.success({
            model: modelInfo[0],
            media_items: processedItems,
            category_breakdown: categoryStats,
            pagination: {
                current_page: parseInt(page),
                total_pages: Math.ceil(total / limitValue),
                total_items: total,
                per_page: limitValue
            },
            current_category: category
        });

    } catch (error) {
        logger.error('model-dashboard.media error', { error: error.message });
        res.fail(500, 'Failed to load model media', error.message);
    }
});

/**
 * Get violation analytics across models
 * GET /api/model-dashboard/violations/analytics
 */
router.get('/violations/analytics', async (req, res) => {
    try {
        const {
            days = 30,
            top_models = 10
        } = req.query;

        const daysValue = Math.max(1, Math.min(90, parseInt(days)));
        const topModelsLimit = Math.max(1, Math.min(50, parseInt(top_models)));

        // Get violation summary by model (top violators)
        const [topViolators] = await db.execute(`
            SELECT 
                mvh.model_id,
                mvh.model_name,
                COUNT(*) as total_violations,
                AVG(mvh.severity_score) as avg_severity,
                MAX(mvh.violation_date) as last_violation,
                
                -- Breakdown by violation type
                SUM(CASE WHEN mvh.violation_type = 'nudity_high' THEN 1 ELSE 0 END) as nudity_violations,
                SUM(CASE WHEN mvh.violation_type = 'underage_detected' THEN 1 ELSE 0 END) as underage_violations,
                SUM(CASE WHEN mvh.violation_type = 'policy_violation' THEN 1 ELSE 0 END) as policy_violations,
                SUM(CASE WHEN mvh.violation_type = 'terms_violation' THEN 1 ELSE 0 END) as terms_violations,
                
                -- Model info  
                CONCAT('/public/uploads/profiles/', m.slug, '/profile.jpg') as profile_image_url,
                m.status as model_status
                
            FROM model_violation_history mvh
            LEFT JOIN models m ON mvh.model_id = m.id
            WHERE mvh.violation_date >= DATE_SUB(CURRENT_DATE, INTERVAL ? DAY)
            GROUP BY mvh.model_id, mvh.model_name
            ORDER BY total_violations DESC, avg_severity DESC
            LIMIT ?
        `, [daysValue, topModelsLimit]);

        // Get violation trends by day
        const [dailyTrends] = await db.execute(`
            SELECT 
                violation_date,
                violation_type,
                COUNT(*) as violation_count,
                AVG(severity_score) as avg_severity
            FROM model_violation_history
            WHERE violation_date >= DATE_SUB(CURRENT_DATE, INTERVAL ? DAY)
            GROUP BY violation_date, violation_type
            ORDER BY violation_date DESC, violation_type
        `, [daysValue]);

        // Get overall statistics
        const [overallStats] = await db.execute(`
            SELECT 
                COUNT(DISTINCT model_id) as models_with_violations,
                COUNT(*) as total_violations,
                AVG(severity_score) as avg_severity_score,
                MIN(violation_date) as earliest_violation,
                MAX(violation_date) as latest_violation
            FROM model_violation_history
            WHERE violation_date >= DATE_SUB(CURRENT_DATE, INTERVAL ? DAY)
        `, [daysValue]);

        res.set('Cache-Control', 'private, max-age=30');
        res.success({
            analytics: {
                period_days: daysValue,
                overall_stats: overallStats[0],
                top_violators: topViolators,
                daily_trends: dailyTrends
            },
            generated_at: new Date().toISOString()
        });

    } catch (error) {
        logger.error('model-dashboard.analytics error', { error: error.message });
        res.fail(500, 'Failed to load violation analytics', error.message);
    }
});

/**
 * Update model dashboard statistics cache
 * POST /api/model-dashboard/refresh-stats/:id?
 */
router.post('/refresh-stats/:id?', async (req, res) => {
    try {
        const modelId = req.params.id ? parseInt(req.params.id) : null;

        // This would normally be an admin-only endpoint
        // For now, allow refresh but log the action

        const refreshQuery = `
            INSERT INTO model_dashboard_stats (
                model_id, model_name,
                total_media_count, pending_review_count, approved_count, 
                approved_blurred_count, rejected_count,
                total_violations_30d, last_violation_date, last_upload_date
            )
            SELECT 
                m.id,
                m.name,
                COALESCE(media_counts.total_count, 0),
                COALESCE(media_counts.pending_count, 0),
                COALESCE(media_counts.approved_count, 0),
                COALESCE(media_counts.approved_blurred_count, 0),
                COALESCE(media_counts.rejected_count, 0),
                COALESCE(violation_stats.violation_count, 0),
                violation_stats.last_violation,
                media_counts.last_upload
            FROM models m
            LEFT JOIN (
                SELECT 
                    model_id,
                    COUNT(*) as total_count,
                    SUM(CASE WHEN review_status = 'pending' THEN 1 ELSE 0 END) as pending_count,
                    SUM(CASE WHEN review_status = 'approved' THEN 1 ELSE 0 END) as approved_count,
                    SUM(CASE WHEN review_status = 'approved_blurred' THEN 1 ELSE 0 END) as approved_blurred_count,
                    SUM(CASE WHEN review_status = 'rejected' THEN 1 ELSE 0 END) as rejected_count,
                    MAX(flagged_at) as last_upload
                FROM media_review_queue 
                ${modelId ? 'WHERE model_id = ?' : ''}
                GROUP BY model_id
            ) media_counts ON m.id = media_counts.model_id
            LEFT JOIN (
                SELECT 
                    model_id,
                    COUNT(*) as violation_count,
                    MAX(violation_date) as last_violation
                FROM model_violation_history 
                WHERE violation_date >= DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY)
                ${modelId ? 'AND model_id = ?' : ''}
                GROUP BY model_id
            ) violation_stats ON m.id = violation_stats.model_id
            ${modelId ? 'WHERE m.id = ?' : ''}
            ON DUPLICATE KEY UPDATE
                total_media_count = VALUES(total_media_count),
                pending_review_count = VALUES(pending_review_count),
                approved_count = VALUES(approved_count),
                approved_blurred_count = VALUES(approved_blurred_count),
                rejected_count = VALUES(rejected_count),
                total_violations_30d = VALUES(total_violations_30d),
                last_violation_date = VALUES(last_violation_date),
                last_upload_date = VALUES(last_upload_date)
        `;

        const queryParams = modelId ? [modelId, modelId, modelId] : [];
        await db.execute(refreshQuery, queryParams);

        const refreshedModels = modelId ? 1 : await db.execute('SELECT COUNT(*) as count FROM models');
        const modelCount = modelId ? 1 : refreshedModels[0][0].count;

        res.success({ refreshed_model_id: modelId, refreshed_at: new Date().toISOString() }, { message: `Statistics refreshed for ${modelCount} model(s)` });

    } catch (error) {
        logger.error('model-dashboard.refresh-stats error', { error: error.message });
        res.fail(500, 'Failed to refresh statistics', error.message);
    }
});

module.exports = router;