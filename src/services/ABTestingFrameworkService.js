/**
 * Automated A/B Testing Framework Service
 * 
 * This service provides comprehensive A/B testing capabilities with statistical significance
 * tracking, automated traffic allocation, and real-time performance monitoring.
 * 
 * Features:
 * - Automated experiment setup and management
 * - Statistical significance tracking using Bayesian and Frequentist methods
 * - Real-time experiment monitoring and alerting
 * - Traffic allocation optimization
 * - Multi-variate testing support
 * - Automated experiment conclusion based on statistical criteria
 * - Integration with recommendation systems and other ML services
 */

const mysql = require('mysql2/promise');
const Redis = require('redis');
const EventEmitter = require('events');
const crypto = require('crypto');

class ABTestingFrameworkService extends EventEmitter {
    constructor() {
        super();
        
        // Statistical significance configuration
        this.statisticalConfig = {
            confidence_level: 0.95, // 95% confidence level
            minimum_detectable_effect: 0.05, // 5% minimum effect size
            statistical_power: 0.80, // 80% statistical power
            alpha: 0.05, // Type I error rate
            beta: 0.20, // Type II error rate
            
            // Bayesian settings
            bayesian_threshold: 0.95, // Probability threshold for Bayesian significance
            credible_interval: 0.95, // Credible interval for Bayesian analysis
            prior_strength: 1.0, // Strength of prior beliefs
            
            // Sequential testing
            sequential_testing: true,
            peek_penalty: 1.2, // Penalty factor for peeking at results
            max_sample_ratio: 5.0 // Maximum sample size vs initial calculation
        };
        
        // Experiment management configuration
        this.experimentConfig = {
            default_duration_days: 14,
            minimum_duration_days: 3,
            maximum_duration_days: 90,
            minimum_sample_size: 100,
            maximum_concurrent_experiments: 10,
            
            // Traffic allocation
            default_control_ratio: 0.5,
            minimum_variant_traffic: 0.1,
            traffic_ramp_up_days: 2,
            
            // Quality controls
            outlier_detection: true,
            bot_filtering: true,
            conversion_window_hours: 24,
            attribution_model: 'last_click'
        };
        
        // Supported experiment types and metrics
        this.experimentTypes = {
            recommendation_algorithm: {
                primary_metrics: ['click_through_rate', 'conversion_rate', 'engagement_rate'],
                secondary_metrics: ['diversity_score', 'novelty_score', 'user_satisfaction'],
                statistical_test: 'proportion_test',
                effect_size_calculation: 'relative_difference'
            },
            ui_component: {
                primary_metrics: ['conversion_rate', 'bounce_rate', 'time_on_page'],
                secondary_metrics: ['user_engagement', 'feature_usage', 'completion_rate'],
                statistical_test: 'proportion_test',
                effect_size_calculation: 'relative_difference'
            },
            pricing_strategy: {
                primary_metrics: ['revenue_per_user', 'conversion_rate', 'lifetime_value'],
                secondary_metrics: ['churn_rate', 'upsell_rate', 'customer_satisfaction'],
                statistical_test: 'ttest',
                effect_size_calculation: 'cohen_d'
            },
            content_optimization: {
                primary_metrics: ['engagement_rate', 'view_duration', 'sharing_rate'],
                secondary_metrics: ['scroll_depth', 'return_rate', 'content_rating'],
                statistical_test: 'proportion_test',
                effect_size_calculation: 'relative_difference'
            }
        };
        
        // Real-time monitoring and alerting
        this.monitoringConfig = {
            monitoring_frequency_minutes: 5,
            alert_thresholds: {
                significant_drop: -0.20, // 20% drop triggers alert
                significant_increase: 0.20, // 20% increase triggers alert
                low_conversion_rate: 0.01, // Below 1% conversion triggers alert
                high_bounce_rate: 0.80, // Above 80% bounce rate triggers alert
                sample_ratio_mismatch: 0.05 // 5% mismatch in traffic allocation
            },
            early_stopping_criteria: {
                futility_threshold: 0.01, // Stop if effect size unlikely to be > 1%
                superiority_threshold: 0.99, // Stop if 99% certain of winner
                minimum_samples_for_early_stop: 1000
            }
        };
        
        // Active experiments cache
        this.activeExperiments = new Map();
        this.experimentCache = new Map();
        this.statisticalCache = new Map();
        
        // Monitoring intervals
        this.monitoringIntervals = new Map();
        
        // Performance tracking
        this.performanceMetrics = {
            experiment_creation_latency: [],
            allocation_latency: [],
            statistical_calculation_latency: [],
            total_experiments_managed: 0,
            successful_conclusions: 0,
            inconclusive_experiments: 0
        };
    }
    
