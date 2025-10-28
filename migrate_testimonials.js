const sqlite3 = require('sqlite3').verbose();
const mysql = require('mysql2/promise');
require('dotenv').config();

// Database connections
const sourceDb = new sqlite3.Database('/Users/programmer/Projects/rosemastos/instance/models.db');

async function migrateTestimonials() {
    let targetDb;
    try {
        targetDb = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'phoenix4ge'
        });
        console.log('🔗 Connected to phoenix4ge database');

        // Get model mapping from RoseMastos ID to phoenix4ge ID
        const modelMapping = {};
        const phoenix4geModels = await targetDb.execute('SELECT id, slug FROM models');
        
        for (const model of phoenix4geModels[0]) {
            // Assuming the first model in phoenix4ge corresponds to the RoseMastos data
            modelMapping[1] = model.id; // Map RoseMastos model_id 1 to phoenix4ge model
            break;
        }

        console.log('📋 Model mapping:', modelMapping);

        // Get testimonials from RoseMastos
        const getTestimonials = () => {
            return new Promise((resolve, reject) => {
                const query = `
                    SELECT id, name, text, rating, is_featured, created_at, is_active, model_id
                    FROM testimonial 
                    WHERE model_id IS NOT NULL
                    ORDER BY is_featured DESC, created_at DESC
                `;
                
                sourceDb.all(query, [], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
        };

        const testimonials = await getTestimonials();
        console.log(`💬 Found ${testimonials.length} testimonials to migrate`);

        let migratedCount = 0;

        for (const testimonial of testimonials) {
            try {
                const phoenix4geModelId = modelMapping[testimonial.model_id];
                if (!phoenix4geModelId) {
                    console.log(`⚠️  Skipping testimonial ${testimonial.id} - no model mapping for model_id ${testimonial.model_id}`);
                    continue;
                }

                // Extract client initial from full name (first letter + last name initial)
                const clientInitial = testimonial.name.length > 0 
                    ? testimonial.name.split(' ').map(part => part[0]).join('').toUpperCase()
                    : 'A.N.';

                // Insert into phoenix4ge
                await targetDb.execute(`
                    INSERT INTO testimonials (
                        model_id, client_name, client_initial, testimonial_text, 
                        rating, is_featured, is_active, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    phoenix4geModelId,
                    testimonial.name,
                    clientInitial,
                    testimonial.text,
                    testimonial.rating,
                    testimonial.is_featured ? 1 : 0,
                    testimonial.is_active ? 1 : 0,
                    testimonial.created_at
                ]);

                migratedCount++;
                console.log(`✅ Migrated testimonial: "${testimonial.name}" - ${testimonial.rating} stars`);

            } catch (error) {
                console.error(`❌ Error migrating testimonial ${testimonial.id}:`, error.message);
            }
        }

        console.log(`\n🎉 Migration completed!`);
        console.log(`📊 Total testimonials processed: ${testimonials.length}`);
        console.log(`✅ Successfully migrated: ${migratedCount}`);
        console.log(`❌ Failed: ${testimonials.length - migratedCount}`);

        // Verify migration
        const [verifyResult] = await targetDb.execute(
            'SELECT COUNT(*) as count FROM testimonials WHERE model_id = ?',
            [Object.values(modelMapping)[0]]
        );
        
        console.log(`📋 Verification: ${verifyResult[0].count} testimonials now in phoenix4ge`);

        // Show sample of migrated data
        const [sampleData] = await targetDb.execute(
            'SELECT client_name, rating, is_featured FROM testimonials WHERE model_id = ? LIMIT 3',
            [Object.values(modelMapping)[0]]
        );
        
        console.log('\n📝 Sample migrated testimonials:');
        sampleData.forEach(t => {
            console.log(`   • ${t.client_name} - ${t.rating} stars ${t.is_featured ? '(Featured)' : ''}`);
        });

    } catch (error) {
        console.error('💥 Migration failed:', error);
    } finally {
        sourceDb.close();
        if (targetDb) {
            await targetDb.end();
        }
    }
}

// Run migration
console.log('🚀 Starting testimonials migration from RoseMastos to phoenix4ge...');
migrateTestimonials();