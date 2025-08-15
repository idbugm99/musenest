/**
 * Interactive Tour System - Phase 8.4
 * Provides guided onboarding and contextual help for gallery management
 */

class InteractiveTourSystem {
  constructor() {
    this.tours = new Map();
    this.currentTour = null;
    this.currentStep = 0;
    this.isActive = false;
    this.userProgress = this.loadProgress();
    
    // Tour configuration
    this.config = {
      showDots: true,
      showProgress: true,
      allowSkip: true,
      highlightPadding: 8,
      animationDuration: 300,
      autoAdvanceDelay: null, // Set to milliseconds for auto-advance
      keyboardNavigation: true
    };
    
    this.init();
  }

  init() {
    this.createTourOverlay();
    this.setupEventListeners();
    this.registerDefaultTours();
    
    // Auto-start onboarding for new users
    if (this.shouldShowOnboarding()) {
      setTimeout(() => this.startTour('gallery-basics'), 1000);
    }
    
    console.log('Interactive Tour System initialized');
  }

  createTourOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'tour-overlay';
    overlay.className = 'tour-overlay';
    overlay.innerHTML = `
      <div class="tour-backdrop"></div>
      <div class="tour-spotlight"></div>
      <div class="tour-tooltip">
        <div class="tour-tooltip-header">
          <h6 class="tour-title"></h6>
          <div class="tour-progress"></div>
          <button class="tour-close" aria-label="Close tour">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="tour-tooltip-content">
          <div class="tour-description"></div>
          <div class="tour-media"></div>
        </div>
        <div class="tour-tooltip-footer">
          <div class="tour-navigation">
            <button class="tour-btn tour-btn-secondary tour-skip">Skip Tour</button>
            <div class="tour-step-controls">
              <button class="tour-btn tour-btn-outline tour-prev">Previous</button>
              <div class="tour-dots"></div>
              <button class="tour-btn tour-btn-primary tour-next">Next</button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    this.overlay = overlay;
    this.bindOverlayEvents();
  }

  bindOverlayEvents() {
    // Navigation buttons
    this.overlay.querySelector('.tour-close').addEventListener('click', () => this.endTour());
    this.overlay.querySelector('.tour-skip').addEventListener('click', () => this.skipTour());
    this.overlay.querySelector('.tour-prev').addEventListener('click', () => this.previousStep());
    this.overlay.querySelector('.tour-next').addEventListener('click', () => this.nextStep());
    
    // Prevent clicks on backdrop from closing (intentional)
    this.overlay.querySelector('.tour-backdrop').addEventListener('click', (e) => {
      e.preventDefault();
      // Gentle pulse animation to show interaction
      this.overlay.querySelector('.tour-tooltip').classList.add('pulse');
      setTimeout(() => {
        this.overlay.querySelector('.tour-tooltip').classList.remove('pulse');
      }, 300);
    });
  }

  setupEventListeners() {
    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (!this.isActive) return;
      
      if (this.config.keyboardNavigation) {
        switch (e.key) {
          case 'ArrowRight':
          case ' ':
            e.preventDefault();
            this.nextStep();
            break;
          case 'ArrowLeft':
            e.preventDefault();
            this.previousStep();
            break;
          case 'Escape':
            e.preventDefault();
            this.endTour();
            break;
        }
      }
    });

    // Window resize handling
    window.addEventListener('resize', () => {
      if (this.isActive) {
        this.updateSpotlight();
        this.updateTooltipPosition();
      }
    });

    // Tour trigger buttons
    document.addEventListener('click', (e) => {
      if (e.target.matches('[data-tour]')) {
        e.preventDefault();
        const tourId = e.target.getAttribute('data-tour');
        this.startTour(tourId);
      }
    });
  }

  registerDefaultTours() {
    // Gallery Basics Tour
    this.registerTour('gallery-basics', {
      title: 'Gallery Management Basics',
      description: 'Learn how to organize and manage your image gallery',
      steps: [
        {
          title: 'Welcome to Gallery Management',
          content: 'This tour will show you how to organize your images into beautiful gallery sections. Let\'s start!',
          element: null,
          position: 'center',
          media: {
            type: 'icon',
            content: 'fas fa-images'
          }
        },
        {
          title: 'Create New Sections',
          content: 'Use this form to create new gallery sections. Choose a title and layout that fits your content style.',
          element: '.card:has(#sec_title)',
          position: 'right',
          highlight: true,
          media: {
            type: 'tip',
            content: 'Try "Portfolio" or "Behind the Scenes" as section names!'
          }
        },
        {
          title: 'Drag & Drop Builder',
          content: 'The magic happens here! Click this button to open our revolutionary drag-and-drop interface.',
          element: 'button[onclick*="openDragDropGalleryBuilder"]',
          position: 'bottom',
          highlight: true,
          action: {
            type: 'pulse',
            duration: 2000
          }
        },
        {
          title: 'Your Gallery Sections',
          content: 'All your created sections appear here. You can search, edit, and organize them easily.',
          element: '#sections_list',
          position: 'left',
          highlight: true
        },
        {
          title: 'Need Help?',
          content: 'Click the help button anytime for quick assistance and advanced tips.',
          element: 'button[onclick*="showGalleryHelp"]',
          position: 'bottom',
          highlight: true,
          media: {
            type: 'tip',
            content: 'Keyboard shortcuts are available too! Press "?" to see them.'
          }
        }
      ]
    });

    // Drag & Drop Advanced Tour
    this.registerTour('drag-drop-advanced', {
      title: 'Drag & Drop Mastery',
      description: 'Master the advanced features of our drag-and-drop builder',
      steps: [
        {
          title: 'Advanced Drag & Drop Features',
          content: 'Let\'s explore the powerful features of the drag-and-drop builder.',
          element: null,
          position: 'center',
          media: {
            type: 'icon',
            content: 'fas fa-magic'
          }
        },
        {
          title: 'Bulk Selection',
          content: 'Select multiple images by holding Ctrl/Cmd and clicking, or use the "Select All" button.',
          element: '#dragDropSelectAll',
          position: 'bottom',
          highlight: true
        },
        {
          title: 'Smart Filtering',
          content: 'Use these filters to quickly find the images you need for your galleries.',
          element: '.row.g-2:has(#dragDropSearchInput)',
          position: 'bottom',
          highlight: true
        },
        {
          title: 'Visual Drop Zones',
          content: 'Drag images to these highlighted areas to add them to gallery sections.',
          element: '.gallery-drop-zone',
          position: 'left',
          highlight: true,
          waitForElement: true
        }
      ]
    });

    // Mobile-Specific Tour
    this.registerTour('mobile-gestures', {
      title: 'Mobile Gestures',
      description: 'Learn touch gestures for mobile gallery management',
      condition: () => window.MobileTouchHandler && MobileTouchHandler.isSupported(),
      steps: [
        {
          title: 'Mobile Touch Gestures',
          content: 'Your mobile device supports advanced touch gestures for gallery management!',
          element: null,
          position: 'center',
          media: {
            type: 'icon',
            content: 'fas fa-mobile-alt'
          }
        },
        {
          title: 'Long Press to Drag',
          content: 'On mobile, long press an image to start drag mode, then tap a gallery section to add it.',
          element: '.drag-image-tile',
          position: 'top',
          highlight: true,
          waitForElement: true
        },
        {
          title: 'Swipe Navigation',
          content: 'Swipe left or right in the image library to change pages quickly.',
          element: '#dragDropImageLibrary',
          position: 'top',
          highlight: true,
          waitForElement: true
        },
        {
          title: 'Pinch to Zoom',
          content: 'In the lightbox, pinch to zoom and double-tap for quick zoom control.',
          element: '#lightboxImageWrapper',
          position: 'bottom',
          highlight: true,
          waitForElement: true
        }
      ]
    });
  }

  registerTour(id, tourConfig) {
    this.tours.set(id, {
      id,
      ...tourConfig,
      steps: tourConfig.steps || []
    });
  }

  async startTour(tourId) {
    const tour = this.tours.get(tourId);
    if (!tour) {
      console.error(`Tour "${tourId}" not found`);
      return;
    }

    // Check condition if specified
    if (tour.condition && !tour.condition()) {
      console.log(`Tour "${tourId}" condition not met, skipping`);
      return;
    }

    // End any active tour
    if (this.isActive) {
      this.endTour();
    }

    this.currentTour = tour;
    this.currentStep = 0;
    this.isActive = true;

    // Show overlay
    this.overlay.style.display = 'block';
    this.overlay.classList.add('active');

    // Start first step
    await this.showStep(0);
    
    // Track tour start
    this.trackEvent('tour_started', { tourId });
  }

  async showStep(stepIndex) {
    const tour = this.currentTour;
    const step = tour.steps[stepIndex];
    
    if (!step) return;

    this.currentStep = stepIndex;

    // Wait for element if required
    if (step.waitForElement && step.element) {
      await this.waitForElement(step.element);
    }

    // Update spotlight and tooltip
    this.updateSpotlight(step.element, step.highlight);
    this.updateTooltipContent(step);
    this.updateTooltipPosition(step.element, step.position);
    this.updateNavigationState();

    // Execute step action if specified
    if (step.action) {
      this.executeStepAction(step.action, step.element);
    }

    // Auto-advance if configured
    if (this.config.autoAdvanceDelay && stepIndex < tour.steps.length - 1) {
      setTimeout(() => {
        if (this.isActive && this.currentStep === stepIndex) {
          this.nextStep();
        }
      }, this.config.autoAdvanceDelay);
    }
  }

  updateSpotlight(elementSelector, highlight = false) {
    const spotlight = this.overlay.querySelector('.tour-spotlight');
    
    if (!elementSelector) {
      // Center mode - no spotlight
      spotlight.style.display = 'none';
      return;
    }

    const element = document.querySelector(elementSelector);
    if (!element) {
      spotlight.style.display = 'none';
      return;
    }

    spotlight.style.display = 'block';
    
    const rect = element.getBoundingClientRect();
    const padding = this.config.highlightPadding;
    
    spotlight.style.top = `${rect.top - padding}px`;
    spotlight.style.left = `${rect.left - padding}px`;
    spotlight.style.width = `${rect.width + padding * 2}px`;
    spotlight.style.height = `${rect.height + padding * 2}px`;
    
    // Add highlight effect
    if (highlight) {
      spotlight.classList.add('highlight');
    } else {
      spotlight.classList.remove('highlight');
    }
  }

  updateTooltipContent(step) {
    const tooltip = this.overlay.querySelector('.tour-tooltip');
    const title = tooltip.querySelector('.tour-title');
    const description = tooltip.querySelector('.tour-description');
    const media = tooltip.querySelector('.tour-media');
    const progress = tooltip.querySelector('.tour-progress');

    title.textContent = step.title;
    description.innerHTML = step.content;

    // Update media content
    if (step.media) {
      media.style.display = 'block';
      switch (step.media.type) {
        case 'icon':
          media.innerHTML = `<div class="tour-media-icon"><i class="${step.media.content}"></i></div>`;
          break;
        case 'tip':
          media.innerHTML = `<div class="tour-media-tip"><i class="fas fa-lightbulb"></i> ${step.media.content}</div>`;
          break;
        case 'image':
          media.innerHTML = `<div class="tour-media-image"><img src="${step.media.content}" alt="Tour illustration" /></div>`;
          break;
        case 'video':
          media.innerHTML = `<div class="tour-media-video"><video src="${step.media.content}" autoplay muted loop></video></div>`;
          break;
      }
    } else {
      media.style.display = 'none';
    }

    // Update progress
    if (this.config.showProgress) {
      const current = this.currentStep + 1;
      const total = this.currentTour.steps.length;
      progress.innerHTML = `
        <div class="tour-progress-bar">
          <div class="tour-progress-fill" style="width: ${(current / total) * 100}%"></div>
        </div>
        <span class="tour-progress-text">${current} of ${total}</span>
      `;
    }
  }

  updateTooltipPosition(elementSelector, position = 'bottom') {
    const tooltip = this.overlay.querySelector('.tour-tooltip');
    
    if (!elementSelector || position === 'center') {
      // Center the tooltip
      tooltip.style.position = 'fixed';
      tooltip.style.top = '50%';
      tooltip.style.left = '50%';
      tooltip.style.transform = 'translate(-50%, -50%)';
      tooltip.classList.remove('position-top', 'position-bottom', 'position-left', 'position-right');
      tooltip.classList.add('position-center');
      return;
    }

    const element = document.querySelector(elementSelector);
    if (!element) return;

    const rect = element.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    };

    tooltip.classList.remove('position-top', 'position-bottom', 'position-left', 'position-right', 'position-center');
    tooltip.classList.add(`position-${position}`);

    let top, left;

    switch (position) {
      case 'top':
        top = rect.top - tooltipRect.height - 20;
        left = rect.left + rect.width / 2;
        break;
      case 'bottom':
        top = rect.bottom + 20;
        left = rect.left + rect.width / 2;
        break;
      case 'left':
        top = rect.top + rect.height / 2;
        left = rect.left - tooltipRect.width - 20;
        break;
      case 'right':
        top = rect.top + rect.height / 2;
        left = rect.right + 20;
        break;
    }

    // Ensure tooltip stays within viewport
    top = Math.max(20, Math.min(top, viewport.height - tooltipRect.height - 20));
    left = Math.max(20, Math.min(left, viewport.width - tooltipRect.width - 20));

    tooltip.style.position = 'fixed';
    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
    tooltip.style.transform = position === 'bottom' || position === 'top' ? 'translateX(-50%)' : 
                              position === 'left' || position === 'right' ? 'translateY(-50%)' : 'none';
  }

  updateNavigationState() {
    const prevBtn = this.overlay.querySelector('.tour-prev');
    const nextBtn = this.overlay.querySelector('.tour-next');
    const dots = this.overlay.querySelector('.tour-dots');
    const skipBtn = this.overlay.querySelector('.tour-skip');

    // Update button states
    prevBtn.disabled = this.currentStep === 0;
    
    const isLastStep = this.currentStep === this.currentTour.steps.length - 1;
    nextBtn.textContent = isLastStep ? 'Finish' : 'Next';
    nextBtn.className = isLastStep ? 'tour-btn tour-btn-success tour-next' : 'tour-btn tour-btn-primary tour-next';

    // Update dots
    if (this.config.showDots) {
      dots.innerHTML = '';
      for (let i = 0; i < this.currentTour.steps.length; i++) {
        const dot = document.createElement('button');
        dot.className = `tour-dot ${i === this.currentStep ? 'active' : ''}`;
        dot.setAttribute('aria-label', `Go to step ${i + 1}`);
        dot.addEventListener('click', () => this.goToStep(i));
        dots.appendChild(dot);
      }
    }

    // Show/hide skip button
    skipBtn.style.display = this.config.allowSkip ? 'block' : 'none';
  }

  executeStepAction(action, elementSelector) {
    const element = elementSelector ? document.querySelector(elementSelector) : null;
    
    switch (action.type) {
      case 'pulse':
        if (element) {
          element.classList.add('tour-pulse');
          setTimeout(() => {
            element.classList.remove('tour-pulse');
          }, action.duration || 1000);
        }
        break;
      case 'highlight':
        if (element) {
          element.classList.add('tour-highlight');
          setTimeout(() => {
            element.classList.remove('tour-highlight');
          }, action.duration || 2000);
        }
        break;
      case 'click':
        if (element && action.autoClick) {
          setTimeout(() => {
            element.click();
          }, action.delay || 500);
        }
        break;
    }
  }

  async waitForElement(selector, timeout = 5000) {
    return new Promise((resolve) => {
      if (document.querySelector(selector)) {
        resolve();
        return;
      }

      const observer = new MutationObserver(() => {
        if (document.querySelector(selector)) {
          observer.disconnect();
          resolve();
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      setTimeout(() => {
        observer.disconnect();
        resolve();
      }, timeout);
    });
  }

  nextStep() {
    if (this.currentStep < this.currentTour.steps.length - 1) {
      this.showStep(this.currentStep + 1);
    } else {
      this.completeTour();
    }
  }

  previousStep() {
    if (this.currentStep > 0) {
      this.showStep(this.currentStep - 1);
    }
  }

  goToStep(stepIndex) {
    if (stepIndex >= 0 && stepIndex < this.currentTour.steps.length) {
      this.showStep(stepIndex);
    }
  }

  skipTour() {
    this.trackEvent('tour_skipped', { 
      tourId: this.currentTour.id,
      stepIndex: this.currentStep 
    });
    this.endTour();
  }

  completeTour() {
    if (this.currentTour) {
      this.markTourCompleted(this.currentTour.id);
      this.trackEvent('tour_completed', { tourId: this.currentTour.id });
    }
    this.endTour();
  }

  endTour() {
    if (!this.isActive) return;

    this.isActive = false;
    this.currentTour = null;
    this.currentStep = 0;

    // Animate out
    this.overlay.classList.remove('active');
    setTimeout(() => {
      this.overlay.style.display = 'none';
    }, this.config.animationDuration);

    // Clean up any highlighting
    document.querySelectorAll('.tour-pulse, .tour-highlight').forEach(el => {
      el.classList.remove('tour-pulse', 'tour-highlight');
    });
  }

  // Progress management
  shouldShowOnboarding() {
    return !this.userProgress.completedTours.has('gallery-basics') && 
           !this.userProgress.onboardingDismissed;
  }

  markTourCompleted(tourId) {
    this.userProgress.completedTours.add(tourId);
    this.userProgress.lastActivity = Date.now();
    this.saveProgress();
  }

  dismissOnboarding() {
    this.userProgress.onboardingDismissed = true;
    this.saveProgress();
  }

  loadProgress() {
    try {
      const saved = localStorage.getItem('gallery-tour-progress');
      if (saved) {
        const data = JSON.parse(saved);
        return {
          completedTours: new Set(data.completedTours || []),
          onboardingDismissed: data.onboardingDismissed || false,
          lastActivity: data.lastActivity || Date.now()
        };
      }
    } catch (error) {
      console.warn('Failed to load tour progress:', error);
    }

    return {
      completedTours: new Set(),
      onboardingDismissed: false,
      lastActivity: Date.now()
    };
  }

  saveProgress() {
    try {
      const data = {
        completedTours: Array.from(this.userProgress.completedTours),
        onboardingDismissed: this.userProgress.onboardingDismissed,
        lastActivity: this.userProgress.lastActivity
      };
      localStorage.setItem('gallery-tour-progress', JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save tour progress:', error);
    }
  }

  trackEvent(eventName, data = {}) {
    // Analytics integration point
    console.log('Tour Event:', eventName, data);
    
    // Could integrate with Google Analytics, Mixpanel, etc.
    if (window.gtag) {
      window.gtag('event', eventName, {
        event_category: 'tour_system',
        ...data
      });
    }
  }

  // Public API methods
  isTourCompleted(tourId) {
    return this.userProgress.completedTours.has(tourId);
  }

  showHelpForFeature(featureName) {
    // Quick contextual help
    const helpMap = {
      'drag-drop': 'drag-drop-advanced',
      'mobile': 'mobile-gestures',
      'basics': 'gallery-basics'
    };

    const tourId = helpMap[featureName];
    if (tourId) {
      this.startTour(tourId);
    }
  }
}

// Inject required CSS
const tourCSS = `
/* Interactive Tour System Styles */
.tour-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10000;
  display: none;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.tour-overlay.active {
  display: block;
  animation: tourFadeIn 0.3s ease;
}

.tour-backdrop {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(2px);
}

.tour-spotlight {
  position: absolute;
  background: transparent;
  border: 3px solid #007bff;
  border-radius: 8px;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.75);
  transition: all 0.3s ease;
  pointer-events: none;
  display: none;
}

