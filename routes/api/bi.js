/**
 * Business Intelligence API Routes
 * Part of Phase E.2: Business intelligence dashboards and reporting
 * Provides API endpoints for BI dashboards, reports, and data visualization
 */

const express = require('express');
const router = express.Router();
const BusinessIntelligenceService = require('../../src/services/BusinessIntelligenceService');
const AdvancedAnalyticsService = require('../../src/services/AdvancedAnalyticsService');

// Initialize BI service
let biService = null;
let analyticsService = null;

// Middleware to initialize BI service
router.use((req, res, next) => {
    if (!biService) {
        // Initialize analytics service first if not already done
        if (!analyticsService) {
            analyticsService = new AdvancedAnalyticsService(req.db, {
                collection: {
                    realTimeInterval: 30000,
                    aggregationInterval: 300000
                }
            });
        }

        const config = {
            dashboards: {
                refreshInterval: parseInt(process.env.BI_DASHBOARD_REFRESH) || 300000,
                cacheTimeout: parseInt(process.env.BI_CACHE_TIMEOUT) || 600000,
                maxWidgets: parseInt(process.env.BI_MAX_WIDGETS) || 20,
                enableRealTime: process.env.BI_REALTIME_ENABLED !== 'false'
            },
            reports: {
                scheduledEnabled: process.env.BI_SCHEDULED_REPORTS !== 'false',
                retentionDays: parseInt(process.env.BI_REPORT_RETENTION) || 90,
                maxReportSize: parseInt(process.env.BI_MAX_REPORT_SIZE) || 50 * 1024 * 1024,
                formats: (process.env.BI_REPORT_FORMATS || 'json,csv,pdf').split(',')
            },
            storage: {
                biDir: process.env.BI_STORAGE_DIR || '/tmp/musenest-bi'
            }
        };

        biService = new BusinessIntelligenceService(req.db, analyticsService, config);
        console.log('📊 BusinessIntelligenceService initialized for API routes');
    }
    next();
});

/**
 * GET /api/bi/status
 * Get BI service status
 */
router.get('/status', (req, res) => {
    try {
        if (!biService) {
            return res.status(500).json({
                success: false,
                error: 'BI service not initialized'
            });
        }

        const status = biService.getBIStatus();
        
        res.json({
            success: true,
            status: {
                dashboards: {
                    total: status.dashboards.total,
                    realTime: status.dashboards.realTime,
                    categories: status.dashboards.categories,
                    realTimePercentage: status.dashboards.total > 0 ? 
                        Math.round((status.dashboards.realTime / status.dashboards.total) * 100) : 0
                },
                widgets: {
                    total: status.widgets.total,
                    byType: status.widgets.byType,
                    avgPerDashboard: status.dashboards.total > 0 ? 
                        Math.round(status.widgets.total / status.dashboards.total * 100) / 100 : 0
                },
                reports: {
                    total: status.reports.total,
                    scheduled: status.reports.scheduled,
                    categories: status.reports.categories,
                    scheduledPercentage: status.reports.total > 0 ? 
                        Math.round((status.reports.scheduled / status.reports.total) * 100) : 0
                },
                configuration: {
                    refreshInterval: status.configuration.dashboards.refreshInterval,
                    refreshIntervalMinutes: Math.round(status.configuration.dashboards.refreshInterval / 60000),
                    realTimeEnabled: status.configuration.dashboards.enableRealTime,
                    maxWidgets: status.configuration.dashboards.maxWidgets,
                    supportedFormats: status.configuration.reports.formats
                }
            },
            timestamp: Date.now()
        });

    } catch (error) {
        console.error('❌ Error getting BI status:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get BI status'
        });
    }
});

/**
 * GET /api/bi/dashboards
 * Get list of dashboards
 */
router.get('/dashboards', (req, res) => {
    try {
        if (!biService) {
            return res.status(500).json({
                success: false,
                error: 'BI service not initialized'
            });
        }

        const { category } = req.query;
        const dashboards = biService.getDashboards(category);
        
        res.json({
            success: true,
            dashboards: dashboards.map(dashboard => ({
                id: dashboard.id,
                name: dashboard.name,
                description: dashboard.description,
                category: dashboard.category,
                widgetCount: dashboard.widgetCount,
                isRealTime: dashboard.isRealTime,
                lastRefresh: dashboard.lastRefresh ? 
                    new Date(dashboard.lastRefresh).toISOString() : null,
                viewCount: dashboard.viewCount,
                status: dashboard.lastRefresh && 
                         Date.now() - dashboard.lastRefresh < 600000 ? 'active' : 'stale'
            })),
            metadata: {
                total: dashboards.length,
                category: category || 'all',
                categories: [...new Set(dashboards.map(d => d.category))],
                realTimeCount: dashboards.filter(d => d.isRealTime).length
            }
        });

    } catch (error) {
        console.error('❌ Error getting dashboards:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get dashboards'
        });
    }
});

