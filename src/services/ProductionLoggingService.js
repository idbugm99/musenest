/**
 * Production Logging Service
 * Part of Phase D.4: Production logging and audit trails
 * Provides comprehensive logging, audit trails, and log management for production environments
 */

const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');
const util = require('util');

class ProductionLoggingService extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            logLevel: config.logLevel || 'info',
            logDir: config.logDir || path.join(__dirname, '../../logs'),
            maxFileSize: config.maxFileSize || 50 * 1024 * 1024, // 50MB
            maxFiles: config.maxFiles || 10,
            enableConsole: config.enableConsole !== false,
            enableFile: config.enableFile !== false,
            enableAudit: config.enableAudit !== false,
            enableStructured: config.enableStructured !== false,
            logRotation: config.logRotation !== false,
            environment: config.environment || process.env.NODE_ENV || 'development'
        };

        // Log levels
        this.logLevels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3,
            trace: 4
        };

        // Current log level threshold
        this.currentLogLevel = this.logLevels[this.config.logLevel] || this.logLevels.info;

        // Log streams and files
        this.logStreams = {
            application: null,
            error: null,
            audit: null,
            security: null,
            performance: null
        };

        // Audit trail configuration
        this.auditConfig = {
            trackUserActions: true,
            trackSystemEvents: true,
            trackDataChanges: true,
            trackSecurityEvents: true,
            retentionDays: 90
        };

        // Log statistics
        this.logStats = {
            totalLogs: 0,
            errorCount: 0,
            warnCount: 0,
            auditEvents: 0,
            securityEvents: 0,
            startTime: Date.now()
        };

        // Initialize logging system
        this.initialize();
        
        console.log('📝 ProductionLoggingService initialized');
    }

    /**
     * Initialize logging system
     */
    async initialize() {
        try {
            // Ensure log directory exists
            await fs.mkdir(this.config.logDir, { recursive: true });

            // Initialize log streams if file logging is enabled
            if (this.config.enableFile) {
                await this.initializeLogStreams();
            }

            // Set up log rotation if enabled
            if (this.config.logRotation) {
                this.setupLogRotation();
            }

            this.emit('loggingInitialized');
            console.log(`📝 Logging initialized: ${this.config.logDir}`);

        } catch (error) {
            console.error('❌ Failed to initialize logging system:', error.message);
            this.emit('loggingError', error);
        }
    }

    /**
     * Initialize log file streams
     */
    async initializeLogStreams() {
        const streamTypes = ['application', 'error', 'audit', 'security', 'performance'];
        
        for (const streamType of streamTypes) {
            try {
                const logFile = path.join(this.config.logDir, `${streamType}.log`);
                
                // Create write stream with append mode
                const stream = require('fs').createWriteStream(logFile, { 
                    flags: 'a',
                    encoding: 'utf8'
                });
                
                stream.on('error', (error) => {
                    console.error(`❌ Log stream error (${streamType}):`, error.message);
                    this.emit('streamError', { streamType, error });
                });

                this.logStreams[streamType] = stream;
                
            } catch (error) {
                console.error(`❌ Failed to initialize ${streamType} log stream:`, error.message);
            }
        }
    }

    /**
     * Log a message with specified level
     * @param {string} level - Log level (error, warn, info, debug, trace)
     * @param {string} message - Log message
     * @param {Object} meta - Additional metadata
     * @param {Object} context - Contextual information
     */
    log(level, message, meta = {}, context = {}) {
        // Check if this log level should be processed
        if (this.logLevels[level] > this.currentLogLevel) {
            return;
        }

        const timestamp = new Date();
        const logEntry = {
            timestamp: timestamp.toISOString(),
            level: level.toUpperCase(),
            message,
            meta,
            context: {
                ...context,
                environment: this.config.environment,
                pid: process.pid,
                uptime: process.uptime()
            }
        };

        // Add stack trace for errors
        if (level === 'error' && meta.error) {
            logEntry.stack = meta.error.stack;
        }

        // Update statistics
        this.updateLogStats(level);

        // Output to console if enabled
        if (this.config.enableConsole) {
            this.writeToConsole(logEntry);
        }

        // Write to file if enabled
        if (this.config.enableFile) {
            this.writeToFile(logEntry, 'application');
            
            // Also write errors to error log
            if (level === 'error') {
                this.writeToFile(logEntry, 'error');
            }
        }

        this.emit('logEntry', logEntry);
    }

    /**
     * Log error message
     */
    error(message, error = null, context = {}) {
        this.log('error', message, { error }, context);
    }

    /**
     * Log warning message
     */
    warn(message, meta = {}, context = {}) {
        this.log('warn', message, meta, context);
    }

    /**
     * Log info message
     */
    info(message, meta = {}, context = {}) {
        this.log('info', message, meta, context);
    }

    /**
     * Log debug message
     */
    debug(message, meta = {}, context = {}) {
        this.log('debug', message, meta, context);
    }

    /**
     * Log trace message
     */
    trace(message, meta = {}, context = {}) {
        this.log('trace', message, meta, context);
    }

    /**
     * Log audit event
     * @param {string} action - Action performed
     * @param {Object} details - Event details
     * @param {Object} user - User information
     * @param {Object} resource - Resource affected
     */
    audit(action, details = {}, user = {}, resource = {}) {
        if (!this.config.enableAudit) {
            return;
        }

        const auditEntry = {
            timestamp: new Date().toISOString(),
            type: 'audit',
            action,
            details,
            user: {
                id: user.id || 'anonymous',
                email: user.email || 'unknown',
                role: user.role || 'unknown',
                ip: user.ip || 'unknown'
            },
            resource: {
                type: resource.type || 'unknown',
                id: resource.id || null,
                name: resource.name || null
            },
            environment: this.config.environment,
            sessionId: details.sessionId || null,
            userAgent: details.userAgent || null,
            success: details.success !== false
        };

        this.logStats.auditEvents++;

        // Write to audit log
        if (this.config.enableFile) {
            this.writeToFile(auditEntry, 'audit');
        }

        // Also log to main application log
        this.info('Audit Event', { 
            action, 
            userId: user.id, 
            resourceType: resource.type,
            success: auditEntry.success
        });

        this.emit('auditEvent', auditEntry);
    }

    /**
     * Log security event
     * @param {string} event - Security event type
     * @param {Object} details - Event details
     * @param {string} severity - Event severity (low, medium, high, critical)
     */
    security(event, details = {}, severity = 'medium') {
        const securityEntry = {
            timestamp: new Date().toISOString(),
            type: 'security',
            event,
            severity,
            details,
            environment: this.config.environment,
            source: details.source || 'application',
            ip: details.ip || 'unknown',
            userAgent: details.userAgent || null,
            userId: details.userId || null
        };

        this.logStats.securityEvents++;

        // Write to security log
        if (this.config.enableFile) {
            this.writeToFile(securityEntry, 'security');
        }

        // Also log as warning or error based on severity
        const logLevel = ['critical', 'high'].includes(severity) ? 'error' : 'warn';
        this.log(logLevel, `Security Event: ${event}`, { 
            severity, 
            details: details 
        });

        this.emit('securityEvent', securityEntry);
    }

    /**
     * Log performance metrics
     * @param {string} operation - Operation name
     * @param {number} duration - Duration in milliseconds
     * @param {Object} metrics - Additional metrics
     */
    performance(operation, duration, metrics = {}) {
        const perfEntry = {
            timestamp: new Date().toISOString(),
            type: 'performance',
            operation,
            duration,
            metrics: {
                ...metrics,
                memory: process.memoryUsage(),
                cpu: process.cpuUsage()
            },
            environment: this.config.environment
        };

        // Write to performance log
        if (this.config.enableFile) {
            this.writeToFile(perfEntry, 'performance');
        }

        // Log slow operations as warnings
        const slowThreshold = 5000; // 5 seconds
        if (duration > slowThreshold) {
            this.warn('Slow Operation Detected', { 
                operation, 
                duration, 
                threshold: slowThreshold 
            });
        }

        this.emit('performanceMetric', perfEntry);
    }

    /**
     * Write log entry to console
     * @param {Object} logEntry - Log entry object
     */
    writeToConsole(logEntry) {
        const colorCodes = {
            ERROR: '\x1b[31m', // Red
            WARN: '\x1b[33m',  // Yellow
            INFO: '\x1b[36m',  // Cyan
            DEBUG: '\x1b[35m', // Magenta
            TRACE: '\x1b[37m'  // White
        };

        const resetCode = '\x1b[0m';
        const color = colorCodes[logEntry.level] || '';
        
        const timestamp = logEntry.timestamp;
        const level = logEntry.level.padEnd(5);
        const message = logEntry.message;
        
        let output = `${timestamp} ${color}${level}${resetCode} ${message}`;
        
        // Add metadata if present
        if (Object.keys(logEntry.meta).length > 0) {
            output += ` ${util.inspect(logEntry.meta, { colors: true, depth: 2 })}`;
        }

        // Add context if present and significant
        const significantContext = Object.keys(logEntry.context)
            .filter(key => !['environment', 'pid', 'uptime'].includes(key))
            .reduce((obj, key) => {
                obj[key] = logEntry.context[key];
                return obj;
            }, {});

        if (Object.keys(significantContext).length > 0) {
            output += ` Context: ${util.inspect(significantContext, { colors: true, depth: 1 })}`;
        }

        console.log(output);
    }

    /**
     * Write log entry to file
     * @param {Object} logEntry - Log entry object
     * @param {string} streamType - Type of log stream
     */
    writeToFile(logEntry, streamType) {
        const stream = this.logStreams[streamType];
        if (!stream) {
            return;
        }

        try {
            let logLine;
            
            if (this.config.enableStructured) {
                // Structured JSON logging
                logLine = JSON.stringify(logEntry) + '\n';
            } else {
                // Human-readable format
                const timestamp = logEntry.timestamp;
                const level = logEntry.level.padEnd(5);
                const message = logEntry.message;
                
                logLine = `${timestamp} ${level} ${message}`;
                
                if (Object.keys(logEntry.meta).length > 0) {
                    logLine += ` Meta: ${JSON.stringify(logEntry.meta)}`;
                }
                
                if (logEntry.stack) {
                    logLine += `\nStack: ${logEntry.stack}`;
                }
                
                logLine += '\n';
            }

            stream.write(logLine);
            
        } catch (error) {
            console.error(`❌ Failed to write to ${streamType} log:`, error.message);
        }
    }

    /**
     * Set up log rotation
     */
    setupLogRotation() {
        // Check for log rotation every hour
        setInterval(() => {
            this.rotateLogsIfNeeded();
        }, 60 * 60 * 1000); // 1 hour

        console.log('🔄 Log rotation scheduled');
    }

    /**
     * Rotate logs if needed based on size
     */
    async rotateLogsIfNeeded() {
        try {
            for (const [streamType, stream] of Object.entries(this.logStreams)) {
                if (!stream) continue;

                const logFile = path.join(this.config.logDir, `${streamType}.log`);
                
                try {
                    const stats = await fs.stat(logFile);
                    
                    if (stats.size > this.config.maxFileSize) {
                        await this.rotateLogFile(streamType, logFile);
                    }
                } catch (error) {
                    // File doesn't exist or can't be accessed
                    continue;
                }
            }
        } catch (error) {
            console.error('❌ Error during log rotation:', error.message);
        }
    }

    /**
     * Rotate a specific log file
     * @param {string} streamType - Type of log stream
     * @param {string} logFile - Path to log file
     */
    async rotateLogFile(streamType, logFile) {
        try {
            console.log(`🔄 Rotating log file: ${streamType}`);

            // Close current stream
            const currentStream = this.logStreams[streamType];
            if (currentStream) {
                currentStream.end();
            }

            // Move current log to rotated version
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const rotatedFile = logFile.replace('.log', `_${timestamp}.log`);
            await fs.rename(logFile, rotatedFile);

            // Create new stream
            const newStream = require('fs').createWriteStream(logFile, { 
                flags: 'a',
                encoding: 'utf8'
            });
            
            newStream.on('error', (error) => {
                console.error(`❌ New log stream error (${streamType}):`, error.message);
            });

            this.logStreams[streamType] = newStream;

            // Clean up old rotated files
            await this.cleanupOldLogFiles(streamType);

            this.info('Log File Rotated', { 
                streamType, 
                rotatedFile, 
                newFile: logFile 
            });

        } catch (error) {
            console.error(`❌ Failed to rotate ${streamType} log:`, error.message);
        }
    }

    /**
     * Clean up old log files beyond maxFiles limit
     * @param {string} streamType - Type of log stream
     */
    async cleanupOldLogFiles(streamType) {
        try {
            const files = await fs.readdir(this.config.logDir);
            const logFiles = files
                .filter(file => file.startsWith(`${streamType}_`) && file.endsWith('.log'))
                .map(file => ({
                    name: file,
                    path: path.join(this.config.logDir, file),
                    mtime: null
                }));

            // Get modification times
            for (const file of logFiles) {
                try {
                    const stats = await fs.stat(file.path);
                    file.mtime = stats.mtime;
                } catch (error) {
                    // Skip files we can't stat
                }
            }

            // Sort by modification time (oldest first)
            logFiles.sort((a, b) => a.mtime - b.mtime);

            // Remove files beyond maxFiles limit
            const filesToDelete = logFiles.slice(0, -this.config.maxFiles);
            
            for (const file of filesToDelete) {
                try {
                    await fs.unlink(file.path);
                    console.log(`🗑️ Deleted old log file: ${file.name}`);
                } catch (error) {
                    console.error(`❌ Failed to delete old log file ${file.name}:`, error.message);
                }
            }

        } catch (error) {
            console.error(`❌ Error cleaning up old ${streamType} logs:`, error.message);
        }
    }

    /**
     * Update log statistics
     * @param {string} level - Log level
     */
    updateLogStats(level) {
        this.logStats.totalLogs++;
        
        if (level === 'error') {
            this.logStats.errorCount++;
        } else if (level === 'warn') {
            this.logStats.warnCount++;
        }
    }

    /**
     * Search logs
     * @param {Object} criteria - Search criteria
     * @returns {Array} Matching log entries
     */
    async searchLogs(criteria = {}) {
        // This is a simplified implementation
        // In production, would use proper log search tools like ELK stack
        
        const {
            level,
            message,
            startTime,
            endTime,
            limit = 100,
            streamType = 'application'
        } = criteria;

        try {
            const logFile = path.join(this.config.logDir, `${streamType}.log`);
            const logContent = await fs.readFile(logFile, 'utf8');
            const lines = logContent.split('\n').filter(line => line.trim());

            let results = [];

            for (const line of lines) {
                try {
                    let logEntry;
                    
                    if (this.config.enableStructured) {
                        logEntry = JSON.parse(line);
                    } else {
                        // Parse human-readable format (simplified)
                        const match = line.match(/^(\S+) (\S+)\s+(.+)$/);
                        if (!match) continue;
                        
                        logEntry = {
                            timestamp: match[1],
                            level: match[2].trim(),
                            message: match[3]
                        };
                    }

                    // Apply filters
                    if (level && logEntry.level !== level.toUpperCase()) {
                        continue;
                    }
                    
                    if (message && !logEntry.message.toLowerCase().includes(message.toLowerCase())) {
                        continue;
                    }
                    
                    if (startTime && new Date(logEntry.timestamp) < new Date(startTime)) {
                        continue;
                    }
                    
                    if (endTime && new Date(logEntry.timestamp) > new Date(endTime)) {
                        continue;
                    }

                    results.push(logEntry);
                    
                    if (results.length >= limit) {
                        break;
                    }
                    
                } catch (error) {
                    // Skip malformed lines
                    continue;
                }
            }

            return results;

        } catch (error) {
            console.error('❌ Error searching logs:', error.message);
            return [];
        }
    }

    // API methods

    getLogStats() {
        return {
            ...this.logStats,
            uptime: Date.now() - this.logStats.startTime,
            currentLogLevel: this.config.logLevel,
            enabledFeatures: {
                console: this.config.enableConsole,
                file: this.config.enableFile,
                audit: this.config.enableAudit,
                structured: this.config.enableStructured,
                rotation: this.config.logRotation
            }
        };
    }

    getConfiguration() {
        return { ...this.config };
    }

    updateLogLevel(newLevel) {
        if (this.logLevels.hasOwnProperty(newLevel)) {
            this.config.logLevel = newLevel;
            this.currentLogLevel = this.logLevels[newLevel];
            this.info('Log Level Changed', { 
                oldLevel: this.config.logLevel, 
                newLevel 
            });
            return true;
        }
        return false;
    }

    async getLogFiles() {
        try {
            const files = await fs.readdir(this.config.logDir);
            const logFiles = [];

            for (const file of files) {
                if (file.endsWith('.log')) {
                    try {
                        const filePath = path.join(this.config.logDir, file);
                        const stats = await fs.stat(filePath);
                        
                        logFiles.push({
                            name: file,
                            size: stats.size,
                            modified: stats.mtime,
                            type: file.split('.')[0]
                        });
                    } catch (error) {
                        // Skip files we can't access
                    }
                }
            }

            return logFiles.sort((a, b) => b.modified - a.modified);

        } catch (error) {
            console.error('❌ Error getting log files:', error.message);
            return [];
        }
    }

    /**
     * Graceful shutdown
     */
    async shutdown() {
        console.log('📝 Shutting down logging service...');
        
        // Close all log streams
        for (const [streamType, stream] of Object.entries(this.logStreams)) {
            if (stream) {
                stream.end();
                console.log(`📝 Closed ${streamType} log stream`);
            }
        }
        
        this.emit('loggingShutdown');
    }
}

module.exports = ProductionLoggingService;