/**
 * Media Logger Service
 * Part of Phase B.4: Comprehensive Error Logging and Monitoring System
 * Handles detailed logging for media operations, moderation, and system monitoring
 */

const fs = require('fs').promises;
const path = require('path');

class MediaLogger {
    constructor(dbConnection, options = {}) {
        this.db = dbConnection;
        this.logLevel = options.logLevel || process.env.LOG_LEVEL || 'info';
        this.enableDatabaseLogging = options.enableDatabaseLogging !== false;
        this.enableFileLogging = options.enableFileLogging === true;
        this.logDirectory = options.logDirectory || path.join(process.cwd(), 'logs/media');
        
        // Log retention settings
        this.retentionDays = options.retentionDays || 30;
        this.maxLogFileSize = options.maxLogFileSize || 10 * 1024 * 1024; // 10MB
        
        // Performance monitoring
        this.performanceMetrics = new Map();
        this.alertThresholds = {
            uploadTimeMs: options.uploadTimeThreshold || 30000, // 30 seconds
            moderationTimeMs: options.moderationTimeThreshold || 60000, // 1 minute
            errorRate: options.errorRateThreshold || 0.1, // 10%
            diskUsageMB: options.diskUsageThreshold || 1000 // 1GB
        };
        
        // Initialize file logging if enabled
        if (this.enableFileLogging) {
            this.initializeFileLogging();
        }
        
        console.log('📝 MediaLogger initialized with level:', this.logLevel);
    }

    /**
     * Initialize file logging system
     */
    async initializeFileLogging() {
        try {
            await fs.mkdir(this.logDirectory, { recursive: true });
            console.log('📁 Log directory initialized:', this.logDirectory);
        } catch (error) {
            console.error('❌ Failed to initialize log directory:', error.message);
            this.enableFileLogging = false;
        }
    }

    /**
     * Log media upload event with comprehensive details
     * @param {Object} uploadData - Upload event data
     */
    async logUpload(uploadData) {
        const logEntry = {
            event_type: 'media_upload',
            level: 'info',
            model_slug: uploadData.modelSlug,
            filename: uploadData.filename,
            original_filename: uploadData.originalFilename,
            file_size: uploadData.fileSize,
            processing_time_ms: uploadData.processingTime,
            watermark_applied: uploadData.watermarkApplied,
            moderation_status: uploadData.moderationStatus,
            upload_method: uploadData.uploadMethod || 'media_library',
            client_ip: uploadData.clientIP,
            user_agent: uploadData.userAgent,
            session_id: uploadData.sessionId,
            batch_id: uploadData.batchId,
            tracking_id: uploadData.trackingId,
            metadata: uploadData.metadata ? JSON.stringify(uploadData.metadata) : null,
            message: `Media uploaded: ${uploadData.filename} (${uploadData.fileSize} bytes) in ${uploadData.processingTime}ms`,
            timestamp: new Date().toISOString()
        };

        await this.writeLog(logEntry);
        
        // Update performance metrics
        this.updatePerformanceMetrics('upload', uploadData.processingTime);
        
        console.log(`📤 Upload logged: ${uploadData.filename} (${uploadData.processingTime}ms)`);
    }

    /**
     * Log moderation event with detailed analysis
     * @param {Object} moderationData - Moderation event data
     */
    async logModeration(moderationData) {
        const logEntry = {
            event_type: 'moderation_result',
            level: moderationData.moderationStatus === 'error' ? 'error' : 'info',
            model_slug: moderationData.modelSlug,
            filename: moderationData.filename,
            tracking_id: moderationData.trackingId,
            batch_id: moderationData.batchId,
            moderation_status: moderationData.moderationStatus,
            moderation_score: moderationData.moderationScore,
            confidence_score: moderationData.confidenceScore,
            risk_level: moderationData.riskLevel,
            human_review_required: moderationData.humanReviewRequired,
            processing_time_ms: moderationData.processingTime,
            retry_attempts: moderationData.retryAttempts,
            analysis_version: moderationData.analysisVersion,
            detected_parts: moderationData.detectedParts ? JSON.stringify(moderationData.detectedParts) : null,
            face_analysis: moderationData.faceAnalysis ? JSON.stringify(moderationData.faceAnalysis) : null,
            violation_types: moderationData.violationTypes ? JSON.stringify(moderationData.violationTypes) : null,
            technical_issues: moderationData.technicalIssues ? JSON.stringify(moderationData.technicalIssues) : null,
            message: `Moderation completed: ${moderationData.moderationStatus} (score: ${moderationData.moderationScore}, risk: ${moderationData.riskLevel})`,
            timestamp: new Date().toISOString()
        };

        await this.writeLog(logEntry);
        
        // Update performance metrics
        this.updatePerformanceMetrics('moderation', moderationData.processingTime);
        
        // Check for alerts
        await this.checkModerationAlerts(moderationData);
        
        console.log(`🔍 Moderation logged: ${moderationData.filename} -> ${moderationData.moderationStatus}`);
    }

