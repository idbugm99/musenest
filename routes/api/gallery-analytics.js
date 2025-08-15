/**
 * Gallery Analytics API Routes
 * 
 * API endpoints for analytics data collection, reporting,
 * and insights generation for gallery usage patterns.
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
    console.error('Gallery Analytics API Error:', error);
    res.status(500).json({
        error: 'Internal server error',
        message: error.message || 'An unexpected error occurred'
    });
};

// ===== Analytics Data Collection =====

/**
 * POST /api/gallery-analytics/events
 * Collect analytics events from frontend
 */
router.post('/events', async (req, res) => {
    let db;
    try {
        db = await getDbConnection();
        const { sessionId, userId, events, sessionInfo } = req.body;
        
        if (!sessionId || !events || !Array.isArray(events)) {
            return res.status(400).json({
                error: 'Invalid request data',
                required: ['sessionId', 'events']
            });
        }

        // Store or update session info
        await db.execute(`
            INSERT INTO gallery_analytics_sessions (
                session_id,
                user_id,
                user_agent,
                viewport_width,
                viewport_height,
                referrer,
                utm_source,
                utm_medium,
                utm_campaign,
                device_type,
                browser,
                os,
                created_at,
                updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
            ON DUPLICATE KEY UPDATE
                updated_at = NOW(),
                event_count = event_count + ${events.length}
        `, [
            sessionId,
            userId,
            sessionInfo?.userAgent || req.get('user-agent'),
            sessionInfo?.viewport?.width || null,
            sessionInfo?.viewport?.height || null,
            sessionInfo?.referrer || req.get('referer'),
            sessionInfo?.utm?.source || null,
            sessionInfo?.utm?.medium || null,
            sessionInfo?.utm?.campaign || null,
            sessionInfo?.device?.type || 'desktop',
            sessionInfo?.device?.browser || 'unknown',
            sessionInfo?.device?.os || 'unknown'
        ]);

        // Store events
        for (const event of events) {
            await db.execute(`
                INSERT INTO gallery_analytics_events (
                    session_id,
                    user_id,
                    event_type,
                    event_data,
                    url,
                    timestamp,
                    created_at
                ) VALUES (?, ?, ?, ?, ?, ?, NOW())
            `, [
                sessionId,
                userId,
                event.type,
                JSON.stringify(event.data || {}),
                event.url || req.get('referer'),
                new Date(event.timestamp)
            ]);
        }

        res.json({
            success: true,
            message: `Stored ${events.length} analytics events`,
            sessionId
        });

    } catch (error) {
        handleApiError(error, res);
    } finally {
        if (db) await db.end();
    }
});

// ===== Analytics Reports =====

/**
 * GET /api/gallery-analytics/metrics/overview
 * Get overview metrics for dashboard
 */
