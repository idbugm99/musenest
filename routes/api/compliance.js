/**
 * Compliance Framework API Routes
 * Part of Phase F.2: Create compliance framework with audit trails and reporting
 * Provides API endpoints for compliance monitoring, audit trails, and regulatory reporting
 */

const express = require('express');
const router = express.Router();
const ComplianceFrameworkService = require('../../src/services/ComplianceFrameworkService');
const SecurityMonitoringService = require('../../src/services/SecurityMonitoringService');
const AdvancedAnalyticsService = require('../../src/services/AdvancedAnalyticsService');

// Initialize services
let complianceService = null;
let securityService = null;
let analyticsService = null;

// Middleware to initialize compliance service
router.use((req, res, next) => {
    if (!complianceService) {
        // Initialize required services
        if (!analyticsService) {
            analyticsService = new AdvancedAnalyticsService(req.db, {
                collection: {
                    realTimeInterval: 30000,
                    aggregationInterval: 300000
                }
            });
        }

        if (!securityService) {
            securityService = new SecurityMonitoringService(req.db, analyticsService, {
                monitoring: { enableRealTime: true }
            });
        }

        const config = {
            compliance: {
                enableContinuousMonitoring: process.env.COMPLIANCE_MONITORING !== 'false',
                complianceCheckInterval: parseInt(process.env.COMPLIANCE_CHECK_INTERVAL) || 3600000,
                auditRetentionYears: parseInt(process.env.AUDIT_RETENTION_YEARS) || 7,
                enableRealTimeAuditing: process.env.REALTIME_AUDITING !== 'false',
                complianceThreshold: parseInt(process.env.COMPLIANCE_THRESHOLD) || 85,
                maxViolations: parseInt(process.env.MAX_VIOLATIONS) || 10
            },
            frameworks: {
                enabledRegulations: (process.env.ENABLED_REGULATIONS || 'GDPR,CCPA,SOX,PCI-DSS').split(','),
                riskAssessmentEnabled: process.env.RISK_ASSESSMENT !== 'false',
                policyUpdateInterval: parseInt(process.env.POLICY_UPDATE_INTERVAL) || 86400000
            },
            auditing: {
                enableDetailedLogging: process.env.DETAILED_AUDIT_LOGGING !== 'false',
                sensitiveDataTracking: process.env.SENSITIVE_DATA_TRACKING !== 'false',
                hashAuditLogs: process.env.HASH_AUDIT_LOGS !== 'false',
                compressionEnabled: process.env.AUDIT_COMPRESSION !== 'false'
            },
            reporting: {
                enableAutomatedReports: process.env.AUTOMATED_REPORTS !== 'false',
                reportFormats: (process.env.REPORT_FORMATS || 'pdf,json,csv,xlsx').split(','),
                reportSchedule: process.env.REPORT_SCHEDULE || 'monthly',
                reportRetentionMonths: parseInt(process.env.REPORT_RETENTION_MONTHS) || 36,
                executiveReportsEnabled: process.env.EXECUTIVE_REPORTS !== 'false'
            },
            storage: {
                complianceDir: process.env.COMPLIANCE_STORAGE_DIR || '/tmp/musenest-compliance'
            }
        };

        complianceService = new ComplianceFrameworkService(req.db, securityService, config);
        console.log('📋 ComplianceFrameworkService initialized for API routes');
    }
    next();
});

/**
 * GET /api/compliance/status
 * Get compliance framework status and overview
 */
