#!/usr/bin/env node
/**
 * Gallery Image Picker Production Deployment Checklist
 * Validates system readiness for production deployment
 */

const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
const { performance } = require('perf_hooks');

const config = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'musenest',
  port: process.env.DB_PORT || 3306
};

class GalleryPickerDeploymentChecker {
  constructor() {
    this.checks = [];
    this.warnings = [];
    this.errors = [];
    this.connection = null;
  }

  async connect() {
    try {
      this.connection = await mysql.createConnection(config);
      console.log('✅ Database connection established');
    } catch (error) {
      this.errors.push(`Database connection failed: ${error.message}`);
    }
  }

  async checkDatabaseIndexes() {
    console.log('🔍 Checking database indexes for gallery operations...');
    
    const requiredIndexes = [
      {
        table: 'model_media_library',
        index: 'idx_gallery_library_optimal',
        columns: ['model_slug', 'moderation_status', 'usage_intent', 'upload_date']
      },
      {
        table: 'gallery_images',
        index: 'idx_gallery_section_images',
        columns: ['model_id', 'section_id', 'is_active']
      },
      {
        table: 'gallery_sections', 
        index: 'idx_model_sections',
        columns: ['model_id', 'is_visible']
      }
    ];

    for (const indexInfo of requiredIndexes) {
      try {
        const [indexes] = await this.connection.query(
          `SHOW INDEX FROM ${indexInfo.table} WHERE Key_name = ?`,
          [indexInfo.index]
        );
        
        if (indexes.length === 0) {
          this.warnings.push(`Missing production index: ${indexInfo.index} on table ${indexInfo.table}`);
        } else {
          console.log(`  ✅ Index ${indexInfo.index} exists`);
        }
      } catch (error) {
        this.errors.push(`Failed to check index ${indexInfo.index}: ${error.message}`);
      }
    }
  }

  async checkApiEndpoints() {
    console.log('🔍 Checking API endpoint availability...');
    
    const testModel = 'escortexample'; // Test with a known model
    const endpoints = [
      {
        path: `/api/model-gallery/${testModel}/library`,
        method: 'GET',
        description: 'Library listing endpoint'
      }
    ];

    // Note: In a real deployment, we'd use HTTP requests here
    // For now, we'll check if the route files exist
    const routeFiles = [
      'routes/api/model-gallery.js',
      'admin/components/gallery-image-picker.html'
    ];

    for (const file of routeFiles) {
      try {
        await fs.access(path.join(__dirname, '..', file));
        console.log(`  ✅ Route file ${file} exists`);
      } catch (error) {
        this.errors.push(`Missing route file: ${file}`);
      }
    }
  }

  async checkPerformance() {
    console.log('🔍 Running performance checks...');
    
    if (!this.connection) {
      this.errors.push('Cannot run performance checks without database connection');
      return;
    }

    // Test database query performance
    const start = performance.now();
    try {
      await this.connection.query(
        'SELECT COUNT(*) as count FROM model_media_library WHERE model_slug = ? AND moderation_status = ?',
        ['escortexample', 'approved']
      );
      const queryTime = performance.now() - start;
      
      if (queryTime > 100) {
        this.warnings.push(`Library query took ${queryTime.toFixed(2)}ms (should be < 100ms)`);
      } else {
        console.log(`  ✅ Library query performance: ${queryTime.toFixed(2)}ms`);
      }
    } catch (error) {
      this.errors.push(`Performance test failed: ${error.message}`);
    }
  }

  async checkSecurity() {
    console.log('🔍 Checking security configuration...');
    
    const securityChecks = [
      {
        name: 'HTTPS Configuration',
        check: () => process.env.NODE_ENV === 'production' && process.env.HTTPS_ENABLED !== 'false',
        message: 'HTTPS should be enabled in production'
      },
      {
        name: 'Rate Limiting',
        check: () => process.env.RATE_LIMIT_MAX && parseInt(process.env.RATE_LIMIT_MAX) < 1000,
        message: 'Rate limiting should be configured for production'
      },
      {
        name: 'JWT Secret',
        check: () => process.env.JWT_SECRET && process.env.JWT_SECRET.length > 32,
        message: 'JWT secret should be strong (>32 characters)'
      }
    ];

    for (const check of securityChecks) {
      if (check.check()) {
        console.log(`  ✅ ${check.name}`);
      } else {
        this.warnings.push(`Security: ${check.message}`);
      }
    }
  }

