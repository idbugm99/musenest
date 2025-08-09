/**
 * Business Intelligence Service
 * Part of Phase E.2: Business intelligence dashboards and reporting
 * Provides comprehensive BI capabilities including dashboards, reports, and data visualization
 */

const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');

class BusinessIntelligenceService extends EventEmitter {
    constructor(dbConnection = null, analyticsService = null, config = {}) {
        super();
        
        this.db = dbConnection;
        this.analyticsService = analyticsService;
        
        this.config = {
            // Dashboard configuration
            dashboards: {
                refreshInterval: config.dashboards?.refreshInterval || 300000, // 5 minutes
                cacheTimeout: config.dashboards?.cacheTimeout || 600000, // 10 minutes
                maxWidgets: config.dashboards?.maxWidgets || 20,
                enableRealTime: config.dashboards?.enableRealTime !== false
            },
            
            // Report configuration
            reports: {
                scheduledEnabled: config.reports?.scheduledEnabled !== false,
                retentionDays: config.reports?.retentionDays || 90,
                maxReportSize: config.reports?.maxReportSize || 50 * 1024 * 1024, // 50MB
                formats: config.reports?.formats || ['json', 'csv', 'pdf']
            },
            
            // Data visualization
            visualization: {
                chartTypes: config.visualization?.chartTypes || [
                    'line', 'bar', 'pie', 'area', 'scatter', 'heatmap', 'gauge'
                ],
                colorSchemes: config.visualization?.colorSchemes || [
                    'default', 'business', 'performance', 'security'
                ],
                maxDataPoints: config.visualization?.maxDataPoints || 1000
            },
            
            // Storage configuration
            storage: {
                biDir: config.storage?.biDir || path.join(__dirname, '../../bi'),
                reportsDir: config.storage?.reportsDir || path.join(__dirname, '../../bi/reports'),
                dashboardsDir: config.storage?.dashboardsDir || path.join(__dirname, '../../bi/dashboards'),
                cacheDir: config.storage?.cacheDir || path.join(__dirname, '../../bi/cache')
            }
        };

        // BI data stores
        this.dashboards = new Map();
        this.reports = new Map();
        this.widgets = new Map();
        this.visualizations = new Map();
        this.dashboardCache = new Map();
        this.scheduledReports = new Map();
        
        // BI counters
        this.biCounter = 0;
        
        // Dashboard refresh intervals
        this.dashboardIntervals = new Map();
        
        console.log('📊 BusinessIntelligenceService initialized');
        this.initialize();
    }

    /**
     * Initialize BI service
     */
    async initialize() {
        try {
            // Ensure BI directories exist
            const dirs = [
                this.config.storage.biDir,
                this.config.storage.reportsDir,
                this.config.storage.dashboardsDir,
                this.config.storage.cacheDir
            ];
            
            for (const dir of dirs) {
                await fs.mkdir(dir, { recursive: true });
            }

            // Load existing dashboards and reports
            await this.loadExistingData();
            
            // Create default dashboards
            await this.createDefaultDashboards();
            
            // Start dashboard refresh intervals
            this.startDashboardRefresh();

            this.emit('biServiceInitialized');
            console.log('📊 BI service initialized');

        } catch (error) {
            console.error('❌ Failed to initialize BI service:', error.message);
            this.emit('biServiceError', error);
        }
    }

    /**
     * Create a new dashboard
     * @param {Object} dashboardConfig - Dashboard configuration
     * @returns {Object} Created dashboard
     */
    async createDashboard(dashboardConfig) {
        const dashboardId = `dashboard_${++this.biCounter}_${Date.now()}`;
        const dashboard = {
            id: dashboardId,
            name: dashboardConfig.name || `Dashboard ${this.biCounter}`,
            description: dashboardConfig.description || '',
            category: dashboardConfig.category || 'general',
            layout: dashboardConfig.layout || 'grid',
            widgets: [],
            filters: dashboardConfig.filters || {},
            refreshInterval: dashboardConfig.refreshInterval || this.config.dashboards.refreshInterval,
            isRealTime: dashboardConfig.isRealTime || false,
            permissions: dashboardConfig.permissions || ['admin'],
            created: Date.now(),
            lastUpdated: Date.now(),
            lastRefresh: null,
            viewCount: 0
        };

        // Add widgets if provided
        if (dashboardConfig.widgets) {
            for (const widgetConfig of dashboardConfig.widgets) {
                const widget = await this.createWidget(widgetConfig);
                dashboard.widgets.push(widget.id);
            }
        }

        this.dashboards.set(dashboardId, dashboard);
        
        // Save dashboard
        await this.saveDashboard(dashboard);
        
        // Start real-time updates if enabled
        if (dashboard.isRealTime) {
            this.startRealTimeDashboard(dashboardId);
        }

        this.emit('dashboardCreated', dashboard);
        console.log(`📊 Dashboard created: ${dashboard.name} (${dashboardId})`);
        
        return dashboard;
    }

