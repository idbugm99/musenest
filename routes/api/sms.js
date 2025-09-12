/**
 * SMS API Routes
 * Handles Telnyx SMS operations and webhooks
 */

const express = require('express');
const router = express.Router();
const TelnyxSmsService = require('../../services/TelnyxSmsService');
const { query } = require('../../config/database');

// Initialize SMS service
const smsService = new TelnyxSmsService();

/**
 * POST /api/sms/send
 * Send SMS message
 */
router.post('/send', async (req, res) => {
    try {
        const { to, message, type, metadata = {} } = req.body;

        if (!to || !message) {
            return res.status(400).json({
                success: false,
                error: 'Phone number and message are required'
            });
        }

        const result = await smsService.sendSms(to, message, {
            webhookUrl: process.env.TELNYX_WEBHOOK_URL
        });

        // Log SMS attempt to database
        if (type) {
            await logSmsAttempt({
                type,
                to_number: to,
                message,
                success: result.success,
                message_id: result.messageId,
                error: result.error,
                metadata
            });
        }

        res.json(result);

    } catch (error) {
        console.error('SMS API Error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

/**
 * POST /api/sms/notify/chat-started
 * Send chat started notification to model
 */
router.post('/notify/chat-started', async (req, res) => {
    try {
        const {
            conversationId,
            modelSlug,
            clientName,
            clientEmail,
            initialMessage
        } = req.body;

        if (!conversationId) {
            return res.status(400).json({
                success: false,
                error: 'Conversation ID is required'
            });
        }

        // Get model phone number
        const modelResult = await query(`
            SELECT phone, name, slug 
            FROM models 
            WHERE slug = ? 
            LIMIT 1
        `, [modelSlug]);

        if (modelResult.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Model not found'
            });
        }

        const model = modelResult[0];
        
        if (!model.phone) {
            return res.json({
                success: false,
                error: 'Model has no phone number configured'
            });
        }

        const result = await smsService.sendChatStartedNotification({
            toNumber: model.phone,
            clientName,
            clientEmail,
            initialMessage: initialMessage?.substring(0, 100) + '...',
            conversationId,
            modelSlug
        });

        // Log SMS attempt
        await logSmsAttempt({
            type: 'chat_started',
            conversation_id: conversationId,
            to_number: model.phone,
            message: `Chat started notification for ${clientName}`,
            success: result.success,
            message_id: result.messageId,
            error: result.error,
            metadata: { modelSlug, clientName, clientEmail }
        });

        res.json(result);

    } catch (error) {
        console.error('Chat started SMS notification error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send notification'
        });
    }
});

/**
 * POST /api/sms/notify/new-message
 * Send new message notification
 */
router.post('/notify/new-message', async (req, res) => {
    try {
        const {
            conversationId,
            modelSlug,
            senderName,
            messagePreview,
            recipientType = 'model' // 'model' or 'client'
        } = req.body;

        if (!conversationId || !senderName) {
            return res.status(400).json({
                success: false,
                error: 'Conversation ID and sender name are required'
            });
        }

        let phoneNumber;
        let modelName;

        if (recipientType === 'model') {
            // Get model phone number
            const modelResult = await query(`
                SELECT phone, name 
                FROM models 
                WHERE slug = ? 
                LIMIT 1
            `, [modelSlug]);

            if (modelResult.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Model not found'
                });
            }

            phoneNumber = modelResult[0].phone;
            modelName = modelResult[0].name;
        } else {
            // Get client phone number from conversation
            const conversationResult = await query(`
                SELECT c.phone, m.name as model_name
                FROM conversations conv
                JOIN contacts c ON conv.contact_id = c.id
                JOIN models m ON conv.model_id = m.id
                WHERE conv.id = ?
                LIMIT 1
            `, [conversationId]);

            if (conversationResult.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Conversation not found'
                });
            }

            phoneNumber = conversationResult[0].phone;
            modelName = conversationResult[0].model_name;
        }

        if (!phoneNumber) {
            return res.json({
                success: false,
                error: 'No phone number configured for recipient'
            });
        }

        const result = await smsService.sendChatNotification({
            toNumber: phoneNumber,
            modelName,
            senderName,
            messagePreview: messagePreview?.substring(0, 100),
            conversationId,
            modelSlug
        });

        // Log SMS attempt
        await logSmsAttempt({
            type: 'new_message',
            conversation_id: conversationId,
            to_number: phoneNumber,
            message: `New message notification from ${senderName}`,
            success: result.success,
            message_id: result.messageId,
            error: result.error,
            metadata: { modelSlug, senderName, recipientType }
        });

        res.json(result);

    } catch (error) {
        console.error('New message SMS notification error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send notification'
        });
    }
});

