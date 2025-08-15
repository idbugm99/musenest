/**
 * Progressive Disclosure System - Phase 8.4
 * Gradually reveals advanced features based on user proficiency and context
 */

class ProgressiveDisclosureSystem {
  constructor() {
    this.userProfile = this.loadUserProfile();
    this.disclosureRules = new Map();
    this.activeDisclosures = new Set();
    this.features = new Map();
    
    // Configuration
    this.config = {
      proficiencyLevels: ['beginner', 'intermediate', 'advanced', 'expert'],
      adaptiveThreshold: 3, // Actions before considering feature mastery
      contextualRevealing: true,
      animationDuration: 300,
      hintPersistence: 7 // Days to keep showing hints
    };
    
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.registerDefaultFeatures();
    this.evaluateDisclosures();
    this.startAdaptiveLearning();
    
    console.log('Progressive Disclosure System initialized');
    console.log('User proficiency level:', this.userProfile.level);
  }

  setupEventListeners() {
    // Track user interactions for proficiency assessment
    document.addEventListener('click', (e) => {
      this.trackInteraction(e.target, 'click');
    });

    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        this.trackInteraction(e.target, 'keyboard_shortcut');
      }
    });

    // Modal events for context-aware disclosure
    document.addEventListener('show.bs.modal', (e) => {
      this.onModalOpened(e.target.id);
    });

    // Page visibility for timing-based disclosures
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.evaluateTimeBasedDisclosures();
      }
    });

    // Feature usage tracking
    window.addEventListener('gallery-feature-used', (e) => {
      this.onFeatureUsed(e.detail.feature, e.detail.context);
    });
  }

  registerDefaultFeatures() {
    // Advanced Drag & Drop Features
    this.registerFeature('bulk-operations', {
      title: 'Bulk Operations',
      description: 'Select multiple images and perform actions on all of them at once',
      element: '#dragDropSelectAll',
      revealCondition: {
        type: 'usage_count',
        feature: 'single_drag_drop',
        threshold: 3
      },
      proficiencyLevel: 'intermediate',
      category: 'efficiency',
      hint: {
        text: '💡 Select multiple images for bulk operations',
        persistent: true,
        position: 'bottom'
      }
    });

    // Keyboard Shortcuts
    this.registerFeature('keyboard-shortcuts', {
      title: 'Keyboard Shortcuts',
      description: 'Use keyboard shortcuts for faster gallery management',
      revealCondition: {
        type: 'time_spent',
        threshold: 300000 // 5 minutes
      },
      proficiencyLevel: 'intermediate',
      category: 'efficiency',
      hint: {
        text: '⌨️ Press "?" for keyboard shortcuts',
        persistent: false,
        duration: 10000
      }
    });

    // Advanced Filtering
    this.registerFeature('advanced-filters', {
      title: 'Advanced Filters',
      description: 'Fine-tune image selection with status and context filters',
      element: '#dragDropStatusFilter, #dragDropContextFilter',
      revealCondition: {
        type: 'image_count',
        threshold: 20
      },
      proficiencyLevel: 'intermediate',
      category: 'organization',
      enhancement: {
        type: 'highlight_on_hover',
        className: 'progressive-highlight'
      }
    });

    // Lightbox Advanced Controls
    this.registerFeature('lightbox-metadata', {
      title: 'Image Metadata Editing',
      description: 'Edit image captions, tags, and alt text directly in the lightbox',
      element: '.lightbox-info-panel',
      revealCondition: {
        type: 'feature_usage',
        feature: 'lightbox_opened',
        threshold: 5
      },
      proficiencyLevel: 'intermediate',
      category: 'content',
      enhancement: {
        type: 'pulse_hint',
        duration: 2000
      }
    });

    // Batch Processing
    this.registerFeature('batch-processing', {
      title: 'Batch Image Processing',
      description: 'Process multiple images simultaneously with batch operations',
      element: '[id*="batch"]',
      revealCondition: {
        type: 'selection_size',
        threshold: 5
      },
      proficiencyLevel: 'advanced',
      category: 'efficiency',
      tutorial: 'batch-operations-tour'
    });

    // Mobile Gestures (context-aware)
    this.registerFeature('mobile-gestures', {
      title: 'Touch Gestures',
      description: 'Use advanced touch gestures for mobile gallery management',
      revealCondition: {
        type: 'device_type',
        value: 'mobile'
      },
      proficiencyLevel: 'beginner',
      category: 'mobile',
      onReveal: () => this.showMobileGestureTutorial()
    });

    // Expert Features
    this.registerFeature('api-integration', {
      title: 'API Integration',
      description: 'Advanced developers can integrate with gallery APIs',
      revealCondition: {
        type: 'proficiency',
        level: 'expert'
      },
      proficiencyLevel: 'expert',
      category: 'development',
      documentation: '/docs/api/gallery-management'
    });

    // Context-specific features
    this.registerFeature('section-management', {
      title: 'Advanced Section Management',
      description: 'Reorder sections, bulk edit properties, and manage section templates',
      element: '#sections_list .card-header',
      revealCondition: {
        type: 'section_count',
        threshold: 3
      },
      proficiencyLevel: 'intermediate',
      category: 'organization',
      enhancement: {
        type: 'show_advanced_menu',
        menuItems: [
          { text: 'Reorder Sections', icon: 'fas fa-arrows-alt', action: 'reorderSections' },
          { text: 'Bulk Edit', icon: 'fas fa-edit', action: 'bulkEditSections' },
          { text: 'Export Template', icon: 'fas fa-download', action: 'exportTemplate' }
        ]
      }
    });
  }

  registerFeature(id, config) {
    this.features.set(id, {
      id,
      ...config,
      revealed: false,
      usageCount: this.userProfile.featureUsage[id] || 0,
      firstUsed: this.userProfile.featureFirstUsed[id] || null,
      lastUsed: this.userProfile.featureLastUsed[id] || null
    });
  }

  evaluateDisclosures() {
    for (const [featureId, feature] of this.features) {
      if (this.shouldRevealFeature(feature)) {
        this.revealFeature(featureId);
      }
    }
  }

  shouldRevealFeature(feature) {
    if (feature.revealed) return false;

    const condition = feature.revealCondition;
    if (!condition) return false;

    // Check proficiency level requirement
    const userLevelIndex = this.config.proficiencyLevels.indexOf(this.userProfile.level);
    const featureLevelIndex = this.config.proficiencyLevels.indexOf(feature.proficiencyLevel);
    
    if (userLevelIndex < featureLevelIndex) {
      return false; // User not ready for this feature level
    }

    switch (condition.type) {
      case 'usage_count':
        const relatedFeature = this.features.get(condition.feature);
        return relatedFeature && relatedFeature.usageCount >= condition.threshold;

      case 'time_spent':
        return this.userProfile.totalTimeSpent >= condition.threshold;

      case 'image_count':
        return this.getCurrentImageCount() >= condition.threshold;

      case 'feature_usage':
        const targetFeature = this.features.get(condition.feature);
        return targetFeature && targetFeature.usageCount >= condition.threshold;

      case 'selection_size':
        return this.getCurrentSelectionSize() >= condition.threshold;

      case 'device_type':
        return this.getDeviceType() === condition.value;

      case 'proficiency':
        return this.config.proficiencyLevels.indexOf(this.userProfile.level) >= 
               this.config.proficiencyLevels.indexOf(condition.level);

      case 'section_count':
        return this.getSectionCount() >= condition.threshold;

      case 'custom':
        return condition.evaluator ? condition.evaluator() : false;

      default:
        return false;
    }
  }

  revealFeature(featureId) {
    const feature = this.features.get(featureId);
    if (!feature || feature.revealed) return;

    feature.revealed = true;
    this.activeDisclosures.add(featureId);

    // Apply enhancement
    this.applyFeatureEnhancement(feature);

    // Show hint if configured
    if (feature.hint) {
      this.showFeatureHint(feature);
    }

    // Execute onReveal callback
    if (feature.onReveal) {
      feature.onReveal();
    }

    // Track revelation
    this.trackFeatureReveal(featureId);

    console.log(`Feature revealed: ${featureId} - ${feature.title}`);
  }

  applyFeatureEnhancement(feature) {
    if (!feature.enhancement || !feature.element) return;

    const elements = document.querySelectorAll(feature.element);
    if (elements.length === 0) return;

    switch (feature.enhancement.type) {
      case 'highlight_on_hover':
        elements.forEach(el => {
          el.classList.add('progressive-disclosure-enhanced');
          if (feature.enhancement.className) {
            el.classList.add(feature.enhancement.className);
          }
        });
        break;

      case 'pulse_hint':
        elements.forEach(el => {
          el.classList.add('progressive-pulse');
          setTimeout(() => {
            el.classList.remove('progressive-pulse');
          }, feature.enhancement.duration || 2000);
        });
        break;

      case 'show_advanced_menu':
        this.addAdvancedMenu(elements[0], feature);
        break;

      case 'badge_indicator':
        this.addFeatureBadge(elements[0], feature);
        break;

      case 'tutorial_trigger':
        this.addTutorialTrigger(elements[0], feature);
        break;
    }
  }

  showFeatureHint(feature) {
    if (!feature.hint || !feature.element) return;

    const elements = document.querySelectorAll(feature.element);
    if (elements.length === 0) return;

    const targetElement = elements[0];
    const hint = this.createHintElement(feature.hint);
    
    // Position hint relative to target
    this.positionHint(hint, targetElement, feature.hint.position || 'top');
    
    // Auto-hide if not persistent
    if (!feature.hint.persistent && feature.hint.duration) {
      setTimeout(() => {
        this.hideHint(hint);
      }, feature.hint.duration);
    }
  }

  createHintElement(hintConfig) {
    const hint = document.createElement('div');
    hint.className = 'progressive-hint';
    hint.innerHTML = `
      <div class="progressive-hint-content">
        <span class="progressive-hint-text">${hintConfig.text}</span>
        <button class="progressive-hint-close" aria-label="Dismiss hint">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="progressive-hint-arrow"></div>
    `;

    // Close functionality
    hint.querySelector('.progressive-hint-close').addEventListener('click', () => {
      this.hideHint(hint);
    });

    document.body.appendChild(hint);
    
    // Animate in
    requestAnimationFrame(() => {
      hint.classList.add('show');
    });

    return hint;
  }

  positionHint(hint, targetElement, position) {
    const targetRect = targetElement.getBoundingClientRect();
    const hintRect = hint.getBoundingClientRect();
    const arrow = hint.querySelector('.progressive-hint-arrow');

    let top, left;

    switch (position) {
      case 'top':
        top = targetRect.top - hintRect.height - 10;
        left = targetRect.left + targetRect.width / 2 - hintRect.width / 2;
        arrow.className = 'progressive-hint-arrow progressive-hint-arrow-bottom';
        break;
      case 'bottom':
        top = targetRect.bottom + 10;
        left = targetRect.left + targetRect.width / 2 - hintRect.width / 2;
        arrow.className = 'progressive-hint-arrow progressive-hint-arrow-top';
        break;
      case 'left':
        top = targetRect.top + targetRect.height / 2 - hintRect.height / 2;
        left = targetRect.left - hintRect.width - 10;
        arrow.className = 'progressive-hint-arrow progressive-hint-arrow-right';
        break;
      case 'right':
        top = targetRect.top + targetRect.height / 2 - hintRect.height / 2;
        left = targetRect.right + 10;
        arrow.className = 'progressive-hint-arrow progressive-hint-arrow-left';
        break;
    }

    // Ensure hint stays within viewport
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    };

    top = Math.max(10, Math.min(top, viewport.height - hintRect.height - 10));
    left = Math.max(10, Math.min(left, viewport.width - hintRect.width - 10));

    hint.style.position = 'fixed';
    hint.style.top = `${top}px`;
    hint.style.left = `${left}px`;
    hint.style.zIndex = '9998';
  }

  hideHint(hint) {
    hint.classList.remove('show');
    setTimeout(() => {
      if (hint.parentNode) {
        hint.parentNode.removeChild(hint);
      }
    }, 300);
  }

  addAdvancedMenu(element, feature) {
    const menu = document.createElement('div');
    menu.className = 'progressive-advanced-menu';
    menu.innerHTML = `
      <button class="progressive-menu-trigger" title="Advanced options">
        <i class="fas fa-ellipsis-h"></i>
      </button>
      <div class="progressive-menu-dropdown">
        ${feature.enhancement.menuItems.map(item => `
          <button class="progressive-menu-item" onclick="${item.action}()">
            <i class="${item.icon}"></i>
            <span>${item.text}</span>
          </button>
        `).join('')}
      </div>
    `;

    // Toggle functionality
    const trigger = menu.querySelector('.progressive-menu-trigger');
    const dropdown = menu.querySelector('.progressive-menu-dropdown');

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('show');
    });

    // Close on outside click
    document.addEventListener('click', () => {
      dropdown.classList.remove('show');
    });

    element.style.position = 'relative';
    element.appendChild(menu);
  }

  addFeatureBadge(element, feature) {
    const badge = document.createElement('span');
    badge.className = 'progressive-feature-badge';
    badge.textContent = 'NEW';
    badge.title = feature.description;

    element.style.position = 'relative';
    element.appendChild(badge);

    // Auto-remove after interaction
    const removeOnClick = () => {
      badge.remove();
      element.removeEventListener('click', removeOnClick);
    };
    element.addEventListener('click', removeOnClick);
  }

  trackInteraction(target, type) {
    // Analyze user interaction patterns for proficiency assessment
    const featureId = this.identifyFeatureFromElement(target);
    if (featureId) {
      this.onFeatureUsed(featureId, { type, timestamp: Date.now() });
    }

    // Update session time
    this.userProfile.totalTimeSpent = (this.userProfile.totalTimeSpent || 0) + 1;
    
    // Advanced interaction patterns indicate higher proficiency
    if (type === 'keyboard_shortcut') {
      this.userProfile.keyboardShortcutUsage = (this.userProfile.keyboardShortcutUsage || 0) + 1;
      this.assessProficiencyLevel();
    }
  }

  onFeatureUsed(featureId, context = {}) {
    const feature = this.features.get(featureId);
    if (!feature) return;

    feature.usageCount++;
    feature.lastUsed = Date.now();
    
    if (!feature.firstUsed) {
      feature.firstUsed = Date.now();
    }

    // Update user profile
    this.userProfile.featureUsage[featureId] = feature.usageCount;
    this.userProfile.featureFirstUsed[featureId] = feature.firstUsed;
    this.userProfile.featureLastUsed[featureId] = feature.lastUsed;

    // Trigger disclosure evaluation
    this.evaluateDisclosures();
    
    // Assess proficiency level changes
    this.assessProficiencyLevel();
    
    this.saveUserProfile();
  }

  assessProficiencyLevel() {
    const stats = this.calculateUsageStats();
    const currentLevelIndex = this.config.proficiencyLevels.indexOf(this.userProfile.level);
    
    let newLevel = this.userProfile.level;

    // Promotion criteria
    if (currentLevelIndex === 0 && stats.totalFeatures >= 3 && stats.averageUsage >= 2) {
      newLevel = 'intermediate';
    } else if (currentLevelIndex === 1 && stats.totalFeatures >= 6 && stats.keyboardShortcuts >= 3) {
      newLevel = 'advanced';
    } else if (currentLevelIndex === 2 && stats.totalFeatures >= 10 && stats.advancedFeatures >= 3) {
      newLevel = 'expert';
    }

    if (newLevel !== this.userProfile.level) {
      this.userProfile.level = newLevel;
      this.onProficiencyLevelChanged(newLevel);
      this.saveUserProfile();
    }
  }

  calculateUsageStats() {
    return {
      totalFeatures: Object.keys(this.userProfile.featureUsage).length,
      averageUsage: Object.values(this.userProfile.featureUsage).reduce((a, b) => a + b, 0) / 
                    Math.max(1, Object.keys(this.userProfile.featureUsage).length),
      keyboardShortcuts: this.userProfile.keyboardShortcutUsage || 0,
      advancedFeatures: Array.from(this.features.values())
        .filter(f => f.proficiencyLevel === 'advanced' && f.usageCount > 0).length
    };
  }

  onProficiencyLevelChanged(newLevel) {
    console.log(`User proficiency level upgraded to: ${newLevel}`);
    
    // Show congratulations and reveal new features
    this.showProficiencyUpgrade(newLevel);
    this.evaluateDisclosures();
  }

  showProficiencyUpgrade(level) {
    const messages = {
      intermediate: 'Great! You\'re getting comfortable with gallery management. New features unlocked!',
      advanced: 'Excellent! You\'re now an advanced user. Power features are now available!',
      expert: 'Outstanding! You\'ve mastered gallery management. Expert tools are now yours!'
    };

    const notification = document.createElement('div');
    notification.className = 'proficiency-upgrade-notification';
    notification.innerHTML = `
      <div class="upgrade-content">
        <div class="upgrade-icon">
          <i class="fas fa-trophy"></i>
        </div>
        <div class="upgrade-message">
          <h6>Level Up!</h6>
          <p>${messages[level]}</p>
        </div>
        <button class="upgrade-dismiss">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `;

    notification.querySelector('.upgrade-dismiss').addEventListener('click', () => {
      notification.remove();
    });

    document.body.appendChild(notification);

    // Auto-dismiss after 10 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 10000);
  }

  // Helper methods for condition evaluation
  getCurrentImageCount() {
    // Try to get from drag-drop builder
    if (window.dragDropGalleryBuilder && window.dragDropGalleryBuilder.images) {
      return window.dragDropGalleryBuilder.images.length;
    }
    
    // Fallback: count visible image tiles
    return document.querySelectorAll('.drag-image-tile, .picker-image-tile').length;
  }

  getCurrentSelectionSize() {
    if (window.dragDropGalleryBuilder && window.dragDropGalleryBuilder.selectedImages) {
      return window.dragDropGalleryBuilder.selectedImages.size;
    }
    
    return document.querySelectorAll('.drag-image-tile.selected, .picker-image-tile.selected').length;
  }

  getSectionCount() {
    return document.querySelectorAll('#sections_list .card').length;
  }

  getDeviceType() {
    if (window.MobileTouchHandler?.isSupported()) {
      return 'mobile';
    }
    return window.innerWidth <= 768 ? 'tablet' : 'desktop';
  }

  identifyFeatureFromElement(element) {
    // Map DOM elements to feature IDs
    if (element.matches('[onclick*="openDragDropGalleryBuilder"]')) return 'drag_drop_builder';
    if (element.matches('#dragDropSelectAll')) return 'bulk_operations';
    if (element.closest('.lightbox-info-panel')) return 'lightbox_metadata';
    if (element.matches('.drag-image-tile')) return 'single_drag_drop';
    if (element.closest('.advanced-image-lightbox')) return 'lightbox_opened';
    
    return null;
  }

  startAdaptiveLearning() {
    // Continuously adapt to user behavior
    setInterval(() => {
      this.evaluateDisclosures();
    }, 30000); // Every 30 seconds

    // Save profile periodically
    setInterval(() => {
      this.saveUserProfile();
    }, 60000); // Every minute
  }

  // Contextual methods
  onModalOpened(modalId) {
    // Context-aware disclosure when specific modals open
    if (modalId === 'dragDropGalleryModal') {
      this.evaluateContextualDisclosures('drag_drop_context');
    } else if (modalId === 'advancedImageLightbox') {
      this.evaluateContextualDisclosures('lightbox_context');
    }
  }

  evaluateContextualDisclosures(context) {
    // Show contextual hints based on current context
    for (const [featureId, feature] of this.features) {
      if (feature.context === context && !feature.revealed) {
        if (this.shouldRevealFeature(feature)) {
          this.revealFeature(featureId);
        }
      }
    }
  }

  evaluateTimeBasedDisclosures() {
    // Check for features that should be revealed based on time spent
    const sessionTime = Date.now() - (this.sessionStartTime || Date.now());
    
    for (const [featureId, feature] of this.features) {
      if (feature.revealCondition?.type === 'time_spent' && 
          sessionTime >= feature.revealCondition.threshold) {
        if (this.shouldRevealFeature(feature)) {
          this.revealFeature(featureId);
        }
      }
    }
  }

  // Mobile gesture tutorial
  showMobileGestureTutorial() {
    if (window.interactiveTourSystem) {
      window.interactiveTourSystem.startTour('mobile-gestures');
    }
  }

  // Data persistence
  loadUserProfile() {
    try {
      const saved = localStorage.getItem('progressive-disclosure-profile');
      if (saved) {
        const data = JSON.parse(saved);
        return {
          level: 'beginner',
          totalTimeSpent: 0,
          featureUsage: {},
          featureFirstUsed: {},
          featureLastUsed: {},
          keyboardShortcutUsage: 0,
          sessionCount: 0,
          ...data
        };
      }
    } catch (error) {
      console.warn('Failed to load user profile:', error);
    }

    return {
      level: 'beginner',
      totalTimeSpent: 0,
      featureUsage: {},
      featureFirstUsed: {},
      featureLastUsed: {},
      keyboardShortcutUsage: 0,
      sessionCount: 0
    };
  }

  saveUserProfile() {
    try {
      localStorage.setItem('progressive-disclosure-profile', JSON.stringify(this.userProfile));
    } catch (error) {
      console.warn('Failed to save user profile:', error);
    }
  }

  trackFeatureReveal(featureId) {
    // Analytics integration point
    console.log('Feature revealed:', featureId);
    
    if (window.gtag) {
      window.gtag('event', 'feature_revealed', {
        event_category: 'progressive_disclosure',
        feature_id: featureId,
        user_level: this.userProfile.level
      });
    }
  }

  // Public API
  manuallyRevealFeature(featureId) {
    this.revealFeature(featureId);
  }

  resetUserProfile() {
    this.userProfile = {
      level: 'beginner',
      totalTimeSpent: 0,
      featureUsage: {},
      featureFirstUsed: {},
      featureLastUsed: {},
      keyboardShortcutUsage: 0,
      sessionCount: 0
    };
    
    // Hide all revealed features
    for (const feature of this.features.values()) {
      feature.revealed = false;
    }
    
    this.activeDisclosures.clear();
    this.saveUserProfile();
    this.evaluateDisclosures();
  }

  getUserProficiencyLevel() {
    return this.userProfile.level;
  }

  getRevealedFeatures() {
    return Array.from(this.activeDisclosures);
  }
}

