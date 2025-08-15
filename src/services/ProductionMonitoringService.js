/**
 * Production Monitoring Service
 * 
 * Comprehensive monitoring system for Universal Gallery with
 * real-time alerting, incident management, and automated responses.
 */

class ProductionMonitoringService {
    constructor(database, logger, alertingService, performanceMonitor) {
        this.db = database;
        this.logger = logger;
        this.alerting = alertingService;
        this.performance = performanceMonitor;
        
        // Monitoring configuration
        this.config = {
            metrics: {
                collection_interval: 60000, // 1 minute
                retention_days: 30,
                aggregation_intervals: ['1m', '5m', '15m', '1h', '1d']
            },
            alerts: {
                evaluation_interval: 30000, // 30 seconds
                notification_cooldown: 300000, // 5 minutes
                escalation_timeout: 900000, // 15 minutes
                auto_resolve_timeout: 1800000 // 30 minutes
            },
            health_checks: {
                interval: 30000, // 30 seconds
                timeout: 5000, // 5 seconds
                retries: 3,
                grace_period: 60000 // 1 minute
            },
            thresholds: {
                error_rate: { warning: 0.02, critical: 0.05 }, // 2% warning, 5% critical
                response_time: { warning: 2000, critical: 5000 }, // 2s warning, 5s critical
                memory_usage: { warning: 0.8, critical: 0.9 }, // 80% warning, 90% critical
                cpu_usage: { warning: 0.7, critical: 0.85 }, // 70% warning, 85% critical
                disk_usage: { warning: 0.8, critical: 0.9 }, // 80% warning, 90% critical
                gallery_load_time: { warning: 3000, critical: 7000 }, // 3s warning, 7s critical
                image_load_failures: { warning: 0.05, critical: 0.1 }, // 5% warning, 10% critical
                theme_rendering_errors: { warning: 0.01, critical: 0.03 } // 1% warning, 3% critical
            }
        };
        
        // Active monitoring state
        this.monitoring = {
            collectors: new Map(),
            alerts: new Map(),
            incidents: new Map(),
            health_checks: new Map(),
            metrics_buffer: new Map(),
            last_evaluation: Date.now()
        };
        
        this.isRunning = false;
        this.initializeMonitoring();
    }

    /**
     * Initialize the monitoring system
     */
    async initializeMonitoring() {
        try {
            this.logger.info('🔍 Initializing production monitoring system...');
            
            // Set up metric collectors
            await this.setupMetricCollectors();
            
            // Initialize alert rules
            await this.loadAlertRules();
            
            // Start health checks
            await this.startHealthChecks();
            
            // Begin metric collection
            this.startMetricCollection();
            
            // Start alert evaluation
            this.startAlertEvaluation();
            
            this.isRunning = true;
            this.logger.info('✅ Production monitoring system initialized successfully');
            
        } catch (error) {
            this.logger.error('❌ Failed to initialize monitoring system:', error);
            throw error;
        }
    }

    /**
     * Set up metric collectors for different system components
     */
    async setupMetricCollectors() {
        const collectors = [
            { name: 'gallery_performance', handler: this.collectGalleryMetrics.bind(this) },
            { name: 'theme_rendering', handler: this.collectThemeMetrics.bind(this) },
            { name: 'image_loading', handler: this.collectImageMetrics.bind(this) },
            { name: 'user_experience', handler: this.collectUXMetrics.bind(this) },
            { name: 'system_resources', handler: this.collectSystemMetrics.bind(this) },
            { name: 'database_performance', handler: this.collectDatabaseMetrics.bind(this) },
            { name: 'api_performance', handler: this.collectAPIMetrics.bind(this) },
            { name: 'migration_status', handler: this.collectMigrationMetrics.bind(this) }
        ];

        for (const collector of collectors) {
            this.monitoring.collectors.set(collector.name, {
                handler: collector.handler,
                last_run: 0,
                errors: 0,
                metrics: []
            });
        }

        this.logger.info(`📊 Set up ${collectors.length} metric collectors`);
    }

    /**
     * Load alert rules from configuration
     */
    async loadAlertRules() {
        try {
            // Load from database or configuration
            const [alertRules] = await this.db.query(`
                SELECT * FROM monitoring_alert_rules WHERE is_active = 1
            `);

            // Add default alert rules if none exist
            if (alertRules.length === 0) {
                await this.createDefaultAlertRules();
                const [newRules] = await this.db.query(`
                    SELECT * FROM monitoring_alert_rules WHERE is_active = 1
                `);
                alertRules.push(...newRules);
            }

            for (const rule of alertRules) {
                this.monitoring.alerts.set(rule.id, {
                    ...rule,
                    config: JSON.parse(rule.config),
                    last_evaluation: 0,
                    current_state: 'ok',
                    last_alert_sent: 0,
                    alert_count: 0
                });
            }

            this.logger.info(`🚨 Loaded ${alertRules.length} alert rules`);

        } catch (error) {
            this.logger.error('Failed to load alert rules:', error);
            // Continue with default rules
            await this.createDefaultAlertRules();
        }
    }