    /**
     * Initialize the A/B testing framework service
     */
    async initialize() {
        try {
            console.log('🧪 Initializing A/B Testing Framework Service...');
            
            // Initialize database connection
            this.db = await mysql.createConnection({
                host: process.env.DB_HOST || 'localhost',
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD || '',
                database: process.env.DB_DATABASE || 'musenest'
            });
            
            // Initialize Redis for experiment state and caching
            this.redis = Redis.createClient({
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379
            });
            await this.redis.connect();
            
            // Initialize experiment-specific Redis (separate DB)
            this.experimentRedis = Redis.createClient({
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379,
                db: 5 // Use database 5 for A/B testing
            });
            await this.experimentRedis.connect();
            
            // Load active experiments
            await this.loadActiveExperiments();
            
            // Start real-time monitoring
            this.startExperimentMonitoring();
            
            // Start statistical calculations scheduler
            this.startStatisticalCalculations();
            
            // Start experiment health checks
            this.startHealthChecks();
            
            console.log('✅ A/B Testing Framework Service initialized successfully');
            console.log(`📊 Managing ${this.activeExperiments.size} active experiments`);
            
            this.emit('initialized');
            
        } catch (error) {
            console.error('❌ Failed to initialize A/B Testing Framework Service:', error);
            throw error;
        }
    }
    