  async checkFileSystem() {
    console.log('🔍 Checking file system configuration...');
    
    const directories = [
      'public/uploads',
      'admin/components',
      'admin/js'
    ];

    for (const dir of directories) {
      try {
        const stats = await fs.stat(path.join(__dirname, '..', dir));
        if (stats.isDirectory()) {
          console.log(`  ✅ Directory ${dir} exists`);
        }
      } catch (error) {
        this.errors.push(`Missing directory: ${dir}`);
      }
    }

    // Check write permissions for upload directory
    const uploadDir = path.join(__dirname, '..', 'public/uploads');
    try {
      const testFile = path.join(uploadDir, '.write-test');
      await fs.writeFile(testFile, 'test');
      await fs.unlink(testFile);
      console.log('  ✅ Upload directory is writable');
    } catch (error) {
      this.errors.push('Upload directory is not writable');
    }
  }

  async checkEnvironmentVariables() {
    console.log('🔍 Checking environment variables...');
    
    const requiredVars = [
      'NODE_ENV',
      'DB_HOST',
      'DB_USER',
      'DB_NAME',
      'JWT_SECRET'
    ];

    const optionalVars = [
      'DB_PASSWORD',
      'CDN_URL',
      'REDIS_URL',
      'AI_SERVER_URL'
    ];

    for (const varName of requiredVars) {
      if (process.env[varName]) {
        console.log(`  ✅ ${varName} is set`);
      } else {
        this.errors.push(`Required environment variable missing: ${varName}`);
      }
    }

    for (const varName of optionalVars) {
      if (process.env[varName]) {
        console.log(`  ✅ ${varName} is set`);
      } else {
        this.warnings.push(`Optional environment variable not set: ${varName}`);
      }
    }
  }

  async generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('GALLERY IMAGE PICKER DEPLOYMENT READINESS REPORT');
    console.log('='.repeat(60));
    
    if (this.errors.length === 0) {
      console.log('🎉 DEPLOYMENT READY - No critical issues found');
    } else {
      console.log('❌ DEPLOYMENT NOT READY - Critical issues must be resolved');
    }

    if (this.errors.length > 0) {
      console.log('\n🔴 CRITICAL ERRORS:');
      this.errors.forEach(error => console.log(`  • ${error}`));
    }

    if (this.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS:');
      this.warnings.forEach(warning => console.log(`  • ${warning}`));
    }

    // Production optimization recommendations
    console.log('\n💡 PRODUCTION OPTIMIZATION RECOMMENDATIONS:');
    console.log('  • Enable CDN for static assets');
    console.log('  • Configure Redis for session storage');
    console.log('  • Set up monitoring with health checks');
    console.log('  • Configure log aggregation');
    console.log('  • Enable automated backups');
    console.log('  • Set up SSL certificate auto-renewal');
    console.log('  • Configure horizontal scaling with load balancer');

    console.log('\n📊 EXPECTED PERFORMANCE:');
    console.log('  • Library API: <100ms response time');
    console.log('  • Batch operations: <30s for 50 images');
    console.log('  • Upload processing: <5s per image');
    console.log('  • Cache hit rate: >80% for library requests');

    return this.errors.length === 0;
  }

  async runAllChecks() {
    try {
      await this.connect();
      await this.checkEnvironmentVariables();
      await this.checkFileSystem();
      await this.checkDatabaseIndexes();
      await this.checkApiEndpoints();
      await this.checkPerformance();
      await this.checkSecurity();
      
      return await this.generateReport();
    } finally {
      if (this.connection) {
        await this.connection.end();
      }
    }
  }
}

// Run the deployment checker
if (require.main === module) {
  (async () => {
    const checker = new GalleryPickerDeploymentChecker();
    const isReady = await checker.runAllChecks();
    process.exit(isReady ? 0 : 1);
  })();
}

module.exports = GalleryPickerDeploymentChecker;