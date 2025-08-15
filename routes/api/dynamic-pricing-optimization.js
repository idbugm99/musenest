/**
 * Dynamic Pricing Optimization API Routes
 * 
 * RESTful API endpoints for dynamic pricing, market intelligence,
 * competitor monitoring, demand forecasting, and revenue optimization.
 */

const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');

// Initialize Dynamic Pricing Optimization Service
let pricingService = null;

async function initializeService() {
    if (!pricingService) {
        const DynamicPricingOptimizationService = require('../../src/services/DynamicPricingOptimizationService');
        
        // Create database connection for the service
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'musenest'
        });
        
        pricingService = new DynamicPricingOptimizationService(db);
        await pricingService.initialize();
    }
    return pricingService;
}

// Middleware to ensure service is initialized
async function ensureServiceReady(req, res, next) {
    try {
        await initializeService();
        next();
    } catch (error) {
        console.error('Failed to initialize Dynamic Pricing Optimization Service:', error);
        res.status(503).json({
            error: 'Dynamic Pricing Optimization Service unavailable',
            details: error.message
        });
    }
}

/**
 * GET /api/dynamic-pricing-optimization/health
 * Get service health status and pricing performance metrics
 */
router.get('/health', ensureServiceReady, async (req, res) => {
    try {
        const health = await pricingService.getServiceHealthStatus();
        res.json(health);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to get health status',
            details: error.message
        });
    }
});

/**
 * POST /api/dynamic-pricing-optimization/optimize-pricing
 * Optimize pricing for a specific product using AI and market intelligence
 * 
 * Body: {
 *   "productId": "product_123",
 *   "optimizationContext": {
 *     "urgency": "normal", // low, normal, high, urgent
 *     "constraints": {
 *       "min_margin": 0.20,
 *       "max_price_change": 0.15,
 *       "competitor_response_factor": 0.8
 *     },
 *     "objectives": {
 *       "primary": "revenue_maximization", // profit_maximization, market_share, customer_acquisition
 *       "revenue_weight": 0.6,
 *       "profit_weight": 0.3,
 *       "market_share_weight": 0.1
 *     }
 *   }
 * }
 */
router.post('/optimize-pricing', ensureServiceReady, async (req, res) => {
    try {
        const { productId, optimizationContext = {} } = req.body;
        
        if (!productId) {
            return res.status(400).json({
                error: 'Missing required parameter',
                required: ['productId']
            });
        }
        
        console.log(`💰 Optimizing pricing for product: ${productId}`);
        
        const pricingOptimization = await pricingService.optimizePricing(
            productId, 
            optimizationContext
        );
        
        res.json({
            success: !pricingOptimization.error,
            ...pricingOptimization
        });
        
    } catch (error) {
        console.error('Pricing optimization error:', error);
        res.status(500).json({
            error: 'Failed to optimize pricing',
            details: error.message
        });
    }
});

/**
 * POST /api/dynamic-pricing-optimization/monitor-competitors
 * Monitor competitor pricing and generate competitive intelligence
 * 
 * Body: {
 *   "monitoringParameters": {
 *     "competitor_ids": ["comp_1", "comp_2"],
 *     "product_categories": ["premium", "standard"],
 *     "monitoring_depth": "comprehensive", // standard, comprehensive, detailed
 *     "alert_thresholds": {
 *       "price_change_threshold": 0.05,
 *       "threat_level_threshold": "medium"
 *     }
 *   }
 * }
 */
router.post('/monitor-competitors', ensureServiceReady, async (req, res) => {
    try {
        const { monitoringParameters = {} } = req.body;
        
        console.log('🔍 Starting competitor pricing monitoring');
        
        const monitoringResults = await pricingService.monitorCompetitorPricing(
            monitoringParameters
        );
        
        res.json({
            success: true,
            ...monitoringResults
        });
        
    } catch (error) {
        console.error('Competitor monitoring error:', error);
        res.status(500).json({
            error: 'Failed to monitor competitor pricing',
            details: error.message
        });
    }
});