router.get('/metrics/overview', async (req, res) => {
    let db;
    try {
        db = await getDbConnection();
        const { period = '30' } = req.query;
        const days = parseInt(period);

        // Calculate date ranges
        const currentStart = new Date();
        currentStart.setDate(currentStart.getDate() - days);
        const previousStart = new Date();
        previousStart.setDate(previousStart.getDate() - (days * 2));
        const previousEnd = new Date();
        previousEnd.setDate(previousEnd.getDate() - days);

        // Get current period metrics
        const [currentMetrics] = await db.execute(`
            SELECT 
                COUNT(DISTINCT user_id) as total_visitors,
                COUNT(DISTINCT CASE WHEN event_type = 'gallery_view' THEN event_data->>'$.galleryId' END) as total_gallery_views,
                COUNT(CASE WHEN event_type IN ('image_click', 'image_view', 'lightbox_interaction') THEN 1 END) as total_interactions,
                AVG(CASE WHEN event_type = 'session_end' THEN JSON_EXTRACT(event_data, '$.sessionDuration') END) / 1000 as avg_session_duration
            FROM gallery_analytics_events 
            WHERE created_at >= ?
        `, [currentStart]);

        // Get previous period metrics for comparison
        const [previousMetrics] = await db.execute(`
            SELECT 
                COUNT(DISTINCT user_id) as total_visitors,
                COUNT(DISTINCT CASE WHEN event_type = 'gallery_view' THEN event_data->>'$.galleryId' END) as total_gallery_views,
                COUNT(CASE WHEN event_type IN ('image_click', 'image_view', 'lightbox_interaction') THEN 1 END) as total_interactions,
                AVG(CASE WHEN event_type = 'session_end' THEN JSON_EXTRACT(event_data, '$.sessionDuration') END) / 1000 as avg_session_duration
            FROM gallery_analytics_events 
            WHERE created_at >= ? AND created_at < ?
        `, [previousStart, previousEnd]);

        const current = currentMetrics[0];
        const previous = previousMetrics[0];

        // Calculate percentage changes
        const calculateChange = (current, previous) => {
            if (!previous || previous === 0) return { value: 0, direction: 'neutral' };
            const change = ((current - previous) / previous) * 100;
            return {
                value: change,
                direction: change > 0 ? 'up' : change < 0 ? 'down' : 'neutral'
            };
        };

        res.json({
            totalVisitors: current.total_visitors || 0,
            totalGalleryViews: current.total_gallery_views || 0,
            totalInteractions: current.total_interactions || 0,
            avgSessionDuration: current.avg_session_duration || 0,
            visitorsChange: calculateChange(current.total_visitors, previous.total_visitors),
            viewsChange: calculateChange(current.total_gallery_views, previous.total_gallery_views),
            interactionsChange: calculateChange(current.total_interactions, previous.total_interactions),
            sessionChange: calculateChange(current.avg_session_duration, previous.avg_session_duration)
        });

    } catch (error) {
        handleApiError(error, res);
    } finally {
        if (db) await db.end();
    }
});

/**
 * GET /api/gallery-analytics/traffic
 * Get traffic and engagement data
 */
router.get('/traffic', async (req, res) => {
    let db;
    try {
        db = await getDbConnection();
        const { period = '30' } = req.query;
        const days = parseInt(period);

        // Get daily traffic data
        const [dailyTraffic] = await db.execute(`
            SELECT 
                DATE(created_at) as date,
                COUNT(DISTINCT user_id) as visitors,
                COUNT(DISTINCT CASE WHEN event_type = 'gallery_view' THEN event_data->>'$.galleryId' END) as views,
                AVG(CASE WHEN event_type = 'session_end' THEN JSON_EXTRACT(event_data, '$.sessionDuration') END) / 1000 as avg_session_duration
            FROM gallery_analytics_events 
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        `, [days]);

        // Get traffic statistics
        const [trafficStats] = await db.execute(`
            SELECT 
                COUNT(DISTINCT s.user_id) as total_unique_visitors,
                COUNT(DISTINCT CASE 
                    WHEN (SELECT COUNT(*) FROM gallery_analytics_sessions s2 WHERE s2.user_id = s.user_id AND s2.created_at < s.created_at) = 0 
                    THEN s.user_id 
                END) as new_visitors,
                COUNT(DISTINCT CASE 
                    WHEN (SELECT COUNT(*) FROM gallery_analytics_sessions s2 WHERE s2.user_id = s.user_id AND s2.created_at < s.created_at) > 0 
                    THEN s.user_id 
                END) as returning_visitors,
                AVG(CASE 
                    WHEN (SELECT COUNT(*) FROM gallery_analytics_events e WHERE e.session_id = s.session_id AND e.event_type != 'session_start') = 0 
                    THEN 1 ELSE 0 
                END) * 100 as bounce_rate,
                AVG((SELECT COUNT(DISTINCT e.url) FROM gallery_analytics_events e WHERE e.session_id = s.session_id)) as pages_per_session,
                AVG((SELECT AVG(JSON_EXTRACT(e.event_data, '$.engagementTime')) FROM gallery_analytics_events e WHERE e.session_id = s.session_id AND e.event_type = 'engagement_time')) / 1000 as avg_time_on_page
            FROM gallery_analytics_sessions s
            WHERE s.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        `, [days]);

        const stats = trafficStats[0];
        const totalVisitors = stats.total_unique_visitors || 0;

        res.json({
            daily: dailyTraffic.map(day => ({
                date: day.date,
                visitors: day.visitors || 0,
                views: day.views || 0,
                avgSessionDuration: day.avg_session_duration || 0
            })),
            stats: {
                newVisitors: stats.new_visitors || 0,
                newVisitorPercent: totalVisitors > 0 ? Math.round((stats.new_visitors / totalVisitors) * 100) : 0,
                returningVisitors: stats.returning_visitors || 0,
                returningVisitorPercent: totalVisitors > 0 ? Math.round((stats.returning_visitors / totalVisitors) * 100) : 0,
                bounceRate: Math.round(stats.bounce_rate || 0),
                pagesPerSession: stats.pages_per_session || 0,
                avgTimeOnPage: stats.avg_time_on_page || 0,
                interactionRate: 75 // Placeholder - would need more complex calculation
            }
        });

    } catch (error) {
        handleApiError(error, res);
    } finally {
        if (db) await db.end();
    }
});

