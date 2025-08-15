/**
 * Universal Gallery System - JavaScript Client
 * Handles dynamic gallery loading and rendering for all themes
 * Updated to work with synchronous Handlebars helpers
 */

// Global gallery initialization function
window.initializeUniversalGallery = async function(galleryId) {
    try {
        console.log(`🎨 Initializing universal gallery: ${galleryId}`);
        
        const container = document.getElementById(galleryId);
        if (!container) {
            console.error(`❌ Gallery container not found: ${galleryId}`);
            return;
        }
        
        // Get gallery configuration from data attributes
        const modelSlug = container.dataset.modelSlug;
        const previewTheme = container.dataset.previewTheme || null;
        const galleryOptions = JSON.parse(container.dataset.galleryOptions || '{}');
        
        if (!modelSlug) {
            throw new Error('Model slug not provided');
        }
        
        // Show loading state
        showLoadingState(container);
        
        // Load gallery configuration and data
        const galleryData = await loadGalleryData(modelSlug, previewTheme, galleryOptions);
        
        if (!galleryData || !galleryData.success) {
            throw new Error(galleryData?.error || 'Failed to load gallery data');
        }
        
        // Render the gallery
        await renderGallery(container, galleryData.data, galleryData.config);
        
        // Initialize gallery interactions
        initializeGalleryInteractions(container, galleryData.config);
        
        console.log(`✅ Universal gallery initialized: ${galleryId}`);
        
    } catch (error) {
        console.error(`❌ Failed to initialize gallery ${galleryId}:`, error);
        showErrorState(container, error.message);
    }
};