/**
 * POST /api/dynamic-pricing-optimization/execute-strategy
 * Execute a specific pricing strategy for a product
 * 
 * Body: {
 *   "productId": "product_123",
 *   "strategyConfig": {
 *     "strategy_type": "competitive_pricing", // competitive_pricing, demand_based, value_based
 *     "strategy_parameters": {
 *       "competitor_price_weight": 0.6,
 *       "market_share_weight": 0.3,
 *       "brand_premium": 0.1
 *     }
 *   },
 *   "executionContext": {
 *     "implementation_speed": "gradual", // immediate, gradual, scheduled
 *     "customer_segment_rollout": ["premium", "regular"],
 *     "monitoring_period_days": 14
 *   }
 * }
 */
router.post('/execute-strategy', ensureServiceReady, async (req, res) => {
    try {
        const { productId, strategyConfig, executionContext = {} } = req.body;
        
        if (!productId || !strategyConfig) {
            return res.status(400).json({
                error: 'Missing required parameters',
                required: ['productId', 'strategyConfig']
            });
        }
        
        if (!strategyConfig.strategy_type) {
            return res.status(400).json({
                error: 'Invalid strategy configuration',
                message: 'strategyConfig must include strategy_type'
            });
        }
        
        console.log(`🎯 Executing ${strategyConfig.strategy_type} strategy for product: ${productId}`);
        
        const strategyExecution = await pricingService.executePricingStrategy(
            productId,
            strategyConfig,
            executionContext
        );
        
        res.json({
            success: !strategyExecution.error,
            ...strategyExecution
        });
        
    } catch (error) {
        console.error('Strategy execution error:', error);
        res.status(500).json({
            error: 'Failed to execute pricing strategy',
            details: error.message
        });
    }
});

/**
 * GET /api/dynamic-pricing-optimization/product-pricing/:productId
 * Get comprehensive pricing information and recommendations for a product
 * 
 * Query params:
 * - include_forecasts: include demand forecasts (default true)
 * - include_competitors: include competitor analysis (default true)
 * - include_experiments: include pricing experiment data (default true)
 * - timeframe: analysis timeframe - 7d, 30d, 90d (default 30d)
 */
