/**
 * Telnyx SMS Service
 * Handles SMS notifications for chat system
 */

class TelnyxSmsService {
    constructor() {
        this.apiKey = process.env.TELNYX_API_KEY;
        this.fromNumber = process.env.TELNYX_FROM_NUMBER;
        this.testMode = process.env.TELNYX_TEST_MODE === 'true';
        this.baseUrl = this.testMode ? 'http://localhost:12111/v2' : 'https://api.telnyx.com/v2';
        this.enabled = !!(this.apiKey && this.fromNumber) || this.testMode;
        
        if (this.testMode) {
            console.log('📱 Telnyx SMS Service: TEST MODE - All SMS will be simulated');
            this.fromNumber = this.fromNumber || '+15551234567';
        } else if (!this.enabled) {
            console.log('📱 Telnyx SMS Service: Disabled (missing TELNYX_API_KEY or TELNYX_FROM_NUMBER)');
        } else {
            console.log('📱 Telnyx SMS Service: Enabled with number', this.fromNumber);
        }
    }

    /**
     * Check if SMS service is properly configured
     */
    isEnabled() {
        return this.enabled;
    }

    /**
     * Send SMS message
     * @param {string} toNumber - Recipient phone number (E.164 format)
     * @param {string} message - Message text (max 1600 chars)
     * @param {Object} options - Additional options
     */
    async sendSms(toNumber, message, options = {}) {
        if (!this.enabled) {
            console.log('📱 SMS not sent - service disabled:', { to: toNumber, message });
            return { success: false, error: 'SMS service not configured' };
        }

        try {
            // Validate phone number format
            const cleanNumber = this.formatPhoneNumber(toNumber);
            if (!cleanNumber) {
                throw new Error(`Invalid phone number format: ${toNumber}`);
            }

            // Truncate message if too long
            const truncatedMessage = message.length > 1600 
                ? message.substring(0, 1597) + '...' 
                : message;

            // Prepare payload for API call
            const payload = {
                from: this.fromNumber,
                to: cleanNumber,
                text: truncatedMessage,
                messaging_profile_id: options.messagingProfileId || undefined,
                webhook_url: options.webhookUrl || undefined,
                use_profile_webhooks: options.useProfileWebhooks !== false
            };

            // Log the request
            console.log('📱 Sending SMS via', this.testMode ? 'Mock Server' : 'Telnyx API:', { 
                url: this.baseUrl + '/messages',
                from: payload.from, 
                to: payload.to, 
                messageLength: payload.text.length 
            });

            try {
                const response = await fetch(`${this.baseUrl}/messages`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.apiKey || 'mock-api-key'}`,
                        'Content-Type': 'application/json',
                        'User-Agent': 'MuseNest/1.0'
                    },
                    body: JSON.stringify(payload)
                });

                const data = await response.json();

                if (!response.ok) {
                    console.error('📱 SMS API Error:', data);
                    return {
                        success: false,
                        error: data.errors?.[0]?.detail || 'SMS send failed',
                        telnyxResponse: data
                    };
                }

                console.log('📱 SMS sent successfully:', {
                    messageId: data.data.id,
                    status: data.data.status,
                    to: data.data.to
                });

                return {
                    success: true,
                    messageId: data.data.id,
                    status: data.data.status,
                    telnyxResponse: data
                };

            } catch (error) {
                console.error('📱 SMS API Network Error:', error);
                return {
                    success: false,
                    error: error.message || 'Network error sending SMS'
                };
            }


        } catch (error) {
            console.error('📱 SMS Service Error:', error);
            return {
                success: false,
                error: error.message || 'Unknown SMS error'
            };
        }
    }

    /**
     * Send new chat message notification
     * @param {Object} params - Notification parameters
     */
    async sendChatNotification(params) {
        const {
            toNumber,
            modelName,
            senderName,
            messagePreview,
            conversationId,
            modelSlug
        } = params;

        if (!toNumber) {
            console.log('📱 No phone number provided for chat notification');
            return { success: false, error: 'No phone number' };
        }

        // Create notification message
        const message = this.formatChatMessage({
            modelName,
            senderName,
            messagePreview,
            conversationId,
            modelSlug
        });

        return await this.sendSms(toNumber, message, {
            webhookUrl: process.env.TELNYX_WEBHOOK_URL
        });
    }

    /**
     * Send chat started notification to model
     * @param {Object} params - Notification parameters
     */
    async sendChatStartedNotification(params) {
        const {
            toNumber,
            clientName,
            clientEmail,
            initialMessage,
            conversationId,
            modelSlug
        } = params;

        if (!toNumber) {
            return { success: false, error: 'No phone number' };
        }

        const message = `💬 New Chat Started!\n\nClient: ${clientName}\nEmail: ${clientEmail}\n\nMessage: "${initialMessage}"\n\nReply at: ${process.env.BASE_URL || 'https://musenest.com'}/${modelSlug}/chat/${conversationId}`;

        return await this.sendSms(toNumber, message);
    }

    /**
     * Format chat message for SMS
     */
    formatChatMessage(params) {
        const { modelName, senderName, messagePreview, modelSlug } = params;
        
        let message = `💬 ${modelName} - New Message\n\n`;
        message += `From: ${senderName}\n`;
        
        if (messagePreview) {
            const preview = messagePreview.length > 100 
                ? messagePreview.substring(0, 97) + '...' 
                : messagePreview;
            message += `Message: "${preview}"\n`;
        }
        
        message += `\nReply: ${process.env.BASE_URL || 'https://musenest.com'}/${modelSlug}/chat`;
        
        return message;
    }

    /**
     * Format phone number to E.164 format
     * @param {string} phoneNumber - Raw phone number
     * @returns {string|null} - Formatted number or null if invalid
     */
    formatPhoneNumber(phoneNumber) {
        if (!phoneNumber) return null;
        
        // Remove all non-digit characters
        const digits = phoneNumber.replace(/\D/g, '');
        
        // Handle US/Canada numbers
        if (digits.length === 10) {
            return `+1${digits}`;
        }
        
        // Handle international numbers that already include country code
        if (digits.length === 11 && digits.startsWith('1')) {
            return `+${digits}`;
        }
        
        // Handle other international numbers (assume they have country code)
        if (digits.length > 10) {
            return `+${digits}`;
        }
        
        // Invalid format
        return null;
    }

    /**
     * Handle incoming SMS webhooks from Telnyx
     * @param {Object} webhookData - Webhook payload from Telnyx
     */
    async handleIncomingSms(webhookData) {
        try {
            const { data } = webhookData;
            
            if (data.event_type !== 'message.received') {
                return { success: true, message: 'Event ignored' };
            }

            const {
                id: messageId,
                from,
                to,
                text,
                received_at
            } = data.payload;

            console.log('📱 Incoming SMS received:', {
                messageId,
                from,
                to,
                textLength: text?.length
            });

            // Add the incoming SMS response to the active chat conversation
            try {
                const { query } = require('../config/database');
                
                // Find the most recent active conversation for this phone number
                const conversations = await query(`
                    SELECT c.id, c.contact_model_interaction_id, cmi.model_id, cmi.contact_id, m.name as model_name, m.slug as model_slug
                    FROM conversations c
                    JOIN contact_model_interactions cmi ON c.contact_model_interaction_id = cmi.id
                    JOIN models m ON cmi.model_id = m.id OR cmi.model_id = m.slug
                    WHERE m.sms_phone_number = ? AND c.is_live_chat = TRUE
                    ORDER BY c.created_at DESC
                    LIMIT 1
                `, [to]); // 'to' is the phone number that received the SMS (model's phone)

                if (conversations.length > 0) {
                    const conversation = conversations[0];
                    
                    // Insert the SMS response as a message from the model
                    await query(`
                        INSERT INTO messages (
                            conversation_id, message_type, message, 
                            sender_name, sender_email, ip_address, user_agent,
                            is_read_by_contact, is_read_by_model, read_at_contact, read_at_model
                        )
                        VALUES (?, 'internal_note', ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        conversation.id,
                        text,
                        conversation.model_name,
                        null, // no email for SMS
                        'SMS-Bot',
                        'SMS Auto-Response/1.0',
                        false, // Contact hasn't read it yet
                        true,  // Model has "read" their own response
                        null,  // Contact read time
                        new Date() // Model read time
                    ]);

                    // Update conversation timestamps
                    await query(`
                        UPDATE conversations 
                        SET last_seen_by_model = CURRENT_TIMESTAMP, chat_status = 'active'
                        WHERE id = ?
                    `, [conversation.id]);

                    console.log(`📱 SMS response added to conversation ${conversation.id}: "${text}"`);
                } else {
                    console.log('📱 No active conversation found for SMS response, just logging it');
                }
            } catch (dbError) {
                console.error('📱 Error adding SMS response to conversation:', dbError);
                // Continue anyway - don't fail the webhook
            }
            
