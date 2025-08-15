/**
 * Visual Regression Performance Testing
 * 
 * Tests the performance impact of visual regression testing itself,
 * ensuring that screenshot comparison and visual validation don't
 * negatively impact the overall gallery performance.
 */

const { chromium } = require('playwright');
const pixelmatch = require('pixelmatch');
const { PNG } = require('pngjs');
const testSetup = require('../setup/test-setup');
const testConfig = require('../setup/test-config');
const path = require('path');
const fs = require('fs').promises;

describe('Visual Regression Performance Tests', () => {
    let browser;
    let context;
    let page;
    let visualResults = [];

    beforeAll(async () => {
        await testSetup.setupGlobal();
        
        browser = await chromium.launch({
            headless: true,
            args: [
                '--disable-web-security',
                '--disable-features=TranslateUI',
                '--disable-extensions'
            ]
        });
    });

    afterAll(async () => {
        if (browser) {
            await browser.close();
        }
        
        await generateVisualPerformanceReport(visualResults);
        await testSetup.teardownGlobal();
    });

    beforeEach(async () => {
        context = await browser.newContext({
            viewport: { width: 1920, height: 1080 }
        });
        page = await context.newPage();
    });

    afterEach(async () => {
        if (context) {
            await context.close();
        }
    });

    describe('Screenshot Performance', () => {
        test('should capture screenshots efficiently across multiple themes', async () => {
            const themes = ['modern', 'luxury', 'minimal'];
            const screenshotResults = {
                captures: [],
                totalCaptureTime: 0,
                totalProcessingTime: 0,
                themes: themes.length,
                startTime: Date.now()
            };

            for (const theme of themes) {
                const themeStart = Date.now();
                
                await page.goto(`${testConfig.server.baseUrl}/test/gallery/${theme}`);
                await page.waitForSelector('[data-gallery-container]');
                await testSetup.getTestUtils().waitForNetwork(page);
                
                // Capture full page screenshot
                const screenshotStart = performance.now();
                const screenshot = await page.screenshot({
                    fullPage: true,
                    type: 'png',
                    quality: 90
                });
                const captureTime = performance.now() - screenshotStart;
                
                // Process screenshot (simulate image comparison preparation)
                const processStart = performance.now();
                const png = PNG.sync.read(screenshot);
                const processTime = performance.now() - processStart;
                
                const themeTime = Date.now() - themeStart;
                
                screenshotResults.captures.push({
                    theme,
                    captureTime,
                    processTime,
                    totalTime: themeTime,
                    imageSize: screenshot.length,
                    dimensions: { width: png.width, height: png.height }
                });
                
                screenshotResults.totalCaptureTime += captureTime;
                screenshotResults.totalProcessingTime += processTime;
            }
            
            screenshotResults.averageCaptureTime = screenshotResults.totalCaptureTime / themes.length;
            screenshotResults.averageProcessingTime = screenshotResults.totalProcessingTime / themes.length;
            screenshotResults.totalTime = Date.now() - screenshotResults.startTime;
            
            const result = {
                testName: 'Screenshot Capture Performance',
                metrics: screenshotResults,
                timestamp: new Date().toISOString()
            };
            
            visualResults.push(result);
            
            // Performance assertions
            expect(screenshotResults.averageCaptureTime).toBeLessThan(2000); // 2 seconds per screenshot
            expect(screenshotResults.averageProcessingTime).toBeLessThan(500); // 500ms processing
            expect(screenshotResults.totalTime).toBeLessThan(8000); // 8 seconds total for all themes
            
            console.log('📸 Screenshot Performance:', {
                themes: themes.length,
                avgCapture: `${Math.round(screenshotResults.averageCaptureTime)}ms`,
                avgProcess: `${Math.round(screenshotResults.averageProcessingTime)}ms`,
                totalTime: `${screenshotResults.totalTime}ms`
            });
        });

        test('should handle viewport-specific screenshots efficiently', async () => {
            const viewports = [
                { name: 'Desktop', width: 1920, height: 1080 },
                { name: 'Tablet', width: 768, height: 1024 },
                { name: 'Mobile', width: 375, height: 812 }
            ];
            
            const viewportResults = {
                captures: [],
                resizeTimings: [],
                totalTime: 0,
                startTime: Date.now()
            };

            await page.goto(`${testConfig.server.baseUrl}/test/gallery/modern`);
            await page.waitForSelector('[data-gallery-container]');

            for (const viewport of viewports) {
                const viewportStart = performance.now();
                
                // Resize viewport
                const resizeStart = performance.now();
                await page.setViewportSize({ width: viewport.width, height: viewport.height });
                await page.waitForTimeout(500); // Allow layout to settle
                const resizeTime = performance.now() - resizeStart;
                
                // Capture screenshot
                const captureStart = performance.now();
                const screenshot = await page.screenshot({
                    fullPage: false, // Viewport only for responsive testing
                    type: 'png'
                });
                const captureTime = performance.now() - captureStart;
                
                const totalViewportTime = performance.now() - viewportStart;
                
                viewportResults.captures.push({
                    viewport: viewport.name,
                    dimensions: `${viewport.width}x${viewport.height}`,
                    resizeTime,
                    captureTime,
                    totalTime: totalViewportTime,
                    imageSize: screenshot.length
                });
                
                viewportResults.resizeTimings.push(resizeTime);
            }
            
            viewportResults.totalTime = Date.now() - viewportResults.startTime;
            viewportResults.averageResizeTime = viewportResults.resizeTimings.reduce((sum, time) => sum + time, 0) / viewportResults.resizeTimings.length;
            viewportResults.averageCaptureTime = viewportResults.captures.reduce((sum, cap) => sum + cap.captureTime, 0) / viewportResults.captures.length;
            
            const result = {
                testName: 'Viewport Screenshot Performance',
                metrics: viewportResults,
                timestamp: new Date().toISOString()
            };
            
            visualResults.push(result);
            
            // Performance assertions
            expect(viewportResults.averageResizeTime).toBeLessThan(800); // 800ms average resize
            expect(viewportResults.averageCaptureTime).toBeLessThan(1500); // 1.5s average capture
            expect(viewportResults.totalTime).toBeLessThan(6000); // 6 seconds total
            
            console.log('📱 Viewport Screenshots:', {
                viewports: viewports.length,
                avgResize: `${Math.round(viewportResults.averageResizeTime)}ms`,
                avgCapture: `${Math.round(viewportResults.averageCaptureTime)}ms`,
                total: `${viewportResults.totalTime}ms`
            });
        });
    });

    describe('Image Comparison Performance', () => {
        test('should efficiently compare images for visual regression', async () => {
            await page.goto(`${testConfig.server.baseUrl}/test/gallery/modern`);
            await page.waitForSelector('[data-gallery-container]');
            await testSetup.getTestUtils().waitForNetwork(page);

            // Capture baseline screenshot
            const baseline = await page.screenshot({ fullPage: true, type: 'png' });
            
            // Make a small UI change (add a class that might affect rendering)
            await page.evaluate(() => {
                const container = document.querySelector('[data-gallery-container]');
                if (container) {
                    container.style.marginTop = '1px'; // Minimal change
                }
            });
            
            // Capture comparison screenshot
            const comparison = await page.screenshot({ fullPage: true, type: 'png' });
            
            // Benchmark image comparison
            const comparisonResults = await performImageComparison(baseline, comparison);
            
            const result = {
                testName: 'Image Comparison Performance',
                metrics: comparisonResults,
                timestamp: new Date().toISOString()
            };
            
            visualResults.push(result);
            
            // Performance assertions
            expect(comparisonResults.comparisonTime).toBeLessThan(1000); // 1 second max
            expect(comparisonResults.memoryUsage).toBeLessThan(50 * 1024 * 1024); // 50MB max
            expect(comparisonResults.pixelsCompared).toBeGreaterThan(0);
            
            console.log('🔍 Image Comparison:', {
                time: `${Math.round(comparisonResults.comparisonTime)}ms`,
                pixels: comparisonResults.pixelsCompared.toLocaleString(),
                differences: comparisonResults.pixelDifferences,
                memory: `${Math.round(comparisonResults.memoryUsage / 1024 / 1024)}MB`
            });
        });

        test('should handle batch image comparisons efficiently', async () => {
            const batchSize = 5;
            const batchResults = {
                comparisons: [],
                totalTime: 0,
                totalMemory: 0,
                startTime: Date.now()
            };

            // Generate test images by taking screenshots with slight variations
            const screenshots = [];
            await page.goto(`${testConfig.server.baseUrl}/test/gallery/modern`);
            await page.waitForSelector('[data-gallery-container]');

            for (let i = 0; i < batchSize; i++) {
                // Make small variations
                await page.evaluate((iteration) => {
                    const container = document.querySelector('[data-gallery-container]');
                    if (container) {
                        container.style.paddingTop = `${iteration}px`;
                    }
                }, i);
                
                await page.waitForTimeout(100);
                const screenshot = await page.screenshot({ fullPage: false, type: 'png' });
                screenshots.push(screenshot);
            }

            // Perform batch comparisons
            for (let i = 1; i < screenshots.length; i++) {
                const comparisonStart = performance.now();
                const memoryStart = process.memoryUsage().heapUsed;
                
                const comparisonResult = await performImageComparison(screenshots[0], screenshots[i]);
                
                const comparisonTime = performance.now() - comparisonStart;
                const memoryUsed = process.memoryUsage().heapUsed - memoryStart;
                
                batchResults.comparisons.push({
                    index: i,
                    comparisonTime,
                    memoryUsed,
                    pixelDifferences: comparisonResult.pixelDifferences,
                    similarityPercentage: comparisonResult.similarityPercentage
                });
                
                batchResults.totalTime += comparisonTime;
                batchResults.totalMemory += memoryUsed;
            }
            
            batchResults.totalTime = Date.now() - batchResults.startTime;
            batchResults.averageComparisonTime = batchResults.totalTime / batchResults.comparisons.length;
            batchResults.averageMemoryUsage = batchResults.totalMemory / batchResults.comparisons.length;
            
            const result = {
                testName: 'Batch Image Comparison Performance',
                metrics: batchResults,
                timestamp: new Date().toISOString()
            };
            
            visualResults.push(result);
            
            // Performance assertions
            expect(batchResults.averageComparisonTime).toBeLessThan(800); // 800ms per comparison
            expect(batchResults.averageMemoryUsage).toBeLessThan(20 * 1024 * 1024); // 20MB per comparison
            expect(batchResults.comparisons.length).toBe(batchSize - 1);
            
            console.log('🔄 Batch Comparison:', {
                comparisons: batchResults.comparisons.length,
                avgTime: `${Math.round(batchResults.averageComparisonTime)}ms`,
                avgMemory: `${Math.round(batchResults.averageMemoryUsage / 1024 / 1024)}MB`,
                total: `${batchResults.totalTime}ms`
            });
        });
    });

    describe('Visual Performance Impact', () => {
        test('should measure performance impact of visual testing on gallery', async () => {
            // Test gallery performance without visual testing
            const baselineStart = Date.now();
            await page.goto(`${testConfig.server.baseUrl}/test/gallery/luxury`);
            await page.waitForSelector('[data-gallery-container]');
            await testSetup.getTestUtils().waitForNetwork(page);
            
            const baselineMetrics = await page.evaluate(() => ({
                lcp: window.performanceMetrics?.lcp || 0,
                cls: window.performanceMetrics?.cls || 0,
                domContentLoaded: performance.timing ? 
                    performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart : 0
            }));
            const baselineTime = Date.now() - baselineStart;

            // Test gallery performance with visual testing overhead
            const visualTestStart = Date.now();
            
            // Simulate visual testing overhead
            await page.addInitScript(() => {
                // Add visual testing observers
                window.visualTestingOverhead = {
                    screenshotRequests: 0,
                    domObservations: 0
                };
                
                // Simulate mutation observer for visual changes
                if (typeof MutationObserver !== 'undefined') {
                    const observer = new MutationObserver(() => {
                        window.visualTestingOverhead.domObservations++;
                    });
                    observer.observe(document.body, {
                        childList: true,
                        subtree: true,
                        attributes: true
                    });
                }
            });
            
            await page.goto(`${testConfig.server.baseUrl}/test/gallery/luxury`);
            await page.waitForSelector('[data-gallery-container]');
            await testSetup.getTestUtils().waitForNetwork(page);
            
            // Take screenshot (visual testing overhead)
            const screenshotStart = performance.now();
            await page.screenshot({ fullPage: true, type: 'png' });
            const screenshotTime = performance.now() - screenshotStart;
            
            const visualTestMetrics = await page.evaluate(() => ({
                lcp: window.performanceMetrics?.lcp || 0,
                cls: window.performanceMetrics?.cls || 0,
                domContentLoaded: performance.timing ? 
                    performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart : 0,
                visualOverhead: window.visualTestingOverhead
            }));
            const visualTestTime = Date.now() - visualTestStart;

            const impactResults = {
                baseline: {
                    loadTime: baselineTime,
                    ...baselineMetrics
                },
                withVisualTesting: {
                    loadTime: visualTestTime,
                    screenshotTime,
                    ...visualTestMetrics
                },
                impact: {
                    loadTimeIncrease: visualTestTime - baselineTime,
                    loadTimeIncreasePercent: ((visualTestTime - baselineTime) / baselineTime) * 100,
                    lcpIncrease: (visualTestMetrics.lcp || 0) - (baselineMetrics.lcp || 0),
                    clsIncrease: (visualTestMetrics.cls || 0) - (baselineMetrics.cls || 0)
                }
            };
            
            const result = {
                testName: 'Visual Testing Performance Impact',
                metrics: impactResults,
                timestamp: new Date().toISOString()
            };
            
            visualResults.push(result);
            
            // Performance impact assertions
            expect(impactResults.impact.loadTimeIncreasePercent).toBeLessThan(15); // Max 15% increase
            expect(impactResults.withVisualTesting.screenshotTime).toBeLessThan(2000); // 2s screenshot time
            expect(impactResults.impact.lcpIncrease).toBeLessThan(500); // Max 500ms LCP increase
            
            console.log('📊 Visual Testing Impact:', {
                baselineTime: `${baselineTime}ms`,
                visualTime: `${visualTestTime}ms`,
                increase: `${Math.round(impactResults.impact.loadTimeIncreasePercent)}%`,
                screenshotTime: `${Math.round(impactResults.withVisualTesting.screenshotTime)}ms`
            });
        });
    });
});

