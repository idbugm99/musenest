/**
 * Add Gallery Performance Indexes
 * Add indexes for optimal gallery library listing performance
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function addGalleryPerformanceIndexes() {
    let connection;
    
    try {
        // Create database connection
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'phoenix4ge',
            charset: 'utf8mb4'
        });

        console.log('📊 Adding gallery performance indexes...');

        // Check existing indexes
        console.log('\n🔍 Checking existing indexes...');
        const [existingIndexes] = await connection.execute(`
            SHOW INDEX FROM model_media_library 
            WHERE Key_name LIKE '%gallery%' OR Key_name LIKE '%picker%' OR Key_name LIKE '%library%'
        `);
        
        console.log(`Found ${existingIndexes.length} existing gallery-related indexes`);
        existingIndexes.forEach(idx => {
            console.log(`  - ${idx.Key_name}: ${idx.Column_name}`);
        });

        // Add composite index for library listing performance
        // This covers the most common query pattern for the picker:
        // WHERE model_slug = ? AND moderation_status IN (...) ORDER BY upload_date DESC
        const libraryIndexName = 'idx_gallery_library_listing';
        
        try {
            console.log(`\n📈 Adding composite index: ${libraryIndexName}`);
            await connection.execute(`
                CREATE INDEX ${libraryIndexName} 
                ON model_media_library (model_slug, moderation_status, upload_date DESC, is_deleted)
            `);
            console.log(`✅ Added index: ${libraryIndexName}`);
        } catch (error) {
            if (error.code === 'ER_DUP_KEYNAME') {
                console.log(`ℹ️  Index ${libraryIndexName} already exists`);
            } else {
                throw error;
            }
        }

        // Add index for filename lookups (used in batch operations)
        const filenameIndexName = 'idx_gallery_filename_lookup';
        
        try {
            console.log(`\n📈 Adding filename lookup index: ${filenameIndexName}`);
            await connection.execute(`
                CREATE INDEX ${filenameIndexName} 
                ON model_media_library (model_slug, filename, is_deleted)
            `);
            console.log(`✅ Added index: ${filenameIndexName}`);
        } catch (error) {
            if (error.code === 'ER_DUP_KEYNAME') {
                console.log(`ℹ️  Index ${filenameIndexName} already exists`);
            } else {
                throw error;
            }
        }

        // Add usage_intent column if it doesn't exist (for future use)
        try {
            console.log(`\n🆕 Adding usage_intent column...`);
            await connection.execute(`
                ALTER TABLE model_media_library 
                ADD COLUMN usage_intent ENUM('public_site', 'paysite', 'private') DEFAULT 'public_site'
                AFTER moderation_status
            `);
            console.log(`✅ Added usage_intent column`);
        } catch (error) {
            if (error.code === 'ER_DUP_FIELDNAME') {
                console.log(`ℹ️  Column usage_intent already exists`);
            } else {
                console.log(`⚠️  Could not add usage_intent column: ${error.message}`);
            }
        }

        // If we successfully added usage_intent, create the optimal index
        try {
            const optimalIndexName = 'idx_gallery_library_optimal';
            console.log(`\n🎯 Adding optimal library index with usage_intent: ${optimalIndexName}`);
            await connection.execute(`
                CREATE INDEX ${optimalIndexName} 
                ON model_media_library (model_slug, moderation_status, usage_intent, upload_date DESC)
            `);
            console.log(`✅ Added optimal index: ${optimalIndexName}`);
        } catch (error) {
            if (error.code === 'ER_DUP_KEYNAME') {
                console.log(`ℹ️  Index ${optimalIndexName} already exists`);
            } else if (error.code === 'ER_BAD_FIELD_ERROR') {
                console.log(`ℹ️  Skipping optimal index (usage_intent column not available)`);
            } else {
                console.log(`⚠️  Could not add optimal index: ${error.message}`);
            }
        }

        // Show final index status
        console.log('\n📊 Final index status:');
        const [finalIndexes] = await connection.execute(`
            SHOW INDEX FROM model_media_library 
            WHERE Key_name LIKE '%gallery%' OR Key_name LIKE '%picker%' OR Key_name LIKE '%library%' OR Key_name LIKE '%optimal%'
        `);
        
        finalIndexes.forEach(idx => {
            console.log(`  ✅ ${idx.Key_name}: ${idx.Column_name} (${idx.Seq_in_index})`);
        });

        // Test the performance
        console.log('\n🚀 Testing query performance...');
        const startTime = Date.now();
        const [testResults] = await connection.execute(`
            SELECT id, filename, moderation_status, upload_date
            FROM model_media_library 
            WHERE model_slug = 'modelexample' 
              AND moderation_status IN ('approved', 'approved_blurred')
              AND is_deleted = 0
            ORDER BY upload_date DESC 
            LIMIT 24
        `);
        const queryTime = Date.now() - startTime;
        
        console.log(`📈 Query returned ${testResults.length} results in ${queryTime}ms`);
        if (queryTime < 50) {
            console.log(`✅ Excellent performance (< 50ms)`);
        } else if (queryTime < 200) {
            console.log(`✅ Good performance (< 200ms)`);
        } else {
            console.log(`⚠️  Consider additional optimization (${queryTime}ms)`);
        }

    } catch (error) {
        console.error('❌ Error adding gallery performance indexes:', error);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// Run the index addition
addGalleryPerformanceIndexes()
    .then(() => {
        console.log('\n✅ Gallery performance indexes added successfully!');
        console.log('🚀 Library API queries should now be significantly faster.');
        process.exit(0);
    })
    .catch(console.error);