.tour-spotlight.highlight {
  border-color: #28a745;
  animation: tourSpotlightPulse 2s infinite;
}

.tour-tooltip {
  position: fixed;
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  max-width: 400px;
  min-width: 300px;
  z-index: 10001;
  animation: tourTooltipSlideIn 0.3s ease;
}

.tour-tooltip.pulse {
  animation: tourTooltipPulse 0.3s ease;
}

.tour-tooltip-header {
  padding: 1rem 1rem 0.5rem;
  border-bottom: 1px solid #e9ecef;
  position: relative;
}

.tour-title {
  margin: 0;
  color: #212529;
  font-weight: 600;
  font-size: 1.1rem;
}

.tour-close {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  background: none;
  border: none;
  color: #6c757d;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.tour-close:hover {
  background: #f8f9fa;
  color: #495057;
}

.tour-progress {
  margin-top: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.tour-progress-bar {
  flex: 1;
  height: 4px;
  background: #e9ecef;
  border-radius: 2px;
  overflow: hidden;
}

.tour-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #007bff, #28a745);
  border-radius: 2px;
  transition: width 0.3s ease;
}

.tour-progress-text {
  font-size: 0.75rem;
  color: #6c757d;
  white-space: nowrap;
}

.tour-tooltip-content {
  padding: 1rem;
}

