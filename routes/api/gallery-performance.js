/**
 * Gallery Performance API Routes
 * 
 * API endpoints for performance monitoring, analytics collection,
 * and performance optimization recommendations.
 */

const express = require('express');
const mysql = require('mysql2/promise');
const router = express.Router();

// Database connection helper
const getDbConnection = async () => {
    return await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_DATABASE || 'musenest',
        charset: 'utf8mb4'
    });
};

// Error handling middleware
const handleApiError = (error, res) => {
    console.error('Gallery Performance API Error:', error);
    res.status(500).json({
        error: 'Internal server error',
        message: error.message || 'An unexpected error occurred'
    });
};

// ===== Performance Analytics Collection =====

/**
 * POST /api/gallery-performance/analytics
 * Collect performance analytics data from frontend
 */
router.post('/analytics', async (req, res) => {
    let db;
    try {
        db = await getDbConnection();
        const analyticsData = req.body;
        
        // Validate required fields
        if (!analyticsData.timestamp || !analyticsData.sessionDuration) {
            return res.status(400).json({
                error: 'Missing required analytics data',
                required: ['timestamp', 'sessionDuration']
            });
        }

        // Store main session record
        const [sessionResult] = await db.execute(`
            INSERT INTO gallery_performance_sessions (
                session_id,
                timestamp,
                session_duration,
                url,
                user_agent,
                viewport_width,
                viewport_height,
                device_pixel_ratio,
                connection_type,
                connection_downlink,
                created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `, [
            generateSessionId(),
            new Date(analyticsData.timestamp),
            analyticsData.sessionDuration,
            analyticsData.browserInfo?.url || req.get('referer'),
            analyticsData.browserInfo?.userAgent || req.get('user-agent'),
            analyticsData.browserInfo?.viewport ? analyticsData.browserInfo.viewport.split('x')[0] : null,
            analyticsData.browserInfo?.viewport ? analyticsData.browserInfo.viewport.split('x')[1] : null,
            analyticsData.browserInfo?.devicePixelRatio || null,
            analyticsData.browserInfo?.connection?.effectiveType || null,
            analyticsData.browserInfo?.connection?.downlink || null
        ]);

        const sessionId = sessionResult.insertId;

        // Store Core Web Vitals
        if (analyticsData.coreWebVitals) {
            const cwv = analyticsData.coreWebVitals;
            await db.execute(`
                INSERT INTO gallery_core_web_vitals (
                    session_id,
                    lcp_value,
                    lcp_rating,
                    fid_value,
                    fid_rating,
                    cls_value,
                    cls_rating,
                    created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
            `, [
                sessionId,
                cwv.lcp,
                cwv.lcpRating,
                cwv.fid,
                cwv.fidRating,
                cwv.cls,
                cwv.clsRating
            ]);
        }

        // Store Image Metrics
        if (analyticsData.imageMetrics) {
            const img = analyticsData.imageMetrics;
            await db.execute(`
                INSERT INTO gallery_image_metrics (
                    session_id,
                    total_images,
                    loaded_images,
                    failed_images,
                    average_load_time,
                    largest_image_size,
                    total_data_transfer,
                    success_rate,
                    average_image_size,
                    created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            `, [
                sessionId,
                img.totalImages,
                img.loadedImages,
                img.failedImages,
                img.averageLoadTime,
                img.largestImageSize,
                img.totalDataTransfer,
                img.successRate,
                img.averageImageSize
            ]);
        }

        // Store User Interaction
        if (analyticsData.userInteraction) {
            const ui = analyticsData.userInteraction;
            await db.execute(`
                INSERT INTO gallery_user_interactions (
                    session_id,
                    gallery_views,
                    image_clicks,
                    lightbox_opens,
                    scroll_depth,
                    created_at
                ) VALUES (?, ?, ?, ?, ?, NOW())
            `, [
                sessionId,
                ui.galleryViews,
                ui.imageClicks,
                ui.lightboxOpens,
                ui.scrollDepth
            ]);
        }

        // Store Cache Metrics
        if (analyticsData.cacheMetrics) {
            const cache = analyticsData.cacheMetrics;
            await db.execute(`
                INSERT INTO gallery_cache_metrics (
                    session_id,
                    cache_hits,
                    cache_misses,
                    prefetch_hits,
                    hit_rate,
                    created_at
                ) VALUES (?, ?, ?, ?, ?, NOW())
            `, [
                sessionId,
                cache.cacheHits,
                cache.cacheMisses,
                cache.prefetchHits,
                cache.hitRate
            ]);
        }

        // Store detailed performance timeline
        if (analyticsData.detailedTimeline && Array.isArray(analyticsData.detailedTimeline)) {
            for (const metric of analyticsData.detailedTimeline) {
                await db.execute(`
                    INSERT INTO gallery_performance_timeline (
                        session_id,
                        category,
                        metric_data,
                        metric_timestamp,
                        created_at
                    ) VALUES (?, ?, ?, ?, NOW())
                `, [
                    sessionId,
                    metric.category,
                    JSON.stringify(metric.data),
                    new Date(metric.timestamp)
                ]);
            }
        }

        // Store recommendations
        if (analyticsData.recommendations && Array.isArray(analyticsData.recommendations)) {
            for (const rec of analyticsData.recommendations) {
                await db.execute(`
                    INSERT INTO gallery_performance_recommendations (
                        session_id,
                        category,
                        severity,
                        message,
                        metric_value,
                        created_at
                    ) VALUES (?, ?, ?, ?, ?, NOW())
                `, [
                    sessionId,
                    rec.category,
                    rec.severity,
                    rec.message,
                    rec.value
                ]);
            }
        }

        res.json({
            success: true,
            message: 'Analytics data stored successfully',
            session_id: sessionId
        });

    } catch (error) {
        handleApiError(error, res);
    } finally {
        if (db) await db.end();
    }
});