// Load gallery data from the server
async function loadGalleryData(modelSlug, previewTheme, options) {
    try {
        const params = new URLSearchParams({
            model: modelSlug,
            ...(previewTheme && { preview_theme: previewTheme }),
            ...options
        });
        
        const response = await fetch(`/api/universal-gallery/config?${params}`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data;
        
    } catch (error) {
        console.error('❌ Failed to load gallery data:', error);
        return { success: false, error: error.message };
    }
}

// Render gallery content with multiple sections
async function renderGallery(container, galleryData, galleryConfig) {
    try {
        // Clear loading state
        container.innerHTML = '';
        container.classList.remove('loading');
        
        // Apply theme-specific CSS variables
        applyGalleryStyles(container, galleryConfig);
        
        // Check if we have sections data
        if (!galleryData.sections || galleryData.sections.length === 0) {
            container.innerHTML = '<div class="no-gallery-sections">No gallery sections available.</div>';
            return;
        }
        
        let galleryHtml = '<div class="universal-gallery-sections">';
        
        // Render each section separately
        galleryData.sections.forEach((section, index) => {
            if (section.items && section.items.length > 0) {
                galleryHtml += `
                    <div class="gallery-section" data-section-id="${section.id}" data-layout="${section.layout}">
                        <div class="section-header">
                            <h3 class="section-title">${section.name}</h3>
                            ${section.description ? `<p class="section-description">${section.description}</p>` : ''}
                            <div class="section-meta">
                                <span class="item-count">${section.itemCount} items</span>
                                <span class="layout-type">${section.layout} layout</span>
                            </div>
                        </div>
                        <div class="section-content">
                            ${renderSectionLayout(section)}
                        </div>
                    </div>
                `;
            }
        });
        
        galleryHtml += '</div>';
        
        container.innerHTML = galleryHtml;
        
        // Initialize interactive features for each section
        initializeGallerySections(container, galleryData.sections, galleryConfig);
        
    } catch (error) {
        console.error('❌ Failed to render gallery:', error);
        container.innerHTML = `<div class="gallery-error">Failed to render gallery: ${error.message}</div>`;
    }
}

// Render individual section layout
function renderSectionLayout(section) {
    switch (section.layout) {
        case 'masonry':
            return renderMasonryLayout(section.items, section.layoutSettings);
        case 'grid':
            return renderGridLayout(section.items, section.layoutSettings);
        case 'carousel':
            return renderCarouselLayout(section.items, section.layoutSettings);
        case 'lightbox_grid':
            return renderLightboxGridLayout(section.items, section.layoutSettings);
        default:
            return renderMasonryLayout(section.items, section.layoutSettings); // Fallback to masonry
    }
}

// Initialize interactive features for gallery sections
function initializeGallerySections(container, sections, config) {
    sections.forEach(section => {
        const sectionElement = container.querySelector(`[data-section-id="${section.id}"]`);
        if (sectionElement) {
            // Initialize layout-specific features
            switch (section.layout) {
                case 'carousel':
                    initializeCarousel(sectionElement, section);
                    break;
                case 'masonry':
                    initializeMasonry(sectionElement, section);
                    break;
            }
            
            // Initialize lightbox for all sections
            if (config?.gallery_settings?.enable_lightbox !== false) {
                initializeLightbox(sectionElement, section.items, config);
            }
        }
    });
}

// Apply theme-specific CSS variables to gallery container
function applyGalleryStyles(container, config) {
    try {
        if (config.css_variables) {
            const root = document.documentElement;
            Object.entries(config.css_variables).forEach(([key, value]) => {
                const varName = `--gallery-${key.replace(/_/g, '-')}`;
                root.style.setProperty(varName, value);
            });
        }
    } catch (error) {
        console.warn('⚠️ Failed to apply gallery styles:', error);
    }
}

// Render masonry layout
function renderMasonryLayout(items, layoutSettings = {}) {
    if (!items || items.length === 0) {
        return renderEmptyState();
    }
    
    const columns = layoutSettings.columns || 3;
    const gap = layoutSettings.gap || '1.5rem';
    
    const itemsHtml = items.map(item => `
        <div class="gallery-grid-item masonry-item" data-id="${item.id}">
            <img src="${item.srcThumb || item.srcMed}" 
                 alt="${escapeHtml(item.alt)}" 
                 class="gallery-image"
                 loading="lazy"
                 onclick="openLightbox('${item.id}')"
                 style="aspect-ratio: ${item.aspect || 1};">
            ${item.caption ? `<div class="gallery-caption">${escapeHtml(item.caption)}</div>` : ''}
        </div>
    `).join('');
    
    return `
        <div class="universal-gallery">
            <div class="gallery-grid masonry-grid" style="--gallery-grid-columns-desktop: ${columns}; --gallery-grid-gap: ${gap};">
                ${itemsHtml}
            </div>
        </div>
    `;
}

// Render grid layout
function renderGridLayout(items, layoutSettings = {}) {
    if (!items || items.length === 0) {
        return renderEmptyState();
    }
    
    const columns = layoutSettings.columns || 4;
    const gap = layoutSettings.gap || '1.5rem';
    
    const itemsHtml = items.map(item => `
        <div class="gallery-grid-item grid-item" data-id="${item.id}">
            <div class="gallery-image-container">
                <img src="${item.srcThumb || item.srcMed}" 
                     alt="${escapeHtml(item.alt)}" 
                     class="gallery-image"
                     loading="lazy"
                     onclick="openLightbox('${item.id}')">
            </div>
            ${item.caption ? `<div class="gallery-caption">${escapeHtml(item.caption)}</div>` : ''}
        </div>
    `).join('');
    
    return `
        <div class="universal-gallery">
            <div class="gallery-grid-container" style="--gallery-grid-columns-desktop: ${columns}; --gallery-grid-gap: ${gap};">
                ${itemsHtml}
            </div>
        </div>
    `;
}

// Render carousel layout  
function renderCarouselLayout(items, layoutSettings = {}) {
    if (!items || items.length === 0) {
        return renderEmptyState();
    }
    
    const visibleItems = layoutSettings.visible_items || 1;
    const showDots = layoutSettings.show_dots !== false;
    const showArrows = layoutSettings.show_arrows !== false;
    
    const itemsHtml = items.map((item, index) => `
        <div class="gallery-carousel-item ${index === 0 ? 'active' : ''}" data-id="${item.id}">
            <div class="gallery-image-container">
                <img src="${item.srcMed || item.srcThumb}" 
                     alt="${escapeHtml(item.alt)}" 
                     class="gallery-image"
                     onclick="openLightbox('${item.id}')">
            </div>
            ${item.caption ? `<div class="gallery-caption">${escapeHtml(item.caption)}</div>` : ''}
        </div>
    `).join('');
    
    const dots = items.map((_, index) => `
        <button class="gallery-carousel-dot ${index === 0 ? 'active' : ''}" 
                onclick="goToSlide(${index})" aria-label="Go to slide ${index + 1}"></button>
    `).join('');
    
    // Calculate proper track width for carousel
    // For single-item carousels: track width = items * 100%
    // For multi-item carousels: track width = (items * 100%) / visibleItems
    const trackWidthPercent = visibleItems === 1 ? items.length * 100 : (items.length * 100) / visibleItems;
    
    return `
        <div class="universal-gallery">
            <div class="gallery-carousel-container">
                <div class="gallery-carousel-viewport">
                    <div class="gallery-carousel-track" style="transform: translateX(-0%);">
                        ${itemsHtml}
                    </div>
                </div>
                
                ${showArrows ? `
                <button class="gallery-carousel-nav prev" onclick="previousSlide()" aria-label="Previous image">‹</button>
                <button class="gallery-carousel-nav next" onclick="nextSlide()" aria-label="Next image">›</button>
                ` : ''}
                
                ${showDots ? `
                <div class="gallery-carousel-dots">
                    ${dots}
                </div>
                ` : ''}
            </div>
        </div>
    `;
}

// Render lightbox grid layout
function renderLightboxGridLayout(galleryData) {
    if (!galleryData.items || galleryData.items.length === 0) {
        return renderEmptyState();
    }
    
    const items = galleryData.items.map(item => `
        <div class="gallery-grid-item lightbox-thumbnail" data-id="${item.id}">
            <img src="${item.srcThumb}" 
                 alt="${escapeHtml(item.alt)}" 
                 class="gallery-thumbnail"
                 loading="lazy"
                 onclick="openLightbox('${item.id}')">
        </div>
    `).join('');
    
    return `
        <div class="universal-gallery">
            <div class="gallery-grid lightbox-grid">
                ${items}
            </div>
        </div>
    `;
}

// Render empty state
function renderEmptyState() {
    return `
        <div class="universal-gallery">
            <div class="gallery-empty-state text-center py-12">
                <div class="gallery-empty-icon text-6xl mb-4">📷</div>
                <h3 class="text-lg font-semibold text-gray-900 mb-2">No Images Available</h3>
                <p class="text-gray-600">This gallery doesn't have any images to display yet.</p>
            </div>
        </div>
    `;
}

// Initialize layout-specific functionality
async function initializeLayoutSpecific(container, layout, config) {
    try {
        switch (layout) {
            case 'masonry':
                await initializeMasonry(container);
                break;
            case 'carousel':
                initializeCarousel(container, config);
                break;
            case 'grid':
            case 'lightbox_grid':
                // Grid layouts don't need special initialization
                break;
        }
    } catch (error) {
        console.warn('⚠️ Failed to initialize layout-specific features:', error);
    }
}

// Initialize masonry layout
async function initializeMasonry(container) {
    // Simple CSS-based masonry fallback
    const masonryGrid = container.querySelector('.masonry-grid');
    if (masonryGrid) {
        masonryGrid.style.columnCount = 'var(--gallery-grid-columns-desktop, 3)';
        masonryGrid.style.columnGap = 'var(--gallery-grid-gap, 1.5rem)';
        masonryGrid.style.columnFill = 'balance';
        
        // Apply masonry item styles
        const items = masonryGrid.querySelectorAll('.masonry-item');
        items.forEach(item => {
            item.style.breakInside = 'avoid';
            item.style.marginBottom = 'var(--gallery-grid-gap, 1.5rem)';
            item.style.display = 'inline-block';
            item.style.width = '100%';
        });
    }
}

// Initialize carousel functionality
function initializeCarousel(container, section) {
    let currentSlide = 0;
    const carousel = container.querySelector('.gallery-carousel-container');
    const track = container.querySelector('.gallery-carousel-track');
    const items = container.querySelectorAll('.gallery-carousel-item');
    const dots = container.querySelectorAll('.gallery-carousel-dot');
    
    if (!carousel || !track || items.length === 0) return;
    
    // Get layout settings from database
    const layoutSettings = section.layoutSettings || {};
    const visibleItems = layoutSettings.visible_items || 1;
    const autoPlay = layoutSettings.auto_play || false;
    const autoPlaySpeed = layoutSettings.auto_play_speed || 3000;
    
    // Clean carousel navigation - no complex math needed
    const maxIndex = items.length - 1;
    
    // Initialize carousel at slide 0
    currentSlide = 0;
    
    // Simple navigation functions
    function goToSlide(index) {
        currentSlide = Math.max(0, Math.min(index, maxIndex));
        track.style.transform = `translateX(-${currentSlide * 100}%)`;
        
        // Update active states
        items.forEach((item, idx) => {
            item.classList.toggle('active', idx === currentSlide);
        });
        
        dots.forEach((dot, idx) => {
            dot.classList.toggle('active', idx === currentSlide);
        });
    }
    
    function nextSlide() { 
        goToSlide(currentSlide + 1); 
    }
    
    function previousSlide() { 
        goToSlide(currentSlide - 1); 
    }
    
    // Assign global functions
    window.nextSlide = nextSlide;
    window.previousSlide = previousSlide;
    window.goToSlide = goToSlide;
    
    // Auto-play functionality using database settings
    if (autoPlay) {
        setInterval(() => {
            if (!carousel.matches(':hover')) { // Pause on hover
                // Loop back to start when reaching the end
                if (currentSlide >= maxIndex) {
                    goToSlide(0);
                } else {
                    goToSlide(currentSlide + 1);
                }
            }
        }, autoPlaySpeed);
    }
    
    // Touch/swipe support
    let startX = 0;
    let isDragging = false;
    
    track.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        isDragging = true;
    });
    
    track.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        e.preventDefault();
    });
    
    track.addEventListener('touchend', (e) => {
        if (!isDragging) return;
        isDragging = false;
        
        const endX = e.changedTouches[0].clientX;
        const diff = startX - endX;
        
        if (Math.abs(diff) > 50) { // Minimum swipe distance
            if (diff > 0) {
                nextSlide();
            } else {
                previousSlide();
            }
        }
    });
    
    // Set initial carousel state
    goToSlide(0);
}