    /**
     * Log error event with detailed context
     * @param {Object} errorData - Error event data
     */
    async logError(errorData) {
        const logEntry = {
            event_type: 'error',
            level: 'error',
            model_slug: errorData.modelSlug,
            filename: errorData.filename,
            error_type: errorData.errorType,
            error_message: errorData.error,
            error_stack: errorData.errorStack,
            operation: errorData.operation,
            processing_stage: errorData.processingStage,
            tracking_id: errorData.trackingId,
            batch_id: errorData.batchId,
            retry_attempts: errorData.retryAttempts,
            processing_time_ms: errorData.processingTime,
            client_ip: errorData.clientIP,
            session_id: errorData.sessionId,
            context_data: errorData.contextData ? JSON.stringify(errorData.contextData) : null,
            escalation_priority: errorData.escalationPriority || 'medium',
            requires_manual_review: errorData.requiresManualReview || false,
            message: `Error in ${errorData.operation}: ${errorData.error}`,
            timestamp: new Date().toISOString()
        };

        await this.writeLog(logEntry);
        
        // Track error rates
        this.trackErrorRate(errorData.operation, errorData.errorType);
        
        // Check if immediate alert is needed
        await this.checkErrorAlerts(errorData);
        
        console.error(`💥 Error logged: ${errorData.operation} - ${errorData.error}`);
    }

    /**
     * Log performance metrics and system health
     * @param {Object} performanceData - Performance metrics data
     */
    async logPerformance(performanceData) {
        const logEntry = {
            event_type: 'performance_metrics',
            level: 'info',
            model_slug: performanceData.modelSlug,
            operation: performanceData.operation,
            processing_time_ms: performanceData.processingTime,
            memory_usage_mb: performanceData.memoryUsage,
            cpu_usage_percent: performanceData.cpuUsage,
            disk_usage_mb: performanceData.diskUsage,
            active_uploads: performanceData.activeUploads,
            queue_depth: performanceData.queueDepth,
            throughput_per_hour: performanceData.throughput,
            error_rate_percent: performanceData.errorRate,
            system_load: performanceData.systemLoad,
            timestamp: new Date().toISOString(),
            message: `Performance: ${performanceData.operation} - ${performanceData.processingTime}ms (${performanceData.throughput}/hr)`
        };

        await this.writeLog(logEntry);
        
        // Check performance thresholds
        await this.checkPerformanceAlerts(performanceData);
    }

    /**
     * Log file storage operations
     * @param {Object} storageData - Storage operation data
     */
    async logFileStorage(storageData) {
        const logEntry = {
            event_type: 'file_storage',
            level: storageData.success ? 'info' : 'warn',
            model_slug: storageData.modelSlug,
            media_id: storageData.mediaId,
            filename: storageData.filename,
            operation: storageData.operation, // move, copy, delete, backup
            source_path: storageData.sourcePath,
            target_path: storageData.targetPath,
            moderation_status: storageData.moderationStatus,
            files_moved: storageData.filesMovedCount,
            backup_created: storageData.backupPaths ? true : false,
            processing_time_ms: storageData.processingTime,
            success: storageData.success,
            error_message: storageData.error,
            message: storageData.success 
                ? `File ${storageData.operation} successful: ${storageData.filename}` 
                : `File ${storageData.operation} failed: ${storageData.error}`,
            timestamp: new Date().toISOString()
        };

        await this.writeLog(logEntry);
        
        console.log(`📁 Storage operation logged: ${storageData.operation} ${storageData.filename} - ${storageData.success ? 'SUCCESS' : 'FAILED'}`);
    }

