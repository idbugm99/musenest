/**
 * Machine Learning API Routes
 * Part of Phase E.3: Predictive analytics and machine learning insights
 * Provides API endpoints for ML models, predictions, and intelligent insights
 */

const express = require('express');
const router = express.Router();
const PredictiveAnalyticsService = require('../../src/services/PredictiveAnalyticsService');
const AdvancedAnalyticsService = require('../../src/services/AdvancedAnalyticsService');

// Initialize ML service
let mlService = null;
let analyticsService = null;

// Middleware to initialize ML service
router.use((req, res, next) => {
    if (!mlService) {
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
            models: {
                enabledModels: (process.env.ML_ENABLED_MODELS || 
                    'revenue_forecasting,user_behavior,churn_prediction,anomaly_detection,capacity_planning,demand_forecasting').split(','),
                retrainingInterval: parseInt(process.env.ML_RETRAIN_INTERVAL) || 24 * 60 * 60 * 1000,
                minDataPoints: parseInt(process.env.ML_MIN_DATA_POINTS) || 100,
                validationSplit: parseFloat(process.env.ML_VALIDATION_SPLIT) || 0.2,
                confidenceThreshold: parseFloat(process.env.ML_CONFIDENCE_THRESHOLD) || 0.75
            },
            predictions: {
                forecastHorizons: {
                    short: parseInt(process.env.ML_FORECAST_SHORT) || 7,
                    medium: parseInt(process.env.ML_FORECAST_MEDIUM) || 30,
                    long: parseInt(process.env.ML_FORECAST_LONG) || 90
                },
                updateInterval: parseInt(process.env.ML_PREDICTION_UPDATE_INTERVAL) || 3600000,
                maxPredictions: parseInt(process.env.ML_MAX_PREDICTIONS) || 1000,
                enableRealTime: process.env.ML_REALTIME_ENABLED !== 'false'
            },
            insights: {
                enabledTypes: (process.env.ML_INSIGHT_TYPES || 
                    'trends,patterns,recommendations,alerts,opportunities').split(','),
                minConfidence: parseFloat(process.env.ML_MIN_CONFIDENCE) || 0.6,
                maxInsights: parseInt(process.env.ML_MAX_INSIGHTS) || 50,
                refreshInterval: parseInt(process.env.ML_INSIGHT_REFRESH) || 1800000
            },
            storage: {
                modelsDir: process.env.ML_MODELS_DIR || '/tmp/musenest-ml/models',
                predictionsDir: process.env.ML_PREDICTIONS_DIR || '/tmp/musenest-ml/predictions',
                insightsDir: process.env.ML_INSIGHTS_DIR || '/tmp/musenest-ml/insights'
            }
        };

        mlService = new PredictiveAnalyticsService(analyticsService, config);
        console.log('🤖 PredictiveAnalyticsService initialized for API routes');
    }
    next();
});

/**
 * GET /api/ml/status
 * Get ML service status and overview
 */
router.get('/status', (req, res) => {
    try {
        if (!mlService) {
            return res.status(500).json({
                success: false,
                error: 'ML service not initialized'
            });
        }

        const status = mlService.getMLStatus();
        
        res.json({
            success: true,
            status: {
                models: {
                    total: status.models.total,
                    trained: status.models.trained,
                    training: status.models.training,
                    trainedPercentage: status.models.total > 0 ? 
                        Math.round((status.models.trained / status.models.total) * 100) : 0,
                    averageAccuracy: status.models.averageAccuracy,
                    byType: status.models.byType
                },
                predictions: {
                    total: status.predictions.total,
                    recent: status.predictions.recent,
                    averageConfidence: status.predictions.averageConfidence,
                    predictionRate: status.predictions.recent > 0 ? 
                        Math.round(status.predictions.recent / status.models.trained * 100) / 100 : 0
                },
                insights: {
                    total: status.insights.total,
                    recent: status.insights.recent,
                    byCategory: status.insights.byCategory,
                    insightRate: status.insights.recent > 0 ? 
                        Math.round(status.insights.recent / status.predictions.recent * 100) / 100 : 0
                },
                configuration: {
                    enabledModels: status.configuration.models.enabledModels.length,
                    forecastHorizons: status.configuration.predictions.forecastHorizons,
                    realTimePredictions: status.configuration.predictions.enableRealTime,
                    confidenceThreshold: status.configuration.models.confidenceThreshold
                },
                health: {
                    overall: status.models.trained > 0 && status.predictions.recent > 0 ? 'healthy' : 
                             status.models.total > 0 ? 'training' : 'initializing',
                    lastActivity: Date.now()
                }
            },
            timestamp: Date.now()
        });

    } catch (error) {
        console.error('❌ Error getting ML status:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get ML status'
        });
    }
});

