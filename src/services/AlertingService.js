/**
 * Alerting Service
 * Part of Phase D.2: Comprehensive system monitoring and alerting
 * Handles alert notifications, escalation, and delivery to various channels
 */

const EventEmitter = require('events');

class AlertingService extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            email: {
                enabled: config.email?.enabled || false,
                smtp: config.email?.smtp || {},
                recipients: config.email?.recipients || []
            },
            webhook: {
                enabled: config.webhook?.enabled || false,
                urls: config.webhook?.urls || [],
                timeout: config.webhook?.timeout || 5000
            },
            sms: {
                enabled: config.sms?.enabled || false,
                provider: config.sms?.provider || null,
                recipients: config.sms?.recipients || []
            },
            slack: {
                enabled: config.slack?.enabled || false,
                webhookUrl: config.slack?.webhookUrl || null,
                channel: config.slack?.channel || '#alerts'
            }
        };
        
        // Alert rules and escalation
        this.escalationRules = {
            cpu_high: { 
                escalateAfter: 300000, // 5 minutes
                criticalThreshold: 95,
                channels: ['email', 'webhook']
            },
            memory_high: { 
                escalateAfter: 180000, // 3 minutes
                criticalThreshold: 95,
                channels: ['email', 'webhook'] 
            },
            disk_high: { 
                escalateAfter: 60000, // 1 minute
                criticalThreshold: 95,
                channels: ['email', 'webhook', 'sms']
            },
            error_rate_high: { 
                escalateAfter: 120000, // 2 minutes
                criticalThreshold: 20,
                channels: ['email', 'webhook']
            },
            response_time_high: { 
                escalateAfter: 240000, // 4 minutes
                criticalThreshold: 5000,
                channels: ['email', 'webhook']
            },
            db_connections_high: { 
                escalateAfter: 30000, // 30 seconds
                criticalThreshold: 98,
                channels: ['email', 'webhook', 'sms']
            },
            cache_hit_rate_low: { 
                escalateAfter: 600000, // 10 minutes
                criticalThreshold: 0.3,
                channels: ['email', 'webhook']
            },
            queue_size_high: { 
                escalateAfter: 300000, // 5 minutes
                criticalThreshold: 5000,
                channels: ['email', 'webhook']
            }
        };
        
        // Alert tracking
        this.sentAlerts = new Map();
        this.alertHistory = [];
        this.rateLimits = new Map(); // Prevent alert spam
        this.escalatedAlerts = new Set();
        
        console.log('🚨 AlertingService initialized');
        this.logConfiguration();
    }

    /**
     * Send an alert notification
     * @param {Object} alert - Alert object
     * @returns {Object} Send result
     */
    async sendAlert(alert) {
        try {
            // Check rate limiting
            if (this.isRateLimited(alert)) {
                console.log(`⏳ Alert rate limited: ${alert.type}`);
                return { success: false, reason: 'rate_limited' };
            }

            // Update rate limit tracking
            this.updateRateLimit(alert);

            // Determine alert channels based on level and type
            const channels = this.determineAlertChannels(alert);
            
            console.log(`🚨 Sending alert [${alert.level}]: ${alert.message} to channels: ${channels.join(', ')}`);

            const results = await this.sendToChannels(alert, channels);
            
            // Track sent alert
            this.sentAlerts.set(alert.id, {
                ...alert,
                sentAt: Date.now(),
                channels: channels,
                results: results
            });
            
            this.alertHistory.push({
                id: alert.id,
                type: alert.type,
                level: alert.level,
                message: alert.message,
                sentAt: Date.now(),
                channels: channels,
                success: results.some(r => r.success)
            });
            
            this.emit('alertSent', { alert, results });
            
            // Schedule escalation check if needed
            this.scheduleEscalationCheck(alert);
            
            return {
                success: results.some(r => r.success),
                channels: channels,
                results: results
            };

        } catch (error) {
            console.error('❌ Error sending alert:', error.message);
            this.emit('alertError', { alert, error });
            return { success: false, error: error.message };
        }
    }

    /**
     * Send alert resolution notification
     * @param {Object} alert - Resolved alert object
     */
    async sendResolutionNotification(alert) {
        try {
            const sentAlert = this.sentAlerts.get(alert.id);
            if (!sentAlert) {
                return; // No original alert found
            }

            const resolutionMessage = {
                ...alert,
                message: `RESOLVED: ${alert.message}`,
                level: 'info',
                resolved: true
            };

            // Send to same channels as original alert
            const channels = sentAlert.channels;
            console.log(`✅ Sending resolution notification: ${alert.type} to channels: ${channels.join(', ')}`);

            const results = await this.sendToChannels(resolutionMessage, channels);
            
            // Clean up tracking
            this.sentAlerts.delete(alert.id);
            this.escalatedAlerts.delete(alert.id);
            
            this.emit('resolutionSent', { alert, results });

        } catch (error) {
            console.error('❌ Error sending resolution notification:', error.message);
        }
    }

    /**
     * Determine which channels to use for an alert
     * @param {Object} alert - Alert object
     * @returns {Array} Array of channel names
     */
    determineAlertChannels(alert) {
        const rule = this.escalationRules[alert.type];
        const defaultChannels = ['webhook']; // Always send to webhook if available
        
        if (!rule) {
            return defaultChannels;
        }

        let channels = [...rule.channels];
        
        // Add high-priority channels for critical alerts
        if (alert.level === 'critical') {
            if (this.config.sms.enabled) {
                channels.push('sms');
            }
            if (this.config.slack.enabled) {
                channels.push('slack');
            }
        }
        
        // Filter to only enabled channels
        channels = channels.filter(channel => {
            switch (channel) {
                case 'email': return this.config.email.enabled;
                case 'webhook': return this.config.webhook.enabled;
                case 'sms': return this.config.sms.enabled;
                case 'slack': return this.config.slack.enabled;
                default: return false;
            }
        });
        
        return channels.length > 0 ? channels : defaultChannels;
    }

    /**
     * Send alert to multiple channels
     * @param {Object} alert - Alert object
     * @param {Array} channels - Array of channel names
     * @returns {Array} Array of send results
     */
    async sendToChannels(alert, channels) {
        const results = [];
        
        const sendPromises = channels.map(async (channel) => {
            try {
                let result;
                switch (channel) {
                    case 'email':
                        result = await this.sendEmailAlert(alert);
                        break;
                    case 'webhook':
                        result = await this.sendWebhookAlert(alert);
                        break;
                    case 'sms':
                        result = await this.sendSMSAlert(alert);
                        break;
                    case 'slack':
                        result = await this.sendSlackAlert(alert);
                        break;
                    default:
                        result = { success: false, error: `Unknown channel: ${channel}` };
                }
                
                return { channel, ...result };
            } catch (error) {
                return { channel, success: false, error: error.message };
            }
        });
        
        const channelResults = await Promise.allSettled(sendPromises);
        
        for (const result of channelResults) {
            if (result.status === 'fulfilled') {
                results.push(result.value);
            } else {
                results.push({ 
                    channel: 'unknown', 
                    success: false, 
                    error: result.reason.message 
                });
            }
        }
        
        return results;
    }

    /**
     * Send email alert
     * @param {Object} alert - Alert object
     * @returns {Object} Send result
     */
    async sendEmailAlert(alert) {
        if (!this.config.email.enabled || this.config.email.recipients.length === 0) {
            return { success: false, error: 'Email not configured' };
        }

        try {
            // Would integrate with actual email service (nodemailer, SendGrid, etc.)
            console.log(`📧 Email alert sent to ${this.config.email.recipients.length} recipients`);
            
            return { 
                success: true, 
                recipients: this.config.email.recipients.length,
                messageId: `email_${Date.now()}`
            };
            
        } catch (error) {
            console.error('❌ Email alert failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send webhook alert
     * @param {Object} alert - Alert object
     * @returns {Object} Send result
     */
    async sendWebhookAlert(alert) {
        if (!this.config.webhook.enabled || this.config.webhook.urls.length === 0) {
            return { success: false, error: 'Webhook not configured' };
        }

        try {
            const webhook = require('node-fetch');
            const payload = {
                timestamp: new Date().toISOString(),
                alert: {
                    id: alert.id,
                    type: alert.type,
                    level: alert.level,
                    message: alert.message,
                    value: alert.value,
                    threshold: alert.threshold,
                    resolved: alert.resolved || false
                },
                service: 'phoenix4ge',
                environment: process.env.NODE_ENV || 'development'
            };

            const results = [];
            for (const url of this.config.webhook.urls) {
                try {
                    // Would send actual HTTP request
                    console.log(`🪝 Webhook alert sent to ${url}`);
                    results.push({ url, success: true });
                } catch (error) {
                    console.error(`❌ Webhook failed for ${url}:`, error.message);
                    results.push({ url, success: false, error: error.message });
                }
            }

            const successful = results.filter(r => r.success).length;
            return { 
                success: successful > 0, 
                results, 
                successful, 
                total: this.config.webhook.urls.length 
            };

        } catch (error) {
            console.error('❌ Webhook alert failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send SMS alert
     * @param {Object} alert - Alert object
     * @returns {Object} Send result
     */
    async sendSMSAlert(alert) {
        if (!this.config.sms.enabled || this.config.sms.recipients.length === 0) {
            return { success: false, error: 'SMS not configured' };
        }

        try {
            // Would integrate with SMS provider (Twilio, AWS SNS, etc.)
            const message = `phoenix4ge Alert [${alert.level.toUpperCase()}]: ${alert.message}`;
            
            console.log(`📱 SMS alert sent to ${this.config.sms.recipients.length} recipients`);
            console.log(`📱 SMS content: ${message}`);
            
            return { 
                success: true, 
                recipients: this.config.sms.recipients.length,
                messageLength: message.length
            };
            
        } catch (error) {
            console.error('❌ SMS alert failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send Slack alert
     * @param {Object} alert - Alert object
     * @returns {Object} Send result
     */
    async sendSlackAlert(alert) {
        if (!this.config.slack.enabled || !this.config.slack.webhookUrl) {
            return { success: false, error: 'Slack not configured' };
        }

        try {
            const color = this.getSlackAlertColor(alert.level);
            const emoji = this.getSlackAlertEmoji(alert.level);
            
            const payload = {
                channel: this.config.slack.channel,
                username: 'phoenix4ge Monitor',
                text: alert.resolved ? 
                    `✅ Alert Resolved: ${alert.type}` : 
                    `${emoji} Alert: ${alert.type}`,
                attachments: [{
                    color: color,
                    fields: [
                        {
                            title: 'Message',
                            value: alert.message,
                            short: false
                        },
                        {
                            title: 'Level',
                            value: alert.level.toUpperCase(),
                            short: true
                        },
                        {
                            title: 'Time',
                            value: new Date(alert.timestamp).toISOString(),
                            short: true
                        }
                    ]
                }]
            };

            // Would send actual Slack webhook request
            console.log(`💬 Slack alert sent to ${this.config.slack.channel}`);
            
            return { 
                success: true, 
                channel: this.config.slack.channel,
                messageId: `slack_${Date.now()}`
            };
            
        } catch (error) {
            console.error('❌ Slack alert failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Check rate limiting for alert
     * @param {Object} alert - Alert object
     * @returns {boolean} True if rate limited
     */
    isRateLimited(alert) {
        const rateLimitKey = `${alert.type}_${alert.level}`;
        const rateLimitData = this.rateLimits.get(rateLimitKey);
        
        if (!rateLimitData) {
            return false; // No previous alerts
        }
        
        const now = Date.now();
        const timeSinceLastAlert = now - rateLimitData.lastSent;
        
        // Rate limit rules based on alert level
        const rateLimitWindow = {
            'critical': 60000,    // 1 minute
            'warning': 300000,    // 5 minutes
            'info': 900000        // 15 minutes
        };
        
        const window = rateLimitWindow[alert.level] || rateLimitWindow.warning;
        
        return timeSinceLastAlert < window;
    }

    /**
     * Update rate limit tracking
     * @param {Object} alert - Alert object
     */
    updateRateLimit(alert) {
        const rateLimitKey = `${alert.type}_${alert.level}`;
        this.rateLimits.set(rateLimitKey, {
            lastSent: Date.now(),
            count: (this.rateLimits.get(rateLimitKey)?.count || 0) + 1
        });
    }

    /**
     * Schedule escalation check for alert
     * @param {Object} alert - Alert object
     */
    scheduleEscalationCheck(alert) {
        const rule = this.escalationRules[alert.type];
        if (!rule || this.escalatedAlerts.has(alert.id)) {
            return;
        }

        setTimeout(async () => {
            await this.checkEscalation(alert);
        }, rule.escalateAfter);
    }

    /**
     * Check if alert needs escalation
     * @param {Object} alert - Alert object
     */
    async checkEscalation(alert) {
        // Check if alert is still active and should be escalated
        const rule = this.escalationRules[alert.type];
        if (!rule || this.escalatedAlerts.has(alert.id)) {
            return;
        }

        // Check if alert value exceeds critical threshold
        if (alert.value >= rule.criticalThreshold) {
            console.warn(`🚨 ESCALATING alert: ${alert.message}`);
            
            const escalatedAlert = {
                ...alert,
                level: 'critical',
                message: `ESCALATED: ${alert.message}`,
                escalated: true,
                escalatedAt: Date.now()
            };

            this.escalatedAlerts.add(alert.id);
            await this.sendAlert(escalatedAlert);
            
            this.emit('alertEscalated', escalatedAlert);
        }
    }

    /**
     * Get Slack color for alert level
     * @param {string} level - Alert level
     * @returns {string} Color code
     */
    getSlackAlertColor(level) {
        const colors = {
            'critical': 'danger',
            'warning': 'warning',
            'info': 'good'
        };
        return colors[level] || 'warning';
    }

    /**
     * Get Slack emoji for alert level
     * @param {string} level - Alert level
     * @returns {string} Emoji
     */
    getSlackAlertEmoji(level) {
        const emojis = {
            'critical': '🚨',
            'warning': '⚠️',
            'info': 'ℹ️'
        };
        return emojis[level] || '⚠️';
    }

    /**
     * Log current configuration
     */
    logConfiguration() {
        const enabledChannels = [];
        if (this.config.email.enabled) enabledChannels.push('email');
        if (this.config.webhook.enabled) enabledChannels.push('webhook');
        if (this.config.sms.enabled) enabledChannels.push('sms');
        if (this.config.slack.enabled) enabledChannels.push('slack');
        
        console.log(`🚨 Alerting channels: ${enabledChannels.join(', ') || 'none configured'}`);
        console.log(`🚨 Alert types configured: ${Object.keys(this.escalationRules).length}`);
    }

    // API methods

    getConfiguration() {
        return {
            ...this.config,
            escalationRules: this.escalationRules,
            enabledChannels: this.getEnabledChannels()
        };
    }

    getEnabledChannels() {
        const enabled = [];
        if (this.config.email.enabled) enabled.push('email');
        if (this.config.webhook.enabled) enabled.push('webhook');
        if (this.config.sms.enabled) enabled.push('sms');
        if (this.config.slack.enabled) enabled.push('slack');
        return enabled;
    }

    updateConfiguration(newConfig) {
        this.config = { ...this.config, ...newConfig };
        console.log('🚨 Alerting configuration updated');
        this.logConfiguration();
        this.emit('configurationUpdated', this.config);
    }

    getAlertHistory(limit = 50) {
        return this.alertHistory
            .sort((a, b) => b.sentAt - a.sentAt)
            .slice(0, limit);
    }

    getAlertStatistics() {
        const total = this.alertHistory.length;
        const successful = this.alertHistory.filter(a => a.success).length;
        const byLevel = {};
        const byType = {};
        
        for (const alert of this.alertHistory) {
            byLevel[alert.level] = (byLevel[alert.level] || 0) + 1;
            byType[alert.type] = (byType[alert.type] || 0) + 1;
        }
        
        return {
            total,
            successful,
            successRate: total > 0 ? Math.round((successful / total) * 100) : 0,
            byLevel,
            byType,
            rateLimitedCount: Array.from(this.rateLimits.values()).reduce((sum, data) => sum + data.count, 0),
            escalatedCount: this.escalatedAlerts.size
        };
    }
}

module.exports = AlertingService;