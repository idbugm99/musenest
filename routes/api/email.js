/**
 * Email API Routes
 * Handles incoming email webhooks and email integration with conversation threads
 */

const express = require('express');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const router = express.Router();

// Services
const ConversationService = require('../../services/ConversationService');
const TelnyxSmsService = require('../../services/TelnyxSmsService');

const conversationService = new ConversationService();
const smsService = new TelnyxSmsService();

// Rate limiting for email webhooks
const emailWebhookRateLimit = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // 100 emails per minute
    message: { error: 'Too many email webhook requests' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Validation schemas
const incomingEmailSchema = z.object({
    messageId: z.string().optional(),
    from: z.object({
        email: z.string().email(),
        name: z.string().optional()
    }),
    to: z.array(z.object({
        email: z.string().email(),
        name: z.string().optional()
    })),
    subject: z.string(),
    textBody: z.string().optional(),
    htmlBody: z.string().optional(),
    date: z.string().optional(),
    headers: z.record(z.string()).optional()
});

const outgoingEmailSchema = z.object({
    modelId: z.string(),
    recipientEmail: z.string().email(),
    recipientName: z.string().optional(),
    subject: z.string(),
    message: z.string(),
    conversationId: z.number().int().positive().optional()
});

/**
 * Webhook for incoming emails (e.g., from SendGrid, Mailgun, etc.)
 * POST /api/email/webhook/incoming
 */
router.post('/webhook/incoming', emailWebhookRateLimit, async (req, res) => {
    try {
        console.log('📧 Incoming email webhook received:', JSON.stringify(req.body, null, 2));

        const validationResult = incomingEmailSchema.safeParse(req.body);
        if (!validationResult.success) {
            console.error('📧 Email webhook validation failed:', validationResult.error.errors);
            return res.status(400).json({
                error: 'Invalid email webhook payload',
                details: validationResult.error.errors
            });
        }

        const emailData = validationResult.data;
        const { from, to, subject, textBody, htmlBody, messageId, headers } = emailData;

        // Extract model from the recipient email (e.g., modelexample@phoenix4ge.com)
        const modelRecipient = to.find(recipient => 
            recipient.email.includes('@phoenix4ge.com') || 
            recipient.email.includes('your-domain.com') // Add your actual domain
        );

        if (!modelRecipient) {
            console.log('📧 Email not addressed to a model, ignoring');
            return res.json({ success: true, message: 'Email ignored - not for a model' });
        }

        // Extract model ID from email (everything before @)
        const modelId = modelRecipient.email.split('@')[0];
        
        // Use text body if available, otherwise HTML body
        const messageContent = textBody || htmlBody || 'No content';

        // Find or create conversation for this email thread
        const conversationResult = await conversationService.findOrCreateConversation(
            from.email, 
            modelId, 
            'email_in'
        );

        // Add email message to conversation
        await conversationService.addEmailMessage({
            conversationId: conversationResult.conversationId,
            messageType: 'email_in',
            subject: subject,
            message: messageContent,
            senderName: from.name || from.email,
            senderEmail: from.email,
            recipientName: modelRecipient.name || modelId,
            recipientEmail: modelRecipient.email,
            emailMessageId: messageId || `${Date.now()}-${Math.random()}`,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });

        // Send SMS notification if enabled for this model
        console.log('📱 Processing email for SMS notification:', { 
            modelId, 
            from: from.email, 
            subject: subject.substring(0, 50) 
        });

        try {
            if (smsService.isEnabled()) {
                // Get model information for SMS notification
                const { query } = require('../../config/database');
                const modelInfo = await query(`
                    SELECT m.id, m.slug, m.name, m.sms_phone_number
                    FROM models m
                    WHERE m.id = ? OR m.slug = ?
                `, [modelId, modelId]);

                if (modelInfo.length > 0 && modelInfo[0].sms_phone_number) {
                    const result = await smsService.sendEmailNotification({
                        toNumber: modelInfo[0].sms_phone_number,
                        modelName: modelInfo[0].name,
                        senderName: from.name || from.email,
                        senderEmail: from.email,
                        subject: subject,
                        messagePreview: messageContent.substring(0, 100) + (messageContent.length > 100 ? '...' : ''),
                        conversationId: conversationResult.conversationId,
                        modelSlug: modelInfo[0].slug
                    });

                    if (result.success) {
                        console.log('📱 Email SMS notification sent successfully:', result.messageId);
                    } else {
                        console.error('📱 Failed to send email SMS notification:', result.error);
                    }
                }
            }
        } catch (smsError) {
            console.error('📱 Error sending email SMS notification:', smsError);
            // Don't fail the email processing if SMS fails
        }

        res.json({
            success: true,
            conversationId: conversationResult.conversationId,
            messageAdded: true,
            isNewConversation: conversationResult.isNewConversation
        });

    } catch (error) {
        console.error('📧 Error processing incoming email:', error);
        res.status(500).json({
            error: 'An error occurred while processing the email'
        });
    }
});

/**
 * Send outgoing email and add to conversation thread
 * POST /api/email/send
 */
router.post('/send', async (req, res) => {
    try {
        const validationResult = outgoingEmailSchema.safeParse(req.body);
        if (!validationResult.success) {
            return res.status(400).json({
                error: 'Validation failed',
                details: validationResult.error.errors
            });
        }

        const { modelId, recipientEmail, recipientName, subject, message, conversationId } = validationResult.data;

        let finalConversationId = conversationId;

        // If no conversation ID provided, find or create one
        if (!finalConversationId) {
            const conversationResult = await conversationService.findOrCreateConversation(
                recipientEmail, 
                modelId, 
                'email_out'
            );
            finalConversationId = conversationResult.conversationId;
        }

        // Add outgoing email message to conversation
        const messageResult = await conversationService.addEmailMessage({
            conversationId: finalConversationId,
            messageType: 'email_out',
            subject: subject,
            message: message,
            senderName: modelId, // Model is sending
            senderEmail: `${modelId}@phoenix4ge.com`,
            recipientName: recipientName || recipientEmail,
            recipientEmail: recipientEmail,
            emailMessageId: `out-${Date.now()}-${Math.random()}`,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });

        // TODO: Integrate with actual email service (SendGrid, Mailgun, etc.)
        console.log('📧 Email would be sent:', {
            from: `${modelId}@phoenix4ge.com`,
            to: recipientEmail,
            subject: subject,
            message: message.substring(0, 100) + '...'
        });

        res.json({
            success: true,
            messageId: messageResult.messageId,
            conversationId: finalConversationId,
            status: 'queued' // Would be actual status from email service
        });

    } catch (error) {
        console.error('📧 Error sending email:', error);
        res.status(500).json({
            error: 'An error occurred while sending the email'
        });
    }
});

/**
 * Get conversation history with all message types
 * GET /api/email/conversation/:conversationId
 */
router.get('/conversation/:conversationId', async (req, res) => {
    try {
        const conversationId = parseInt(req.params.conversationId);
        const since = req.query.since ? new Date(req.query.since) : null;
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);

        const result = await conversationService.getConversationHistory(conversationId, limit, since);

        if (result.success) {
            res.json({
                success: true,
                messages: result.messages,
                conversationId: conversationId
            });
        } else {
            res.status(404).json({ error: 'Conversation not found' });
        }

    } catch (error) {
        console.error('📧 Error getting conversation history:', error);
        res.status(500).json({
            error: 'An error occurred while fetching conversation history'
        });
    }
});

