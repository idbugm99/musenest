/**
 * Jest Setup Configuration
 * 
 * Global Jest setup for Universal Gallery testing.
 * Configures test environment, utilities, and custom matchers.
 */

const testSetup = require('./test-setup');
const testConfig = require('./test-config');
const { configureToMatchImageSnapshot } = require('jest-image-snapshot');

// Configure image snapshot testing
const toMatchImageSnapshot = configureToMatchImageSnapshot({
    threshold: testConfig.visualRegression.threshold,
    customSnapshotsDir: testConfig.visualRegression.baselineDir,
    customDiffDir: testConfig.paths.reports + '/visual-regression/diffs',
    customReceivedDir: testConfig.paths.reports + '/visual-regression/received'
});

expect.extend({ toMatchImageSnapshot });

// Global test setup
beforeAll(async () => {
    if (global.setupComplete) return;
    
    console.log('🧪 Setting up Universal Gallery test environment...');
    await testSetup.setupGlobal();
    global.setupComplete = true;
}, testConfig.environment.setupTimeout);

// Global test teardown
afterAll(async () => {
    if (!global.setupComplete) return;
    
    console.log('🧹 Cleaning up Universal Gallery test environment...');
    await testSetup.teardownGlobal();
    global.setupComplete = false;
}, testConfig.environment.teardownTimeout);

// Global test helpers
global.testHelpers = {
    config: testConfig,
    setup: testSetup,
    utils: testSetup.getTestUtils(),
    
    // Wait utilities
    wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
    waitFor: async (condition, timeout = 5000) => {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            if (await condition()) {
                return true;
            }
            await global.testHelpers.wait(100);
        }
        throw new Error(`Condition not met within ${timeout}ms`);
    },
    
    // Mock utilities
    mockFetch: (response) => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(response),
            text: () => Promise.resolve(JSON.stringify(response))
        });
        return global.fetch;
    },
    
    mockFailedFetch: (error) => {
        global.fetch = jest.fn().mockRejectedValue(error || new Error('Fetch failed'));
        return global.fetch;
    },
    
    // Gallery test utilities
    createTestGallery: (config = {}) => {
        const defaultConfig = {
            layout: 'grid',
            columns: 3,
            spacing: 'medium',
            lightbox: true,
            lazy: true
        };
        
        return { ...defaultConfig, ...config };
    },
    
    createTestImages: (count = 5) => {
        const images = [];
        for (let i = 1; i <= count; i++) {
            images.push({
                id: `test-img-${i}`,
                src: `https://picsum.photos/400/300?random=${i}`,
                alt: `Test Image ${i}`,
                width: 400,
                height: 300,
                category: ['portrait', 'landscape', 'studio'][i % 3]
            });
        }
        return images;
    }
};

// Custom Jest matchers
expect.extend({
    toBeWithinRange(received, floor, ceiling) {
        const pass = received >= floor && received <= ceiling;
        if (pass) {
            return {
                message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
                pass: true
            };
        } else {
            return {
                message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
                pass: false
            };
        }
    },
    
    toHaveValidImageSrc(received) {
        const pass = typeof received === 'string' && 
                    (received.startsWith('http') || received.startsWith('data:') || received.startsWith('/'));
        if (pass) {
            return {
                message: () => `expected ${received} not to be a valid image src`,
                pass: true
            };
        } else {
            return {
                message: () => `expected ${received} to be a valid image src`,
                pass: false
            };
        }
    },
    
    toHaveValidPerformanceMetrics(received) {
        const isValid = received &&
                       typeof received.lcp === 'number' &&
                       typeof received.fid === 'number' &&
                       typeof received.cls === 'number' &&
                       received.lcp >= 0 &&
                       received.fid >= 0 &&
                       received.cls >= 0;
        
        if (isValid) {
            return {
                message: () => `expected performance metrics not to be valid`,
                pass: true
            };
        } else {
            return {
                message: () => `expected valid performance metrics with lcp, fid, and cls properties`,
                pass: false
            };
        }
    }
});

// Error handling for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit the process in tests
});

// Console override for cleaner test output
if (process.env.NODE_ENV === 'test' && !process.env.TEST_VERBOSE) {
    const originalConsole = global.console;
    global.console = {
        ...originalConsole,
        log: jest.fn(),
        info: jest.fn(),
        warn: originalConsole.warn,
        error: originalConsole.error
    };
}

// Increase timeout for slower tests
jest.setTimeout(testConfig.environment.testTimeout);

// Mock browser APIs for unit tests
if (typeof window === 'undefined') {
    global.window = {
        innerWidth: 1920,
        innerHeight: 1080,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
        location: {
            href: 'http://localhost:3001',
            origin: 'http://localhost:3001'
        },
        performance: {
            now: () => Date.now()
        }
    };
}

if (typeof document === 'undefined') {
    global.document = {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        querySelector: jest.fn(),
        querySelectorAll: jest.fn(() => []),
        createElement: jest.fn(() => ({
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            click: jest.fn(),
            setAttribute: jest.fn(),
            getAttribute: jest.fn(),
            style: {}
        })),
        body: {
            appendChild: jest.fn(),
            removeChild: jest.fn()
        }
    };
}

if (typeof navigator === 'undefined') {
    global.navigator = {
        userAgent: 'Mozilla/5.0 (Test Environment)',
        language: 'en-US'
    };
}

// Mock IntersectionObserver for unit tests
if (typeof IntersectionObserver === 'undefined') {
    global.IntersectionObserver = jest.fn().mockImplementation((callback) => ({
        observe: jest.fn(),
        unobserve: jest.fn(),
        disconnect: jest.fn(),
        callback
    }));
}

// Mock ResizeObserver for unit tests
if (typeof ResizeObserver === 'undefined') {
    global.ResizeObserver = jest.fn().mockImplementation((callback) => ({
        observe: jest.fn(),
        unobserve: jest.fn(),
        disconnect: jest.fn(),
        callback
    }));
}

// Mock PerformanceObserver for unit tests
if (typeof PerformanceObserver === 'undefined') {
    global.PerformanceObserver = jest.fn().mockImplementation((callback) => ({
        observe: jest.fn(),
        disconnect: jest.fn(),
        callback
    }));
}

// Test result tracking for screenshots
let currentTest = null;

beforeEach(() => {
    currentTest = expect.getState().currentTestName;
    global.currentTestFailed = false;
});

afterEach(() => {
    if (expect.getState().numPassingAsserts === 0) {
        global.currentTestFailed = true;
    }
});

console.log('✅ Jest setup complete for Universal Gallery tests');