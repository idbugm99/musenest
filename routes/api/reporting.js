/**
 * Automated Reporting and Alerts API Routes
 * Part of Phase E.5: Create automated reporting and alert systems
 * Provides API endpoints for report scheduling, alert management, and notification systems
 */

const express = require('express');
const router = express.Router();
const AutomatedReportingService = require('../../src/services/AutomatedReportingService');
const AdvancedAnalyticsService = require('../../src/services/AdvancedAnalyticsService');
const BusinessIntelligenceService = require('../../src/services/BusinessIntelligenceService');

// Initialize services
let reportingService = null;
let analyticsService = null;
let biService = null;

// Middleware to initialize reporting service
router.use((req, res, next) => {
    if (!reportingService) {
        // Initialize required services
        if (!analyticsService) {
            analyticsService = new AdvancedAnalyticsService(req.db, {
                collection: {
                    realTimeInterval: 30000,
                    aggregationInterval: 300000
                }
            });
        }

        if (!biService) {
            biService = new BusinessIntelligenceService(req.db, analyticsService, {
                dashboards: {
                    refreshInterval: 300000,
                    enableRealTime: true
                }
            });
        }

        const config = {
            reporting: {
                enableScheduled: process.env.REPORTING_SCHEDULED !== 'false',
                scheduleCheckInterval: parseInt(process.env.REPORTING_CHECK_INTERVAL) || 60000,
                maxConcurrentReports: parseInt(process.env.REPORTING_MAX_CONCURRENT) || 5,
                reportTimeout: parseInt(process.env.REPORTING_TIMEOUT) || 300000,
                retentionDays: parseInt(process.env.REPORTING_RETENTION_DAYS) || 90,
                formats: (process.env.REPORTING_FORMATS || 'pdf,json,csv,excel').split(',')
            },
            alerting: {
                enableRealTime: process.env.ALERTING_ENABLED !== 'false',
                alertCheckInterval: parseInt(process.env.ALERTING_CHECK_INTERVAL) || 30000,
                maxActiveAlerts: parseInt(process.env.ALERTING_MAX_ACTIVE) || 1000,
                escalationTimeout: parseInt(process.env.ALERTING_ESCALATION_TIMEOUT) || 3600000,
                acknowledgmentTimeout: parseInt(process.env.ALERTING_ACK_TIMEOUT) || 1800000
            },
            notifications: {
                email: {
                    enabled: process.env.EMAIL_NOTIFICATIONS !== 'false',
                    host: process.env.SMTP_HOST,
                    port: parseInt(process.env.SMTP_PORT) || 587,
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS,
                    from: process.env.SMTP_FROM
                },
                webhook: {
                    enabled: process.env.WEBHOOK_NOTIFICATIONS !== 'false',
                    timeout: parseInt(process.env.WEBHOOK_TIMEOUT) || 10000
                }
            },
            storage: {
                reportsDir: process.env.REPORTS_STORAGE_DIR || '/tmp/musenest-reports',
                alertsDir: process.env.ALERTS_STORAGE_DIR || '/tmp/musenest-alerts'
            }
        };

        reportingService = new AutomatedReportingService(req.db, analyticsService, biService, config);
        console.log('📊 AutomatedReportingService initialized for API routes');
    }
    next();
});

/**
 * GET /api/reporting/status
 * Get reporting service status and overview
 */
router.get('/status', (req, res) => {
    try {
        if (!reportingService) {
            return res.status(500).json({
                success: false,
                error: 'Reporting service not initialized'
            });
        }

        const status = reportingService.getReportingStatus();
        
        res.json({
            success: true,
            status: {
                service: {
                    active: status.isActive,
                    uptime: Date.now() - (status.startTime || Date.now())
                },
                reporting: {
                    scheduledReports: status.scheduledReports,
                    activeReports: status.activeReports,
                    enabledScheduled: status.configuration.reporting.enableScheduled,
                    supportedFormats: status.configuration.reporting.formats,
                    maxConcurrent: status.configuration.reporting.maxConcurrentReports,
                    retentionDays: status.configuration.reporting.retentionDays
                },
                alerting: {
                    totalRules: status.alertRules,
                    activeAlerts: status.activeAlerts,
                    totalAlerts: status.totalAlerts,
                    enabledRealTime: status.configuration.alerting.enableRealTime,
                    maxActiveAlerts: status.configuration.alerting.maxActiveAlerts,
                    checkInterval: status.configuration.alerting.alertCheckInterval,
                    checkIntervalSeconds: Math.round(status.configuration.alerting.alertCheckInterval / 1000)
                },
                notifications: {
                    email: {
                        enabled: status.configuration.notifications.email.enabled,
                        configured: !!(status.configuration.notifications.email.host && status.configuration.notifications.email.from)
                    },
                    webhook: {
                        enabled: status.configuration.notifications.webhook.enabled,
                        timeout: status.configuration.notifications.webhook.timeout,
                        timeoutSeconds: Math.round(status.configuration.notifications.webhook.timeout / 1000)
                    }
                }
            },
            timestamp: Date.now()
        });

    } catch (error) {
        console.error('❌ Error getting reporting status:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get reporting status'
        });
    }
});

