/**
 * Smart UX Patterns System - Phase 8.6
 * AI-powered behavioral analytics and workflow optimization
 */

class SmartUXPatternsSystem {
  constructor() {
    this.behaviorTracker = new Map();
    this.patterns = new Map();
    this.optimizations = new Map();
    this.userSession = new Map();
    this.analytics = {
      interactions: [],
      workflows: [],
      errors: [],
      performance: [],
      satisfaction: []
    };
    
    // Configuration
    this.config = {
      trackingEnabled: true,
      privacyMode: false, // Anonymize data
      debugMode: false, // Reduce console spam in production
      analysisInterval: 30000, // 30 seconds
      patternMinOccurrences: 3,
      optimizationThreshold: 5,
      sessionTimeout: 1800000, // 30 minutes
      enablePredictiveUI: true,
      enableAutomaticOptimizations: true
    };
    
    this.init();
  }

  init() {
    this.initializeSessionTracking();
    this.setupBehaviorTracking();
    this.registerSmartPatterns();
    this.startAnalysisEngine();
    this.initializeOptimizations();
    
    console.log('Smart UX Patterns System initialized');
  }

  initializeSessionTracking() {
    // Generate session ID
    this.sessionId = this.generateSessionId();
    this.sessionStartTime = Date.now();
    
    // Load previous session data
    this.loadUserProfile();
    
    // Track session info
    this.userSession.set('sessionId', this.sessionId);
    this.userSession.set('startTime', this.sessionStartTime);
    this.userSession.set('userAgent', navigator.userAgent);
    this.userSession.set('viewport', {
      width: window.innerWidth,
      height: window.innerHeight
    });
    this.userSession.set('deviceType', this.detectDeviceType());
  }

  setupBehaviorTracking() {
    // Mouse movement patterns
    this.trackMouseBehavior();
    
    // Click patterns and sequences
    this.trackClickPatterns();
    
    // Keyboard usage patterns
    this.trackKeyboardBehavior();
    
    // Scroll behavior
    this.trackScrollBehavior();
    
    // Focus patterns
    this.trackFocusPatterns();
    
    // Error patterns
    this.trackErrorPatterns();
    
    // Performance patterns
    this.trackPerformancePatterns();
  }

  trackMouseBehavior() {
    let mouseTrail = [];
    let lastMouseTime = 0;
    
    document.addEventListener('mousemove', (e) => {
      if (!this.config.trackingEnabled) return;
      
      const currentTime = Date.now();
      if (currentTime - lastMouseTime < 50) return; // Throttle
      
      mouseTrail.push({
        x: e.clientX,
        y: e.clientY,
        timestamp: currentTime,
        target: e.target ? this.getElementSelector(e.target) : 'unknown'
      });
      
      // Keep only last 50 points
      if (mouseTrail.length > 50) {
        mouseTrail.shift();
      }
      
      this.userSession.set('mouseTrail', mouseTrail);
      lastMouseTime = currentTime;
      
      // Analyze movement patterns
      if (mouseTrail.length >= 10) {
        this.analyzeMousePattern(mouseTrail.slice(-10));
      }
    }, { passive: true });

    // Track mouse dwell time
    let dwellTimer;
    document.addEventListener('mouseover', (e) => {
      if (!this.config.trackingEnabled) return;
      
      dwellTimer = setTimeout(() => {
        this.recordBehavior('mouse_dwell', {
          element: e.target ? this.getElementSelector(e.target) : 'unknown',
          duration: 1000,
          timestamp: Date.now()
        });
      }, 1000);
    });

    document.addEventListener('mouseout', () => {
      clearTimeout(dwellTimer);
    });
  }

  trackClickPatterns() {
    let clickSequence = [];
    
    document.addEventListener('click', (e) => {
      if (!this.config.trackingEnabled) return;
      
      const clickData = {
        element: e.target ? this.getElementSelector(e.target) : 'unknown',
        timestamp: Date.now(),
        coordinates: { x: e.clientX, y: e.clientY },
        isDoubleClick: e.detail === 2,
        modifiers: {
          ctrl: e.ctrlKey,
          shift: e.shiftKey,
          alt: e.altKey,
          meta: e.metaKey
        }
      };
      
      clickSequence.push(clickData);
      
      // Keep last 20 clicks
      if (clickSequence.length > 20) {
        clickSequence.shift();
      }
      
      this.recordBehavior('click', clickData);
      this.analyzeClickPattern(clickSequence);
    });
  }

  trackKeyboardBehavior() {
    let keySequence = [];
    
    document.addEventListener('keydown', (e) => {
      if (!this.config.trackingEnabled) return;
      
      const keyData = {
        key: e.key,
        code: e.code,
        timestamp: Date.now(),
        target: e.target ? this.getElementSelector(e.target) : 'unknown',
        modifiers: {
          ctrl: e.ctrlKey,
          shift: e.shiftKey,
          alt: e.altKey,
          meta: e.metaKey
        }
      };
      
      keySequence.push(keyData);
      
      if (keySequence.length > 50) {
        keySequence.shift();
      }
      
      this.recordBehavior('keyboard', keyData);
      this.analyzeKeyboardPattern(keySequence);
    });
  }

  trackScrollBehavior() {
    let scrollData = [];
    let lastScrollTime = 0;
    
    document.addEventListener('scroll', (e) => {
      if (!this.config.trackingEnabled) return;
      
      const currentTime = Date.now();
      if (currentTime - lastScrollTime < 100) return; // Throttle
      
      const scrollInfo = {
        scrollTop: window.scrollY,
        scrollLeft: window.scrollX,
        timestamp: currentTime,
        target: e.target ? this.getElementSelector(e.target) : 'document'
      };
      
      scrollData.push(scrollInfo);
      
      if (scrollData.length > 100) {
        scrollData.shift();
      }
      
      this.analyzeScrollPattern(scrollData);
      lastScrollTime = currentTime;
    }, { passive: true });
  }

  analyzeScrollPattern(scrollData) {
    try {
      // Analyze scroll patterns for UX insights
      const { scrollTop, scrollLeft, timestamp, target } = scrollData;
      
      // Detect rapid scrolling (potential confusion)
      if (this.lastScrollData) {
        const timeDiff = timestamp - this.lastScrollData.timestamp;
        const scrollDiff = Math.abs(scrollTop - this.lastScrollData.scrollTop);
        
        if (timeDiff < 100 && scrollDiff > 100) {
          this.recordBehavior('rapid_scrolling', {
            scrollDistance: scrollDiff,
            timeFrame: timeDiff,
            target
          });
        }
      }
      
      this.lastScrollData = scrollData;
      
      // Record scroll behavior for pattern analysis
      this.recordBehavior('scroll', scrollData);
      
    } catch (error) {
      // Only log errors in debug mode to avoid console spam
      if (this.config.debugMode) {
        console.warn('Failed to analyze scroll pattern:', error);
      }
    }
  }

