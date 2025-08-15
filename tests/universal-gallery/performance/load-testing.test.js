/**
 * Load Testing and Stress Testing
 * 
 * Tests gallery performance under high load conditions,
 * concurrent user simulations, and stress scenarios.
 */

const { chromium } = require('playwright');
const testSetup = require('../setup/test-setup');
const testConfig = require('../setup/test-config');

describe('Gallery Load Testing', () => {
    let browsers = [];
    let loadTestResults = [];

    beforeAll(async () => {
        await testSetup.setupGlobal();
    });

    afterAll(async () => {
        // Close all browsers
        for (const browser of browsers) {
            await browser.close();
        }
        
        // Generate load test report
        await generateLoadTestReport(loadTestResults);
        await testSetup.teardownGlobal();
    });

    describe('Concurrent User Simulation', () => {
        test('should handle 10 concurrent users', async () => {
            const concurrentUsers = 10;
            const userSessions = [];
            
            console.log(`🔄 Starting ${concurrentUsers} concurrent user sessions...`);
            
            // Launch browsers for concurrent users
            for (let i = 0; i < concurrentUsers; i++) {
                const browser = await chromium.launch({ headless: true });
                browsers.push(browser);
                
                const context = await browser.newContext({
                    viewport: { width: 1920, height: 1080 }
                });
                const page = await context.newPage();
                
                userSessions.push({
                    browser,
                    context,
                    page,
                    userId: `user_${i + 1}`,
                    startTime: Date.now()
                });
            }
            
            // Execute concurrent user workflows
            const userWorkflows = userSessions.map(async (session, index) => {
                const results = {
                    userId: session.userId,
                    startTime: session.startTime,
                    steps: []
                };
                
                try {
                    // Step 1: Load gallery
                    const loadStart = Date.now();
                    await session.page.goto(`${testConfig.server.baseUrl}/test/gallery/modern`);
                    await session.page.waitForSelector('[data-gallery-container]');
                    results.steps.push({
                        step: 'load_gallery',
                        duration: Date.now() - loadStart,
                        success: true
                    });
                    
                    // Step 2: Browse images
                    const browseStart = Date.now();
                    const images = await session.page.$$('[data-gallery-image]');
                    for (let i = 0; i < Math.min(3, images.length); i++) {
                        await images[i].click();
                        await session.page.waitForTimeout(500);
                        await session.page.keyboard.press('Escape');
                        await session.page.waitForTimeout(200);
                    }
                    results.steps.push({
                        step: 'browse_images',
                        duration: Date.now() - browseStart,
                        success: true
                    });
                    
                    // Step 3: Search functionality
                    const searchStart = Date.now();
                    const searchInput = session.page.locator('[data-gallery-search]');
                    if (await searchInput.count() > 0) {
                        await searchInput.fill('test');
                        await session.page.waitForTimeout(500);
                        await searchInput.fill('');
                        await session.page.waitForTimeout(500);
                    }
                    results.steps.push({
                        step: 'search_images',
                        duration: Date.now() - searchStart,
                        success: true
                    });
                    
                    // Step 4: Filter by category
                    const filterStart = Date.now();
                    const categoryFilter = session.page.locator('[data-gallery-filter][name="category"]');
                    if (await categoryFilter.count() > 0) {
                        await categoryFilter.selectOption('portrait');
                        await session.page.waitForTimeout(500);
                        await categoryFilter.selectOption('');
                        await session.page.waitForTimeout(500);
                    }
                    results.steps.push({
                        step: 'filter_images',
                        duration: Date.now() - filterStart,
                        success: true
                    });
                    
                    results.totalDuration = Date.now() - session.startTime;
                    results.success = true;
                    
                } catch (error) {
                    results.error = error.message;
                    results.success = false;
                    results.totalDuration = Date.now() - session.startTime;
                }
                
                return results;
            });
            
            // Wait for all user workflows to complete
            const allResults = await Promise.all(userWorkflows);
            
            // Analyze results
            const successfulSessions = allResults.filter(r => r.success);
            const failedSessions = allResults.filter(r => !r.success);
            const averageDuration = successfulSessions.reduce((sum, r) => sum + r.totalDuration, 0) / successfulSessions.length;
            const maxDuration = Math.max(...allResults.map(r => r.totalDuration));
            const minDuration = Math.min(...successfulSessions.map(r => r.totalDuration));
            
            const loadTestResult = {
                testName: 'Concurrent User Load Test',
                concurrentUsers,
                successfulSessions: successfulSessions.length,
                failedSessions: failedSessions.length,
                successRate: (successfulSessions.length / concurrentUsers) * 100,
                averageDuration,
                maxDuration,
                minDuration,
                results: allResults,
                timestamp: new Date().toISOString()
            };
            
            loadTestResults.push(loadTestResult);
            
            // Assertions
            expect(successfulSessions.length).toBeGreaterThanOrEqual(concurrentUsers * 0.9); // 90% success rate
            expect(averageDuration).toBeLessThan(10000); // Average session under 10 seconds
            expect(failedSessions.length).toBeLessThanOrEqual(concurrentUsers * 0.1); // Max 10% failures
            
            console.log('👥 Concurrent User Results:', {
                successful: successfulSessions.length,
                failed: failedSessions.length,
                successRate: `${Math.round(loadTestResult.successRate)}%`,
                avgDuration: `${Math.round(averageDuration)}ms`,
                maxDuration: `${Math.round(maxDuration)}ms`
            });
            
        }, 120000); // 2 minute timeout
    });

    describe('High Volume Image Loading', () => {
        test('should handle large image galleries efficiently', async () => {
            const browser = await chromium.launch({ headless: true });
            browsers.push(browser);
            const context = await browser.newContext();
            const page = await context.newPage();
            
            // Create a test page with many images
            await page.goto(`${testConfig.server.baseUrl}/test/gallery/luxury`);
            await page.waitForSelector('[data-gallery-container]');
            
            // Inject additional images to simulate large gallery
            await page.evaluate(() => {
                const galleryGrid = document.querySelector('.gallery-grid');
                for (let i = 20; i < 100; i++) {
                    const item = document.createElement('div');
                    item.className = 'gallery-item';
                    item.setAttribute('data-gallery-image', '');
                    item.innerHTML = `<img src="https://picsum.photos/400/300?random=${i}" alt="Test ${i}" loading="lazy" />`;
                    galleryGrid.appendChild(item);
                }
                
                // Track loading performance
                window.imageLoadMetrics = {
                    totalImages: 0,
                    loadedImages: 0,
                    failedImages: 0,
                    loadTimes: []
                };
                
                const images = document.querySelectorAll('[data-gallery-image] img');
                window.imageLoadMetrics.totalImages = images.length;
                
                images.forEach((img, index) => {
                    const startTime = performance.now();
                    
                    img.onload = () => {
                        window.imageLoadMetrics.loadedImages++;
                        window.imageLoadMetrics.loadTimes.push(performance.now() - startTime);
                    };
                    
                    img.onerror = () => {
                        window.imageLoadMetrics.failedImages++;
                    };
                });
            });
            
            // Scroll to trigger lazy loading
            await page.evaluate(async () => {
                const scrollHeight = document.body.scrollHeight;
                const viewportHeight = window.innerHeight;
                const scrollSteps = Math.ceil(scrollHeight / viewportHeight);
                
                for (let i = 0; i < scrollSteps; i++) {
                    window.scrollTo(0, i * viewportHeight);
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            });
            
            // Wait for images to load
            await page.waitForTimeout(5000);
            
            // Collect metrics
            const imageMetrics = await page.evaluate(() => window.imageLoadMetrics);
            
            const highVolumeResult = {
                testName: 'High Volume Image Loading',
                totalImages: imageMetrics.totalImages,
                loadedImages: imageMetrics.loadedImages,
                failedImages: imageMetrics.failedImages,
                loadSuccessRate: (imageMetrics.loadedImages / imageMetrics.totalImages) * 100,
                averageLoadTime: imageMetrics.loadTimes.reduce((sum, time) => sum + time, 0) / imageMetrics.loadTimes.length,
                maxLoadTime: Math.max(...imageMetrics.loadTimes),
                minLoadTime: Math.min(...imageMetrics.loadTimes),
                timestamp: new Date().toISOString()
            };
            
            loadTestResults.push(highVolumeResult);
            
            // Assertions
            expect(imageMetrics.loadSuccessRate).toBeGreaterThan(90); // 90% success rate
            expect(highVolumeResult.averageLoadTime).toBeLessThan(3000); // Average load under 3 seconds
            expect(imageMetrics.totalImages).toBeGreaterThan(80); // Should have many images
            
            console.log('🖼️  High Volume Results:', {
                total: imageMetrics.totalImages,
                loaded: imageMetrics.loadedImages,
                failed: imageMetrics.failedImages,
                successRate: `${Math.round(highVolumeResult.loadSuccessRate)}%`,
                avgLoad: `${Math.round(highVolumeResult.averageLoadTime)}ms`
            });
        }, 30000);
    });

    describe('Memory Stress Testing', () => {
        test('should maintain stability under memory pressure', async () => {
            const browser = await chromium.launch({ 
                headless: true,
                args: ['--max_old_space_size=512'] // Limit memory to increase pressure
            });
            browsers.push(browser);
            const context = await browser.newContext();
            const page = await context.newPage();
            
            await page.goto(`${testConfig.server.baseUrl}/test/gallery/modern`);
            await page.waitForSelector('[data-gallery-container]');
            
            // Perform memory-intensive operations
            const memoryStressResult = await page.evaluate(async () => {
                const results = {
                    initialMemory: performance.memory?.usedJSHeapSize || 0,
                    peakMemory: 0,
                    finalMemory: 0,
                    operationsCompleted: 0,
                    errors: 0
                };
                
                try {
                    // Rapid lightbox operations
                    for (let i = 0; i < 50; i++) {
                        const images = document.querySelectorAll('[data-gallery-image]');
                        const randomIndex = Math.floor(Math.random() * images.length);
                        
                        if (images[randomIndex]) {
                            images[randomIndex].click();
                            await new Promise(resolve => setTimeout(resolve, 50));
                            
                            const escEvent = new KeyboardEvent('keydown', { key: 'Escape' });
                            document.dispatchEvent(escEvent);
                            await new Promise(resolve => setTimeout(resolve, 50));
                        }
                        
                        results.operationsCompleted++;
                        
                        // Track peak memory
                        const currentMemory = performance.memory?.usedJSHeapSize || 0;
                        if (currentMemory > results.peakMemory) {
                            results.peakMemory = currentMemory;
                        }
                        
                        // Every 10 operations, try to trigger garbage collection
                        if (i % 10 === 0 && window.gc) {
                            window.gc();
                        }
                    }
                    
                    // Final memory check
                    results.finalMemory = performance.memory?.usedJSHeapSize || 0;
                    
                } catch (error) {
                    results.errors++;
                    results.error = error.message;
                }
                
                return results;
            });
            
            const memoryIncrease = memoryStressResult.finalMemory - memoryStressResult.initialMemory;
            const memoryIncreasePercent = (memoryIncrease / memoryStressResult.initialMemory) * 100;
            
            const stressTestResult = {
                testName: 'Memory Stress Test',
                ...memoryStressResult,
                memoryIncrease,
                memoryIncreasePercent,
                timestamp: new Date().toISOString()
            };
            
            loadTestResults.push(stressTestResult);
            
            // Assertions
            expect(memoryStressResult.errors).toBe(0);
            expect(memoryStressResult.operationsCompleted).toBeGreaterThan(45); // At least 90% completion
            expect(memoryIncreasePercent).toBeLessThan(200); // Memory shouldn't double
            
            console.log('🧠 Memory Stress Results:', {
                operations: memoryStressResult.operationsCompleted,
                errors: memoryStressResult.errors,
                initialMem: `${Math.round(memoryStressResult.initialMemory / 1024 / 1024)}MB`,
                peakMem: `${Math.round(memoryStressResult.peakMemory / 1024 / 1024)}MB`,
                finalMem: `${Math.round(memoryStressResult.finalMemory / 1024 / 1024)}MB`,
                increase: `${Math.round(memoryIncreasePercent)}%`
            });
        }, 60000);
    });

    describe('Network Stress Testing', () => {
        test('should handle network congestion gracefully', async () => {
            const browser = await chromium.launch({ headless: true });
            browsers.push(browser);
            const context = await browser.newContext();
            const page = await context.newPage();
            
            // Simulate slow network conditions
            await context.route('**/*', async route => {
                // Add random delays to simulate network congestion
                const delay = Math.random() * 1000; // Up to 1 second delay
                await new Promise(resolve => setTimeout(resolve, delay));
                await route.continue();
            });
            
            const networkStressStart = Date.now();
            
            await page.goto(`${testConfig.server.baseUrl}/test/gallery/luxury`);
            await page.waitForSelector('[data-gallery-container]');
            
            // Perform operations under network stress
            const networkResults = await page.evaluate(async () => {
                const results = {
                    operationsAttempted: 0,
                    operationsCompleted: 0,
                    timeouts: 0,
                    errors: []
                };
                
                const operations = [
                    // Image interactions
                    async () => {
                        const images = document.querySelectorAll('[data-gallery-image]');
                        if (images.length > 0) {
                            images[0].click();
                            await new Promise(resolve => setTimeout(resolve, 200));
                            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
                        }
                    },
                    // Search operations
                    async () => {
                        const searchInput = document.querySelector('[data-gallery-search]');
                        if (searchInput) {
                            searchInput.value = 'test';
                            searchInput.dispatchEvent(new Event('input'));
                            await new Promise(resolve => setTimeout(resolve, 300));
                        }
                    },
                    // Filter operations
                    async () => {
                        const filter = document.querySelector('[data-gallery-filter]');
                        if (filter) {
                            filter.value = 'portrait';
                            filter.dispatchEvent(new Event('change'));
                            await new Promise(resolve => setTimeout(resolve, 300));
                        }
                    }
                ];
                
                for (const operation of operations) {
                    results.operationsAttempted++;
                    
                    try {
                        await Promise.race([
                            operation(),
                            new Promise((_, reject) => 
                                setTimeout(() => reject(new Error('Operation timeout')), 5000)
                            )
                        ]);
                        results.operationsCompleted++;
                    } catch (error) {
                        if (error.message === 'Operation timeout') {
                            results.timeouts++;
                        } else {
                            results.errors.push(error.message);
                        }
                    }
                }
                
                return results;
            });
            
            const totalDuration = Date.now() - networkStressStart;
            const successRate = (networkResults.operationsCompleted / networkResults.operationsAttempted) * 100;
            
            const networkStressResult = {
                testName: 'Network Stress Test',
                ...networkResults,
                totalDuration,
                successRate,
                timestamp: new Date().toISOString()
            };
            
            loadTestResults.push(networkStressResult);
            
            // Assertions - should be more lenient under stress conditions
            expect(successRate).toBeGreaterThan(70); // 70% success rate under stress
            expect(networkResults.timeouts).toBeLessThan(networkResults.operationsAttempted * 0.3); // Max 30% timeouts
            expect(totalDuration).toBeLessThan(30000); // Complete within 30 seconds
            
            console.log('🌐 Network Stress Results:', {
                attempted: networkResults.operationsAttempted,
                completed: networkResults.operationsCompleted,
                timeouts: networkResults.timeouts,
                successRate: `${Math.round(successRate)}%`,
                duration: `${Math.round(totalDuration)}ms`
            });
        }, 45000);
    });

    describe('Rapid User Interaction Stress', () => {
        test('should handle rapid user interactions without breaking', async () => {
            const browser = await chromium.launch({ headless: true });
            browsers.push(browser);
            const context = await browser.newContext();
            const page = await context.newPage();
            
            await page.goto(`${testConfig.server.baseUrl}/test/gallery/modern`);
            await page.waitForSelector('[data-gallery-container]');
            
            // Perform rapid interactions
            const rapidInteractionResults = await page.evaluate(async () => {
                const results = {
                    clicksAttempted: 0,
                    clicksSuccessful: 0,
                    keyPressesAttempted: 0,
                    keyPressesSuccessful: 0,
                    searchesAttempted: 0,
                    searchesSuccessful: 0,
                    errors: []
                };
                
                try {
                    // Rapid clicking on images
                    const images = document.querySelectorAll('[data-gallery-image]');
                    for (let i = 0; i < 20; i++) {
                        results.clicksAttempted++;
                        try {
                            const randomIndex = Math.floor(Math.random() * images.length);
                            images[randomIndex]?.click();
                            results.clicksSuccessful++;
                        } catch (error) {
                            results.errors.push(`Click error: ${error.message}`);
                        }
                        
                        // Very short delay to simulate rapid clicking
                        await new Promise(resolve => setTimeout(resolve, 50));
                    }
                    
                    // Rapid keyboard navigation
                    const keyEvents = ['ArrowLeft', 'ArrowRight', 'Escape', 'Enter'];
                    for (let i = 0; i < 30; i++) {
                        results.keyPressesAttempted++;
                        try {
                            const randomKey = keyEvents[Math.floor(Math.random() * keyEvents.length)];
                            document.dispatchEvent(new KeyboardEvent('keydown', { key: randomKey }));
                            results.keyPressesSuccessful++;
                        } catch (error) {
                            results.errors.push(`Key press error: ${error.message}`);
                        }
                        
                        await new Promise(resolve => setTimeout(resolve, 30));
                    }
                    
                    // Rapid search input
                    const searchInput = document.querySelector('[data-gallery-search]');
                    if (searchInput) {
                        const searchTerms = ['test', 'image', 'photo', 'gallery', ''];
                        for (let i = 0; i < 15; i++) {
                            results.searchesAttempted++;
                            try {
                                const randomTerm = searchTerms[Math.floor(Math.random() * searchTerms.length)];
                                searchInput.value = randomTerm;
                                searchInput.dispatchEvent(new Event('input'));
                                results.searchesSuccessful++;
                            } catch (error) {
                                results.errors.push(`Search error: ${error.message}`);
                            }
                            
                            await new Promise(resolve => setTimeout(resolve, 100));
                        }
                    }
                    
                } catch (error) {
                    results.errors.push(`General error: ${error.message}`);
                }
                
                return results;
            });
            
            const totalInteractions = rapidInteractionResults.clicksAttempted + 
                                    rapidInteractionResults.keyPressesAttempted + 
                                    rapidInteractionResults.searchesAttempted;
            const totalSuccessful = rapidInteractionResults.clicksSuccessful + 
                                  rapidInteractionResults.keyPressesSuccessful + 
                                  rapidInteractionResults.searchesSuccessful;
            const interactionSuccessRate = (totalSuccessful / totalInteractions) * 100;
            
            const rapidInteractionResult = {
                testName: 'Rapid User Interaction Stress',
                ...rapidInteractionResults,
                totalInteractions,
                totalSuccessful,
                interactionSuccessRate,
                timestamp: new Date().toISOString()
            };
            
            loadTestResults.push(rapidInteractionResult);
            
            // Assertions
            expect(interactionSuccessRate).toBeGreaterThan(90); // 90% success rate
            expect(rapidInteractionResults.errors.length).toBeLessThan(totalInteractions * 0.1); // Max 10% errors
            
            console.log('⚡ Rapid Interaction Results:', {
                totalAttempted: totalInteractions,
                totalSuccessful: totalSuccessful,
                successRate: `${Math.round(interactionSuccessRate)}%`,
                errors: rapidInteractionResults.errors.length,
                clicks: `${rapidInteractionResults.clicksSuccessful}/${rapidInteractionResults.clicksAttempted}`,
                keyPresses: `${rapidInteractionResults.keyPressesSuccessful}/${rapidInteractionResults.keyPressesAttempted}`,
                searches: `${rapidInteractionResults.searchesSuccessful}/${rapidInteractionResults.searchesAttempted}`
            });
        }, 30000);
    });
});

/**
 * Generate load test report
 */
async function generateLoadTestReport(results) {
    const path = require('path');
    const fs = require('fs').promises;
    
    const reportDir = path.join(testConfig.paths.reports, 'load-testing');
    await fs.mkdir(reportDir, { recursive: true });
    
    const report = {
        generatedAt: new Date().toISOString(),
        summary: {
            totalTests: results.length,
            overallSuccessRate: calculateOverallSuccessRate(results),
            averageTestDuration: calculateAverageTestDuration(results),
            recommendedMaxConcurrentUsers: calculateRecommendedMaxUsers(results)
        },
        results,
        recommendations: generateLoadTestRecommendations(results)
    };
    
    // JSON report
    await fs.writeFile(
        path.join(reportDir, 'load-test-report.json'),
        JSON.stringify(report, null, 2)
    );
    
    // HTML report
    const htmlReport = generateLoadTestHTML(report);
    await fs.writeFile(
        path.join(reportDir, 'load-test-report.html'),
        htmlReport
    );
    
    console.log('📈 Load test report generated:', path.join(reportDir, 'load-test-report.html'));
}

function calculateOverallSuccessRate(results) {
    const testsWithSuccessRate = results.filter(r => r.successRate !== undefined);
    if (testsWithSuccessRate.length === 0) return 100;
    
    return testsWithSuccessRate.reduce((sum, r) => sum + r.successRate, 0) / testsWithSuccessRate.length;
}

function calculateAverageTestDuration(results) {
    const testsWithDuration = results.filter(r => r.totalDuration !== undefined);
    if (testsWithDuration.length === 0) return 0;
    
    return testsWithDuration.reduce((sum, r) => sum + r.totalDuration, 0) / testsWithDuration.length;
}

function calculateRecommendedMaxUsers(results) {
    const concurrentTest = results.find(r => r.testName.includes('Concurrent User'));
    if (!concurrentTest) return 'Unknown';
    
    if (concurrentTest.successRate > 95) return concurrentTest.concurrentUsers * 2;
    if (concurrentTest.successRate > 90) return concurrentTest.concurrentUsers * 1.5;
    return concurrentTest.concurrentUsers;
}

function generateLoadTestRecommendations(results) {
    const recommendations = [];
    
    const concurrentTest = results.find(r => r.testName.includes('Concurrent User'));
    if (concurrentTest && concurrentTest.successRate < 90) {
        recommendations.push({
            type: 'performance',
            priority: 'high',
            title: 'Improve Concurrent User Handling',
            description: 'Success rate below 90% for concurrent users. Consider optimizing server resources or implementing rate limiting.'
        });
    }
    
    const memoryTest = results.find(r => r.testName.includes('Memory Stress'));
    if (memoryTest && memoryTest.memoryIncreasePercent > 150) {
        recommendations.push({
            type: 'memory',
            priority: 'medium',
            title: 'Memory Usage Optimization',
            description: 'Memory usage increased significantly during stress testing. Consider implementing better garbage collection or memory management.'
        });
    }
    
    const networkTest = results.find(r => r.testName.includes('Network Stress'));
    if (networkTest && networkTest.successRate < 80) {
        recommendations.push({
            type: 'network',
            priority: 'medium',
            title: 'Network Resilience',
            description: 'Performance degrades significantly under network stress. Consider implementing better error handling and retry mechanisms.'
        });
    }
    
    return recommendations;
}

function generateLoadTestHTML(report) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Universal Gallery Load Test Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { border-bottom: 2px solid #e74c3c; padding-bottom: 20px; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .summary-card { background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); color: white; padding: 20px; border-radius: 8px; text-align: center; }
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
        .metric-value { font-size: 1.5em; font-weight: bold; color: #e74c3c; }
        .metric-label { font-size: 0.85em; color: #666; margin-top: 5px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📈 Universal Gallery Load Test Report</h1>
            <p>Generated: ${report.generatedAt}</p>
        </div>
        
        <div class="summary">
            <div class="summary-card">
                <h3>${report.summary.totalTests}</h3>
                <p>Load Tests</p>
            </div>
            <div class="summary-card">
                <h3>${Math.round(report.summary.overallSuccessRate)}%</h3>
                <p>Success Rate</p>
            </div>
            <div class="summary-card">
                <h3>${Math.round(report.summary.averageTestDuration)}ms</h3>
                <p>Avg Duration</p>
            </div>
            <div class="summary-card">
                <h3>${report.summary.recommendedMaxConcurrentUsers}</h3>
                <p>Max Users</p>
            </div>
        </div>
        
        <h2>🧪 Load Test Results</h2>
        ${report.results.map(result => `
            <div class="test-result ${result.successRate > 90 ? 'success' : result.successRate > 75 ? 'warning' : 'error'}">
                <h3>${result.testName}</h3>
                <p><strong>Timestamp:</strong> ${result.timestamp}</p>
                ${result.successRate !== undefined ? `<p><strong>Success Rate:</strong> ${Math.round(result.successRate)}%</p>` : ''}
                ${result.concurrentUsers ? `<p><strong>Concurrent Users:</strong> ${result.concurrentUsers}</p>` : ''}
                ${result.totalDuration ? `<p><strong>Duration:</strong> ${Math.round(result.totalDuration)}ms</p>` : ''}
                ${result.operationsCompleted !== undefined ? `<p><strong>Operations:</strong> ${result.operationsCompleted}/${result.operationsAttempted || result.operationsCompleted}</p>` : ''}
            </div>
        `).join('')}
        
        <h2>💡 Recommendations</h2>
        <div class="recommendations">
            ${report.recommendations.map(rec => `
                <div class="recommendation ${rec.priority}">
                    <h4>${rec.title}</h4>
                    <p>${rec.description}</p>
                    <small><strong>Priority:</strong> ${rec.priority.toUpperCase()} | <strong>Type:</strong> ${rec.type}</small>
                </div>
            `).join('')}
        </div>
    </div>
</body>
</html>`;
}