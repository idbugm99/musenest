/**
 * Gallery Image Picker Monitoring and Health Check Endpoints
 */

const express = require('express');
const router = express.Router();
const { analytics, galleryPickerAnalytics } = require('../../utils/gallery-picker-analytics');

// Health check endpoint specifically for gallery operations
router.get('/health', async (req, res) => {
  try {
    const healthReport = analytics.getHealth();
    
    // Set HTTP status based on health
    const statusCode = {
      'healthy': 200,
      'warning': 200, // Still functional but with issues
      'critical': 503 // Service unavailable
    }[healthReport.status] || 200;
    
    res.status(statusCode).json({
      success: true,
      data: healthReport
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to generate health report',
      message: error.message
    });
  }
});

// Get current metrics
router.get('/metrics', async (req, res) => {
  try {
    const { keys } = req.query;
    const metricKeys = keys ? keys.split(',').map(k => k.trim()) : null;
    
    const metrics = analytics.getMetrics(metricKeys);
    
    res.json({
      success: true,
      data: {
        metrics,
        timestamp: Date.now()
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve metrics',
      message: error.message
    });
  }
});

// Prometheus metrics endpoint for monitoring tools
router.get('/prometheus', async (req, res) => {
  try {
    const prometheusMetrics = analytics.exportMetrics();
    
    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(prometheusMetrics);
    
  } catch (error) {
    res.status(500).send('# Error generating metrics');
  }
});

// Performance dashboard data
router.get('/performance', async (req, res) => {
  try {
    const performanceData = {
      responseTime: {
        library: galleryPickerAnalytics.getPerformanceStats('gallery.library.response_time'),
        batchAdd: galleryPickerAnalytics.getPerformanceStats('gallery.batch.add.response_time'),
        batchRemove: galleryPickerAnalytics.getPerformanceStats('gallery.batch.remove.response_time')
      },
      throughput: analytics.getMetrics([
        'gallery.library.requests.total',
        'gallery.batch.add.operations',
        'gallery.batch.remove.operations',
        'gallery.upload.operations'
      ]),
      errors: {
        database: analytics.getMetrics(['gallery.errors.database']),
        validation: analytics.getMetrics(['gallery.errors.validation']),
        security: analytics.getMetrics(['gallery.errors.security_violations'])
      },
      cache: {
        hitRate: analytics.getMetrics([
          'gallery.library.cache.hits',
          'gallery.library.cache.misses'
        ])
      }
    };
    
    res.json({
      success: true,
      data: performanceData
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve performance data',
      message: error.message
    });
  }
});

// User analytics endpoint
router.get('/user-analytics', async (req, res) => {
  try {
    const userMetrics = analytics.getMetrics([
      'gallery.picker.opens',
      'gallery.picker.searches', 
      'gallery.picker.filter_changes',
      'gallery.picker.multi_select_usage'
    ]);
    
    res.json({
      success: true,
      data: {
        interactions: userMetrics,
        timestamp: Date.now()
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve user analytics',
      message: error.message
    });
  }
});

// Alert conditions endpoint
router.get('/alerts', async (req, res) => {
  try {
    const healthReport = analytics.getHealth();
    const alerts = [];
    
    // Check for high error rates
    if (healthReport.metrics?.requests?.errorRate > 5) {
      alerts.push({
        level: 'warning',
        type: 'high_error_rate',
        message: `Error rate is ${healthReport.metrics.requests.errorRate.toFixed(2)}% (threshold: 5%)`,
        timestamp: Date.now()
      });
    }
    
    // Check for low cache hit rate
    if (healthReport.metrics?.cache?.hitRate < 70) {
      alerts.push({
        level: 'info',
        type: 'low_cache_hit_rate',
        message: `Cache hit rate is ${healthReport.metrics.cache.hitRate.toFixed(2)}% (threshold: 70%)`,
        timestamp: Date.now()
      });
    }
    
    // Check for slow response times
    if (healthReport.metrics?.performance?.responseTime?.avg > 1000) {
      alerts.push({
        level: 'warning',
        type: 'slow_response_time',
        message: `Average response time is ${healthReport.metrics.performance.responseTime.avg.toFixed(0)}ms (threshold: 1000ms)`,
        timestamp: Date.now()
      });
    }
    
    res.json({
      success: true,
      data: {
        alerts,
        alertCount: alerts.length,
        status: alerts.length === 0 ? 'healthy' : 'has_alerts'
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to check alerts',
      message: error.message
    });
  }
});

// Reset metrics (admin only - should be protected in production)
router.post('/reset-metrics', async (req, res) => {
  try {
    // In production, add authentication check here
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        error: 'Metrics reset not allowed in production'
      });
    }
    
    // Reset all metrics
    galleryPickerAnalytics.metrics.clear();
    galleryPickerAnalytics.performanceMetrics.clear();
    galleryPickerAnalytics.errorMetrics.clear();
    galleryPickerAnalytics.userMetrics.clear();
    
    galleryPickerAnalytics.initializeMetrics();
    
    res.json({
      success: true,
      message: 'Metrics reset successfully'
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to reset metrics',
      message: error.message
    });
  }
});

// Live monitoring endpoint (Server-Sent Events)
router.get('/live', async (req, res) => {
  // Set headers for Server-Sent Events
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });
  
  // Send initial health report
  const healthReport = analytics.getHealth();
  res.write(`data: ${JSON.stringify({ type: 'health', data: healthReport })}\n\n`);
  
  // Set up periodic updates
  const updateInterval = setInterval(() => {
    try {
      const currentHealth = analytics.getHealth();
      res.write(`data: ${JSON.stringify({ type: 'health', data: currentHealth })}\n\n`);
    } catch (error) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
    }
  }, 5000); // Update every 5 seconds
  
  // Listen for analytics events
  const handleMetricUpdate = (data) => {
    res.write(`data: ${JSON.stringify({ type: 'metric', data })}\n\n`);
  };
  
  galleryPickerAnalytics.on('metric.increment', handleMetricUpdate);
  galleryPickerAnalytics.on('metric.timing', handleMetricUpdate);
  
  // Clean up when client disconnects
  req.on('close', () => {
    clearInterval(updateInterval);
    galleryPickerAnalytics.off('metric.increment', handleMetricUpdate);
    galleryPickerAnalytics.off('metric.timing', handleMetricUpdate);
  });
});

module.exports = router;