/**
 * GET /api/reporting/reports/scheduled
 * Get list of scheduled reports
 */
router.get('/reports/scheduled', (req, res) => {
    try {
        if (!reportingService) {
            return res.status(500).json({
                success: false,
                error: 'Reporting service not initialized'
            });
        }

        const reports = reportingService.getScheduledReports();
        
        res.json({
            success: true,
            reports: reports.map(report => ({
                id: report.id,
                name: report.name,
                description: report.description,
                type: report.type,
                format: report.format,
                schedule: {
                    frequency: report.schedule.frequency,
                    time: report.schedule.time || null,
                    dayOfWeek: report.schedule.dayOfWeek || null,
                    dayOfMonth: report.schedule.dayOfMonth || null
                },
                isActive: report.isActive,
                created: new Date(report.created).toISOString(),
                lastGenerated: report.lastGenerated ? 
                    new Date(report.lastGenerated).toISOString() : null,
                nextGeneration: new Date(report.nextGeneration).toISOString(),
                generationCount: report.generationCount,
                recipientCount: report.recipients.length,
                distributionMethods: report.distributionMethods,
                dataSource: report.dataSource
            })),
            summary: {
                total: reports.length,
                active: reports.filter(r => r.isActive).length,
                byType: reports.reduce((acc, r) => {
                    acc[r.type] = (acc[r.type] || 0) + 1;
                    return acc;
                }, {}),
                byFormat: reports.reduce((acc, r) => {
                    acc[r.format] = (acc[r.format] || 0) + 1;
                    return acc;
                }, {}),
                byFrequency: reports.reduce((acc, r) => {
                    acc[r.schedule.frequency] = (acc[r.schedule.frequency] || 0) + 1;
                    return acc;
                }, {})
            }
        });

    } catch (error) {
        console.error('❌ Error getting scheduled reports:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get scheduled reports'
        });
    }
});

/**
 * POST /api/reporting/reports/scheduled
 * Create a new scheduled report
 */
router.post('/reports/scheduled', (req, res) => {
    try {
        if (!reportingService) {
            return res.status(500).json({
                success: false,
                error: 'Reporting service not initialized'
            });
        }

        const reportConfig = req.body;
        
        // Validate required fields
        if (!reportConfig.name) {
            return res.status(400).json({
                success: false,
                error: 'Report name is required'
            });
        }

        if (!reportConfig.schedule || !reportConfig.schedule.frequency) {
            return res.status(400).json({
                success: false,
                error: 'Schedule frequency is required'
            });
        }

        console.log(`📊 Creating scheduled report: ${reportConfig.name}`);
        
        const report = reportingService.createScheduledReport(reportConfig);
        
        res.status(201).json({
            success: true,
            message: 'Scheduled report created successfully',
            report: {
                id: report.id,
                name: report.name,
                description: report.description,
                type: report.type,
                format: report.format,
                schedule: report.schedule,
                dataSource: report.dataSource,
                created: new Date(report.created).toISOString(),
                nextGeneration: new Date(report.nextGeneration).toISOString(),
                isActive: report.isActive,
                recipientCount: report.recipients.length,
                distributionMethods: report.distributionMethods
            }
        });

    } catch (error) {
        console.error('❌ Error creating scheduled report:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to create scheduled report'
        });
    }
});

/**
 * GET /api/reporting/reports/active
 * Get list of recently generated reports
 */
