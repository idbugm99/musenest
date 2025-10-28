const sqlite3 = require('sqlite3').verbose();
const mysql = require('mysql2/promise');
require('dotenv').config();

// Database connections
const sourceDb = new sqlite3.Database('/Users/programmer/Projects/rosemastos/instance/models.db');

async function migrateCalendarEvents() {
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

        // Get calendar events from RoseMastos
        const getCalendarEvents = () => {
            return new Promise((resolve, reject) => {
                const query = `
                    SELECT id, start_date, end_date, location, status, notes, color, 
                           is_recurring, recurrence_pattern, created_at, updated_at, 
                           model_id, all_day, start_time, end_time
                    FROM availability 
                    WHERE model_id IS NOT NULL
                    ORDER BY start_date
                `;
                
                sourceDb.all(query, [], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
        };

        const calendarEvents = await getCalendarEvents();
        console.log(`📅 Found ${calendarEvents.length} calendar events to migrate`);

        let migratedCount = 0;

        for (const event of calendarEvents) {
            try {
                const phoenix4geModelId = modelMapping[event.model_id];
                if (!phoenix4geModelId) {
                    console.log(`⚠️  Skipping event ${event.id} - no model mapping for model_id ${event.model_id}`);
                    continue;
                }

                // Generate title from status and location
                const title = event.status === 'available' 
                    ? `Available in ${event.location}`
                    : event.status === 'vacation'
                    ? `Vacation - ${event.location}`
                    : `${event.status} - ${event.location}`;

                // Insert into phoenix4ge
                await targetDb.execute(`
                    INSERT INTO calendar_events (
                        model_id, title, description, start_date, end_date, 
                        start_time, end_time, all_day, location, status, 
                        color, is_recurring, recurrence_pattern, notes, 
                        created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    phoenix4geModelId,
                    title,
                    event.notes || `${title} - migrated from RoseMastos`,
                    event.start_date,
                    event.end_date,
                    event.start_time,
                    event.end_time,
                    event.all_day ? 1 : 0,
                    event.location,
                    event.status,
                    event.color || '#3B82F6',
                    event.is_recurring ? 1 : 0,
                    event.recurrence_pattern,
                    event.notes,
                    event.created_at,
                    event.updated_at
                ]);

                migratedCount++;
                console.log(`✅ Migrated event: ${title} (${event.start_date} to ${event.end_date})`);

            } catch (error) {
                console.error(`❌ Error migrating event ${event.id}:`, error.message);
            }
        }

        console.log(`\n🎉 Migration completed!`);
        console.log(`📊 Total events processed: ${calendarEvents.length}`);
        console.log(`✅ Successfully migrated: ${migratedCount}`);
        console.log(`❌ Failed: ${calendarEvents.length - migratedCount}`);

        // Verify migration
        const [verifyResult] = await targetDb.execute(
            'SELECT COUNT(*) as count FROM calendar_events WHERE model_id = ?',
            [Object.values(modelMapping)[0]]
        );
        
        console.log(`📋 Verification: ${verifyResult[0].count} calendar events now in phoenix4ge`);

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
console.log('🚀 Starting calendar events migration from RoseMastos to phoenix4ge...');
migrateCalendarEvents();