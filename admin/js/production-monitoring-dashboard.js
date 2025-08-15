/**
 * Production Monitoring Dashboard Controller
 * 
 * Manages real-time monitoring interface, performance metrics visualization,
 * and alert management functionality.
 */

class ProductionMonitoringDashboard {
    constructor() {
        this.dashboardData = null;
        this.refreshInterval = null;
        this.charts = {};
        this.autoRefreshEnabled = true;
        this.refreshIntervalMs = 30000; // 30 seconds
        
        this.init();
    }

    async init() {
        console.log('📊 Initializing Production Monitoring Dashboard...');
        
        try {
            await this.loadDashboardData();
            this.setupEventListeners();
            this.initializeCharts();
            this.startAutoRefresh();
            
            console.log('✅ Production Monitoring Dashboard initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize dashboard:', error);
            this.showError('Failed to initialize monitoring dashboard');
        }
    }

    async loadDashboardData() {
        try {
            const response = await fetch('/api/production-monitoring/dashboard');
            if (!response.ok) throw new Error('Failed to load dashboard data');
            
            const result = await response.json();
            this.dashboardData = result.data;
            
            this.updateSystemHealth();
            this.updateActiveAlerts();
            this.updateHealthChecks();
            this.updateSystemUptime();
            this.updateCharts();
            
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            this.showLoadingError();
        }
    }

    updateSystemHealth() {
        const systemHealth = this.dashboardData.systemHealth || [];
        
        let healthyCount = 0;
        let degradedCount = 0;
        let unhealthyCount = 0;
        let totalResponseTime = 0;
        let totalChecks = 0;

        systemHealth.forEach(health => {
            healthyCount += health.healthy_checks || 0;
            degradedCount += health.degraded_checks || 0;
            unhealthyCount += health.unhealthy_checks || 0;
            totalResponseTime += (health.avg_response_time || 0) * (health.total_checks || 0);
            totalChecks += health.total_checks || 0;
        });

        document.getElementById('healthyServicesCount').textContent = healthyCount;
        document.getElementById('degradedServicesCount').textContent = degradedCount;
        document.getElementById('unhealthyServicesCount').textContent = unhealthyCount;
        
        const avgResponseTime = totalChecks > 0 ? Math.round(totalResponseTime / totalChecks) : 0;
        document.getElementById('avgResponseTimeDisplay').textContent = `${avgResponseTime}ms`;
    }

