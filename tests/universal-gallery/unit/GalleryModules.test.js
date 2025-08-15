/**
 * Unit Tests for Gallery Modules
 * 
 * Tests individual gallery modules including lightbox,
 * masonry, prefetch, and their integration with the service.
 */

const testSetup = require('../setup/test-setup');
const testConfig = require('../setup/test-config');

// Mock DOM environment
const { JSDOM } = require('jsdom');
const dom = new JSDOM(`
<!DOCTYPE html>
<html>
<body>
    <div id="test-gallery"></div>
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
global.Event = dom.window.Event;
global.CustomEvent = dom.window.CustomEvent;
global.IntersectionObserver = class IntersectionObserver {
    constructor(callback, options) {
        this.callback = callback;
        this.options = options;
    }
    observe(element) {
        // Simulate immediate intersection
        setTimeout(() => {
            this.callback([{
                target: element,
                isIntersecting: true,
                intersectionRatio: 1
            }]);
        }, 0);
    }
    unobserve() {}
    disconnect() {}
};

// Import modules after DOM setup
const GalleryLightbox = require('../../../src/modules/GalleryLightbox');
const GalleryMasonry = require('../../../src/modules/GalleryMasonry');
const GalleryPrefetch = require('../../../src/modules/GalleryPrefetch');

describe('Gallery Modules', () => {
    let galleryContainer;

    beforeAll(async () => {
        await testSetup.setupGlobal();
    });

    afterAll(async () => {
        await testSetup.teardownGlobal();
    });

    beforeEach(() => {
        document.body.innerHTML = `
            <div id="test-gallery" data-gallery-container>
                <div class="gallery-grid">
                    <div class="gallery-item" data-gallery-image data-image-id="img1">
                        <img src="https://picsum.photos/400/300?random=1" alt="Test 1" width="400" height="300" />
                    </div>
                    <div class="gallery-item" data-gallery-image data-image-id="img2">
                        <img src="https://picsum.photos/400/400?random=2" alt="Test 2" width="400" height="400" />
                    </div>
                    <div class="gallery-item" data-gallery-image data-image-id="img3">
                        <img src="https://picsum.photos/300/500?random=3" alt="Test 3" width="300" height="500" />
                    </div>
                    <div class="gallery-item" data-gallery-image data-image-id="img4">
                        <img src="https://picsum.photos/500/300?random=4" alt="Test 4" width="500" height="300" />
                    </div>
                </div>
            </div>
        `;
        galleryContainer = document.getElementById('test-gallery');
    });

    describe('GalleryLightbox', () => {
        let lightbox;

        beforeEach(() => {
            lightbox = new GalleryLightbox({
                selector: '[data-gallery-image]',
                animation: 'fade',
                keyboard: true,
                touch: true
            });
        });

        afterEach(() => {
            if (lightbox) {
                lightbox.destroy();
            }
            // Remove any lightbox overlays
            document.querySelectorAll('.lightbox-overlay').forEach(el => el.remove());
        });

        test('should initialize with default configuration', () => {
            expect(lightbox).toBeDefined();
            expect(lightbox.config.animation).toBe('fade');
            expect(lightbox.config.keyboard).toBe(true);
            expect(lightbox.config.touch).toBe(true);
        });

        test('should accept custom configuration', () => {
            const customLightbox = new GalleryLightbox({
                animation: 'slide',
                keyboard: false,
                showNavigation: false
            });

            expect(customLightbox.config.animation).toBe('slide');
            expect(customLightbox.config.keyboard).toBe(false);
            expect(customLightbox.config.showNavigation).toBe(false);
        });

        test('should initialize with gallery container', () => {
            lightbox.init(galleryContainer);

            expect(lightbox.isInitialized).toBe(true);
            expect(lightbox.container).toBe(galleryContainer);
            expect(lightbox.images.length).toBe(4);
        });

        test('should create lightbox overlay on initialization', () => {
            lightbox.init(galleryContainer);

            const overlay = document.querySelector('.lightbox-overlay');
            expect(overlay).toBeTruthy();
            expect(overlay.style.display).toBe('none');
        });

        test('should open lightbox when image is clicked', async () => {
            lightbox.init(galleryContainer);

            const firstImage = galleryContainer.querySelector('[data-gallery-image]');
            firstImage.click();

            await new Promise(resolve => setTimeout(resolve, 50));

            const overlay = document.querySelector('.lightbox-overlay');
            expect(overlay.style.display).toBe('flex');
            expect(lightbox.state.isOpen).toBe(true);
            expect(lightbox.state.currentIndex).toBe(0);
        });

        test('should close lightbox with escape key', async () => {
            lightbox.init(galleryContainer);

            // Open lightbox
            const firstImage = galleryContainer.querySelector('[data-gallery-image]');
            firstImage.click();

            await new Promise(resolve => setTimeout(resolve, 50));

            // Press escape key
            const escEvent = new KeyboardEvent('keydown', { key: 'Escape' });
            document.dispatchEvent(escEvent);

            await new Promise(resolve => setTimeout(resolve, 50));

            const overlay = document.querySelector('.lightbox-overlay');
            expect(overlay.style.display).toBe('none');
            expect(lightbox.state.isOpen).toBe(false);
        });

        test('should navigate with arrow keys', async () => {
            lightbox.init(galleryContainer);

            // Open lightbox
            const firstImage = galleryContainer.querySelector('[data-gallery-image]');
            firstImage.click();

            await new Promise(resolve => setTimeout(resolve, 50));

            const initialIndex = lightbox.state.currentIndex;

            // Press right arrow key
            const arrowEvent = new KeyboardEvent('keydown', { key: 'ArrowRight' });
            document.dispatchEvent(arrowEvent);

            expect(lightbox.state.currentIndex).toBe(initialIndex + 1);
        });

        test('should handle navigation buttons', async () => {
            lightbox.init(galleryContainer);

            // Open lightbox
            const firstImage = galleryContainer.querySelector('[data-gallery-image]');
            firstImage.click();

            await new Promise(resolve => setTimeout(resolve, 50));

            const nextButton = document.querySelector('.lightbox-next');
            if (nextButton) {
                nextButton.click();
                expect(lightbox.state.currentIndex).toBe(1);
            }
        });

        test('should handle touch/swipe gestures', async () => {
            lightbox.init(galleryContainer);

            // Open lightbox
            const firstImage = galleryContainer.querySelector('[data-gallery-image]');
            firstImage.click();

            await new Promise(resolve => setTimeout(resolve, 50));

            const lightboxImage = document.querySelector('.lightbox-image');
            if (lightboxImage) {
                // Simulate touch events
                const touchStart = new TouchEvent('touchstart', {
                    touches: [{ clientX: 200, clientY: 100 }]
                });
                const touchEnd = new TouchEvent('touchend', {
                    changedTouches: [{ clientX: 100, clientY: 100 }]
                });

                lightboxImage.dispatchEvent(touchStart);
                lightboxImage.dispatchEvent(touchEnd);

                // Should navigate to next image on swipe left
                expect(lightbox.state.currentIndex).toBeGreaterThan(0);
            }
        });

        test('should emit events on state changes', (done) => {
            lightbox.init(galleryContainer);

            let eventCount = 0;

            lightbox.addEventListener('open', (data) => {
                expect(data.index).toBe(0);
                eventCount++;
            });

            lightbox.addEventListener('navigate', (data) => {
                expect(data.index).toBeGreaterThanOrEqual(0);
                eventCount++;
            });

            lightbox.addEventListener('close', () => {
                eventCount++;
                expect(eventCount).toBe(3);
                done();
            });

            // Trigger events
            const firstImage = galleryContainer.querySelector('[data-gallery-image]');
            firstImage.click();

            setTimeout(() => {
                const escEvent = new KeyboardEvent('keydown', { key: 'Escape' });
                document.dispatchEvent(escEvent);
            }, 50);
        });

        test('should preload adjacent images', async () => {
            lightbox.init(galleryContainer);

            const firstImage = galleryContainer.querySelector('[data-gallery-image]');
            firstImage.click();

            await new Promise(resolve => setTimeout(resolve, 100));

            // Check if adjacent images are preloaded
            expect(lightbox.state.preloadedImages.size).toBeGreaterThan(0);
        });

        test('should handle image loading errors gracefully', async () => {
            // Add an image with broken src
            const brokenImage = document.createElement('div');
            brokenImage.className = 'gallery-item';
            brokenImage.setAttribute('data-gallery-image', '');
            brokenImage.innerHTML = '<img src="broken-image.jpg" alt="Broken" />';
            galleryContainer.querySelector('.gallery-grid').appendChild(brokenImage);

            lightbox.init(galleryContainer);

            // Click on broken image
            brokenImage.click();

            await new Promise(resolve => setTimeout(resolve, 100));

            // Should handle error gracefully
            expect(lightbox.state.isOpen).toBe(true);
        });
    });

    describe('GalleryMasonry', () => {
        let masonry;

        beforeEach(() => {
            masonry = new GalleryMasonry({
                columns: 3,
                gap: 16,
                responsive: true
            });
        });

        afterEach(() => {
            if (masonry) {
                masonry.destroy();
            }
        });

        test('should initialize with default configuration', () => {
            expect(masonry).toBeDefined();
            expect(masonry.config.columns).toBe(3);
            expect(masonry.config.gap).toBe(16);
            expect(masonry.config.responsive).toBe(true);
        });

        test('should calculate column layout', () => {
            masonry.init(galleryContainer);

            expect(masonry.state.columnHeights).toHaveLength(3);
            expect(masonry.state.columns).toBe(3);
        });

        test('should position items in masonry layout', async () => {
            masonry.init(galleryContainer);
            await masonry.layout();

            const items = galleryContainer.querySelectorAll('[data-gallery-image]');
            items.forEach(item => {
                expect(item.style.position).toBe('absolute');
                expect(item.style.left).toBeDefined();
                expect(item.style.top).toBeDefined();
            });
        });

        test('should handle responsive column calculation', () => {
            Object.defineProperty(window, 'innerWidth', { value: 768, writable: true });
            
            masonry.init(galleryContainer);
            
            const responsiveColumns = masonry.calculateResponsiveColumns();
            expect(responsiveColumns).toBeGreaterThan(0);
            expect(responsiveColumns).toBeLessThanOrEqual(masonry.config.maxColumns || 4);
        });

        test('should recalculate layout on window resize', (done) => {
            masonry.init(galleryContainer);
            
            const layoutSpy = jest.spyOn(masonry, 'layout');
            
            window.dispatchEvent(new Event('resize'));
            
            setTimeout(() => {
                expect(layoutSpy).toHaveBeenCalled();
                done();
            }, 300); // Wait for debounce
        });

        test('should handle image load events for relayout', async () => {
            masonry.init(galleryContainer);
            
            const layoutSpy = jest.spyOn(masonry, 'layout');
            
            // Simulate image load
            const firstImage = galleryContainer.querySelector('[data-gallery-image] img');
            firstImage.dispatchEvent(new Event('load'));
            
            await new Promise(resolve => setTimeout(resolve, 50));
            
            expect(layoutSpy).toHaveBeenCalled();
        });

        test('should optimize performance with debounced layout', (done) => {
            masonry.init(galleryContainer);
            
            const layoutSpy = jest.spyOn(masonry, 'layout');
            
            // Trigger multiple resize events rapidly
            for (let i = 0; i < 5; i++) {
                window.dispatchEvent(new Event('resize'));
            }
            
            setTimeout(() => {
                // Should only call layout once due to debouncing
                expect(layoutSpy).toHaveBeenCalledTimes(1);
                done();
            }, 350);
        });

        test('should handle dynamic content addition', async () => {
            masonry.init(galleryContainer);
            await masonry.layout();

            // Add new item
            const newItem = document.createElement('div');
            newItem.className = 'gallery-item';
            newItem.setAttribute('data-gallery-image', '');
            newItem.innerHTML = '<img src="new-image.jpg" alt="New" width="400" height="600" />';
            galleryContainer.querySelector('.gallery-grid').appendChild(newItem);

            await masonry.addItem(newItem);

            expect(masonry.state.items.length).toBe(5);
        });

        test('should handle item removal', async () => {
            masonry.init(galleryContainer);
            await masonry.layout();

            const firstItem = galleryContainer.querySelector('[data-gallery-image]');
            await masonry.removeItem(firstItem);

            expect(masonry.state.items.length).toBe(3);
        });

        test('should calculate optimal column heights', async () => {
            masonry.init(galleryContainer);
            await masonry.layout();

            const heights = masonry.state.columnHeights;
            const maxHeight = Math.max(...heights);
            const minHeight = Math.min(...heights);

            // Heights should be relatively balanced
            expect(maxHeight - minHeight).toBeLessThan(200);
        });
    });

    describe('GalleryPrefetch', () => {
        let prefetch;

        beforeEach(() => {
            prefetch = new GalleryPrefetch({
                preloadCount: 3,
                viewport: 50,
                priority: 'high'
            });
        });

        afterEach(() => {
            if (prefetch) {
                prefetch.destroy();
            }
        });

        test('should initialize with default configuration', () => {
            expect(prefetch).toBeDefined();
            expect(prefetch.config.preloadCount).toBe(3);
            expect(prefetch.config.viewport).toBe(50);
            expect(prefetch.config.priority).toBe('high');
        });

        test('should setup intersection observer', () => {
            prefetch.init(galleryContainer);

            expect(prefetch.observer).toBeDefined();
            expect(prefetch.isInitialized).toBe(true);
        });

        test('should observe gallery images', () => {
            prefetch.init(galleryContainer);

            const images = galleryContainer.querySelectorAll('[data-gallery-image] img');
            expect(prefetch.observedImages.size).toBe(images.length);
        });

        test('should preload images when they enter viewport', async () => {
            prefetch.init(galleryContainer);

            // Simulate intersection
            const firstImage = galleryContainer.querySelector('[data-gallery-image] img');
            
            await new Promise(resolve => setTimeout(resolve, 50));

            expect(prefetch.state.preloadedImages.has(firstImage.src)).toBe(true);
        });

        test('should respect preload count limit', async () => {
            prefetch.init(galleryContainer);

            await new Promise(resolve => setTimeout(resolve, 100));

            expect(prefetch.state.preloadedImages.size).toBeLessThanOrEqual(prefetch.config.preloadCount);
        });

        test('should handle image preload success', (done) => {
            prefetch.init(galleryContainer);

            prefetch.addEventListener('preloadSuccess', (data) => {
                expect(data.src).toBeDefined();
                expect(data.loadTime).toBeGreaterThan(0);
                done();
            });

            // Trigger preload
            const firstImage = galleryContainer.querySelector('[data-gallery-image] img');
            prefetch.preloadImage(firstImage.src);
        });

        test('should handle image preload errors', (done) => {
            prefetch.init(galleryContainer);

            prefetch.addEventListener('preloadError', (data) => {
                expect(data.src).toBe('broken-image.jpg');
                expect(data.error).toBeDefined();
                done();
            });

            // Trigger preload with broken URL
            prefetch.preloadImage('broken-image.jpg');
        });

        test('should prioritize visible images', async () => {
            prefetch.init(galleryContainer);

            await new Promise(resolve => setTimeout(resolve, 100));

            // Check that visible images are prioritized
            const visibleImages = Array.from(galleryContainer.querySelectorAll('[data-gallery-image] img'))
                .slice(0, 2); // First 2 should be visible

            visibleImages.forEach(img => {
                expect(prefetch.state.preloadQueue.some(item => item.src === img.src)).toBe(true);
            });
        });

        test('should handle dynamic image addition', () => {
            prefetch.init(galleryContainer);

            const newImage = document.createElement('div');
            newImage.className = 'gallery-item';
            newImage.setAttribute('data-gallery-image', '');
            newImage.innerHTML = '<img src="dynamic-image.jpg" alt="Dynamic" />';
            galleryContainer.querySelector('.gallery-grid').appendChild(newImage);

            prefetch.observeNewImages();

            const dynamicImg = newImage.querySelector('img');
            expect(prefetch.observedImages.has(dynamicImg)).toBe(true);
        });

        test('should clean up preload queue on destroy', () => {
            prefetch.init(galleryContainer);

            expect(prefetch.state.preloadQueue.length).toBeGreaterThan(0);

            prefetch.destroy();

            expect(prefetch.state.preloadQueue.length).toBe(0);
            expect(prefetch.observedImages.size).toBe(0);
        });

        test('should provide preload statistics', () => {
            prefetch.init(galleryContainer);

            const stats = prefetch.getStats();

            expect(stats).toHaveProperty('totalImages');
            expect(stats).toHaveProperty('preloadedImages');
            expect(stats).toHaveProperty('successRate');
            expect(stats).toHaveProperty('averageLoadTime');
        });
    });

    describe('Module Integration', () => {
        test('should work together with multiple modules', async () => {
            const lightbox = new GalleryLightbox();
            const masonry = new GalleryMasonry({ columns: 2 });
            const prefetch = new GalleryPrefetch();

            // Initialize all modules
            lightbox.init(galleryContainer);
            masonry.init(galleryContainer);
            prefetch.init(galleryContainer);

            await masonry.layout();

            // Test that they don't interfere with each other
            expect(lightbox.isInitialized).toBe(true);
            expect(masonry.isInitialized).toBe(true);
            expect(prefetch.isInitialized).toBe(true);

            // Test lightbox still works with masonry layout
            const firstImage = galleryContainer.querySelector('[data-gallery-image]');
            firstImage.click();

            await new Promise(resolve => setTimeout(resolve, 50));

            expect(lightbox.state.isOpen).toBe(true);

            // Cleanup
            lightbox.destroy();
            masonry.destroy();
            prefetch.destroy();
        });

        test('should handle module dependency resolution', () => {
            // Test that modules can be initialized in any order
            const modules = [
                new GalleryLightbox(),
                new GalleryMasonry(),
                new GalleryPrefetch()
            ];

            // Random initialization order
            const shuffled = modules.sort(() => Math.random() - 0.5);
            
            shuffled.forEach(module => {
                module.init(galleryContainer);
                expect(module.isInitialized).toBe(true);
            });

            // Cleanup
            modules.forEach(module => module.destroy());
        });
    });
});