router.get('/reports/active', (req, res) => {
    try {
        if (!reportingService) {
            return res.status(500).json({
                success: false,
                error: 'Reporting service not initialized'
            });
        }

        const { limit = 50, format, type } = req.query;
        let reports = reportingService.getActiveReports();
        
        // Apply filters
        if (format) {
            reports = reports.filter(r => r.format === format);
        }
        if (type) {
            reports = reports.filter(r => r.type === type);
        }

        // Sort by generation time (newest first) and limit
        reports = reports
            .sort((a, b) => b.generatedAt - a.generatedAt)
            .slice(0, parseInt(limit));
        
        res.json({
            success: true,
            reports: reports.map(report => ({
                id: report.id,
                scheduledReportId: report.scheduledReportId,
                name: report.name,
                type: report.type,
                format: report.format,
                generated: new Date(report.generatedAt).toISOString(),
                generationTime: report.generationTime,
                generationTimeSeconds: Math.round(report.generationTime / 1000 * 100) / 100,
                dataPoints: report.dataPoints,
                size: report.size,
                sizeMB: Math.round(report.size / (1024 * 1024) * 100) / 100,
                filePath: report.filePath,
                downloadUrl: `/api/reporting/reports/${report.id}/download`
            })),
            summary: {
                total: reports.length,
                totalSize: reports.reduce((sum, r) => sum + r.size, 0),
                totalSizeMB: Math.round(reports.reduce((sum, r) => sum + r.size, 0) / (1024 * 1024) * 100) / 100,
                avgGenerationTime: reports.length > 0 ? 
                    Math.round(reports.reduce((sum, r) => sum + r.generationTime, 0) / reports.length) : 0,
                byFormat: reports.reduce((acc, r) => {
                    acc[r.format] = (acc[r.format] || 0) + 1;
                    return acc;
                }, {}),
                byType: reports.reduce((acc, r) => {
                    acc[r.type] = (acc[r.type] || 0) + 1;
                    return acc;
                }, {})
            }
        });

    } catch (error) {
        console.error('❌ Error getting active reports:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get active reports'
        });
    }
});

/**
 * GET /api/reporting/alerts/rules
 * Get list of alert rules
 */
router.get('/alerts/rules', (req, res) => {
    try {
        if (!reportingService) {
            return res.status(500).json({
                success: false,
                error: 'Reporting service not initialized'
            });
        }

        const { category, severity, active } = req.query;
        let rules = reportingService.getAlertRules();
        
        // Apply filters
        if (category) {
            rules = rules.filter(r => r.category === category);
        }
        if (severity) {
            rules = rules.filter(r => r.severity === severity);
        }
        if (active !== undefined) {
            rules = rules.filter(r => r.isActive === (active === 'true'));
        }
        
        res.json({
            success: true,
            rules: rules.map(rule => ({
                id: rule.id,
                name: rule.name,
                description: rule.description,
                category: rule.category,
                severity: rule.severity,
                condition: {
                    type: rule.condition.type,
                    operator: rule.condition.operator || 'gt',
                    path: rule.condition.path || null
                },
                threshold: {
                    value: rule.threshold.value,
                    unit: rule.threshold.unit || null
                },
                isActive: rule.isActive,
                created: new Date(rule.created).toISOString(),
                lastTriggered: rule.lastTriggered ? 
                    new Date(rule.lastTriggered).toISOString() : null,
                triggerCount: rule.triggerCount,
                actions: rule.actions,
                recipientCount: rule.recipients.length,
                suppressionTime: rule.suppressionTime,
                suppressionMinutes: Math.round(rule.suppressionTime / 60000),
                autoResolve: rule.autoResolve
            })),
            summary: {
                total: rules.length,
                active: rules.filter(r => r.isActive).length,
                byCategory: rules.reduce((acc, r) => {
                    acc[r.category] = (acc[r.category] || 0) + 1;
                    return acc;
                }, {}),
                bySeverity: rules.reduce((acc, r) => {
                    acc[r.severity] = (acc[r.severity] || 0) + 1;
                    return acc;
                }, {}),
                totalTriggers: rules.reduce((sum, r) => sum + r.triggerCount, 0),
                recentlyTriggered: rules.filter(r => 
                    r.lastTriggered && Date.now() - r.lastTriggered < 3600000).length
            }
        });

    } catch (error) {
        console.error('❌ Error getting alert rules:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get alert rules'
        });
    }
});