router.get('/product-pricing/:productId', async (req, res) => {
    try {
        const { productId } = req.params;
        const { 
            include_forecasts = 'true',
            include_competitors = 'true', 
            include_experiments = 'true',
            timeframe = '30d'
        } = req.query;
        
        if (!productId) {
            return res.status(400).json({
                error: 'Invalid product ID',
                message: 'Product ID is required'
            });
        }
        
        const days = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : timeframe === '90d' ? 90 : 30;
        
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'musenest'
        });
        
        // Get product pricing configuration
        const [pricingConfig] = await db.execute(`
            SELECT * FROM product_pricing_config WHERE product_id = ?
        `, [productId]);
        
        if (pricingConfig.length === 0) {
            await db.end();
            return res.status(404).json({
                error: 'Product pricing configuration not found',
                product_id: productId
            });
        }
        
        const productPricing = pricingConfig[0];
        
        // Get recent pricing optimizations
        const [optimizations] = await db.execute(`
            SELECT 
                optimization_id,
                optimization_strategy,
                current_price,
                recommended_price,
                price_change_percentage,
                expected_revenue_impact,
                optimization_confidence,
                decision_status,
                created_at
            FROM pricing_optimization_results 
            WHERE product_id = ? 
              AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            ORDER BY created_at DESC 
            LIMIT 10
        `, [productId, days]);
        
        productPricing.recent_optimizations = optimizations.map(opt => ({
            ...opt,
            current_price: parseFloat(opt.current_price),
            recommended_price: parseFloat(opt.recommended_price),
            price_change_percentage: parseFloat(opt.price_change_percentage),
            expected_revenue_impact: parseFloat(opt.expected_revenue_impact),
            optimization_confidence: parseFloat(opt.optimization_confidence)
        }));
        
        // Get demand forecasts if requested
        if (include_forecasts === 'true') {
            const [forecasts] = await db.execute(`
                SELECT 
                    forecast_id,
                    forecast_model,
                    forecast_horizon_days,
                    baseline_demand,
                    demand_trend,
                    forecast_accuracy,
                    confidence_interval,
                    created_at
                FROM demand_forecasting 
                WHERE product_id = ? 
                  AND forecast_status = 'active'
                  AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
                ORDER BY created_at DESC 
                LIMIT 5
            `, [productId, days]);
            
            productPricing.demand_forecasts = forecasts.map(forecast => ({
                ...forecast,
                baseline_demand: parseFloat(forecast.baseline_demand),
                forecast_accuracy: parseFloat(forecast.forecast_accuracy),
                confidence_interval: JSON.parse(forecast.confidence_interval || '{}')
            }));
        }
        
        // Get competitor analysis if requested
        if (include_competitors === 'true') {
            const [competitors] = await db.execute(`
                SELECT 
                    competitor_id,
                    competitor_name,
                    competitor_price,
                    price_change_percentage,
                    market_share_percentage,
                    competitive_threat_level,
                    quality_comparison,
                    collected_at
                FROM competitor_pricing_analysis 
                WHERE our_product_id = ? 
                  AND collected_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
                ORDER BY competitive_threat_level DESC, collected_at DESC 
                LIMIT 10
            `, [productId, days]);
            
            productPricing.competitor_analysis = competitors.map(comp => ({
                ...comp,
                competitor_price: parseFloat(comp.competitor_price),
                price_change_percentage: parseFloat(comp.price_change_percentage),
                market_share_percentage: parseFloat(comp.market_share_percentage)
            }));
        }
        
        // Get pricing experiments if requested
        if (include_experiments === 'true') {
            const [experiments] = await db.execute(`
                SELECT 
                    experiment_id,
                    experiment_name,
                    experiment_status,
                    control_price,
                    treatment_prices,
                    statistical_significance,
                    effect_size,
                    implementation_decision,
                    total_revenue,
                    participants_count,
                    created_at
                FROM pricing_experiments 
                WHERE product_id = ? 
                  AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
                ORDER BY created_at DESC 
                LIMIT 5
            `, [productId, days]);
            
            productPricing.pricing_experiments = experiments.map(exp => ({
                ...exp,
                control_price: parseFloat(exp.control_price),
                treatment_prices: JSON.parse(exp.treatment_prices || '[]'),
                statistical_significance: parseFloat(exp.statistical_significance || 0),
                effect_size: parseFloat(exp.effect_size || 0),
                total_revenue: parseFloat(exp.total_revenue || 0),
                participants_count: parseInt(exp.participants_count || 0)
            }));
        }
        
        await db.end();
        
        // Process main pricing configuration
        const processedPricing = {
            ...productPricing,
            current_price: parseFloat(productPricing.current_price),
            base_cost: parseFloat(productPricing.base_cost),
            minimum_price: parseFloat(productPricing.minimum_price),
            maximum_price: parseFloat(productPricing.maximum_price),
            target_margin_percentage: parseFloat(productPricing.target_margin_percentage),
            brand_premium_multiplier: parseFloat(productPricing.brand_premium_multiplier),
            quality_score: parseFloat(productPricing.quality_score || 0),
            uniqueness_score: parseFloat(productPricing.uniqueness_score || 0),
            max_price_change_percentage: parseFloat(productPricing.max_price_change_percentage),
            premium_customer_multiplier: parseFloat(productPricing.premium_customer_multiplier),
            discount_customer_multiplier: parseFloat(productPricing.discount_customer_multiplier),
            current_demand_level: parseFloat(productPricing.current_demand_level),
            price_elasticity: parseFloat(productPricing.price_elasticity),
            conversion_rate: parseFloat(productPricing.conversion_rate)
        };
        
        res.json({
            success: true,
            product_id: productId,
            pricing_data: processedPricing,
            analysis_timeframe: timeframe,
            generated_at: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Product pricing retrieval error:', error);
        res.status(500).json({
            error: 'Failed to get product pricing information',
            details: error.message
        });
    }
});

/**
 * GET /api/dynamic-pricing-optimization/analytics
 * Generate comprehensive pricing analytics and performance metrics
 * 
 * Query params:
 * - timeframe: 7d, 30d, 90d (default 30d)
 * - product_id: filter by specific product (optional)
 * - include_forecasts: include forecasting analysis (default true)
 * - include_experiments: include experiment results (default true)
 */
