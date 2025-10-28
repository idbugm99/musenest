const express = require('express');
const { z } = require('zod');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const router = express.Router();

// Database connection - use existing database module
const { query } = require('../../config/database');
const ClientResolverService = require('../../services/ClientResolverService');
const clientResolver = new ClientResolverService();

// Rate limiting - 5 submissions per 15 minutes per IP
const contactRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { error: 'Too many contact submissions. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: async (req, res) => {
    // Log rate limit violations
    await logRateLimit(req.ip, req.path);
    res.status(429).json({ error: 'Too many contact submissions. Please try again later.' });
  }
});

// Validation schema
const contactSchema = z.object({
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(255, 'Name must be less than 255 characters')
    .regex(/^[a-zA-Z\s\-'\.]+$/, 'Name contains invalid characters'),
  
  email: z.string()
    .email('Invalid email address')
    .max(255, 'Email must be less than 255 characters'),
  
  phone: z.string()
    .regex(/^[\+]?[1-9][\d]{0,15}$/, 'Invalid phone number format')
    .optional()
    .or(z.literal('')),
  
  message: z.string()
    .min(10, 'Message must be at least 10 characters')
    .max(5000, 'Message must be less than 5000 characters'),
  
  subject: z.string()
    .min(3, 'Subject must be at least 3 characters')
    .max(255, 'Subject must be less than 255 characters')
    .optional()
    .or(z.literal('')),
  
  preferred_contact: z.enum(['email', 'phone', 'either']).default('email'),
  
  // Consent fields
  consent_marketing: z.boolean().default(false),
  consent_analytics: z.boolean().default(false),
  consent_contact: z.boolean().refine(val => val === true, {
    message: 'You must consent to being contacted to submit this form'
  }),
  
  // Honeypot fields (should be empty)
  website: z.string().max(0, 'Spam detected').optional().or(z.literal('')),
  company: z.string().max(0, 'Spam detected').optional().or(z.literal('')),
  phone_alt: z.string().max(0, 'Spam detected').optional().or(z.literal('')),
  
  // Model context
  model_id: z.string().max(50).optional(),
  
  // Turnstile token (optional if not configured)
  'cf-turnstile-response': z.string().min(1, 'Please complete the security check').optional()
});

// Honeypot field names that should always be empty
const HONEYPOT_FIELDS = ['website', 'company', 'phone_alt'];

// Verify Turnstile token
async function verifyTurnstile(token, ip) {
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: process.env.TURNSTILE_SECRET_KEY,
        response: token,
        remoteip: ip
      })
    });
    
    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error('Turnstile verification error:', error);
    return false;
  }
}

// Log honeypot violations
async function logHoneypot(ip, userAgent, honeypotField, honeypotValue, formData) {
  try {
    await query(`
      INSERT INTO honeypot_logs (ip_address, user_agent, honeypot_field, honeypot_value, form_data)
      VALUES (?, ?, ?, ?, ?)
    `, [ip, userAgent, honeypotField, honeypotValue, JSON.stringify(formData)]);
  } catch (error) {
    console.error('Error logging honeypot violation:', error);
  }
}

// Log rate limit violations
async function logRateLimit(ip, endpoint) {
  try {
    await query(`
      INSERT INTO rate_limits (ip_address, endpoint, attempts, window_start)
      VALUES (?, ?, 1, NOW())
      ON DUPLICATE KEY UPDATE 
        attempts = attempts + 1,
        blocked_until = DATE_ADD(NOW(), INTERVAL 15 MINUTE)
    `, [ip, endpoint]);
  } catch (error) {
    console.error('Error logging rate limit:', error);
  }
}

