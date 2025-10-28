/**
 * Real-Time Data Streaming and Processing Service
 * Part of Phase E.4: Real-time data streaming and processing
 * 
 * Provides comprehensive real-time data streaming capabilities including:
 * - WebSocket-based real-time data streams
 * - Event-driven data processing pipelines
 * - Stream aggregation and windowing
 * - Real-time analytics and monitoring
 * - Data filtering and transformation
 * - Multi-subscriber stream management
 */

const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');

class RealTimeStreamingService extends EventEmitter {
    constructor(database, analyticsService, config = {}) {
        super();
        this.db = database;
        this.analyticsService = analyticsService;
        
        // Configuration with environment-based defaults
        this.config = {
            streaming: {
                bufferSize: config.streaming?.bufferSize || parseInt(process.env.STREAMING_BUFFER_SIZE) || 1000,
                windowSize: config.streaming?.windowSize || parseInt(process.env.STREAMING_WINDOW_SIZE) || 60000,
                maxConnections: config.streaming?.maxConnections || parseInt(process.env.STREAMING_MAX_CONNECTIONS) || 500,
                heartbeatInterval: config.streaming?.heartbeatInterval || parseInt(process.env.STREAMING_HEARTBEAT) || 30000,
                enableCompression: config.streaming?.enableCompression !== false,
                rateLimitPerSecond: config.streaming?.rateLimitPerSecond || 100
            },
            processing: {
                enableBatching: config.processing?.enableBatching !== false,
                batchSize: config.processing?.batchSize || 50,
                processingTimeout: config.processing?.processingTimeout || 5000,
                enableParallel: config.processing?.enableParallel !== false,
                maxConcurrency: config.processing?.maxConcurrency || 10
            },
            aggregation: {
                enableWindowing: config.aggregation?.enableWindowing !== false,
                windowTypes: config.aggregation?.windowTypes || ['sliding', 'tumbling', 'session'],
                aggregationFunctions: config.aggregation?.aggregationFunctions || ['sum', 'avg', 'count', 'min', 'max'],
                maxWindows: config.aggregation?.maxWindows || 100
            },
            storage: {
                streamingDir: config.storage?.streamingDir || '/tmp/phoenix4ge-streaming',
                maxFileSize: config.storage?.maxFileSize || 50 * 1024 * 1024, // 50MB
                retentionHours: config.storage?.retentionHours || 24,
                compressionEnabled: config.storage?.compressionEnabled !== false
            }
        };

        // Stream management
        this.activeStreams = new Map();
        this.streamSubscribers = new Map();
        this.processingQueues = new Map();
        this.windowedData = new Map();
        this.streamCounter = 0;
        this.processingCounter = 0;

        // Real-time data buffers
        this.dataBuffers = new Map();
        this.aggregationWindows = new Map();
        this.eventFilters = new Map();

        // Service state
        this.isActive = false;
        this.lastHeartbeat = Date.now();
        this.connectionStats = {
            total: 0,
            active: 0,
            disconnected: 0
        };

        console.log('🚀 RealTimeStreamingService initialized');
        this.ensureStorageDirectories();
        this.startService();
    }

    async ensureStorageDirectories() {
        try {
            await fs.mkdir(this.config.storage.streamingDir, { recursive: true });
            await fs.mkdir(path.join(this.config.storage.streamingDir, 'streams'), { recursive: true });
            await fs.mkdir(path.join(this.config.storage.streamingDir, 'aggregations'), { recursive: true });
            await fs.mkdir(path.join(this.config.storage.streamingDir, 'logs'), { recursive: true });
        } catch (error) {
            console.error('❌ Error creating streaming directories:', error.message);
        }
    }

