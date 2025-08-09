/**
 * System Monitoring Service
 * Part of Phase D.2: Comprehensive system monitoring and alerting
 * Provides real-time system monitoring, metrics collection, and alerting capabilities
 */

const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');

class SystemMonitoringService extends EventEmitter {
    constructor(alertingService = null) {
        super();
        
        this.alertingService = alertingService;
        this.monitoringInterval = 5000; // 5 seconds default
        this.monitoringActive = false;
        this.metricsHistory = new Map();
        this.alertThresholds = {
            cpu: 80,           // CPU usage %
            memory: 85,        // Memory usage %
            disk: 90,          // Disk usage %
            responseTime: 2000, // Response time ms
            errorRate: 5,      // Error rate %
            databaseConnections: 95, // DB connection pool %
            cacheHitRate: 0.7, // Cache hit rate minimum
            queueSize: 1000    // Background job queue size
        };
        
        // Metrics storage
        this.currentMetrics = {};
        this.metricsSummary = {
            uptime: 0,
            totalRequests: 0,
            totalErrors: 0,
            averageResponseTime: 0,
            peakMemoryUsage: 0,
            peakCpuUsage: 0
        };
        
        // Alert state
        this.activeAlerts = new Map();
        this.alertHistory = [];
        
        console.log('📊 SystemMonitoringService initialized');
    }

    /**
     * Start system monitoring
     * @param {Object} options - Monitoring configuration options
     */
    async startMonitoring(options = {}) {
        if (this.monitoringActive) {
            console.log('📊 Monitoring already active');
            return;
        }

        this.monitoringInterval = options.interval || this.monitoringInterval;
        this.alertThresholds = { ...this.alertThresholds, ...(options.thresholds || {}) };
        
        console.log(`📊 Starting system monitoring (interval: ${this.monitoringInterval}ms)`);
        
        this.monitoringActive = true;
        this.startTime = Date.now();
        
        // Start monitoring loop
        this.monitoringTimer = setInterval(async () => {
            await this.collectMetrics();
            await this.checkAlertConditions();
        }, this.monitoringInterval);
        
        // Start periodic summary updates
        this.summaryTimer = setInterval(() => {
            this.updateMetricsSummary();
        }, 60000); // Update summary every minute
        
        this.emit('monitoringStarted', { interval: this.monitoringInterval });
        
        // Collect initial metrics
        await this.collectMetrics();
    }

    /**
     * Stop system monitoring
     */
    stopMonitoring() {
        if (!this.monitoringActive) {
            return;
        }
        
        console.log('📊 Stopping system monitoring');
        
        this.monitoringActive = false;
        
        if (this.monitoringTimer) {
            clearInterval(this.monitoringTimer);
            this.monitoringTimer = null;
        }
        
        if (this.summaryTimer) {
            clearInterval(this.summaryTimer);
            this.summaryTimer = null;
        }
        
        this.emit('monitoringStopped');
    }

    /**
     * Collect system metrics
     */
    async collectMetrics() {
        const timestamp = Date.now();
        
        try {
            // System metrics
            const systemMetrics = await this.collectSystemMetrics();
            
            // Application metrics
            const appMetrics = await this.collectApplicationMetrics();
            
            // Database metrics
            const dbMetrics = await this.collectDatabaseMetrics();
            
            // Cache metrics
            const cacheMetrics = await this.collectCacheMetrics();
            
            // Queue metrics
            const queueMetrics = await this.collectQueueMetrics();
            
            // Combine all metrics
            const metrics = {
                timestamp,
                system: systemMetrics,
                application: appMetrics,
                database: dbMetrics,
                cache: cacheMetrics,
                queue: queueMetrics
            };
            
            // Store current metrics
            this.currentMetrics = metrics;
            
            // Add to history (keep last 1000 entries)
            const historyKey = `${Math.floor(timestamp / 60000) * 60000}`; // Round to minute
            this.metricsHistory.set(historyKey, metrics);
            
            // Cleanup old history
            if (this.metricsHistory.size > 1000) {
                const oldestKey = Array.from(this.metricsHistory.keys())[0];
                this.metricsHistory.delete(oldestKey);
            }
            
            this.emit('metricsCollected', metrics);
            
        } catch (error) {
            console.error('❌ Error collecting metrics:', error.message);
            this.emit('metricsError', error);
        }
    }

    /**
     * Collect system-level metrics
     */
    async collectSystemMetrics() {
        const metrics = {
            uptime: process.uptime(),
            timestamp: Date.now()
        };

        // Memory metrics
        const memUsage = process.memoryUsage();
        metrics.memory = {
            used: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
            total: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
            external: Math.round(memUsage.external / 1024 / 1024), // MB
            usage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100) // %
        };

