-- Dynamic Pricing Optimization and Market Intelligence Migration
-- Adds comprehensive tables for dynamic pricing, market intelligence,
-- competitor analysis, demand forecasting, and revenue optimization

USE musenest;

-- Product pricing configuration and management
CREATE TABLE IF NOT EXISTS product_pricing_config (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    product_id VARCHAR(200) NOT NULL, -- Links to products/services
    product_type ENUM('content', 'subscription', 'service', 'bundle', 'addon') NOT NULL,
    
    -- Current pricing information
    current_price DECIMAL(10,2) NOT NULL,
    base_cost DECIMAL(10,2), -- Cost of goods/services
    minimum_price DECIMAL(10,2) NOT NULL,
    maximum_price DECIMAL(10,2),
    
    -- Pricing strategy configuration
    pricing_strategy ENUM('competitive', 'value_based', 'cost_plus', 'penetration', 'skimming', 'dynamic', 'hybrid') DEFAULT 'dynamic',
    pricing_tier ENUM('basic', 'premium', 'luxury', 'enterprise') DEFAULT 'premium',
    target_margin_percentage DECIMAL(6,2) DEFAULT 25.00,
    
    -- Market positioning
    market_position ENUM('budget', 'competitive', 'premium', 'luxury') DEFAULT 'competitive',
    brand_premium_multiplier DECIMAL(6,4) DEFAULT 1.0000,
    quality_score DECIMAL(6,4), -- Product quality assessment
    uniqueness_score DECIMAL(6,4), -- Product uniqueness/differentiation
    
    -- Dynamic pricing settings
    dynamic_pricing_enabled BOOLEAN DEFAULT TRUE,
    price_change_frequency_hours INT DEFAULT 24,
    max_price_change_percentage DECIMAL(6,2) DEFAULT 20.00,
    price_stability_period_hours INT DEFAULT 24,
    
    -- Customer segmentation
    segment_pricing_enabled BOOLEAN DEFAULT FALSE,
    premium_customer_multiplier DECIMAL(6,4) DEFAULT 1.1500,
    discount_customer_multiplier DECIMAL(6,4) DEFAULT 0.9000,
    
    -- Inventory and capacity
    inventory_level INT DEFAULT 0,
    capacity_limit INT DEFAULT 0,
    inventory_pricing_enabled BOOLEAN DEFAULT FALSE,
    
    -- Performance metrics
    current_demand_level DECIMAL(8,2) DEFAULT 0,
    price_elasticity DECIMAL(8,4) DEFAULT -1.2000, -- Demand sensitivity to price
    conversion_rate DECIMAL(6,4) DEFAULT 0.0500,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_product_id (product_id),
    INDEX idx_product_type (product_type),
    INDEX idx_pricing_strategy (pricing_strategy),
    INDEX idx_current_price (current_price DESC),
    INDEX idx_dynamic_pricing_enabled (dynamic_pricing_enabled),
    INDEX idx_price_elasticity (price_elasticity),
    INDEX idx_updated_at (updated_at DESC),
    
    UNIQUE KEY unique_product_pricing (product_id)
);

-- Market intelligence data and competitor monitoring
CREATE TABLE IF NOT EXISTS market_intelligence (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    intelligence_type ENUM('competitor_pricing', 'market_trends', 'demand_patterns', 'economic_indicators', 'industry_analysis') NOT NULL,
    data_source ENUM('api_integration', 'web_scraping', 'manual_input', 'third_party_feed', 'internal_analysis') NOT NULL,
    
    -- Market scope and context
    market_segment VARCHAR(100),
    geographic_scope ENUM('local', 'regional', 'national', 'global') DEFAULT 'national',
    product_category VARCHAR(100),
    time_period_start TIMESTAMP,
    time_period_end TIMESTAMP,
    
    -- Intelligence data
    intelligence_data JSON NOT NULL, -- Raw market intelligence data
    processed_insights JSON, -- Processed insights and analysis
    key_findings JSON, -- Key findings and observations
    trend_indicators JSON, -- Trend indicators and patterns
    
    -- Data quality and reliability
    data_quality_score DECIMAL(6,4) NOT NULL,
    reliability_score DECIMAL(6,4) NOT NULL,
    confidence_level DECIMAL(6,4) NOT NULL,
    data_freshness_hours INT DEFAULT 0, -- How old the data is
    
    -- Impact and relevance
    market_impact_score DECIMAL(6,4), -- How much this affects the market
    relevance_score DECIMAL(6,4), -- Relevance to our products
    urgency_level ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
    
    -- Source metadata
    source_identifier VARCHAR(200), -- ID of the data source
    collection_method VARCHAR(100), -- How data was collected
    validation_status ENUM('unvalidated', 'validated', 'verified', 'disputed') DEFAULT 'unvalidated',
    
    collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_intelligence_type (intelligence_type),
    INDEX idx_data_source (data_source),
    INDEX idx_market_segment (market_segment),
    INDEX idx_product_category (product_category),
    INDEX idx_data_quality_score (data_quality_score DESC),
    INDEX idx_market_impact_score (market_impact_score DESC),
    INDEX idx_urgency_level (urgency_level),
    INDEX idx_collected_at (collected_at DESC),
    INDEX idx_time_period (time_period_start, time_period_end)
);

