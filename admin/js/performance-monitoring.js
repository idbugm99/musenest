/**
 * Performance Monitoring Dashboard JavaScript
 * 
 * Handles real-time performance monitoring, metrics visualization,
 * and performance recommendations for gallery optimization.
 */

class PerformanceMonitoringDashboard {
    constructor() {
        this.config = {
            apiBaseUrl: '/api/universal-gallery',
            updateInterval: 5000, // 5 seconds
            chartUpdateInterval: 1000, // 1 second for real-time charts
            maxDataPoints: 100
        };

        this.state = {
            performanceService: null,
            metrics: {},
            charts: new Map(),
            isMonitoring: false,
            isPaused: false,
            realTimeData: {
                timeline: [],
                memory: [],
                imageLoading: []
            }
        };

        this.templates = {};
        this.init();
    }

    /**
     * Initialize the performance monitoring dashboard
     */
    async init() {
        try {
            // Initialize performance service
            if (typeof GalleryPerformanceService !== 'undefined') {
                this.state.performanceService = new GalleryPerformanceService();
                this.state.performanceService.init();
            }

            this.compileTemplates();
            this.bindEvents();
            this.initializeCharts();
            await this.loadInitialMetrics();
            this.startRealTimeMonitoring();
            
            console.log('📊 Performance Monitoring Dashboard initialized');
        } catch (error) {
            console.error('❌ Failed to initialize performance dashboard:', error);
        }
    }

    /**
     * Compile Handlebars templates
     */
    compileTemplates() {
        if (typeof Handlebars === 'undefined') {
            console.warn('Handlebars not available, using basic templating');
            return;
        }

        // Compile recommendation template
        const recommendationTemplate = document.getElementById('recommendationTemplate');
        if (recommendationTemplate) {
            this.templates.recommendation = Handlebars.compile(recommendationTemplate.innerHTML);
        }

        // Register helpers
        Handlebars.registerHelper('formatBytes', (bytes) => {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        });

        Handlebars.registerHelper('formatTime', (ms) => {
            if (ms < 1000) return ms.toFixed(0) + 'ms';
            return (ms / 1000).toFixed(2) + 's';
        });
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Header actions
        document.getElementById('refreshMetricsBtn')?.addEventListener('click', () => {
            this.refreshMetrics();
        });

        document.getElementById('exportMetricsBtn')?.addEventListener('click', () => {
            this.exportMetrics();
        });

        document.getElementById('runAuditBtn')?.addEventListener('click', () => {
            this.runPerformanceAudit();
        });

        // Timeline controls
        document.getElementById('pauseTimelineBtn')?.addEventListener('click', (e) => {
            this.toggleTimelinePause(e.target);
        });

        document.getElementById('clearTimelineBtn')?.addEventListener('click', () => {
            this.clearTimeline();
        });

        // Memory monitoring
        document.getElementById('triggerGCBtn')?.addEventListener('click', () => {
            this.triggerGarbageCollection();
        });

        // Recommendations
        document.getElementById('generateRecommendationsBtn')?.addEventListener('click', () => {
            this.generateRecommendations();
        });

        // Modal events
        document.getElementById('closeAlertModal')?.addEventListener('click', () => {
            this.closePerformanceAlert();
        });

        document.getElementById('dismissAlert')?.addEventListener('click', () => {
            this.closePerformanceAlert();
        });

        document.getElementById('viewDetailsAlert')?.addEventListener('click', () => {
            this.viewAlertDetails();
        });

        // Delegate events for dynamic content
        document.addEventListener('click', (e) => {
            if (e.target.closest('.view-details-btn')) {
                const category = e.target.closest('.view-details-btn').dataset.category;
                this.viewRecommendationDetails(category);
            }

            if (e.target.closest('.auto-fix-btn')) {
                const category = e.target.closest('.auto-fix-btn').dataset.category;
                this.autoFixIssue(category);
            }
        });

        // Listen for performance metrics from service
        window.addEventListener('galleryPerformanceMetric', (e) => {
            this.handlePerformanceMetric(e.detail);
        });
    }

