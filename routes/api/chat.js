const express = require('express');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const router = express.Router();

// Database connection
const { query } = require('../../config/database');

// SMS service for notifications
const TelnyxSmsService = require('../../services/TelnyxSmsService');
const smsService = new TelnyxSmsService();

// Client resolver for associating messages with client interactions
const ClientResolverService = require('../../services/ClientResolverService');
const clientResolver = new ClientResolverService();

// Rate limiting for chat messages - more generous than contact forms
const chatRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 messages per minute
  message: { error: 'Too many chat messages. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Validation schemas
const sendMessageSchema = z.object({
  conversation_id: z.number().int().positive(),
  message: z.string().min(1).max(2000),
  sender_type: z.enum(['contact', 'model']),
  sender_id: z.string().optional() // model_id or contact_id
});

const markReadSchema = z.object({
  conversation_id: z.number().int().positive(),
  message_ids: z.array(z.number().int().positive()),
  reader_type: z.enum(['contact', 'model'])
});

// Send a chat message
router.post('/send-message', chatRateLimit, async (req, res) => {
  try {
    const validationResult = sendMessageSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationResult.error.errors
      });
    }

    const { conversation_id, message, sender_type, sender_id } = validationResult.data;

    // Verify conversation exists and is live chat
    const conversation = await query(`
      SELECT c.*, cmi.contact_id, cmi.model_id, m.chat_enabled, m.online_status 
      FROM conversations c
      JOIN contact_model_interactions cmi ON c.contact_model_interaction_id = cmi.id
      LEFT JOIN models m ON cmi.model_id = m.slug OR cmi.model_id = m.id
      WHERE c.id = ? AND c.is_live_chat = TRUE
    `, [conversation_id]);

    if (conversation.length === 0) {
      return res.status(404).json({ error: 'Live chat conversation not found' });
    }

    const conv = conversation[0];

    // Ensure conversation has client_model_interaction_id populated
    if (!conv.client_model_interaction_id) {
      try {
        const resolved = await clientResolver.resolveOrCreateClient({
          modelId: conv.model_id,
          name: null,
          email: conv.contact_email || null,
          phone: null
        });
        await query(`UPDATE conversations SET client_model_interaction_id = ? WHERE id = ?`, [resolved.interactionId, conversation_id]);
      } catch (e) {
        console.error('Failed to resolve client interaction for chat:', e);
      }
    }

    // Insert the message
    const messageResult = await query(`
      INSERT INTO messages (
        conversation_id, message_type, message_type_extended, message, 
        sender_name, sender_email, ip_address, user_agent,
        is_read_by_contact, is_read_by_model, read_at_contact, read_at_model
      )
      VALUES (?, 'internal_note', 'chat_message', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      conversation_id,
      message,
      sender_type === 'model' ? conv.model_id : `Contact ${conv.contact_id}`,
      sender_type === 'model' ? null : conv.contact_email || null,
      req.ip,
      req.get('User-Agent'),
      sender_type === 'contact', // Contact has read their own message
      sender_type === 'model',   // Model has read their own message
      sender_type === 'contact' ? new Date() : null,
      sender_type === 'model' ? new Date() : null
    ]);

    // Update conversation timestamps
    const updateField = sender_type === 'contact' ? 'last_seen_by_contact' : 'last_seen_by_model';
    await query(`
      UPDATE conversations 
      SET ${updateField} = CURRENT_TIMESTAMP, chat_status = 'active'
      WHERE id = ?
    `, [conversation_id]);

    // Get the created message for response
    const createdMessage = await query(`
      SELECT id, message, created_at, is_read_by_contact, is_read_by_model
      FROM messages WHERE id = ?
    `, [messageResult.insertId]);

    // Send SMS notification for new chat message (if model has SMS notifications enabled)
    console.log('📱 Processing ongoing chat message for SMS notification:', { 
      conversation_id, message: message.substring(0, 50), sender_type 
    });
    
    try {
      if (smsService.isEnabled() && sender_type === 'contact') {
        // Get model information for SMS notification
        const modelInfo = await query(`
          SELECT m.id, m.slug, m.name, m.sms_phone_number
          FROM models m
          WHERE m.id = ? OR m.slug = ?
        `, [conversation[0].model_id, conversation[0].model_id]);

        if (modelInfo.length > 0 && modelInfo[0].sms_phone_number) {
          const result = await smsService.sendChatNotification({
            toNumber: modelInfo[0].sms_phone_number,
            modelName: modelInfo[0].name,
            senderName: sender_type === 'model' ? modelInfo[0].name : `Contact ${conversation[0].contact_id}`,
            messagePreview: message,
            conversationId: conversation_id,
            modelSlug: modelInfo[0].slug
          });

          if (result.success) {
            console.log('📱 Chat message SMS notification sent successfully:', result.messageId);
          } else {
            console.error('📱 Failed to send chat message SMS notification:', result.error);
          }
        }
      }
    } catch (smsError) {
      console.error('📱 Error sending chat message SMS notification:', smsError);
      // Don't fail the chat message if SMS fails
    }

    res.json({
      success: true,
      message_id: messageResult.insertId,
      message: createdMessage[0],
      conversation_status: 'active'
    });

  } catch (error) {
    console.error('Chat message error:', error);
    res.status(500).json({
      error: 'An error occurred while sending the message'
    });
  }
});

// Get messages for a conversation
router.get('/messages/:conversation_id', async (req, res) => {
  try {
    const conversationId = parseInt(req.params.conversation_id);
    const since = req.query.since ? new Date(req.query.since) : null;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);

    // Verify conversation access (simplified - in production, add proper auth)
    const conversation = await query(`
      SELECT id, is_live_chat, chat_status FROM conversations 
      WHERE id = ? AND is_live_chat = TRUE
    `, [conversationId]);

    if (conversation.length === 0) {
      return res.status(404).json({ error: 'Live chat conversation not found' });
    }

    let whereClause = 'WHERE conversation_id = ?';
    let params = [conversationId];

    if (since) {
      whereClause += ' AND created_at > ?';
      params.push(since);
    }

    const messages = await query(`
      SELECT 
        id, message, created_at, sender_name, message_type_extended,
        is_read_by_contact, is_read_by_model, read_at_contact, read_at_model
      FROM messages 
      ${whereClause}
      ORDER BY created_at DESC 
      LIMIT ?
    `, [...params, limit]);

    res.json({
      success: true,
      messages: messages.reverse(), // Return in chronological order
      conversation_status: conversation[0].chat_status
    });

  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({
      error: 'An error occurred while fetching messages'
    });
  }
});

// Mark messages as read
router.post('/mark-read', async (req, res) => {
  try {
    const validationResult = markReadSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationResult.error.errors
      });
    }

    const { conversation_id, message_ids, reader_type } = validationResult.data;

    const readField = reader_type === 'contact' ? 'is_read_by_contact' : 'is_read_by_model';
    const readAtField = reader_type === 'contact' ? 'read_at_contact' : 'read_at_model';

    if (message_ids.length > 0) {
      await query(`
        UPDATE messages 
        SET ${readField} = TRUE, ${readAtField} = CURRENT_TIMESTAMP
        WHERE id IN (${message_ids.map(() => '?').join(',')}) AND conversation_id = ?
      `, [...message_ids, conversation_id]);
    }

    // Update conversation last seen
    const lastSeenField = reader_type === 'contact' ? 'last_seen_by_contact' : 'last_seen_by_model';
    await query(`
      UPDATE conversations 
      SET ${lastSeenField} = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [conversation_id]);

    res.json({
      success: true,
      marked_read: message_ids.length
    });

  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({
      error: 'An error occurred while marking messages as read'
    });
  }
});