    updateActiveAlerts() {
        const activeAlerts = this.dashboardData.activeAlerts || [];
        const container = document.getElementById('activeAlertsContainer');

        if (activeAlerts.length === 0) {
            container.innerHTML = `
                <div class="text-center text-success py-4">
                    <i class="bi bi-check-circle fs-1 mb-2"></i>
                    <div>No active alerts</div>
                    <small class="text-muted">All systems operating normally</small>
                </div>
            `;
            return;
        }

        const html = activeAlerts.map(alert => {
            const severityClass = `alert-severity-${alert.severity}`;
            const timeActive = this.formatDuration(alert.minutes_active * 60 * 1000);
            
            return `
                <div class="alert-item ${severityClass}">
                    <div class="d-flex justify-content-between align-items-start">
                        <div class="flex-grow-1">
                            <div class="fw-medium mb-1">${alert.title}</div>
                            <div class="alert-meta mb-2">
                                <span class="badge bg-${this.getSeverityColor(alert.severity)} me-2">
                                    ${alert.severity.toUpperCase()}
                                </span>
                                <span class="me-2">
                                    <i class="bi bi-building"></i> ${alert.source}
                                </span>
                                <span class="me-2">
                                    <i class="bi bi-clock"></i> Active for ${timeActive}
                                </span>
                                <span>
                                    <i class="bi bi-send"></i> ${alert.successful_deliveries}/${alert.delivery_attempts} delivered
                                </span>
                            </div>
                            <div class="text-muted">${alert.description}</div>
                        </div>
                        <div class="ms-3">
                            <button class="btn btn-sm btn-success" 
                                    onclick="monitoringDashboard.showResolveAlertModal('${alert.alert_id}', '${alert.title}', '${alert.description}')">
                                <i class="bi bi-check-circle"></i> Resolve
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
    }

    updateHealthChecks() {
        const systemHealth = this.dashboardData.systemHealth || [];
        const tbody = document.getElementById('healthCheckTableBody');

        if (systemHealth.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-muted py-3">No health check data available</td>
                </tr>
            `;
            return;
        }

        const html = systemHealth.map(health => {
            const overallStatus = health.unhealthy_checks > 0 ? 'unhealthy' : 
                                health.degraded_checks > 0 ? 'degraded' : 'healthy';
            
            return `
                <tr>
                    <td>
                        <div class="fw-medium">${health.check_category}</div>
                        <small class="text-muted">${health.total_checks} checks</small>
                    </td>
                    <td>
                        <span class="health-status-${overallStatus}">
                            ${overallStatus}
                        </span>
                    </td>
                    <td>${Math.round(health.avg_response_time || 0)}ms</td>
                    <td>
                        <small>${this.formatTimeAgo(health.last_check_time)}</small>
                    </td>
                    <td>
                        <small class="text-muted">
                            ${health.unhealthy_checks > 0 ? 
                                `${health.unhealthy_checks} unhealthy` : 
                                health.degraded_checks > 0 ? 
                                `${health.degraded_checks} degraded` : 
                                'All checks passing'
                            }
                        </small>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary" 
                                onclick="monitoringDashboard.showHealthCheckDetails('${health.check_category}')">
                            <i class="bi bi-info-circle"></i> Details
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        tbody.innerHTML = html;
    }

    updateSystemUptime() {
        const uptimeData = this.dashboardData.systemUptime || [];
        const container = document.getElementById('systemUptimeList');
        const overallUptime = uptimeData.length > 0 ? 
            uptimeData.reduce((sum, item) => sum + item.uptime_seconds, 0) / uptimeData.length : 0;

        // Update overall uptime display
        document.getElementById('systemUptimeDisplay').textContent = this.formatDuration(overallUptime * 1000);

        if (uptimeData.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted py-3">No uptime data available</div>
            `;
            return;
        }

        const html = uptimeData.map(item => {
            const uptimePercent = this.calculateUptimePercent(item.uptime_seconds);
            const badgeClass = uptimePercent >= 99.9 ? 'uptime-excellent' :
                              uptimePercent >= 99.0 ? 'uptime-good' : 'uptime-warning';
            
            return `
                <div class="uptime-item">
                    <div class="flex-grow-1">
                        <div class="fw-medium">${item.component_name.replace(/_/g, ' ').toUpperCase()}</div>
                        <small class="text-muted">${this.formatDuration(item.uptime_seconds * 1000)}</small>
                    </div>
                    <span class="uptime-badge ${badgeClass}">
                        ${uptimePercent.toFixed(1)}%
                    </span>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
    }

    initializeCharts() {
        // System Performance Chart
        this.charts.systemPerformance = new Chart(
            document.getElementById('systemPerformanceChart'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'CPU Usage (%)',
                        data: [],
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        tension: 0.4
                    },
                    {
                        label: 'Memory Usage (%)',
                        data: [],
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        tension: 0.4
                    }
                ]
            },
            options: this.getChartOptions('System Performance')
        });

        // Database Performance Chart
        this.charts.databasePerformance = new Chart(
            document.getElementById('databasePerformanceChart'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Query Time (ms)',
                        data: [],
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        tension: 0.4,
                        yAxisID: 'y1'
                    },
                    {
                        label: 'Connection Pool (%)',
                        data: [],
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        tension: 0.4
                    }
                ]
            },
            options: this.getChartOptions('Database Performance', true)
        });

        // Gallery Performance Chart
        this.charts.galleryPerformance = new Chart(
            document.getElementById('galleryPerformanceChart'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Page Load Time (ms)',
                        data: [],
                        borderColor: '#8b5cf6',
                        backgroundColor: 'rgba(139, 92, 246, 0.1)',
                        tension: 0.4
                    },
                    {
                        label: 'Cache Hit Rate (%)',
                        data: [],
                        borderColor: '#06b6d4',
                        backgroundColor: 'rgba(6, 182, 212, 0.1)',
                        tension: 0.4
                    }
                ]
            },
            options: this.getChartOptions('Gallery Performance')
        });

        // User Experience Chart
        this.charts.userExperience = new Chart(
            document.getElementById('userExperienceChart'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'LCP (ms)',
                        data: [],
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        tension: 0.4
                    },
                    {
                        label: 'FID (ms)',
                        data: [],
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        tension: 0.4
                    }
                ]
            },
            options: this.getChartOptions('Core Web Vitals')
        });

        // Alert Statistics Chart
        this.charts.alertStatistics = new Chart(
            document.getElementById('alertStatisticsChart'), {
            type: 'bar',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Critical',
                        data: [],
                        backgroundColor: '#dc3545'
                    },
                    {
                        label: 'High',
                        data: [],
                        backgroundColor: '#fd7e14'
                    },
                    {
                        label: 'Medium',
                        data: [],
                        backgroundColor: '#ffc107'
                    },
                    {
                        label: 'Low',
                        data: [],
                        backgroundColor: '#6c757d'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { stacked: true },
                    y: { stacked: true }
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Alert Statistics by Day'
                    }
                }
            }
        });
    }

    updateCharts() {
        const metricsTrends = this.dashboardData.metricsTrends || [];
        const alertStats = this.dashboardData.alertStatistics || [];

        // Process metrics trends for charts
        this.updateMetricsCharts(metricsTrends);
        this.updateAlertStatisticsChart(alertStats);
    }

    updateMetricsCharts(trends) {
        // Group trends by category and metric
        const trendsByCategory = {};
        
        trends.forEach(trend => {
            if (!trendsByCategory[trend.metric_category]) {
                trendsByCategory[trend.metric_category] = {};
            }
            if (!trendsByCategory[trend.metric_category][trend.metric_name]) {
                trendsByCategory[trend.metric_category][trend.metric_name] = [];
            }
            trendsByCategory[trend.metric_category][trend.metric_name].push(trend);
        });

        // Update system performance chart
        this.updateCategoryChart('systemPerformance', trendsByCategory.system, 
            ['cpu_usage_percent', 'memory_usage_percent']);

        // Update database performance chart
        this.updateCategoryChart('databasePerformance', trendsByCategory.database,
            ['avg_query_time_ms', 'connection_pool_usage_percent']);

        // Update gallery performance chart
        this.updateCategoryChart('galleryPerformance', trendsByCategory.gallery,
            ['page_load_time_ms', 'cache_hit_rate_percent']);

        // Update user experience chart
        this.updateCategoryChart('userExperience', trendsByCategory.user_experience,
            ['lcp_ms', 'fid_ms']);
    }

    updateCategoryChart(chartName, categoryData, metricNames) {
        const chart = this.charts[chartName];
        if (!chart || !categoryData) return;

        // Get labels from the first metric
        const firstMetric = categoryData[metricNames[0]] || [];
        const labels = firstMetric.slice(-12).map(trend => 
            `${String(trend.metric_hour).padStart(2, '0')}:00`
        );

        chart.data.labels = labels;

        // Update each dataset
        metricNames.forEach((metricName, index) => {
            const metricData = categoryData[metricName] || [];
            chart.data.datasets[index].data = metricData.slice(-12).map(trend => trend.avg_value);
        });

        chart.update('none');
    }

    updateAlertStatisticsChart(alertStats) {
        const chart = this.charts.alertStatistics;
        if (!chart) return;

        // Process last 7 days of alert statistics
        const last7Days = alertStats.slice(-7);
        const labels = last7Days.map(stat => new Date(stat.alert_date).toLocaleDateString());
        
        const severities = ['critical', 'high', 'medium', 'low'];
        severities.forEach((severity, index) => {
            chart.data.datasets[index].data = last7Days.map(stat => {
                const severityStats = alertStats.filter(s => 
                    s.alert_date === stat.alert_date && s.severity === severity
                );
                return severityStats.reduce((sum, s) => sum + s.alert_count, 0);
            });
        });

        chart.data.labels = labels;
        chart.update('none');
    }

    setupEventListeners() {
        // Test Alert button
        document.getElementById('testAlertBtn')?.addEventListener('click', () => {
            this.sendTestAlert();
        });

        // Refresh Dashboard button
        document.getElementById('refreshDashboardBtn')?.addEventListener('click', () => {
            this.loadDashboardData();
        });

        // Alert resolution form
        document.getElementById('confirmResolveAlertBtn')?.addEventListener('click', () => {
            this.resolveAlert();
        });

        // Alert filters
        document.getElementById('alertSeverityFilter')?.addEventListener('change', (e) => {
            this.filterAlerts();
        });

        document.getElementById('alertSourceFilter')?.addEventListener('change', (e) => {
            this.filterAlerts();
        });
    }

    async sendTestAlert() {
        try {
            const response = await fetch('/api/production-monitoring/test-alert', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const result = await response.json();
            if (result.success) {
                this.showSuccess('Test alert sent successfully!');
            } else {
                throw new Error(result.message);
            }

        } catch (error) {
            console.error('Error sending test alert:', error);
            this.showError('Failed to send test alert: ' + error.message);
        }
    }

    showResolveAlertModal(alertId, title, description) {
        document.getElementById('resolveAlertId').value = alertId;
        document.getElementById('alertDetailsDisplay').innerHTML = `
            <div class="fw-medium mb-1">${title}</div>
            <div class="text-muted">${description}</div>
            <div class="mt-2">
                <small><strong>Alert ID:</strong> ${alertId}</small>
            </div>
        `;

        const modal = new bootstrap.Modal(document.getElementById('resolveAlertModal'));
        modal.show();
    }

    async resolveAlert() {
        try {
            const form = document.getElementById('resolveAlertForm');
            const formData = new FormData(form);
            const alertId = formData.get('alertId');
            const resolutionNotes = formData.get('resolutionNotes');

            const response = await fetch(`/api/production-monitoring/alerts/${alertId}/resolve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resolution_notes: resolutionNotes })
            });

            const result = await response.json();
            if (result.success) {
                bootstrap.Modal.getInstance(document.getElementById('resolveAlertModal')).hide();
                form.reset();
                this.showSuccess('Alert marked as resolved');
                
                // Refresh alerts
                setTimeout(() => this.loadDashboardData(), 1000);
            } else {
                throw new Error(result.message);
            }

        } catch (error) {
            console.error('Error resolving alert:', error);
            this.showError('Failed to resolve alert: ' + error.message);
        }
    }

    getChartOptions(title, dualAxis = false) {
        const options = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: title
                },
                legend: {
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            },
            interaction: {
                intersect: false
            }
        };

        if (dualAxis) {
            options.scales.y1 = {
                type: 'linear',
                display: true,
                position: 'right',
                grid: {
                    drawOnChartArea: false
                }
            };
        }

        return options;
    }

    startAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }

        this.refreshInterval = setInterval(() => {
            if (this.autoRefreshEnabled) {
                this.loadDashboardData();
            }
        }, this.refreshIntervalMs);

        console.log(`🔄 Auto-refresh started (${this.refreshIntervalMs/1000}s interval)`);
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    // Utility methods
    getSeverityColor(severity) {
        const colors = {
            'critical': 'danger',
            'high': 'warning',
            'medium': 'warning',
            'low': 'secondary'
        };
        return colors[severity] || 'secondary';
    }

    calculateUptimePercent(uptimeSeconds) {
        // Assume total possible uptime is 7 days = 604800 seconds
        const totalPossibleUptime = 7 * 24 * 60 * 60;
        return Math.min(100, (uptimeSeconds / totalPossibleUptime) * 100);
    }

    formatDuration(milliseconds) {
        if (!milliseconds || milliseconds < 0) return '0s';
        
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) return `${days}d ${hours % 24}h`;
        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    }

    formatTimeAgo(timestamp) {
        const now = Date.now();
        const time = new Date(timestamp).getTime();
        const diff = now - time;
        
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return `${Math.floor(diff / 86400000)}d ago`;
    }

    showSuccess(message) {
        console.log('✅ Success:', message);
        // In a full implementation, would show toast notification
        alert(message);
    }

    showError(message) {
        console.error('❌ Error:', message);
        // In a full implementation, would show toast notification
        alert('Error: ' + message);
    }

    showLoadingError() {
        const containers = [
            'activeAlertsContainer',
            'healthCheckTableBody', 
            'systemUptimeList'
        ];

        containers.forEach(containerId => {
            const container = document.getElementById(containerId);
            if (container) {
                container.innerHTML = `
                    <div class="text-center text-danger py-3">
                        <i class="bi bi-exclamation-triangle"></i>
                        Failed to load data
                    </div>
                `;
            }
        });
    }

    // Cleanup
    destroy() {
        this.stopAutoRefresh();
        Object.values(this.charts).forEach(chart => {
            if (chart) chart.destroy();
        });
        this.charts = {};
    }
}

// Initialize dashboard when DOM is loaded
let monitoringDashboard;
document.addEventListener('DOMContentLoaded', () => {
    monitoringDashboard = new ProductionMonitoringDashboard();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (monitoringDashboard) {
        monitoringDashboard.destroy();
    }
});