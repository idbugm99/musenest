/**
 * AI Performance Dashboard Controller
 * 
 * Manages the AI-powered performance prediction dashboard interface,
 * including load time prediction, resource forecasting, anomaly detection,
 * and optimization recommendations.
 */

class AIPerformanceDashboard {
    constructor() {
        this.refreshInterval = null;
        this.currentFilter = 'all';
        this.isLoading = false;
        
        // Auto-refresh every 5 minutes
        this.autoRefreshInterval = 5 * 60 * 1000;
        
        this.init();
    }
    
    /**
     * Initialize the dashboard
     */
    async init() {
        try {
            console.log('🤖 Initializing AI Performance Dashboard...');
            
            // Load initial data
            await this.refreshDashboard();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Start auto-refresh
            this.startAutoRefresh();
            
            console.log('✅ AI Performance Dashboard initialized');
            
        } catch (error) {
            console.error('❌ Failed to initialize AI Performance Dashboard:', error);
            this.showError('Failed to initialize dashboard');
        }
    }
    
    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Prediction type filter buttons
        document.querySelectorAll('[data-prediction-type]').forEach(button => {
            button.addEventListener('click', (e) => {
                const type = e.target.dataset.predictionType;
                this.filterPredictions(type);
                
                // Update active button
                document.querySelectorAll('[data-prediction-type]').forEach(btn => 
                    btn.classList.remove('active'));
                e.target.classList.add('active');
            });
        });
        
