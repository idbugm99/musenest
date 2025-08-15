/**
 * Guided Workflow System - Phase 8.4
 * Provides intelligent workflow suggestions and guided assistance
 */

class GuidedWorkflowSystem {
  constructor() {
    this.workflows = new Map();
    this.activeWorkflow = null;
    this.userContext = new Map();
    this.suggestions = [];
    this.dismissedSuggestions = new Set();
    
    // Configuration
    this.config = {
      suggestionDelay: 2000,        // Delay before showing suggestions
      maxSuggestions: 3,            // Maximum concurrent suggestions
      intelligentTiming: true,      // Smart timing based on user activity
      contextAwareness: true,       // Adapt to current context
      learningEnabled: true,        // Learn from user preferences
      persistDismissals: true       // Remember dismissed suggestions
    };
    
    this.init();
  }

  init() {
    this.loadAnalytics();
    this.setupEventListeners();
    this.registerDefaultWorkflows();
    this.startContextMonitoring();
    this.createSuggestionContainer();
    
    console.log('Guided Workflow System initialized');
  }

  setupEventListeners() {
    // Monitor user actions for workflow triggers
    document.addEventListener('click', (e) => {
      this.analyzeUserAction('click', e.target);
    });

    // Monitor form interactions
    document.addEventListener('input', (e) => {
      this.analyzeUserAction('input', e.target);
    });

    // Monitor modal events
    document.addEventListener('show.bs.modal', (e) => {
      this.onModalEvent('opened', e.target.id);
    });

    document.addEventListener('hidden.bs.modal', (e) => {
      this.onModalEvent('closed', e.target.id);
    });

    // Monitor gallery-specific events
    window.addEventListener('gallery-action', (e) => {
      this.onGalleryAction(e.detail);
    });

    // Monitor idle time for proactive suggestions
    let idleTimer;
    document.addEventListener('mousemove', () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        this.onUserIdle();
      }, 30000); // 30 seconds of inactivity
    });
  }

  createSuggestionContainer() {
    const container = document.createElement('div');
    container.id = 'workflow-suggestions-container';
    container.className = 'workflow-suggestions-container';
    document.body.appendChild(container);
    this.container = container;
  }

  registerDefaultWorkflows() {
    // First-time gallery creation workflow
    this.registerWorkflow('first-gallery-setup', {
      title: 'Create Your First Gallery',
      description: 'Let\'s set up your gallery step by step',
      triggers: [
        { type: 'page_load', condition: () => this.getSectionCount() === 0 },
        { type: 'empty_state', element: '#sections_list' }
      ],
      steps: [
        {
          action: 'focus_element',
          target: '#sec_title',
          message: 'First, give your gallery section a descriptive name'
        },
        {
          action: 'suggest_input',
          target: '#sec_title',
          suggestions: ['Portfolio', 'Featured Work', 'Behind the Scenes', 'Recent Photos']
        },
        {
          action: 'explain_layout',
          target: '#sec_layout',
          message: 'Choose a layout that fits your content style'
        },
        {
          action: 'highlight_button',
          target: '#btn_create_section',
          message: 'Click here to create your section!'
        }
      ],
      priority: 'high',
      category: 'onboarding'
    });

    // Bulk image organization workflow
    this.registerWorkflow('bulk-organization', {
      title: 'Organize Multiple Images',
      description: 'Efficiently organize your images using bulk operations',
      triggers: [
        { type: 'image_count', threshold: 10, condition: () => this.getSectionCount() >= 2 },
        { type: 'selection_size', threshold: 5 }
      ],
      steps: [
        {
          action: 'show_tip',
          message: 'You have many images! Let me show you how to organize them efficiently.',
          duration: 3000
        },
        {
          action: 'highlight_feature',
          target: 'button[onclick*="openDragDropGalleryBuilder"]',
          message: 'Use the Drag & Drop Builder for easy bulk organization'
        },
        {
          action: 'demonstrate',
          type: 'bulk_selection',
          message: 'Hold Ctrl/Cmd to select multiple images at once'
        }
      ],
      priority: 'medium',
      category: 'efficiency'
    });

    // Mobile optimization workflow
    this.registerWorkflow('mobile-optimization', {
      title: 'Mobile Gallery Management',
      description: 'Learn mobile-specific gestures and features',
      triggers: [
        { type: 'device_change', to: 'mobile' },
        { type: 'first_mobile_visit' }
      ],
      steps: [
        {
          action: 'show_mobile_intro',
          message: 'Welcome to mobile! Your gallery supports touch gestures.'
        },
        {
          action: 'demonstrate_gesture',
          gesture: 'long_press',
          target: '.drag-image-tile',
          message: 'Long press images to start drag mode'
        },
        {
          action: 'demonstrate_gesture',
          gesture: 'swipe',
          target: '#dragDropImageLibrary',
          message: 'Swipe left/right to navigate pages'
        }
      ],
      condition: () => this.isMobileDevice(),
      priority: 'high',
      category: 'mobile'
    });

    // Advanced features discovery workflow
    this.registerWorkflow('advanced-discovery', {
      title: 'Discover Advanced Features',
      description: 'Unlock powerful features as you become more proficient',
      triggers: [
        { type: 'proficiency_level', level: 'intermediate' },
        { type: 'feature_usage', features: ['drag_drop', 'lightbox'], threshold: 5 }
      ],
      steps: [
        {
          action: 'show_achievement',
          message: 'Great progress! You\'re ready for advanced features.',
          icon: 'fas fa-star'
        },
        {
          action: 'reveal_shortcuts',
          message: 'Did you know you can use keyboard shortcuts? Press "?" to see them.'
        },
        {
          action: 'suggest_batch_operations',
          message: 'Try selecting multiple images for bulk operations'
        }
      ],
      priority: 'medium',
      category: 'progression'
    });

    // Workflow optimization suggestions
    this.registerWorkflow('workflow-optimization', {
      title: 'Optimize Your Workflow',
      description: 'Suggestions to make your gallery management more efficient',
      triggers: [
        { type: 'repetitive_action', action: 'single_image_drag', threshold: 10 },
        { type: 'slow_completion', task: 'gallery_creation', time: 300000 }
      ],
      steps: [
        {
          action: 'analyze_behavior',
          message: 'I noticed you\'re doing a lot of individual image operations.'
        },
        {
          action: 'suggest_bulk',
          message: 'You can select multiple images and drag them together!'
        },
        {
          action: 'show_filters',
          message: 'Use filters to find specific images faster'
        }
      ],
      priority: 'low',
      category: 'optimization'
    });

    // Error recovery workflows
    this.registerWorkflow('error-recovery', {
      title: 'Let Me Help',
      description: 'Assistance when things don\'t go as expected',
      triggers: [
        { type: 'api_error', consecutive: 2 },
        { type: 'empty_drag_drop', attempts: 3 },
        { type: 'navigation_confusion', backtrack: 5 }
      ],
      steps: [
        {
          action: 'acknowledge_frustration',
          message: 'I see you might be having some trouble. Let me help!'
        },
        {
          action: 'offer_alternatives',
          message: 'Here are a few different ways to accomplish what you\'re trying to do'
        },
        {
          action: 'provide_support',
          message: 'Would you like me to start a guided tour?'
        }
      ],
      priority: 'urgent',
      category: 'support'
    });
  }

  registerWorkflow(id, config) {
    this.workflows.set(id, {
      id,
      ...config,
      triggered: false,
      completed: false,
      dismissed: false,
      lastTriggered: null,
      completions: 0
    });
  }

  analyzeUserAction(type, target) {
    // Update user context
    this.updateUserContext(type, target);
    
    // Check workflow triggers
    this.evaluateWorkflowTriggers();
    
    // Generate contextual suggestions
    setTimeout(() => {
      this.generateContextualSuggestions();
    }, this.config.suggestionDelay);
  }

  updateUserContext(actionType, target) {
    const context = {
      timestamp: Date.now(),
      type: actionType,
      element: target.tagName?.toLowerCase(),
      id: target.id,
      className: target.className,
      location: window.location.pathname
    };

    // Store recent actions (keep last 10)
    if (!this.userContext.has('recent_actions')) {
      this.userContext.set('recent_actions', []);
    }
    
    const recentActions = this.userContext.get('recent_actions');
    recentActions.unshift(context);
    if (recentActions.length > 10) {
      recentActions.pop();
    }

    // Update specific contexts
    this.updateSpecificContexts(actionType, target, context);
  }

  updateSpecificContexts(actionType, target, context) {
    // Track form interactions
    if (actionType === 'input') {
      if (target.id === 'sec_title') {
        this.userContext.set('creating_section', true);
        this.userContext.set('section_title_length', target.value.length);
      }
    }

    // Track modal usage
    if (target.matches('[data-bs-toggle="modal"]') || target.closest('[data-bs-toggle="modal"]')) {
      this.userContext.set('modal_interactions', (this.userContext.get('modal_interactions') || 0) + 1);
    }

    // Track drag-drop builder usage
    if (target.matches('[onclick*="openDragDropGalleryBuilder"]')) {
      this.userContext.set('drag_drop_opens', (this.userContext.get('drag_drop_opens') || 0) + 1);
    }

    // Track image selections
    if (target.matches('.drag-image-tile, .picker-image-tile')) {
      this.userContext.set('image_interactions', (this.userContext.get('image_interactions') || 0) + 1);
    }
  }

  evaluateWorkflowTriggers() {
    for (const [workflowId, workflow] of this.workflows) {
      if (workflow.triggered || workflow.dismissed) continue;

      // Check if workflow conditions are met
      if (this.shouldTriggerWorkflow(workflow)) {
        this.triggerWorkflow(workflowId);
      }
    }
  }

  shouldTriggerWorkflow(workflow) {
    if (workflow.condition && !workflow.condition()) return false;

    for (const trigger of workflow.triggers) {
      if (this.evaluateTrigger(trigger)) {
        return true;
      }
    }
    return false;
  }

  evaluateTrigger(trigger) {
    switch (trigger.type) {
      case 'page_load':
        return trigger.condition ? trigger.condition() : true;

      case 'image_count':
        return this.getImageCount() >= trigger.threshold && 
               (trigger.condition ? trigger.condition() : true);

      case 'selection_size':
        return this.getSelectionSize() >= trigger.threshold;

      case 'device_change':
        return this.getDeviceType() === trigger.to;

      case 'proficiency_level':
        return this.getUserProficiencyLevel() === trigger.level;

      case 'feature_usage':
        return trigger.features.every(feature => 
          this.getFeatureUsage(feature) >= trigger.threshold);

      case 'repetitive_action':
        return this.getActionCount(trigger.action) >= trigger.threshold;

      case 'api_error':
        return this.getConsecutiveErrors() >= trigger.consecutive;

      case 'empty_state':
        const element = document.querySelector(trigger.element);
        return element && this.isEmptyState(element);

      default:
        return false;
    }
  }

  triggerWorkflow(workflowId) {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return;

    workflow.triggered = true;
    workflow.lastTriggered = Date.now();

    console.log(`Workflow triggered: ${workflowId} - ${workflow.title}`);

    // Execute workflow steps
    this.executeWorkflow(workflow);
  }

  executeWorkflow(workflow) {
    this.activeWorkflow = workflow;
    
    // Show workflow introduction
    this.showWorkflowIntro(workflow);
    
    // Start executing steps
    this.executeWorkflowSteps(workflow.steps, 0);
  }

  showWorkflowIntro(workflow) {
    const intro = this.createSuggestionElement({
      type: 'workflow_intro',
      title: workflow.title,
      message: workflow.description,
      icon: this.getWorkflowIcon(workflow.category),
      actions: [
        {
          text: 'Get Started',
          className: 'btn-primary',
          action: () => this.proceedWithWorkflow()
        },
        {
          text: 'Not Now',
          className: 'btn-outline-secondary',
          action: () => this.dismissWorkflow()
        }
      ],
      priority: workflow.priority
    });

    this.showSuggestion(intro);
  }

  executeWorkflowSteps(steps, currentIndex) {
    if (currentIndex >= steps.length) {
      this.completeWorkflow();
      return;
    }

    const step = steps[currentIndex];
    this.executeWorkflowStep(step, () => {
      // Move to next step
      setTimeout(() => {
        this.executeWorkflowSteps(steps, currentIndex + 1);
      }, 1000);
    });
  }

  executeWorkflowStep(step, onComplete) {
    switch (step.action) {
      case 'focus_element':
        this.focusElement(step.target, step.message);
        break;

      case 'suggest_input':
        this.suggestInput(step.target, step.suggestions, step.message);
        break;

      case 'highlight_button':
        this.highlightElement(step.target, step.message);
        break;

      case 'show_tip':
        this.showTip(step.message, step.duration);
        break;

      case 'demonstrate':
        this.demonstrateFeature(step.type, step.message);
        break;

      case 'show_achievement':
        this.showAchievement(step.message, step.icon);
        break;

      case 'reveal_shortcuts':
        this.revealShortcuts(step.message);
        break;

      default:
        console.warn('Unknown workflow step action:', step.action);
    }

    // Auto-complete step after delay
    setTimeout(onComplete, step.duration || 3000);
  }

  generateContextualSuggestions() {
    if (this.suggestions.length >= this.config.maxSuggestions) return;

    const context = this.analyzeCurrentContext();
    const suggestions = this.getSuggestionsForContext(context);

    suggestions.forEach(suggestion => {
      if (!this.dismissedSuggestions.has(suggestion.id)) {
        this.showSuggestion(this.createSuggestionElement(suggestion));
      }
    });
  }

  analyzeCurrentContext() {
    return {
      currentPage: window.location.pathname,
      activeModal: document.querySelector('.modal.show')?.id,
      imageCount: this.getImageCount(),
      selectionSize: this.getSelectionSize(),
      sectionCount: this.getSectionCount(),
      userLevel: this.getUserProficiencyLevel(),
      recentActions: this.userContext.get('recent_actions') || [],
      timeSpent: this.getTimeSpentOnPage(),
      deviceType: this.getDeviceType()
    };
  }

  getSuggestionsForContext(context) {
    const suggestions = [];

    // Empty gallery suggestion
    if (context.sectionCount === 0) {
      suggestions.push({
        id: 'create-first-section',
        type: 'quick_action',
        title: 'Create Your First Gallery Section',
        message: 'Start by creating a section to organize your images',
        icon: 'fas fa-plus-circle',
        actions: [{
          text: 'Create Section',
          action: () => document.getElementById('sec_title')?.focus()
        }]
      });
    }

    // Many images, suggest bulk operations
    if (context.imageCount > 15 && context.selectionSize < 2) {
      suggestions.push({
        id: 'bulk-operations-hint',
        type: 'efficiency_tip',
        title: 'Speed Up Your Workflow',
        message: 'With this many images, try selecting multiple at once for bulk operations',
        icon: 'fas fa-lightning-bolt',
        actions: [{
          text: 'Show Me How',
          action: () => this.demonstrateBulkSelection()
        }]
      });
    }

    // Mobile device suggestions
    if (context.deviceType === 'mobile') {
      suggestions.push({
        id: 'mobile-gestures',
        type: 'device_tip',
        title: 'Mobile Gestures Available',
        message: 'Long press images to drag, swipe to navigate',
        icon: 'fas fa-mobile-alt',
        actions: [{
          text: 'Learn Gestures',
          action: () => this.showMobileGestures()
        }]
      });
    }

    // Intermediate user suggestions
    if (context.userLevel === 'intermediate') {
      suggestions.push({
        id: 'keyboard-shortcuts',
        type: 'power_user_tip',
        title: 'Try Keyboard Shortcuts',
        message: 'Press "?" to see available keyboard shortcuts',
        icon: 'fas fa-keyboard',
        priority: 'low'
      });
    }

    return suggestions;
  }

  createSuggestionElement(suggestion) {
    const element = document.createElement('div');
    element.className = `workflow-suggestion workflow-suggestion-${suggestion.type} priority-${suggestion.priority || 'medium'}`;
    element.setAttribute('data-suggestion-id', suggestion.id);
    
    const actions = suggestion.actions || [];
    const actionsHTML = actions.map(action => 
      `<button class="suggestion-action ${action.className || 'btn-primary'}" data-action="${action.text}">
        ${action.text}
      </button>`
    ).join('');

    element.innerHTML = `
      <div class="suggestion-content">
        <div class="suggestion-header">
          <div class="suggestion-icon">
            <i class="${suggestion.icon || 'fas fa-lightbulb'}"></i>
          </div>
          <div class="suggestion-text">
            <h6 class="suggestion-title">${suggestion.title}</h6>
            <p class="suggestion-message">${suggestion.message}</p>
          </div>
          <button class="suggestion-dismiss" data-action="dismiss">
            <i class="fas fa-times"></i>
          </button>
        </div>
        ${actionsHTML ? `<div class="suggestion-actions">${actionsHTML}</div>` : ''}
      </div>
    `;

    // Bind action events
    actions.forEach((action, index) => {
      const button = element.querySelectorAll('.suggestion-action')[index];
      if (button && action.action) {
        button.addEventListener('click', () => {
          action.action();
          this.dismissSuggestion(element);
        });
      }
    });

    // Bind dismiss event
    element.querySelector('.suggestion-dismiss').addEventListener('click', () => {
      this.dismissSuggestion(element);
    });

    return element;
  }

  showSuggestion(element) {
    this.container.appendChild(element);
    this.suggestions.push(element);

    // Animate in
    requestAnimationFrame(() => {
      element.classList.add('show');
    });

    // Auto-dismiss low priority suggestions
    const priority = element.classList.contains('priority-low') ? 'low' : 'medium';
    if (priority === 'low') {
      setTimeout(() => {
        if (element.parentNode) {
          this.dismissSuggestion(element);
        }
      }, 8000);
    }
  }

  dismissSuggestion(element) {
    const suggestionId = element.getAttribute('data-suggestion-id');
    if (suggestionId && this.config.persistDismissals) {
      this.dismissedSuggestions.add(suggestionId);
    }

    element.classList.remove('show');
    setTimeout(() => {
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
      this.suggestions = this.suggestions.filter(s => s !== element);
    }, 300);
  }

  // Workflow step implementations
  focusElement(selector, message) {
    const element = document.querySelector(selector);
    if (element) {
      element.focus();
      element.classList.add('workflow-highlight');
      
      if (message) {
        this.showContextualMessage(element, message);
      }
    }
  }

  suggestInput(selector, suggestions, message) {
    const input = document.querySelector(selector);
    if (!input) return;

    // Create suggestion dropdown
    const dropdown = document.createElement('div');
    dropdown.className = 'workflow-input-suggestions';
    dropdown.innerHTML = suggestions.map(suggestion => 
      `<div class="input-suggestion" data-value="${suggestion}">${suggestion}</div>`
    ).join('');

    // Position dropdown
    const rect = input.getBoundingClientRect();
    dropdown.style.position = 'fixed';
    dropdown.style.top = `${rect.bottom + 5}px`;
    dropdown.style.left = `${rect.left}px`;
    dropdown.style.width = `${rect.width}px`;

    // Handle clicks
    dropdown.addEventListener('click', (e) => {
      if (e.target.classList.contains('input-suggestion')) {
        input.value = e.target.getAttribute('data-value');
        input.dispatchEvent(new Event('input'));
        dropdown.remove();
      }
    });

    document.body.appendChild(dropdown);

    // Remove on click outside or input focus loss
    const cleanup = () => {
      if (dropdown.parentNode) dropdown.remove();
      input.removeEventListener('blur', cleanup);
      document.removeEventListener('click', cleanup);
    };
    
    input.addEventListener('blur', cleanup);
    document.addEventListener('click', cleanup);
  }

  highlightElement(selector, message) {
    const element = document.querySelector(selector);
    if (element) {
      element.classList.add('workflow-highlight', 'workflow-pulse');
      
      if (message) {
        this.showContextualMessage(element, message);
      }

      setTimeout(() => {
        element.classList.remove('workflow-pulse');
      }, 3000);
    }
  }

  showContextualMessage(element, message) {
    const messageEl = document.createElement('div');
    messageEl.className = 'workflow-contextual-message';
    messageEl.textContent = message;

    const rect = element.getBoundingClientRect();
    messageEl.style.position = 'fixed';
    messageEl.style.top = `${rect.bottom + 10}px`;
    messageEl.style.left = `${rect.left}px`;
    messageEl.style.zIndex = '10000';

    document.body.appendChild(messageEl);

    setTimeout(() => {
      if (messageEl.parentNode) {
        messageEl.remove();
      }
    }, 5000);
  }

  // Utility methods
  getImageCount() {
    if (window.dragDropGalleryBuilder?.images) {
      return window.dragDropGalleryBuilder.images.length;
    }
    return document.querySelectorAll('.drag-image-tile, .picker-image-tile').length;
  }

  getSelectionSize() {
    if (window.dragDropGalleryBuilder?.selectedImages) {
      return window.dragDropGalleryBuilder.selectedImages.size;
    }
    return document.querySelectorAll('.drag-image-tile.selected, .picker-image-tile.selected').length;
  }

  getSectionCount() {
    return document.querySelectorAll('#sections_list .card').length;
  }

  getUserProficiencyLevel() {
    if (window.progressiveDisclosureSystem) {
      return window.progressiveDisclosureSystem.getUserProficiencyLevel();
    }
    return 'beginner';
  }

  getDeviceType() {
    if (window.MobileTouchHandler?.isSupported()) {
      return 'mobile';
    }
    return window.innerWidth <= 768 ? 'tablet' : 'desktop';
  }

  isMobileDevice() {
    return this.getDeviceType() === 'mobile';
  }

  getWorkflowIcon(category) {
    const icons = {
      onboarding: 'fas fa-graduation-cap',
      efficiency: 'fas fa-lightning-bolt',
      mobile: 'fas fa-mobile-alt',
      progression: 'fas fa-star',
      optimization: 'fas fa-cogs',
      support: 'fas fa-life-ring'
    };
    return icons[category] || 'fas fa-lightbulb';
  }

  startContextMonitoring() {
    // Monitor context changes
    setInterval(() => {
      this.evaluateWorkflowTriggers();
    }, 5000);

    // Clean up old suggestions
    setInterval(() => {
      this.cleanupOldSuggestions();
    }, 30000);
  }

  cleanupOldSuggestions() {
    const now = Date.now();
    const maxAge = 300000; // 5 minutes

    this.suggestions.forEach(suggestion => {
      const timestamp = parseInt(suggestion.getAttribute('data-timestamp') || '0');
      if (now - timestamp > maxAge) {
        this.dismissSuggestion(suggestion);
      }
    });
  }

  onModalEvent(event, modalId) {
    if (event === 'opened') {
      // Show contextual suggestions for specific modals
      if (modalId === 'dragDropGalleryModal') {
        this.showDragDropSuggestions();
      } else if (modalId === 'advancedImageLightbox') {
        this.showLightboxSuggestions();
      }
    }
  }

  onGalleryAction(detail) {
    // React to gallery-specific actions
    if (detail.action === 'image_added') {
      this.onImageAdded(detail);
    } else if (detail.action === 'section_created') {
      this.onSectionCreated(detail);
    }
  }

  onUserIdle() {
    // Show suggestions when user is idle
    if (this.suggestions.length === 0) {
      this.generateIdleSuggestions();
    }
  }

  generateIdleSuggestions() {
    // Generate contextual suggestions when user is idle
    const context = this.analyzeCurrentContext();
    const suggestions = this.getSuggestionsForContext(context);
    
    // Show up to 2 suggestions
    suggestions.slice(0, 2).forEach(suggestion => {
      if (!this.suggestions.find(s => s.id === suggestion.id)) {
        const element = this.createSuggestionElement(suggestion);
        this.showSuggestion(element);
      }
    });
  }

  // Public API
  triggerWorkflowManually(workflowId) {
    this.triggerWorkflow(workflowId);
  }

  dismissAllSuggestions() {
    [...this.suggestions].forEach(suggestion => {
      this.dismissSuggestion(suggestion);
    });
  }

  resetDismissedSuggestions() {
    this.dismissedSuggestions.clear();
  }

  getSuggestionStats() {
    return {
      active: this.suggestions.length,
      dismissed: this.dismissedSuggestions.size,
      activeWorkflow: this.activeWorkflow?.id || null
    };
  }

  // Missing methods referenced in the code
  getFeatureUsage(feature) {
    // Get feature usage from analytics or default to 0
    if (!this.analytics || !this.analytics.features) {
      return 0;
    }
    return this.analytics.features[feature] || 0;
  }

  completeWorkflow() {
    if (this.activeWorkflow) {
      console.log('Completing workflow:', this.activeWorkflow.id);
      this.activeWorkflow.completed = true;
      this.activeWorkflow.completedAt = Date.now();
      
      // Initialize analytics if needed
      if (!this.analytics) {
        this.analytics = {};
      }
      
      // Store completion in analytics
      if (!this.analytics.completedWorkflows) {
        this.analytics.completedWorkflows = [];
      }
      this.analytics.completedWorkflows.push({
        id: this.activeWorkflow.id,
        completedAt: this.activeWorkflow.completedAt,
        steps: this.activeWorkflow.steps.length
      });
      
      this.activeWorkflow = null;
      this.saveAnalytics();
    }
  }

  getActionCount(action) {
    // Get action count from analytics or default to 0
    if (!this.analytics || !this.analytics.actions) {
      return 0;
    }
    return this.analytics.actions[action] || 0;
  }

  proceedWithWorkflow() {
    if (this.activeWorkflow) {
      console.log('Proceeding with workflow:', this.activeWorkflow.id);
      const currentStep = this.activeWorkflow.currentStep || 0;
      if (currentStep < this.activeWorkflow.steps.length) {
        this.activeWorkflow.currentStep = currentStep + 1;
        this.executeWorkflowSteps(this.activeWorkflow.steps, currentStep + 1);
      } else {
        this.completeWorkflow();
      }
    }
  }

  dismissWorkflow() {
    if (this.activeWorkflow) {
      console.log('Dismissing workflow:', this.activeWorkflow.id);
      
      // Track dismissal in analytics
      if (!this.analytics) {
        this.analytics = {};
      }
      if (!this.analytics.dismissedWorkflows) {
        this.analytics.dismissedWorkflows = [];
      }
      this.analytics.dismissedWorkflows.push({
        id: this.activeWorkflow.id,
        dismissedAt: Date.now(),
        step: this.activeWorkflow.currentStep || 0
      });
      
      this.activeWorkflow = null;
      this.saveAnalytics();
    }
  }

  getConsecutiveErrors() {
    // Return consecutive error count from analytics
    if (!this.analytics || !this.analytics.consecutiveErrors) {
      return 0;
    }
    return this.analytics.consecutiveErrors;
  }

  saveAnalytics() {
    // Save analytics to localStorage or send to server
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('guidedWorkflowAnalytics', JSON.stringify(this.analytics || {}));
      }
    } catch (error) {
      console.warn('Failed to save analytics:', error);
    }
  }

  loadAnalytics() {
    // Load analytics from localStorage
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem('guidedWorkflowAnalytics');
        if (saved) {
          this.analytics = JSON.parse(saved);
        }
      }
    } catch (error) {
      console.warn('Failed to load analytics:', error);
      this.analytics = {};
    }
    
    // Ensure analytics object has required structure
    if (!this.analytics) {
      this.analytics = {};
    }
    if (!this.analytics.features) {
      this.analytics.features = {};
    }
    if (!this.analytics.actions) {
      this.analytics.actions = {};
    }
    if (!this.analytics.consecutiveErrors) {
      this.analytics.consecutiveErrors = 0;
    }
    if (!this.analytics.pageLoadTime) {
      this.analytics.pageLoadTime = Date.now();
    }
  }

  getTimeSpentOnPage() {
    // Calculate time spent on current page
    if (!this.analytics || !this.analytics.pageLoadTime) {
      return 0;
    }
    return Date.now() - this.analytics.pageLoadTime;
  }
}