.tour-description {
  color: #495057;
  line-height: 1.5;
  margin-bottom: 1rem;
}

.tour-media {
  margin-top: 1rem;
  display: none;
}

.tour-media-icon {
  text-align: center;
  padding: 1rem;
  font-size: 2rem;
  color: #007bff;
}

.tour-media-tip {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 0.75rem;
  font-size: 0.9rem;
  color: #495057;
}

.tour-media-tip i {
  color: #ffc107;
  margin-right: 0.5rem;
}

.tour-media-image img,
.tour-media-video video {
  width: 100%;
  border-radius: 8px;
}

.tour-tooltip-footer {
  padding: 0.75rem 1rem 1rem;
  border-top: 1px solid #e9ecef;
}

.tour-navigation {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.tour-step-controls {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.tour-btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 80px;
}

.tour-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.tour-btn-primary {
  background: #007bff;
  color: white;
}

.tour-btn-primary:hover:not(:disabled) {
  background: #0056b3;
}

.tour-btn-success {
  background: #28a745;
  color: white;
}

.tour-btn-success:hover:not(:disabled) {
  background: #1e7e34;
}

.tour-btn-secondary {
  background: #6c757d;
  color: white;
}

.tour-btn-secondary:hover:not(:disabled) {
  background: #545b62;
}

.tour-btn-outline {
  background: transparent;
  color: #6c757d;
  border: 1px solid #dee2e6;
}

.tour-btn-outline:hover:not(:disabled) {
  background: #f8f9fa;
  border-color: #adb5bd;
}

.tour-dots {
  display: flex;
  gap: 0.5rem;
}

.tour-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: none;
  background: #dee2e6;
  cursor: pointer;
  transition: all 0.2s ease;
  padding: 0;
}