/**
 * GET /api/bi/dashboards/:dashboardId
 * Get specific dashboard with widget data
 */
router.get('/dashboards/:dashboardId', async (req, res) => {
    try {
        if (!biService) {
            return res.status(500).json({
                success: false,
                error: 'BI service not initialized'
            });
        }

        const { dashboardId } = req.params;
        const { refresh = false } = req.query;
        
        // Refresh dashboard if requested
        if (refresh === 'true') {
            await biService.refreshDashboard(dashboardId);
        }
        
        const dashboard = biService.getDashboard(dashboardId);
        
        if (!dashboard) {
            return res.status(404).json({
                success: false,
                error: 'Dashboard not found'
            });
        }

        res.json({
            success: true,
            dashboard: {
                id: dashboard.id,
                name: dashboard.name,
                description: dashboard.description,
                category: dashboard.category,
                layout: dashboard.layout,
                isRealTime: dashboard.isRealTime,
                refreshInterval: dashboard.refreshInterval,
                lastRefresh: dashboard.lastRefresh ? 
                    new Date(dashboard.lastRefresh).toISOString() : null,
                viewCount: dashboard.viewCount,
                filters: dashboard.filters,
                widgets: dashboard.widgets.map(widget => ({
                    id: widget.id,
                    name: widget.name,
                    type: widget.type,
                    chartType: widget.chartType,
                    dimensions: widget.dimensions,
                    position: widget.position,
                    lastRefresh: widget.lastRefresh ? 
                        new Date(widget.lastRefresh).toISOString() : null,
                    visualization: {
                        type: widget.visualization.type,
                        title: widget.visualization.title,
                        dataPoints: widget.visualization.metadata?.dataPoints || 0,
                        data: widget.visualization.data
                    },
                    status: widget.data ? 'loaded' : 'loading'
                }))
            }
        });

    } catch (error) {
        console.error('❌ Error getting dashboard:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get dashboard'
        });
    }
});

/**
 * POST /api/bi/dashboards
 * Create a new dashboard
 */
router.post('/dashboards', async (req, res) => {
    try {
        if (!biService) {
            return res.status(500).json({
                success: false,
                error: 'BI service not initialized'
            });
        }

        const dashboardConfig = req.body;
        
        // Validate required fields
        if (!dashboardConfig.name) {
            return res.status(400).json({
                success: false,
                error: 'Dashboard name is required'
            });
        }

        console.log(`📊 Creating dashboard: ${dashboardConfig.name}`);
        
        const dashboard = await biService.createDashboard(dashboardConfig);
        
        res.status(201).json({
            success: true,
            message: 'Dashboard created successfully',
            dashboard: {
                id: dashboard.id,
                name: dashboard.name,
                description: dashboard.description,
                category: dashboard.category,
                widgetCount: dashboard.widgets.length,
                isRealTime: dashboard.isRealTime,
                created: new Date(dashboard.created).toISOString()
            }
        });

    } catch (error) {
        console.error('❌ Error creating dashboard:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to create dashboard'
        });
    }
});

/**
 * PUT /api/bi/dashboards/:dashboardId/refresh
 * Manually refresh a dashboard
 */
router.put('/dashboards/:dashboardId/refresh', async (req, res) => {
    try {
        if (!biService) {
            return res.status(500).json({
                success: false,
                error: 'BI service not initialized'
            });
        }

        const { dashboardId } = req.params;
        
        console.log(`🔄 Refreshing dashboard: ${dashboardId}`);
        
        const dashboard = await biService.refreshDashboard(dashboardId);
        
        res.json({
            success: true,
            message: 'Dashboard refreshed successfully',
            dashboard: {
                id: dashboard.id,
                name: dashboard.name,
                lastRefresh: new Date(dashboard.lastRefresh).toISOString(),
                widgetCount: dashboard.widgets.length
            }
        });

    } catch (error) {
        console.error('❌ Error refreshing dashboard:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to refresh dashboard'
        });
    }
});