router.get('/status', (req, res) => {
    try {
        if (!complianceService) {
            return res.status(500).json({
                success: false,
                error: 'Compliance service not initialized'
            });
        }

        const status = complianceService.getComplianceStatus();
        
        res.json({
            success: true,
            status: {
                service: {
                    active: status.isActive,
                    continuousMonitoring: status.configuration.compliance.enableContinuousMonitoring,
                    realTimeAuditing: status.configuration.auditing.enableRealTimeAuditing
                },
                compliance: {
                    overallScore: status.overallComplianceScore,
                    riskLevel: status.riskLevel,
                    threshold: status.configuration.compliance.complianceThreshold,
                    activeFrameworks: status.activeFrameworks,
                    enabledRegulations: status.configuration.frameworks.enabledRegulations
                },
                violations: {
                    total: status.totalViolations,
                    maxAllowed: status.configuration.compliance.maxViolations,
                    utilizationPercent: Math.round((status.totalViolations / status.configuration.compliance.maxViolations) * 100)
                },
                auditing: {
                    totalEvents: status.auditEventsRecorded,
                    retentionYears: status.configuration.compliance.auditRetentionYears,
                    detailedLogging: status.configuration.auditing.enableDetailedLogging,
                    sensitiveDataTracking: status.configuration.auditing.sensitiveDataTracking,
                    logHashing: status.configuration.auditing.hashAuditLogs
                },
                reporting: {
                    reportsGenerated: status.reportsGenerated,
                    automatedReports: status.configuration.reporting.enableAutomatedReports,
                    reportSchedule: status.configuration.reporting.reportSchedule,
                    supportedFormats: status.configuration.reporting.reportFormats,
                    retentionMonths: status.configuration.reporting.reportRetentionMonths
                },
                checkInterval: {
                    milliseconds: status.configuration.compliance.complianceCheckInterval,
                    minutes: Math.round(status.configuration.compliance.complianceCheckInterval / 60000),
                    hours: Math.round(status.configuration.compliance.complianceCheckInterval / 3600000)
                }
            },
            timestamp: Date.now()
        });

    } catch (error) {
        console.error('❌ Error getting compliance status:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get compliance status'
        });
    }
});

/**
 * GET /api/compliance/frameworks
 * Get available compliance frameworks and their requirements
 */
router.get('/frameworks', (req, res) => {
    try {
        if (!complianceService) {
            return res.status(500).json({
                success: false,
                error: 'Compliance service not initialized'
            });
        }

        const { framework } = req.query;
        const frameworks = complianceService.getComplianceFrameworks();
        
        if (framework) {
            const specificFramework = frameworks[framework];
            if (!specificFramework) {
                return res.status(404).json({
                    success: false,
                    error: 'Framework not found'
                });
            }
            
            res.json({
                success: true,
                framework: {
                    id: specificFramework.id,
                    name: specificFramework.name,
                    description: specificFramework.description,
                    jurisdiction: specificFramework.jurisdiction,
                    applicability: specificFramework.applicability,
                    requirements: specificFramework.requirements.map(req => ({
                        id: req.id,
                        title: req.title,
                        description: req.description,
                        severity: req.severity
                    })),
                    penalties: {
                        maxFine: specificFramework.penalties.max_fine,
                        warningThreshold: specificFramework.penalties.warning_threshold,
                        criticalThreshold: specificFramework.penalties.critical_threshold
                    },
                    totalRequirements: specificFramework.requirements.length
                }
            });
        } else {
            const frameworkList = Object.values(frameworks).map(fw => ({
                id: fw.id,
                name: fw.name,
                description: fw.description,
                jurisdiction: fw.jurisdiction,
                applicability: fw.applicability,
                requirementCount: fw.requirements.length,
                penalties: {
                    maxFine: fw.penalties.max_fine,
                    warningThreshold: fw.penalties.warning_threshold,
                    criticalThreshold: fw.penalties.critical_threshold
                }
            }));

            res.json({
                success: true,
                frameworks: frameworkList,
                summary: {
                    total: frameworkList.length,
                    totalRequirements: frameworkList.reduce((sum, fw) => sum + fw.requirementCount, 0),
                    byJurisdiction: frameworkList.reduce((acc, fw) => {
                        acc[fw.jurisdiction] = (acc[fw.jurisdiction] || 0) + 1;
                        return acc;
                    }, {})
                }
            });
        }

    } catch (error) {
        console.error('❌ Error getting compliance frameworks:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get compliance frameworks'
        });
    }
});

/**
 * GET /api/compliance/scores
 * Get compliance scores for all frameworks
 */
