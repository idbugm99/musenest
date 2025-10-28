-- Add Live Chat System Support
-- Enables hybrid email/chat communication between contacts and models

-- First, check if we have a models table, if not create a simple one for chat settings
CREATE TABLE IF NOT EXISTS models (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    chat_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Add chat feature toggle to models table (ignore errors if columns exist)
ALTER TABLE models ADD COLUMN chat_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE models ADD COLUMN chat_welcome_message TEXT DEFAULT NULL;
ALTER TABLE models ADD COLUMN chat_away_message TEXT DEFAULT NULL;
ALTER TABLE models ADD COLUMN online_status ENUM('online', 'away', 'offline') DEFAULT 'offline';

-- Add live chat flags to conversations table (ignore errors if columns exist)
ALTER TABLE conversations ADD COLUMN is_live_chat BOOLEAN DEFAULT FALSE;
ALTER TABLE conversations ADD COLUMN last_seen_by_model TIMESTAMP NULL;
ALTER TABLE conversations ADD COLUMN last_seen_by_contact TIMESTAMP NULL;
ALTER TABLE conversations ADD COLUMN chat_status ENUM('pending', 'active', 'archived', 'email_only') DEFAULT 'email_only';

-- Enhance messages table for better chat support (ignore errors if columns exist)
ALTER TABLE messages ADD COLUMN message_type_extended ENUM('contact_form', 'email_in', 'email_out', 'sms_in', 'sms_out', 'internal_note', 'chat_message', 'system_message', 'welcome_message', 'away_message') DEFAULT 'contact_form';
ALTER TABLE messages ADD COLUMN is_read_by_model BOOLEAN DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN is_read_by_contact BOOLEAN DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN read_at_model TIMESTAMP NULL;
ALTER TABLE messages ADD COLUMN read_at_contact TIMESTAMP NULL;
ALTER TABLE messages ADD COLUMN typing_status ENUM('typing', 'stopped') DEFAULT NULL;
ALTER TABLE messages ADD COLUMN typing_updated_at TIMESTAMP NULL;

-- Create chat sessions table for WebSocket management (optional for future)
CREATE TABLE IF NOT EXISTS chat_sessions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    conversation_id INT NOT NULL,
    participant_type ENUM('model', 'contact') NOT NULL,
    participant_id VARCHAR(255) NOT NULL, -- model_id or contact_id
    session_id VARCHAR(255) NOT NULL, -- WebSocket session ID
    connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_ping TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    disconnected_at TIMESTAMP NULL,
    
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    INDEX idx_conversation_participant (conversation_id, participant_type),
    INDEX idx_session_id (session_id),
    INDEX idx_last_ping (last_ping)
);

-- Insert some sample models with chat enabled
INSERT IGNORE INTO models (id, name, email, chat_enabled, chat_welcome_message, online_status) VALUES 
('modelexample', 'Model Example', 'modelexample@phoenix4ge.com', TRUE, 'Hi! I\'m online and ready to chat. How can I help you today?', 'online'),
('secondmodel', 'Second Model', 'secondmodel@phoenix4ge.com', FALSE, NULL, 'offline');

-- Update the conversation_details view to include chat information
DROP VIEW IF EXISTS conversation_details;
CREATE VIEW conversation_details AS
SELECT 
    c.id as conversation_id,
    c.subject,
    c.status,
    c.priority,
    c.is_live_chat,
    c.chat_status,
    c.last_seen_by_model,
    c.last_seen_by_contact,
    c.created_at as conversation_created,
    cmi.contact_id,
    cmi.model_id,
    cmi.interaction_count,
    cmi.first_interaction_at,
    cmi.last_interaction_at,
    cont.name as contact_name,
    cont.email as contact_email,
    cont.phone as contact_phone,
    cont.preferred_contact,
    m.name as model_name,
    m.email as model_email,
    m.chat_enabled,
    m.online_status,
    m.chat_welcome_message
FROM conversations c
JOIN contact_model_interactions cmi ON c.contact_model_interaction_id = cmi.id
JOIN contacts cont ON cmi.contact_id = cont.id
LEFT JOIN models m ON cmi.model_id = m.id;

-- Create view for active chat conversations
CREATE OR REPLACE VIEW active_chats AS
SELECT 
    cd.*,
    COUNT(m.id) as unread_messages_model,
    MAX(m.created_at) as last_message_at
FROM conversation_details cd
LEFT JOIN messages m ON cd.conversation_id = m.conversation_id AND m.is_read_by_model = FALSE
WHERE cd.is_live_chat = TRUE AND cd.chat_status IN ('pending', 'active')
GROUP BY cd.conversation_id
ORDER BY last_message_at DESC;

-- Add indexes for chat performance
CREATE INDEX IF NOT EXISTS idx_conversations_live_chat ON conversations(is_live_chat, chat_status);
CREATE INDEX IF NOT EXISTS idx_messages_read_status ON messages(conversation_id, is_read_by_model, is_read_by_contact);
CREATE INDEX IF NOT EXISTS idx_messages_type_extended ON messages(message_type_extended, created_at);
CREATE INDEX IF NOT EXISTS idx_models_chat_enabled ON models(chat_enabled, online_status);