/**
 * Telnyx Mock Server
 * Simulates the Telnyx SMS API for testing purposes
 */

const express = require('express');
const app = express();
const port = 12111; // Standard port used by telnyx-mock

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add request logging
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`📡 [${timestamp}] ${req.method} ${req.path}`);
    if (req.method === 'POST' && req.body) {
        console.log('📡 Request body:', JSON.stringify(req.body, null, 2));
    }
    next();
});

// Store messages for inspection
const messageLog = [];

/**
 * POST /v2/messages - Send SMS Message
 * Simulates the Telnyx Messages API
 */
app.post('/v2/messages', (req, res) => {
    console.log('📱 Telnyx Mock Server: Received SMS request');
    
    const { from, to, text, messaging_profile_id, webhook_url } = req.body;
    
    // Validate required fields (like real Telnyx API)
    if (!from || !to || !text) {
        console.log('❌ Missing required fields');
        return res.status(400).json({
            errors: [{
                code: 'missing_required_parameter',
                title: 'Missing required parameter',
                detail: 'from, to, and text are required parameters'
            }]
        });
    }

    // Generate mock message ID
    const messageId = 'mock_' + Math.random().toString(36).substring(2, 15);
    
    // Log the message
    const messageRecord = {
        id: messageId,
        from,
        to,
        text,
        messaging_profile_id,
        webhook_url,
        status: 'queued',
        created_at: new Date().toISOString(),
        received_at: new Date().toISOString()
    };
    
    messageLog.push(messageRecord);
    
    console.log('📱 Mock SMS Message Created:');
    console.log(`   ID: ${messageId}`);
    console.log(`   From: ${from}`);
    console.log(`   To: ${to}`);
    console.log(`   Text: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`);
    
    // Simulate successful Telnyx API response
    const response = {
        data: {
            record_type: 'message',
            id: messageId,
            from: from,
            to: to,
            text: text,
            status: 'queued',
            messaging_profile_id: messaging_profile_id || 'default_profile_id',
            created_at: messageRecord.created_at,
            updated_at: messageRecord.created_at,
            direction: 'outbound',
            webhook_url: webhook_url,
            parts: 1,
            cost: null,
            errors: []
        }
    };

    console.log('✅ Responding with mock success');
    res.json(response);
    
    // Simulate automated response after a short delay
    setTimeout(() => {
        console.log(`📞 Simulating incoming SMS response...`);
        
        // Generate automated response text
        const responses = [
            "Thanks for your message! I received: \"" + text.substring(0, 50) + (text.length > 50 ? '...' : '') + "\"",
            "Hello! I got your message and will respond soon.",
            "Message received! This is an automated response from the mock server.",
            "Hi there! Your message has been received successfully.",
            "Thank you for reaching out! This is a test response from the SMS system."
        ];
        
        const responseText = responses[Math.floor(Math.random() * responses.length)];
        
        // Simulate incoming SMS by making POST request to main server
        const incomingPayload = {
            data: {
                event_type: 'message.received',
                payload: {
                    id: 'mock_incoming_' + Math.random().toString(36).substring(2, 15),
                    from: to, // Response comes from the original 'to' number
                    to: from, // Response goes to the original 'from' number
                    text: responseText,
                    received_at: new Date().toISOString()
                }
            }
        };
        
        console.log(`📱 Mock Server: Sending automated response:`);
        console.log(`   From: ${to}`);
        console.log(`   To: ${from}`);
        console.log(`   Text: ${responseText}`);
        
        // Send the simulated incoming SMS to the main server's webhook endpoint
        fetch('http://localhost:3000/api/sms/webhook', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(incomingPayload)
        })
        .then(response => {
            console.log(`✅ Mock Server: Automated response sent, status: ${response.status}`);
        })
        .catch(error => {
            console.error(`❌ Mock Server: Failed to send automated response:`, error.message);
        });
        
    }, 2000); // Wait 2 seconds before sending response
});

/**
 * GET /v2/messages/:id - Get Message Status
 */
app.get('/v2/messages/:id', (req, res) => {
    const messageId = req.params.id;
    console.log(`📱 Mock Server: Looking up message ${messageId}`);
    
    const message = messageLog.find(msg => msg.id === messageId);
    
    if (!message) {
        return res.status(404).json({
            errors: [{
                code: 'resource_not_found',
                title: 'Resource not found',
                detail: `Message with id '${messageId}' not found`
            }]
        });
    }
    
    // Simulate status progression
    const now = new Date();
    const created = new Date(message.created_at);
    const ageInSeconds = (now - created) / 1000;
    
    let status = 'queued';
    if (ageInSeconds > 2) status = 'sent';
    if (ageInSeconds > 5) status = 'delivered';
    
    const response = {
        data: {
            record_type: 'message',
            id: messageId,
            from: message.from,
            to: message.to,
            text: message.text,
            status: status,
            messaging_profile_id: message.messaging_profile_id || 'default_profile_id',
            created_at: message.created_at,
            updated_at: now.toISOString(),
            direction: 'outbound',
            webhook_url: message.webhook_url,
            parts: 1,
            cost: null,
            errors: []
        }
    };
    
    console.log(`✅ Message ${messageId} status: ${status}`);
    res.json(response);
});

/**
 * GET /mock/messages - Get all messages (for debugging)
 */
app.get('/mock/messages', (req, res) => {
    console.log(`📋 Mock Server: Returning ${messageLog.length} messages`);
    res.json({
        messages: messageLog,
        count: messageLog.length
    });
});

/**
 * DELETE /mock/messages - Clear message log
 */
app.delete('/mock/messages', (req, res) => {
    const count = messageLog.length;
    messageLog.length = 0;
    console.log(`🗑️ Mock Server: Cleared ${count} messages`);
    res.json({ 
        message: `Cleared ${count} messages`,
        count: 0
    });
});

/**
 * GET /mock/health - Health check
 */
app.get('/mock/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'Telnyx Mock Server',
        version: '1.0.0',
        messages_logged: messageLog.length,
        uptime: process.uptime()
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('❌ Mock Server Error:', err);
    res.status(500).json({
        errors: [{
            code: 'internal_server_error',
            title: 'Internal Server Error',
            detail: 'An unexpected error occurred'
        }]
    });
});

// 404 handler
app.use((req, res) => {
    console.log(`❓ Mock Server: 404 for ${req.method} ${req.path}`);
    res.status(404).json({
        errors: [{
            code: 'resource_not_found',
            title: 'Resource not found',
            detail: `Endpoint ${req.method} ${req.path} not found`
        }]
    });
});

// Start server
app.listen(port, () => {
    console.log('🚀 Telnyx Mock Server Started');
    console.log(`📍 Server running on port ${port}`);
    console.log(`🔗 Health check: http://localhost:${port}/mock/health`);
    console.log(`📱 SMS endpoint: http://localhost:${port}/v2/messages`);
    console.log('📋 Message log: http://localhost:${port}/mock/messages');
    console.log('');
    console.log('Ready to receive SMS requests!');
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down Telnyx Mock Server...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down Telnyx Mock Server...');
    process.exit(0);
});