    /**
     * Create a new A/B test experiment
     */
    async createExperiment(experimentDefinition) {
        try {
            const startTime = Date.now();
            
            const {
                name,
                description,
                experimentType,
                variants,
                trafficAllocation = {},
                targetingCriteria = {},
                primaryMetric,
                secondaryMetrics = [],
                durationDays = this.experimentConfig.default_duration_days,
                minimumSampleSize = this.experimentConfig.minimum_sample_size,
                statisticalSettings = {}
            } = experimentDefinition;
            
            console.log(`🧪 Creating new A/B test experiment: ${name}`);
            
            // Validate experiment definition
            const validation = await this.validateExperimentDefinition(experimentDefinition);
            if (!validation.valid) {
                throw new Error(`Experiment validation failed: ${validation.errors.join(', ')}`);
            }
            
            // Check concurrent experiment limits
            if (this.activeExperiments.size >= this.experimentConfig.maximum_concurrent_experiments) {
                throw new Error('Maximum concurrent experiments limit reached');
            }
            
            // Generate experiment ID
            const experimentId = this.generateExperimentId(name);
            
            // Calculate statistical requirements
            const statisticalPlan = await this.calculateStatisticalRequirements({
                primaryMetric,
                variants: variants.length,
                minimumDetectableEffect: statisticalSettings.minimumDetectableEffect || this.statisticalConfig.minimum_detectable_effect,
                statisticalPower: statisticalSettings.statisticalPower || this.statisticalConfig.statistical_power,
                alpha: statisticalSettings.alpha || this.statisticalConfig.alpha
            });
            
            // Setup traffic allocation
            const trafficPlan = this.setupTrafficAllocation(variants, trafficAllocation);
            
            // Create experiment record in database
            await this.db.execute(`
                INSERT INTO ab_test_experiments (
                    experiment_id,
                    name,
                    description,
                    experiment_type,
                    status,
                    variants,
                    traffic_allocation,
                    targeting_criteria,
                    primary_metric,
                    secondary_metrics,
                    statistical_plan,
                    planned_duration_days,
                    minimum_sample_size,
                    calculated_sample_size,
                    start_date,
                    planned_end_date,
                    created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            `, [
                experimentId,
                name,
                description,
                experimentType,
                'draft',
                JSON.stringify(variants),
                JSON.stringify(trafficPlan),
                JSON.stringify(targetingCriteria),
                primaryMetric,
                JSON.stringify(secondaryMetrics),
                JSON.stringify(statisticalPlan),
                durationDays,
                minimumSampleSize,
                statisticalPlan.requiredSampleSize,
                null, // Will be set when experiment starts
                null,
                new Date()
            ]);
            
            // Create variant records
            for (let i = 0; i < variants.length; i++) {
                const variant = variants[i];
                await this.db.execute(`
                    INSERT INTO ab_test_variants (
                        experiment_id,
                        variant_name,
                        variant_type,
                        configuration,
                        traffic_percentage,
                        is_control,
                        created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, NOW())
                `, [
                    experimentId,
                    variant.name,
                    variant.type || 'treatment',
                    JSON.stringify(variant.configuration || {}),
                    trafficPlan[variant.name],
                    variant.isControl === true,
                    new Date()
                ]);
            }
            
            // Initialize experiment state in Redis
            await this.experimentRedis.hSet(`experiment:${experimentId}`, {
                status: 'draft',
                created_at: new Date().toISOString(),
                traffic_allocation: JSON.stringify(trafficPlan),
                participant_count: '0',
                conversion_count: '0'
            });
            
            // Track performance
            const latency = Date.now() - startTime;
            this.performanceMetrics.experiment_creation_latency.push(latency);
            this.performanceMetrics.total_experiments_managed++;
            
            console.log(`✅ Created experiment ${experimentId} in ${latency}ms`);
            console.log(`📊 Required sample size: ${statisticalPlan.requiredSampleSize} per variant`);
            
            this.emit('experiment-created', {
                experimentId,
                name,
                variants: variants.length,
                requiredSampleSize: statisticalPlan.requiredSampleSize,
                plannedDuration: durationDays
            });
            
            return {
                success: true,
                experimentId,
                name,
                status: 'draft',
                variants: variants.map(v => v.name),
                trafficAllocation: trafficPlan,
                statisticalPlan,
                metadata: {
                    createdAt: new Date().toISOString(),
                    latency
                }
            };
            
        } catch (error) {
            console.error('Error creating A/B test experiment:', error);
            throw error;
        }
    }
    