-- Competitor pricing analysis and monitoring
CREATE TABLE IF NOT EXISTS competitor_pricing_analysis (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    competitor_id VARCHAR(100) NOT NULL,
    competitor_name VARCHAR(200),
    competitor_type ENUM('direct', 'indirect', 'substitute', 'market_leader', 'niche_player') DEFAULT 'direct',
    
    -- Product/service being compared
    competitor_product_id VARCHAR(200),
    competitor_product_name VARCHAR(300),
    our_product_id VARCHAR(200), -- Our equivalent product
    
    -- Pricing information
    competitor_price DECIMAL(10,2) NOT NULL,
    previous_price DECIMAL(10,2),
    price_change_amount DECIMAL(10,2),
    price_change_percentage DECIMAL(8,4),
    pricing_model VARCHAR(100), -- subscription, one-time, tiered, etc.
    
    -- Market context
    market_share_percentage DECIMAL(6,2),
    brand_strength_score DECIMAL(6,4), -- Brand strength assessment
    competitive_advantage TEXT, -- Competitor's key advantages
    competitive_weaknesses TEXT, -- Competitor's weaknesses
    
    -- Quality and positioning
    quality_comparison ENUM('inferior', 'similar', 'superior') DEFAULT 'similar',
    feature_comparison_score DECIMAL(6,4), -- Feature comparison vs our product
    value_proposition_strength DECIMAL(6,4),
    
    -- Market intelligence
    pricing_strategy_assessment VARCHAR(200), -- Assessed pricing strategy
    promotion_activities JSON, -- Current promotions and offers
    distribution_channels JSON, -- Where they sell
    target_customer_segments JSON, -- Their target segments
    
    -- Threat assessment
    competitive_threat_level ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
    price_war_risk DECIMAL(6,4), -- Risk of price competition
    response_urgency ENUM('none', 'monitor', 'respond', 'immediate') DEFAULT 'monitor',
    
    -- Data collection metadata
    data_source VARCHAR(200), -- Where price data came from
    collection_method VARCHAR(100), -- How data was collected
    data_accuracy_confidence DECIMAL(6,4) DEFAULT 0.8000,
    
    -- Timing information
    price_effective_date TIMESTAMP, -- When competitor price became effective
    next_expected_change_date TIMESTAMP, -- When we expect next price change
    
    collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_competitor_id (competitor_id),
    INDEX idx_competitor_type (competitor_type),
    INDEX idx_our_product_id (our_product_id),
    INDEX idx_competitor_price (competitor_price),
    INDEX idx_price_change_percentage (price_change_percentage DESC),
    INDEX idx_market_share_percentage (market_share_percentage DESC),
    INDEX idx_competitive_threat_level (competitive_threat_level),
    INDEX idx_collected_at (collected_at DESC),
    INDEX idx_price_effective_date (price_effective_date DESC),
    INDEX idx_competitor_product (competitor_id, our_product_id, collected_at DESC)
);

