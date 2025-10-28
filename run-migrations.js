#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

// Database configuration - matches your existing config
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'phoenix4ge',
    port: process.env.DB_PORT || 3306,
    multipleStatements: true  // Allow multiple SQL statements
};

async function runMigration(filename) {
    console.log(`🔄 Running migration: ${filename}`);
    
    try {
        const connection = await mysql.createConnection(dbConfig);
        const migrationPath = path.join(__dirname, 'migrations', filename);
        const sql = fs.readFileSync(migrationPath, 'utf8');
        
        // Split SQL into individual statements and execute each one
        const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);
        
        for (const statement of statements) {
            const cleanStatement = statement.trim();
            if (cleanStatement && !cleanStatement.startsWith('--')) {
                console.log(`  Executing: ${cleanStatement.substring(0, 60)}...`);
                await connection.execute(cleanStatement);
            }
        }
        
        console.log(`✅ Migration completed: ${filename}`);
        
        await connection.end();
    } catch (error) {
        console.error(`❌ Migration failed: ${filename}`);
        console.error(`Error: ${error.message}`);
        throw error;
    }
}

async function main() {
    console.log('🚀 Starting pose analysis migrations...');
    
    try {
        // Run migrations in order
        await runMigration('012_add_pose_analysis_fields.sql');
        await runMigration('014_add_pose_analysis_to_content_moderation.sql');
        await runMigration('013_update_content_moderation_trigger.sql');
        
        console.log('🎉 All migrations completed successfully!');
        console.log('💡 You can now upload images with full pose analysis data');
        
    } catch (error) {
        console.error('💥 Migration process failed');
        process.exit(1);
    }
}

main();