/**
 * POST /api/reporting/alerts/rules
 * Create a new alert rule
 */
router.post('/alerts/rules', (req, res) => {
    try {
        if (!reportingService) {
            return res.status(500).json({
                success: false,
                error: 'Reporting service not initialized'
            });
        }

        const ruleConfig = req.body;
        
        // Validate required fields
        if (!ruleConfig.name) {
            return res.status(400).json({
                success: false,
                error: 'Alert rule name is required'
            });
        }

        if (!ruleConfig.condition || !ruleConfig.condition.type) {
            return res.status(400).json({
                success: false,
                error: 'Alert condition type is required'
            });
        }

        if (!ruleConfig.threshold || ruleConfig.threshold.value === undefined) {
            return res.status(400).json({
                success: false,
                error: 'Alert threshold value is required'
            });
        }

        console.log(`🚨 Creating alert rule: ${ruleConfig.name}`);
        
        const rule = reportingService.createAlertRule(ruleConfig);
        
        res.status(201).json({
            success: true,
            message: 'Alert rule created successfully',
            rule: {
                id: rule.id,
                name: rule.name,
                description: rule.description,
                category: rule.category,
                severity: rule.severity,
                condition: rule.condition,
                threshold: rule.threshold,
                actions: rule.actions,
                recipients: rule.recipients,
                isActive: rule.isActive,
                created: new Date(rule.created).toISOString(),
                suppressionTime: rule.suppressionTime,
                autoResolve: rule.autoResolve
            }
        });

    } catch (error) {
        console.error('❌ Error creating alert rule:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to create alert rule'
        });
    }
});

/**
 * GET /api/reporting/alerts/active
 * Get list of active alerts
 */
router.get('/alerts/active', (req, res) => {
    try {
        if (!reportingService) {
            return res.status(500).json({
                success: false,
                error: 'Reporting service not initialized'
            });
        }

        const { severity, category, limit = 100 } = req.query;
        let alerts = reportingService.getActiveAlerts();
        
        // Apply filters
        if (severity) {
            alerts = alerts.filter(a => a.severity === severity);
        }
        if (category) {
            alerts = alerts.filter(a => a.category === category);
        }

        // Sort by trigger time (newest first) and limit
        alerts = alerts
            .sort((a, b) => b.triggeredAt - a.triggeredAt)
            .slice(0, parseInt(limit));
        
        res.json({
            success: true,
            alerts: alerts.map(alert => ({
                id: alert.id,
                ruleId: alert.ruleId,
                ruleName: alert.ruleName,
                category: alert.category,
                severity: alert.severity,
                message: alert.message,
                status: alert.status,
                triggered: new Date(alert.triggeredAt).toISOString(),
                acknowledged: alert.acknowledgedAt ? 
                    new Date(alert.acknowledgedAt).toISOString() : null,
                resolved: alert.resolvedAt ? 
                    new Date(alert.resolvedAt).toISOString() : null,
                escalationLevel: alert.escalationLevel,
                age: Date.now() - alert.triggeredAt,
                ageMinutes: Math.round((Date.now() - alert.triggeredAt) / 60000),
                metadata: {
                    condition: alert.metadata.condition,
                    threshold: alert.metadata.threshold,
                    triggerValue: alert.metadata.triggerValue
                }
            })),
            summary: {
                total: alerts.length,
                bySeverity: alerts.reduce((acc, a) => {
                    acc[a.severity] = (acc[a.severity] || 0) + 1;
                    return acc;
                }, {}),
                byCategory: alerts.reduce((acc, a) => {
                    acc[a.category] = (acc[a.category] || 0) + 1;
                    return acc;
                }, {}),
                byStatus: alerts.reduce((acc, a) => {
                    acc[a.status] = (acc[a.status] || 0) + 1;
                    return acc;
                }, {}),
                acknowledged: alerts.filter(a => a.acknowledgedAt).length,
                escalated: alerts.filter(a => a.escalationLevel > 0).length,
                avgAge: alerts.length > 0 ? 
                    Math.round(alerts.reduce((sum, a) => sum + (Date.now() - a.triggeredAt), 0) / alerts.length / 60000) : 0
            }
        });

    } catch (error) {
        console.error('❌ Error getting active alerts:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get active alerts'
        });
    }
});

