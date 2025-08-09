/**
 * Real-Time Streaming API Routes
 * Part of Phase E.4: Real-time data streaming and processing
 * Provides API endpoints for stream management, data ingestion, and real-time processing
 */

const express = require('express');
const router = express.Router();
const RealTimeStreamingService = require('../../src/services/RealTimeStreamingService');
const AdvancedAnalyticsService = require('../../src/services/AdvancedAnalyticsService');

// Initialize streaming service
let streamingService = null;
let analyticsService = null;

// Middleware to initialize streaming service
router.use((req, res, next) => {
    if (!streamingService) {
        // Initialize analytics service first if not already done
        if (!analyticsService) {
            analyticsService = new AdvancedAnalyticsService(req.db, {
                collection: {
                    realTimeInterval: 30000,
                    aggregationInterval: 300000
                }
            });
        }

        const config = {
            streaming: {
                bufferSize: parseInt(process.env.STREAMING_BUFFER_SIZE) || 1000,
                windowSize: parseInt(process.env.STREAMING_WINDOW_SIZE) || 60000,
                maxConnections: parseInt(process.env.STREAMING_MAX_CONNECTIONS) || 500,
                heartbeatInterval: parseInt(process.env.STREAMING_HEARTBEAT) || 30000,
                enableCompression: process.env.STREAMING_COMPRESSION !== 'false',
                rateLimitPerSecond: parseInt(process.env.STREAMING_RATE_LIMIT) || 100
            },
            processing: {
                enableBatching: process.env.STREAMING_BATCHING !== 'false',
                batchSize: parseInt(process.env.STREAMING_BATCH_SIZE) || 50,
                processingTimeout: parseInt(process.env.STREAMING_PROCESSING_TIMEOUT) || 5000,
                enableParallel: process.env.STREAMING_PARALLEL !== 'false',
                maxConcurrency: parseInt(process.env.STREAMING_MAX_CONCURRENCY) || 10
            },
            aggregation: {
                enableWindowing: process.env.STREAMING_WINDOWING !== 'false',
                windowTypes: (process.env.STREAMING_WINDOW_TYPES || 'sliding,tumbling,session').split(','),
                maxWindows: parseInt(process.env.STREAMING_MAX_WINDOWS) || 100
            },
            storage: {
                streamingDir: process.env.STREAMING_STORAGE_DIR || '/tmp/musenest-streaming'
            }
        };

        streamingService = new RealTimeStreamingService(req.db, analyticsService, config);
        console.log('🚀 RealTimeStreamingService initialized for API routes');
    }
    next();
});

/**
 * GET /api/streaming/status
 * Get streaming service status and overview
 */
router.get('/status', (req, res) => {
    try {
        if (!streamingService) {
            return res.status(500).json({
                success: false,
                error: 'Streaming service not initialized'
            });
        }

        const status = streamingService.getStreamingStatus();
        
        res.json({
            success: true,
            status: {
                service: {
                    active: status.isActive,
                    lastHeartbeat: new Date(status.lastHeartbeat).toISOString(),
                    uptime: Date.now() - status.lastHeartbeat
                },
                streams: {
                    active: status.activeStreams,
                    totalSubscribers: status.totalSubscribers,
                    avgSubscribersPerStream: status.activeStreams > 0 ? 
                        Math.round(status.totalSubscribers / status.activeStreams * 100) / 100 : 0
                },
                connections: {
                    total: status.connectionStats.total,
                    active: status.connectionStats.active,
                    disconnected: status.connectionStats.disconnected,
                    utilization: status.configuration.streaming.maxConnections > 0 ?
                        Math.round((status.connectionStats.active / status.configuration.streaming.maxConnections) * 100) : 0
                },
                performance: {
                    totalBufferSize: status.bufferSizes.reduce((sum, b) => sum + b.bufferSize, 0),
                    bufferedStreams: status.bufferSizes.filter(b => b.bufferSize > 0).length,
                    maxBufferSize: Math.max(0, ...status.bufferSizes.map(b => b.bufferSize))
                },
                configuration: {
                    bufferSize: status.configuration.streaming.bufferSize,
                    windowSize: status.configuration.streaming.windowSize,
                    windowSizeMinutes: Math.round(status.configuration.streaming.windowSize / 60000),
                    maxConnections: status.configuration.streaming.maxConnections,
                    rateLimitPerSecond: status.configuration.streaming.rateLimitPerSecond,
                    batchingEnabled: status.configuration.processing.enableBatching,
                    windowingEnabled: status.configuration.aggregation.enableWindowing
                }
            },
            timestamp: Date.now()
        });

    } catch (error) {
        console.error('❌ Error getting streaming status:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get streaming status'
        });
    }
});

