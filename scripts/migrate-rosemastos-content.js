#!/usr/bin/env node

/**
 * MuseNest Content Migration Script
 * 
 * Migrates content data from RoseMastos SQLite database to MuseNest MySQL database
 * Maps RoseMastos models and content to MuseNest content_templates structure
 */

const mysql = require('mysql2/promise');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

// Database configurations
const MYSQL_CONFIG = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'musenest',
    port: process.env.DB_PORT || 3306
};

const ROSEMASTOS_DB_PATH = '/Users/programmer/Projects/rosemastos/instance/models.db';

// Page type mapping from RoseMastos to MuseNest
const PAGE_TYPE_MAPPING = {
    'home': 1,
    'about': 2,
    'contact': 3,
    'gallery': 4,
    'rates': 5,
    'etiquette': 16
};

// Content field mapping for different page types
const CONTENT_MAPPING = {
    home: {
        'hero_title': 'about_title',
        'hero_subtitle': 'about_paragraph_1',
        'hero_description': 'about_paragraph_2',
        'about_link_text': 'about_link_text',
        'about_link_destination': 'about_link_destination',
        'gallery_section_title': 'gallery_section_title',
        'gallery_button_text': 'gallery_button_text',
        'testimonials_section_title': 'testimonials_section_title',
        'cta_section_title': 'cta_section_title',
        'cta_section_subtitle': 'cta_section_subtitle',
        'hero_button_1': 'hero_button_1',
        'hero_button_1_link': 'hero_button_1_link',
        'hero_button_2': 'hero_button_2',
        'hero_button_2_link': 'hero_button_2_link'
    },
    about: {
        'page_title': 'page_title',
        'main_paragraph_1': 'main_paragraph_1',
        'main_paragraph_2': 'main_paragraph_2',
        'main_paragraph_3': 'main_paragraph_3',
        'main_paragraph_4': 'main_paragraph_4',
        'services_title': 'services_title',
        'services_list': ['service_1', 'service_2', 'service_3', 'service_4', 'service_5'],
        'interests_title': 'interests_title',
        'interests': 'interests',
        'facts_title': 'facts_title',
        'quick_facts': 'quick_facts_json',
        'cta_section_title': 'cta_section_title',
        'cta_section_subtitle': 'cta_section_subtitle'
    },
    contact: {
        'page_title': 'page_title',
        'page_subtitle': 'page_subtitle',
        'form_title': 'form_title',
        'form_name_label': 'form_name_label',
        'form_email_label': 'form_email_label',
        'form_phone_label': 'form_phone_label',
        'form_date_label': 'form_date_label',
        'form_duration_label': 'form_duration_label',
        'form_message_label': 'form_message_label',
        'form_message_placeholder': 'form_message_placeholder',
        'form_button_text': 'form_button_text',
        'direct_title': 'direct_title',
        'direct_email_label': 'direct_email_label',
        'direct_phone_label': 'direct_phone_label',
        'direct_response_label': 'direct_response_label',
        'direct_response_text': 'direct_response_text',
        'guidelines_title': 'guidelines_title',
        'guideline_1': 'guideline_1',
        'guideline_2': 'guideline_2',
        'guideline_3': 'guideline_3',
        'guideline_4': 'guideline_4',
        'guideline_5': 'guideline_5',
        'location_title': 'location_title',
        'location_area_text': 'location_area_text',
        'location_services_text': 'location_services_text',
        'location_travel_text': 'location_travel_text',
        'privacy_title': 'privacy_title',
        'privacy_text': 'privacy_text',
        'form_duration_options': 'form_duration_options'
    },
    etiquette: {
        'page_title': 'page_title',
        'page_subtitle': 'page_subtitle',
        'booking_title': 'booking_title',
        'booking_initial_contact_title': 'booking_initial_contact_title',
        'booking_initial_contact_text': 'booking_initial_contact_text',
        'booking_screening_title': 'booking_screening_title',
        'booking_screening_text': 'booking_screening_text',
        'booking_advance_title': 'booking_advance_title',
        'booking_advance_text': 'booking_advance_text',
        'respect_title': 'respect_title',
        'respect_mutual_title': 'respect_mutual_title',
        'respect_mutual_text': 'respect_mutual_text',
        'respect_boundaries_title': 'respect_boundaries_title',
        'respect_boundaries_text': 'respect_boundaries_text',
        'respect_personal_title': 'respect_personal_title',
        'respect_personal_text': 'respect_personal_text',
        'hygiene_title': 'hygiene_title',
        'hygiene_personal_title': 'hygiene_personal_title',
        'hygiene_personal_text': 'hygiene_personal_text',
        'hygiene_attire_title': 'hygiene_attire_title',
        'hygiene_attire_text': 'hygiene_attire_text',
        'hygiene_substances_title': 'hygiene_substances_title',
        'hygiene_substances_text': 'hygiene_substances_text',
        'cancellation_title': 'cancellation_title',
        'cancellation_advance_title': 'cancellation_advance_title',
        'cancellation_advance_text': 'cancellation_advance_text',
        'cancellation_noshow_title': 'cancellation_noshow_title',
        'cancellation_noshow_text': 'cancellation_noshow_text',
        'cancellation_my_title': 'cancellation_my_title',
        'cancellation_my_text': 'cancellation_my_text',
        'safety_title': 'safety_title',
        'safety_confidentiality_title': 'safety_confidentiality_title',
        'safety_confidentiality_text': 'safety_confidentiality_text',
        'safety_environment_title': 'safety_environment_title',
        'safety_environment_text': 'safety_environment_text',
        'safety_communication_title': 'safety_communication_title',
        'safety_communication_text': 'safety_communication_text',
        'questions_title': 'questions_title',
        'questions_text': 'questions_text',
        'questions_button_text': 'questions_button_text',
        'page_subtext': 'page_subtext',
        'section_1_title': 'section_1_title',
        'section_1_body': 'section_1_body',
        'section_2_title': 'section_2_title',
        'section_2_body': 'section_2_body',
        'section_3_title': 'section_3_title',
        'section_3_body': 'section_3_body',
        'cta_title': 'cta_title',
        'cta_body': 'cta_body',
        'cta_button_text': 'cta_button_text'
    }
};

