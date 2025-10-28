/**
 * Conversation Service
 * Unified service for managing conversations across email, SMS, and chat
 * Provides conversation thread management and email integration
 */

const { query } = require('../config/database');
const ClientResolverService = require('./ClientResolverService');
const clientResolver = new ClientResolverService();

class ConversationService {
    
    /**
     * Find or create a conversation for a contact and model
     * This ensures unified threading across all communication methods
     */
    async findOrCreateConversation(contactEmail, modelId, messageType = 'contact_form') {
        try {
            // First, find or create the contact
            let contact = await query(`
                SELECT id, name, email FROM contacts 
                WHERE email = ? 
                ORDER BY created_at DESC 
                LIMIT 1
            `, [contactEmail]);

            let contactId;
            if (contact.length === 0) {
                // Create new contact
                const contactResult = await query(`
                    INSERT INTO contacts (name, email, source, model_id) 
                    VALUES (?, ?, 'email', ?)
                `, [contactEmail.split('@')[0], contactEmail, modelId]);
                contactId = contactResult.insertId;
            } else {
                contactId = contact[0].id;
            }

            // Find or create contact-model interaction
            let interaction = await query(`
                SELECT id FROM contact_model_interactions 
                WHERE contact_id = ? AND model_id = ?
                ORDER BY created_at DESC 
                LIMIT 1
            `, [contactId, modelId]);

            let interactionId;
            if (interaction.length === 0) {
                // Create new interaction
                const interactionResult = await query(`
                    INSERT INTO contact_model_interactions (contact_id, model_id, interaction_count, first_interaction_at, last_interaction_at)
                    VALUES (?, ?, 1, NOW(), NOW())
                `, [contactId, modelId]);
                interactionId = interactionResult.insertId;
            } else {
                interactionId = interaction[0].id;
                // Update interaction count
                await query(`
                    UPDATE contact_model_interactions 
                    SET interaction_count = interaction_count + 1, last_interaction_at = NOW()
                    WHERE id = ?
                `, [interactionId]);
            }

            // Find existing conversation for this interaction
            let conversation = await query(`
                SELECT c.*, cmi.contact_id, cmi.model_id 
                FROM conversations c
                JOIN contact_model_interactions cmi ON c.contact_model_interaction_id = cmi.id
                WHERE cmi.contact_id = ? AND cmi.model_id = ?
                ORDER BY 
                  CASE WHEN c.chat_status = 'active' THEN 1 ELSE 2 END,
                  c.created_at DESC 
                LIMIT 1
            `, [contactId, modelId]);

            let conversationId;
            let chatStatus = 'email_only';
            
            // Determine chat status based on message type
            if (messageType === 'chat_message' || messageType === 'sms_in' || messageType === 'sms_out') {
                chatStatus = 'active';
            }

            if (conversation.length === 0) {
                // Create new conversation
                const conversationResult = await query(`
                    INSERT INTO conversations (
                        contact_model_interaction_id, subject, status, chat_status,
                        is_live_chat, created_at, updated_at
                    ) VALUES (?, ?, 'new', ?, ?, NOW(), NOW())
                `, [
                    interactionId, 
                    `Conversation with ${contactEmail}`,
                    chatStatus,
                    chatStatus !== 'email_only'
                ]);
                conversationId = conversationResult.insertId;
            } else {
                conversationId = conversation[0].id;
                
                // Upgrade conversation to chat if needed
                if (chatStatus === 'active' && conversation[0].chat_status !== 'active') {
                    await query(`
                        UPDATE conversations 
                        SET chat_status = 'active', is_live_chat = TRUE, updated_at = NOW()
                        WHERE id = ?
                    `, [conversationId]);
                }
            }

            return {
                conversationId,
                contactId,
                modelId,
                interactionId,
                isNewConversation: conversation.length === 0
            };

        } catch (error) {
            console.error('Error in findOrCreateConversation:', error);
            throw error;
        }
    }

    /**
     * Add an email message to a conversation thread
     */
    async addEmailMessage({
        conversationId,
        messageType, // 'email_in' or 'email_out'
        subject,
        message,
        senderName,
        senderEmail,
        recipientName,
        recipientEmail,
        emailMessageId, // Email Message-ID header for threading
        ipAddress = null,
        userAgent = null
    }) {
        try {
            // Ensure conversation has client_model_interaction_id
            try {
                const resolver = await clientResolver.resolveOrCreateClient({
                    modelId: recipientName || recipientEmail.split('@')[0],
                    name: senderName,
                    email: senderEmail
                });
                await query(`UPDATE conversations SET client_model_interaction_id = ? WHERE id = ? AND client_model_interaction_id IS NULL`, [resolver.interactionId, conversationId]);
            } catch (e) {
                console.error('Email resolver failed (non-fatal):', e.message);
            }

            const result = await query(`
                INSERT INTO messages (
                    conversation_id, message_type, message_type_extended, subject, message,
                    sender_name, sender_email, recipient_name, recipient_email,
                    email_message_id, ip_address, user_agent,
                    is_read_by_contact, is_read_by_model, 
                    read_at_contact, read_at_model,
                    created_at
                ) VALUES (?, 'email_in', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            `, [
                conversationId,
                messageType,
                subject,
                message,
                senderName,
                senderEmail,
                recipientName,
                recipientEmail,
                emailMessageId,
                ipAddress,
                userAgent,
                messageType === 'email_out',
                messageType === 'email_in',
                messageType === 'email_out' ? new Date() : null,
                messageType === 'email_in' ? null : new Date()
            ]);

            // Update conversation timestamp
            await query(`
                UPDATE conversations 
                SET updated_at = NOW()
                WHERE id = ?
            `, [conversationId]);

            return {
                messageId: result.insertId,
                success: true
            };

        } catch (error) {
            console.error('Error adding email message:', error);
            throw error;
        }
    }