/**
 * GET /api/ml/models
 * Get list of ML models
 */
router.get('/models', (req, res) => {
    try {
        if (!mlService) {
            return res.status(500).json({
                success: false,
                error: 'ML service not initialized'
            });
        }

        const { type, status } = req.query;
        let models = mlService.getModels(type);
        
        // Filter by status if specified
        if (status) {
            models = models.filter(m => m.status === status);
        }
        
        res.json({
            success: true,
            models: models.map(model => ({
                id: model.id,
                name: model.name,
                type: model.type,
                algorithm: model.algorithm,
                status: model.status,
                lastTrained: model.lastTrained ? 
                    new Date(model.lastTrained).toISOString() : null,
                lastPrediction: model.lastPrediction ? 
                    new Date(model.lastPrediction).toISOString() : null,
                version: model.version,
                performance: {
                    accuracy: model.performance?.accuracy ? 
                        Math.round(model.performance.accuracy * 10000) / 100 : null,
                    confidence: model.performance?.confidence || null,
                    reliability: model.performance?.accuracy > 0.8 ? 'high' :
                                model.performance?.accuracy > 0.6 ? 'medium' : 'low'
                },
                health: this.getModelHealth(model)
            })),
            metadata: {
                total: models.length,
                type: type || 'all',
                status: status || 'all',
                types: [...new Set(models.map(m => m.type))],
                statuses: [...new Set(models.map(m => m.status))],
                averageAccuracy: models.length > 0 ? 
                    Math.round((models.reduce((sum, m) => sum + (m.performance?.accuracy || 0), 0) / models.length) * 100) : 0
            }
        });

    } catch (error) {
        console.error('❌ Error getting models:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get models'
        });
    }
});

/**
 * GET /api/ml/models/:modelId
 * Get specific model details
 */
router.get('/models/:modelId', (req, res) => {
    try {
        if (!mlService) {
            return res.status(500).json({
                success: false,
                error: 'ML service not initialized'
            });
        }

        const { modelId } = req.params;
        const model = mlService.getModel(modelId);
        
        if (!model) {
            return res.status(404).json({
                success: false,
                error: 'Model not found'
            });
        }

        res.json({
            success: true,
            model: {
                id: model.id,
                name: model.name,
                type: model.type,
                algorithm: model.algorithm,
                description: model.description,
                status: model.status,
                features: model.features,
                target: model.target,
                created: new Date(model.created).toISOString(),
                lastTrained: model.lastTrained ? 
                    new Date(model.lastTrained).toISOString() : null,
                lastPrediction: model.lastPrediction ? 
                    new Date(model.lastPrediction).toISOString() : null,
                version: model.version,
                parameters: model.parameters,
                performance: {
                    accuracy: model.performance?.accuracy ? 
                        Math.round(model.performance.accuracy * 10000) / 100 : null,
                    precision: model.performance?.precision ? 
                        Math.round(model.performance.precision * 10000) / 100 : null,
                    recall: model.performance?.recall ? 
                        Math.round(model.performance.recall * 10000) / 100 : null,
                    f1Score: model.performance?.f1Score ? 
                        Math.round(model.performance.f1Score * 10000) / 100 : null,
                    mse: model.performance?.mse,
                    mae: model.performance?.mae,
                    r2Score: model.performance?.r2Score ? 
                        Math.round(model.performance.r2Score * 10000) / 100 : null
                },
                trainingData: {
                    count: model.trainingData?.length || 0,
                    lastUpdated: model.lastTrained
                },
                predictions: {
                    count: model.predictions?.size || 0,
                    recent: Array.from(model.predictions?.values() || [])
                        .sort((a, b) => b.generatedAt - a.generatedAt)
                        .slice(0, 5)
                        .map(p => ({
                            id: p.id,
                            generatedAt: new Date(p.generatedAt).toISOString(),
                            confidence: p.confidenceScores?.average || null,
                            horizon: p.horizon
                        }))
                }
            }
        });

    } catch (error) {
        console.error('❌ Error getting model details:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get model details'
        });
    }
});

