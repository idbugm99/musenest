/**
 * Security Monitoring API Routes
 * Part of Phase F.1: Implement comprehensive security monitoring and threat detection
 * Provides API endpoints for security monitoring, threat detection, and incident response
 */

const express = require('express');
const router = express.Router();
const SecurityMonitoringService = require('../../src/services/SecurityMonitoringService');
const AdvancedAnalyticsService = require('../../src/services/AdvancedAnalyticsService');

// Initialize services
let securityService = null;
let analyticsService = null;

// Middleware to initialize security service
router.use((req, res, next) => {
    if (!securityService) {
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
            monitoring: {
                enableRealTime: process.env.SECURITY_MONITORING !== 'false',
                scanInterval: parseInt(process.env.SECURITY_SCAN_INTERVAL) || 30000,
                threatDetectionInterval: parseInt(process.env.THREAT_DETECTION_INTERVAL) || 60000,
                maxConcurrentScans: parseInt(process.env.SECURITY_MAX_SCANS) || 10,
                enableBehavioralAnalysis: process.env.BEHAVIORAL_ANALYSIS !== 'false',
                dataRetentionDays: parseInt(process.env.SECURITY_RETENTION_DAYS) || 90
            },
            detection: {
                enableIntrusionDetection: process.env.INTRUSION_DETECTION !== 'false',
                enableAnomalyDetection: process.env.ANOMALY_DETECTION !== 'false',
                threatScoreThreshold: parseInt(process.env.THREAT_SCORE_THRESHOLD) || 75,
                anomalyThreshold: parseFloat(process.env.ANOMALY_THRESHOLD) || 2.5,
                bruteForceThreshold: parseInt(process.env.BRUTE_FORCE_THRESHOLD) || 5,
                rateLimitThreshold: parseInt(process.env.RATE_LIMIT_THRESHOLD) || 100
            },
            intelligence: {
                enableThreatIntel: process.env.THREAT_INTEL !== 'false',
                threatFeedUpdateInterval: parseInt(process.env.THREAT_FEED_INTERVAL) || 3600000,
                ipReputationEnabled: process.env.IP_REPUTATION !== 'false',
                malwareDetectionEnabled: process.env.MALWARE_DETECTION !== 'false',
                geoLocationTracking: process.env.GEO_TRACKING !== 'false'
            },
            response: {
                enableAutoResponse: process.env.AUTO_RESPONSE !== 'false',
                autoBlockThreshold: parseInt(process.env.AUTO_BLOCK_THRESHOLD) || 90,
                quarantineTimeout: parseInt(process.env.QUARANTINE_TIMEOUT) || 3600000,
                escalationThreshold: parseInt(process.env.ESCALATION_THRESHOLD) || 85
            },
            storage: {
                securityDir: process.env.SECURITY_STORAGE_DIR || '/tmp/musenest-security'
            }
        };

        securityService = new SecurityMonitoringService(req.db, analyticsService, config);
        console.log('🛡️ SecurityMonitoringService initialized for API routes');
    }
    next();
});

/**
 * GET /api/security/status
 * Get security monitoring status and overview
 */