-- Demand forecasting and predictions
CREATE TABLE IF NOT EXISTS demand_forecasting (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    product_id VARCHAR(200) NOT NULL,
    forecast_id VARCHAR(100) UNIQUE NOT NULL, -- Unique forecast identifier
    
    -- Forecast parameters
    forecast_model ENUM('time_series', 'regression', 'neural_network', 'ensemble', 'arima', 'exponential_smoothing') NOT NULL,
    forecast_horizon_days INT NOT NULL, -- How many days into future
    confidence_interval DECIMAL(6,4) DEFAULT 0.9000, -- 90% confidence by default
    
    -- Historical data used for forecasting
    training_period_start TIMESTAMP NOT NULL,
    training_period_end TIMESTAMP NOT NULL,
    training_data_points INT, -- Number of data points used
    data_quality_score DECIMAL(6,4), -- Quality of training data
    
    -- Forecast results
    baseline_demand DECIMAL(12,2) NOT NULL, -- Current/baseline demand level
    predicted_demand JSON NOT NULL, -- Demand predictions by time period
    demand_trend ENUM('declining', 'stable', 'growing', 'volatile') DEFAULT 'stable',
    seasonality_patterns JSON, -- Identified seasonal patterns
    
    -- Forecast accuracy and validation
    forecast_accuracy DECIMAL(6,4), -- Historical accuracy of this model
    mean_absolute_error DECIMAL(12,4), -- MAE of forecasts
    root_mean_square_error DECIMAL(12,4), -- RMSE of forecasts
    confidence_bounds JSON, -- Upper and lower confidence bounds
    
    -- Influencing factors
    price_elasticity_factor DECIMAL(8,4) DEFAULT -1.2000,
    seasonality_factor DECIMAL(6,4) DEFAULT 1.0000,
    competitive_factor DECIMAL(6,4) DEFAULT 1.0000,
    economic_factor DECIMAL(6,4) DEFAULT 1.0000,
    marketing_factor DECIMAL(6,4) DEFAULT 1.0000,
    external_factors JSON, -- Other factors affecting demand
    
    -- Model metadata
    model_version VARCHAR(50),
    model_parameters JSON, -- Model-specific parameters
    feature_importance JSON, -- Importance of different features
    
    -- Forecast lifecycle
    forecast_status ENUM('active', 'expired', 'superseded', 'invalid') DEFAULT 'active',
    expires_at TIMESTAMP, -- When forecast expires
    superseded_by_forecast_id VARCHAR(100), -- ID of replacement forecast
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_product_id (product_id),
    INDEX idx_forecast_id (forecast_id),
    INDEX idx_forecast_model (forecast_model),
    INDEX idx_forecast_horizon_days (forecast_horizon_days),
    INDEX idx_forecast_accuracy (forecast_accuracy DESC),
    INDEX idx_baseline_demand (baseline_demand DESC),
    INDEX idx_forecast_status (forecast_status),
    INDEX idx_expires_at (expires_at),
    INDEX idx_created_at (created_at DESC),
    
    FOREIGN KEY (superseded_by_forecast_id) REFERENCES demand_forecasting(forecast_id) ON DELETE SET NULL
);

