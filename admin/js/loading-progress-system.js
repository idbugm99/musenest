/**
 * Loading & Progress System - Phase 8.5
 * Advanced loading states and progress indicators
 */

class LoadingProgressSystem {
  constructor() {
    this.activeLoaders = new Map();
    this.progressTrackers = new Map();
    this.loadingStates = new Set();
    
    // Configuration
    this.config = {
      defaultDuration: 2000,
      minDisplayTime: 500,
      skeletonDelay: 300,
      progressUpdateInterval: 50,
      autoHideDelay: 1000,
      enableSkeletonScreens: true,
      enableProgressEstimation: true
    };
    
    this.init();
  }

  init() {
    this.setupGlobalLoadingInterceptors();
    this.createLoadingTemplates();
    this.registerProgressHandlers();
    this.startProgressLoop();
    
    console.log('Loading & Progress System initialized');
  }

  setupGlobalLoadingInterceptors() {
    // Intercept fetch requests for automatic loading states
    this.interceptFetch();
    
    // Intercept form submissions
    this.interceptFormSubmissions();
    
    // Intercept image loading
    this.interceptImageLoading();
    
    // Intercept modal loading
    this.interceptModalLoading();
  }

  interceptFetch() {
    const originalFetch = window.fetch;
    
    window.fetch = async (...args) => {
      const url = args[0];
      const options = args[1] || {};
      
      // Skip intercepting certain requests
      if (this.shouldSkipInterception(url)) {
        return originalFetch(...args);
      }
      
      const loadingId = this.generateLoadingId(url);
      const context = this.getRequestContext(url, options);
      
      try {
        // Show loading state
        this.showRequestLoading(loadingId, context);
        
        // Make the request
        const response = await originalFetch(...args);
        
        // Handle response
        if (response.ok) {
          this.showRequestSuccess(loadingId, context);
        } else {
          this.showRequestError(loadingId, context, `HTTP ${response.status}`);
        }
        
        return response;
      } catch (error) {
        this.showRequestError(loadingId, context, error.message);
        throw error;
      } finally {
        setTimeout(() => {
          this.hideRequestLoading(loadingId);
        }, this.config.autoHideDelay);
      }
    };
  }

  interceptFormSubmissions() {
    document.addEventListener('submit', (e) => {
      const form = e.target;
      if (form.tagName === 'FORM') {
        this.handleFormSubmission(form);
      }
    });
  }