/**
 * POST /api/ml/models
 * Create a new ML model
 */
router.post('/models', async (req, res) => {
    try {
        if (!mlService) {
            return res.status(500).json({
                success: false,
                error: 'ML service not initialized'
            });
        }

        const modelConfig = req.body;
        
        // Validate required fields
        if (!modelConfig.name || !modelConfig.type || !modelConfig.algorithm) {
            return res.status(400).json({
                success: false,
                error: 'name, type, and algorithm are required'
            });
        }

        console.log(`🤖 Creating ML model: ${modelConfig.name}`);
        
        const model = await mlService.createModel(modelConfig);
        
        res.status(201).json({
            success: true,
            message: 'Model created successfully',
            model: {
                id: model.id,
                name: model.name,
                type: model.type,
                algorithm: model.algorithm,
                status: model.status,
                created: new Date(model.created).toISOString(),
                features: model.features,
                target: model.target
            }
        });

    } catch (error) {
        console.error('❌ Error creating model:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to create model'
        });
    }
});

/**
 * POST /api/ml/models/:modelId/train
 * Train a specific model
 */
router.post('/models/:modelId/train', async (req, res) => {
    try {
        if (!mlService) {
            return res.status(500).json({
                success: false,
                error: 'ML service not initialized'
            });
        }

        const { modelId } = req.params;
        const options = req.body || {};
        
        console.log(`🤖 Training model: ${modelId}`);
        
        const trainingResult = await mlService.trainModel(modelId, options);
        
        res.json({
            success: true,
            message: 'Model training completed',
            training: {
                modelId: trainingResult.modelId,
                modelName: trainingResult.modelName,
                duration: trainingResult.duration,
                dataPoints: trainingResult.dataPoints,
                version: trainingResult.version,
                completedAt: new Date(trainingResult.completedAt).toISOString(),
                performance: {
                    accuracy: trainingResult.performance?.accuracy ? 
                        Math.round(trainingResult.performance.accuracy * 10000) / 100 : null,
                    precision: trainingResult.performance?.precision ? 
                        Math.round(trainingResult.performance.precision * 10000) / 100 : null,
                    recall: trainingResult.performance?.recall ? 
                        Math.round(trainingResult.performance.recall * 10000) / 100 : null,
                    quality: trainingResult.performance?.accuracy > 0.8 ? 'excellent' :
                            trainingResult.performance?.accuracy > 0.6 ? 'good' : 
                            trainingResult.performance?.accuracy > 0.4 ? 'fair' : 'poor'
                }
            }
        });

    } catch (error) {
        console.error('❌ Error training model:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to train model'
        });
    }
});

/**
 * POST /api/ml/models/:modelId/predict
 * Generate predictions using a model
 */
router.post('/models/:modelId/predict', async (req, res) => {
    try {
        if (!mlService) {
            return res.status(500).json({
                success: false,
                error: 'ML service not initialized'
            });
        }

        const { modelId } = req.params;
        const { inputData, options = {} } = req.body;
        
        console.log(`🤖 Generating predictions: ${modelId}`);
        
        const predictionResult = await mlService.generatePredictions(modelId, inputData, options);
        
        res.json({
            success: true,
            message: 'Predictions generated successfully',
            prediction: {
                id: predictionResult.id,
                modelId: predictionResult.modelId,
                modelName: predictionResult.modelName,
                modelType: predictionResult.modelType,
                generatedAt: new Date(predictionResult.generatedAt).toISOString(),
                duration: predictionResult.duration,
                horizon: predictionResult.horizon,
                confidence: {
                    average: predictionResult.confidenceScores?.average || null,
                    minimum: predictionResult.confidenceScores?.minimum || null,
                    maximum: predictionResult.confidenceScores?.maximum || null,
                    reliability: predictionResult.confidenceScores?.reliability || 'unknown',
                    distribution: predictionResult.confidenceScores?.distribution || {}
                },
                predictions: predictionResult.predictions.slice(0, 20).map(p => ({ // Limit to first 20
                    date: p.date,
                    period: p.period,
                    value: this.formatPredictionValue(p, predictionResult.modelType),
                    confidence: Math.round((p.confidence || 0) * 10000) / 100
                })),
                insights: predictionResult.insights.map(insight => ({
                    type: insight.type,
                    category: insight.category,
                    title: insight.title,
                    description: insight.description,
                    impact: insight.impact,
                    confidence: Math.round((insight.confidence || 0) * 10000) / 100,
                    recommendation: insight.recommendation
                })),
                summary: {
                    totalPredictions: predictionResult.predictions.length,
                    averageConfidence: predictionResult.confidenceScores?.average || null,
                    insightCount: predictionResult.insights.length,
                    forecastPeriod: `${predictionResult.predictions.length} ${options.horizon || 'short'}-term periods`
                }
            }
        });

    } catch (error) {
        console.error('❌ Error generating predictions:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to generate predictions'
        });
    }
});