-- Pricing optimization results and decisions
CREATE TABLE IF NOT EXISTS pricing_optimization_results (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    optimization_id VARCHAR(100) UNIQUE NOT NULL,
    product_id VARCHAR(200) NOT NULL,
    
    -- Optimization context
    optimization_trigger ENUM('scheduled', 'competitor_change', 'demand_change', 'inventory_level', 'manual', 'market_event') NOT NULL,
    optimization_strategy ENUM('revenue_maximization', 'profit_maximization', 'market_share', 'competitive_response', 'penetration') DEFAULT 'revenue_maximization',
    
    -- Current state
    current_price DECIMAL(10,2) NOT NULL,
    current_demand DECIMAL(12,2),
    current_market_position VARCHAR(100),
    
    -- Optimization inputs
    market_intelligence_data JSON, -- Market data used for optimization
    competitor_analysis_data JSON, -- Competitor data used
    demand_forecast_data JSON, -- Demand forecast used
    customer_segment_data JSON, -- Customer segmentation data
    
    -- Optimization results
    recommended_price DECIMAL(10,2) NOT NULL,
    price_change_amount DECIMAL(10,2),
    price_change_percentage DECIMAL(8,4),
    optimization_confidence DECIMAL(6,4) NOT NULL,
    
    -- Expected impact
    expected_demand_change DECIMAL(12,2),
    expected_revenue_impact DECIMAL(12,2),
    expected_profit_impact DECIMAL(12,2),
    expected_market_share_impact DECIMAL(8,4),
    risk_assessment_score DECIMAL(6,4),
    
    -- Implementation details
    implementation_priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
    rollout_strategy VARCHAR(200), -- How to implement the price change
    monitoring_recommendations TEXT, -- What to monitor after implementation
    
    -- Decision outcome
    decision_status ENUM('pending', 'approved', 'rejected', 'implemented', 'expired') DEFAULT 'pending',
    decision_rationale TEXT, -- Why decision was made
    approved_by VARCHAR(100), -- Who approved the decision
    approved_at TIMESTAMP NULL,
    implemented_at TIMESTAMP NULL,
    
    -- Performance tracking
    actual_demand_change DECIMAL(12,2), -- Actual results after implementation
    actual_revenue_impact DECIMAL(12,2),
    actual_profit_impact DECIMAL(12,2),
    optimization_accuracy DECIMAL(6,4), -- How accurate was the prediction
    
    -- Model and processing metadata
    models_used JSON, -- Which models were used for optimization
    processing_time_ms INT, -- How long optimization took
    data_quality_score DECIMAL(6,4), -- Quality of input data
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_optimization_id (optimization_id),
    INDEX idx_product_id (product_id),
    INDEX idx_optimization_trigger (optimization_trigger),
    INDEX idx_optimization_strategy (optimization_strategy),
    INDEX idx_recommended_price (recommended_price),
    INDEX idx_optimization_confidence (optimization_confidence DESC),
    INDEX idx_expected_revenue_impact (expected_revenue_impact DESC),
    INDEX idx_decision_status (decision_status),
    INDEX idx_implementation_priority (implementation_priority),
    INDEX idx_approved_at (approved_at DESC),
    INDEX idx_implemented_at (implemented_at DESC),
    INDEX idx_created_at (created_at DESC),
    INDEX idx_optimization_performance (product_id, decision_status, created_at DESC)
);

-- Pricing experiments and A/B tests
CREATE TABLE IF NOT EXISTS pricing_experiments (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    experiment_id VARCHAR(100) UNIQUE NOT NULL,
    experiment_name VARCHAR(300) NOT NULL,
    product_id VARCHAR(200) NOT NULL,
    
    -- Experiment design
    experiment_type ENUM('ab_test', 'multivariate', 'bandit', 'sequential') DEFAULT 'ab_test',
    experiment_hypothesis TEXT, -- What we're testing
    success_metrics JSON, -- What metrics define success
    
    -- Test configuration
    control_price DECIMAL(10,2) NOT NULL, -- Current/control price
    treatment_prices JSON NOT NULL, -- Test prices to compare
    traffic_allocation JSON NOT NULL, -- How traffic is split between variants
    minimum_sample_size INT DEFAULT 1000,
    
    -- Statistical configuration
    significance_level DECIMAL(6,4) DEFAULT 0.0500, -- 5% significance level
    statistical_power DECIMAL(6,4) DEFAULT 0.8000, -- 80% power
    minimum_detectable_effect DECIMAL(6,4) DEFAULT 0.0500, -- 5% minimum effect
    
    -- Experiment lifecycle
    experiment_status ENUM('draft', 'running', 'paused', 'completed', 'cancelled') DEFAULT 'draft',
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    planned_duration_days INT DEFAULT 14,
    
    -- Results and analysis
    participants_count INT DEFAULT 0,
    conversions_count INT DEFAULT 0,
    total_revenue DECIMAL(12,2) DEFAULT 0,
    statistical_significance DECIMAL(6,4), -- p-value
    effect_size DECIMAL(8,4), -- Measured effect size
    confidence_interval JSON, -- Confidence interval of effect
    
    -- Experiment results by variant
    variant_results JSON, -- Results for each variant
    winning_variant VARCHAR(50), -- Which variant won
    winner_confidence DECIMAL(6,4), -- Confidence in winner
    
    -- Implementation decision
    implementation_decision ENUM('implement_winner', 'implement_control', 'run_longer', 'inconclusive') DEFAULT 'inconclusive',
    decision_rationale TEXT,
    implemented_price DECIMAL(10,2), -- Final price implemented
    
    -- Learning and insights
    key_learnings TEXT, -- What we learned from experiment
    customer_segment_insights JSON, -- Insights by customer segment
    follow_up_recommendations TEXT, -- Recommended next steps
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_experiment_id (experiment_id),
    INDEX idx_experiment_name (experiment_name),
    INDEX idx_product_id (product_id),
    INDEX idx_experiment_type (experiment_type),
    INDEX idx_experiment_status (experiment_status),
    INDEX idx_start_date (start_date),
    INDEX idx_end_date (end_date),
    INDEX idx_statistical_significance (statistical_significance),
    INDEX idx_participants_count (participants_count DESC),
    INDEX idx_total_revenue (total_revenue DESC),
    INDEX idx_created_at (created_at DESC),
    INDEX idx_active_experiments (product_id, experiment_status, start_date DESC)
);

