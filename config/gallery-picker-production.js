/**
 * Gallery Image Picker Production Optimizations
 * Optimized configuration for high-performance production deployment
 */

const galleryPickerProductionConfig = {
  // Performance settings for production
  cache: {
    enabled: true,
    ttl: 5 * 60 * 1000, // 5 minutes TTL for image library cache
    maxSize: 100, // Maximum cached library responses
    compression: true
  },
  
  // Batch operation limits for production
  batchLimits: {
    maxFilesPerBatch: 50, // Reduced from 100 for production stability
    requestTimeout: 30000, // 30 second timeout for batch operations
    concurrentUploads: 3 // Limit concurrent uploads
  },
  
  // API rate limiting specifically for gallery operations
  apiRateLimits: {
    library: {
      windowMs: 1 * 60 * 1000, // 1 minute window
      max: 60, // 60 library requests per minute per IP
      message: 'Too many library requests. Please try again in a minute.'
    },
    batchAdd: {
      windowMs: 5 * 60 * 1000, // 5 minute window  
      max: 20, // 20 batch operations per 5 minutes
      message: 'Batch operation limit reached. Please wait before adding more images.'
    },
    upload: {
      windowMs: 10 * 60 * 1000, // 10 minute window
      max: 100, // 100 uploads per 10 minutes
      message: 'Upload limit reached. Please wait before uploading more images.'
    }
  },
  
  // Database connection optimization for gallery operations
  database: {
    connectionLimit: 20,
    acquireTimeout: 60000,
    timeout: 60000,
    reconnect: true,
    // Connection pooling optimized for gallery operations
    idleTimeout: 300000, // 5 minutes
    maxConnections: 15
  },
  
  // Image processing optimization
  imageProcessing: {
    concurrent: 3, // Process 3 images simultaneously
    quality: 85, // JPEG quality for thumbnails
    thumbnailSizes: {
      small: { width: 150, height: 150 },
      medium: { width: 300, height: 300 },
      large: { width: 800, height: 600 }
    },
    watermarkOpacity: 0.3,
    compressionLevel: 8
  },
  
  // Monitoring and logging configuration
  monitoring: {
    enabled: true,
    logLevel: 'info',
    metricsInterval: 60000, // Collect metrics every minute
    
    // Track key performance metrics
    metrics: [
      'gallery.library.requests',
      'gallery.library.cache.hit_rate', 
      'gallery.batch.add.operations',
      'gallery.batch.add.success_rate',
      'gallery.batch.remove.operations',
      'gallery.upload.operations',
      'gallery.upload.success_rate',
      'gallery.database.query_time',
      'gallery.api.response_time',
      'gallery.errors.validation',
      'gallery.errors.security_violations'
    ]
  },
  
  // Security enhancements for production
  security: {
    // Input validation
    maxFilenameLength: 255,
    allowedFileTypes: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    maxFileSize: 10 * 1024 * 1024, // 10MB max file size
    
    // Path traversal protection 
    filenameRegex: /^[a-zA-Z0-9][a-zA-Z0-9._-]*\.(jpg|jpeg|png|gif|webp)$/i,
    blacklistedPatterns: [
      '..', '/', '\\', '<', '>', '|', '*', '?', '"', ':'
    ],
    
    // Content validation
    validateImageHeaders: true,
    scanForMalware: process.env.MALWARE_SCANNING_ENABLED === 'true',
    maxImageDimensions: {
      width: 8000,
      height: 8000
    }
  },
  
  // Error handling and resilience
  errorHandling: {
    retryAttempts: 3,
    retryDelay: 1000,
    circuitBreakerEnabled: true,
    timeoutThreshold: 30000,
    
    // Graceful degradation options
    fallbackToLegacyPicker: true,
    showProgressOnSlowOperations: true,
    maxConcurrentOperations: 5
  },
  
  // CDN and static asset optimization
  staticAssets: {
    cdnEnabled: process.env.CDN_URL ? true : false,
    cdnUrl: process.env.CDN_URL,
    imageOptimization: true,
    lazyLoading: true,
    preloadCriticalImages: 3
  },
  
  // Browser compatibility and fallbacks
  compatibility: {
    ie11Support: false, // Modern browsers only
    webpSupport: true,
    modernImageFormats: ['webp', 'avif'],
    progressiveEnhancement: true
  }
};

module.exports = galleryPickerProductionConfig;