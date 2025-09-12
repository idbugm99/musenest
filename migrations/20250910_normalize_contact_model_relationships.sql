-- Normalize Contact-Model Relationships Migration
-- Creates proper many-to-many relationship between contacts and models

-- First, create the contact_model_interactions join table
CREATE TABLE contact_model_interactions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    contact_id INT NOT NULL,
    model_id VARCHAR(50) NOT NULL,
    first_interaction_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_interaction_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    interaction_count INT DEFAULT 1,
    
    -- Foreign key constraints
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
    
    -- Indexes for performance
    INDEX idx_contact_id (contact_id),
    INDEX idx_model_id (model_id),
    INDEX idx_contact_model (contact_id, model_id),
    
    -- Unique constraint to prevent duplicate contact-model pairs
    UNIQUE KEY unique_contact_model (contact_id, model_id)
);

-- Migrate existing data from contacts table to the join table
INSERT INTO contact_model_interactions (contact_id, model_id, first_interaction_at, last_interaction_at)
SELECT 
    id as contact_id,
    model_id,
    created_at as first_interaction_at,
    updated_at as last_interaction_at
FROM contacts 
WHERE model_id IS NOT NULL AND model_id != '';

-- Now update the conversations table to reference the contact_model_interactions
-- Add a contact_model_interaction_id column
ALTER TABLE conversations 
ADD COLUMN contact_model_interaction_id INT AFTER contact_id,
ADD FOREIGN KEY fk_conversation_interaction (contact_model_interaction_id) 
    REFERENCES contact_model_interactions(id) ON DELETE SET NULL;

-- Update existing conversations to link to the new join table
UPDATE conversations c
JOIN contact_model_interactions cmi ON (c.contact_id = cmi.contact_id AND c.model_id = cmi.model_id)
SET c.contact_model_interaction_id = cmi.id
WHERE c.model_id IS NOT NULL AND c.model_id != '';

-- Remove the direct model_id column from contacts table (it's now normalized)
ALTER TABLE contacts DROP COLUMN model_id;

-- Update conversations table - model_id is now redundant since we have the join table reference
-- But we'll keep it for backward compatibility and easier queries
-- ALTER TABLE conversations DROP COLUMN model_id; -- Commented out for now

-- Add unique constraint to prevent duplicate contacts by email
-- ALTER TABLE contacts ADD UNIQUE KEY unique_email (email); -- Commented out - let's discuss this

-- Add some useful indexes for common queries
ALTER TABLE contacts ADD INDEX idx_email_name (email, name);
ALTER TABLE contacts ADD INDEX idx_created_at_desc (created_at DESC);