.tour-dot.active {
  background: #007bff;
  transform: scale(1.5);
}

.tour-dot:hover {
  background: #adb5bd;
}

/* Tour positioning classes */
.tour-tooltip.position-center {
  transform: translate(-50%, -50%) !important;
}

.tour-tooltip.position-top::before,
.tour-tooltip.position-bottom::before,
.tour-tooltip.position-left::before,
.tour-tooltip.position-right::before {
  content: '';
  position: absolute;
  width: 0;
  height: 0;
  border: 8px solid transparent;
}

.tour-tooltip.position-top::before {
  bottom: -16px;
  left: 50%;
  transform: translateX(-50%);
  border-top-color: white;
}

.tour-tooltip.position-bottom::before {
  top: -16px;
  left: 50%;
  transform: translateX(-50%);
  border-bottom-color: white;
}

.tour-tooltip.position-left::before {
  right: -16px;
  top: 50%;
  transform: translateY(-50%);
  border-left-color: white;
}

.tour-tooltip.position-right::before {
  left: -16px;
  top: 50%;
  transform: translateY(-50%);
  border-right-color: white;
}

/* Highlight effects */
.tour-pulse {
  animation: tourElementPulse 1s ease-in-out infinite !important;
}

.tour-highlight {
  box-shadow: 0 0 0 4px rgba(40, 167, 69, 0.3) !important;
  border-radius: 4px !important;
}