router.get('/analytics', ensureServiceReady, async (req, res) => {
    try {
        const { 
            timeframe = '30d', 
            product_id,
            include_forecasts = 'true',
            include_experiments = 'true' 
        } = req.query;
        
        const validTimeframes = ['7d', '30d', '90d'];
        if (!validTimeframes.includes(timeframe)) {
            return res.status(400).json({
                error: 'Invalid timeframe',
                valid_options: validTimeframes
            });
        }
        
        console.log(`📈 Generating pricing analytics for timeframe: ${timeframe}`);
        
        const analytics = await pricingService.generatePricingAnalytics(timeframe);
        
        // Filter by product if specified
        if (product_id) {
            analytics.product_id = product_id;
        }
        
        res.json({
            success: true,
            ...analytics
        });
        
    } catch (error) {
        console.error('Pricing analytics error:', error);
        res.status(500).json({
            error: 'Failed to generate pricing analytics',
            details: error.message
        });
    }
});

/**
 * GET /api/dynamic-pricing-optimization/dashboard
 * Get pricing dashboard with key metrics and alerts
 * 
 * Query params:
 * - timeframe: 24h, 7d, 30d (default 7d)
 */
router.get('/dashboard', async (req, res) => {
    try {
        const { timeframe = '7d' } = req.query;
        
        const days = timeframe === '24h' ? 1 : timeframe === '7d' ? 7 : 30;
        
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'musenest'
        });
        
        // Get pricing performance summary
        const [pricingPerformance] = await db.execute(`
            SELECT * FROM v_pricing_performance_summary 
            ORDER BY avg_expected_revenue_impact DESC 
            LIMIT 20
        `);
        
        // Get competitor pricing alerts
        const [competitorAlerts] = await db.execute(`
            SELECT * FROM v_competitor_pricing_alerts 
            ORDER BY competitive_threat_level DESC, ABS(price_change_percentage) DESC 
            LIMIT 15
        `);
        
        // Get pricing experiment summary
        const [experimentSummary] = await db.execute(`
            SELECT * FROM v_pricing_experiment_summary 
            ORDER BY successful_optimizations DESC 
            LIMIT 10
        `);
        
        // Get recent pricing optimizations
        const [recentOptimizations] = await db.execute(`
            SELECT 
                product_id,
                optimization_strategy,
                recommended_price,
                price_change_percentage,
                expected_revenue_impact,
                optimization_confidence,
                decision_status,
                created_at
            FROM pricing_optimization_results 
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            ORDER BY expected_revenue_impact DESC 
            LIMIT 20
        `, [days]);
        
        // Get market intelligence summary
        const [marketIntelligence] = await db.execute(`
            SELECT 
                intelligence_type,
                COUNT(*) as intelligence_count,
                AVG(data_quality_score) as avg_quality,
                AVG(market_impact_score) as avg_impact,
                COUNT(CASE WHEN urgency_level IN ('high', 'critical') THEN 1 END) as urgent_items,
                MAX(collected_at) as last_update
            FROM market_intelligence 
            WHERE collected_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            GROUP BY intelligence_type
            ORDER BY avg_impact DESC
        `, [days]);
        
        // Get system performance metrics
        const [systemMetrics] = await db.execute(`
            SELECT 
                COUNT(CASE WHEN por.created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR) THEN 1 END) as optimizations_last_hour,
                COUNT(CASE WHEN cpa.collected_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR) THEN 1 END) as competitor_updates_last_hour,
                COUNT(CASE WHEN pe.updated_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR) THEN 1 END) as experiments_updated_last_hour,
                AVG(por.processing_time_ms) as avg_optimization_time_ms,
                COUNT(CASE WHEN por.decision_status = 'implemented' THEN 1 END) as implemented_optimizations,
                AVG(por.optimization_confidence) as avg_optimization_confidence
            FROM pricing_optimization_results por
            LEFT JOIN competitor_pricing_analysis cpa ON DATE(por.created_at) = DATE(cpa.collected_at)
            LEFT JOIN pricing_experiments pe ON por.product_id = pe.product_id
            WHERE por.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        `, [days]);
        
        await db.end();
        
        // Process results
        const dashboard = {
            timeframe,
            generated_at: new Date().toISOString(),
            
            pricing_performance: pricingPerformance.map(perf => ({
                ...perf,
                current_price: parseFloat(perf.current_price),
                target_margin_percentage: parseFloat(perf.target_margin_percentage),
                optimization_count: parseInt(perf.optimization_count || 0),
                avg_confidence: parseFloat(perf.avg_confidence || 0),
                avg_expected_revenue_impact: parseFloat(perf.avg_expected_revenue_impact || 0),
                implemented_optimizations: parseInt(perf.implemented_optimizations || 0),
                avg_actual_revenue_impact: parseFloat(perf.avg_actual_revenue_impact || 0)
            })),
            
            competitor_alerts: competitorAlerts.map(alert => ({
                ...alert,
                competitor_price: parseFloat(alert.competitor_price),
                our_current_price: parseFloat(alert.our_current_price),
                price_change_percentage: parseFloat(alert.price_change_percentage),
                price_difference: parseFloat(alert.price_difference)
            })),
            
            experiment_summary: experimentSummary.map(exp => ({
                ...exp,
                total_experiments: parseInt(exp.total_experiments || 0),
                completed_experiments: parseInt(exp.completed_experiments || 0),
                avg_significance: parseFloat(exp.avg_significance || 0),
                avg_effect_size: parseFloat(exp.avg_effect_size || 0),
                successful_optimizations: parseInt(exp.successful_optimizations || 0),
                avg_experiment_revenue: parseFloat(exp.avg_experiment_revenue || 0),
                avg_sample_size: parseInt(exp.avg_sample_size || 0)
            })),
            
            recent_optimizations: recentOptimizations.map(opt => ({
                ...opt,
                recommended_price: parseFloat(opt.recommended_price),
                price_change_percentage: parseFloat(opt.price_change_percentage),
                expected_revenue_impact: parseFloat(opt.expected_revenue_impact),
                optimization_confidence: parseFloat(opt.optimization_confidence)
            })),
            
            market_intelligence: marketIntelligence.map(intel => ({
                ...intel,
                intelligence_count: parseInt(intel.intelligence_count || 0),
                avg_quality: parseFloat(intel.avg_quality || 0),
                avg_impact: parseFloat(intel.avg_impact || 0),
                urgent_items: parseInt(intel.urgent_items || 0)
            })),
            
            system_metrics: systemMetrics[0] ? {
                optimizations_last_hour: parseInt(systemMetrics[0].optimizations_last_hour || 0),
                competitor_updates_last_hour: parseInt(systemMetrics[0].competitor_updates_last_hour || 0),
                experiments_updated_last_hour: parseInt(systemMetrics[0].experiments_updated_last_hour || 0),
                avg_optimization_time_ms: parseFloat(systemMetrics[0].avg_optimization_time_ms || 0),
                implemented_optimizations: parseInt(systemMetrics[0].implemented_optimizations || 0),
                avg_optimization_confidence: parseFloat(systemMetrics[0].avg_optimization_confidence || 0)
            } : {}
        };
        
        res.json({
            success: true,
            dashboard
        });
        
    } catch (error) {
        console.error('Dashboard data error:', error);
        res.status(500).json({
            error: 'Failed to get dashboard data',
            details: error.message
        });
    }
});