  trackFocusPatterns() {
    let focusSequence = [];
    
    document.addEventListener('focus', (e) => {
      if (!this.config.trackingEnabled) return;
      
      const focusData = {
        element: e.target ? this.getElementSelector(e.target) : 'unknown',
        timestamp: Date.now(),
        previousElement: focusSequence.length > 0 ? focusSequence[focusSequence.length - 1].element : null
      };
      
      focusSequence.push(focusData);
      
      if (focusSequence.length > 30) {
        focusSequence.shift();
      }
      
      this.recordBehavior('focus', focusData);
      this.analyzeFocusPattern(focusSequence);
    }, true);
  }

  analyzeFocusPattern(focusSequence) {
    try {
      if (focusSequence.length < 2) return;
      
      // Analyze focus movement patterns
      const recentFocus = focusSequence.slice(-5);
      const focusJumps = this.detectFocusJumping(recentFocus);
      
      if (focusJumps.length > 0) {
        this.recordBehavior('focus_jumping', {
          jumps: focusJumps,
          sequenceLength: focusSequence.length
        });
      }
      
      // Detect tab order issues
      const tabOrderIssues = this.detectTabOrder(focusSequence);
      if (tabOrderIssues.length > 0) {
        this.recordBehavior('tab_order_issues', {
          issues: tabOrderIssues
        });
      }
      
    } catch (error) {
      // Only log errors in debug mode to avoid console spam
      if (this.config.debugMode) {
        console.warn('Failed to analyze focus pattern:', error);
      }
    }
  }

  trackErrorPatterns() {
    // Track JavaScript errors
    window.addEventListener('error', (e) => {
      this.recordBehavior('javascript_error', {
        message: e.message,
        filename: e.filename,
        lineno: e.lineno,
        colno: e.colno,
        timestamp: Date.now()
      });
    });

    // Track network errors
    window.addEventListener('unhandledrejection', (e) => {
      this.recordBehavior('promise_rejection', {
        reason: e.reason?.toString(),
        timestamp: Date.now()
      });
    });

    // Track form validation errors
    document.addEventListener('invalid', (e) => {
      this.recordBehavior('validation_error', {
        element: e.target ? this.getElementSelector(e.target) : 'unknown',
        validationMessage: e.target ? e.target.validationMessage : 'Unknown validation error',
        timestamp: Date.now()
      });
    });
  }