-- Customer pricing segments and personalization
CREATE TABLE IF NOT EXISTS customer_pricing_segments (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    segment_id VARCHAR(100) UNIQUE NOT NULL,
    segment_name VARCHAR(200) NOT NULL,
    
    -- Segment characteristics
    segment_description TEXT,
    segment_criteria JSON NOT NULL, -- Criteria for segment membership
    customer_count INT DEFAULT 0, -- Number of customers in segment
    segment_value_score DECIMAL(8,4), -- Value/profitability of segment
    
    -- Pricing behavior characteristics
    price_sensitivity DECIMAL(6,4) DEFAULT 0.5000, -- How sensitive to price changes
    willingness_to_pay DECIMAL(10,2), -- Average willingness to pay
    purchase_frequency DECIMAL(8,2), -- How often they purchase
    average_order_value DECIMAL(10,2), -- Average purchase amount
    lifetime_value DECIMAL(12,2), -- Customer lifetime value
    
    -- Segment-specific pricing
    pricing_strategy ENUM('premium', 'competitive', 'discount', 'value', 'penetration') DEFAULT 'competitive',
    price_multiplier DECIMAL(6,4) DEFAULT 1.0000, -- Multiplier vs base price
    discount_eligibility BOOLEAN DEFAULT FALSE,
    maximum_discount_percentage DECIMAL(6,2) DEFAULT 0,
    exclusive_pricing_tiers BOOLEAN DEFAULT FALSE,
    
    -- Behavioral patterns
    conversion_rate DECIMAL(6,4), -- Conversion rate for this segment
    churn_rate DECIMAL(6,4), -- Churn rate
    price_comparison_behavior ENUM('none', 'minimal', 'moderate', 'extensive') DEFAULT 'moderate',
    loyalty_level ENUM('low', 'medium', 'high', 'very_high') DEFAULT 'medium',
    
    -- Personalization preferences
    personalized_pricing_enabled BOOLEAN DEFAULT FALSE,
    dynamic_pricing_participation BOOLEAN DEFAULT TRUE,
    promotional_responsiveness DECIMAL(6,4), -- Response to promotions
    seasonal_behavior_patterns JSON, -- How behavior changes seasonally
    
    -- Segment performance
    revenue_contribution DECIMAL(12,2), -- Revenue from this segment
    profit_contribution DECIMAL(12,2), -- Profit from this segment
    growth_rate DECIMAL(8,4), -- Segment growth rate
    retention_rate DECIMAL(6,4), -- Customer retention rate
    
    -- Segment lifecycle
    segment_status ENUM('active', 'inactive', 'testing', 'deprecated') DEFAULT 'active',
    last_updated_at TIMESTAMP,
    segment_version VARCHAR(20) DEFAULT '1.0',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_segment_id (segment_id),
    INDEX idx_segment_name (segment_name),
    INDEX idx_customer_count (customer_count DESC),
    INDEX idx_segment_value_score (segment_value_score DESC),
    INDEX idx_price_sensitivity (price_sensitivity),
    INDEX idx_lifetime_value (lifetime_value DESC),
    INDEX idx_pricing_strategy (pricing_strategy),
    INDEX idx_conversion_rate (conversion_rate DESC),
    INDEX idx_segment_status (segment_status),
    INDEX idx_revenue_contribution (revenue_contribution DESC),
    INDEX idx_updated_at (updated_at DESC)
);

