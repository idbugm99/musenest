/**
 * Visual Feedback System - Phase 8.5
 * Comprehensive micro-interactions and visual feedback for enhanced UX
 */

class VisualFeedbackSystem {
  constructor() {
    this.animations = new Map();
    this.feedbackQueue = [];
    this.isProcessingQueue = false;
    this.observers = new Map();
    
    // Configuration
    this.config = {
      animationDuration: 300,
      staggerDelay: 50,
      bounceIntensity: 0.1,
      enableSounds: false,
      respectMotionPreference: true,
      highContrastMode: false,
      debugMode: false
    };
    
    this.init();
  }

  init() {
    this.detectUserPreferences();
    this.setupGlobalObservers();
    this.registerMicroInteractions();
    this.createFeedbackElements();
    this.startAnimationLoop();
    
    console.log('Visual Feedback System initialized');
  }

  detectUserPreferences() {
    // Detect reduced motion preference
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.config.respectMotionPreference = true;
      this.config.animationDuration = 100; // Faster, less intrusive
    }
    
    // Detect high contrast preference
    if (window.matchMedia('(prefers-contrast: high)').matches) {
      this.config.highContrastMode = true;
    }
  }

  setupGlobalObservers() {
    // Intersection Observer for scroll animations
    this.setupScrollAnimations();
    
    // Mutation Observer for dynamic content
    this.setupDynamicContentObserver();
    
    // Performance Observer for smooth animations
    this.setupPerformanceMonitoring();
  }

  registerMicroInteractions() {
    // Button interactions
    this.registerButtonFeedback();
    
    // Form interactions
    this.registerFormFeedback();
    
    // Card interactions
    this.registerCardFeedback();
    
    // Image interactions
    this.registerImageFeedback();
    
    // Modal interactions
    this.registerModalFeedback();
    
    // Drag and drop interactions
    this.registerDragDropFeedback();
    
    // Navigation interactions
    this.registerNavigationFeedback();
  }

  registerButtonFeedback() {
    document.addEventListener('click', (e) => {
      const button = e.target.closest('button, .btn, [role="button"]');
      if (!button) return;
      
      // Skip if disabled
      if (button.disabled || button.classList.contains('disabled')) return;
      
      // Create ripple effect
      this.createRippleEffect(button, e);
      
      // Button press animation
      this.animateButtonPress(button);
      
      // Success feedback for specific button types
      if (button.classList.contains('btn-primary') || button.classList.contains('btn-success')) {
        this.scheduleSuccessFeedback(button, 200);
      }
    });

    // Hover effects
    document.addEventListener('mouseenter', (e) => {
      const button = e.target.closest('button, .btn, [role="button"]');
      if (button && !button.disabled) {
        this.animateButtonHover(button, true);
      }
    }, true);

    document.addEventListener('mouseleave', (e) => {
      const button = e.target.closest('button, .btn, [role="button"]');
      if (button && !button.disabled) {
        this.animateButtonHover(button, false);
      }
    }, true);
  }

  registerFormFeedback() {
    // Input focus/blur animations
    document.addEventListener('focusin', (e) => {
      if (e.target.matches('input, textarea, select')) {
        this.animateInputFocus(e.target, true);
      }
    });

    document.addEventListener('focusout', (e) => {
      if (e.target.matches('input, textarea, select')) {
        this.animateInputFocus(e.target, false);
      }
    });

    // Input validation feedback
    document.addEventListener('input', (e) => {
      if (e.target.matches('input, textarea')) {
        this.handleInputValidation(e.target);
      }
    });

    // Form submission feedback
    document.addEventListener('submit', (e) => {
      const form = e.target;
      this.animateFormSubmission(form);
    });
  }

  registerCardFeedback() {
    // Card hover and click animations
    document.addEventListener('mouseenter', (e) => {
      const card = e.target.closest('.card, .gallery-section-card, .drag-image-tile');
      if (card) {
        this.animateCardHover(card, true);
      }
    }, true);

    document.addEventListener('mouseleave', (e) => {
      const card = e.target.closest('.card, .gallery-section-card, .drag-image-tile');
      if (card) {
        this.animateCardHover(card, false);
      }
    }, true);

    document.addEventListener('click', (e) => {
      const card = e.target.closest('.card, .gallery-section-card');
      if (card) {
        this.animateCardClick(card);
      }
    });
  }

  registerImageFeedback() {
    // Image loading states
    document.addEventListener('load', (e) => {
      if (e.target.tagName === 'IMG') {
        this.animateImageLoad(e.target);
      }
    }, true);

    // Image selection feedback
    document.addEventListener('click', (e) => {
      const tile = e.target.closest('.drag-image-tile, .picker-image-tile');
      if (tile) {
        this.animateImageSelection(tile);
      }
    });

    // Image hover effects
    document.addEventListener('mouseenter', (e) => {
      const img = e.target.closest('img');
      if (img && img.closest('.drag-image-tile, .picker-image-tile')) {
        this.animateImageHover(img, true);
      }
    }, true);

    document.addEventListener('mouseleave', (e) => {
      const img = e.target.closest('img');
      if (img && img.closest('.drag-image-tile, .picker-image-tile')) {
        this.animateImageHover(img, false);
      }
    }, true);
  }

  registerModalFeedback() {
    // Modal animations
    document.addEventListener('show.bs.modal', (e) => {
      this.animateModalShow(e.target);
    });

    document.addEventListener('hide.bs.modal', (e) => {
      this.animateModalHide(e.target);
    });

    // Modal backdrop clicks
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal')) {
        this.animateModalBackdropClick(e.target);
      }
    });
  }

  registerDragDropFeedback() {
    // Drag start animations
    document.addEventListener('dragstart', (e) => {
      this.animateDragStart(e.target);
    });

    // Drop zone hover feedback
    document.addEventListener('dragenter', (e) => {
      const dropZone = e.target.closest('.gallery-drop-zone');
      if (dropZone) {
        this.animateDropZoneHover(dropZone, true);
      }
    });

    document.addEventListener('dragleave', (e) => {
      const dropZone = e.target.closest('.gallery-drop-zone');
      if (dropZone) {
        this.animateDropZoneHover(dropZone, false);
      }
    });

    // Drop success animation
    document.addEventListener('drop', (e) => {
      const dropZone = e.target.closest('.gallery-drop-zone');
      if (dropZone) {
        this.animateDropSuccess(dropZone);
      }
    });
  }

  registerNavigationFeedback() {
    // Page transitions
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[href]');
      if (link && !link.getAttribute('href').startsWith('#')) {
        this.animatePageTransition();
      }
    });

    // Tab switching
    document.addEventListener('click', (e) => {
      const tab = e.target.closest('[data-bs-toggle="tab"]');
      if (tab) {
        this.animateTabSwitch(tab);
      }
    });
  }

  // Animation implementations
  createRippleEffect(element, event) {
    if (!this.shouldAnimate()) return;

    const rect = element.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;

    const ripple = document.createElement('div');
    ripple.className = 'feedback-ripple';
    ripple.style.cssText = `
      position: absolute;
      width: ${size}px;
      height: ${size}px;
      left: ${x}px;
      top: ${y}px;
      background: rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      transform: scale(0);
      animation: ripple-expand ${this.config.animationDuration}ms ease-out;
      pointer-events: none;
      z-index: 1000;
    `;

    element.style.position = 'relative';
    element.style.overflow = 'hidden';
    element.appendChild(ripple);

    setTimeout(() => {
      if (ripple.parentNode) {
        ripple.parentNode.removeChild(ripple);
      }
    }, this.config.animationDuration);
  }

  animateButtonPress(button) {
    if (!this.shouldAnimate()) return;

    button.style.transform = 'scale(0.95)';
    button.style.transition = `transform ${this.config.animationDuration / 3}ms ease`;

    setTimeout(() => {
      button.style.transform = '';
      setTimeout(() => {
        button.style.transition = '';
      }, this.config.animationDuration);
    }, this.config.animationDuration / 3);
  }

  animateButtonHover(button, isHover) {
    if (!this.shouldAnimate()) return;

    if (isHover) {
      button.style.transform = 'translateY(-2px)';
      button.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
      button.style.transition = `all ${this.config.animationDuration}ms ease`;
    } else {
      button.style.transform = '';
      button.style.boxShadow = '';
    }
  }

  animateInputFocus(input, isFocused) {
    if (!this.shouldAnimate()) return;

    const parent = input.closest('.form-group, .mb-2, .mb-3') || input.parentNode;
    
    if (isFocused) {
      input.style.transform = 'scale(1.02)';
      input.style.boxShadow = '0 0 0 0.2rem rgba(0, 123, 255, 0.25)';
      parent.style.transform = 'translateY(-2px)';
    } else {
      input.style.transform = '';
      input.style.boxShadow = '';
      parent.style.transform = '';
    }

    input.style.transition = `all ${this.config.animationDuration}ms ease`;
    parent.style.transition = `transform ${this.config.animationDuration}ms ease`;
  }

  handleInputValidation(input) {
    if (!this.shouldAnimate()) return;

    const isValid = input.validity.valid;
    const hasValue = input.value.trim().length > 0;

    // Remove existing validation classes
    input.classList.remove('feedback-valid', 'feedback-invalid');

    if (hasValue) {
      if (isValid) {
        input.classList.add('feedback-valid');
        this.createValidationIcon(input, 'check');
      } else {
        input.classList.add('feedback-invalid');
        this.createValidationIcon(input, 'times');
        this.animateInputError(input);
      }
    }
  }

  createValidationIcon(input, iconType) {
    // Remove existing icon
    const existingIcon = input.parentNode.querySelector('.feedback-validation-icon');
    if (existingIcon) {
      existingIcon.remove();
    }

    const icon = document.createElement('div');
    icon.className = `feedback-validation-icon feedback-${iconType}`;
    icon.innerHTML = `<i class="fas fa-${iconType}"></i>`;

    const rect = input.getBoundingClientRect();
    const parentRect = input.parentNode.getBoundingClientRect();

    icon.style.cssText = `
      position: absolute;
      right: 12px;
      top: 50%;
      transform: translateY(-50%);
      color: ${iconType === 'check' ? '#28a745' : '#dc3545'};
      z-index: 10;
      animation: validation-icon-appear ${this.config.animationDuration}ms ease;
    `;

    input.parentNode.style.position = 'relative';
    input.parentNode.appendChild(icon);
  }

  animateInputError(input) {
    if (!this.shouldAnimate()) return;

    input.style.animation = `input-shake ${this.config.animationDuration}ms ease`;
    setTimeout(() => {
      input.style.animation = '';
    }, this.config.animationDuration);
  }

  animateFormSubmission(form) {
    if (!this.shouldAnimate()) return;

    const submitBtn = form.querySelector('button[type="submit"], .btn-primary');
    if (submitBtn) {
      this.showLoadingState(submitBtn);
    }
  }

  showLoadingState(button) {
    const originalText = button.textContent;
    const spinner = document.createElement('span');
    spinner.className = 'feedback-spinner';
    spinner.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    button.innerHTML = '';
    button.appendChild(spinner);
    button.appendChild(document.createTextNode(' Processing...'));
    button.disabled = true;

    // Store original state for restoration
    button.dataset.originalText = originalText;
  }

  hideLoadingState(button) {
    const originalText = button.dataset.originalText || 'Submit';
    button.innerHTML = originalText;
    button.disabled = false;
    delete button.dataset.originalText;
  }

  animateCardHover(card, isHover) {
    if (!this.shouldAnimate()) return;

    if (isHover) {
      card.style.transform = 'translateY(-4px) scale(1.02)';
      card.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.15)';
      card.style.transition = `all ${this.config.animationDuration}ms ease`;
      
      // Animate child elements
      const images = card.querySelectorAll('img');
      images.forEach(img => {
        img.style.transform = 'scale(1.05)';
        img.style.transition = `transform ${this.config.animationDuration}ms ease`;
      });
    } else {
      card.style.transform = '';
      card.style.boxShadow = '';
      
      const images = card.querySelectorAll('img');
      images.forEach(img => {
        img.style.transform = '';
      });
    }
  }

  animateCardClick(card) {
    if (!this.shouldAnimate()) return;

    card.style.transform = 'scale(0.98)';
    card.style.transition = `transform ${this.config.animationDuration / 2}ms ease`;

    setTimeout(() => {
      card.style.transform = '';
    }, this.config.animationDuration / 2);
  }

  animateImageLoad(img) {
    if (!this.shouldAnimate()) return;

    img.style.opacity = '0';
    img.style.transform = 'scale(1.1)';
    
    requestAnimationFrame(() => {
      img.style.opacity = '1';
      img.style.transform = 'scale(1)';
      img.style.transition = `all ${this.config.animationDuration}ms ease`;
    });
  }

  animateImageSelection(tile) {
    if (!this.shouldAnimate()) return;

    const isSelected = tile.classList.contains('selected');
    
    if (isSelected) {
      // Selection animation
      tile.style.transform = 'scale(1.05)';
      this.createSelectionBurst(tile);
    } else {
      // Deselection animation
      tile.style.transform = 'scale(0.95)';
    }

    tile.style.transition = `transform ${this.config.animationDuration}ms ease`;
    
    setTimeout(() => {
      tile.style.transform = '';
    }, this.config.animationDuration);
  }

  createSelectionBurst(element) {
    const burst = document.createElement('div');
    burst.className = 'feedback-selection-burst';
    
    const rect = element.getBoundingClientRect();
    burst.style.cssText = `
      position: fixed;
      top: ${rect.top + rect.height / 2}px;
      left: ${rect.left + rect.width / 2}px;
      width: 20px;
      height: 20px;
      background: #007bff;
      border-radius: 50%;
      transform: scale(0);
      animation: selection-burst ${this.config.animationDuration}ms ease-out;
      pointer-events: none;
      z-index: 9999;
    `;

    document.body.appendChild(burst);

    setTimeout(() => {
      if (burst.parentNode) {
        burst.parentNode.removeChild(burst);
      }
    }, this.config.animationDuration);
  }

  animateImageHover(img, isHover) {
    if (!this.shouldAnimate()) return;

    if (isHover) {
      img.style.filter = 'brightness(1.1) contrast(1.1)';
      img.style.transform = 'scale(1.05)';
    } else {
      img.style.filter = '';
      img.style.transform = '';
    }

    img.style.transition = `all ${this.config.animationDuration}ms ease`;
  }

  animateModalShow(modal) {
    if (!this.shouldAnimate()) return;

    modal.style.animation = `modal-slide-in ${this.config.animationDuration}ms ease-out`;
  }

  animateModalHide(modal) {
    if (!this.shouldAnimate()) return;

    modal.style.animation = `modal-slide-out ${this.config.animationDuration}ms ease-in`;
  }

  animateModalBackdropClick(modal) {
    if (!this.shouldAnimate()) return;

    const modalDialog = modal.querySelector('.modal-dialog');
    if (modalDialog) {
      modalDialog.style.animation = `modal-shake ${this.config.animationDuration}ms ease`;
      setTimeout(() => {
        modalDialog.style.animation = '';
      }, this.config.animationDuration);
    }
  }

  animateDragStart(element) {
    if (!this.shouldAnimate()) return;

    element.style.opacity = '0.7';
    element.style.transform = 'rotate(5deg) scale(1.1)';
    element.style.transition = `all ${this.config.animationDuration}ms ease`;
    element.classList.add('dragging');
  }

  animateDropZoneHover(dropZone, isHover) {
    if (!this.shouldAnimate()) return;

    if (isHover) {
      dropZone.style.background = 'rgba(0, 123, 255, 0.1)';
      dropZone.style.borderColor = '#007bff';
      dropZone.style.transform = 'scale(1.02)';
      dropZone.classList.add('drop-zone-active');
    } else {
      dropZone.style.background = '';
      dropZone.style.borderColor = '';
      dropZone.style.transform = '';
      dropZone.classList.remove('drop-zone-active');
    }

    dropZone.style.transition = `all ${this.config.animationDuration}ms ease`;
  }

  animateDropSuccess(dropZone) {
    if (!this.shouldAnimate()) return;

    dropZone.style.background = 'rgba(40, 167, 69, 0.2)';
    dropZone.style.borderColor = '#28a745';
    dropZone.style.transform = 'scale(1.05)';

    this.createSuccessIcon(dropZone);

    setTimeout(() => {
      dropZone.style.background = '';
      dropZone.style.borderColor = '';
      dropZone.style.transform = '';
    }, this.config.animationDuration * 2);
  }

  createSuccessIcon(element) {
    const icon = document.createElement('div');
    icon.className = 'feedback-success-icon';
    icon.innerHTML = '<i class="fas fa-check-circle"></i>';
    icon.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) scale(0);
      color: #28a745;
      font-size: 2rem;
      animation: success-icon-pop ${this.config.animationDuration * 2}ms ease;
      pointer-events: none;
      z-index: 1000;
    `;

    element.style.position = 'relative';
    element.appendChild(icon);

    setTimeout(() => {
      if (icon.parentNode) {
        icon.parentNode.removeChild(icon);
      }
    }, this.config.animationDuration * 2);
  }

  animatePageTransition() {
    if (!this.shouldAnimate()) return;

    document.body.style.opacity = '0.7';
    document.body.style.transform = 'scale(0.98)';
    document.body.style.transition = `all ${this.config.animationDuration}ms ease`;
  }

  animateTabSwitch(tab) {
    if (!this.shouldAnimate()) return;

    const targetId = tab.getAttribute('data-bs-target') || tab.getAttribute('href');
    const targetPane = document.querySelector(targetId);

    if (targetPane) {
      targetPane.style.animation = `tab-fade-in ${this.config.animationDuration}ms ease`;
    }
  }

  // Utility methods
  shouldAnimate() {
    return this.config.respectMotionPreference ? 
           !window.matchMedia('(prefers-reduced-motion: reduce)').matches : true;
  }

  scheduleSuccessFeedback(element, delay = 0) {
    setTimeout(() => {
      this.showSuccessFeedback(element);
    }, delay);
  }

  showSuccessFeedback(element) {
    if (!this.shouldAnimate()) return;

    element.style.background = '#28a745';
    element.style.transform = 'scale(1.05)';
    element.style.transition = `all ${this.config.animationDuration}ms ease`;

    setTimeout(() => {
      element.style.background = '';
      element.style.transform = '';
    }, this.config.animationDuration * 2);
  }

  showErrorFeedback(element, message = '') {
    if (!this.shouldAnimate()) return;

    element.style.background = '#dc3545';
    element.style.animation = `error-shake ${this.config.animationDuration}ms ease`;
    
    if (message) {
      this.showToastMessage(message, 'error');
    }

    setTimeout(() => {
      element.style.background = '';
      element.style.animation = '';
    }, this.config.animationDuration);
  }

  showToastMessage(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `feedback-toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-content">
        <i class="fas fa-${this.getToastIcon(type)}"></i>
        <span>${message}</span>
        <button class="toast-close">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `;

    toast.querySelector('.toast-close').addEventListener('click', () => {
      this.hideToast(toast);
    });

    this.showToast(toast);
  }

  getToastIcon(type) {
    const icons = {
      success: 'check-circle',
      error: 'exclamation-circle',
      warning: 'exclamation-triangle',
      info: 'info-circle'
    };
    return icons[type] || 'info-circle';
  }

  showToast(toast) {
    const container = this.getToastContainer();
    container.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    // Auto-hide after 5 seconds
    setTimeout(() => {
      this.hideToast(toast);
    }, 5000);
  }

  hideToast(toast) {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, this.config.animationDuration);
  }

  getToastContainer() {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    return container;
  }

  // Advanced animations
  createLoadingSpinner(element) {
    const spinner = document.createElement('div');
    spinner.className = 'feedback-loading-spinner';
    spinner.innerHTML = '<div class="spinner-ring"></div>';
    
    element.style.position = 'relative';
    element.appendChild(spinner);
    
    return spinner;
  }

  removeLoadingSpinner(spinner) {
    if (spinner && spinner.parentNode) {
      spinner.style.animation = `fade-out ${this.config.animationDuration}ms ease`;
      setTimeout(() => {
        if (spinner.parentNode) {
          spinner.parentNode.removeChild(spinner);
        }
      }, this.config.animationDuration);
    }
  }

  setupScrollAnimations() {
    if (!this.shouldAnimate()) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-in');
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    });

    // Observe elements that should animate on scroll
    document.querySelectorAll('.card, .gallery-section-card').forEach(el => {
      observer.observe(el);
    });

    this.observers.set('scroll', observer);
  }

  setupDynamicContentObserver() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1) { // Element node
            this.processNewElement(node);
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    this.observers.set('mutation', observer);
  }

  processNewElement(element) {
    // Add entrance animation to new elements
    if (this.shouldAnimate()) {
      element.style.opacity = '0';
      element.style.transform = 'translateY(20px)';
      
      requestAnimationFrame(() => {
        element.style.opacity = '1';
        element.style.transform = '';
        element.style.transition = `all ${this.config.animationDuration}ms ease`;
      });
    }

    // Observe for scroll animations
    const scrollObserver = this.observers.get('scroll');
    if (scrollObserver && element.matches('.card, .gallery-section-card')) {
      scrollObserver.observe(element);
    }
  }

  setupPerformanceMonitoring() {
    // Monitor frame rate and adjust animations accordingly
    let frameRate = 60;
    let lastTime = performance.now();
    let frameCount = 0;

    const checkPerformance = (currentTime) => {
      frameCount++;
      
      if (currentTime - lastTime >= 1000) {
        frameRate = frameCount;
        frameCount = 0;
        lastTime = currentTime;
        
        // Reduce animation complexity if frame rate is low
        if (frameRate < 30) {
          this.config.animationDuration = Math.max(100, this.config.animationDuration * 0.7);
        } else if (frameRate > 50) {
          this.config.animationDuration = Math.min(300, this.config.animationDuration * 1.1);
        }
      }
      
      requestAnimationFrame(checkPerformance);
    };

    requestAnimationFrame(checkPerformance);
  }

  createFeedbackElements() {
    // Create global styles
    this.injectFeedbackStyles();
    
    // Create toast container
    this.getToastContainer();
  }

  startAnimationLoop() {
    // Process feedback queue
    const processQueue = () => {
      if (this.feedbackQueue.length > 0 && !this.isProcessingQueue) {
        this.isProcessingQueue = true;
        
        const feedback = this.feedbackQueue.shift();
        this.executeFeedback(feedback);
        
        setTimeout(() => {
          this.isProcessingQueue = false;
        }, this.config.staggerDelay);
      }
      
      requestAnimationFrame(processQueue);
    };
    
    requestAnimationFrame(processQueue);
  }

  executeFeedback(feedback) {
    switch (feedback.type) {
      case 'success':
        this.showSuccessFeedback(feedback.element);
        break;
      case 'error':
        this.showErrorFeedback(feedback.element, feedback.message);
        break;
      case 'loading':
        this.showLoadingState(feedback.element);
        break;
      default:
        console.warn('Unknown feedback type:', feedback.type);
    }
  }

  // Public API
  queueFeedback(type, element, message = '') {
    this.feedbackQueue.push({ type, element, message });
  }

  triggerSuccessFeedback(element) {
    this.queueFeedback('success', element);
  }

  triggerErrorFeedback(element, message = '') {
    this.queueFeedback('error', element, message);
  }

  triggerLoadingFeedback(element) {
    this.queueFeedback('loading', element);
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }

  destroy() {
    // Clean up observers
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();
    
    // Remove feedback elements
    const container = document.getElementById('toast-container');
    if (container) container.remove();
  }

  injectFeedbackStyles() {
    const css = `
      /* Feedback system styles will be injected separately */
      .feedback-ripple { pointer-events: none; }
      .feedback-valid { border-color: #28a745 !important; }
      .feedback-invalid { border-color: #dc3545 !important; }
      .animate-in { 
        animation: animate-in 0.6s ease-out; 
        animation-fill-mode: both;
      }
    `;
    
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }
}

// Auto-initialize
document.addEventListener('DOMContentLoaded', () => {
  window.visualFeedbackSystem = new VisualFeedbackSystem();
});

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VisualFeedbackSystem;
} else {
  window.VisualFeedbackSystem = VisualFeedbackSystem;
}