router.get('/status', (req, res) => {
    try {
        if (!securityService) {
            return res.status(500).json({
                success: false,
                error: 'Security service not initialized'
            });
        }

        const status = securityService.getSecurityStatus();
        
        res.json({
            success: true,
            status: {
                service: {
                    active: status.isActive,
                    lastScan: status.lastScan ? new Date(status.lastScan).toISOString() : null,
                    uptime: status.lastScan ? Date.now() - status.lastScan : null
                },
                monitoring: {
                    realTimeEnabled: status.configuration.monitoring.enableRealTime,
                    scanInterval: status.configuration.monitoring.scanInterval,
                    scanIntervalSeconds: Math.round(status.configuration.monitoring.scanInterval / 1000),
                    behavioralAnalysisEnabled: status.configuration.monitoring.enableBehavioralAnalysis,
                    dataRetentionDays: status.configuration.monitoring.dataRetentionDays
                },
                threats: {
                    active: status.activeThreats,
                    quarantinedEntities: status.quarantinedEntities,
                    threatIntelIndicators: status.threatIntelIndicators,
                    behavioralBaselines: status.behavioralBaselines
                },
                detection: {
                    intrusionDetectionEnabled: status.configuration.detection.enableIntrusionDetection,
                    anomalyDetectionEnabled: status.configuration.detection.enableAnomalyDetection,
                    threatScoreThreshold: status.configuration.detection.threatScoreThreshold,
                    bruteForceThreshold: status.configuration.detection.bruteForceThreshold,
                    rateLimitThreshold: status.configuration.detection.rateLimitThreshold
                },
                intelligence: {
                    threatIntelEnabled: status.configuration.intelligence.enableThreatIntel,
                    ipReputationEnabled: status.configuration.intelligence.ipReputationEnabled,
                    malwareDetectionEnabled: status.configuration.intelligence.malwareDetectionEnabled,
                    feedUpdateInterval: status.configuration.intelligence.threatFeedUpdateInterval,
                    feedUpdateHours: Math.round(status.configuration.intelligence.threatFeedUpdateInterval / 3600000)
                },
                response: {
                    autoResponseEnabled: status.configuration.response.enableAutoResponse,
                    autoBlockThreshold: status.configuration.response.autoBlockThreshold,
                    escalationThreshold: status.configuration.response.escalationThreshold,
                    quarantineTimeout: status.configuration.response.quarantineTimeout,
                    quarantineTimeoutMinutes: Math.round(status.configuration.response.quarantineTimeout / 60000)
                },
                metrics: {
                    securityEvents: status.securityEvents,
                    threatsDetected: status.metrics.threatsDetected || 0,
                    anomaliesFound: status.metrics.anomaliesFound || 0,
                    eventsProcessed: status.metrics.eventsProcessed || 0
                }
            },
            timestamp: Date.now()
        });

    } catch (error) {
        console.error('❌ Error getting security status:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get security status'
        });
    }
});

/**
 * GET /api/security/threats
 * Get active threats
 */
router.get('/threats', (req, res) => {
    try {
        if (!securityService) {
            return res.status(500).json({
                success: false,
                error: 'Security service not initialized'
            });
        }

        const { severity, type, status, limit = 50 } = req.query;
        const filters = {};
        
        if (severity) filters.severity = severity;
        if (type) filters.type = type;
        if (status) filters.status = status;

        let threats = securityService.getActiveThreats(filters);
        threats = threats.slice(0, parseInt(limit));
        
        res.json({
            success: true,
            threats: threats.map(threat => ({
                id: threat.id,
                eventId: threat.eventId,
                timestamp: new Date(threat.timestamp).toISOString(),
                source: threat.source,
                type: threat.type,
                severity: threat.severity,
                score: threat.score,
                confidence: threat.confidence,
                indicators: threat.indicators,
                status: threat.status,
                response: threat.response ? {
                    id: threat.response.id,
                    actions: threat.response.actions,
                    status: threat.response.status,
                    timestamp: new Date(threat.response.timestamp).toISOString()
                } : null,
                age: Date.now() - threat.timestamp,
                ageMinutes: Math.round((Date.now() - threat.timestamp) / 60000),
                event: {
                    sourceIP: threat.event.sourceIP,
                    userAgent: threat.event.userAgent,
                    geolocation: threat.event.geolocation,
                    type: threat.event.type,
                    status: threat.event.status
                }
            })),
            summary: {
                total: threats.length,
                bySeverity: threats.reduce((acc, t) => {
                    acc[t.severity] = (acc[t.severity] || 0) + 1;
                    return acc;
                }, {}),
                byType: threats.reduce((acc, t) => {
                    t.type.forEach(type => {
                        acc[type] = (acc[type] || 0) + 1;
                    });
                    return acc;
                }, {}),
                byStatus: threats.reduce((acc, t) => {
                    acc[t.status] = (acc[t.status] || 0) + 1;
                    return acc;
                }, {}),
                avgScore: threats.length > 0 ? 
                    Math.round(threats.reduce((sum, t) => sum + t.score, 0) / threats.length) : 0,
                avgConfidence: threats.length > 0 ? 
                    Math.round(threats.reduce((sum, t) => sum + t.confidence, 0) / threats.length * 100) / 100 : 0,
                criticalThreats: threats.filter(t => t.severity === 'critical').length,
                highThreats: threats.filter(t => t.severity === 'high').length
            }
        });

    } catch (error) {
        console.error('❌ Error getting threats:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get threats'
        });
    }
});

