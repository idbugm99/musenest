/**
 * Mobile Gallery Enhancements - Phase 8.3
 * Advanced mobile optimizations for gallery components
 */

class MobileGalleryEnhancements {
  constructor() {
    this.isMobile = MobileTouchHandler.isSupported();
    this.swipeThreshold = 50;
    this.isInitialized = false;
    
    if (this.isMobile) {
      this.init();
    }
  }

  init() {
    if (this.isInitialized) return;
    
    this.injectMobileStyles();
    this.setupMobileNavigation();
    this.optimizeMobilePerformance();
    this.setupMobileLightboxEnhancements();
    this.setupMobileDragDropEnhancements();
    
    this.isInitialized = true;
    console.log('Mobile Gallery Enhancements initialized');
  }

  injectMobileStyles() {
    const css = `
/* Mobile Gallery Enhancements */
@media (max-width: 768px) {
  /* Advanced Image Lightbox Mobile Optimizations */
  .modal-fullscreen .modal-content {
    overflow: hidden;
  }
  
  .modal-fullscreen .modal-header {
    padding: 0.5rem;
    flex-wrap: wrap;
    min-height: 60px;
  }
  
  .modal-fullscreen .modal-header .modal-title {
    font-size: 0.9rem;
    flex: 1;
    min-width: 0;
  }
  
  .modal-fullscreen .modal-header .badge {
    font-size: 0.7rem;
    order: 3;
    margin: 0.25rem 0;
  }
  
  .modal-fullscreen .modal-header .btn-group {
    order: 2;
    margin-right: 0.5rem;
  }
  
  .modal-fullscreen .modal-header .btn-close {
    order: 4;
    padding: 0.25rem;
    margin: 0;
  }

  /* Mobile Lightbox Controls */
  .lightbox-controls {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 1055;
    background: rgba(0, 0, 0, 0.9);
    backdrop-filter: blur(10px);
    padding: 0.75rem;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    transform: translateY(100%);
    transition: transform 0.3s ease;
  }
  
  .lightbox-controls.show {
    transform: translateY(0);
  }
  
  .lightbox-controls .btn-group {
    width: 100%;
    display: flex;
    justify-content: space-around;
  }
  
  .lightbox-controls .btn {
    flex: 1;
    margin: 0 2px;
    padding: 0.5rem 0.25rem;
    font-size: 0.85rem;
    border-radius: 8px;
  }
  
  .lightbox-controls .btn i {
    display: block;
    margin-bottom: 0.25rem;
    font-size: 1.1em;
  }

  /* Mobile Image Container */
  #lightboxImageWrapper {
    position: relative;
    height: calc(100vh - 120px);
    display: flex;
    align-items: center;
    justify-content: center;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
  }
  
  #lightboxMainImage {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    transition: transform 0.1s ease-out;
  }

  /* Mobile Navigation */
  .lightbox-nav-btn {
    position: fixed;
    top: 50%;
    transform: translateY(-50%);
    z-index: 1054;
    background: rgba(0, 0, 0, 0.7);
    border: none;
    color: white;
    width: 48px;
    height: 60px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.2rem;
    opacity: 0.7;
    transition: opacity 0.2s ease;
  }
  
  .lightbox-nav-btn:hover,
  .lightbox-nav-btn:active {
    opacity: 1;
    color: white;
  }
  
  .lightbox-nav-btn.prev {
    left: 10px;
  }
  
  .lightbox-nav-btn.next {
    right: 10px;
  }

  /* Mobile Info Panel */
  .lightbox-info-panel {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: rgba(0, 0, 0, 0.95);
    backdrop-filter: blur(15px);
    color: white;
    padding: 1rem;
    transform: translateY(100%);
    transition: transform 0.3s ease;
    z-index: 1053;
    max-height: 50vh;
    overflow-y: auto;
  }
  
  .lightbox-info-panel.show {
    transform: translateY(0);
  }
  
  .lightbox-info-panel h6 {
    color: #007bff;
    margin-bottom: 0.5rem;
    font-size: 0.85rem;
  }
  
  .lightbox-info-panel .form-control,
  .lightbox-info-panel .form-select {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: white;
    font-size: 0.85rem;
  }

  /* Mobile Context Menu */
  .mobile-context-menu {
    position: fixed;
    z-index: 3000;
    background: rgba(0, 0, 0, 0.95);
    backdrop-filter: blur(10px);
    border-radius: 16px;
    padding: 0.75rem;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    min-width: 200px;
    animation: contextMenuFadeIn 0.2s ease;
  }
  
  .context-menu-item {
    padding: 0.75rem 1rem;
    color: white;
    cursor: pointer;
    border-radius: 12px;
    transition: background 0.2s ease;
    font-size: 0.9rem;
    display: flex;
    align-items: center;
  }
  
  .context-menu-item:hover {
    background: rgba(255, 255, 255, 0.1);
  }
  
  .context-menu-item i {
    width: 20px;
    opacity: 0.8;
  }

  /* Drag Drop Gallery Builder Mobile */
  .modal-fullscreen .row {
    flex-direction: column;
    height: 100%;
  }
  
  .modal-fullscreen .col-md-8 {
    flex: 1;
    min-height: 0;
    order: 2;
  }
  
  .modal-fullscreen .col-md-4 {
    flex: 0 0 auto;
    height: 40vh;
    order: 1;
    overflow-y: auto;
  }
  
  .gallery-sections-container {
    height: 100%;
    overflow-y: auto;
    padding: 0.5rem;
  }
  
  .gallery-section-card {
    margin-bottom: 0.75rem;
  }
  
  .gallery-section-card .card-header {
    padding: 0.5rem 0.75rem;
    font-size: 0.85rem;
  }
  
  .gallery-drop-zone {
    min-height: 80px;
    padding: 0.75rem;
    margin: 0.5rem 0;
  }
  
  .drag-image-tile {
    margin-bottom: 8px;
    min-height: 44px;
    touch-action: manipulation;
  }
  
  .drag-image-tile .tile-image {
    width: 100%;
    height: 60px;
    object-fit: cover;
  }

  /* Mobile Swipe Indicators */
  .mobile-swipe-indicator {
    position: absolute;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.7);
    color: white;
    padding: 0.5rem 1rem;
    border-radius: 20px;
    font-size: 0.75rem;
    opacity: 0.8;
    pointer-events: none;
    z-index: 1052;
  }

  /* Performance Optimizations */
  .drag-image-tile,
  .gallery-drop-zone,
  #lightboxMainImage {
    will-change: transform;
  }
  
  .overflow-auto {
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
  }
  
  /* Accessibility improvements */
  .btn:focus,
  .form-control:focus,
  .form-select:focus {
    box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.5);
  }
  
  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .mobile-context-menu,
    .lightbox-controls,
    .lightbox-info-panel {
      background: rgba(0, 0, 0, 1);
      border: 1px solid white;
    }
  }
}

@keyframes contextMenuFadeIn {
  from {
    opacity: 0;
    transform: translate(-50%, -100%) scale(0.9);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -100%) scale(1);
  }
}

/* Touch feedback animations */
@keyframes touchPress {
  0% { transform: scale(1); }
  50% { transform: scale(0.95); }
  100% { transform: scale(1); }
}

.touch-press {
  animation: touchPress 0.1s ease;
}
`;

    const mobileGalleryStyleSheet = document.createElement('style');
    mobileGalleryStyleSheet.textContent = css;
    document.head.appendChild(mobileGalleryStyleSheet);
  }

