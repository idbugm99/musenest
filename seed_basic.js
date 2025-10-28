const { query } = require('./config/database');
const bcrypt = require('bcrypt');

async function seedBasicData() {
    console.log('🌱 Seeding basic phoenix4ge data...\n');
    
    try {
        // 1. Add basic themes
        console.log('📝 Adding themes...');
        await query(`
            INSERT IGNORE INTO themes (id, name, display_name, description, is_active, created_at)
            VALUES 
            (1, 'basic', 'Basic', 'Clean and professional design', true, NOW()),
            (3, 'glamour', 'Glamour', 'Dark luxury with golden accents', true, NOW())
        `);
        
        // 2. Add test user
        console.log('👤 Adding test user...');
        const hashedPassword = await bcrypt.hash('admin123', 12);
        await query(`
            INSERT IGNORE INTO users (id, email, password_hash, role, is_active, created_at)
            VALUES (1, 'admin@phoenix4ge.com', ?, 'admin', true, NOW())
        `, [hashedPassword]);
        
        // 3. Add test model
        console.log('🏠 Adding test model...');
        await query(`
            INSERT IGNORE INTO models (id, name, slug, status, created_at)
            VALUES (1, 'Demo Model', 'demo', 'active', NOW())
        `);
        
        // 4. Connect user to model
        await query(`
            INSERT IGNORE INTO model_users (model_id, user_id, role)
            VALUES (1, 1, 'owner')
        `);
        
        // 5. Assign glamour theme to model
        await query(`
            INSERT IGNORE INTO model_themes (model_id, theme_id, is_active)
            VALUES (1, 3, true)
        `);
        
        // 6. Add basic site settings
        await query(`
            INSERT IGNORE INTO site_settings (model_id, site_name, model_name, tagline, created_at)
            VALUES (1, 'phoenix4ge Demo', 'Demo Model', 'Professional companionship services', NOW())
        `);
        
        // 7. Add some test FAQ items
        console.log('❓ Adding FAQ items...');
        await query(`
            INSERT IGNORE INTO faq_items (model_id, question, answer, sort_order, is_visible, created_at)
            VALUES 
            (1, 'What services do you offer?', 'I offer professional companionship services for various social events and occasions.', 1, true, NOW()),
            (1, 'How do I book an appointment?', 'Please contact me through the contact form or email provided on the contact page.', 2, true, NOW()),
            (1, 'What are your rates?', 'My rates vary depending on the type of service and duration. Please see the rates page for detailed information.', 3, true, NOW())
        `);
        
        // 8. Add test testimonial
        console.log('💬 Adding testimonial...');
        await query(`
            INSERT IGNORE INTO testimonials (model_id, client_name, testimonial_text, rating, is_featured, is_active, created_at)
            VALUES (1, 'Client A', 'Absolutely wonderful experience. Professional, elegant, and charming.', 5, true, true, NOW())
        `);
        
        console.log('✅ Basic data seeded successfully!');
        console.log('📊 Test the system at: http://localhost:3000/demo/');
        
    } catch (error) {
        console.error('❌ Seeding failed:', error);
    }
    
    process.exit(0);
}

seedBasicData();