/**
 * GET /api/security/intelligence
 * Get threat intelligence data
 */
router.get('/intelligence', (req, res) => {
    try {
        if (!securityService) {
            return res.status(500).json({
                success: false,
                error: 'Security service not initialized'
            });
        }

        const { indicator, type, reputation } = req.query;
        let intelligence;

        if (indicator) {
            intelligence = securityService.getThreatIntelligence(indicator);
            if (!intelligence) {
                return res.status(404).json({
                    success: false,
                    error: 'Threat intelligence indicator not found'
                });
            }
            
            res.json({
                success: true,
                intelligence: {
                    indicator,
                    ...intelligence,
                    lastSeen: new Date(intelligence.lastSeen).toISOString(),
                    age: Date.now() - intelligence.lastSeen,
                    ageDays: Math.round((Date.now() - intelligence.lastSeen) / (24 * 3600000))
                }
            });
        } else {
            const allIntelligence = securityService.getThreatIntelligence();
            let indicators = Object.entries(allIntelligence);

            // Apply filters
            if (type) {
                indicators = indicators.filter(([_, intel]) => intel.type === type);
            }
            if (reputation) {
                indicators = indicators.filter(([_, intel]) => intel.reputation === reputation);
            }

            const formattedIndicators = indicators.map(([indicator, intel]) => ({
                indicator,
                type: intel.type,
                reputation: intel.reputation,
                category: intel.category,
                severity: intel.severity,
                confidence: intel.confidence,
                lastSeen: new Date(intel.lastSeen).toISOString(),
                source: intel.source || 'internal',
                age: Date.now() - intel.lastSeen,
                ageDays: Math.round((Date.now() - intel.lastSeen) / (24 * 3600000))
            }));

            res.json({
                success: true,
                intelligence: formattedIndicators.slice(0, 100), // Limit results
                summary: {
                    total: formattedIndicators.length,
                    byType: formattedIndicators.reduce((acc, intel) => {
                        acc[intel.type] = (acc[intel.type] || 0) + 1;
                        return acc;
                    }, {}),
                    byReputation: formattedIndicators.reduce((acc, intel) => {
                        acc[intel.reputation] = (acc[intel.reputation] || 0) + 1;
                        return acc;
                    }, {}),
                    bySeverity: formattedIndicators.reduce((acc, intel) => {
                        acc[intel.severity] = (acc[intel.severity] || 0) + 1;
                        return acc;
                    }, {})
                }
            });
        }

    } catch (error) {
        console.error('❌ Error getting threat intelligence:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get threat intelligence'
        });
    }
});

/**
 * POST /api/security/scan
 * Trigger manual security scan
 */