  setupMobileNavigation() {
    // Swipe navigation for image galleries
    document.addEventListener('mobile-swipe', (e) => {
      const { direction, target, velocity } = e.detail;
      
      // Only handle fast swipes
      if (velocity < 0.5) return;
      
      // Lightbox navigation
      if (target.closest('#advancedImageLightbox') && window.advancedImageLightbox && window.advancedImageLightbox.modal._isShown) {
        if (direction === 'left') {
          window.advancedImageLightbox.nextImage();
        } else if (direction === 'right') {
          window.advancedImageLightbox.previousImage();
        }
        return;
      }
      
      // Drag-drop gallery navigation
      if (target.closest('#dragDropGalleryModal') && window.dragDropGalleryBuilder && window.dragDropGalleryBuilder.modal._isShown) {
        const library = target.closest('#dragDropImageLibrary');
        if (library && window.dragDropGalleryBuilder) {
          if (direction === 'left' && window.dragDropGalleryBuilder.currentPage < window.dragDropGalleryBuilder.totalPages) {
            window.dragDropGalleryBuilder.currentPage++;
            window.dragDropGalleryBuilder.loadImages();
          } else if (direction === 'right' && window.dragDropGalleryBuilder.currentPage > 1) {
            window.dragDropGalleryBuilder.currentPage--;
            window.dragDropGalleryBuilder.loadImages();
          }
        }
      }
    });
  }