    /**
     * Log admin actions for audit trail
     * @param {Object} adminData - Admin action data
     */
    async logAdminAction(adminData) {
        const logEntry = {
            event_type: 'admin_action',
            level: 'info',
            admin_user_id: adminData.adminUserId,
            admin_username: adminData.adminUsername,
            action_type: adminData.actionType,
            target_model: adminData.modelSlug,
            target_media_id: adminData.mediaId,
            action_details: adminData.actionDetails,
            before_state: adminData.beforeState ? JSON.stringify(adminData.beforeState) : null,
            after_state: adminData.afterState ? JSON.stringify(adminData.afterState) : null,
            client_ip: adminData.clientIP,
            session_id: adminData.sessionId,
            justification: adminData.justification,
            message: `Admin action: ${adminData.actionType} by ${adminData.adminUsername} on ${adminData.modelSlug}`,
            timestamp: new Date().toISOString()
        };

        await this.writeLog(logEntry);
        
        console.log(`👨‍💼 Admin action logged: ${adminData.actionType} by ${adminData.adminUsername}`);
    }

    /**
     * Write log entry to database and/or file
     * @param {Object} logEntry - Log entry to write
     */
    async writeLog(logEntry) {
        try {
            // Write to database if enabled
            if (this.enableDatabaseLogging && this.db) {
                await this.writeToDatabaseLog(logEntry);
            }
            
            // Write to file if enabled
            if (this.enableFileLogging) {
                await this.writeToFileLog(logEntry);
            }
            
        } catch (error) {
            console.error('❌ Failed to write log:', error.message);
            // Don't throw - logging failures shouldn't break the main operation
        }
    }

    /**
     * Write log entry to database
     * @param {Object} logEntry - Log entry
     */
    async writeToDatabaseLog(logEntry) {
        try {
            const query = `
                INSERT INTO media_operation_logs (
                    event_type, level, model_slug, filename, media_id, tracking_id, batch_id,
                    processing_time_ms, moderation_status, operation, error_message, error_stack,
                    client_ip, session_id, metadata, message, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            `;
            
            const params = [
                logEntry.event_type,
                logEntry.level,
                logEntry.model_slug,
                logEntry.filename,
                logEntry.media_id,
                logEntry.tracking_id,
                logEntry.batch_id,
                logEntry.processing_time_ms,
                logEntry.moderation_status,
                logEntry.operation,
                logEntry.error_message,
                logEntry.error_stack,
                logEntry.client_ip,
                logEntry.session_id,
                logEntry.metadata,
                logEntry.message
            ];
            
            await this.db.execute(query, params);
            
        } catch (error) {
            console.error('⚠️ Database logging failed:', error.message);
        }
    }

    /**
     * Write log entry to file
     * @param {Object} logEntry - Log entry
     */
    async writeToFileLog(logEntry) {
        try {
            const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
            const logFileName = `media-${today}.log`;
            const logFilePath = path.join(this.logDirectory, logFileName);
            
            // Format log line
            const logLine = `${logEntry.timestamp} [${logEntry.level.toUpperCase()}] ${logEntry.event_type} - ${logEntry.message}\n`;
            
            // Append to log file
            await fs.appendFile(logFilePath, logLine);
            
            // Check file size and rotate if needed
            await this.rotateLogFileIfNeeded(logFilePath);
            
        } catch (error) {
            console.error('⚠️ File logging failed:', error.message);
        }
    }

    /**
     * Rotate log file if it exceeds max size
     * @param {string} logFilePath - Path to log file
     */
    async rotateLogFileIfNeeded(logFilePath) {
        try {
            const stats = await fs.stat(logFilePath);
            
            if (stats.size > this.maxLogFileSize) {
                const timestamp = Date.now();
                const rotatedPath = `${logFilePath}.${timestamp}`;
                
                await fs.rename(logFilePath, rotatedPath);
                console.log(`📦 Log file rotated: ${path.basename(rotatedPath)}`);
            }
            
        } catch (error) {
            // Ignore rotation errors
        }
    }