/**
 * Perform image comparison using pixelmatch
 */
async function performImageComparison(img1Buffer, img2Buffer) {
    const startTime = performance.now();
    const memoryStart = process.memoryUsage().heapUsed;
    
    try {
        const img1 = PNG.sync.read(img1Buffer);
        const img2 = PNG.sync.read(img2Buffer);
        
        // Ensure images are same size
        if (img1.width !== img2.width || img1.height !== img2.height) {
            throw new Error('Image dimensions do not match');
        }
        
        const diff = new PNG({ width: img1.width, height: img1.height });
        const pixelDifferences = pixelmatch(img1.data, img2.data, diff.data, img1.width, img1.height, {
            threshold: 0.1
        });
        
        const totalPixels = img1.width * img1.height;
        const similarityPercentage = ((totalPixels - pixelDifferences) / totalPixels) * 100;
        
        const comparisonTime = performance.now() - startTime;
        const memoryUsage = process.memoryUsage().heapUsed - memoryStart;
        
        return {
            comparisonTime,
            memoryUsage,
            pixelsCompared: totalPixels,
            pixelDifferences,
            similarityPercentage,
            dimensions: { width: img1.width, height: img1.height }
        };
    } catch (error) {
        return {
            comparisonTime: performance.now() - startTime,
            memoryUsage: process.memoryUsage().heapUsed - memoryStart,
            pixelsCompared: 0,
            pixelDifferences: -1,
            similarityPercentage: 0,
            error: error.message
        };
    }
}

