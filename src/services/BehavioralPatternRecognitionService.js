/**
 * Behavioral Pattern Recognition for Fraud and Abuse Detection Service
 * 
 * This service provides advanced behavioral analysis and pattern recognition capabilities
 * for detecting fraudulent activities, abuse patterns, suspicious behaviors, and security
 * threats using machine learning and statistical analysis.
 * 
 * Features:
 * - Real-time behavioral anomaly detection
 * - Fraud pattern recognition and prevention
 * - Abuse detection and automated response
 * - User behavior profiling and risk assessment
 * - Account security monitoring and alerts
 * - Multi-dimensional pattern analysis
 * - Predictive risk scoring and threat assessment
 * - Automated investigation and response workflows
 */

const mysql = require('mysql2/promise');
const Redis = require('redis');
const EventEmitter = require('events');
const crypto = require('crypto');

class BehavioralPatternRecognitionService extends EventEmitter {
    constructor() {
        super();
        
        // Behavioral analysis configuration
        this.behavioralConfig = {
            // User behavior tracking
            behavior_tracking: {
                enabled: true,
                tracking_window_hours: 24,
                session_analysis: true,
                interaction_patterns: true,
                navigation_patterns: true,
                temporal_patterns: true,
                device_fingerprinting: true,
                geolocation_analysis: true
            },
            
            // Anomaly detection models
            anomaly_detection: {
                statistical_threshold: 3.0, // Standard deviations
                machine_learning_models: ['isolation_forest', 'one_class_svm', 'lstm_autoencoder'],
                ensemble_voting: true,
                confidence_threshold: 0.8,
                adaptive_thresholds: true,
                real_time_scoring: true
            },
            
            // Behavioral metrics
            behavioral_metrics: {
                session_duration: { weight: 0.15, normal_range: [300, 3600] }, // 5 minutes to 1 hour
                click_rate: { weight: 0.12, normal_range: [0.5, 5.0] }, // clicks per minute
                page_dwell_time: { weight: 0.10, normal_range: [10, 300] }, // seconds
                navigation_velocity: { weight: 0.13, normal_range: [1, 10] }, // pages per minute
                interaction_depth: { weight: 0.11, normal_range: [2, 20] }, // interactions per session
                feature_usage_pattern: { weight: 0.14, normal_range: [0.3, 0.9] }, // feature utilization ratio
                error_rate: { weight: 0.08, normal_range: [0.0, 0.1] }, // error frequency
                retry_behavior: { weight: 0.07, normal_range: [0, 3] }, // retry attempts
                temporal_consistency: { weight: 0.10, normal_range: [0.7, 1.0] } // time pattern consistency
            }
        };
        
        // Fraud detection configuration  
        this.fraudConfig = {
            // Fraud detection patterns
            fraud_patterns: {
                account_takeover: {
                    enabled: true,
                    indicators: ['unusual_login_location', 'device_change', 'password_change', 'profile_modifications'],
                    risk_threshold: 0.7,
                    immediate_action: 'require_verification'
                },
                
                payment_fraud: {
                    enabled: true,
                    indicators: ['multiple_payment_methods', 'rapid_purchases', 'unusual_amounts', 'failed_attempts'],
                    risk_threshold: 0.8,
                    immediate_action: 'block_transaction'
                },
                
                identity_fraud: {
                    enabled: true,
                    indicators: ['inconsistent_personal_info', 'synthetic_identity', 'document_anomalies'],
                    risk_threshold: 0.75,
                    immediate_action: 'manual_review'
                },
                
                bot_behavior: {
                    enabled: true,
                    indicators: ['superhuman_speed', 'repetitive_patterns', 'no_mouse_movement', 'consistent_timing'],
                    risk_threshold: 0.6,
                    immediate_action: 'challenge_verification'
                },
                
                social_engineering: {
                    enabled: true,
                    indicators: ['rapid_trust_building', 'information_extraction', 'urgency_tactics'],
                    risk_threshold: 0.65,
                    immediate_action: 'alert_user_and_admin'
                }
            },
            
            // Risk scoring weights
            risk_factors: {
                location_anomaly: 0.20,
                device_anomaly: 0.15,
                behavioral_anomaly: 0.25,
                temporal_anomaly: 0.15,
                transaction_anomaly: 0.25
            },
            
            // Response thresholds
            response_thresholds: {
                low_risk: 0.3,
                medium_risk: 0.6,
                high_risk: 0.8,
                critical_risk: 0.95
            }
        };
        
        // Abuse detection configuration
        this.abuseConfig = {
            // Abuse pattern categories
            abuse_categories: {
                content_abuse: {
                    enabled: true,
                    patterns: ['spam_content', 'inappropriate_uploads', 'copyright_violation', 'hate_content'],
                    detection_methods: ['content_analysis', 'frequency_analysis', 'user_reports'],
                    auto_action_threshold: 0.8
                },
                
                platform_abuse: {
                    enabled: true,
                    patterns: ['fake_reviews', 'manipulation_attempts', 'system_gaming', 'resource_abuse'],
                    detection_methods: ['behavioral_analysis', 'network_analysis', 'statistical_analysis'],
                    auto_action_threshold: 0.75
                },
                
                harassment_abuse: {
                    enabled: true,
                    patterns: ['targeted_harassment', 'stalking_behavior', 'doxxing_attempts', 'coordinated_attacks'],
                    detection_methods: ['interaction_analysis', 'communication_patterns', 'temporal_clustering'],
                    auto_action_threshold: 0.7
                },
                
                financial_abuse: {
                    enabled: true,
                    patterns: ['chargeback_fraud', 'refund_abuse', 'promotional_abuse', 'currency_manipulation'],
                    detection_methods: ['transaction_analysis', 'pattern_matching', 'velocity_checks'],
                    auto_action_threshold: 0.85
                }
            },
            
            // Detection sensitivity
            sensitivity_levels: {
                conservative: { false_positive_tolerance: 0.1, detection_threshold: 0.9 },
                balanced: { false_positive_tolerance: 0.05, detection_threshold: 0.8 },
                aggressive: { false_positive_tolerance: 0.02, detection_threshold: 0.7 }
            }
        };
        
        // Security monitoring configuration
        this.securityConfig = {
            // Security event monitoring
            security_events: {
                login_anomalies: { enabled: true, severity: 'medium' },
                privilege_escalation: { enabled: true, severity: 'high' },
                data_exfiltration: { enabled: true, severity: 'critical' },
                brute_force_attempts: { enabled: true, severity: 'high' },
                session_hijacking: { enabled: true, severity: 'critical' },
                api_abuse: { enabled: true, severity: 'medium' },
                unauthorized_access: { enabled: true, severity: 'critical' }
            },
            
            // Threat intelligence integration
            threat_intelligence: {
                enabled: true,
                ip_reputation_check: true,
                domain_reputation_check: true,
                threat_feeds: ['malware_ips', 'botnet_ips', 'tor_exit_nodes'],
                update_frequency_hours: 6
            },
            
            // Incident response automation
            incident_response: {
                auto_response_enabled: true,
                escalation_thresholds: {
                    automatic: 0.9,
                    manual_review: 0.7,
                    monitoring_only: 0.5
                },
                response_actions: ['block_user', 'require_verification', 'limit_access', 'alert_admins', 'log_incident']
            }
        };
        
        // Initialize data structures and caches
        this.userBehaviorProfiles = new Map();
        this.realtimeDetectors = new Map();
        this.patternCache = new Map();
        this.riskScores = new Map();
        
        // Model states and performance tracking
        this.detectionModels = {
            anomaly_detectors: {},
            fraud_detectors: {},
            abuse_detectors: {},
            security_monitors: {}
        };
        
        // Performance metrics and statistics
        this.performanceMetrics = {
            events_processed: 0,
            anomalies_detected: 0,
            fraud_cases_prevented: 0,
            abuse_cases_detected: 0,
            false_positive_rate: 0,
            detection_accuracy: 0,
            avg_response_time: 0,
            risk_distribution: { low: 0, medium: 0, high: 0, critical: 0 }
        };
        
        // Active monitoring sessions
        this.activeSessions = new Map();
        this.behaviorStreams = new Map();
    }
    
