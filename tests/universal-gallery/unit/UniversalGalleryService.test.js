/**
 * Unit Tests for UniversalGalleryService
 * 
 * Tests core gallery functionality, configuration management,
 * layout rendering, and service integration.
 */

const testSetup = require('../setup/test-setup');
const testConfig = require('../setup/test-config');

// Mock DOM environment for testing
const { JSDOM } = require('jsdom');
const dom = new JSDOM(`
<!DOCTYPE html>
<html>
<body>
    <div id="test-gallery" data-gallery-container></div>
</body>
</html>
`, {
    url: 'http://localhost:3001',
    pretendToBeVisual: true,
    resources: 'usable'
});

global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
global.IntersectionObserver = class IntersectionObserver {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
};

// Import the service after DOM setup
const UniversalGalleryService = require('../../../src/services/UniversalGalleryService');

describe('UniversalGalleryService', () => {
    let galleryService;
    let galleryContainer;

    beforeAll(async () => {
        await testSetup.setupGlobal();
    });

    afterAll(async () => {
        await testSetup.teardownGlobal();
    });

    beforeEach(() => {
        // Reset DOM
        document.body.innerHTML = `
            <div id="test-gallery" data-gallery-container data-gallery-id="test-gallery">
                <div class="gallery-grid" data-gallery-layout="grid">
                    <div class="gallery-item" data-gallery-image data-image-id="img1">
                        <img src="test1.jpg" alt="Test 1" />
                    </div>
                    <div class="gallery-item" data-gallery-image data-image-id="img2">
                        <img src="test2.jpg" alt="Test 2" />
                    </div>
                    <div class="gallery-item" data-gallery-image data-image-id="img3">
                        <img src="test3.jpg" alt="Test 3" />
                    </div>
                </div>
            </div>
        `;

        galleryContainer = document.getElementById('test-gallery');
        galleryService = new UniversalGalleryService();
    });

    afterEach(() => {
        if (galleryService && typeof galleryService.destroy === 'function') {
            galleryService.destroy();
        }
    });

    describe('Initialization', () => {
        test('should initialize with default configuration', () => {
            expect(galleryService).toBeDefined();
            expect(galleryService.config).toBeDefined();
            expect(galleryService.config.layout).toBe('grid');
            expect(galleryService.config.lightbox).toBe(true);
            expect(galleryService.config.lazy).toBe(true);
        });

        test('should accept custom configuration', () => {
            const customConfig = {
                layout: 'masonry',
                columns: 4,
                spacing: 'large',
                lightbox: false
            };

            const customService = new UniversalGalleryService(customConfig);
            expect(customService.config.layout).toBe('masonry');
            expect(customService.config.columns).toBe(4);
            expect(customService.config.spacing).toBe('large');
            expect(customService.config.lightbox).toBe(false);
        });

        test('should validate configuration on initialization', () => {
            const invalidConfig = {
                layout: 'invalid-layout',
                columns: -1
            };

            expect(() => {
                new UniversalGalleryService(invalidConfig);
            }).toThrow();
        });

        test('should initialize with gallery container', async () => {
            await galleryService.init(galleryContainer);
            
            expect(galleryService.isInitialized).toBe(true);
            expect(galleryService.container).toBe(galleryContainer);
            expect(galleryService.state.imageCount).toBe(3);
        });
    });

    describe('Configuration Management', () => {
        beforeEach(async () => {
            await galleryService.init(galleryContainer);
        });

        test('should update configuration dynamically', async () => {
            const newConfig = {
                layout: 'masonry',
                columns: 4,
                spacing: 'large'
            };

            await galleryService.updateConfig(newConfig);
            
            expect(galleryService.config.layout).toBe('masonry');
            expect(galleryService.config.columns).toBe(4);
            expect(galleryService.config.spacing).toBe('large');
        });

        test('should validate configuration updates', async () => {
            const invalidConfig = {
                layout: 'invalid-layout'
            };

            await expect(galleryService.updateConfig(invalidConfig)).rejects.toThrow();
        });

        test('should trigger re-render on configuration update', async () => {
            const renderSpy = jest.spyOn(galleryService, 'render');
            
            await galleryService.updateConfig({ columns: 4 });
            
            expect(renderSpy).toHaveBeenCalled();
        });

        test('should merge partial configuration updates', async () => {
            const originalLayout = galleryService.config.layout;
            
            await galleryService.updateConfig({ columns: 5 });
            
            expect(galleryService.config.layout).toBe(originalLayout);
            expect(galleryService.config.columns).toBe(5);
        });
    });

    describe('Layout Management', () => {
        beforeEach(async () => {
            await galleryService.init(galleryContainer);
        });

        test('should render grid layout correctly', async () => {
            await galleryService.updateConfig({ layout: 'grid', columns: 3 });
            
            const galleryGrid = galleryContainer.querySelector('.gallery-grid');
            expect(galleryGrid).toBeTruthy();
            expect(galleryGrid.style.gridTemplateColumns).toContain('3');
        });

        test('should render masonry layout correctly', async () => {
            await galleryService.updateConfig({ layout: 'masonry' });
            
            expect(galleryService.modules.has('masonry')).toBe(true);
        });

        test('should render carousel layout correctly', async () => {
            await galleryService.updateConfig({ layout: 'carousel' });
            
            expect(galleryContainer.classList.contains('gallery-carousel')).toBe(true);
        });

        test('should handle responsive column calculation', async () => {
            // Mock window resize
            Object.defineProperty(window, 'innerWidth', {
                writable: true,
                configurable: true,
                value: 768
            });

            await galleryService.updateConfig({ columns: 'auto' });
            
            const columns = galleryService.calculateResponsiveColumns();
            expect(columns).toBeGreaterThan(0);
            expect(columns).toBeLessThanOrEqual(4);
        });

        test('should apply spacing correctly', async () => {
            await galleryService.updateConfig({ spacing: 'large' });
            
            const galleryGrid = galleryContainer.querySelector('.gallery-grid');
            expect(galleryGrid.style.gap).toBe('2rem');
        });
    });

    describe('Image Management', () => {
        beforeEach(async () => {
            await galleryService.init(galleryContainer);
        });

        test('should detect and catalog images on initialization', () => {
            expect(galleryService.state.images.length).toBe(3);
            expect(galleryService.state.imageCount).toBe(3);
        });

        test('should handle image loading states', async () => {
            const images = galleryContainer.querySelectorAll('[data-gallery-image] img');
            
            // Simulate image loading
            images.forEach(img => {
                img.dispatchEvent(new Event('load'));
            });

            await new Promise(resolve => setTimeout(resolve, 100));
            
            expect(galleryService.state.loadedImages).toBe(3);
        });

        test('should handle image loading errors', async () => {
            const firstImage = galleryContainer.querySelector('[data-gallery-image] img');
            
            // Simulate image error
            firstImage.dispatchEvent(new Event('error'));

            await new Promise(resolve => setTimeout(resolve, 100));
            
            expect(galleryService.state.errorImages).toBe(1);
        });

        test('should implement lazy loading when enabled', async () => {
            await galleryService.updateConfig({ lazy: true });
            
            const images = galleryContainer.querySelectorAll('[data-gallery-image] img');
            images.forEach(img => {
                expect(img.loading).toBe('lazy');
            });
        });

        test('should disable lazy loading when configured', async () => {
            await galleryService.updateConfig({ lazy: false });
            
            const images = galleryContainer.querySelectorAll('[data-gallery-image] img');
            images.forEach(img => {
                expect(img.loading).toBe('eager');
            });
        });
    });

    describe('Event Handling', () => {
        beforeEach(async () => {
            await galleryService.init(galleryContainer);
        });

        test('should handle image clicks', () => {
            const clickHandler = jest.fn();
            galleryService.addEventListener('imageClick', clickHandler);

            const firstImage = galleryContainer.querySelector('[data-gallery-image]');
            firstImage.click();

            expect(clickHandler).toHaveBeenCalled();
        });

        test('should handle lightbox events when enabled', async () => {
            await galleryService.updateConfig({ lightbox: true });
            
            const lightboxHandler = jest.fn();
            galleryService.addEventListener('lightboxOpen', lightboxHandler);

            const firstImage = galleryContainer.querySelector('[data-gallery-image]');
            firstImage.click();

            expect(lightboxHandler).toHaveBeenCalled();
        });

        test('should handle window resize events', () => {
            const resizeHandler = jest.spyOn(galleryService, 'handleResize');
            
            window.dispatchEvent(new Event('resize'));
            
            expect(resizeHandler).toHaveBeenCalled();
        });

        test('should handle keyboard navigation', () => {
            const keyHandler = jest.spyOn(galleryService, 'handleKeydown');
            
            const keyEvent = new KeyboardEvent('keydown', { key: 'ArrowRight' });
            galleryContainer.dispatchEvent(keyEvent);
            
            expect(keyHandler).toHaveBeenCalledWith(keyEvent);
        });
    });

    describe('Module Integration', () => {
        beforeEach(async () => {
            await galleryService.init(galleryContainer);
        });

        test('should load lightbox module when enabled', async () => {
            await galleryService.updateConfig({ lightbox: true });
            
            expect(galleryService.modules.has('lightbox')).toBe(true);
        });

        test('should load masonry module for masonry layout', async () => {
            await galleryService.updateConfig({ layout: 'masonry' });
            
            expect(galleryService.modules.has('masonry')).toBe(true);
        });

        test('should load prefetch module when enabled', async () => {
            await galleryService.updateConfig({ prefetch: true });
            
            expect(galleryService.modules.has('prefetch')).toBe(true);
        });

        test('should unload modules when disabled', async () => {
            await galleryService.updateConfig({ lightbox: true });
            expect(galleryService.modules.has('lightbox')).toBe(true);

            await galleryService.updateConfig({ lightbox: false });
            expect(galleryService.modules.has('lightbox')).toBe(false);
        });
    });

    describe('Performance Tracking', () => {
        beforeEach(async () => {
            await galleryService.init(galleryContainer);
        });

        test('should track render performance', () => {
            expect(galleryService.state.performance.renderStart).toBeDefined();
            expect(galleryService.state.performance.renderEnd).toBeDefined();
            expect(galleryService.state.performance.renderDuration).toBeGreaterThan(0);
        });

        test('should track image loading performance', async () => {
            const images = galleryContainer.querySelectorAll('[data-gallery-image] img');
            
            // Simulate image load
            images[0].dispatchEvent(new Event('load'));
            
            expect(galleryService.state.performance.imageLoadTimes.length).toBeGreaterThan(0);
        });

        test('should calculate performance metrics', () => {
            const metrics = galleryService.getPerformanceMetrics();
            
            expect(metrics).toHaveProperty('renderTime');
            expect(metrics).toHaveProperty('imageLoadTime');
            expect(metrics).toHaveProperty('totalImages');
            expect(metrics).toHaveProperty('loadedImages');
        });
    });

    describe('State Management', () => {
        beforeEach(async () => {
            await galleryService.init(galleryContainer);
        });

        test('should maintain gallery state', () => {
            expect(galleryService.state.isInitialized).toBe(true);
            expect(galleryService.state.imageCount).toBe(3);
            expect(galleryService.state.loadedImages).toBeDefined();
            expect(galleryService.state.errorImages).toBeDefined();
        });

        test('should update state on image load', () => {
            const initialLoaded = galleryService.state.loadedImages;
            
            const firstImage = galleryContainer.querySelector('[data-gallery-image] img');
            firstImage.dispatchEvent(new Event('load'));
            
            expect(galleryService.state.loadedImages).toBe(initialLoaded + 1);
        });

        test('should update state on configuration change', async () => {
            const originalLayout = galleryService.state.currentLayout;
            
            await galleryService.updateConfig({ layout: 'masonry' });
            
            expect(galleryService.state.currentLayout).toBe('masonry');
            expect(galleryService.state.currentLayout).not.toBe(originalLayout);
        });

        test('should provide state snapshot', () => {
            const snapshot = galleryService.getState();
            
            expect(snapshot).toHaveProperty('isInitialized');
            expect(snapshot).toHaveProperty('imageCount');
            expect(snapshot).toHaveProperty('currentLayout');
            expect(snapshot).toHaveProperty('modules');
        });
    });

    describe('Error Handling', () => {
        test('should handle initialization without container', async () => {
            const newService = new UniversalGalleryService();
            
            await expect(newService.init(null)).rejects.toThrow();
        });

        test('should handle invalid configuration', () => {
            expect(() => {
                new UniversalGalleryService({
                    layout: 'invalid',
                    columns: 'not-a-number'
                });
            }).toThrow();
        });

        test('should handle missing gallery images gracefully', async () => {
            const emptyContainer = document.createElement('div');
            emptyContainer.setAttribute('data-gallery-container', '');
            
            const emptyService = new UniversalGalleryService();
            await emptyService.init(emptyContainer);
            
            expect(emptyService.state.imageCount).toBe(0);
            expect(emptyService.isInitialized).toBe(true);
        });

        test('should handle module loading failures gracefully', async () => {
            // Mock module loading failure
            const originalLoadModule = galleryService.loadModule;
            galleryService.loadModule = jest.fn().mockRejectedValue(new Error('Module load failed'));

            await galleryService.init(galleryContainer);
            
            // Service should still initialize without the failed module
            expect(galleryService.isInitialized).toBe(true);
            
            // Restore original method
            galleryService.loadModule = originalLoadModule;
        });
    });

    describe('Cleanup and Destruction', () => {
        beforeEach(async () => {
            await galleryService.init(galleryContainer);
        });

        test('should cleanup event listeners on destroy', () => {
            const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');
            
            galleryService.destroy();
            
            expect(removeEventListenerSpy).toHaveBeenCalled();
            expect(galleryService.isInitialized).toBe(false);
        });

        test('should cleanup modules on destroy', () => {
            const moduleCount = galleryService.modules.size;
            
            galleryService.destroy();
            
            expect(galleryService.modules.size).toBe(0);
            expect(galleryService.modules.size).toBeLessThan(moduleCount);
        });

        test('should reset state on destroy', () => {
            galleryService.destroy();
            
            expect(galleryService.state.isInitialized).toBe(false);
            expect(galleryService.container).toBe(null);
        });

        test('should handle multiple destroy calls gracefully', () => {
            galleryService.destroy();
            
            expect(() => {
                galleryService.destroy();
            }).not.toThrow();
        });
    });

    describe('API Integration', () => {
        beforeEach(async () => {
            await galleryService.init(galleryContainer);
        });

        test('should fetch gallery configuration from API', async () => {
            const mockFetch = jest.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({
                    layout: 'grid',
                    columns: 4,
                    lightbox: true
                })
            });
            global.fetch = mockFetch;

            await galleryService.loadConfigFromAPI('test-model-1');
            
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/universal-gallery/config/test-model-1')
            );
            expect(galleryService.config.columns).toBe(4);
        });

        test('should handle API configuration errors gracefully', async () => {
            const mockFetch = jest.fn().mockRejectedValue(new Error('API Error'));
            global.fetch = mockFetch;

            await expect(galleryService.loadConfigFromAPI('test-model-1')).resolves.not.toThrow();
            
            // Should fall back to default configuration
            expect(galleryService.config.layout).toBe('grid');
        });

        test('should save configuration to API', async () => {
            const mockFetch = jest.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ success: true })
            });
            global.fetch = mockFetch;

            await galleryService.saveConfigToAPI('test-model-1');
            
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/universal-gallery/config/test-model-1'),
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Content-Type': 'application/json'
                    }),
                    body: expect.any(String)
                })
            );
        });
    });
});