/**
 * GET /api/bi/reports
 * Get list of reports
 */
router.get('/reports', (req, res) => {
    try {
        if (!biService) {
            return res.status(500).json({
                success: false,
                error: 'BI service not initialized'
            });
        }

        const { category, type } = req.query;
        let reports = biService.getReports(category);
        
        // Filter by type if specified
        if (type) {
            reports = reports.filter(r => r.type === type);
        }
        
        res.json({
            success: true,
            reports: reports.map(report => ({
                id: report.id,
                name: report.name,
                description: report.description,
                category: report.category,
                type: report.type,
                format: report.format,
                lastGenerated: report.lastGenerated ? 
                    new Date(report.lastGenerated).toISOString() : null,
                generationCount: report.generationCount,
                status: report.status,
                isScheduled: !!report.schedule
            })),
            metadata: {
                total: reports.length,
                category: category || 'all',
                type: type || 'all',
                categories: [...new Set(reports.map(r => r.category))],
                types: [...new Set(reports.map(r => r.type))],
                scheduledCount: reports.filter(r => r.isScheduled).length
            }
        });

    } catch (error) {
        console.error('❌ Error getting reports:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get reports'
        });
    }
});

/**
 * POST /api/bi/reports
 * Create a new report
 */
router.post('/reports', async (req, res) => {
    try {
        if (!biService) {
            return res.status(500).json({
                success: false,
                error: 'BI service not initialized'
            });
        }

        const reportConfig = req.body;
        
        // Validate required fields
        if (!reportConfig.name) {
            return res.status(400).json({
                success: false,
                error: 'Report name is required'
            });
        }

        console.log(`📊 Creating report: ${reportConfig.name}`);
        
        const report = await biService.createReport(reportConfig);
        
        res.status(201).json({
            success: true,
            message: 'Report created successfully',
            report: {
                id: report.id,
                name: report.name,
                description: report.description,
                category: report.category,
                type: report.type,
                format: report.format,
                created: new Date(report.created).toISOString(),
                isScheduled: !!report.schedule
            }
        });

    } catch (error) {
        console.error('❌ Error creating report:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to create report'
        });
    }
});

/**
 * POST /api/bi/reports/:reportId/generate
 * Generate a report
 */
router.post('/reports/:reportId/generate', async (req, res) => {
    try {
        if (!biService) {
            return res.status(500).json({
                success: false,
                error: 'BI service not initialized'
            });
        }

        const { reportId } = req.params;
        const options = req.body || {};
        
        console.log(`📊 Generating report: ${reportId}`);
        
        const generatedReport = await biService.generateReport(reportId, options);
        
        res.json({
            success: true,
            message: 'Report generated successfully',
            report: {
                id: generatedReport.id,
                reportId: generatedReport.reportId,
                name: generatedReport.name,
                format: generatedReport.format,
                generated: new Date(generatedReport.generated).toISOString(),
                duration: generatedReport.duration,
                dataPoints: generatedReport.dataPoints,
                size: generatedReport.data ? 
                    (typeof generatedReport.data === 'string' ? 
                        generatedReport.data.length : 
                        JSON.stringify(generatedReport.data).length) : 0,
                visualizations: Object.keys(generatedReport.visualizations || {}),
                downloadUrl: `/api/bi/reports/${generatedReport.id}/download`
            }
        });

    } catch (error) {
        console.error('❌ Error generating report:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to generate report'
        });
    }
});

/**
 * GET /api/bi/visualizations/types
 * Get supported visualization types
 */
