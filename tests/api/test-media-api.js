// Quick test of the media API
const db = require('./config/database');

async function testMediaAPI() {
    try {
        console.log('Testing database connection...');
        
        // Test simple query
        const [result] = await db.execute(
            'SELECT COUNT(*) as count FROM media_review_queue WHERE review_status = ?',
            ['pending']
        );
        
        console.log('Count query result:', result);
        
        // Test main query without LIMIT first
        const [items] = await db.execute(`
            SELECT 
                id, model_name, review_status, nudity_score, priority, queue_type, 
                usage_intent, flagged_at, original_path
            FROM media_review_queue 
            WHERE review_status = ?
            ORDER BY flagged_at DESC
        `, ['pending']);
        
        console.log('Items without LIMIT:', items.length, 'items found');
        
        // Now test with LIMIT using string interpolation (not ideal but for testing)
        const [itemsLimited] = await db.execute(`
            SELECT 
                id, model_name, review_status, nudity_score, priority, queue_type, 
                usage_intent, flagged_at, original_path
            FROM media_review_queue 
            WHERE review_status = ?
            ORDER BY flagged_at DESC
            LIMIT 20
        `, ['pending']);
        
        console.log('Items query result:', items.length, 'items found');
        console.log('First item:', items[0]);
        
        process.exit(0);
    } catch (error) {
        console.error('Test failed:', error);
        process.exit(1);
    }
}

testMediaAPI();