/**
 * Generate visual performance report
 */
async function generateVisualPerformanceReport(results) {
    const reportDir = path.join(testConfig.paths.reports, 'visual-performance');
    await fs.mkdir(reportDir, { recursive: true });
    
    const report = {
        generatedAt: new Date().toISOString(),
        summary: generateVisualSummary(results),
        results,
        recommendations: generateVisualRecommendations(results)
    };
    
    // JSON report
    await fs.writeFile(
        path.join(reportDir, 'visual-performance-report.json'),
        JSON.stringify(report, null, 2)
    );
    
    // HTML report
    const htmlReport = generateVisualHTML(report);
    await fs.writeFile(
        path.join(reportDir, 'visual-performance-report.html'),
        htmlReport
    );
    
    console.log('👁️  Visual performance report generated:', path.join(reportDir, 'visual-performance-report.html'));
}

function generateVisualSummary(results) {
    const screenshotTests = results.filter(r => r.testName.includes('Screenshot'));
    const comparisonTests = results.filter(r => r.testName.includes('Comparison'));
    const impactTests = results.filter(r => r.testName.includes('Impact'));
    
    return {
        totalTests: results.length,
        screenshotTests: screenshotTests.length,
        comparisonTests: comparisonTests.length,
        averageScreenshotTime: screenshotTests.reduce((sum, t) => sum + (t.metrics.averageCaptureTime || 0), 0) / screenshotTests.length,
        averageComparisonTime: comparisonTests.reduce((sum, t) => sum + (t.metrics.averageComparisonTime || t.metrics.comparisonTime || 0), 0) / comparisonTests.length,
        performanceImpact: impactTests.length > 0 ? impactTests[0].metrics.impact?.loadTimeIncreasePercent || 0 : 0
    };
}