/**
 * GET /api/streaming/streams
 * Get list of active streams
 */
router.get('/streams', (req, res) => {
    try {
        if (!streamingService) {
            return res.status(500).json({
                success: false,
                error: 'Streaming service not initialized'
            });
        }

        const streams = streamingService.getStreams();
        
        res.json({
            success: true,
            streams: streams.map(stream => ({
                id: stream.id,
                name: stream.name,
                type: stream.type,
                subscriberCount: stream.subscriberCount,
                dataCount: stream.dataCount,
                bytesTransferred: stream.bytesTransferred,
                bytesMB: Math.round(stream.bytesTransferred / (1024 * 1024) * 100) / 100,
                uptime: stream.uptime,
                uptimeMinutes: Math.round(stream.uptime / 60000),
                isActive: stream.isActive,
                lastActivity: new Date(stream.lastActivity).toISOString(),
                throughput: stream.uptime > 0 ? Math.round(stream.dataCount / (stream.uptime / 1000) * 100) / 100 : 0 // data points per second
            })),
            summary: {
                total: streams.length,
                active: streams.filter(s => s.isActive).length,
                totalDataPoints: streams.reduce((sum, s) => sum + s.dataCount, 0),
                totalSubscribers: streams.reduce((sum, s) => sum + s.subscriberCount, 0)
            }
        });

    } catch (error) {
        console.error('❌ Error getting streams:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get streams'
        });
    }
});

/**
 * POST /api/streaming/streams
 * Create a new data stream
 */
router.post('/streams', (req, res) => {
    try {
        if (!streamingService) {
            return res.status(500).json({
                success: false,
                error: 'Streaming service not initialized'
            });
        }

        const streamConfig = req.body;
        
        // Validate required fields
        if (!streamConfig.name) {
            return res.status(400).json({
                success: false,
                error: 'Stream name is required'
            });
        }

        console.log(`🚀 Creating stream: ${streamConfig.name}`);
        
        const stream = streamingService.createStream(streamConfig);
        
        res.status(201).json({
            success: true,
            message: 'Stream created successfully',
            stream: {
                id: stream.id,
                name: stream.name,
                type: stream.type,
                source: stream.source,
                filters: stream.filters,
                aggregations: stream.aggregations,
                windowConfig: stream.windowConfig,
                created: new Date(stream.created).toISOString(),
                subscriberCount: stream.subscribers.size
            }
        });

    } catch (error) {
        console.error('❌ Error creating stream:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to create stream'
        });
    }
});

/**
 * GET /api/streaming/streams/:streamId
 * Get detailed information about a specific stream
 */