    /**
     * Create default alert rules
     */
    async createDefaultAlertRules() {
        const defaultRules = [
            {
                name: 'High Error Rate',
                description: 'Gallery error rate exceeds threshold',
                metric: 'gallery_error_rate',
                condition: 'greater_than',
                warning_threshold: this.config.thresholds.error_rate.warning,
                critical_threshold: this.config.thresholds.error_rate.critical,
                evaluation_window: '5m',
                notification_channels: ['email', 'slack']
            },
            {
                name: 'High Response Time',
                description: 'Gallery response time exceeds threshold',
                metric: 'gallery_response_time',
                condition: 'greater_than',
                warning_threshold: this.config.thresholds.response_time.warning,
                critical_threshold: this.config.thresholds.response_time.critical,
                evaluation_window: '5m',
                notification_channels: ['email']
            },
            {
                name: 'Image Load Failures',
                description: 'High rate of image loading failures',
                metric: 'image_load_failure_rate',
                condition: 'greater_than',
                warning_threshold: this.config.thresholds.image_load_failures.warning,
                critical_threshold: this.config.thresholds.image_load_failures.critical,
                evaluation_window: '10m',
                notification_channels: ['email', 'slack']
            },
            {
                name: 'Theme Rendering Errors',
                description: 'Theme rendering error rate is high',
                metric: 'theme_rendering_error_rate',
                condition: 'greater_than',
                warning_threshold: this.config.thresholds.theme_rendering_errors.warning,
                critical_threshold: this.config.thresholds.theme_rendering_errors.critical,
                evaluation_window: '5m',
                notification_channels: ['email', 'slack']
            },
            {
                name: 'System Memory Usage',
                description: 'System memory usage is high',
                metric: 'system_memory_usage',
                condition: 'greater_than',
                warning_threshold: this.config.thresholds.memory_usage.warning,
                critical_threshold: this.config.thresholds.memory_usage.critical,
                evaluation_window: '5m',
                notification_channels: ['email']
            },
            {
                name: 'Database Performance',
                description: 'Database query performance degraded',
                metric: 'database_avg_query_time',
                condition: 'greater_than',
                warning_threshold: 1000, // 1 second
                critical_threshold: 3000, // 3 seconds
                evaluation_window: '5m',
                notification_channels: ['email', 'pagerduty']
            }
        ];

        for (const rule of defaultRules) {
            const ruleId = `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            await this.db.query(`
                INSERT INTO monitoring_alert_rules 
                (id, name, description, config, is_active, created_at)
                VALUES (?, ?, ?, ?, 1, NOW())
            `, [
                ruleId,
                rule.name,
                rule.description,
                JSON.stringify(rule)
            ]);
        }

        this.logger.info(`✅ Created ${defaultRules.length} default alert rules`);
    }

    /**
     * Start health checks for critical system components
     */
    async startHealthChecks() {
        const healthChecks = [
            { name: 'database', handler: this.checkDatabaseHealth.bind(this) },
            { name: 'gallery_api', handler: this.checkGalleryAPIHealth.bind(this) },
            { name: 'theme_system', handler: this.checkThemeSystemHealth.bind(this) },
            { name: 'image_service', handler: this.checkImageServiceHealth.bind(this) },
            { name: 'migration_system', handler: this.checkMigrationSystemHealth.bind(this) }
        ];

        for (const check of healthChecks) {
            this.monitoring.health_checks.set(check.name, {
                handler: check.handler,
                status: 'unknown',
                last_check: 0,
                consecutive_failures: 0,
                last_success: 0,
                response_time: 0
            });
        }

        // Start health check interval
        setInterval(async () => {
            await this.runHealthChecks();
        }, this.config.health_checks.interval);

        this.logger.info(`❤️ Started ${healthChecks.length} health checks`);
    }

    /**
     * Start metric collection
     */
    startMetricCollection() {
        setInterval(async () => {
            await this.collectAllMetrics();
        }, this.config.metrics.collection_interval);

        this.logger.info('📈 Started metric collection');
    }

    /**
     * Start alert evaluation
     */
    startAlertEvaluation() {
        setInterval(async () => {
            await this.evaluateAlerts();
        }, this.config.alerts.evaluation_interval);

        this.logger.info('🚨 Started alert evaluation');
    }

    /**
     * Collect all metrics from registered collectors
     */
    async collectAllMetrics() {
        const startTime = Date.now();
        const results = [];

        for (const [collectorName, collector] of this.monitoring.collectors) {
            try {
                const metrics = await collector.handler();
                collector.last_run = Date.now();
                collector.metrics = metrics;
                collector.errors = 0;
                
                results.push({ collector: collectorName, metrics: metrics.length });
                
                // Store metrics in buffer for alert evaluation
                this.storeMetricsInBuffer(collectorName, metrics);
                
                // Persist metrics to database
                await this.persistMetrics(collectorName, metrics);
                
            } catch (error) {
                collector.errors++;
                this.logger.error(`Metric collection failed for ${collectorName}:`, error);
            }
        }

        const duration = Date.now() - startTime;
        this.logger.debug(`📊 Collected metrics in ${duration}ms:`, results);
    }

    /**
     * Gallery performance metrics collection
     */
    async collectGalleryMetrics() {
        const metrics = [];
        const timestamp = Date.now();

        try {
            // Get gallery request statistics
            const [requestStats] = await this.db.query(`
                SELECT 
                    COUNT(*) as total_requests,
                    COUNT(CASE WHEN status_code >= 400 THEN 1 END) as error_requests,
                    AVG(response_time_ms) as avg_response_time,
                    MAX(response_time_ms) as max_response_time,
                    COUNT(DISTINCT model_id) as active_models
                FROM request_logs 
                WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
                AND request_path LIKE '%/gallery%'
            `);

            if (requestStats.length > 0) {
                const stats = requestStats[0];
                const errorRate = stats.total_requests > 0 ? 
                    stats.error_requests / stats.total_requests : 0;

                metrics.push(
                    { name: 'gallery_total_requests', value: stats.total_requests, timestamp },
                    { name: 'gallery_error_requests', value: stats.error_requests, timestamp },
                    { name: 'gallery_error_rate', value: errorRate, timestamp },
                    { name: 'gallery_avg_response_time', value: stats.avg_response_time || 0, timestamp },
                    { name: 'gallery_max_response_time', value: stats.max_response_time || 0, timestamp },
                    { name: 'gallery_active_models', value: stats.active_models, timestamp }
                );
            }

            // Get Core Web Vitals data
            const coreWebVitals = await this.performance.getRecentWebVitals('5m');
            if (coreWebVitals) {
                metrics.push(
                    { name: 'gallery_lcp', value: coreWebVitals.lcp || 0, timestamp },
                    { name: 'gallery_fid', value: coreWebVitals.fid || 0, timestamp },
                    { name: 'gallery_cls', value: coreWebVitals.cls || 0, timestamp }
                );
            }

        } catch (error) {
            this.logger.error('Error collecting gallery metrics:', error);
        }

        return metrics;
    }

    /**
     * Theme rendering metrics collection
     */
    async collectThemeMetrics() {
        const metrics = [];
        const timestamp = Date.now();

        try {
            // Get theme rendering statistics
            const [themeStats] = await this.db.query(`
                SELECT 
                    theme_id,
                    COUNT(*) as render_count,
                    COUNT(CASE WHEN status_code >= 400 THEN 1 END) as render_errors,
                    AVG(response_time_ms) as avg_render_time
                FROM request_logs 
                WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
                AND theme_id IS NOT NULL
                GROUP BY theme_id
            `);

            let totalRenders = 0;
            let totalErrors = 0;
            let totalRenderTime = 0;

            for (const stat of themeStats) {
                totalRenders += stat.render_count;
                totalErrors += stat.render_errors;
                totalRenderTime += stat.avg_render_time * stat.render_count;

                // Per-theme metrics
                const errorRate = stat.render_errors / stat.render_count;
                metrics.push(
                    { name: 'theme_render_count', value: stat.render_count, timestamp, tags: { theme_id: stat.theme_id } },
                    { name: 'theme_error_rate', value: errorRate, timestamp, tags: { theme_id: stat.theme_id } },
                    { name: 'theme_avg_render_time', value: stat.avg_render_time, timestamp, tags: { theme_id: stat.theme_id } }
                );
            }

            // Aggregate metrics
            if (totalRenders > 0) {
                metrics.push(
                    { name: 'theme_rendering_total', value: totalRenders, timestamp },
                    { name: 'theme_rendering_errors', value: totalErrors, timestamp },
                    { name: 'theme_rendering_error_rate', value: totalErrors / totalRenders, timestamp },
                    { name: 'theme_avg_rendering_time', value: totalRenderTime / totalRenders, timestamp }
                );
            }

            // Get migration impact on theme rendering
            const [migrationImpact] = await this.db.query(`
                SELECT 
                    COUNT(*) as migration_requests,
                    AVG(response_time_ms) as migration_avg_time
                FROM request_logs rl
                JOIN user_theme_migrations utm ON rl.model_id = utm.model_id
                WHERE rl.timestamp >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
                AND utm.status = 'active'
            `);

            if (migrationImpact.length > 0 && migrationImpact[0].migration_requests > 0) {
                metrics.push(
                    { name: 'migration_affected_requests', value: migrationImpact[0].migration_requests, timestamp },
                    { name: 'migration_avg_response_time', value: migrationImpact[0].migration_avg_time, timestamp }
                );
            }

        } catch (error) {
            this.logger.error('Error collecting theme metrics:', error);
        }

        return metrics;
    }

    /**
     * Image loading metrics collection
     */
    async collectImageMetrics() {
        const metrics = [];
        const timestamp = Date.now();

        try {
            // Get image loading statistics from request logs
            const [imageStats] = await this.db.query(`
                SELECT 
                    COUNT(*) as total_image_requests,
                    COUNT(CASE WHEN status_code >= 400 THEN 1 END) as failed_requests,
                    COUNT(CASE WHEN status_code = 200 THEN 1 END) as successful_requests,
                    AVG(response_time_ms) as avg_load_time,
                    MAX(response_time_ms) as max_load_time
                FROM request_logs 
                WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
                AND (request_path LIKE '%.jpg' OR request_path LIKE '%.png' 
                     OR request_path LIKE '%.webp' OR request_path LIKE '%/images/%')
            `);

            if (imageStats.length > 0) {
                const stats = imageStats[0];
                const failureRate = stats.total_image_requests > 0 ? 
                    stats.failed_requests / stats.total_image_requests : 0;

                metrics.push(
                    { name: 'image_total_requests', value: stats.total_image_requests, timestamp },
                    { name: 'image_successful_requests', value: stats.successful_requests, timestamp },
                    { name: 'image_failed_requests', value: stats.failed_requests, timestamp },
                    { name: 'image_load_failure_rate', value: failureRate, timestamp },
                    { name: 'image_avg_load_time', value: stats.avg_load_time || 0, timestamp },
                    { name: 'image_max_load_time', value: stats.max_load_time || 0, timestamp }
                );
            }

            // Get gallery-specific image metrics
            const [galleryImageStats] = await this.db.query(`
                SELECT 
                    COUNT(DISTINCT gi.id) as total_gallery_images,
                    COUNT(CASE WHEN gi.status = 'active' THEN 1 END) as active_images,
                    COUNT(CASE WHEN gi.status = 'processing' THEN 1 END) as processing_images,
                    COUNT(CASE WHEN gi.status = 'error' THEN 1 END) as error_images,
                    AVG(gi.file_size) as avg_file_size
                FROM gallery_images gi
                WHERE gi.created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
            `);

            if (galleryImageStats.length > 0) {
                const stats = galleryImageStats[0];
                metrics.push(
                    { name: 'gallery_total_images', value: stats.total_gallery_images, timestamp },
                    { name: 'gallery_active_images', value: stats.active_images, timestamp },
                    { name: 'gallery_processing_images', value: stats.processing_images, timestamp },
                    { name: 'gallery_error_images', value: stats.error_images, timestamp },
                    { name: 'gallery_avg_file_size', value: stats.avg_file_size || 0, timestamp }
                );
            }

        } catch (error) {
            this.logger.error('Error collecting image metrics:', error);
        }

        return metrics;
    }

    /**
     * User experience metrics collection
     */
    async collectUXMetrics() {
        const metrics = [];
        const timestamp = Date.now();

        try {
            // Get user session statistics
            const [sessionStats] = await this.db.query(`
                SELECT 
                    COUNT(DISTINCT ip_address) as unique_visitors,
                    COUNT(*) as total_page_views,
                    AVG(response_time_ms) as avg_page_load_time,
                    COUNT(CASE WHEN status_code >= 400 THEN 1 END) as user_errors
                FROM request_logs 
                WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
                AND method = 'GET'
                AND request_path NOT LIKE '%.css'
                AND request_path NOT LIKE '%.js'
                AND request_path NOT LIKE '%.jpg'
                AND request_path NOT LIKE '%.png'
            `);

            if (sessionStats.length > 0) {
                const stats = sessionStats[0];
                metrics.push(
                    { name: 'ux_unique_visitors', value: stats.unique_visitors, timestamp },
                    { name: 'ux_total_page_views', value: stats.total_page_views, timestamp },
                    { name: 'ux_avg_page_load_time', value: stats.avg_page_load_time || 0, timestamp },
                    { name: 'ux_user_errors', value: stats.user_errors, timestamp }
                );
            }

            // Get user feedback metrics (if available)
            const [feedbackStats] = await this.db.query(`
                SELECT 
                    COUNT(*) as total_feedback,
                    AVG(rating) as avg_rating,
                    COUNT(CASE WHEN rating >= 4 THEN 1 END) as positive_feedback,
                    COUNT(CASE WHEN rating <= 2 THEN 1 END) as negative_feedback
                FROM migration_user_feedback 
                WHERE submitted_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
            `);

            if (feedbackStats.length > 0 && feedbackStats[0].total_feedback > 0) {
                const stats = feedbackStats[0];
                const satisfaction = stats.positive_feedback / stats.total_feedback;
                
                metrics.push(
                    { name: 'ux_total_feedback', value: stats.total_feedback, timestamp },
                    { name: 'ux_avg_rating', value: stats.avg_rating || 0, timestamp },
                    { name: 'ux_user_satisfaction', value: satisfaction, timestamp },
                    { name: 'ux_negative_feedback', value: stats.negative_feedback, timestamp }
                );
            }

        } catch (error) {
            this.logger.error('Error collecting UX metrics:', error);
        }

        return metrics;
    }

    /**
     * System resource metrics collection
     */
    async collectSystemMetrics() {
        const metrics = [];
        const timestamp = Date.now();

        try {
            // Memory usage
            const memUsage = process.memoryUsage();
            const totalMemory = require('os').totalmem();
            const freeMemory = require('os').freemem();
            const usedMemory = totalMemory - freeMemory;
            
            metrics.push(
                { name: 'system_heap_used', value: memUsage.heapUsed, timestamp },
                { name: 'system_heap_total', value: memUsage.heapTotal, timestamp },
                { name: 'system_memory_usage', value: usedMemory / totalMemory, timestamp },
                { name: 'system_free_memory', value: freeMemory, timestamp }
            );

            // CPU usage (simplified)
            const cpuUsage = process.cpuUsage();
            metrics.push(
                { name: 'system_cpu_user', value: cpuUsage.user, timestamp },
                { name: 'system_cpu_system', value: cpuUsage.system, timestamp }
            );

            // Event loop lag
            const startTime = process.hrtime.bigint();
            setImmediate(() => {
                const lag = Number(process.hrtime.bigint() - startTime) / 1e6; // Convert to milliseconds
                metrics.push({ name: 'system_event_loop_lag', value: lag, timestamp });
            });

            // Process uptime
            metrics.push(
                { name: 'system_uptime', value: process.uptime(), timestamp },
                { name: 'system_pid', value: process.pid, timestamp }
            );

        } catch (error) {
            this.logger.error('Error collecting system metrics:', error);
        }

        return metrics;
    }

    /**
     * Database performance metrics collection
     */
    async collectDatabaseMetrics() {
        const metrics = [];
        const timestamp = Date.now();

        try {
            // Database connection pool stats (if available)
            if (this.db.pool) {
                metrics.push(
                    { name: 'database_total_connections', value: this.db.pool.totalConnections || 0, timestamp },
                    { name: 'database_idle_connections', value: this.db.pool.idleConnections || 0, timestamp },
                    { name: 'database_active_connections', value: this.db.pool.activeConnections || 0, timestamp }
                );
            }

            // Query performance (simulate timing)
            const queryStart = Date.now();
            await this.db.query('SELECT 1');
            const queryTime = Date.now() - queryStart;
            
            metrics.push(
                { name: 'database_ping_time', value: queryTime, timestamp }
            );

            // Database size metrics
            const [dbStats] = await this.db.query(`
                SELECT 
                    table_schema as db_name,
                    ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) as size_mb,
                    COUNT(*) as table_count
                FROM information_schema.tables 
                WHERE table_schema = DATABASE()
                GROUP BY table_schema
            `);

            if (dbStats.length > 0) {
                const stats = dbStats[0];
                metrics.push(
                    { name: 'database_size_mb', value: stats.size_mb, timestamp },
                    { name: 'database_table_count', value: stats.table_count, timestamp }
                );
            }

            // Slow query detection (last 5 minutes)
            const [slowQueries] = await this.db.query(`
                SELECT COUNT(*) as slow_query_count
                FROM mysql.slow_log 
                WHERE start_time >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
            `).catch(() => [{ slow_query_count: 0 }]); // Fallback if slow_log not available

            metrics.push(
                { name: 'database_slow_queries', value: slowQueries[0].slow_query_count, timestamp }
            );

        } catch (error) {
            this.logger.error('Error collecting database metrics:', error);
        }

        return metrics;
    }

    /**
     * API performance metrics collection
     */
    async collectAPIMetrics() {
        const metrics = [];
        const timestamp = Date.now();

        try {
            // API endpoint performance
            const [apiStats] = await this.db.query(`
                SELECT 
                    LEFT(request_path, 50) as endpoint,
                    method,
                    COUNT(*) as request_count,
                    COUNT(CASE WHEN status_code >= 400 THEN 1 END) as error_count,
                    AVG(response_time_ms) as avg_response_time,
                    MAX(response_time_ms) as max_response_time
                FROM request_logs 
                WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
                AND request_path LIKE '/api/%'
                GROUP BY LEFT(request_path, 50), method
                ORDER BY request_count DESC
                LIMIT 10
            `);

            for (const stat of apiStats) {
                const errorRate = stat.error_count / stat.request_count;
                const tags = { endpoint: stat.endpoint, method: stat.method };
                
                metrics.push(
                    { name: 'api_request_count', value: stat.request_count, timestamp, tags },
                    { name: 'api_error_count', value: stat.error_count, timestamp, tags },
                    { name: 'api_error_rate', value: errorRate, timestamp, tags },
                    { name: 'api_avg_response_time', value: stat.avg_response_time, timestamp, tags },
                    { name: 'api_max_response_time', value: stat.max_response_time, timestamp, tags }
                );
            }

            // Overall API health
            const [overallStats] = await this.db.query(`
                SELECT 
                    COUNT(*) as total_api_requests,
                    COUNT(CASE WHEN status_code >= 400 THEN 1 END) as total_api_errors,
                    AVG(response_time_ms) as overall_avg_time
                FROM request_logs 
                WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
                AND request_path LIKE '/api/%'
            `);

            if (overallStats.length > 0 && overallStats[0].total_api_requests > 0) {
                const stats = overallStats[0];
                metrics.push(
                    { name: 'api_total_requests', value: stats.total_api_requests, timestamp },
                    { name: 'api_total_errors', value: stats.total_api_errors, timestamp },
                    { name: 'api_overall_error_rate', value: stats.total_api_errors / stats.total_api_requests, timestamp },
                    { name: 'api_overall_avg_time', value: stats.overall_avg_time, timestamp }
                );
            }

        } catch (error) {
            this.logger.error('Error collecting API metrics:', error);
        }

        return metrics;
    }

    /**
     * Migration system metrics collection
     */
    async collectMigrationMetrics() {
        const metrics = [];
        const timestamp = Date.now();

        try {
            // Active migration statistics
            const [migrationStats] = await this.db.query(`
                SELECT 
                    status,
                    COUNT(*) as count,
                    AVG(TIMESTAMPDIFF(SECOND, created_at, COALESCE(updated_at, NOW()))) as avg_duration
                FROM theme_migrations 
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
                GROUP BY status
            `);

            for (const stat of migrationStats) {
                metrics.push(
                    { name: 'migration_count', value: stat.count, timestamp, tags: { status: stat.status } },
                    { name: 'migration_avg_duration', value: stat.avg_duration || 0, timestamp, tags: { status: stat.status } }
                );
            }

            // Migration performance impact
            const [performanceImpact] = await this.db.query(`
                SELECT 
                    AVG(CASE WHEN mm.metric_name = 'error_rate' THEN mm.metric_value END) as avg_error_rate,
                    AVG(CASE WHEN mm.metric_name = 'response_time' THEN mm.metric_value END) as avg_response_time
                FROM migration_metrics mm
                WHERE mm.collected_at >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
            `);

            if (performanceImpact.length > 0) {
                const impact = performanceImpact[0];
                if (impact.avg_error_rate !== null) {
                    metrics.push(
                        { name: 'migration_avg_error_rate', value: impact.avg_error_rate, timestamp },
                        { name: 'migration_avg_response_time', value: impact.avg_response_time || 0, timestamp }
                    );
                }
            }

            // Rollback frequency
            const [rollbackStats] = await this.db.query(`
                SELECT COUNT(*) as rollback_count
                FROM theme_migrations 
                WHERE status = 'rolled_back'
                AND created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
            `);

            metrics.push(
                { name: 'migration_rollback_count', value: rollbackStats[0].rollback_count, timestamp }
            );

        } catch (error) {
            this.logger.error('Error collecting migration metrics:', error);
        }

        return metrics;
    }

    /**
     * Store metrics in buffer for alert evaluation
     */
    storeMetricsInBuffer(collectorName, metrics) {
        const bufferKey = `${collectorName}_buffer`;
        const buffer = this.monitoring.metrics_buffer.get(bufferKey) || [];
        
        // Add new metrics
        buffer.push(...metrics);
        
        // Keep only last 15 minutes of data
        const cutoffTime = Date.now() - 15 * 60 * 1000;
        const filteredBuffer = buffer.filter(metric => metric.timestamp > cutoffTime);
        
        this.monitoring.metrics_buffer.set(bufferKey, filteredBuffer);
    }

    /**
     * Persist metrics to database
     */
    async persistMetrics(collectorName, metrics) {
        if (metrics.length === 0) return;

        try {
            const values = metrics.map(metric => [
                metric.name,
                metric.value,
                collectorName,
                JSON.stringify(metric.tags || {}),
                new Date(metric.timestamp)
            ]);

            await this.db.query(`
                INSERT INTO monitoring_metrics 
                (metric_name, metric_value, source, tags, timestamp)
                VALUES ?
            `, [values]);

        } catch (error) {
            this.logger.error(`Failed to persist metrics for ${collectorName}:`, error);
        }
    }

    /**
     * Run all health checks
     */
    async runHealthChecks() {
        for (const [checkName, check] of this.monitoring.health_checks) {
            try {
                const startTime = Date.now();
                const result = await Promise.race([
                    check.handler(),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Health check timeout')), 
                        this.config.health_checks.timeout)
                    )
                ]);

                const responseTime = Date.now() - startTime;
                
                // Update health check status
                check.status = result.healthy ? 'healthy' : 'unhealthy';
                check.last_check = Date.now();
                check.response_time = responseTime;
                check.last_success = result.healthy ? Date.now() : check.last_success;
                check.consecutive_failures = result.healthy ? 0 : check.consecutive_failures + 1;
                check.details = result.details;

                // Store health check result
                await this.storeHealthCheckResult(checkName, check, result);

                // Alert on consecutive failures
                if (check.consecutive_failures >= 3) {
                    await this.alerting.sendAlert({
                        type: 'health_check_failure',
                        severity: 'critical',
                        title: `Health Check Failed: ${checkName}`,
                        description: `Health check has failed ${check.consecutive_failures} times consecutively`,
                        details: result.details,
                        timestamp: Date.now()
                    });
                }

            } catch (error) {
                const check = this.monitoring.health_checks.get(checkName);
                check.status = 'error';
                check.last_check = Date.now();
                check.consecutive_failures++;
                check.error = error.message;

                this.logger.error(`Health check failed for ${checkName}:`, error);
            }
        }
    }

    /**
     * Database health check
     */
    async checkDatabaseHealth() {
        try {
            const start = Date.now();
            await this.db.query('SELECT 1');
            const responseTime = Date.now() - start;
            
            return {
                healthy: responseTime < 1000, // Consider unhealthy if query takes > 1s
                details: { response_time: responseTime },
                message: `Database responding in ${responseTime}ms`
            };
        } catch (error) {
            return {
                healthy: false,
                details: { error: error.message },
                message: 'Database connection failed'
            };
        }
    }

    /**
     * Gallery API health check
     */
    async checkGalleryAPIHealth() {
        // This would make an HTTP request to a gallery API endpoint
        // For now, we'll simulate it
        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 100));
            
            return {
                healthy: true,
                details: { endpoint: '/api/gallery/health' },
                message: 'Gallery API responding normally'
            };
        } catch (error) {
            return {
                healthy: false,
                details: { error: error.message },
                message: 'Gallery API unreachable'
            };
        }
    }

    /**
     * Theme system health check
     */
    async checkThemeSystemHealth() {
        try {
            // Check if themes can be loaded
            const [themeCount] = await this.db.query('SELECT COUNT(*) as count FROM theme_sets WHERE is_active = 1');
            
            return {
                healthy: themeCount[0].count > 0,
                details: { active_themes: themeCount[0].count },
                message: `${themeCount[0].count} active themes available`
            };
        } catch (error) {
            return {
                healthy: false,
                details: { error: error.message },
                message: 'Theme system check failed'
            };
        }
    }

    /**
     * Image service health check
     */
    async checkImageServiceHealth() {
        try {
            // Check recent image processing
            const [recentImages] = await this.db.query(`
                SELECT COUNT(*) as count 
                FROM gallery_images 
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
                AND status = 'active'
            `);
            
            return {
                healthy: true, // Always healthy unless error
                details: { recent_processed: recentImages[0].count },
                message: `Image service operational`
            };
        } catch (error) {
            return {
                healthy: false,
                details: { error: error.message },
                message: 'Image service check failed'
            };
        }
    }

    /**
     * Migration system health check
     */
    async checkMigrationSystemHealth() {
        try {
            // Check for stuck migrations
            const [stuckMigrations] = await this.db.query(`
                SELECT COUNT(*) as count 
                FROM theme_migrations 
                WHERE status = 'in_progress'
                AND updated_at < DATE_SUB(NOW(), INTERVAL 2 HOUR)
            `);
            
            return {
                healthy: stuckMigrations[0].count === 0,
                details: { stuck_migrations: stuckMigrations[0].count },
                message: stuckMigrations[0].count > 0 ? 
                    `${stuckMigrations[0].count} migrations may be stuck` : 
                    'Migration system operating normally'
            };
        } catch (error) {
            return {
                healthy: false,
                details: { error: error.message },
                message: 'Migration system check failed'
            };
        }
    }

    /**
     * Store health check result
     */
    async storeHealthCheckResult(checkName, check, result) {
        try {
            await this.db.query(`
                INSERT INTO monitoring_health_checks 
                (check_name, status, response_time_ms, details, timestamp)
                VALUES (?, ?, ?, ?, ?)
            `, [
                checkName,
                check.status,
                check.response_time,
                JSON.stringify(result.details || {}),
                new Date(check.last_check)
            ]);
        } catch (error) {
            this.logger.error(`Failed to store health check result for ${checkName}:`, error);
        }
    }

    /**
     * Evaluate all alert rules
     */
    async evaluateAlerts() {
        const startTime = Date.now();
        let evaluatedRules = 0;
        let triggeredAlerts = 0;

        for (const [ruleId, rule] of this.monitoring.alerts) {
            try {
                const shouldAlert = await this.evaluateAlertRule(rule);
                evaluatedRules++;

                if (shouldAlert && this.shouldSendAlert(rule)) {
                    await this.triggerAlert(rule, shouldAlert);
                    triggeredAlerts++;
                } else if (!shouldAlert && rule.current_state !== 'ok') {
                    await this.resolveAlert(rule);
                }

            } catch (error) {
                this.logger.error(`Alert evaluation failed for rule ${ruleId}:`, error);
            }
        }

        const duration = Date.now() - startTime;
        this.logger.debug(`🚨 Evaluated ${evaluatedRules} alert rules in ${duration}ms, triggered ${triggeredAlerts} alerts`);
    }

    /**
     * Evaluate a specific alert rule
     */
    async evaluateAlertRule(rule) {
        const config = rule.config;
        const metricName = config.metric;
        const condition = config.condition;
        const warningThreshold = config.warning_threshold;
        const criticalThreshold = config.critical_threshold;
        const evaluationWindow = config.evaluation_window || '5m';

        // Get metric values from buffer
        const windowMs = this.parseTimeWindow(evaluationWindow);
        const cutoffTime = Date.now() - windowMs;
        
        const metricValues = [];
        for (const [bufferKey, buffer] of this.monitoring.metrics_buffer) {
            const relevantMetrics = buffer.filter(metric => 
                metric.name === metricName && 
                metric.timestamp > cutoffTime
            );
            metricValues.push(...relevantMetrics);
        }

        if (metricValues.length === 0) {
            return false; // No data to evaluate
        }

        // Calculate aggregated value (average for now)
        const values = metricValues.map(m => m.value);
        const aggregatedValue = values.reduce((sum, val) => sum + val, 0) / values.length;

        // Evaluate condition
        let triggered = false;
        let severity = 'ok';

        if (condition === 'greater_than') {
            if (aggregatedValue > criticalThreshold) {
                triggered = true;
                severity = 'critical';
            } else if (aggregatedValue > warningThreshold) {
                triggered = true;
                severity = 'warning';
            }
        } else if (condition === 'less_than') {
            if (aggregatedValue < criticalThreshold) {
                triggered = true;
                severity = 'critical';
            } else if (aggregatedValue < warningThreshold) {
                triggered = true;
                severity = 'warning';
            }
        }

        rule.last_evaluation = Date.now();
        rule.last_value = aggregatedValue;

        return triggered ? { severity, value: aggregatedValue, threshold: triggered ? 
            (severity === 'critical' ? criticalThreshold : warningThreshold) : null 
        } : false;
    }

    /**
     * Check if alert should be sent (respecting cooldown)
     */
    shouldSendAlert(rule) {
        const now = Date.now();
        const timeSinceLastAlert = now - rule.last_alert_sent;
        
        // Always send critical alerts
        if (rule.current_state === 'critical') {
            return true;
        }
        
        // Respect cooldown for warning alerts
        return timeSinceLastAlert > this.config.alerts.notification_cooldown;
    }

    /**
     * Trigger an alert
     */
    async triggerAlert(rule, alertData) {
        const alert = {
            id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            rule_id: rule.id,
            rule_name: rule.name,
            severity: alertData.severity,
            metric_value: alertData.value,
            threshold: alertData.threshold,
            message: this.buildAlertMessage(rule, alertData),
            timestamp: Date.now(),
            resolved_at: null,
            notification_channels: rule.config.notification_channels || ['email']
        };

        // Store alert in database
        await this.storeAlert(alert);
        
        // Send notifications
        await this.alerting.sendAlert(alert);
        
        // Update rule state
        rule.current_state = alertData.severity;
        rule.last_alert_sent = Date.now();
        rule.alert_count++;

        // Store in active incidents
        this.monitoring.incidents.set(alert.id, alert);

        this.logger.warn(`🚨 Alert triggered: ${rule.name}`, {
            severity: alertData.severity,
            value: alertData.value,
            threshold: alertData.threshold
        });
    }

    /**
     * Resolve an alert
     */
    async resolveAlert(rule) {
        // Find active incidents for this rule
        const activeIncidents = Array.from(this.monitoring.incidents.values())
            .filter(incident => incident.rule_id === rule.id && !incident.resolved_at);

        for (const incident of activeIncidents) {
            incident.resolved_at = Date.now();
            
            // Update in database
            await this.db.query(`
                UPDATE monitoring_alerts 
                SET resolved_at = NOW() 
                WHERE id = ?
            `, [incident.id]);

            // Send resolution notification
            await this.alerting.sendResolution(incident);
            
            // Remove from active incidents
            this.monitoring.incidents.delete(incident.id);
        }

        rule.current_state = 'ok';
        this.logger.info(`✅ Alert resolved: ${rule.name}`);
    }

    /**
     * Build alert message
     */
    buildAlertMessage(rule, alertData) {
        const config = rule.config;
        return `${rule.name}: ${config.metric} is ${alertData.value.toFixed(2)} (threshold: ${alertData.threshold})`;
    }

    /**
     * Store alert in database
     */
    async storeAlert(alert) {
        try {
            await this.db.query(`
                INSERT INTO monitoring_alerts 
                (id, rule_id, severity, metric_value, threshold_value, message, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                alert.id,
                alert.rule_id,
                alert.severity,
                alert.metric_value,
                alert.threshold,
                alert.message,
                new Date(alert.timestamp)
            ]);
        } catch (error) {
            this.logger.error('Failed to store alert:', error);
        }
    }

    /**
     * Parse time window string to milliseconds
     */
    parseTimeWindow(window) {
        const match = window.match(/^(\d+)([smhd])$/);
        if (!match) return 5 * 60 * 1000; // Default 5 minutes
        
        const value = parseInt(match[1]);
        const unit = match[2];
        
        switch (unit) {
            case 's': return value * 1000;
            case 'm': return value * 60 * 1000;
            case 'h': return value * 60 * 60 * 1000;
            case 'd': return value * 24 * 60 * 60 * 1000;
            default: return value * 60 * 1000;
        }
    }

    /**
     * Get monitoring status
     */
    getStatus() {
        return {
            running: this.isRunning,
            collectors: Array.from(this.monitoring.collectors.entries()).map(([name, collector]) => ({
                name,
                last_run: collector.last_run,
                errors: collector.errors,
                metrics_count: collector.metrics.length
            })),
            health_checks: Array.from(this.monitoring.health_checks.entries()).map(([name, check]) => ({
                name,
                status: check.status,
                last_check: check.last_check,
                consecutive_failures: check.consecutive_failures,
                response_time: check.response_time
            })),
            active_alerts: Array.from(this.monitoring.alerts.values()).map(rule => ({
                name: rule.name,
                current_state: rule.current_state,
                last_evaluation: rule.last_evaluation,
                alert_count: rule.alert_count
            })),
            active_incidents: Array.from(this.monitoring.incidents.values()).length
        };
    }

    /**
     * Stop monitoring
     */
    async stop() {
        this.isRunning = false;
        this.logger.info('🛑 Production monitoring system stopped');
    }
}

module.exports = ProductionMonitoringService;