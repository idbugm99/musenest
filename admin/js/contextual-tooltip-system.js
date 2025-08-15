/**
 * Contextual Tooltip System - Phase 8.4
 * Provides smart, context-aware tooltips for advanced features
 */

class ContextualTooltipSystem {
  constructor() {
    this.tooltips = new Map();
    this.activeTooltip = null;
    this.showTimeout = null;
    this.hideTimeout = null;
    this.settings = this.loadSettings();
    
    // Configuration
    this.config = {
      showDelay: 800,        // Delay before showing tooltip
      hideDelay: 100,        // Delay before hiding tooltip
      maxWidth: 300,         // Maximum tooltip width
      fadeSpeed: 200,        // Animation speed
      smartPositioning: true, // Auto-adjust position
      persistentHints: true,  // Show hints for complex features
      learnMode: true,       // Adaptive showing based on usage
      keyboardTrigger: true  // Show on focus for keyboard navigation
    };
    
    this.init();
  }

  init() {
    this.createTooltipContainer();
    this.setupEventListeners();
    this.registerDefaultTooltips();
    this.startUsageTracking();
    
    console.log('Contextual Tooltip System initialized');
  }

  createTooltipContainer() {
    const container = document.createElement('div');
    container.id = 'contextual-tooltip-container';
    container.className = 'contextual-tooltip-container';
    container.innerHTML = `
      <div class="tooltip-content">
        <div class="tooltip-header">
          <h6 class="tooltip-title"></h6>
          <button class="tooltip-close" aria-label="Close tooltip">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="tooltip-body">
          <div class="tooltip-description"></div>
          <div class="tooltip-shortcuts"></div>
          <div class="tooltip-tips"></div>
        </div>
        <div class="tooltip-footer">
          <div class="tooltip-actions"></div>
          <div class="tooltip-controls">
            <button class="tooltip-disable-btn">Don't show again</button>
            <button class="tooltip-learn-more">Learn more</button>
          </div>
        </div>
      </div>
      <div class="tooltip-arrow"></div>
    `;
    
    document.body.appendChild(container);
    this.container = container;
    this.bindContainerEvents();
  }