  interceptImageLoading() {
    // Use Intersection Observer for lazy loading with progress
    const imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.handleImageLoading(entry.target);
          imageObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    // Observe all images with data-src
    document.querySelectorAll('img[data-src]').forEach(img => {
      imageObserver.observe(img);
    });

    // Handle dynamic images
    const mutationObserver = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1) {
            const images = node.querySelectorAll('img[data-src]');
            images.forEach(img => imageObserver.observe(img));
          }
        });
      });
    });

    mutationObserver.observe(document.body, { childList: true, subtree: true });
  }

  interceptModalLoading() {
    document.addEventListener('show.bs.modal', (e) => {
      this.handleModalLoading(e.target);
    });
  }

  // Request context analysis
  getRequestContext(url, options) {
    const context = {
      type: 'generic',
      element: null,
      message: 'Loading...',
      showProgress: false
    };

    // Gallery API requests
    if (url.includes('/api/model-gallery/')) {
      context.type = 'gallery';
      context.message = 'Loading gallery...';
      context.showProgress = true;
    }

    // Image upload requests
    if (options.method === 'POST' && url.includes('/upload')) {
      context.type = 'upload';
      context.message = 'Uploading...';
      context.showProgress = true;
    }

    // Drag & drop requests
    if (url.includes('/sections/') && url.includes('/images/batch')) {
      context.type = 'batch_operation';
      context.message = 'Moving images...';
      context.showProgress = true;
    }

    return context;
  }

  shouldSkipInterception(url) {
    const skipPatterns = [
      '/ping',
      '/health',
      '/metrics',
      'data:',
      'blob:'
    ];
    
    return skipPatterns.some(pattern => url.toString().includes(pattern));
  }

  generateLoadingId(url) {
    return `loading_${btoa(url.toString()).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16)}`;
  }

  // Loading state management
  showRequestLoading(loadingId, context) {
    const element = this.findContextElement(context);
    
    if (element) {
      this.showElementLoading(element, loadingId, context);
    } else {
      this.showGlobalLoading(loadingId, context);
    }
  }

  showElementLoading(element, loadingId, context) {
    // Add loading class
    element.classList.add('loading-state');
    
    // Create loading overlay
    const overlay = this.createLoadingOverlay(context);
    overlay.setAttribute('data-loading-id', loadingId);
    
    // Position overlay
    element.style.position = 'relative';
    element.appendChild(overlay);
    
    // Track loading state
    this.activeLoaders.set(loadingId, {
      element,
      overlay,
      context,
      startTime: Date.now()
    });

    // Show skeleton if appropriate
    if (this.config.enableSkeletonScreens && context.type === 'gallery') {
      setTimeout(() => {
        this.showSkeleton(element, context);
      }, this.config.skeletonDelay);
    }
  }

  showGlobalLoading(loadingId, context) {
    const loader = this.createGlobalLoader(context);
    loader.setAttribute('data-loading-id', loadingId);
    
    document.body.appendChild(loader);
    
    requestAnimationFrame(() => {
      loader.classList.add('show');
    });

    this.activeLoaders.set(loadingId, {
      element: document.body,
      overlay: loader,
      context,
      startTime: Date.now()
    });
  }

  showRequestSuccess(loadingId, context) {
    const loader = this.activeLoaders.get(loadingId);
    if (!loader) return;

    // Update to success state
    const successOverlay = this.createSuccessOverlay(context);
    
    if (loader.overlay.parentNode) {
      loader.overlay.parentNode.replaceChild(successOverlay, loader.overlay);
    }
    
    // Auto-hide after delay
    setTimeout(() => {
      this.hideRequestLoading(loadingId);
    }, this.config.autoHideDelay);
  }

  showRequestError(loadingId, context, errorMessage) {
    const loader = this.activeLoaders.get(loadingId);
    if (!loader) return;

    // Update to error state
    const errorOverlay = this.createErrorOverlay(context, errorMessage);
    
    if (loader.overlay.parentNode) {
      loader.overlay.parentNode.replaceChild(errorOverlay, loader.overlay);
    }
    
    // Auto-hide after longer delay
    setTimeout(() => {
      this.hideRequestLoading(loadingId);
    }, this.config.autoHideDelay * 2);
  }

  hideRequestLoading(loadingId) {
    const loader = this.activeLoaders.get(loadingId);
    if (!loader) return;

    const elapsedTime = Date.now() - loader.startTime;
    const remainingTime = Math.max(0, this.config.minDisplayTime - elapsedTime);

    setTimeout(() => {
      // Remove loading class
      loader.element.classList.remove('loading-state');
      
      // Remove overlay
      if (loader.overlay.parentNode) {
        loader.overlay.classList.add('fade-out');
        setTimeout(() => {
          if (loader.overlay.parentNode) {
            loader.overlay.parentNode.removeChild(loader.overlay);
          }
        }, 300);
      }
      
      // Remove from tracking
      this.activeLoaders.delete(loadingId);
    }, remainingTime);
  }

  // Form submission handling
  handleFormSubmission(form) {
    const submitBtn = form.querySelector('button[type="submit"], .btn-primary');
    const formId = `form_${Date.now()}`;
    
    if (submitBtn) {
      this.showButtonLoading(submitBtn, formId);
      
      // Track form submission
      const originalOnSubmit = form.onsubmit;
      form.onsubmit = (e) => {
        if (originalOnSubmit) {
          const result = originalOnSubmit.call(form, e);
          if (result === false) {
            this.hideButtonLoading(submitBtn, formId);
            return false;
          }
        }
        return true;
      };
    }
  }

  showButtonLoading(button, loadingId) {
    const originalContent = button.innerHTML;
    const originalDisabled = button.disabled;
    
    button.innerHTML = `
      <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
      ${button.dataset.loadingText || 'Processing...'}
    `;
    button.disabled = true;
    button.classList.add('loading-button');
    
    this.activeLoaders.set(loadingId, {
      element: button,
      originalContent,
      originalDisabled,
      startTime: Date.now()
    });
  }

  hideButtonLoading(button, loadingId) {
    const loader = this.activeLoaders.get(loadingId);
    if (!loader) return;

    button.innerHTML = loader.originalContent;
    button.disabled = loader.originalDisabled;
    button.classList.remove('loading-button');
    
    this.activeLoaders.delete(loadingId);
  }

  // Image loading handling
  handleImageLoading(img) {
    const src = img.dataset.src;
    if (!src) return;

    const placeholder = this.createImagePlaceholder(img);
    img.parentNode.insertBefore(placeholder, img);
    img.style.display = 'none';

    // Load image
    const tempImg = new Image();
    tempImg.onload = () => {
      img.src = src;
      img.style.display = '';
      img.classList.add('image-fade-in');
      
      // Remove placeholder
      setTimeout(() => {
        if (placeholder.parentNode) {
          placeholder.parentNode.removeChild(placeholder);
        }
      }, 300);
    };
    
    tempImg.onerror = () => {
      const errorPlaceholder = this.createImageErrorPlaceholder(img);
      if (placeholder.parentNode) {
        placeholder.parentNode.replaceChild(errorPlaceholder, placeholder);
      }
    };
    
    tempImg.src = src;
  }

  // Modal loading handling
  handleModalLoading(modal) {
    const modalBody = modal.querySelector('.modal-body');
    if (!modalBody) return;

    // Show loading state
    const loader = this.createModalLoader();
    modalBody.appendChild(loader);
    
    // Remove loader when modal content is ready
    setTimeout(() => {
      if (loader.parentNode) {
        loader.classList.add('fade-out');
        setTimeout(() => {
          if (loader.parentNode) {
            loader.parentNode.removeChild(loader);
          }
        }, 300);
      }
    }, 1000);
  }

  // Template creators
  createLoadingOverlay(context) {
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    
    let content = `
      <div class="loading-content">
        <div class="spinner-ring"></div>
        <div class="loading-message">${context.message}</div>
    `;
    
    if (context.showProgress) {
      content += `
        <div class="progress-container">
          <div class="progress-bar-animated">
            <div class="progress-bar-fill" style="width: 0%"></div>
          </div>
          <div class="progress-text">0%</div>
        </div>
      `;
    }
    
    content += '</div>';
    overlay.innerHTML = content;
    
    // Animate progress if enabled
    if (context.showProgress) {
      this.animateProgress(overlay);
    }
    
    return overlay;
  }

  createSuccessOverlay(context) {
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay success-overlay';
    overlay.innerHTML = `
      <div class="loading-content">
        <div class="success-icon">
          <i class="fas fa-check-circle"></i>
        </div>
        <div class="success-message">
          ${context.type === 'upload' ? 'Upload complete!' : 
            context.type === 'batch_operation' ? 'Images moved successfully!' : 
            'Success!'}
        </div>
      </div>
    `;
    return overlay;
  }

  createErrorOverlay(context, errorMessage) {
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay error-overlay';
    overlay.innerHTML = `
      <div class="loading-content">
        <div class="error-icon">
          <i class="fas fa-exclamation-circle"></i>
        </div>
        <div class="error-message">
          ${errorMessage || 'Something went wrong'}
        </div>
        <button class="btn btn-sm btn-outline-light retry-btn">
          Retry
        </button>
      </div>
    `;
    
    // Add retry functionality
    overlay.querySelector('.retry-btn').addEventListener('click', () => {
      window.location.reload();
    });
    
    return overlay;
  }

  createGlobalLoader(context) {
    const loader = document.createElement('div');
    loader.className = 'global-loader';
    loader.innerHTML = `
      <div class="global-loader-content">
        <div class="spinner-ring large"></div>
        <div class="loader-message">${context.message}</div>
      </div>
    `;
    return loader;
  }

  createImagePlaceholder(img) {
    const placeholder = document.createElement('div');
    placeholder.className = 'image-placeholder skeleton';
    placeholder.style.width = img.getAttribute('width') || '100%';
    placeholder.style.height = img.getAttribute('height') || '200px';
    placeholder.style.borderRadius = getComputedStyle(img).borderRadius;
    return placeholder;
  }

  createImageErrorPlaceholder(img) {
    const placeholder = document.createElement('div');
    placeholder.className = 'image-error-placeholder';
    placeholder.style.width = img.getAttribute('width') || '100%';
    placeholder.style.height = img.getAttribute('height') || '200px';
    placeholder.innerHTML = `
      <div class="error-content">
        <i class="fas fa-image"></i>
        <span>Failed to load</span>
      </div>
    `;
    return placeholder;
  }

  createModalLoader() {
    const loader = document.createElement('div');
    loader.className = 'modal-loader';
    loader.innerHTML = `
      <div class="modal-loading-content">
        <div class="spinner-ring"></div>
        <div class="loading-text">Loading content...</div>
      </div>
    `;
    return loader;
  }

  showSkeleton(element, context) {
    if (!this.activeLoaders.has(context.id)) return; // Already hidden
    
    const skeleton = this.createSkeleton(context);
    element.appendChild(skeleton);
    
    setTimeout(() => {
      if (skeleton.parentNode) {
        skeleton.remove();
      }
    }, 5000); // Max skeleton time
  }

  createSkeleton(context) {
    const skeleton = document.createElement('div');
    skeleton.className = 'skeleton-container';
    
    let skeletonContent = '';
    
    switch (context.type) {
      case 'gallery':
        skeletonContent = this.createGallerySkeleton();
        break;
      case 'form':
        skeletonContent = this.createFormSkeleton();
        break;
      default:
        skeletonContent = this.createGenericSkeleton();
    }
    
    skeleton.innerHTML = skeletonContent;
    return skeleton;
  }

  createGallerySkeleton() {
    return `
      <div class="gallery-skeleton">
        ${Array.from({ length: 6 }, () => `
          <div class="skeleton-image-tile">
            <div class="skeleton skeleton-image"></div>
            <div class="skeleton skeleton-text short"></div>
          </div>
        `).join('')}
      </div>
    `;
  }

  createFormSkeleton() {
    return `
      <div class="form-skeleton">
        <div class="skeleton skeleton-text medium"></div>
        <div class="skeleton skeleton-text long"></div>
        <div class="skeleton skeleton-text short"></div>
      </div>
    `;
  }

  createGenericSkeleton() {
    return `
      <div class="generic-skeleton">
        <div class="skeleton skeleton-text long"></div>
        <div class="skeleton skeleton-text medium"></div>
        <div class="skeleton skeleton-text short"></div>
      </div>
    `;
  }

  // Progress animation
  animateProgress(overlay) {
    const progressBar = overlay.querySelector('.progress-bar-fill');
    const progressText = overlay.querySelector('.progress-text');
    
    if (!progressBar || !progressText) return;
    
    let progress = 0;
    const duration = this.config.defaultDuration;
    const increment = 100 / (duration / this.config.progressUpdateInterval);
    
    const updateProgress = () => {
      progress += increment * (Math.random() * 0.5 + 0.5); // Vary speed
      progress = Math.min(progress, 95); // Don't complete until real completion
      
      progressBar.style.width = `${progress}%`;
      progressText.textContent = `${Math.round(progress)}%`;
      
      if (progress < 95) {
        setTimeout(updateProgress, this.config.progressUpdateInterval);
      }
    };
    
    updateProgress();
  }

  completeProgress(loadingId) {
    const loader = this.activeLoaders.get(loadingId);
    if (!loader || !loader.overlay) return;
    
    const progressBar = loader.overlay.querySelector('.progress-bar-fill');
    const progressText = loader.overlay.querySelector('.progress-text');
    
    if (progressBar && progressText) {
      progressBar.style.width = '100%';
      progressText.textContent = '100%';
    }
  }

  findContextElement(context) {
    // Try to find the most appropriate element to show loading on
    if (context.type === 'gallery') {
      return document.querySelector('#sections_list');
    }
    
    if (context.type === 'batch_operation') {
      return document.querySelector('.drag-drop-gallery-builder');
    }
    
    return null;
  }

  registerProgressHandlers() {
    // Progress tracking for specific operations
    window.addEventListener('upload-progress', (e) => {
      this.updateUploadProgress(e.detail);
    });
    
    window.addEventListener('batch-operation-progress', (e) => {
      this.updateBatchProgress(e.detail);
    });
  }

  updateUploadProgress(data) {
    const { loadingId, progress, loaded, total } = data;
    const loader = this.activeLoaders.get(loadingId);
    
    if (loader && loader.overlay) {
      const progressBar = loader.overlay.querySelector('.progress-bar-fill');
      const progressText = loader.overlay.querySelector('.progress-text');
      
      if (progressBar && progressText) {
        progressBar.style.width = `${progress}%`;
        progressText.textContent = `${progress}% (${this.formatBytes(loaded)} / ${this.formatBytes(total)})`;
      }
    }
  }

  updateBatchProgress(data) {
    const { loadingId, completed, total } = data;
    const loader = this.activeLoaders.get(loadingId);
    
    if (loader && loader.overlay) {
      const progressText = loader.overlay.querySelector('.loading-message');
      if (progressText) {
        progressText.textContent = `Processing ${completed}/${total} items...`;
      }
    }
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  startProgressLoop() {
    // Continuous progress monitoring
    setInterval(() => {
      this.updateActiveLoaders();
    }, this.config.progressUpdateInterval);
  }

  updateActiveLoaders() {
    for (const [loadingId, loader] of this.activeLoaders) {
      const elapsed = Date.now() - loader.startTime;
      
      // Update estimated progress for indeterminate loaders
      if (this.config.enableProgressEstimation && loader.context.showProgress) {
        this.updateEstimatedProgress(loader, elapsed);
      }
    }
  }

  updateEstimatedProgress(loader, elapsed) {
    const progressBar = loader.overlay?.querySelector('.progress-bar-fill');
    if (!progressBar || progressBar.style.width === '100%') return;
    
    // Estimate progress based on elapsed time and context
    const estimatedDuration = this.getEstimatedDuration(loader.context.type);
    const estimatedProgress = Math.min(90, (elapsed / estimatedDuration) * 100);
    
    if (estimatedProgress > parseFloat(progressBar.style.width)) {
      progressBar.style.width = `${estimatedProgress}%`;
      
      const progressText = loader.overlay.querySelector('.progress-text');
      if (progressText) {
        progressText.textContent = `${Math.round(estimatedProgress)}%`;
      }
    }
  }

  getEstimatedDuration(type) {
    const durations = {
      gallery: 3000,
      upload: 5000,
      batch_operation: 4000,
      generic: 2000
    };
    
    return durations[type] || durations.generic;
  }

  createLoadingTemplates() {
    // Add CSS classes for loading states
    const style = document.createElement('style');
    style.textContent = `
      .image-fade-in {
        animation: fade-in 0.5s ease;
      }
      
      .loading-button {
        position: relative;
      }
      
      .global-loader {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(255, 255, 255, 0.9);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.3s ease;
      }
      
      .global-loader.show {
        opacity: 1;
      }
      
      .success-overlay {
        background: rgba(40, 167, 69, 0.1) !important;
        color: #28a745;
      }
      
      .error-overlay {
        background: rgba(220, 53, 69, 0.1) !important;
        color: #dc3545;
      }
    `;
    document.head.appendChild(style);
  }

  // Public API
  showLoading(element, options = {}) {
    const loadingId = this.generateLoadingId(Date.now().toString());
    const context = {
      type: options.type || 'generic',
      message: options.message || 'Loading...',
      showProgress: options.showProgress || false
    };
    
    this.showElementLoading(element, loadingId, context);
    return loadingId;
  }

  hideLoading(loadingId) {
    this.hideRequestLoading(loadingId);
  }

  showProgress(element, options = {}) {
    const progressBar = this.createProgressBar(options);
    element.appendChild(progressBar);
    return progressBar;
  }

  createProgressBar(options = {}) {
    const container = document.createElement('div');
    container.className = 'progress-container';
    container.innerHTML = `
      <div class="progress-bar-animated">
        <div class="progress-bar-fill" style="width: ${options.initialValue || 0}%"></div>
      </div>
      <div class="progress-text">${options.initialValue || 0}%</div>
    `;
    return container;
  }

  updateProgress(progressBar, value) {
    const fill = progressBar.querySelector('.progress-bar-fill');
    const text = progressBar.querySelector('.progress-text');
    
    if (fill && text) {
      fill.style.width = `${value}%`;
      text.textContent = `${value}%`;
    }
  }

  destroy() {
    // Clean up all active loaders
    for (const loadingId of this.activeLoaders.keys()) {
      this.hideRequestLoading(loadingId);
    }
  }
}

// Auto-initialize
document.addEventListener('DOMContentLoaded', () => {
  window.loadingProgressSystem = new LoadingProgressSystem();
});

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LoadingProgressSystem;
} else {
  window.LoadingProgressSystem = LoadingProgressSystem;
}