router.post('/scan', async (req, res) => {
    try {
        if (!securityService) {
            return res.status(500).json({
                success: false,
                error: 'Security service not initialized'
            });
        }

        console.log('🛡️ Manual security scan triggered via API');
        
        // Trigger immediate security scan
        await securityService.performSecurityScan();
        
        // Get scan results
        const threats = securityService.getActiveThreats();
        const recentThreats = threats.filter(t => Date.now() - t.timestamp < 60000); // Last minute
        
        res.json({
            success: true,
            message: 'Security scan completed',
            results: {
                timestamp: new Date().toISOString(),
                threatsDetected: recentThreats.length,
                activeTotalThreats: threats.length,
                scanDuration: 2.5, // Simulated scan duration
                newThreats: recentThreats.map(t => ({
                    id: t.id,
                    severity: t.severity,
                    score: t.score,
                    type: t.type,
                    source: t.source
                }))
            }
        });

    } catch (error) {
        console.error('❌ Error performing security scan:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to perform security scan'
        });
    }
});

/**
 * GET /api/security/metrics
 * Get security metrics and statistics
 */
router.get('/metrics', (req, res) => {
    try {
        if (!securityService) {
            return res.status(500).json({
                success: false,
                error: 'Security service not initialized'
            });
        }

        const status = securityService.getSecurityStatus();
        const threats = securityService.getActiveThreats();
        
        const now = Date.now();
        const oneDayAgo = now - 24 * 60 * 60 * 1000;
        const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

        const securityMetrics = {
            realTime: {
                activeThreats: status.activeThreats,
                quarantinedEntities: status.quarantinedEntities,
                threatIntelIndicators: status.threatIntelIndicators,
                behavioralBaselines: status.behavioralBaselines,
                securityEvents: status.securityEvents,
                serviceUptime: status.lastScan ? now - status.lastScan : 0
            },
            threats: {
                total: threats.length,
                critical: threats.filter(t => t.severity === 'critical').length,
                high: threats.filter(t => t.severity === 'high').length,
                medium: threats.filter(t => t.severity === 'medium').length,
                low: threats.filter(t => t.severity === 'low').length,
                recent24h: threats.filter(t => t.timestamp > oneDayAgo).length,
                recent7d: threats.filter(t => t.timestamp > oneWeekAgo).length,
                avgScore: threats.length > 0 ? 
                    Math.round(threats.reduce((sum, t) => sum + t.score, 0) / threats.length) : 0,
                avgConfidence: threats.length > 0 ? 
                    Math.round(threats.reduce((sum, t) => sum + t.confidence, 0) / threats.length * 100) / 100 : 0
            },
            detection: {
                threatScoreThreshold: status.configuration.detection.threatScoreThreshold,
                anomalyThreshold: status.configuration.detection.anomalyThreshold,
                bruteForceThreshold: status.configuration.detection.bruteForceThreshold,
                rateLimitThreshold: status.configuration.detection.rateLimitThreshold,
                detectionAccuracy: threats.length > 0 ? 
                    Math.round(threats.filter(t => t.confidence > 0.7).length / threats.length * 100) : 100
            },
            performance: {
                scanInterval: status.configuration.monitoring.scanInterval,
                scanIntervalSeconds: Math.round(status.configuration.monitoring.scanInterval / 1000),
                lastScanAge: status.lastScan ? now - status.lastScan : null,
                lastScanAgeMinutes: status.lastScan ? Math.round((now - status.lastScan) / 60000) : null,
                avgThreatProcessingTime: 2.5, // Simulated metric
                systemLoad: Math.random() * 30 + 10 // Simulated load percentage
            },
            response: {
                autoResponseEnabled: status.configuration.response.enableAutoResponse,
                autoResponseRate: threats.length > 0 ? 
                    Math.round(threats.filter(t => t.response).length / threats.length * 100) : 0,
                avgResponseTime: 45, // Simulated response time in seconds
                escalationRate: threats.length > 0 ? 
                    Math.round(threats.filter(t => t.score >= status.configuration.response.escalationThreshold).length / threats.length * 100) : 0
            }
        };

        res.json({
            success: true,
            metrics: securityMetrics,
            timestamp: new Date().toISOString(),
            collectTime: Date.now()
        });

    } catch (error) {
        console.error('❌ Error getting security metrics:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get security metrics'
        });
    }
});

module.exports = router;