#!/usr/bin/env node

const mysql = require('mysql2/promise');

async function testNullInsert() {
    try {
        const connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root', 
            password: '',
            database: 'musenest'
        });
        
        console.log('Testing explicit NULL insert...');
        
        const query = `
            INSERT INTO content_moderation (
                image_path, original_path, model_id, context_type, nudity_score, flagged
            ) VALUES (?, ?, ?, ?, ?, ?)
        `;
        
        const values = [
            '/test/explicit-null.jpg',
            null,  // explicit NULL
            1,
            'public_gallery', 
            25.5,
            0
        ];
        
        const [result] = await connection.execute(query, values);
        console.log('✅ Explicit NULL insert successful! Insert ID:', result.insertId);
        
        // Clean up
        await connection.execute('DELETE FROM content_moderation WHERE id = ?', [result.insertId]);
        console.log('🧹 Test record cleaned up');
        
        await connection.end();
        
    } catch (error) {
        console.error('❌ Explicit NULL insert failed:', error.message);
    }
}

testNullInsert();