  trackPerformancePatterns() {
    // Track page load performance
    window.addEventListener('load', () => {
      const perfData = performance.getEntriesByType('navigation')[0];
      this.recordBehavior('page_performance', {
        loadTime: perfData.loadEventEnd - perfData.loadEventStart,
        domContentLoaded: perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart,
        firstPaint: this.getFirstPaint(),
        timestamp: Date.now()
      });
    });

    // Track interaction performance
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((entries) => {
        for (const entry of entries.getEntries()) {
          if (entry.entryType === 'measure' || entry.entryType === 'navigation') {
            this.recordBehavior('performance_metric', {
              name: entry.name,
              duration: entry.duration,
              timestamp: Date.now()
            });
          }
        }
      });
      
      observer.observe({ entryTypes: ['measure', 'navigation'] });
    }
  }

  // Pattern analysis methods
  analyzeMousePattern(trail) {
    if (trail.length < 5) return;
    
    // Calculate movement smoothness
    const smoothness = this.calculateMovementSmoothness(trail);
    
    // Detect hesitation patterns
    const hesitation = this.detectHesitation(trail);
    
    // Identify target seeking behavior
    const targetSeeking = this.detectTargetSeeking(trail);
    
    const pattern = {
      type: 'mouse_movement',
      smoothness,
      hesitation,
      targetSeeking,
      timestamp: Date.now()
    };
    
    this.recordPattern('mouse_behavior', pattern);
    
    // Trigger optimizations based on patterns
    if (hesitation.detected) {
      this.suggestUIOptimization('reduce_hesitation', {
        area: hesitation.area,
        suggestion: 'Consider enlarging touch targets or improving visual hierarchy'
      });
    }
  }

  analyzeClickPattern(sequence) {
    if (sequence.length < 3) return;
    
    const recentClicks = sequence.slice(-5);
    
    // Detect rapid clicking (frustration)
    const rapidClicking = this.detectRapidClicking(recentClicks);
    
    // Detect click clustering
    const clustering = this.detectClickClustering(recentClicks);
    
    // Detect misclicks
    const misclicks = this.detectMisclicks(recentClicks);
    
    if (rapidClicking.detected) {
      this.recordPattern('user_frustration', {
        type: 'rapid_clicking',
        element: rapidClicking.element,
        count: rapidClicking.count,
        timestamp: Date.now()
      });
      
      this.suggestUIOptimization('address_frustration', {
        element: rapidClicking.element,
        suggestion: 'Element may need better feedback or loading states'
      });
    }
    
    if (misclicks.detected) {
      this.suggestUIOptimization('improve_accuracy', {
        elements: misclicks.elements,
        suggestion: 'Consider improving spacing or touch target sizes'
      });
    }
  }

  analyzeKeyboardPattern(sequence) {
    if (sequence.length < 5) return;
    
    const recentKeys = sequence.slice(-10);
    
    // Detect keyboard shortcuts usage
    const shortcutUsage = this.detectShortcutUsage(recentKeys);
    
    // Detect typing patterns
    const typingPatterns = this.detectTypingPatterns(recentKeys);
    
    // Detect backspace frequency (input difficulties)
    const backspaceFreq = this.calculateBackspaceFrequency(recentKeys);
    
    if (shortcutUsage.detected) {
      this.recordPattern('power_user_behavior', {
        shortcuts: shortcutUsage.shortcuts,
        frequency: shortcutUsage.frequency,
        timestamp: Date.now()
      });
    }
    
    if (backspaceFreq > 0.3) { // More than 30% backspace
      this.suggestUIOptimization('improve_input', {
        suggestion: 'Consider input validation or autocomplete features'
      });
    }
  }

  analyzeFocusPattern(sequence) {
    if (sequence.length < 3) return;
    
    // Detect tab trap issues
    const tabTraps = this.detectTabTraps(sequence);
    
    // Detect focus jumping
    const focusJumping = this.detectFocusJumping(sequence);
    
    // Analyze tab order efficiency
    const tabOrderEfficiency = this.analyzeTabOrder(sequence);
    
    if (tabTraps.detected) {
      this.suggestUIOptimization('fix_tab_traps', {
        elements: tabTraps.elements,
        suggestion: 'Improve keyboard navigation flow'
      });
    }
    
    if (tabOrderEfficiency < 0.7) {
      this.suggestUIOptimization('optimize_tab_order', {
        suggestion: 'Consider reordering focusable elements for better UX'
      });
    }
  }

  // Smart pattern recognition
  registerSmartPatterns() {
    // Workflow efficiency patterns
    this.patterns.set('efficient_workflow', {
      detect: (behaviors) => this.detectEfficientWorkflow(behaviors),
      optimize: (pattern) => this.optimizeWorkflow(pattern)
    });

    // User expertise patterns
    this.patterns.set('expertise_level', {
      detect: (behaviors) => this.detectExpertiseLevel(behaviors),
      optimize: (pattern) => this.adaptToExpertise(pattern)
    });

    // Content preference patterns
    this.patterns.set('content_preferences', {
      detect: (behaviors) => this.detectContentPreferences(behaviors),
      optimize: (pattern) => this.personalizeContent(pattern)
    });

    // Error recovery patterns
    this.patterns.set('error_recovery', {
      detect: (behaviors) => this.detectErrorRecovery(behaviors),
      optimize: (pattern) => this.improveErrorHandling(pattern)
    });

    // Mobile usage patterns
    this.patterns.set('mobile_behavior', {
      detect: (behaviors) => this.detectMobileBehavior(behaviors),
      optimize: (pattern) => this.optimizeMobileExperience(pattern)
    });
  }

  detectEfficientWorkflow(behaviors) {
    const workflowActions = behaviors.filter(b => 
      b.type === 'click' && 
      (b.data.element.includes('btn') || b.data.element.includes('button'))
    );
    
    if (workflowActions.length < 3) return null;
    
    // Analyze action sequences
    const sequences = this.findActionSequences(workflowActions);
    const efficiency = this.calculateWorkflowEfficiency(sequences);
    
    return {
      efficiency,
      sequences,
      commonPaths: this.identifyCommonPaths(sequences),
      bottlenecks: this.identifyBottlenecks(sequences)
    };
  }

  detectExpertiseLevel(behaviors) {
    const expertiseIndicators = {
      keyboardShortcuts: behaviors.filter(b => 
        b.type === 'keyboard' && 
        (b.data.modifiers.ctrl || b.data.modifiers.meta)
      ).length,
      
      rapidInteractions: behaviors.filter(b => 
        b.type === 'click' && 
        this.isRapidInteraction(b, behaviors)
      ).length,
      
      advancedFeatureUsage: behaviors.filter(b =>
        b.type === 'click' && 
        this.isAdvancedFeature(b.data.element)
      ).length,
      
      errorRate: behaviors.filter(b => b.type.includes('error')).length / behaviors.length
    };
    
    const expertiseScore = this.calculateExpertiseScore(expertiseIndicators);
    
    return {
      level: this.classifyExpertiseLevel(expertiseScore),
      indicators: expertiseIndicators,
      score: expertiseScore
    };
  }

  // Optimization suggestions
  suggestUIOptimization(type, data) {
    const optimization = {
      id: this.generateOptimizationId(),
      type,
      data,
      timestamp: Date.now(),
      priority: this.calculateOptimizationPriority(type, data),
      implemented: false
    };
    
    this.optimizations.set(optimization.id, optimization);
    
    // Auto-implement high priority optimizations
    if (this.config.enableAutomaticOptimizations && optimization.priority >= 0.8) {
      this.implementOptimization(optimization);
    }
    
    // Notify other systems
    this.notifyOptimizationSuggested(optimization);
  }

  implementOptimization(optimization) {
    switch (optimization.type) {
      case 'reduce_hesitation':
        this.implementHesitationReduction(optimization.data);
        break;
        
      case 'improve_accuracy':
        this.implementAccuracyImprovement(optimization.data);
        break;
        
      case 'optimize_workflow':
        this.implementWorkflowOptimization(optimization.data);
        break;
        
      case 'personalize_interface':
        this.implementInterfacePersonalization(optimization.data);
        break;
    }
    
    optimization.implemented = true;
    optimization.implementedAt = Date.now();
  }

  implementHesitationReduction(data) {
    // Increase visual prominence of hesitation areas
    const elements = document.querySelectorAll(data.area);
    elements.forEach(element => {
      element.style.transition = 'all 0.3s ease';
      element.style.boxShadow = '0 0 10px rgba(0, 123, 255, 0.3)';
      element.style.borderRadius = '8px';
    });
  }

  implementAccuracyImprovement(data) {
    // Increase touch target sizes
    data.elements.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        element.style.minHeight = '44px';
        element.style.minWidth = '44px';
        element.style.padding = '0.75rem 1rem';
      });
    });
  }

  // Predictive UI enhancements
  startAnalysisEngine() {
    setInterval(() => {
      this.performBehaviorAnalysis();
      this.updatePredictions();
      this.optimizePerformance();
    }, this.config.analysisInterval);
  }

  performBehaviorAnalysis() {
    const recentBehaviors = this.getRecentBehaviors(300000); // Last 5 minutes
    
    // Analyze patterns
    for (const [patternName, patternConfig] of this.patterns) {
      const pattern = patternConfig.detect(recentBehaviors);
      if (pattern) {
        this.recordPattern(patternName, pattern);
        patternConfig.optimize(pattern);
      }
    }
    
    // Generate insights
    this.generateUserInsights(recentBehaviors);
  }

  updatePredictions() {
    if (!this.config.enablePredictiveUI) return;
    
    const predictions = this.generatePredictions();
    
    // Preload likely next actions
    predictions.forEach(prediction => {
      if (prediction.confidence > 0.7) {
        this.preloadPredictedAction(prediction);
      }
    });
  }

  generatePredictions() {
    const recentBehaviors = this.getRecentBehaviors(60000); // Last minute
    const predictions = [];
    
    // Predict next likely clicks based on patterns
    const clickPrediction = this.predictNextClick(recentBehaviors);
    if (clickPrediction) {
      predictions.push(clickPrediction);
    }
    
    // Predict workflow completion
    const workflowPrediction = this.predictWorkflowCompletion(recentBehaviors);
    if (workflowPrediction) {
      predictions.push(workflowPrediction);
    }
    
    return predictions;
  }

  preloadPredictedAction(prediction) {
    switch (prediction.type) {
      case 'modal_open':
        // Preload modal content
        this.preloadModalContent(prediction.target);
        break;
        
      case 'image_load':
        // Preload images
        this.preloadImages(prediction.images);
        break;
        
      case 'api_call':
        // Prefetch API data
        this.prefetchAPIData(prediction.endpoint);
        break;
    }
  }

  // Analytics and reporting
  generateUserInsights(behaviors) {
    const insights = {
      sessionDuration: Date.now() - this.sessionStartTime,
      totalInteractions: behaviors.length,
      interactionRate: behaviors.length / ((Date.now() - this.sessionStartTime) / 60000), // per minute
      primaryWorkflows: this.identifyPrimaryWorkflows(behaviors),
      expertiseIndicators: this.detectExpertiseLevel(behaviors),
      satisfactionScore: this.calculateSatisfactionScore(behaviors),
      painPoints: this.identifyPainPoints(behaviors),
      efficiencyMetrics: this.calculateEfficiencyMetrics(behaviors)
    };
    
    this.userSession.set('insights', insights);
    
    // Update progressive disclosure system
    if (window.progressiveDisclosureSystem) {
      this.updateProgressiveDisclosure(insights);
    }
    
    // Update guided workflow system
    if (window.guidedWorkflowSystem) {
      this.updateGuidedWorkflows(insights);
    }
  }

  calculateSatisfactionScore(behaviors) {
    let score = 1.0;
    
    // Reduce score for errors
    const errorRate = behaviors.filter(b => b.type.includes('error')).length / behaviors.length;
    score -= errorRate * 0.5;
    
    // Reduce score for hesitation
    const hesitationBehaviors = behaviors.filter(b => b.type === 'mouse_dwell' && b.data.duration > 2000);
    score -= (hesitationBehaviors.length / behaviors.length) * 0.3;
    
    // Increase score for successful completions
    const successBehaviors = behaviors.filter(b => b.type === 'success_feedback');
    score += (successBehaviors.length / behaviors.length) * 0.2;
    
    return Math.max(0, Math.min(1, score));
  }

  identifyPainPoints(behaviors) {
    const painPoints = [];
    
    // High error rate areas
    const errorsByElement = new Map();
    behaviors.filter(b => b.type.includes('error')).forEach(b => {
      const element = b.data.element || 'unknown';
      errorsByElement.set(element, (errorsByElement.get(element) || 0) + 1);
    });
    
    for (const [element, count] of errorsByElement) {
      if (count >= 3) {
        painPoints.push({
          type: 'high_error_rate',
          element,
          count,
          severity: count > 5 ? 'high' : 'medium'
        });
      }
    }
    
    // Long hesitation areas
    const hesitationByElement = new Map();
    behaviors.filter(b => b.type === 'mouse_dwell').forEach(b => {
      const element = b.data.element;
      hesitationByElement.set(element, (hesitationByElement.get(element) || 0) + 1);
    });
    
    for (const [element, count] of hesitationByElement) {
      if (count >= 5) {
        painPoints.push({
          type: 'user_hesitation',
          element,
          count,
          severity: 'medium'
        });
      }
    }
    
    return painPoints;
  }

  // Missing pattern analysis methods implementation
  calculateMovementSmoothness(trail) {
    if (trail.length < 3) return 1;
    
    let totalDistance = 0;
    let totalTime = 0;
    let directionChanges = 0;
    
    for (let i = 1; i < trail.length; i++) {
      const prev = trail[i - 1];
      const curr = trail[i];
      
      const distance = Math.sqrt(
        Math.pow(curr.x - prev.x, 2) + Math.pow(curr.y - prev.y, 2)
      );
      const time = curr.timestamp - prev.timestamp;
      
      totalDistance += distance;
      totalTime += time;
      
      // Check for direction changes
      if (i >= 2) {
        const prevPrev = trail[i - 2];
        const angle1 = Math.atan2(prev.y - prevPrev.y, prev.x - prevPrev.x);
        const angle2 = Math.atan2(curr.y - prev.y, curr.x - prev.x);
        const angleDiff = Math.abs(angle2 - angle1);
        
        if (angleDiff > Math.PI / 4) { // 45 degrees threshold
          directionChanges++;
        }
      }
    }
    
    const avgVelocity = totalDistance / totalTime;
    const smoothness = Math.max(0, 1 - (directionChanges / trail.length));
    
    return {
      smoothness,
      avgVelocity,
      directionChanges,
      totalDistance
    };
  }

  detectHesitation(trail) {
    let hesitationPoints = [];
    let currentHesitation = null;
    
    for (let i = 1; i < trail.length; i++) {
      const prev = trail[i - 1];
      const curr = trail[i];
      const distance = Math.sqrt(
        Math.pow(curr.x - prev.x, 2) + Math.pow(curr.y - prev.y, 2)
      );
      const time = curr.timestamp - prev.timestamp;
      
      if (distance < 5 && time > 200) { // Slow movement = hesitation
        if (!currentHesitation) {
          currentHesitation = {
            startTime: prev.timestamp,
            area: prev.target,
            duration: 0
          };
        }
        currentHesitation.duration = curr.timestamp - currentHesitation.startTime;
      } else {
        if (currentHesitation && currentHesitation.duration > 500) {
          hesitationPoints.push(currentHesitation);
        }
        currentHesitation = null;
      }
    }
    
    return {
      detected: hesitationPoints.length > 0,
      points: hesitationPoints,
      area: hesitationPoints.length > 0 ? hesitationPoints[0].area : null
    };
  }

  detectTargetSeeking(trail) {
    if (trail.length < 5) return { detected: false };
    
    const endTarget = trail[trail.length - 1].target;
    let targetChanges = 0;
    let lastTarget = trail[0].target;
    
    for (const point of trail) {
      if (point.target !== lastTarget) {
        targetChanges++;
        lastTarget = point.target;
      }
    }
    
    return {
      detected: targetChanges > 2,
      changes: targetChanges,
      finalTarget: endTarget,
      seeking: targetChanges > trail.length * 0.3 // More than 30% target changes
    };
  }

  detectRapidClicking(clicks) {
    if (clicks.length < 3) return { detected: false };
    
    const recentClicks = clicks.slice(-5);
    const timeWindow = 2000; // 2 seconds
    const firstClick = recentClicks[0];
    const lastClick = recentClicks[recentClicks.length - 1];
    
    if (lastClick.timestamp - firstClick.timestamp < timeWindow) {
      const sameElement = recentClicks.every(click => 
        click.element === firstClick.element
      );
      
      if (sameElement && recentClicks.length >= 3) {
        return {
          detected: true,
          count: recentClicks.length,
          element: firstClick.element,
          timeSpan: lastClick.timestamp - firstClick.timestamp
        };
      }
    }
    
    return { detected: false };
  }

  detectClickClustering(clicks) {
    const clusters = [];
    const clusterRadius = 50; // pixels
    
    for (const click of clicks) {
      let addedToCluster = false;
      
      for (const cluster of clusters) {
        const distance = Math.sqrt(
          Math.pow(click.coordinates.x - cluster.centerX, 2) +
          Math.pow(click.coordinates.y - cluster.centerY, 2)
        );
        
        if (distance <= clusterRadius) {
          cluster.clicks.push(click);
          cluster.centerX = cluster.clicks.reduce((sum, c) => sum + c.coordinates.x, 0) / cluster.clicks.length;
          cluster.centerY = cluster.clicks.reduce((sum, c) => sum + c.coordinates.y, 0) / cluster.clicks.length;
          addedToCluster = true;
          break;
        }
      }
      
      if (!addedToCluster) {
        clusters.push({
          clicks: [click],
          centerX: click.coordinates.x,
          centerY: click.coordinates.y
        });
      }
    }
    
    return {
      clusters: clusters.filter(c => c.clicks.length > 1),
      detected: clusters.some(c => c.clicks.length > 2)
    };
  }

  detectMisclicks(clicks) {
    const misclicks = [];
    
    for (let i = 1; i < clicks.length; i++) {
      const prev = clicks[i - 1];
      const curr = clicks[i];
      const timeDiff = curr.timestamp - prev.timestamp;
      const distance = Math.sqrt(
        Math.pow(curr.coordinates.x - prev.coordinates.x, 2) +
        Math.pow(curr.coordinates.y - prev.coordinates.y, 2)
      );
      
      // Quick successive clicks in different areas = likely misclick
      if (timeDiff < 500 && distance > 100 && prev.element !== curr.element) {
        misclicks.push({
          original: prev,
          correction: curr,
          distance,
          timeDiff
        });
      }
    }
    
    return {
      detected: misclicks.length > 0,
      misclicks,
      elements: [...new Set(misclicks.map(m => m.original.element))]
    };
  }

  detectShortcutUsage(keySequence) {
    const shortcuts = [];
    
    for (const keyData of keySequence) {
      if (keyData.modifiers.ctrl || keyData.modifiers.meta) {
        const shortcut = `${keyData.modifiers.ctrl ? 'Ctrl' : 'Cmd'}+${keyData.key}`;
        shortcuts.push(shortcut);
      }
    }
    
    const uniqueShortcuts = [...new Set(shortcuts)];
    
    return {
      detected: shortcuts.length > 0,
      shortcuts: uniqueShortcuts,
      frequency: shortcuts.length / keySequence.length,
      totalUsage: shortcuts.length
    };
  }

  detectTypingPatterns(keySequence) {
    const typingKeys = keySequence.filter(k => 
      k.key.length === 1 || k.key === 'Backspace' || k.key === 'Space'
    );
    
    if (typingKeys.length < 5) return { detected: false };
    
    let totalTime = 0;
    let intervals = [];
    
    for (let i = 1; i < typingKeys.length; i++) {
      const interval = typingKeys[i].timestamp - typingKeys[i - 1].timestamp;
      intervals.push(interval);
      totalTime += interval;
    }
    
    const avgInterval = totalTime / intervals.length;
    const wpm = (60000 / avgInterval) * 5; // Approximate WPM calculation
    
    return {
      detected: true,
      avgInterval,
      estimatedWPM: Math.round(wpm),
      consistency: this.calculateConsistency(intervals)
    };
  }

  calculateBackspaceFrequency(keySequence) {
    const backspaces = keySequence.filter(k => k.key === 'Backspace').length;
    const totalKeys = keySequence.filter(k => k.key.length === 1 || k.key === 'Space').length;
    
    return totalKeys > 0 ? backspaces / totalKeys : 0;
  }

  detectTabTraps(focusSequence) {
    const traps = [];
    
    for (let i = 2; i < focusSequence.length; i++) {
      const current = focusSequence[i];
      const prev = focusSequence[i - 1];
      const prevPrev = focusSequence[i - 2];
      
      // Check for cycling between same elements
      if (current.element === prevPrev.element && current.element !== prev.element) {
        traps.push({
          elements: [prevPrev.element, prev.element, current.element],
          timestamp: current.timestamp
        });
      }
    }
    
    return {
      detected: traps.length > 0,
      traps,
      elements: [...new Set(traps.flatMap(t => t.elements))]
    };
  }

  detectFocusJumping(focusSequence) {
    if (focusSequence.length < 3) return { detected: false };
    
    let jumps = 0;
    
    for (let i = 1; i < focusSequence.length; i++) {
      const prev = focusSequence[i - 1];
      const curr = focusSequence[i];
      const timeDiff = curr.timestamp - prev.timestamp;
      
      // Very fast focus changes might indicate jumping
      if (timeDiff < 100) {
        jumps++;
      }
    }
    
    return {
      detected: jumps > focusSequence.length * 0.3,
      jumpCount: jumps,
      percentage: jumps / focusSequence.length
    };
  }

  analyzeTabOrder(focusSequence) {
    if (focusSequence.length < 3) return 1;
    
    let logicalMoves = 0;
    let totalMoves = focusSequence.length - 1;
    
    // This is a simplified analysis - in a real implementation,
    // you'd want to analyze the actual DOM structure
    for (let i = 1; i < focusSequence.length; i++) {
      const prev = focusSequence[i - 1];
      const curr = focusSequence[i];
      
      // Check if the focus move makes logical sense
      // This is a placeholder - real implementation would check DOM order
      if (this.isLogicalFocusMove(prev.element, curr.element)) {
        logicalMoves++;
      }
    }
    
    return logicalMoves / totalMoves;
  }

  isLogicalFocusMove(fromElement, toElement) {
    // Simplified logic - in reality, this would analyze DOM structure
    // For now, assume moves between similar element types are logical
    const fromType = fromElement.split('.')[0];
    const toType = toElement.split('.')[0];
    
    return fromType === toType || 
           (fromType === 'input' && toType === 'button') ||
           (fromType === 'button' && toType === 'input');
  }

  calculateConsistency(intervals) {
    if (intervals.length < 2) return 1;
    
    const mean = intervals.reduce((a, b) => a + b) / intervals.length;
    const variance = intervals.reduce((sum, interval) => 
      sum + Math.pow(interval - mean, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);
    
    // Return consistency as a value between 0 and 1
    return Math.max(0, 1 - (stdDev / mean));
  }

  // Pattern analysis implementation
  findActionSequences(actions) {
    const sequences = [];
    const sequenceLength = 3;
    
    for (let i = 0; i <= actions.length - sequenceLength; i++) {
      const sequence = actions.slice(i, i + sequenceLength);
      const pattern = sequence.map(a => a.data.element).join(' -> ');
      sequences.push({ pattern, actions: sequence });
    }
    
    return sequences;
  }

  calculateWorkflowEfficiency(sequences) {
    if (sequences.length === 0) return 1;
    
    // Count repeated sequences (common workflows)
    const patternCounts = new Map();
    for (const seq of sequences) {
      patternCounts.set(seq.pattern, (patternCounts.get(seq.pattern) || 0) + 1);
    }
    
    const repeatedSequences = Array.from(patternCounts.values())
      .filter(count => count > 1);
    
    // Efficiency = ratio of repeated (learned) workflows
    return repeatedSequences.length / sequences.length;
  }

  identifyCommonPaths(sequences) {
    const pathCounts = new Map();
    
    for (const seq of sequences) {
      pathCounts.set(seq.pattern, (pathCounts.get(seq.pattern) || 0) + 1);
    }
    
    return Array.from(pathCounts.entries())
      .filter(([pattern, count]) => count > 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([pattern, count]) => ({ pattern, count }));
  }

  identifyBottlenecks(sequences) {
    // Identify elements that appear frequently in sequences (potential bottlenecks)
    const elementCounts = new Map();
    
    for (const seq of sequences) {
      for (const action of seq.actions) {
        const element = action.data.element;
        elementCounts.set(element, (elementCounts.get(element) || 0) + 1);
      }
    }
    
    return Array.from(elementCounts.entries())
      .filter(([element, count]) => count > sequences.length * 0.5)
      .map(([element, count]) => ({ element, frequency: count / sequences.length }));
  }

  isRapidInteraction(behavior, allBehaviors) {
    const behaviorIndex = allBehaviors.indexOf(behavior);
    if (behaviorIndex === 0) return false;
    
    const prevBehavior = allBehaviors[behaviorIndex - 1];
    return behavior.timestamp - prevBehavior.timestamp < 1000; // Less than 1 second
  }

  isAdvancedFeature(elementSelector) {
    const advancedFeatures = [
      'batch', 'advanced', 'export', 'import', 'api', 'webhook',
      'automation', 'bulk', 'mass', 'filter', 'sort', 'search'
    ];
    
    return advancedFeatures.some(feature => 
      elementSelector.toLowerCase().includes(feature)
    );
  }

  calculateExpertiseScore(indicators) {
    let score = 0;
    
    // Keyboard shortcuts usage (0-0.3)
    score += Math.min(0.3, indicators.keyboardShortcuts * 0.05);
    
    // Rapid interactions (0-0.25)
    score += Math.min(0.25, indicators.rapidInteractions * 0.02);
    
    // Advanced feature usage (0-0.3)
    score += Math.min(0.3, indicators.advancedFeatureUsage * 0.1);
    
    // Low error rate bonus (0-0.15)
    score += Math.max(0, 0.15 - indicators.errorRate);
    
    return Math.min(1, score);
  }

  classifyExpertiseLevel(score) {
    if (score >= 0.8) return 'expert';
    if (score >= 0.6) return 'advanced';
    if (score >= 0.4) return 'intermediate';
    return 'beginner';
  }

  detectContentPreferences(behaviors) {
    const clicksByElement = new Map();
    const timeSpentByArea = new Map();
    
    for (const behavior of behaviors) {
      if (behavior.type === 'click') {
        const element = behavior.data.element;
        clicksByElement.set(element, (clicksByElement.get(element) || 0) + 1);
      } else if (behavior.type === 'mouse_dwell') {
        const area = behavior.data.element;
        timeSpentByArea.set(area, (timeSpentByArea.get(area) || 0) + behavior.data.duration);
      }
    }
    
    return {
      preferredElements: Array.from(clicksByElement.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5),
      timeSpentAreas: Array.from(timeSpentByArea.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
    };
  }

  detectErrorRecovery(behaviors) {
    const errors = behaviors.filter(b => b.type.includes('error'));
    const recoveries = [];
    
    for (const error of errors) {
      const nextActions = behaviors.filter(b => 
        b.timestamp > error.timestamp && 
        b.timestamp < error.timestamp + 30000 // 30 seconds
      ).slice(0, 5);
      
      if (nextActions.length > 0) {
        recoveries.push({
          error,
          recoveryActions: nextActions,
          recoveryTime: nextActions[0].timestamp - error.timestamp
        });
      }
    }
    
    return {
      errors: errors.length,
      recoveries: recoveries.length,
      avgRecoveryTime: recoveries.length > 0 ? 
        recoveries.reduce((sum, r) => sum + r.recoveryTime, 0) / recoveries.length : 0,
      recoveryRate: errors.length > 0 ? recoveries.length / errors.length : 1
    };
  }

  detectMobileBehavior(behaviors) {
    const touchEvents = behaviors.filter(b => 
      b.type === 'touch' || b.type === 'swipe' || b.type === 'pinch'
    );
    
    const scrollEvents = behaviors.filter(b => b.type === 'scroll');
    const rapidScrolls = scrollEvents.filter((scroll, index) => {
      if (index === 0) return false;
      const prevScroll = scrollEvents[index - 1];
      return scroll.timestamp - prevScroll.timestamp < 100;
    });
    
    return {
      touchUsage: touchEvents.length / behaviors.length,
      scrollIntensity: rapidScrolls.length / scrollEvents.length,
      isMobilePrimary: touchEvents.length > behaviors.length * 0.3
    };
  }

  // Implementation methods for optimizations
  optimizeWorkflow(pattern) {
    if (pattern.efficiency < 0.5) {
      this.suggestUIOptimization('optimize_workflow', {
        bottlenecks: pattern.bottlenecks,
        suggestion: 'Consider creating shortcuts or reorganizing frequently used features'
      });
    }
  }

  adaptToExpertise(pattern) {
    if (pattern.level === 'expert') {
      this.suggestUIOptimization('show_advanced_features', {
        suggestion: 'Enable advanced mode with more power user features'
      });
    } else if (pattern.level === 'beginner') {
      this.suggestUIOptimization('simplify_interface', {
        suggestion: 'Hide advanced features and show more guidance'
      });
    }
  }

  personalizeContent(pattern) {
    const preferences = pattern.preferredElements;
    if (preferences && preferences.length > 0) {
      this.suggestUIOptimization('personalize_interface', {
        preferredFeatures: preferences,
        suggestion: 'Prioritize frequently used features in the interface'
      });
    }
  }

  improveErrorHandling(pattern) {
    if (pattern.recoveryRate < 0.7) {
      this.suggestUIOptimization('improve_error_handling', {
        avgRecoveryTime: pattern.avgRecoveryTime,
        suggestion: 'Improve error messages and recovery guidance'
      });
    }
  }

  optimizeMobileExperience(pattern) {
    if (pattern.isMobilePrimary) {
      this.suggestUIOptimization('optimize_mobile', {
        touchUsage: pattern.touchUsage,
        suggestion: 'Optimize interface for touch interactions'
      });
    }
  }

  implementWorkflowOptimization(data) {
    // Create quick action buttons for frequently used workflows
    const quickActions = document.createElement('div');
    quickActions.className = 'workflow-quick-actions';
    quickActions.innerHTML = `
      <div class="quick-actions-header">
        <i class="fas fa-bolt"></i>
        <span>Quick Actions</span>
      </div>
      <div class="quick-actions-list">
        ${data.bottlenecks.map(bottleneck => `
          <button class="btn btn-sm btn-outline-primary quick-action-btn" 
                  data-target="${bottleneck.element}">
            ${this.getElementDisplayName(bottleneck.element)}
          </button>
        `).join('')}
      </div>
    `;
    
    const toolbar = document.querySelector('.gallery-toolbar') || document.body;
    toolbar.appendChild(quickActions);
  }

  implementInterfacePersonalization(data) {
    // Reorder interface elements based on usage frequency
    const preferredElements = data.preferredFeatures;
    
    preferredElements.forEach((element, index) => {
      const domElement = document.querySelector(element[0]);
      if (domElement && domElement.parentNode) {
        domElement.style.order = index;
        domElement.classList.add('frequently-used');
      }
    });
  }

  getElementDisplayName(selector) {
    // Convert selector to user-friendly name
    const names = {
      'button.btn-primary': 'Save',
      'button.btn-danger': 'Delete', 
      '.image-picker': 'Image Picker',
      '.section-header': 'Section',
      '.gallery-grid': 'Gallery'
    };
    
    return names[selector] || selector.replace(/[.#]/g, '').replace(/-/g, ' ');
  }

  // Prediction methods
  predictNextClick(behaviors) {
    const recentClicks = behaviors
      .filter(b => b.type === 'click')
      .slice(-10);
    
    if (recentClicks.length < 3) return null;
    
    // Find most common next click after recent pattern
    const patterns = new Map();
    
    for (let i = 0; i < recentClicks.length - 1; i++) {
      const current = recentClicks[i].data.element;
      const next = recentClicks[i + 1].data.element;
      const pattern = `${current} -> ${next}`;
      
      patterns.set(pattern, (patterns.get(pattern) || 0) + 1);
    }
    
    const mostCommon = Array.from(patterns.entries())
      .sort((a, b) => b[1] - a[1])[0];
    
    if (mostCommon && mostCommon[1] > 1) {
      const lastClick = recentClicks[recentClicks.length - 1].data.element;
      const predictedNext = mostCommon[0].split(' -> ')[1];
      
      return {
        type: 'click_prediction',
        target: predictedNext,
        confidence: Math.min(0.9, mostCommon[1] / recentClicks.length)
      };
    }
    
    return null;
  }

  predictWorkflowCompletion(behaviors) {
    const workflowSteps = behaviors
      .filter(b => b.type === 'click')
      .slice(-5)
      .map(b => b.data.element);
    
    // Common workflow patterns in gallery
    const workflows = {
      'image_selection': ['image-picker', 'gallery-grid', 'btn-primary'],
      'batch_operation': ['select-all', 'batch-actions', 'confirm-btn'],
      'section_creation': ['add-section', 'section-title', 'save-section']
    };
    
    for (const [workflowName, steps] of Object.entries(workflows)) {
      let matchCount = 0;
      let lastMatchIndex = -1;
      
      for (let i = 0; i < steps.length; i++) {
        const stepIndex = workflowSteps.findIndex(s => s.includes(steps[i]));
        if (stepIndex > lastMatchIndex) {
          matchCount++;
          lastMatchIndex = stepIndex;
        }
      }
      
      const progress = matchCount / steps.length;
      if (progress >= 0.5 && progress < 1) {
        const nextStep = steps[matchCount];
        return {
          type: 'workflow_completion',
          workflow: workflowName,
          nextStep,
          progress,
          confidence: progress
        };
      }
    }
    
    return null;
  }

  preloadModalContent(target) {
    const modalElement = document.querySelector(`[data-bs-target="${target}"]`);
    if (modalElement && !modalElement.dataset.preloaded) {
      // Preload modal content
      modalElement.dataset.preloaded = 'true';
      // Implementation would fetch and cache modal content
    }
  }

  preloadImages(imageList) {
    imageList.forEach(src => {
      const img = new Image();
      img.src = src;
    });
  }

  prefetchAPIData(endpoint) {
    if (this.prefetchedEndpoints.has(endpoint)) return;
    
    this.prefetchedEndpoints.add(endpoint);
    fetch(endpoint, { method: 'HEAD' })
      .catch(() => {}); // Silent fail for prefetch
  }

  identifyPrimaryWorkflows(behaviors) {
    const clickSequences = behaviors
      .filter(b => b.type === 'click')
      .map(b => b.data.element);
    
    const workflows = new Map();
    const windowSize = 4;
    
    for (let i = 0; i <= clickSequences.length - windowSize; i++) {
      const sequence = clickSequences.slice(i, i + windowSize).join(' -> ');
      workflows.set(sequence, (workflows.get(sequence) || 0) + 1);
    }
    
    return Array.from(workflows.entries())
      .filter(([seq, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([sequence, count]) => ({ sequence, frequency: count }));
  }

  calculateEfficiencyMetrics(behaviors) {
    const totalTime = Date.now() - this.sessionStartTime;
    const actionCount = behaviors.filter(b => b.type === 'click').length;
    const errorCount = behaviors.filter(b => b.type.includes('error')).length;
    
    return {
      actionsPerMinute: (actionCount / (totalTime / 60000)),
      errorRate: errorCount / actionCount,
      sessionProductivity: Math.max(0, 1 - (errorCount * 0.1))
    };
  }

  updateProgressiveDisclosure(insights) {
    if (insights.expertiseIndicators.level === 'expert') {
      document.querySelectorAll('.advanced-feature').forEach(el => {
        el.style.display = 'block';
      });
    } else if (insights.expertiseIndicators.level === 'beginner') {
      document.querySelectorAll('.advanced-feature').forEach(el => {
        el.style.display = 'none';
      });
    }
  }

  updateGuidedWorkflows(insights) {
    if (insights.satisfactionScore < 0.7 && insights.sessionDuration > 300000) {
      // Show guidance after 5 minutes if user seems to be struggling
      window.dispatchEvent(new CustomEvent('show-guided-help', {
        detail: { reason: 'low_satisfaction', insights }
      }));
    }
  }

  getFirstPaint() {
    try {
      const paintEntries = performance.getEntriesByType('paint');
      const firstPaint = paintEntries.find(entry => entry.name === 'first-paint');
      return firstPaint ? firstPaint.startTime : 0;
    } catch (error) {
      return 0;
    }
  }

  generalizeSelector(selector) {
    // Remove specific IDs and classes for privacy
    return selector
      .replace(/#[a-zA-Z0-9_-]+/g, '#id')
      .replace(/\.[a-zA-Z0-9_-]+/g, '.class');
  }

  // Initialize missing properties
  init() {
    this.initializeSessionTracking();
    this.setupBehaviorTracking();
    this.registerSmartPatterns();
    this.startAnalysisEngine();
    this.initializeOptimizations();
    
    // Initialize missing properties
    this.prefetchedEndpoints = new Set();
    this.userProfile = this.loadUserProfile();
    
    console.log('Smart UX Patterns System initialized');
  }

  initializeOptimizations() {
    // Set up optimization implementations
    this.optimizationImplementations = new Map([
      ['reduce_hesitation', this.implementHesitationReduction.bind(this)],
      ['improve_accuracy', this.implementAccuracyImprovement.bind(this)],
      ['optimize_workflow', this.implementWorkflowOptimization.bind(this)],
      ['personalize_interface', this.implementInterfacePersonalization.bind(this)]
    ]);
  }

  // Utility methods
  recordBehavior(type, data) {
    if (!this.config.trackingEnabled) return;
    
    try {
      const behavior = {
        type,
        data: this.config.privacyMode ? this.anonymizeData(data) : data,
        sessionId: this.sessionId,
        timestamp: Date.now()
      };
      
      this.analytics.interactions.push(behavior);
      
      // Keep only recent behaviors in memory
      if (this.analytics.interactions.length > 1000) {
        this.analytics.interactions = this.analytics.interactions.slice(-500);
      }
    } catch (error) {
      // Only log errors in development mode to avoid console spam
      if (this.config.debugMode) {
        console.warn('Failed to record behavior:', error);
      }
    }
  }

  recordPattern(name, pattern) {
    try {
      const patternRecord = {
        name,
        pattern,
        sessionId: this.sessionId,
        timestamp: Date.now()
      };
      
      this.analytics.workflows.push(patternRecord);
    } catch (error) {
      // Only log errors in development mode to avoid console spam
      if (this.config.debugMode) {
        console.warn('Failed to record pattern:', error);
      }
    }
  }

  getRecentBehaviors(timeWindow) {
    const cutoff = Date.now() - timeWindow;
    return this.analytics.interactions.filter(b => b.timestamp >= cutoff);
  }

  getElementSelector(element) {
    if (!element || !element.tagName) return 'unknown';
    
    try {
      // Create a meaningful selector
      let selector = element.tagName.toLowerCase();
      
      if (element.id) {
        selector += `#${element.id}`;
      } else if (element.className && typeof element.className === 'string') {
        const classes = element.className.split(' ').filter(c => c.trim());
        if (classes.length > 0) {
          selector += `.${classes[0]}`;
        }
      }
      
      return selector;
    } catch (error) {
      console.warn('Error getting element selector:', error);
      return 'unknown';
    }
  }

  anonymizeData(data) {
    // Remove or hash sensitive information
    const anonymized = { ...data };
    
    if (anonymized.coordinates) {
      // Rough coordinates
      anonymized.coordinates = {
        x: Math.round(anonymized.coordinates.x / 50) * 50,
        y: Math.round(anonymized.coordinates.y / 50) * 50
      };
    }
    
    if (anonymized.target) {
      // Generalize element selectors
      anonymized.target = this.generalizeSelector(anonymized.target);
    }
    
    return anonymized;
  }

  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateOptimizationId() {
    return `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  detectDeviceType() {
    const userAgent = navigator.userAgent;
    if (/Mobile|Android|iPhone|iPad/.test(userAgent)) {
      return 'mobile';
    } else if (/Tablet/.test(userAgent)) {
      return 'tablet';
    }
    return 'desktop';
  }

  loadUserProfile() {
    try {
      const saved = localStorage.getItem('smart-ux-profile');
      if (saved) {
        const profile = JSON.parse(saved);
        this.userProfile = profile;
        return profile;
      }
    } catch (error) {
      console.warn('Failed to load user profile:', error);
    }
    
    return {
      sessions: [],
      patterns: {},
      preferences: {},
      expertiseLevel: 'beginner'
    };
  }

  saveUserProfile() {
    if (!this.config.trackingEnabled) return;
    
    try {
      const profile = {
        ...this.userProfile,
        lastSession: this.sessionId,
        lastActivity: Date.now(),
        sessionCount: (this.userProfile.sessionCount || 0) + 1
      };
      
      localStorage.setItem('smart-ux-profile', JSON.stringify(profile));
    } catch (error) {
      console.warn('Failed to save user profile:', error);
    }
  }

  // Public API
  getAnalytics() {
    return {
      session: Object.fromEntries(this.userSession),
      behaviors: this.analytics.interactions.slice(-100), // Last 100
      patterns: this.analytics.workflows.slice(-50), // Last 50
      optimizations: Array.from(this.optimizations.values()),
      insights: this.userSession.get('insights')
    };
  }

  getOptimizationSuggestions() {
    return Array.from(this.optimizations.values())
      .filter(opt => !opt.implemented)
      .sort((a, b) => b.priority - a.priority);
  }

  enableTracking(enable = true) {
    this.config.trackingEnabled = enable;
    if (!enable) {
      // Clear sensitive data
      this.analytics.interactions = [];
      this.behaviorTracker.clear();
    }
  }

  enablePrivacyMode(enable = true) {
    this.config.privacyMode = enable;
  }

  exportAnalytics() {
    return {
      sessionId: this.sessionId,
      analytics: this.getAnalytics(),
      timestamp: Date.now(),
      version: '1.0'
    };
  }

  notifyOptimizationSuggested(optimization) {
    // Dispatch custom event for other systems
    window.dispatchEvent(new CustomEvent('ux-optimization-suggested', {
      detail: optimization
    }));
  }

  destroy() {
    // Save final session data
    this.saveUserProfile();
    
    // Clean up
    this.analytics.interactions = [];
    this.behaviorTracker.clear();
    this.patterns.clear();
    this.optimizations.clear();
  }

  // Missing method referenced in suggestUIOptimization
  calculateOptimizationPriority(type, data) {
    // Calculate priority based on type and data
    let priority = 'medium'; // default
    
    switch (type) {
      case 'reduce_clicks':
        priority = data.currentClicks > 3 ? 'high' : 'medium';
        break;
      case 'improve_feedback':
        priority = data.userFrustration > 0.7 ? 'high' : 'low';
        break;
      case 'optimize_layout':
        priority = data.scrollDistance > 1000 ? 'medium' : 'low';
        break;
      case 'enhance_accessibility':
        priority = 'high'; // always high priority
        break;
      case 'streamline_workflow':
        priority = data.stepCount > 5 ? 'high' : 'medium';
        break;
      default:
        priority = 'medium';
    }
    
    return priority;
  }

  // Missing method referenced in the code  
  optimizePerformance() {
    console.log('Optimizing UX performance...');
    
    // Performance optimization logic
    const optimizations = [];
    
    // Check for slow animations
    const animations = document.querySelectorAll('[style*="transition"], [style*="animation"]');
    if (animations.length > 10) {
      optimizations.push('Reduce number of simultaneous animations');
    }
    
    // Check for large DOM elements
    const allElements = document.querySelectorAll('*');
    if (allElements.length > 1000) {
      optimizations.push('Consider virtual scrolling for large lists');
    }
    
    // Check for unoptimized images
    const images = document.querySelectorAll('img:not([loading="lazy"])');
    if (images.length > 5) {
      optimizations.push('Add lazy loading to images');
    }
    
    if (optimizations.length > 0) {
      console.log('Performance optimizations suggested:', optimizations);
    }
    
    return optimizations;
  }
}

// Auto-initialize
document.addEventListener('DOMContentLoaded', () => {
  window.smartUXPatternsSystem = new SmartUXPatternsSystem();
  
  // Save session data before page unload
  window.addEventListener('beforeunload', () => {
    if (window.smartUXPatternsSystem) {
      window.smartUXPatternsSystem.saveUserProfile();
    }
  });
});

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SmartUXPatternsSystem;
} else {
  window.SmartUXPatternsSystem = SmartUXPatternsSystem;
}