function generateVisualRecommendations(results) {
    const recommendations = [];
    
    const screenshotTest = results.find(r => r.testName.includes('Screenshot Capture'));
    if (screenshotTest && screenshotTest.metrics.averageCaptureTime > 1500) {
        recommendations.push({
            type: 'performance',
            priority: 'medium',
            title: 'Optimize Screenshot Capture',
            description: 'Screenshot capture time is above optimal. Consider reducing image quality or using viewport-only captures where possible.'
        });
    }
    
    const comparisonTest = results.find(r => r.testName.includes('Image Comparison'));
    if (comparisonTest && comparisonTest.metrics.comparisonTime > 800) {
        recommendations.push({
            type: 'performance',
            priority: 'medium',
            title: 'Optimize Image Comparison',
            description: 'Image comparison is slower than optimal. Consider reducing image size or using more efficient comparison algorithms.'
        });
    }
    
    const impactTest = results.find(r => r.testName.includes('Performance Impact'));
    if (impactTest && impactTest.metrics.impact?.loadTimeIncreasePercent > 10) {
        recommendations.push({
            type: 'optimization',
            priority: 'high',
            title: 'Reduce Visual Testing Impact',
            description: 'Visual testing is significantly impacting gallery performance. Consider running visual tests separately from performance tests.'
        });
    }
    
    return recommendations;
}