    /**
     * Create a new widget
     * @param {Object} widgetConfig - Widget configuration
     * @returns {Object} Created widget
     */
    async createWidget(widgetConfig) {
        const widgetId = `widget_${++this.biCounter}_${Date.now()}`;
        const widget = {
            id: widgetId,
            name: widgetConfig.name || `Widget ${this.biCounter}`,
            type: widgetConfig.type || 'chart',
            chartType: widgetConfig.chartType || 'line',
            dataSource: widgetConfig.dataSource || 'analytics',
            query: widgetConfig.query || {},
            visualization: widgetConfig.visualization || {},
            dimensions: widgetConfig.dimensions || { width: 6, height: 4 },
            position: widgetConfig.position || { x: 0, y: 0 },
            refreshInterval: widgetConfig.refreshInterval || this.config.dashboards.refreshInterval,
            filters: widgetConfig.filters || {},
            colorScheme: widgetConfig.colorScheme || 'default',
            options: widgetConfig.options || {},
            created: Date.now(),
            lastUpdated: Date.now(),
            lastRefresh: null,
            data: null
        };

        this.widgets.set(widgetId, widget);
        
        // Generate initial data
        await this.refreshWidget(widgetId);

        this.emit('widgetCreated', widget);
        
        return widget;
    }

    /**
     * Create a report
     * @param {Object} reportConfig - Report configuration
     * @returns {Object} Created report
     */
    async createReport(reportConfig) {
        const reportId = `report_${++this.biCounter}_${Date.now()}`;
        const report = {
            id: reportId,
            name: reportConfig.name || `Report ${this.biCounter}`,
            description: reportConfig.description || '',
            category: reportConfig.category || 'general',
            type: reportConfig.type || 'standard',
            format: reportConfig.format || 'json',
            dataSource: reportConfig.dataSource || 'analytics',
            query: reportConfig.query || {},
            visualization: reportConfig.visualization || {},
            filters: reportConfig.filters || {},
            schedule: reportConfig.schedule || null, // cron format
            recipients: reportConfig.recipients || [],
            template: reportConfig.template || null,
            created: Date.now(),
            lastGenerated: null,
            generationCount: 0,
            status: 'active'
        };

        this.reports.set(reportId, report);
        
        // Save report configuration
        await this.saveReport(report);
        
        // Schedule report if needed
        if (report.schedule) {
            await this.scheduleReport(reportId);
        }

        this.emit('reportCreated', report);
        console.log(`📊 Report created: ${report.name} (${reportId})`);
        
        return report;
    }

    /**
     * Generate report data
     * @param {string} reportId - Report ID
     * @param {Object} options - Generation options
     * @returns {Object} Generated report
     */
    async generateReport(reportId, options = {}) {
        const report = this.reports.get(reportId);
        if (!report) {
            throw new Error(`Report not found: ${reportId}`);
        }

        const startTime = Date.now();
        console.log(`📊 Generating report: ${report.name}`);

        try {
            // Collect data based on report configuration
            const reportData = await this.collectReportData(report);
            
            // Apply filters
            const filteredData = this.applyFilters(reportData, report.filters);
            
            // Generate visualizations if needed
            const visualizations = report.visualization ? 
                await this.generateVisualizations(filteredData, report.visualization) : {};
            
            // Format data based on report format
            const formattedData = await this.formatReportData(filteredData, report.format);
            
            const generatedReport = {
                id: `generated_${reportId}_${Date.now()}`,
                reportId,
                name: report.name,
                generated: Date.now(),
                duration: Date.now() - startTime,
                format: report.format,
                dataPoints: Array.isArray(filteredData) ? filteredData.length : Object.keys(filteredData).length,
                data: formattedData,
                visualizations,
                metadata: {
                    generatedBy: options.userId || 'system',
                    filters: report.filters,
                    query: report.query,
                    dataSource: report.dataSource
                }
            };

            // Save generated report
            await this.saveGeneratedReport(generatedReport);
            
            // Update report statistics
            report.lastGenerated = Date.now();
            report.generationCount++;
            
            this.emit('reportGenerated', generatedReport);
            console.log(`✅ Report generated: ${report.name} (${generatedReport.duration}ms)`);
            
            return generatedReport;

        } catch (error) {
            console.error(`❌ Error generating report ${report.name}:`, error.message);
            throw error;
        }
    }

