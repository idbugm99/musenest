#!/usr/bin/env node

/**
 * Referral System Migration Runner
 * 
 * This script applies the referral tracking system migration to your MuseNest database.
 * It will create the necessary tables, columns, and sample data for the referral system.
 * 
 * Usage:
 *   node run-referral-migration.js
 * 
 * Requirements:
 *   - MySQL database connection configured in config/database.js
 *   - Sufficient privileges to CREATE TABLE and ALTER TABLE
 */

const fs = require('fs');
const path = require('path');
const db = require('./config/database');

const MIGRATION_FILE = './migrations/018_referral_tracking_system.sql';

async function runMigration() {
    console.log('🚀 Starting Referral System Migration...\n');
    
    try {
        // Check if migration file exists
        const migrationPath = path.resolve(__dirname, MIGRATION_FILE);
        if (!fs.existsSync(migrationPath)) {
            throw new Error(`Migration file not found: ${migrationPath}`);
        }
        
        // Read migration SQL
        console.log('📖 Reading migration file...');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        // Split SQL statements (simple approach)
        const statements = migrationSQL
            .split(/;\s*$/gm)
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && !stmt.startsWith('/*'));
        
        console.log(`📝 Found ${statements.length} SQL statements to execute\n`);
        
        // Execute each statement
        let successCount = 0;
        let skipCount = 0;
        
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            
            try {
                // Skip delimiter statements
                if (statement.includes('DELIMITER')) {
                    console.log(`⚠️  Skipping DELIMITER statement (${i + 1}/${statements.length})`);
                    skipCount++;
                    continue;
                }
                
                console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`);
                
                // Handle trigger creation specially (MySQL specific)
                if (statement.includes('CREATE TRIGGER')) {
                    // Execute trigger as-is
                    await db.execute(statement);
                } else {
                    await db.execute(statement);
                }
                
                successCount++;
                
            } catch (error) {
                // Check if it's a "already exists" error (which we can ignore)
                if (error.message.includes('already exists') || 
                    error.message.includes('Duplicate column name') ||
                    error.message.includes('Duplicate entry')) {
                    console.log(`⚠️  Statement ${i + 1} already applied (${error.message.split(':')[0]})`);
                    skipCount++;
                } else {
                    console.error(`❌ Error executing statement ${i + 1}:`, error.message);
                    console.error(`Statement: ${statement.substring(0, 100)}...`);
                    throw error;
                }
            }
        }
        
        console.log(`\n✅ Migration completed successfully!`);
        console.log(`   - ${successCount} statements executed`);
        console.log(`   - ${skipCount} statements skipped (already applied)`);
        
        // Verify the migration by checking for key tables
        console.log('\n🔍 Verifying migration...');
        
        const [tables] = await db.execute(`
            SELECT TABLE_NAME 
            FROM information_schema.TABLES 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME IN ('referral_codes', 'referral_usage_log', 'referral_campaigns')
        `);
        
        console.log(`✅ Found ${tables.length}/3 referral tables created`);
        
        // Check for new columns
        const [columns] = await db.execute(`
            SELECT COLUMN_NAME 
            FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'users' 
            AND COLUMN_NAME IN ('referral_code_used', 'referred_by_user_id')
        `);
        
        console.log(`✅ Found ${columns.length}/2 referral columns added to users table`);
        
        // Show next steps
        console.log('\n🎉 Referral System Migration Complete!\n');
        console.log('Next steps:');
        console.log('1. Test the API endpoints:');
        console.log('   - POST /api/clients (with referral_code parameter)');
        console.log('   - GET /api/referral-codes/validate/:code');
        console.log('   - POST /api/clients/:id/referral-codes');
        console.log('2. Create some test referral codes');
        console.log('3. Test the signup flow with referral codes');
        console.log('\nAPI Documentation:');
        console.log('- Generate code: POST /api/clients/:id/referral-codes');
        console.log('- Validate code: GET /api/referral-codes/validate/:code'); 
        console.log('- View analytics: GET /api/clients/:id/referral-analytics');
        console.log('\n📚 Check the referral-code-generator.js utility for programmatic access');
        
    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n⚠️  Migration interrupted by user');
    try {
        await db.end();
    } catch (e) {
        // Ignore connection close errors
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n⚠️  Migration terminated');
    try {
        await db.end();
    } catch (e) {
        // Ignore connection close errors
    }
    process.exit(0);
});

// Run migration if called directly
if (require.main === module) {
    runMigration()
        .then(() => {
            console.log('🏁 Migration script completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Migration script failed:', error);
            process.exit(1);
        });
}

module.exports = { runMigration };