  bindContainerEvents() {
    // Close button
    this.container.querySelector('.tooltip-close').addEventListener('click', () => {
      this.hideTooltip();
    });

    // Disable button
    this.container.querySelector('.tooltip-disable-btn').addEventListener('click', () => {
      this.disableTooltip();
    });

    // Learn more button
    this.container.querySelector('.tooltip-learn-more').addEventListener('click', () => {
      this.showLearnMore();
    });

    // Prevent tooltip from closing when clicked
    this.container.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (this.activeTooltip && !this.container.contains(e.target)) {
        this.hideTooltip();
      }
    });
  }

  setupEventListeners() {
    // Mouse events for hover tooltips
    document.addEventListener('mouseenter', (e) => {
      const target = e.target.closest('[data-tooltip]');
      if (target) {
        this.scheduleShow(target);
      }
    }, true);

    document.addEventListener('mouseleave', (e) => {
      const target = e.target.closest('[data-tooltip]');
      if (target && this.activeTooltip?.element === target) {
        this.scheduleHide();
      }
    }, true);

    // Keyboard events for accessibility
    document.addEventListener('focus', (e) => {
      const target = e.target.closest('[data-tooltip]');
      if (target && this.config.keyboardTrigger) {
        this.scheduleShow(target);
      }
    }, true);

    document.addEventListener('blur', (e) => {
      const target = e.target.closest('[data-tooltip]');
      if (target && this.activeTooltip?.element === target) {
        this.scheduleHide();
      }
    }, true);

    // Help key shortcut
    document.addEventListener('keydown', (e) => {
      if (e.key === '?' && !e.target.matches('input, textarea')) {
        e.preventDefault();
        this.showContextualHelp();
      }
    });

    // Escape to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.activeTooltip) {
        this.hideTooltip();
      }
    });

    // Dynamic content updates
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) { // Element node
            this.processDynamicContent(node);
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  registerDefaultTooltips() {
    // Drag & Drop Builder tooltips
    this.registerTooltip('[onclick*="openDragDropGalleryBuilder"]', {
      title: 'Drag & Drop Gallery Builder',
      description: 'Open the revolutionary drag-and-drop interface to quickly organize images into gallery sections.',
      shortcuts: [
        { key: 'Ctrl+D', action: 'Quick drag mode' },
        { key: 'Ctrl+A', action: 'Select all images' }
      ],
      tips: [
        'Hold Ctrl/Cmd to select multiple images',
        'Drag images directly to gallery sections',
        'Use filters to find specific images quickly'
      ],
      learnMore: 'drag-drop-advanced',
      category: 'gallery-management'
    });

    // Gallery sections tooltips
    this.registerTooltip('#sections_list .card', {
      title: 'Gallery Section',
      description: 'Each section represents a different part of your gallery with its own layout and images.',
      tips: [
        'Click to expand and view images',
        'Use the edit button to modify settings',
        'Drag images between sections'
      ],
      category: 'gallery-management',
      contextual: true
    });

    // Search functionality tooltips
    this.registerTooltip('#search_sections', {
      title: 'Search Sections',
      description: 'Quickly find specific gallery sections by typing part of their name.',
      shortcuts: [
        { key: 'Ctrl+F', action: 'Focus search' }
      ],
      tips: [
        'Search is case-insensitive',
        'Results update as you type'
      ],
      category: 'navigation'
    });

    // Section creation tooltips
    this.registerTooltip('#btn_create_section', {
      title: 'Create New Section',
      description: 'Add a new gallery section with a custom title and layout style.',
      tips: [
        'Choose descriptive names like "Portfolio" or "Behind the Scenes"',
        'Grid layout works best for most image types',
        'Masonry layout is perfect for images of different sizes'
      ],
      category: 'content-creation'
    });

    // Layout selector tooltips
    this.registerTooltip('#sec_layout', {
      title: 'Section Layout',
      description: 'Choose how images will be displayed in this section.',
      options: [
        { value: 'grid', description: 'Equal-sized image grid - best for uniform content' },
        { value: 'masonry', description: 'Pinterest-style layout - great for varied image sizes' },
        { value: 'carousel', description: 'Sliding carousel - perfect for featured content' },
        { value: 'lightbox_grid', description: 'Grid with built-in lightbox - ideal for portfolios' }
      ],
      category: 'layout'
    });

    // Help button tooltips
    this.registerTooltip('[onclick*="showGalleryHelp"]', {
      title: 'Gallery Help',
      description: 'Access comprehensive help, keyboard shortcuts, and advanced tips.',
      shortcuts: [
        { key: '?', action: 'Quick help' },
        { key: 'F1', action: 'Full help' }
      ],
      category: 'help'
    });

    // Mobile-specific tooltips
    if (window.MobileTouchHandler?.isSupported()) {
      this.registerTooltip('.drag-image-tile', {
        title: 'Mobile Image Tile',
        description: 'Use touch gestures to interact with images on mobile devices.',
        gestures: [
          { gesture: 'Long press', action: 'Start drag mode' },
          { gesture: 'Double tap', action: 'Open lightbox' },
          { gesture: 'Single tap', action: 'Select/deselect' }
        ],
        category: 'mobile',
        condition: () => window.innerWidth <= 768
      });
    }
  }

  registerTooltip(selector, config) {
    this.tooltips.set(selector, {
      selector,
      ...config,
      id: this.generateTooltipId(selector),
      usage: {
        shown: 0,
        dismissed: 0,
        learnMoreClicked: 0,
        lastShown: null
      }
    });
  }

  scheduleShow(element) {
    this.clearTimeouts();
    
    const tooltip = this.findTooltipForElement(element);
    if (!tooltip || this.isTooltipDisabled(tooltip)) return;

    // Check if we should show based on learning mode
    if (this.config.learnMode && !this.shouldShowTooltip(tooltip)) return;

    this.showTimeout = setTimeout(() => {
      this.showTooltip(element, tooltip);
    }, this.config.showDelay);
  }

  scheduleHide() {
    this.clearTimeouts();
    
    this.hideTimeout = setTimeout(() => {
      this.hideTooltip();
    }, this.config.hideDelay);
  }

  clearTimeouts() {
    if (this.showTimeout) {
      clearTimeout(this.showTimeout);
      this.showTimeout = null;
    }
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
  }

  showTooltip(element, tooltipConfig) {
    if (this.activeTooltip?.element === element) return;

    // Hide any existing tooltip
    this.hideTooltip();

    // Check condition if specified
    if (tooltipConfig.condition && !tooltipConfig.condition()) return;

    this.activeTooltip = {
      element,
      config: tooltipConfig
    };

    // Update content
    this.updateTooltipContent(tooltipConfig);
    
    // Position tooltip
    this.positionTooltip(element);
    
    // Show tooltip
    this.container.style.display = 'block';
    this.container.classList.add('show');
    
    // Track usage
    tooltipConfig.usage.shown++;
    tooltipConfig.usage.lastShown = Date.now();
    
    // Auto-hide for simple tooltips
    if (tooltipConfig.autoHide) {
      setTimeout(() => this.hideTooltip(), tooltipConfig.autoHide);
    }
  }

  hideTooltip() {
    if (!this.activeTooltip) return;

    this.clearTimeouts();
    this.container.classList.remove('show');
    
    setTimeout(() => {
      this.container.style.display = 'none';
      this.activeTooltip = null;
    }, this.config.fadeSpeed);
  }

  updateTooltipContent(config) {
    const container = this.container;
    
    // Title
    container.querySelector('.tooltip-title').textContent = config.title;
    
    // Description
    container.querySelector('.tooltip-description').innerHTML = config.description;
    
    // Shortcuts
    const shortcutsContainer = container.querySelector('.tooltip-shortcuts');
    if (config.shortcuts && config.shortcuts.length > 0) {
      shortcutsContainer.innerHTML = `
        <h6>Keyboard Shortcuts</h6>
        <ul class="tooltip-shortcuts-list">
          ${config.shortcuts.map(s => `
            <li>
              <kbd>${s.key}</kbd>
              <span>${s.action}</span>
            </li>
          `).join('')}
        </ul>
      `;
      shortcutsContainer.style.display = 'block';
    } else {
      shortcutsContainer.style.display = 'none';
    }

    // Gestures (mobile)
    if (config.gestures && config.gestures.length > 0) {
      shortcutsContainer.innerHTML = `
        <h6>Touch Gestures</h6>
        <ul class="tooltip-gestures-list">
          ${config.gestures.map(g => `
            <li>
              <strong>${g.gesture}:</strong>
              <span>${g.action}</span>
            </li>
          `).join('')}
        </ul>
      `;
      shortcutsContainer.style.display = 'block';
    }

    // Options (for select elements)
    if (config.options && config.options.length > 0) {
      shortcutsContainer.innerHTML = `
        <h6>Available Options</h6>
        <ul class="tooltip-options-list">
          ${config.options.map(o => `
            <li>
              <strong>${o.value}:</strong>
              <span>${o.description}</span>
            </li>
          `).join('')}
        </ul>
      `;
      shortcutsContainer.style.display = 'block';
    }

    // Tips
    const tipsContainer = container.querySelector('.tooltip-tips');
    if (config.tips && config.tips.length > 0) {
      tipsContainer.innerHTML = `
        <h6>💡 Pro Tips</h6>
        <ul class="tooltip-tips-list">
          ${config.tips.map(tip => `<li>${tip}</li>`).join('')}
        </ul>
      `;
      tipsContainer.style.display = 'block';
    } else {
      tipsContainer.style.display = 'none';
    }

    // Learn more button
    const learnMoreBtn = container.querySelector('.tooltip-learn-more');
    if (config.learnMore) {
      learnMoreBtn.style.display = 'inline-block';
      learnMoreBtn.onclick = () => {
        config.usage.learnMoreClicked++;
        if (window.interactiveTourSystem) {
          window.interactiveTourSystem.startTour(config.learnMore);
        }
        this.hideTooltip();
      };
    } else {
      learnMoreBtn.style.display = 'none';
    }

    // Actions
    const actionsContainer = container.querySelector('.tooltip-actions');
    if (config.actions && config.actions.length > 0) {
      actionsContainer.innerHTML = config.actions.map(action => `
        <button class="tooltip-action-btn" onclick="${action.onclick}">
          <i class="${action.icon}"></i> ${action.text}
        </button>
      `).join('');
      actionsContainer.style.display = 'block';
    } else {
      actionsContainer.style.display = 'none';
    }

    // Adjust size based on content
    container.style.maxWidth = `${this.config.maxWidth}px`;
  }

  positionTooltip(element) {
    const container = this.container;
    const rect = element.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    };

    let position = 'bottom'; // Default position
    let top, left;

    // Smart positioning
    if (this.config.smartPositioning) {
      const spaceBelow = viewport.height - rect.bottom;
      const spaceAbove = rect.top;
      const spaceRight = viewport.width - rect.right;
      const spaceLeft = rect.left;

      // Choose position with most space
      if (spaceBelow >= containerRect.height + 20) {
        position = 'bottom';
      } else if (spaceAbove >= containerRect.height + 20) {
        position = 'top';
      } else if (spaceRight >= containerRect.width + 20) {
        position = 'right';
      } else if (spaceLeft >= containerRect.width + 20) {
        position = 'left';
      } else {
        position = 'bottom'; // Fallback
      }
    }

    // Calculate position
    switch (position) {
      case 'top':
        top = rect.top - containerRect.height - 10;
        left = rect.left + rect.width / 2 - containerRect.width / 2;
        break;
      case 'bottom':
        top = rect.bottom + 10;
        left = rect.left + rect.width / 2 - containerRect.width / 2;
        break;
      case 'left':
        top = rect.top + rect.height / 2 - containerRect.height / 2;
        left = rect.left - containerRect.width - 10;
        break;
      case 'right':
        top = rect.top + rect.height / 2 - containerRect.height / 2;
        left = rect.right + 10;
        break;
    }

    // Ensure tooltip stays within viewport
    top = Math.max(10, Math.min(top, viewport.height - containerRect.height - 10));
    left = Math.max(10, Math.min(left, viewport.width - containerRect.width - 10));

    // Set position
    container.style.top = `${top}px`;
    container.style.left = `${left}px`;
    
    // Update arrow position
    this.updateArrowPosition(position, rect);
  }

  updateArrowPosition(position, elementRect) {
    const arrow = this.container.querySelector('.tooltip-arrow');
    const containerRect = this.container.getBoundingClientRect();
    
    arrow.className = `tooltip-arrow tooltip-arrow-${position}`;

    switch (position) {
      case 'top':
        arrow.style.top = '100%';
        arrow.style.left = `${elementRect.left + elementRect.width / 2 - containerRect.left}px`;
        break;
      case 'bottom':
        arrow.style.bottom = '100%';
        arrow.style.left = `${elementRect.left + elementRect.width / 2 - containerRect.left}px`;
        break;
      case 'left':
        arrow.style.left = '100%';
        arrow.style.top = `${elementRect.top + elementRect.height / 2 - containerRect.top}px`;
        break;
      case 'right':
        arrow.style.right = '100%';
        arrow.style.top = `${elementRect.top + elementRect.height / 2 - containerRect.top}px`;
        break;
    }
  }

  findTooltipForElement(element) {
    for (const [selector, config] of this.tooltips) {
      if (element.matches(selector) || element.closest(selector)) {
        return config;
      }
    }
    return null;
  }

  shouldShowTooltip(tooltipConfig) {
    if (!this.config.learnMode) return true;

    const usage = tooltipConfig.usage;
    const category = tooltipConfig.category || 'general';
    
    // Don't show if dismissed too many times
    if (usage.dismissed >= 3) return false;
    
    // Show less frequently after multiple views
    if (usage.shown > 5) {
      const daysSinceLastShown = (Date.now() - (usage.lastShown || 0)) / (1000 * 60 * 60 * 24);
      return daysSinceLastShown > 7; // Only show weekly after 5+ views
    }

    return true;
  }

  isTooltipDisabled(tooltipConfig) {
    const disabledTooltips = this.settings.disabledTooltips || new Set();
    return disabledTooltips.has(tooltipConfig.id);
  }

  disableTooltip() {
    if (!this.activeTooltip) return;

    const tooltipId = this.activeTooltip.config.id;
    if (!this.settings.disabledTooltips) {
      this.settings.disabledTooltips = new Set();
    }
    this.settings.disabledTooltips.add(tooltipId);
    
    this.activeTooltip.config.usage.dismissed++;
    this.saveSettings();
    this.hideTooltip();
  }

  showLearnMore() {
    if (!this.activeTooltip) return;

    const config = this.activeTooltip.config;
    if (config.learnMore && window.interactiveTourSystem) {
      window.interactiveTourSystem.startTour(config.learnMore);
      this.hideTooltip();
    }
  }

  showContextualHelp() {
    // Find focused or hovered element and show relevant tooltip
    const activeElement = document.activeElement;
    const tooltip = this.findTooltipForElement(activeElement);
    
    if (tooltip) {
      this.showTooltip(activeElement, tooltip);
    } else {
      // Show general help
      if (window.interactiveTourSystem) {
        window.interactiveTourSystem.startTour('gallery-basics');
      }
    }
  }

  processDynamicContent(node) {
    // Process newly added content for tooltips
    if (node.matches && node.matches('[data-tooltip]')) {
      this.setupTooltipForElement(node);
    }
    
    // Process child elements
    const tooltipElements = node.querySelectorAll && node.querySelectorAll('[data-tooltip]');
    if (tooltipElements) {
      tooltipElements.forEach(el => this.setupTooltipForElement(el));
    }
  }

  setupTooltipForElement(element) {
    const tooltipData = element.getAttribute('data-tooltip');
    if (tooltipData) {
      try {
        const config = JSON.parse(tooltipData);
        this.registerTooltip(`[data-tooltip-id="${element.dataset.tooltipId}"]`, config);
        element.setAttribute('data-tooltip-id', this.generateTooltipId());
      } catch (error) {
        // Simple text tooltip
        this.registerTooltip(`[data-tooltip-id="${element.dataset.tooltipId}"]`, {
          title: 'Help',
          description: tooltipData
        });
        element.setAttribute('data-tooltip-id', this.generateTooltipId());
      }
    }
  }

  generateTooltipId(selector) {
    if (selector) {
      return btoa(selector).replace(/[^a-zA-Z0-9]/g, '');
    }
    return 'tooltip_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  startUsageTracking() {
    // Track which features users interact with
    const trackableSelectors = Array.from(this.tooltips.keys());
    
    trackableSelectors.forEach(selector => {
      document.addEventListener('click', (e) => {
        if (e.target.matches(selector) || e.target.closest(selector)) {
          const tooltip = this.tooltips.get(selector);
          if (tooltip) {
            // User interacted with this feature, reduce tooltip frequency
            tooltip.usage.interacted = (tooltip.usage.interacted || 0) + 1;
            this.saveSettings();
          }
        }
      });
    });

    // Auto-save settings periodically
    setInterval(() => {
      this.saveSettings();
    }, 60000); // Every minute
  }

  loadSettings() {
    try {
      const saved = localStorage.getItem('contextual-tooltip-settings');
      if (saved) {
        const data = JSON.parse(saved);
        return {
          disabledTooltips: new Set(data.disabledTooltips || []),
          ...data
        };
      }
    } catch (error) {
      console.warn('Failed to load tooltip settings:', error);
    }

    return {
      disabledTooltips: new Set()
    };
  }

  saveSettings() {
    try {
      const data = {
        ...this.settings,
        disabledTooltips: Array.from(this.settings.disabledTooltips || [])
      };
      localStorage.setItem('contextual-tooltip-settings', JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save tooltip settings:', error);
    }
  }

  // Public API
  enableTooltip(tooltipId) {
    if (this.settings.disabledTooltips) {
      this.settings.disabledTooltips.delete(tooltipId);
      this.saveSettings();
    }
  }

  resetAllTooltips() {
    this.settings.disabledTooltips = new Set();
    // Reset usage statistics
    for (const tooltip of this.tooltips.values()) {
      tooltip.usage = {
        shown: 0,
        dismissed: 0,
        learnMoreClicked: 0,
        lastShown: null
      };
    }
    this.saveSettings();
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }
}