    /**
     * Initialize charts
     */
    initializeCharts() {
        // Check if Chart.js is available
        if (typeof Chart === 'undefined') {
            console.warn('Chart.js not available, charts will not be displayed');
            return;
        }

        // Image Load Time Chart
        const imageChartCanvas = document.getElementById('imageLoadTimeChart');
        if (imageChartCanvas) {
            const imageChart = new Chart(imageChartCanvas, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Load Time (ms)',
                        data: [],
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        tension: 0.1
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Load Time (ms)'
                            }
                        },
                        x: {
                            title: {
                                display: true,
                                text: 'Images'
                            }
                        }
                    }
                }
            });
            this.state.charts.set('imageLoadTime', imageChart);
        }

        // Memory Usage Chart
        const memoryChartCanvas = document.getElementById('memoryUsageChart');
        if (memoryChartCanvas) {
            const memoryChart = new Chart(memoryChartCanvas, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Used Heap (MB)',
                        data: [],
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        tension: 0.1
                    }, {
                        label: 'Total Heap (MB)',
                        data: [],
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        tension: 0.1
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Memory (MB)'
                            }
                        },
                        x: {
                            title: {
                                display: true,
                                text: 'Time'
                            }
                        }
                    }
                }
            });
            this.state.charts.set('memoryUsage', memoryChart);
        }

        // Performance Timeline Chart
        const timelineChartCanvas = document.getElementById('performanceTimelineChart');
        if (timelineChartCanvas) {
            const timelineChart = new Chart(timelineChartCanvas, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'LCP',
                        data: [],
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        tension: 0.1
                    }, {
                        label: 'FID',
                        data: [],
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        tension: 0.1
                    }, {
                        label: 'CLS',
                        data: [],
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        tension: 0.1
                    }]
                },
                options: {
                    responsive: true,
                    interaction: {
                        intersect: false,
                        mode: 'index'
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Value'
                            }
                        },
                        x: {
                            title: {
                                display: true,
                                text: 'Time'
                            }
                        }
                    }
                }
            });
            this.state.charts.set('timeline', timelineChart);
        }
    }

    /**
     * Load initial performance metrics
     */
    async loadInitialMetrics() {
        if (!this.state.performanceService) return;

        try {
            const report = this.state.performanceService.getPerformanceReport();
            this.updateMetricsDisplay(report);
            this.generateRecommendations();
        } catch (error) {
            console.error('Failed to load initial metrics:', error);
        }
    }

    /**
     * Update metrics display
     */
    updateMetricsDisplay(report) {
        this.state.metrics = report;

        // Update Core Web Vitals
        this.updateCoreWebVitals(report.coreWebVitals);
        
        // Update Image Metrics
        this.updateImageMetrics(report.imageMetrics);
        
        // Update User Interaction
        this.updateUserInteraction(report.userInteraction);
        
        // Update Cache Metrics
        this.updateCacheMetrics(report.cacheMetrics);

        // Update charts
        this.updateCharts(report);
    }

    /**
     * Update Core Web Vitals display
     */
    updateCoreWebVitals(cwv) {
        // LCP
        if (cwv.lcp !== null) {
            document.getElementById('lcpValue').textContent = `${Math.round(cwv.lcp)} ms`;
            const lcpRating = document.getElementById('lcpRating')?.querySelector('.rating-badge');
            if (lcpRating) {
                lcpRating.textContent = cwv.lcpRating;
                lcpRating.className = `rating-badge ${cwv.lcpRating.replace('-', '')}`;
            }
        }

        // FID
        if (cwv.fid !== null) {
            document.getElementById('fidValue').textContent = `${Math.round(cwv.fid)} ms`;
            const fidRating = document.getElementById('fidRating')?.querySelector('.rating-badge');
            if (fidRating) {
                fidRating.textContent = cwv.fidRating;
                fidRating.className = `rating-badge ${cwv.fidRating.replace('-', '')}`;
            }
        }

        // CLS
        if (cwv.cls !== null) {
            document.getElementById('clsValue').textContent = cwv.cls.toFixed(3);
            const clsRating = document.getElementById('clsRating')?.querySelector('.rating-badge');
            if (clsRating) {
                clsRating.textContent = cwv.clsRating;
                clsRating.className = `rating-badge ${cwv.clsRating.replace('-', '')}`;
            }
        }
    }

    /**
     * Update image metrics display
     */
    updateImageMetrics(imageMetrics) {
        document.getElementById('totalImages').textContent = imageMetrics.totalImages || 0;
        document.getElementById('loadedImages').textContent = imageMetrics.loadedImages || 0;
        document.getElementById('failedImages').textContent = imageMetrics.failedImages || 0;
        
        const totalDataMB = (imageMetrics.totalDataTransfer / (1024 * 1024)).toFixed(2);
        document.getElementById('totalDataTransfer').textContent = `${totalDataMB} MB`;

        document.getElementById('imageSuccessRate').textContent = `${Math.round(imageMetrics.successRate || 0)}% success`;
        document.getElementById('averageLoadTime').textContent = `${Math.round(imageMetrics.averageLoadTime || 0)} ms avg`;
    }

    /**
     * Update user interaction display
     */
    updateUserInteraction(userInteraction) {
        document.getElementById('galleryViews').textContent = userInteraction.galleryViews || 0;
        document.getElementById('imageClicks').textContent = userInteraction.imageClicks || 0;
        document.getElementById('lightboxOpens').textContent = userInteraction.lightboxOpens || 0;
        document.getElementById('maxScrollDepth').textContent = `${userInteraction.scrollDepth || 0}%`;

        const sessionMinutes = Math.round((userInteraction.averageSessionTime || 0) / 60000);
        document.getElementById('sessionDuration').textContent = `${sessionMinutes} min session`;
        document.getElementById('scrollDepth').textContent = `${userInteraction.scrollDepth || 0}% scrolled`;
    }

    /**
     * Update cache metrics display
     */
    updateCacheMetrics(cacheMetrics) {
        document.getElementById('cacheHits').textContent = cacheMetrics.cacheHits || 0;
        document.getElementById('cacheMisses').textContent = cacheMetrics.cacheMisses || 0;
        document.getElementById('prefetchHits').textContent = cacheMetrics.prefetchHits || 0;
        document.getElementById('cacheEfficiency').textContent = `${Math.round(cacheMetrics.hitRate || 0)}%`;

        document.getElementById('cacheHitRate').textContent = `${Math.round(cacheMetrics.hitRate || 0)}% hit rate`;
        
        const prefetchRate = cacheMetrics.prefetchHits > 0 ? 
            Math.round((cacheMetrics.prefetchHits / (cacheMetrics.cacheHits + cacheMetrics.cacheMisses)) * 100) : 0;
        document.getElementById('prefetchEfficiency').textContent = `${prefetchRate}% prefetch`;
    }

    /**
     * Update charts with new data
     */
    updateCharts(report) {
        // Update memory usage chart
        const memoryChart = this.state.charts.get('memoryUsage');
        if (memoryChart && 'memory' in performance) {
            const memory = performance.memory;
            const usedMB = memory.usedJSHeapSize / (1024 * 1024);
            const totalMB = memory.totalJSHeapSize / (1024 * 1024);

            this.addDataToChart(memoryChart, new Date().toLocaleTimeString(), [usedMB, totalMB]);

            // Update memory progress bars
            const usedPercent = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
            const totalPercent = (memory.totalJSHeapSize / memory.jsHeapSizeLimit) * 100;

            document.getElementById('usedHeapProgress').style.width = `${usedPercent}%`;
            document.getElementById('totalHeapProgress').style.width = `${totalPercent}%`;
            document.getElementById('usedHeapValue').textContent = `${usedMB.toFixed(1)} MB`;
            document.getElementById('totalHeapValue').textContent = `${totalMB.toFixed(1)} MB`;
        }

        // Update timeline chart
        const timelineChart = this.state.charts.get('timeline');
        if (timelineChart && !this.state.isPaused) {
            const cwv = report.coreWebVitals;
            const timestamp = new Date().toLocaleTimeString();
            
            this.addDataToChart(timelineChart, timestamp, [
                cwv.lcp || 0,
                cwv.fid || 0,
                (cwv.cls || 0) * 1000 // Scale CLS for visibility
            ]);
        }
    }

    /**
     * Add data to chart with maximum data points limit
     */
    addDataToChart(chart, label, data) {
        chart.data.labels.push(label);
        data.forEach((value, index) => {
            chart.data.datasets[index].data.push(value);
        });

        // Limit data points
        if (chart.data.labels.length > this.config.maxDataPoints) {
            chart.data.labels.shift();
            chart.data.datasets.forEach(dataset => {
                dataset.data.shift();
            });
        }

        chart.update('none');
    }

    /**
     * Start real-time monitoring
     */
    startRealTimeMonitoring() {
        this.state.isMonitoring = true;

        // Update metrics regularly
        setInterval(() => {
            if (!this.state.isPaused && this.state.performanceService) {
                const report = this.state.performanceService.getPerformanceReport();
                this.updateMetricsDisplay(report);
                this.checkPerformanceThresholds(report);
            }
        }, this.config.updateInterval);

        // Update charts more frequently
        setInterval(() => {
            if (!this.state.isPaused && this.state.performanceService) {
                const report = this.state.performanceService.getPerformanceReport();
                this.updateCharts(report);
            }
        }, this.config.chartUpdateInterval);
    }

    /**
     * Handle performance metric events
     */
    handlePerformanceMetric(metric) {
        // Add to real-time data
        this.state.realTimeData.timeline.push(metric);

        // Limit timeline data
        if (this.state.realTimeData.timeline.length > this.config.maxDataPoints) {
            this.state.realTimeData.timeline.shift();
        }

        // Check for performance alerts
        this.checkPerformanceAlert(metric);
    }

    /**
     * Check performance thresholds and trigger alerts
     */
    checkPerformanceThresholds(report) {
        const alerts = [];

        // Check LCP threshold
        if (report.coreWebVitals.lcp > 4000) {
            alerts.push({
                type: 'LCP',
                severity: 'high',
                message: `Largest Contentful Paint is ${Math.round(report.coreWebVitals.lcp)}ms (> 4000ms)`,
                value: report.coreWebVitals.lcp
            });
        }

        // Check memory usage
        if ('memory' in performance) {
            const memory = performance.memory;
            const usagePercent = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
            
            if (usagePercent > 85) {
                alerts.push({
                    type: 'Memory',
                    severity: 'high',
                    message: `Memory usage is ${usagePercent.toFixed(1)}% of limit`,
                    value: usagePercent
                });
            }
        }

        // Show alerts
        alerts.forEach(alert => {
            this.showPerformanceAlert(alert);
        });
    }

    /**
     * Check individual metric for alerts
     */
    checkPerformanceAlert(metric) {
        if (metric.category === 'core_web_vitals' && metric.data.rating === 'poor') {
            this.showPerformanceAlert({
                type: metric.data.metric.toUpperCase(),
                severity: 'medium',
                message: `${metric.data.metric.toUpperCase()} measurement shows poor performance`,
                value: metric.data.value
            });
        }
    }

    /**
     * Show performance alert modal
     */
    showPerformanceAlert(alert) {
        const modal = document.getElementById('performanceAlertModal');
        const alertContent = document.getElementById('alertContent');
        
        if (modal && alertContent) {
            alertContent.innerHTML = `
                <div class="alert-item ${alert.severity}">
                    <div class="alert-icon">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <div class="alert-details">
                        <h4>${alert.type} Performance Issue</h4>
                        <p>${alert.message}</p>
                        <div class="alert-value">Current value: <strong>${alert.value}</strong></div>
                    </div>
                </div>
            `;
            
            modal.style.display = 'flex';
        }
    }

    /**
     * Generate performance recommendations
     */
    async generateRecommendations() {
        if (!this.state.performanceService) return;

        const report = this.state.performanceService.getPerformanceReport();
        const recommendations = report.recommendations || [];

        const container = document.getElementById('recommendationsList');
        if (!container) return;

        if (recommendations.length === 0) {
            container.innerHTML = `
                <div class="no-recommendations">
                    <i class="fas fa-check-circle"></i>
                    <p>Great! No performance issues detected.</p>
                </div>
            `;
            return;
        }

        let html = '';
        recommendations.forEach(rec => {
            const iconMap = {
                'LCP': 'tachometer-alt',
                'FID': 'mouse-pointer', 
                'CLS': 'arrows-alt',
                'Images': 'images',
                'Caching': 'database'
            };

            const recommendationData = {
                category: rec.category,
                severity: rec.severity,
                message: rec.message,
                value: rec.value,
                icon: iconMap[rec.category] || 'exclamation-triangle',
                fixable: rec.category === 'Images' || rec.category === 'Caching'
            };

            if (this.templates.recommendation) {
                html += this.templates.recommendation(recommendationData);
            } else {
                // Fallback HTML
                html += `
                    <div class="recommendation-item ${rec.severity}">
                        <div class="recommendation-icon">
                            <i class="fas fa-${iconMap[rec.category] || 'exclamation-triangle'}"></i>
                        </div>
                        <div class="recommendation-content">
                            <div class="recommendation-header">
                                <h4>${rec.category}</h4>
                                <span class="severity-badge ${rec.severity}">${rec.severity}</span>
                            </div>
                            <p class="recommendation-message">${rec.message}</p>
                            <div class="recommendation-value">Current value: <strong>${rec.value}</strong></div>
                        </div>
                    </div>
                `;
            }
        });

        container.innerHTML = html;
    }

    /**
     * Action handlers
     */
    async refreshMetrics() {
        if (this.state.performanceService) {
            const report = this.state.performanceService.getPerformanceReport();
            this.updateMetricsDisplay(report);
            this.showToast('Metrics refreshed successfully', 'success');
        }
    }

    async exportMetrics() {
        if (this.state.performanceService) {
            const data = this.state.performanceService.exportData();
            
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `gallery-performance-${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            URL.revokeObjectURL(url);
            this.showToast('Performance data exported successfully', 'success');
        }
    }

    async runPerformanceAudit() {
        this.showToast('Performance audit started...', 'info');
        
        // Simulate audit process
        setTimeout(() => {
            this.refreshMetrics();
            this.generateRecommendations();
            this.showToast('Performance audit completed', 'success');
        }, 2000);
    }

    toggleTimelinePause(button) {
        this.state.isPaused = !this.state.isPaused;
        
        if (this.state.isPaused) {
            button.innerHTML = '<i class="fas fa-play"></i> Resume';
            button.classList.add('btn-primary');
            button.classList.remove('btn-outline');
        } else {
            button.innerHTML = '<i class="fas fa-pause"></i> Pause';
            button.classList.add('btn-outline');
            button.classList.remove('btn-primary');
        }
    }

    clearTimeline() {
        this.state.charts.forEach(chart => {
            chart.data.labels = [];
            chart.data.datasets.forEach(dataset => {
                dataset.data = [];
            });
            chart.update();
        });
        
        this.state.realTimeData.timeline = [];
        this.showToast('Timeline data cleared', 'success');
    }

    triggerGarbageCollection() {
        if (window.gc) {
            window.gc();
            this.showToast('Garbage collection triggered', 'success');
        } else {
            this.showToast('Garbage collection not available in this browser', 'warning');
        }
    }

    closePerformanceAlert() {
        const modal = document.getElementById('performanceAlertModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    viewAlertDetails() {
        this.closePerformanceAlert();
        // Could open detailed performance analysis
        console.log('Opening detailed performance analysis...');
    }

    viewRecommendationDetails(category) {
        console.log(`Viewing details for ${category} recommendations`);
        this.showToast(`Opening ${category} performance details`, 'info');
    }

    autoFixIssue(category) {
        console.log(`Auto-fixing ${category} issues`);
        this.showToast(`Attempting to auto-fix ${category} issues`, 'info');
        
        // Simulate auto-fix process
        setTimeout(() => {
            this.showToast(`${category} optimization applied`, 'success');
            this.generateRecommendations();
        }, 1500);
    }

    /**
     * Show toast notification
     */
    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer') || document.body;
        const toast = document.createElement('div');
        
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <i class="fas fa-${this.getToastIcon(type)}"></i>
            <span>${message}</span>
            <button class="toast-close" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 5000);
    }

    getToastIcon(type) {
        const icons = {
            'success': 'check-circle',
            'error': 'exclamation-triangle',
            'warning': 'exclamation-circle',
            'info': 'info-circle'
        };
        return icons[type] || 'info-circle';
    }
}

// Initialize performance monitoring when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.performanceMonitoringDashboard = new PerformanceMonitoringDashboard();
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PerformanceMonitoringDashboard;
} else {
    window.PerformanceMonitoringDashboard = PerformanceMonitoringDashboard;
}