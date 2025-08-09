const db = require('./config/database');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    try {
        console.log('Starting media library migration...');
        
        const migrationFile = path.join(__dirname, 'migrations', '067_media_library_system.sql');
        const migrationContent = fs.readFileSync(migrationFile, 'utf8');
        
        // Split by semicolon and filter out comments and empty lines
        const statements = migrationContent
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && !stmt.startsWith('/*'));
        
        console.log(`Found ${statements.length} SQL statements to execute`);
        
        let completed = 0;
        for (const statement of statements) {
            if (statement.trim().length === 0) continue;
            
            try {
                await db.execute(statement);
                completed++;
                console.log(`✅ Executed statement ${completed}/${statements.length}`);
            } catch (error) {
                // Skip statements that already exist (table exists errors)
                if (error.code === 'ER_TABLE_EXISTS_ERROR' || 
                    error.code === 'ER_DUP_KEYNAME' || 
                    error.message.includes('already exists')) {
                    console.log(`⚠️  Skipped existing: ${error.message}`);
                    completed++;
                    continue;
                }
                console.error(`❌ Failed to execute statement:`, statement.substring(0, 100) + '...');
                console.error('Error:', error.message);
                throw error;
            }
        }
        
        console.log(`🎉 Migration completed successfully! Executed ${completed} statements.`);
        
        // Verify tables were created
        const tables = await db.execute("SHOW TABLES LIKE 'model_media_%'");
        console.log(`Created ${tables[0].length} media library tables:`);
        tables[0].forEach(row => {
            const tableName = Object.values(row)[0];
            console.log(`  - ${tableName}`);
        });
        
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

runMigration();