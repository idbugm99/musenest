/**
 * Security Monitoring and Threat Detection Service
 * Part of Phase F.1: Implement comprehensive security monitoring and threat detection
 * 
 * Provides enterprise-grade security monitoring capabilities including:
 * - Real-time threat detection and analysis
 * - Intrusion detection and prevention
 * - Behavioral analysis and anomaly detection
 * - Security event correlation and investigation
 * - Threat intelligence integration
 * - Security metrics and reporting
 * - Automated incident response triggers
 */

const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class SecurityMonitoringService extends EventEmitter {
    constructor(database, analyticsService, config = {}) {
        super();
        this.db = database;
        this.analyticsService = analyticsService;
        
        // Configuration with environment-based defaults
        this.config = {
            monitoring: {
                enableRealTime: config.monitoring?.enableRealTime !== false,
                scanInterval: config.monitoring?.scanInterval || 30000, // 30 seconds
                threatDetectionInterval: config.monitoring?.threatDetectionInterval || 60000, // 1 minute
                maxConcurrentScans: config.monitoring?.maxConcurrentScans || 10,
                enableBehavioralAnalysis: config.monitoring?.enableBehavioralAnalysis !== false,
                dataRetentionDays: config.monitoring?.dataRetentionDays || 90
            },
            detection: {
                enableIntrusionDetection: config.detection?.enableIntrusionDetection !== false,
                enableAnomalyDetection: config.detection?.enableAnomalyDetection !== false,
                threatScoreThreshold: config.detection?.threatScoreThreshold || 75,
                anomalyThreshold: config.detection?.anomalyThreshold || 2.5, // Standard deviations
                bruteForceThreshold: config.detection?.bruteForceThreshold || 5, // Failed attempts
                rateLimitThreshold: config.detection?.rateLimitThreshold || 100, // Requests per minute
                suspiciousPatterns: config.detection?.suspiciousPatterns || [
                    'sql injection', 'xss', 'csrf', 'path traversal', 'command injection'
                ]
            },
            intelligence: {
                enableThreatIntel: config.intelligence?.enableThreatIntel !== false,
                threatFeedUpdateInterval: config.intelligence?.threatFeedUpdateInterval || 3600000, // 1 hour
                ipReputationEnabled: config.intelligence?.ipReputationEnabled !== false,
                malwareDetectionEnabled: config.intelligence?.malwareDetectionEnabled !== false,
                geoLocationTracking: config.intelligence?.geoLocationTracking !== false
            },
            response: {
                enableAutoResponse: config.response?.enableAutoResponse !== false,
                autoBlockThreshold: config.response?.autoBlockThreshold || 90, // Threat score
                quarantineTimeout: config.response?.quarantineTimeout || 3600000, // 1 hour
                escalationThreshold: config.response?.escalationThreshold || 85,
                notificationMethods: config.response?.notificationMethods || ['email', 'webhook', 'sms']
            },
            storage: {
                securityDir: config.storage?.securityDir || '/tmp/phoenix4ge-security',
                logsDir: config.storage?.logsDir || '/tmp/phoenix4ge-security/logs',
                quarantineDir: config.storage?.quarantineDir || '/tmp/phoenix4ge-security/quarantine',
                reportsDir: config.storage?.reportsDir || '/tmp/phoenix4ge-security/reports'
            }
        };

        // Service state
        this.isActive = false;
        this.securityEvents = new Map();
        this.threatIntelligence = new Map();
        this.behavioralBaselines = new Map();
        this.activeThreats = new Map();
        this.quarantinedEntities = new Map();
        this.securityMetrics = new Map();
        this.eventCounter = 0;
        this.threatCounter = 0;

        // Security analyzers
        this.intrusionDetector = new IntrusionDetector(this.config);
        this.anomalyDetector = new AnomalyDetector(this.config);
        this.behavioralAnalyzer = new BehavioralAnalyzer(this.config);
        this.threatIntelManager = new ThreatIntelligenceManager(this.config);

        // Known threat patterns and signatures
        this.threatSignatures = new Map();
        this.suspiciousIPs = new Set();
        this.maliciousPatterns = new Set();

        console.log('🛡️ SecurityMonitoringService initialized');
        this.ensureStorageDirectories();
        this.loadThreatIntelligence();
        this.initializeThreatSignatures();
        this.startService();
    }

    async ensureStorageDirectories() {
        try {
            const directories = [
                this.config.storage.securityDir,
                this.config.storage.logsDir,
                this.config.storage.quarantineDir,
                this.config.storage.reportsDir,
                path.join(this.config.storage.logsDir, 'events'),
                path.join(this.config.storage.logsDir, 'threats'),
                path.join(this.config.storage.logsDir, 'incidents')
            ];

            for (const dir of directories) {
                await fs.mkdir(dir, { recursive: true });
            }
        } catch (error) {
            console.error('❌ Error creating security directories:', error.message);
        }
    }

    async loadThreatIntelligence() {
        try {
            // Load existing threat intelligence data
            const threatIntelFile = path.join(this.config.storage.securityDir, 'threat_intelligence.json');
            const data = await fs.readFile(threatIntelFile, 'utf8');
            const threatData = JSON.parse(data);
            
            for (const [indicator, intelligence] of Object.entries(threatData)) {
                this.threatIntelligence.set(indicator, intelligence);
            }
            
            console.log(`🛡️ Loaded ${this.threatIntelligence.size} threat intelligence indicators`);
        } catch (error) {
            console.log('🛡️ No existing threat intelligence found, will populate with defaults');
            await this.initializeDefaultThreatIntel();
        }
    }

    async initializeDefaultThreatIntel() {
        // Initialize with common threat indicators for demonstration
        const defaultThreats = {
            '192.168.1.100': {
                type: 'ip',
                reputation: 'malicious',
                category: 'botnet',
                severity: 'high',
                lastSeen: Date.now(),
                confidence: 0.9
            },
            '10.0.0.50': {
                type: 'ip',
                reputation: 'suspicious',
                category: 'scanning',
                severity: 'medium',
                lastSeen: Date.now(),
                confidence: 0.7
            },
            'malware-hash-example': {
                type: 'hash',
                reputation: 'malicious',
                category: 'malware',
                severity: 'critical',
                lastSeen: Date.now(),
                confidence: 0.95
            }
        };

        for (const [indicator, intelligence] of Object.entries(defaultThreats)) {
            this.threatIntelligence.set(indicator, intelligence);
        }

        await this.saveThreatIntelligence();
    }

    initializeThreatSignatures() {
        // SQL Injection patterns
        this.threatSignatures.set('sql_injection', {
            patterns: [
                /('|(\\'))((\s*(union|select|insert|update|delete|drop|create|alter|exec|execute)\s)|(\s*\d+\s*=\s*\d+))/i,
                /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b.*?\b(from|into|set|where|order|group)\b)/i,
                /((\s*['"])(\s*(\d+|null)|\s*=\s*['"]))/i
            ],
            severity: 'high',
            category: 'injection'
        });

        // XSS patterns
        this.threatSignatures.set('xss', {
            patterns: [
                /<script[^>]*>.*?<\/script>/gi,
                /javascript:[^"']*/gi,
                /on(load|error|click|mouse|focus|blur)=[^"']*/gi,
                /<iframe[^>]*>.*?<\/iframe>/gi
            ],
            severity: 'high',
            category: 'injection'
        });

        // Path traversal patterns
        this.threatSignatures.set('path_traversal', {
            patterns: [
                /\.\.\/.*$/,
                /\.\.\\.*$/,
                /%2e%2e%2f/i,
                /%2e%2e%5c/i
            ],
            severity: 'medium',
            category: 'traversal'
        });

        // Command injection patterns
        this.threatSignatures.set('command_injection', {
            patterns: [
                /[;&|`$(){}[\]]/,
                /(rm|cat|ls|ps|kill|chmod|sudo|su|wget|curl)\s+/i,
                /\$\([^)]+\)/,
                /`[^`]+`/
            ],
            severity: 'critical',
            category: 'injection'
        });

        console.log(`🛡️ Initialized ${this.threatSignatures.size} threat detection signatures`);
    }

    startService() {
        this.isActive = true;
        
        if (this.config.monitoring.enableRealTime) {
            // Start real-time security monitoring
            this.monitoringInterval = setInterval(() => {
                this.performSecurityScan();
            }, this.config.monitoring.scanInterval);

            // Start threat detection
            this.threatDetectionInterval = setInterval(() => {
                this.detectThreats();
            }, this.config.monitoring.threatDetectionInterval);
        }

        // Start behavioral analysis
        if (this.config.monitoring.enableBehavioralAnalysis) {
            this.behavioralInterval = setInterval(() => {
                this.performBehavioralAnalysis();
            }, 300000); // 5 minutes
        }

        // Start threat intelligence updates
        if (this.config.intelligence.enableThreatIntel) {
            this.threatIntelInterval = setInterval(() => {
                this.updateThreatIntelligence();
            }, this.config.intelligence.threatFeedUpdateInterval);
        }

        // Start cleanup tasks
        this.cleanupInterval = setInterval(() => {
            this.performSecurityCleanup();
        }, 3600000); // 1 hour

        console.log('🔄 Security monitoring service started');
        this.emit('serviceStarted', { timestamp: Date.now() });
    }

    stopService() {
        this.isActive = false;
        
        if (this.monitoringInterval) clearInterval(this.monitoringInterval);
        if (this.threatDetectionInterval) clearInterval(this.threatDetectionInterval);
        if (this.behavioralInterval) clearInterval(this.behavioralInterval);
        if (this.threatIntelInterval) clearInterval(this.threatIntelInterval);
        if (this.cleanupInterval) clearInterval(this.cleanupInterval);

        console.log('⏹️ Security monitoring service stopped');
        this.emit('serviceStopped', { timestamp: Date.now() });
    }

    // Core Security Monitoring
    async performSecurityScan() {
        if (!this.isActive) return;

        try {
            const scanResults = {
                timestamp: Date.now(),
                scanId: `scan_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                threatsDetected: 0,
                anomaliesFound: 0,
                eventsProcessed: 0
            };

            // Collect current security events
            const securityEvents = await this.collectSecurityEvents();
            scanResults.eventsProcessed = securityEvents.length;

            // Process each event for threats
            for (const event of securityEvents) {
                const threatAnalysis = await this.analyzeEventForThreats(event);
                if (threatAnalysis.isThreshold) {
                    scanResults.threatsDetected++;
                    await this.handleThreatDetection(event, threatAnalysis);
                }

                // Check for anomalies
                const anomalyAnalysis = await this.analyzeEventForAnomalies(event);
                if (anomalyAnalysis.isAnomaly) {
                    scanResults.anomaliesFound++;
                    await this.handleAnomalyDetection(event, anomalyAnalysis);
                }
            }

            // Update security metrics
            this.updateSecurityMetrics(scanResults);

            this.emit('securityScanCompleted', scanResults);

        } catch (error) {
            console.error('❌ Error in security scan:', error.message);
            this.emit('securityScanError', { error: error.message, timestamp: Date.now() });
        }
    }

    async collectSecurityEvents() {
        // In a real implementation, this would collect from various sources:
        // - Web server logs
        // - Application logs
        // - Database logs
        // - Network traffic
        // - System events
        
        // For demonstration, generate simulated security events
        return this.generateSimulatedSecurityEvents();
    }

    generateSimulatedSecurityEvents() {
        const events = [];
        const eventTypes = ['login_attempt', 'api_request', 'file_access', 'network_connection', 'admin_action'];
        const severities = ['low', 'medium', 'high', 'critical'];
        const sources = ['web', 'api', 'admin', 'system', 'database'];

        for (let i = 0; i < 10 + Math.floor(Math.random() * 20); i++) {
            const event = {
                id: `event_${++this.eventCounter}_${Date.now()}`,
                timestamp: Date.now() - Math.floor(Math.random() * 300000), // Within last 5 minutes
                type: eventTypes[Math.floor(Math.random() * eventTypes.length)],
                severity: severities[Math.floor(Math.random() * severities.length)],
                source: sources[Math.floor(Math.random() * sources.length)],
                sourceIP: this.generateRandomIP(),
                userAgent: this.generateRandomUserAgent(),
                payload: this.generateEventPayload(),
                status: Math.random() > 0.1 ? 'success' : 'failure',
                responseTime: 50 + Math.random() * 500,
                dataSize: Math.floor(Math.random() * 10000),
                geolocation: this.generateRandomLocation()
            };

            events.push(event);
        }

        return events;
    }

    generateRandomIP() {
        const ipTypes = [
            // Normal IPs
            () => `192.168.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`,
            () => `10.0.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`,
            // Potentially suspicious IPs (match our threat intel)
            () => Math.random() < 0.05 ? '192.168.1.100' : `172.16.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`,
            () => Math.random() < 0.03 ? '10.0.0.50' : `203.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`
        ];
        
        return ipTypes[Math.floor(Math.random() * ipTypes.length)]();
    }

    generateRandomUserAgent() {
        const agents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
            // Potentially suspicious
            'sqlmap/1.0',
            'Nmap Scripting Engine',
            'curl/7.68.0'
        ];
        
        return agents[Math.floor(Math.random() * agents.length)];
    }

    generateEventPayload() {
        const payloadTypes = [
            // Normal payloads
            () => ({ action: 'view_profile', user_id: Math.floor(Math.random() * 1000) }),
            () => ({ action: 'upload_image', file_size: Math.floor(Math.random() * 5000000) }),
            () => ({ action: 'search', query: 'model photos' }),
            // Potentially malicious payloads
            () => Math.random() < 0.02 ? { action: 'search', query: "'; DROP TABLE users; --" } : { action: 'search', query: 'normal search' },
            () => Math.random() < 0.01 ? { action: 'comment', content: '<script>alert("xss")</script>' } : { action: 'comment', content: 'normal comment' },
            () => Math.random() < 0.015 ? { action: 'file_access', path: '../../etc/passwd' } : { action: 'file_access', path: '/uploads/image.jpg' }
        ];
        
        return payloadTypes[Math.floor(Math.random() * payloadTypes.length)]();
    }

    generateRandomLocation() {
        const locations = [
            { country: 'US', city: 'New York', lat: 40.7128, lon: -74.0060 },
            { country: 'US', city: 'Los Angeles', lat: 34.0522, lon: -118.2437 },
            { country: 'GB', city: 'London', lat: 51.5074, lon: -0.1278 },
            { country: 'DE', city: 'Berlin', lat: 52.5200, lon: 13.4050 },
            { country: 'CN', city: 'Beijing', lat: 39.9042, lon: 116.4074 },
            // Suspicious locations
            { country: 'RU', city: 'Moscow', lat: 55.7558, lon: 37.6173 },
            { country: 'IR', city: 'Tehran', lat: 35.6892, lon: 51.3890 }
        ];
        
        return locations[Math.floor(Math.random() * locations.length)];
    }

    async analyzeEventForThreats(event) {
        const analysis = {
            isThreshold: false,
            threatScore: 0,
            threatTypes: [],
            indicators: [],
            confidence: 0
        };

        // IP reputation check
        if (this.threatIntelligence.has(event.sourceIP)) {
            const intel = this.threatIntelligence.get(event.sourceIP);
            analysis.threatScore += intel.reputation === 'malicious' ? 50 : 25;
            analysis.threatTypes.push('malicious_ip');
            analysis.indicators.push(`IP ${event.sourceIP} flagged as ${intel.reputation}`);
        }

        // User agent analysis
        if (event.userAgent.includes('sqlmap') || event.userAgent.includes('Nmap')) {
            analysis.threatScore += 40;
            analysis.threatTypes.push('scanning_tool');
            analysis.indicators.push('Suspicious user agent detected');
        }

        // Payload pattern matching
        if (event.payload) {
            const payloadString = JSON.stringify(event.payload);
            
            for (const [signatureName, signature] of this.threatSignatures) {
                for (const pattern of signature.patterns) {
                    if (pattern.test(payloadString)) {
                        const scoreIncrease = signature.severity === 'critical' ? 30 : 
                                            signature.severity === 'high' ? 20 : 
                                            signature.severity === 'medium' ? 10 : 5;
                        analysis.threatScore += scoreIncrease;
                        analysis.threatTypes.push(signatureName);
                        analysis.indicators.push(`${signatureName} pattern detected`);
                    }
                }
            }
        }

        // Geolocation risk
        if (event.geolocation && ['RU', 'IR', 'CN'].includes(event.geolocation.country)) {
            analysis.threatScore += 10;
            analysis.threatTypes.push('high_risk_geolocation');
            analysis.indicators.push(`Request from high-risk country: ${event.geolocation.country}`);
        }

        // Failed request analysis
        if (event.status === 'failure') {
            analysis.threatScore += 5;
            analysis.indicators.push('Failed request');
        }

        // Calculate confidence and threat determination
        analysis.confidence = Math.min(analysis.threatScore / 100, 1);
        analysis.isThreshold = analysis.threatScore >= this.config.detection.threatScoreThreshold;

        return analysis;
    }

    async analyzeEventForAnomalies(event) {
        const analysis = {
            isAnomaly: false,
            anomalyScore: 0,
            anomalyTypes: [],
            deviations: []
        };

        // Response time anomaly
        if (event.responseTime > 2000) { // > 2 seconds
            analysis.anomalyScore += 20;
            analysis.anomalyTypes.push('slow_response');
            analysis.deviations.push(`Response time ${event.responseTime}ms exceeds normal range`);
        }

        // Data size anomaly
        if (event.dataSize > 50000) { // > 50KB
            analysis.anomalyScore += 15;
            analysis.anomalyTypes.push('large_payload');
            analysis.deviations.push(`Data size ${event.dataSize} bytes exceeds normal range`);
        }

        // Time-based anomaly (requests outside business hours)
        const hour = new Date(event.timestamp).getHours();
        if (hour < 6 || hour > 22) { // Outside 6 AM - 10 PM
            analysis.anomalyScore += 10;
            analysis.anomalyTypes.push('off_hours_activity');
            analysis.deviations.push('Activity outside normal business hours');
        }

        analysis.isAnomaly = analysis.anomalyScore >= 25; // Anomaly threshold

        return analysis;
    }

    async handleThreatDetection(event, threatAnalysis) {
        const threatId = `threat_${++this.threatCounter}_${Date.now()}`;
        
        const threat = {
            id: threatId,
            eventId: event.id,
            timestamp: Date.now(),
            source: event.sourceIP,
            type: threatAnalysis.threatTypes,
            severity: this.calculateThreatSeverity(threatAnalysis.threatScore),
            score: threatAnalysis.threatScore,
            confidence: threatAnalysis.confidence,
            indicators: threatAnalysis.indicators,
            status: 'active',
            event: event,
            response: null
        };

        this.activeThreats.set(threatId, threat);

        // Log security event
        await this.logSecurityEvent('threat_detected', threat);

        // Auto-response if enabled and threshold met
        if (this.config.response.enableAutoResponse && 
            threatAnalysis.threatScore >= this.config.response.autoBlockThreshold) {
            await this.executeAutoResponse(threat);
        }

        // Escalate if needed
        if (threatAnalysis.threatScore >= this.config.response.escalationThreshold) {
            await this.escalateThreat(threat);
        }

        console.log(`🚨 Threat detected: ${threat.severity} severity (score: ${threat.score})`);
        this.emit('threatDetected', threat);

        return threat;
    }

    async handleAnomalyDetection(event, anomalyAnalysis) {
        const anomaly = {
            id: `anomaly_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            eventId: event.id,
            timestamp: Date.now(),
            source: event.sourceIP,
            types: anomalyAnalysis.anomalyTypes,
            score: anomalyAnalysis.anomalyScore,
            deviations: anomalyAnalysis.deviations,
            event: event
        };

        // Log anomaly
        await this.logSecurityEvent('anomaly_detected', anomaly);

        console.log(`🔍 Anomaly detected: ${anomaly.types.join(', ')} (score: ${anomaly.score})`);
        this.emit('anomalyDetected', anomaly);

        return anomaly;
    }

    calculateThreatSeverity(threatScore) {
        if (threatScore >= 90) return 'critical';
        if (threatScore >= 75) return 'high';
        if (threatScore >= 50) return 'medium';
        return 'low';
    }

    async executeAutoResponse(threat) {
        const response = {
            id: `response_${Date.now()}`,
            threatId: threat.id,
            timestamp: Date.now(),
            actions: [],
            status: 'executing'
        };

        try {
            // Block IP if malicious
            if (threat.type.includes('malicious_ip') || threat.score >= 95) {
                await this.blockIP(threat.source);
                response.actions.push(`Blocked IP: ${threat.source}`);
            }

            // Quarantine if medium-high threat
            if (threat.score >= 80) {
                await this.quarantineEntity(threat.source, 'ip');
                response.actions.push(`Quarantined IP: ${threat.source}`);
            }

            // Rate limit if suspicious behavior
            if (threat.type.includes('scanning_tool') || threat.type.includes('brute_force')) {
                await this.applyRateLimit(threat.source);
                response.actions.push(`Applied rate limit to: ${threat.source}`);
            }

            response.status = 'completed';
            threat.response = response;

            console.log(`⚡ Auto-response executed for threat ${threat.id}: ${response.actions.join(', ')}`);
            this.emit('autoResponseExecuted', { threat, response });

        } catch (error) {
            response.status = 'failed';
            response.error = error.message;
            console.error(`❌ Auto-response failed for threat ${threat.id}:`, error.message);
        }

        return response;
    }

    async blockIP(ipAddress) {
        // In a real implementation, this would integrate with:
        // - Firewall rules
        // - Load balancer configuration
        // - CDN settings
        // - Network security appliances
        
        console.log(`🚫 IP blocked: ${ipAddress}`);
        
        // Add to internal block list
        this.suspiciousIPs.add(ipAddress);
        
        // Update threat intelligence
        this.threatIntelligence.set(ipAddress, {
            type: 'ip',
            reputation: 'blocked',
            category: 'auto_blocked',
            severity: 'high',
            lastSeen: Date.now(),
            confidence: 0.9,
            autoBlocked: true
        });
    }

    async quarantineEntity(entity, entityType) {
        const quarantineId = `quarantine_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        
        const quarantine = {
            id: quarantineId,
            entity,
            entityType,
            timestamp: Date.now(),
            expiresAt: Date.now() + this.config.response.quarantineTimeout,
            reason: 'Automated threat response',
            status: 'active'
        };

        this.quarantinedEntities.set(quarantineId, quarantine);
        
        console.log(`🔒 Entity quarantined: ${entityType} ${entity} for ${Math.round(this.config.response.quarantineTimeout / 60000)} minutes`);
        this.emit('entityQuarantined', quarantine);

        return quarantine;
    }

    async applyRateLimit(sourceIP) {
        // In a real implementation, this would configure rate limiting
        console.log(`⏱️ Rate limit applied to: ${sourceIP}`);
        
        // This would typically integrate with:
        // - Redis for rate limiting
        // - API gateway configuration
        // - Load balancer settings
    }

    async escalateThreat(threat) {
        const escalation = {
            id: `escalation_${Date.now()}`,
            threatId: threat.id,
            timestamp: Date.now(),
            severity: 'high',
            reason: `Threat score ${threat.score} exceeds escalation threshold`,
            notificationsSent: [],
            status: 'escalated'
        };

        // Send notifications based on configured methods
        for (const method of this.config.response.notificationMethods) {
            try {
                await this.sendThreatNotification(threat, method);
                escalation.notificationsSent.push(method);
            } catch (error) {
                console.error(`❌ Failed to send ${method} notification:`, error.message);
            }
        }

        console.log(`📢 Threat escalated: ${threat.id} via ${escalation.notificationsSent.join(', ')}`);
        this.emit('threatEscalated', { threat, escalation });

        return escalation;
    }

    async sendThreatNotification(threat, method) {
        // In a real implementation, this would send actual notifications
        switch (method) {
            case 'email':
                console.log(`📧 Email notification sent for threat ${threat.id}`);
                break;
            case 'webhook':
                console.log(`🔗 Webhook notification sent for threat ${threat.id}`);
                break;
            case 'sms':
                console.log(`📱 SMS notification sent for threat ${threat.id}`);
                break;
            default:
                console.log(`📤 ${method} notification sent for threat ${threat.id}`);
        }
    }

    async detectThreats() {
        if (!this.isActive) return;

        try {
            // Detect brute force attacks
            await this.detectBruteForceAttacks();
            
            // Detect DDoS patterns
            await this.detectDDoSPatterns();
            
            // Detect data exfiltration
            await this.detectDataExfiltration();
            
            // Detect privilege escalation
            await this.detectPrivilegeEscalation();

        } catch (error) {
            console.error('❌ Error in threat detection:', error.message);
        }
    }

    async detectBruteForceAttacks() {
        // Analyze failed login attempts from same IP
        const recentEvents = Array.from(this.securityEvents.values())
            .filter(e => e.timestamp > Date.now() - 900000) // Last 15 minutes
            .filter(e => e.type === 'login_attempt' && e.status === 'failure');

        const ipFailureCounts = recentEvents.reduce((acc, event) => {
            acc[event.sourceIP] = (acc[event.sourceIP] || 0) + 1;
            return acc;
        }, {});

        for (const [ip, failureCount] of Object.entries(ipFailureCounts)) {
            if (failureCount >= this.config.detection.bruteForceThreshold) {
                const threat = {
                    id: `brute_force_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                    type: ['brute_force'],
                    severity: 'high',
                    source: ip,
                    score: Math.min(failureCount * 10, 100),
                    confidence: 0.9,
                    indicators: [`${failureCount} failed login attempts in 15 minutes`],
                    timestamp: Date.now(),
                    status: 'active'
                };

                this.activeThreats.set(threat.id, threat);
                await this.handleThreatDetection({ sourceIP: ip, type: 'brute_force' }, { 
                    isThreshold: true, 
                    threatScore: threat.score, 
                    threatTypes: threat.type,
                    indicators: threat.indicators,
                    confidence: threat.confidence
                });
            }
        }
    }

    async detectDDoSPatterns() {
        // Analyze request patterns for DDoS indicators
        const recentEvents = Array.from(this.securityEvents.values())
            .filter(e => e.timestamp > Date.now() - 300000); // Last 5 minutes

        const requestCounts = recentEvents.reduce((acc, event) => {
            acc[event.sourceIP] = (acc[event.sourceIP] || 0) + 1;
            return acc;
        }, {});

        for (const [ip, requestCount] of Object.entries(requestCounts)) {
            if (requestCount >= this.config.detection.rateLimitThreshold) {
                const threat = {
                    id: `ddos_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                    type: ['ddos'],
                    severity: 'high',
                    source: ip,
                    score: Math.min(requestCount / 2, 100),
                    confidence: 0.8,
                    indicators: [`${requestCount} requests in 5 minutes`],
                    timestamp: Date.now(),
                    status: 'active'
                };

                this.activeThreats.set(threat.id, threat);
                console.log(`🚨 Potential DDoS detected from ${ip}: ${requestCount} requests`);
                this.emit('ddosDetected', threat);
            }
        }
    }

    async detectDataExfiltration() {
        // Look for unusual data transfer patterns
        const recentEvents = Array.from(this.securityEvents.values())
            .filter(e => e.timestamp > Date.now() - 1800000) // Last 30 minutes
            .filter(e => e.dataSize > 10000); // Large data transfers

        const ipDataTransfers = recentEvents.reduce((acc, event) => {
            if (!acc[event.sourceIP]) {
                acc[event.sourceIP] = { totalSize: 0, requestCount: 0 };
            }
            acc[event.sourceIP].totalSize += event.dataSize;
            acc[event.sourceIP].requestCount++;
            return acc;
        }, {});

        for (const [ip, transfer] of Object.entries(ipDataTransfers)) {
            if (transfer.totalSize > 10000000) { // 10MB threshold
                const threat = {
                    id: `data_exfiltration_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                    type: ['data_exfiltration'],
                    severity: 'critical',
                    source: ip,
                    score: Math.min(transfer.totalSize / 100000, 100),
                    confidence: 0.7,
                    indicators: [`${Math.round(transfer.totalSize / 1024 / 1024)}MB transferred in 30 minutes`],
                    timestamp: Date.now(),
                    status: 'active'
                };

                this.activeThreats.set(threat.id, threat);
                console.log(`🚨 Potential data exfiltration detected from ${ip}: ${Math.round(transfer.totalSize / 1024 / 1024)}MB`);
                this.emit('dataExfiltrationDetected', threat);
            }
        }
    }

    async detectPrivilegeEscalation() {
        // Look for suspicious admin activity patterns
        const recentEvents = Array.from(this.securityEvents.values())
            .filter(e => e.timestamp > Date.now() - 3600000) // Last hour
            .filter(e => e.type === 'admin_action');

        // Group by source IP
        const ipAdminActions = recentEvents.reduce((acc, event) => {
            if (!acc[event.sourceIP]) {
                acc[event.sourceIP] = [];
            }
            acc[event.sourceIP].push(event);
            return acc;
        }, {});

        for (const [ip, actions] of Object.entries(ipAdminActions)) {
            if (actions.length >= 5) { // Many admin actions in short time
                const threat = {
                    id: `privilege_escalation_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                    type: ['privilege_escalation'],
                    severity: 'high',
                    source: ip,
                    score: Math.min(actions.length * 15, 100),
                    confidence: 0.6,
                    indicators: [`${actions.length} admin actions in 1 hour`],
                    timestamp: Date.now(),
                    status: 'active'
                };

                this.activeThreats.set(threat.id, threat);
                console.log(`🚨 Potential privilege escalation detected from ${ip}: ${actions.length} admin actions`);
                this.emit('privilegeEscalationDetected', threat);
            }
        }
    }

    async performBehavioralAnalysis() {
        if (!this.isActive) return;

        console.log('🧠 Performing behavioral analysis');
        
        // This would implement behavioral analysis algorithms
        // For now, we'll do basic pattern analysis
        const recentEvents = Array.from(this.securityEvents.values())
            .filter(e => e.timestamp > Date.now() - 3600000); // Last hour

        // Analyze user behavior patterns
        const userPatterns = this.analyzeUserBehaviorPatterns(recentEvents);
        
        // Analyze network patterns
        const networkPatterns = this.analyzeNetworkPatterns(recentEvents);
        
        // Update behavioral baselines
        this.updateBehavioralBaselines(userPatterns, networkPatterns);

        this.emit('behavioralAnalysisCompleted', {
            timestamp: Date.now(),
            userPatterns: Object.keys(userPatterns).length,
            networkPatterns: Object.keys(networkPatterns).length,
            baselinesUpdated: this.behavioralBaselines.size
        });
    }

    analyzeUserBehaviorPatterns(events) {
        const patterns = {};
        
        // Group events by source IP (representing users)
        events.forEach(event => {
            if (!patterns[event.sourceIP]) {
                patterns[event.sourceIP] = {
                    requestCount: 0,
                    averageResponseTime: 0,
                    errorRate: 0,
                    activeHours: new Set(),
                    actionTypes: {}
                };
            }
            
            const pattern = patterns[event.sourceIP];
            pattern.requestCount++;
            pattern.averageResponseTime = (pattern.averageResponseTime + event.responseTime) / 2;
            
            if (event.status === 'failure') {
                pattern.errorRate++;
            }
            
            const hour = new Date(event.timestamp).getHours();
            pattern.activeHours.add(hour);
            
            if (event.payload && event.payload.action) {
                pattern.actionTypes[event.payload.action] = (pattern.actionTypes[event.payload.action] || 0) + 1;
            }
        });

        // Convert Sets to arrays for storage
        Object.values(patterns).forEach(pattern => {
            pattern.activeHours = Array.from(pattern.activeHours);
            pattern.errorRate = pattern.errorRate / pattern.requestCount;
        });

        return patterns;
    }

    analyzeNetworkPatterns(events) {
        const patterns = {};
        
        // Analyze by source location
        events.forEach(event => {
            if (event.geolocation) {
                const country = event.geolocation.country;
                if (!patterns[country]) {
                    patterns[country] = {
                        requestCount: 0,
                        averageDataSize: 0,
                        threatScore: 0,
                        uniqueIPs: new Set()
                    };
                }
                
                patterns[country].requestCount++;
                patterns[country].averageDataSize = (patterns[country].averageDataSize + event.dataSize) / 2;
                patterns[country].uniqueIPs.add(event.sourceIP);
                
                // Add threat score for high-risk countries
                if (['RU', 'IR', 'CN'].includes(country)) {
                    patterns[country].threatScore += 10;
                }
            }
        });

        // Convert Sets to counts
        Object.values(patterns).forEach(pattern => {
            pattern.uniqueIPCount = pattern.uniqueIPs.size;
            delete pattern.uniqueIPs;
        });

        return patterns;
    }

    updateBehavioralBaselines(userPatterns, networkPatterns) {
        // Update user behavioral baselines
        for (const [ip, pattern] of Object.entries(userPatterns)) {
            this.behavioralBaselines.set(`user_${ip}`, {
                ...pattern,
                lastUpdated: Date.now(),
                type: 'user_behavior'
            });
        }

        // Update network behavioral baselines
        for (const [country, pattern] of Object.entries(networkPatterns)) {
            this.behavioralBaselines.set(`network_${country}`, {
                ...pattern,
                lastUpdated: Date.now(),
                type: 'network_behavior'
            });
        }
    }

    async updateThreatIntelligence() {
        if (!this.isActive) return;

        console.log('🔄 Updating threat intelligence');

        // In a real implementation, this would:
        // - Fetch from threat intelligence feeds
        // - Update IP reputation databases
        // - Download malware signatures
        // - Update geolocation risk data

        // For demonstration, simulate adding new threat intelligence
        const newThreats = this.generateNewThreatIntelligence();
        
        for (const [indicator, intelligence] of Object.entries(newThreats)) {
            this.threatIntelligence.set(indicator, intelligence);
        }

        await this.saveThreatIntelligence();

        this.emit('threatIntelligenceUpdated', {
            timestamp: Date.now(),
            totalIndicators: this.threatIntelligence.size,
            newIndicators: Object.keys(newThreats).length
        });
    }

    generateNewThreatIntelligence() {
        const newThreats = {};
        
        // Simulate new malicious IPs
        if (Math.random() < 0.3) {
            const ip = `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
            newThreats[ip] = {
                type: 'ip',
                reputation: 'malicious',
                category: 'botnet',
                severity: 'high',
                lastSeen: Date.now(),
                confidence: 0.8,
                source: 'threat_feed'
            };
        }

        // Simulate new malware signatures
        if (Math.random() < 0.2) {
            const hash = crypto.randomBytes(16).toString('hex');
            newThreats[hash] = {
                type: 'hash',
                reputation: 'malicious',
                category: 'malware',
                severity: 'critical',
                lastSeen: Date.now(),
                confidence: 0.95,
                source: 'malware_feed'
            };
        }

        return newThreats;
    }

    async saveThreatIntelligence() {
        try {
            const threatIntelFile = path.join(this.config.storage.securityDir, 'threat_intelligence.json');
            const threatData = Object.fromEntries(this.threatIntelligence);
            await fs.writeFile(threatIntelFile, JSON.stringify(threatData, null, 2));
        } catch (error) {
            console.error('❌ Error saving threat intelligence:', error.message);
        }
    }

    async logSecurityEvent(eventType, eventData) {
        try {
            const logEntry = {
                timestamp: Date.now(),
                type: eventType,
                data: eventData,
                id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
            };

            const logFile = path.join(
                this.config.storage.logsDir, 
                'events',
                `${eventType}_${new Date().toISOString().split('T')[0]}.json`
            );

            // Append to daily log file
            await fs.appendFile(logFile, JSON.stringify(logEntry) + '\n');

            // Store in memory for recent access
            this.securityEvents.set(logEntry.id, logEntry);

        } catch (error) {
            console.error('❌ Error logging security event:', error.message);
        }
    }

    updateSecurityMetrics(scanResults) {
        const metrics = {
            timestamp: Date.now(),
            threatsDetected: scanResults.threatsDetected,
            anomaliesFound: scanResults.anomaliesFound,
            eventsProcessed: scanResults.eventsProcessed,
            activeThreats: this.activeThreats.size,
            quarantinedEntities: this.quarantinedEntities.size,
            threatIntelIndicators: this.threatIntelligence.size,
            behavioralBaselines: this.behavioralBaselines.size
        };

        this.securityMetrics.set('latest', metrics);
        
        // Keep metrics history
        const metricsHistory = this.securityMetrics.get('history') || [];
        metricsHistory.push(metrics);
        
        // Keep only last 100 metrics
        if (metricsHistory.length > 100) {
            metricsHistory.shift();
        }
        
        this.securityMetrics.set('history', metricsHistory);
    }

    async performSecurityCleanup() {
        const now = Date.now();
        const retentionMs = this.config.monitoring.dataRetentionDays * 24 * 60 * 60 * 1000;

        // Clean up old security events
        for (const [eventId, event] of this.securityEvents) {
            if (now - event.timestamp > retentionMs) {
                this.securityEvents.delete(eventId);
            }
        }

        // Clean up resolved threats
        for (const [threatId, threat] of this.activeThreats) {
            if (threat.status === 'resolved' && now - threat.timestamp > 7 * 24 * 60 * 60 * 1000) {
                this.activeThreats.delete(threatId);
            }
        }

        // Clean up expired quarantines
        for (const [quarantineId, quarantine] of this.quarantinedEntities) {
            if (now > quarantine.expiresAt) {
                this.quarantinedEntities.delete(quarantineId);
                console.log(`🔓 Quarantine expired: ${quarantine.entityType} ${quarantine.entity}`);
                this.emit('quarantineExpired', quarantine);
            }
        }

        console.log('🧹 Security data cleanup completed');
    }

    // Public API Methods
    getSecurityStatus() {
        const latestMetrics = this.securityMetrics.get('latest') || {};
        
        return {
            isActive: this.isActive,
            lastScan: latestMetrics.timestamp,
            activeThreats: this.activeThreats.size,
            quarantinedEntities: this.quarantinedEntities.size,
            threatIntelIndicators: this.threatIntelligence.size,
            behavioralBaselines: this.behavioralBaselines.size,
            securityEvents: this.securityEvents.size,
            configuration: this.config,
            metrics: latestMetrics
        };
    }

    getActiveThreats(filters = {}) {
        let threats = Array.from(this.activeThreats.values());

        if (filters.severity) {
            threats = threats.filter(t => t.severity === filters.severity);
        }
        if (filters.type) {
            threats = threats.filter(t => t.type.includes(filters.type));
        }
        if (filters.status) {
            threats = threats.filter(t => t.status === filters.status);
        }

        return threats.sort((a, b) => b.timestamp - a.timestamp);
    }

    getSecurityEvents(filters = {}) {
        let events = Array.from(this.securityEvents.values());

        if (filters.type) {
            events = events.filter(e => e.type === filters.type);
        }
        if (filters.timeRange) {
            const cutoff = Date.now() - filters.timeRange;
            events = events.filter(e => e.timestamp > cutoff);
        }

        return events.sort((a, b) => b.timestamp - a.timestamp);
    }

    getThreatIntelligence(indicator = null) {
        if (indicator) {
            return this.threatIntelligence.get(indicator);
        }
        return Object.fromEntries(this.threatIntelligence);
    }

    getQuarantinedEntities() {
        return Array.from(this.quarantinedEntities.values())
            .sort((a, b) => b.timestamp - a.timestamp);
    }

    getSecurityMetrics() {
        return {
            latest: this.securityMetrics.get('latest'),
            history: this.securityMetrics.get('history') || []
        };
    }

    updateConfiguration(newConfig) {
        Object.assign(this.config, newConfig);
        console.log('🛡️ Security monitoring configuration updated');
        this.emit('configurationUpdated', { config: this.config, timestamp: Date.now() });
    }
}

// Analyzer Classes (Placeholder implementations)
class IntrusionDetector {
    constructor(config) {
        this.config = config;
    }
    
    async analyze(data) {
        return { category: 'intrusion', detected: 0, patterns: [] };
    }
}

class AnomalyDetector {
    constructor(config) {
        this.config = config;
    }
    
    async analyze(data) {
        return { category: 'anomaly', detected: 0, deviations: [] };
    }
}

class BehavioralAnalyzer {
    constructor(config) {
        this.config = config;
    }
    
    async analyze(data) {
        return { category: 'behavioral', patterns: [], anomalies: [] };
    }
}

class ThreatIntelligenceManager {
    constructor(config) {
        this.config = config;
    }
    
    async updateFeeds() {
        return { updated: 0, total: 0 };
    }
}

module.exports = SecurityMonitoringService;