    /**
     * Collect data for report
     * @param {Object} report - Report configuration
     * @returns {Object} Collected data
     */
    async collectReportData(report) {
        switch (report.dataSource) {
            case 'analytics':
                return await this.collectAnalyticsData(report.query);
            
            case 'database':
                return await this.collectDatabaseData(report.query);
            
            case 'business':
                return await this.collectBusinessData(report.query);
            
            case 'performance':
                return await this.collectPerformanceData(report.query);
            
            case 'security':
                return await this.collectSecurityData(report.query);
            
            default:
                throw new Error(`Unknown data source: ${report.dataSource}`);
        }
    }

    /**
     * Collect analytics data
     * @param {Object} query - Data query
     * @returns {Object} Analytics data
     */
    async collectAnalyticsData(query) {
        if (!this.analyticsService) {
            throw new Error('Analytics service not available');
        }

        const timeRange = query.timeRange || 24 * 60 * 60 * 1000; // 24 hours
        const granularity = query.granularity || 'hour';
        
        const historicalData = this.analyticsService.getAggregatedData(timeRange);
        const currentMetrics = this.analyticsService.getCurrentMetrics();
        const anomalies = this.analyticsService.getAnomalies(timeRange);
        const trends = this.analyticsService.getTrends(7); // 7 days
        
        return {
            current: currentMetrics,
            historical: historicalData,
            anomalies,
            trends,
            summary: {
                dataPoints: historicalData.length,
                timeRange: query.timeRange,
                granularity,
                collectedAt: Date.now()
            }
        };
    }

    /**
     * Collect database data
     * @param {Object} query - Database query
     * @returns {Object} Database data
     */
    async collectDatabaseData(query) {
        if (!this.db) {
            return this.getSimulatedDatabaseData(query);
        }

        try {
            const sql = query.sql || 'SELECT COUNT(*) as count FROM models';
            const params = query.params || [];
            
            const [results] = await this.db.execute(sql, params);
            
            return {
                results,
                query: sql,
                rowCount: results.length,
                executedAt: Date.now()
            };
            
        } catch (error) {
            console.error('❌ Database query error:', error.message);
            return this.getSimulatedDatabaseData(query);
        }
    }

    /**
     * Get simulated database data
     * @param {Object} query - Query configuration
     * @returns {Object} Simulated data
     */
    getSimulatedDatabaseData(query) {
        return {
            results: [
                { metric: 'total_models', value: 150 },
                { metric: 'active_models', value: 135 },
                { metric: 'total_clients', value: 320 },
                { metric: 'active_clients', value: 285 },
                { metric: 'total_subscriptions', value: 280 },
                { metric: 'monthly_revenue', value: 12450.75 }
            ],
            rowCount: 6,
            simulated: true,
            executedAt: Date.now()
        };
    }

    /**
     * Collect business data
     * @param {Object} query - Business query
     * @returns {Object} Business data
     */
    async collectBusinessData(query) {
        const timeRange = query.timeRange || 30 * 24 * 60 * 60 * 1000; // 30 days
        const now = Date.now();
        
        // Simulate business metrics over time
        const data = [];
        const points = 30; // 30 data points
        const interval = timeRange / points;
        
        for (let i = 0; i < points; i++) {
            const timestamp = now - (timeRange - (i * interval));
            data.push({
                timestamp,
                date: new Date(timestamp).toISOString().slice(0, 10),
                revenue: 10000 + (Math.random() * 5000) + (i * 100),
                clients: 300 + Math.floor(Math.random() * 50) + (i * 2),
                subscriptions: 250 + Math.floor(Math.random() * 30) + (i * 1.5),
                models: 150 + Math.floor(Math.random() * 20) + (i * 1),
                conversionRate: 0.7 + (Math.random() * 0.2),
                customerSatisfaction: 4.2 + (Math.random() * 0.6)
            });
        }
        
        return {
            timeSeries: data,
            summary: {
                totalRevenue: data.reduce((sum, d) => sum + d.revenue, 0),
                avgClients: Math.round(data.reduce((sum, d) => sum + d.clients, 0) / data.length),
                growthRate: ((data[data.length - 1].clients - data[0].clients) / data[0].clients) * 100,
                dataPoints: data.length,
                timeRange: query.timeRange
            }
        };
    }