router.get('/scores', (req, res) => {
    try {
        if (!complianceService) {
            return res.status(500).json({
                success: false,
                error: 'Compliance service not initialized'
            });
        }

        const scores = complianceService.getComplianceScores();
        const frameworks = complianceService.getComplianceFrameworks();
        
        const formattedScores = Object.entries(scores).map(([frameworkId, scoreData]) => {
            const framework = frameworks[frameworkId];
            return {
                frameworkId,
                frameworkName: framework ? framework.name : frameworkId,
                score: scoreData.score,
                violations: scoreData.violations,
                riskLevel: scoreData.riskLevel,
                trend: scoreData.trend,
                lastUpdated: new Date(scoreData.lastUpdated).toISOString(),
                thresholds: framework ? {
                    warning: framework.penalties.warning_threshold,
                    critical: framework.penalties.critical_threshold
                } : null,
                status: scoreData.score >= (framework?.penalties.warning_threshold || 75) ? 'compliant' : 
                       scoreData.score >= (framework?.penalties.critical_threshold || 60) ? 'at_risk' : 'non_compliant'
            };
        });

        // Calculate overall statistics
        const overallStats = {
            averageScore: formattedScores.length > 0 ? 
                Math.round(formattedScores.reduce((sum, s) => sum + s.score, 0) / formattedScores.length) : 100,
            totalViolations: formattedScores.reduce((sum, s) => sum + s.violations, 0),
            riskLevelDistribution: formattedScores.reduce((acc, s) => {
                acc[s.riskLevel] = (acc[s.riskLevel] || 0) + 1;
                return acc;
            }, {}),
            complianceStatusDistribution: formattedScores.reduce((acc, s) => {
                acc[s.status] = (acc[s.status] || 0) + 1;
                return acc;
            }, {}),
            trendDistribution: formattedScores.reduce((acc, s) => {
                acc[s.trend] = (acc[s.trend] || 0) + 1;
                return acc;
            }, {})
        };

        res.json({
            success: true,
            scores: formattedScores,
            overall: overallStats,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error getting compliance scores:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get compliance scores'
        });
    }
});

/**
 * GET /api/compliance/violations
 * Get compliance violations
 */
router.get('/violations', (req, res) => {
    try {
        if (!complianceService) {
            return res.status(500).json({
                success: false,
                error: 'Compliance service not initialized'
            });
        }

        const { frameworkId, severity, timeRange, limit = 50 } = req.query;
        const filters = {};
        
        if (frameworkId) filters.frameworkId = frameworkId;
        if (severity) filters.severity = severity;
        if (timeRange) filters.timeRange = parseInt(timeRange) * 1000; // Convert to milliseconds

        let violations = complianceService.getComplianceViolations(filters);
        violations = violations.slice(0, parseInt(limit));
        
        res.json({
            success: true,
            violations: violations.map(violation => ({
                id: violation.id,
                frameworkId: violation.frameworkId,
                requirementId: violation.requirementId,
                description: violation.description,
                severity: violation.severity,
                riskScore: violation.riskScore,
                timestamp: new Date(violation.timestamp).toISOString(),
                remediation: violation.remediation,
                auditEventId: violation.auditEventId,
                checkType: violation.checkType || 'unknown',
                age: Date.now() - violation.timestamp,
                ageHours: Math.round((Date.now() - violation.timestamp) / 3600000),
                ageDays: Math.round((Date.now() - violation.timestamp) / (24 * 3600000))
            })),
            summary: {
                total: violations.length,
                bySeverity: violations.reduce((acc, v) => {
                    acc[v.severity] = (acc[v.severity] || 0) + 1;
                    return acc;
                }, {}),
                byFramework: violations.reduce((acc, v) => {
                    acc[v.frameworkId] = (acc[v.frameworkId] || 0) + 1;
                    return acc;
                }, {}),
                avgRiskScore: violations.length > 0 ? 
                    Math.round(violations.reduce((sum, v) => sum + v.riskScore, 0) / violations.length) : 0,
                criticalViolations: violations.filter(v => v.severity === 'critical').length,
                highViolations: violations.filter(v => v.severity === 'high').length,
                recentViolations: violations.filter(v => Date.now() - v.timestamp < 24 * 3600000).length // Last 24h
            }
        });

    } catch (error) {
        console.error('❌ Error getting compliance violations:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get compliance violations'
        });
    }
});