router.get('/visualizations/types', (req, res) => {
    try {
        const visualizationTypes = [
            {
                type: 'line',
                name: 'Line Chart',
                description: 'Display data points connected by lines, ideal for showing trends over time',
                dataTypes: ['time-series', 'continuous'],
                options: ['xAxis', 'yAxis', 'colorScheme', 'interpolation']
            },
            {
                type: 'bar',
                name: 'Bar Chart',
                description: 'Display data using rectangular bars, perfect for comparing categories',
                dataTypes: ['categorical', 'discrete'],
                options: ['orientation', 'colorScheme', 'stacked']
            },
            {
                type: 'pie',
                name: 'Pie Chart',
                description: 'Show proportional data as slices of a circle',
                dataTypes: ['proportional', 'categorical'],
                options: ['colorScheme', 'showLabels', 'innerRadius']
            },
            {
                type: 'area',
                name: 'Area Chart',
                description: 'Line chart with filled area below, emphasizes magnitude',
                dataTypes: ['time-series', 'continuous'],
                options: ['xAxis', 'yAxis', 'colorScheme', 'stacked']
            },
            {
                type: 'scatter',
                name: 'Scatter Plot',
                description: 'Show relationships between two variables using dots',
                dataTypes: ['correlation', 'continuous'],
                options: ['xAxis', 'yAxis', 'colorScheme', 'size']
            },
            {
                type: 'heatmap',
                name: 'Heatmap',
                description: 'Display data density or relationships using color intensity',
                dataTypes: ['matrix', 'correlation'],
                options: ['colorScheme', 'interpolation', 'scale']
            },
            {
                type: 'gauge',
                name: 'Gauge Chart',
                description: 'Show a single value within a defined range, like a speedometer',
                dataTypes: ['single-value', 'kpi'],
                options: ['min', 'max', 'thresholds', 'colorScheme']
            }
        ];

        const colorSchemes = [
            {
                name: 'default',
                colors: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd'],
                description: 'Default color palette'
            },
            {
                name: 'business',
                colors: ['#2E8B57', '#4682B4', '#DAA520', '#CD853F', '#8B4513'],
                description: 'Professional business colors'
            },
            {
                name: 'performance',
                colors: ['#00ff00', '#ffff00', '#ff8000', '#ff0000'],
                description: 'Performance indicators (green to red)'
            },
            {
                name: 'security',
                colors: ['#800080', '#ff1493', '#ff4500', '#ff0000'],
                description: 'Security threat levels'
            }
        ];

        res.json({
            success: true,
            visualizations: {
                types: visualizationTypes,
                colorSchemes: colorSchemes,
                dataTypes: [
                    'time-series', 'categorical', 'continuous', 'discrete', 
                    'proportional', 'correlation', 'matrix', 'single-value', 'kpi'
                ],
                commonOptions: [
                    'title', 'xAxis', 'yAxis', 'colorScheme', 'width', 'height',
                    'showLegend', 'showLabels', 'animation', 'responsive'
                ]
            }
        });

    } catch (error) {
        console.error('❌ Error getting visualization types:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get visualization types'
        });
    }
});

/**
 * GET /api/bi/data/sources
 * Get available data sources
 */
router.get('/data/sources', (req, res) => {
    try {
        const dataSources = [
            {
                id: 'analytics',
                name: 'Analytics Data',
                description: 'Real-time and historical analytics metrics',
                tables: ['current_metrics', 'aggregated_data', 'anomalies', 'trends'],
                fields: {
                    system: ['memory_usage', 'cpu_usage', 'uptime', 'event_loop_delay'],
                    business: ['total_models', 'active_clients', 'monthly_revenue', 'conversion_rate'],
                    performance: ['response_time', 'throughput', 'error_rate', 'availability'],
                    security: ['blocked_requests', 'threats', 'compliance_score']
                },
                refreshRate: '30 seconds'
            },
            {
                id: 'database',
                name: 'Database Tables',
                description: 'Direct database queries and custom SQL',
                tables: ['models', 'clients', 'subscriptions', 'gallery_images', 'user_sessions'],
                fields: {
                    models: ['id', 'name', 'status', 'created_at', 'updated_at'],
                    clients: ['id', 'username', 'email', 'status', 'subscription_tier'],
                    subscriptions: ['id', 'tier_id', 'status', 'price', 'created_at']
                },
                refreshRate: 'on-demand'
            },
            {
                id: 'business',
                name: 'Business Metrics',
                description: 'Simulated business intelligence data',
                tables: ['revenue_trends', 'growth_metrics', 'customer_analytics'],
                fields: {
                    revenue: ['daily_revenue', 'monthly_revenue', 'growth_rate'],
                    customers: ['new_customers', 'active_customers', 'churn_rate'],
                    satisfaction: ['nps_score', 'csat_score', 'retention_rate']
                },
                refreshRate: '5 minutes'
            },
            {
                id: 'performance',
                name: 'Performance Metrics',
                description: 'System and application performance data',
                tables: ['system_metrics', 'api_performance', 'resource_usage'],
                fields: {
                    system: ['cpu_usage', 'memory_usage', 'disk_usage', 'network_io'],
                    api: ['response_time', 'requests_per_second', 'error_rate'],
                    resources: ['database_connections', 'cache_hit_rate', 'queue_size']
                },
                refreshRate: '1 minute'
            },
            {
                id: 'security',
                name: 'Security Data',
                description: 'Security events and compliance metrics',
                tables: ['security_events', 'threat_intelligence', 'compliance_data'],
                fields: {
                    events: ['blocked_requests', 'failed_logins', 'suspicious_activity'],
                    threats: ['malware_detected', 'ip_reputation', 'attack_patterns'],
                    compliance: ['audit_score', 'policy_violations', 'risk_level']
                },
                refreshRate: '30 seconds'
            }
        ];

        const queryExamples = {
            analytics: {
                current_metrics: 'Get current system performance',
                time_series: 'Retrieve metrics over time range',
                anomalies: 'Find performance anomalies',
                trends: 'Analyze growth trends'
            },
            database: {
                sql_query: 'SELECT COUNT(*) FROM models WHERE status = "active"',
                aggregation: 'GROUP BY subscription_tier',
                joins: 'JOIN clients ON models.client_id = clients.id'
            },
            business: {
                revenue_analysis: 'Revenue trends and forecasting',
                customer_segments: 'Customer behavior analysis',
                growth_metrics: 'Business growth indicators'
            }
        };

        res.json({
            success: true,
            dataSources,
            queryExamples,
            totalSources: dataSources.length,
            capabilities: {
                realTime: ['analytics', 'security'],
                historical: ['analytics', 'business', 'performance'],
                customQueries: ['database'],
                scheduling: ['all']
            }
        });

    } catch (error) {
        console.error('❌ Error getting data sources:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get data sources'
        });
    }
});