/**
 * GET /api/gallery-analytics/galleries/performance
 * Get gallery performance data
 */
router.get('/galleries/performance', async (req, res) => {
    let db;
    try {
        db = await getDbConnection();
        const { period = '30' } = req.query;
        const days = parseInt(period);

        // Get gallery performance metrics
        const [galleryPerformance] = await db.execute(`
            SELECT 
                JSON_UNQUOTE(event_data->>'$.galleryId') as gallery_id,
                JSON_UNQUOTE(event_data->>'$.galleryType') as gallery_type,
                COUNT(DISTINCT CASE WHEN event_type = 'gallery_view' THEN session_id END) as views,
                COUNT(CASE WHEN event_type IN ('image_click', 'image_view') THEN 1 END) as interactions,
                AVG(CASE WHEN event_type = 'engagement_time' AND event_data->>'$.elementType' = 'gallery' 
                    THEN JSON_EXTRACT(event_data, '$.engagementTime') END) / 1000 as avg_engagement_time,
                COUNT(DISTINCT CASE WHEN event_type = 'image_view' THEN event_data->>'$.imageId' END) as unique_images_viewed
            FROM gallery_analytics_events 
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
                AND event_data->>'$.galleryId' IS NOT NULL
            GROUP BY JSON_UNQUOTE(event_data->>'$.galleryId'), JSON_UNQUOTE(event_data->>'$.galleryType')
            ORDER BY views DESC
            LIMIT 20
        `, [days]);

        const galleries = galleryPerformance.map(gallery => {
            const engagementRate = gallery.interactions > 0 && gallery.views > 0 ? 
                Math.round((gallery.interactions / gallery.views) * 100) : 0;

            return {
                id: gallery.gallery_id,
                name: `Gallery ${gallery.gallery_id}`,
                type: gallery.gallery_type || 'standard',
                views: gallery.views || 0,
                interactions: gallery.interactions || 0,
                engagementRate,
                avgViewTime: Math.round(gallery.avg_engagement_time || 0),
                imageCount: gallery.unique_images_viewed || 0
            };
        });

        res.json(galleries);

    } catch (error) {
        handleApiError(error, res);
    } finally {
        if (db) await db.end();
    }
});

/**
 * GET /api/gallery-analytics/behavior
 * Get user behavior patterns
 */