/**
 * GET /api/ml/predictions
 * Get list of predictions
 */
router.get('/predictions', (req, res) => {
    try {
        if (!mlService) {
            return res.status(500).json({
                success: false,
                error: 'ML service not initialized'
            });
        }

        const { modelId, limit = 20 } = req.query;
        const predictions = mlService.getPredictions(modelId, parseInt(limit));
        
        res.json({
            success: true,
            predictions: predictions.map(prediction => ({
                id: prediction.id,
                modelId: prediction.modelId,
                modelName: prediction.modelName,
                modelType: prediction.modelType,
                generatedAt: new Date(prediction.generatedAt).toISOString(),
                duration: prediction.duration,
                horizon: prediction.horizon,
                confidence: {
                    average: prediction.confidenceScores?.average || null,
                    reliability: prediction.confidenceScores?.reliability || 'unknown'
                },
                summary: {
                    predictionCount: prediction.predictions?.length || 0,
                    insightCount: prediction.insights?.length || 0,
                    averageConfidence: prediction.confidenceScores?.average || null
                },
                status: prediction.predictions && prediction.predictions.length > 0 ? 'completed' : 'pending'
            })),
            metadata: {
                total: predictions.length,
                modelFilter: modelId || 'all',
                limit: parseInt(limit),
                modelTypes: [...new Set(predictions.map(p => p.modelType))],
                averageConfidence: predictions.length > 0 ? 
                    Math.round((predictions.reduce((sum, p) => sum + (p.confidenceScores?.average || 0), 0) / predictions.length) * 100) / 100 : 0
            }
        });

    } catch (error) {
        console.error('❌ Error getting predictions:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get predictions'
        });
    }
});

/**
 * GET /api/ml/predictions/:predictionId
 * Get specific prediction details
 */
router.get('/predictions/:predictionId', (req, res) => {
    try {
        if (!mlService) {
            return res.status(500).json({
                success: false,
                error: 'ML service not initialized'
            });
        }

        const { predictionId } = req.params;
        const predictions = mlService.getPredictions();
        const prediction = predictions.find(p => p.id === predictionId);
        
        if (!prediction) {
            return res.status(404).json({
                success: false,
                error: 'Prediction not found'
            });
        }

        res.json({
            success: true,
            prediction: {
                id: prediction.id,
                modelId: prediction.modelId,
                modelName: prediction.modelName,
                modelType: prediction.modelType,
                generatedAt: new Date(prediction.generatedAt).toISOString(),
                duration: prediction.duration,
                horizon: prediction.horizon,
                options: prediction.options,
                confidence: prediction.confidenceScores,
                predictions: prediction.predictions.map(p => ({
                    date: p.date,
                    period: p.period,
                    value: this.formatPredictionValue(p, prediction.modelType),
                    confidence: Math.round((p.confidence || 0) * 10000) / 100,
                    factors: p.factors
                })),
                insights: prediction.insights,
                inputData: {
                    dataPoints: Array.isArray(prediction.inputData) ? prediction.inputData.length : 0,
                    features: prediction.inputData && prediction.inputData[0] ? Object.keys(prediction.inputData[0]) : []
                }
            }
        });

    } catch (error) {
        console.error('❌ Error getting prediction details:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get prediction details'
        });
    }
});