/**
 * GET /api/reporting/templates
 * Get reporting and alert templates
 */
router.get('/templates', (req, res) => {
    try {
        const { type = 'all' } = req.query;
        
        const reportTemplates = [
            {
                id: 'analytics-daily',
                name: 'Daily Analytics Report',
                type: 'analytics',
                format: 'pdf',
                description: 'Daily system and business analytics summary',
                schedule: { frequency: 'daily', time: '09:00' },
                dataSource: 'analytics',
                sections: ['System Performance', 'Business Metrics', 'User Activity', 'Anomalies']
            },
            {
                id: 'business-weekly',
                name: 'Weekly Business Report',
                type: 'business',
                format: 'excel',
                description: 'Weekly business performance and revenue analysis',
                schedule: { frequency: 'weekly', dayOfWeek: 1, time: '08:00' },
                dataSource: 'business',
                sections: ['Revenue Analysis', 'Customer Growth', 'Model Performance', 'Forecasts']
            },
            {
                id: 'security-monthly',
                name: 'Monthly Security Report',
                type: 'security',
                format: 'pdf',
                description: 'Monthly security posture and threat analysis',
                schedule: { frequency: 'monthly', dayOfMonth: 1, time: '10:00' },
                dataSource: 'security',
                sections: ['Threat Summary', 'Security Events', 'Compliance Status', 'Recommendations']
            },
            {
                id: 'performance-hourly',
                name: 'Hourly Performance Report',
                type: 'performance',
                format: 'json',
                description: 'Hourly system performance monitoring',
                schedule: { frequency: 'hourly' },
                dataSource: 'performance',
                sections: ['System Metrics', 'Response Times', 'Resource Usage', 'Alerts']
            }
        ];

        const alertTemplates = [
            {
                id: 'high-memory-usage',
                name: 'High Memory Usage Alert',
                category: 'system',
                severity: 'high',
                description: 'Alert when system memory usage exceeds threshold',
                condition: { type: 'memory_high', operator: 'gt' },
                threshold: { value: 85, unit: 'percent' },
                actions: ['email', 'webhook'],
                suppressionTime: 300000
            },
            {
                id: 'slow-api-response',
                name: 'Slow API Response Alert',
                category: 'performance',
                severity: 'medium',
                description: 'Alert when API response time is too slow',
                condition: { type: 'response_time_high', operator: 'gt' },
                threshold: { value: 2000, unit: 'milliseconds' },
                actions: ['email'],
                suppressionTime: 600000
            },
            {
                id: 'revenue-drop',
                name: 'Revenue Drop Alert',
                category: 'business',
                severity: 'critical',
                description: 'Alert when daily revenue drops significantly',
                condition: { type: 'revenue_drop', operator: 'lt' },
                threshold: { value: 1000, unit: 'dollars' },
                actions: ['email', 'sms'],
                suppressionTime: 3600000
            },
            {
                id: 'security-threats',
                name: 'High Security Threats Alert',
                category: 'security',
                severity: 'high',
                description: 'Alert when security threats exceed normal levels',
                condition: { type: 'threats_high', operator: 'gt' },
                threshold: { value: 100, unit: 'count' },
                actions: ['email', 'webhook'],
                suppressionTime: 1800000
            }
        ];

        let templates = {};
        if (type === 'all' || type === 'reports') {
            templates.reports = reportTemplates;
        }
        if (type === 'all' || type === 'alerts') {
            templates.alerts = alertTemplates;
        }

        const configurations = {
            reportFormats: ['pdf', 'json', 'csv', 'excel'],
            scheduleFrequencies: ['hourly', 'daily', 'weekly', 'monthly'],
            dataSources: ['analytics', 'business', 'security', 'performance'],
            distributionMethods: ['email', 'webhook', 'file'],
            alertCategories: ['system', 'business', 'performance', 'security', 'custom'],
            alertSeverities: ['low', 'medium', 'high', 'critical'],
            alertActions: ['email', 'sms', 'webhook', 'slack'],
            conditionOperators: ['gt', 'lt', 'eq', 'ne', 'gte', 'lte']
        };

        res.json({
            success: true,
            templates,
            configurations,
            metadata: {
                reportTemplates: reportTemplates.length,
                alertTemplates: alertTemplates.length,
                totalTemplates: reportTemplates.length + alertTemplates.length
            }
        });

    } catch (error) {
        console.error('❌ Error getting reporting templates:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get reporting templates'
        });
    }
});

