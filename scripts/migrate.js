const fs = require('fs').promises;
const path = require('path');
const { query, testConnection } = require('../config/database');

async function runMigrations() {
    console.log('🚀 Starting phoenix4ge database migrations...\n');
    
    // Test database connection
    const isConnected = await testConnection();
    if (!isConnected) {
        console.error('❌ Cannot connect to database. Please check your configuration.');
        process.exit(1);
    }
    
    const migrationsDir = path.join(__dirname, '../database/migrations');
    
    try {
        // Get all migration files
        const files = await fs.readdir(migrationsDir);
        const migrationFiles = files
            .filter(file => file.endsWith('.sql'))
            .sort(); // Run in order
        
        console.log(`Found ${migrationFiles.length} migration files:\n`);
        
        for (const file of migrationFiles) {
            console.log(`📄 Running migration: ${file}`);
            
            const filePath = path.join(migrationsDir, file);
            const sql = await fs.readFile(filePath, 'utf8');
            
            // Split SQL file by semicolons and execute each statement
            const statements = sql
                .split(';')
                .map(stmt => stmt.trim())
                .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
            
            for (const statement of statements) {
                try {
                    await query(statement);
                } catch (error) {
                    // Skip errors for existing structures (tables, indexes)
                    if (
                        error.message.includes('already exists') ||
                        error.message.includes('Duplicate key name')
                    ) {
                        continue;
                    }
                    throw error;
                }
            }
            
            console.log(`   ✅ ${file} completed successfully`);
        }
        
        console.log('\n🎉 All migrations completed successfully!');
        console.log('\nNext steps:');
        console.log('1. Run: npm run seed (to add sample data)');
        console.log('2. Run: npm run dev (to start development server)');
        
    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        process.exit(1);
    }
    
    process.exit(0);
}

// Run migrations if called directly
if (require.main === module) {
    runMigrations();
}

module.exports = { runMigrations };