  setupMobileLightboxEnhancements() {
    // Mobile lightbox UI management
    document.addEventListener('mobile-tap', (e) => {
      if (!window.advancedImageLightbox || !window.advancedImageLightbox.modal._isShown) return;
      
      const target = e.detail.target;
      const imageWrapper = target.closest('#lightboxImageWrapper');
      
      if (imageWrapper) {
        this.toggleMobileLightboxUI();
      }
    });

    // Double tap to zoom
    document.addEventListener('mobile-doubletap', (e) => {
      if (!window.advancedImageLightbox || !window.advancedImageLightbox.modal._isShown) return;
      
      const target = e.detail.target;
      const imageWrapper = target.closest('#lightboxImageWrapper');
      
      if (imageWrapper && window.advancedImageLightbox.zoomLevel === 1) {
        window.advancedImageLightbox.zoomIn(2);
      } else if (imageWrapper) {
        window.advancedImageLightbox.resetZoom();
      }
    });

    // Pinch to zoom support (if pinch events are available)
    document.addEventListener('mobile-pinchmove', (e) => {
      if (!window.advancedImageLightbox || !window.advancedImageLightbox.modal._isShown) return;
      
      const target = e.detail.target;
      if (target.closest('#lightboxImageWrapper')) {
        const { scale } = e.detail;
        const newZoom = Math.max(0.1, Math.min(5, scale));
        window.advancedImageLightbox.setZoom(newZoom);
      }
    });
  }

  setupMobileDragDropEnhancements() {
    // Enhanced mobile drag interactions
    document.addEventListener('mobile-longpress', (e) => {
      const target = e.detail.target;
      const tile = target.closest('.drag-image-tile');
      
      if (tile && window.dragDropGalleryBuilder && window.dragDropGalleryBuilder.modal._isShown) {
        // Add touch feedback
        tile.classList.add('touch-press');
        setTimeout(() => tile.classList.remove('touch-press'), 100);
        
        // Start mobile drag mode
        window.dragDropGalleryBuilder.startMobileDrag(tile);
      }
    });
  }

  optimizeMobilePerformance() {
    // Throttle scroll events for better performance
    let scrollTimeout;
    document.addEventListener('scroll', () => {
      if (scrollTimeout) return;
      
      scrollTimeout = setTimeout(() => {
        scrollTimeout = null;
      }, 16); // 60fps throttling
    }, { passive: true });

    // Optimize image loading for mobile
    const imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
            imageObserver.unobserve(img);
          }
        }
      });
    }, {
      rootMargin: '50px'
    });

    // Observe lazy-loaded images
    document.addEventListener('DOMContentLoaded', () => {
      document.querySelectorAll('img[data-src]').forEach(img => {
        imageObserver.observe(img);
      });
    });

    // Memory management for mobile
    window.addEventListener('beforeunload', () => {
      // Clean up touch handlers
      if (window.dragDropMobileHandler) {
        window.dragDropMobileHandler.destroy();
      }
    });
  }

  toggleMobileLightboxUI() {
    const controls = document.querySelector('.lightbox-controls');
    const info = document.querySelector('.lightbox-info-panel');
    const header = document.querySelector('#lightboxHeader');
    
    if (!controls || !info || !header) return;
    
    const isHidden = controls.style.display === 'none';
    
    if (isHidden) {
      controls.style.display = '';
      header.style.display = '';
      controls.classList.add('show');
      if (window.advancedImageLightbox && window.advancedImageLightbox.isInfoPanelVisible) {
        info.classList.add('show');
      }
    } else {
      controls.classList.remove('show');
      info.classList.remove('show');
      
      // Hide after animation
      setTimeout(() => {
        controls.style.display = 'none';
        header.style.display = 'none';
      }, 300);
    }
  }

  // Static method to check if mobile enhancements should be enabled
  static shouldEnable() {
    return MobileTouchHandler.isSupported();
  }
}

// Auto-initialize mobile enhancements
document.addEventListener('DOMContentLoaded', () => {
  if (MobileGalleryEnhancements.shouldEnable()) {
    window.mobileGalleryEnhancements = new MobileGalleryEnhancements();
  }
});

// Export for manual usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MobileGalleryEnhancements;
} else {
  window.MobileGalleryEnhancements = MobileGalleryEnhancements;
}