-- Pricing performance analytics and metrics
CREATE TABLE IF NOT EXISTS pricing_performance_analytics (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    analysis_period_start TIMESTAMP NOT NULL,
    analysis_period_end TIMESTAMP NOT NULL,
    analysis_type ENUM('revenue_impact', 'profit_optimization', 'market_positioning', 'customer_response', 'competitive_analysis', 'segment_performance') NOT NULL,
    
    -- Scope of analysis
    product_scope JSON, -- Which products were analyzed
    customer_segment_scope JSON, -- Which segments were included
    geographic_scope ENUM('local', 'regional', 'national', 'global') DEFAULT 'national',
    
    -- Performance metrics
    total_revenue DECIMAL(15,2), -- Total revenue in period
    revenue_change_percentage DECIMAL(8,4), -- Revenue change vs previous period
    total_profit DECIMAL(15,2), -- Total profit in period
    profit_margin_percentage DECIMAL(6,4), -- Average profit margin
    average_selling_price DECIMAL(10,2), -- Average selling price
    price_realization_rate DECIMAL(6,4), -- % of list price actually achieved
    
    -- Volume and demand metrics
    units_sold BIGINT DEFAULT 0, -- Total units sold
    demand_fulfillment_rate DECIMAL(6,4), -- % of demand fulfilled
    inventory_turnover_rate DECIMAL(8,4), -- Inventory turnover
    stockout_incidents INT DEFAULT 0, -- Number of stockout incidents
    
    -- Customer metrics
    customer_acquisition_count INT DEFAULT 0, -- New customers acquired
    customer_retention_rate DECIMAL(6,4), -- Customer retention
    average_customer_value DECIMAL(10,2), -- Average value per customer
    price_sensitivity_index DECIMAL(6,4), -- Overall price sensitivity
    
    -- Competitive metrics
    market_share_percentage DECIMAL(6,4), -- Market share
    price_competitiveness_score DECIMAL(6,4), -- How competitive our prices are
    win_rate_vs_competitors DECIMAL(6,4), -- Win rate in competitive situations
    
    -- Optimization effectiveness
    pricing_changes_implemented INT DEFAULT 0, -- Number of price changes
    optimization_accuracy DECIMAL(6,4), -- Accuracy of pricing predictions
    revenue_uplift_from_optimization DECIMAL(12,2), -- Additional revenue from optimization
    profit_uplift_from_optimization DECIMAL(12,2), -- Additional profit from optimization
    
    -- Analytics data
    detailed_analytics JSON NOT NULL, -- Detailed analysis results
    key_insights JSON, -- Key insights from analysis
    trend_analysis JSON, -- Trend analysis results
    recommendations JSON, -- Strategic recommendations
    
    -- Data quality and confidence
    data_completeness_percentage DECIMAL(6,4), -- How complete the data is
    analysis_confidence_level DECIMAL(6,4), -- Confidence in analysis
    statistical_significance DECIMAL(6,4), -- Statistical significance of findings
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_analysis_period (analysis_period_start, analysis_period_end),
    INDEX idx_analysis_type (analysis_type),
    INDEX idx_total_revenue (total_revenue DESC),
    INDEX idx_revenue_change_percentage (revenue_change_percentage DESC),
    INDEX idx_profit_margin_percentage (profit_margin_percentage DESC),
    INDEX idx_market_share_percentage (market_share_percentage DESC),
    INDEX idx_optimization_accuracy (optimization_accuracy DESC),
    INDEX idx_created_at (created_at DESC)
);

-- Insert default pricing configurations
INSERT IGNORE INTO customer_pricing_segments (segment_id, segment_name, segment_description, segment_criteria, price_sensitivity, pricing_strategy, price_multiplier) VALUES
('premium_customers', 'Premium Customers', 'High-value customers with low price sensitivity', '{"min_ltv": 1000, "purchase_frequency": "high", "brand_loyalty": "high"}', 0.2, 'premium', 1.15),
('regular_customers', 'Regular Customers', 'Standard customers with moderate price sensitivity', '{"min_ltv": 200, "purchase_frequency": "medium"}', 0.5, 'competitive', 1.00),
('price_sensitive_customers', 'Price-Sensitive Customers', 'Customers who are highly sensitive to pricing', '{"price_comparison_behavior": "extensive", "discount_usage": "high"}', 0.8, 'discount', 0.90),
('new_customers', 'New Customers', 'Recently acquired customers in onboarding phase', '{"signup_date": "last_30_days", "purchase_count": "< 3"}', 0.6, 'penetration', 0.85);

