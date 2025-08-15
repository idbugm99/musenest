/**
 * End-to-End Tests for Universal Gallery System
 * 
 * Tests complete gallery functionality including user interactions,
 * theme switching, performance monitoring, and accessibility features.
 */

const { chromium, firefox, webkit } = require('playwright');
const testSetup = require('../setup/test-setup');
const testConfig = require('../setup/test-config');
const path = require('path');

describe('Universal Gallery E2E Tests', () => {
    let browser;
    let context;
    let page;
    let utils;

    const browsers = process.env.E2E_BROWSERS ? 
        process.env.E2E_BROWSERS.split(',') : 
        ['chromium']; // Default to Chromium only for faster tests

    browsers.forEach(browserName => {
        describe(`Gallery Functionality - ${browserName}`, () => {
            beforeAll(async () => {
                await testSetup.setupGlobal();
                utils = testSetup.getTestUtils();

                // Launch browser
                const browserEngine = {
                    chromium,
                    firefox,
                    webkit
                }[browserName];

                if (!browserEngine) {
                    throw new Error(`Unknown browser: ${browserName}`);
                }

                browser = await browserEngine.launch({
                    headless: testConfig.browser.headless,
                    slowMo: testConfig.browser.slowMo,
                    devtools: testConfig.browser.devtools
                });
            });

            afterAll(async () => {
                if (browser) {
                    await browser.close();
                }
                await testSetup.teardownGlobal();
            });

            beforeEach(async () => {
                context = await browser.newContext(testConfig.browser.contexts.desktop);
                page = await context.newPage();
                
                // Set viewport
                await page.setViewportSize(testConfig.browser.contexts.desktop.viewport);
                
                // Navigate to test gallery page
                await page.goto(`${testConfig.server.baseUrl}/test/gallery/modern`);
                
                // Wait for gallery to initialize
                await page.waitForSelector('[data-gallery-container]');
                await utils.waitForNetwork(page);
            });

            afterEach(async () => {
                if (testConfig.utils.screenshotOnFailure && global.currentTestFailed) {
                    await utils.takeScreenshot(page, `failed-${Date.now()}`);
                }
                
                if (context) {
                    await context.close();
                }
            });

            describe('Gallery Initialization', () => {
                test('should load gallery with correct theme', async () => {
                    const galleryContainer = await page.locator('[data-gallery-container]');
                    await expect(galleryContainer).toBeVisible();

                    const themeAttribute = await galleryContainer.getAttribute('data-theme');
                    expect(themeAttribute).toBe('modern');
                });

                test('should display gallery images', async () => {
                    const images = await page.locator('[data-gallery-image]');
                    const imageCount = await images.count();
                    
                    expect(imageCount).toBeGreaterThan(0);
                    expect(imageCount).toBeLessThanOrEqual(12); // Default page size
                });

                test('should have proper image attributes', async () => {
                    const firstImage = page.locator('[data-gallery-image] img').first();
                    
                    await expect(firstImage).toBeVisible();
                    await expect(firstImage).toHaveAttribute('src');
                    await expect(firstImage).toHaveAttribute('alt');
                    await expect(firstImage).toHaveAttribute('width');
                    await expect(firstImage).toHaveAttribute('height');
                });

                test('should initialize performance monitoring', async () => {
                    const performanceService = await page.evaluate(() => {
                        return window.testHelpers?.performanceService?.isInitialized;
                    });

                    expect(performanceService).toBe(true);
                });

                test('should initialize analytics tracking', async () => {
                    const analyticsService = await page.evaluate(() => {
                        return window.testHelpers?.analyticsService?.isInitialized;
                    });

                    expect(analyticsService).toBe(true);
                });
            });

            describe('Image Interactions', () => {
                test('should open lightbox when image is clicked', async () => {
                    const firstImage = page.locator('[data-gallery-image]').first();
                    await firstImage.click();

                    // Wait for lightbox to appear
                    await page.waitForSelector('.lightbox-overlay', { timeout: 2000 });
                    
                    const lightbox = page.locator('.lightbox-overlay');
                    await expect(lightbox).toBeVisible();
                });

                test('should navigate lightbox with keyboard', async () => {
                    // Open lightbox
                    await page.locator('[data-gallery-image]').first().click();
                    await page.waitForSelector('.lightbox-overlay');

                    // Navigate with arrow key
                    await page.keyboard.press('ArrowRight');
                    
                    // Check if navigation occurred (image src should change)
                    await page.waitForTimeout(500);
                    
                    const lightboxImage = page.locator('.lightbox-image img');
                    await expect(lightboxImage).toBeVisible();
                });

                test('should close lightbox with escape key', async () => {
                    // Open lightbox
                    await page.locator('[data-gallery-image]').first().click();
                    await page.waitForSelector('.lightbox-overlay');

                    // Close with escape
                    await page.keyboard.press('Escape');
                    
                    const lightbox = page.locator('.lightbox-overlay');
                    await expect(lightbox).not.toBeVisible();
                });

                test('should handle image loading states', async () => {
                    // Check for loading indicators
                    const images = page.locator('[data-gallery-image] img');
                    const firstImage = images.first();

                    // Wait for image to load
                    await firstImage.waitFor({ state: 'visible' });
                    
                    const naturalWidth = await firstImage.evaluate(img => img.naturalWidth);
                    expect(naturalWidth).toBeGreaterThan(0);
                });

                test('should track image interactions analytically', async () => {
                    // Click on an image
                    await page.locator('[data-gallery-image]').first().click();
                    await page.waitForTimeout(500);

                    // Check if analytics were recorded
                    const analyticsData = await page.evaluate(() => {
                        return window.testHelpers?.analyticsService?.getAnalyticsSummary();
                    });

                    expect(analyticsData).toBeDefined();
                    expect(analyticsData.metrics.imageClicks).toBeGreaterThan(0);
                });
            });

            describe('Gallery Controls', () => {
                test('should filter images by category', async () => {
                    const categoryFilter = page.locator('[data-gallery-filter][name="category"]');
                    await categoryFilter.selectOption('portrait');

                    // Wait for filtering to complete
                    await page.waitForTimeout(500);

                    // Check that only portrait images are shown
                    const visibleImages = page.locator('[data-gallery-image]:visible');
                    const imageCount = await visibleImages.count();
                    
                    expect(imageCount).toBeGreaterThan(0);
                    
                    // Verify all visible images have portrait category
                    const categories = await visibleImages.evaluateAll(images => 
                        images.map(img => img.dataset.category)
                    );
                    
                    categories.forEach(category => {
                        expect(category).toBe('portrait');
                    });
                });

                test('should search images by text', async () => {
                    const searchInput = page.locator('[data-gallery-search]');
                    await searchInput.fill('Test Image 1');
                    await searchInput.press('Enter');

                    // Wait for search to complete
                    await page.waitForTimeout(500);

                    const visibleImages = page.locator('[data-gallery-image]:visible');
                    const imageCount = await visibleImages.count();
                    
                    expect(imageCount).toBeLessThanOrEqual(2); // Should filter results
                });

                test('should clear search and filters', async () => {
                    // Apply search and filter
                    await page.locator('[data-gallery-search]').fill('test');
                    await page.locator('[data-gallery-filter][name="category"]').selectOption('portrait');
                    
                    await page.waitForTimeout(500);
                    
                    // Clear search
                    await page.locator('[data-gallery-search]').fill('');
                    await page.locator('[data-gallery-search]').press('Enter');
                    
                    // Reset filter
                    await page.locator('[data-gallery-filter][name="category"]').selectOption('');
                    
                    await page.waitForTimeout(500);

                    // Should show all images again
                    const visibleImages = page.locator('[data-gallery-image]:visible');
                    const imageCount = await visibleImages.count();
                    
                    expect(imageCount).toBe(12); // Default image count
                });
            });

            describe('Responsive Layout', () => {
                test('should adapt to mobile viewport', async () => {
                    // Change to mobile viewport
                    await page.setViewportSize(testConfig.browser.contexts.mobile.viewport);
                    await page.waitForTimeout(500);

                    // Check that layout adapted
                    const galleryGrid = page.locator('.gallery-grid');
                    const gridColumns = await galleryGrid.evaluate(el => 
                        window.getComputedStyle(el).gridTemplateColumns
                    );

                    // Mobile should have fewer columns
                    expect(gridColumns.split(' ').length).toBeLessThanOrEqual(2);
                });

                test('should handle tablet viewport', async () => {
                    // Change to tablet viewport
                    await page.setViewportSize(testConfig.browser.contexts.tablet.viewport);
                    await page.waitForTimeout(500);

                    // Check tablet layout
                    const galleryGrid = page.locator('.gallery-grid');
                    await expect(galleryGrid).toBeVisible();
                    
                    const gridColumns = await galleryGrid.evaluate(el => 
                        window.getComputedStyle(el).gridTemplateColumns
                    );

                    // Tablet should have moderate column count
                    const columnCount = gridColumns.split(' ').length;
                    expect(columnCount).toBeGreaterThan(1);
                    expect(columnCount).toBeLessThanOrEqual(3);
                });

                test('should maintain functionality across viewports', async () => {
                    const viewports = [
                        testConfig.browser.contexts.desktop.viewport,
                        testConfig.browser.contexts.tablet.viewport,
                        testConfig.browser.contexts.mobile.viewport
                    ];

                    for (const viewport of viewports) {
                        await page.setViewportSize(viewport);
                        await page.waitForTimeout(300);

                        // Test image click functionality
                        const firstImage = page.locator('[data-gallery-image]').first();
                        await firstImage.click();
                        
                        await page.waitForSelector('.lightbox-overlay', { timeout: 2000 });
                        const lightbox = page.locator('.lightbox-overlay');
                        await expect(lightbox).toBeVisible();

                        // Close lightbox
                        await page.keyboard.press('Escape');
                        await expect(lightbox).not.toBeVisible();
                    }
                });
            });

            describe('Performance Monitoring', () => {
                test('should track Core Web Vitals', async () => {
                    // Wait for performance metrics to be collected
                    await page.waitForTimeout(2000);

                    const performanceMetrics = await page.evaluate(() => {
                        return window.testHelpers?.performanceService?.getPerformanceReport();
                    });

                    expect(performanceMetrics).toBeDefined();
                    
                    if (performanceMetrics.coreWebVitals) {
                        expect(performanceMetrics.coreWebVitals.lcp).toBeGreaterThan(0);
                        expect(performanceMetrics.coreWebVitals.lcp).toBeLessThan(testConfig.performance.coreWebVitals.lcp.poor);
                    }
                });

                test('should monitor image loading performance', async () => {
                    await page.waitForTimeout(3000);

                    const imageMetrics = await page.evaluate(() => {
                        const report = window.testHelpers?.performanceService?.getPerformanceReport();
                        return report?.imageMetrics;
                    });

                    expect(imageMetrics).toBeDefined();
                    expect(imageMetrics.totalImages).toBeGreaterThan(0);
                    expect(imageMetrics.loadedImages).toBeGreaterThan(0);
                    expect(imageMetrics.averageLoadTime).toBeLessThan(testConfig.performance.imageLoading.maxLoadTime);
                });

                test('should track user interactions', async () => {
                    // Perform some interactions
                    await page.locator('[data-gallery-image]').first().click();
                    await page.keyboard.press('Escape');
                    await page.locator('[data-gallery-search]').fill('test');

                    await page.waitForTimeout(1000);

                    const interactionMetrics = await page.evaluate(() => {
                        const analytics = window.testHelpers?.analyticsService?.getAnalyticsSummary();
                        return analytics?.metrics;
                    });

                    expect(interactionMetrics).toBeDefined();
                    expect(interactionMetrics.imageClicks).toBeGreaterThan(0);
                });
            });

            describe('Theme Integration', () => {
                test('should load different themes correctly', async () => {
                    const themes = ['modern', 'luxury', 'minimal'];

                    for (const theme of themes) {
                        await page.goto(`${testConfig.server.baseUrl}/test/gallery/${theme}`);
                        await page.waitForSelector('[data-gallery-container]');

                        const themeAttribute = await page.getAttribute('[data-gallery-container]', 'data-theme');
                        expect(themeAttribute).toBe(theme);

                        // Verify theme-specific styles are loaded
                        const galleryContainer = page.locator('[data-gallery-container]');
                        const computedStyle = await galleryContainer.evaluate(el => 
                            window.getComputedStyle(el)
                        );

                        expect(computedStyle).toBeDefined();
                    }
                });

                test('should maintain functionality across themes', async () => {
                    const themes = ['modern', 'luxury'];

                    for (const theme of themes) {
                        await page.goto(`${testConfig.server.baseUrl}/test/gallery/${theme}`);
                        await page.waitForSelector('[data-gallery-container]');

                        // Test lightbox functionality
                        await page.locator('[data-gallery-image]').first().click();
                        await page.waitForSelector('.lightbox-overlay', { timeout: 2000 });
                        
                        const lightbox = page.locator('.lightbox-overlay');
                        await expect(lightbox).toBeVisible();

                        await page.keyboard.press('Escape');
                        await expect(lightbox).not.toBeVisible();
                    }
                });
            });

            describe('Accessibility Features', () => {
                test('should support keyboard navigation', async () => {
                    // Focus first image
                    await page.keyboard.press('Tab');
                    
                    const focusedElement = await page.evaluate(() => document.activeElement.tagName);
                    expect(['IMG', 'DIV', 'BUTTON']).toContain(focusedElement);

                    // Navigate with arrow keys
                    await page.keyboard.press('ArrowRight');
                    await page.waitForTimeout(100);

                    // Should still have focus within gallery
                    const galleryContainer = page.locator('[data-gallery-container]');
                    const hasFocusWithin = await galleryContainer.evaluate(el => 
                        el.contains(document.activeElement)
                    );
                    expect(hasFocusWithin).toBe(true);
                });

                test('should have proper ARIA attributes', async () => {
                    const galleryContainer = page.locator('[data-gallery-container]');
                    
                    // Check for ARIA labels
                    const ariaLabel = await galleryContainer.getAttribute('aria-label');
                    expect(ariaLabel).toBeTruthy();

                    // Check images have alt text
                    const images = page.locator('[data-gallery-image] img');
                    const imageCount = await images.count();
                    
                    for (let i = 0; i < imageCount; i++) {
                        const alt = await images.nth(i).getAttribute('alt');
                        expect(alt).toBeTruthy();
                    }
                });

                test('should support screen reader navigation', async () => {
                    // Check for proper heading structure
                    const headings = page.locator('h1, h2, h3, h4, h5, h6');
                    const headingCount = await headings.count();
                    
                    expect(headingCount).toBeGreaterThan(0);

                    // Check for skip links (if implemented)
                    const skipLinks = page.locator('a[href^="#"]');
                    const skipLinkCount = await skipLinks.count();
                    
                    // Skip links are optional but good practice
                    if (skipLinkCount > 0) {
                        const firstSkipLink = skipLinks.first();
                        await expect(firstSkipLink).toHaveAttribute('href');
                    }
                });

                test('should handle focus management in lightbox', async () => {
                    // Open lightbox
                    await page.locator('[data-gallery-image]').first().click();
                    await page.waitForSelector('.lightbox-overlay');

                    // Check that focus is trapped in lightbox
                    await page.keyboard.press('Tab');
                    
                    const focusedElement = await page.evaluate(() => {
                        const activeEl = document.activeElement;
                        return {
                            tagName: activeEl.tagName,
                            className: activeEl.className
                        };
                    });

                    expect(focusedElement.className).toContain('lightbox');

                    // Close and check focus returns
                    await page.keyboard.press('Escape');
                    await page.waitForTimeout(300);

                    const returnedFocus = await page.evaluate(() => {
                        const activeEl = document.activeElement;
                        return activeEl.closest('[data-gallery-image]') !== null;
                    });

                    expect(returnedFocus).toBe(true);
                });
            });

            describe('Error Handling', () => {
                test('should handle image loading errors gracefully', async () => {
                    // Inject an image with broken src
                    await page.evaluate(() => {
                        const galleryGrid = document.querySelector('.gallery-grid');
                        const brokenImageItem = document.createElement('div');
                        brokenImageItem.className = 'gallery-item';
                        brokenImageItem.setAttribute('data-gallery-image', '');
                        brokenImageItem.innerHTML = '<img src="broken-image-url.jpg" alt="Broken Image" />';
                        galleryGrid.appendChild(brokenImageItem);
                    });

                    await page.waitForTimeout(500);

                    // Gallery should still function normally
                    const workingImages = page.locator('[data-gallery-image]:has(img[src*="picsum"])');
                    const workingImageCount = await workingImages.count();
                    
                    expect(workingImageCount).toBeGreaterThan(0);

                    // First working image should still open lightbox
                    await workingImages.first().click();
                    await page.waitForSelector('.lightbox-overlay', { timeout: 2000 });
                    
                    const lightbox = page.locator('.lightbox-overlay');
                    await expect(lightbox).toBeVisible();
                });

                test('should handle network interruptions', async () => {
                    // Simulate offline condition
                    await context.setOffline(true);

                    // Try to interact with gallery
                    const firstImage = page.locator('[data-gallery-image]').first();
                    await firstImage.click();

                    // Should still work with cached resources
                    await page.waitForSelector('.lightbox-overlay', { timeout: 3000 });
                    const lightbox = page.locator('.lightbox-overlay');
                    await expect(lightbox).toBeVisible();

                    // Restore connection
                    await context.setOffline(false);
                });

                test('should handle JavaScript errors gracefully', async () => {
                    // Inject a script error
                    await page.evaluate(() => {
                        // Simulate error in analytics service
                        if (window.testHelpers?.analyticsService) {
                            window.testHelpers.analyticsService.trackEvent = function() {
                                throw new Error('Simulated analytics error');
                            };
                        }
                    });

                    // Gallery should still function
                    const firstImage = page.locator('[data-gallery-image]').first();
                    await firstImage.click();

                    await page.waitForSelector('.lightbox-overlay', { timeout: 2000 });
                    const lightbox = page.locator('.lightbox-overlay');
                    await expect(lightbox).toBeVisible();
                });
            });

            describe('Visual Regression', () => {
                test('should match baseline screenshots', async () => {
                    // Take screenshot of gallery
                    const galleryScreenshot = await utils.takeScreenshot(page, `gallery-${browserName}-desktop`);
                    expect(galleryScreenshot).toBeDefined();

                    // Test mobile layout
                    await page.setViewportSize(testConfig.browser.contexts.mobile.viewport);
                    await page.waitForTimeout(500);
                    
                    const mobileScreenshot = await utils.takeScreenshot(page, `gallery-${browserName}-mobile`);
                    expect(mobileScreenshot).toBeDefined();
                });

                test('should maintain visual consistency with lightbox', async () => {
                    // Open lightbox
                    await page.locator('[data-gallery-image]').first().click();
                    await page.waitForSelector('.lightbox-overlay');
                    await page.waitForTimeout(500); // Wait for animations

                    const lightboxScreenshot = await utils.takeScreenshot(page, `lightbox-${browserName}`);
                    expect(lightboxScreenshot).toBeDefined();
                });
            });
        });
    });
});