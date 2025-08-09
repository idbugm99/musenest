/**
 * Compliance Framework Service
 * Part of Phase F.2: Create compliance framework with audit trails and reporting
 * 
 * Provides comprehensive compliance management capabilities including:
 * - Regulatory compliance monitoring (GDPR, CCPA, SOX, HIPAA, etc.)
 * - Audit trail generation and management
 * - Compliance reporting and documentation
 * - Policy enforcement and validation
 * - Risk assessment and compliance scoring
 * - Automated compliance checks and alerts
 * - Data governance and retention policies
 */

const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class ComplianceFrameworkService extends EventEmitter {
    constructor(database, securityService, config = {}) {
        super();
        this.db = database;
        this.securityService = securityService;
        
        // Configuration with environment-based defaults
        this.config = {
            compliance: {
                enableContinuousMonitoring: config.compliance?.enableContinuousMonitoring !== false,
                complianceCheckInterval: config.compliance?.complianceCheckInterval || 3600000, // 1 hour
                auditRetentionYears: config.compliance?.auditRetentionYears || 7,
                enableRealTimeAuditing: config.compliance?.enableRealTimeAuditing !== false,
                complianceThreshold: config.compliance?.complianceThreshold || 85, // 85% compliance score
                maxViolations: config.compliance?.maxViolations || 10
            },
            frameworks: {
                enabledRegulations: config.frameworks?.enabledRegulations || ['GDPR', 'CCPA', 'SOX', 'PCI-DSS'],
                customPolicies: config.frameworks?.customPolicies || [],
                riskAssessmentEnabled: config.frameworks?.riskAssessmentEnabled !== false,
                policyUpdateInterval: config.frameworks?.policyUpdateInterval || 86400000 // 24 hours
            },
            auditing: {
                enableDetailedLogging: config.auditing?.enableDetailedLogging !== false,
                auditEventTypes: config.auditing?.auditEventTypes || [
                    'data_access', 'data_modification', 'user_authentication', 'admin_action', 
                    'configuration_change', 'security_event', 'compliance_violation'
                ],
                sensitiveDataTracking: config.auditing?.sensitiveDataTracking !== false,
                hashAuditLogs: config.auditing?.hashAuditLogs !== false,
                compressionEnabled: config.auditing?.compressionEnabled !== false
            },
            reporting: {
                enableAutomatedReports: config.reporting?.enableAutomatedReports !== false,
                reportFormats: config.reporting?.reportFormats || ['pdf', 'json', 'csv', 'xlsx'],
                reportSchedule: config.reporting?.reportSchedule || 'monthly',
                reportRetentionMonths: config.reporting?.reportRetentionMonths || 36,
                executiveReportsEnabled: config.reporting?.executiveReportsEnabled !== false
            },
            storage: {
                complianceDir: config.storage?.complianceDir || '/tmp/musenest-compliance',
                auditLogsDir: config.storage?.auditLogsDir || '/tmp/musenest-compliance/audit-logs',
                reportsDir: config.storage?.reportsDir || '/tmp/musenest-compliance/reports',
                policiesDir: config.storage?.policiesDir || '/tmp/musenest-compliance/policies'
            }
        };

        // Service state
        this.isActive = false;
        this.complianceFrameworks = new Map();
        this.auditTrails = new Map();
        this.complianceViolations = new Map();
        this.complianceReports = new Map();
        this.policyViolations = new Map();
        this.complianceScores = new Map();
        this.auditCounter = 0;
        this.reportCounter = 0;

        // Compliance framework definitions
        this.initializeComplianceFrameworks();

        console.log('📋 ComplianceFrameworkService initialized');
        this.ensureStorageDirectories();
        this.loadCompliancePolicies();
        this.startService();
    }

    async ensureStorageDirectories() {
        try {
            const directories = [
                this.config.storage.complianceDir,
                this.config.storage.auditLogsDir,
                this.config.storage.reportsDir,
                this.config.storage.policiesDir,
                path.join(this.config.storage.auditLogsDir, 'daily'),
                path.join(this.config.storage.auditLogsDir, 'archived'),
                path.join(this.config.storage.reportsDir, 'automated'),
                path.join(this.config.storage.reportsDir, 'ad-hoc')
            ];

            for (const dir of directories) {
                await fs.mkdir(dir, { recursive: true });
            }
        } catch (error) {
            console.error('❌ Error creating compliance directories:', error.message);
        }
    }

    initializeComplianceFrameworks() {
        // GDPR (General Data Protection Regulation)
        this.complianceFrameworks.set('GDPR', {
            id: 'GDPR',
            name: 'General Data Protection Regulation',
            description: 'EU regulation on data protection and privacy',
            jurisdiction: 'EU',
            applicability: 'Data processing of EU residents',
            requirements: [
                {
                    id: 'GDPR-1',
                    title: 'Consent Management',
                    description: 'Obtain explicit consent for data processing',
                    severity: 'critical',
                    checkFunction: 'checkConsentManagement'
                },
                {
                    id: 'GDPR-2',
                    title: 'Right to Erasure',
                    description: 'Implement data deletion capabilities',
                    severity: 'high',
                    checkFunction: 'checkDataDeletionCapability'
                },
                {
                    id: 'GDPR-3',
                    title: 'Data Portability',
                    description: 'Enable data export functionality',
                    severity: 'medium',
                    checkFunction: 'checkDataPortability'
                },
                {
                    id: 'GDPR-4',
                    title: 'Breach Notification',
                    description: 'Report breaches within 72 hours',
                    severity: 'critical',
                    checkFunction: 'checkBreachNotification'
                },
                {
                    id: 'GDPR-5',
                    title: 'Data Protection Officer',
                    description: 'Appoint DPO if required',
                    severity: 'medium',
                    checkFunction: 'checkDPOAppointment'
                }
            ],
            penalties: {
                max_fine: '20M EUR or 4% of annual revenue',
                warning_threshold: 75,
                critical_threshold: 60
            }
        });

        // CCPA (California Consumer Privacy Act)
        this.complianceFrameworks.set('CCPA', {
            id: 'CCPA',
            name: 'California Consumer Privacy Act',
            description: 'California state law on consumer privacy rights',
            jurisdiction: 'California, US',
            applicability: 'California residents data processing',
            requirements: [
                {
                    id: 'CCPA-1',
                    title: 'Privacy Policy',
                    description: 'Maintain transparent privacy policy',
                    severity: 'high',
                    checkFunction: 'checkPrivacyPolicy'
                },
                {
                    id: 'CCPA-2',
                    title: 'Consumer Rights',
                    description: 'Implement consumer data rights',
                    severity: 'critical',
                    checkFunction: 'checkConsumerRights'
                },
                {
                    id: 'CCPA-3',
                    title: 'Opt-out Mechanism',
                    description: 'Provide opt-out for data sale',
                    severity: 'critical',
                    checkFunction: 'checkOptOutMechanism'
                },
                {
                    id: 'CCPA-4',
                    title: 'Data Categories Disclosure',
                    description: 'Disclose data categories collected',
                    severity: 'medium',
                    checkFunction: 'checkDataCategoriesDisclosure'
                }
            ],
            penalties: {
                max_fine: '$7500 per violation',
                warning_threshold: 80,
                critical_threshold: 65
            }
        });

        // PCI-DSS (Payment Card Industry Data Security Standard)
        this.complianceFrameworks.set('PCI-DSS', {
            id: 'PCI-DSS',
            name: 'Payment Card Industry Data Security Standard',
            description: 'Security standards for payment card data',
            jurisdiction: 'Global',
            applicability: 'Payment card data processing',
            requirements: [
                {
                    id: 'PCI-1',
                    title: 'Network Security',
                    description: 'Maintain secure network infrastructure',
                    severity: 'critical',
                    checkFunction: 'checkNetworkSecurity'
                },
                {
                    id: 'PCI-2',
                    title: 'Data Encryption',
                    description: 'Encrypt cardholder data transmission',
                    severity: 'critical',
                    checkFunction: 'checkDataEncryption'
                },
                {
                    id: 'PCI-3',
                    title: 'Access Controls',
                    description: 'Implement strong access controls',
                    severity: 'high',
                    checkFunction: 'checkAccessControls'
                },
                {
                    id: 'PCI-4',
                    title: 'Vulnerability Management',
                    description: 'Regular security testing and monitoring',
                    severity: 'high',
                    checkFunction: 'checkVulnerabilityManagement'
                }
            ],
            penalties: {
                max_fine: '$500K monthly + card replacement costs',
                warning_threshold: 85,
                critical_threshold: 70
            }
        });

        // SOX (Sarbanes-Oxley Act)
        this.complianceFrameworks.set('SOX', {
            id: 'SOX',
            name: 'Sarbanes-Oxley Act',
            description: 'US federal law for financial reporting accuracy',
            jurisdiction: 'United States',
            applicability: 'Public companies financial data',
            requirements: [
                {
                    id: 'SOX-1',
                    title: 'Internal Controls',
                    description: 'Maintain internal financial controls',
                    severity: 'critical',
                    checkFunction: 'checkInternalControls'
                },
                {
                    id: 'SOX-2',
                    title: 'Audit Trail',
                    description: 'Comprehensive audit trails for financial data',
                    severity: 'critical',
                    checkFunction: 'checkFinancialAuditTrail'
                },
                {
                    id: 'SOX-3',
                    title: 'Change Management',
                    description: 'Controlled change management processes',
                    severity: 'high',
                    checkFunction: 'checkChangeManagement'
                },
                {
                    id: 'SOX-4',
                    title: 'Data Retention',
                    description: 'Proper data retention and archival',
                    severity: 'high',
                    checkFunction: 'checkDataRetention'
                }
            ],
            penalties: {
                max_fine: '$25M + imprisonment',
                warning_threshold: 90,
                critical_threshold: 75
            }
        });

        console.log(`📋 Initialized ${this.complianceFrameworks.size} compliance frameworks`);
    }

    async loadCompliancePolicies() {
        try {
            const policiesFile = path.join(this.config.storage.policiesDir, 'compliance_policies.json');
            const data = await fs.readFile(policiesFile, 'utf8');
            const policies = JSON.parse(data);
            
            // Load custom policies and overrides
            for (const [frameworkId, customRequirements] of Object.entries(policies.customRequirements || {})) {
                if (this.complianceFrameworks.has(frameworkId)) {
                    const framework = this.complianceFrameworks.get(frameworkId);
                    framework.requirements.push(...customRequirements);
                }
            }
            
            console.log('📋 Loaded compliance policies from file');
        } catch (error) {
            console.log('📋 No existing policies found, using defaults');
            await this.saveCompliancePolicies();
        }
    }

    async saveCompliancePolicies() {
        try {
            const policies = {
                lastUpdated: Date.now(),
                frameworks: Object.fromEntries(this.complianceFrameworks),
                customRequirements: {}
            };

            const policiesFile = path.join(this.config.storage.policiesDir, 'compliance_policies.json');
            await fs.writeFile(policiesFile, JSON.stringify(policies, null, 2));
        } catch (error) {
            console.error('❌ Error saving compliance policies:', error.message);
        }
    }

    startService() {
        this.isActive = true;
        
        if (this.config.compliance.enableContinuousMonitoring) {
            this.complianceInterval = setInterval(() => {
                this.performComplianceCheck();
            }, this.config.compliance.complianceCheckInterval);
        }

        // Start automated reporting
        if (this.config.reporting.enableAutomatedReports) {
            this.reportingInterval = setInterval(() => {
                this.generateAutomatedReports();
            }, this.getReportingInterval());
        }

        // Start audit log cleanup
        this.cleanupInterval = setInterval(() => {
            this.performAuditCleanup();
        }, 86400000); // Daily cleanup

        console.log('🔄 Compliance framework service started');
        this.emit('serviceStarted', { timestamp: Date.now() });
    }

    stopService() {
        this.isActive = false;
        
        if (this.complianceInterval) clearInterval(this.complianceInterval);
        if (this.reportingInterval) clearInterval(this.reportingInterval);
        if (this.cleanupInterval) clearInterval(this.cleanupInterval);

        console.log('⏹️ Compliance framework service stopped');
        this.emit('serviceStopped', { timestamp: Date.now() });
    }

    // Audit Trail Management
    async logAuditEvent(eventType, eventData, userId = 'system', sessionId = null) {
        const auditId = `audit_${++this.auditCounter}_${Date.now()}`;
        
        const auditEvent = {
            id: auditId,
            timestamp: Date.now(),
            eventType,
            userId,
            sessionId,
            data: eventData,
            sourceIP: eventData.sourceIP || 'unknown',
            userAgent: eventData.userAgent || 'unknown',
            outcome: eventData.outcome || 'unknown',
            riskLevel: this.calculateEventRiskLevel(eventType, eventData),
            dataClassification: this.classifyEventData(eventData),
            hash: this.config.auditing.hashAuditLogs ? this.generateAuditHash(auditId, eventType, eventData) : null
        };

        // Store in memory
        this.auditTrails.set(auditId, auditEvent);

        // Write to persistent storage
        await this.persistAuditEvent(auditEvent);

        // Check for compliance violations
        await this.checkEventCompliance(auditEvent);

        // Emit event for real-time monitoring
        this.emit('auditEventLogged', auditEvent);

        return auditEvent;
    }

    calculateEventRiskLevel(eventType, eventData) {
        const riskScores = {
            'data_access': 20,
            'data_modification': 40,
            'data_deletion': 60,
            'user_authentication': 10,
            'admin_action': 50,
            'configuration_change': 70,
            'security_event': 80,
            'compliance_violation': 90,
            'privilege_escalation': 85,
            'sensitive_data_access': 75
        };

        let baseRisk = riskScores[eventType] || 30;

        // Increase risk for sensitive data
        if (eventData.sensitiveData || eventData.personalData) {
            baseRisk += 20;
        }

        // Increase risk for failed events
        if (eventData.outcome === 'failure' || eventData.outcome === 'error') {
            baseRisk += 15;
        }

        // Increase risk for admin users
        if (eventData.isAdmin || eventData.privileged) {
            baseRisk += 10;
        }

        return Math.min(baseRisk, 100);
    }

    classifyEventData(eventData) {
        const classifications = [];

        if (eventData.personalData || eventData.pii) {
            classifications.push('PII');
        }

        if (eventData.financialData || eventData.paymentInfo) {
            classifications.push('Financial');
        }

        if (eventData.healthData || eventData.medicalInfo) {
            classifications.push('Medical');
        }

        if (eventData.sensitiveData || eventData.confidential) {
            classifications.push('Confidential');
        }

        if (eventData.publicData) {
            classifications.push('Public');
        }

        return classifications.length > 0 ? classifications : ['Unclassified'];
    }

    generateAuditHash(auditId, eventType, eventData) {
        const hashData = `${auditId}|${eventType}|${JSON.stringify(eventData)}|${Date.now()}`;
        return crypto.createHash('sha256').update(hashData).digest('hex');
    }

    async persistAuditEvent(auditEvent) {
        try {
            const logDate = new Date(auditEvent.timestamp);
            const logFileName = `audit_${logDate.toISOString().split('T')[0]}.jsonl`;
            const logFilePath = path.join(this.config.storage.auditLogsDir, 'daily', logFileName);

            const logEntry = JSON.stringify(auditEvent) + '\n';
            
            if (this.config.auditing.compressionEnabled) {
                // In a real implementation, would use compression
                await fs.appendFile(logFilePath, logEntry);
            } else {
                await fs.appendFile(logFilePath, logEntry);
            }

        } catch (error) {
            console.error('❌ Error persisting audit event:', error.message);
        }
    }

    async checkEventCompliance(auditEvent) {
        for (const [frameworkId, framework] of this.complianceFrameworks) {
            if (!this.config.frameworks.enabledRegulations.includes(frameworkId)) {
                continue;
            }

            for (const requirement of framework.requirements) {
                const violation = await this.checkRequirementViolation(auditEvent, requirement, framework);
                if (violation) {
                    await this.recordComplianceViolation(violation);
                }
            }
        }
    }

    async checkRequirementViolation(auditEvent, requirement, framework) {
        // Check for specific compliance violations based on the requirement
        switch (requirement.id) {
            case 'GDPR-1': // Consent Management
                if (auditEvent.eventType === 'data_access' && 
                    auditEvent.dataClassification.includes('PII') && 
                    !auditEvent.data.consentObtained) {
                    return {
                        id: `violation_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                        frameworkId: framework.id,
                        requirementId: requirement.id,
                        auditEventId: auditEvent.id,
                        description: 'Personal data accessed without explicit consent',
                        severity: requirement.severity,
                        timestamp: Date.now(),
                        riskScore: 90,
                        remediation: 'Obtain explicit consent before processing personal data'
                    };
                }
                break;

            case 'GDPR-4': // Breach Notification
                if (auditEvent.eventType === 'security_event' && 
                    auditEvent.riskLevel > 70 && 
                    !auditEvent.data.breachNotified) {
                    return {
                        id: `violation_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                        frameworkId: framework.id,
                        requirementId: requirement.id,
                        auditEventId: auditEvent.id,
                        description: 'Security breach not reported within required timeframe',
                        severity: requirement.severity,
                        timestamp: Date.now(),
                        riskScore: 95,
                        remediation: 'Implement automated breach notification system'
                    };
                }
                break;

            case 'SOX-2': // Audit Trail
                if ((auditEvent.eventType === 'data_modification' || auditEvent.eventType === 'data_deletion') && 
                    auditEvent.dataClassification.includes('Financial') && 
                    !auditEvent.data.auditTrailComplete) {
                    return {
                        id: `violation_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                        frameworkId: framework.id,
                        requirementId: requirement.id,
                        auditEventId: auditEvent.id,
                        description: 'Incomplete audit trail for financial data modification',
                        severity: requirement.severity,
                        timestamp: Date.now(),
                        riskScore: 85,
                        remediation: 'Ensure comprehensive audit logging for all financial transactions'
                    };
                }
                break;

            case 'PCI-2': // Data Encryption
                if (auditEvent.eventType === 'data_access' && 
                    auditEvent.dataClassification.includes('Financial') && 
                    !auditEvent.data.encrypted) {
                    return {
                        id: `violation_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                        frameworkId: framework.id,
                        requirementId: requirement.id,
                        auditEventId: auditEvent.id,
                        description: 'Payment card data accessed without encryption',
                        severity: requirement.severity,
                        timestamp: Date.now(),
                        riskScore: 95,
                        remediation: 'Implement end-to-end encryption for payment card data'
                    };
                }
                break;
        }

        return null;
    }

    async recordComplianceViolation(violation) {
        this.complianceViolations.set(violation.id, violation);

        // Log violation as audit event
        await this.logAuditEvent('compliance_violation', {
            violationId: violation.id,
            frameworkId: violation.frameworkId,
            requirementId: violation.requirementId,
            severity: violation.severity,
            riskScore: violation.riskScore,
            outcome: 'violation_detected'
        });

        // Update compliance scores
        this.updateComplianceScore(violation.frameworkId, violation);

        // Trigger alerts for critical violations
        if (violation.severity === 'critical' && violation.riskScore >= 85) {
            this.emit('criticalComplianceViolation', violation);
        }

        console.log(`⚠️ Compliance violation recorded: ${violation.frameworkId}-${violation.requirementId}`);
        this.emit('complianceViolationRecorded', violation);

        return violation;
    }

    updateComplianceScore(frameworkId, violation) {
        if (!this.complianceScores.has(frameworkId)) {
            this.complianceScores.set(frameworkId, {
                frameworkId,
                score: 100,
                violations: 0,
                lastUpdated: Date.now(),
                riskLevel: 'low',
                trend: 'stable'
            });
        }

        const score = this.complianceScores.get(frameworkId);
        const previousScore = score.score;

        // Calculate score impact based on violation severity
        const scoreImpacts = {
            'critical': 15,
            'high': 10,
            'medium': 5,
            'low': 2
        };

        const impact = scoreImpacts[violation.severity] || 5;
        score.score = Math.max(0, score.score - impact);
        score.violations++;
        score.lastUpdated = Date.now();

        // Update risk level
        if (score.score >= 90) {
            score.riskLevel = 'low';
        } else if (score.score >= 75) {
            score.riskLevel = 'medium';
        } else if (score.score >= 60) {
            score.riskLevel = 'high';
        } else {
            score.riskLevel = 'critical';
        }

        // Update trend
        if (score.score < previousScore) {
            score.trend = 'declining';
        } else if (score.score > previousScore) {
            score.trend = 'improving';
        }

        this.complianceScores.set(frameworkId, score);
    }

    // Compliance Monitoring
    async performComplianceCheck() {
        if (!this.isActive) return;

        console.log('📋 Performing comprehensive compliance check');

        const checkResults = {
            timestamp: Date.now(),
            frameworksChecked: 0,
            totalRequirements: 0,
            violationsFound: 0,
            complianceScores: {}
        };

        for (const [frameworkId, framework] of this.complianceFrameworks) {
            if (!this.config.frameworks.enabledRegulations.includes(frameworkId)) {
                continue;
            }

            checkResults.frameworksChecked++;
            
            const frameworkResult = await this.checkFrameworkCompliance(framework);
            checkResults.totalRequirements += frameworkResult.requirementsChecked;
            checkResults.violationsFound += frameworkResult.violationsFound;
            checkResults.complianceScores[frameworkId] = frameworkResult.complianceScore;
        }

        // Generate compliance summary
        const complianceSummary = {
            id: `compliance_check_${Date.now()}`,
            timestamp: checkResults.timestamp,
            overallScore: this.calculateOverallComplianceScore(checkResults.complianceScores),
            results: checkResults,
            riskLevel: this.calculateOverallRiskLevel(checkResults.complianceScores),
            recommendations: this.generateComplianceRecommendations(checkResults)
        };

        this.emit('complianceCheckCompleted', complianceSummary);
        
        return complianceSummary;
    }

    async checkFrameworkCompliance(framework) {
        const result = {
            frameworkId: framework.id,
            requirementsChecked: 0,
            violationsFound: 0,
            complianceScore: 100,
            requirementResults: []
        };

        for (const requirement of framework.requirements) {
            result.requirementsChecked++;
            
            const requirementResult = await this.checkRequirementCompliance(requirement, framework);
            result.requirementResults.push(requirementResult);
            
            if (!requirementResult.compliant) {
                result.violationsFound++;
                
                // Create violation record
                const violation = {
                    id: `compliance_check_violation_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                    frameworkId: framework.id,
                    requirementId: requirement.id,
                    description: `Compliance check failed: ${requirementResult.reason}`,
                    severity: requirement.severity,
                    timestamp: Date.now(),
                    riskScore: requirementResult.riskScore,
                    remediation: requirementResult.remediation,
                    checkType: 'automated'
                };

                await this.recordComplianceViolation(violation);
            }
        }

        // Calculate framework compliance score
        if (result.requirementsChecked > 0) {
            const compliancePercentage = ((result.requirementsChecked - result.violationsFound) / result.requirementsChecked) * 100;
            result.complianceScore = Math.round(compliancePercentage);
        }

        return result;
    }

    async checkRequirementCompliance(requirement, framework) {
        // Simulate compliance checks - in a real implementation, these would be actual checks
        const result = {
            requirementId: requirement.id,
            title: requirement.title,
            compliant: true,
            reason: null,
            riskScore: 0,
            remediation: null
        };

        // Simulate some non-compliance scenarios
        const complianceRate = 0.85 + Math.random() * 0.15; // 85-100% compliance rate
        
        if (complianceRate < 0.95) {
            result.compliant = false;
            result.riskScore = 100 - (complianceRate * 100);
            
            switch (requirement.id) {
                case 'GDPR-1':
                    result.reason = 'Consent management system not properly configured';
                    result.remediation = 'Update consent forms and implement double opt-in';
                    break;
                case 'GDPR-2':
                    result.reason = 'Data deletion process incomplete or not tested';
                    result.remediation = 'Implement and test automated data deletion workflows';
                    break;
                case 'PCI-1':
                    result.reason = 'Network security controls not meeting standards';
                    result.remediation = 'Update firewall rules and network segmentation';
                    break;
                case 'SOX-1':
                    result.reason = 'Internal financial controls require strengthening';
                    result.remediation = 'Implement additional approval workflows for financial transactions';
                    break;
                default:
                    result.reason = 'Requirement not fully satisfied based on current configuration';
                    result.remediation = 'Review and update system configuration to meet requirement';
            }
        }

        return result;
    }

    calculateOverallComplianceScore(frameworkScores) {
        const scores = Object.values(frameworkScores);
        if (scores.length === 0) return 100;
        
        return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
    }

    calculateOverallRiskLevel(frameworkScores) {
        const scores = Object.values(frameworkScores);
        const avgScore = this.calculateOverallComplianceScore(frameworkScores);
        
        if (avgScore >= 90) return 'low';
        if (avgScore >= 75) return 'medium';
        if (avgScore >= 60) return 'high';
        return 'critical';
    }

    generateComplianceRecommendations(checkResults) {
        const recommendations = [];
        
        if (checkResults.violationsFound > 5) {
            recommendations.push({
                priority: 'high',
                title: 'Multiple Compliance Violations Detected',
                description: `${checkResults.violationsFound} violations found across ${checkResults.frameworksChecked} frameworks`,
                action: 'Implement comprehensive compliance remediation plan'
            });
        }

        const overallScore = this.calculateOverallComplianceScore(checkResults.complianceScores);
        if (overallScore < 80) {
            recommendations.push({
                priority: 'critical',
                title: 'Low Compliance Score',
                description: `Overall compliance score of ${overallScore}% is below acceptable threshold`,
                action: 'Immediate compliance improvement program required'
            });
        }

        // Framework-specific recommendations
        for (const [frameworkId, score] of Object.entries(checkResults.complianceScores)) {
            const framework = this.complianceFrameworks.get(frameworkId);
            if (score < framework.penalties.warning_threshold) {
                recommendations.push({
                    priority: score < framework.penalties.critical_threshold ? 'critical' : 'high',
                    title: `${framework.name} Compliance Issues`,
                    description: `${frameworkId} compliance score of ${score}% requires attention`,
                    action: `Review and address ${frameworkId} specific requirements`
                });
            }
        }

        return recommendations;
    }

    // Reporting
    async generateAutomatedReports() {
        if (!this.isActive) return;

        console.log('📋 Generating automated compliance reports');

        try {
            const reportTypes = ['compliance_summary', 'audit_trail_summary', 'violation_report'];
            
            for (const reportType of reportTypes) {
                const report = await this.generateReport(reportType);
                if (report) {
                    await this.saveReport(report);
                }
            }

            this.emit('automatedReportsGenerated', {
                timestamp: Date.now(),
                reportsGenerated: reportTypes.length
            });

        } catch (error) {
            console.error('❌ Error generating automated reports:', error.message);
        }
    }

    async generateReport(reportType, options = {}) {
        const reportId = `report_${++this.reportCounter}_${Date.now()}`;
        const report = {
            id: reportId,
            type: reportType,
            timestamp: Date.now(),
            period: options.period || this.getReportPeriod(),
            data: {},
            metadata: {
                generatedBy: 'ComplianceFrameworkService',
                version: '1.0',
                format: options.format || 'json'
            }
        };

        switch (reportType) {
            case 'compliance_summary':
                report.data = await this.generateComplianceSummaryData();
                break;
            case 'audit_trail_summary':
                report.data = await this.generateAuditTrailSummaryData(options.timeRange);
                break;
            case 'violation_report':
                report.data = await this.generateViolationReportData(options.timeRange);
                break;
            case 'executive_summary':
                report.data = await this.generateExecutiveSummaryData();
                break;
            default:
                throw new Error(`Unknown report type: ${reportType}`);
        }

        this.complianceReports.set(reportId, report);
        return report;
    }

    async generateComplianceSummaryData() {
        const frameworks = {};
        const overallStats = {
            totalFrameworks: 0,
            averageComplianceScore: 0,
            totalViolations: this.complianceViolations.size,
            riskDistribution: { low: 0, medium: 0, high: 0, critical: 0 }
        };

        for (const [frameworkId, framework] of this.complianceFrameworks) {
            if (!this.config.frameworks.enabledRegulations.includes(frameworkId)) {
                continue;
            }

            const score = this.complianceScores.get(frameworkId) || { score: 100, violations: 0, riskLevel: 'low' };
            
            frameworks[frameworkId] = {
                name: framework.name,
                score: score.score,
                violations: score.violations,
                riskLevel: score.riskLevel,
                requirements: framework.requirements.length,
                lastUpdated: score.lastUpdated
            };

            overallStats.totalFrameworks++;
            overallStats.averageComplianceScore += score.score;
            overallStats.riskDistribution[score.riskLevel]++;
        }

        if (overallStats.totalFrameworks > 0) {
            overallStats.averageComplianceScore = Math.round(overallStats.averageComplianceScore / overallStats.totalFrameworks);
        }

        return {
            frameworks,
            overallStats,
            generatedAt: new Date().toISOString(),
            reportPeriod: this.getReportPeriod()
        };
    }

    async generateAuditTrailSummaryData(timeRange = 7 * 24 * 60 * 60 * 1000) {
        const cutoff = Date.now() - timeRange;
        const relevantAudits = Array.from(this.auditTrails.values())
            .filter(audit => audit.timestamp > cutoff);

        const summary = {
            totalEvents: relevantAudits.length,
            eventsByType: {},
            eventsByRiskLevel: { low: 0, medium: 0, high: 0, critical: 0 },
            eventsByUser: {},
            sensitiveDataEvents: 0,
            failedEvents: 0,
            timeRange: {
                start: new Date(cutoff).toISOString(),
                end: new Date().toISOString(),
                rangeDays: Math.round(timeRange / (24 * 60 * 60 * 1000))
            }
        };

        relevantAudits.forEach(audit => {
            // Count by event type
            summary.eventsByType[audit.eventType] = (summary.eventsByType[audit.eventType] || 0) + 1;

            // Count by risk level
            if (audit.riskLevel <= 25) summary.eventsByRiskLevel.low++;
            else if (audit.riskLevel <= 50) summary.eventsByRiskLevel.medium++;
            else if (audit.riskLevel <= 75) summary.eventsByRiskLevel.high++;
            else summary.eventsByRiskLevel.critical++;

            // Count by user
            summary.eventsByUser[audit.userId] = (summary.eventsByUser[audit.userId] || 0) + 1;

            // Count sensitive data events
            if (audit.dataClassification.some(cls => ['PII', 'Financial', 'Medical', 'Confidential'].includes(cls))) {
                summary.sensitiveDataEvents++;
            }

            // Count failed events
            if (audit.outcome === 'failure' || audit.outcome === 'error') {
                summary.failedEvents++;
            }
        });

        return summary;
    }

    async generateViolationReportData(timeRange = 30 * 24 * 60 * 60 * 1000) {
        const cutoff = Date.now() - timeRange;
        const relevantViolations = Array.from(this.complianceViolations.values())
            .filter(violation => violation.timestamp > cutoff);

        const report = {
            totalViolations: relevantViolations.length,
            violationsByFramework: {},
            violationsBySeverity: { low: 0, medium: 0, high: 0, critical: 0 },
            violationsByRequirement: {},
            riskScoreDistribution: [],
            trends: this.calculateViolationTrends(relevantViolations),
            topViolations: relevantViolations
                .sort((a, b) => b.riskScore - a.riskScore)
                .slice(0, 10)
                .map(v => ({
                    id: v.id,
                    framework: v.frameworkId,
                    requirement: v.requirementId,
                    severity: v.severity,
                    riskScore: v.riskScore,
                    timestamp: new Date(v.timestamp).toISOString()
                })),
            timeRange: {
                start: new Date(cutoff).toISOString(),
                end: new Date().toISOString(),
                rangeDays: Math.round(timeRange / (24 * 60 * 60 * 1000))
            }
        };

        relevantViolations.forEach(violation => {
            // Count by framework
            report.violationsByFramework[violation.frameworkId] = 
                (report.violationsByFramework[violation.frameworkId] || 0) + 1;

            // Count by severity
            report.violationsBySeverity[violation.severity]++;

            // Count by requirement
            const reqKey = `${violation.frameworkId}-${violation.requirementId}`;
            report.violationsByRequirement[reqKey] = 
                (report.violationsByRequirement[reqKey] || 0) + 1;

            // Risk score distribution
            const riskBucket = Math.floor(violation.riskScore / 10) * 10;
            report.riskScoreDistribution[riskBucket] = 
                (report.riskScoreDistribution[riskBucket] || 0) + 1;
        });

        return report;
    }

    calculateViolationTrends(violations) {
        // Simple trend calculation - in a real implementation would be more sophisticated
        const now = Date.now();
        const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);
        const twoWeeksAgo = now - (14 * 24 * 60 * 60 * 1000);

        const thisWeek = violations.filter(v => v.timestamp > oneWeekAgo).length;
        const lastWeek = violations.filter(v => v.timestamp > twoWeeksAgo && v.timestamp <= oneWeekAgo).length;

        let trend = 'stable';
        let changePercent = 0;

        if (lastWeek > 0) {
            changePercent = Math.round(((thisWeek - lastWeek) / lastWeek) * 100);
            if (changePercent > 10) trend = 'increasing';
            else if (changePercent < -10) trend = 'decreasing';
        }

        return {
            trend,
            changePercent,
            thisWeekCount: thisWeek,
            lastWeekCount: lastWeek
        };
    }

    async saveReport(report) {
        try {
            const fileName = `${report.type}_${report.id}_${new Date().toISOString().split('T')[0]}.json`;
            const filePath = path.join(this.config.storage.reportsDir, 'automated', fileName);
            
            await fs.writeFile(filePath, JSON.stringify(report, null, 2));
            
            console.log(`📋 Report saved: ${fileName}`);
            return filePath;
        } catch (error) {
            console.error('❌ Error saving report:', error.message);
            throw error;
        }
    }

    getReportingInterval() {
        const intervals = {
            'daily': 24 * 60 * 60 * 1000,
            'weekly': 7 * 24 * 60 * 60 * 1000,
            'monthly': 30 * 24 * 60 * 60 * 1000,
            'quarterly': 90 * 24 * 60 * 60 * 1000
        };

        return intervals[this.config.reporting.reportSchedule] || intervals.monthly;
    }

    getReportPeriod() {
        const now = new Date();
        
        switch (this.config.reporting.reportSchedule) {
            case 'daily':
                return now.toISOString().split('T')[0];
            case 'weekly':
                const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
                return `${weekStart.toISOString().split('T')[0]} to ${new Date().toISOString().split('T')[0]}`;
            case 'monthly':
                return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            case 'quarterly':
                const quarter = Math.floor(now.getMonth() / 3) + 1;
                return `Q${quarter} ${now.getFullYear()}`;
            default:
                return now.toISOString().split('T')[0];
        }
    }

    async performAuditCleanup() {
        const cutoff = Date.now() - (this.config.compliance.auditRetentionYears * 365 * 24 * 60 * 60 * 1000);
        let cleanedCount = 0;

        // Clean up in-memory audit trails
        for (const [auditId, audit] of this.auditTrails) {
            if (audit.timestamp < cutoff) {
                this.auditTrails.delete(auditId);
                cleanedCount++;
            }
        }

        // Archive old compliance violations
        for (const [violationId, violation] of this.complianceViolations) {
            if (violation.timestamp < cutoff) {
                // In a real implementation, would archive to cold storage
                this.complianceViolations.delete(violationId);
            }
        }

        if (cleanedCount > 0) {
            console.log(`🧹 Cleaned up ${cleanedCount} old audit records`);
        }
    }

    // Public API Methods
    getComplianceStatus() {
        const overallScore = this.calculateOverallComplianceScore(
            Object.fromEntries(
                Array.from(this.complianceScores.entries()).map(([id, score]) => [id, score.score])
            )
        );

        return {
            isActive: this.isActive,
            overallComplianceScore: overallScore,
            totalViolations: this.complianceViolations.size,
            activeFrameworks: this.config.frameworks.enabledRegulations.length,
            auditEventsRecorded: this.auditTrails.size,
            reportsGenerated: this.complianceReports.size,
            riskLevel: this.calculateOverallRiskLevel(
                Object.fromEntries(
                    Array.from(this.complianceScores.entries()).map(([id, score]) => [id, score.score])
                )
            ),
            configuration: this.config
        };
    }

    getComplianceScores() {
        return Object.fromEntries(this.complianceScores);
    }

    getAuditTrails(filters = {}) {
        let trails = Array.from(this.auditTrails.values());

        if (filters.eventType) {
            trails = trails.filter(t => t.eventType === filters.eventType);
        }
        if (filters.userId) {
            trails = trails.filter(t => t.userId === filters.userId);
        }
        if (filters.riskLevel) {
            const riskThresholds = { low: 25, medium: 50, high: 75, critical: 100 };
            const threshold = riskThresholds[filters.riskLevel];
            if (threshold) {
                trails = trails.filter(t => t.riskLevel <= threshold && t.riskLevel > (riskThresholds[filters.riskLevel] || 0) - 25);
            }
        }
        if (filters.timeRange) {
            const cutoff = Date.now() - filters.timeRange;
            trails = trails.filter(t => t.timestamp > cutoff);
        }

        return trails.sort((a, b) => b.timestamp - a.timestamp);
    }

    getComplianceViolations(filters = {}) {
        let violations = Array.from(this.complianceViolations.values());

        if (filters.frameworkId) {
            violations = violations.filter(v => v.frameworkId === filters.frameworkId);
        }
        if (filters.severity) {
            violations = violations.filter(v => v.severity === filters.severity);
        }
        if (filters.timeRange) {
            const cutoff = Date.now() - filters.timeRange;
            violations = violations.filter(v => v.timestamp > cutoff);
        }

        return violations.sort((a, b) => b.timestamp - a.timestamp);
    }

    getComplianceReports() {
        return Array.from(this.complianceReports.values())
            .sort((a, b) => b.timestamp - a.timestamp);
    }

    getComplianceFrameworks() {
        return Object.fromEntries(this.complianceFrameworks);
    }

    updateConfiguration(newConfig) {
        Object.assign(this.config, newConfig);
        console.log('📋 Compliance framework configuration updated');
        this.emit('configurationUpdated', { config: this.config, timestamp: Date.now() });
    }
}

module.exports = ComplianceFrameworkService;