    /**
     * Start an experiment (move from draft to running)
     */
    async startExperiment(experimentId) {
        try {
            console.log(`🚀 Starting experiment: ${experimentId}`);
            
            // Get experiment details
            const [experiments] = await this.db.execute(`
                SELECT * FROM ab_test_experiments WHERE experiment_id = ?
            `, [experimentId]);
            
            if (experiments.length === 0) {
                throw new Error('Experiment not found');
            }
            
            const experiment = experiments[0];
            
            if (experiment.status !== 'draft') {
                throw new Error(`Cannot start experiment with status: ${experiment.status}`);
            }
            
            // Final pre-flight checks
            const preflightCheck = await this.performPreflightChecks(experimentId);
            if (!preflightCheck.passed) {
                throw new Error(`Preflight checks failed: ${preflightCheck.issues.join(', ')}`);
            }
            
            // Calculate end date
            const startDate = new Date();
            const endDate = new Date(startDate.getTime() + (experiment.planned_duration_days * 24 * 60 * 60 * 1000));
            
            // Update experiment status
            await this.db.execute(`
                UPDATE ab_test_experiments 
                SET status = 'running', 
                    start_date = ?, 
                    planned_end_date = ?,
                    updated_at = NOW()
                WHERE experiment_id = ?
            `, [startDate, endDate, experimentId]);
            
            // Update Redis state
            await this.experimentRedis.hSet(`experiment:${experimentId}`, {
                status: 'running',
                start_date: startDate.toISOString(),
                planned_end_date: endDate.toISOString()
            });
            
            // Load experiment into active cache
            const experimentData = {
                ...experiment,
                status: 'running',
                start_date: startDate,
                planned_end_date: endDate,
                variants: JSON.parse(experiment.variants),
                traffic_allocation: JSON.parse(experiment.traffic_allocation),
                statistical_plan: JSON.parse(experiment.statistical_plan)
            };
            
            this.activeExperiments.set(experimentId, experimentData);
            
            // Start monitoring for this experiment
            this.startExperimentMonitoring(experimentId);
            
            console.log(`✅ Started experiment ${experimentId}`);
            console.log(`⏰ Planned duration: ${experiment.planned_duration_days} days (until ${endDate.toISOString()})`);
            
            this.emit('experiment-started', {
                experimentId,
                name: experiment.name,
                startDate: startDate.toISOString(),
                plannedEndDate: endDate.toISOString(),
                variants: experimentData.variants.length
            });
            
            return {
                success: true,
                experimentId,
                status: 'running',
                startDate: startDate.toISOString(),
                plannedEndDate: endDate.toISOString()
            };
            
        } catch (error) {
            console.error('Error starting experiment:', error);
            throw error;
        }
    }
    
    /**
     * Assign user to experiment variant
     */
    async assignUserToVariant(experimentId, userId, userContext = {}) {
        try {
            const startTime = Date.now();
            
            // Check if user is already assigned
            const existingAssignment = await this.experimentRedis.hGet(
                `assignment:${experimentId}:${userId}`,
                'variant'
            );
            
            if (existingAssignment) {
                return {
                    experimentId,
                    userId,
                    variant: existingAssignment,
                    isNew: false,
                    assignedAt: await this.experimentRedis.hGet(`assignment:${experimentId}:${userId}`, 'assigned_at')
                };
            }
            
            // Get experiment
            const experiment = this.activeExperiments.get(experimentId);
            if (!experiment || experiment.status !== 'running') {
                throw new Error(`Experiment ${experimentId} is not active`);
            }
            
            // Check if user meets targeting criteria
            const meetsTargeting = this.checkUserTargeting(userContext, experiment.targeting_criteria);
            if (!meetsTargeting) {
                return {
                    experimentId,
                    userId,
                    variant: null,
                    isNew: false,
                    reason: 'targeting_criteria_not_met'
                };
            }
            
            // Assign variant using deterministic hash-based allocation
            const assignedVariant = this.determineVariantAssignment(
                userId,
                experimentId,
                experiment.traffic_allocation
            );
            
            // Store assignment
            const assignmentData = {
                variant: assignedVariant,
                assigned_at: new Date().toISOString(),
                user_context: JSON.stringify(userContext),
                assignment_method: 'hash_based'
            };
            
            // Store in Redis
            await this.experimentRedis.hSet(`assignment:${experimentId}:${userId}`, assignmentData);
            
            // Store in database for permanent record
            await this.db.execute(`
                INSERT INTO ab_test_participants (
                    experiment_id,
                    user_id,
                    variant_name,
                    assigned_at,
                    user_context,
                    assignment_method
                ) VALUES (?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    variant_name = VALUES(variant_name),
                    user_context = VALUES(user_context)
            `, [
                experimentId,
                userId,
                assignedVariant,
                new Date(),
                JSON.stringify(userContext),
                'hash_based'
            ]);
            
            // Update participant count
            await this.experimentRedis.hIncrBy(`experiment:${experimentId}`, 'participant_count', 1);
            await this.experimentRedis.hIncrBy(`variant:${experimentId}:${assignedVariant}`, 'participant_count', 1);
            
            // Track performance
            const latency = Date.now() - startTime;
            this.performanceMetrics.allocation_latency.push(latency);
            
            console.log(`👤 Assigned user ${userId} to variant ${assignedVariant} in experiment ${experimentId}`);
            
            this.emit('user-assigned', {
                experimentId,
                userId,
                variant: assignedVariant,
                latency
            });
            
            return {
                experimentId,
                userId,
                variant: assignedVariant,
                isNew: true,
                assignedAt: assignmentData.assigned_at
            };
            
        } catch (error) {
            console.error('Error assigning user to variant:', error);
            throw error;
        }
    }
    