    /**
     * Update performance metrics
     * @param {string} operation - Operation name
     * @param {number} processingTime - Processing time in ms
     */
    updatePerformanceMetrics(operation, processingTime) {
        if (!this.performanceMetrics.has(operation)) {
            this.performanceMetrics.set(operation, {
                count: 0,
                totalTime: 0,
                avgTime: 0,
                maxTime: 0,
                minTime: Infinity
            });
        }
        
        const metrics = this.performanceMetrics.get(operation);
        metrics.count++;
        metrics.totalTime += processingTime;
        metrics.avgTime = metrics.totalTime / metrics.count;
        metrics.maxTime = Math.max(metrics.maxTime, processingTime);
        metrics.minTime = Math.min(metrics.minTime, processingTime);
        
        this.performanceMetrics.set(operation, metrics);
    }

    /**
     * Track error rates by operation
     * @param {string} operation - Operation name
     * @param {string} errorType - Type of error
     */
    trackErrorRate(operation, errorType) {
        const key = `${operation}_errors`;
        
        if (!this.performanceMetrics.has(key)) {
            this.performanceMetrics.set(key, {
                totalErrors: 0,
                errorTypes: new Map()
            });
        }
        
        const errorMetrics = this.performanceMetrics.get(key);
        errorMetrics.totalErrors++;
        
        const currentCount = errorMetrics.errorTypes.get(errorType) || 0;
        errorMetrics.errorTypes.set(errorType, currentCount + 1);
        
        this.performanceMetrics.set(key, errorMetrics);
    }

    /**
     * Check for moderation alerts
     * @param {Object} moderationData - Moderation data
     */
    async checkModerationAlerts(moderationData) {
        try {
            // Alert on high-risk content
            if (moderationData.riskLevel === 'high' || moderationData.moderationScore > 80) {
                await this.sendAlert('high_risk_content', {
                    message: `High-risk content detected: ${moderationData.filename}`,
                    data: moderationData
                });
            }
            
            // Alert on moderation errors
            if (moderationData.moderationStatus === 'error') {
                await this.sendAlert('moderation_error', {
                    message: `Moderation failed for: ${moderationData.filename}`,
                    data: moderationData
                });
            }
            
            // Alert on slow moderation
            if (moderationData.processingTime > this.alertThresholds.moderationTimeMs) {
                await this.sendAlert('slow_moderation', {
                    message: `Slow moderation detected: ${moderationData.processingTime}ms`,
                    data: moderationData
                });
            }
            
        } catch (error) {
            console.error('⚠️ Alert check failed:', error.message);
        }
    }

    /**
     * Check for error alerts
     * @param {Object} errorData - Error data
     */
    async checkErrorAlerts(errorData) {
        try {
            // Alert on critical errors
            if (errorData.escalationPriority === 'high' || errorData.requiresManualReview) {
                await this.sendAlert('critical_error', {
                    message: `Critical error in ${errorData.operation}: ${errorData.error}`,
                    data: errorData
                });
            }
            
            // Check error rate threshold
            const errorRate = this.calculateErrorRate(errorData.operation);
            if (errorRate > this.alertThresholds.errorRate) {
                await this.sendAlert('high_error_rate', {
                    message: `High error rate detected for ${errorData.operation}: ${Math.round(errorRate * 100)}%`,
                    data: { operation: errorData.operation, errorRate }
                });
            }
            
        } catch (error) {
            console.error('⚠️ Error alert check failed:', error.message);
        }
    }