    startService() {
        this.isActive = true;
        
        // Start heartbeat monitoring
        this.heartbeatInterval = setInterval(() => {
            this.performHeartbeat();
        }, this.config.streaming.heartbeatInterval);

        // Start data processing loop
        this.processingInterval = setInterval(() => {
            this.processBufferedData();
        }, 1000);

        // Start window cleanup
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpiredWindows();
        }, 30000);

        console.log('🔄 Real-time streaming service started');
        this.emit('serviceStarted', { timestamp: Date.now() });
    }

    stopService() {
        this.isActive = false;
        
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        if (this.processingInterval) {
            clearInterval(this.processingInterval);
        }
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }

        // Close all active streams
        for (const [streamId, stream] of this.activeStreams) {
            this.closeStream(streamId);
        }

        console.log('⏹️ Real-time streaming service stopped');
        this.emit('serviceStopped', { timestamp: Date.now() });
    }

    // Stream Management
    createStream(streamConfig) {
        const streamId = `stream_${++this.streamCounter}_${Date.now()}`;
        
        const stream = {
            id: streamId,
            name: streamConfig.name || `Stream ${this.streamCounter}`,
            type: streamConfig.type || 'data',
            source: streamConfig.source || 'internal',
            filters: streamConfig.filters || {},
            aggregations: streamConfig.aggregations || [],
            windowConfig: streamConfig.windowConfig || { type: 'sliding', size: this.config.streaming.windowSize },
            subscribers: new Set(),
            isActive: true,
            created: Date.now(),
            lastActivity: Date.now(),
            dataCount: 0,
            bytesTransferred: 0
        };

        this.activeStreams.set(streamId, stream);
        this.dataBuffers.set(streamId, []);
        this.processingQueues.set(streamId, []);

        // Initialize windowed data if windowing is enabled
        if (this.config.aggregation.enableWindowing) {
            this.initializeStreamWindows(streamId, stream.windowConfig);
        }

        console.log(`📡 Stream created: ${stream.name} (${streamId})`);
        this.emit('streamCreated', stream);
        
        return stream;
    }

    subscribeToStream(streamId, subscriberConfig) {
        const stream = this.activeStreams.get(streamId);
        if (!stream) {
            throw new Error(`Stream not found: ${streamId}`);
        }

        const subscriberId = `subscriber_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const subscriber = {
            id: subscriberId,
            streamId,
            name: subscriberConfig.name || `Subscriber ${subscriberId}`,
            type: subscriberConfig.type || 'websocket',
            connection: subscriberConfig.connection,
            filters: subscriberConfig.filters || {},
            dataFormat: subscriberConfig.dataFormat || 'json',
            compressionEnabled: subscriberConfig.compression !== false,
            rateLimitPerSecond: subscriberConfig.rateLimitPerSecond || this.config.streaming.rateLimitPerSecond,
            lastMessage: Date.now(),
            messageCount: 0,
            isActive: true
        };

        stream.subscribers.add(subscriberId);
        if (!this.streamSubscribers.has(streamId)) {
            this.streamSubscribers.set(streamId, new Map());
        }
        this.streamSubscribers.get(streamId).set(subscriberId, subscriber);

        this.connectionStats.active++;
        this.connectionStats.total++;

        console.log(`👥 Subscriber added to stream ${stream.name}: ${subscriber.name}`);
        this.emit('subscriberAdded', { streamId, subscriber });

        return subscriber;
    }

    // Data Ingestion and Processing
    async ingestData(streamId, data, metadata = {}) {
        const stream = this.activeStreams.get(streamId);
        if (!stream || !stream.isActive) {
            throw new Error(`Stream not available: ${streamId}`);
        }

        const timestamp = Date.now();
        const processedData = {
            id: `data_${++this.processingCounter}_${timestamp}`,
            streamId,
            timestamp,
            data: this.applyStreamFilters(data, stream.filters),
            metadata: {
                ...metadata,
                originalSize: JSON.stringify(data).length,
                processed: timestamp,
                source: stream.source
            }
        };

        // Add to buffer for processing
        const buffer = this.dataBuffers.get(streamId);
        buffer.push(processedData);

        // Update stream statistics
        stream.dataCount++;
        stream.lastActivity = timestamp;
        stream.bytesTransferred += processedData.metadata.originalSize;

        // If buffer is full, trigger immediate processing
        if (buffer.length >= this.config.streaming.bufferSize) {
            await this.processStreamBuffer(streamId);
        }

        // Add to windowed aggregations if enabled
        if (this.config.aggregation.enableWindowing) {
            this.addToWindows(streamId, processedData);
        }

        this.emit('dataIngested', { streamId, data: processedData });
        return processedData;
    }

    async processBufferedData() {
        if (!this.isActive) return;

        for (const [streamId, buffer] of this.dataBuffers) {
            if (buffer.length > 0) {
                await this.processStreamBuffer(streamId);
            }
        }
    }

    async processStreamBuffer(streamId) {
        const buffer = this.dataBuffers.get(streamId);
        const stream = this.activeStreams.get(streamId);
        
        if (!buffer || !stream || buffer.length === 0) return;

        const batchSize = this.config.processing.enableBatching ? 
            Math.min(this.config.processing.batchSize, buffer.length) : 
            buffer.length;

        const batch = buffer.splice(0, batchSize);

        try {
            // Process batch
            const processedBatch = await this.processBatch(streamId, batch);
            
            // Send to subscribers
            await this.broadcastToSubscribers(streamId, processedBatch);
            
            // Apply aggregations
            if (stream.aggregations.length > 0) {
                const aggregatedData = await this.applyAggregations(streamId, processedBatch, stream.aggregations);
                if (aggregatedData) {
                    await this.broadcastAggregatedData(streamId, aggregatedData);
                }
            }

            this.emit('batchProcessed', { 
                streamId, 
                batchSize: processedBatch.length, 
                timestamp: Date.now() 
            });

        } catch (error) {
            console.error(`❌ Error processing stream buffer ${streamId}:`, error.message);
            this.emit('processingError', { streamId, error: error.message, batch });
        }
    }

    async processBatch(streamId, batch) {
        const startTime = Date.now();
        
        // Apply transformations and enrichments
        const processedBatch = await Promise.all(
            batch.map(async (dataPoint) => {
                try {
                    // Apply data transformations
                    const transformed = await this.transformData(dataPoint);
                    
                    // Enrich with additional context
                    const enriched = await this.enrichData(transformed, streamId);
                    
                    return enriched;
                } catch (error) {
                    console.error(`❌ Error processing data point ${dataPoint.id}:`, error.message);
                    return dataPoint; // Return original if processing fails
                }
            })
        );

        const processingTime = Date.now() - startTime;
        
        return {
            streamId,
            batchId: `batch_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            data: processedBatch,
            processingTime,
            processedAt: Date.now(),
            originalBatchSize: batch.length,
            processedBatchSize: processedBatch.length
        };
    }

    // Data Transformation and Enrichment
    async transformData(dataPoint) {
        // Apply basic transformations
        const transformed = {
            ...dataPoint,
            transformed: Date.now()
        };

        // Add computed fields based on data type
        if (dataPoint.data.metrics) {
            transformed.data.computedMetrics = this.computeMetrics(dataPoint.data.metrics);
        }

        if (dataPoint.data.events) {
            transformed.data.eventSummary = this.summarizeEvents(dataPoint.data.events);
        }

        return transformed;
    }

    async enrichData(dataPoint, streamId) {
        const enriched = {
            ...dataPoint,
            enrichment: {
                streamInfo: this.getStreamInfo(streamId),
                systemMetrics: await this.getSystemMetrics(),
                contextualData: await this.getContextualData(dataPoint)
            }
        };

        return enriched;
    }

    getStreamInfo(streamId) {
        const stream = this.activeStreams.get(streamId);
        if (!stream) return null;

        return {
            name: stream.name,
            type: stream.type,
            subscriberCount: stream.subscribers.size,
            dataCount: stream.dataCount,
            uptime: Date.now() - stream.created
        };
    }

    async getSystemMetrics() {
        if (this.analyticsService) {
            const currentMetrics = this.analyticsService.getCurrentMetrics();
            return currentMetrics ? {
                memory: currentMetrics.system.memory.usage,
                cpu: currentMetrics.system.cpu.usage,
                uptime: currentMetrics.system.uptime
            } : null;
        }
        return null;
    }

    async getContextualData(dataPoint) {
        // Add contextual information based on data content
        const context = {
            timestamp: new Date(dataPoint.timestamp).toISOString(),
            dataSize: dataPoint.metadata.originalSize,
            processingLatency: Date.now() - dataPoint.timestamp
        };

        // Add business context if available
        if (dataPoint.data.business) {
            context.businessMetrics = {
                activeModels: dataPoint.data.business.models?.total || 0,
                activeClients: dataPoint.data.business.clients?.active || 0,
                revenue: dataPoint.data.business.subscriptions?.monthlyRevenue || 0
            };
        }

        return context;
    }

    // Stream Broadcasting
    async broadcastToSubscribers(streamId, processedBatch) {
        const subscribers = this.streamSubscribers.get(streamId);
        if (!subscribers || subscribers.size === 0) return;

        const broadcastPromises = [];
        
        for (const [subscriberId, subscriber] of subscribers) {
            if (!subscriber.isActive) continue;

            const promise = this.sendToSubscriber(subscriber, processedBatch)
                .catch(error => {
                    console.error(`❌ Error sending to subscriber ${subscriberId}:`, error.message);
                    this.handleSubscriberError(subscriberId, error);
                });
            
            broadcastPromises.push(promise);
        }

        await Promise.allSettled(broadcastPromises);
    }

    async sendToSubscriber(subscriber, processedBatch) {
        // Apply subscriber-specific filters
        const filteredData = this.applySubscriberFilters(processedBatch.data, subscriber.filters);
        
        if (filteredData.length === 0) return;

        // Format data according to subscriber preferences
        const formattedData = this.formatDataForSubscriber(filteredData, subscriber);
        
        // Apply rate limiting
        if (!this.checkRateLimit(subscriber)) {
            return;
        }

        // Send data based on subscriber type
        switch (subscriber.type) {
            case 'websocket':
                await this.sendViaWebSocket(subscriber, formattedData);
                break;
            case 'http':
                await this.sendViaHTTP(subscriber, formattedData);
                break;
            case 'callback':
                await this.sendViaCallback(subscriber, formattedData);
                break;
            default:
                console.warn(`Unknown subscriber type: ${subscriber.type}`);
        }

        // Update subscriber statistics
        subscriber.messageCount++;
        subscriber.lastMessage = Date.now();
    }

    async sendViaWebSocket(subscriber, data) {
        if (subscriber.connection && subscriber.connection.readyState === 1) { // WebSocket.OPEN
            const message = JSON.stringify({
                type: 'streamData',
                streamId: subscriber.streamId,
                data: data,
                timestamp: Date.now()
            });

            subscriber.connection.send(
                subscriber.compressionEnabled ? this.compress(message) : message
            );
        } else {
            throw new Error('WebSocket connection not available');
        }
    }

    async sendViaHTTP(subscriber, data) {
        // HTTP POST to subscriber endpoint
        if (subscriber.connection && subscriber.connection.url) {
            const response = await fetch(subscriber.connection.url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...subscriber.connection.headers
                },
                body: JSON.stringify({
                    streamId: subscriber.streamId,
                    data: data,
                    timestamp: Date.now()
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        }
    }

    async sendViaCallback(subscriber, data) {
        if (subscriber.connection && typeof subscriber.connection.callback === 'function') {
            await subscriber.connection.callback({
                streamId: subscriber.streamId,
                data: data,
                timestamp: Date.now()
            });
        }
    }

    // Windowed Aggregations
    initializeStreamWindows(streamId, windowConfig) {
        const windows = {
            sliding: this.createSlidingWindow(streamId, windowConfig.size),
            tumbling: this.createTumblingWindow(streamId, windowConfig.size),
            session: this.createSessionWindow(streamId, windowConfig.timeout || 300000)
        };

        this.aggregationWindows.set(streamId, windows);
    }

    createSlidingWindow(streamId, windowSize) {
        return {
            type: 'sliding',
            size: windowSize,
            data: new Map(), // timestamp -> data points
            currentWindow: [],
            lastUpdate: Date.now()
        };
    }

    createTumblingWindow(streamId, windowSize) {
        return {
            type: 'tumbling',
            size: windowSize,
            currentWindow: [],
            windowStart: Date.now(),
            completedWindows: []
        };
    }

    createSessionWindow(streamId, sessionTimeout) {
        return {
            type: 'session',
            timeout: sessionTimeout,
            sessions: new Map(), // sessionId -> data points
            lastActivity: new Map() // sessionId -> timestamp
        };
    }

    addToWindows(streamId, dataPoint) {
        const windows = this.aggregationWindows.get(streamId);
        if (!windows) return;

        const timestamp = dataPoint.timestamp;

        // Add to sliding window
        const sliding = windows.sliding;
        sliding.data.set(timestamp, dataPoint);
        sliding.currentWindow.push(dataPoint);
        
        // Remove old data points outside window
        const windowStart = timestamp - sliding.size;
        for (const [ts, data] of sliding.data) {
            if (ts < windowStart) {
                sliding.data.delete(ts);
                sliding.currentWindow = sliding.currentWindow.filter(d => d.timestamp >= windowStart);
            }
        }

        // Add to tumbling window
        const tumbling = windows.tumbling;
        tumbling.currentWindow.push(dataPoint);
        
        // Check if window should tumble
        if (timestamp - tumbling.windowStart >= tumbling.size) {
            tumbling.completedWindows.push({
                start: tumbling.windowStart,
                end: timestamp,
                data: tumbling.currentWindow
            });
            tumbling.currentWindow = [];
            tumbling.windowStart = timestamp;
            
            // Keep only recent completed windows
            if (tumbling.completedWindows.length > this.config.aggregation.maxWindows) {
                tumbling.completedWindows.shift();
            }
        }

        // Add to session window (simplified session detection)
        const session = windows.session;
        const sessionId = this.determineSessionId(dataPoint);
        
        if (!session.sessions.has(sessionId)) {
            session.sessions.set(sessionId, []);
        }
        
        session.sessions.get(sessionId).push(dataPoint);
        session.lastActivity.set(sessionId, timestamp);
    }

    determineSessionId(dataPoint) {
        // Simple session identification logic
        // In a real implementation, this would be more sophisticated
        return dataPoint.metadata.sessionId || 
               dataPoint.metadata.userId || 
               dataPoint.metadata.clientId || 
               'default';
    }

    // Utility Methods
    applyStreamFilters(data, filters) {
        if (!filters || Object.keys(filters).length === 0) {
            return data;
        }

        // Apply various filter types
        let filteredData = data;

        if (filters.minValue !== undefined && data.value !== undefined) {
            if (data.value < filters.minValue) return null;
        }

        if (filters.maxValue !== undefined && data.value !== undefined) {
            if (data.value > filters.maxValue) return null;
        }

        if (filters.tags && Array.isArray(filters.tags)) {
            if (!data.tags || !filters.tags.some(tag => data.tags.includes(tag))) {
                return null;
            }
        }

        if (filters.exclude && Array.isArray(filters.exclude)) {
            if (filters.exclude.some(field => data[field] !== undefined)) {
                return null;
            }
        }

        return filteredData;
    }

    applySubscriberFilters(dataArray, filters) {
        if (!filters || Object.keys(filters).length === 0) {
            return dataArray;
        }

        return dataArray.filter(dataPoint => {
            return this.applyStreamFilters(dataPoint.data, filters) !== null;
        });
    }

    formatDataForSubscriber(data, subscriber) {
        switch (subscriber.dataFormat) {
            case 'csv':
                return this.formatAsCSV(data);
            case 'xml':
                return this.formatAsXML(data);
            case 'json':
            default:
                return data;
        }
    }

    formatAsCSV(data) {
        // Simple CSV formatting for demonstration
        if (!Array.isArray(data) || data.length === 0) return '';
        
        const headers = Object.keys(data[0]);
        const csvRows = [
            headers.join(','),
            ...data.map(row => headers.map(field => JSON.stringify(row[field] || '')).join(','))
        ];
        
        return csvRows.join('\n');
    }

    formatAsXML(data) {
        // Simple XML formatting for demonstration
        const xmlRows = data.map(item => {
            const fields = Object.keys(item).map(key => 
                `<${key}>${JSON.stringify(item[key])}</${key}>`
            ).join('');
            return `<item>${fields}</item>`;
        });
        
        return `<data>${xmlRows.join('')}</data>`;
    }

    checkRateLimit(subscriber) {
        const now = Date.now();
        const secondStart = Math.floor(now / 1000) * 1000;
        
        if (!subscriber.rateLimitWindow) {
            subscriber.rateLimitWindow = { start: secondStart, count: 0 };
        }

        if (subscriber.rateLimitWindow.start !== secondStart) {
            subscriber.rateLimitWindow = { start: secondStart, count: 0 };
        }

        if (subscriber.rateLimitWindow.count >= subscriber.rateLimitPerSecond) {
            return false;
        }

        subscriber.rateLimitWindow.count++;
        return true;
    }

    compress(data) {
        // Simple compression simulation - in production use zlib
        return Buffer.from(data).toString('base64');
    }

    computeMetrics(metrics) {
        const computed = {};
        
        if (metrics.memory) {
            computed.memoryEfficiency = metrics.memory.used / metrics.memory.total;
        }
        
        if (metrics.requests && metrics.errors) {
            computed.errorRate = metrics.errors / (metrics.requests + metrics.errors);
        }
        
        return computed;
    }

    summarizeEvents(events) {
        if (!Array.isArray(events)) return {};
        
        return {
            total: events.length,
            types: [...new Set(events.map(e => e.type))],
            severity: events.reduce((acc, e) => {
                acc[e.severity] = (acc[e.severity] || 0) + 1;
                return acc;
            }, {})
        };
    }

    performHeartbeat() {
        this.lastHeartbeat = Date.now();
        
        // Clean up inactive subscribers
        for (const [streamId, subscribers] of this.streamSubscribers) {
            for (const [subscriberId, subscriber] of subscribers) {
                const inactiveTime = this.lastHeartbeat - subscriber.lastMessage;
                if (inactiveTime > this.config.streaming.heartbeatInterval * 3) {
                    this.removeSubscriber(streamId, subscriberId);
                }
            }
        }

        this.emit('heartbeat', {
            timestamp: this.lastHeartbeat,
            activeStreams: this.activeStreams.size,
            totalSubscribers: Array.from(this.streamSubscribers.values())
                .reduce((sum, subs) => sum + subs.size, 0)
        });
    }

    cleanupExpiredWindows() {
        const now = Date.now();
        
        for (const [streamId, windows] of this.aggregationWindows) {
            // Clean up session windows
            const session = windows.session;
            for (const [sessionId, lastActivity] of session.lastActivity) {
                if (now - lastActivity > session.timeout) {
                    session.sessions.delete(sessionId);
                    session.lastActivity.delete(sessionId);
                }
            }
        }
    }

    handleSubscriberError(subscriberId, error) {
        console.error(`❌ Subscriber error ${subscriberId}:`, error.message);
        
        // Find and remove the problematic subscriber
        for (const [streamId, subscribers] of this.streamSubscribers) {
            if (subscribers.has(subscriberId)) {
                this.removeSubscriber(streamId, subscriberId);
                break;
            }
        }
    }

    removeSubscriber(streamId, subscriberId) {
        const subscribers = this.streamSubscribers.get(streamId);
        if (subscribers && subscribers.has(subscriberId)) {
            subscribers.delete(subscriberId);
            this.connectionStats.active--;
            this.connectionStats.disconnected++;
            
            const stream = this.activeStreams.get(streamId);
            if (stream) {
                stream.subscribers.delete(subscriberId);
            }
            
            console.log(`👥 Subscriber removed: ${subscriberId} from stream ${streamId}`);
            this.emit('subscriberRemoved', { streamId, subscriberId });
        }
    }

    closeStream(streamId) {
        const stream = this.activeStreams.get(streamId);
        if (!stream) return;

        stream.isActive = false;
        
        // Remove all subscribers
        const subscribers = this.streamSubscribers.get(streamId);
        if (subscribers) {
            for (const subscriberId of subscribers.keys()) {
                this.removeSubscriber(streamId, subscriberId);
            }
        }

        // Cleanup resources
        this.activeStreams.delete(streamId);
        this.dataBuffers.delete(streamId);
        this.processingQueues.delete(streamId);
        this.aggregationWindows.delete(streamId);
        this.streamSubscribers.delete(streamId);

        console.log(`📡 Stream closed: ${stream.name} (${streamId})`);
        this.emit('streamClosed', { streamId, stream });
    }

    // Public API Methods
    getStreamingStatus() {
        return {
            isActive: this.isActive,
            lastHeartbeat: this.lastHeartbeat,
            activeStreams: this.activeStreams.size,
            totalSubscribers: Array.from(this.streamSubscribers.values())
                .reduce((sum, subs) => sum + subs.size, 0),
            connectionStats: this.connectionStats,
            bufferSizes: Array.from(this.dataBuffers.entries()).map(([streamId, buffer]) => ({
                streamId,
                bufferSize: buffer.length
            })),
            configuration: this.config
        };
    }

    getStreams() {
        return Array.from(this.activeStreams.values()).map(stream => ({
            id: stream.id,
            name: stream.name,
            type: stream.type,
            subscriberCount: stream.subscribers.size,
            dataCount: stream.dataCount,
            bytesTransferred: stream.bytesTransferred,
            uptime: Date.now() - stream.created,
            isActive: stream.isActive,
            lastActivity: stream.lastActivity
        }));
    }

    getStreamDetails(streamId) {
        const stream = this.activeStreams.get(streamId);
        if (!stream) return null;

        const subscribers = this.streamSubscribers.get(streamId);
        const buffer = this.dataBuffers.get(streamId);
        const windows = this.aggregationWindows.get(streamId);

        return {
            ...stream,
            subscriberDetails: subscribers ? Array.from(subscribers.values()) : [],
            currentBufferSize: buffer ? buffer.length : 0,
            windowSummary: windows ? {
                sliding: windows.sliding.currentWindow.length,
                tumbling: windows.tumbling.currentWindow.length,
                sessions: windows.session.sessions.size
            } : null
        };
    }

    updateConfiguration(newConfig) {
        Object.assign(this.config, newConfig);
        console.log('🔧 Real-time streaming configuration updated');
        this.emit('configurationUpdated', { config: this.config, timestamp: Date.now() });
    }
}

module.exports = RealTimeStreamingService;