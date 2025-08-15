/**
 * Gallery Image Picker Analytics and Monitoring
 * Comprehensive metrics collection and performance monitoring
 */

const EventEmitter = require('events');

class GalleryPickerAnalytics extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.enabled = options.enabled !== false;
    this.metricsInterval = options.metricsInterval || 60000; // 1 minute
    this.retentionDays = options.retentionDays || 7;
    
    // Metrics storage
    this.metrics = new Map();
    this.performanceMetrics = new Map();
    this.errorMetrics = new Map();
    this.userMetrics = new Map();
    
    // Initialize metric containers
    this.initializeMetrics();
    
    // Start periodic metrics collection if enabled
    if (this.enabled) {
      this.startMetricsCollection();
    }
  }

  initializeMetrics() {
    const metricKeys = [
      // Request metrics
      'gallery.library.requests.total',
      'gallery.library.requests.success',
      'gallery.library.requests.error',
      'gallery.library.cache.hits',
      'gallery.library.cache.misses',
      
      // Batch operation metrics
      'gallery.batch.add.operations',
      'gallery.batch.add.images_added',
      'gallery.batch.add.images_skipped',
      'gallery.batch.add.images_failed',
      'gallery.batch.remove.operations',
      'gallery.batch.remove.images_removed',
      
      // Upload metrics
      'gallery.upload.operations',
      'gallery.upload.success',
      'gallery.upload.failed',
      'gallery.upload.bytes_processed',
      
      // Performance metrics
      'gallery.api.response_time.avg',
      'gallery.api.response_time.p95',
      'gallery.database.query_time.avg',
      'gallery.image.processing_time.avg',
      
      // Error metrics
      'gallery.errors.validation',
      'gallery.errors.security_violations',
      'gallery.errors.database',
      'gallery.errors.file_system',
      
      // User behavior metrics
      'gallery.picker.opens',
      'gallery.picker.searches',
      'gallery.picker.filter_changes',
      'gallery.picker.multi_select_usage'
    ];

    metricKeys.forEach(key => {
      this.metrics.set(key, {
        value: 0,
        timestamp: Date.now(),
        samples: []
      });
    });
  }

  // Increment a counter metric
  increment(metricKey, value = 1, labels = {}) {
    if (!this.enabled) return;
    
    const metric = this.metrics.get(metricKey) || this.createMetric(metricKey);
    metric.value += value;
    metric.timestamp = Date.now();
    metric.samples.push({ value, timestamp: Date.now(), labels });
    
    // Emit event for real-time monitoring
    this.emit('metric.increment', { key: metricKey, value, labels });
    
    this.cleanupOldSamples(metric);
  }

  // Record a timing metric
  timing(metricKey, duration, labels = {}) {
    if (!this.enabled) return;
    
    const metric = this.performanceMetrics.get(metricKey) || this.createPerformanceMetric(metricKey);
    metric.samples.push({ value: duration, timestamp: Date.now(), labels });
    
    // Update averages
    this.updatePerformanceStats(metricKey);
    
    this.emit('metric.timing', { key: metricKey, duration, labels });
    this.cleanupOldSamples(metric);
  }

  // Record an error
  recordError(errorType, error, context = {}) {
    if (!this.enabled) return;
    
    const errorKey = `gallery.errors.${errorType}`;
    this.increment(errorKey);
    
    const errorMetric = this.errorMetrics.get(errorKey) || this.createErrorMetric(errorKey);
    errorMetric.errors.push({
      message: error.message || error,
      stack: error.stack,
      context,
      timestamp: Date.now()
    });
    
    this.emit('error.recorded', { type: errorType, error, context });
    this.cleanupOldErrors(errorMetric);
  }

  // Record user interaction
  recordUserInteraction(action, context = {}) {
    if (!this.enabled) return;
    
    const userKey = `gallery.picker.${action}`;
    this.increment(userKey);
    
    const userMetric = this.userMetrics.get(action) || this.createUserMetric(action);
    userMetric.interactions.push({
      ...context,
      timestamp: Date.now()
    });
    
    this.emit('user.interaction', { action, context });
    this.cleanupOldUserInteractions(userMetric);
  }

  // Get current metrics summary
  getMetrics(metricKeys = null) {
    if (!this.enabled) return {};
    
    const result = {};
    const keys = metricKeys || Array.from(this.metrics.keys());
    
    keys.forEach(key => {
      const metric = this.metrics.get(key);
      if (metric) {
        result[key] = {
          value: metric.value,
          timestamp: metric.timestamp,
          sampleCount: metric.samples.length
        };
      }
    });

    return result;
  }

  // Get performance statistics
  getPerformanceStats(metricKey) {
    if (!this.enabled) return null;
    
    const metric = this.performanceMetrics.get(metricKey);
    if (!metric) return null;

    const values = metric.samples.map(s => s.value).sort((a, b) => a - b);
    const count = values.length;
    
    if (count === 0) return null;

    return {
      count,
      min: values[0],
      max: values[count - 1],
      avg: values.reduce((sum, val) => sum + val, 0) / count,
      p50: values[Math.floor(count * 0.5)],
      p95: values[Math.floor(count * 0.95)],
      p99: values[Math.floor(count * 0.99)]
    };
  }

  // Get error summary
  getErrorSummary() {
    if (!this.enabled) return {};
    
    const summary = {};
    
    for (const [key, metric] of this.errorMetrics) {
      summary[key] = {
        count: metric.errors.length,
        recentErrors: metric.errors.slice(-5) // Last 5 errors
      };
    }

    return summary;
  }

  // Generate comprehensive health report
  generateHealthReport() {
    if (!this.enabled) return { status: 'disabled' };
    
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    // Calculate key performance indicators
    const libraryRequests = this.metrics.get('gallery.library.requests.total');
    const libraryErrors = this.metrics.get('gallery.library.requests.error');
    const cacheHits = this.metrics.get('gallery.library.cache.hits');
    const cacheMisses = this.metrics.get('gallery.library.cache.misses');
    
    const errorRate = libraryRequests && libraryRequests.value > 0 
      ? (libraryErrors?.value || 0) / libraryRequests.value * 100 
      : 0;
      
    const cacheHitRate = (cacheHits?.value || 0) + (cacheMisses?.value || 0) > 0
      ? (cacheHits?.value || 0) / ((cacheHits?.value || 0) + (cacheMisses?.value || 0)) * 100
      : 0;

    // Performance stats
    const responseTimeStats = this.getPerformanceStats('gallery.api.response_time.avg');
    const dbQueryStats = this.getPerformanceStats('gallery.database.query_time.avg');

    return {
      status: this.determineHealthStatus(errorRate, responseTimeStats),
      timestamp: now,
      metrics: {
        requests: {
          total: libraryRequests?.value || 0,
          errors: libraryErrors?.value || 0,
          errorRate: Math.round(errorRate * 100) / 100
        },
        cache: {
          hits: cacheHits?.value || 0,
          misses: cacheMisses?.value || 0,
          hitRate: Math.round(cacheHitRate * 100) / 100
        },
        performance: {
          responseTime: responseTimeStats,
          databaseQueryTime: dbQueryStats
        }
      },
      errors: this.getErrorSummary(),
      uptime: process.uptime()
    };
  }

  // Determine overall health status
  determineHealthStatus(errorRate, responseTimeStats) {
    if (errorRate > 10) return 'critical';
    if (errorRate > 5 || (responseTimeStats && responseTimeStats.avg > 1000)) return 'warning';
    return 'healthy';
  }

  // Helper methods
  createMetric(key) {
    const metric = {
      value: 0,
      timestamp: Date.now(),
      samples: []
    };
    this.metrics.set(key, metric);
    return metric;
  }

  createPerformanceMetric(key) {
    const metric = {
      samples: [],
      timestamp: Date.now()
    };
    this.performanceMetrics.set(key, metric);
    return metric;
  }

  createErrorMetric(key) {
    const metric = {
      errors: [],
      timestamp: Date.now()
    };
    this.errorMetrics.set(key, metric);
    return metric;
  }

  createUserMetric(action) {
    const metric = {
      interactions: [],
      timestamp: Date.now()
    };
    this.userMetrics.set(action, metric);
    return metric;
  }

  updatePerformanceStats(metricKey) {
    const metric = this.performanceMetrics.get(metricKey);
    if (!metric || metric.samples.length === 0) return;

    const values = metric.samples.map(s => s.value);
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
    
    // Update average metric
    const avgKey = `${metricKey}.avg`;
    if (this.metrics.has(avgKey)) {
      this.metrics.get(avgKey).value = avg;
    }
  }

  // Cleanup old samples to prevent memory leaks
  cleanupOldSamples(metric) {
    const cutoff = Date.now() - (this.retentionDays * 24 * 60 * 60 * 1000);
    metric.samples = metric.samples.filter(sample => sample.timestamp > cutoff);
  }

  cleanupOldErrors(metric) {
    const cutoff = Date.now() - (this.retentionDays * 24 * 60 * 60 * 1000);
    metric.errors = metric.errors.filter(error => error.timestamp > cutoff);
  }

  cleanupOldUserInteractions(metric) {
    const cutoff = Date.now() - (this.retentionDays * 24 * 60 * 60 * 1000);
    metric.interactions = metric.interactions.filter(interaction => interaction.timestamp > cutoff);
  }

  startMetricsCollection() {
    setInterval(() => {
      this.emit('metrics.collected', this.generateHealthReport());
    }, this.metricsInterval);
  }

  // Export metrics in Prometheus format (for monitoring tools)
  exportPrometheusMetrics() {
    if (!this.enabled) return '';
    
    let output = '';
    
    // Counter metrics
    for (const [key, metric] of this.metrics) {
      const metricName = key.replace(/\./g, '_');
      output += `# TYPE ${metricName} counter\n`;
      output += `${metricName} ${metric.value}\n`;
    }
    
    // Performance histograms
    for (const [key, stats] of this.performanceMetrics) {
      const perfStats = this.getPerformanceStats(key);
      if (perfStats) {
        const metricName = key.replace(/\./g, '_');
        output += `# TYPE ${metricName} histogram\n`;
        output += `${metricName}_count ${perfStats.count}\n`;
        output += `${metricName}_sum ${perfStats.avg * perfStats.count}\n`;
        output += `${metricName}{quantile="0.5"} ${perfStats.p50}\n`;
        output += `${metricName}{quantile="0.95"} ${perfStats.p95}\n`;
        output += `${metricName}{quantile="0.99"} ${perfStats.p99}\n`;
      }
    }
    
    return output;
  }
}