        // Auto-refresh toggle
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.stopAutoRefresh();
            } else {
                this.startAutoRefresh();
                this.refreshDashboard();
            }
        });
    }
    
    /**
     * Refresh all dashboard data
     */
    async refreshDashboard() {
        if (this.isLoading) return;
        
        try {
            this.isLoading = true;
            console.log('🔄 Refreshing AI Performance Dashboard...');
            
            // Refresh all sections in parallel
            await Promise.all([
                this.loadServiceHealth(),
                this.loadModelsStatus(),
                this.loadRecentPredictions(),
                this.loadOptimizationRecommendations(),
                this.loadRecentAnomalies()
            ]);
            
            console.log('✅ Dashboard refresh completed');
            
        } catch (error) {
            console.error('❌ Dashboard refresh failed:', error);
            this.showError('Failed to refresh dashboard data');
        } finally {
            this.isLoading = false;
        }
    }
    
    /**
     * Load service health status
     */
    async loadServiceHealth() {
        try {
            const response = await fetch('/api/performance-prediction/health');
            const data = await response.json();
            
            const statusElement = document.getElementById('serviceStatus');
            
            if (data.status === 'healthy') {
                statusElement.innerHTML = `
                    <div class="status-indicator status-healthy">
                        <i class="bi bi-check-circle-fill"></i>
                    </div>
                    <h6 class="text-success mb-1">Service Healthy</h6>
                    <small class="text-muted">All systems operational</small>
                `;
            } else if (data.status === 'degraded') {
                statusElement.innerHTML = `
                    <div class="status-indicator status-warning">
                        <i class="bi bi-exclamation-triangle-fill"></i>
                    </div>
                    <h6 class="text-warning mb-1">Service Degraded</h6>
                    <small class="text-muted">Some components unavailable</small>
                `;
            } else {
                statusElement.innerHTML = `
                    <div class="status-indicator status-error">
                        <i class="bi bi-x-circle-fill"></i>
                    </div>
                    <h6 class="text-danger mb-1">Service Error</h6>
                    <small class="text-muted">Service unavailable</small>
                `;
            }
            
        } catch (error) {
            console.error('Error loading service health:', error);
            document.getElementById('serviceStatus').innerHTML = `
                <div class="status-indicator status-error">
                    <i class="bi bi-wifi-off"></i>
                </div>
                <h6 class="text-danger mb-1">Connection Error</h6>
                <small class="text-muted">Cannot reach service</small>
            `;
        }
    }
    
    /**
     * Load ML models status
     */
    async loadModelsStatus() {
        try {
            const response = await fetch('/api/performance-prediction/models');
            const data = await response.json();
            
            if (data.success && data.models) {
                this.renderModelsStatus(data.models);
            } else {
                throw new Error('Invalid models data received');
            }
            
        } catch (error) {
            console.error('Error loading models status:', error);
            document.getElementById('modelsStatus').innerHTML = `
                <div class="col-12 text-center text-danger">
                    <i class="bi bi-exclamation-triangle"></i>
                    <span class="ms-2">Failed to load models status</span>
                </div>
            `;
        }
    }
    
    /**
     * Render ML models status
     */
    renderModelsStatus(models) {
        const container = document.getElementById('modelsStatus');
        
        container.innerHTML = models.map(model => `
            <div class="col-md-6 col-lg-3 mb-2">
                <div class="model-status-card card border-0 p-2 ${model.healthStatus}">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h6 class="mb-1 small">${this.formatModelName(model.model_name)}</h6>
                            <div class="d-flex align-items-center">
                                <span class="accuracy-badge bg-${this.getAccuracyColor(model.accuracy)} text-white">
                                    ${(model.accuracy * 100).toFixed(1)}%
                                </span>
                                ${model.needsRetraining ? 
                                    '<i class="bi bi-exclamation-triangle text-warning ms-2" title="Needs retraining"></i>' : 
                                    '<i class="bi bi-check-circle text-success ms-2" title="Up to date"></i>'
                                }
                            </div>
                        </div>
                        <div class="text-end">
                            <small class="text-muted">
                                ${model.last_trained_at ? 
                                    this.timeAgo(new Date(model.last_trained_at)) : 
                                    'Not trained'
                                }
                            </small>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    }
    
    /**
     * Load recent predictions
     */
    async loadRecentPredictions() {
        try {
            const response = await fetch('/api/performance-prediction/predictions?limit=20');
            const data = await response.json();
            
            if (data.success && data.predictions) {
                this.renderPredictionsTable(data.predictions);
            } else {
                throw new Error('Invalid predictions data received');
            }
            
        } catch (error) {
            console.error('Error loading recent predictions:', error);
            document.getElementById('predictionsTableBody').innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-danger">
                        <i class="bi bi-exclamation-triangle"></i>
                        <span class="ms-2">Failed to load predictions</span>
                    </td>
                </tr>
            `;
        }
    }
    
    /**
     * Render predictions table
     */
    renderPredictionsTable(predictions) {
        const tbody = document.getElementById('predictionsTableBody');
        
        if (predictions.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-muted">
                        <i class="bi bi-inbox"></i>
                        <span class="ms-2">No predictions found</span>
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = predictions.map(prediction => `
            <tr>
                <td>
                    <span class="badge bg-${this.getPredictionTypeColor(prediction.prediction_type)}">
                        ${this.formatPredictionType(prediction.prediction_type)}
                    </span>
                </td>
                <td class="small">${this.formatModelName(prediction.model_name)}</td>
                <td>
                    ${prediction.predicted_load_time ? 
                        `<strong>${parseFloat(prediction.predicted_load_time).toFixed(2)}s</strong>` :
                        '<span class="text-muted">Complex result</span>'
                    }
                    ${prediction.performance_category ? 
                        `<br><small class="text-muted">${this.formatCategory(prediction.performance_category)}</small>` : 
                        ''
                    }
                </td>
                <td>
                    <div class="d-flex align-items-center">
                        <span class="me-2">${(prediction.confidence_score * 100).toFixed(0)}%</span>
                        <div class="confidence-bar" style="width: 50px;">
                            <div class="confidence-indicator" style="width: ${prediction.confidence_score * 100}%"></div>
                        </div>
                    </div>
                </td>
                <td class="small text-muted">${this.timeAgo(new Date(prediction.created_at))}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" onclick="aiDashboard.viewPredictionDetails('${prediction.prediction_key}')">
                        <i class="bi bi-eye"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }
    
    /**
     * Load optimization recommendations
     */
    async loadOptimizationRecommendations() {
        try {
            const response = await fetch('/api/performance-prediction/recommendations?limit=10');
            const data = await response.json();
            
            if (data.success && data.recommendations) {
                this.renderOptimizationRecommendations(data.recommendations);
            } else {
                throw new Error('Invalid recommendations data received');
            }
            
        } catch (error) {
            console.error('Error loading optimization recommendations:', error);
            document.getElementById('optimizationRecommendations').innerHTML = `
                <div class="alert alert-danger">
                    <i class="bi bi-exclamation-triangle"></i>
                    Failed to load optimization recommendations
                </div>
            `;
        }
    }
    
    /**
     * Render optimization recommendations
     */
    renderOptimizationRecommendations(recommendations) {
        const container = document.getElementById('optimizationRecommendations');
        
        if (recommendations.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted py-4">
                    <i class="bi bi-lightbulb fs-1"></i>
                    <p>No optimization recommendations available</p>
                    <p class="small">Run performance analysis to generate recommendations</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = recommendations.map(rec => `
            <div class="recommendation-card card p-3 priority-${rec.priority}">
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <div>
                        <h6 class="mb-1">${rec.title}</h6>
                        <p class="text-muted mb-2 small">${rec.description}</p>
                    </div>
                    <div class="text-end">
                        <span class="badge bg-${this.getPriorityColor(rec.priority)} mb-1">${rec.priority.toUpperCase()}</span>
                        <br>
                        <span class="badge bg-${this.getImpactColor(rec.impact_level)}">${rec.impact_level} Impact</span>
                    </div>
                </div>
                <div class="row text-center">
                    <div class="col-4">
                        <small class="text-muted d-block">Effort</small>
                        <strong>${rec.effort_level}</strong>
                    </div>
                    <div class="col-4">
                        <small class="text-muted d-block">Confidence</small>
                        <strong>${(rec.confidence_score * 100).toFixed(0)}%</strong>
                    </div>
                    <div class="col-4">
                        <small class="text-muted d-block">Status</small>
                        <span class="badge bg-${this.getStatusColor(rec.status)}">${rec.status}</span>
                    </div>
                </div>
                ${rec.actions && rec.actions.length > 0 ? `
                    <div class="mt-2">
                        <small class="text-muted">Actions:</small>
                        <ul class="list-unstyled small mb-0">
                            ${rec.actions.slice(0, 3).map(action => `<li class="text-muted">• ${action}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
            </div>
        `).join('');
    }
    
    /**
     * Load recent anomalies
     */
    async loadRecentAnomalies() {
        try {
            const response = await fetch('/api/performance-prediction/analytics');
            const data = await response.json();
            
            if (data.success && data.analytics.recentAnomalies) {
                this.renderRecentAnomalies(data.analytics.recentAnomalies);
            } else {
                throw new Error('Invalid anomalies data received');
            }
            
        } catch (error) {
            console.error('Error loading recent anomalies:', error);
            document.getElementById('recentAnomalies').innerHTML = `
                <div class="text-danger small">
                    <i class="bi bi-exclamation-triangle"></i>
                    Failed to load anomalies
                </div>
            `;
        }
    }
    
    /**
     * Render recent anomalies
     */
    renderRecentAnomalies(anomalies) {
        const container = document.getElementById('recentAnomalies');
        
        if (anomalies.length === 0) {
            container.innerHTML = `
                <div class="text-center text-success small">
                    <i class="bi bi-shield-check"></i>
                    <p class="mb-0">No recent anomalies</p>
                    <p class="mb-0 text-muted">System is performing normally</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = anomalies.map(anomaly => `
            <div class="anomaly-alert small mb-2">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <strong class="text-danger">${this.formatAnomalyType(anomaly.anomaly_type)}</strong>
                        <br>
                        <span class="text-muted">Severity: ${anomaly.severity}</span>
                    </div>
                    <div class="text-end">
                        <span class="badge bg-danger">${anomaly.count}</span>
                        <br>
                        <small class="text-muted">${(anomaly.avg_confidence * 100).toFixed(0)}% conf</small>
                    </div>
                </div>
            </div>
        `).join('');
    }
    
    /**
     * Show load time prediction modal
     */
    showLoadTimePredictionModal() {
        const modal = new bootstrap.Modal(document.getElementById('loadTimePredictionModal'));
        modal.show();
    }
    
    /**
     * Run load time prediction
     */
    async runLoadTimePrediction() {
        try {
            const form = document.getElementById('loadTimePredictionForm');
            const formData = new FormData(form);
            
            const galleryConfig = {
                modelId: parseInt(formData.get('modelId')),
                themeId: parseInt(formData.get('themeId')),
                imageCount: parseInt(formData.get('imageCount')) || 25
            };
            
            const userContext = {
                deviceType: formData.get('deviceType'),
                connectionSpeed: formData.get('connectionSpeed')
            };
            
            const response = await fetch('/api/performance-prediction/load-time', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ galleryConfig, userContext })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.displayLoadTimePrediction(data.prediction);
                bootstrap.Modal.getInstance(document.getElementById('loadTimePredictionModal')).hide();
            } else {
                throw new Error(data.error || 'Prediction failed');
            }
            
        } catch (error) {
            console.error('Load time prediction error:', error);
            this.showError('Failed to generate load time prediction');
        }
    }
    
    /**
     * Display load time prediction result
     */
    displayLoadTimePrediction(prediction) {
        const container = document.getElementById('loadTimePredictionResult');
        
        container.innerHTML = `
            <div class="prediction-result">
                <div class="row text-center mb-3">
                    <div class="col-4">
                        <h3 class="text-primary mb-1">${prediction.predictedLoadTime.toFixed(2)}s</h3>
                        <small class="text-muted">Predicted Load Time</small>
                    </div>
                    <div class="col-4">
                        <h3 class="text-${this.getCategoryColor(prediction.category)} mb-1">${prediction.category.toUpperCase()}</h3>
                        <small class="text-muted">Performance Category</small>
                    </div>
                    <div class="col-4">
                        <h3 class="text-info mb-1">${(prediction.confidence * 100).toFixed(0)}%</h3>
                        <small class="text-muted">Confidence</small>
                    </div>
                </div>
                
                ${prediction.recommendations && prediction.recommendations.length > 0 ? `
                    <div class="mt-3">
                        <h6>Recommendations:</h6>
                        <ul class="list-unstyled small">
                            ${prediction.recommendations.map(rec => 
                                `<li class="mb-1">
                                    <i class="bi bi-lightbulb text-warning me-2"></i>
                                    ${rec.description}
                                    <span class="badge bg-${this.getImpactColor(rec.impact)} ms-2">${rec.impact} impact</span>
                                </li>`
                            ).join('')}
                        </ul>
                    </div>
                ` : ''}
                
                <div class="text-end mt-2">
                    <small class="text-muted">Generated: ${this.timeAgo(new Date(prediction.timestamp))}</small>
                </div>
            </div>
        `;
    }
    
    /**
     * Show resource prediction modal
     */
    showResourcePredictionModal() {
        const modal = new bootstrap.Modal(document.getElementById('resourcePredictionModal'));
        modal.show();
    }
    
    /**
     * Run resource usage prediction
     */
    async runResourcePrediction() {
        try {
            const form = document.getElementById('resourcePredictionForm');
            const formData = new FormData(form);
            
            const loadPattern = {
                expectedUsers: parseInt(formData.get('expectedUsers')),
                peakHour: formData.get('peakHour') === 'true'
            };
            
            const timeHorizon = formData.get('timeHorizon');
            
            const response = await fetch('/api/performance-prediction/resource-usage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ loadPattern, timeHorizon })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.displayResourcePrediction(data.prediction);
                bootstrap.Modal.getInstance(document.getElementById('resourcePredictionModal')).hide();
            } else {
                throw new Error(data.error || 'Prediction failed');
            }
            
        } catch (error) {
            console.error('Resource prediction error:', error);
            this.showError('Failed to generate resource usage forecast');
        }
    }
    
    /**
     * Display resource prediction result
     */
    displayResourcePrediction(prediction) {
        const container = document.getElementById('resourcePredictionResult');
        
        // Default prediction structure for fallback
        const predictions = prediction.predictions || {
            cpu: { value: 45, confidence: 0.7 },
            memory: { value: 60, confidence: 0.7 },
            database: { value: 30, confidence: 0.7 },
            network: { value: 25, confidence: 0.7 }
        };
        
        container.innerHTML = `
            <div class="prediction-result">
                <div class="row mb-3">
                    <div class="col-6 col-md-3 text-center mb-2">
                        <div class="text-info mb-1">
                            <i class="bi bi-cpu fs-4"></i>
                        </div>
                        <strong>${predictions.cpu.value || 45}%</strong>
                        <br><small class="text-muted">CPU Usage</small>
                    </div>
                    <div class="col-6 col-md-3 text-center mb-2">
                        <div class="text-warning mb-1">
                            <i class="bi bi-memory fs-4"></i>
                        </div>
                        <strong>${predictions.memory.value || 60}%</strong>
                        <br><small class="text-muted">Memory</small>
                    </div>
                    <div class="col-6 col-md-3 text-center mb-2">
                        <div class="text-success mb-1">
                            <i class="bi bi-database fs-4"></i>
                        </div>
                        <strong>${predictions.database.value || 30}%</strong>
                        <br><small class="text-muted">Database</small>
                    </div>
                    <div class="col-6 col-md-3 text-center mb-2">
                        <div class="text-primary mb-1">
                            <i class="bi bi-wifi fs-4"></i>
                        </div>
                        <strong>${predictions.network.value || 25}%</strong>
                        <br><small class="text-muted">Network</small>
                    </div>
                </div>
                
                <div class="row">
                    <div class="col-md-6">
                        <h6>Time Horizon:</h6>
                        <p class="text-muted">${prediction.timeHorizon}</p>
                    </div>
                    <div class="col-md-6">
                        <h6>Overall Confidence:</h6>
                        <p class="text-muted">${(prediction.confidence * 100).toFixed(0)}%</p>
                    </div>
                </div>
                
                <div class="text-end mt-2">
                    <small class="text-muted">Generated: ${this.timeAgo(new Date(prediction.timestamp))}</small>
                </div>
            </div>
        `;
    }
    
    /**
     * Run anomaly detection
     */
    async runAnomalyDetection() {
        try {
            // Get current system metrics (simplified for demo)
            const metrics = {
                responseTime: Math.random() * 3 + 1, // 1-4 seconds
                errorRate: Math.random() * 0.05,     // 0-5%
                throughput: Math.random() * 200 + 100, // 100-300 req/s
                cpuUsage: Math.random() * 0.4 + 0.4   // 40-80%
            };
            
            const response = await fetch('/api/performance-prediction/detect-anomalies', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ metrics })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.displayAnomalyDetectionResult(data.anomalies);
            } else {
                throw new Error(data.error || 'Anomaly detection failed');
            }
            
        } catch (error) {
            console.error('Anomaly detection error:', error);
            this.showError('Failed to run anomaly detection');
        }
    }
    
    /**
     * Display anomaly detection result
     */
    displayAnomalyDetectionResult(result) {
        const container = document.getElementById('anomalyDetectionResult');
        
        if (!result.hasAnomalies) {
            container.innerHTML = `
                <div class="anomaly-normal text-center py-4">
                    <i class="bi bi-shield-check fs-1 text-success"></i>
                    <h5 class="text-success mt-2">No Anomalies Detected</h5>
                    <p class="text-muted">System is performing within normal parameters</p>
                    <div class="small">
                        <strong>Overall Score:</strong> ${result.overallScore || 'Normal'}
                        <br>
                        <small class="text-muted">Checked: ${this.timeAgo(new Date(result.timestamp))}</small>
                    </div>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="anomaly-alert">
                    <div class="text-center mb-3">
                        <i class="bi bi-exclamation-triangle fs-1 text-danger"></i>
                        <h5 class="text-danger mt-2">Anomalies Detected</h5>
                        <p class="text-muted">${result.anomalies.length} performance anomalies found</p>
                    </div>
                    
                    <div class="row">
                        ${result.anomalies.map(anomaly => `
                            <div class="col-md-6 mb-2">
                                <div class="card border-danger">
                                    <div class="card-body p-2">
                                        <h6 class="text-danger mb-1">${this.formatAnomalyType(anomaly.type)}</h6>
                                        <p class="small text-muted mb-1">${anomaly.metric}: ${anomaly.currentValue}</p>
                                        <div class="d-flex justify-content-between align-items-center">
                                            <span class="badge bg-${this.getSeverityColor(anomaly.severity)}">${anomaly.severity}</span>
                                            <small class="text-muted">${(anomaly.confidence * 100).toFixed(0)}% conf</small>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    
                    <div class="text-end mt-2">
                        <small class="text-muted">Detected: ${this.timeAgo(new Date(result.timestamp))}</small>
                    </div>
                </div>
            `;
        }
    }
    
    /**
     * Train ML models
     */
    async trainModels() {
        try {
            const form = document.getElementById('trainModelsForm');
            const formData = new FormData(form);
            const modelName = formData.get('modelName');
            
            const payload = modelName ? { modelName } : {};
            
            const response = await fetch('/api/performance-prediction/models/train', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            const data = await response.json();
            
            if (data.success) {
                bootstrap.Modal.getInstance(document.getElementById('trainModelsModal')).hide();
                this.showSuccess(data.message);
                
                // Refresh models status after training
                setTimeout(() => this.loadModelsStatus(), 2000);
            } else {
                throw new Error(data.error || 'Training failed');
            }
            
        } catch (error) {
            console.error('Model training error:', error);
            this.showError('Failed to start model training');
        }
    }
    
    /**
     * Filter recommendations by priority
     */
    filterRecommendations(priority) {
        this.currentFilter = priority;
        this.loadOptimizationRecommendations();
    }
    
    /**
     * Filter predictions by type
     */
    filterPredictions(type) {
        const url = type === 'all' ? 
            '/api/performance-prediction/predictions?limit=20' :
            `/api/performance-prediction/predictions?type=${type}&limit=20`;
            
        fetch(url)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    this.renderPredictionsTable(data.predictions);
                }
            })
            .catch(error => {
                console.error('Error filtering predictions:', error);
            });
    }
    
    /**
     * Start auto-refresh
     */
    startAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        
        this.refreshInterval = setInterval(() => {
            if (!document.hidden && !this.isLoading) {
                this.refreshDashboard();
            }
        }, this.autoRefreshInterval);
    }
    
    /**
     * Stop auto-refresh
     */
    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }
    
    // Utility Methods
    formatModelName(modelName) {
        return modelName.replace(/_/g, ' ')
                       .replace(/\b\w/g, l => l.toUpperCase());
    }
    
    formatPredictionType(type) {
        return type.replace(/_/g, ' ')
                  .replace(/\b\w/g, l => l.toUpperCase());
    }
    
    formatAnomalyType(type) {
        return type.replace(/_/g, ' ')
                  .replace(/\b\w/g, l => l.toUpperCase());
    }
    
    formatCategory(category) {
        return category.charAt(0).toUpperCase() + category.slice(1);
    }
    
    getAccuracyColor(accuracy) {
        if (accuracy >= 0.8) return 'success';
        if (accuracy >= 0.7) return 'info';
        if (accuracy >= 0.6) return 'warning';
        return 'danger';
    }
    
    getPredictionTypeColor(type) {
        const colors = {
            'load_time': 'primary',
            'resource_usage': 'info',
            'anomaly_detection': 'warning',
            'optimization': 'success'
        };
        return colors[type] || 'secondary';
    }
    
    getPriorityColor(priority) {
        const colors = { high: 'danger', medium: 'warning', low: 'info', critical: 'dark' };
        return colors[priority] || 'secondary';
    }
    
    getImpactColor(impact) {
        const colors = { high: 'success', medium: 'info', low: 'secondary' };
        return colors[impact] || 'secondary';
    }
    
    getStatusColor(status) {
        const colors = {
            pending: 'warning',
            in_progress: 'info', 
            completed: 'success',
            rejected: 'danger'
        };
        return colors[status] || 'secondary';
    }
    
    getCategoryColor(category) {
        const colors = {
            excellent: 'success',
            good: 'info',
            acceptable: 'warning',
            poor: 'danger'
        };
        return colors[category] || 'secondary';
    }
    
    getSeverityColor(severity) {
        const colors = {
            low: 'info',
            medium: 'warning', 
            high: 'danger',
            critical: 'dark'
        };
        return colors[severity] || 'secondary';
    }
    
    timeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        
        if (seconds < 60) return 'Just now';
        
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    }
    
    showSuccess(message) {
        // You can implement toast notifications here
        console.log('✅', message);
    }
    
    showError(message) {
        // You can implement toast notifications here
        console.error('❌', message);
    }
}

// Global functions for HTML onclick handlers
window.refreshDashboard = function() {
    if (window.aiDashboard) {
        window.aiDashboard.refreshDashboard();
    }
};

window.showLoadTimePredictionModal = function() {
    if (window.aiDashboard) {
        window.aiDashboard.showLoadTimePredictionModal();
    }
};

window.showResourcePredictionModal = function() {
    if (window.aiDashboard) {
        window.aiDashboard.showResourcePredictionModal();
    }
};

window.runLoadTimePrediction = function() {
    if (window.aiDashboard) {
        window.aiDashboard.runLoadTimePrediction();
    }
};

window.runResourcePrediction = function() {
    if (window.aiDashboard) {
        window.aiDashboard.runResourcePrediction();
    }
};

window.runAnomalyDetection = function() {
    if (window.aiDashboard) {
        window.aiDashboard.runAnomalyDetection();
    }
};

window.trainModels = function() {
    if (window.aiDashboard) {
        window.aiDashboard.trainModels();
    }
};

window.filterRecommendations = function(priority) {
    if (window.aiDashboard) {
        window.aiDashboard.filterRecommendations(priority);
    }
};

// Initialize dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('ai-performance-dashboard')) {
        window.aiDashboard = new AIPerformanceDashboard();
    }
});