// Get active chat conversations (for model dashboard)
router.get('/active-conversations', async (req, res) => {
  try {
    const modelId = req.query.model_id;
    
    let whereClause = 'WHERE cd.is_live_chat = TRUE AND cd.chat_status IN ("pending", "active")';
    let params = [];

    if (modelId) {
      whereClause += ' AND cd.model_id = ?';
      params.push(modelId);
    }

    const conversations = await query(`
      SELECT * FROM active_chats cd
      ${whereClause}
      ORDER BY cd.last_message_at DESC
      LIMIT 20
    `, params);

    res.json({
      success: true,
      conversations: conversations
    });

  } catch (error) {
    console.error('Active conversations error:', error);
    res.status(500).json({
      error: 'An error occurred while fetching active conversations'
    });
  }
});

// Update typing status
router.post('/typing', async (req, res) => {
  try {
    const { conversation_id, is_typing, sender_type } = req.body;

    // This could be handled with WebSockets in production
    // For now, just update the database for polling-based solutions
    await query(`
      UPDATE messages 
      SET typing_status = ?, typing_updated_at = CURRENT_TIMESTAMP
      WHERE conversation_id = ? AND sender_name LIKE ?
      ORDER BY created_at DESC LIMIT 1
    `, [
      is_typing ? 'typing' : 'stopped',
      conversation_id,
      sender_type === 'model' ? '%' : 'Contact%'
    ]);

    res.json({ success: true });

  } catch (error) {
    console.error('Typing status error:', error);
    res.status(500).json({
      error: 'An error occurred while updating typing status'
    });
  }
});

module.exports = router;