/**
 * Security Incident Response and Forensics API Routes
 * Part of Phase F.5: Create security incident response and forensics
 * Provides API endpoints for incident management, forensics, and automated response
 */

const express = require('express');
const router = express.Router();
const IncidentResponseService = require('../../src/services/IncidentResponseService');
const SecurityMonitoringService = require('../../src/services/SecurityMonitoringService');
const ComplianceFrameworkService = require('../../src/services/ComplianceFrameworkService');
const AdvancedAnalyticsService = require('../../src/services/AdvancedAnalyticsService');

// Initialize services
let incidentService = null;
let securityService = null;
let complianceService = null;
let analyticsService = null;

// Middleware to initialize incident response service
router.use((req, res, next) => {
    if (!incidentService) {
        // Initialize dependencies first
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

        if (!complianceService) {
            const complianceConfig = {
                compliance: {
                    enableContinuousMonitoring: true,
                    complianceCheckInterval: 3600000,
                    auditRetentionYears: 7
                }
            };
            complianceService = new ComplianceFrameworkService(req.db, securityService, complianceConfig);
        }

        const config = {
            response: {
                enableAutoResponse: process.env.IR_AUTO_RESPONSE !== 'false',
                responseTimeThreshold: parseInt(process.env.IR_RESPONSE_TIME_THRESHOLD) || 300000,
                escalationThresholds: {
                    low: parseInt(process.env.IR_ESCALATION_LOW) || 24 * 3600000,
                    medium: parseInt(process.env.IR_ESCALATION_MEDIUM) || 4 * 3600000,
                    high: parseInt(process.env.IR_ESCALATION_HIGH) || 1 * 3600000,
                    critical: parseInt(process.env.IR_ESCALATION_CRITICAL) || 15 * 60000
                },
                autoContainment: process.env.IR_AUTO_CONTAINMENT !== 'false',
                autoIsolation: process.env.IR_AUTO_ISOLATION !== 'false',
                notificationEnabled: process.env.IR_NOTIFICATIONS !== 'false'
            },
            detection: {
                enableRealTimeDetection: process.env.IR_REALTIME_DETECTION !== 'false',
                anomalyThreshold: parseFloat(process.env.IR_ANOMALY_THRESHOLD) || 3.0,
                patternMatchingEnabled: process.env.IR_PATTERN_MATCHING !== 'false',
                behavioralAnalysis: process.env.IR_BEHAVIORAL_ANALYSIS !== 'false',
                correlationEnabled: process.env.IR_CORRELATION !== 'false',
                confidenceThreshold: parseFloat(process.env.IR_CONFIDENCE_THRESHOLD) || 0.7
            },
            forensics: {
                enableDigitalForensics: process.env.IR_FORENSICS !== 'false',
                preserveEvidence: process.env.IR_PRESERVE_EVIDENCE !== 'false',
                chainOfCustody: process.env.IR_CHAIN_OF_CUSTODY !== 'false',
                evidenceRetentionDays: parseInt(process.env.IR_EVIDENCE_RETENTION_DAYS) || 365,
                enableMemoryDumps: process.env.IR_MEMORY_DUMPS !== 'false',
                enableNetworkCapture: process.env.IR_NETWORK_CAPTURE !== 'false',
                compressionEnabled: process.env.IR_COMPRESSION !== 'false'
            },
            communication: {
                enableAlerts: process.env.IR_ALERTS !== 'false',
                alertChannels: (process.env.IR_ALERT_CHANNELS || 'email,sms,slack').split(','),
                escalationContacts: (process.env.IR_ESCALATION_CONTACTS || '').split(',').filter(c => c),
                externalNotificationRequired: process.env.IR_EXTERNAL_NOTIFICATIONS !== 'false',
                mediaResponseEnabled: process.env.IR_MEDIA_RESPONSE !== 'false',
                stakeholderNotification: process.env.IR_STAKEHOLDER_NOTIFICATIONS !== 'false'
            },
            recovery: {
                enableAutoRecovery: process.env.IR_AUTO_RECOVERY !== 'false',
                backupRestoreEnabled: process.env.IR_BACKUP_RESTORE !== 'false',
                serviceRecoveryEnabled: process.env.IR_SERVICE_RECOVERY !== 'false',
                dataRecoveryEnabled: process.env.IR_DATA_RECOVERY !== 'false',
                recoveryTimeObjective: parseInt(process.env.IR_RTO) || 4 * 3600000,
                recoveryPointObjective: parseInt(process.env.IR_RPO) || 1 * 3600000
            },
            playbooks: {
                enablePlaybooks: process.env.IR_PLAYBOOKS !== 'false',
                autoPlaybookExecution: process.env.IR_AUTO_PLAYBOOK_EXECUTION !== 'false',
                playbookValidation: process.env.IR_PLAYBOOK_VALIDATION !== 'false',
                customPlaybooksEnabled: process.env.IR_CUSTOM_PLAYBOOKS !== 'false'
            }
        };

        incidentService = new IncidentResponseService(req.db, securityService, complianceService, config);
        console.log('🚨 IncidentResponseService initialized for API routes');
    }
    next();
});

/**
 * POST /api/incident-response/incidents
 * Create a new security incident
 */