/**
 * GET /api/ml/insights
 * Get ML-generated insights
 */
router.get('/insights', (req, res) => {
    try {
        if (!mlService) {
            return res.status(500).json({
                success: false,
                error: 'ML service not initialized'
            });
        }

        const { category, type, limit = 20 } = req.query;
        let insights = mlService.getInsights(category, parseInt(limit));
        
        // Filter by type if specified
        if (type) {
            insights = insights.filter(i => i.type === type);
        }
        
        res.json({
            success: true,
            insights: insights.map(insight => ({
                id: insight.id,
                type: insight.type,
                category: insight.category,
                title: insight.title,
                description: insight.description,
                impact: insight.impact,
                confidence: Math.round((insight.confidence || 0) * 10000) / 100,
                recommendation: insight.recommendation,
                modelId: insight.modelId,
                modelName: this.getModelName(insight.modelId),
                generatedAt: new Date(insight.generatedAt).toISOString(),
                data: insight.data,
                priority: this.calculateInsightPriority(insight),
                actionable: !!insight.recommendation
            })),
            metadata: {
                total: insights.length,
                category: category || 'all',
                type: type || 'all',
                limit: parseInt(limit),
                categories: [...new Set(insights.map(i => i.category))],
                types: [...new Set(insights.map(i => i.type))],
                averageConfidence: insights.length > 0 ? 
                    Math.round((insights.reduce((sum, i) => sum + (i.confidence || 0), 0) / insights.length) * 100) / 100 : 0,
                highImpact: insights.filter(i => i.impact === 'high').length,
                actionableCount: insights.filter(i => !!i.recommendation).length
            }
        });

    } catch (error) {
        console.error('❌ Error getting insights:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get insights'
        });
    }
});

/**
 * GET /api/ml/algorithms
 * Get supported ML algorithms and their capabilities
 */