router.get('/streams/:streamId', (req, res) => {
    try {
        if (!streamingService) {
            return res.status(500).json({
                success: false,
                error: 'Streaming service not initialized'
            });
        }

        const { streamId } = req.params;
        const streamDetails = streamingService.getStreamDetails(streamId);
        
        if (!streamDetails) {
            return res.status(404).json({
                success: false,
                error: 'Stream not found'
            });
        }

        res.json({
            success: true,
            stream: {
                id: streamDetails.id,
                name: streamDetails.name,
                type: streamDetails.type,
                source: streamDetails.source,
                isActive: streamDetails.isActive,
                created: new Date(streamDetails.created).toISOString(),
                lastActivity: new Date(streamDetails.lastActivity).toISOString(),
                statistics: {
                    dataCount: streamDetails.dataCount,
                    bytesTransferred: streamDetails.bytesTransferred,
                    bytesMB: Math.round(streamDetails.bytesTransferred / (1024 * 1024) * 100) / 100,
                    subscriberCount: streamDetails.subscriberDetails.length,
                    uptime: Date.now() - streamDetails.created,
                    uptimeHours: Math.round((Date.now() - streamDetails.created) / 3600000 * 100) / 100,
                    currentBufferSize: streamDetails.currentBufferSize,
                    throughput: streamDetails.dataCount > 0 && streamDetails.created ? 
                        Math.round(streamDetails.dataCount / ((Date.now() - streamDetails.created) / 1000) * 100) / 100 : 0
                },
                configuration: {
                    filters: streamDetails.filters,
                    aggregations: streamDetails.aggregations,
                    windowConfig: streamDetails.windowConfig
                },
                subscribers: streamDetails.subscriberDetails.map(sub => ({
                    id: sub.id,
                    name: sub.name,
                    type: sub.type,
                    dataFormat: sub.dataFormat,
                    messageCount: sub.messageCount,
                    lastMessage: new Date(sub.lastMessage).toISOString(),
                    isActive: sub.isActive,
                    rateLimitPerSecond: sub.rateLimitPerSecond
                })),
                windowing: streamDetails.windowSummary
            }
        });

    } catch (error) {
        console.error('❌ Error getting stream details:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get stream details'
        });
    }
});

/**
 * POST /api/streaming/streams/:streamId/subscribe
 * Subscribe to a data stream
 */