        // CPU metrics (simplified)
        metrics.cpu = {
            usage: await this.getCPUUsage(),
            loadAverage: process.platform !== 'win32' ? require('os').loadavg() : [0, 0, 0]
        };

        // Disk metrics
        metrics.disk = await this.getDiskUsage();

        // Network metrics (basic)
        metrics.network = await this.getNetworkMetrics();

        return metrics;
    }

    /**
     * Collect application-specific metrics
     */
    async collectApplicationMetrics() {
        const metrics = {
            environment: process.env.NODE_ENV || 'development',
            nodeVersion: process.version,
            pid: process.pid,
            platform: process.platform
        };

        // Request metrics (would integrate with request tracking)
        metrics.requests = {
            total: this.metricsSummary.totalRequests,
            errors: this.metricsSummary.totalErrors,
            errorRate: this.metricsSummary.totalRequests > 0 ? 
                (this.metricsSummary.totalErrors / this.metricsSummary.totalRequests) * 100 : 0,
            averageResponseTime: this.metricsSummary.averageResponseTime
        };

        // Event loop metrics
        metrics.eventLoop = {
            delay: await this.measureEventLoopDelay()
        };

        return metrics;
    }

    /**
     * Collect database metrics
     */
    async collectDatabaseMetrics() {
        const metrics = {
            connected: true, // Would check actual connection
            connectionPool: {
                active: 5,     // Would get from actual pool
                idle: 15,      // Would get from actual pool
                total: 20,     // Would get from actual pool
                usage: 25      // Percentage
            },
            queries: {
                total: 0,      // Would track actual queries
                slow: 0,       // Queries > threshold
                failed: 0      // Failed queries
            },
            performance: {
                averageQueryTime: 0, // Would calculate from query logs
                slowestQuery: 0,     // Longest query time
                connectionsPerSecond: 0
            }
        };

        try {
            // Would integrate with actual database monitoring
            // Example for MySQL/PostgreSQL connection pool monitoring
            
        } catch (error) {
            metrics.error = error.message;
            metrics.connected = false;
        }

        return metrics;
    }

    /**
     * Collect cache metrics
     */
    async collectCacheMetrics() {
        const metrics = {
            type: 'memory', // Would detect Redis vs memory
            connected: true,
            performance: {
                hitRate: 0.75,    // Would calculate from cache service
                missRate: 0.25,   // Would calculate from cache service
                averageGetTime: 5, // ms
                averageSetTime: 3  // ms
            },
            usage: {
                keys: 0,          // Total keys
                memory: 0,        // Memory usage in MB
                maxMemory: 0      // Max memory limit
            }
        };

        try {
            // Would integrate with GalleryCacheService
            // const cacheStats = await this.cacheService.getCacheStatistics();
            
        } catch (error) {
            metrics.error = error.message;
            metrics.connected = false;
        }

        return metrics;
    }

    /**
     * Collect background queue metrics
     */
    async collectQueueMetrics() {
        const metrics = {
            jobs: {
                pending: 0,    // Would get from ImageProcessingQueue
                running: 0,    // Would get from ImageProcessingQueue
                completed: 0,  // Would get from ImageProcessingQueue
                failed: 0      // Would get from ImageProcessingQueue
            },
            performance: {
                averageJobTime: 0,     // Average processing time
                throughput: 0,         // Jobs per minute
                successRate: 100       // Success percentage
            },
            workers: {
                active: 3,             // Active worker processes
                maxConcurrency: 3      // Maximum concurrent jobs
            }
        };

        try {
            // Would integrate with ImageProcessingQueue service
            
        } catch (error) {
            metrics.error = error.message;
        }

        return metrics;
    }

    /**
     * Check alert conditions and trigger alerts
     */
    async checkAlertConditions() {
        if (!this.currentMetrics) return;

        const alerts = [];
        const timestamp = Date.now();

        try {
            // CPU usage alert
            if (this.currentMetrics.system?.cpu?.usage > this.alertThresholds.cpu) {
                alerts.push({
                    type: 'cpu_high',
                    level: 'warning',
                    message: `High CPU usage: ${this.currentMetrics.system.cpu.usage}%`,
                    value: this.currentMetrics.system.cpu.usage,
                    threshold: this.alertThresholds.cpu
                });
            }

            // Memory usage alert
            if (this.currentMetrics.system?.memory?.usage > this.alertThresholds.memory) {
                alerts.push({
                    type: 'memory_high',
                    level: 'warning',
                    message: `High memory usage: ${this.currentMetrics.system.memory.usage}%`,
                    value: this.currentMetrics.system.memory.usage,
                    threshold: this.alertThresholds.memory
                });
            }

            // Disk usage alert
            if (this.currentMetrics.system?.disk?.usage > this.alertThresholds.disk) {
                alerts.push({
                    type: 'disk_high',
                    level: 'critical',
                    message: `High disk usage: ${this.currentMetrics.system.disk.usage}%`,
                    value: this.currentMetrics.system.disk.usage,
                    threshold: this.alertThresholds.disk
                });
            }

            // Error rate alert
            if (this.currentMetrics.application?.requests?.errorRate > this.alertThresholds.errorRate) {
                alerts.push({
                    type: 'error_rate_high',
                    level: 'warning',
                    message: `High error rate: ${this.currentMetrics.application.requests.errorRate.toFixed(2)}%`,
                    value: this.currentMetrics.application.requests.errorRate,
                    threshold: this.alertThresholds.errorRate
                });
            }

            // Response time alert
            if (this.currentMetrics.application?.requests?.averageResponseTime > this.alertThresholds.responseTime) {
                alerts.push({
                    type: 'response_time_high',
                    level: 'warning',
                    message: `Slow response time: ${this.currentMetrics.application.requests.averageResponseTime}ms`,
                    value: this.currentMetrics.application.requests.averageResponseTime,
                    threshold: this.alertThresholds.responseTime
                });
            }

            // Database connection pool alert
            if (this.currentMetrics.database?.connectionPool?.usage > this.alertThresholds.databaseConnections) {
                alerts.push({
                    type: 'db_connections_high',
                    level: 'critical',
                    message: `High database connection usage: ${this.currentMetrics.database.connectionPool.usage}%`,
                    value: this.currentMetrics.database.connectionPool.usage,
                    threshold: this.alertThresholds.databaseConnections
                });
            }

            // Cache hit rate alert
            if (this.currentMetrics.cache?.performance?.hitRate < this.alertThresholds.cacheHitRate) {
                alerts.push({
                    type: 'cache_hit_rate_low',
                    level: 'warning',
                    message: `Low cache hit rate: ${(this.currentMetrics.cache.performance.hitRate * 100).toFixed(1)}%`,
                    value: this.currentMetrics.cache.performance.hitRate,
                    threshold: this.alertThresholds.cacheHitRate
                });
            }

            // Queue size alert
            const queueSize = (this.currentMetrics.queue?.jobs?.pending || 0) + (this.currentMetrics.queue?.jobs?.running || 0);
            if (queueSize > this.alertThresholds.queueSize) {
                alerts.push({
                    type: 'queue_size_high',
                    level: 'warning',
                    message: `High queue size: ${queueSize} jobs`,
                    value: queueSize,
                    threshold: this.alertThresholds.queueSize
                });
            }

            // Process alerts
            for (const alert of alerts) {
                await this.processAlert({
                    ...alert,
                    id: `${alert.type}_${timestamp}`,
                    timestamp,
                    acknowledged: false
                });
            }

            // Check for resolved alerts
            await this.checkResolvedAlerts();

        } catch (error) {
            console.error('❌ Error checking alert conditions:', error.message);
        }
    }

    /**
     * Process an individual alert
     */
    async processAlert(alert) {
        const existingAlert = this.activeAlerts.get(alert.type);
        
        if (existingAlert) {
            // Update existing alert
            existingAlert.count = (existingAlert.count || 1) + 1;
            existingAlert.lastSeen = alert.timestamp;
            existingAlert.value = alert.value;
        } else {
            // New alert
            alert.count = 1;
            alert.firstSeen = alert.timestamp;
            alert.lastSeen = alert.timestamp;
            
            this.activeAlerts.set(alert.type, alert);
            this.alertHistory.push({...alert});
            
            console.warn(`🚨 ALERT [${alert.level.toUpperCase()}]: ${alert.message}`);
            
            // Send to alerting service if available
            if (this.alertingService) {
                await this.alertingService.sendAlert(alert);
            }
            
            this.emit('alertTriggered', alert);
        }
    }

    /**
     * Check for resolved alerts
     */
    async checkResolvedAlerts() {
        const resolvedAlerts = [];
        
        for (const [alertType, alert] of this.activeAlerts.entries()) {
            let resolved = false;
            
            switch (alertType) {
                case 'cpu_high':
                    resolved = (this.currentMetrics.system?.cpu?.usage || 0) <= this.alertThresholds.cpu;
                    break;
                case 'memory_high':
                    resolved = (this.currentMetrics.system?.memory?.usage || 0) <= this.alertThresholds.memory;
                    break;
                case 'disk_high':
                    resolved = (this.currentMetrics.system?.disk?.usage || 0) <= this.alertThresholds.disk;
                    break;
                case 'error_rate_high':
                    resolved = (this.currentMetrics.application?.requests?.errorRate || 0) <= this.alertThresholds.errorRate;
                    break;
                case 'response_time_high':
                    resolved = (this.currentMetrics.application?.requests?.averageResponseTime || 0) <= this.alertThresholds.responseTime;
                    break;
                case 'db_connections_high':
                    resolved = (this.currentMetrics.database?.connectionPool?.usage || 0) <= this.alertThresholds.databaseConnections;
                    break;
                case 'cache_hit_rate_low':
                    resolved = (this.currentMetrics.cache?.performance?.hitRate || 1) >= this.alertThresholds.cacheHitRate;
                    break;
                case 'queue_size_high':
                    const queueSize = (this.currentMetrics.queue?.jobs?.pending || 0) + (this.currentMetrics.queue?.jobs?.running || 0);
                    resolved = queueSize <= this.alertThresholds.queueSize;
                    break;
            }
            
            if (resolved) {
                alert.resolvedAt = Date.now();
                alert.duration = alert.resolvedAt - alert.firstSeen;
                
                resolvedAlerts.push(alert);
                this.activeAlerts.delete(alertType);
                
                console.log(`✅ Alert resolved: ${alert.message} (duration: ${Math.round(alert.duration / 1000)}s)`);
                
                if (this.alertingService) {
                    await this.alertingService.sendResolutionNotification(alert);
                }
                
                this.emit('alertResolved', alert);
            }
        }
        
        return resolvedAlerts;
    }

    /**
     * Update metrics summary
     */
    updateMetricsSummary() {
        if (!this.currentMetrics) return;
        
        this.metricsSummary.uptime = process.uptime();
        
        // Update peak values
        if (this.currentMetrics.system?.memory?.usage) {
            this.metricsSummary.peakMemoryUsage = Math.max(
                this.metricsSummary.peakMemoryUsage,
                this.currentMetrics.system.memory.usage
            );
        }
        
        if (this.currentMetrics.system?.cpu?.usage) {
            this.metricsSummary.peakCpuUsage = Math.max(
                this.metricsSummary.peakCpuUsage,
                this.currentMetrics.system.cpu.usage
            );
        }
        
        this.emit('summaryUpdated', this.metricsSummary);
    }

    // Utility methods for metrics collection

    async getCPUUsage() {
        // Simplified CPU usage calculation
        // In production, would use more sophisticated monitoring
        return Math.floor(Math.random() * 30) + 10; // Simulated 10-40%
    }

    async getDiskUsage() {
        // Simplified disk usage
        // In production, would check actual disk usage
        return {
            used: 25000,  // MB
            total: 100000, // MB
            usage: 25     // %
        };
    }

    async getNetworkMetrics() {
        // Simplified network metrics
        return {
            bytesIn: 0,   // Would track actual network I/O
            bytesOut: 0,
            connectionsActive: 0,
            connectionsTotal: 0
        };
    }

    async measureEventLoopDelay() {
        return new Promise((resolve) => {
            const start = process.hrtime.bigint();
            setImmediate(() => {
                const delta = process.hrtime.bigint() - start;
                resolve(Number(delta / 1000000n)); // Convert to ms
            });
        });
    }

    // API methods

    getCurrentMetrics() {
        return this.currentMetrics;
    }

    getMetricsHistory(timeRange = 3600000) { // 1 hour default
        const cutoffTime = Date.now() - timeRange;
        const history = {};
        
        for (const [timestamp, metrics] of this.metricsHistory.entries()) {
            if (parseInt(timestamp) >= cutoffTime) {
                history[timestamp] = metrics;
            }
        }
        
        return history;
    }

    getActiveAlerts() {
        return Array.from(this.activeAlerts.values());
    }

    getAlertHistory(limit = 100) {
        return this.alertHistory
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit);
    }

    getMetricsSummary() {
        return {
            ...this.metricsSummary,
            monitoringActive: this.monitoringActive,
            monitoringUptime: this.startTime ? Date.now() - this.startTime : 0,
            activeAlertsCount: this.activeAlerts.size,
            totalAlertsTriggered: this.alertHistory.length
        };
    }

    acknowledgeAlert(alertType) {
        const alert = this.activeAlerts.get(alertType);
        if (alert) {
            alert.acknowledged = true;
            alert.acknowledgedAt = Date.now();
            console.log(`📋 Alert acknowledged: ${alert.message}`);
            this.emit('alertAcknowledged', alert);
            return true;
        }
        return false;
    }

    updateAlertThresholds(newThresholds) {
        this.alertThresholds = { ...this.alertThresholds, ...newThresholds };
        console.log('📊 Alert thresholds updated:', newThresholds);
        this.emit('thresholdsUpdated', this.alertThresholds);
    }

    isMonitoring() {
        return this.monitoringActive;
    }
}

module.exports = SystemMonitoringService;