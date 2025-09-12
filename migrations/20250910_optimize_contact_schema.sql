-- Optimize Contact Schema - Remove Redundancy and Tighten Referential Integrity
-- Based on schema analysis and recommendations

-- Step 1: Check if we have a models table (we might need to create it)
-- For now, we'll assume model_id is a string identifier

-- Step 2: Update contact_model_interactions to have proper constraints
-- (Already has the structure we need)

-- Step 3: Since conversations already has contact_model_interaction_id,
-- we can now remove the redundant contact_id and model_id columns

-- First, ensure all existing conversations have contact_model_interaction_id populated
-- (This should already be done from the previous migration)

-- Verify data integrity before removing columns
SELECT 
    'Conversations missing contact_model_interaction_id' as issue,
    COUNT(*) as count
FROM conversations 
WHERE contact_model_interaction_id IS NULL;

-- Remove the redundant columns from conversations table
-- (Keep them for now but add comments to indicate they're deprecated)
-- ALTER TABLE conversations DROP COLUMN contact_id;
-- ALTER TABLE conversations DROP COLUMN model_id;

-- Add some helpful views for common queries
CREATE OR REPLACE VIEW conversation_details AS
SELECT 
    c.id as conversation_id,
    c.subject,
    c.status,
    c.priority,
    c.created_at as conversation_created,
    cmi.contact_id,
    cmi.model_id,
    cmi.interaction_count,
    cmi.first_interaction_at,
    cmi.last_interaction_at,
    cont.name as contact_name,
    cont.email as contact_email,
    cont.phone as contact_phone,
    cont.preferred_contact
FROM conversations c
JOIN contact_model_interactions cmi ON c.contact_model_interaction_id = cmi.id
JOIN contacts cont ON cmi.contact_id = cont.id;

-- View to see all models a contact has interacted with
CREATE OR REPLACE VIEW contact_model_summary AS
SELECT 
    c.id as contact_id,
    c.name as contact_name,
    c.email as contact_email,
    c.created_at as contact_created,
    GROUP_CONCAT(DISTINCT cmi.model_id) as models_contacted,
    COUNT(DISTINCT cmi.model_id) as total_models,
    SUM(cmi.interaction_count) as total_interactions,
    MIN(cmi.first_interaction_at) as first_contact,
    MAX(cmi.last_interaction_at) as last_contact
FROM contacts c
LEFT JOIN contact_model_interactions cmi ON c.id = cmi.contact_id
GROUP BY c.id, c.name, c.email, c.created_at;

-- View to see all contacts for a specific model
CREATE OR REPLACE VIEW model_contact_summary AS
SELECT 
    cmi.model_id,
    COUNT(DISTINCT cmi.contact_id) as unique_contacts,
    COUNT(DISTINCT conv.id) as total_conversations,
    SUM(cmi.interaction_count) as total_interactions,
    MIN(cmi.first_interaction_at) as first_contact,
    MAX(cmi.last_interaction_at) as last_contact
FROM contact_model_interactions cmi
LEFT JOIN conversations conv ON cmi.id = conv.contact_model_interaction_id
GROUP BY cmi.model_id;

-- Add some useful indexes for performance
CREATE INDEX idx_conversations_interaction_id ON conversations(contact_model_interaction_id);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_contact_model_interactions_contact_model ON contact_model_interactions(contact_id, model_id);