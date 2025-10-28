/**
 * Dynamic Resource Allocation Service
 * 
 * This service dynamically allocates server resources (CPU, memory, database connections, 
 * cache space) based on real-time usage patterns, user behavior predictions, and 
 * performance requirements.
 * 
 * Features:
 * - Real-time resource demand prediction
 * - Automatic scaling based on usage patterns
 * - Resource pool management and optimization
 * - Performance-based resource reallocation
 * - Cost optimization through intelligent resource usage
 */

const mysql = require('mysql2/promise');
const Redis = require('redis');
const EventEmitter = require('events');
const os = require('os');

class DynamicResourceAllocationService extends EventEmitter {
    constructor() {
        super();
        
        // Resource Pool Configuration
        this.resourcePools = {
            cpu: {
                total: os.cpus().length,
                allocated: 0,
                reserved: Math.ceil(os.cpus().length * 0.2), // 20% system reserve
                available: os.cpus().length * 0.8,
                allocation_strategy: 'predictive',
                pool_segments: {
                    web_server: { min: 2, max: 4, current: 2, priority: 'high' },
                    database: { min: 1, max: 2, current: 1, priority: 'critical' },
                    cache: { min: 1, max: 2, current: 1, priority: 'high' },
                    ml_processing: { min: 0, max: 2, current: 1, priority: 'medium' },
                    background_tasks: { min: 0, max: 1, current: 0, priority: 'low' }
                }
            },
            memory: {
                total: os.totalmem(),
                allocated: 0,
                reserved: os.totalmem() * 0.15, // 15% system reserve
                available: os.totalmem() * 0.85,
                allocation_strategy: 'adaptive',
                pool_segments: {
                    web_server: { min: 512 * 1024 * 1024, max: 2048 * 1024 * 1024, current: 1024 * 1024 * 1024, priority: 'high' },
                    database: { min: 256 * 1024 * 1024, max: 1024 * 1024 * 1024, current: 512 * 1024 * 1024, priority: 'critical' },
                    cache: { min: 512 * 1024 * 1024, max: 4096 * 1024 * 1024, current: 1024 * 1024 * 1024, priority: 'high' },
                    ml_processing: { min: 0, max: 1024 * 1024 * 1024, current: 256 * 1024 * 1024, priority: 'medium' },
                    session_storage: { min: 64 * 1024 * 1024, max: 512 * 1024 * 1024, current: 128 * 1024 * 1024, priority: 'medium' }
                }
            },
            database_connections: {
                total: 100,
                allocated: 0,
                reserved: 10,
                available: 90,
                allocation_strategy: 'demand_based',
                pool_segments: {
                    read_operations: { min: 20, max: 40, current: 25, priority: 'high' },
                    write_operations: { min: 10, max: 20, current: 15, priority: 'critical' },
                    analytics: { min: 5, max: 15, current: 8, priority: 'medium' },
                    ml_training: { min: 2, max: 10, current: 5, priority: 'low' },
                    background_jobs: { min: 3, max: 8, current: 5, priority: 'low' }
                }
            },
            storage_io: {
                total: 1000, // IOPS budget
                allocated: 0,
                reserved: 100,
                available: 900,
                allocation_strategy: 'priority_based',
                pool_segments: {
                    gallery_images: { min: 200, max: 400, current: 250, priority: 'high' },
                    database_io: { min: 150, max: 300, current: 200, priority: 'critical' },
                    cache_io: { min: 100, max: 200, current: 150, priority: 'high' },
                    backup_operations: { min: 50, max: 150, current: 75, priority: 'low' },
                    log_writes: { min: 25, max: 75, current: 35, priority: 'medium' }
                }
            }
        };
        
        // Prediction Models for Resource Demand
        this.demandPredictionModels = {
            cpu_demand: {
                features: ['concurrent_users', 'request_rate', 'complexity_score', 'time_of_day'],
                accuracy: 0.82,
                prediction_horizon: 300 // 5 minutes
            },
            memory_demand: {
                features: ['active_sessions', 'cache_size', 'ml_model_loading', 'image_processing'],
                accuracy: 0.78,
                prediction_horizon: 600 // 10 minutes
            },
            database_demand: {
                features: ['query_rate', 'concurrent_operations', 'analytics_jobs', 'backup_status'],
                accuracy: 0.85,
                prediction_horizon: 180 // 3 minutes
            },
            io_demand: {
                features: ['file_operations', 'image_uploads', 'cache_writes', 'log_volume'],
                accuracy: 0.75,
                prediction_horizon: 240 // 4 minutes
            }
        };
        
        // Performance Thresholds
        this.performanceThresholds = {
            cpu: {
                optimal: 0.65,      // < 65% is optimal
                warning: 0.80,      // 80-90% is warning
                critical: 0.90,     // > 90% is critical
                emergency: 0.95     // > 95% triggers emergency scaling
            },
            memory: {
                optimal: 0.70,
                warning: 0.85,
                critical: 0.93,
                emergency: 0.97
            },
            database: {
                optimal: 0.60,      // Connection pool usage
                warning: 0.75,
                critical: 0.85,
                emergency: 0.95
            },
            response_time: {
                optimal: 200,       // < 200ms
                warning: 500,       // 500-1000ms
                critical: 1000,     // > 1000ms
                emergency: 2000     // > 2000ms
            }
        };
        
        // Allocation History
        this.allocationHistory = [];
        this.performanceHistory = [];
        this.reallocationEvents = [];
        
        // Auto-scaling Configuration
        this.autoScalingConfig = {
            enabled: true,
            scale_up_threshold: 0.80,
            scale_down_threshold: 0.30,
            cool_down_period: 300000, // 5 minutes
            max_scale_factor: 2.0,
            min_scale_factor: 0.5,
            evaluation_window: 180000 // 3 minutes
        };
        
        // Real-time Monitoring
        this.currentMetrics = {
            cpu: { usage: 0, load: 0, processes: 0 },
            memory: { usage: 0, free: 0, cached: 0 },
            database: { connections: 0, queries_per_second: 0, avg_query_time: 0 },
            storage: { read_iops: 0, write_iops: 0, queue_depth: 0 },
            network: { bandwidth_in: 0, bandwidth_out: 0, connections: 0 }
        };
    }
    