// Send email notifications
async function sendNotifications(contactData, conversationId) {
  try {
    // Configure nodemailer (adjust for your email provider)
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'localhost',
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    // Send notification to admin
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@phoenix4ge.com';
    const modelInfo = contactData.model_id ? ` for model ${contactData.model_id}` : '';
    
    await transporter.sendMail({
      from: process.env.FROM_EMAIL || adminEmail,
      to: adminEmail,
      subject: `New Contact Form Submission${modelInfo} - ${contactData.subject || 'No Subject'}`,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Conversation ID:</strong> ${conversationId}</p>
        <p><strong>Name:</strong> ${contactData.name}</p>
        <p><strong>Email:</strong> ${contactData.email}</p>
        <p><strong>Phone:</strong> ${contactData.phone || 'Not provided'}</p>
        <p><strong>Preferred Contact:</strong> ${contactData.preferred_contact}</p>
        ${contactData.model_id ? `<p><strong>Model:</strong> ${contactData.model_id}</p>` : ''}
        <p><strong>Subject:</strong> ${contactData.subject || 'No subject'}</p>
        <p><strong>Message:</strong></p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px;">
          ${contactData.message.replace(/\n/g, '<br>')}
        </div>
        
        <h3>Consent Information</h3>
        <p>Marketing: ${contactData.consent_marketing ? 'Yes' : 'No'}</p>
        <p>Analytics: ${contactData.consent_analytics ? 'Yes' : 'No'}</p>
        <p>Contact Form: ${contactData.consent_contact ? 'Yes' : 'No'}</p>
      `
    });

    // Send auto-reply to user
    await transporter.sendMail({
      from: process.env.FROM_EMAIL || adminEmail,
      to: contactData.email,
      subject: `Thank you for your message${modelInfo}`,
      html: `
        <h2>Thank you for contacting us!</h2>
        <p>Hi ${contactData.name},</p>
        <p>We've received your message and will get back to you soon via your preferred contact method: <strong>${contactData.preferred_contact}</strong>.</p>
        <p><strong>Your message:</strong></p>
        <div style="background: #f9f9f9; padding: 10px; border-left: 4px solid #dc2626;">
          ${contactData.message.replace(/\n/g, '<br>')}
        </div>
        <p>Reference ID: ${conversationId}</p>
        <p>Best regards,<br>phoenix4ge Team</p>
      `
    });

  } catch (error) {
    console.error('Error sending email notifications:', error);
    // Don't throw - we still want to save to database even if email fails
  }
}

// Main contact form endpoint
router.post('/submit', contactRateLimit, async (req, res) => {
  try {
    // Check for honeypot violations
    for (const field of HONEYPOT_FIELDS) {
      if (req.body[field] && req.body[field].trim()) {
        await logHoneypot(
          req.ip, 
          req.get('User-Agent'), 
          field, 
          req.body[field], 
          req.body
        );
        return res.status(400).json({ error: 'Invalid submission detected' });
      }
    }

    // Validate input data
    const validationResult = contactSchema.safeParse(req.body);
    if (!validationResult.success) {
      console.error('Contact form validation failed:', validationResult.error.issues);
      return res.status(400).json({
        error: 'Validation failed',
        details: validationResult.error.issues.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }))
      });
    }

    const data = validationResult.data;

    // Verify Turnstile token (only if both secret key and token are present)
    if (process.env.TURNSTILE_SECRET_KEY && data['cf-turnstile-response']) {
      const turnstileValid = await verifyTurnstile(data['cf-turnstile-response'], req.ip);
      if (!turnstileValid) {
        return res.status(400).json({ error: 'Security verification failed' });
      }
    }

    // Check if contact already exists (by email)
    let contactId;
    let isExistingContact = false;
    let existingConversationId = null;
    
    const existingContact = await query(`
      SELECT id, name, email FROM contacts WHERE email = ?
    `, [data.email]);

    if (existingContact.length > 0) {
      // Contact exists, update their info and use existing ID
      contactId = existingContact[0].id;
      isExistingContact = true;
      
      // Check if there's an active live chat conversation for this model
      if (data.model_id) {
        const activeConversation = await query(`
          SELECT c.id, c.chat_status 
          FROM conversations c
          JOIN contact_model_interactions cmi ON c.contact_model_interaction_id = cmi.id
          WHERE cmi.contact_id = ? AND cmi.model_id = ? 
            AND c.is_live_chat = TRUE 
            AND c.chat_status IN ('pending', 'active')
          ORDER BY 
            CASE WHEN c.chat_status = 'active' THEN 1 ELSE 2 END,
            c.created_at DESC 
          LIMIT 1
        `, [contactId, data.model_id]);
        
        if (activeConversation.length > 0) {
          existingConversationId = activeConversation[0].id;
          console.log('📱 Found existing active conversation:', existingConversationId, '- adding message instead of creating new chat');
        }
      }
      
      // Update contact with latest information
      await query(`
        UPDATE contacts 
        SET name = ?, phone = ?, preferred_contact = ?, ip_address = ?, user_agent = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        data.name,
        data.phone || null,
        data.preferred_contact,
        req.ip,
        req.get('User-Agent'),
        contactId
      ]);
    } else {
      // New contact, create record
      const contactResult = await query(`
        INSERT INTO contacts (name, email, phone, preferred_contact, source, ip_address, user_agent)
        VALUES (?, ?, ?, ?, 'contact_form', ?, ?)
      `, [
        data.name,
        data.email,
        data.phone || null,
        data.preferred_contact,
        req.ip,
        req.get('User-Agent')
      ]);
      
      contactId = contactResult.insertId;
    }

    // Handle consent records (only insert if new contact or consents have changed)
    if (!isExistingContact) {
      const consents = [
        { type: 'contact_form', given: data.consent_contact },
        { type: 'marketing', given: data.consent_marketing },
        { type: 'analytics', given: data.consent_analytics }
      ];

      for (const consent of consents) {
        await query(`
          INSERT INTO consents (contact_id, consent_type, consent_given, ip_address)
          VALUES (?, ?, ?, ?)
        `, [contactId, consent.type, consent.given, req.ip]);
      }
    }

    // Handle contact-model interaction (if model_id is provided)
    let contactModelInteractionId = null;
    let isLiveChatEnabled = false;
    let modelInfo = null;
    
    if (data.model_id) {
      // Check model's chat settings
      const modelResult = await query(`
        SELECT id, name, email, phone, chat_enabled, online_status, chat_welcome_message 
        FROM models WHERE slug = ? OR id = ?
      `, [data.model_id, data.model_id]);
      
      if (modelResult.length > 0) {
        modelInfo = modelResult[0];
        isLiveChatEnabled = modelInfo.chat_enabled === 1;
      }
      
      // Check if this contact-model interaction already exists
      const existingInteraction = await query(`
        SELECT id, interaction_count FROM contact_model_interactions 
        WHERE contact_id = ? AND model_id = ?
      `, [contactId, data.model_id]);

      if (existingInteraction.length > 0) {
        // Update existing interaction
        contactModelInteractionId = existingInteraction[0].id;
        await query(`
          UPDATE contact_model_interactions 
          SET interaction_count = interaction_count + 1, last_interaction_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [contactModelInteractionId]);
      } else {
        // Create new contact-model interaction
        const interactionResult = await query(`
          INSERT INTO contact_model_interactions (contact_id, model_id, interaction_count)
          VALUES (?, ?, 1)
        `, [contactId, data.model_id]);
        contactModelInteractionId = interactionResult.insertId;
      }
    }

    let conversationId;
    let isNewConversation = true;
    
    if (existingConversationId) {
      // Use existing active conversation
      conversationId = existingConversationId;
      isNewConversation = false;
      
      // Update conversation timestamp and status
      await query(`
        UPDATE conversations 
        SET last_seen_by_contact = CURRENT_TIMESTAMP, chat_status = 'active'
        WHERE id = ?
      `, [conversationId]);
      
      // Add message to existing conversation via the chat API (to trigger SMS notifications)
      console.log('📱 Adding message to existing conversation via chat API for SMS notifications');
      
      try {
        const response = await fetch(`http://localhost:${process.env.PORT || 3000}/api/chat/send-message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            conversation_id: parseInt(conversationId),
            message: data.message,
            sender_type: 'contact',
            sender_id: contactId?.toString()
          })
        });
        
        const result = await response.json();
        
        if (result.success) {
          console.log('📱 Message added to existing conversation successfully:', result.message_id);
        } else {
          console.error('📱 Failed to add message to existing conversation:', result.error);
          // Fallback to direct message insertion (without SMS notification)
          await insertMessageDirectly();
        }
      } catch (error) {
        console.error('📱 Error calling chat API:', error);
        // Fallback to direct message insertion (without SMS notification)
        await insertMessageDirectly();
      }
    } else {
      // Create new conversation
      const conversationResult = await query(`
        INSERT INTO conversations (
          contact_id, subject, model_id, contact_model_interaction_id, 
          is_live_chat, chat_status, last_seen_by_contact, client_model_interaction_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        contactId,
        data.subject || `Contact from ${data.name}`,
        data.model_id || null, // Keep for backward compatibility
        contactModelInteractionId,
        isLiveChatEnabled,
        isLiveChatEnabled ? 'pending' : 'email_only',
        new Date(), // Contact has seen their own message
        (await clientResolver.resolveOrCreateClient({
          modelId: data.model_id,
          name: data.name,
          email: data.email,
          phone: data.phone
        })).interactionId
      ]);

      conversationId = conversationResult.insertId;
      
      // Insert initial message directly (SMS will be sent via separate notification)
      await insertMessageDirectly();
    }
    
    // Helper function to insert message directly without SMS (used for fallbacks and new conversations)
    async function insertMessageDirectly() {
      await query(`
        INSERT INTO messages (
          conversation_id, message_type, message_type_extended, subject, message, 
          sender_name, sender_email, sender_phone, ip_address, user_agent,
          is_read_by_contact, read_at_contact
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        conversationId,
        'contact_form',
        isLiveChatEnabled ? 'chat_message' : 'contact_form',
        data.subject || `Contact from ${data.name}`,
        data.message,
        data.name,
        data.email,
        data.phone || null,
        req.ip,
        req.get('User-Agent'),
        true, // Contact has read their own message
        new Date()
      ]);
    }

    // Send email notifications (async, don't wait)
    setImmediate(() => sendNotifications(data, conversationId));

    // Send SMS notification if live chat is enabled (async, don't wait)
    // Only send "chat started" notification for new conversations
    // Existing conversations will have SMS sent via the chat API call above
    if (isLiveChatEnabled && modelInfo && isNewConversation) {
      console.log('📱 Sending chat started SMS notification for new conversation:', conversationId);
      setImmediate(() => sendSmsNotification(data, conversationId, modelInfo.id));
    } else if (isLiveChatEnabled && modelInfo && !isNewConversation) {
      console.log('📱 Skipping chat started SMS - using existing conversation with chat API SMS instead');
    }

    res.json({
      success: true,
      message: 'Your message has been sent successfully!',
      conversation_id: conversationId,
      is_live_chat: isLiveChatEnabled,
      chat_status: isLiveChatEnabled ? 'pending' : 'email_only'
    });

  } catch (error) {
    console.error('Contact form error:', error);
    res.status(500).json({
      error: 'An error occurred while processing your request. Please try again.'
    });
  }
});

/**
 * Send SMS notification for new chat started
 */
async function sendSmsNotification(contactData, conversationId, modelId) {
  try {
    // Get model information
    const modelResult = await query(`
      SELECT slug, name FROM models WHERE id = ? LIMIT 1
    `, [modelId]);

    if (modelResult.length === 0) {
      console.log('📱 SMS notification skipped - model not found:', modelId);
      return;
    }

    const model = modelResult[0];

    // Call SMS API to send chat started notification
    const response = await fetch(`http://localhost:${process.env.PORT || 3000}/api/sms/notify/chat-started`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        conversationId,
        modelSlug: model.slug,
        clientName: contactData.name,
        clientEmail: contactData.email,
        initialMessage: contactData.message
      })
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('📱 SMS notification sent successfully for conversation:', conversationId);
    } else {
      console.log('📱 SMS notification failed:', result.error);
    }

  } catch (error) {
    console.error('📱 Error sending SMS notification:', error);
  }
}

module.exports = router;