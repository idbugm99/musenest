const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const { testConnection } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware (disabled HTTPS redirect in development)
if (process.env.NODE_ENV === 'production') {
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
                scriptSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", "data:", "https:"],
                fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
            },
        },
    }));
} else {
    // Development mode - minimal security headers, no HTTPS enforcement
    app.use(helmet({
        contentSecurityPolicy: false,
        hsts: false,
    }));
}

// Rate limiting (reasonable limits with static asset exclusion)
const limiter = rateLimit({
    windowMs: (process.env.RATE_LIMIT_WINDOW || 15) * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'development' ? 200 : (process.env.RATE_LIMIT_MAX || 100),
    message: 'Too many requests from this IP, please try again later.',
    skip: (req) => {
        // Skip rate limiting for static assets only
        return req.url.startsWith('/public/') || 
               req.url.startsWith('/uploads/') ||
               req.url.endsWith('.css') ||
               req.url.endsWith('.js') ||
               req.url.endsWith('.png') ||
               req.url.endsWith('.jpg') ||
               req.url.endsWith('.ico');
    }
});
app.use(limiter);

// CORS
app.use(cors({
    origin: process.env.NODE_ENV === 'production' ? process.env.FRONTEND_URL : true,
    credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Static files
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// Disable built-in template engine - we use our custom one
app.set('view engine', false);

// Routes
app.get('/', (req, res) => {
    res.json({
        name: 'MuseNest API',
        version: '1.0.0',
        status: 'Running',
        message: 'Professional model portfolio management system'
    });
});

// Health check
app.get('/health', async (req, res) => {
    const dbStatus = await testConnection();
    res.json({
        status: 'OK',
        database: dbStatus ? 'Connected' : 'Disconnected',
        timestamp: new Date().toISOString()
    });
});

// API Routes
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/models', require('./src/routes/models'));

// Content Management APIs
app.use('/api/gallery', require('./routes/gallery'));
app.use('/api/faq', require('./routes/faq'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/testimonials', require('./routes/testimonials'));

// Dynamic model routes
app.use('/', require('./src/routes/dynamic'));

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: 'The requested resource could not be found.'
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    
    if (process.env.NODE_ENV === 'development') {
        res.status(500).json({
            error: 'Internal Server Error',
            message: err.message,
            stack: err.stack
        });
    } else {
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Something went wrong!'
        });
    }
});

// Start server
async function startServer() {
    try {
        // Test database connection
        console.log('🔍 Testing database connection...');
        const dbConnected = await testConnection();
        
        if (!dbConnected) {
            console.warn('⚠️  Database connection failed, but server will still start');
        }
        
        app.listen(PORT, () => {
            console.log('🚀 MuseNest Server Started');
            console.log(`📍 Server running on port ${PORT}`);
            console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`🔗 Health check: http://localhost:${PORT}/health`);
            console.log('');
            console.log('Next steps:');
            console.log('1. Copy .env.example to .env and configure your database');
            console.log('2. Run: npm run migrate (to set up database)');
            console.log('3. Run: npm run seed (to add sample data)');
        });
        
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

startServer();