// Initialize lightbox functionality for a section
function initializeLightbox(sectionElement, items, config) {
    try {
        // Store items data globally for lightbox access
        if (!window.galleryLightboxData) {
            window.galleryLightboxData = {};
        }
        
        // Store items for this section
        items.forEach(item => {
            window.galleryLightboxData[item.id] = item;
        });
        
        console.log(`✅ Lightbox initialized for section with ${items.length} items`);
    } catch (error) {
        console.warn('⚠️ Failed to initialize lightbox:', error);
    }
}

// Initialize gallery interactions
function initializeGalleryInteractions(container, config) {
    // Global lightbox functionality
    window.openLightbox = function(imageId) {
        console.log(`Opening lightbox for image: ${imageId}`);
        
        const imageData = window.galleryLightboxData?.[imageId];
        if (!imageData) {
            console.error(`Image data not found for ID: ${imageId}`);
            return;
        }
        
        // Create simple lightbox overlay
        const lightboxOverlay = document.createElement('div');
        lightboxOverlay.className = 'gallery-lightbox-overlay';
        lightboxOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.9);
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
        `;
        
        const lightboxImage = document.createElement('img');
        lightboxImage.src = imageData.srcFull || imageData.srcMed;
        lightboxImage.alt = imageData.alt;
        lightboxImage.style.cssText = `
            max-width: 90%;
            max-height: 90%;
            object-fit: contain;
            border-radius: 8px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        `;
        
        // Close lightbox on overlay click
        lightboxOverlay.addEventListener('click', (e) => {
            if (e.target === lightboxOverlay) {
                document.body.removeChild(lightboxOverlay);
                document.body.style.overflow = '';
            }
        });
        
        // Close lightbox on Escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                document.body.removeChild(lightboxOverlay);
                document.body.style.overflow = '';
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
        
        lightboxOverlay.appendChild(lightboxImage);
        document.body.appendChild(lightboxOverlay);
        document.body.style.overflow = 'hidden';
    };
    
    // Keyboard navigation
    if (config?.accessibility?.keyboard_navigation !== false) {
        document.addEventListener('keydown', (e) => {
            if (container.contains(document.activeElement)) {
                switch (e.key) {
                    case 'ArrowLeft':
                        e.preventDefault();
                        if (typeof window.previousSlide === 'function') {
                            window.previousSlide();
                        }
                        break;
                    case 'ArrowRight':
                        e.preventDefault();
                        if (typeof window.nextSlide === 'function') {
                            window.nextSlide();
                        }
                        break;
                    case 'Escape':
                        e.preventDefault();
                        // Close lightbox or exit fullscreen
                        break;
                }
            }
        });
    }
}

// Utility functions
function showLoadingState(container) {
    container.classList.add('loading');
    const loadingState = container.querySelector('.gallery-loading-state');
    const errorState = container.querySelector('.gallery-error-state');
    
    if (loadingState) loadingState.classList.remove('hidden');
    if (errorState) errorState.classList.add('hidden');
}

function showErrorState(container, errorMessage) {
    container.classList.remove('loading');
    const loadingState = container.querySelector('.gallery-loading-state');
    const errorState = container.querySelector('.gallery-error-state');
    
    if (loadingState) loadingState.classList.add('hidden');
    if (errorState) {
        errorState.classList.remove('hidden');
        const errorText = errorState.querySelector('p');
        if (errorText && errorMessage) {
            errorText.textContent = errorMessage;
        }
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize all galleries on page load
document.addEventListener('DOMContentLoaded', function() {
    const galleries = document.querySelectorAll('.universal-gallery[id^="gallery-"]');
    galleries.forEach(gallery => {
        if (gallery.id) {
            initializeUniversalGallery(gallery.id);
        }
    });
});

console.log('🎨 Universal Gallery System JavaScript loaded');