    /**
     * Collect performance data
     * @param {Object} query - Performance query
     * @returns {Object} Performance data
     */
    async collectPerformanceData(query) {
        const timeRange = query.timeRange || 24 * 60 * 60 * 1000; // 24 hours
        const now = Date.now();
        
        // Simulate performance metrics
        const data = [];
        const points = 24; // Hourly data
        const interval = timeRange / points;
        
        for (let i = 0; i < points; i++) {
            const timestamp = now - (timeRange - (i * interval));
            data.push({
                timestamp,
                hour: new Date(timestamp).getHours(),
                responseTime: 50 + (Math.random() * 200),
                throughput: 80 + (Math.random() * 40),
                errorRate: Math.random() * 2,
                cpuUsage: 20 + (Math.random() * 60),
                memoryUsage: 40 + (Math.random() * 50),
                diskUsage: 60 + (Math.random() * 20),
                uptime: 99.5 + (Math.random() * 0.5)
            });
        }
        
        return {
            timeSeries: data,
            summary: {
                avgResponseTime: Math.round(data.reduce((sum, d) => sum + d.responseTime, 0) / data.length),
                avgThroughput: Math.round(data.reduce((sum, d) => sum + d.throughput, 0) / data.length),
                avgErrorRate: Math.round((data.reduce((sum, d) => sum + d.errorRate, 0) / data.length) * 100) / 100,
                avgUptime: Math.round((data.reduce((sum, d) => sum + d.uptime, 0) / data.length) * 100) / 100,
                dataPoints: data.length
            }
        };
    }

    /**
     * Collect security data
     * @param {Object} query - Security query
     * @returns {Object} Security data
     */
    async collectSecurityData(query) {
        const timeRange = query.timeRange || 24 * 60 * 60 * 1000; // 24 hours
        const now = Date.now();
        
        // Simulate security metrics
        const data = [];
        const points = 24; // Hourly data
        const interval = timeRange / points;
        
        for (let i = 0; i < points; i++) {
            const timestamp = now - (timeRange - (i * interval));
            data.push({
                timestamp,
                hour: new Date(timestamp).getHours(),
                blockedRequests: Math.floor(Math.random() * 50),
                suspiciousActivity: Math.floor(Math.random() * 10),
                failedLogins: Math.floor(Math.random() * 20),
                bannedIPs: Math.floor(Math.random() * 5),
                threats: Math.floor(Math.random() * 3),
                complianceScore: 95 + (Math.random() * 5)
            });
        }
        
        return {
            timeSeries: data,
            summary: {
                totalBlocked: data.reduce((sum, d) => sum + d.blockedRequests, 0),
                totalThreats: data.reduce((sum, d) => sum + d.threats, 0),
                avgComplianceScore: Math.round((data.reduce((sum, d) => sum + d.complianceScore, 0) / data.length) * 100) / 100,
                dataPoints: data.length
            }
        };
    }

    /**
     * Apply filters to data
     * @param {Object} data - Raw data
     * @param {Object} filters - Filters to apply
     * @returns {Object} Filtered data
     */
    applyFilters(data, filters) {
        if (!filters || Object.keys(filters).length === 0) {
            return data;
        }

        // Apply time range filter
        if (filters.dateRange && data.timeSeries) {
            const { start, end } = filters.dateRange;
            data.timeSeries = data.timeSeries.filter(item => {
                const timestamp = item.timestamp;
                return (!start || timestamp >= new Date(start).getTime()) &&
                       (!end || timestamp <= new Date(end).getTime());
            });
        }

        // Apply value filters
        if (filters.metrics && data.timeSeries) {
            Object.entries(filters.metrics).forEach(([metric, condition]) => {
                if (condition.min !== undefined) {
                    data.timeSeries = data.timeSeries.filter(item => item[metric] >= condition.min);
                }
                if (condition.max !== undefined) {
                    data.timeSeries = data.timeSeries.filter(item => item[metric] <= condition.max);
                }
            });
        }

        return data;
    }

    /**
     * Generate visualizations for data
     * @param {Object} data - Data to visualize
     * @param {Object} vizConfig - Visualization configuration
     * @returns {Object} Generated visualizations
     */
    async generateVisualizations(data, vizConfig) {
        const visualizations = {};

        for (const [vizId, config] of Object.entries(vizConfig)) {
            try {
                const viz = await this.createVisualization(data, config);
                visualizations[vizId] = viz;
            } catch (error) {
                console.error(`❌ Error creating visualization ${vizId}:`, error.message);
            }
        }

        return visualizations;
    }