router.post('/streams/:streamId/subscribe', (req, res) => {
    try {
        if (!streamingService) {
            return res.status(500).json({
                success: false,
                error: 'Streaming service not initialized'
            });
        }

        const { streamId } = req.params;
        const subscriberConfig = req.body;
        
        // Validate required fields
        if (!subscriberConfig.name) {
            return res.status(400).json({
                success: false,
                error: 'Subscriber name is required'
            });
        }

        if (!subscriberConfig.type || !['websocket', 'http', 'callback'].includes(subscriberConfig.type)) {
            return res.status(400).json({
                success: false,
                error: 'Valid subscriber type is required (websocket, http, callback)'
            });
        }

        console.log(`👥 Creating subscription for stream ${streamId}: ${subscriberConfig.name}`);
        
        const subscriber = streamingService.subscribeToStream(streamId, subscriberConfig);
        
        res.status(201).json({
            success: true,
            message: 'Subscription created successfully',
            subscriber: {
                id: subscriber.id,
                streamId: subscriber.streamId,
                name: subscriber.name,
                type: subscriber.type,
                dataFormat: subscriber.dataFormat,
                rateLimitPerSecond: subscriber.rateLimitPerSecond,
                compressionEnabled: subscriber.compressionEnabled,
                filters: subscriber.filters,
                created: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('❌ Error creating subscription:', error.message);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/streaming/streams/:streamId/data
 * Ingest data into a stream
 */
router.post('/streams/:streamId/data', async (req, res) => {
    try {
        if (!streamingService) {
            return res.status(500).json({
                success: false,
                error: 'Streaming service not initialized'
            });
        }

        const { streamId } = req.params;
        const { data, metadata = {} } = req.body;
        
        if (!data) {
            return res.status(400).json({
                success: false,
                error: 'Data is required'
            });
        }

        const processedData = await streamingService.ingestData(streamId, data, metadata);
        
        res.json({
            success: true,
            message: 'Data ingested successfully',
            result: {
                id: processedData.id,
                streamId: processedData.streamId,
                timestamp: new Date(processedData.timestamp).toISOString(),
                originalSize: processedData.metadata.originalSize,
                processed: new Date(processedData.metadata.processed).toISOString(),
                source: processedData.metadata.source
            }
        });

    } catch (error) {
        console.error('❌ Error ingesting data:', error.message);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/streaming/streams/:streamId/close
 * Close a stream
 */
router.post('/streams/:streamId/close', (req, res) => {
    try {
        if (!streamingService) {
            return res.status(500).json({
                success: false,
                error: 'Streaming service not initialized'
            });
        }

        const { streamId } = req.params;
        
        console.log(`🔚 Closing stream: ${streamId}`);
        
        streamingService.closeStream(streamId);
        
        res.json({
            success: true,
            message: 'Stream closed successfully',
            streamId,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error closing stream:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to close stream'
        });
    }
});

/**
 * GET /api/streaming/templates
 * Get streaming configuration templates
 */
router.get('/templates', (req, res) => {
    try {
        const templates = {
            streams: [
                {
                    id: 'analytics-stream',
                    name: 'Analytics Data Stream',
                    type: 'analytics',
                    source: 'internal',
                    description: 'Real-time analytics metrics and system performance data',
                    filters: {
                        minValue: 0,
                        tags: ['system', 'performance']
                    },
                    aggregations: ['avg', 'sum', 'count'],
                    windowConfig: {
                        type: 'sliding',
                        size: 300000 // 5 minutes
                    }
                },
                {
                    id: 'business-stream',
                    name: 'Business Metrics Stream',
                    type: 'business',
                    source: 'internal',
                    description: 'Business intelligence and revenue metrics',
                    filters: {
                        tags: ['business', 'revenue', 'customers']
                    },
                    aggregations: ['sum', 'avg', 'count'],
                    windowConfig: {
                        type: 'tumbling',
                        size: 3600000 // 1 hour
                    }
                },
                {
                    id: 'security-stream',
                    name: 'Security Events Stream',
                    type: 'security',
                    source: 'internal',
                    description: 'Real-time security events and threat monitoring',
                    filters: {
                        tags: ['security', 'threats', 'alerts'],
                        minSeverity: 'medium'
                    },
                    aggregations: ['count', 'max'],
                    windowConfig: {
                        type: 'session',
                        timeout: 1800000 // 30 minutes
                    }
                },
                {
                    id: 'user-activity-stream',
                    name: 'User Activity Stream',
                    type: 'activity',
                    source: 'internal',
                    description: 'Real-time user interactions and engagement metrics',
                    filters: {
                        tags: ['user', 'activity', 'engagement']
                    },
                    aggregations: ['count', 'avg'],
                    windowConfig: {
                        type: 'sliding',
                        size: 900000 // 15 minutes
                    }
                }
            ],
            subscribers: [
                {
                    name: 'WebSocket Dashboard',
                    type: 'websocket',
                    dataFormat: 'json',
                    compression: true,
                    rateLimitPerSecond: 50,
                    filters: {
                        tags: ['dashboard', 'realtime']
                    },
                    connection: {
                        // WebSocket connection object would be provided at runtime
                    }
                },
                {
                    name: 'HTTP Webhook',
                    type: 'http',
                    dataFormat: 'json',
                    compression: false,
                    rateLimitPerSecond: 10,
                    filters: {},
                    connection: {
                        url: 'https://api.example.com/webhook',
                        headers: {
                            'Authorization': 'Bearer <token>',
                            'Content-Type': 'application/json'
                        }
                    }
                },
                {
                    name: 'CSV Export',
                    type: 'callback',
                    dataFormat: 'csv',
                    compression: true,
                    rateLimitPerSecond: 1,
                    filters: {
                        tags: ['export', 'batch']
                    },
                    connection: {
                        // Callback function would be provided at runtime
                    }
                }
            ]
        };

        const configurations = {
            windowTypes: [
                {
                    type: 'sliding',
                    name: 'Sliding Window',
                    description: 'Continuously updated window that slides over time',
                    useCase: 'Real-time monitoring and continuous metrics',
                    parameters: ['size (milliseconds)']
                },
                {
                    type: 'tumbling',
                    name: 'Tumbling Window',
                    description: 'Non-overlapping fixed-size windows',
                    useCase: 'Batch processing and periodic aggregations',
                    parameters: ['size (milliseconds)']
                },
                {
                    type: 'session',
                    name: 'Session Window',
                    description: 'Dynamic windows based on activity sessions',
                    useCase: 'User session tracking and behavior analysis',
                    parameters: ['timeout (milliseconds)']
                }
            ],
            aggregationFunctions: [
                { name: 'sum', description: 'Calculate sum of values' },
                { name: 'avg', description: 'Calculate average of values' },
                { name: 'count', description: 'Count number of data points' },
                { name: 'min', description: 'Find minimum value' },
                { name: 'max', description: 'Find maximum value' },
                { name: 'stddev', description: 'Calculate standard deviation' }
            ],
            dataFormats: [
                { format: 'json', description: 'JavaScript Object Notation', mimeType: 'application/json' },
                { format: 'csv', description: 'Comma Separated Values', mimeType: 'text/csv' },
                { format: 'xml', description: 'Extensible Markup Language', mimeType: 'application/xml' }
            ]
        };

        res.json({
            success: true,
            templates,
            configurations,
            metadata: {
                streamTemplates: templates.streams.length,
                subscriberTemplates: templates.subscribers.length,
                windowTypes: configurations.windowTypes.length,
                aggregationFunctions: configurations.aggregationFunctions.length
            }
        });

    } catch (error) {
        console.error('❌ Error getting streaming templates:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get streaming templates'
        });
    }
});

/**
 * GET /api/streaming/configuration
 * Get streaming service configuration
 */
router.get('/configuration', (req, res) => {
    try {
        if (!streamingService) {
            return res.status(500).json({
                success: false,
                error: 'Streaming service not initialized'
            });
        }

        const status = streamingService.getStreamingStatus();
        
        res.json({
            success: true,
            configuration: {
                streaming: {
                    bufferSize: status.configuration.streaming.bufferSize,
                    windowSize: status.configuration.streaming.windowSize,
                    windowSizeMinutes: Math.round(status.configuration.streaming.windowSize / 60000),
                    maxConnections: status.configuration.streaming.maxConnections,
                    heartbeatInterval: status.configuration.streaming.heartbeatInterval,
                    heartbeatIntervalMinutes: Math.round(status.configuration.streaming.heartbeatInterval / 60000),
                    enableCompression: status.configuration.streaming.enableCompression,
                    rateLimitPerSecond: status.configuration.streaming.rateLimitPerSecond
                },
                processing: {
                    enableBatching: status.configuration.processing.enableBatching,
                    batchSize: status.configuration.processing.batchSize,
                    processingTimeout: status.configuration.processing.processingTimeout,
                    processingTimeoutSeconds: Math.round(status.configuration.processing.processingTimeout / 1000),
                    enableParallel: status.configuration.processing.enableParallel,
                    maxConcurrency: status.configuration.processing.maxConcurrency
                },
                aggregation: {
                    enableWindowing: status.configuration.aggregation.enableWindowing,
                    windowTypes: status.configuration.aggregation.windowTypes,
                    aggregationFunctions: status.configuration.aggregation.aggregationFunctions,
                    maxWindows: status.configuration.aggregation.maxWindows
                },
                storage: {
                    streamingDirectory: status.configuration.storage.streamingDir,
                    maxFileSize: status.configuration.storage.maxFileSize,
                    maxFileSizeMB: Math.round(status.configuration.storage.maxFileSize / (1024 * 1024)),
                    retentionHours: status.configuration.storage.retentionHours,
                    compressionEnabled: status.configuration.storage.compressionEnabled
                }
            }
        });

    } catch (error) {
        console.error('❌ Error getting streaming configuration:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get streaming configuration'
        });
    }
});

/**
 * PUT /api/streaming/configuration
 * Update streaming service configuration
 */
router.put('/configuration', (req, res) => {
    try {
        if (!streamingService) {
            return res.status(500).json({
                success: false,
                error: 'Streaming service not initialized'
            });
        }

        const newConfig = req.body;
        
        // Validate configuration structure
        const validSections = ['streaming', 'processing', 'aggregation', 'storage'];
        const providedSections = Object.keys(newConfig);
        const invalidSections = providedSections.filter(section => !validSections.includes(section));
        
        if (invalidSections.length > 0) {
            return res.status(400).json({
                success: false,
                error: `Invalid configuration sections: ${invalidSections.join(', ')}`
            });
        }

        streamingService.updateConfiguration(newConfig);
        
        console.log('🚀 Streaming configuration updated via API:', providedSections);

        res.json({
            success: true,
            message: 'Streaming configuration updated',
            updated: providedSections,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error updating streaming configuration:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to update streaming configuration'
        });
    }
});

/**
 * GET /api/streaming/metrics
 * Get real-time streaming metrics
 */
router.get('/metrics', (req, res) => {
    try {
        if (!streamingService) {
            return res.status(500).json({
                success: false,
                error: 'Streaming service not initialized'
            });
        }

        const status = streamingService.getStreamingStatus();
        const streams = streamingService.getStreams();
        
        const metrics = {
            realTime: {
                activeStreams: status.activeStreams,
                totalSubscribers: status.totalSubscribers,
                activeConnections: status.connectionStats.active,
                totalBufferSize: status.bufferSizes.reduce((sum, b) => sum + b.bufferSize, 0),
                serviceUptime: Date.now() - status.lastHeartbeat,
                serviceUptimeMinutes: Math.round((Date.now() - status.lastHeartbeat) / 60000)
            },
            throughput: {
                totalDataPoints: streams.reduce((sum, s) => sum + s.dataCount, 0),
                totalBytesTransferred: streams.reduce((sum, s) => sum + s.bytesTransferred, 0),
                totalBytesMB: Math.round(streams.reduce((sum, s) => sum + s.bytesTransferred, 0) / (1024 * 1024) * 100) / 100,
                avgThroughput: streams.length > 0 ? 
                    Math.round(streams.reduce((sum, s) => sum + (s.dataCount / (s.uptime / 1000)), 0) / streams.length * 100) / 100 : 0
            },
            performance: {
                connectionUtilization: status.configuration.streaming.maxConnections > 0 ?
                    Math.round((status.connectionStats.active / status.configuration.streaming.maxConnections) * 100) : 0,
                bufferUtilization: streams.length > 0 ?
                    Math.round((status.bufferSizes.reduce((sum, b) => sum + b.bufferSize, 0) / 
                    (streams.length * status.configuration.streaming.bufferSize)) * 100) : 0,
                avgSubscribersPerStream: status.activeStreams > 0 ? 
                    Math.round(status.totalSubscribers / status.activeStreams * 100) / 100 : 0,
                disconnectionRate: status.connectionStats.total > 0 ?
                    Math.round((status.connectionStats.disconnected / status.connectionStats.total) * 100) : 0
            },
            health: {
                status: status.isActive ? 'healthy' : 'unhealthy',
                lastHeartbeat: new Date(status.lastHeartbeat).toISOString(),
                missedHeartbeats: Math.max(0, Math.floor((Date.now() - status.lastHeartbeat) / status.configuration.streaming.heartbeatInterval)),
                streamsWithBufferedData: status.bufferSizes.filter(b => b.bufferSize > 0).length,
                streamsWithHighLoad: status.bufferSizes.filter(b => 
                    b.bufferSize > status.configuration.streaming.bufferSize * 0.8).length
            }
        };

        res.json({
            success: true,
            metrics,
            timestamp: new Date().toISOString(),
            collectTime: Date.now()
        });

    } catch (error) {
        console.error('❌ Error getting streaming metrics:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get streaming metrics'
        });
    }
});

module.exports = router;