/**
 * GET /api/compliance/audit-trails
 * Get audit trail events
 */
router.get('/audit-trails', (req, res) => {
    try {
        if (!complianceService) {
            return res.status(500).json({
                success: false,
                error: 'Compliance service not initialized'
            });
        }

        const { eventType, userId, riskLevel, timeRange, limit = 100 } = req.query;
        const filters = {};
        
        if (eventType) filters.eventType = eventType;
        if (userId) filters.userId = userId;
        if (riskLevel) filters.riskLevel = riskLevel;
        if (timeRange) filters.timeRange = parseInt(timeRange) * 1000; // Convert to milliseconds

        let auditTrails = complianceService.getAuditTrails(filters);
        auditTrails = auditTrails.slice(0, parseInt(limit));
        
        res.json({
            success: true,
            auditTrails: auditTrails.map(audit => ({
                id: audit.id,
                timestamp: new Date(audit.timestamp).toISOString(),
                eventType: audit.eventType,
                userId: audit.userId,
                sessionId: audit.sessionId,
                sourceIP: audit.sourceIP,
                userAgent: audit.userAgent,
                outcome: audit.outcome,
                riskLevel: audit.riskLevel,
                dataClassification: audit.dataClassification,
                hash: audit.hash,
                data: {
                    // Only return safe data fields
                    action: audit.data.action,
                    resource: audit.data.resource,
                    outcome: audit.data.outcome,
                    sensitive: audit.data.sensitiveData || audit.data.personalData || false
                },
                age: Date.now() - audit.timestamp,
                ageMinutes: Math.round((Date.now() - audit.timestamp) / 60000),
                riskCategory: audit.riskLevel <= 25 ? 'low' : 
                            audit.riskLevel <= 50 ? 'medium' :
                            audit.riskLevel <= 75 ? 'high' : 'critical'
            })),
            summary: {
                total: auditTrails.length,
                byEventType: auditTrails.reduce((acc, a) => {
                    acc[a.eventType] = (acc[a.eventType] || 0) + 1;
                    return acc;
                }, {}),
                byUser: auditTrails.reduce((acc, a) => {
                    acc[a.userId] = (acc[a.userId] || 0) + 1;
                    return acc;
                }, {}),
                byRiskLevel: auditTrails.reduce((acc, a) => {
                    const category = a.riskLevel <= 25 ? 'low' : 
                                   a.riskLevel <= 50 ? 'medium' :
                                   a.riskLevel <= 75 ? 'high' : 'critical';
                    acc[category] = (acc[category] || 0) + 1;
                    return acc;
                }, {}),
                byOutcome: auditTrails.reduce((acc, a) => {
                    acc[a.outcome] = (acc[a.outcome] || 0) + 1;
                    return acc;
                }, {}),
                sensitiveDataEvents: auditTrails.filter(a => 
                    a.dataClassification.some(cls => ['PII', 'Financial', 'Medical', 'Confidential'].includes(cls))
                ).length,
                failedEvents: auditTrails.filter(a => 
                    a.outcome === 'failure' || a.outcome === 'error'
                ).length,
                avgRiskLevel: auditTrails.length > 0 ? 
                    Math.round(auditTrails.reduce((sum, a) => sum + a.riskLevel, 0) / auditTrails.length) : 0
            }
        });

    } catch (error) {
        console.error('❌ Error getting audit trails:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get audit trails'
        });
    }
});

/**
 * POST /api/compliance/audit-trails
 * Log a new audit event
 */
