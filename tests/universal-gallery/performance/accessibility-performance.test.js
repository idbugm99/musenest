/**
 * Accessibility Performance Testing
 * 
 * Tests gallery performance specifically related to accessibility features,
 * ensuring that accessibility enhancements don't negatively impact performance.
 */

const { chromium } = require('playwright');
const { injectAxe, checkA11y, getViolations } = require('jest-axe');
const testSetup = require('../setup/test-setup');
const testConfig = require('../setup/test-config');

describe('Accessibility Performance Tests', () => {
    let browser;
    let context;
    let page;
    let accessibilityResults = [];

    beforeAll(async () => {
        await testSetup.setupGlobal();
        
        browser = await chromium.launch({
            headless: true,
            args: ['--force-prefers-reduced-motion', '--disable-animations']
        });
    });

    afterAll(async () => {
        if (browser) {
            await browser.close();
        }
        
        await generateAccessibilityPerformanceReport(accessibilityResults);
        await testSetup.teardownGlobal();
    });

    beforeEach(async () => {
        context = await browser.newContext({
            viewport: { width: 1920, height: 1080 },
            // Simulate screen reader user preferences
            reducedMotion: 'reduce'
        });
        page = await context.newPage();
        
        // Inject axe-core for accessibility testing
        await page.addInitScript(() => {
            window.accessibilityMetrics = {
                focusTimings: [],
                announcements: [],
                keyboardNavigationTimes: [],
                screenReaderCompatibility: {}
            };
            
            // Track focus timing
            document.addEventListener('focusin', (e) => {
                window.accessibilityMetrics.focusTimings.push({
                    element: e.target.tagName + (e.target.className ? '.' + e.target.className : ''),
                    timestamp: performance.now()
                });
            });
        });
    });

    afterEach(async () => {
        if (context) {
            await context.close();
        }
    });

    describe('Screen Reader Performance', () => {
        test('should maintain performance with screen reader navigation', async () => {
            const startTime = Date.now();
            
            await page.goto(`${testConfig.server.baseUrl}/test/gallery/modern`);
            await page.waitForSelector('[data-gallery-container]');
            
            // Inject axe-core
            await injectAxe(page);
            
            // Simulate screen reader navigation
            const screenReaderResults = await page.evaluate(async () => {
                const results = {
                    elementsScanned: 0,
                    ariaDescriptionsProcessed: 0,
                    altTextValidated: 0,
                    focusableElementsCount: 0,
                    scanTime: performance.now()
                };
                
                // Count all focusable elements
                const focusableElements = document.querySelectorAll(
                    'a, button, input, textarea, select, [tabindex]:not([tabindex="-1"])'
                );
                results.focusableElementsCount = focusableElements.length;
                
                // Process each gallery image for accessibility
                const images = document.querySelectorAll('[data-gallery-image] img');
                for (const img of images) {
                    results.elementsScanned++;
                    
                    // Check alt text
                    if (img.alt && img.alt.length > 0) {
                        results.altTextValidated++;
                    }
                    
                    // Check ARIA descriptions
                    if (img.getAttribute('aria-describedby') || img.getAttribute('aria-label')) {
                        results.ariaDescriptionsProcessed++;
                    }
                    
                    // Simulate processing time
                    await new Promise(resolve => setTimeout(resolve, 10));
                }
                
                results.scanTime = performance.now() - results.scanTime;
                return results;
            });
            
            const totalTime = Date.now() - startTime;
            
            // Run accessibility audit
            const axeResults = await checkA11y(page);
            const violations = getViolations(axeResults);
            
            const result = {
                testName: 'Screen Reader Performance',
                metrics: {
                    totalTime,
                    ...screenReaderResults,
                    a11yViolations: violations.length,
                    averageElementProcessTime: screenReaderResults.scanTime / screenReaderResults.elementsScanned
                },
                timestamp: new Date().toISOString(),
                violations: violations.map(v => ({
                    id: v.id,
                    impact: v.impact,
                    nodes: v.nodes.length
                }))
            };
            
            accessibilityResults.push(result);
            
            // Performance assertions
            expect(totalTime).toBeLessThan(8000); // 8 seconds max for full a11y scan
            expect(result.metrics.averageElementProcessTime).toBeLessThan(50); // 50ms per element
            expect(violations.length).toBe(0); // No accessibility violations
            
            console.log('🔍 Screen Reader Performance:', {
                totalTime: `${totalTime}ms`,
                elements: screenReaderResults.elementsScanned,
                focusable: screenReaderResults.focusableElementsCount,
                violations: violations.length
            });
        });
    });

    describe('Keyboard Navigation Performance', () => {
        test('should handle rapid keyboard navigation efficiently', async () => {
            await page.goto(`${testConfig.server.baseUrl}/test/gallery/luxury`);
            await page.waitForSelector('[data-gallery-container]');
            
            // Test rapid keyboard navigation
            const keyboardResults = await page.evaluate(async () => {
                const results = {
                    tabNavigations: 0,
                    arrowNavigations: 0,
                    escapeHandling: 0,
                    totalFocusTime: 0,
                    focusEvents: [],
                    startTime: performance.now()
                };
                
                // Tab through all focusable elements
                const focusableElements = document.querySelectorAll(
                    '[data-gallery-image], [data-gallery-filter], [data-gallery-search], button, a'
                );
                
                for (let i = 0; i < Math.min(10, focusableElements.length); i++) {
                    const focusStart = performance.now();
                    
                    // Simulate tab key press
                    const tabEvent = new KeyboardEvent('keydown', { 
                        key: 'Tab', 
                        bubbles: true, 
                        cancelable: true 
                    });
                    document.dispatchEvent(tabEvent);
                    
                    // Focus element
                    if (focusableElements[i]) {
                        focusableElements[i].focus();
                        results.tabNavigations++;
                    }
                    
                    const focusTime = performance.now() - focusStart;
                    results.totalFocusTime += focusTime;
                    results.focusEvents.push({
                        element: i,
                        focusTime: focusTime
                    });
                    
                    // Small delay between navigations
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
                
                // Test arrow key navigation in gallery
                const galleryImages = document.querySelectorAll('[data-gallery-image]');
                if (galleryImages.length > 0) {
                    galleryImages[0].focus();
                    
                    for (let i = 0; i < Math.min(5, galleryImages.length - 1); i++) {
                        const arrowEvent = new KeyboardEvent('keydown', { 
                            key: 'ArrowRight', 
                            bubbles: true, 
                            cancelable: true 
                        });
                        document.dispatchEvent(arrowEvent);
                        results.arrowNavigations++;
                        
                        await new Promise(resolve => setTimeout(resolve, 30));
                    }
                }
                
                // Test escape key handling
                for (let i = 0; i < 3; i++) {
                    const escapeEvent = new KeyboardEvent('keydown', { 
                        key: 'Escape', 
                        bubbles: true, 
                        cancelable: true 
                    });
                    document.dispatchEvent(escapeEvent);
                    results.escapeHandling++;
                    
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
                
                results.totalTime = performance.now() - results.startTime;
                results.averageFocusTime = results.totalFocusTime / results.tabNavigations;
                
                return results;
            });
            
            const result = {
                testName: 'Keyboard Navigation Performance',
                metrics: keyboardResults,
                timestamp: new Date().toISOString()
            };
            
            accessibilityResults.push(result);
            
            // Performance assertions
            expect(keyboardResults.averageFocusTime).toBeLessThan(30); // 30ms average focus time
            expect(keyboardResults.totalTime).toBeLessThan(2000); // Complete in under 2 seconds
            expect(keyboardResults.tabNavigations).toBeGreaterThan(0);
            
            console.log('⌨️ Keyboard Navigation:', {
                tabNavs: keyboardResults.tabNavigations,
                arrowNavs: keyboardResults.arrowNavigations,
                avgFocus: `${Math.round(keyboardResults.averageFocusTime)}ms`,
                totalTime: `${Math.round(keyboardResults.totalTime)}ms`
            });
        });
    });

    describe('Focus Management Performance', () => {
        test('should efficiently manage focus in lightbox interactions', async () => {
            await page.goto(`${testConfig.server.baseUrl}/test/gallery/modern`);
            await page.waitForSelector('[data-gallery-container]');
            
            // Test focus management in lightbox
            const focusResults = await page.evaluate(async () => {
                const results = {
                    lightboxOpenings: 0,
                    focusRestorations: 0,
                    focusTrapTests: 0,
                    totalFocusManagementTime: 0,
                    focusEvents: [],
                    startTime: performance.now()
                };
                
                const images = document.querySelectorAll('[data-gallery-image]');
                const firstImage = images[0];
                
                if (firstImage) {
                    // Test lightbox opening and focus management
                    for (let i = 0; i < 3; i++) {
                        const focusStart = performance.now();
                        
                        // Store current focused element
                        const previouslyFocused = document.activeElement;
                        
                        // Click to open lightbox
                        firstImage.click();
                        results.lightboxOpenings++;
                        
                        // Wait for lightbox to potentially open
                        await new Promise(resolve => setTimeout(resolve, 200));
                        
                        // Check if focus was properly managed
                        const currentFocus = document.activeElement;
                        if (currentFocus !== previouslyFocused) {
                            results.focusTrapTests++;
                        }
                        
                        // Test escape key and focus restoration
                        const escapeEvent = new KeyboardEvent('keydown', { 
                            key: 'Escape', 
                            bubbles: true, 
                            cancelable: true 
                        });
                        document.dispatchEvent(escapeEvent);
                        
                        await new Promise(resolve => setTimeout(resolve, 200));
                        
                        // Check if focus was restored
                        if (document.activeElement === firstImage || document.activeElement === previouslyFocused) {
                            results.focusRestorations++;
                        }
                        
                        const focusTime = performance.now() - focusStart;
                        results.totalFocusManagementTime += focusTime;
                        results.focusEvents.push({
                            iteration: i,
                            focusTime: focusTime,
                            focusRestored: document.activeElement === firstImage || document.activeElement === previouslyFocused
                        });
                    }
                }
                
                results.totalTime = performance.now() - results.startTime;
                results.averageFocusManagementTime = results.totalFocusManagementTime / results.lightboxOpenings;
                
                return results;
            });
            
            const result = {
                testName: 'Focus Management Performance',
                metrics: focusResults,
                timestamp: new Date().toISOString()
            };
            
            accessibilityResults.push(result);
            
            // Performance and functionality assertions
            expect(focusResults.averageFocusManagementTime).toBeLessThan(500); // 500ms per focus cycle
            expect(focusResults.focusRestorations).toBeGreaterThanOrEqual(2); // At least 2/3 focus restorations
            expect(focusResults.lightboxOpenings).toBe(3);
            
            console.log('🎯 Focus Management:', {
                openings: focusResults.lightboxOpenings,
                restorations: focusResults.focusRestorations,
                trapTests: focusResults.focusTrapTests,
                avgTime: `${Math.round(focusResults.averageFocusManagementTime)}ms`
            });
        });
    });

    describe('Reduced Motion Performance', () => {
        test('should perform efficiently with reduced motion preferences', async () => {
            await page.goto(`${testConfig.server.baseUrl}/test/gallery/luxury`);
            await page.waitForSelector('[data-gallery-container]');
            
            // Test performance with reduced motion
            const reducedMotionResults = await page.evaluate(async () => {
                const results = {
                    animationsSkipped: 0,
                    transitionsReduced: 0,
                    instantUpdates: 0,
                    totalProcessingTime: 0,
                    startTime: performance.now()
                };
                
                // Check if prefers-reduced-motion is respected
                const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                
                if (prefersReducedMotion) {
                    // Test gallery interactions with reduced motion
                    const images = document.querySelectorAll('[data-gallery-image]');
                    
                    for (let i = 0; i < Math.min(3, images.length); i++) {
                        const processStart = performance.now();
                        
                        // Click image (should have reduced/no animation)
                        images[i].click();
                        results.instantUpdates++;
                        
                        // Check for transition duration (should be 0 or very short)
                        const computedStyle = window.getComputedStyle(images[i]);
                        const transitionDuration = parseFloat(computedStyle.transitionDuration) || 0;
                        
                        if (transitionDuration === 0 || transitionDuration < 0.1) {
                            results.transitionsReduced++;
                        }
                        
                        await new Promise(resolve => setTimeout(resolve, 100));
                        
                        // Close with escape
                        const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
                        document.dispatchEvent(escapeEvent);
                        
                        const processTime = performance.now() - processStart;
                        results.totalProcessingTime += processTime;
                    }
                    
                    // Test filter animations
                    const filters = document.querySelectorAll('[data-gallery-filter]');
                    if (filters.length > 0) {
                        const filterProcessStart = performance.now();
                        
                        const filter = filters[0];
                        filter.value = 'portrait';
                        filter.dispatchEvent(new Event('change'));
                        
                        // Should update immediately without animation
                        await new Promise(resolve => setTimeout(resolve, 50));
                        results.animationsSkipped++;
                        
                        results.totalProcessingTime += (performance.now() - filterProcessStart);
                    }
                }
                
                results.totalTime = performance.now() - results.startTime;
                results.averageProcessingTime = results.totalProcessingTime / (results.instantUpdates + results.animationsSkipped);
                results.prefersReducedMotion = prefersReducedMotion;
                
                return results;
            });
            
            const result = {
                testName: 'Reduced Motion Performance',
                metrics: reducedMotionResults,
                timestamp: new Date().toISOString()
            };
            
            accessibilityResults.push(result);
            
            // Performance assertions for reduced motion
            expect(reducedMotionResults.averageProcessingTime).toBeLessThan(200); // Faster without animations
            expect(reducedMotionResults.prefersReducedMotion).toBe(true);
            if (reducedMotionResults.instantUpdates > 0) {
                expect(reducedMotionResults.transitionsReduced).toBeGreaterThan(0);
            }
            
            console.log('🎭 Reduced Motion:', {
                prefersReduced: reducedMotionResults.prefersReducedMotion,
                instantUpdates: reducedMotionResults.instantUpdates,
                transitionsReduced: reducedMotionResults.transitionsReduced,
                avgTime: `${Math.round(reducedMotionResults.averageProcessingTime)}ms`
            });
        });
    });

    describe('High Contrast Performance', () => {
        test('should maintain performance with high contrast styles', async () => {
            // Test with forced high contrast mode
            await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
            await page.addStyleTag({
                content: `
                    @media (prefers-contrast: high) {
                        * { 
                            transition: none !important; 
                            animation: none !important;
                        }
                    }
                `
            });
            
            await page.goto(`${testConfig.server.baseUrl}/test/gallery/modern`);
            await page.waitForSelector('[data-gallery-container]');
            
            const contrastResults = await page.evaluate(async () => {
                const results = {
                    contrastCalculations: 0,
                    styleRecalculations: 0,
                    colorAdjustments: 0,
                    totalComputeTime: 0,
                    startTime: performance.now()
                };
                
                // Simulate high contrast calculations
                const elements = document.querySelectorAll('[data-gallery-image], button, a, input');
                
                for (const element of elements) {
                    const computeStart = performance.now();
                    
                    // Get computed styles (simulates browser work in high contrast)
                    const styles = window.getComputedStyle(element);
                    const backgroundColor = styles.backgroundColor;
                    const color = styles.color;
                    const borderColor = styles.borderColor;
                    
                    results.contrastCalculations++;
                    
                    // Simulate contrast ratio calculations
                    if (backgroundColor !== 'rgba(0, 0, 0, 0)' && color !== 'rgba(0, 0, 0, 0)') {
                        results.colorAdjustments++;
                    }
                    
                    // Force style recalculation
                    element.offsetHeight; // Trigger layout
                    results.styleRecalculations++;
                    
                    results.totalComputeTime += (performance.now() - computeStart);
                }
                
                results.totalTime = performance.now() - results.startTime;
                results.averageComputeTime = results.totalComputeTime / results.contrastCalculations;
                
                return results;
            });
            
            const result = {
                testName: 'High Contrast Performance',
                metrics: contrastResults,
                timestamp: new Date().toISOString()
            };
            
            accessibilityResults.push(result);
            
            // Performance assertions for high contrast
            expect(contrastResults.averageComputeTime).toBeLessThan(10); // 10ms per element max
            expect(contrastResults.totalTime).toBeLessThan(1000); // 1 second total
            expect(contrastResults.contrastCalculations).toBeGreaterThan(0);
            
            console.log('🔆 High Contrast:', {
                calculations: contrastResults.contrastCalculations,
                adjustments: contrastResults.colorAdjustments,
                avgCompute: `${Math.round(contrastResults.averageComputeTime)}ms`,
                totalTime: `${Math.round(contrastResults.totalTime)}ms`
            });
        });
    });
});

/**
 * Generate accessibility performance report
 */
async function generateAccessibilityPerformanceReport(results) {
    const path = require('path');
    const fs = require('fs').promises;
    
    const reportDir = path.join(testConfig.paths.reports, 'accessibility-performance');
    await fs.mkdir(reportDir, { recursive: true });
    
    const report = {
        generatedAt: new Date().toISOString(),
        summary: generateAccessibilitysSummary(results),
        results,
        recommendations: generateAccessibilityRecommendations(results)
    };
    
    // JSON report
    await fs.writeFile(
        path.join(reportDir, 'accessibility-performance-report.json'),
        JSON.stringify(report, null, 2)
    );
    
    // HTML report
    const htmlReport = generateAccessibilityHTML(report);
    await fs.writeFile(
        path.join(reportDir, 'accessibility-performance-report.html'),
        htmlReport
    );
    
    console.log('♿ Accessibility performance report generated:', path.join(reportDir, 'accessibility-performance-report.html'));
}

function generateAccessibilitysSummary(results) {
    const screenReaderTests = results.filter(r => r.testName.includes('Screen Reader'));
    const keyboardTests = results.filter(r => r.testName.includes('Keyboard'));
    const focusTests = results.filter(r => r.testName.includes('Focus'));
    
    return {
        totalTests: results.length,
        screenReaderOptimized: screenReaderTests.filter(t => t.metrics.averageElementProcessTime < 50).length,
        keyboardEfficient: keyboardTests.filter(t => t.metrics.averageFocusTime < 30).length,
        focusManaged: focusTests.filter(t => t.metrics.focusRestorations >= 2).length,
        averageAccessibilityTime: results.reduce((sum, r) => sum + (r.metrics.totalTime || 0), 0) / results.length
    };
}

function generateAccessibilityRecommendations(results) {
    const recommendations = [];
    
    const screenReaderTest = results.find(r => r.testName.includes('Screen Reader'));
    if (screenReaderTest && screenReaderTest.metrics.averageElementProcessTime > 30) {
        recommendations.push({
            type: 'performance',
            priority: 'medium',
            title: 'Optimize Screen Reader Processing',
            description: 'Average element processing time is above optimal. Consider caching ARIA descriptions and optimizing alt text processing.'
        });
    }
    
    const keyboardTest = results.find(r => r.testName.includes('Keyboard'));
    if (keyboardTest && keyboardTest.metrics.averageFocusTime > 25) {
        recommendations.push({
            type: 'accessibility',
            priority: 'medium',
            title: 'Improve Keyboard Navigation Speed',
            description: 'Focus timing is slower than optimal. Consider optimizing focus management and reducing unnecessary DOM queries.'
        });
    }
    
    const focusTest = results.find(r => r.testName.includes('Focus Management'));
    if (focusTest && focusTest.metrics.focusRestorations < focusTest.metrics.lightboxOpenings) {
        recommendations.push({
            type: 'accessibility',
            priority: 'high',
            title: 'Fix Focus Restoration',
            description: 'Focus is not being properly restored after modal interactions. This breaks keyboard navigation flow.'
        });
    }
    
    return recommendations;
}

function generateAccessibilityHTML(report) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Universal Gallery Accessibility Performance Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { border-bottom: 2px solid #6f42c1; padding-bottom: 20px; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .summary-card { background: linear-gradient(135deg, #6f42c1 0%, #5a32a3 100%); color: white; padding: 20px; border-radius: 8px; text-align: center; }
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
        .metric-value { font-size: 1.5em; font-weight: bold; color: #6f42c1; }
        .metric-label { font-size: 0.85em; color: #666; margin-top: 5px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>♿ Universal Gallery Accessibility Performance Report</h1>
            <p>Generated: ${report.generatedAt}</p>
        </div>
        
        <div class="summary">
            <div class="summary-card">
                <h3>${report.summary.totalTests}</h3>
                <p>A11y Tests</p>
            </div>
            <div class="summary-card">
                <h3>${report.summary.screenReaderOptimized}</h3>
                <p>Screen Reader Optimized</p>
            </div>
            <div class="summary-card">
                <h3>${report.summary.keyboardEfficient}</h3>
                <p>Keyboard Efficient</p>
            </div>
            <div class="summary-card">
                <h3>${Math.round(report.summary.averageAccessibilityTime)}ms</h3>
                <p>Avg A11y Time</p>
            </div>
        </div>
        
        <h2>🧪 Accessibility Performance Results</h2>
        ${report.results.map(result => `
            <div class="test-result success">
                <h3>${result.testName}</h3>
                <p><strong>Timestamp:</strong> ${result.timestamp}</p>
                ${result.metrics ? `
                    <div class="metrics">
                        ${Object.entries(result.metrics).slice(0, 6).map(([key, value]) => `
                            <div class="metric">
                                <div class="metric-value">${typeof value === 'number' ? Math.round(value * 100) / 100 : value}</div>
                                <div class="metric-label">${key}</div>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `).join('')}
        
        <h2>💡 Accessibility Recommendations</h2>
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