// Create singleton instance
const galleryPickerAnalytics = new GalleryPickerAnalytics({
  enabled: process.env.GALLERY_PICKER_ANALYTICS_ENABLED !== 'false',
  metricsInterval: parseInt(process.env.METRICS_INTERVAL) || 60000,
  retentionDays: parseInt(process.env.METRICS_RETENTION_DAYS) || 7
});

// Convenience functions for easy usage
const analytics = {
  // Track API requests
  trackRequest: (endpoint, success = true, responseTime = 0, labels = {}) => {
    galleryPickerAnalytics.increment(`gallery.${endpoint}.requests.total`);
    galleryPickerAnalytics.increment(`gallery.${endpoint}.requests.${success ? 'success' : 'error'}`);
    if (responseTime > 0) {
      galleryPickerAnalytics.timing(`gallery.${endpoint}.response_time`, responseTime, labels);
    }
  },

  // Track cache usage
  trackCache: (hit = true) => {
    galleryPickerAnalytics.increment(`gallery.library.cache.${hit ? 'hits' : 'misses'}`);
  },

  // Track batch operations
  trackBatchOperation: (type, added = 0, skipped = 0, failed = 0) => {
    galleryPickerAnalytics.increment(`gallery.batch.${type}.operations`);
    if (added > 0) galleryPickerAnalytics.increment(`gallery.batch.${type}.images_${type === 'add' ? 'added' : 'removed'}`, added);
    if (skipped > 0) galleryPickerAnalytics.increment(`gallery.batch.${type}.images_skipped`, skipped);
    if (failed > 0) galleryPickerAnalytics.increment(`gallery.batch.${type}.images_failed`, failed);
  },

  // Track uploads
  trackUpload: (success = true, fileSize = 0) => {
    galleryPickerAnalytics.increment(`gallery.upload.${success ? 'success' : 'failed'}`);
    if (success && fileSize > 0) {
      galleryPickerAnalytics.increment('gallery.upload.bytes_processed', fileSize);
    }
  },

  // Track user interactions
  trackUserAction: (action, context = {}) => {
    galleryPickerAnalytics.recordUserInteraction(action, context);
  },

  // Track errors
  trackError: (type, error, context = {}) => {
    galleryPickerAnalytics.recordError(type, error, context);
  },

  // Get health report
  getHealth: () => galleryPickerAnalytics.generateHealthReport(),

  // Get metrics
  getMetrics: (keys) => galleryPickerAnalytics.getMetrics(keys),

  // Export for monitoring tools
  exportMetrics: () => galleryPickerAnalytics.exportPrometheusMetrics()
};

module.exports = {
  GalleryPickerAnalytics,
  galleryPickerAnalytics,
  analytics
};