router.get('/behavior', async (req, res) => {
    let db;
    try {
        db = await getDbConnection();
        const { period = '30' } = req.query;
        const days = parseInt(period);

        // Get behavior statistics
        const [behaviorStats] = await db.execute(`
            SELECT 
                COUNT(DISTINCT session_id) as total_sessions,
                COUNT(DISTINCT CASE WHEN event_type = 'search_query' THEN session_id END) as sessions_with_search,
                COUNT(CASE WHEN event_type = 'search_query' THEN 1 END) as total_searches,
                COUNT(DISTINCT CASE WHEN event_type = 'filter_usage' THEN session_id END) as sessions_with_filters,
                COUNT(DISTINCT CASE WHEN event_type = 'lightbox_interaction' THEN session_id END) as sessions_with_lightbox,
                COUNT(CASE WHEN event_type = 'lightbox_interaction' THEN 1 END) as total_lightbox_opens,
                COUNT(DISTINCT CASE WHEN JSON_EXTRACT(event_data, '$.device.type') = 'mobile' THEN session_id END) as mobile_sessions
            FROM gallery_analytics_events e
            JOIN gallery_analytics_sessions s ON e.session_id = s.session_id
            WHERE e.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        `, [days]);

        // Get most used filter
        const [topFilter] = await db.execute(`
            SELECT 
                JSON_UNQUOTE(event_data->>'$.filterName') as filter_name,
                COUNT(*) as usage_count
            FROM gallery_analytics_events 
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
                AND event_type = 'filter_usage'
            GROUP BY JSON_UNQUOTE(event_data->>'$.filterName')
            ORDER BY usage_count DESC
            LIMIT 1
        `, [days]);

        // Get mobile session duration
        const [mobileStats] = await db.execute(`
            SELECT 
                AVG(JSON_EXTRACT(event_data, '$.sessionDuration')) / 1000 as avg_mobile_session_time
            FROM gallery_analytics_events e
            JOIN gallery_analytics_sessions s ON e.session_id = s.session_id
            WHERE e.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
                AND e.event_type = 'session_end'
                AND s.device_type = 'mobile'
        `, [days]);

        const stats = behaviorStats[0];
        const totalSessions = stats.total_sessions || 1; // Avoid division by zero

        res.json({
            searchUsagePercent: Math.round((stats.sessions_with_search / totalSessions) * 100),
            avgQueriesPerSession: stats.sessions_with_search > 0 ? 
                (stats.total_searches / stats.sessions_with_search).toFixed(1) : 0,
            filterUsagePercent: Math.round((stats.sessions_with_filters / totalSessions) * 100),
            mostUsedFilter: topFilter[0]?.filter_name || 'None',
            lightboxUsagePercent: Math.round((stats.sessions_with_lightbox / totalSessions) * 100),
            avgLightboxPerSession: stats.sessions_with_lightbox > 0 ? 
                (stats.total_lightbox_opens / stats.sessions_with_lightbox).toFixed(1) : 0,
            mobileTrafficPercent: Math.round((stats.mobile_sessions / totalSessions) * 100),
            avgMobileSessionTime: mobileStats[0]?.avg_mobile_session_time || 0
        });

    } catch (error) {
        handleApiError(error, res);
    } finally {
        if (db) await db.end();
    }
});

/**
 * GET /api/gallery-analytics/search
 * Get search analytics data
 */
router.get('/search', async (req, res) => {
    let db;
    try {
        db = await getDbConnection();
        const { period = '30' } = req.query;
        const days = parseInt(period);

        // Get search statistics
        const [searchStats] = await db.execute(`
            SELECT 
                COUNT(*) as total_searches,
                COUNT(DISTINCT JSON_UNQUOTE(event_data->>'$.query')) as unique_queries,
                AVG(CASE WHEN JSON_EXTRACT(event_data, '$.resultsFound') = 0 THEN 1 ELSE 0 END) * 100 as zero_results_rate
            FROM gallery_analytics_events 
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
                AND event_type = 'search_query'
        `, [days]);

        // Get top search queries
        const [topQueries] = await db.execute(`
            SELECT 
                JSON_UNQUOTE(event_data->>'$.query') as query,
                COUNT(*) as count
            FROM gallery_analytics_events 
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
                AND event_type = 'search_query'
                AND JSON_UNQUOTE(event_data->>'$.query') != ''
            GROUP BY JSON_UNQUOTE(event_data->>'$.query')
            ORDER BY count DESC
            LIMIT 10
        `, [days]);

        // Get filter usage data
        const [filterUsage] = await db.execute(`
            SELECT 
                JSON_UNQUOTE(event_data->>'$.filterName') as filter_name,
                COUNT(*) as usage_count
            FROM gallery_analytics_events 
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
                AND event_type = 'filter_usage'
            GROUP BY JSON_UNQUOTE(event_data->>'$.filterName')
            ORDER BY usage_count DESC
        `, [days]);

        const stats = searchStats[0];

        res.json({
            totalSearches: stats.total_searches || 0,
            avgResultsFound: 8.5, // Placeholder - would need actual results tracking
            zeroResultsRate: Math.round(stats.zero_results_rate || 0),
            searchExitRate: 15, // Placeholder - would need session flow analysis
            topQueries: topQueries.map(q => ({
                query: q.query,
                count: q.count
            })),
            filterUsage: Object.fromEntries(
                filterUsage.map(f => [f.filter_name, f.usage_count])
            )
        });

    } catch (error) {
        handleApiError(error, res);
    } finally {
        if (db) await db.end();
    }
});