    /**
     * Create a single visualization
     * @param {Object} data - Data to visualize
     * @param {Object} config - Visualization configuration
     * @returns {Object} Visualization definition
     */
    async createVisualization(data, config) {
        const visualization = {
            type: config.type || 'line',
            title: config.title || 'Chart',
            xAxis: config.xAxis || 'timestamp',
            yAxis: config.yAxis || 'value',
            colorScheme: config.colorScheme || 'default',
            options: config.options || {},
            data: null,
            metadata: {
                created: Date.now(),
                dataPoints: 0
            }
        };

        // Process data based on visualization type
        switch (visualization.type) {
            case 'line':
            case 'area':
                visualization.data = this.processTimeSeriesData(data, config);
                break;
                
            case 'bar':
            case 'column':
                visualization.data = this.processCategoricalData(data, config);
                break;
                
            case 'pie':
            case 'donut':
                visualization.data = this.processProportionalData(data, config);
                break;
                
            case 'scatter':
                visualization.data = this.processScatterData(data, config);
                break;
                
            case 'heatmap':
                visualization.data = this.processHeatmapData(data, config);
                break;
                
            case 'gauge':
                visualization.data = this.processGaugeData(data, config);
                break;
                
            default:
                throw new Error(`Unsupported visualization type: ${visualization.type}`);
        }

        visualization.metadata.dataPoints = Array.isArray(visualization.data) ? 
            visualization.data.length : Object.keys(visualization.data).length;

        return visualization;
    }

    /**
     * Process time series data for line/area charts
     * @param {Object} data - Raw data
     * @param {Object} config - Configuration
     * @returns {Array} Processed data
     */
    processTimeSeriesData(data, config) {
        if (!data.timeSeries) return [];
        
        return data.timeSeries.map(item => ({
            x: item.timestamp,
            y: item[config.yAxis] || 0,
            label: new Date(item.timestamp).toLocaleString()
        }));
    }

