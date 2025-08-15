/**
 * Analytics Reporting Dashboard JavaScript
 * 
 * Handles analytics data visualization, user behavior insights,
 * and reporting functionality for gallery usage patterns.
 */

class AnalyticsReportingDashboard {
    constructor() {
        this.config = {
            apiBaseUrl: '/api/gallery-analytics',
            updateInterval: 60000, // 1 minute
            chartColors: {
                primary: '#3b82f6',
                success: '#10b981',
                warning: '#f59e0b',
                error: '#ef4444',
                info: '#06b6d4',
                secondary: '#64748b'
            }
        };

        this.state = {
            currentDateRange: '30',
            customDateRange: null,
            analyticsData: {},
            charts: new Map(),
            filters: {
                gallery: 'all',
                period: '30'
            },
            isLoading: false,
            lastUpdate: null
        };

        this.templates = {};
        this.init();
    }

    /**
     * Initialize the analytics dashboard
     */
    async init() {
        try {
            this.compileTemplates();
            this.bindEvents();
            this.initializeCharts();
            await this.loadAnalyticsData();
            this.startAutoRefresh();
            
            console.log('📊 Analytics Reporting Dashboard initialized');
        } catch (error) {
            console.error('❌ Failed to initialize analytics dashboard:', error);
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

        // Compile gallery performance template
        const galleryTemplate = document.getElementById('galleryPerformanceTemplate');
        if (galleryTemplate) {
            this.templates.galleryPerformance = Handlebars.compile(galleryTemplate.innerHTML);
        }

        // Compile insight template
        const insightTemplate = document.getElementById('insightTemplate');
        if (insightTemplate) {
            this.templates.insight = Handlebars.compile(insightTemplate.innerHTML);
        }

        // Register helpers
        Handlebars.registerHelper('formatNumber', (number) => {
            return new Intl.NumberFormat().format(number);
        });

        Handlebars.registerHelper('formatDuration', (seconds) => {
            if (seconds < 60) return `${Math.round(seconds)}s`;
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = Math.round(seconds % 60);
            return `${minutes}m ${remainingSeconds}s`;
        });

        Handlebars.registerHelper('formatPercent', (value) => {
            return `${Math.round(value * 100) / 100}%`;
        });
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Date range selector
        document.getElementById('dateRangeSelect')?.addEventListener('change', (e) => {
            this.handleDateRangeChange(e.target.value);
        });

        // Header actions
        document.getElementById('refreshAnalyticsBtn')?.addEventListener('click', () => {
            this.refreshAnalytics();
        });

        document.getElementById('exportReportBtn')?.addEventListener('click', () => {
            this.exportReport();
        });

        // Section controls
        document.getElementById('trafficViewModeBtn')?.addEventListener('click', (e) => {
            this.toggleTrafficViewMode(e.target);
        });

        document.getElementById('galleryFilterSelect')?.addEventListener('change', (e) => {
            this.filterGalleryPerformance(e.target.value);
        });

        document.getElementById('heatmapToggleBtn')?.addEventListener('click', (e) => {
            this.toggleHeatmap(e.target);
        });

        // Export buttons
        document.getElementById('exportSearchDataBtn')?.addEventListener('click', () => {
            this.exportSearchData();
        });

        document.getElementById('generateInsightsBtn')?.addEventListener('click', () => {
            this.generateInsights();
        });

        // Custom date range modal
        document.getElementById('closeDateModal')?.addEventListener('click', () => {
            this.closeCustomDateModal();
        });

        document.getElementById('cancelDateRange')?.addEventListener('click', () => {
            this.closeCustomDateModal();
        });

        document.getElementById('applyDateRange')?.addEventListener('click', () => {
            this.applyCustomDateRange();
        });

        // Delegate events for dynamic content
        document.addEventListener('click', (e) => {
            this.handleDynamicClicks(e);
        });
    }

    /**
     * Handle clicks on dynamically generated content
     */
    handleDynamicClicks(event) {
        const target = event.target.closest('[data-action]');
        if (!target) return;

        const action = target.dataset.action;
        const id = target.dataset.galleryId || target.dataset.insightId;

        switch (action) {
            case 'view-details':
                this.viewGalleryDetails(id);
                break;
            case 'optimize':
                this.optimizeGallery(id);
                break;
            case 'learn-more':
                this.learnMoreAboutInsight(id);
                break;
            case 'implement':
                this.implementInsight(id);
                break;
        }
    }

    /**
     * Initialize charts
     */
    initializeCharts() {
        if (typeof Chart === 'undefined') {
            console.warn('Chart.js not available, charts will not be displayed');
            return;
        }

        // Traffic Chart
        const trafficCanvas = document.getElementById('trafficChart');
        if (trafficCanvas) {
            const trafficChart = new Chart(trafficCanvas, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Daily Visitors',
                        data: [],
                        borderColor: this.config.chartColors.primary,
                        backgroundColor: `${this.config.chartColors.primary}20`,
                        tension: 0.1,
                        fill: true
                    }, {
                        label: 'Gallery Views',
                        data: [],
                        borderColor: this.config.chartColors.success,
                        backgroundColor: `${this.config.chartColors.success}20`,
                        tension: 0.1,
                        fill: true
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
                                text: 'Count'
                            }
                        }
                    }
                }
            });
            this.state.charts.set('traffic', trafficChart);
        }

        // Engagement Chart
        const engagementCanvas = document.getElementById('engagementChart');
        if (engagementCanvas) {
            const engagementChart = new Chart(engagementCanvas, {
                type: 'bar',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Avg Session Duration (minutes)',
                        data: [],
                        backgroundColor: this.config.chartColors.info,
                        borderColor: this.config.chartColors.info,
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Minutes'
                            }
                        }
                    }
                }
            });
            this.state.charts.set('engagement', engagementChart);
        }

        // Filter Usage Chart
        const filterCanvas = document.getElementById('filterUsageChart');
        if (filterCanvas) {
            const filterChart = new Chart(filterCanvas, {
                type: 'doughnut',
                data: {
                    labels: [],
                    datasets: [{
                        data: [],
                        backgroundColor: [
                            this.config.chartColors.primary,
                            this.config.chartColors.success,
                            this.config.chartColors.warning,
                            this.config.chartColors.error,
                            this.config.chartColors.info,
                            this.config.chartColors.secondary
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            position: 'right'
                        }
                    }
                }
            });
            this.state.charts.set('filterUsage', filterChart);
        }
    }

    /**
     * Load analytics data
     */
    async loadAnalyticsData() {
        this.setLoading(true);
        
        try {
            const [overview, traffic, galleries, behavior, search, insights] = await Promise.all([
                this.fetchOverviewMetrics(),
                this.fetchTrafficData(),
                this.fetchGalleryPerformance(),
                this.fetchUserBehavior(),
                this.fetchSearchAnalytics(),
                this.fetchInsights()
            ]);

            this.state.analyticsData = {
                overview,
                traffic,
                galleries,
                behavior,
                search,
                insights
            };

            this.updateDashboard();
            this.state.lastUpdate = new Date();

        } catch (error) {
            console.error('Failed to load analytics data:', error);
            this.showToast('Failed to load analytics data', 'error');
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * Update dashboard with current data
     */
    updateDashboard() {
        this.updateOverviewMetrics();
        this.updateTrafficCharts();
        this.updateGalleryPerformance();
        this.updateUserBehavior();
        this.updateSearchAnalytics();
        this.updateInsights();
    }

    /**
     * Update overview metrics
     */
    updateOverviewMetrics() {
        const data = this.state.analyticsData.overview;
        if (!data) return;

        // Update metric values
        document.getElementById('totalVisitors').textContent = this.formatNumber(data.totalVisitors || 0);
        document.getElementById('totalGalleryViews').textContent = this.formatNumber(data.totalGalleryViews || 0);
        document.getElementById('totalInteractions').textContent = this.formatNumber(data.totalInteractions || 0);
        document.getElementById('avgSessionDuration').textContent = this.formatDuration(data.avgSessionDuration || 0);

        // Update change indicators
        this.updateChangeIndicator('visitorsChange', data.visitorsChange);
        this.updateChangeIndicator('viewsChange', data.viewsChange);
        this.updateChangeIndicator('interactionsChange', data.interactionsChange);
        this.updateChangeIndicator('sessionChange', data.sessionChange);
    }

    /**
     * Update change indicator
     */
    updateChangeIndicator(elementId, changeData) {
        const element = document.getElementById(elementId);
        if (!element || !changeData) return;

        const indicator = element.querySelector('.change-indicator');
        if (!indicator) return;

        const value = changeData.value || 0;
        const sign = value >= 0 ? '+' : '';
        
        indicator.textContent = `${sign}${value.toFixed(1)}%`;
        indicator.className = `change-indicator ${value >= 0 ? 'positive' : 'negative'}`;
    }

    /**
     * Update traffic charts
     */
    updateTrafficCharts() {
        const trafficData = this.state.analyticsData.traffic;
        if (!trafficData) return;

        // Update traffic chart
        const trafficChart = this.state.charts.get('traffic');
        if (trafficChart) {
            trafficChart.data.labels = trafficData.daily.map(d => d.date);
            trafficChart.data.datasets[0].data = trafficData.daily.map(d => d.visitors);
            trafficChart.data.datasets[1].data = trafficData.daily.map(d => d.views);
            trafficChart.update();
        }

        // Update engagement chart
        const engagementChart = this.state.charts.get('engagement');
        if (engagementChart) {
            engagementChart.data.labels = trafficData.daily.map(d => d.date);
            engagementChart.data.datasets[0].data = trafficData.daily.map(d => d.avgSessionDuration / 60);
            engagementChart.update();
        }

        // Update traffic statistics
        this.updateTrafficStats(trafficData.stats);
    }

    /**
     * Update traffic statistics
     */
    updateTrafficStats(stats) {
        if (!stats) return;

        document.getElementById('newVisitors').textContent = `${this.formatNumber(stats.newVisitors)} (${stats.newVisitorPercent}%)`;
        document.getElementById('returningVisitors').textContent = `${this.formatNumber(stats.returningVisitors)} (${stats.returningVisitorPercent}%)`;
        document.getElementById('bounceRate').textContent = `${stats.bounceRate}%`;
        document.getElementById('pagesPerSession').textContent = stats.pagesPerSession.toFixed(1);
        document.getElementById('avgTimeOnPage').textContent = `${(stats.avgTimeOnPage / 60).toFixed(1)} min`;
        document.getElementById('interactionRate').textContent = `${stats.interactionRate}%`;
    }

    /**
     * Update gallery performance
     */
    updateGalleryPerformance() {
        const galleries = this.state.analyticsData.galleries;
        if (!galleries) return;

        const container = document.getElementById('galleryPerformanceList');
        if (!container) return;

        let html = '';
        galleries.forEach(gallery => {
            if (this.templates.galleryPerformance) {
                html += this.templates.galleryPerformance(gallery);
            } else {
                // Fallback HTML
                html += `
                    <div class="gallery-performance-item">
                        <div class="gallery-info">
                            <div class="gallery-details">
                                <h4>${gallery.name}</h4>
                                <p class="gallery-meta">${gallery.type} • ${gallery.imageCount} images</p>
                            </div>
                        </div>
                        <div class="gallery-metrics">
                            <div class="metric-item">
                                <label>Views</label>
                                <div class="metric-number">${gallery.views}</div>
                            </div>
                            <div class="metric-item">
                                <label>Engagement</label>
                                <div class="metric-number">${gallery.engagementRate}%</div>
                            </div>
                        </div>
                    </div>
                `;
            }
        });

        container.innerHTML = html;

        // Update top galleries and images
        this.updateTopPerformers(galleries);
    }

    /**
     * Update top performers
     */
    updateTopPerformers(galleries) {
        // Top galleries
        const topGalleries = galleries.slice(0, 5);
        const topGalleriesContainer = document.getElementById('topGalleries');
        if (topGalleriesContainer) {
            topGalleriesContainer.innerHTML = topGalleries.map(gallery => `
                <div class="top-item">
                    <span class="top-item-name">${gallery.name}</span>
                    <span class="top-item-value">${gallery.views} views</span>
                </div>
            `).join('');
        }

        // Top images (if available)
        const topImagesContainer = document.getElementById('topImages');
        if (topImagesContainer && galleries[0]?.topImages) {
            topImagesContainer.innerHTML = galleries[0].topImages.map(image => `
                <div class="top-item">
                    <span class="top-item-name">${image.name || 'Image'}</span>
                    <span class="top-item-value">${image.interactions} interactions</span>
                </div>
            `).join('');
        }
    }

    /**
     * Update user behavior section
     */
    updateUserBehavior() {
        const behavior = this.state.analyticsData.behavior;
        if (!behavior) return;

        // Update behavior patterns
        document.getElementById('searchUsage').textContent = `${behavior.searchUsagePercent || 0}% of sessions`;
        document.getElementById('searchDetails').textContent = `${behavior.avgQueriesPerSession || 0} avg queries`;
        
        document.getElementById('filterUsage').textContent = `${behavior.filterUsagePercent || 0}% of sessions`;
        document.getElementById('filterDetails').textContent = behavior.mostUsedFilter || 'None';
        
        document.getElementById('lightboxUsage').textContent = `${behavior.lightboxUsagePercent || 0}% of interactions`;
        document.getElementById('lightboxDetails').textContent = `${behavior.avgLightboxPerSession || 0} avg per session`;
        
        document.getElementById('mobileUsage').textContent = `${behavior.mobileTrafficPercent || 0}% of traffic`;
        document.getElementById('mobileDetails').textContent = `${this.formatDuration(behavior.avgMobileSessionTime || 0)} avg session time`;
    }

    /**
     * Update search analytics
     */
    updateSearchAnalytics() {
        const search = this.state.analyticsData.search;
        if (!search) return;

        // Update search metrics
        document.getElementById('totalSearches').textContent = this.formatNumber(search.totalSearches || 0);
        document.getElementById('avgResultsFound').textContent = (search.avgResultsFound || 0).toFixed(1);
        document.getElementById('zeroResultsRate').textContent = `${search.zeroResultsRate || 0}%`;
        document.getElementById('searchExitRate').textContent = `${search.searchExitRate || 0}%`;

        // Update top queries
        const topQueriesContainer = document.getElementById('topQueries');
        if (topQueriesContainer && search.topQueries) {
            topQueriesContainer.innerHTML = search.topQueries.map((query, index) => `
                <div class="query-item" style="padding: 0.5rem; border-bottom: 1px solid #e5e7eb;">
                    <div style="display: flex; justify-content: space-between;">
                        <span>${query.query}</span>
                        <span style="color: #6b7280;">${query.count} searches</span>
                    </div>
                </div>
            `).join('');
        }

        // Update filter usage chart
        const filterChart = this.state.charts.get('filterUsage');
        if (filterChart && search.filterUsage) {
            filterChart.data.labels = Object.keys(search.filterUsage);
            filterChart.data.datasets[0].data = Object.values(search.filterUsage);
            filterChart.update();
        }
    }

    /**
     * Update insights section
     */
    updateInsights() {
        const insights = this.state.analyticsData.insights;
        if (!insights) return;

        const insightsContainer = document.getElementById('insightsList');
        const recommendationsContainer = document.getElementById('recommendationsList');

        if (insightsContainer) {
            let html = '';
            insights.insights?.forEach(insight => {
                if (this.templates.insight) {
                    html += this.templates.insight(insight);
                } else {
                    // Fallback HTML
                    html += `
                        <div class="insight-item ${insight.priority}">
                            <div class="insight-content">
                                <div class="insight-header">
                                    <h4>${insight.title}</h4>
                                    <span class="priority-badge ${insight.priority}">${insight.priority}</span>
                                </div>
                                <p class="insight-description">${insight.description}</p>
                                <div class="insight-impact"><strong>Potential Impact:</strong> ${insight.impact}</div>
                            </div>
                        </div>
                    `;
                }
            });
            insightsContainer.innerHTML = html;
        }

        if (recommendationsContainer) {
            let html = '';
            insights.recommendations?.forEach(rec => {
                html += `
                    <div class="insight-item ${rec.priority}">
                        <div class="insight-content">
                            <h4>${rec.title}</h4>
                            <p>${rec.description}</p>
                        </div>
                    </div>
                `;
            });
            recommendationsContainer.innerHTML = html;
        }
    }

    /**
     * Handle date range change
     */
    handleDateRangeChange(value) {
        if (value === 'custom') {
            this.showCustomDateModal();
        } else {
            this.state.currentDateRange = value;
            this.state.filters.period = value;
            this.loadAnalyticsData();
        }
    }

    /**
     * Show custom date range modal
     */
    showCustomDateModal() {
        const modal = document.getElementById('customDateModal');
        if (modal) {
            modal.style.display = 'flex';
            
            // Set default dates (last 30 days to today)
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 30);
            
            document.getElementById('customStartDate').value = startDate.toISOString().split('T')[0];
            document.getElementById('customEndDate').value = endDate.toISOString().split('T')[0];
        }
    }

    /**
     * Close custom date modal
     */
    closeCustomDateModal() {
        const modal = document.getElementById('customDateModal');
        if (modal) {
            modal.style.display = 'none';
        }
        
        // Reset dropdown to previous value
        const select = document.getElementById('dateRangeSelect');
        if (select) {
            select.value = this.state.currentDateRange;
        }
    }

    /**
     * Apply custom date range
     */
    applyCustomDateRange() {
        const startDate = document.getElementById('customStartDate').value;
        const endDate = document.getElementById('customEndDate').value;
        
        if (!startDate || !endDate) {
            this.showToast('Please select both start and end dates', 'warning');
            return;
        }
        
        if (new Date(startDate) > new Date(endDate)) {
            this.showToast('Start date must be before end date', 'warning');
            return;
        }
        
        this.state.customDateRange = { startDate, endDate };
        this.state.currentDateRange = 'custom';
        this.closeCustomDateModal();
        this.loadAnalyticsData();
    }

    /**
     * Action handlers
     */
    async refreshAnalytics() {
        this.showToast('Refreshing analytics data...', 'info');
        await this.loadAnalyticsData();
        this.showToast('Analytics data refreshed', 'success');
    }

    async exportReport() {
        try {
            const response = await fetch(`${this.config.apiBaseUrl}/reports/export?period=${this.state.currentDateRange}`, {
                method: 'GET'
            });
            
            if (!response.ok) throw new Error('Export failed');
            
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `gallery-analytics-${this.state.currentDateRange}-days-${Date.now()}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.showToast('Report exported successfully', 'success');
        } catch (error) {
            console.error('Export failed:', error);
            this.showToast('Failed to export report', 'error');
        }
    }

    toggleTrafficViewMode(button) {
        const currentView = button.dataset.view;
        const newView = currentView === 'chart' ? 'table' : 'chart';
        
        button.dataset.view = newView;
        button.innerHTML = newView === 'chart' ? 
            '<i class="fas fa-chart-bar"></i> Chart View' : 
            '<i class="fas fa-table"></i> Table View';
    }

    filterGalleryPerformance(filter) {
        this.state.filters.gallery = filter;
        this.updateGalleryPerformance();
    }

    toggleHeatmap(button) {
        const container = document.getElementById('heatmapContainer');
        if (container) {
            const isVisible = container.style.display !== 'none';
            container.style.display = isVisible ? 'none' : 'block';
            button.innerHTML = isVisible ? 
                '<i class="fas fa-fire"></i> Show Heatmap' : 
                '<i class="fas fa-eye-slash"></i> Hide Heatmap';
        }
    }

    async exportSearchData() {
        try {
            const searchData = this.state.analyticsData.search;
            const dataStr = JSON.stringify(searchData, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `search-analytics-${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.showToast('Search data exported successfully', 'success');
        } catch (error) {
            console.error('Search export failed:', error);
            this.showToast('Failed to export search data', 'error');
        }
    }

    async generateInsights() {
        this.showToast('Generating new insights...', 'info');
        
        try {
            const response = await fetch(`${this.config.apiBaseUrl}/insights/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    period: this.state.currentDateRange,
                    customRange: this.state.customDateRange
                })
            });
            
            if (!response.ok) throw new Error('Insight generation failed');
            
            const insights = await response.json();
            this.state.analyticsData.insights = insights;
            this.updateInsights();
            
            this.showToast('New insights generated successfully', 'success');
        } catch (error) {
            console.error('Insight generation failed:', error);
            this.showToast('Failed to generate insights', 'error');
        }
    }

    viewGalleryDetails(galleryId) {
        this.showToast(`Opening detailed analytics for gallery ${galleryId}`, 'info');
        // Implementation would open detailed view
    }

    optimizeGallery(galleryId) {
        this.showToast(`Starting optimization for gallery ${galleryId}`, 'info');
        // Implementation would start optimization process
    }

    learnMoreAboutInsight(insightId) {
        this.showToast(`Opening detailed insight information`, 'info');
        // Implementation would show detailed insight modal
    }

    implementInsight(insightId) {
        this.showToast(`Implementing insight recommendations`, 'info');
        // Implementation would apply insight recommendations
    }

    /**
     * API methods
     */
    async fetchOverviewMetrics() {
        const response = await fetch(`${this.config.apiBaseUrl}/metrics/overview?period=${this.state.currentDateRange}`);
        if (!response.ok) throw new Error('Failed to fetch overview metrics');
        return response.json();
    }

    async fetchTrafficData() {
        const response = await fetch(`${this.config.apiBaseUrl}/traffic?period=${this.state.currentDateRange}`);
        if (!response.ok) throw new Error('Failed to fetch traffic data');
        return response.json();
    }

    async fetchGalleryPerformance() {
        const response = await fetch(`${this.config.apiBaseUrl}/galleries/performance?period=${this.state.currentDateRange}`);
        if (!response.ok) throw new Error('Failed to fetch gallery performance');
        return response.json();
    }

    async fetchUserBehavior() {
        const response = await fetch(`${this.config.apiBaseUrl}/behavior?period=${this.state.currentDateRange}`);
        if (!response.ok) throw new Error('Failed to fetch user behavior');
        return response.json();
    }

    async fetchSearchAnalytics() {
        const response = await fetch(`${this.config.apiBaseUrl}/search?period=${this.state.currentDateRange}`);
        if (!response.ok) throw new Error('Failed to fetch search analytics');
        return response.json();
    }

    async fetchInsights() {
        const response = await fetch(`${this.config.apiBaseUrl}/insights?period=${this.state.currentDateRange}`);
        if (!response.ok) throw new Error('Failed to fetch insights');
        return response.json();
    }

    /**
     * Utility methods
     */
    formatNumber(number) {
        return new Intl.NumberFormat().format(number);
    }

    formatDuration(seconds) {
        if (seconds < 60) return `${Math.round(seconds)}s`;
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.round(seconds % 60);
        return `${minutes}m ${remainingSeconds}s`;
    }

    setLoading(isLoading) {
        this.state.isLoading = isLoading;
        // Could show loading spinners here
    }

    startAutoRefresh() {
        setInterval(() => {
            if (!this.state.isLoading) {
                this.loadAnalyticsData();
            }
        }, this.config.updateInterval);
    }

    showToast(message, type = 'info') {
        console.log(`${type.toUpperCase()}: ${message}`);
        // Integration with main toast system would go here
    }
}

// Initialize analytics dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.analyticsReportingDashboard = new AnalyticsReportingDashboard();
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AnalyticsReportingDashboard;
} else {
    window.AnalyticsReportingDashboard = AnalyticsReportingDashboard;
}