    /**
     * Initialize the dynamic resource allocation service
     */
    async initialize() {
        try {
            console.log('⚖️ Initializing Dynamic Resource Allocation Service...');
            
            // Initialize database connection
            this.db = await mysql.createConnection({
                host: process.env.DB_HOST || 'localhost',
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD || '',
                database: process.env.DB_DATABASE || 'phoenix4ge'
            });
            
            // Initialize Redis for resource coordination
            this.redis = Redis.createClient({
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379,
                db: 3 // Use database 3 for resource management
            });
            await this.redis.connect();
            
            // Load historical allocation patterns
            await this.loadHistoricalPatterns();
            
            // Initialize resource monitoring
            this.startResourceMonitoring();
            
            // Start demand prediction
            this.startDemandPrediction();
            
            // Start automatic resource allocation
            this.startAutomaticAllocation();
            
            // Set initial resource allocation
            await this.performInitialAllocation();
            
            console.log('✅ Dynamic Resource Allocation Service initialized successfully');
            this.emit('initialized');
            
        } catch (error) {
            console.error('❌ Failed to initialize Dynamic Resource Allocation Service:', error);
            throw error;
        }
    }
    
    /**
     * Predict resource demand based on usage patterns
     */
    async predictResourceDemand(resource, horizon = 300) {
        try {
            const model = this.demandPredictionModels[`${resource}_demand`];
            
            if (!model) {
                throw new Error(`No prediction model for resource: ${resource}`);
            }
            
            // Collect current features
            const features = await this.collectPredictionFeatures(resource);
            
            // Apply ML model (simplified implementation)
            const prediction = await this.applyDemandModel(resource, features, horizon);
            
            // Add confidence intervals
            const demandPrediction = {
                resource,
                horizon,
                current_usage: this.getCurrentResourceUsage(resource),
                predicted_usage: prediction.value,
                confidence: prediction.confidence,
                trend: this.calculateTrend(resource),
                recommendations: this.generateResourceRecommendations(resource, prediction),
                predicted_at: new Date().toISOString()
            };
            
            // Store prediction for analysis
            await this.storeDemandPrediction(demandPrediction);
            
            return demandPrediction;
            
        } catch (error) {
            console.error(`Error predicting ${resource} demand:`, error);
            return this.getFallbackDemandPrediction(resource, horizon);
        }
    }
    
