const fs = require('fs');
const path = require('path');
const { query } = require('./config/database');

async function runMigration() {
    console.log('🔄 Running page content tables migration...');
    
    try {
        // Read the migration file
        const migrationPath = path.join(__dirname, 'migrations', '065_dedicated_page_content_tables.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        // Split the SQL into individual statements, separating CREATE and INSERT
        const allStatements = migrationSQL
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
            
        const createStatements = allStatements.filter(stmt => stmt.toUpperCase().includes('CREATE TABLE'));
        const insertStatements = allStatements.filter(stmt => stmt.toUpperCase().startsWith('INSERT'));
        
        console.log(`Debug: Found ${allStatements.length} total statements`);
        console.log('Debug: First few statements:', allStatements.slice(0, 3).map(s => s.substring(0, 50)));
        
        // First run CREATE statements
        console.log(`📋 Creating ${createStatements.length} tables...`);
        for (let i = 0; i < createStatements.length; i++) {
            const statement = createStatements[i];
            console.log(`   ${i + 1}/${createStatements.length}: ${statement.substring(0, 50)}...`);
            try {
                await query(statement);
            } catch (error) {
                if (error.code === 'ER_TABLE_EXISTS_ERROR') {
                    console.log(`   ⏭️  Table already exists, skipping...`);
                    continue;
                }
                throw error;
            }
        }
        
        // Then run INSERT statements
        console.log(`📝 Inserting default data with ${insertStatements.length} statements...`);
        const statements = insertStatements;
        
        console.log(`📝 Executing ${statements.length} SQL statements...`);
        
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            if (statement) {
                console.log(`   ${i + 1}/${statements.length}: ${statement.substring(0, 50)}...`);
                try {
                    await query(statement);
                } catch (error) {
                    if (error.code === 'ER_TABLE_EXISTS_ERROR') {
                        console.log(`   ⏭️  Table already exists, skipping...`);
                        continue;
                    }
                    throw error;
                }
            }
        }
        
        console.log('✅ Migration completed successfully!');
        console.log('✅ New dedicated page content tables created:');
        console.log('   - model_home_page_content');
        console.log('   - model_about_page_content');
        console.log('   - model_contact_page_content');
        console.log('   - model_rates_page_content');
        console.log('   - model_gallery_page_content');
        console.log('   - model_etiquette_page_content');
        
        // Test that tables were created properly
        const tables = await query("SHOW TABLES LIKE 'model_%_page_content'");
        console.log(`✅ Verified ${tables.length} new content tables exist`);
        
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error('   Full error:', error);
        process.exit(1);
    }
}

// Run the migration
runMigration().then(() => {
    console.log('🎉 Page content tables migration complete!');
    process.exit(0);
}).catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
});