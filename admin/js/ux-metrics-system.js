/**
 * UX Metrics System - Phase 8.6
 * Comprehensive performance monitoring and UX analytics
 */

class UXMetricsSystem {
  constructor() {
    this.metrics = new Map();
    this.sessions = new Map();
    this.realTimeMetrics = new Map();
    this.alerts = new Set();
    
    // Configuration
    this.config = {
      metricsInterval: 5000, // 5 seconds
      sessionTimeout: 1800000, // 30 minutes
      performanceThresholds: {
        loadTime: 3000, // 3 seconds
        interactionDelay: 200, // 200ms
        errorRate: 0.05, // 5%
        satisfactionScore: 0.7 // 70%
      },
      enableRealTimeMonitoring: true,
      enablePerformanceAlerts: true
    };
    
    this.currentSession = this.initializeSession();
    this.init();
  }

  init() {
    this.setupPerformanceMonitoring();
    this.setupUserBehaviorTracking();
    this.setupErrorTracking();
    this.setupRealtimeMetrics();
    this.startMetricsCollection();
    
    console.log('UX Metrics System initialized');
  }

  initializeSession() {
    return {
      id: this.generateSessionId(),
      startTime: Date.now(),
      endTime: null,
      pageViews: 0,
      interactions: 0,
      errors: 0,
      performanceMetrics: {
        loadTimes: [],
        interactionDelays: [],
        memoryUsage: [],
        cpuUsage: []
      },
      userBehavior: {
        clickCount: 0,
        scrollDistance: 0,
        timeOnPage: 0,
        bounceRate: 0,
        conversionEvents: []
      },
      satisfaction: {
        score: 0,
        feedback: [],
        npsScore: null
      }
    };
  }

  setupPerformanceMonitoring() {
    // Monitor Core Web Vitals
    this.observePerformanceMetrics();
    
    // Monitor page load performance
    window.addEventListener('load', () => {
      this.recordPageLoadMetrics();
    });
    
    // Monitor interaction performance
    this.monitorInteractionDelays();
    
    // Monitor memory and CPU usage
    this.monitorResourceUsage();
  }

