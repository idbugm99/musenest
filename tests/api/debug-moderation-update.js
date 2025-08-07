const db = require('./config/database');

async function debugModerationUpdate() {
    try {
        console.log('Testing media_review_queue and content_moderation updates...');
        
        // First, check what records exist in media_review_queue
        const [allQueueRecords] = await db.execute(
            'SELECT id, content_moderation_id, review_status FROM media_review_queue LIMIT 5'
        );
        console.log('All queue records:', allQueueRecords);
        
        // Find a media review queue record to test with
        const [queueRecords] = await db.execute(
            'SELECT id, content_moderation_id, review_status FROM media_review_queue LIMIT 1'
        );
        
        if (queueRecords.length === 0) {
            console.log('No records found in media_review_queue table at all');
            return;
        }
        
        const queueRecord = queueRecords[0];
        console.log('Found queue record:', queueRecord);
        
        // Test the media_review_queue update first
        console.log('Testing media_review_queue update...');
        
        const blurSettings = {
            strength: 15,
            opacity: 0.8,
            shape: 'rounded',
            blurredParts: ['genitalia'],
            overlayPositions: { genitalia: { x: 100, y: 100, width: 50, height: 50 } }
        };
        
        await db.execute(`
            UPDATE media_review_queue 
            SET 
                review_status = 'approved_blurred',
                blur_settings = ?,
                blur_applied = TRUE,
                final_location = 'public_blurred',
                file_moved = TRUE,
                moved_at = NOW(),
                admin_notes = ?,
                reviewed_by = ?,
                reviewed_at = NOW(),
                updated_at = NOW()
            WHERE id = ?
        `, [JSON.stringify(blurSettings), 'Test admin notes', 1, queueRecord.id]);
        
        console.log('Media review queue update successful!');
        
        // Now test the content_moderation update
        console.log('Testing content_moderation update...');
        
        await db.execute(`
            UPDATE content_moderation 
            SET 
                moderation_status = ?,
                final_location = ?,
                reviewed_by = ?,
                reviewed_at = NOW()
            WHERE id = ?
        `, ['approved', 'public_blurred', 1, queueRecord.content_moderation_id]);
        
        console.log('Content moderation update successful!');
        
    } catch (error) {
        console.error('Error in debug update:', error);
        console.error('Error code:', error.code);
        console.error('SQL State:', error.sqlState);
        console.error('SQL Message:', error.sqlMessage);
        console.error('Error stack:', error.stack);
    } finally {
        process.exit(0);
    }
}

debugModerationUpdate();