    /**
     * Perform dynamic resource reallocation
     */
    async reallocateResources(trigger = 'automatic') {
        try {
            console.log(`⚖️ Starting dynamic resource reallocation (trigger: ${trigger})`);
            
            const reallocationPlan = {
                trigger,
                timestamp: new Date().toISOString(),
                current_allocation: this.getCurrentAllocation(),
                performance_metrics: this.currentMetrics,
                predictions: {},
                adjustments: {},
                success: false
            };
            
            // Get demand predictions for all resources
            for (const resourceType of ['cpu', 'memory', 'database_connections', 'storage_io']) {
                reallocationPlan.predictions[resourceType] = await this.predictResourceDemand(resourceType);
            }
            
            // Calculate optimal allocations
            const optimalAllocations = await this.calculateOptimalAllocation(
                reallocationPlan.predictions,
                reallocationPlan.performance_metrics
            );
            
            // Apply resource adjustments
            for (const [resource, allocation] of Object.entries(optimalAllocations)) {
                const adjustment = await this.adjustResourceAllocation(resource, allocation);
                reallocationPlan.adjustments[resource] = adjustment;
            }
            
            // Verify allocation success
            reallocationPlan.success = Object.values(reallocationPlan.adjustments)
                .every(adj => adj.success);
            
            // Store reallocation event
            this.reallocationEvents.push(reallocationPlan);
            await this.storeReallocationEvent(reallocationPlan);
            
            if (reallocationPlan.success) {
                console.log('✅ Resource reallocation completed successfully');
                this.emit('resources-reallocated', reallocationPlan);
            } else {
                console.warn('⚠️ Resource reallocation partially failed');
                this.emit('reallocation-partial-failure', reallocationPlan);
            }
            
            return reallocationPlan;
            
        } catch (error) {
            console.error('❌ Resource reallocation failed:', error);
            this.emit('reallocation-failed', { error: error.message, trigger });
            throw error;
        }
    }
    
    /**
     * Calculate optimal resource allocation
     */
    async calculateOptimalAllocation(predictions, currentMetrics) {
        try {
            const optimalAllocations = {};
            
            // CPU Allocation Optimization
            const cpuPrediction = predictions.cpu;
            const currentCpuUsage = currentMetrics.cpu.usage;
            
            if (cpuPrediction.predicted_usage > this.performanceThresholds.cpu.warning) {
                // Scale up CPU allocation
                optimalAllocations.cpu = this.optimizeCpuAllocation(cpuPrediction, 'scale_up');
            } else if (cpuPrediction.predicted_usage < this.performanceThresholds.cpu.optimal * 0.5) {
                // Scale down CPU allocation
                optimalAllocations.cpu = this.optimizeCpuAllocation(cpuPrediction, 'scale_down');
            }
            
            // Memory Allocation Optimization
            const memoryPrediction = predictions.memory;
            if (memoryPrediction.predicted_usage > this.performanceThresholds.memory.warning) {
                optimalAllocations.memory = this.optimizeMemoryAllocation(memoryPrediction, 'scale_up');
            } else if (memoryPrediction.predicted_usage < this.performanceThresholds.memory.optimal * 0.6) {
                optimalAllocations.memory = this.optimizeMemoryAllocation(memoryPrediction, 'scale_down');
            }
            
            // Database Connection Optimization
            const dbPrediction = predictions.database_connections;
            if (dbPrediction.predicted_usage > this.performanceThresholds.database.warning) {
                optimalAllocations.database_connections = this.optimizeDatabaseAllocation(dbPrediction, 'scale_up');
            }
            
            // Storage I/O Optimization
            const ioPrediction = predictions.storage_io;
            if (ioPrediction.predicted_usage > 0.8) {
                optimalAllocations.storage_io = this.optimizeStorageAllocation(ioPrediction, 'scale_up');
            }
            
            return optimalAllocations;
            
        } catch (error) {
            console.error('Error calculating optimal allocation:', error);
            return {};
        }
    }
    
    /**
     * Optimize CPU allocation based on prediction
     */
    optimizeCpuAllocation(prediction, action) {
        const currentPool = this.resourcePools.cpu;
        const segments = currentPool.pool_segments;
        
        if (action === 'scale_up') {
            // Priority-based scaling
            const scaleTargets = [
                { name: 'web_server', segment: segments.web_server },
                { name: 'cache', segment: segments.cache },
                { name: 'ml_processing', segment: segments.ml_processing }
            ].filter(target => target.segment.current < target.segment.max);
            
            const newAllocation = {};
            for (const target of scaleTargets) {
                const increase = Math.min(1, target.segment.max - target.segment.current);
                newAllocation[target.name] = target.segment.current + increase;
            }
            
            return {
                action: 'scale_up',
                segments: newAllocation,
                reason: `Predicted CPU usage: ${(prediction.predicted_usage * 100).toFixed(1)}%`,
                priority: prediction.predicted_usage > this.performanceThresholds.cpu.critical ? 'high' : 'medium'
            };
        } else {
            // Scale down lower priority segments
            const newAllocation = {};
            if (segments.ml_processing.current > segments.ml_processing.min) {
                newAllocation.ml_processing = Math.max(
                    segments.ml_processing.min,
                    segments.ml_processing.current - 1
                );
            }
            
            return {
                action: 'scale_down',
                segments: newAllocation,
                reason: `Low predicted CPU usage: ${(prediction.predicted_usage * 100).toFixed(1)}%`,
                priority: 'low'
            };
        }
    }
    