    /**
     * Initialize the behavioral pattern recognition service
     */
    async initialize() {
        try {
            console.log('🔒 Initializing Behavioral Pattern Recognition Service...');
            
            // Initialize database connection
            this.db = await mysql.createConnection({
                host: process.env.DB_HOST || 'localhost',
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD || '',
                database: process.env.DB_DATABASE || 'phoenix4ge'
            });
            
            // Initialize Redis for real-time data and caching
            this.redis = Redis.createClient({
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379
            });
            await this.redis.connect();
            
            // Initialize behavioral-specific Redis (separate DB)
            this.behavioralRedis = Redis.createClient({
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379,
                db: 10 // Use database 10 for behavioral analysis
            });
            await this.behavioralRedis.connect();
            
            // Load machine learning models for pattern detection
            await this.loadDetectionModels();
            
            // Initialize user behavior baselines
            await this.initializeBehaviorBaselines();
            
            // Start real-time behavior monitoring
            this.startRealtimeMonitoring();
            
            // Start automated threat detection
            this.startThreatDetection();
            
            // Start incident response system
            this.startIncidentResponse();
            
            // Start performance monitoring
            this.startPerformanceMonitoring();
            
            console.log('✅ Behavioral Pattern Recognition Service initialized successfully');
            console.log(`🛡️ Loaded ${Object.keys(this.detectionModels).length} detection model categories`);
            console.log(`⚡ Real-time monitoring: ${this.behavioralConfig.behavior_tracking.enabled ? 'Enabled' : 'Disabled'}`);
            
            this.emit('initialized');
            
        } catch (error) {
            console.error('❌ Failed to initialize Behavioral Pattern Recognition Service:', error);
            throw error;
        }
    }
    