router.get('/algorithms', (req, res) => {
    try {
        const algorithms = [
            {
                name: 'linear_regression',
                displayName: 'Linear Regression',
                type: 'regression',
                description: 'Simple linear relationship modeling for continuous predictions',
                useCases: ['revenue forecasting', 'trend analysis', 'demand prediction'],
                advantages: ['Fast training', 'Interpretable', 'Good baseline'],
                limitations: ['Assumes linear relationships', 'Sensitive to outliers'],
                parameters: {
                    learningRate: { type: 'number', default: 0.01, range: [0.001, 1.0] },
                    epochs: { type: 'integer', default: 100, range: [10, 1000] }
                }
            },
            {
                name: 'random_forest',
                displayName: 'Random Forest',
                type: 'classification/regression',
                description: 'Ensemble method using multiple decision trees',
                useCases: ['user behavior prediction', 'feature importance', 'classification'],
                advantages: ['Handles mixed data types', 'Feature importance', 'Robust to overfitting'],
                limitations: ['Can overfit with noisy data', 'Less interpretable'],
                parameters: {
                    nEstimators: { type: 'integer', default: 100, range: [10, 500] },
                    maxDepth: { type: 'integer', default: 10, range: [3, 20] },
                    minSamplesSplit: { type: 'integer', default: 2, range: [2, 20] }
                }
            },
            {
                name: 'gradient_boosting',
                displayName: 'Gradient Boosting',
                type: 'classification/regression',
                description: 'Sequential ensemble method for high accuracy',
                useCases: ['churn prediction', 'risk assessment', 'complex patterns'],
                advantages: ['High accuracy', 'Handles missing data', 'Feature importance'],
                limitations: ['Prone to overfitting', 'Requires tuning'],
                parameters: {
                    nEstimators: { type: 'integer', default: 100, range: [10, 300] },
                    learningRate: { type: 'number', default: 0.1, range: [0.01, 0.3] },
                    maxDepth: { type: 'integer', default: 6, range: [3, 10] }
                }
            },
            {
                name: 'isolation_forest',
                displayName: 'Isolation Forest',
                type: 'anomaly_detection',
                description: 'Unsupervised anomaly detection using random partitioning',
                useCases: ['fraud detection', 'outlier detection', 'system monitoring'],
                advantages: ['No labeled data needed', 'Efficient', 'Scalable'],
                limitations: ['Parameter sensitive', 'May not work well in high dimensions'],
                parameters: {
                    nEstimators: { type: 'integer', default: 100, range: [50, 300] },
                    contamination: { type: 'number', default: 0.1, range: [0.01, 0.5] }
                }
            },
            {
                name: 'time_series',
                displayName: 'Time Series Analysis',
                type: 'forecasting',
                description: 'Specialized methods for temporal data analysis',
                useCases: ['capacity planning', 'seasonal forecasting', 'trend analysis'],
                advantages: ['Handles seasonality', 'Temporal patterns', 'Trend decomposition'],
                limitations: ['Requires regular intervals', 'Sensitive to missing data'],
                parameters: {
                    seasonality: { type: 'string', default: 'auto', options: ['auto', 'weekly', 'monthly', 'yearly'] },
                    trend: { type: 'string', default: 'auto', options: ['auto', 'linear', 'exponential'] }
                }
            },
            {
                name: 'arima',
                displayName: 'ARIMA',
                type: 'time_series',
                description: 'Autoregressive Integrated Moving Average for time series',
                useCases: ['demand forecasting', 'stock prediction', 'economic indicators'],
                advantages: ['Well-established', 'Good for stationary data', 'Confidence intervals'],
                limitations: ['Requires stationarity', 'Parameter selection challenging'],
                parameters: {
                    p: { type: 'integer', default: 1, range: [0, 5], description: 'Autoregressive order' },
                    d: { type: 'integer', default: 1, range: [0, 2], description: 'Differencing order' },
                    q: { type: 'integer', default: 1, range: [0, 5], description: 'Moving average order' }
                }
            }
        ];

        const algorithmCategories = {
            regression: algorithms.filter(a => a.type.includes('regression')),
            classification: algorithms.filter(a => a.type.includes('classification')),
            timeSeries: algorithms.filter(a => a.type.includes('time_series') || a.type.includes('forecasting')),
            anomalyDetection: algorithms.filter(a => a.type.includes('anomaly')),
            ensemble: algorithms.filter(a => a.name.includes('forest') || a.name.includes('boosting'))
        };

        res.json({
            success: true,
            algorithms,
            categories: algorithmCategories,
            summary: {
                total: algorithms.length,
                byType: {
                    regression: algorithms.filter(a => a.type.includes('regression')).length,
                    classification: algorithms.filter(a => a.type.includes('classification')).length,
                    timeSeries: algorithms.filter(a => a.type.includes('time') || a.type.includes('forecasting')).length,
                    anomalyDetection: algorithms.filter(a => a.type.includes('anomaly')).length
                }
            },
            recommendations: {
                beginners: ['linear_regression', 'random_forest'],
                advanced: ['gradient_boosting', 'arima'],
                realTime: ['isolation_forest', 'time_series'],
                interpretable: ['linear_regression', 'random_forest']
            }
        });

    } catch (error) {
        console.error('❌ Error getting algorithms:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get algorithms'
        });
    }
});

/**
 * GET /api/ml/model-types
 * Get available model types and their use cases
 */