/**
 * POST /api/sms/webhook
 * Handle Telnyx webhooks
 */
router.post('/webhook', async (req, res) => {
    try {
        console.log('📱 Telnyx webhook received:', req.body);

        const result = await smsService.handleIncomingSms(req.body);
        
        // Log webhook
        await query(`
            INSERT INTO sms_webhooks (
                webhook_type, webhook_data, processed_at, success
            ) VALUES (?, ?, NOW(), ?)
        `, [
            req.body.data?.event_type || 'unknown',
            JSON.stringify(req.body),
            result.success
        ]);

        res.json({ success: true });

    } catch (error) {
        console.error('SMS webhook error:', error);
        res.status(500).json({
            success: false,
            error: 'Webhook processing failed'
        });
    }
});

/**
 * GET /api/sms/status
 * Get SMS service status
 */
router.get('/status', (req, res) => {
    res.json({
        success: true,
        enabled: smsService.isEnabled(),
        service: 'telnyx',
        fromNumber: process.env.TELNYX_FROM_NUMBER || null,
        webhookUrl: process.env.TELNYX_WEBHOOK_URL || null
    });
});

/**
 * GET /api/sms/config
 * Get SMS configuration for admin interface
 */
router.get('/config', async (req, res) => {
    try {
        const config = {
            enabled: smsService.isEnabled(),
            testMode: process.env.TELNYX_TEST_MODE === 'true',
            fromNumber: smsService.fromNumber,
            apiKey: process.env.TELNYX_API_KEY ? true : false, // Don't expose actual key
            webhookUrl: process.env.TELNYX_WEBHOOK_URL || '',
            error: smsService.isEnabled() ? null : 'SMS service not configured'
        };

        res.json(config);
    } catch (error) {
        console.error('Error getting SMS config:', error);
        res.status(500).json({ error: 'Failed to get SMS configuration' });
    }
});

/**
 * POST /api/sms/config
 * Update SMS configuration (admin only)
 */
router.post('/config', async (req, res) => {
    try {
        const { apiKey, fromNumber, webhookUrl, testMode } = req.body;

        // Validate phone number format
        if (fromNumber && !fromNumber.match(/^\+[1-9]\d{1,14}$/)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid phone number format. Use E.164 format (e.g., +15551234567)' 
            });
        }

        // Validate webhook URL if provided
        if (webhookUrl && !webhookUrl.match(/^https?:\/\/.+/)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid webhook URL format' 
            });
        }

        // Log configuration update (don't log sensitive data)
        console.log('📱 SMS Configuration Update:', {
            hasApiKey: !!apiKey,
            fromNumber: fromNumber,
            hasWebhookUrl: !!webhookUrl,
            testMode: testMode
        });

        res.json({ 
            success: true, 
            message: 'SMS configuration validated successfully',
            note: 'In production, this would update your environment configuration'
        });

    } catch (error) {
        console.error('Error updating SMS config:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to update SMS configuration' 
        });
    }
});

/**
 * GET /api/sms/test-connection
 * Test SMS service connection
 */
router.get('/test-connection', async (req, res) => {
    try {
        if (!smsService.isEnabled()) {
            return res.json({
                success: false,
                error: 'SMS service is not configured'
            });
        }

        if (smsService.testMode) {
            res.json({
                success: true,
                message: 'Test mode connection successful',
                testMode: true
            });
        } else {
            res.json({
                success: true,
                message: 'API connection test would be performed here',
                testMode: false,
                note: 'Real implementation would test Telnyx API connectivity'
            });
        }

    } catch (error) {
        console.error('Error testing SMS connection:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Connection test failed: ' + error.message 
        });
    }
});

/**
 * POST /api/sms/send-test
 * Send test SMS message
 */
