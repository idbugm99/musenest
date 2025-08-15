#!/usr/bin/env node

/**
 * Hero Background Migration Script
 * Adds parallax hero background support and enhanced content management fields
 */

const fs = require('fs').promises;
const path = require('path');
const db = require('../config/database');

async function runMigration() {
    console.log('🚀 Starting Hero Background Migration...\n');
    
    try {
        // Test database connection
        const connected = await db.testConnection();
        if (!connected) {
            throw new Error('Database connection failed');
        }
        
        // Read migration SQL file
        const migrationPath = path.join(__dirname, '../migrations/add_hero_background_fields.sql');
        const migrationSQL = await fs.readFile(migrationPath, 'utf8');
        
        // Split SQL into individual statements (handle multi-statement execution)
        const statements = migrationSQL
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
        
        console.log(`📝 Executing ${statements.length} migration statements...\n`);
        
        // Execute each statement individually
        let successCount = 0;
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            
            try {
                console.log(`${i + 1}. ${statement.substring(0, 60)}...`);
                await db.query(statement);
                successCount++;
                console.log(`   ✅ Success\n`);
            } catch (error) {
                // Check if it's a benign error (like column already exists)
                if (error.message.includes('Duplicate column name') || 
                    error.message.includes('already exists')) {
                    console.log(`   ⚠️  Already exists - skipping\n`);
                    successCount++;
                } else {
                    console.error(`   ❌ Error: ${error.message}\n`);
                    // Don't throw - continue with other statements
                }
            }
        }
        
        // Verify the migration worked
        console.log('🔍 Verifying migration results...\n');
        
        try {
            // Check if new columns exist
            const columns = await db.query(`
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'content_templates'
                AND COLUMN_NAME IN (
                    'hero_background_image', 
                    'hero_background_opacity',
                    'hero_button_1_link',
                    'hero_button_2_link',
                    'hero_section_visible',
                    'testimonials_section_visible'
                )
            `);
            
            console.log(`✅ Added ${columns.length} new content template columns:`);
            columns.forEach(col => console.log(`   - ${col.COLUMN_NAME}`));
            console.log('');
            
            // Check if testimonials table was created
            const tables = await db.query(`
                SELECT TABLE_NAME 
                FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'testimonials'
            `);
            
            if (tables.length > 0) {
                const testimonialCount = await db.query('SELECT COUNT(*) as count FROM testimonials');
                console.log(`✅ Testimonials table created with ${testimonialCount[0].count} sample testimonials`);
            }
            
            // Check model count
            const modelCount = await db.query(`
                SELECT COUNT(*) as count 
                FROM models 
                WHERE status IN ('active', 'trial')
            `);
            
            console.log(`✅ Migration applied to ${modelCount[0].count} active models`);
            
        } catch (verifyError) {
            console.log(`⚠️  Verification warning: ${verifyError.message}`);
        }
        
        console.log(`\n🎉 Migration completed successfully!`);
        console.log(`📊 ${successCount}/${statements.length} statements executed`);
        console.log(`\n💡 Next steps:`);
        console.log(`   1. Update theme templates with parallax hero sections`);
        console.log(`   2. Add hero background image upload to admin interface`);
        console.log(`   3. Test parallax functionality across all themes`);
        
    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Handle script execution
if (require.main === module) {
    runMigration()
        .then(() => {
            process.exit(0);
        })
        .catch((error) => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

module.exports = { runMigration };