    /**
     * Get conversation history with all message types (email, SMS, chat)
     */
    async getConversationHistory(conversationId, limit = 50, since = null) {
        try {
            let whereClause = 'WHERE conversation_id = ?';
            let params = [conversationId];

            if (since) {
                whereClause += ' AND created_at > ?';
                params.push(since);
            }

            const messages = await query(`
                SELECT 
                    id, message_type, message_type_extended, subject, message,
                    sender_name, sender_email, recipient_name, recipient_email,
                    email_message_id, sms_message_id,
                    is_read_by_contact, is_read_by_model,
                    read_at_contact, read_at_model,
                    created_at, updated_at
                FROM messages
                ${whereClause}
                ORDER BY created_at ASC
                LIMIT ?
            `, [...params, limit]);

            return {
                messages,
                success: true
            };

        } catch (error) {
            console.error('Error getting conversation history:', error);
            throw error;
        }
    }

    /**
     * Search for conversations by email, name, or content
     */
    async searchConversations(searchTerm, modelId = null, limit = 20) {
        try {
            let whereClause = `
                WHERE (
                    cont.email LIKE ? OR 
                    cont.name LIKE ? OR 
                    EXISTS (
                        SELECT 1 FROM messages m 
                        WHERE m.conversation_id = c.id 
                        AND (m.message LIKE ? OR m.subject LIKE ?)
                    )
                )
            `;
            let params = [`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`];

            if (modelId) {
                whereClause += ' AND cmi.model_id = ?';
                params.push(modelId);
            }

            const conversations = await query(`
                SELECT 
                    c.id as conversation_id,
                    c.subject,
                    c.status,
                    c.chat_status,
                    c.is_live_chat,
                    c.created_at,
                    c.updated_at,
                    cont.name as contact_name,
                    cont.email as contact_email,
                    cmi.model_id,
                    COUNT(m.id) as message_count,
                    MAX(m.created_at) as last_message_at
                FROM conversations c
                JOIN contact_model_interactions cmi ON c.contact_model_interaction_id = cmi.id
                JOIN contacts cont ON cmi.contact_id = cont.id
                LEFT JOIN messages m ON c.id = m.conversation_id
                ${whereClause}
                GROUP BY c.id
                ORDER BY c.updated_at DESC
                LIMIT ?
            `, [...params, limit]);

            return {
                conversations,
                success: true
            };

        } catch (error) {
            console.error('Error searching conversations:', error);
            throw error;
        }
    }

    /**
     * Mark messages as read for a specific reader (contact or model)
     */
    async markMessagesAsRead(conversationId, readerType, messageIds = null) {
        try {
            const readField = readerType === 'contact' ? 'is_read_by_contact' : 'is_read_by_model';
            const readAtField = readerType === 'contact' ? 'read_at_contact' : 'read_at_model';

            let whereClause = 'WHERE conversation_id = ?';
            let params = [conversationId];

            if (messageIds && messageIds.length > 0) {
                whereClause += ` AND id IN (${messageIds.map(() => '?').join(',')})`;
                params.push(...messageIds);
            }

            await query(`
                UPDATE messages 
                SET ${readField} = TRUE, ${readAtField} = NOW()
                ${whereClause}
            `, params);

            // Update conversation last seen
            const lastSeenField = readerType === 'contact' ? 'last_seen_by_contact' : 'last_seen_by_model';
            await query(`
                UPDATE conversations 
                SET ${lastSeenField} = NOW()
                WHERE id = ?
            `, [conversationId]);

            return { success: true };

        } catch (error) {
            console.error('Error marking messages as read:', error);
            throw error;
        }
    }

    /**
     * Get conversation statistics for analytics
     */
    async getConversationStats(modelId = null, days = 30) {
        try {
            let whereClause = 'WHERE c.created_at > DATE_SUB(NOW(), INTERVAL ? DAY)';
            let params = [days];

            if (modelId) {
                whereClause += ' AND cmi.model_id = ?';
                params.push(modelId);
            }

            const stats = await query(`
                SELECT 
                    COUNT(DISTINCT c.id) as total_conversations,
                    COUNT(DISTINCT CASE WHEN c.is_live_chat = TRUE THEN c.id END) as chat_conversations,
                    COUNT(DISTINCT CASE WHEN c.chat_status = 'active' THEN c.id END) as active_chats,
                    COUNT(DISTINCT cmi.contact_id) as unique_contacts,
                    COUNT(m.id) as total_messages,
                    COUNT(CASE WHEN m.message_type_extended = 'email_in' THEN 1 END) as email_messages,
                    COUNT(CASE WHEN m.message_type_extended LIKE 'sms_%' THEN 1 END) as sms_messages,
                    COUNT(CASE WHEN m.message_type_extended = 'chat_message' THEN 1 END) as chat_messages
                FROM conversations c
                JOIN contact_model_interactions cmi ON c.contact_model_interaction_id = cmi.id
                LEFT JOIN messages m ON c.id = m.conversation_id
                ${whereClause}
            `, params);

            return {
                stats: stats[0] || {},
                success: true
            };

        } catch (error) {
            console.error('Error getting conversation stats:', error);
            throw error;
        }
    }
}

module.exports = ConversationService;