    /**
     * Analyze user behavior for anomalies and threats
     */
    async analyzeBehaviorPattern(userId, behaviorData, context = {}) {
        try {
            const startTime = Date.now();
            
            console.log(`🔍 Analyzing behavior pattern for user: ${userId}`);
            
            // Load user behavior profile
            const userProfile = await this.loadUserBehaviorProfile(userId);
            
            // Normalize and validate behavior data
            const normalizedData = this.normalizeBehaviorData(behaviorData);
            
            // Perform multi-dimensional anomaly detection
            const anomalyResults = await this.detectBehavioralAnomalies(userId, normalizedData, userProfile);
            
            // Analyze fraud risk indicators
            const fraudAnalysis = await this.analyzeFraudRisk(userId, normalizedData, userProfile, context);
            
            // Detect abuse patterns
            const abuseAnalysis = await this.detectAbusePatterns(userId, normalizedData, context);
            
            // Perform security threat assessment
            const securityAssessment = await this.assessSecurityThreats(userId, normalizedData, context);
            
            // Calculate composite risk score
            const riskScoring = this.calculateCompositeRiskScore(anomalyResults, fraudAnalysis, abuseAnalysis, securityAssessment);
            
            // Generate behavioral insights
            const behavioralInsights = this.generateBehavioralInsights(normalizedData, userProfile, anomalyResults);
            
            // Determine required actions
            const requiredActions = await this.determineRequiredActions(riskScoring, fraudAnalysis, abuseAnalysis);
            
            // Update user behavior profile
            await this.updateBehaviorProfile(userId, normalizedData, anomalyResults);
            
            // Create comprehensive analysis result
            const behaviorAnalysis = {
                user_id: userId,
                analysis_timestamp: new Date().toISOString(),
                
                // Core analysis results
                anomaly_detection: anomalyResults,
                fraud_analysis: fraudAnalysis,
                abuse_analysis: abuseAnalysis,
                security_assessment: securityAssessment,
                
                // Risk assessment
                risk_scoring: riskScoring,
                risk_level: this.categorizeRiskLevel(riskScoring.composite_score),
                
                // Insights and actions
                behavioral_insights: behavioralInsights,
                required_actions: requiredActions,
                
                // Metadata
                analysis_metadata: {
                    processing_time_ms: Date.now() - startTime,
                    models_used: this.getModelsUsed(),
                    data_quality_score: this.assessDataQuality(normalizedData),
                    confidence_level: this.calculateAnalysisConfidence(anomalyResults, fraudAnalysis),
                    baseline_comparison: this.compareToBaseline(normalizedData, userProfile)
                }
            };
            
            // Store analysis results
            await this.storeBehaviorAnalysis(behaviorAnalysis);
            
            // Execute required actions if any
            if (requiredActions.immediate_actions.length > 0) {
                await this.executeImmediateActions(userId, requiredActions, behaviorAnalysis);
            }
            
            // Update performance metrics
            this.updatePerformanceMetrics(behaviorAnalysis);
            
            const processingTime = Date.now() - startTime;
            console.log(`✅ Behavior analysis completed in ${processingTime}ms - Risk Level: ${behaviorAnalysis.risk_level}, Score: ${(riskScoring.composite_score * 100).toFixed(1)}%`);
            
            this.emit('behavior-analyzed', {
                userId,
                riskLevel: behaviorAnalysis.risk_level,
                riskScore: riskScoring.composite_score,
                anomaliesDetected: anomalyResults.anomalies_count,
                actionsRequired: requiredActions.immediate_actions.length,
                processingTime
            });
            
            return behaviorAnalysis;
            
        } catch (error) {
            console.error(`Error analyzing behavior pattern for user ${userId}:`, error);
            return {
                user_id: userId,
                error: true,
                error_message: error.message,
                analysis_timestamp: new Date().toISOString()
            };
        }
    }
    