class ContentMigrator {
    constructor() {
        this.mysqlConnection = null;
        this.sqliteDb = null;
        this.migrationStats = {
            models_processed: 0,
            content_records_created: 0,
            errors: []
        };
    }

    async init() {
        console.log('🚀 Initializing Content Migration...');
        
        // Connect to MySQL
        try {
            this.mysqlConnection = await mysql.createConnection(MYSQL_CONFIG);
            console.log('✅ Connected to MuseNest MySQL database');
        } catch (error) {
            throw new Error(`Failed to connect to MySQL: ${error.message}`);
        }

        // Connect to SQLite
        try {
            this.sqliteDb = new sqlite3.Database(ROSEMASTOS_DB_PATH);
            console.log('✅ Connected to RoseMastos SQLite database');
        } catch (error) {
            throw new Error(`Failed to connect to SQLite: ${error.message}`);
        }
    }

    async getRoseMastosModels() {
        return new Promise((resolve, reject) => {
            this.sqliteDb.all(
                'SELECT id, name, slug, status FROM models WHERE status IN ("active", "trial")',
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }

    async getPageContent(modelId, tableName) {
        return new Promise((resolve, reject) => {
            this.sqliteDb.get(
                `SELECT * FROM ${tableName} WHERE model_id = ?`,
                [modelId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
    }

    async findOrCreateMuseNestModel(roseMastosModel) {
        // Check if model already exists in MuseNest
        const [existingModels] = await this.mysqlConnection.execute(
            'SELECT id FROM models WHERE slug = ?',
            [roseMastosModel.slug]
        );

        if (existingModels.length > 0) {
            console.log(`📋 Found existing model: ${roseMastosModel.name} (${roseMastosModel.slug})`);
            return existingModels[0].id;
        }

        // Create new model in MuseNest
        const [result] = await this.mysqlConnection.execute(
            `INSERT INTO models (name, slug, email, status, theme_set_id, created_at)
             VALUES (?, ?, ?, ?, 1, NOW())`,
            [
                roseMastosModel.name,
                roseMastosModel.slug,
                `${roseMastosModel.slug}@musenest.com`,
                roseMastosModel.status === 'active' ? 'active' : 'inactive'
            ]
        );

        console.log(`✨ Created new model: ${roseMastosModel.name} (${roseMastosModel.slug}) -> ID: ${result.insertId}`);
        return result.insertId;
    }

    async migrateContent(musenestModelId, roseMastosModelId, pageType, contentData) {
        const pageTypeId = PAGE_TYPE_MAPPING[pageType];
        if (!pageTypeId) {
            console.warn(`⚠️  Unknown page type: ${pageType}`);
            return;
        }

        const contentMapping = CONTENT_MAPPING[pageType];
        if (!contentMapping) {
            console.warn(`⚠️  No content mapping for page type: ${pageType}`);
            return;
        }

        let recordsCreated = 0;

        // Process each content field mapping
        for (const [musenestKey, roseMastosKey] of Object.entries(contentMapping)) {
            let contentValue = null;

            if (Array.isArray(roseMastosKey)) {
                // Handle arrays (like services list)
                const services = roseMastosKey
                    .map(key => contentData[key])
                    .filter(value => value && value.trim())
                    .join('\n');
                contentValue = services || null;
            } else if (roseMastosKey === 'quick_facts_json') {
                // Handle JSON data
                if (contentData[roseMastosKey]) {
                    try {
                        // Parse and validate JSON
                        const facts = JSON.parse(contentData[roseMastosKey]);
                        contentValue = JSON.stringify(facts);
                    } catch (e) {
                        console.warn(`⚠️  Invalid JSON in quick_facts for model ${musenestModelId}`);
                        contentValue = null;
                    }
                }
            } else {
                // Handle regular string fields
                contentValue = contentData[roseMastosKey] || null;
            }

            if (contentValue) {
                try {
                    // Check if content already exists
                    const [existingContent] = await this.mysqlConnection.execute(
                        'SELECT id FROM content_templates WHERE model_id = ? AND page_type_id = ? AND content_key = ?',
                        [musenestModelId, pageTypeId, musenestKey]
                    );

                    if (existingContent.length > 0) {
                        // Update existing content
                        await this.mysqlConnection.execute(
                            'UPDATE content_templates SET content_value = ?, updated_at = NOW() WHERE id = ?',
                            [contentValue, existingContent[0].id]
                        );
                        console.log(`📝 Updated ${pageType}.${musenestKey}`);
                    } else {
                        // Insert new content
                        await this.mysqlConnection.execute(
                            `INSERT INTO content_templates 
                             (model_id, page_type_id, content_key, content_value, content_type, updated_at) 
                             VALUES (?, ?, ?, ?, 'text', NOW())`,
                            [musenestModelId, pageTypeId, musenestKey, contentValue]
                        );
                        console.log(`✨ Created ${pageType}.${musenestKey}`);
                        recordsCreated++;
                    }
                } catch (error) {
                    console.error(`❌ Error inserting ${pageType}.${musenestKey}:`, error.message);
                    this.migrationStats.errors.push({
                        model_id: musenestModelId,
                        page_type: pageType,
                        field: musenestKey,
                        error: error.message
                    });
                }
            }
        }

        return recordsCreated;
    }

    async migrateModel(roseMastosModel) {
        console.log(`\n🔄 Processing model: ${roseMastosModel.name} (${roseMastosModel.slug})`);
        
        try {
            // Find or create model in MuseNest
            const musenestModelId = await this.findOrCreateMuseNestModel(roseMastosModel);
            
            let totalContentCreated = 0;

            // Migrate home page content
            const homeContent = await this.getPageContent(roseMastosModel.id, 'home_page_content');
            if (homeContent) {
                const created = await this.migrateContent(musenestModelId, roseMastosModel.id, 'home', homeContent);
                totalContentCreated += created;
            }

            // Migrate about page content
            const aboutContent = await this.getPageContent(roseMastosModel.id, 'about_page_content');
            if (aboutContent) {
                const created = await this.migrateContent(musenestModelId, roseMastosModel.id, 'about', aboutContent);
                totalContentCreated += created;
            }

            // Migrate contact page content
            const contactContent = await this.getPageContent(roseMastosModel.id, 'contact_page_content');
            if (contactContent) {
                const created = await this.migrateContent(musenestModelId, roseMastosModel.id, 'contact', contactContent);
                totalContentCreated += created;
            }

            // Migrate etiquette page content
            const etiquetteContent = await this.getPageContent(roseMastosModel.id, 'etiquette_page_content');
            if (etiquetteContent) {
                const created = await this.migrateContent(musenestModelId, roseMastosModel.id, 'etiquette', etiquetteContent);
                totalContentCreated += created;
            }

            console.log(`✅ Completed ${roseMastosModel.name}: ${totalContentCreated} content records processed`);
            this.migrationStats.models_processed++;
            this.migrationStats.content_records_created += totalContentCreated;

        } catch (error) {
            console.error(`❌ Error processing model ${roseMastosModel.name}:`, error.message);
            this.migrationStats.errors.push({
                model: roseMastosModel.name,
                slug: roseMastosModel.slug,
                error: error.message
            });
        }
    }

    async run() {
        try {
            await this.init();

            // Get all models from RoseMastos
            const roseMastosModels = await this.getRoseMastosModels();
            console.log(`📊 Found ${roseMastosModels.length} models to migrate`);

            // Process each model
            for (const model of roseMastosModels) {
                await this.migrateModel(model);
            }

            // Print migration summary
            console.log('\n🎉 Migration Complete!');
            console.log('=====================================');
            console.log(`📊 Models processed: ${this.migrationStats.models_processed}/${roseMastosModels.length}`);
            console.log(`📝 Content records created/updated: ${this.migrationStats.content_records_created}`);
            console.log(`❌ Errors: ${this.migrationStats.errors.length}`);

            if (this.migrationStats.errors.length > 0) {
                console.log('\n⚠️  Errors encountered:');
                this.migrationStats.errors.forEach((error, index) => {
                    console.log(`  ${index + 1}. ${error.model || error.page_type || 'Unknown'}: ${error.error}`);
                });
            }

        } catch (error) {
            console.error('💥 Migration failed:', error.message);
            process.exit(1);
        } finally {
            // Cleanup connections
            if (this.mysqlConnection) {
                await this.mysqlConnection.end();
            }
            if (this.sqliteDb) {
                this.sqliteDb.close();
            }
        }
    }
}

// Run migration if called directly
if (require.main === module) {
    const migrator = new ContentMigrator();
    migrator.run().catch(console.error);
}

module.exports = ContentMigrator;