router.get('/model-types', (req, res) => {
    try {
        const modelTypes = [
            {
                type: 'revenue_forecasting',
                name: 'Revenue Forecasting',
                description: 'Predict future revenue based on historical data and business metrics',
                algorithms: ['linear_regression', 'time_series', 'arima'],
                features: ['historical_revenue', 'client_count', 'subscription_growth', 'market_trends'],
                outputs: ['future_revenue', 'growth_rate', 'confidence_intervals'],
                useCases: ['Budget planning', 'Financial forecasting', 'Growth projections'],
                dataRequirements: 'Historical revenue data spanning at least 3 months',
                accuracy: 'Typically 85-95% for short-term forecasts'
            },
            {
                type: 'user_behavior',
                name: 'User Behavior Prediction',
                description: 'Analyze and predict user actions and engagement patterns',
                algorithms: ['random_forest', 'gradient_boosting'],
                features: ['session_duration', 'page_views', 'engagement_rate', 'feature_usage'],
                outputs: ['predicted_action', 'engagement_score', 'behavior_probabilities'],
                useCases: ['Personalization', 'UX optimization', 'Feature development'],
                dataRequirements: 'User interaction logs with at least 1000 sessions',
                accuracy: 'Typically 70-85% depending on data quality'
            },
            {
                type: 'churn_prediction',
                name: 'Customer Churn Prediction',
                description: 'Identify customers at risk of canceling or becoming inactive',
                algorithms: ['gradient_boosting', 'random_forest'],
                features: ['usage_frequency', 'support_tickets', 'payment_history', 'engagement_score'],
                outputs: ['churn_probability', 'risk_level', 'contributing_factors'],
                useCases: ['Retention campaigns', 'Customer success', 'Revenue protection'],
                dataRequirements: 'Customer data with historical churn labels',
                accuracy: 'Typically 75-90% with proper feature engineering'
            },
            {
                type: 'anomaly_detection',
                name: 'Anomaly Detection',
                description: 'Detect unusual patterns and outliers in system behavior',
                algorithms: ['isolation_forest'],
                features: ['system_metrics', 'performance_indicators', 'usage_patterns'],
                outputs: ['anomaly_score', 'outlier_flag', 'contributing_metrics'],
                useCases: ['System monitoring', 'Fraud detection', 'Quality assurance'],
                dataRequirements: 'Normal behavior data for baseline establishment',
                accuracy: 'Typically 80-95% depending on anomaly complexity'
            },
            {
                type: 'capacity_planning',
                name: 'Capacity Planning',
                description: 'Forecast resource needs and infrastructure requirements',
                algorithms: ['time_series', 'linear_regression'],
                features: ['resource_usage', 'growth_rate', 'seasonal_patterns'],
                outputs: ['capacity_requirements', 'scaling_timeline', 'resource_optimization'],
                useCases: ['Infrastructure planning', 'Cost optimization', 'Performance management'],
                dataRequirements: 'Historical resource utilization data',
                accuracy: 'Typically 80-90% for resource planning'
            },
            {
                type: 'demand_forecasting',
                name: 'Demand Forecasting',
                description: 'Predict service demand and usage patterns',
                algorithms: ['arima', 'time_series'],
                features: ['historical_demand', 'market_indicators', 'seasonal_factors'],
                outputs: ['future_demand', 'peak_periods', 'seasonal_adjustments'],
                useCases: ['Resource allocation', 'Inventory management', 'Staffing decisions'],
                dataRequirements: 'Historical demand data with seasonal patterns',
                accuracy: 'Typically 75-85% for demand patterns'
            }
        ];

        const { category } = req.query;
        let filteredTypes = modelTypes;
        
        if (category) {
            const categoryMap = {
                'business': ['revenue_forecasting', 'churn_prediction'],
                'technical': ['anomaly_detection', 'capacity_planning'],
                'analytics': ['user_behavior', 'demand_forecasting']
            };
            
            if (categoryMap[category]) {
                filteredTypes = modelTypes.filter(type => categoryMap[category].includes(type.type));
            }
        }

        res.json({
            success: true,
            modelTypes: filteredTypes,
            metadata: {
                total: filteredTypes.length,
                category: category || 'all',
                categories: {
                    business: modelTypes.filter(t => ['revenue_forecasting', 'churn_prediction'].includes(t.type)).length,
                    technical: modelTypes.filter(t => ['anomaly_detection', 'capacity_planning'].includes(t.type)).length,
                    analytics: modelTypes.filter(t => ['user_behavior', 'demand_forecasting'].includes(t.type)).length
                },
                algorithms: [...new Set(modelTypes.flatMap(t => t.algorithms))]
            },
            recommendations: {
                quickStart: ['revenue_forecasting', 'user_behavior'],
                advanced: ['churn_prediction', 'anomaly_detection'],
                realTime: ['anomaly_detection', 'capacity_planning']
            }
        });

    } catch (error) {
        console.error('❌ Error getting model types:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get model types'
        });
    }
});

/**
 * GET /api/ml/configuration
 * Get ML service configuration
 */