    /**
     * Monitor real-time user activity for immediate threat detection
     */
    async monitorRealtimeActivity(userId, activityEvent) {
        try {
            console.log(`⚡ Real-time monitoring for user: ${userId}`);
            
            // Add to real-time activity stream
            await this.addToActivityStream(userId, activityEvent);
            
            // Check for immediate threats
            const immediateThreats = await this.checkImmediateThreats(userId, activityEvent);
            
            if (immediateThreats.length > 0) {
                // Execute emergency response
                await this.executeEmergencyResponse(userId, immediateThreats, activityEvent);
                
                this.emit('immediate-threat-detected', {
                    userId,
                    threats: immediateThreats,
                    activity: activityEvent,
                    timestamp: new Date().toISOString()
                });
            }
            
            // Update real-time risk score
            const realtimeRisk = await this.updateRealtimeRiskScore(userId, activityEvent);
            
            return {
                user_id: userId,
                immediate_threats: immediateThreats,
                realtime_risk_score: realtimeRisk,
                monitoring_active: true,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error(`Error in real-time monitoring for user ${userId}:`, error);
            return {
                user_id: userId,
                error: true,
                error_message: error.message
            };
        }
    }
    
    /**
     * Investigate suspicious behavior patterns across multiple users
     */
    async investigateSuspiciousPatterns(investigationParameters = {}) {
        try {
            console.log('🕵️ Investigating suspicious behavior patterns...');
            
            const {
                timeframe = '24h',
                pattern_types = ['fraud', 'abuse', 'security'],
                minimum_confidence = 0.7,
                cross_user_analysis = true
            } = investigationParameters;
            
            // Get suspicious behavior data
            const suspiciousData = await this.getSuspiciousBehaviorData(timeframe, pattern_types);
            
            // Perform pattern clustering analysis
            const patternClusters = await this.performPatternClustering(suspiciousData);
            
            // Analyze cross-user connections
            const crossUserAnalysis = cross_user_analysis 
                ? await this.analyzeCrossUserConnections(suspiciousData)
                : null;
            
            // Identify coordinated attacks
            const coordinatedAttacks = await this.identifyCoordinatedAttacks(patternClusters, crossUserAnalysis);
            
            // Generate investigation insights
            const investigationInsights = this.generateInvestigationInsights(
                patternClusters, crossUserAnalysis, coordinatedAttacks
            );
            
            // Create recommended actions
            const recommendedActions = this.generateInvestigationActions(investigationInsights);
            
            const investigation = {
                investigation_id: this.generateInvestigationId(),
                investigation_timestamp: new Date().toISOString(),
                parameters: investigationParameters,
                
                // Analysis results
                suspicious_data_analyzed: suspiciousData.length,
                pattern_clusters: patternClusters,
                cross_user_analysis: crossUserAnalysis,
                coordinated_attacks: coordinatedAttacks,
                
                // Insights and actions
                investigation_insights: investigationInsights,
                recommended_actions: recommendedActions,
                
                // Investigation metadata
                confidence_level: this.calculateInvestigationConfidence(investigationInsights),
                severity_assessment: this.assessInvestigationSeverity(coordinatedAttacks),
                follow_up_required: recommendedActions.high_priority_actions.length > 0
            };
            
            // Store investigation results
            await this.storeInvestigationResults(investigation);
            
            console.log(`🔍 Investigation completed - ${patternClusters.length} pattern clusters, ${coordinatedAttacks.length} coordinated attacks detected`);
            
            this.emit('investigation-completed', {
                investigationId: investigation.investigation_id,
                patternClusters: patternClusters.length,
                coordinatedAttacks: coordinatedAttacks.length,
                severity: investigation.severity_assessment
            });
            
            return investigation;
            
        } catch (error) {
            console.error('Error in suspicious pattern investigation:', error);
            throw error;
        }
    }
    
    /**
     * Generate comprehensive security and fraud analytics
     */
    async generateSecurityAnalytics(timeframe = '30d') {
        try {
            console.log(`📊 Generating security analytics for timeframe: ${timeframe}`);
            
            // Get security event data
            const securityData = await this.getSecurityEventData(timeframe);
            
            // Analyze threat patterns and trends
            const threatAnalysis = await this.analyzeThreatPatterns(securityData, timeframe);
            
            // Calculate fraud prevention metrics
            const fraudMetrics = await this.calculateFraudMetrics(securityData, timeframe);
            
            // Analyze abuse detection effectiveness
            const abuseMetrics = await this.calculateAbuseMetrics(securityData, timeframe);
            
            // Assess system security health
            const securityHealth = await this.assessSystemSecurityHealth();
            
            // Generate risk landscape analysis
            const riskLandscape = await this.analyzeRiskLandscape(securityData);
            
            // Performance analysis
            const performanceAnalysis = this.analyzeDetectionPerformance();
            
            const analytics = {
                timeframe,
                generated_at: new Date().toISOString(),
                
                // Core analytics
                threat_analysis: threatAnalysis,
                fraud_metrics: fraudMetrics,
                abuse_metrics: abuseMetrics,
                security_health: securityHealth,
                risk_landscape: riskLandscape,
                
                // System performance
                performance_analysis: performanceAnalysis,
                detection_metrics: this.performanceMetrics,
                
                // Insights and recommendations
                security_insights: this.generateSecurityInsights(threatAnalysis, fraudMetrics),
                improvement_recommendations: this.generateImprovementRecommendations(performanceAnalysis)
            };
            
            // Store analytics results
            await this.storeSecurityAnalytics(analytics);
            
            console.log(`📈 Security analytics complete - Threats: ${threatAnalysis.total_threats}, Fraud prevented: ${fraudMetrics.fraud_prevented}`);
            
            return analytics;
            
        } catch (error) {
            console.error('Error generating security analytics:', error);
            throw error;
        }
    }
    
    // Utility and helper methods
    
    async detectBehavioralAnomalies(userId, behaviorData, userProfile) {
        try {
            const anomalies = [];
            const anomalyScores = {};
            
            // Statistical anomaly detection
            for (const [metric, config] of Object.entries(this.behavioralConfig.behavioral_metrics)) {
                const value = behaviorData[metric];
                const userBaseline = userProfile.baselines[metric];
                
                if (value && userBaseline) {
                    const zscore = Math.abs((value - userBaseline.mean) / (userBaseline.stddev || 1));
                    anomalyScores[metric] = zscore;
                    
                    if (zscore > this.behavioralConfig.anomaly_detection.statistical_threshold) {
                        anomalies.push({
                            type: 'statistical_anomaly',
                            metric: metric,
                            value: value,
                            expected: userBaseline.mean,
                            z_score: zscore,
                            severity: zscore > 5 ? 'critical' : zscore > 4 ? 'high' : 'medium'
                        });
                    }
                }
            }
            
            // Machine learning anomaly detection (mock implementation)
            const mlAnomalyScore = Math.random() * 0.3; // In production, use actual ML models
            
            return {
                anomalies_detected: anomalies.length > 0,
                anomalies_count: anomalies.length,
                anomalies: anomalies,
                anomaly_scores: anomalyScores,
                ml_anomaly_score: mlAnomalyScore,
                overall_anomaly_score: anomalies.length > 0 ? 
                    Math.max(...Object.values(anomalyScores)) / this.behavioralConfig.anomaly_detection.statistical_threshold : 0
            };
        } catch (error) {
            console.error('Error in behavioral anomaly detection:', error);
            return { anomalies_detected: false, error: error.message };
        }
    }
    
    async analyzeFraudRisk(userId, behaviorData, userProfile, context) {
        try {
            const fraudIndicators = [];
            const riskFactors = {};
            
            // Check each fraud pattern
            for (const [patternType, config] of Object.entries(this.fraudConfig.fraud_patterns)) {
                if (!config.enabled) continue;
                
                let patternScore = 0;
                const indicators = [];
                
                // Analyze indicators for this pattern type
                for (const indicator of config.indicators) {
                    const score = await this.evaluateFraudIndicator(indicator, behaviorData, userProfile, context);
                    if (score > 0.5) {
                        indicators.push({
                            indicator,
                            score,
                            evidence: this.getIndicatorEvidence(indicator, behaviorData, context)
                        });
                        patternScore = Math.max(patternScore, score);
                    }
                }
                
                if (patternScore >= config.risk_threshold) {
                    fraudIndicators.push({
                        pattern_type: patternType,
                        risk_score: patternScore,
                        indicators: indicators,
                        immediate_action: config.immediate_action,
                        confidence: this.calculatePatternConfidence(indicators)
                    });
                }
                
                riskFactors[patternType] = patternScore;
            }
            
            // Calculate overall fraud risk
            const overallFraudRisk = fraudIndicators.length > 0 
                ? Math.max(...fraudIndicators.map(f => f.risk_score))
                : 0;
            
            return {
                fraud_risk_detected: fraudIndicators.length > 0,
                overall_fraud_risk: overallFraudRisk,
                fraud_indicators: fraudIndicators,
                risk_factors: riskFactors,
                risk_category: this.categorizeFraudRisk(overallFraudRisk),
                immediate_actions_required: fraudIndicators.filter(f => f.risk_score >= 0.8).length > 0
            };
        } catch (error) {
            console.error('Error in fraud risk analysis:', error);
            return { fraud_risk_detected: false, error: error.message };
        }
    }
    
    calculateCompositeRiskScore(anomalyResults, fraudAnalysis, abuseAnalysis, securityAssessment) {
        const weights = this.fraudConfig.risk_factors;
        
        const scores = {
            behavioral_anomaly: anomalyResults.overall_anomaly_score || 0,
            fraud_risk: fraudAnalysis.overall_fraud_risk || 0,
            abuse_risk: abuseAnalysis.overall_abuse_risk || 0,
            security_risk: securityAssessment.overall_security_risk || 0
        };
        
        // Weighted composite score
        const compositeScore = (
            scores.behavioral_anomaly * weights.behavioral_anomaly +
            scores.fraud_risk * weights.transaction_anomaly +
            scores.abuse_risk * 0.2 + // Fixed weight for abuse
            scores.security_risk * 0.15 // Fixed weight for security
        );
        
        return {
            composite_score: Math.min(1.0, Math.max(0.0, compositeScore)),
            component_scores: scores,
            risk_weights: weights,
            calculation_method: 'weighted_average'
        };
    }
    
    generateInvestigationId() {
        return 'INV_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex').toUpperCase();
    }
    