    /**
     * Process categorical data for bar charts
     * @param {Object} data - Raw data
     * @param {Object} config - Configuration
     * @returns {Array} Processed data
     */
    processCategoricalData(data, config) {
        if (data.summary) {
            return Object.entries(data.summary)
                .filter(([key, value]) => typeof value === 'number')
                .map(([key, value]) => ({
                    category: key,
                    value: value,
                    label: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())
                }));
        }
        return [];
    }

    /**
     * Process proportional data for pie charts
     * @param {Object} data - Raw data
     * @param {Object} config - Configuration
     * @returns {Array} Processed data
     */
    processProportionalData(data, config) {
        const categories = this.processCategoricalData(data, config);
        const total = categories.reduce((sum, item) => sum + item.value, 0);
        
        return categories.map(item => ({
            ...item,
            percentage: Math.round((item.value / total) * 10000) / 100
        }));
    }

    /**
     * Process scatter plot data
     * @param {Object} data - Raw data
     * @param {Object} config - Configuration
     * @returns {Array} Processed data
     */
    processScatterData(data, config) {
        if (!data.timeSeries) return [];
        
        const xAxis = config.xAxis || 'timestamp';
        const yAxis = config.yAxis || 'value';
        
        return data.timeSeries.map(item => ({
            x: item[xAxis] || 0,
            y: item[yAxis] || 0,
            label: `${xAxis}: ${item[xAxis]}, ${yAxis}: ${item[yAxis]}`
        }));
    }

    /**
     * Process heatmap data
     * @param {Object} data - Raw data
     * @param {Object} config - Configuration
     * @returns {Array} Processed data
     */
    processHeatmapData(data, config) {
        // Simplified heatmap data processing
        if (!data.timeSeries) return [];
        
        const heatmapData = [];
        const metric = config.yAxis || 'value';
        
        // Group by hour and day of week
        const grouped = {};
        
        data.timeSeries.forEach(item => {
            const date = new Date(item.timestamp);
            const hour = date.getHours();
            const day = date.getDay();
            
            if (!grouped[day]) grouped[day] = {};
            if (!grouped[day][hour]) grouped[day][hour] = [];
            
            grouped[day][hour].push(item[metric] || 0);
        });
        
        // Convert to heatmap format
        Object.entries(grouped).forEach(([day, hours]) => {
            Object.entries(hours).forEach(([hour, values]) => {
                const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
                heatmapData.push({
                    x: parseInt(hour),
                    y: parseInt(day),
                    value: avg,
                    label: `Day ${day}, Hour ${hour}: ${Math.round(avg * 100) / 100}`
                });
            });
        });
        
        return heatmapData;
    }

    /**
     * Process gauge data
     * @param {Object} data - Raw data
     * @param {Object} config - Configuration
     * @returns {Object} Processed data
     */
    processGaugeData(data, config) {
        const metric = config.metric || 'value';
        let value = 0;
        
        if (data.summary && data.summary[metric]) {
            value = data.summary[metric];
        } else if (data.current && data.current[metric]) {
            value = data.current[metric];
        }
        
        return {
            value: Math.round(value * 100) / 100,
            min: config.min || 0,
            max: config.max || 100,
            label: config.title || metric,
            thresholds: config.thresholds || {
                good: 80,
                warning: 60,
                critical: 40
            }
        };
    }

    /**
     * Format report data based on format
     * @param {Object} data - Data to format
     * @param {string} format - Output format
     * @returns {String|Object} Formatted data
     */
    async formatReportData(data, format) {
        switch (format) {
            case 'json':
                return data;
                
            case 'csv':
                return this.convertToCSV(data);
                
            case 'pdf':
                return await this.convertToPDF(data);
                
            default:
                return data;
        }
    }

    /**
     * Convert data to CSV format
     * @param {Object} data - Data to convert
     * @returns {string} CSV data
     */
    convertToCSV(data) {
        if (data.timeSeries) {
            const headers = Object.keys(data.timeSeries[0] || {});
            const csvHeaders = headers.join(',');
            const csvRows = data.timeSeries.map(row => 
                headers.map(header => row[header] || '').join(',')
            );
            return [csvHeaders, ...csvRows].join('\n');
        }
        
        if (data.results) {
            const headers = Object.keys(data.results[0] || {});
            const csvHeaders = headers.join(',');
            const csvRows = data.results.map(row => 
                headers.map(header => row[header] || '').join(',')
            );
            return [csvHeaders, ...csvRows].join('\n');
        }
        
        return JSON.stringify(data);
    }

    /**
     * Convert data to PDF format (placeholder)
     * @param {Object} data - Data to convert
     * @returns {Object} PDF metadata
     */
    async convertToPDF(data) {
        // In production, would use a library like puppeteer or jsPDF
        return {
            format: 'pdf',
            content: 'PDF generation not implemented',
            pageCount: 1,
            size: '1024 bytes'
        };
    }

    /**
     * Refresh widget data
     * @param {string} widgetId - Widget ID
     * @returns {Object} Refreshed widget
     */
    async refreshWidget(widgetId) {
        const widget = this.widgets.get(widgetId);
        if (!widget) {
            throw new Error(`Widget not found: ${widgetId}`);
        }

        try {
            // Collect data based on widget configuration
            const data = await this.collectReportData({
                dataSource: widget.dataSource,
                query: widget.query
            });
            
            // Apply filters
            const filteredData = this.applyFilters(data, widget.filters);
            
            // Generate visualization
            const visualization = await this.createVisualization(filteredData, {
                type: widget.chartType,
                xAxis: widget.visualization.xAxis,
                yAxis: widget.visualization.yAxis,
                ...widget.options
            });
            
            // Update widget
            widget.data = filteredData;
            widget.visualization = visualization;
            widget.lastRefresh = Date.now();
            widget.lastUpdated = Date.now();
            
            this.emit('widgetRefreshed', widget);
            
            return widget;
            
        } catch (error) {
            console.error(`❌ Error refreshing widget ${widget.name}:`, error.message);
            throw error;
        }
    }

    /**
     * Start real-time dashboard updates
     * @param {string} dashboardId - Dashboard ID
     */
    startRealTimeDashboard(dashboardId) {
        const dashboard = this.dashboards.get(dashboardId);
        if (!dashboard) return;

        const interval = setInterval(async () => {
            try {
                await this.refreshDashboard(dashboardId);
            } catch (error) {
                console.error(`❌ Error refreshing real-time dashboard ${dashboardId}:`, error.message);
            }
        }, dashboard.refreshInterval);

        this.dashboardIntervals.set(dashboardId, interval);
        console.log(`🔄 Real-time updates started for dashboard: ${dashboard.name}`);
    }

    /**
     * Refresh dashboard data
     * @param {string} dashboardId - Dashboard ID
     * @returns {Object} Refreshed dashboard
     */
    async refreshDashboard(dashboardId) {
        const dashboard = this.dashboards.get(dashboardId);
        if (!dashboard) {
            throw new Error(`Dashboard not found: ${dashboardId}`);
        }

        try {
            // Refresh all widgets
            const refreshPromises = dashboard.widgets.map(widgetId => 
                this.refreshWidget(widgetId).catch(error => {
                    console.error(`❌ Error refreshing widget ${widgetId}:`, error.message);
                    return null;
                })
            );
            
            await Promise.all(refreshPromises);
            
            dashboard.lastRefresh = Date.now();
            dashboard.viewCount++;
            
            this.emit('dashboardRefreshed', dashboard);
            
            return dashboard;
            
        } catch (error) {
            console.error(`❌ Error refreshing dashboard ${dashboard.name}:`, error.message);
            throw error;
        }
    }

    /**
     * Start dashboard refresh intervals
     */
    startDashboardRefresh() {
        for (const [dashboardId, dashboard] of this.dashboards.entries()) {
            if (dashboard.isRealTime) {
                this.startRealTimeDashboard(dashboardId);
            }
        }
    }

    /**
     * Create default dashboards
     */
    async createDefaultDashboards() {
        // Executive Dashboard
        const executiveDashboard = await this.createDashboard({
            name: 'Executive Dashboard',
            description: 'High-level business metrics and KPIs',
            category: 'business',
            isRealTime: true,
            widgets: [
                {
                    name: 'Revenue Trend',
                    type: 'chart',
                    chartType: 'line',
                    dataSource: 'business',
                    query: { timeRange: 30 * 24 * 60 * 60 * 1000 },
                    visualization: { xAxis: 'timestamp', yAxis: 'revenue' },
                    dimensions: { width: 8, height: 4 }
                },
                {
                    name: 'Client Growth',
                    type: 'chart',
                    chartType: 'area',
                    dataSource: 'business',
                    query: { timeRange: 30 * 24 * 60 * 60 * 1000 },
                    visualization: { xAxis: 'timestamp', yAxis: 'clients' },
                    dimensions: { width: 4, height: 4 }
                },
                {
                    name: 'KPI Summary',
                    type: 'metrics',
                    dataSource: 'analytics',
                    query: {},
                    dimensions: { width: 12, height: 2 }
                }
            ]
        });

        // Operations Dashboard
        const operationsDashboard = await this.createDashboard({
            name: 'Operations Dashboard',
            description: 'System performance and operational metrics',
            category: 'operations',
            isRealTime: true,
            widgets: [
                {
                    name: 'System Performance',
                    type: 'chart',
                    chartType: 'line',
                    dataSource: 'performance',
                    query: { timeRange: 24 * 60 * 60 * 1000 },
                    visualization: { xAxis: 'timestamp', yAxis: 'responseTime' },
                    dimensions: { width: 6, height: 4 }
                },
                {
                    name: 'Resource Usage',
                    type: 'chart',
                    chartType: 'gauge',
                    dataSource: 'performance',
                    query: {},
                    visualization: { metric: 'cpuUsage' },
                    dimensions: { width: 3, height: 4 }
                },
                {
                    name: 'Error Rate',
                    type: 'chart',
                    chartType: 'bar',
                    dataSource: 'performance',
                    query: { timeRange: 24 * 60 * 60 * 1000 },
                    visualization: { xAxis: 'hour', yAxis: 'errorRate' },
                    dimensions: { width: 3, height: 4 }
                }
            ]
        });

        // Security Dashboard
        const securityDashboard = await this.createDashboard({
            name: 'Security Dashboard',
            description: 'Security metrics and threat monitoring',
            category: 'security',
            isRealTime: true,
            widgets: [
                {
                    name: 'Threat Activity',
                    type: 'chart',
                    chartType: 'area',
                    dataSource: 'security',
                    query: { timeRange: 24 * 60 * 60 * 1000 },
                    visualization: { xAxis: 'timestamp', yAxis: 'threats' },
                    dimensions: { width: 8, height: 4 }
                },
                {
                    name: 'Security Score',
                    type: 'chart',
                    chartType: 'gauge',
                    dataSource: 'security',
                    query: {},
                    visualization: { metric: 'complianceScore' },
                    dimensions: { width: 4, height: 4 }
                }
            ]
        });

        console.log('📊 Default dashboards created');
    }

    // File operations

    async saveDashboard(dashboard) {
        try {
            const filename = `dashboard_${dashboard.id}.json`;
            const filepath = path.join(this.config.storage.dashboardsDir, filename);
            await fs.writeFile(filepath, JSON.stringify(dashboard, null, 2));
        } catch (error) {
            console.error('❌ Error saving dashboard:', error.message);
        }
    }

    async saveReport(report) {
        try {
            const filename = `report_${report.id}.json`;
            const filepath = path.join(this.config.storage.reportsDir, filename);
            await fs.writeFile(filepath, JSON.stringify(report, null, 2));
        } catch (error) {
            console.error('❌ Error saving report:', error.message);
        }
    }

    async saveGeneratedReport(generatedReport) {
        try {
            const filename = `generated_${generatedReport.id}.json`;
            const filepath = path.join(this.config.storage.reportsDir, filename);
            await fs.writeFile(filepath, JSON.stringify(generatedReport, null, 2));
        } catch (error) {
            console.error('❌ Error saving generated report:', error.message);
        }
    }

    async loadExistingData() {
        try {
            // Load dashboards
            const dashboardFiles = await fs.readdir(this.config.storage.dashboardsDir).catch(() => []);
            for (const file of dashboardFiles.filter(f => f.startsWith('dashboard_'))) {
                try {
                    const filepath = path.join(this.config.storage.dashboardsDir, file);
                    const dashboard = JSON.parse(await fs.readFile(filepath, 'utf8'));
                    this.dashboards.set(dashboard.id, dashboard);
                } catch (error) {
                    console.warn(`⚠️ Failed to load dashboard from ${file}`);
                }
            }

            // Load reports
            const reportFiles = await fs.readdir(this.config.storage.reportsDir).catch(() => []);
            for (const file of reportFiles.filter(f => f.startsWith('report_'))) {
                try {
                    const filepath = path.join(this.config.storage.reportsDir, file);
                    const report = JSON.parse(await fs.readFile(filepath, 'utf8'));
                    this.reports.set(report.id, report);
                } catch (error) {
                    console.warn(`⚠️ Failed to load report from ${file}`);
                }
            }

            console.log(`📊 Loaded ${this.dashboards.size} dashboards and ${this.reports.size} reports`);
            
        } catch (error) {
            console.error('❌ Error loading existing data:', error.message);
        }
    }

    async scheduleReport(reportId) {
        // Placeholder for report scheduling
        // Would integrate with cron or task scheduler
        console.log(`📅 Report scheduled: ${reportId}`);
    }

    // API methods

    getDashboards(category = null) {
        let dashboards = Array.from(this.dashboards.values());
        if (category) {
            dashboards = dashboards.filter(d => d.category === category);
        }
        return dashboards.map(d => ({
            id: d.id,
            name: d.name,
            description: d.description,
            category: d.category,
            widgetCount: d.widgets.length,
            lastRefresh: d.lastRefresh,
            viewCount: d.viewCount,
            isRealTime: d.isRealTime
        }));
    }

    getDashboard(dashboardId) {
        const dashboard = this.dashboards.get(dashboardId);
        if (!dashboard) return null;

        // Get widget data
        const widgets = dashboard.widgets.map(widgetId => {
            const widget = this.widgets.get(widgetId);
            return widget ? {
                id: widget.id,
                name: widget.name,
                type: widget.type,
                chartType: widget.chartType,
                dimensions: widget.dimensions,
                position: widget.position,
                data: widget.data,
                visualization: widget.visualization,
                lastRefresh: widget.lastRefresh
            } : null;
        }).filter(Boolean);

        return {
            ...dashboard,
            widgets
        };
    }

    getReports(category = null) {
        let reports = Array.from(this.reports.values());
        if (category) {
            reports = reports.filter(r => r.category === category);
        }
        return reports.map(r => ({
            id: r.id,
            name: r.name,
            description: r.description,
            category: r.category,
            type: r.type,
            format: r.format,
            lastGenerated: r.lastGenerated,
            generationCount: r.generationCount,
            status: r.status
        }));
    }

    getBIStatus() {
        return {
            dashboards: {
                total: this.dashboards.size,
                realTime: Array.from(this.dashboards.values()).filter(d => d.isRealTime).length,
                categories: [...new Set(Array.from(this.dashboards.values()).map(d => d.category))]
            },
            widgets: {
                total: this.widgets.size,
                byType: this.getWidgetsByType()
            },
            reports: {
                total: this.reports.size,
                scheduled: Array.from(this.reports.values()).filter(r => r.schedule).length,
                categories: [...new Set(Array.from(this.reports.values()).map(r => r.category))]
            },
            configuration: this.config
        };
    }

    getWidgetsByType() {
        const widgets = Array.from(this.widgets.values());
        const byType = {};
        widgets.forEach(widget => {
            byType[widget.type] = (byType[widget.type] || 0) + 1;
        });
        return byType;
    }

    updateConfiguration(newConfig) {
        this.config = { ...this.config, ...newConfig };
        console.log('📊 BI service configuration updated');
        this.emit('configurationUpdated', this.config);
    }
}

module.exports = BusinessIntelligenceService;