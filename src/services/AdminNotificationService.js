/**
 * Admin Notification Service
 * Part of Phase B.6: Admin Notifications System for Upload Status Updates
 * Handles real-time notifications for admin users about media operations
 */

const EventEmitter = require('events');

class AdminNotificationService extends EventEmitter {
    constructor(dbConnection, options = {}) {
        super();
        this.db = dbConnection;
        
        // Notification configuration
        this.config = {
            enableRealTime: options.enableRealTime !== false,
            enableEmail: options.enableEmail === true,
            enableWebhooks: options.enableWebhooks === true,
            notificationRetentionDays: options.notificationRetentionDays || 30,
            batchSize: options.batchSize || 50,
            maxNotificationsPerHour: options.maxNotificationsPerHour || 100
        };
        
        // Active admin sessions for real-time notifications
        this.activeSessions = new Map(); // sessionId -> { adminUserId, modelSlug, websocket, lastActivity }
        
        // Notification queue for batch processing
        this.notificationQueue = [];
        this.isProcessingQueue = false;
        
        // Rate limiting
        this.notificationCounts = new Map(); // adminUserId -> { count, resetTime }
        
        // Start background processing
        this.startBackgroundProcessing();
        
        console.log('📢 AdminNotificationService initialized');
    }

    /**
     * Start background processing for notifications
     */
    startBackgroundProcessing() {
        // Process notification queue every 5 seconds
        setInterval(() => {
            this.processNotificationQueue();
        }, 5000);
        
        // Clean up old notifications every hour
        setInterval(() => {
            this.cleanupOldNotifications();
        }, 3600000);
        
        // Reset rate limiting counters every hour
        setInterval(() => {
            this.resetRateLimits();
        }, 3600000);
        
        console.log('⏰ Background notification processing started');
    }