  observePerformanceMetrics() {
    if ('PerformanceObserver' in window) {
      // First Contentful Paint (FCP)
      const fcpObserver = new PerformanceObserver((entries) => {
        for (const entry of entries.getEntries()) {
          this.recordMetric('first_contentful_paint', entry.startTime);
        }
      });
      fcpObserver.observe({ entryTypes: ['paint'] });
      
      // Largest Contentful Paint (LCP)
      const lcpObserver = new PerformanceObserver((entries) => {
        const lastEntry = entries.getEntries()[entries.getEntries().length - 1];
        this.recordMetric('largest_contentful_paint', lastEntry.startTime);
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      
      // First Input Delay (FID)
      const fidObserver = new PerformanceObserver((entries) => {
        for (const entry of entries.getEntries()) {
          this.recordMetric('first_input_delay', entry.processingStart - entry.startTime);
        }
      });
      fidObserver.observe({ entryTypes: ['first-input'] });
      
      // Cumulative Layout Shift (CLS)
      const clsObserver = new PerformanceObserver((entries) => {
        let clsScore = 0;
        for (const entry of entries.getEntries()) {
          if (!entry.hadRecentInput) {
            clsScore += entry.value;
          }
        }
        this.recordMetric('cumulative_layout_shift', clsScore);
      });
      clsObserver.observe({ entryTypes: ['layout-shift'] });
    }
  }

  recordPageLoadMetrics() {
    const navigation = performance.getEntriesByType('navigation')[0];
    if (navigation) {
      const metrics = {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        totalLoadTime: navigation.loadEventEnd - navigation.fetchStart,
        domInteractive: navigation.domInteractive - navigation.fetchStart,
        firstByte: navigation.responseStart - navigation.requestStart
      };
      
      for (const [key, value] of Object.entries(metrics)) {
        this.recordMetric(`page_load_${key}`, value);
        this.currentSession.performanceMetrics.loadTimes.push({
          metric: key,
          value,
          timestamp: Date.now()
        });
      }
      
      // Check performance thresholds
      if (metrics.totalLoadTime > this.config.performanceThresholds.loadTime) {
        this.triggerAlert('slow_page_load', {
          loadTime: metrics.totalLoadTime,
          threshold: this.config.performanceThresholds.loadTime
        });
      }
    }
  }

  monitorInteractionDelays() {
    const interactionTypes = ['click', 'keydown', 'touchstart'];
    
    interactionTypes.forEach(type => {
      document.addEventListener(type, (e) => {
        const startTime = performance.now();
        
        requestAnimationFrame(() => {
          const endTime = performance.now();
          const delay = endTime - startTime;
          
          this.recordMetric('interaction_delay', delay);
          this.currentSession.performanceMetrics.interactionDelays.push({
            type,
            delay,
            timestamp: Date.now(),
            target: e.target.tagName
          });
          
          // Alert for slow interactions
          if (delay > this.config.performanceThresholds.interactionDelay) {
            this.triggerAlert('slow_interaction', {
              delay,
              threshold: this.config.performanceThresholds.interactionDelay,
              element: e.target
            });
          }
        });
      }, { passive: true });
    });
  }

  monitorResourceUsage() {
    if ('memory' in performance) {
      setInterval(() => {
        const memInfo = performance.memory;
        const memoryMetrics = {
          usedJSHeapSize: memInfo.usedJSHeapSize,
          totalJSHeapSize: memInfo.totalJSHeapSize,
          jsHeapSizeLimit: memInfo.jsHeapSizeLimit,
          usage: memInfo.usedJSHeapSize / memInfo.jsHeapSizeLimit
        };
        
        this.recordMetric('memory_usage', memoryMetrics.usage);
        this.currentSession.performanceMetrics.memoryUsage.push({
          ...memoryMetrics,
          timestamp: Date.now()
        });
        
        // Alert for high memory usage
        if (memoryMetrics.usage > 0.9) {
          this.triggerAlert('high_memory_usage', memoryMetrics);
        }
      }, 30000); // Every 30 seconds
    }
  }

  setupUserBehaviorTracking() {
    // Track user interactions
    this.trackClicks();
    this.trackScrollBehavior();
    this.trackTimeOnPage();
    this.trackFormInteractions();
    this.trackNavigationPatterns();
  }

  trackClicks() {
    document.addEventListener('click', (e) => {
      this.currentSession.userBehavior.clickCount++;
      this.currentSession.interactions++;
      
      const clickData = {
        element: e.target.tagName,
        className: e.target.className,
        timestamp: Date.now(),
        coordinates: { x: e.clientX, y: e.clientY }
      };
      
      this.recordMetric('user_click', clickData);
      
      // Track conversion events
      if (e.target.matches('.btn-primary, .btn-success, [data-conversion]')) {
        this.recordConversionEvent('click', e.target);
      }
    });
  }

  trackScrollBehavior() {
    let maxScrollDepth = 0;
    let scrollDistance = 0;
    let lastScrollY = 0;
    
    document.addEventListener('scroll', (e) => {
      const currentScrollY = window.scrollY;
      const scrollDepth = (currentScrollY + window.innerHeight) / document.documentElement.scrollHeight;
      
      maxScrollDepth = Math.max(maxScrollDepth, scrollDepth);
      scrollDistance += Math.abs(currentScrollY - lastScrollY);
      lastScrollY = currentScrollY;
      
      this.currentSession.userBehavior.scrollDistance = scrollDistance;
      this.recordMetric('scroll_depth', maxScrollDepth);
    }, { passive: true });
  }

  trackTimeOnPage() {
    const startTime = Date.now();
    
    // Update time on page every 10 seconds
    const timeTracker = setInterval(() => {
      if (!document.hidden) {
        this.currentSession.userBehavior.timeOnPage = Date.now() - startTime;
        this.recordMetric('time_on_page', this.currentSession.userBehavior.timeOnPage);
      }
    }, 10000);
    
    // Stop tracking when page is unloaded
    window.addEventListener('beforeunload', () => {
      clearInterval(timeTracker);
      this.finalizeSession();
    });
    
    // Handle visibility changes (tab switching)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.recordMetric('tab_hidden', Date.now() - startTime);
      } else {
        this.recordMetric('tab_visible', Date.now() - startTime);
      }
    });
  }

  trackFormInteractions() {
    document.addEventListener('input', (e) => {
      if (e.target.matches('input, textarea, select')) {
        this.recordMetric('form_interaction', {
          fieldType: e.target.type || e.target.tagName,
          fieldName: e.target.name || e.target.id,
          timestamp: Date.now()
        });
      }
    });
    
    document.addEventListener('submit', (e) => {
      const form = e.target;
      if (form.tagName === 'FORM') {
        const formData = new FormData(form);
        const completionTime = Date.now() - this.currentSession.startTime;
        
        this.recordMetric('form_submission', {
          formId: form.id,
          fieldCount: formData.keys() ? Array.from(formData.keys()).length : 0,
          completionTime,
          timestamp: Date.now()
        });
        
        this.recordConversionEvent('form_submit', form);
      }
    });
  }

  trackNavigationPatterns() {
    let navigationPath = [];
    
    // Track page navigation (for SPAs)
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    history.pushState = function(...args) {
      navigationPath.push({
        url: args[2] || window.location.href,
        timestamp: Date.now(),
        method: 'pushState'
      });
      return originalPushState.apply(history, args);
    };
    
    history.replaceState = function(...args) {
      navigationPath.push({
        url: args[2] || window.location.href,
        timestamp: Date.now(),
        method: 'replaceState'
      });
      return originalReplaceState.apply(history, args);
    };
    
    window.addEventListener('popstate', () => {
      navigationPath.push({
        url: window.location.href,
        timestamp: Date.now(),
        method: 'popstate'
      });
    });
    
    this.currentSession.navigationPath = navigationPath;
  }

  setupErrorTracking() {
    // JavaScript errors
    window.addEventListener('error', (e) => {
      this.recordError('javascript_error', {
        message: e.message,
        filename: e.filename,
        lineno: e.lineno,
        colno: e.colno,
        stack: e.error?.stack,
        timestamp: Date.now()
      });
    });
    
    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (e) => {
      this.recordError('unhandled_rejection', {
        reason: e.reason?.toString(),
        stack: e.reason?.stack,
        timestamp: Date.now()
      });
    });
    
    // Network errors
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args);
        if (!response.ok) {
          this.recordError('network_error', {
            url: args[0],
            status: response.status,
            statusText: response.statusText,
            timestamp: Date.now()
          });
        }
        return response;
      } catch (error) {
        this.recordError('fetch_error', {
          url: args[0],
          message: error.message,
          timestamp: Date.now()
        });
        throw error;
      }
    };
  }

  setupRealtimeMetrics() {
    if (!this.config.enableRealTimeMonitoring) return;
    
    // Real-time performance monitoring
    setInterval(() => {
      this.updateRealTimeMetrics();
    }, 1000);
    
    // Real-time user activity
    this.monitorUserActivity();
  }

  updateRealTimeMetrics() {
    const now = Date.now();
    const windowSize = 60000; // 1 minute window
    
    // Get recent metrics
    const recentMetrics = Array.from(this.metrics.entries())
      .filter(([timestamp]) => now - timestamp < windowSize);
    
    // Calculate real-time performance indicators
    const realTimeData = {
      timestamp: now,
      activeUsers: 1, // Single user session
      pageLoadTime: this.calculateAverage(recentMetrics, 'page_load_totalLoadTime'),
      interactionDelay: this.calculateAverage(recentMetrics, 'interaction_delay'),
      errorRate: this.calculateErrorRate(recentMetrics),
      satisfactionScore: this.calculateSatisfactionScore(),
      memoryUsage: this.getLatestMetric('memory_usage'),
      userActivity: this.calculateUserActivity()
    };
    
    this.realTimeMetrics.set(now, realTimeData);
    
    // Trim old real-time data (keep last 5 minutes)
    const cutoff = now - 300000;
    for (const [timestamp] of this.realTimeMetrics) {
      if (timestamp < cutoff) {
        this.realTimeMetrics.delete(timestamp);
      }
    }
    
    // Dispatch real-time update event
    window.dispatchEvent(new CustomEvent('ux-metrics-update', {
      detail: realTimeData
    }));
  }

  monitorUserActivity() {
    let lastActivity = Date.now();
    let isActive = true;
    
    const activityEvents = ['click', 'scroll', 'keypress', 'mousemove', 'touchstart'];
    const activityHandler = () => {
      lastActivity = Date.now();
      if (!isActive) {
        isActive = true;
        this.recordMetric('user_active', Date.now());
      }
    };
    
    activityEvents.forEach(event => {
      document.addEventListener(event, activityHandler, { passive: true });
    });
    
    // Check for inactivity every 30 seconds
    setInterval(() => {
      const timeSinceActivity = Date.now() - lastActivity;
      if (timeSinceActivity > 30000 && isActive) { // 30 seconds of inactivity
        isActive = false;
        this.recordMetric('user_inactive', timeSinceActivity);
      }
    }, 30000);
  }

  startMetricsCollection() {
    setInterval(() => {
      this.collectSystemMetrics();
      this.analyzeTrends();
      this.generateInsights();
    }, this.config.metricsInterval);
  }

  collectSystemMetrics() {
    // Collect browser performance metrics
    if (performance.memory) {
      const memory = performance.memory;
      this.recordMetric('system_memory', {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit
      });
    }
    
    // Connection quality
    if (navigator.connection) {
      const conn = navigator.connection;
      this.recordMetric('connection_quality', {
        effectiveType: conn.effectiveType,
        downlink: conn.downlink,
        rtt: conn.rtt,
        saveData: conn.saveData
      });
    }
    
    // Battery status (if available)
    if (navigator.getBattery) {
      navigator.getBattery().then(battery => {
        this.recordMetric('battery_status', {
          level: battery.level,
          charging: battery.charging,
          dischargingTime: battery.dischargingTime
        });
      });
    }
  }

  analyzeTrends() {
    const timeWindow = 300000; // 5 minutes
    const now = Date.now();
    
    // Get metrics from the last 5 minutes
    const recentMetrics = Array.from(this.metrics.entries())
      .filter(([timestamp]) => now - timestamp < timeWindow)
      .map(([timestamp, data]) => ({ timestamp, ...data }));
    
    if (recentMetrics.length < 10) return; // Need sufficient data
    
    // Analyze load time trend
    const loadTimes = recentMetrics
      .filter(m => m.metric === 'page_load_totalLoadTime')
      .map(m => m.value);
    
    if (loadTimes.length > 1) {
      const trend = this.calculateTrend(loadTimes);
      if (trend.slope > 0.1) {
        this.triggerAlert('performance_degradation', {
          metric: 'load_time',
          trend: trend.slope
        });
      }
    }
    
    // Analyze error rate trend
    const errors = recentMetrics.filter(m => m.metric.includes('error'));
    const errorRate = errors.length / recentMetrics.length;
    
    if (errorRate > this.config.performanceThresholds.errorRate) {
      this.triggerAlert('high_error_rate', {
        rate: errorRate,
        threshold: this.config.performanceThresholds.errorRate
      });
    }
  }

  generateInsights() {
    const insights = {
      timestamp: Date.now(),
      session: this.currentSession.id,
      performance: this.getPerformanceInsights(),
      userBehavior: this.getUserBehaviorInsights(),
      recommendations: this.generateRecommendations()
    };
    
    // Store insights
    this.recordMetric('insights_generated', insights);
    
    // Dispatch insights event
    window.dispatchEvent(new CustomEvent('ux-insights-generated', {
      detail: insights
    }));
  }

  getPerformanceInsights() {
    const now = Date.now();
    const windowSize = 300000; // 5 minutes
    
    const recentMetrics = Array.from(this.metrics.entries())
      .filter(([timestamp]) => now - timestamp < windowSize);
    
    return {
      avgLoadTime: this.calculateAverage(recentMetrics, 'page_load_totalLoadTime'),
      avgInteractionDelay: this.calculateAverage(recentMetrics, 'interaction_delay'),
      errorCount: recentMetrics.filter(([, data]) => data.metric?.includes('error')).length,
      memoryTrend: this.calculateTrend(
        recentMetrics
          .filter(([, data]) => data.metric === 'memory_usage')
          .map(([, data]) => data.value)
      ),
      coreWebVitals: {
        fcp: this.getLatestMetric('first_contentful_paint'),
        lcp: this.getLatestMetric('largest_contentful_paint'),
        fid: this.getLatestMetric('first_input_delay'),
        cls: this.getLatestMetric('cumulative_layout_shift')
      }
    };
  }

  getUserBehaviorInsights() {
    return {
      engagement: {
        clickCount: this.currentSession.userBehavior.clickCount,
        timeOnPage: this.currentSession.userBehavior.timeOnPage,
        scrollDistance: this.currentSession.userBehavior.scrollDistance,
        interactionRate: this.currentSession.userBehavior.clickCount / 
                         (this.currentSession.userBehavior.timeOnPage / 60000) // clicks per minute
      },
      satisfaction: this.currentSession.satisfaction,
      conversionEvents: this.currentSession.userBehavior.conversionEvents,
      navigationPattern: this.analyzeNavigationPattern()
    };
  }

  generateRecommendations() {
    const recommendations = [];
    const performance = this.getPerformanceInsights();
    
    // Performance recommendations
    if (performance.avgLoadTime > this.config.performanceThresholds.loadTime) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        issue: 'Slow page load times',
        suggestion: 'Optimize images, minify CSS/JS, enable compression',
        impact: 'high'
      });
    }
    
    if (performance.avgInteractionDelay > this.config.performanceThresholds.interactionDelay) {
      recommendations.push({
        type: 'performance',
        priority: 'medium',
        issue: 'Slow interaction responses',
        suggestion: 'Optimize JavaScript execution, reduce DOM complexity',
        impact: 'medium'
      });
    }
    
    // Core Web Vitals recommendations
    if (performance.coreWebVitals.lcp > 2500) {
      recommendations.push({
        type: 'core_web_vitals',
        priority: 'high',
        issue: 'Poor Largest Contentful Paint',
        suggestion: 'Optimize above-the-fold content loading',
        impact: 'high'
      });
    }
    
    if (performance.coreWebVitals.cls > 0.1) {
      recommendations.push({
        type: 'core_web_vitals',
        priority: 'medium',
        issue: 'High Cumulative Layout Shift',
        suggestion: 'Set dimensions for images and ads, avoid inserting content above existing content',
        impact: 'medium'
      });
    }
    
    // User behavior recommendations
    const userBehavior = this.getUserBehaviorInsights();
    if (userBehavior.engagement.interactionRate < 1) { // Less than 1 click per minute
      recommendations.push({
        type: 'user_experience',
        priority: 'medium',
        issue: 'Low user engagement',
        suggestion: 'Improve call-to-action visibility, add interactive elements',
        impact: 'medium'
      });
    }
    
    return recommendations;
  }

  // Helper methods
  recordMetric(metricName, value) {
    const timestamp = Date.now();
    this.metrics.set(timestamp, {
      metric: metricName,
      value,
      sessionId: this.currentSession.id
    });
    
    // Trim old metrics (keep last hour)
    const cutoff = timestamp - 3600000;
    for (const [metricTimestamp] of this.metrics) {
      if (metricTimestamp < cutoff) {
        this.metrics.delete(metricTimestamp);
      }
    }
  }

  recordError(errorType, errorData) {
    this.currentSession.errors++;
    this.recordMetric(`error_${errorType}`, errorData);
    
    // Check error rate threshold
    const errorRate = this.calculateErrorRate();
    if (errorRate > this.config.performanceThresholds.errorRate) {
      this.triggerAlert('high_error_rate', { rate: errorRate });
    }
  }

  recordConversionEvent(type, element) {
    const conversionEvent = {
      type,
      element: element.tagName,
      className: element.className,
      timestamp: Date.now(),
      sessionTime: Date.now() - this.currentSession.startTime
    };
    
    this.currentSession.userBehavior.conversionEvents.push(conversionEvent);
    this.recordMetric('conversion_event', conversionEvent);
  }

  calculateAverage(metrics, metricType) {
    const values = metrics
      .filter(([, data]) => data.metric === metricType)
      .map(([, data]) => data.value)
      .filter(value => typeof value === 'number');
    
    return values.length > 0 ? values.reduce((a, b) => a + b) / values.length : 0;
  }

  calculateErrorRate(metrics = null) {
    const metricsToUse = metrics || Array.from(this.metrics.entries());
    const totalMetrics = metricsToUse.length;
    const errorMetrics = metricsToUse.filter(([, data]) => 
      data.metric && data.metric.includes('error')
    ).length;
    
    return totalMetrics > 0 ? errorMetrics / totalMetrics : 0;
  }

  calculateSatisfactionScore() {
    let score = 1.0;
    
    // Reduce score based on errors
    const errorRate = this.calculateErrorRate();
    score -= errorRate * 0.5;
    
    // Reduce score based on performance
    const avgLoadTime = this.getLatestMetric('page_load_totalLoadTime') || 0;
    if (avgLoadTime > this.config.performanceThresholds.loadTime) {
      score -= 0.2;
    }
    
    const avgInteractionDelay = this.getLatestMetric('interaction_delay') || 0;
    if (avgInteractionDelay > this.config.performanceThresholds.interactionDelay) {
      score -= 0.1;
    }
    
    // Increase score based on engagement
    const timeOnPage = this.currentSession.userBehavior.timeOnPage;
    const clickCount = this.currentSession.userBehavior.clickCount;
    if (timeOnPage > 60000 && clickCount > 5) { // Engaged user
      score += 0.1;
    }
    
    return Math.max(0, Math.min(1, score));
  }

  calculateUserActivity() {
    const now = Date.now();
    const windowSize = 60000; // 1 minute window
    
    const recentActivity = Array.from(this.metrics.entries())
      .filter(([timestamp, data]) => 
        now - timestamp < windowSize && 
        (data.metric === 'user_click' || data.metric === 'scroll_depth')
      );
    
    return {
      actionsPerMinute: recentActivity.length,
      isActive: recentActivity.length > 0
    };
  }

  calculateTrend(values) {
    if (values.length < 2) return { slope: 0, correlation: 0 };
    
    const n = values.length;
    const xSum = (n * (n - 1)) / 2;
    const ySum = values.reduce((a, b) => a + b, 0);
    const xySum = values.reduce((sum, y, x) => sum + x * y, 0);
    const xxSum = (n * (n - 1) * (2 * n - 1)) / 6;
    
    const slope = (n * xySum - xSum * ySum) / (n * xxSum - xSum * xSum);
    
    return { slope, correlation: Math.abs(slope) };
  }

  getLatestMetric(metricType) {
    const metricEntries = Array.from(this.metrics.entries())
      .filter(([, data]) => data.metric === metricType)
      .sort((a, b) => b[0] - a[0]);
    
    return metricEntries.length > 0 ? metricEntries[0][1].value : null;
  }

  analyzeNavigationPattern() {
    const path = this.currentSession.navigationPath || [];
    if (path.length < 2) return { pattern: 'single_page' };
    
    const uniquePages = [...new Set(path.map(p => p.url))].length;
    const totalNavigation = path.length;
    
    return {
      pattern: uniquePages === 1 ? 'single_page' : 'multi_page',
      uniquePages,
      totalNavigation,
      averageTimePerPage: this.currentSession.userBehavior.timeOnPage / uniquePages,
      bounceRate: uniquePages === 1 ? 1 : 0
    };
  }

  triggerAlert(alertType, data) {
    if (!this.config.enablePerformanceAlerts) return;
    
    const alert = {
      type: alertType,
      data,
      timestamp: Date.now(),
      sessionId: this.currentSession.id,
      severity: this.getAlertSeverity(alertType)
    };
    
    this.alerts.add(alert);
    
    // Dispatch alert event
    window.dispatchEvent(new CustomEvent('ux-performance-alert', {
      detail: alert
    }));
    
    console.warn(`UX Performance Alert: ${alertType}`, data);
  }

  getAlertSeverity(alertType) {
    const severityMap = {
      slow_page_load: 'high',
      slow_interaction: 'medium',
      high_memory_usage: 'high',
      performance_degradation: 'high',
      high_error_rate: 'critical'
    };
    
    return severityMap[alertType] || 'medium';
  }

  finalizeSession() {
    this.currentSession.endTime = Date.now();
    this.currentSession.satisfaction.score = this.calculateSatisfactionScore();
    
    // Store completed session
    this.sessions.set(this.currentSession.id, this.currentSession);
    
    // Generate final session report
    const sessionReport = {
      ...this.currentSession,
      insights: this.generateInsights(),
      summary: this.generateSessionSummary()
    };
    
    // Dispatch session end event
    window.dispatchEvent(new CustomEvent('ux-session-ended', {
      detail: sessionReport
    }));
  }

  generateSessionSummary() {
    return {
      duration: this.currentSession.endTime - this.currentSession.startTime,
      interactions: this.currentSession.interactions,
      errors: this.currentSession.errors,
      conversionEvents: this.currentSession.userBehavior.conversionEvents.length,
      satisfactionScore: this.currentSession.satisfaction.score,
      performanceGrade: this.calculatePerformanceGrade()
    };
  }

  calculatePerformanceGrade() {
    const performance = this.getPerformanceInsights();
    let score = 100;
    
    // Deduct points for poor performance
    if (performance.avgLoadTime > 3000) score -= 20;
    if (performance.avgLoadTime > 5000) score -= 20;
    if (performance.avgInteractionDelay > 200) score -= 15;
    if (performance.errorCount > 5) score -= 25;
    if (performance.coreWebVitals.lcp > 2500) score -= 10;
    if (performance.coreWebVitals.cls > 0.1) score -= 10;
    
    score = Math.max(0, score);
    
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  // Utility methods
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public API
  getMetrics() {
    return {
      currentSession: this.currentSession,
      realtimeMetrics: Array.from(this.realTimeMetrics.entries()),
      historicalMetrics: Array.from(this.metrics.entries()).slice(-100),
      alerts: Array.from(this.alerts),
      insights: this.generateInsights()
    };
  }

  getPerformanceDashboard() {
    return {
      coreWebVitals: this.getPerformanceInsights().coreWebVitals,
      userExperience: this.getUserBehaviorInsights(),
      performanceGrade: this.calculatePerformanceGrade(),
      recommendations: this.generateRecommendations(),
      alerts: Array.from(this.alerts).slice(-10)
    };
  }

  exportMetrics() {
    return {
      sessions: Array.from(this.sessions.entries()),
      metrics: Array.from(this.metrics.entries()),
      realTimeMetrics: Array.from(this.realTimeMetrics.entries()),
      alerts: Array.from(this.alerts),
      timestamp: Date.now(),
      version: '1.0'
    };
  }

  clearMetrics() {
    this.metrics.clear();
    this.realTimeMetrics.clear();
    this.alerts.clear();
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }
}

// Auto-initialize
document.addEventListener('DOMContentLoaded', () => {
  window.uxMetricsSystem = new UXMetricsSystem();
});

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UXMetricsSystem;
} else {
  window.UXMetricsSystem = UXMetricsSystem;
}