// ===== Performance Reports and Analytics =====

/**
 * GET /api/gallery-performance/reports/summary
 * Get performance summary report
 */
router.get('/reports/summary', async (req, res) => {
    let db;
    try {
        db = await getDbConnection();
        const { days = 7, model_id } = req.query;
        
        const dateFilter = `created_at >= DATE_SUB(NOW(), INTERVAL ${parseInt(days)} DAY)`;
        let modelFilter = '';
        let queryParams = [];
        
        if (model_id) {
            // Extract model from URL if sessions table had model tracking
            modelFilter = ' AND url LIKE ?';
            queryParams.push(`%/${model_id}%`);
        }

        // Get session statistics
        const [sessionStats] = await db.execute(`
            SELECT 
                COUNT(*) as total_sessions,
                AVG(session_duration) as avg_session_duration,
                MIN(session_duration) as min_session_duration,
                MAX(session_duration) as max_session_duration
            FROM gallery_performance_sessions 
            WHERE ${dateFilter}${modelFilter}
        `, queryParams);

        // Get Core Web Vitals averages
        const [cwvStats] = await db.execute(`
            SELECT 
                AVG(cwv.lcp_value) as avg_lcp,
                AVG(cwv.fid_value) as avg_fid,
                AVG(cwv.cls_value) as avg_cls,
                SUM(CASE WHEN cwv.lcp_rating = 'good' THEN 1 ELSE 0 END) / COUNT(*) * 100 as lcp_good_percentage,
                SUM(CASE WHEN cwv.fid_rating = 'good' THEN 1 ELSE 0 END) / COUNT(*) * 100 as fid_good_percentage,
                SUM(CASE WHEN cwv.cls_rating = 'good' THEN 1 ELSE 0 END) / COUNT(*) * 100 as cls_good_percentage
            FROM gallery_core_web_vitals cwv
            JOIN gallery_performance_sessions s ON cwv.session_id = s.id
            WHERE s.${dateFilter}${modelFilter}
        `, queryParams);

        // Get image performance stats
        const [imageStats] = await db.execute(`
            SELECT 
                AVG(img.success_rate) as avg_success_rate,
                AVG(img.average_load_time) as avg_load_time,
                AVG(img.average_image_size) as avg_image_size,
                SUM(img.total_images) as total_images_loaded,
                SUM(img.failed_images) as total_failed_images
            FROM gallery_image_metrics img
            JOIN gallery_performance_sessions s ON img.session_id = s.id
            WHERE s.${dateFilter}${modelFilter}
        `, queryParams);

        // Get user interaction stats
        const [interactionStats] = await db.execute(`
            SELECT 
                AVG(ui.gallery_views) as avg_gallery_views,
                AVG(ui.image_clicks) as avg_image_clicks,
                AVG(ui.lightbox_opens) as avg_lightbox_opens,
                AVG(ui.scroll_depth) as avg_scroll_depth
            FROM gallery_user_interactions ui
            JOIN gallery_performance_sessions s ON ui.session_id = s.id
            WHERE s.${dateFilter}${modelFilter}
        `, queryParams);

        // Get cache performance stats
        const [cacheStats] = await db.execute(`
            SELECT 
                AVG(cm.hit_rate) as avg_hit_rate,
                SUM(cm.cache_hits) as total_cache_hits,
                SUM(cm.cache_misses) as total_cache_misses,
                SUM(cm.prefetch_hits) as total_prefetch_hits
            FROM gallery_cache_metrics cm
            JOIN gallery_performance_sessions s ON cm.session_id = s.id
            WHERE s.${dateFilter}${modelFilter}
        `, queryParams);

        // Get top performance issues
        const [topIssues] = await db.execute(`
            SELECT 
                category,
                severity,
                COUNT(*) as issue_count,
                AVG(metric_value) as avg_metric_value
            FROM gallery_performance_recommendations gpr
            JOIN gallery_performance_sessions s ON gpr.session_id = s.id
            WHERE s.${dateFilter}${modelFilter}
            GROUP BY category, severity
            ORDER BY issue_count DESC
            LIMIT 10
        `, queryParams);

        res.json({
            period: `${days} days`,
            model_id: model_id || 'all',
            summary: {
                sessions: sessionStats[0],
                coreWebVitals: cwvStats[0],
                images: imageStats[0],
                userInteraction: interactionStats[0],
                cache: cacheStats[0]
            },
            topIssues: topIssues
        });

    } catch (error) {
        handleApiError(error, res);
    } finally {
        if (db) await db.end();
    }
});