    /**
     * Register admin session for real-time notifications
     * @param {string} sessionId - Session ID
     * @param {Object} sessionData - Session data
     */
    registerAdminSession(sessionId, sessionData) {
        this.activeSessions.set(sessionId, {
            adminUserId: sessionData.adminUserId,
            modelSlug: sessionData.modelSlug,
            websocket: sessionData.websocket,
            lastActivity: Date.now(),
            preferences: sessionData.preferences || {}
        });
        
        console.log(`👨‍💼 Admin session registered: ${sessionId} (${sessionData.adminUserId})`);
        
        // Send welcome notification
        this.sendRealTimeNotification(sessionId, {
            type: 'session_connected',
            message: 'Real-time notifications connected',
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Unregister admin session
     * @param {string} sessionId - Session ID
     */
    unregisterAdminSession(sessionId) {
        const session = this.activeSessions.get(sessionId);
        if (session) {
            this.activeSessions.delete(sessionId);
            console.log(`👨‍💼 Admin session unregistered: ${sessionId} (${session.adminUserId})`);
        }
    }

    /**
     * Send upload status notification
     * @param {Object} uploadData - Upload notification data
     */
    async notifyUploadStatus(uploadData) {
        const notification = {
            type: 'upload_status',
            level: uploadData.success ? 'success' : 'error',
            modelSlug: uploadData.modelSlug,
            mediaId: uploadData.mediaId,
            filename: uploadData.filename,
            status: uploadData.success ? 'completed' : 'failed',
            message: uploadData.success 
                ? `Upload completed: ${uploadData.filename}`
                : `Upload failed: ${uploadData.filename} - ${uploadData.error}`,
            details: {
                fileSize: uploadData.fileSize,
                processingTime: uploadData.processingTime,
                watermarkApplied: uploadData.watermarkApplied,
                moderationStatus: uploadData.moderationStatus,
                error: uploadData.error
            },
            timestamp: new Date().toISOString(),
            actionRequired: !uploadData.success,
            priority: uploadData.success ? 'normal' : 'high'
        };
        
        await this.sendNotification(notification);
        console.log(`📤 Upload notification sent: ${uploadData.filename} - ${notification.status}`);
    }

    /**
     * Send moderation result notification
     * @param {Object} moderationData - Moderation notification data
     */
    async notifyModerationResult(moderationData) {
        const notification = {
            type: 'moderation_result',
            level: this.getModerationNotificationLevel(moderationData.moderationStatus),
            modelSlug: moderationData.modelSlug,
            mediaId: moderationData.mediaId,
            filename: moderationData.filename,
            status: moderationData.moderationStatus,
            message: this.getModerationMessage(moderationData),
            details: {
                moderationScore: moderationData.moderationScore,
                riskLevel: moderationData.riskLevel,
                humanReviewRequired: moderationData.humanReviewRequired,
                processingTime: moderationData.processingTime,
                retryAttempts: moderationData.retryAttempts,
                detectedParts: moderationData.detectedParts,
                violationTypes: moderationData.violationTypes
            },
            timestamp: new Date().toISOString(),
            actionRequired: moderationData.humanReviewRequired || moderationData.moderationStatus === 'flagged',
            priority: this.getModerationPriority(moderationData)
        };
        
        await this.sendNotification(notification);
        console.log(`🔍 Moderation notification sent: ${moderationData.filename} - ${moderationData.moderationStatus}`);
    }

    /**
     * Send system alert notification
     * @param {Object} alertData - Alert notification data
     */
    async notifySystemAlert(alertData) {
        const notification = {
            type: 'system_alert',
            level: 'warning',
            modelSlug: alertData.modelSlug,
            alertType: alertData.alertType,
            message: alertData.message,
            details: alertData.details,
            timestamp: new Date().toISOString(),
            actionRequired: true,
            priority: alertData.priority || 'high'
        };
        
        await this.sendNotification(notification);
        console.log(`🚨 System alert sent: ${alertData.alertType} - ${alertData.message}`);
    }

    /**
     * Send error notification
     * @param {Object} errorData - Error notification data
     */
    async notifyError(errorData) {
        const notification = {
            type: 'error',
            level: 'error',
            modelSlug: errorData.modelSlug,
            filename: errorData.filename,
            operation: errorData.operation,
            message: `Error in ${errorData.operation}: ${errorData.error}`,
            details: {
                errorType: errorData.errorType,
                errorStack: errorData.errorStack,
                processingStage: errorData.processingStage,
                retryAttempts: errorData.retryAttempts,
                escalationPriority: errorData.escalationPriority
            },
            timestamp: new Date().toISOString(),
            actionRequired: errorData.requiresManualReview,
            priority: errorData.escalationPriority === 'high' ? 'urgent' : 'high'
        };
        
        await this.sendNotification(notification);
        console.log(`💥 Error notification sent: ${errorData.operation} - ${errorData.error}`);
    }

    /**
     * Send file storage notification
     * @param {Object} storageData - File storage notification data
     */
    async notifyFileStorage(storageData) {
        const notification = {
            type: 'file_storage',
            level: storageData.success ? 'info' : 'warning',
            modelSlug: storageData.modelSlug,
            mediaId: storageData.mediaId,
            filename: storageData.filename,
            operation: storageData.operation,
            message: storageData.success 
                ? `File ${storageData.operation} completed: ${storageData.filename}`
                : `File ${storageData.operation} failed: ${storageData.filename} - ${storageData.error}`,
            details: {
                sourcePath: storageData.sourcePath,
                targetPath: storageData.targetPath,
                moderationStatus: storageData.moderationStatus,
                filesMovedCount: storageData.filesMovedCount,
                backupCreated: storageData.backupPaths ? true : false,
                processingTime: storageData.processingTime,
                error: storageData.error
            },
            timestamp: new Date().toISOString(),
            actionRequired: !storageData.success,
            priority: storageData.success ? 'low' : 'medium'
        };
        
        await this.sendNotification(notification);
        console.log(`📁 Storage notification sent: ${storageData.operation} ${storageData.filename} - ${storageData.success ? 'SUCCESS' : 'FAILED'}`);
    }

    /**
     * Send batch operation status notification
     * @param {Object} batchData - Batch operation notification data
     */
    async notifyBatchOperation(batchData) {
        const notification = {
            type: 'batch_operation',
            level: batchData.errors > 0 ? 'warning' : 'success',
            modelSlug: batchData.modelSlug,
            operation: batchData.operation,
            message: `Batch ${batchData.operation} completed: ${batchData.processed}/${batchData.total} successful`,
            details: {
                totalOperations: batchData.total,
                processedOperations: batchData.processed,
                errorCount: batchData.errors,
                processingTime: batchData.processingTime,
                successRate: Math.round((batchData.processed / batchData.total) * 100)
            },
            timestamp: new Date().toISOString(),
            actionRequired: batchData.errors > 0,
            priority: batchData.errors > batchData.processed ? 'high' : 'normal'
        };
        
        await this.sendNotification(notification);
        console.log(`📦 Batch notification sent: ${batchData.operation} - ${batchData.processed}/${batchData.total} successful`);
    }

    /**
     * Send notification through all configured channels
     * @param {Object} notification - Notification data
     */
    async sendNotification(notification) {
        try {
            // Check rate limiting
            if (!this.checkRateLimit(notification)) {
                console.warn('⚠️ Notification rate limit exceeded, queuing for later');
                this.notificationQueue.push(notification);
                return;
            }
            
            // Store notification in database
            await this.storeNotification(notification);
            
            // Send real-time notifications
            if (this.config.enableRealTime) {
                this.sendRealTimeNotifications(notification);
            }
            
            // Queue for email notifications if enabled
            if (this.config.enableEmail && this.shouldSendEmail(notification)) {
                this.queueEmailNotification(notification);
            }
            
            // Send webhook notifications if enabled
            if (this.config.enableWebhooks && this.shouldSendWebhook(notification)) {
                this.sendWebhookNotification(notification);
            }
            
            // Emit event for other services
            this.emit('notification', notification);
            
        } catch (error) {
            console.error('❌ Error sending notification:', error.message);
        }
    }

    /**
     * Store notification in database
     * @param {Object} notification - Notification data
     */
    async storeNotification(notification) {
        try {
            const insertQuery = `
                INSERT INTO admin_notifications (
                    notification_type, level, model_slug, media_id, filename,
                    message, details, timestamp, action_required, priority,
                    created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            `;
            
            const params = [
                notification.type,
                notification.level,
                notification.modelSlug,
                notification.mediaId,
                notification.filename,
                notification.message,
                JSON.stringify(notification.details),
                notification.timestamp,
                notification.actionRequired ? 1 : 0,
                notification.priority
            ];
            
            await this.db.execute(insertQuery, params);
            
        } catch (error) {
            console.error('⚠️ Failed to store notification:', error.message);
        }
    }

    /**
     * Send real-time notifications to active admin sessions
     * @param {Object} notification - Notification data
     */
    sendRealTimeNotifications(notification) {
        const relevantSessions = this.getRelevantSessions(notification);
        
        for (const [sessionId, session] of relevantSessions) {
            try {
                this.sendRealTimeNotification(sessionId, notification);
            } catch (error) {
                console.error(`⚠️ Failed to send real-time notification to session ${sessionId}:`, error.message);
                // Remove invalid session
                this.activeSessions.delete(sessionId);
            }
        }
    }

    /**
     * Send real-time notification to specific session
     * @param {string} sessionId - Session ID
     * @param {Object} notification - Notification data
     */
    sendRealTimeNotification(sessionId, notification) {
        const session = this.activeSessions.get(sessionId);
        if (!session || !session.websocket) {
            return;
        }
        
        try {
            const message = {
                type: 'notification',
                data: notification,
                sessionId,
                timestamp: new Date().toISOString()
            };
            
            session.websocket.send(JSON.stringify(message));
            session.lastActivity = Date.now();
            
        } catch (error) {
            console.error(`⚠️ WebSocket send failed for session ${sessionId}:`, error.message);
            this.activeSessions.delete(sessionId);
        }
    }

    /**
     * Get admin sessions relevant to notification
     * @param {Object} notification - Notification data
     * @returns {Map} Relevant sessions
     */
    getRelevantSessions(notification) {
        const relevantSessions = new Map();
        
        for (const [sessionId, session] of this.activeSessions) {
            // Include session if it matches the model or is a system-wide notification
            if (!notification.modelSlug || 
                session.modelSlug === notification.modelSlug || 
                session.modelSlug === 'all' ||
                notification.priority === 'urgent') {
                
                // Check notification preferences
                if (this.shouldNotifySession(session, notification)) {
                    relevantSessions.set(sessionId, session);
                }
            }
        }
        
        return relevantSessions;
    }

    /**
     * Check if session should receive notification based on preferences
     * @param {Object} session - Session data
     * @param {Object} notification - Notification data
     * @returns {boolean} Should notify
     */
    shouldNotifySession(session, notification) {
        const preferences = session.preferences || {};
        
        // Always send urgent notifications
        if (notification.priority === 'urgent') {
            return true;
        }
        
        // Check notification type preferences
        if (preferences.disabledTypes && preferences.disabledTypes.includes(notification.type)) {
            return false;
        }
        
        // Check notification level preferences
        if (preferences.minimumLevel) {
            const levelOrder = ['info', 'success', 'warning', 'error'];
            const notificationLevel = levelOrder.indexOf(notification.level);
            const minimumLevel = levelOrder.indexOf(preferences.minimumLevel);
            
            if (notificationLevel < minimumLevel) {
                return false;
            }
        }
        
        return true;
    }

    /**
     * Check rate limiting for notifications
     * @param {Object} notification - Notification data
     * @returns {boolean} Should send notification
     */
    checkRateLimit(notification) {
        // System alerts and urgent notifications bypass rate limiting
        if (notification.type === 'system_alert' || notification.priority === 'urgent') {
            return true;
        }
        
        const now = Date.now();
        const hourMs = 3600000; // 1 hour in milliseconds
        
        // Check global rate limit per admin (if we can determine admin)
        // For now, we'll use a simple global rate limit
        const globalKey = 'global';
        let rateLimitData = this.notificationCounts.get(globalKey);
        
        if (!rateLimitData || now > rateLimitData.resetTime) {
            rateLimitData = { count: 0, resetTime: now + hourMs };
            this.notificationCounts.set(globalKey, rateLimitData);
        }
        
        if (rateLimitData.count >= this.config.maxNotificationsPerHour) {
            return false;
        }
        
        rateLimitData.count++;
        return true;
    }

    /**
     * Process notification queue for rate-limited notifications
     */
    async processNotificationQueue() {
        if (this.isProcessingQueue || this.notificationQueue.length === 0) {
            return;
        }
        
        this.isProcessingQueue = true;
        
        try {
            const batch = this.notificationQueue.splice(0, this.config.batchSize);
            
            for (const notification of batch) {
                if (this.checkRateLimit(notification)) {
                    await this.sendNotification(notification);
                } else {
                    // Put back at front of queue
                    this.notificationQueue.unshift(notification);
                    break; // Stop processing this batch
                }
            }
            
        } catch (error) {
            console.error('❌ Error processing notification queue:', error.message);
        } finally {
            this.isProcessingQueue = false;
        }
    }

    /**
     * Queue email notification for later processing
     * @param {Object} notification - Notification data
     */
    queueEmailNotification(notification) {
        // In a real implementation, this would queue emails
        // For now, just log that we would send an email
        console.log(`📧 Email notification queued: ${notification.type} - ${notification.message}`);
    }

    /**
     * Send webhook notification
     * @param {Object} notification - Notification data
     */
    async sendWebhookNotification(notification) {
        try {
            // In a real implementation, this would send to configured webhooks
            console.log(`🔗 Webhook notification sent: ${notification.type} - ${notification.message}`);
        } catch (error) {
            console.error('⚠️ Webhook notification failed:', error.message);
        }
    }

    /**
     * Determine if notification should be sent via email
     * @param {Object} notification - Notification data
     * @returns {boolean} Should send email
     */
    shouldSendEmail(notification) {
        return notification.priority === 'urgent' || 
               notification.priority === 'high' || 
               notification.type === 'system_alert';
    }

    /**
     * Determine if notification should be sent via webhook
     * @param {Object} notification - Notification data
     * @returns {boolean} Should send webhook
     */
    shouldSendWebhook(notification) {
        return notification.actionRequired || 
               notification.priority === 'urgent' || 
               notification.type === 'system_alert';
    }

    /**
     * Get moderation notification level based on status
     * @param {string} moderationStatus - Moderation status
     * @returns {string} Notification level
     */
    getModerationNotificationLevel(moderationStatus) {
        switch (moderationStatus) {
            case 'approved': return 'success';
            case 'rejected': return 'warning';
            case 'flagged': return 'warning';
            case 'error': return 'error';
            default: return 'info';
        }
    }

    /**
     * Get moderation notification message
     * @param {Object} moderationData - Moderation data
     * @returns {string} Notification message
     */
    getModerationMessage(moderationData) {
        switch (moderationData.moderationStatus) {
            case 'approved':
                return `Content approved: ${moderationData.filename}`;
            case 'rejected':
                return `Content rejected: ${moderationData.filename} (score: ${moderationData.moderationScore})`;
            case 'flagged':
                return `Content flagged for review: ${moderationData.filename}`;
            case 'error':
                return `Moderation failed: ${moderationData.filename}`;
            default:
                return `Moderation update: ${moderationData.filename} -> ${moderationData.moderationStatus}`;
        }
    }

    /**
     * Get moderation notification priority
     * @param {Object} moderationData - Moderation data
     * @returns {string} Notification priority
     */
    getModerationPriority(moderationData) {
        if (moderationData.moderationStatus === 'error') return 'urgent';
        if (moderationData.humanReviewRequired) return 'high';
        if (moderationData.moderationStatus === 'flagged') return 'high';
        if (moderationData.riskLevel === 'high') return 'high';
        return 'normal';
    }

    /**
     * Reset rate limiting counters
     */
    resetRateLimits() {
        this.notificationCounts.clear();
        console.log('🔄 Rate limiting counters reset');
    }

    /**
     * Clean up old notifications
     */
    async cleanupOldNotifications() {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - this.config.notificationRetentionDays);
            
            const result = await this.db.execute(
                'DELETE FROM admin_notifications WHERE created_at < ?',
                [cutoffDate.toISOString()]
            );
            
            const cleanedCount = result.affectedRows || 0;
            if (cleanedCount > 0) {
                console.log(`🧹 Cleaned ${cleanedCount} old notifications`);
            }
            
        } catch (error) {
            console.error('⚠️ Failed to cleanup old notifications:', error.message);
        }
    }

    /**
     * Get notification statistics
     * @param {string} modelSlug - Model slug (optional)
     * @returns {Object} Statistics
     */
    async getNotificationStatistics(modelSlug = null) {
        try {
            let query = `
                SELECT 
                    notification_type,
                    level,
                    COUNT(*) as count,
                    COUNT(CASE WHEN action_required = 1 THEN 1 END) as action_required_count
                FROM admin_notifications
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
            `;
            
            const params = [];
            if (modelSlug) {
                query += ' AND model_slug = ?';
                params.push(modelSlug);
            }
            
            query += ' GROUP BY notification_type, level ORDER BY notification_type, level';
            
            const stats = await this.db.query(query, params);
            
            return {
                success: true,
                statistics: stats || [],
                activeSessions: this.activeSessions.size,
                queuedNotifications: this.notificationQueue.length,
                generatedAt: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('❌ Error getting notification statistics:', error.message);
            return { success: false, error: error.message };
        }
    }
}

module.exports = AdminNotificationService;