// Inject required CSS
const workflowCSS = `
/* Guided Workflow System Styles */
.workflow-suggestions-container {
  position: fixed;
  top: 2rem;
  right: 2rem;
  z-index: 9997;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 350px;
  pointer-events: none;
}

.workflow-suggestion {
  background: white;
  border: 1px solid #e9ecef;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  opacity: 0;
  transform: translateX(100%);
  transition: all 0.3s ease;
  pointer-events: auto;
  overflow: hidden;
}

.workflow-suggestion.show {
  opacity: 1;
  transform: translateX(0);
}

.workflow-suggestion.priority-urgent {
  border-left: 4px solid #dc3545;
}

.workflow-suggestion.priority-high {
  border-left: 4px solid #ffc107;
}

.workflow-suggestion.priority-medium {
  border-left: 4px solid #007bff;
}

.workflow-suggestion.priority-low {
  border-left: 4px solid #28a745;
}

.suggestion-content {
  padding: 1rem;
}

.suggestion-header {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.suggestion-icon {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 0.5rem;
  color: #007bff;
  font-size: 1.1rem;
  flex-shrink: 0;
}

.suggestion-text {
  flex: 1;
  min-width: 0;
}

.suggestion-title {
  margin: 0 0 0.25rem 0;
  font-size: 0.9rem;
  font-weight: 600;
  color: #495057;
}

.suggestion-message {
  margin: 0;
  font-size: 0.8rem;
  color: #6c757d;
  line-height: 1.4;
}

.suggestion-dismiss {
  background: none;
  border: none;
  color: #adb5bd;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 4px;
  transition: color 0.2s ease;
  flex-shrink: 0;
}

.suggestion-dismiss:hover {
  color: #6c757d;
}

.suggestion-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.suggestion-action {
  padding: 0.375rem 0.75rem;
  border: none;
  border-radius: 6px;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s ease;
  flex: 1;
}

.suggestion-action.btn-primary {
  background: #007bff;
  color: white;
}

.suggestion-action.btn-primary:hover {
  background: #0056b3;
}

.suggestion-action.btn-outline-secondary {
  background: none;
  color: #6c757d;
  border: 1px solid #dee2e6;
}

.suggestion-action.btn-outline-secondary:hover {
  background: #f8f9fa;
}

/* Workflow highlighting */
.workflow-highlight {
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.3) !important;
  border-radius: 4px !important;
  position: relative;
  z-index: 10;
}

.workflow-pulse {
  animation: workflowPulse 2s ease-in-out 3;
}

@keyframes workflowPulse {
  0%, 100% { 
    transform: scale(1);
    box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.3);
  }
  50% { 
    transform: scale(1.02);
    box-shadow: 0 0 0 8px rgba(0, 123, 255, 0.1);
  }
}

/* Input suggestions */
.workflow-input-suggestions {
  background: white;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  z-index: 10001;
  max-height: 200px;
  overflow-y: auto;
}

.input-suggestion {
  padding: 0.75rem 1rem;
  cursor: pointer;
  border-bottom: 1px solid #f8f9fa;
  transition: background-color 0.2s ease;
  font-size: 0.85rem;
}

.input-suggestion:hover {
  background: #f8f9fa;
}

.input-suggestion:last-child {
  border-bottom: none;
}

/* Contextual messages */
.workflow-contextual-message {
  background: #2c3e50;
  color: white;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  font-size: 0.8rem;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  animation: contextualMessageSlide 0.3s ease-out;
}

@keyframes contextualMessageSlide {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Workflow types */
.workflow-suggestion-workflow_intro .suggestion-icon {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
}

.workflow-suggestion-efficiency_tip .suggestion-icon {
  background: linear-gradient(135deg, #f093fb, #f5576c);
  color: white;
}

.workflow-suggestion-device_tip .suggestion-icon {
  background: linear-gradient(135deg, #4facfe, #00f2fe);
  color: white;
}

.workflow-suggestion-power_user_tip .suggestion-icon {
  background: linear-gradient(135deg, #43e97b, #38f9d7);
  color: white;
}

/* Responsive design */
@media (max-width: 768px) {
  .workflow-suggestions-container {
    top: 1rem;
    right: 1rem;
    left: 1rem;
    max-width: none;
  }
  
  .suggestion-actions {
    flex-direction: column;
  }
  
  .workflow-contextual-message {
    max-width: calc(100vw - 2rem);
    margin: 0 1rem;
  }
}

/* High contrast support */
@media (prefers-contrast: high) {
  .workflow-suggestion {
    border: 2px solid #000;
  }
  
  .suggestion-icon {
    border: 1px solid #000;
  }
  
  .workflow-highlight {
    box-shadow: 0 0 0 3px #000 !important;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .workflow-suggestion,
  .workflow-pulse,
  .contextual-message {
    animation: none !important;
    transition: none !important;
  }
  
  .workflow-suggestion.show {
    transform: none;
  }
}
`;

// Inject CSS
const guidedWorkflowStyleSheet = document.createElement('style');
guidedWorkflowStyleSheet.textContent = workflowCSS;
document.head.appendChild(guidedWorkflowStyleSheet);

// Auto-initialize
document.addEventListener('DOMContentLoaded', () => {
  window.guidedWorkflowSystem = new GuidedWorkflowSystem();
});

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GuidedWorkflowSystem;
} else {
  window.GuidedWorkflowSystem = GuidedWorkflowSystem;
}