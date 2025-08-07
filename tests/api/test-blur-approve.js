const express = require('express');
const db = require('./config/database');

const app = express();
app.use(express.json());

app.post('/test-blur-approve/:id', async (req, res) => {
    try {
        const { id } = req.params;
        console.log('=== TEST BLUR APPROVE START ===');
        console.log('Media ID:', id);
        console.log('Request body:', JSON.stringify(req.body, null, 2));
        
        // Get the item
        const [items] = await db.execute(
            'SELECT * FROM media_review_queue WHERE id = ?',
            [id]
        );
        
        if (items.length === 0) {
            return res.status(404).json({ success: false, error: 'Item not found' });
        }
        
        const item = items[0];
        console.log('Found item:', JSON.stringify(item, null, 2));
        
        // Try just the moderation_status update
        console.log('Attempting content_moderation update...');
        console.log('Content moderation ID:', item.content_moderation_id);
        
        await db.execute(`
            UPDATE content_moderation 
            SET moderation_status = 'approved'
            WHERE id = ?
        `, [item.content_moderation_id]);
        
        console.log('SUCCESS: content_moderation updated');
        
        res.json({ success: true, message: 'Test successful' });
        
    } catch (error) {
        console.error('=== ERROR DETAILS ===');
        console.error('Error message:', error.message);
        console.error('Error code:', error.code);
        console.error('SQL state:', error.sqlState);
        console.error('SQL message:', error.sqlMessage);
        console.error('Full error:', error);
        
        res.status(500).json({
            success: false,
            error: 'Test failed',
            details: error.message
        });
    }
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`Test server running on port ${PORT}`);
    console.log('Test with: curl -X POST http://localhost:3001/test-blur-approve/1 -H "Content-Type: application/json" -d "{}"');
});