/**
 * Universal Gallery Test Setup
 * 
 * Global test setup and teardown for all gallery testing suites.
 * Handles database initialization, server startup, and test utilities.
 */

const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs').promises;
const testConfig = require('./test-config');

class UniversalGalleryTestSetup {
    constructor() {
        this.dbConnection = null;
        this.serverInstance = null;
        this.testServer = null;
        this.isSetup = false;
    }

    /**
     * Global test setup - run once before all tests
     */
    async setupGlobal() {
        console.log('🧪 Setting up Universal Gallery test environment...');

        try {
            await this.setupDatabase();
            await this.setupServer();
            await this.setupTestData();
            await this.setupReportDirectories();

            this.isSetup = true;
            console.log('✅ Universal Gallery test environment ready');
        } catch (error) {
            console.error('❌ Failed to setup test environment:', error);
            throw error;
        }
    }

    /**
     * Global test teardown - run once after all tests
     */
    async teardownGlobal() {
        console.log('🧹 Cleaning up Universal Gallery test environment...');

        try {
            await this.teardownServer();
            await this.teardownDatabase();
            console.log('✅ Universal Gallery test environment cleaned up');
        } catch (error) {
            console.error('❌ Failed to cleanup test environment:', error);
        }
    }

    /**
     * Setup test database
     */
    async setupDatabase() {
        if (!testConfig.database.autoSetup) return;

        console.log('📊 Setting up test database...');

        // Create database connection without specifying database
        const connection = await mysql.createConnection({
            host: testConfig.database.host,
            user: testConfig.database.user,
            password: testConfig.database.password,
            port: testConfig.database.port
        });

        try {
            // Create test database if it doesn't exist
            await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${testConfig.database.database}\``);
            await connection.end();

            // Connect to test database
            this.dbConnection = await mysql.createConnection(testConfig.database);

            // Run necessary migrations
            await this.runTestMigrations();

            console.log('✅ Test database setup complete');
        } catch (error) {
            await connection.end();
            throw error;
        }
    }

    /**
     * Run test database migrations
     */
    async runTestMigrations() {
        const migrations = [
            // Core gallery tables
            `CREATE TABLE IF NOT EXISTS universal_gallery_configs (
                id INT PRIMARY KEY AUTO_INCREMENT,
                model_id INT,
                theme_name VARCHAR(50),
                layout_type VARCHAR(30),
                config_json JSON,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )`,

            // Gallery images table for testing
            `CREATE TABLE IF NOT EXISTS gallery_images_test (
                id INT PRIMARY KEY AUTO_INCREMENT,
                model_id INT,
                filename VARCHAR(255),
                original_name VARCHAR(255),
                file_size INT,
                width INT,
                height INT,
                alt_text TEXT,
                category VARCHAR(50),
                tags JSON,
                is_approved BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,

            // Performance metrics tables
            `CREATE TABLE IF NOT EXISTS gallery_performance_sessions_test (
                id INT PRIMARY KEY AUTO_INCREMENT,
                session_id VARCHAR(100) UNIQUE,
                model_id INT,
                theme_name VARCHAR(50),
                user_agent TEXT,
                viewport_width INT,
                viewport_height INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,

            // Analytics events table
            `CREATE TABLE IF NOT EXISTS gallery_analytics_events_test (
                id INT PRIMARY KEY AUTO_INCREMENT,
                session_id VARCHAR(100),
                user_id VARCHAR(100),
                event_type VARCHAR(50),
                event_data JSON,
                url TEXT,
                timestamp DATETIME,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_session_events (session_id),
                INDEX idx_event_type (event_type),
                INDEX idx_timestamp (timestamp)
            )`,

            // Test models table
            `CREATE TABLE IF NOT EXISTS models_test (
                id INT PRIMARY KEY AUTO_INCREMENT,
                slug VARCHAR(100) UNIQUE,
                name VARCHAR(255),
                theme_set_id INT DEFAULT 1,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,

            // Theme sets for testing
            `CREATE TABLE IF NOT EXISTS theme_sets_test (
                id INT PRIMARY KEY AUTO_INCREMENT,
                name VARCHAR(50) UNIQUE,
                display_name VARCHAR(100),
                category VARCHAR(50),
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`
        ];

        for (const migration of migrations) {
            await this.dbConnection.execute(migration);
        }

        console.log('✅ Test migrations complete');
    }

    /**
     * Setup test server
     */
    async setupServer() {
        if (!testConfig.server.autoStart) return;

        console.log('🌐 Starting test server...');

        const express = require('express');
        const app = express();

        // Configure middleware
        app.use(express.json());
        app.use(express.static(testConfig.server.staticPath));

        // Mount test routes
        app.use('/api/universal-gallery', require('./test-routes'));

        // Gallery test page
        app.get('/test/gallery/:theme?', (req, res) => {
            const theme = req.params.theme || 'modern';
            res.send(this.generateTestGalleryPage(theme));
        });

        // Health check endpoint
        app.get('/health', (req, res) => {
            res.json({ status: 'ok', timestamp: new Date().toISOString() });
        });

        // Start server
        return new Promise((resolve, reject) => {
            this.testServer = app.listen(testConfig.server.port, testConfig.server.host, (error) => {
                if (error) {
                    reject(error);
                } else {
                    console.log(`✅ Test server running at ${testConfig.server.baseUrl}`);
                    resolve();
                }
            });
        });
    }

    /**
     * Generate test gallery page HTML
     */
    generateTestGalleryPage(theme) {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Universal Gallery Test - ${theme}</title>
    <link rel="stylesheet" href="/src/styles/universal-gallery.css">
    <link rel="stylesheet" href="/themes/${theme}/styles/gallery.css">
</head>
<body>
    <div id="test-gallery" data-theme="${theme}" data-gallery-container data-gallery-id="test-gallery">
        <div class="gallery-header">
            <h2>Test Gallery - ${theme.toUpperCase()} Theme</h2>
            <div class="gallery-controls">
                <input type="text" data-gallery-search placeholder="Search images..." />
                <select data-gallery-filter name="category">
                    <option value="">All Categories</option>
                    <option value="portrait">Portrait</option>
                    <option value="landscape">Landscape</option>
                    <option value="studio">Studio</option>
                </select>
            </div>
        </div>
        
        <div class="gallery-grid" data-gallery-layout="grid">
            ${this.generateTestImages()}
        </div>
        
        <div class="gallery-pagination">
            <button class="gallery-btn gallery-btn--prev" disabled>Previous</button>
            <span class="gallery-pagination-info">Page 1 of 1</span>
            <button class="gallery-btn gallery-btn--next" disabled>Next</button>
        </div>
    </div>

    <!-- Scripts -->
    <script src="/src/services/UniversalGalleryService.js"></script>
    <script src="/src/modules/GalleryLightbox.js"></script>
    <script src="/src/modules/GalleryMasonry.js"></script>
    <script src="/src/modules/GalleryPrefetch.js"></script>
    <script src="/src/services/GalleryPerformanceService.js"></script>
    <script src="/src/services/GalleryAnalyticsService.js"></script>
    
    <script>
        // Initialize gallery for testing
        document.addEventListener('DOMContentLoaded', function() {
            const gallery = document.getElementById('test-gallery');
            
            // Initialize Universal Gallery Service
            const galleryService = new UniversalGalleryService({
                layout: 'grid',
                columns: 3,
                spacing: 'medium',
                lightbox: true,
                lazy: true,
                prefetch: true
            });
            
            galleryService.init(gallery);
            
            // Initialize performance monitoring
            const performanceService = new GalleryPerformanceService();
            performanceService.init();
            
            // Initialize analytics
            const analyticsService = new GalleryAnalyticsService();
            analyticsService.init();
            
            // Add global test helpers
            window.testHelpers = {
                gallery,
                galleryService,
                performanceService,
                analyticsService,
                getImageCount: () => gallery.querySelectorAll('[data-gallery-image]').length,
                triggerResize: () => window.dispatchEvent(new Event('resize')),
                simulateClick: (selector) => {
                    const element = gallery.querySelector(selector);
                    if (element) element.click();
                    return element;
                },
                waitForImages: () => {
                    const images = Array.from(gallery.querySelectorAll('img'));
                    return Promise.all(images.map(img => {
                        if (img.complete) return Promise.resolve();
                        return new Promise(resolve => {
                            img.onload = resolve;
                            img.onerror = resolve;
                        });
                    }));
                }
            };
        });
    </script>
</body>
</html>`;
    }

    /**
     * Generate test images HTML
     */
    generateTestImages() {
        const images = [];
        const categories = ['portrait', 'landscape', 'studio'];
        
        for (let i = 1; i <= 12; i++) {
            const category = categories[i % categories.length];
            const width = 400 + (i * 100);
            const height = 300 + (i * 80);
            
            images.push(`
                <div class="gallery-item" data-gallery-image data-image-id="test-img-${i}" data-category="${category}">
                    <img 
                        src="https://picsum.photos/${width}/${height}?random=${i}"
                        alt="Test image ${i}"
                        data-src="https://picsum.photos/${width}/${height}?random=${i}"
                        data-gallery-image
                        data-category="${category}"
                        data-tags="test,sample,${category}"
                        loading="lazy"
                        width="${width}"
                        height="${height}"
                    />
                    <div class="gallery-item-overlay">
                        <button class="gallery-btn gallery-btn--view" data-lightbox>View</button>
                    </div>
                </div>
            `);
        }
        
        return images.join('');
    }

    /**
     * Setup test data
     */
    async setupTestData() {
        if (!this.dbConnection) return;

        console.log('📋 Setting up test data...');

        // Insert test models
        await this.dbConnection.execute(`
            INSERT IGNORE INTO models_test (id, slug, name, theme_set_id) VALUES 
            (1, 'test-model-1', 'Test Model 1', 1),
            (2, 'test-model-2', 'Test Model 2', 2),
            (3, 'test-model-3', 'Test Model 3', 1)
        `);

        // Insert test theme sets
        await this.dbConnection.execute(`
            INSERT IGNORE INTO theme_sets_test (id, name, display_name, category) VALUES 
            (1, 'modern', 'Modern', 'standard'),
            (2, 'luxury', 'Luxury', 'premium'),
            (3, 'minimal', 'Minimal', 'standard')
        `);

        // Insert test gallery configurations
        await this.dbConnection.execute(`
            INSERT IGNORE INTO universal_gallery_configs (model_id, theme_name, layout_type, config_json) VALUES 
            (1, 'modern', 'grid', '{"columns": 3, "spacing": "medium", "lightbox": true}'),
            (2, 'luxury', 'masonry', '{"columns": "auto", "spacing": "large", "lightbox": true}'),
            (3, 'minimal', 'carousel', '{"autoplay": false, "controls": true}')
        `);

        // Insert test images
        const testImages = [];
        for (let i = 1; i <= 20; i++) {
            testImages.push([
                Math.ceil(i / 7), // model_id (distribute across 3 models)
                `test-image-${i}.jpg`,
                `Test Image ${i}`,
                Math.floor(Math.random() * 100000) + 50000, // file_size
                400 + (i * 50), // width
                300 + (i * 40), // height
                `Alt text for test image ${i}`,
                ['portrait', 'landscape', 'studio'][i % 3],
                JSON.stringify(['test', 'sample', 'gallery']),
                true // is_approved
            ]);
        }

        if (testImages.length > 0) {
            const placeholders = testImages.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
            await this.dbConnection.execute(`
                INSERT IGNORE INTO gallery_images_test 
                (model_id, filename, original_name, file_size, width, height, alt_text, category, tags, is_approved) 
                VALUES ${placeholders}
            `, testImages.flat());
        }

        console.log('✅ Test data setup complete');
    }

    /**
     * Setup report directories
     */
    async setupReportDirectories() {
        const dirs = [
            testConfig.paths.reports,
            path.join(testConfig.paths.reports, 'coverage'),
            path.join(testConfig.paths.reports, 'junit'),
            path.join(testConfig.paths.reports, 'html'),
            path.join(testConfig.paths.reports, 'screenshots'),
            path.join(testConfig.paths.reports, 'visual-regression')
        ];

        for (const dir of dirs) {
            try {
                await fs.mkdir(dir, { recursive: true });
            } catch (error) {
                // Directory might already exist
                if (error.code !== 'EEXIST') throw error;
            }
        }

        console.log('✅ Report directories created');
    }

    /**
     * Teardown test server
     */
    async teardownServer() {
        if (this.testServer) {
            return new Promise((resolve) => {
                this.testServer.close(() => {
                    console.log('✅ Test server stopped');
                    resolve();
                });
            });
        }
    }

    /**
     * Teardown test database
     */
    async teardownDatabase() {
        if (!testConfig.database.autoCleanup || !this.dbConnection) return;

        console.log('🗑️  Cleaning up test database...');

        try {
            // Drop test tables
            const testTables = [
                'universal_gallery_configs',
                'gallery_images_test',
                'gallery_performance_sessions_test',
                'gallery_analytics_events_test',
                'models_test',
                'theme_sets_test'
            ];

            for (const table of testTables) {
                await this.dbConnection.execute(`DROP TABLE IF EXISTS ${table}`);
            }

            await this.dbConnection.end();
            console.log('✅ Test database cleaned up');
        } catch (error) {
            console.warn('⚠️  Failed to cleanup test database:', error.message);
        }
    }

    /**
     * Get database connection for tests
     */
    getDbConnection() {
        return this.dbConnection;
    }

    /**
     * Get test utilities
     */
    getTestUtils() {
        return {
            // Wait helpers
            wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
            waitForElement: async (page, selector, timeout = 5000) => {
                return page.waitForSelector(selector, { timeout });
            },
            waitForNetwork: async (page, timeout = 10000) => {
                return page.waitForLoadState('networkidle', { timeout });
            },

            // Gallery helpers
            getGalleryImages: async (page) => {
                return page.$$('[data-gallery-image]');
            },
            clickGalleryImage: async (page, index = 0) => {
                const images = await page.$$('[data-gallery-image]');
                if (images[index]) {
                    await images[index].click();
                }
                return images[index];
            },
            openLightbox: async (page, imageIndex = 0) => {
                await this.clickGalleryImage(page, imageIndex);
                return page.waitForSelector('.lightbox-overlay', { timeout: 2000 });
            },

            // Performance helpers
            getPerformanceMetrics: async (page) => {
                return page.evaluate(() => {
                    return window.testHelpers?.performanceService?.getPerformanceReport();
                });
            },
            getAnalyticsData: async (page) => {
                return page.evaluate(() => {
                    return window.testHelpers?.analyticsService?.getAnalyticsSummary();
                });
            },

            // Screenshot helpers
            takeScreenshot: async (page, name, fullPage = false) => {
                const screenshotPath = path.join(testConfig.paths.reports, 'screenshots', `${name}-${Date.now()}.png`);
                await page.screenshot({ path: screenshotPath, fullPage });
                return screenshotPath;
            }
        };
    }
}

// Export singleton instance
const testSetup = new UniversalGalleryTestSetup();

module.exports = testSetup;