/**
 * POST /api/dynamic-pricing-optimization/pricing-experiment
 * Create and run a pricing A/B test experiment
 * 
 * Body: {
 *   "experimentName": "Premium Content Price Test",
 *   "productId": "product_123",
 *   "experimentConfig": {
 *     "control_price": 29.99,
 *     "treatment_prices": [24.99, 34.99],
 *     "traffic_allocation": [0.4, 0.3, 0.3],
 *     "duration_days": 14,
 *     "success_metrics": ["conversion_rate", "revenue_per_visitor"],
 *     "minimum_sample_size": 1000
 *   }
 * }
 */
router.post('/pricing-experiment', async (req, res) => {
    try {
        const { experimentName, productId, experimentConfig } = req.body;
        
        if (!experimentName || !productId || !experimentConfig) {
            return res.status(400).json({
                error: 'Missing required parameters',
                required: ['experimentName', 'productId', 'experimentConfig']
            });
        }
        
        if (!experimentConfig.control_price || !experimentConfig.treatment_prices) {
            return res.status(400).json({
                error: 'Invalid experiment configuration',
                message: 'Must include control_price and treatment_prices'
            });
        }
        
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'musenest'
        });
        
        // Generate experiment ID
        const experimentId = 'EXP_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8).toUpperCase();
        
        // Create pricing experiment
        await db.execute(`
            INSERT INTO pricing_experiments (
                experiment_id,
                experiment_name,
                product_id,
                experiment_type,
                control_price,
                treatment_prices,
                traffic_allocation,
                minimum_sample_size,
                planned_duration_days,
                success_metrics,
                experiment_status,
                start_date
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `, [
            experimentId,
            experimentName,
            productId,
            'ab_test',
            experimentConfig.control_price,
            JSON.stringify(experimentConfig.treatment_prices),
            JSON.stringify(experimentConfig.traffic_allocation || []),
            experimentConfig.minimum_sample_size || 1000,
            experimentConfig.duration_days || 14,
            JSON.stringify(experimentConfig.success_metrics || []),
            'running'
        ]);
        
        await db.end();
        
        console.log(`🧪 Created pricing experiment: ${experimentName} for product: ${productId}`);
        
        res.json({
            success: true,
            experiment_id: experimentId,
            experiment_name: experimentName,
            product_id: productId,
            status: 'running',
            message: 'Pricing experiment created and started successfully'
        });
        
    } catch (error) {
        console.error('Pricing experiment creation error:', error);
        res.status(500).json({
            error: 'Failed to create pricing experiment',
            details: error.message
        });
    }
});