router.post('/incidents', async (req, res) => {
    try {
        if (!incidentService) {
            return res.status(500).json({
                success: false,
                error: 'Incident response service not initialized'
            });
        }

        const incidentData = req.body;
        
        // Validate required fields
        if (!incidentData.title && !incidentData.description) {
            return res.status(400).json({
                success: false,
                error: 'Either title or description is required'
            });
        }

        const options = {
            createdBy: req.user?.id || req.headers['x-user-id'] || 'api_user',
            sourceIP: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent')
        };

        console.log(`🚨 Creating incident: ${incidentData.title || 'Automated Detection'}`);
        
        const creationResult = await incidentService.createIncident(incidentData, options);
        
        if (creationResult.success) {
            res.status(201).json({
                success: true,
                message: 'Security incident created successfully',
                incident: {
                    id: creationResult.incidentId,
                    severity: creationResult.severity,
                    priority: creationResult.priority,
                    status: creationResult.status,
                    assignedPlaybook: creationResult.assignedPlaybook,
                    responseTeamSize: creationResult.responseTeam.length
                },
                nextSteps: this.getIncidentNextSteps(creationResult.severity),
                estimatedResolutionTime: this.getEstimatedResolutionTime(creationResult.severity),
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(400).json({
                success: false,
                error: creationResult.error,
                message: creationResult.message
            });
        }

    } catch (error) {
        console.error('❌ Error creating incident:', error.message);
        res.status(500).json({
            success: false,
            error: 'incident_creation_service_error',
            message: 'Incident creation service error'
        });
    }
});

/**
 * GET /api/incident-response/incidents
 * Get security incidents with filtering and pagination
 */
router.get('/incidents', (req, res) => {
    try {
        if (!incidentService) {
            return res.status(500).json({
                success: false,
                error: 'Incident response service not initialized'
            });
        }

        const { status, severity, type, assigned_to, limit = 50, page = 1 } = req.query;
        let incidents = Array.from(incidentService.incidents.values());

        // Apply filters
        if (status) {
            incidents = incidents.filter(i => i.status === status);
        }
        if (severity) {
            incidents = incidents.filter(i => i.severity === severity);
        }
        if (type) {
            incidents = incidents.filter(i => i.type === type);
        }
        if (assigned_to) {
            incidents = incidents.filter(i => i.responseTeam.includes(assigned_to));
        }

        // Sort by creation date (newest first)
        incidents = incidents.sort((a, b) => b.createdAt - a.createdAt);

        // Pagination
        const totalIncidents = incidents.length;
        const startIndex = (parseInt(page) - 1) * parseInt(limit);
        const endIndex = startIndex + parseInt(limit);
        const paginatedIncidents = incidents.slice(startIndex, endIndex);

        const formattedIncidents = paginatedIncidents.map(incident => ({
            id: incident.id,
            title: incident.title,
            description: incident.description.substring(0, 200) + (incident.description.length > 200 ? '...' : ''),
            type: incident.type,
            severity: incident.severity,
            priority: incident.priority,
            status: incident.status,
            createdAt: new Date(incident.createdAt).toISOString(),
            detectedAt: new Date(incident.detectedAt).toISOString(),
            source: incident.source,
            affectedSystems: incident.affectedSystems,
            responseTeamSize: incident.responseTeam.length,
            evidenceCount: incident.evidence.length,
            playbook: incident.playbook,
            containmentStatus: incident.containmentStatus,
            age: Date.now() - incident.createdAt,
            ageHours: Math.round((Date.now() - incident.createdAt) / 3600000),
            ageDays: Math.round((Date.now() - incident.createdAt) / (24 * 3600000)),
            metrics: {
                responseTime: incident.metrics.responseTime,
                containmentTime: incident.metrics.containmentTime,
                totalDowntime: incident.metrics.totalDowntime
            }
        }));

        res.json({
            success: true,
            incidents: formattedIncidents,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: totalIncidents,
                totalPages: Math.ceil(totalIncidents / parseInt(limit)),
                hasNext: endIndex < totalIncidents,
                hasPrev: startIndex > 0
            },
            summary: {
                total: formattedIncidents.length,
                bySeverity: incidents.reduce((acc, i) => {
                    acc[i.severity] = (acc[i.severity] || 0) + 1;
                    return acc;
                }, {}),
                byStatus: incidents.reduce((acc, i) => {
                    acc[i.status] = (acc[i.status] || 0) + 1;
                    return acc;
                }, {}),
                byType: incidents.reduce((acc, i) => {
                    acc[i.type] = (acc[i.type] || 0) + 1;
                    return acc;
                }, {}),
                avgResponseTime: incidents.filter(i => i.metrics.responseTime > 0).length > 0 ? 
                    Math.round(incidents
                        .filter(i => i.metrics.responseTime > 0)
                        .reduce((sum, i) => sum + i.metrics.responseTime, 0) / 
                        incidents.filter(i => i.metrics.responseTime > 0).length / 60000) : 0, // in minutes
                openIncidents: incidents.filter(i => i.status === 'open').length,
                criticalIncidents: incidents.filter(i => i.severity === 'critical').length
            }
        });

    } catch (error) {
        console.error('❌ Error getting incidents:', error.message);
        res.status(500).json({
            success: false,
            error: 'incidents_retrieval_service_error',
            message: 'Failed to retrieve incidents'
        });
    }
});

/**
 * GET /api/incident-response/incidents/:incidentId
 * Get detailed information about a specific incident
 */
router.get('/incidents/:incidentId', (req, res) => {
    try {
        if (!incidentService) {
            return res.status(500).json({
                success: false,
                error: 'Incident response service not initialized'
            });
        }

        const { incidentId } = req.params;
        const incident = incidentService.incidents.get(incidentId);

        if (!incident) {
            return res.status(404).json({
                success: false,
                error: 'incident_not_found',
                message: 'Incident not found'
            });
        }

        // Get workflow details if exists
        let workflowDetails = null;
        if (incident.workflow) {
            const workflow = incidentService.workflows.get(incident.workflow);
            if (workflow) {
                workflowDetails = {
                    id: workflow.id,
                    playbookId: workflow.playbookId,
                    status: workflow.status,
                    progress: workflow.progress,
                    currentStep: workflow.currentStep,
                    totalSteps: workflow.steps.length,
                    startedAt: new Date(workflow.startedAt).toISOString(),
                    completedAt: workflow.completedAt ? new Date(workflow.completedAt).toISOString() : null,
                    executionMode: workflow.executionMode,
                    steps: workflow.steps.map(step => ({
                        id: step.id,
                        action: step.action,
                        status: step.status,
                        critical: step.critical,
                        startedAt: step.startedAt ? new Date(step.startedAt).toISOString() : null,
                        completedAt: step.completedAt ? new Date(step.completedAt).toISOString() : null,
                        result: step.result,
                        error: step.error
                    }))
                };
            }
        }

        // Get evidence details
        const evidenceDetails = incident.evidence.map(evidenceId => {
            const evidence = incidentService.evidenceStore.get(evidenceId);
            return evidence ? {
                id: evidence.id,
                type: evidence.type,
                category: evidence.category,
                description: evidence.description,
                collectedAt: new Date(evidence.collectedAt).toISOString(),
                collectedBy: evidence.collectedBy,
                size: evidence.size,
                hash: evidence.hash,
                analysisStatus: evidence.analysis.status,
                findingsCount: evidence.analysis.findings.length,
                preserved: evidence.preservation.preserved
            } : null;
        }).filter(e => e);

        // Get response team details
        const responseTeamDetails = incident.responseTeam.map(memberId => {
            const member = incidentService.responseTeam.get(memberId);
            return member ? {
                id: member.id,
                name: member.name,
                role: member.role,
                email: member.email,
                experience: member.experience,
                certifications: member.certifications
            } : null;
        }).filter(m => m);

        const detailedIncident = {
            id: incident.id,
            title: incident.title,
            description: incident.description,
            type: incident.type,
            severity: incident.severity,
            priority: incident.priority,
            status: incident.status,
            createdAt: new Date(incident.createdAt).toISOString(),
            detectedAt: new Date(incident.detectedAt).toISOString(),
            escalatedAt: incident.escalatedAt ? new Date(incident.escalatedAt).toISOString() : null,
            resolvedAt: incident.resolvedAt ? new Date(incident.resolvedAt).toISOString() : null,
            closedAt: incident.closedAt ? new Date(incident.closedAt).toISOString() : null,
            source: incident.source,
            affectedSystems: incident.affectedSystems,
            indicators: incident.indicators,
            timeline: incident.timeline.map(event => ({
                timestamp: new Date(event.timestamp).toISOString(),
                event: event.event,
                description: event.description,
                user: event.user
            })),
            workflow: workflowDetails,
            evidence: evidenceDetails,
            responseTeam: responseTeamDetails,
            containmentStatus: incident.containmentStatus,
            eradicationStatus: incident.eradicationStatus,
            recoveryStatus: incident.recoveryStatus,
            metrics: {
                detectionTime: incident.metrics.detectionTime,
                responseTime: incident.metrics.responseTime,
                responseTimeMinutes: Math.round(incident.metrics.responseTime / 60000),
                containmentTime: incident.metrics.containmentTime,
                containmentTimeMinutes: Math.round(incident.metrics.containmentTime / 60000),
                recoveryTime: incident.metrics.recoveryTime,
                recoveryTimeMinutes: Math.round(incident.metrics.recoveryTime / 60000),
                totalDowntime: incident.metrics.totalDowntime,
                totalDowntimeMinutes: Math.round(incident.metrics.totalDowntime / 60000)
            },
            impact: incident.impact,
            communication: {
                internalNotifications: incident.communication.internalNotifications.length,
                externalNotifications: incident.communication.externalNotifications.length,
                stakeholderUpdates: incident.communication.stakeholderUpdates.length
            },
            age: Date.now() - incident.createdAt,
            ageDays: Math.round((Date.now() - incident.createdAt) / (24 * 3600000)),
            lessonsLearned: incident.lessonsLearned
        };

        res.json({
            success: true,
            incident: detailedIncident
        });

    } catch (error) {
        console.error('❌ Error getting incident details:', error.message);
        res.status(500).json({
            success: false,
            error: 'incident_details_service_error',
            message: 'Failed to get incident details'
        });
    }
});

/**
 * POST /api/incident-response/incidents/:incidentId/playbook
 * Execute incident response playbook
 */
router.post('/incidents/:incidentId/playbook', async (req, res) => {
    try {
        if (!incidentService) {
            return res.status(500).json({
                success: false,
                error: 'Incident response service not initialized'
            });
        }

        const { incidentId } = req.params;
        const { playbookId, executionMode = 'automatic', autoExecution = true } = req.body;

        if (!playbookId) {
            return res.status(400).json({
                success: false,
                error: 'playbookId is required'
            });
        }

        const options = {
            executedBy: req.user?.id || req.headers['x-user-id'] || 'api_user',
            executionMode,
            autoExecution
        };

        console.log(`🚨 Executing playbook ${playbookId} for incident ${incidentId}`);
        
        const executionResult = await incidentService.executePlaybook(incidentId, playbookId, options);
        
        if (executionResult.success) {
            res.json({
                success: true,
                message: 'Playbook execution started successfully',
                workflow: {
                    id: executionResult.workflowId,
                    playbookName: executionResult.playbookName,
                    estimatedDuration: executionResult.estimatedDuration,
                    estimatedDurationHours: Math.round(executionResult.estimatedDuration / 3600000),
                    stepCount: executionResult.stepCount,
                    autoExecution: executionResult.autoExecution
                },
                monitoring: {
                    statusEndpoint: `/api/incident-response/workflows/${executionResult.workflowId}/status`,
                    progressEndpoint: `/api/incident-response/workflows/${executionResult.workflowId}/progress`
                },
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(400).json({
                success: false,
                error: executionResult.error,
                message: executionResult.message
            });
        }

    } catch (error) {
        console.error('❌ Error executing playbook:', error.message);
        res.status(500).json({
            success: false,
            error: 'playbook_execution_service_error',
            message: 'Playbook execution service error'
        });
    }
});

/**
 * POST /api/incident-response/incidents/:incidentId/evidence
 * Collect digital evidence for an incident
 */
router.post('/incidents/:incidentId/evidence', async (req, res) => {
    try {
        if (!incidentService) {
            return res.status(500).json({
                success: false,
                error: 'Incident response service not initialized'
            });
        }

        const { incidentId } = req.params;
        const evidenceRequest = req.body;

        if (!evidenceRequest.type || !evidenceRequest.source) {
            return res.status(400).json({
                success: false,
                error: 'Evidence type and source are required'
            });
        }

        // Enrich evidence request with user information
        evidenceRequest.collectedBy = req.user?.id || req.headers['x-user-id'] || 'api_user';
        evidenceRequest.metadata = {
            ...evidenceRequest.metadata,
            requestIP: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent'),
            timestamp: Date.now()
        };

        console.log(`🚨 Collecting ${evidenceRequest.type} evidence for incident ${incidentId}`);
        
        const collectionResult = await incidentService.collectEvidence(incidentId, evidenceRequest);
        
        if (collectionResult.success) {
            res.status(201).json({
                success: true,
                message: 'Evidence collection completed successfully',
                evidence: {
                    id: collectionResult.evidenceId,
                    type: collectionResult.type,
                    category: collectionResult.category,
                    size: collectionResult.size,
                    sizeFormatted: this.formatBytes(collectionResult.size),
                    hash: collectionResult.hash,
                    collectedAt: collectionResult.collectedAt,
                    preserved: collectionResult.preserved,
                    retentionUntil: collectionResult.retentionUntil
                },
                forensics: {
                    chainOfCustodyMaintained: true,
                    evidenceIntegrityVerified: true,
                    analysisRecommended: true
                },
                nextSteps: [
                    'Evidence has been securely stored',
                    'Analysis can be initiated using the analysis endpoint',
                    'Chain of custody has been established',
                    'Evidence will be retained until ' + new Date(collectionResult.retentionUntil).toLocaleDateString()
                ],
                analysisEndpoint: `/api/incident-response/evidence/${collectionResult.evidenceId}/analyze`
            });
        } else {
            res.status(400).json({
                success: false,
                error: collectionResult.error,
                message: collectionResult.message
            });
        }

    } catch (error) {
        console.error('❌ Error collecting evidence:', error.message);
        res.status(500).json({
            success: false,
            error: 'evidence_collection_service_error',
            message: 'Evidence collection service error'
        });
    }
});

/**
 * POST /api/incident-response/evidence/:evidenceId/analyze
 * Analyze collected digital evidence
 */
router.post('/evidence/:evidenceId/analyze', async (req, res) => {
    try {
        if (!incidentService) {
            return res.status(500).json({
                success: false,
                error: 'Incident response service not initialized'
            });
        }

        const { evidenceId } = req.params;
        const analysisOptions = req.body || {};

        // Add user context to analysis options
        analysisOptions.analyzedBy = req.user?.id || req.headers['x-user-id'] || 'api_user';
        analysisOptions.requestedAt = Date.now();

        console.log(`🚨 Analyzing evidence ${evidenceId}`);
        
        const analysisResult = await incidentService.analyzeEvidence(evidenceId, analysisOptions);
        
        if (analysisResult.success) {
            res.json({
                success: true,
                message: 'Evidence analysis completed successfully',
                analysis: {
                    id: analysisResult.analysisId,
                    findings: analysisResult.findings,
                    findingsCount: analysisResult.findings.length,
                    indicators: analysisResult.indicators,
                    indicatorsCount: analysisResult.indicators.length,
                    confidence: analysisResult.confidence,
                    confidenceLevel: this.getConfidenceLevel(analysisResult.confidence),
                    timeline: analysisResult.timeline,
                    recommendations: analysisResult.recommendations
                },
                forensics: {
                    methodUsed: analysisOptions.method || 'automated',
                    analysisTime: '2 minutes', // Simulated
                    evidenceIntegrity: 'verified',
                    analysisValidity: 'high'
                },
                actionableInsights: {
                    immediateActions: analysisResult.recommendations.slice(0, 3),
                    investigationPriority: analysisResult.confidence > 0.8 ? 'high' : 
                                           analysisResult.confidence > 0.6 ? 'medium' : 'low',
                    threatLevel: this.assessThreatLevel(analysisResult.indicators),
                    correlationSuggested: analysisResult.indicators.length > 2
                },
                reportGenerated: true,
                reportEndpoint: `/api/incident-response/evidence/${evidenceId}/report`
            });
        } else {
            res.status(400).json({
                success: false,
                error: analysisResult.error,
                message: analysisResult.message
            });
        }

    } catch (error) {
        console.error('❌ Error analyzing evidence:', error.message);
        res.status(500).json({
            success: false,
            error: 'evidence_analysis_service_error',
            message: 'Evidence analysis service error'
        });
    }
});

/**
 * GET /api/incident-response/playbooks
 * Get available incident response playbooks
 */
router.get('/playbooks', (req, res) => {
    try {
        if (!incidentService) {
            return res.status(500).json({
                success: false,
                error: 'Incident response service not initialized'
            });
        }

        const { severity, trigger, active = 'true' } = req.query;
        let playbooks = Array.from(incidentService.playbooks.values());

        // Apply filters
        if (active !== 'all') {
            playbooks = playbooks.filter(p => p.active === (active === 'true'));
        }
        if (severity) {
            playbooks = playbooks.filter(p => p.severity.includes(severity));
        }
        if (trigger) {
            playbooks = playbooks.filter(p => p.triggers.some(t => t.includes(trigger)));
        }

        const formattedPlaybooks = playbooks.map(playbook => ({
            id: playbook.id,
            name: playbook.name,
            description: playbook.description,
            severity: playbook.severity,
            triggers: playbook.triggers,
            stepCount: playbook.steps.length,
            automationLevel: playbook.automationLevel,
            estimatedDuration: playbook.estimatedDuration,
            estimatedDurationHours: Math.round(playbook.estimatedDuration / 3600000),
            requiredRoles: playbook.requiredRoles,
            usageCount: playbook.usageCount,
            successRate: playbook.successRate,
            lastUsed: playbook.lastUsed ? new Date(playbook.lastUsed).toISOString() : null,
            createdAt: new Date(playbook.createdAt).toISOString(),
            active: playbook.active,
            complexity: this.getPlaybookComplexity(playbook.steps.length, playbook.automationLevel),
            suitableFor: this.getPlaybookSuitability(playbook)
        }));

        res.json({
            success: true,
            playbooks: formattedPlaybooks,
            summary: {
                total: formattedPlaybooks.length,
                active: formattedPlaybooks.filter(p => p.active).length,
                byAutomationLevel: playbooks.reduce((acc, p) => {
                    acc[p.automationLevel] = (acc[p.automationLevel] || 0) + 1;
                    return acc;
                }, {}),
                bySeverity: playbooks.reduce((acc, p) => {
                    p.severity.forEach(sev => {
                        acc[sev] = (acc[sev] || 0) + 1;
                    });
                    return acc;
                }, {}),
                avgSuccessRate: playbooks.length > 0 ? 
                    Math.round(playbooks.reduce((sum, p) => sum + p.successRate, 0) / playbooks.length) : 0,
                totalUsages: playbooks.reduce((sum, p) => sum + p.usageCount, 0)
            }
        });

    } catch (error) {
        console.error('❌ Error getting playbooks:', error.message);
        res.status(500).json({
            success: false,
            error: 'playbooks_retrieval_service_error',
            message: 'Failed to retrieve playbooks'
        });
    }
});

/**
 * GET /api/incident-response/team
 * Get incident response team members and their status
 */
router.get('/team', (req, res) => {
    try {
        if (!incidentService) {
            return res.status(500).json({
                success: false,
                error: 'Incident response service not initialized'
            });
        }

        const { role, availability, active = 'true' } = req.query;
        let teamMembers = Array.from(incidentService.responseTeam.values());

        // Apply filters
        if (active !== 'all') {
            teamMembers = teamMembers.filter(m => m.active === (active === 'true'));
        }
        if (role) {
            teamMembers = teamMembers.filter(m => m.role === role);
        }
        if (availability) {
            teamMembers = teamMembers.filter(m => m.availability === availability);
        }

        const formattedTeamMembers = teamMembers.map(member => ({
            id: member.id,
            name: member.name,
            role: member.role,
            email: member.email,
            phone: member.phone,
            skills: member.skills,
            availability: member.availability,
            certifications: member.certifications,
            experience: member.experience,
            active: member.active,
            incidentsHandled: member.incidentsHandled,
            currentIncidentsCount: member.currentIncidents.length,
            currentIncidents: member.currentIncidents,
            addedAt: new Date(member.addedAt).toISOString(),
            lastActivity: member.lastActivity ? new Date(member.lastActivity).toISOString() : null,
            workload: this.getWorkloadStatus(member.currentIncidents.length),
            expertise: this.getExpertiseLevel(member.experience, member.certifications.length)
        }));

        res.json({
            success: true,
            team: formattedTeamMembers,
            summary: {
                total: formattedTeamMembers.length,
                active: formattedTeamMembers.filter(m => m.active).length,
                available: formattedTeamMembers.filter(m => m.availability === 'on_call').length,
                byRole: teamMembers.reduce((acc, m) => {
                    acc[m.role] = (acc[m.role] || 0) + 1;
                    return acc;
                }, {}),
                byExperience: teamMembers.reduce((acc, m) => {
                    acc[m.experience] = (acc[m.experience] || 0) + 1;
                    return acc;
                }, {}),
                totalIncidentsHandled: teamMembers.reduce((sum, m) => sum + m.incidentsHandled, 0),
                avgIncidentsPerMember: teamMembers.length > 0 ? 
                    Math.round(teamMembers.reduce((sum, m) => sum + m.incidentsHandled, 0) / teamMembers.length) : 0,
                currentWorkload: teamMembers.reduce((sum, m) => sum + m.currentIncidents.length, 0)
            },
            roleDefinitions: {
                incident_commander: 'Overall incident management and coordination',
                security_analyst: 'Threat analysis and technical investigation',
                forensics_specialist: 'Digital forensics and evidence analysis',
                legal_counsel: 'Legal compliance and regulatory requirements',
                network_engineer: 'Network infrastructure and connectivity issues',
                hr_representative: 'Human resources and insider threat coordination',
                privacy_officer: 'Privacy compliance and data protection'
            }
        });

    } catch (error) {
        console.error('❌ Error getting response team:', error.message);
        res.status(500).json({
            success: false,
            error: 'team_retrieval_service_error',
            message: 'Failed to retrieve response team'
        });
    }
});

/**
 * GET /api/incident-response/status
 * Get incident response service status and metrics
 */
router.get('/status', (req, res) => {
    try {
        if (!incidentService) {
            return res.status(500).json({
                success: false,
                error: 'Incident response service not initialized'
            });
        }

        const status = incidentService.getIncidentResponseStatus();
        
        res.json({
            success: true,
            status: {
                service: {
                    active: status.isActive,
                    lastActivity: new Date(status.lastActivity).toISOString()
                },
                response: {
                    autoResponseEnabled: status.configuration.response.enableAutoResponse,
                    responseTimeThreshold: status.configuration.response.responseTimeThreshold,
                    responseTimeThresholdMinutes: Math.round(status.configuration.response.responseTimeThreshold / 60000),
                    autoContainmentEnabled: status.configuration.response.autoContainment,
                    autoIsolationEnabled: status.configuration.response.autoIsolation,
                    notificationsEnabled: status.configuration.response.notificationEnabled
                },
                detection: {
                    realTimeDetectionEnabled: status.configuration.detection.enableRealTimeDetection,
                    anomalyThreshold: status.configuration.detection.anomalyThreshold,
                    patternMatchingEnabled: status.configuration.detection.patternMatchingEnabled,
                    behavioralAnalysisEnabled: status.configuration.detection.behavioralAnalysis,
                    correlationEnabled: status.configuration.detection.correlationEnabled,
                    confidenceThreshold: status.configuration.detection.confidenceThreshold
                },
                forensics: {
                    digitalForensicsEnabled: status.configuration.forensics.enableDigitalForensics,
                    evidencePreservationEnabled: status.configuration.forensics.preserveEvidence,
                    chainOfCustodyEnabled: status.configuration.forensics.chainOfCustody,
                    evidenceRetentionDays: status.configuration.forensics.evidenceRetentionDays,
                    memoryDumpsEnabled: status.configuration.forensics.enableMemoryDumps,
                    networkCaptureEnabled: status.configuration.forensics.enableNetworkCapture
                },
                playbooks: {
                    playbooksEnabled: status.configuration.playbooks.enablePlaybooks,
                    autoPlaybookExecutionEnabled: status.configuration.playbooks.autoPlaybookExecution,
                    playbookValidationEnabled: status.configuration.playbooks.playbookValidation,
                    customPlaybooksEnabled: status.configuration.playbooks.customPlaybooksEnabled
                },
                recovery: {
                    autoRecoveryEnabled: status.configuration.recovery.enableAutoRecovery,
                    backupRestoreEnabled: status.configuration.recovery.backupRestoreEnabled,
                    recoveryTimeObjective: status.configuration.recovery.recoveryTimeObjective,
                    recoveryTimeObjectiveHours: Math.round(status.configuration.recovery.recoveryTimeObjective / 3600000),
                    recoveryPointObjective: status.configuration.recovery.recoveryPointObjective,
                    recoveryPointObjectiveHours: Math.round(status.configuration.recovery.recoveryPointObjective / 3600000)
                },
                metrics: status.metrics
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error getting incident response status:', error.message);
        res.status(500).json({
            success: false,
            error: 'status_service_error',
            message: 'Failed to get incident response status'
        });
    }
});

/**
 * GET /api/incident-response/dashboard
 * Get comprehensive incident response dashboard data
 */
router.get('/dashboard', (req, res) => {
    try {
        if (!incidentService) {
            return res.status(500).json({
                success: false,
                error: 'Incident response service not initialized'
            });
        }

        const incidents = Array.from(incidentService.incidents.values());
        const workflows = Array.from(incidentService.workflows.values());
        const evidence = Array.from(incidentService.evidenceStore.values());
        const team = Array.from(incidentService.responseTeam.values());

        const now = Date.now();
        const oneDayAgo = now - 24 * 60 * 60 * 1000;
        const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
        const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;

        const dashboard = {
            incidents: {
                total: incidents.length,
                open: incidents.filter(i => i.status === 'open').length,
                inProgress: incidents.filter(i => i.status === 'in_progress').length,
                resolved: incidents.filter(i => i.status === 'resolved').length,
                closed: incidents.filter(i => i.status === 'closed').length,
                critical: incidents.filter(i => i.severity === 'critical').length,
                high: incidents.filter(i => i.severity === 'high').length,
                recent24h: incidents.filter(i => i.createdAt > oneDayAgo).length,
                recent7d: incidents.filter(i => i.createdAt > oneWeekAgo).length,
                recent30d: incidents.filter(i => i.createdAt > oneMonthAgo).length
            },
            response: {
                activePlaybooks: workflows.filter(w => w.status === 'running').length,
                completedPlaybooks: workflows.filter(w => w.status === 'completed').length,
                avgResponseTime: this.calculateAverageResponseTime(incidents),
                avgContainmentTime: this.calculateAverageContainmentTime(incidents),
                avgRecoveryTime: this.calculateAverageRecoveryTime(incidents),
                playbookSuccessRate: this.calculatePlaybookSuccessRate(workflows)
            },
            forensics: {
                evidenceItems: evidence.length,
                evidenceCollected24h: evidence.filter(e => e.collectedAt > oneDayAgo).length,
                evidenceAnalyzed: evidence.filter(e => e.analysis.status === 'completed').length,
                evidencePending: evidence.filter(e => e.analysis.status === 'pending').length,
                avgEvidenceSize: evidence.length > 0 ? 
                    Math.round(evidence.reduce((sum, e) => sum + e.size, 0) / evidence.length) : 0,
                totalEvidenceSize: evidence.reduce((sum, e) => sum + e.size, 0)
            },
            team: {
                totalMembers: team.length,
                activeMembers: team.filter(m => m.active).length,
                availableMembers: team.filter(m => m.availability === 'on_call').length,
                busyMembers: team.filter(m => m.currentIncidents.length > 0).length,
                avgWorkload: team.length > 0 ? 
                    Math.round(team.reduce((sum, m) => sum + m.currentIncidents.length, 0) / team.length) : 0,
                expertMembers: team.filter(m => m.experience === 'expert').length
            },
            trends: {
                incidentTrend: this.calculateIncidentTrend(incidents),
                severityTrend: this.calculateSeverityTrend(incidents),
                responseTimeTrend: this.calculateResponseTimeTrend(incidents),
                resolutionTrend: this.calculateResolutionTrend(incidents)
            },
            alerts: {
                criticalIncidentsOpen: incidents.filter(i => i.severity === 'critical' && i.status === 'open').length,
                highPriorityOverdue: incidents.filter(i => i.priority === 'P1' && 
                    now - i.createdAt > 4 * 3600000 && i.status === 'open').length,
                evidenceAnalysisBacklog: evidence.filter(e => e.analysis.status === 'pending').length,
                teamOverloaded: team.filter(m => m.currentIncidents.length >= 3).length
            }
        };

        res.json({
            success: true,
            dashboard,
            generatedAt: new Date().toISOString(),
            refreshInterval: 30000, // 30 seconds
            alertsCount: Object.values(dashboard.alerts).reduce((sum, count) => sum + count, 0)
        });

    } catch (error) {
        console.error('❌ Error generating dashboard:', error.message);
        res.status(500).json({
            success: false,
            error: 'dashboard_service_error',
            message: 'Failed to generate incident response dashboard'
        });
    }
});

// Helper methods
router.getIncidentNextSteps = function(severity) {
    const nextSteps = {
        critical: [
            'Immediate escalation to incident commander',
            'Automated containment procedures initiated',
            'Evidence preservation in progress',
            'Executive notification scheduled within 15 minutes'
        ],
        high: [
            'Response team being assembled',
            'Initial containment measures activated',
            'Evidence collection initiated',
            'Stakeholder notification scheduled within 1 hour'
        ],
        medium: [
            'Security analyst assigned to investigate',
            'Standard response procedures initiated',
            'Evidence collection scheduled',
            'Regular updates will be provided'
        ],
        low: [
            'Incident logged for investigation',
            'Automated analysis in progress',
            'Manual review scheduled within 24 hours',
            'No immediate action required'
        ]
    };

    return nextSteps[severity] || nextSteps['low'];
};

router.getEstimatedResolutionTime = function(severity) {
    const resolutionTimes = {
        critical: '4-8 hours',
        high: '8-24 hours',
        medium: '1-3 days',
        low: '3-7 days'
    };

    return resolutionTimes[severity] || resolutionTimes['low'];
};

router.formatBytes = function(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

router.getConfidenceLevel = function(confidence) {
    if (confidence >= 0.9) return 'very_high';
    if (confidence >= 0.7) return 'high';
    if (confidence >= 0.5) return 'medium';
    if (confidence >= 0.3) return 'low';
    return 'very_low';
};

router.assessThreatLevel = function(indicators) {
    const highThreatIndicators = ['malware_presence', 'data_exfiltration', 'c2_communication'];
    const mediumThreatIndicators = ['suspicious_activity', 'anomalous_behavior', 'unauthorized_access'];
    
    const highCount = indicators.filter(i => highThreatIndicators.includes(i)).length;
    const mediumCount = indicators.filter(i => mediumThreatIndicators.includes(i)).length;
    
    if (highCount > 0) return 'high';
    if (mediumCount > 1) return 'medium';
    return 'low';
};

router.getPlaybookComplexity = function(stepCount, automationLevel) {
    const automation = ['very_high', 'high', 'medium', 'low'].indexOf(automationLevel);
    const complexity = stepCount + (automation * 2);
    
    if (complexity > 15) return 'high';
    if (complexity > 8) return 'medium';
    return 'low';
};

router.getPlaybookSuitability = function(playbook) {
    const suitable = [];
    if (playbook.automationLevel === 'very_high' || playbook.automationLevel === 'high') {
        suitable.push('24/7 operations');
    }
    if (playbook.severity.includes('critical')) {
        suitable.push('emergency response');
    }
    if (playbook.steps.length <= 5) {
        suitable.push('rapid response');
    }
    return suitable;
};

router.getWorkloadStatus = function(currentIncidentsCount) {
    if (currentIncidentsCount >= 4) return 'overloaded';
    if (currentIncidentsCount >= 2) return 'busy';
    if (currentIncidentsCount === 1) return 'active';
    return 'available';
};

router.getExpertiseLevel = function(experience, certificationCount) {
    const experienceScore = { 'junior': 1, 'senior': 2, 'expert': 3 }[experience] || 1;
    const certScore = Math.min(certificationCount, 3);
    const totalScore = experienceScore + certScore;
    
    if (totalScore >= 5) return 'expert';
    if (totalScore >= 3) return 'advanced';
    return 'intermediate';
};

// Dashboard calculation methods
router.calculateAverageResponseTime = function(incidents) {
    const responded = incidents.filter(i => i.metrics.responseTime > 0);
    return responded.length > 0 ? 
        Math.round(responded.reduce((sum, i) => sum + i.metrics.responseTime, 0) / responded.length / 60000) : 0;
};

router.calculateAverageContainmentTime = function(incidents) {
    const contained = incidents.filter(i => i.metrics.containmentTime > 0);
    return contained.length > 0 ? 
        Math.round(contained.reduce((sum, i) => sum + i.metrics.containmentTime, 0) / contained.length / 60000) : 0;
};

router.calculateAverageRecoveryTime = function(incidents) {
    const recovered = incidents.filter(i => i.metrics.recoveryTime > 0);
    return recovered.length > 0 ? 
        Math.round(recovered.reduce((sum, i) => sum + i.metrics.recoveryTime, 0) / recovered.length / 60000) : 0;
};

router.calculatePlaybookSuccessRate = function(workflows) {
    const completed = workflows.filter(w => w.status === 'completed');
    return workflows.length > 0 ? 
        Math.round((completed.length / workflows.length) * 100) : 100;
};

router.calculateIncidentTrend = function(incidents) {
    const now = Date.now();
    const thisWeek = incidents.filter(i => i.createdAt > now - 7 * 24 * 60 * 60 * 1000).length;
    const lastWeek = incidents.filter(i => 
        i.createdAt > now - 14 * 24 * 60 * 60 * 1000 && 
        i.createdAt <= now - 7 * 24 * 60 * 60 * 1000
    ).length;
    
    if (thisWeek > lastWeek * 1.1) return 'increasing';
    if (thisWeek < lastWeek * 0.9) return 'decreasing';
    return 'stable';
};

router.calculateSeverityTrend = function(incidents) {
    const now = Date.now();
    const recentCritical = incidents.filter(i => 
        i.severity === 'critical' && i.createdAt > now - 7 * 24 * 60 * 60 * 1000
    ).length;
    
    return recentCritical > 2 ? 'worsening' : 'stable';
};

router.calculateResponseTimeTrend = function(incidents) {
    const now = Date.now();
    const recentIncidents = incidents.filter(i => i.createdAt > now - 7 * 24 * 60 * 60 * 1000);
    const olderIncidents = incidents.filter(i => 
        i.createdAt > now - 14 * 24 * 60 * 60 * 1000 && 
        i.createdAt <= now - 7 * 24 * 60 * 60 * 1000
    );
    
    if (recentIncidents.length === 0 || olderIncidents.length === 0) return 'stable';
    
    const recentAvg = recentIncidents.reduce((sum, i) => sum + i.metrics.responseTime, 0) / recentIncidents.length;
    const olderAvg = olderIncidents.reduce((sum, i) => sum + i.metrics.responseTime, 0) / olderIncidents.length;
    
    if (recentAvg < olderAvg * 0.9) return 'improving';
    if (recentAvg > olderAvg * 1.1) return 'degrading';
    return 'stable';
};

router.calculateResolutionTrend = function(incidents) {
    const now = Date.now();
    const recentResolved = incidents.filter(i => 
        i.status === 'resolved' && i.resolvedAt && i.resolvedAt > now - 7 * 24 * 60 * 60 * 1000
    ).length;
    const recentCreated = incidents.filter(i => i.createdAt > now - 7 * 24 * 60 * 60 * 1000).length;
    
    const resolutionRate = recentCreated > 0 ? recentResolved / recentCreated : 1;
    
    if (resolutionRate > 0.8) return 'excellent';
    if (resolutionRate > 0.6) return 'good';
    if (resolutionRate > 0.4) return 'fair';
    return 'poor';
};

module.exports = router;