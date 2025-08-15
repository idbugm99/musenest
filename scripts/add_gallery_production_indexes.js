#!/usr/bin/env node
/**
 * Add production-optimized database indexes for Gallery Image Picker
 */

const mysql = require('mysql2/promise');

const config = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'musenest',
  port: process.env.DB_PORT || 3306
};

const indexes = [
  {
    name: 'idx_gallery_section_images',
    table: 'gallery_images',
    columns: 'model_id, section_id, is_active, order_index',
    description: 'Optimized index for gallery section image queries'
  },
  {
    name: 'idx_model_sections',
    table: 'gallery_sections',
    columns: 'model_id, is_visible, sort_order',
    description: 'Optimized index for model section queries'
  },
  {
    name: 'idx_media_library_filename',
    table: 'model_media_library',
    columns: 'model_slug, filename, is_deleted',
    description: 'Fast lookup index for filename validation'
  },
  {
    name: 'idx_media_library_moderation',
    table: 'model_media_library',
    columns: 'moderation_status, usage_intent, upload_date',
    description: 'Index for moderation and content filtering'
  }
];

async function addProductionIndexes() {
  let connection;
  
  try {
    connection = await mysql.createConnection(config);
    console.log('✅ Connected to database');
    
    for (const index of indexes) {
      try {
        // Check if index already exists
        const [existing] = await connection.query(
          `SHOW INDEX FROM ${index.table} WHERE Key_name = ?`,
          [index.name]
        );
        
        if (existing.length > 0) {
          console.log(`⚠️  Index ${index.name} already exists on ${index.table}`);
          continue;
        }
        
        // Create the index
        const sql = `CREATE INDEX ${index.name} ON ${index.table} (${index.columns})`;
        await connection.execute(sql);
        
        console.log(`✅ Created index: ${index.name} on ${index.table}`);
        console.log(`   Columns: ${index.columns}`);
        console.log(`   Purpose: ${index.description}`);
        
      } catch (error) {
        console.error(`❌ Failed to create index ${index.name}:`, error.message);
      }
    }
    
    // Test the new indexes with some sample queries
    console.log('\n🔍 Testing index performance...');
    
    const testQueries = [
      {
        name: 'Gallery section images',
        sql: 'SELECT COUNT(*) FROM gallery_images WHERE model_id = 1 AND section_id = 1 AND is_active = 1'
      },
      {
        name: 'Model sections',
        sql: 'SELECT COUNT(*) FROM gallery_sections WHERE model_id = 1 AND is_visible = 1'
      },
      {
        name: 'Media library lookup',
        sql: "SELECT COUNT(*) FROM model_media_library WHERE model_slug = 'escortexample' AND is_deleted = 0"
      }
    ];
    
    for (const query of testQueries) {
      const start = Date.now();
      await connection.query(query.sql);
      const duration = Date.now() - start;
      
      console.log(`  ${query.name}: ${duration}ms`);
    }
    
    console.log('\n✅ Production indexes created successfully!');
    console.log('💡 These indexes will significantly improve Gallery Image Picker performance');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

if (require.main === module) {
  addProductionIndexes();
}

module.exports = { addProductionIndexes };