/**
 * GET /api/gallery-performance/reports/trends
 * Get performance trends over time
 */
router.get('/reports/trends', async (req, res) => {
    let db;
    try {
        db = await getDbConnection();
        const { days = 30, metric = 'lcp' } = req.query;
        
        let query, valueColumn;
        
        switch (metric.toLowerCase()) {
            case 'lcp':
                query = `
                    SELECT 
                        DATE(s.created_at) as date,
                        AVG(cwv.lcp_value) as value,
                        COUNT(*) as sample_count
                    FROM gallery_core_web_vitals cwv
                    JOIN gallery_performance_sessions s ON cwv.session_id = s.id
                    WHERE s.created_at >= DATE_SUB(NOW(), INTERVAL ${parseInt(days)} DAY)
                    GROUP BY DATE(s.created_at)
                    ORDER BY date ASC
                `;
                break;
                
            case 'fid':
                query = `
                    SELECT 
                        DATE(s.created_at) as date,
                        AVG(cwv.fid_value) as value,
                        COUNT(*) as sample_count
                    FROM gallery_core_web_vitals cwv
                    JOIN gallery_performance_sessions s ON cwv.session_id = s.id
                    WHERE s.created_at >= DATE_SUB(NOW(), INTERVAL ${parseInt(days)} DAY)
                    GROUP BY DATE(s.created_at)
                    ORDER BY date ASC
                `;
                break;
                
            case 'cls':
                query = `
                    SELECT 
                        DATE(s.created_at) as date,
                        AVG(cwv.cls_value) as value,
                        COUNT(*) as sample_count
                    FROM gallery_core_web_vitals cwv
                    JOIN gallery_performance_sessions s ON cwv.session_id = s.id
                    WHERE s.created_at >= DATE_SUB(NOW(), INTERVAL ${parseInt(days)} DAY)
                    GROUP BY DATE(s.created_at)
                    ORDER BY date ASC
                `;
                break;
                
            case 'image_load_time':
                query = `
                    SELECT 
                        DATE(s.created_at) as date,
                        AVG(img.average_load_time) as value,
                        COUNT(*) as sample_count
                    FROM gallery_image_metrics img
                    JOIN gallery_performance_sessions s ON img.session_id = s.id
                    WHERE s.created_at >= DATE_SUB(NOW(), INTERVAL ${parseInt(days)} DAY)
                    GROUP BY DATE(s.created_at)
                    ORDER BY date ASC
                `;
                break;
                
            default:
                return res.status(400).json({
                    error: 'Invalid metric',
                    available: ['lcp', 'fid', 'cls', 'image_load_time']
                });
        }

        const [trends] = await db.execute(query);

        res.json({
            metric: metric,
            period: `${days} days`,
            data: trends.map(row => ({
                date: row.date,
                value: parseFloat(row.value) || 0,
                sampleCount: row.sample_count
            }))
        });

    } catch (error) {
        handleApiError(error, res);
    } finally {
        if (db) await db.end();
    }
});