/**
 * GET /api/reporting/configuration
 * Get reporting service configuration
 */
router.get('/configuration', (req, res) => {
    try {
        if (!reportingService) {
            return res.status(500).json({
                success: false,
                error: 'Reporting service not initialized'
            });
        }

        const status = reportingService.getReportingStatus();
        
        res.json({
            success: true,
            configuration: {
                reporting: {
                    enableScheduled: status.configuration.reporting.enableScheduled,
                    scheduleCheckInterval: status.configuration.reporting.scheduleCheckInterval,
                    scheduleCheckMinutes: Math.round(status.configuration.reporting.scheduleCheckInterval / 60000),
                    maxConcurrentReports: status.configuration.reporting.maxConcurrentReports,
                    reportTimeout: status.configuration.reporting.reportTimeout,
                    reportTimeoutMinutes: Math.round(status.configuration.reporting.reportTimeout / 60000),
                    retentionDays: status.configuration.reporting.retentionDays,
                    supportedFormats: status.configuration.reporting.formats,
                    distributionMethods: status.configuration.reporting.distributionMethods
                },
                alerting: {
                    enableRealTime: status.configuration.alerting.enableRealTime,
                    alertCheckInterval: status.configuration.alerting.alertCheckInterval,
                    alertCheckIntervalSeconds: Math.round(status.configuration.alerting.alertCheckInterval / 1000),
                    maxActiveAlerts: status.configuration.alerting.maxActiveAlerts,
                    escalationTimeout: status.configuration.alerting.escalationTimeout,
                    escalationTimeoutHours: Math.round(status.configuration.alerting.escalationTimeout / 3600000),
                    acknowledgmentTimeout: status.configuration.alerting.acknowledgmentTimeout,
                    acknowledgmentTimeoutMinutes: Math.round(status.configuration.alerting.acknowledgmentTimeout / 60000),
                    notificationMethods: status.configuration.alerting.notificationMethods
                },
                notifications: {
                    email: {
                        enabled: status.configuration.notifications.email.enabled,
                        host: status.configuration.notifications.email.host,
                        port: status.configuration.notifications.email.port,
                        secure: status.configuration.notifications.email.secure,
                        from: status.configuration.notifications.email.from
                    },
                    webhook: {
                        enabled: status.configuration.notifications.webhook.enabled,
                        timeout: status.configuration.notifications.webhook.timeout,
                        timeoutSeconds: Math.round(status.configuration.notifications.webhook.timeout / 1000),
                        retries: status.configuration.notifications.webhook.retries
                    }
                },
                storage: {
                    reportsDirectory: status.configuration.storage.reportsDir,
                    alertsDirectory: status.configuration.storage.alertsDir,
                    archiveDirectory: status.configuration.storage.archiveDir,
                    tempDirectory: status.configuration.storage.tempDir
                }
            }
        });

    } catch (error) {
        console.error('❌ Error getting reporting configuration:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get reporting configuration'
        });
    }
});

/**
 * PUT /api/reporting/configuration
 * Update reporting service configuration
 */
router.put('/configuration', (req, res) => {
    try {
        if (!reportingService) {
            return res.status(500).json({
                success: false,
                error: 'Reporting service not initialized'
            });
        }

        const newConfig = req.body;
        
        // Validate configuration structure
        const validSections = ['reporting', 'alerting', 'notifications', 'storage'];
        const providedSections = Object.keys(newConfig);
        const invalidSections = providedSections.filter(section => !validSections.includes(section));
        
        if (invalidSections.length > 0) {
            return res.status(400).json({
                success: false,
                error: `Invalid configuration sections: ${invalidSections.join(', ')}`
            });
        }

        reportingService.updateConfiguration(newConfig);
        
        console.log('📊 Reporting configuration updated via API:', providedSections);

        res.json({
            success: true,
            message: 'Reporting configuration updated',
            updated: providedSections,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error updating reporting configuration:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to update reporting configuration'
        });
    }
});

/**
 * GET /api/reporting/metrics
 * Get reporting and alerting metrics
 */
