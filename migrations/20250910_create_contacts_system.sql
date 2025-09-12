-- Contact Management System Database Schema
-- Creates tables for contact forms, consents, conversations, and messages

-- Main contacts table for lead capture
CREATE TABLE contacts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    preferred_contact ENUM('email', 'phone', 'either') DEFAULT 'email',
    source VARCHAR(100), -- 'contact_form', 'booking_inquiry', etc.
    model_id VARCHAR(50), -- Which model they're contacting
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_email (email),
    INDEX idx_model_id (model_id),
    INDEX idx_created_at (created_at)
);

-- Consent tracking for GDPR/privacy compliance
CREATE TABLE consents (
    id INT PRIMARY KEY AUTO_INCREMENT,
    contact_id INT NOT NULL,
    consent_type ENUM('marketing', 'analytics', 'contact_form') NOT NULL,
    consent_given BOOLEAN NOT NULL DEFAULT FALSE,
    consent_text TEXT, -- The actual consent text shown to user
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
    INDEX idx_contact_consent (contact_id, consent_type)
);

-- Conversation threads (groups related messages)
CREATE TABLE conversations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    contact_id INT NOT NULL,
    subject VARCHAR(255),
    status ENUM('new', 'in_progress', 'resolved', 'closed') DEFAULT 'new',
    priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
    assigned_to VARCHAR(50), -- Admin user handling this conversation
    model_id VARCHAR(50), -- Which model this conversation is about
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
    INDEX idx_contact_id (contact_id),
    INDEX idx_status (status),
    INDEX idx_model_id (model_id),
    INDEX idx_created_at (created_at)
);

-- Individual messages within conversations
CREATE TABLE messages (
    id INT PRIMARY KEY AUTO_INCREMENT,
    conversation_id INT NOT NULL,
    message_type ENUM('contact_form', 'email_in', 'email_out', 'sms_in', 'sms_out', 'internal_note') NOT NULL,
    subject VARCHAR(255),
    message TEXT NOT NULL,
    sender_name VARCHAR(255),
    sender_email VARCHAR(255),
    sender_phone VARCHAR(20),
    recipient_name VARCHAR(255),
    recipient_email VARCHAR(255),
    recipient_phone VARCHAR(20),
    
    -- Metadata
    ip_address VARCHAR(45),
    user_agent TEXT,
    email_message_id VARCHAR(255), -- For tracking email threads
    sms_message_id VARCHAR(255), -- For tracking SMS threads
    
    -- Status tracking
    is_read BOOLEAN DEFAULT FALSE,
    is_spam BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    INDEX idx_conversation_id (conversation_id),
    INDEX idx_message_type (message_type),
    INDEX idx_is_read (is_read),
    INDEX idx_created_at (created_at)
);

-- Honeypot tracking for spam prevention
CREATE TABLE honeypot_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    ip_address VARCHAR(45) NOT NULL,
    user_agent TEXT,
    honeypot_field VARCHAR(100), -- Which honeypot field was filled
    honeypot_value TEXT, -- What value was entered
    form_data JSON, -- The entire form submission for analysis
    blocked BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_ip_address (ip_address),
    INDEX idx_created_at (created_at)
);

-- Rate limiting tracking
CREATE TABLE rate_limits (
    ip_address VARCHAR(45) NOT NULL,
    endpoint VARCHAR(100) NOT NULL,
    attempts INT DEFAULT 1,
    window_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    blocked_until TIMESTAMP NULL,
    
    PRIMARY KEY (ip_address, endpoint),
    INDEX idx_blocked_until (blocked_until)
);