/* Animations */
@keyframes tourFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes tourTooltipSlideIn {
  from {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.9);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}

.tour-tooltip.position-top,
.tour-tooltip.position-bottom,
.tour-tooltip.position-left,
.tour-tooltip.position-right {
  animation: tourTooltipFadeIn 0.3s ease;
}

@keyframes tourTooltipFadeIn {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes tourTooltipPulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.02); }
}

@keyframes tourSpotlightPulse {
  0%, 100% { border-color: #28a745; box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.75); }
  50% { border-color: #20c997; box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.6), 0 0 20px rgba(40, 167, 69, 0.5); }
}

@keyframes tourElementPulse {
  0%, 100% { transform: scale(1); box-shadow: 0 0 0 rgba(0, 123, 255, 0.7); }
  50% { transform: scale(1.05); box-shadow: 0 0 20px rgba(0, 123, 255, 0.4); }
}

/* Responsive design */
@media (max-width: 768px) {
  .tour-tooltip {
    max-width: 90vw;
    min-width: 280px;
    margin: 1rem;
  }
  
  .tour-navigation {
    flex-direction: column;
    gap: 0.75rem;
    align-items: stretch;
  }
  
  .tour-step-controls {
    justify-content: space-between;
    width: 100%;
  }
  
  .tour-btn {
    min-width: 60px;
    padding: 0.625rem 0.75rem;
  }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .tour-backdrop {
    background: rgba(0, 0, 0, 0.9);
  }
  
  .tour-tooltip {
    border: 2px solid #000;
  }
  
  .tour-spotlight {
    border-width: 4px;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .tour-overlay,
  .tour-tooltip,
  .tour-spotlight,
  .tour-progress-fill,
  .tour-btn,
  .tour-dot {
    animation: none !important;
    transition: none !important;
  }
}
`;

// Inject CSS
const interactiveTourStyleSheet = document.createElement('style');
interactiveTourStyleSheet.textContent = tourCSS;
document.head.appendChild(interactiveTourStyleSheet);

// Auto-initialize
document.addEventListener('DOMContentLoaded', () => {
  window.interactiveTourSystem = new InteractiveTourSystem();
});

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = InteractiveTourSystem;
} else {
  window.InteractiveTourSystem = InteractiveTourSystem;
}