-- Create views for pricing analytics and monitoring
CREATE OR REPLACE VIEW v_pricing_performance_summary AS
SELECT 
    ppc.product_id,
    ppc.current_price,
    ppc.pricing_strategy,
    ppc.target_margin_percentage,
    COUNT(por.id) as optimization_count,
    AVG(por.optimization_confidence) as avg_confidence,
    AVG(por.expected_revenue_impact) as avg_expected_revenue_impact,
    COUNT(CASE WHEN por.decision_status = 'implemented' THEN 1 END) as implemented_optimizations,
    MAX(por.created_at) as last_optimization_date,
    AVG(por.actual_revenue_impact) as avg_actual_revenue_impact
FROM product_pricing_config ppc
LEFT JOIN pricing_optimization_results por ON ppc.product_id = por.product_id 
    AND por.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY ppc.product_id, ppc.current_price, ppc.pricing_strategy, ppc.target_margin_percentage
ORDER BY avg_expected_revenue_impact DESC;

CREATE OR REPLACE VIEW v_competitor_pricing_alerts AS
SELECT 
    cpa.competitor_id,
    cpa.competitor_name,
    cpa.our_product_id,
    cpa.competitor_price,
    cpa.price_change_percentage,
    cpa.competitive_threat_level,
    cpa.response_urgency,
    cpa.collected_at,
    ppc.current_price as our_current_price,
    (cpa.competitor_price - ppc.current_price) as price_difference,
    CASE 
        WHEN cpa.competitor_price < ppc.current_price THEN 'competitor_lower'
        WHEN cpa.competitor_price > ppc.current_price THEN 'competitor_higher'
        ELSE 'price_match'
    END as price_comparison
FROM competitor_pricing_analysis cpa
JOIN product_pricing_config ppc ON cpa.our_product_id = ppc.product_id
WHERE cpa.collected_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
  AND (cpa.competitive_threat_level IN ('high', 'critical') OR ABS(cpa.price_change_percentage) > 10)
ORDER BY cpa.competitive_threat_level DESC, ABS(cpa.price_change_percentage) DESC;

CREATE OR REPLACE VIEW v_pricing_experiment_summary AS
SELECT 
    pe.product_id,
    COUNT(*) as total_experiments,
    COUNT(CASE WHEN pe.experiment_status = 'completed' THEN 1 END) as completed_experiments,
    AVG(pe.statistical_significance) as avg_significance,
    AVG(pe.effect_size) as avg_effect_size,
    COUNT(CASE WHEN pe.implementation_decision = 'implement_winner' THEN 1 END) as successful_optimizations,
    AVG(pe.total_revenue) as avg_experiment_revenue,
    MAX(pe.end_date) as last_experiment_date,
    AVG(pe.participants_count) as avg_sample_size
FROM pricing_experiments pe
WHERE pe.created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)
GROUP BY pe.product_id
HAVING COUNT(*) > 0
ORDER BY successful_optimizations DESC, avg_effect_size DESC;

-- Create stored procedures for pricing operations
DELIMITER $$

CREATE PROCEDURE OptimizePricingForProduct(
    IN p_product_id VARCHAR(200),
    IN p_optimization_strategy VARCHAR(50) DEFAULT 'revenue_maximization',
    IN p_trigger VARCHAR(50) DEFAULT 'scheduled'
)
BEGIN
    DECLARE v_current_price DECIMAL(10,2);
    DECLARE v_optimization_id VARCHAR(100);
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    -- Generate optimization ID
    SET v_optimization_id = CONCAT('OPT_', UNIX_TIMESTAMP(), '_', SUBSTRING(MD5(RAND()), 1, 8));
    
    -- Get current pricing information
    SELECT current_price INTO v_current_price 
    FROM product_pricing_config 
    WHERE product_id = p_product_id;
    
    IF v_current_price IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Product not found or no pricing configured';
    END IF;
    
    -- Create optimization record (simplified - in production this would involve complex calculations)
    INSERT INTO pricing_optimization_results (
        optimization_id,
        product_id,
        optimization_trigger,
        optimization_strategy,
        current_price,
        recommended_price,
        price_change_percentage,
        optimization_confidence,
        expected_revenue_impact,
        implementation_priority,
        decision_status
    ) VALUES (
        v_optimization_id,
        p_product_id,
        p_trigger,
        p_optimization_strategy,
        v_current_price,
        v_current_price * (1 + (RAND() - 0.5) * 0.1), -- Mock optimization
        (RAND() - 0.5) * 10, -- Mock percentage change
        0.75 + RAND() * 0.25, -- Mock confidence
        1000 + RAND() * 5000, -- Mock revenue impact
        'medium',
        'pending'
    );
    
    SELECT v_optimization_id as optimization_id, 'Pricing optimization completed' as message;
    
    COMMIT;