function generateVisualHTML(report) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Universal Gallery Visual Performance Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { border-bottom: 2px solid #17a2b8; padding-bottom: 20px; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .summary-card { background: linear-gradient(135deg, #17a2b8 0%, #138496 100%); color: white; padding: 20px; border-radius: 8px; text-align: center; }
        .summary-card h3 { margin: 0 0 10px 0; font-size: 2em; }
        .summary-card p { margin: 0; opacity: 0.9; }
        .test-result { background: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 8px; }
        .test-result.success { border-left: 4px solid #28a745; }
        .test-result.warning { border-left: 4px solid #ffc107; }
        .test-result.error { border-left: 4px solid #dc3545; }
        .recommendations { background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .recommendation { padding: 15px; margin: 10px 0; border-radius: 4px; }
        .recommendation.high { background: #ffebee; border-left: 4px solid #f44336; }
        .recommendation.medium { background: #fff3e0; border-left: 4px solid #ff9800; }
        .recommendation.low { background: #e8f5e8; border-left: 4px solid #4caf50; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-top: 15px; }
        .metric { text-align: center; padding: 10px; background: white; border-radius: 4px; }
        .metric-value { font-size: 1.5em; font-weight: bold; color: #17a2b8; }
        .metric-label { font-size: 0.85em; color: #666; margin-top: 5px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>👁️ Universal Gallery Visual Performance Report</h1>
            <p>Generated: ${report.generatedAt}</p>
        </div>
        
        <div class="summary">
            <div class="summary-card">
                <h3>${report.summary.totalTests}</h3>
                <p>Visual Tests</p>
            </div>
            <div class="summary-card">
                <h3>${Math.round(report.summary.averageScreenshotTime || 0)}ms</h3>
                <p>Avg Screenshot</p>
            </div>
            <div class="summary-card">
                <h3>${Math.round(report.summary.averageComparisonTime || 0)}ms</h3>
                <p>Avg Comparison</p>
            </div>
            <div class="summary-card">
                <h3>${Math.round(report.summary.performanceImpact)}%</h3>
                <p>Performance Impact</p>
            </div>
        </div>
        
        <h2>📸 Visual Performance Results</h2>
        ${report.results.map(result => `
            <div class="test-result success">
                <h3>${result.testName}</h3>
                <p><strong>Timestamp:</strong> ${result.timestamp}</p>
                ${result.metrics ? `
                    <div class="metrics">
                        ${Object.entries(result.metrics).slice(0, 6).map(([key, value]) => {
                            if (typeof value === 'object') return '';
                            return `
                                <div class="metric">
                                    <div class="metric-value">${typeof value === 'number' ? Math.round(value * 100) / 100 : value}</div>
                                    <div class="metric-label">${key}</div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                ` : ''}
            </div>
        `).join('')}
        
        <h2>💡 Visual Testing Recommendations</h2>
        <div class="recommendations">
            ${report.recommendations.length > 0 ? report.recommendations.map(rec => `
                <div class="recommendation ${rec.priority}">
                    <h4>${rec.title}</h4>
                    <p>${rec.description}</p>
                    <small><strong>Priority:</strong> ${rec.priority.toUpperCase()} | <strong>Type:</strong> ${rec.type}</small>
                </div>
            `).join('') : '<p>No recommendations - all visual performance metrics are optimal! ✅</p>'}
        </div>
    </div>
</body>
</html>`;
}