    /**
     * Track conversion or event for experiment analysis
     */
    async trackExperimentEvent(experimentId, userId, eventType, eventData = {}) {
        try {
            console.log(`📊 Tracking ${eventType} event for user ${userId} in experiment ${experimentId}`);
            
            // Get user's variant assignment
            const assignment = await this.experimentRedis.hGetAll(`assignment:${experimentId}:${userId}`);
            if (!assignment.variant) {
                console.log(`User ${userId} not assigned to experiment ${experimentId}`);
                return { success: false, reason: 'user_not_assigned' };
            }
            
            // Get experiment configuration
            const experiment = this.activeExperiments.get(experimentId);
            if (!experiment) {
                throw new Error(`Experiment ${experimentId} not found`);
            }
            
            // Validate event is relevant to experiment
            const isRelevantEvent = this.isEventRelevantToExperiment(eventType, experiment);
            if (!isRelevantEvent) {
                return { success: false, reason: 'event_not_relevant' };
            }
            
            // Store event in database
            await this.db.execute(`
                INSERT INTO ab_test_events (
                    experiment_id,
                    user_id,
                    variant_name,
                    event_type,
                    event_data,
                    event_value,
                    recorded_at
                ) VALUES (?, ?, ?, ?, ?, ?, NOW())
            `, [
                experimentId,
                userId,
                assignment.variant,
                eventType,
                JSON.stringify(eventData),
                eventData.value || 0
            ]);
            
            // Update real-time counters in Redis
            if (eventType === experiment.primary_metric || eventType === 'conversion') {
                await this.experimentRedis.hIncrBy(`experiment:${experimentId}`, 'conversion_count', 1);
                await this.experimentRedis.hIncrBy(`variant:${experimentId}:${assignment.variant}`, 'conversion_count', 1);
            }
            
            // Update event-specific counters
            await this.experimentRedis.hIncrBy(`event:${experimentId}:${eventType}`, 'total_count', 1);
            await this.experimentRedis.hIncrBy(`event:${experimentId}:${assignment.variant}:${eventType}`, 'count', 1);
            
            // Check if this triggers any statistical significance updates
            await this.scheduleStatisticalUpdate(experimentId);
            
            this.emit('event-tracked', {
                experimentId,
                userId,
                variant: assignment.variant,
                eventType,
                timestamp: new Date().toISOString()
            });
            
            return {
                success: true,
                experimentId,
                userId,
                variant: assignment.variant,
                eventType,
                recorded: true
            };
            
        } catch (error) {
            console.error('Error tracking experiment event:', error);
            throw error;
        }
    }
    