END$$

CREATE PROCEDURE GetPricingAnalytics(
    IN p_product_id VARCHAR(200) DEFAULT NULL,
    IN p_timeframe VARCHAR(10) DEFAULT '30d'
)
BEGIN
    DECLARE v_days INT DEFAULT 30;
    
    -- Convert timeframe to days
    CASE p_timeframe
        WHEN '7d' THEN SET v_days = 7;
        WHEN '30d' THEN SET v_days = 30;
        WHEN '90d' THEN SET v_days = 90;
        ELSE SET v_days = 30;
    END CASE;
    
    -- Pricing performance summary
    SELECT 
        'Pricing Performance' as section,
        por.product_id,
        COUNT(*) as optimization_count,
        AVG(por.optimization_confidence) as avg_confidence,
        AVG(por.expected_revenue_impact) as avg_expected_revenue,
        COUNT(CASE WHEN por.decision_status = 'implemented' THEN 1 END) as implemented_count,
        AVG(CASE WHEN por.actual_revenue_impact IS NOT NULL THEN por.actual_revenue_impact END) as avg_actual_revenue
    FROM pricing_optimization_results por
    WHERE por.created_at >= DATE_SUB(NOW(), INTERVAL v_days DAY)
      AND (p_product_id IS NULL OR por.product_id = p_product_id)
    GROUP BY por.product_id
    ORDER BY avg_expected_revenue DESC;
    
    -- Competitor analysis summary
    SELECT 
        'Competitor Analysis' as section,
        cpa.our_product_id,
        COUNT(DISTINCT cpa.competitor_id) as competitors_monitored,
        AVG(cpa.competitor_price) as avg_competitor_price,
        COUNT(CASE WHEN ABS(cpa.price_change_percentage) > 5 THEN 1 END) as significant_changes,
        COUNT(CASE WHEN cpa.competitive_threat_level IN ('high', 'critical') THEN 1 END) as threat_count
    FROM competitor_pricing_analysis cpa
    WHERE cpa.collected_at >= DATE_SUB(NOW(), INTERVAL v_days DAY)
      AND (p_product_id IS NULL OR cpa.our_product_id = p_product_id)
    GROUP BY cpa.our_product_id
    ORDER BY threat_count DESC;
END$$

DELIMITER ;

-- Create indexes for optimal pricing query performance
ALTER TABLE product_pricing_config ADD INDEX idx_pricing_performance (dynamic_pricing_enabled, pricing_strategy, updated_at DESC);
ALTER TABLE market_intelligence ADD INDEX idx_intelligence_lookup (intelligence_type, market_segment, collected_at DESC);
ALTER TABLE competitor_pricing_analysis ADD INDEX idx_competitor_monitoring (competitor_type, competitive_threat_level, collected_at DESC);
ALTER TABLE pricing_optimization_results ADD INDEX idx_optimization_tracking (product_id, decision_status, expected_revenue_impact DESC);
ALTER TABLE pricing_experiments ADD INDEX idx_experiment_performance (experiment_status, statistical_significance DESC, total_revenue DESC);

-- Grant permissions for dynamic pricing service
-- Note: In production, create a dedicated pricing service user
-- GRANT SELECT, INSERT, UPDATE, DELETE ON musenest.product_pricing_config TO 'pricing_service'@'localhost';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON musenest.pricing_optimization_results TO 'pricing_service'@'localhost';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON musenest.pricing_experiments TO 'pricing_service'@'localhost';
-- GRANT EXECUTE ON PROCEDURE musenest.OptimizePricingForProduct TO 'pricing_service'@'localhost';
-- GRANT EXECUTE ON PROCEDURE musenest.GetPricingAnalytics TO 'pricing_service'@'localhost';

SELECT 'Dynamic Pricing Optimization and Market Intelligence migration completed successfully' as status;