// Inject required CSS
const tooltipCSS = `
/* Contextual Tooltip System Styles */
.contextual-tooltip-container {
  position: fixed;
  z-index: 9999;
  display: none;
  max-width: 400px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
  line-height: 1.5;
}

.contextual-tooltip-container.show {
  display: block;
  animation: tooltipFadeIn 0.2s ease-out;
}

.tooltip-content {
  background: white;
  border: 1px solid #e1e5e9;
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  overflow: hidden;
  position: relative;
}

.tooltip-header {
  padding: 0.75rem 1rem;
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.tooltip-title {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 600;
  color: #495057;
}

.tooltip-close {
  background: none;
  border: none;
  color: #6c757d;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 4px;
  transition: all 0.15s ease;
}

.tooltip-close:hover {
  background: #e9ecef;
  color: #495057;
}

.tooltip-body {
  padding: 1rem;
}

.tooltip-description {
  color: #6c757d;
  margin-bottom: 0.75rem;
  font-size: 0.85rem;
}

.tooltip-shortcuts,
.tooltip-tips {
  margin-top: 0.75rem;
}

.tooltip-shortcuts h6,
.tooltip-tips h6 {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #007bff;
  margin-bottom: 0.5rem;
  font-weight: 600;
}

.tooltip-shortcuts-list,
.tooltip-gestures-list,
.tooltip-options-list,
.tooltip-tips-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.tooltip-shortcuts-list li,
.tooltip-gestures-list li,
.tooltip-options-list li {
  display: flex;
  align-items: center;
  padding: 0.25rem 0;
  font-size: 0.8rem;
}

.tooltip-shortcuts-list kbd {
  background: #f1f3f4;
  border: 1px solid #dadce0;
  border-radius: 3px;
  padding: 0.125rem 0.375rem;
  font-size: 0.7rem;
  margin-right: 0.5rem;
  min-width: 2rem;
  text-align: center;
}

.tooltip-gestures-list strong,
.tooltip-options-list strong {
  color: #495057;
  margin-right: 0.5rem;
  min-width: 5rem;
}

.tooltip-tips-list li {
  padding: 0.375rem 0;
  border-bottom: 1px solid #f8f9fa;
  font-size: 0.8rem;
  color: #6c757d;
}

.tooltip-tips-list li:last-child {
  border-bottom: none;
}

.tooltip-footer {
  padding: 0.75rem 1rem;
  background: #f8f9fa;
  border-top: 1px solid #e9ecef;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
}

.tooltip-actions {
  display: flex;
  gap: 0.5rem;
}

.tooltip-action-btn {
  padding: 0.375rem 0.75rem;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 0.75rem;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.tooltip-action-btn:hover {
  background: #0056b3;
}

.tooltip-controls {
  display: flex;
  gap: 0.5rem;
  font-size: 0.75rem;
}

.tooltip-disable-btn,
.tooltip-learn-more {
  background: none;
  border: none;
  color: #6c757d;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  transition: all 0.15s ease;
}

.tooltip-disable-btn:hover,
.tooltip-learn-more:hover {
  background: #e9ecef;
  color: #495057;
}

.tooltip-learn-more {
  color: #007bff;
}

.tooltip-learn-more:hover {
  background: rgba(0, 123, 255, 0.1);
  color: #0056b3;
}

/* Arrow styles */
.tooltip-arrow {
  position: absolute;
  width: 0;
  height: 0;
  border: 8px solid transparent;
}

.tooltip-arrow-bottom {
  top: -16px;
  border-bottom-color: white;
  filter: drop-shadow(0 -1px 1px rgba(0, 0, 0, 0.1));
}

.tooltip-arrow-top {
  bottom: -16px;
  border-top-color: white;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.1));
}

.tooltip-arrow-left {
  right: -16px;
  border-left-color: white;
  filter: drop-shadow(1px 0 1px rgba(0, 0, 0, 0.1));
}

.tooltip-arrow-right {
  left: -16px;
  border-right-color: white;
  filter: drop-shadow(-1px 0 1px rgba(0, 0, 0, 0.1));
}

/* Animation */
@keyframes tooltipFadeIn {
  from {
    opacity: 0;
    transform: translateY(-4px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* Responsive design */
@media (max-width: 768px) {
  .contextual-tooltip-container {
    max-width: calc(100vw - 2rem);
    margin: 0 1rem;
  }
  
  .tooltip-footer {
    flex-direction: column;
    align-items: stretch;
    gap: 0.5rem;
  }
  
  .tooltip-controls {
    justify-content: center;
  }
}

/* High contrast support */
@media (prefers-contrast: high) {
  .tooltip-content {
    border: 2px solid #000;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
  }
  
  .tooltip-header,
  .tooltip-footer {
    background: #f0f0f0;
    border-color: #000;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .contextual-tooltip-container {
    animation: none !important;
  }
  
  .tooltip-close,
  .tooltip-disable-btn,
  .tooltip-learn-more,
  .tooltip-action-btn {
    transition: none !important;
  }
}

/* Focus styles for accessibility */
.tooltip-close:focus,
.tooltip-disable-btn:focus,
.tooltip-learn-more:focus,
.tooltip-action-btn:focus {
  outline: 2px solid #007bff;
  outline-offset: 2px;
}
`;

// Inject CSS
const contextualTooltipStyleSheet = document.createElement('style');
contextualTooltipStyleSheet.textContent = tooltipCSS;
document.head.appendChild(contextualTooltipStyleSheet);

// Auto-initialize
document.addEventListener('DOMContentLoaded', () => {
  window.contextualTooltipSystem = new ContextualTooltipSystem();
});

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ContextualTooltipSystem;
} else {
  window.ContextualTooltipSystem = ContextualTooltipSystem;
}