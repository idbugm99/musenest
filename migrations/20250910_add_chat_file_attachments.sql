-- Add Chat File Attachments System
-- Enables file uploads and organized storage for chat conversations

-- Create chat_attachments table for file management
CREATE TABLE IF NOT EXISTS chat_attachments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    conversation_id INT NOT NULL,
    message_id INT DEFAULT NULL,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_type ENUM('image', 'document', 'video', 'audio', 'other') NOT NULL,
    file_size INT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    storage_path TEXT NOT NULL,
    uploaded_by ENUM('contact', 'model') NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_approved BOOLEAN DEFAULT FALSE,
    approval_notes TEXT,
    
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE SET NULL,
    
    INDEX idx_conversation_files (conversation_id, uploaded_at),
    INDEX idx_file_type (file_type, is_approved),
    INDEX idx_approval_queue (is_approved, uploaded_at)
);

-- Add file attachment support to messages table
ALTER TABLE messages ADD COLUMN has_attachments BOOLEAN DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN attachment_count INT DEFAULT 0;

-- Update conversations table to track file activity
ALTER TABLE conversations ADD COLUMN total_files INT DEFAULT 0;
ALTER TABLE conversations ADD COLUMN pending_files INT DEFAULT 0;
ALTER TABLE conversations ADD COLUMN last_file_at TIMESTAMP NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_attachments ON messages(conversation_id, has_attachments);
CREATE INDEX IF NOT EXISTS idx_conversations_files ON conversations(total_files, pending_files);

-- Sample trigger to maintain file counts (optional, can be handled in application)
DELIMITER $$
CREATE TRIGGER IF NOT EXISTS update_file_counts_on_insert
    AFTER INSERT ON chat_attachments
    FOR EACH ROW
BEGIN
    -- Update message attachment count if linked to a message
    IF NEW.message_id IS NOT NULL THEN
        UPDATE messages 
        SET has_attachments = TRUE, 
            attachment_count = attachment_count + 1
        WHERE id = NEW.message_id;
    END IF;
    
    -- Update conversation file counts
    UPDATE conversations 
    SET total_files = total_files + 1,
        pending_files = CASE WHEN NEW.is_approved = FALSE THEN pending_files + 1 ELSE pending_files END,
        last_file_at = NEW.uploaded_at
    WHERE id = NEW.conversation_id;
END$$

CREATE TRIGGER IF NOT EXISTS update_file_counts_on_approval
    AFTER UPDATE ON chat_attachments
    FOR EACH ROW
BEGIN
    -- Update pending count when approval status changes
    IF OLD.is_approved != NEW.is_approved THEN
        UPDATE conversations 
        SET pending_files = CASE 
            WHEN NEW.is_approved = TRUE AND OLD.is_approved = FALSE THEN pending_files - 1
            WHEN NEW.is_approved = FALSE AND OLD.is_approved = TRUE THEN pending_files + 1
            ELSE pending_files
        END
        WHERE id = NEW.conversation_id;
    END IF;
END$$

CREATE TRIGGER IF NOT EXISTS update_file_counts_on_delete
    AFTER DELETE ON chat_attachments
    FOR EACH ROW
BEGIN
    -- Update message attachment count if was linked to a message
    IF OLD.message_id IS NOT NULL THEN
        UPDATE messages 
        SET attachment_count = attachment_count - 1,
            has_attachments = CASE WHEN attachment_count <= 1 THEN FALSE ELSE TRUE END
        WHERE id = OLD.message_id;
    END IF;
    
    -- Update conversation file counts
    UPDATE conversations 
    SET total_files = total_files - 1,
        pending_files = CASE WHEN OLD.is_approved = FALSE THEN pending_files - 1 ELSE pending_files END
    WHERE id = OLD.conversation_id;
END$$

DELIMITER ;

-- Insert some sample configuration for file upload limits
INSERT IGNORE INTO system_settings (setting_key, setting_value, description) VALUES
('file_upload_max_size', '10485760', 'Maximum file upload size in bytes (10MB default)'),
('file_upload_allowed_types', 'image/*,application/pdf,text/*,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'Allowed MIME types for file uploads'),
('file_upload_auto_approve', 'image/jpeg,image/png,image/gif,text/plain', 'File types that are auto-approved'),
('file_upload_storage_quota', '524288000', 'Storage quota per model in bytes (500MB default)');

-- Create view for file management dashboard
CREATE OR REPLACE VIEW chat_files_summary AS
SELECT 
    ca.id,
    ca.conversation_id,
    ca.filename,
    ca.original_filename,
    ca.file_type,
    ca.file_size,
    ca.mime_type,
    ca.uploaded_by,
    ca.uploaded_at,
    ca.is_approved,
    ca.approval_notes,
    c.subject as conversation_subject,
    cmi.model_id,
    cmi.contact_id,
    cont.name as contact_name,
    cont.email as contact_email
FROM chat_attachments ca
JOIN conversations c ON ca.conversation_id = c.id
JOIN contact_model_interactions cmi ON c.contact_model_interaction_id = cmi.id
JOIN contacts cont ON cmi.contact_id = cont.id
ORDER BY ca.uploaded_at DESC;

-- Create view for pending approvals
CREATE OR REPLACE VIEW pending_file_approvals AS
SELECT 
    cfs.*,
    TIMESTAMPDIFF(HOUR, cfs.uploaded_at, NOW()) as hours_pending
FROM chat_files_summary cfs
WHERE cfs.is_approved = FALSE
ORDER BY cfs.uploaded_at ASC;