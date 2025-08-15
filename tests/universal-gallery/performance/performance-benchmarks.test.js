/**
 * Automated Performance Testing and Benchmarking
 * 
 * Comprehensive performance testing suite that measures and validates
 * Core Web Vitals, image loading performance, memory usage, and
 * JavaScript execution performance across different gallery configurations.
 */

const { chromium } = require('playwright');
const testSetup = require('../setup/test-setup');
const testConfig = require('../setup/test-config');
const path = require('path');
const fs = require('fs').promises;

describe('Gallery Performance Benchmarks', () => {
    let browser;
    let context;
    let page;
    let performanceResults = [];
    let utils;

    beforeAll(async () => {
        await testSetup.setupGlobal();
        utils = testSetup.getTestUtils();
        
        browser = await chromium.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-dev-shm-usage',
                '--disable-web-security',
                '--disable-features=TranslateUI',
                '--disable-extensions',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding'
            ]
        });
    });

    afterAll(async () => {
        if (browser) {
            await browser.close();
        }
        
        // Generate performance report
        await generatePerformanceReport(performanceResults);
        await testSetup.teardownGlobal();
    });

    beforeEach(async () => {
        context = await browser.newContext({
            viewport: { width: 1920, height: 1080 }
        });
        page = await context.newPage();
        
        // Enable performance monitoring
        await page.addInitScript(() => {
            window.performanceMetrics = {
                navigation: null,
                paint: [],
                lcp: null,
                fid: null,
                cls: 0,
                customMetrics: {}
            };
            
            // Monitor Core Web Vitals
            if ('PerformanceObserver' in window) {
                // LCP Observer
                const lcpObserver = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    const lastEntry = entries[entries.length - 1];
                    window.performanceMetrics.lcp = lastEntry.startTime;
                });
                lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
                
                // FID Observer (approximation)
                const fidObserver = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    entries.forEach(entry => {
                        if (entry.processingStart && entry.startTime) {
                            window.performanceMetrics.fid = entry.processingStart - entry.startTime;
                        }
                    });
                });
                fidObserver.observe({ entryTypes: ['first-input'] });
                
                // Navigation Observer
                const navObserver = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    if (entries.length > 0) {
                        window.performanceMetrics.navigation = entries[0];
                    }
                });
                navObserver.observe({ entryTypes: ['navigation'] });
                
                // Paint Observer
                const paintObserver = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    window.performanceMetrics.paint = entries;
                });
                paintObserver.observe({ entryTypes: ['paint'] });
            }
            
            // CLS monitoring
            let clsValue = 0;
            let sessionValue = 0;
            let sessionEntries = [];
            
            if ('PerformanceObserver' in window) {
                const clsObserver = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        if (!entry.hadRecentInput) {
                            const firstSessionEntry = sessionEntries[0];
                            const lastSessionEntry = sessionEntries[sessionEntries.length - 1];
                            
                            if (sessionValue && entry.startTime - lastSessionEntry.startTime < 1000 && entry.startTime - firstSessionEntry.startTime < 5000) {
                                sessionValue += entry.value;
                                sessionEntries.push(entry);
                            } else {
                                sessionValue = entry.value;
                                sessionEntries = [entry];
                            }
                            
                            if (sessionValue > clsValue) {
                                clsValue = sessionValue;
                                window.performanceMetrics.cls = clsValue;
                            }
                        }
                    }
                });
                clsObserver.observe({ entryTypes: ['layout-shift'] });
            }
            
            // Custom metrics tracking
            window.trackCustomMetric = (name, value, unit = 'ms') => {
                window.performanceMetrics.customMetrics[name] = { value, unit, timestamp: Date.now() };
            };
        });
    });

    afterEach(async () => {
        if (context) {
            await context.close();
        }
    });

    describe('Core Web Vitals Benchmarks', () => {
        const testConfigurations = [
            { theme: 'modern', layout: 'grid', images: 12 },
            { theme: 'luxury', layout: 'masonry', images: 24 },
            { theme: 'minimal', layout: 'carousel', images: 8 }
        ];

        testConfigurations.forEach(config => {
            test(`should meet Core Web Vitals thresholds - ${config.theme} ${config.layout}`, async () => {
                const startTime = Date.now();
                
                // Navigate to gallery
                await page.goto(`${testConfig.server.baseUrl}/test/gallery/${config.theme}`);
                
                // Wait for gallery to fully load
                await page.waitForSelector('[data-gallery-container]');
                await utils.waitForNetwork(page);
                
                // Wait for images to load
                await page.waitForFunction(() => {
                    const images = document.querySelectorAll('[data-gallery-image] img');
                    return Array.from(images).every(img => img.complete && img.naturalHeight !== 0);
                }, { timeout: 10000 });
                
                // Allow time for CLS to stabilize
                await page.waitForTimeout(2000);
                
                // Collect performance metrics
                const metrics = await page.evaluate(() => window.performanceMetrics);
                const loadTime = Date.now() - startTime;
                
                // Validate Core Web Vitals
                const coreWebVitals = {
                    lcp: metrics.lcp,
                    fid: metrics.fid || 0, // FID might not be available in automated tests
                    cls: metrics.cls,
                    loadTime
                };
                
                // Record results
                performanceResults.push({
                    testName: `Core Web Vitals - ${config.theme} ${config.layout}`,
                    configuration: config,
                    metrics: coreWebVitals,
                    timestamp: new Date().toISOString(),
                    passed: {
                        lcp: coreWebVitals.lcp <= testConfig.performance.coreWebVitals.lcp.good,
                        fid: coreWebVitals.fid <= testConfig.performance.coreWebVitals.fid.good,
                        cls: coreWebVitals.cls <= testConfig.performance.coreWebVitals.cls.good,
                        loadTime: loadTime <= 5000
                    }
                });
                
                // Assertions
                expect(coreWebVitals.lcp).toBeLessThanOrEqual(testConfig.performance.coreWebVitals.lcp.good);
                expect(coreWebVitals.cls).toBeLessThanOrEqual(testConfig.performance.coreWebVitals.cls.good);
                expect(loadTime).toBeLessThan(5000); // 5 second total load time
                
                console.log(`📊 ${config.theme} ${config.layout}:`, {
                    LCP: `${Math.round(coreWebVitals.lcp)}ms`,
                    FID: `${Math.round(coreWebVitals.fid)}ms`,
                    CLS: `${coreWebVitals.cls.toFixed(3)}`,
                    Load: `${loadTime}ms`
                });
            }, 30000);
        });
    });

    describe('Image Loading Performance', () => {
        test('should load images within performance thresholds', async () => {
            await page.goto(`${testConfig.server.baseUrl}/test/gallery/modern`);
            await page.waitForSelector('[data-gallery-container]');
            
            // Track image loading performance
            const imageMetrics = await page.evaluate(async () => {
                const images = Array.from(document.querySelectorAll('[data-gallery-image] img'));
                const metrics = [];
                
                for (const img of images) {
                    const startTime = performance.now();
                    
                    if (!img.complete) {
                        await new Promise((resolve, reject) => {
                            img.onload = resolve;
                            img.onerror = reject;
                            setTimeout(reject, 5000); // 5 second timeout
                        }).catch(() => {});
                    }
                    
                    const loadTime = performance.now() - startTime;
                    
                    metrics.push({
                        src: img.src,
                        loadTime: loadTime,
                        naturalWidth: img.naturalWidth,
                        naturalHeight: img.naturalHeight,
                        fileSize: await fetch(img.src)
                            .then(res => parseInt(res.headers.get('content-length') || '0'))
                            .catch(() => 0)
                    });
                }
                
                return metrics;
            });
            
            // Analyze image performance
            const totalLoadTime = imageMetrics.reduce((sum, img) => sum + img.loadTime, 0);
            const averageLoadTime = totalLoadTime / imageMetrics.length;
            const maxLoadTime = Math.max(...imageMetrics.map(img => img.loadTime));
            const totalFileSize = imageMetrics.reduce((sum, img) => sum + img.fileSize, 0);
            
            performanceResults.push({
                testName: 'Image Loading Performance',
                metrics: {
                    imageCount: imageMetrics.length,
                    averageLoadTime,
                    maxLoadTime,
                    totalLoadTime,
                    totalFileSize,
                    averageFileSize: totalFileSize / imageMetrics.length
                },
                timestamp: new Date().toISOString()
            });
            
            // Assertions
            expect(averageLoadTime).toBeLessThan(testConfig.performance.imageLoading.maxLoadTime);
            expect(maxLoadTime).toBeLessThan(testConfig.performance.imageLoading.maxLoadTime * 2);
            
            console.log('🖼️  Image Performance:', {
                count: imageMetrics.length,
                avgLoad: `${Math.round(averageLoadTime)}ms`,
                maxLoad: `${Math.round(maxLoadTime)}ms`,
                totalSize: `${Math.round(totalFileSize / 1024)}KB`
            });
        }, 20000);

        test('should optimize lazy loading performance', async () => {
            await page.goto(`${testConfig.server.baseUrl}/test/gallery/modern`);
            await page.waitForSelector('[data-gallery-container]');
            
            // Test lazy loading by scrolling
            const lazyMetrics = await page.evaluate(async () => {
                const results = {
                    initiallyLoaded: 0,
                    lazyLoaded: 0,
                    loadTimes: []
                };
                
                // Check initially loaded images
                const allImages = document.querySelectorAll('[data-gallery-image] img');
                allImages.forEach(img => {
                    if (img.complete) results.initiallyLoaded++;
                });
                
                // Scroll to trigger lazy loading
                window.scrollTo(0, document.body.scrollHeight);
                
                // Wait for lazy images to load
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Check final loaded count
                allImages.forEach(img => {
                    if (img.complete) results.lazyLoaded++;
                });
                
                results.lazyLoaded -= results.initiallyLoaded;
                
                return results;
            });
            
            performanceResults.push({
                testName: 'Lazy Loading Performance',
                metrics: lazyMetrics,
                timestamp: new Date().toISOString()
            });
            
            expect(lazyMetrics.initiallyLoaded).toBeGreaterThan(0);
            expect(lazyMetrics.lazyLoaded).toBeGreaterThan(0);
            
            console.log('⚡ Lazy Loading:', {
                initial: lazyMetrics.initiallyLoaded,
                lazy: lazyMetrics.lazyLoaded
            });
        });
    });

    describe('Memory Usage Benchmarks', () => {
        test('should maintain memory usage within acceptable limits', async () => {
            await page.goto(`${testConfig.server.baseUrl}/test/gallery/luxury`);
            await page.waitForSelector('[data-gallery-container]');
            
            // Get initial memory usage
            const initialMemory = await page.evaluate(() => {
                return performance.memory ? {
                    usedJSHeapSize: performance.memory.usedJSHeapSize,
                    totalJSHeapSize: performance.memory.totalJSHeapSize,
                    jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
                } : null;
            });
            
            if (!initialMemory) {
                console.log('⚠️  Memory API not available in this browser');
                return;
            }
            
            // Perform memory-intensive operations
            await page.evaluate(async () => {
                // Open and close lightbox multiple times
                for (let i = 0; i < 5; i++) {
                    const images = document.querySelectorAll('[data-gallery-image]');
                    if (images[i]) {
                        images[i].click();
                        await new Promise(resolve => setTimeout(resolve, 500));
                        
                        // Close lightbox
                        const escEvent = new KeyboardEvent('keydown', { key: 'Escape' });
                        document.dispatchEvent(escEvent);
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                }
                
                // Force garbage collection if available
                if (window.gc) {
                    window.gc();
                }
            });
            
            // Get final memory usage
            const finalMemory = await page.evaluate(() => {
                return performance.memory ? {
                    usedJSHeapSize: performance.memory.usedJSHeapSize,
                    totalJSHeapSize: performance.memory.totalJSHeapSize,
                    jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
                } : null;
            });
            
            const memoryIncrease = finalMemory.usedJSHeapSize - initialMemory.usedJSHeapSize;
            const memoryUsagePercent = (finalMemory.usedJSHeapSize / finalMemory.jsHeapSizeLimit) * 100;
            
            performanceResults.push({
                testName: 'Memory Usage Benchmark',
                metrics: {
                    initialMemory: initialMemory.usedJSHeapSize,
                    finalMemory: finalMemory.usedJSHeapSize,
                    memoryIncrease,
                    memoryUsagePercent,
                    heapLimit: finalMemory.jsHeapSizeLimit
                },
                timestamp: new Date().toISOString()
            });
            
            // Memory should not increase dramatically
            expect(memoryIncrease).toBeLessThan(testConfig.performance.javascript.maxMemoryUsage);
            expect(memoryUsagePercent).toBeLessThan(80); // Less than 80% of heap limit
            
            console.log('🧠 Memory Usage:', {
                initial: `${Math.round(initialMemory.usedJSHeapSize / 1024 / 1024)}MB`,
                final: `${Math.round(finalMemory.usedJSHeapSize / 1024 / 1024)}MB`,
                increase: `${Math.round(memoryIncrease / 1024 / 1024)}MB`,
                usage: `${memoryUsagePercent.toFixed(1)}%`
            });
        }, 15000);
    });

    describe('JavaScript Execution Performance', () => {
        test('should execute gallery operations within performance budgets', async () => {
            await page.goto(`${testConfig.server.baseUrl}/test/gallery/modern`);
            await page.waitForSelector('[data-gallery-container]');
            
            // Benchmark gallery operations
            const jsPerformance = await page.evaluate(async () => {
                const results = {};
                
                // Benchmark gallery initialization
                const initStart = performance.now();
                if (window.testHelpers?.galleryService) {
                    await window.testHelpers.galleryService.updateConfig({ layout: 'masonry' });
                }
                results.initTime = performance.now() - initStart;
                
                // Benchmark image click handling
                const clickStart = performance.now();
                const firstImage = document.querySelector('[data-gallery-image]');
                if (firstImage) {
                    firstImage.click();
                    // Wait for lightbox to open
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
                results.clickTime = performance.now() - clickStart;
                
                // Benchmark search filtering
                const searchStart = performance.now();
                const searchInput = document.querySelector('[data-gallery-search]');
                if (searchInput) {
                    searchInput.value = 'test';
                    searchInput.dispatchEvent(new Event('input'));
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
                results.searchTime = performance.now() - searchStart;
                
                // Benchmark layout recalculation
                const layoutStart = performance.now();
                window.dispatchEvent(new Event('resize'));
                await new Promise(resolve => setTimeout(resolve, 300));
                results.layoutTime = performance.now() - layoutStart;
                
                return results;
            });
            
            performanceResults.push({
                testName: 'JavaScript Execution Performance',
                metrics: jsPerformance,
                timestamp: new Date().toISOString()
            });
            
            // Assertions
            expect(jsPerformance.initTime).toBeLessThan(testConfig.performance.javascript.maxExecutionTime);
            expect(jsPerformance.clickTime).toBeLessThan(testConfig.performance.javascript.maxExecutionTime);
            expect(jsPerformance.searchTime).toBeLessThan(200); // 200ms for search
            expect(jsPerformance.layoutTime).toBeLessThan(300); // 300ms for layout
            
            console.log('⚡ JS Performance:', {
                init: `${Math.round(jsPerformance.initTime)}ms`,
                click: `${Math.round(jsPerformance.clickTime)}ms`,
                search: `${Math.round(jsPerformance.searchTime)}ms`,
                layout: `${Math.round(jsPerformance.layoutTime)}ms`
            });
        });
    });

    describe('Network Performance', () => {
        test('should optimize network resource loading', async () => {
            // Monitor network activity
            const responses = [];
            page.on('response', response => {
                responses.push({
                    url: response.url(),
                    status: response.status(),
                    size: parseInt(response.headers()['content-length'] || '0'),
                    loadTime: response.timing()?.responseEnd - response.timing()?.requestStart || 0,
                    cached: response.fromCache(),
                    resourceType: response.request().resourceType()
                });
            });
            
            await page.goto(`${testConfig.server.baseUrl}/test/gallery/luxury`);
            await page.waitForSelector('[data-gallery-container]');
            await utils.waitForNetwork(page);
            
            // Analyze network performance
            const imageResponses = responses.filter(r => r.resourceType === 'image');
            const jsResponses = responses.filter(r => r.resourceType === 'script');
            const cssResponses = responses.filter(r => r.resourceType === 'stylesheet');
            
            const totalSize = responses.reduce((sum, r) => sum + r.size, 0);
            const totalImages = imageResponses.length;
            const averageImageSize = imageResponses.reduce((sum, r) => sum + r.size, 0) / totalImages;
            const cacheHitRate = responses.filter(r => r.cached).length / responses.length;
            
            const networkMetrics = {
                totalRequests: responses.length,
                totalSize,
                totalImages,
                averageImageSize,
                cacheHitRate,
                jsRequests: jsResponses.length,
                cssRequests: cssResponses.length,
                failedRequests: responses.filter(r => r.status >= 400).length
            };
            
            performanceResults.push({
                testName: 'Network Performance',
                metrics: networkMetrics,
                timestamp: new Date().toISOString()
            });
            
            // Assertions
            expect(totalSize).toBeLessThan(5 * 1024 * 1024); // Less than 5MB total
            expect(averageImageSize).toBeLessThan(testConfig.performance.imageLoading.maxTransferSize);
            expect(networkMetrics.failedRequests).toBe(0);
            
            console.log('🌐 Network Performance:', {
                requests: networkMetrics.totalRequests,
                size: `${Math.round(totalSize / 1024)}KB`,
                images: totalImages,
                cacheHit: `${Math.round(cacheHitRate * 100)}%`
            });
        });
    });

    describe('Comparative Performance Analysis', () => {
        test('should compare performance across gallery configurations', async () => {
            const configurations = [
                { theme: 'modern', layout: 'grid', name: 'Modern Grid' },
                { theme: 'luxury', layout: 'masonry', name: 'Luxury Masonry' },
                { theme: 'minimal', layout: 'carousel', name: 'Minimal Carousel' }
            ];
            
            const comparisonResults = [];
            
            for (const config of configurations) {
                const startTime = Date.now();
                
                await page.goto(`${testConfig.server.baseUrl}/test/gallery/${config.theme}`);
                await page.waitForSelector('[data-gallery-container]');
                await utils.waitForNetwork(page);
                
                const metrics = await page.evaluate(() => {
                    return {
                        ...window.performanceMetrics,
                        domContentLoaded: performance.timing ? 
                            performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart : 0,
                        loadComplete: performance.timing ? 
                            performance.timing.loadEventEnd - performance.timing.navigationStart : 0
                    };
                });
                
                const totalTime = Date.now() - startTime;
                
                comparisonResults.push({
                    configuration: config,
                    metrics: {
                        ...metrics,
                        totalTime,
                        lcp: metrics.lcp || 0,
                        cls: metrics.cls || 0
                    }
                });
                
                // Brief pause between tests
                await page.waitForTimeout(1000);
            }
            
            performanceResults.push({
                testName: 'Comparative Performance Analysis',
                results: comparisonResults,
                timestamp: new Date().toISOString()
            });
            
            // Find best and worst performing configurations
            const bestLCP = comparisonResults.reduce((best, current) => 
                current.metrics.lcp < best.metrics.lcp ? current : best
            );
            
            const bestCLS = comparisonResults.reduce((best, current) => 
                current.metrics.cls < best.metrics.cls ? current : best
            );
            
            console.log('🏆 Performance Comparison:');
            comparisonResults.forEach(result => {
                console.log(`  ${result.configuration.name}:`, {
                    LCP: `${Math.round(result.metrics.lcp)}ms`,
                    CLS: `${result.metrics.cls.toFixed(3)}`,
                    Total: `${result.metrics.totalTime}ms`
                });
            });
            
            console.log(`🥇 Best LCP: ${bestLCP.configuration.name}`);
            console.log(`🥇 Best CLS: ${bestCLS.configuration.name}`);
            
            // All configurations should meet minimum thresholds
            comparisonResults.forEach(result => {
                expect(result.metrics.lcp).toBeLessThan(testConfig.performance.coreWebVitals.lcp.needsImprovement);
                expect(result.metrics.cls).toBeLessThan(testConfig.performance.coreWebVitals.cls.needsImprovement);
            });
        }, 45000);
    });
});

/**
 * Generate comprehensive performance report
 */
async function generatePerformanceReport(results) {
    const reportDir = path.join(testConfig.paths.reports, 'performance');
    await fs.mkdir(reportDir, { recursive: true });
    
    // Generate JSON report
    const jsonReport = {
        generatedAt: new Date().toISOString(),
        testEnvironment: {
            browser: 'chromium',
            viewport: '1920x1080',
            version: require('playwright/package.json').version
        },
        summary: generateSummary(results),
        results,
        thresholds: testConfig.performance
    };
    
    await fs.writeFile(
        path.join(reportDir, 'performance-report.json'),
        JSON.stringify(jsonReport, null, 2)
    );
    
    // Generate HTML report
    const htmlReport = generateHTMLReport(jsonReport);
    await fs.writeFile(
        path.join(reportDir, 'performance-report.html'),
        htmlReport
    );
    
    console.log('📊 Performance report generated:', path.join(reportDir, 'performance-report.html'));
}

function generateSummary(results) {
    const coreWebVitalTests = results.filter(r => r.testName.includes('Core Web Vitals'));
    const memoryTests = results.filter(r => r.testName.includes('Memory'));
    const networkTests = results.filter(r => r.testName.includes('Network'));
    
    return {
        totalTests: results.length,
        coreWebVitalsPass: coreWebVitalTests.filter(t => t.passed?.lcp && t.passed?.cls).length,
        averageLoadTime: coreWebVitalTests.reduce((sum, t) => sum + (t.metrics?.loadTime || 0), 0) / coreWebVitalTests.length,
        memoryEfficient: memoryTests.filter(t => (t.metrics?.memoryUsagePercent || 100) < 80).length,
        networkOptimized: networkTests.filter(t => (t.metrics?.cacheHitRate || 0) > 0.6).length
    };
}

function generateHTMLReport(report) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Universal Gallery Performance Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { border-bottom: 2px solid #007acc; padding-bottom: 20px; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .summary-card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; text-align: center; }
        .summary-card h3 { margin: 0 0 10px 0; font-size: 2em; }
        .summary-card p { margin: 0; opacity: 0.9; }
        .test-result { background: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #28a745; }
        .test-result.warning { border-left-color: #ffc107; }
        .test-result.error { border-left-color: #dc3545; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-top: 15px; }
        .metric { text-align: center; padding: 10px; background: white; border-radius: 4px; }
        .metric-value { font-size: 1.5em; font-weight: bold; color: #007acc; }
        .metric-label { font-size: 0.85em; color: #666; margin-top: 5px; }
        .timestamp { color: #666; font-size: 0.9em; }
        pre { background: #f1f1f1; padding: 15px; border-radius: 4px; overflow-x: auto; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Universal Gallery Performance Report</h1>
            <p class="timestamp">Generated: ${report.generatedAt}</p>
        </div>
        
        <div class="summary">
            <div class="summary-card">
                <h3>${report.summary.totalTests}</h3>
                <p>Total Tests</p>
            </div>
            <div class="summary-card">
                <h3>${Math.round(report.summary.averageLoadTime)}ms</h3>
                <p>Avg Load Time</p>
            </div>
            <div class="summary-card">
                <h3>${report.summary.coreWebVitalsPass}/${report.summary.totalTests}</h3>
                <p>Core Web Vitals Pass</p>
            </div>
            <div class="summary-card">
                <h3>${report.summary.memoryEfficient}</h3>
                <p>Memory Efficient</p>
            </div>
        </div>
        
        <h2>📊 Test Results</h2>
        ${report.results.map(result => `
            <div class="test-result">
                <h3>${result.testName}</h3>
                <p class="timestamp">${result.timestamp}</p>
                ${result.metrics ? `
                    <div class="metrics">
                        ${Object.entries(result.metrics).map(([key, value]) => `
                            <div class="metric">
                                <div class="metric-value">${typeof value === 'number' ? Math.round(value * 100) / 100 : value}</div>
                                <div class="metric-label">${key}</div>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
                ${result.configuration ? `
                    <p><strong>Configuration:</strong> ${JSON.stringify(result.configuration)}</p>
                ` : ''}
            </div>
        `).join('')}
        
        <h2>🎯 Performance Thresholds</h2>
        <pre>${JSON.stringify(report.thresholds, null, 2)}</pre>
    </div>
</body>
</html>`;
}