/**
 * POST /api/bi/data/query
 * Execute a data query
 */
router.post('/data/query', async (req, res) => {
    try {
        if (!biService) {
            return res.status(500).json({
                success: false,
                error: 'BI service not initialized'
            });
        }

        const { dataSource, query } = req.body;
        
        if (!dataSource || !query) {
            return res.status(400).json({
                success: false,
                error: 'dataSource and query are required'
            });
        }

        console.log(`📊 Executing data query: ${dataSource}`);
        
        const data = await biService.collectReportData({ dataSource, query });
        
        // Apply filters if provided
        const filteredData = query.filters ? 
            biService.applyFilters(data, query.filters) : data;
        
        res.json({
            success: true,
            data: filteredData,
            metadata: {
                dataSource,
                query,
                dataPoints: Array.isArray(filteredData) ? 
                    filteredData.length : 
                    (filteredData.timeSeries ? filteredData.timeSeries.length : 0),
                executedAt: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('❌ Error executing data query:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to execute data query'
        });
    }
});

/**
 * GET /api/bi/templates
 * Get dashboard and report templates
 */
router.get('/templates', (req, res) => {
    try {
        const { type = 'all' } = req.query;
        
        const dashboardTemplates = [
            {
                id: 'executive-template',
                name: 'Executive Dashboard',
                type: 'dashboard',
                category: 'business',
                description: 'High-level KPIs and business metrics for executives',
                widgets: [
                    { name: 'Revenue Overview', type: 'chart', chartType: 'line' },
                    { name: 'Customer Growth', type: 'chart', chartType: 'area' },
                    { name: 'Key Metrics', type: 'metrics' },
                    { name: 'Performance Score', type: 'chart', chartType: 'gauge' }
                ]
            },
            {
                id: 'operations-template',
                name: 'Operations Dashboard',
                type: 'dashboard',
                category: 'operations',
                description: 'System performance and operational metrics',
                widgets: [
                    { name: 'System Performance', type: 'chart', chartType: 'line' },
                    { name: 'Resource Usage', type: 'chart', chartType: 'gauge' },
                    { name: 'Error Rates', type: 'chart', chartType: 'bar' },
                    { name: 'Service Status', type: 'status' }
                ]
            },
            {
                id: 'security-template',
                name: 'Security Dashboard',
                type: 'dashboard',
                category: 'security',
                description: 'Security monitoring and threat intelligence',
                widgets: [
                    { name: 'Threat Activity', type: 'chart', chartType: 'area' },
                    { name: 'Security Score', type: 'chart', chartType: 'gauge' },
                    { name: 'Blocked Requests', type: 'chart', chartType: 'bar' },
                    { name: 'Compliance Status', type: 'status' }
                ]
            }
        ];

        const reportTemplates = [
            {
                id: 'business-report-template',
                name: 'Business Performance Report',
                type: 'report',
                category: 'business',
                description: 'Comprehensive business metrics and analysis',
                sections: ['Revenue Analysis', 'Customer Metrics', 'Growth Indicators', 'Recommendations'],
                formats: ['pdf', 'json', 'csv']
            },
            {
                id: 'technical-report-template',
                name: 'Technical Performance Report',
                type: 'report',
                category: 'technical',
                description: 'System performance and technical metrics',
                sections: ['System Health', 'Performance Metrics', 'Error Analysis', 'Optimization Recommendations'],
                formats: ['pdf', 'json']
            },
            {
                id: 'security-report-template',
                name: 'Security Assessment Report',
                type: 'report',
                category: 'security',
                description: 'Security posture and threat analysis',
                sections: ['Threat Summary', 'Security Events', 'Compliance Status', 'Action Items'],
                formats: ['pdf', 'json']
            }
        ];

        let templates = [];
        if (type === 'all' || type === 'dashboard') {
            templates.push(...dashboardTemplates);
        }
        if (type === 'all' || type === 'report') {
            templates.push(...reportTemplates);
        }

        res.json({
            success: true,
            templates,
            metadata: {
                total: templates.length,
                type,
                categories: [...new Set(templates.map(t => t.category))],
                dashboardTemplates: dashboardTemplates.length,
                reportTemplates: reportTemplates.length
            }
        });

    } catch (error) {
        console.error('❌ Error getting templates:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get templates'
        });
    }
});

/**
 * GET /api/bi/configuration
 * Get BI service configuration
 */
router.get('/configuration', (req, res) => {
    try {
        if (!biService) {
            return res.status(500).json({
                success: false,
                error: 'BI service not initialized'
            });
        }

        const status = biService.getBIStatus();
        
        res.json({
            success: true,
            configuration: {
                dashboards: {
                    refreshInterval: status.configuration.dashboards.refreshInterval,
                    refreshIntervalMinutes: Math.round(status.configuration.dashboards.refreshInterval / 60000),
                    cacheTimeout: status.configuration.dashboards.cacheTimeout,
                    cacheTimeoutMinutes: Math.round(status.configuration.dashboards.cacheTimeout / 60000),
                    maxWidgets: status.configuration.dashboards.maxWidgets,
                    realTimeEnabled: status.configuration.dashboards.enableRealTime
                },
                reports: {
                    scheduledEnabled: status.configuration.reports.scheduledEnabled,
                    retentionDays: status.configuration.reports.retentionDays,
                    maxReportSize: status.configuration.reports.maxReportSize,
                    maxReportSizeMB: Math.round(status.configuration.reports.maxReportSize / (1024 * 1024)),
                    supportedFormats: status.configuration.reports.formats
                },
                visualization: {
                    supportedChartTypes: status.configuration.visualization.chartTypes,
                    colorSchemes: status.configuration.visualization.colorSchemes,
                    maxDataPoints: status.configuration.visualization.maxDataPoints
                },
                storage: {
                    biDirectory: status.configuration.storage.biDir,
                    reportsDirectory: status.configuration.storage.reportsDir,
                    dashboardsDirectory: status.configuration.storage.dashboardsDir,
                    cacheDirectory: status.configuration.storage.cacheDir
                }
            }
        });

    } catch (error) {
        console.error('❌ Error getting BI configuration:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get BI configuration'
        });
    }
});

/**
 * PUT /api/bi/configuration
 * Update BI service configuration
 */
router.put('/configuration', (req, res) => {
    try {
        if (!biService) {
            return res.status(500).json({
                success: false,
                error: 'BI service not initialized'
            });
        }

        const newConfig = req.body;
        
        // Validate configuration structure
        const validSections = ['dashboards', 'reports', 'visualization', 'storage'];
        const providedSections = Object.keys(newConfig);
        const invalidSections = providedSections.filter(section => !validSections.includes(section));
        
        if (invalidSections.length > 0) {
            return res.status(400).json({
                success: false,
                error: `Invalid configuration sections: ${invalidSections.join(', ')}`
            });
        }

        biService.updateConfiguration(newConfig);
        
        console.log('📊 BI configuration updated via API:', providedSections);

        res.json({
            success: true,
            message: 'BI configuration updated',
            updated: providedSections,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error updating BI configuration:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to update BI configuration'
        });
    }
});

module.exports = router;