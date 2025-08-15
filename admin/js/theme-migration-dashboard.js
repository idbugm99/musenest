/**
 * Theme Migration Dashboard Controller
 * 
 * Manages the progressive rollout interface, real-time monitoring,
 * and migration lifecycle management.
 */

class ThemeMigrationDashboard {
    constructor() {
        this.migrations = [];
        this.themes = [];
        this.models = [];
        this.refreshInterval = null;
        this.performanceChart = null;
        
        this.init();
    }

    async init() {
        console.log('🔄 Initializing Theme Migration Dashboard...');
        
        try {
            await this.loadInitialData();
            this.setupEventListeners();
            this.setupCharts();
            this.startAutoRefresh();
            
            console.log('✅ Theme Migration Dashboard initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize dashboard:', error);
            this.showError('Failed to initialize migration dashboard');
        }
    }

    async loadInitialData() {
        // Load themes, models, and initial migration data
        await Promise.all([
            this.loadThemes(),
            this.loadModels(), 
            this.loadDashboardOverview(),
            this.loadMigrations()
        ]);
        
        this.populateDropdowns();
    }

    async loadThemes() {
        try {
            const response = await fetch('/api/admin/themes');
            if (!response.ok) throw new Error('Failed to load themes');
            
            const data = await response.json();
            this.themes = data.data || [];
        } catch (error) {
            console.error('Error loading themes:', error);
        }
    }

    async loadModels() {
        try {
            const response = await fetch('/api/admin/models?status=active');
            if (!response.ok) throw new Error('Failed to load models');
            
            const data = await response.json();
            this.models = data.data || [];
        } catch (error) {
            console.error('Error loading models:', error);
        }
    }

    async loadDashboardOverview() {
        try {
            const response = await fetch('/api/theme-migrations/dashboard/overview');
            if (!response.ok) throw new Error('Failed to load dashboard overview');
            
            const data = await response.json();
            this.updateOverviewCards(data.data);
            this.updateRecentActivity(data.data.recentActivity);
            this.updatePerformanceChart(data.data.performance);
        } catch (error) {
            console.error('Error loading dashboard overview:', error);
        }
    }

    async loadMigrations(status = '', page = 1) {
        try {
            let url = `/api/theme-migrations?page=${page}&limit=20`;
            if (status) url += `&status=${status}`;
            
            const response = await fetch(url);
            if (!response.ok) throw new Error('Failed to load migrations');
            
            const data = await response.json();
            this.migrations = data.data.migrations || [];
            this.renderMigrationsTable();
        } catch (error) {
            console.error('Error loading migrations:', error);
            this.showMigrationsError();
        }
    }

    populateDropdowns() {
        // Populate theme dropdowns
        const themeSelects = ['sourceThemeSelect', 'targetThemeSelect', 'controlThemeSelect', 'variantThemeSelect'];
        themeSelects.forEach(selectId => {
            const select = document.getElementById(selectId);
            if (!select) return;
            
            // Clear existing options (except first)
            while (select.children.length > 1) {
                select.removeChild(select.lastChild);
            }
            
            this.themes.forEach(theme => {
                const option = document.createElement('option');
                option.value = theme.id;
                option.textContent = theme.display_name || theme.name;
                select.appendChild(option);
            });
        });

        // Populate model dropdowns
        const modelSelects = ['targetModelsSelect', 'abTestTargetModels'];
        modelSelects.forEach(selectId => {
            const select = document.getElementById(selectId);
            if (!select) return;
            
            // Clear existing options (except first)
            while (select.children.length > 1) {
                select.removeChild(select.lastChild);
            }
            
            this.models.forEach(model => {
                const option = document.createElement('option');
                option.value = model.id;
                option.textContent = `${model.name} (${model.slug})`;
                select.appendChild(option);
            });
        });
    }