    /**
     * Calculate statistical significance for experiment
     */
    async calculateStatisticalSignificance(experimentId) {
        try {
            const startTime = Date.now();
            console.log(`📈 Calculating statistical significance for experiment ${experimentId}`);
            
            // Get experiment data
            const experiment = this.activeExperiments.get(experimentId);
            if (!experiment) {
                throw new Error(`Experiment ${experimentId} not found`);
            }
            
            // Get participant and conversion data
            const [participantData] = await this.db.execute(`
                SELECT 
                    variant_name,
                    COUNT(*) as participants
                FROM ab_test_participants
                WHERE experiment_id = ?
                GROUP BY variant_name
            `, [experimentId]);
            
            const [conversionData] = await this.db.execute(`
                SELECT 
                    variant_name,
                    COUNT(*) as conversions,
                    SUM(event_value) as total_value,
                    AVG(event_value) as avg_value
                FROM ab_test_events
                WHERE experiment_id = ?
                  AND event_type = ?
                GROUP BY variant_name
            `, [experimentId, experiment.primary_metric]);
            
            // Combine data
            const variantStats = this.combineVariantData(participantData, conversionData);
            
            // Perform statistical tests
            const statisticalResults = {
                frequentist: await this.performFrequentistTest(variantStats, experiment),
                bayesian: await this.performBayesianTest(variantStats, experiment),
                effect_size: this.calculateEffectSize(variantStats, experiment),
                confidence_intervals: this.calculateConfidenceIntervals(variantStats),
                sample_ratio_mismatch: this.detectSampleRatioMismatch(variantStats, experiment.traffic_allocation)
            };
            
            // Determine experiment conclusion
            const conclusion = this.determineExperimentConclusion(statisticalResults, experiment);
            
            // Store results
            await this.db.execute(`
                INSERT INTO ab_test_statistical_results (
                    experiment_id,
                    statistical_method,
                    test_statistic,
                    p_value,
                    confidence_level,
                    effect_size,
                    confidence_interval_lower,
                    confidence_interval_upper,
                    is_significant,
                    winning_variant,
                    conclusion,
                    statistical_power,
                    sample_sizes,
                    calculated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE
                    test_statistic = VALUES(test_statistic),
                    p_value = VALUES(p_value),
                    effect_size = VALUES(effect_size),
                    confidence_interval_lower = VALUES(confidence_interval_lower),
                    confidence_interval_upper = VALUES(confidence_interval_upper),
                    is_significant = VALUES(is_significant),
                    winning_variant = VALUES(winning_variant),
                    conclusion = VALUES(conclusion),
                    statistical_power = VALUES(statistical_power),
                    calculated_at = VALUES(calculated_at)
            `, [
                experimentId,
                'combined',
                statisticalResults.frequentist.test_statistic,
                statisticalResults.frequentist.p_value,
                this.statisticalConfig.confidence_level,
                statisticalResults.effect_size.cohens_d,
                statisticalResults.confidence_intervals.lower,
                statisticalResults.confidence_intervals.upper,
                conclusion.is_significant,
                conclusion.winning_variant,
                conclusion.conclusion_type,
                statisticalResults.frequentist.statistical_power,
                JSON.stringify(variantStats)
            ]);
            
            // Update experiment cache
            this.statisticalCache.set(experimentId, {
                ...statisticalResults,
                conclusion,
                calculated_at: new Date().toISOString()
            });
            
            // Check if experiment should be concluded
            if (conclusion.should_conclude) {
                await this.concludeExperiment(experimentId, conclusion);
            }
            
            const latency = Date.now() - startTime;
            this.performanceMetrics.statistical_calculation_latency.push(latency);
            
            console.log(`✅ Calculated statistical significance for ${experimentId} in ${latency}ms`);
            console.log(`📊 P-value: ${statisticalResults.frequentist.p_value.toFixed(4)}, Significant: ${conclusion.is_significant}`);
            
            return {
                experimentId,
                statistical_results: statisticalResults,
                conclusion,
                variant_stats: variantStats,
                calculated_at: new Date().toISOString(),
                latency
            };
            
        } catch (error) {
            console.error('Error calculating statistical significance:', error);
            throw error;
        }
    }
    