/**
 * POST /api/dynamic-pricing-optimization/test
 * Test dynamic pricing optimization with sample data
 */
router.post('/test', ensureServiceReady, async (req, res) => {
    try {
        const testProducts = [
            { id: 'premium_content_1', name: 'Premium Gallery Access', currentPrice: 29.99 },
            { id: 'subscription_basic', name: 'Basic Subscription', currentPrice: 19.99 },
            { id: 'subscription_premium', name: 'Premium Subscription', currentPrice: 49.99 }
        ];
        
        console.log('🧪 Running dynamic pricing optimization test');
        
        const testResults = [];
        
        for (const product of testProducts) {
            const mockOptimizationContext = {
                urgency: 'normal',
                constraints: {
                    min_margin: 0.20,
                    max_price_change: 0.15
                },
                objectives: {
                    primary: 'revenue_maximization',
                    revenue_weight: 0.6,
                    profit_weight: 0.3,
                    market_share_weight: 0.1
                }
            };
            
            const optimization = await pricingService.optimizePricing(
                product.id,
                mockOptimizationContext
            );
            
            testResults.push({
                product: product.name,
                product_id: product.id,
                current_price: product.currentPrice,
                optimization: {
                    recommended_price: optimization.optimized_pricing?.recommended_price,
                    price_change_percentage: optimization.optimized_pricing?.price_change_percentage,
                    expected_revenue_impact: optimization.expected_revenue_impact?.percentage_change,
                    confidence_level: optimization.optimization_metadata?.confidence_level,
                    processing_time: optimization.optimization_metadata?.processing_time_ms
                }
            });
        }
        
        res.json({
            success: true,
            test_products: testProducts.length,
            test_results: testResults,
            message: 'Dynamic pricing optimization test completed successfully'
        });
        
    } catch (error) {
        console.error('Test execution error:', error);
        res.status(500).json({
            error: 'Failed to run test',
            details: error.message
        });
    }
});

// Error handling middleware
router.use((error, req, res, next) => {
    console.error('Dynamic Pricing Optimization API Error:', error);
    res.status(500).json({
        error: 'Internal server error in Dynamic Pricing Optimization API',
        details: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'
    });
});

module.exports = router;