router.post('/audit-trails', async (req, res) => {
    try {
        if (!complianceService) {
            return res.status(500).json({
                success: false,
                error: 'Compliance service not initialized'
            });
        }

        const { eventType, eventData, userId, sessionId } = req.body;
        
        // Validate required fields
        if (!eventType || !eventData) {
            return res.status(400).json({
                success: false,
                error: 'eventType and eventData are required'
            });
        }

        // Add request metadata
        const enrichedEventData = {
            ...eventData,
            sourceIP: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent'),
            timestamp: Date.now()
        };

        console.log(`📋 Logging audit event: ${eventType}`);
        
        const auditEvent = await complianceService.logAuditEvent(
            eventType, 
            enrichedEventData, 
            userId || 'api_user',
            sessionId
        );
        
        res.status(201).json({
            success: true,
            message: 'Audit event logged successfully',
            auditEvent: {
                id: auditEvent.id,
                timestamp: new Date(auditEvent.timestamp).toISOString(),
                eventType: auditEvent.eventType,
                userId: auditEvent.userId,
                riskLevel: auditEvent.riskLevel,
                dataClassification: auditEvent.dataClassification,
                hash: auditEvent.hash
            }
        });

    } catch (error) {
        console.error('❌ Error logging audit event:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to log audit event'
        });
    }
});

/**
 * GET /api/compliance/reports
 * Get compliance reports
 */
router.get('/reports', (req, res) => {
    try {
        if (!complianceService) {
            return res.status(500).json({
                success: false,
                error: 'Compliance service not initialized'
            });
        }

        const { type, limit = 20 } = req.query;
        let reports = complianceService.getComplianceReports();
        
        if (type) {
            reports = reports.filter(r => r.type === type);
        }
        
        reports = reports.slice(0, parseInt(limit));
        
        res.json({
            success: true,
            reports: reports.map(report => ({
                id: report.id,
                type: report.type,
                timestamp: new Date(report.timestamp).toISOString(),
                period: report.period,
                format: report.metadata.format,
                generatedBy: report.metadata.generatedBy,
                version: report.metadata.version,
                dataKeys: Object.keys(report.data),
                size: JSON.stringify(report.data).length,
                sizeMB: Math.round(JSON.stringify(report.data).length / (1024 * 1024) * 100) / 100
            })),
            summary: {
                total: reports.length,
                byType: reports.reduce((acc, r) => {
                    acc[r.type] = (acc[r.type] || 0) + 1;
                    return acc;
                }, {}),
                byPeriod: reports.reduce((acc, r) => {
                    acc[r.period] = (acc[r.period] || 0) + 1;
                    return acc;
                }, {}),
                totalSize: reports.reduce((sum, r) => sum + JSON.stringify(r.data).length, 0),
                totalSizeMB: Math.round(reports.reduce((sum, r) => sum + JSON.stringify(r.data).length, 0) / (1024 * 1024) * 100) / 100
            }
        });

    } catch (error) {
        console.error('❌ Error getting compliance reports:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get compliance reports'
        });
    }
});

/**
 * POST /api/compliance/reports
 * Generate a new compliance report
 */
router.post('/reports', async (req, res) => {
    try {
        if (!complianceService) {
            return res.status(500).json({
                success: false,
                error: 'Compliance service not initialized'
            });
        }

        const { type, options = {} } = req.body;
        
        // Validate required fields
        if (!type) {
            return res.status(400).json({
                success: false,
                error: 'Report type is required'
            });
        }

        const validTypes = ['compliance_summary', 'audit_trail_summary', 'violation_report', 'executive_summary'];
        if (!validTypes.includes(type)) {
            return res.status(400).json({
                success: false,
                error: `Invalid report type. Valid types: ${validTypes.join(', ')}`
            });
        }

        console.log(`📋 Generating compliance report: ${type}`);
        
        const report = await complianceService.generateReport(type, options);
        
        res.status(201).json({
            success: true,
            message: 'Compliance report generated successfully',
            report: {
                id: report.id,
                type: report.type,
                timestamp: new Date(report.timestamp).toISOString(),
                period: report.period,
                format: report.metadata.format,
                dataKeys: Object.keys(report.data),
                summary: this.generateReportSummary(report.type, report.data),
                downloadUrl: `/api/compliance/reports/${report.id}/download`
            }
        });

    } catch (error) {
        console.error('❌ Error generating compliance report:', error.message);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to generate compliance report'
        });
    }
});