    /**
     * Get experiment results and analysis
     */
    async getExperimentResults(experimentId, includeRawData = false) {
        try {
            // Get experiment details
            const [experiments] = await this.db.execute(`
                SELECT * FROM ab_test_experiments WHERE experiment_id = ?
            `, [experimentId]);
            
            if (experiments.length === 0) {
                throw new Error('Experiment not found');
            }
            
            const experiment = experiments[0];
            
            // Get statistical results
            const [statisticalResults] = await this.db.execute(`
                SELECT * FROM ab_test_statistical_results 
                WHERE experiment_id = ? 
                ORDER BY calculated_at DESC 
                LIMIT 1
            `, [experimentId]);
            
            // Get variant performance
            const [variantPerformance] = await this.db.execute(`
                SELECT 
                    av.variant_name,
                    av.is_control,
                    COUNT(DISTINCT ap.user_id) as participants,
                    COUNT(ae.id) as conversions,
                    COUNT(ae.id) / COUNT(DISTINCT ap.user_id) as conversion_rate,
                    COALESCE(SUM(ae.event_value), 0) as total_value,
                    COALESCE(AVG(ae.event_value), 0) as avg_value_per_conversion,
                    COALESCE(SUM(ae.event_value) / COUNT(DISTINCT ap.user_id), 0) as avg_value_per_user
                FROM ab_test_variants av
                LEFT JOIN ab_test_participants ap ON av.experiment_id = ap.experiment_id AND av.variant_name = ap.variant_name
                LEFT JOIN ab_test_events ae ON ap.experiment_id = ae.experiment_id AND ap.user_id = ae.user_id AND ap.variant_name = ae.variant_name
                WHERE av.experiment_id = ?
                GROUP BY av.variant_name, av.is_control
                ORDER BY av.is_control DESC, av.variant_name
            `, [experimentId]);
            
            // Get timeline data
            const [timelineData] = await this.db.execute(`
                SELECT 
                    DATE(ae.recorded_at) as date,
                    ae.variant_name,
                    COUNT(*) as daily_conversions,
                    COUNT(DISTINCT ae.user_id) as daily_users
                FROM ab_test_events ae
                WHERE ae.experiment_id = ?
                  AND ae.event_type = ?
                GROUP BY DATE(ae.recorded_at), ae.variant_name
                ORDER BY date, ae.variant_name
            `, [experimentId, experiment.primary_metric]);
            
            let rawData = {};
            if (includeRawData) {
                // Get raw event data
                const [events] = await this.db.execute(`
                    SELECT * FROM ab_test_events 
                    WHERE experiment_id = ? 
                    ORDER BY recorded_at DESC 
                    LIMIT 10000
                `, [experimentId]);
                
                const [participants] = await this.db.execute(`
                    SELECT * FROM ab_test_participants 
                    WHERE experiment_id = ? 
                    ORDER BY assigned_at DESC
                `, [experimentId]);
                
                rawData = { events, participants };
            }
            
            // Calculate additional insights
            const insights = this.generateExperimentInsights(
                experiment,
                variantPerformance,
                statisticalResults[0],
                timelineData
            );
            
            return {
                success: true,
                experiment: {
                    ...experiment,
                    variants: JSON.parse(experiment.variants),
                    traffic_allocation: JSON.parse(experiment.traffic_allocation),
                    statistical_plan: JSON.parse(experiment.statistical_plan)
                },
                statistical_results: statisticalResults[0] ? {
                    ...statisticalResults[0],
                    sample_sizes: JSON.parse(statisticalResults[0].sample_sizes || '{}')
                } : null,
                variant_performance: variantPerformance.map(vp => ({
                    ...vp,
                    conversion_rate: parseFloat(vp.conversion_rate || 0),
                    total_value: parseFloat(vp.total_value || 0),
                    avg_value_per_conversion: parseFloat(vp.avg_value_per_conversion || 0),
                    avg_value_per_user: parseFloat(vp.avg_value_per_user || 0)
                })),
                timeline: timelineData,
                insights,
                raw_data: includeRawData ? rawData : undefined,
                generated_at: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('Error getting experiment results:', error);
            throw error;
        }
    }
    
    // Utility methods
    
    generateExperimentId(name) {
        const timestamp = Date.now().toString(36);
        const randomSuffix = crypto.randomBytes(4).toString('hex');
        const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 20);
        return `exp_${cleanName}_${timestamp}_${randomSuffix}`;
    }
    