/**
 * GET /api/gallery-performance/reports/models
 * Get performance comparison across models
 */
router.get('/reports/models', async (req, res) => {
    let db;
    try {
        db = await getDbConnection();
        const { days = 7 } = req.query;

        // This would need model detection from URL or additional tracking
        // For now, provide a structure that could be implemented
        const [modelPerformance] = await db.execute(`
            SELECT 
                'Overall' as model_name,
                AVG(cwv.lcp_value) as avg_lcp,
                AVG(cwv.fid_value) as avg_fid,
                AVG(cwv.cls_value) as avg_cls,
                AVG(img.success_rate) as avg_image_success,
                AVG(img.average_load_time) as avg_image_load_time,
                AVG(ui.image_clicks) as avg_image_clicks,
                COUNT(DISTINCT s.id) as session_count
            FROM gallery_performance_sessions s
            LEFT JOIN gallery_core_web_vitals cwv ON s.id = cwv.session_id
            LEFT JOIN gallery_image_metrics img ON s.id = img.session_id  
            LEFT JOIN gallery_user_interactions ui ON s.id = ui.session_id
            WHERE s.created_at >= DATE_SUB(NOW(), INTERVAL ${parseInt(days)} DAY)
        `);

        res.json({
            period: `${days} days`,
            models: modelPerformance.map(model => ({
                name: model.model_name,
                metrics: {
                    lcp: parseFloat(model.avg_lcp) || null,
                    fid: parseFloat(model.avg_fid) || null,
                    cls: parseFloat(model.avg_cls) || null,
                    imageSuccess: parseFloat(model.avg_image_success) || null,
                    imageLoadTime: parseFloat(model.avg_image_load_time) || null,
                    engagement: parseFloat(model.avg_image_clicks) || null
                },
                sessionCount: model.session_count
            }))
        });

    } catch (error) {
        handleApiError(error, res);
    } finally {
        if (db) await db.end();
    }
});

// ===== Performance Optimization Endpoints =====

/**
 * POST /api/gallery-performance/recommendations
 * Generate performance recommendations based on data
 */