            console.log('📱 SMS Content:', text);

            return {
                success: true,
                messageId,
                from,
                text
            };

        } catch (error) {
            console.error('📱 Error handling incoming SMS:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get SMS delivery status
     * @param {string} messageId - Telnyx message ID
     */
    async getMessageStatus(messageId) {
        if (!this.enabled) {
            return { success: false, error: 'SMS service not configured' };
        }

        try {
            const response = await fetch(`${this.baseUrl}/messages/${messageId}`, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (!response.ok) {
                return {
                    success: false,
                    error: data.errors?.[0]?.detail || 'Failed to get message status'
                };
            }

            return {
                success: true,
                status: data.data.status,
                details: data.data
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Send email notification to model via SMS
     * @param {Object} params - Email notification parameters
     * @param {string} params.toNumber - Model's phone number
     * @param {string} params.modelName - Model's display name
     * @param {string} params.senderName - Email sender name
     * @param {string} params.senderEmail - Email sender address
     * @param {string} params.subject - Email subject line
     * @param {string} params.messagePreview - Preview of email content
     * @param {number} params.conversationId - Conversation ID for tracking
     * @param {string} params.modelSlug - Model slug for URL generation
     */
    async sendEmailNotification(params) {
        const {
            toNumber,
            modelName,
            senderName,
            senderEmail,
            subject,
            messagePreview,
            conversationId,
            modelSlug
        } = params;

        // Create email notification message
        const message = `📧 New Email for ${modelName}

From: ${senderName} (${senderEmail})
Subject: ${subject}

${messagePreview}

Reply at: https://musenest.com/${modelSlug}/admin/conversations/${conversationId}`;

        console.log('📱 Sending email notification SMS:', {
            to: toNumber,
            from: senderEmail,
            subject: subject.substring(0, 30) + '...',
            conversationId
        });

        return await this.sendSms(toNumber, message, {
            webhookUrl: `https://musenest.com/api/sms/webhook`
        });
    }
}

module.exports = TelnyxSmsService;