    /**
     * Check for performance alerts
     * @param {Object} performanceData - Performance data
     */
    async checkPerformanceAlerts(performanceData) {
        try {
            // Alert on slow operations
            if (performanceData.processingTime > this.alertThresholds.uploadTimeMs) {
                await this.sendAlert('slow_operation', {
                    message: `Slow operation detected: ${performanceData.operation} took ${performanceData.processingTime}ms`,
                    data: performanceData
                });
            }
            
            // Alert on high disk usage
            if (performanceData.diskUsage > this.alertThresholds.diskUsageMB) {
                await this.sendAlert('high_disk_usage', {
                    message: `High disk usage: ${performanceData.diskUsage}MB`,
                    data: performanceData
                });
            }
            
        } catch (error) {
            console.error('⚠️ Performance alert check failed:', error.message);
        }
    }

    /**
     * Send alert (placeholder for notification system)
     * @param {string} alertType - Type of alert
     * @param {Object} alertData - Alert data
     */
    async sendAlert(alertType, alertData) {
        try {
            // Log the alert
            const alertEntry = {
                event_type: 'system_alert',
                level: 'warn',
                alert_type: alertType,
                message: alertData.message,
                alert_data: JSON.stringify(alertData.data),
                timestamp: new Date().toISOString()
            };
            
            await this.writeLog(alertEntry);
            
            // In a real implementation, this would send notifications
            // via email, Slack, webhook, etc.
            console.warn(`🚨 ALERT [${alertType}]: ${alertData.message}`);
            
        } catch (error) {
            console.error('⚠️ Alert sending failed:', error.message);
        }
    }

    /**
     * Calculate error rate for an operation
     * @param {string} operation - Operation name
     * @returns {number} Error rate (0-1)
     */
    calculateErrorRate(operation) {
        const operationMetrics = this.performanceMetrics.get(operation);
        const errorMetrics = this.performanceMetrics.get(`${operation}_errors`);
        
        if (!operationMetrics || !errorMetrics) {
            return 0;
        }
        
        return errorMetrics.totalErrors / operationMetrics.count;
    }

    /**
     * Get performance statistics
     * @returns {Object} Performance statistics
     */
    getPerformanceStatistics() {
        const stats = {
            operations: {},
            alerts: {
                highRiskContent: 0,
                moderationErrors: 0,
                slowOperations: 0,
                highErrorRates: 0
            },
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
            timestamp: new Date().toISOString()
        };
        
        // Convert performance metrics to stats
        for (const [operation, metrics] of this.performanceMetrics.entries()) {
            if (!operation.endsWith('_errors')) {
                stats.operations[operation] = {
                    count: metrics.count,
                    avgTimeMs: Math.round(metrics.avgTime),
                    maxTimeMs: metrics.maxTime,
                    minTimeMs: metrics.minTime === Infinity ? 0 : metrics.minTime
                };
            }
        }
        
        return stats;
    }

    /**
     * Clean up old log entries
     * @returns {Object} Cleanup results
     */
    async cleanupOldLogs() {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);
            
            let cleanedRecords = 0;
            
            // Clean database logs
            if (this.enableDatabaseLogging && this.db) {
                const result = await this.db.execute(
                    'DELETE FROM media_operation_logs WHERE created_at < ?',
                    [cutoffDate.toISOString()]
                );
                cleanedRecords = result.affectedRows || 0;
            }
            
            // Clean file logs
            if (this.enableFileLogging) {
                await this.cleanupOldLogFiles(cutoffDate);
            }
            
            console.log(`🧹 Log cleanup completed: ${cleanedRecords} records cleaned`);
            
            return {
                success: true,
                cleanedRecords,
                cutoffDate: cutoffDate.toISOString()
            };
            
        } catch (error) {
            console.error('❌ Log cleanup failed:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Clean up old log files
     * @param {Date} cutoffDate - Cutoff date for cleanup
     */
    async cleanupOldLogFiles(cutoffDate) {
        try {
            const files = await fs.readdir(this.logDirectory);
            
            for (const file of files) {
                const filePath = path.join(this.logDirectory, file);
                const stats = await fs.stat(filePath);
                
                if (stats.mtime < cutoffDate) {
                    await fs.unlink(filePath);
                    console.log(`🗑️ Cleaned old log file: ${file}`);
                }
            }
            
        } catch (error) {
            console.error('⚠️ Log file cleanup failed:', error.message);
        }
    }
}

module.exports = MediaLogger;