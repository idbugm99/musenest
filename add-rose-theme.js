#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Path to SQLite database
const dbPath = path.join(__dirname, 'config/database.sqlite');

console.log('🌹 Adding Rose theme to database...');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Error opening database:', err.message);
        process.exit(1);
    }
    console.log('✅ Connected to SQLite database');
});

// Function to run SQL with promise support
function runSQL(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

// Function to check if tables exist
function checkTable(tableName) {
    return new Promise((resolve, reject) => {
        db.get("SELECT name FROM sqlite_master WHERE type='table' AND name=?", [tableName], (err, row) => {
            if (err) reject(err);
            else resolve(!!row);
        });
    });
}

async function addRoseTheme() {
    try {
        // Check if theme_sets table exists
        const themeSetExists = await checkTable('theme_sets');
        
        if (!themeSetExists) {
            console.log('📋 Creating theme_sets table...');
            
            // Create theme_sets table
            await runSQL(`
                CREATE TABLE theme_sets (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name VARCHAR(50) UNIQUE NOT NULL,
                    display_name VARCHAR(100) NOT NULL,
                    description TEXT,
                    category TEXT CHECK(category IN ('professional', 'luxury', 'creative', 'business')) DEFAULT 'professional',
                    default_color_scheme TEXT NOT NULL,
                    features TEXT,
                    pricing_tier TEXT CHECK(pricing_tier IN ('free', 'premium', 'enterprise')) DEFAULT 'free',
                    is_active BOOLEAN DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);
        }
        
        // Check if page_types table exists
        const pageTypesExists = await checkTable('page_types');
        
        if (!pageTypesExists) {
            console.log('📋 Creating page_types table...');
            
            await runSQL(`
                CREATE TABLE page_types (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name VARCHAR(50) UNIQUE NOT NULL,
                    display_name VARCHAR(100) NOT NULL,
                    description TEXT,
                    category TEXT CHECK(category IN ('core', 'optional', 'premium', 'business', 'adult')) DEFAULT 'optional',
                    content_structure TEXT,
                    required_data_tables TEXT,
                    pricing_tier TEXT CHECK(pricing_tier IN ('free', 'premium', 'enterprise')) DEFAULT 'free',
                    is_active BOOLEAN DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);
        }
        
        // Check if theme_set_pages table exists
        const themeSetPagesExists = await checkTable('theme_set_pages');
        
        if (!themeSetPagesExists) {
            console.log('📋 Creating theme_set_pages table...');
            
            await runSQL(`
                CREATE TABLE theme_set_pages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    theme_set_id INTEGER NOT NULL,
                    page_type_id INTEGER NOT NULL,
                    template_file VARCHAR(100) NOT NULL,
                    has_custom_layout BOOLEAN DEFAULT 0,
                    features TEXT,
                    is_available BOOLEAN DEFAULT 1,
                    FOREIGN KEY (theme_set_id) REFERENCES theme_sets(id) ON DELETE CASCADE,
                    FOREIGN KEY (page_type_id) REFERENCES page_types(id) ON DELETE CASCADE,
                    UNIQUE(theme_set_id, page_type_id)
                )
            `);
        }
        
        // Insert core page types if they don't exist
        console.log('📄 Adding core page types...');
        
        const pageTypes = [
            ['home', 'Home Page', 'Main landing page with hero section and overview', 'core', '["hero_title", "hero_subtitle", "about_preview", "services_preview", "cta_text"]', '["gallery_images"]', 'free'],
            ['about', 'About Page', 'Personal information and background', 'core', '["main_content", "personal_info", "values", "experience"]', '[]', 'free'],
            ['contact', 'Contact Page', 'Contact information and inquiry form', 'core', '["contact_intro", "contact_info", "booking_policy", "rates_preview"]', '[]', 'free'],
            ['gallery', 'Photo Gallery', 'Professional photo portfolio', 'core', '["gallery_intro", "categories"]', '["gallery_images"]', 'free'],
            ['rates', 'Rates & Services', 'Service packages and pricing information', 'optional', '["rates_intro", "packages", "policies", "payment_terms"]', '[]', 'free'],
            ['calendar', 'Availability Calendar', 'Booking calendar and availability', 'business', '["calendar_intro", "booking_instructions"]', '["calendar_events"]', 'premium']
        ];
        
        for (const pageType of pageTypes) {
            try {
                await runSQL(`
                    INSERT OR IGNORE INTO page_types 
                    (name, display_name, description, category, content_structure, required_data_tables, pricing_tier) 
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `, pageType);
            } catch (err) {
                if (!err.message.includes('UNIQUE constraint failed')) {
                    throw err;
                }
            }
        }
        
        // Insert Rose theme set
        console.log('🌹 Adding Rose theme set...');
        
        const roseThemeData = [
            'rose',
            'Rose Romantic',
            'Luxurious romantic theme with deep rose palette and elegant typography',
            'luxury',
            JSON.stringify({
                "primary": "#B91C1C",
                "secondary": "#2B0A0E", 
                "background": "#FEF7F0",
                "text": "#1F2937",
                "accent": "#D97706",
                "border": "#FFE5EC"
            }),
            JSON.stringify({
                "animations": true,
                "parallax": false,
                "interactive_elements": "elegant",
                "rose_accents": true,
                "serif_typography": true
            }),
            'premium'
        ];
        
        try {
            await runSQL(`
                INSERT OR REPLACE INTO theme_sets 
                (name, display_name, description, category, default_color_scheme, features, pricing_tier) 
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, roseThemeData);
            console.log('✅ Rose theme set added successfully');
        } catch (err) {
            console.log('⚠️  Rose theme set already exists, updating...');
            await runSQL(`
                UPDATE theme_sets SET 
                    display_name = ?, description = ?, category = ?, 
                    default_color_scheme = ?, features = ?, pricing_tier = ?
                WHERE name = ?
            `, [roseThemeData[1], roseThemeData[2], roseThemeData[3], roseThemeData[4], roseThemeData[5], roseThemeData[6], roseThemeData[0]]);
        }
        
        // Get theme_set_id and page_type_ids
        const themeSet = await new Promise((resolve, reject) => {
            db.get('SELECT id FROM theme_sets WHERE name = ?', ['rose'], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        const pageTypeIds = await new Promise((resolve, reject) => {
            db.all('SELECT id, name FROM page_types WHERE name IN (?, ?, ?, ?, ?, ?)', 
                ['home', 'about', 'contact', 'gallery', 'rates', 'calendar'], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        // Insert theme_set_pages mappings
        console.log('📋 Adding Rose theme page mappings...');
        
        for (const pageType of pageTypeIds) {
            const templateFile = `rose/${pageType.name}.handlebars`;
            const features = JSON.stringify({
                "animations": "soft",
                "rose_styling": true
            });
            
            try {
                await runSQL(`
                    INSERT OR REPLACE INTO theme_set_pages 
                    (theme_set_id, page_type_id, template_file, has_custom_layout, features, is_available) 
                    VALUES (?, ?, ?, 1, ?, 1)
                `, [themeSet.id, pageType.id, templateFile, features]);
                
                console.log(`✅ Added ${pageType.name} page mapping`);
            } catch (err) {
                console.error(`❌ Error adding ${pageType.name} page mapping:`, err.message);
            }
        }
        
        console.log('🎉 Rose theme added successfully to database!');
        console.log(`📊 Theme Set ID: ${themeSet.id}`);
        console.log(`📄 Pages added: ${pageTypeIds.length}`);
        
    } catch (error) {
        console.error('❌ Error adding Rose theme:', error.message);
        throw error;
    }
}

// Run the migration
addRoseTheme()
    .then(() => {
        console.log('✅ Migration completed successfully');
        db.close((err) => {
            if (err) {
                console.error('❌ Error closing database:', err.message);
            } else {
                console.log('📋 Database connection closed');
            }
            process.exit(0);
        });
    })
    .catch((error) => {
        console.error('💥 Migration failed:', error.message);
        db.close();
        process.exit(1);
    });