router.get('/metrics', (req, res) => {
    try {
        if (!reportingService) {
            return res.status(500).json({
                success: false,
                error: 'Reporting service not initialized'
            });
        }

        const status = reportingService.getReportingStatus();
        const scheduledReports = reportingService.getScheduledReports();
        const activeReports = reportingService.getActiveReports();
        const alertRules = reportingService.getAlertRules();
        const activeAlerts = reportingService.getActiveAlerts();

        const now = Date.now();
        const oneDayAgo = now - 24 * 60 * 60 * 1000;
        const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

        const metrics = {
            reporting: {
                scheduled: {
                    total: scheduledReports.length,
                    active: scheduledReports.filter(r => r.isActive).length,
                    generated24h: activeReports.filter(r => r.generatedAt > oneDayAgo).length,
                    generated7d: activeReports.filter(r => r.generatedAt > oneWeekAgo).length,
                    avgGenerationTime: activeReports.length > 0 ?
                        Math.round(activeReports.reduce((sum, r) => sum + r.generationTime, 0) / activeReports.length) : 0
                },
                active: {
                    total: activeReports.length,
                    totalSize: activeReports.reduce((sum, r) => sum + r.size, 0),
                    totalSizeMB: Math.round(activeReports.reduce((sum, r) => sum + r.size, 0) / (1024 * 1024) * 100) / 100,
                    byFormat: activeReports.reduce((acc, r) => {
                        acc[r.format] = (acc[r.format] || 0) + 1;
                        return acc;
                    }, {}),
                    recent: activeReports.filter(r => r.generatedAt > oneDayAgo).length
                }
            },
            alerting: {
                rules: {
                    total: alertRules.length,
                    active: alertRules.filter(r => r.isActive).length,
                    triggered24h: alertRules.filter(r => 
                        r.lastTriggered && r.lastTriggered > oneDayAgo).length,
                    totalTriggers: alertRules.reduce((sum, r) => sum + r.triggerCount, 0),
                    bySeverity: alertRules.reduce((acc, r) => {
                        acc[r.severity] = (acc[r.severity] || 0) + 1;
                        return acc;
                    }, {}),
                    byCategory: alertRules.reduce((acc, r) => {
                        acc[r.category] = (acc[r.category] || 0) + 1;
                        return acc;
                    }, {})
                },
                alerts: {
                    active: activeAlerts.length,
                    triggered24h: activeAlerts.filter(a => a.triggeredAt > oneDayAgo).length,
                    triggered7d: activeAlerts.filter(a => a.triggeredAt > oneWeekAgo).length,
                    acknowledged: activeAlerts.filter(a => a.acknowledgedAt).length,
                    escalated: activeAlerts.filter(a => a.escalationLevel > 0).length,
                    avgAge: activeAlerts.length > 0 ?
                        Math.round(activeAlerts.reduce((sum, a) => sum + (now - a.triggeredAt), 0) / activeAlerts.length / 60000) : 0,
                    bySeverity: activeAlerts.reduce((acc, a) => {
                        acc[a.severity] = (acc[a.severity] || 0) + 1;
                        return acc;
                    }, {})
                }
            },
            performance: {
                serviceUptime: status.isActive ? 100 : 0,
                reportSuccess: scheduledReports.length > 0 ? 
                    Math.round(scheduledReports.filter(r => r.generationCount > 0).length / scheduledReports.length * 100) : 100,
                alertResponseTime: 30, // seconds (configured check interval)
                storageUtilization: 0 // Would be calculated from actual storage usage
            },
            health: {
                status: status.isActive ? 'healthy' : 'unhealthy',
                reportingEnabled: status.configuration.reporting.enableScheduled,
                alertingEnabled: status.configuration.alerting.enableRealTime,
                emailConfigured: status.configuration.notifications.email.enabled,
                webhookConfigured: status.configuration.notifications.webhook.enabled,
                criticalAlerts: activeAlerts.filter(a => a.severity === 'critical').length,
                oldestUnacknowledgedAlert: activeAlerts.length > 0 ?
                    Math.max(...activeAlerts.filter(a => !a.acknowledgedAt).map(a => now - a.triggeredAt)) : 0
            }
        };

        res.json({
            success: true,
            metrics,
            timestamp: new Date().toISOString(),
            collectTime: Date.now()
        });

    } catch (error) {
        console.error('❌ Error getting reporting metrics:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get reporting metrics'
        });
    }
});

module.exports = router;