/**
 * POST /api/compliance/check
 * Trigger manual compliance check
 */
router.post('/check', async (req, res) => {
    try {
        if (!complianceService) {
            return res.status(500).json({
                success: false,
                error: 'Compliance service not initialized'
            });
        }

        console.log('📋 Manual compliance check triggered via API');
        
        // Trigger immediate compliance check
        const checkResults = await complianceService.performComplianceCheck();
        
        res.json({
            success: true,
            message: 'Compliance check completed',
            results: {
                timestamp: new Date(checkResults.timestamp).toISOString(),
                overallScore: checkResults.overallScore,
                riskLevel: checkResults.riskLevel,
                frameworksChecked: checkResults.results.frameworksChecked,
                totalRequirements: checkResults.results.totalRequirements,
                violationsFound: checkResults.results.violationsFound,
                complianceScores: checkResults.results.complianceScores,
                recommendations: checkResults.recommendations.slice(0, 5), // Top 5 recommendations
                duration: Date.now() - checkResults.timestamp
            }
        });

    } catch (error) {
        console.error('❌ Error performing compliance check:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to perform compliance check'
        });
    }
});

/**
 * GET /api/compliance/metrics
 * Get compliance metrics and statistics
 */
router.get('/metrics', (req, res) => {
    try {
        if (!complianceService) {
            return res.status(500).json({
                success: false,
                error: 'Compliance service not initialized'
            });
        }

        const status = complianceService.getComplianceStatus();
        const scores = complianceService.getComplianceScores();
        const violations = complianceService.getComplianceViolations();
        const auditTrails = complianceService.getAuditTrails({ timeRange: 24 * 3600000 }); // Last 24h
        
        const now = Date.now();
        const oneDayAgo = now - 24 * 60 * 60 * 1000;
        const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

        const complianceMetrics = {
            overall: {
                complianceScore: status.overallComplianceScore,
                riskLevel: status.riskLevel,
                activeFrameworks: status.activeFrameworks,
                totalViolations: status.totalViolations,
                auditEvents: status.auditEventsRecorded,
                reportsGenerated: status.reportsGenerated
            },
            frameworks: Object.entries(scores).map(([frameworkId, score]) => ({
                frameworkId,
                score: score.score,
                violations: score.violations,
                riskLevel: score.riskLevel,
                trend: score.trend,
                lastUpdated: new Date(score.lastUpdated).toISOString()
            })),
            violations: {
                total: violations.length,
                recent24h: violations.filter(v => v.timestamp > oneDayAgo).length,
                recent7d: violations.filter(v => v.timestamp > oneWeekAgo).length,
                bySeverity: violations.reduce((acc, v) => {
                    acc[v.severity] = (acc[v.severity] || 0) + 1;
                    return acc;
                }, {}),
                byFramework: violations.reduce((acc, v) => {
                    acc[v.frameworkId] = (acc[v.frameworkId] || 0) + 1;
                    return acc;
                }, {}),
                avgRiskScore: violations.length > 0 ? 
                    Math.round(violations.reduce((sum, v) => sum + v.riskScore, 0) / violations.length) : 0
            },
            auditing: {
                events24h: auditTrails.length,
                uniqueUsers: new Set(auditTrails.map(a => a.userId)).size,
                eventTypes: Object.keys(auditTrails.reduce((acc, a) => {
                    acc[a.eventType] = true;
                    return acc;
                }, {})).length,
                sensitiveDataEvents: auditTrails.filter(a => 
                    a.dataClassification.some(cls => ['PII', 'Financial', 'Medical', 'Confidential'].includes(cls))
                ).length,
                failedEvents: auditTrails.filter(a => 
                    a.outcome === 'failure' || a.outcome === 'error'
                ).length,
                avgRiskLevel: auditTrails.length > 0 ? 
                    Math.round(auditTrails.reduce((sum, a) => sum + a.riskLevel, 0) / auditTrails.length) : 0
            },
            performance: {
                checkInterval: status.configuration.compliance.complianceCheckInterval,
                checkIntervalHours: Math.round(status.configuration.compliance.complianceCheckInterval / 3600000),
                auditRetentionYears: status.configuration.compliance.auditRetentionYears,
                automatedReportsEnabled: status.configuration.reporting.enableAutomatedReports,
                reportSchedule: status.configuration.reporting.reportSchedule,
                continuousMonitoring: status.configuration.compliance.enableContinuousMonitoring
            },
            trends: {
                complianceScoreTrend: this.calculateComplianceScoreTrend(scores),
                violationTrend: this.calculateViolationTrend(violations),
                auditVolumeTrend: this.calculateAuditVolumeTrend(auditTrails)
            }
        };

        res.json({
            success: true,
            metrics: complianceMetrics,
            timestamp: new Date().toISOString(),
            collectTime: Date.now()
        });

    } catch (error) {
        console.error('❌ Error getting compliance metrics:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get compliance metrics'
        });
    }
});