    determineVariantAssignment(userId, experimentId, trafficAllocation) {
        // Use consistent hash-based assignment
        const hash = crypto.createHash('md5')
            .update(`${userId}_${experimentId}`)
            .digest('hex');
        
        const hashValue = parseInt(hash.substring(0, 8), 16) / 0xffffffff;
        
        let cumulativePercentage = 0;
        for (const [variant, percentage] of Object.entries(trafficAllocation)) {
            cumulativePercentage += percentage;
            if (hashValue <= cumulativePercentage) {
                return variant;
            }
        }
        
        // Fallback to first variant
        return Object.keys(trafficAllocation)[0];
    }
    
    async startExperimentMonitoring(experimentId = null) {
        const experimentsToMonitor = experimentId ? [experimentId] : Array.from(this.activeExperiments.keys());
        
        for (const expId of experimentsToMonitor) {
            if (!this.monitoringIntervals.has(expId)) {
                const interval = setInterval(async () => {
                    try {
                        await this.performExperimentHealthCheck(expId);
                    } catch (error) {
                        console.error(`Error in experiment monitoring for ${expId}:`, error);
                    }
                }, this.monitoringConfig.monitoring_frequency_minutes * 60 * 1000);
                
                this.monitoringIntervals.set(expId, interval);
            }
        }
    }
    
    /**
     * Get service health status
     */
    async getHealthStatus() {
        try {
            const redisConnected = this.redis && this.redis.isReady;
            const experimentRedisConnected = this.experimentRedis && this.experimentRedis.isReady;
            const dbConnected = this.db && await this.db.ping();
            
            const avgAllocationLatency = this.performanceMetrics.allocation_latency.length > 0
                ? this.performanceMetrics.allocation_latency.reduce((a, b) => a + b, 0) / this.performanceMetrics.allocation_latency.length
                : 0;
            
            const avgStatisticalLatency = this.performanceMetrics.statistical_calculation_latency.length > 0
                ? this.performanceMetrics.statistical_calculation_latency.reduce((a, b) => a + b, 0) / this.performanceMetrics.statistical_calculation_latency.length
                : 0;
            
            return {
                status: redisConnected && experimentRedisConnected && dbConnected ? 'healthy' : 'degraded',
                components: {
                    redis: redisConnected,
                    experimentRedis: experimentRedisConnected,
                    database: dbConnected
                },
                experiments: {
                    active: this.activeExperiments.size,
                    maximum_concurrent: this.experimentConfig.maximum_concurrent_experiments,
                    total_managed: this.performanceMetrics.total_experiments_managed,
                    successful_conclusions: this.performanceMetrics.successful_conclusions,
                    monitoring_intervals: this.monitoringIntervals.size
                },
                performance: {
                    avgAllocationLatency: Math.round(avgAllocationLatency),
                    avgStatisticalLatency: Math.round(avgStatisticalLatency),
                    cacheSize: this.experimentCache.size
                },
                uptime: process.uptime(),
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                status: 'error',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
    
    /**
     * Shutdown service gracefully
     */
    async shutdown() {
        try {
            console.log('🔄 Shutting down A/B Testing Framework Service...');
            
            // Clear monitoring intervals
            for (const interval of this.monitoringIntervals.values()) {
                clearInterval(interval);
            }
            this.monitoringIntervals.clear();
            
            if (this.redis) {
                await this.redis.disconnect();
            }
            
            if (this.experimentRedis) {
                await this.experimentRedis.disconnect();
            }
            
            if (this.db) {
                await this.db.end();
            }
            
            this.removeAllListeners();
            
            console.log('✅ A/B Testing Framework Service shutdown complete');
        } catch (error) {
            console.error('Error during service shutdown:', error);
        }
    }
}

module.exports = ABTestingFrameworkService;