/**
 * GET /api/gallery-analytics/insights
 * Get generated insights and recommendations
 */
router.get('/insights', async (req, res) => {
    let db;
    try {
        db = await getDbConnection();
        const { period = '30' } = req.query;

        // This would typically involve more complex analysis
        // For now, we'll provide sample insights based on common patterns

        const insights = {
            insights: [
                {
                    id: 'high_bounce_rate',
                    title: 'High Bounce Rate Detected',
                    description: 'Gallery pages have a higher than average bounce rate, suggesting content may not meet visitor expectations.',
                    priority: 'high',
                    impact: 'Reducing bounce rate could increase engagement by 25%',
                    icon: 'exclamation-triangle',
                    actionable: true
                },
                {
                    id: 'mobile_performance',
                    title: 'Mobile Performance Opportunity',
                    description: 'Mobile users have shorter session times, indicating potential performance or usability issues.',
                    priority: 'medium',
                    impact: 'Mobile optimization could increase session time by 40%',
                    icon: 'mobile-alt',
                    actionable: true
                },
                {
                    id: 'search_usage_low',
                    title: 'Low Search Feature Usage',
                    description: 'Search functionality is underutilized, possibly due to poor discoverability or poor results.',
                    priority: 'medium',
                    impact: 'Improving search could increase user engagement',
                    icon: 'search',
                    actionable: false
                }
            ],
            recommendations: [
                {
                    id: 'optimize_image_loading',
                    title: 'Optimize Image Loading',
                    description: 'Implement lazy loading and image compression to improve load times.',
                    priority: 'high'
                },
                {
                    id: 'improve_search_ui',
                    title: 'Enhance Search Interface',
                    description: 'Make search more prominent and add auto-suggestions.',
                    priority: 'medium'
                },
                {
                    id: 'add_related_galleries',
                    title: 'Add Related Gallery Suggestions',
                    description: 'Show related galleries to reduce bounce rate and increase engagement.',
                    priority: 'medium'
                }
            ]
        };

        res.json(insights);

    } catch (error) {
        handleApiError(error, res);
    } finally {
        if (db) await db.end();
    }
});

/**
 * POST /api/gallery-analytics/insights/generate
 * Generate new insights based on current data
 */
router.post('/insights/generate', async (req, res) => {
    let db;
    try {
        // This would implement ML-based insight generation
        // For now, return updated insights
        
        const newInsights = {
            insights: [
                {
                    id: 'trending_content',
                    title: 'Trending Content Identified',
                    description: 'Certain image categories are showing increased engagement patterns.',
                    priority: 'low',
                    impact: 'Content optimization could boost engagement by 15%',
                    icon: 'chart-line',
                    actionable: true
                }
            ],
            recommendations: [
                {
                    id: 'feature_trending_content',
                    title: 'Feature Trending Content',
                    description: 'Promote high-engagement content to homepage.',
                    priority: 'medium'
                }
            ],
            generated_at: new Date().toISOString()
        };

        res.json(newInsights);

    } catch (error) {
        handleApiError(error, res);
    } finally {
        if (db) await db.end();
    }
});

// ===== Export Functionality =====

/**
 * GET /api/gallery-analytics/reports/export
 * Export analytics report
 */
router.get('/reports/export', async (req, res) => {
    try {
        const { period = '30', format = 'json' } = req.query;
        
        // This would generate a comprehensive report
        // For now, return a JSON structure that could be used for PDF generation
        
        const reportData = {
            report_period: `${period} days`,
            generated_at: new Date().toISOString(),
            summary: {
                total_visitors: 1250,
                total_gallery_views: 3400,
                total_interactions: 8750,
                avg_session_duration: 180
            },
            insights: [
                'Mobile traffic represents 45% of total visitors',
                'Gallery engagement rate increased 12% compared to previous period',
                'Search functionality usage remains low at 8% of sessions'
            ]
        };

        if (format === 'json') {
            res.json(reportData);
        } else {
            // For PDF export, you'd use a library like puppeteer or jsPDF
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="analytics-report-${Date.now()}.pdf"`);
            res.send('PDF generation would be implemented here');
        }

    } catch (error) {
        handleApiError(error, res);
    }
});

module.exports = router;