/**
 * Search conversations across all message types
 * GET /api/email/search?q=searchTerm&modelId=modelId
 */
router.get('/search', async (req, res) => {
    try {
        const searchTerm = req.query.q;
        const modelId = req.query.modelId;
        const limit = Math.min(parseInt(req.query.limit) || 20, 50);

        if (!searchTerm || searchTerm.length < 2) {
            return res.status(400).json({ error: 'Search term must be at least 2 characters' });
        }

        const result = await conversationService.searchConversations(searchTerm, modelId, limit);

        res.json({
            success: true,
            conversations: result.conversations,
            searchTerm: searchTerm
        });

    } catch (error) {
        console.error('📧 Error searching conversations:', error);
        res.status(500).json({
            error: 'An error occurred while searching conversations'
        });
    }
});

/**
 * Get conversation statistics
 * GET /api/email/stats?modelId=modelId&days=30
 */
router.get('/stats', async (req, res) => {
    try {
        const modelId = req.query.modelId;
        const days = Math.min(parseInt(req.query.days) || 30, 365);

        const result = await conversationService.getConversationStats(modelId, days);

        res.json({
            success: true,
            stats: result.stats,
            period: `${days} days`
        });

    } catch (error) {
        console.error('📧 Error getting conversation stats:', error);
        res.status(500).json({
            error: 'An error occurred while fetching conversation stats'
        });
    }
});

module.exports = router;