// Inject required CSS
const progressiveCSS = `
/* Progressive Disclosure System Styles */
.progressive-disclosure-enhanced {
  position: relative;
  transition: all 0.2s ease;
}

.progressive-disclosure-enhanced:hover {
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.3);
  border-radius: 4px;
}

.progressive-highlight:hover {
  background: rgba(0, 123, 255, 0.1) !important;
}

.progressive-pulse {
  animation: progressivePulse 2s ease-in-out 3;
}

@keyframes progressivePulse {
  0%, 100% { 
    transform: scale(1);
    box-shadow: 0 0 0 rgba(0, 123, 255, 0.7);
  }
  50% { 
    transform: scale(1.02);
    box-shadow: 0 0 20px rgba(0, 123, 255, 0.4);
  }
}

/* Progressive Hints */
.progressive-hint {
  position: fixed;
  z-index: 9998;
  background: #2c3e50;
  color: white;
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  opacity: 0;
  transform: translateY(-10px) scale(0.95);
  transition: all 0.3s ease;
  max-width: 280px;
  font-size: 0.85rem;
}

.progressive-hint.show {
  opacity: 1;
  transform: translateY(0) scale(1);
}

.progressive-hint-content {
  padding: 0.75rem 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.progressive-hint-text {
  flex: 1;
  margin-right: 0.5rem;
}

.progressive-hint-close {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 4px;
  transition: color 0.2s ease;
}

.progressive-hint-close:hover {
  color: white;
}

.progressive-hint-arrow {
  position: absolute;
  width: 0;
  height: 0;
  border: 8px solid transparent;
}

.progressive-hint-arrow-top {
  top: -16px;
  left: 50%;
  transform: translateX(-50%);
  border-bottom-color: #2c3e50;
}

.progressive-hint-arrow-bottom {
  bottom: -16px;
  left: 50%;
  transform: translateX(-50%);
  border-top-color: #2c3e50;
}

.progressive-hint-arrow-left {
  left: -16px;
  top: 50%;
  transform: translateY(-50%);
  border-right-color: #2c3e50;
}

.progressive-hint-arrow-right {
  right: -16px;
  top: 50%;
  transform: translateY(-50%);
  border-left-color: #2c3e50;
}

/* Advanced Menu */
.progressive-advanced-menu {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  z-index: 10;
}

.progressive-menu-trigger {
  background: rgba(0, 0, 0, 0.6);
  color: white;
  border: none;
  border-radius: 4px;
  padding: 0.375rem;
  cursor: pointer;
  transition: background-color 0.2s ease;
  opacity: 0.8;
}

.progressive-menu-trigger:hover {
  background: rgba(0, 0, 0, 0.8);
  opacity: 1;
}

.progressive-menu-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  background: white;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  min-width: 180px;
  opacity: 0;
  visibility: hidden;
  transform: translateY(-10px);
  transition: all 0.2s ease;
  z-index: 1000;
  margin-top: 0.25rem;
}

.progressive-menu-dropdown.show {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}

.progressive-menu-item {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 0.75rem 1rem;
  border: none;
  background: none;
  color: #495057;
  cursor: pointer;
  transition: background-color 0.2s ease;
  border-bottom: 1px solid #f8f9fa;
  font-size: 0.85rem;
}

.progressive-menu-item:hover {
  background: #f8f9fa;
  color: #212529;
}

.progressive-menu-item:last-child {
  border-bottom: none;
}

.progressive-menu-item i {
  margin-right: 0.75rem;
  width: 16px;
  color: #6c757d;
}

/* Feature Badge */
.progressive-feature-badge {
  position: absolute;
  top: -8px;
  right: -8px;
  background: #dc3545;
  color: white;
  font-size: 0.6rem;
  font-weight: bold;
  padding: 0.25rem 0.375rem;
  border-radius: 12px;
  z-index: 10;
  animation: featureBadgePulse 2s infinite;
}

@keyframes featureBadgePulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

/* Proficiency Upgrade Notification */
.proficiency-upgrade-notification {
  position: fixed;
  top: 2rem;
  right: 2rem;
  z-index: 9999;
  background: linear-gradient(135deg, #28a745, #20c997);
  color: white;
  border-radius: 12px;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.15);
  animation: upgradeSlideIn 0.5s ease-out;
  max-width: 320px;
}

.upgrade-content {
  padding: 1rem 1.25rem;
  display: flex;
  align-items: center;
  position: relative;
}

.upgrade-icon {
  font-size: 2rem;
  margin-right: 1rem;
  color: #ffd700;
}

.upgrade-message h6 {
  margin: 0 0 0.25rem 0;
  font-weight: 600;
  font-size: 1rem;
}

.upgrade-message p {
  margin: 0;
  font-size: 0.85rem;
  opacity: 0.9;
}

.upgrade-dismiss {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 4px;
  transition: color 0.2s ease;
}

.upgrade-dismiss:hover {
  color: white;
}

@keyframes upgradeSlideIn {
  from {
    opacity: 0;
    transform: translateX(100%);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* Responsive Design */
@media (max-width: 768px) {
  .progressive-hint {
    max-width: calc(100vw - 2rem);
    margin: 0 1rem;
  }
  
  .proficiency-upgrade-notification {
    top: 1rem;
    right: 1rem;
    left: 1rem;
    max-width: none;
  }
  
  .progressive-menu-dropdown {
    right: -1rem;
    min-width: 160px;
  }
}

/* High contrast mode */
@media (prefers-contrast: high) {
  .progressive-hint {
    background: #000;
    border: 2px solid #fff;
  }
  
  .progressive-advanced-menu .progressive-menu-trigger {
    background: #000;
    border: 1px solid #fff;
  }
  
  .progressive-menu-dropdown {
    border: 2px solid #000;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .progressive-disclosure-enhanced,
  .progressive-hint,
  .progressive-menu-dropdown,
  .progressive-pulse,
  .progressive-feature-badge {
    animation: none !important;
    transition: none !important;
  }
}
`;

// Inject CSS
const progressiveDisclosureStyleSheet = document.createElement('style');
progressiveDisclosureStyleSheet.textContent = progressiveCSS;
document.head.appendChild(progressiveDisclosureStyleSheet);

// Auto-initialize
document.addEventListener('DOMContentLoaded', () => {
  window.progressiveDisclosureSystem = new ProgressiveDisclosureSystem();
  
  // Track session start time
  window.progressiveDisclosureSystem.sessionStartTime = Date.now();
});

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProgressiveDisclosureSystem;
} else {
  window.ProgressiveDisclosureSystem = ProgressiveDisclosureSystem;
}