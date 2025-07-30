-- Fix risk_level column truncation issue
-- Update the ENUM to handle the values being inserted

-- Check current risk_level column definition
DESCRIBE content_moderation;

-- Update risk_level column to handle all possible values
ALTER TABLE content_moderation 
MODIFY COLUMN risk_level VARCHAR(20) DEFAULT NULL;

-- Also update the media_review_queue table
ALTER TABLE media_review_queue 
MODIFY COLUMN risk_level VARCHAR(20) DEFAULT NULL;

-- Show the updated structure
SELECT 'Risk level columns updated successfully!' as status;