    setupEventListeners() {
        // Migration form
        document.getElementById('startMigrationBtn')?.addEventListener('click', () => {
            this.handleStartMigration();
        });

        // A/B test form
        document.getElementById('createAbTestBtn')?.addEventListener('click', () => {
            this.handleCreateAbTest();
        });

        // Refresh button
        document.getElementById('refreshMigrations')?.addEventListener('click', () => {
            this.loadMigrations();
        });

        // Status filter
        document.getElementById('statusFilter')?.addEventListener('change', (e) => {
            this.loadMigrations(e.target.value);
        });

        // Advanced settings toggle
        document.getElementById('showAdvanced')?.addEventListener('change', (e) => {
            const advancedSettings = document.getElementById('advancedSettings');
            if (advancedSettings) {
                advancedSettings.style.display = e.target.checked ? 'block' : 'none';
            }
        });

        // Traffic split range
        const trafficSplitRange = document.getElementById('trafficSplitRange');
        const trafficSplitText = document.getElementById('trafficSplitText');
        trafficSplitRange?.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            const aPercent = Math.round(value * 100);
            const bPercent = 100 - aPercent;
            trafficSplitText.textContent = `${aPercent}% / ${bPercent}%`;
        });

        // Rollback confirmation
        document.getElementById('rollbackMigrationBtn')?.addEventListener('click', () => {
            this.showRollbackConfirmation();
        });

        // Confirmation modal
        document.getElementById('confirmActionBtn')?.addEventListener('click', () => {
            this.executeConfirmedAction();
        });
    }

    setupCharts() {
        const ctx = document.getElementById('performanceChart');
        if (!ctx) return;

        this.performanceChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Error Rate (%)',
                        data: [],
                        borderColor: 'rgb(239, 68, 68)',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        tension: 0.4
                    },
                    {
                        label: 'Avg Response Time (ms)',
                        data: [],
                        borderColor: 'rgb(59, 130, 246)',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        tension: 0.4,
                        yAxisID: 'y1'
                    },
                    {
                        label: 'User Satisfaction (%)',
                        data: [],
                        borderColor: 'rgb(16, 185, 129)',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top'
                    },
                    title: {
                        display: true,
                        text: 'Migration Performance Metrics (Last 24h)'
                    }
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Error Rate (%) / Satisfaction (%)'
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Response Time (ms)'
                        },
                        grid: {
                            drawOnChartArea: false
                        }
                    }
                }
            }
        });
    }

    updateOverviewCards(data) {
        const summary = data.summary || {};
        
        document.getElementById('activeMigrationsCount').textContent = summary.activeMigrations || 0;
        document.getElementById('completedMigrationsCount').textContent = summary.completedMigrations || 0;
        document.getElementById('rollbackCount').textContent = summary.rollbackCount || 0;
        document.getElementById('affectedUsersCount').textContent = this.formatNumber(summary.affectedUsers || 0);
    }

    updateRecentActivity(activities = []) {
        const container = document.getElementById('recentActivity');
        if (!container) return;

        if (activities.length === 0) {
            container.innerHTML = '<div class="text-muted text-center py-3">No recent activity</div>';
            return;
        }

        const html = activities.map(activity => {
            const timeAgo = this.formatTimeAgo(activity.updated_at);
            const statusClass = `activity-${activity.status}`;
            const icon = this.getActivityIcon(activity.status);
            
            return `
                <div class="recent-activity-item ${statusClass}">
                    <div class="d-flex justify-content-between align-items-start">
                        <div class="flex-grow-1">
                            <div class="fw-medium">${activity.name || 'Unknown Migration'}</div>
                            <small class="text-muted">
                                ${icon} ${this.formatStatus(activity.status)} · ${activity.affected_users} users
                            </small>
                        </div>
                        <small class="text-muted">${timeAgo}</small>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
    }

    updatePerformanceChart(performance) {
        if (!this.performanceChart || !performance) return;

        // For now, show current values as the latest point
        // In a full implementation, this would show time series data
        const now = new Date().toLocaleTimeString();
        
        this.performanceChart.data.labels.push(now);
        this.performanceChart.data.datasets[0].data.push(performance.avgErrorRate * 100);
        this.performanceChart.data.datasets[1].data.push(performance.avgResponseTime);
        this.performanceChart.data.datasets[2].data.push(performance.avgSatisfaction * 100);

        // Keep only last 10 points
        if (this.performanceChart.data.labels.length > 10) {
            this.performanceChart.data.labels.shift();
            this.performanceChart.data.datasets.forEach(dataset => dataset.data.shift());
        }

        this.performanceChart.update();
    }

    renderMigrationsTable() {
        const tbody = document.getElementById('migrationsTableBody');
        if (!tbody) return;

        if (this.migrations.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center text-muted py-4">No migrations found</td>
                </tr>
            `;
            return;
        }

        const html = this.migrations.map(migration => {
            const config = migration.config || {};
            const progress = this.calculateProgress(config);
            const performanceIndicator = this.getPerformanceIndicator(migration);
            
            return `
                <tr>
                    <td>
                        <div class="fw-medium">${config.name || 'Unknown Migration'}</div>
                        <small class="text-muted">
                            ${this.getThemeName(config.sourceTheme)} → ${this.getThemeName(config.targetTheme)}
                        </small>
                    </td>
                    <td>
                        ${config.currentPhase ? `<span class="migration-phase phase-${config.currentPhase}">${config.currentPhase}</span>` : '-'}
                    </td>
                    <td>
                        <div class="progress" style="height: 8px;">
                            <div class="progress-bar bg-primary" role="progressbar" 
                                 style="width: ${progress}%"></div>
                        </div>
                        <small class="text-muted">${progress}%</small>
                    </td>
                    <td>${migration.affected_users || 0}</td>
                    <td>
                        <span class="performance-indicator ${performanceIndicator.class}"></span>
                        ${performanceIndicator.text}
                    </td>
                    <td>
                        <span class="status-badge status-${migration.status}">${this.formatStatus(migration.status)}</span>
                    </td>
                    <td>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-primary" onclick="migrationDashboard.viewMigrationDetails('${migration.id}')">
                                <i class="bi bi-eye"></i>
                            </button>
                            ${migration.status === 'in_progress' ? 
                                `<button class="btn btn-outline-danger" onclick="migrationDashboard.confirmRollback('${migration.id}')">
                                    <i class="bi bi-arrow-counterclockwise"></i>
                                </button>` : 
                                ''
                            }
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        tbody.innerHTML = html;
    }

    async handleStartMigration() {
        try {
            const formData = new FormData(document.getElementById('migrationForm'));
            const migrationData = {
                name: formData.get('name'),
                description: formData.get('description'),
                sourceTheme: parseInt(formData.get('sourceTheme')),
                targetTheme: parseInt(formData.get('targetTheme')),
                schedule: formData.get('schedule'),
                selectionStrategy: formData.get('selectionStrategy'),
                targetModels: Array.from(document.getElementById('targetModelsSelect').selectedOptions).map(option => parseInt(option.value)).filter(v => v)
            };

            // Add advanced settings if enabled
            const showAdvanced = document.getElementById('showAdvanced').checked;
            if (showAdvanced) {
                migrationData.testCriteria = {
                    errorRate: parseFloat(formData.get('maxErrorRate')) / 100,
                    performanceDegradation: parseFloat(formData.get('maxPerfDegradation')) / 100,
                    userSatisfaction: parseFloat(formData.get('minSatisfaction')) / 100
                };
            }

            // Validate required fields
            if (!migrationData.name || !migrationData.sourceTheme || !migrationData.targetTheme) {
                throw new Error('Please fill in all required fields');
            }

            if (migrationData.sourceTheme === migrationData.targetTheme) {
                throw new Error('Source and target themes must be different');
            }

            const response = await fetch('/api/theme-migrations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(migrationData)
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.message || 'Failed to start migration');
            }

            this.showSuccess('Migration started successfully!');
            bootstrap.Modal.getInstance(document.getElementById('migrationModal')).hide();
            document.getElementById('migrationForm').reset();
            
            // Refresh data
            setTimeout(() => {
                this.loadMigrations();
                this.loadDashboardOverview();
            }, 1000);

        } catch (error) {
            console.error('Error starting migration:', error);
            this.showError(error.message);
        }
    }

    async handleCreateAbTest() {
        try {
            const formData = new FormData(document.getElementById('abTestForm'));
            const testData = {
                name: formData.get('name'),
                description: formData.get('description'),
                controlTheme: parseInt(formData.get('controlTheme')),
                variantTheme: parseInt(formData.get('variantTheme')),
                trafficSplit: parseFloat(formData.get('trafficSplit')),
                duration: parseInt(formData.get('duration')),
                targetModels: Array.from(document.getElementById('abTestTargetModels').selectedOptions).map(option => parseInt(option.value)).filter(v => v)
            };

            // Validate required fields
            if (!testData.name || !testData.controlTheme || !testData.variantTheme) {
                throw new Error('Please fill in all required fields');
            }

            if (testData.controlTheme === testData.variantTheme) {
                throw new Error('Control and variant themes must be different');
            }

            const response = await fetch('/api/theme-migrations/ab-tests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(testData)
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.message || 'Failed to create A/B test');
            }

            this.showSuccess('A/B test created successfully!');
            bootstrap.Modal.getInstance(document.getElementById('abTestModal')).hide();
            document.getElementById('abTestForm').reset();

        } catch (error) {
            console.error('Error creating A/B test:', error);
            this.showError(error.message);
        }
    }

    async viewMigrationDetails(migrationId) {
        try {
            const response = await fetch(`/api/theme-migrations/${migrationId}`);
            if (!response.ok) throw new Error('Failed to load migration details');
            
            const result = await response.json();
            const migration = result.data;
            
            document.getElementById('migrationDetailTitle').textContent = migration.name || 'Migration Details';
            
            // Build detailed view
            const detailHTML = this.buildMigrationDetailView(migration);
            document.getElementById('migrationDetailContent').innerHTML = detailHTML;
            
            // Show/hide rollback button
            const rollbackBtn = document.getElementById('rollbackMigrationBtn');
            if (migration.status === 'in_progress') {
                rollbackBtn.classList.remove('d-none');
                rollbackBtn.dataset.migrationId = migrationId;
            } else {
                rollbackBtn.classList.add('d-none');
            }
            
            const modal = new bootstrap.Modal(document.getElementById('migrationDetailModal'));
            modal.show();

        } catch (error) {
            console.error('Error loading migration details:', error);
            this.showError('Failed to load migration details');
        }
    }

    buildMigrationDetailView(migration) {
        const phases = migration.phases || [];
        const metrics = migration.metrics || {};
        
        return `
            <div class="row mb-4">
                <div class="col-md-6">
                    <h6>Migration Overview</h6>
                    <dl class="row">
                        <dt class="col-sm-4">Status:</dt>
                        <dd class="col-sm-8"><span class="status-badge status-${migration.status}">${this.formatStatus(migration.status)}</span></dd>
                        
                        <dt class="col-sm-4">Progress:</dt>
                        <dd class="col-sm-8">${migration.progress}%</dd>
                        
                        <dt class="col-sm-4">Current Phase:</dt>
                        <dd class="col-sm-8">${migration.currentPhase || 'N/A'}</dd>
                        
                        <dt class="col-sm-4">Affected Users:</dt>
                        <dd class="col-sm-8">${metrics.migratedUsers || 0}</dd>
                    </dl>
                </div>
                <div class="col-md-6">
                    <h6>Timing</h6>
                    <dl class="row">
                        <dt class="col-sm-4">Started:</dt>
                        <dd class="col-sm-8">${new Date(migration.startTime).toLocaleString()}</dd>
                        
                        <dt class="col-sm-4">Estimated Completion:</dt>
                        <dd class="col-sm-8">${migration.estimatedCompletion ? new Date(migration.estimatedCompletion).toLocaleString() : 'N/A'}</dd>
                    </dl>
                </div>
            </div>

            ${phases.length > 0 ? `
                <div class="mb-4">
                    <h6>Phase Progress</h6>
                    <div class="table-responsive">
                        <table class="table table-sm">
                            <thead>
                                <tr>
                                    <th>Phase</th>
                                    <th>Target %</th>
                                    <th>Users</th>
                                    <th>Duration</th>
                                    <th>Status</th>
                                    <th>Performance</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${phases.map(phase => `
                                    <tr>
                                        <td><span class="migration-phase phase-${phase.name}">${phase.name}</span></td>
                                        <td>${phase.percentage}%</td>
                                        <td>${phase.actualUserCount}/${phase.targetUserCount}</td>
                                        <td>${this.formatDuration(phase.duration)}</td>
                                        <td><span class="status-badge status-${phase.status}">${this.formatStatus(phase.status)}</span></td>
                                        <td>
                                            ${phase.metrics ? `
                                                <small>
                                                    Error: ${(phase.metrics.errorRate * 100).toFixed(2)}%<br>
                                                    Response: ${Math.round(phase.metrics.avgResponseTime)}ms
                                                </small>
                                            ` : 'N/A'}
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            ` : ''}

            <div class="row">
                <div class="col-12">
                    <h6>Performance Metrics</h6>
                    <div class="row">
                        <div class="col-md-4">
                            <div class="card bg-light">
                                <div class="card-body text-center">
                                    <h5 class="card-title">${(metrics.errorRate || 0).toFixed(3)}%</h5>
                                    <p class="card-text">Error Rate</p>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="card bg-light">
                                <div class="card-body text-center">
                                    <h5 class="card-title">${Math.round(metrics.avgResponseTime || 0)}ms</h5>
                                    <p class="card-text">Avg Response Time</p>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="card bg-light">
                                <div class="card-body text-center">
                                    <h5 class="card-title">${((metrics.userSatisfaction || 0) * 100).toFixed(1)}%</h5>
                                    <p class="card-text">User Satisfaction</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    confirmRollback(migrationId) {
        document.getElementById('confirmationTitle').textContent = 'Confirm Migration Rollback';
        document.getElementById('confirmationBody').innerHTML = `
            <div class="alert alert-warning">
                <i class="bi bi-exclamation-triangle"></i>
                <strong>Warning:</strong> This will immediately rollback the migration, reverting all affected users to the original theme.
            </div>
            <p>Are you sure you want to rollback this migration? This action cannot be undone.</p>
        `;
        
        const confirmBtn = document.getElementById('confirmActionBtn');
        confirmBtn.textContent = 'Rollback Migration';
        confirmBtn.className = 'btn btn-danger';
        confirmBtn.dataset.action = 'rollback';
        confirmBtn.dataset.migrationId = migrationId;
        
        const modal = new bootstrap.Modal(document.getElementById('confirmationModal'));
        modal.show();
    }

    async executeConfirmedAction() {
        const confirmBtn = document.getElementById('confirmActionBtn');
        const action = confirmBtn.dataset.action;
        const migrationId = confirmBtn.dataset.migrationId;
        
        try {
            if (action === 'rollback') {
                await this.rollbackMigration(migrationId);
            }
            
            bootstrap.Modal.getInstance(document.getElementById('confirmationModal')).hide();
        } catch (error) {
            console.error('Error executing confirmed action:', error);
            this.showError(error.message);
        }
    }

    async rollbackMigration(migrationId) {
        try {
            const response = await fetch(`/api/theme-migrations/${migrationId}/rollback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason: 'Manual rollback from dashboard' })
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.message || 'Failed to rollback migration');
            }

            this.showSuccess('Migration rollback completed successfully');
            
            // Close detail modal if open
            const detailModal = bootstrap.Modal.getInstance(document.getElementById('migrationDetailModal'));
            if (detailModal) detailModal.hide();
            
            // Refresh data
            setTimeout(() => {
                this.loadMigrations();
                this.loadDashboardOverview();
            }, 1000);

        } catch (error) {
            console.error('Error rolling back migration:', error);
            throw error;
        }
    }

    startAutoRefresh() {
        // Refresh overview and active migrations every 30 seconds
        this.refreshInterval = setInterval(() => {
            this.loadDashboardOverview();
            
            // Only refresh migrations if showing active ones
            const statusFilter = document.getElementById('statusFilter');
            if (!statusFilter || statusFilter.value === '' || statusFilter.value === 'in_progress') {
                this.loadMigrations(statusFilter?.value || '');
            }
        }, 30000);
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    // Utility methods
    getThemeName(themeId) {
        const theme = this.themes.find(t => t.id == themeId);
        return theme ? (theme.display_name || theme.name) : `Theme ${themeId}`;
    }

    calculateProgress(config) {
        // Simple progress calculation based on status and phase
        switch (config.status) {
            case 'completed': return 100;
            case 'rolled_back': return 0;
            case 'failed': return 0;
            case 'in_progress':
                const phases = ['canary', 'pilot', 'staged', 'production'];
                const currentIndex = phases.indexOf(config.currentPhase);
                return currentIndex >= 0 ? ((currentIndex + 1) / phases.length) * 100 : 25;
            default: return 10;
        }
    }

    getPerformanceIndicator(migration) {
        // Mock performance indicator - in real implementation would use actual metrics
        const random = Math.random();
        if (random > 0.8) return { class: 'perf-excellent', text: 'Excellent' };
        if (random > 0.6) return { class: 'perf-good', text: 'Good' };
        if (random > 0.3) return { class: 'perf-warning', text: 'Warning' };
        return { class: 'perf-poor', text: 'Poor' };
    }

    getActivityIcon(status) {
        switch (status) {
            case 'completed': return '✅';
            case 'in_progress': return '🔄';
            case 'rolled_back': return '↩️';
            case 'failed': return '❌';
            default: return '📝';
        }
    }

    formatStatus(status) {
        return status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
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

    formatDuration(milliseconds) {
        if (!milliseconds) return '0s';
        
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    }

    formatNumber(num) {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    }

    showMigrationsError() {
        const tbody = document.getElementById('migrationsTableBody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center text-danger py-4">
                        <i class="bi bi-exclamation-triangle"></i>
                        Failed to load migrations
                    </td>
                </tr>
            `;
        }
    }

    showSuccess(message) {
        // In a full implementation, this would show a toast notification
        console.log('Success:', message);
        alert(message); // Temporary
    }

    showError(message) {
        // In a full implementation, this would show a toast notification  
        console.error('Error:', message);
        alert('Error: ' + message); // Temporary
    }

    // Cleanup
    destroy() {
        this.stopAutoRefresh();
        if (this.performanceChart) {
            this.performanceChart.destroy();
        }
    }
}

// Initialize dashboard when DOM is loaded
let migrationDashboard;
document.addEventListener('DOMContentLoaded', () => {
    migrationDashboard = new ThemeMigrationDashboard();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (migrationDashboard) {
        migrationDashboard.destroy();
    }
});