    /**
     * Get service health status
     */
    async getServiceHealthStatus() {
        try {
            const redisConnected = this.redis && this.redis.isReady;
            const behavioralRedisConnected = this.behavioralRedis && this.behavioralRedis.isReady;
            const dbConnected = this.db && await this.db.ping();
            
            const avgResponseTime = this.performanceMetrics.avg_response_time;
            const eventsProcessed = this.performanceMetrics.events_processed;
            
            const detectionModelsLoaded = Object.values(this.detectionModels).reduce((count, category) => {
                return count + Object.keys(category).length;
            }, 0);
            
            return {
                status: redisConnected && behavioralRedisConnected && dbConnected ? 'healthy' : 'degraded',
                components: {
                    redis: redisConnected,
                    behavioralRedis: behavioralRedisConnected,
                    database: dbConnected
                },
                detection_systems: {
                    anomaly_detection: this.behavioralConfig.anomaly_detection.enabled,
                    fraud_detection: Object.values(this.fraudConfig.fraud_patterns).some(p => p.enabled),
                    abuse_detection: Object.values(this.abuseConfig.abuse_categories).some(c => c.enabled),
                    security_monitoring: Object.values(this.securityConfig.security_events).some(e => e.enabled),
                    models_loaded: detectionModelsLoaded
                },
                processing: {
                    events_processed: eventsProcessed,
                    anomalies_detected: this.performanceMetrics.anomalies_detected,
                    fraud_cases_prevented: this.performanceMetrics.fraud_cases_prevented,
                    abuse_cases_detected: this.performanceMetrics.abuse_cases_detected,
                    avg_response_time: Math.round(avgResponseTime),
                    detection_accuracy: this.performanceMetrics.detection_accuracy,
                    false_positive_rate: this.performanceMetrics.false_positive_rate
                },
                monitoring: {
                    active_sessions: this.activeSessions.size,
                    behavior_streams: this.behaviorStreams.size,
                    realtime_monitoring: this.behavioralConfig.behavior_tracking.enabled,
                    threat_intelligence: this.securityConfig.threat_intelligence.enabled
                },
                risk_distribution: this.performanceMetrics.risk_distribution,
                cache: {
                    user_behavior_profiles: this.userBehaviorProfiles.size,
                    pattern_cache_size: this.patternCache.size,
                    risk_scores_cached: this.riskScores.size
                },
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
            console.log('🔄 Shutting down Behavioral Pattern Recognition Service...');
            
            // Stop real-time monitoring
            this.activeSessions.clear();
            this.behaviorStreams.clear();
            
            // Clear caches
            this.userBehaviorProfiles.clear();
            this.patternCache.clear();
            this.riskScores.clear();
            
            if (this.redis) {
                await this.redis.disconnect();
            }
            
            if (this.behavioralRedis) {
                await this.behavioralRedis.disconnect();
            }
            
            if (this.db) {
                await this.db.end();
            }
            
            this.removeAllListeners();
            
            console.log('✅ Behavioral Pattern Recognition Service shutdown complete');
        } catch (error) {
            console.error('Error during service shutdown:', error);
        }
    }
}

module.exports = BehavioralPatternRecognitionService;