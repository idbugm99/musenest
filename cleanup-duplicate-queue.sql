-- Clean up duplicate media_review_queue records
-- Keep only the latest record for each content_moderation_id (the one with pose analysis data)

DELETE q1 FROM media_review_queue q1
INNER JOIN media_review_queue q2 
WHERE 
    q1.content_moderation_id = q2.content_moderation_id 
    AND q1.id < q2.id;  -- Keep the newer record (higher ID)