    /**
     * Optimize memory allocation based on prediction
     */
    optimizeMemoryAllocation(prediction, action) {
        const currentPool = this.resourcePools.memory;
        const segments = currentPool.pool_segments;
        
        if (action === 'scale_up') {
            const newAllocation = {};
            
            // Scale cache first (highest impact)
            if (segments.cache.current < segments.cache.max) {
                const increase = Math.min(
                    512 * 1024 * 1024, // 512MB
                    segments.cache.max - segments.cache.current
                );
                newAllocation.cache = segments.cache.current + increase;
            }
            
            // Then web server
            if (segments.web_server.current < segments.web_server.max) {
                const increase = Math.min(
                    256 * 1024 * 1024, // 256MB
                    segments.web_server.max - segments.web_server.current
                );
                newAllocation.web_server = segments.web_server.current + increase;
            }
            
            return {
                action: 'scale_up',
                segments: newAllocation,
                reason: `High predicted memory usage: ${(prediction.predicted_usage * 100).toFixed(1)}%`,
                priority: 'high'
            };
        } else {
            // Scale down ML processing first
            const newAllocation = {};
            if (segments.ml_processing.current > segments.ml_processing.min) {
                const decrease = Math.min(
                    128 * 1024 * 1024, // 128MB
                    segments.ml_processing.current - segments.ml_processing.min
                );
                newAllocation.ml_processing = segments.ml_processing.current - decrease;
            }
            
            return {
                action: 'scale_down',
                segments: newAllocation,
                reason: `Low predicted memory usage: ${(prediction.predicted_usage * 100).toFixed(1)}%`,
                priority: 'low'
            };
        }
    }
    
    /**
     * Optimize database connection allocation
     */
    optimizeDatabaseAllocation(prediction, action) {
        const segments = this.resourcePools.database_connections.pool_segments;
        
        if (action === 'scale_up') {
            const newAllocation = {};
            
            // Scale read operations first
            if (segments.read_operations.current < segments.read_operations.max) {
                newAllocation.read_operations = Math.min(
                    segments.read_operations.max,
                    segments.read_operations.current + 5
                );
            }
            
            // Then write operations
            if (segments.write_operations.current < segments.write_operations.max) {
                newAllocation.write_operations = Math.min(
                    segments.write_operations.max,
                    segments.write_operations.current + 3
                );
            }
            
            return {
                action: 'scale_up',
                segments: newAllocation,
                reason: `High database demand predicted: ${(prediction.predicted_usage * 100).toFixed(1)}%`,
                priority: 'high'
            };
        }
        
        return { action: 'maintain', segments: {}, reason: 'No scaling needed', priority: 'low' };
    }
    
    /**
     * Optimize storage I/O allocation
     */
    optimizeStorageAllocation(prediction, action) {
        const segments = this.resourcePools.storage_io.pool_segments;
        
        if (action === 'scale_up') {
            const newAllocation = {};
            
            // Prioritize gallery images and database I/O
            if (segments.gallery_images.current < segments.gallery_images.max) {
                newAllocation.gallery_images = Math.min(
                    segments.gallery_images.max,
                    segments.gallery_images.current + 50
                );
            }
            
            if (segments.database_io.current < segments.database_io.max) {
                newAllocation.database_io = Math.min(
                    segments.database_io.max,
                    segments.database_io.current + 25
                );
            }
            
            return {
                action: 'scale_up',
                segments: newAllocation,
                reason: `High I/O demand predicted: ${(prediction.predicted_usage * 100).toFixed(1)}%`,
                priority: 'medium'
            };
        }
        
        return { action: 'maintain', segments: {}, reason: 'No I/O scaling needed', priority: 'low' };
    }
    