router.get('/configuration', (req, res) => {
    try {
        if (!mlService) {
            return res.status(500).json({
                success: false,
                error: 'ML service not initialized'
            });
        }

        const status = mlService.getMLStatus();
        
        res.json({
            success: true,
            configuration: {
                models: {
                    enabledModels: status.configuration.models.enabledModels,
                    retrainingInterval: status.configuration.models.retrainingInterval,
                    retrainingIntervalHours: Math.round(status.configuration.models.retrainingInterval / (60 * 60 * 1000)),
                    minDataPoints: status.configuration.models.minDataPoints,
                    validationSplit: status.configuration.models.validationSplit,
                    confidenceThreshold: status.configuration.models.confidenceThreshold
                },
                predictions: {
                    forecastHorizons: status.configuration.predictions.forecastHorizons,
                    updateInterval: status.configuration.predictions.updateInterval,
                    updateIntervalHours: Math.round(status.configuration.predictions.updateInterval / (60 * 60 * 1000)),
                    maxPredictions: status.configuration.predictions.maxPredictions,
                    realTimeEnabled: status.configuration.predictions.enableRealTime
                },
                insights: {
                    enabledTypes: status.configuration.insights.enabledTypes,
                    minConfidence: status.configuration.insights.minConfidence,
                    maxInsights: status.configuration.insights.maxInsights,
                    refreshInterval: status.configuration.insights.refreshInterval,
                    refreshIntervalMinutes: Math.round(status.configuration.insights.refreshInterval / 60000)
                },
                storage: {
                    modelsDirectory: status.configuration.storage.modelsDir,
                    predictionsDirectory: status.configuration.storage.predictionsDir,
                    insightsDirectory: status.configuration.storage.insightsDir,
                    trainDataDirectory: status.configuration.storage.trainDataDir
                }
            }
        });

    } catch (error) {
        console.error('❌ Error getting ML configuration:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get ML configuration'
        });
    }
});

/**
 * PUT /api/ml/configuration
 * Update ML service configuration
 */
router.put('/configuration', (req, res) => {
    try {
        if (!mlService) {
            return res.status(500).json({
                success: false,
                error: 'ML service not initialized'
            });
        }

        const newConfig = req.body;
        
        // Validate configuration structure
        const validSections = ['models', 'predictions', 'insights', 'storage'];
        const providedSections = Object.keys(newConfig);
        const invalidSections = providedSections.filter(section => !validSections.includes(section));
        
        if (invalidSections.length > 0) {
            return res.status(400).json({
                success: false,
                error: `Invalid configuration sections: ${invalidSections.join(', ')}`
            });
        }

        mlService.updateConfiguration(newConfig);
        
        console.log('🤖 ML configuration updated via API:', providedSections);

        res.json({
            success: true,
            message: 'ML configuration updated',
            updated: providedSections,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error updating ML configuration:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to update ML configuration'
        });
    }
});

// Helper methods

router.getModelHealth = function(model) {
    if (model.status === 'error') return 'unhealthy';
    if (model.status === 'training') return 'training';
    if (model.status === 'trained') {
        const accuracy = model.performance?.accuracy || 0;
        return accuracy > 0.8 ? 'excellent' : accuracy > 0.6 ? 'good' : 'fair';
    }
    return 'pending';
};

router.formatPredictionValue = function(prediction, modelType) {
    switch (modelType) {
        case 'revenue_forecasting':
            return prediction.predicted_revenue ? `$${Math.round(prediction.predicted_revenue).toLocaleString()}` : null;
        case 'churn_prediction':
            return prediction.churn_probability ? `${prediction.churn_probability}%` : null;
        case 'user_behavior':
            return prediction.predicted_behavior || null;
        case 'capacity_planning':
            return prediction.capacity_requirements ? Math.round(prediction.capacity_requirements) : null;
        case 'demand_forecasting':
            return prediction.future_demand ? Math.round(prediction.future_demand) : null;
        default:
            return prediction.prediction_value || null;
    }
};

router.getModelName = function(modelId) {
    // This would normally query the ML service
    return 'Model Name'; // Placeholder
};

router.calculateInsightPriority = function(insight) {
    const impactScore = { 'high': 3, 'medium': 2, 'low': 1 }[insight.impact] || 1;
    const confidenceScore = Math.round((insight.confidence || 0) * 3);
    const totalScore = impactScore + confidenceScore;
    
    return totalScore >= 5 ? 'high' : totalScore >= 3 ? 'medium' : 'low';
};

module.exports = router;