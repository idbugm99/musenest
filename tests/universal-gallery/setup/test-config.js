/**
 * Universal Gallery Testing Configuration
 * 
 * Centralized configuration for all gallery testing suites including
 * unit tests, integration tests, e2e tests, and performance tests.
 */

const path = require('path');

module.exports = {
    // Test environment configuration
    environment: {
        testTimeout: 30000,
        setupTimeout: 10000,
        teardownTimeout: 5000,
        maxWorkers: 4,
        verbose: process.env.NODE_ENV === 'development'
    },

    // Database configuration for testing
    database: {
        host: process.env.TEST_DB_HOST || 'localhost',
        user: process.env.TEST_DB_USER || 'root',
        password: process.env.TEST_DB_PASSWORD || '',
        database: process.env.TEST_DB_NAME || 'musenest_test',
        port: process.env.TEST_DB_PORT || 3306,
        charset: 'utf8mb4',
        // Auto-create and cleanup test database
        autoSetup: true,
        autoCleanup: true
    },

    // Server configuration for integration tests
    server: {
        host: 'localhost',
        port: process.env.TEST_PORT || 3001,
        baseUrl: `http://localhost:${process.env.TEST_PORT || 3001}`,
        staticPath: path.join(__dirname, '../../../public'),
        // Auto-start server for integration tests
        autoStart: true,
        autoStop: true
    },

    // Browser configuration for e2e tests
    browser: {
        headless: process.env.CI === 'true' || process.env.HEADLESS === 'true',
        viewport: {
            width: 1920,
            height: 1080
        },
        slowMo: process.env.NODE_ENV === 'development' ? 100 : 0,
        devtools: process.env.NODE_ENV === 'development',
        timeout: 30000,
        // Browser contexts for testing different devices
        contexts: {
            desktop: {
                viewport: { width: 1920, height: 1080 },
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            mobile: {
                viewport: { width: 375, height: 812 },
                userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
                isMobile: true,
                hasTouch: true
            },
            tablet: {
                viewport: { width: 768, height: 1024 },
                userAgent: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
                isMobile: true,
                hasTouch: true
            }
        }
    },

    // Test data configuration
    testData: {
        // Sample gallery configurations for testing
        galleries: {
            basic: {
                layout: 'grid',
                columns: 3,
                spacing: 'medium',
                lightbox: true,
                lazy: true
            },
            masonry: {
                layout: 'masonry',
                columns: 'auto',
                spacing: 'small',
                lightbox: true,
                lazy: true,
                aspectRatio: 'mixed'
            },
            carousel: {
                layout: 'carousel',
                autoplay: false,
                controls: true,
                indicators: true,
                infinite: true
            }
        },
        // Sample theme configurations
        themes: {
            luxury: {
                name: 'luxury',
                category: 'premium',
                layouts: ['grid', 'masonry', 'carousel'],
                features: ['lightbox', 'lazy-loading', 'filters']
            },
            modern: {
                name: 'modern',
                category: 'standard',
                layouts: ['grid', 'masonry'],
                features: ['lightbox', 'lazy-loading']
            }
        },
        // Sample image data
        images: {
            small: {
                id: 'img_001',
                src: '/test-assets/image-small.jpg',
                alt: 'Test image small',
                width: 400,
                height: 300,
                size: 25000
            },
            medium: {
                id: 'img_002',
                src: '/test-assets/image-medium.jpg',
                alt: 'Test image medium',
                width: 800,
                height: 600,
                size: 75000
            },
            large: {
                id: 'img_003',
                src: '/test-assets/image-large.jpg',
                alt: 'Test image large',
                width: 1600,
                height: 1200,
                size: 200000
            }
        }
    },

    // Performance testing thresholds
    performance: {
        // Core Web Vitals thresholds
        coreWebVitals: {
            lcp: {
                good: 2500,      // ≤ 2.5s
                needsImprovement: 4000, // ≤ 4.0s
                poor: 4001       // > 4.0s
            },
            fid: {
                good: 100,       // ≤ 100ms
                needsImprovement: 300,  // ≤ 300ms
                poor: 301        // > 300ms
            },
            cls: {
                good: 0.1,       // ≤ 0.1
                needsImprovement: 0.25, // ≤ 0.25
                poor: 0.26       // > 0.25
            }
        },
        // Image loading thresholds
        imageLoading: {
            maxLoadTime: 3000,   // 3 seconds
            maxTransferSize: 500000, // 500KB
            minCacheHitRate: 0.8 // 80%
        },
        // JavaScript performance thresholds
        javascript: {
            maxBundleSize: 250000,   // 250KB
            maxExecutionTime: 50,    // 50ms
            maxMemoryUsage: 50000000 // 50MB
        }
    },

    // Accessibility testing configuration
    accessibility: {
        // axe-core configuration
        axe: {
            rules: {
                'color-contrast': { enabled: true },
                'keyboard-navigation': { enabled: true },
                'focus-management': { enabled: true },
                'aria-labels': { enabled: true },
                'semantic-structure': { enabled: true }
            },
            tags: ['wcag2a', 'wcag2aa', 'wcag21aa'],
            // Disable rules that don't apply to galleries
            disableRules: ['page-has-heading-one']
        },
        // Keyboard navigation tests
        keyboard: {
            testSequences: [
                ['Tab', 'Tab', 'Enter'],        // Navigate to first image and open
                ['Escape'],                     // Close lightbox
                ['Tab', 'ArrowRight', 'Enter'], // Navigate with arrows
                ['Home', 'End']                 // Jump to start/end
            ]
        }
    },

    // Visual regression testing
    visualRegression: {
        threshold: 0.02, // 2% pixel difference threshold
        screenshotDir: path.join(__dirname, '../screenshots'),
        baselineDir: path.join(__dirname, '../baselines'),
        // Viewport configurations for visual tests
        viewports: [
            { width: 1920, height: 1080, name: 'desktop' },
            { width: 1024, height: 768, name: 'tablet' },
            { width: 375, height: 812, name: 'mobile' }
        ],
        // Gallery states to test
        states: [
            'default',
            'loading',
            'error',
            'empty',
            'lightbox-open',
            'filter-active'
        ]
    },

    // API testing configuration
    api: {
        baseUrl: `http://localhost:${process.env.TEST_PORT || 3001}/api`,
        timeout: 10000,
        retries: 3,
        // Default headers for API tests
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        // Authentication configuration for protected endpoints
        auth: {
            adminToken: process.env.TEST_ADMIN_TOKEN || 'test_admin_token',
            userToken: process.env.TEST_USER_TOKEN || 'test_user_token'
        }
    },

    // File paths
    paths: {
        root: path.join(__dirname, '../../..'),
        src: path.join(__dirname, '../../../src'),
        admin: path.join(__dirname, '../../../admin'),
        themes: path.join(__dirname, '../../../themes'),
        public: path.join(__dirname, '../../../public'),
        tests: path.join(__dirname, '..'),
        fixtures: path.join(__dirname, '../fixtures'),
        reports: path.join(__dirname, '../reports')
    },

    // Test reporting configuration
    reporting: {
        coverage: {
            enabled: true,
            threshold: {
                global: {
                    branches: 80,
                    functions: 85,
                    lines: 85,
                    statements: 85
                }
            },
            reportFormats: ['text', 'html', 'lcov']
        },
        junit: {
            enabled: process.env.CI === 'true',
            outputDir: path.join(__dirname, '../reports/junit')
        },
        html: {
            enabled: true,
            outputDir: path.join(__dirname, '../reports/html')
        }
    },

    // Mock configurations
    mocks: {
        // Mock external services
        services: {
            imageOptimization: true,
            analytics: true,
            cdn: true
        },
        // Mock API responses
        api: {
            delay: 100, // Simulate network delay
            failureRate: 0.05 // 5% failure rate for error handling tests
        }
    },

    // Utilities
    utils: {
        // Helper functions available in all tests
        waitForElement: 5000,
        waitForNetwork: 10000,
        waitForAnimation: 1000,
        retryAttempts: 3,
        screenshotOnFailure: true
    }
};