router.post('/recommendations', async (req, res) => {
    let db;
    try {
        db = await getDbConnection();
        const { model_id, days = 7 } = req.body;

        let modelFilter = '';
        let queryParams = [parseInt(days)];
        
        if (model_id) {
            modelFilter = ' AND url LIKE ?';
            queryParams.push(`%/${model_id}%`);
        }

        // Analyze recent performance data
        const [performanceIssues] = await db.execute(`
            SELECT 
                AVG(cwv.lcp_value) as avg_lcp,
                AVG(cwv.fid_value) as avg_fid,
                AVG(cwv.cls_value) as avg_cls,
                AVG(img.average_load_time) as avg_image_load_time,
                AVG(img.success_rate) as avg_success_rate,
                AVG(cm.hit_rate) as avg_cache_hit_rate
            FROM gallery_performance_sessions s
            LEFT JOIN gallery_core_web_vitals cwv ON s.id = cwv.session_id
            LEFT JOIN gallery_image_metrics img ON s.id = img.session_id
            LEFT JOIN gallery_cache_metrics cm ON s.id = cm.session_id
            WHERE s.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)${modelFilter}
        `, queryParams);

        const data = performanceIssues[0];
        const recommendations = [];

        // Generate recommendations based on thresholds
        if (data.avg_lcp > 2500) {
            recommendations.push({
                category: 'LCP',
                severity: data.avg_lcp > 4000 ? 'high' : 'medium',
                issue: 'Slow Largest Contentful Paint',
                description: 'Your gallery\'s largest content element takes too long to render.',
                currentValue: Math.round(data.avg_lcp),
                targetValue: '< 2500ms',
                suggestions: [
                    'Optimize and compress hero images',
                    'Implement image lazy loading',
                    'Use next-generation image formats (WebP, AVIF)',
                    'Minimize render-blocking CSS and JavaScript'
                ],
                priority: data.avg_lcp > 4000 ? 1 : 2,
                estimatedImpact: 'High'
            });
        }

        if (data.avg_fid > 100) {
            recommendations.push({
                category: 'FID',
                severity: data.avg_fid > 300 ? 'high' : 'medium',
                issue: 'Slow First Input Delay',
                description: 'Users experience delays when first interacting with your gallery.',
                currentValue: Math.round(data.avg_fid),
                targetValue: '< 100ms',
                suggestions: [
                    'Reduce JavaScript execution time',
                    'Remove unused JavaScript',
                    'Defer non-critical JavaScript',
                    'Use web workers for heavy computations'
                ],
                priority: data.avg_fid > 300 ? 1 : 3,
                estimatedImpact: 'Medium'
            });
        }

        if (data.avg_cls > 0.1) {
            recommendations.push({
                category: 'CLS',
                severity: data.avg_cls > 0.25 ? 'high' : 'medium',
                issue: 'High Cumulative Layout Shift',
                description: 'Gallery elements move unexpectedly during loading.',
                currentValue: data.avg_cls.toFixed(3),
                targetValue: '< 0.1',
                suggestions: [
                    'Add explicit dimensions to all images',
                    'Reserve space for dynamic content',
                    'Use CSS aspect-ratio property',
                    'Avoid inserting content above existing content'
                ],
                priority: data.avg_cls > 0.25 ? 1 : 2,
                estimatedImpact: 'High'
            });
        }

        if (data.avg_image_load_time > 1000) {
            recommendations.push({
                category: 'Images',
                severity: 'medium',
                issue: 'Slow Image Loading',
                description: 'Gallery images take too long to load.',
                currentValue: `${Math.round(data.avg_image_load_time)}ms`,
                targetValue: '< 1000ms',
                suggestions: [
                    'Implement progressive image loading',
                    'Use responsive images with srcset',
                    'Optimize image compression',
                    'Enable image caching headers'
                ],
                priority: 3,
                estimatedImpact: 'Medium'
            });
        }

        if (data.avg_cache_hit_rate < 70) {
            recommendations.push({
                category: 'Caching',
                severity: 'medium',
                issue: 'Low Cache Hit Rate',
                description: 'Gallery resources are not being cached effectively.',
                currentValue: `${Math.round(data.avg_cache_hit_rate)}%`,
                targetValue: '> 80%',
                suggestions: [
                    'Implement proper cache headers',
                    'Use service worker for caching',
                    'Enable browser caching for images',
                    'Implement prefetching for critical resources'
                ],
                priority: 4,
                estimatedImpact: 'Medium'
            });
        }

        // Sort by priority
        recommendations.sort((a, b) => a.priority - b.priority);

        res.json({
            modelId: model_id || 'all',
            period: `${days} days`,
            analysisDate: new Date().toISOString(),
            recommendations: recommendations,
            summary: {
                totalIssues: recommendations.length,
                highPriority: recommendations.filter(r => r.severity === 'high').length,
                mediumPriority: recommendations.filter(r => r.severity === 'medium').length,
                estimatedImprovementPotential: recommendations.length > 0 ? 'High' : 'Low'
            }
        });

    } catch (error) {
        handleApiError(error, res);
    } finally {
        if (db) await db.end();
    }
});

// ===== Utility Functions =====

/**
 * Generate a unique session ID
 */
function generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);
}

module.exports = router;