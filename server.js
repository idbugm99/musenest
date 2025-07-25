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

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
        },
    },
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: (process.env.RATE_LIMIT_WINDOW || 15) * 60 * 1000, // 15 minutes
    max: process.env.RATE_LIMIT_MAX || 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
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

// Template engine setup (using Handlebars-like syntax for now)
app.set('view engine', 'html');
app.set('views', path.join(__dirname, 'templates'));

// Custom template rendering middleware
app.engine('html', (filePath, options, callback) => {
    const fs = require('fs');
    fs.readFile(filePath, 'utf8', (err, content) => {
        if (err) return callback(err);
        
        // Simple template replacement for now
        // In production, you'd use a proper template engine like Handlebars
        let rendered = content;
        
        // Replace template variables
        Object.keys(options).forEach(key => {
            const regex = new RegExp(`{{${key}}}`, 'g');
            rendered = rendered.replace(regex, options[key] || '');
        });
        
        // Handle conditional blocks (basic implementation)
        rendered = rendered.replace(/{{#if\s+([^}]+)}}([\s\S]*?){{\/if}}/g, (match, condition, content) => {
            const value = options[condition.trim()];
            return value ? content : '';
        });
        
        // Handle loops (basic implementation)
        rendered = rendered.replace(/{{#each\s+([^}]+)}}([\s\S]*?){{\/each}}/g, (match, arrayName, content) => {
            const array = options[arrayName.trim()];
            if (!Array.isArray(array)) return '';
            
            return array.map(item => {
                let itemContent = content;
                Object.keys(item).forEach(key => {
                    const regex = new RegExp(`{{this\\.${key}}}`, 'g');
                    itemContent = itemContent.replace(regex, item[key] || '');
                });
                return itemContent;
            }).join('');
        });
        
        callback(null, rendered);
    });
});

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

// API Routes (to be implemented)
// app.use('/api/auth', require('./src/routes/auth'));
// app.use('/api/models', require('./src/routes/models'));
// app.use('/api/gallery', require('./src/routes/gallery'));
// app.use('/api/content', require('./src/routes/content'));

// Dynamic model routes (to be implemented)
// app.use('/', require('./src/routes/dynamic'));

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