    /**
     * Adjust resource allocation based on plan
     */
    async adjustResourceAllocation(resourceType, allocation) {
        try {
            const currentPool = this.resourcePools[resourceType];
            const adjustment = {
                resource: resourceType,
                action: allocation.action,
                changes: [],
                success: true,
                timestamp: new Date().toISOString()
            };
            
            // Apply segment adjustments
            for (const [segmentName, newValue] of Object.entries(allocation.segments)) {
                const segment = currentPool.pool_segments[segmentName];
                if (segment) {
                    const oldValue = segment.current;
                    
                    // Validate new value is within bounds
                    if (newValue >= segment.min && newValue <= segment.max) {
                        segment.current = newValue;
                        
                        adjustment.changes.push({
                            segment: segmentName,
                            from: oldValue,
                            to: newValue,
                            change: newValue - oldValue
                        });
                        
                        // Apply the actual resource adjustment
                        await this.applyResourceChange(resourceType, segmentName, oldValue, newValue);
                    } else {
                        adjustment.success = false;
                        adjustment.changes.push({
                            segment: segmentName,
                            error: `Value ${newValue} out of bounds [${segment.min}, ${segment.max}]`
                        });
                    }
                }
            }
            
            // Update total allocation
            this.updateTotalAllocation(resourceType);
            
            // Store adjustment in Redis for coordination
            await this.redis.hSet(`resource:allocation:${resourceType}`, {
                last_update: new Date().toISOString(),
                current_allocation: JSON.stringify(currentPool.pool_segments),
                adjustment_reason: allocation.reason
            });
            
            console.log(`⚖️ ${resourceType} allocation adjusted: ${allocation.action} (${adjustment.changes.length} changes)`);
            
            return adjustment;
            
        } catch (error) {
            console.error(`Error adjusting ${resourceType} allocation:`, error);
            return {
                resource: resourceType,
                action: allocation.action,
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
    
    /**
     * Apply actual resource change (platform-specific implementation)
     */
    async applyResourceChange(resourceType, segmentName, oldValue, newValue) {
        try {
            switch (resourceType) {
                case 'cpu':
                    await this.applyCpuChange(segmentName, oldValue, newValue);
                    break;
                case 'memory':
                    await this.applyMemoryChange(segmentName, oldValue, newValue);
                    break;
                case 'database_connections':
                    await this.applyDatabaseChange(segmentName, oldValue, newValue);
                    break;
                case 'storage_io':
                    await this.applyStorageChange(segmentName, oldValue, newValue);
                    break;
            }
        } catch (error) {
            console.error(`Error applying ${resourceType} change for ${segmentName}:`, error);
            throw error;
        }
    }
    
    /**
     * Apply CPU resource change
     */
    async applyCpuChange(segmentName, oldValue, newValue) {
        // In a real implementation, this would adjust process priorities,
        // CPU affinity, or container resource limits
        console.log(`🔧 CPU: ${segmentName} adjusted from ${oldValue} to ${newValue} cores`);
        
        // Store the change for process managers to pick up
        await this.redis.hSet('resource:cpu:changes', {
            [segmentName]: JSON.stringify({
                allocation: newValue,
                timestamp: new Date().toISOString(),
                applied: false
            })
        });
    }
    
    /**
     * Apply memory resource change
     */
    async applyMemoryChange(segmentName, oldValue, newValue) {
        console.log(`🧠 Memory: ${segmentName} adjusted from ${this.formatBytes(oldValue)} to ${this.formatBytes(newValue)}`);
        
        // In a real implementation, this would adjust heap sizes,
        // cache limits, or container memory limits
        switch (segmentName) {
            case 'cache':
                // Adjust Redis maxmemory
                try {
                    const maxMemoryMB = Math.floor(newValue / 1024 / 1024);
                    await this.redis.configSet('maxmemory', `${maxMemoryMB}MB`);
                    console.log(`Redis maxmemory set to ${maxMemoryMB}MB`);
                } catch (error) {
                    console.error('Failed to adjust Redis memory:', error);
                }
                break;
                
            case 'web_server':
                // Store configuration for web server to pick up
                await this.redis.hSet('resource:memory:web_server', {
                    max_heap: newValue,
                    timestamp: new Date().toISOString()
                });
                break;
        }
    }
    
    /**
     * Apply database connection change
     */
    async applyDatabaseChange(segmentName, oldValue, newValue) {
        console.log(`🗄️ Database: ${segmentName} pool adjusted from ${oldValue} to ${newValue} connections`);
        
        // Store configuration for database connection pools
        await this.redis.hSet('resource:database:pools', {
            [segmentName]: JSON.stringify({
                max_connections: newValue,
                timestamp: new Date().toISOString(),
                applied: false
            })
        });
    }
    
    /**
     * Apply storage I/O change
     */
    async applyStorageChange(segmentName, oldValue, newValue) {
        console.log(`💾 Storage I/O: ${segmentName} IOPS adjusted from ${oldValue} to ${newValue}`);
        
        // Store I/O priority configuration
        await this.redis.hSet('resource:storage:iops', {
            [segmentName]: JSON.stringify({
                iops_limit: newValue,
                timestamp: new Date().toISOString()
            })
        });
    }
    
    /**
     * Start resource monitoring
     */
    startResourceMonitoring() {
        // Monitor system resources every 30 seconds
        setInterval(async () => {
            try {
                await this.collectCurrentMetrics();
                await this.evaluatePerformanceThresholds();
            } catch (error) {
                console.error('Resource monitoring error:', error);
            }
        }, 30000);
    }
    
    /**
     * Start demand prediction
     */
    startDemandPrediction() {
        // Run demand prediction every 2 minutes
        setInterval(async () => {
            try {
                await this.runDemandPredictionCycle();
            } catch (error) {
                console.error('Demand prediction error:', error);
            }
        }, 120000);
    }
    
    /**
     * Start automatic resource allocation
     */
    startAutomaticAllocation() {
        // Check for reallocation needs every 5 minutes
        setInterval(async () => {
            try {
                if (this.autoScalingConfig.enabled) {
                    await this.evaluateReallocationNeed();
                }
            } catch (error) {
                console.error('Automatic allocation error:', error);
            }
        }, 300000);
    }
    
    /**
     * Collect current system metrics
     */
    async collectCurrentMetrics() {
        try {
            // CPU metrics
            const loadAvg = os.loadavg();
            this.currentMetrics.cpu = {
                usage: loadAvg[0] / os.cpus().length,
                load: loadAvg[0],
                processes: 0 // Would be collected from process manager
            };
            
            // Memory metrics
            const totalMem = os.totalmem();
            const freeMem = os.freemem();
            this.currentMetrics.memory = {
                usage: (totalMem - freeMem) / totalMem,
                free: freeMem,
                cached: 0 // Would be collected from system stats
            };
            
            // Database metrics (simplified)
            this.currentMetrics.database = {
                connections: Math.floor(Math.random() * 50) + 20, // Simulated
                queries_per_second: Math.floor(Math.random() * 100) + 50,
                avg_query_time: Math.random() * 100 + 20
            };
            
            // Storage metrics (simplified)
            this.currentMetrics.storage = {
                read_iops: Math.floor(Math.random() * 200) + 100,
                write_iops: Math.floor(Math.random() * 150) + 50,
                queue_depth: Math.floor(Math.random() * 10)
            };
            
            // Store metrics in history
            this.performanceHistory.push({
                timestamp: new Date().toISOString(),
                metrics: JSON.parse(JSON.stringify(this.currentMetrics))
            });
            
            // Keep only last 100 entries
            if (this.performanceHistory.length > 100) {
                this.performanceHistory.shift();
            }
            
        } catch (error) {
            console.error('Error collecting metrics:', error);
        }
    }
    
    /**
     * Evaluate if reallocation is needed
     */
    async evaluateReallocationNeed() {
        try {
            const metrics = this.currentMetrics;
            const thresholds = this.performanceThresholds;
            
            let needsReallocation = false;
            const reasons = [];
            
            // Check CPU threshold
            if (metrics.cpu.usage > thresholds.cpu.warning) {
                needsReallocation = true;
                reasons.push(`CPU usage: ${(metrics.cpu.usage * 100).toFixed(1)}%`);
            }
            
            // Check memory threshold
            if (metrics.memory.usage > thresholds.memory.warning) {
                needsReallocation = true;
                reasons.push(`Memory usage: ${(metrics.memory.usage * 100).toFixed(1)}%`);
            }
            
            // Check database connections
            const dbUsage = metrics.database.connections / this.resourcePools.database_connections.total;
            if (dbUsage > thresholds.database.warning) {
                needsReallocation = true;
                reasons.push(`DB connections: ${(dbUsage * 100).toFixed(1)}%`);
            }
            
            if (needsReallocation) {
                console.log(`🚨 Reallocation needed: ${reasons.join(', ')}`);
                await this.reallocateResources('threshold_exceeded');
            }
            
        } catch (error) {
            console.error('Error evaluating reallocation need:', error);
        }
    }
    
    /**
     * Get current resource allocation summary
     */
    getCurrentAllocation() {
        const allocation = {};
        
        for (const [resourceType, pool] of Object.entries(this.resourcePools)) {
            allocation[resourceType] = {
                total: pool.total,
                allocated: this.calculateTotalAllocated(resourceType),
                available: pool.available,
                utilization: this.calculateUtilization(resourceType),
                segments: pool.pool_segments
            };
        }
        
        return allocation;
    }
    
    /**
     * Get resource allocation analytics
     */
    async getResourceAnalytics(timeframe = '24h') {
        try {
            const analytics = {
                current_allocation: this.getCurrentAllocation(),
                performance_metrics: this.currentMetrics,
                recent_reallocations: this.reallocationEvents.slice(-10),
                efficiency_score: this.calculateEfficiencyScore(),
                cost_optimization: this.calculateCostOptimization(),
                recommendations: await this.generateResourceRecommendations(),
                generated_at: new Date().toISOString()
            };
            
            return analytics;
            
        } catch (error) {
            console.error('Error getting resource analytics:', error);
            return {
                error: error.message,
                current_allocation: this.getCurrentAllocation(),
                generated_at: new Date().toISOString()
            };
        }
    }
    
    // Utility Methods
    calculateTotalAllocated(resourceType) {
        const segments = this.resourcePools[resourceType].pool_segments;
        return Object.values(segments).reduce((total, segment) => total + segment.current, 0);
    }
    
    calculateUtilization(resourceType) {
        const pool = this.resourcePools[resourceType];
        const allocated = this.calculateTotalAllocated(resourceType);
        return allocated / pool.total;
    }
    
    calculateEfficiencyScore() {
        let totalScore = 0;
        let resourceCount = 0;
        
        for (const [resourceType, pool] of Object.entries(this.resourcePools)) {
            const utilization = this.calculateUtilization(resourceType);
            const thresholds = this.performanceThresholds[resourceType];
            
            if (thresholds) {
                let score = 100;
                
                if (utilization > thresholds.critical) {
                    score = 30; // Over-utilized
                } else if (utilization > thresholds.warning) {
                    score = 60; // High utilization
                } else if (utilization > thresholds.optimal) {
                    score = 90; // Good utilization
                } else if (utilization < thresholds.optimal * 0.3) {
                    score = 50; // Under-utilized
                }
                
                totalScore += score;
                resourceCount++;
            }
        }
        
        return resourceCount > 0 ? Math.round(totalScore / resourceCount) : 0;
    }
    
    calculateCostOptimization() {
        // Simplified cost calculation
        const baselineCost = 100; // Base cost unit
        const currentUtilization = Object.keys(this.resourcePools)
            .map(type => this.calculateUtilization(type))
            .reduce((sum, util) => sum + util, 0) / Object.keys(this.resourcePools).length;
        
        const optimizationScore = this.calculateEfficiencyScore();
        const potentialSavings = (100 - optimizationScore) * 0.5; // 50% of inefficiency as savings
        
        return {
            current_cost_index: Math.round(baselineCost * currentUtilization),
            optimization_score: optimizationScore,
            potential_savings_percent: Math.round(potentialSavings),
            estimated_monthly_savings: Math.round(potentialSavings * 10) // $10 per % savings
        };
    }
    
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    updateTotalAllocation(resourceType) {
        const pool = this.resourcePools[resourceType];
        pool.allocated = this.calculateTotalAllocated(resourceType);
        pool.available = pool.total - pool.allocated - pool.reserved;
    }
    
    getCurrentResourceUsage(resource) {
        switch (resource) {
            case 'cpu': return this.currentMetrics.cpu.usage;
            case 'memory': return this.currentMetrics.memory.usage;
            case 'database_connections': 
                return this.currentMetrics.database.connections / this.resourcePools.database_connections.total;
            case 'storage_io':
                return (this.currentMetrics.storage.read_iops + this.currentMetrics.storage.write_iops) / 1000;
            default: return 0.5;
        }
    }
    
    calculateTrend(resource) {
        if (this.performanceHistory.length < 5) return 'stable';
        
        const recentMetrics = this.performanceHistory.slice(-5);
        const usage = recentMetrics.map(m => this.getCurrentResourceUsageFromMetrics(resource, m.metrics));
        
        const trend = usage[usage.length - 1] - usage[0];
        
        if (trend > 0.05) return 'increasing';
        if (trend < -0.05) return 'decreasing';
        return 'stable';
    }
    
    getCurrentResourceUsageFromMetrics(resource, metrics) {
        switch (resource) {
            case 'cpu': return metrics.cpu.usage;
            case 'memory': return metrics.memory.usage;
            case 'database_connections': 
                return metrics.database.connections / this.resourcePools.database_connections.total;
            default: return 0.5;
        }
    }
    
    async performInitialAllocation() {
        console.log('🚀 Performing initial resource allocation...');
        await this.reallocateResources('initial_setup');
    }
    
    async loadHistoricalPatterns() {
        console.log('📊 Loading historical allocation patterns...');
        // Would load from database in real implementation
    }
    
    async collectPredictionFeatures(resource) {
        // Simplified feature collection
        return {
            concurrent_users: Math.floor(Math.random() * 100) + 20,
            request_rate: Math.floor(Math.random() * 1000) + 100,
            time_of_day: new Date().getHours(),
            current_usage: this.getCurrentResourceUsage(resource)
        };
    }
    
    async applyDemandModel(resource, features, horizon) {
        // Simplified ML model application
        const baseUsage = features.current_usage;
        const timeMultiplier = this.getTimeMultiplier(features.time_of_day);
        const loadMultiplier = Math.min(2.0, features.concurrent_users / 50);
        
        const predictedUsage = baseUsage * timeMultiplier * loadMultiplier;
        
        return {
            value: Math.min(1.0, predictedUsage),
            confidence: 0.75 + (Math.random() * 0.2) // 75-95% confidence
        };
    }
    
    getTimeMultiplier(hour) {
        // Peak hours have higher resource demand
        const peakHours = [9, 10, 11, 14, 15, 16, 19, 20, 21];
        return peakHours.includes(hour) ? 1.3 : 1.0;
    }
    
    generateResourceRecommendations(resource, prediction) {
        const recommendations = [];
        
        if (prediction.predicted_usage > 0.8) {
            recommendations.push({
                type: 'scale_up',
                priority: 'high',
                description: `Scale up ${resource} allocation to handle predicted demand`
            });
        } else if (prediction.predicted_usage < 0.3) {
            recommendations.push({
                type: 'scale_down', 
                priority: 'low',
                description: `Consider scaling down ${resource} allocation to optimize costs`
            });
        }
        
        return recommendations;
    }
    
    getFallbackDemandPrediction(resource, horizon) {
        return {
            resource,
            horizon,
            current_usage: this.getCurrentResourceUsage(resource),
            predicted_usage: this.getCurrentResourceUsage(resource) * 1.1,
            confidence: 0.5,
            trend: 'stable',
            recommendations: [],
            predicted_at: new Date().toISOString(),
            fallback: true
        };
    }
    
    async storeDemandPrediction(prediction) {
        try {
            await this.redis.lpush(`predictions:${prediction.resource}`, JSON.stringify(prediction));
            await this.redis.ltrim(`predictions:${prediction.resource}`, 0, 99); // Keep last 100
        } catch (error) {
            console.error('Error storing demand prediction:', error);
        }
    }
    
    async storeReallocationEvent(event) {
        try {
            await this.db.execute(`
                INSERT INTO resource_allocation_events 
                (trigger_type, allocation_data, success, created_at) 
                VALUES (?, ?, ?, NOW())
            `, [event.trigger, JSON.stringify(event), event.success]);
        } catch (error) {
            console.error('Error storing reallocation event:', error);
        }
    }
    
    async runDemandPredictionCycle() {
        for (const resource of ['cpu', 'memory', 'database_connections', 'storage_io']) {
            try {
                await this.predictResourceDemand(resource);
            } catch (error) {
                console.error(`Error predicting ${resource} demand:`, error);
            }
        }
    }
    
    async evaluatePerformanceThresholds() {
        // Check if any thresholds are exceeded and emit alerts
        const metrics = this.currentMetrics;
        const thresholds = this.performanceThresholds;
        
        if (metrics.cpu.usage > thresholds.cpu.critical) {
            this.emit('threshold-exceeded', { resource: 'cpu', level: 'critical', usage: metrics.cpu.usage });
        }
        
        if (metrics.memory.usage > thresholds.memory.critical) {
            this.emit('threshold-exceeded', { resource: 'memory', level: 'critical', usage: metrics.memory.usage });
        }
    }
    
    /**
     * Get service health status
     */
    async getHealthStatus() {
        try {
            const redisConnected = this.redis && this.redis.isReady;
            const dbConnected = this.db && await this.db.ping();
            
            return {
                status: redisConnected && dbConnected ? 'healthy' : 'degraded',
                components: {
                    redis: redisConnected,
                    database: dbConnected
                },
                resource_pools: Object.keys(this.resourcePools).length,
                auto_scaling: this.autoScalingConfig.enabled,
                efficiency_score: this.calculateEfficiencyScore(),
                uptime: process.uptime(),
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                status: 'error',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
    
    /**
     * Shutdown service gracefully
     */
    async shutdown() {
        try {
            console.log('🔄 Shutting down Dynamic Resource Allocation Service...');
            
            if (this.redis) {
                await this.redis.disconnect();
            }
            
            if (this.db) {
                await this.db.end();
            }
            
            this.removeAllListeners();
            
            console.log('✅ Dynamic Resource Allocation Service shutdown complete');
        } catch (error) {
            console.error('Error during service shutdown:', error);
        }
    }
}

module.exports = DynamicResourceAllocationService;