router.post('/send-test', async (req, res) => {
    try {
        const { phoneNumber, message } = req.body;

        if (!phoneNumber || !message) {
            return res.status(400).json({
                success: false,
                error: 'Phone number and message are required'
            });
        }

        // Validate phone number format
        if (!phoneNumber.match(/^\+[1-9]\d{1,14}$/)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid phone number format. Use E.164 format (e.g., +15551234567)'
            });
        }

        // Send test SMS
        const result = await smsService.sendSms(phoneNumber, `[TEST] ${message}`, {
            webhookUrl: process.env.TELNYX_WEBHOOK_URL
        });

        // Log test SMS attempt
        await logSmsAttempt({
            type: 'admin_test',
            to_number: phoneNumber,
            message: `[TEST] ${message}`,
            success: result.success,
            message_id: result.messageId,
            error: result.error,
            metadata: { isTest: true, source: 'admin_interface' }
        });

        res.json(result);

    } catch (error) {
        console.error('Error sending test SMS:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send test SMS: ' + error.message
        });
    }
});

/**
 * GET /api/sms/activity
 * Get SMS activity/history for admin interface
 */
router.get('/activity', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;
        const filter = req.query.filter || 'all'; // all, sent, failed, test

        let whereClause = '';
        const queryParams = [];

        switch (filter) {
            case 'sent':
                whereClause = 'WHERE success = 1';
                break;
            case 'failed':
                whereClause = 'WHERE success = 0';
                break;
            case 'test':
                whereClause = 'WHERE type = "admin_test"';
                break;
            default:
                whereClause = '';
        }

        // Get SMS messages with pagination
        const messages = await query(`
            SELECT id, type, to_number, message, success, message_id, 
                   error_message, created_at, metadata
            FROM sms_log 
            ${whereClause}
            ORDER BY created_at DESC 
            LIMIT ? OFFSET ?
        `, [...queryParams, limit, offset]);

        // Format messages for admin interface
        const formattedMessages = messages.map(msg => ({
            id: msg.id,
            created_at: msg.created_at,
            to_number: msg.to_number,
            message_preview: msg.message ? msg.message.substring(0, 100) : '',
            status: msg.success ? 'sent' : 'failed',
            is_test: msg.type === 'admin_test' || msg.type === 'chat_started',
            telnyx_message_id: msg.message_id,
            error_message: msg.error_message
        }));

        // Get activity metrics for today
        const today = new Date().toISOString().split('T')[0];
        const metrics = await query(`
            SELECT 
                COUNT(*) as total_today,
                COUNT(CASE WHEN success = 1 THEN 1 END) as sent_today,
                COUNT(CASE WHEN success = 0 THEN 1 END) as failed_today,
                COUNT(CASE WHEN type = 'admin_test' THEN 1 END) as test_today
            FROM sms_log 
            WHERE DATE(created_at) = ?
        `, [today]);

        res.json({
            messages: formattedMessages,
            metrics: metrics[0] || {
                total_today: 0,
                sent_today: 0,
                failed_today: 0,
                test_today: 0
            },
            pagination: {
                page,
                limit,
                hasMore: messages.length === limit
            }
        });

    } catch (error) {
        console.error('Error getting SMS activity:', error);
        res.status(500).json({ 
            error: 'Failed to get SMS activity',
            messages: [],
            metrics: {}
        });
    }
});

/**
 * GET /api/sms/message/:id
 * Get detailed message information
 */
router.get('/message/:id', async (req, res) => {
    try {
        const messageId = req.params.id;

        const message = await query(`
            SELECT * FROM sms_log WHERE id = ? LIMIT 1
        `, [messageId]);

        if (message.length === 0) {
            return res.status(404).json({ error: 'Message not found' });
        }

        const messageData = message[0];
        
        // Parse metadata if it exists
        if (messageData.metadata) {
            try {
                messageData.metadata = JSON.parse(messageData.metadata);
            } catch (e) {
                console.error('Error parsing metadata:', e);
            }
        }

        res.json(messageData);

    } catch (error) {
        console.error('Error getting message details:', error);
        res.status(500).json({ error: 'Failed to get message details' });
    }
});

/**
 * GET /api/sms/message/:messageId/status
 * Get message delivery status
 */
router.get('/message/:messageId/status', async (req, res) => {
    try {
        const { messageId } = req.params;
        const result = await smsService.getMessageStatus(messageId);
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to get message status'
        });
    }
});

/**
 * Helper function to log SMS attempts to database
 */
async function logSmsAttempt(data) {
    try {
        await query(`
            INSERT INTO sms_log (
                type, conversation_id, to_number, message, 
                success, message_id, error_message, metadata, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `, [
            data.type,
            data.conversation_id || null,
            data.to_number,
            data.message,
            data.success,
            data.message_id || null,
            data.error || null,
            JSON.stringify(data.metadata || {})
        ]);
    } catch (error) {
        console.error('Failed to log SMS attempt:', error);
    }
}

module.exports = router;