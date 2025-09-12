-- Add SMS phone number field to models table for SMS notifications
-- This allows models to receive SMS notifications for emails and chats

ALTER TABLE models ADD COLUMN sms_phone_number VARCHAR(20) DEFAULT NULL;

-- Add index for SMS phone number lookups
CREATE INDEX IF NOT EXISTS idx_models_sms_phone ON models(sms_phone_number);

-- Update existing models with test SMS numbers
UPDATE models 
SET sms_phone_number = '+15551234567'
WHERE id IN ('modelexample', 'secondmodel') AND sms_phone_number IS NULL;

-- Add comments to document the field
ALTER TABLE models MODIFY COLUMN sms_phone_number VARCHAR(20) 
COMMENT 'SMS phone number for email and chat notifications (E.164 format)';