// Helper functions for API routes
router.generateReportSummary = function(reportType, reportData) {
    switch (reportType) {
        case 'compliance_summary':
            return {
                frameworkCount: Object.keys(reportData.frameworks || {}).length,
                averageScore: reportData.overallStats?.averageComplianceScore || 0,
                totalViolations: reportData.overallStats?.totalViolations || 0,
                riskLevel: reportData.overallStats?.riskDistribution || {}
            };
        case 'audit_trail_summary':
            return {
                totalEvents: reportData.totalEvents || 0,
                sensitiveDataEvents: reportData.sensitiveDataEvents || 0,
                failedEvents: reportData.failedEvents || 0,
                uniqueUsers: Object.keys(reportData.eventsByUser || {}).length,
                timeRange: reportData.timeRange
            };
        case 'violation_report':
            return {
                totalViolations: reportData.totalViolations || 0,
                frameworkCount: Object.keys(reportData.violationsByFramework || {}).length,
                criticalViolations: reportData.violationsBySeverity?.critical || 0,
                trend: reportData.trends?.trend || 'stable',
                timeRange: reportData.timeRange
            };
        default:
            return { dataKeys: Object.keys(reportData) };
    }
};

router.calculateComplianceScoreTrend = function(scores) {
    // Simple trend calculation - in production would use historical data
    const scoreTrends = Object.values(scores).map(s => s.trend);
    const improving = scoreTrends.filter(t => t === 'improving').length;
    const declining = scoreTrends.filter(t => t === 'declining').length;
    
    if (improving > declining) return 'improving';
    if (declining > improving) return 'declining';
    return 'stable';
};

router.calculateViolationTrend = function(violations) {
    const now = Date.now();
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const twoWeeksAgo = now - 14 * 24 * 60 * 60 * 1000;
    
    const thisWeek = violations.filter(v => v.timestamp > oneWeekAgo).length;
    const lastWeek = violations.filter(v => v.timestamp > twoWeeksAgo && v.timestamp <= oneWeekAgo).length;
    
    if (thisWeek > lastWeek * 1.1) return 'increasing';
    if (thisWeek < lastWeek * 0.9) return 'decreasing';
    return 'stable';
};

router.calculateAuditVolumeTrend = function(auditTrails) {
    // Based on 24h data, estimate trend
    const hourlyVolumes = Array.from({ length: 24 }, (_, i) => {
        const hourStart = Date.now() - (i * 60 * 60 * 1000);
        const hourEnd = hourStart + 60 * 60 * 1000;
        return auditTrails.filter(a => a.timestamp >= hourStart && a.timestamp < hourEnd).length;
    });
    
    const firstHalf = hourlyVolumes.slice(0, 12).reduce((a, b) => a + b, 0);
    const secondHalf = hourlyVolumes.slice(12).reduce((a, b) => a + b, 0);
    
    if (secondHalf > firstHalf * 1.2) return 'increasing';
    if (secondHalf < firstHalf * 0.8) return 'decreasing';
    return 'stable';
};

module.exports = router;