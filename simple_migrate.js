const { query } = require('./config/database');
const sqlite3 = require('sqlite3').verbose();

async function simpleMigrate() {
    console.log('🚀 Simple Migration - Site Settings Only\n');
    
    const sourceDb = new sqlite3.Database('/Users/programmer/Projects/rosemastos/instance/models.db');
    
    const querySource = (sql, params = []) => {
        return new Promise((resolve, reject) => {
            sourceDb.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    };

    try {
        // Get site settings with only available columns
        const sourceSettings = await querySource(`
            SELECT model_id, site_name, model_name, tagline, city,
                   contact_email, contact_phone, watermark_text, 
                   watermark_image, favicon_url
            FROM site_settings
            WHERE model_id IN (1, 5, 6)
        `);

        console.log('⚙️  Migrating Site Settings...');
        
        for (const setting of sourceSettings) {
            try {
                await query(`
                    INSERT INTO site_settings (
                        model_id, site_name, model_name, tagline, city,
                        contact_email, contact_phone, watermark_text, 
                        watermark_image, favicon_url, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
                    ON DUPLICATE KEY UPDATE
                        site_name = VALUES(site_name),
                        model_name = VALUES(model_name),
                        tagline = VALUES(tagline)
                `, [
                    setting.model_id,
                    setting.site_name,
                    setting.model_name,
                    setting.tagline,
                    setting.city,
                    setting.contact_email,
                    setting.contact_phone,
                    setting.watermark_text,
                    setting.watermark_image,
                    setting.favicon_url
                ]);
                console.log(`  ✅ Settings for model ${setting.model_id}: ${setting.site_name}`);
            } catch (error) {
                console.log(`  ❌ Settings for model ${setting.model_id} - ${error.message}`);
            }
        }
        
        console.log('\n✅ Migration completed!');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        sourceDb.close();
        process.exit(0);
    }
}

simpleMigrate();