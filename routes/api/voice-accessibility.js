/**
 * Voice Interface and Accessibility API Routes
 * 
 * RESTful API endpoints for voice interface capabilities, accessibility features,
 * user accessibility preferences, voice command processing, and accessibility analytics.
 */

const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');

// Initialize Voice Accessibility Service
let voiceAccessibilityService = null;

async function initializeService() {
    if (!voiceAccessibilityService) {
        const VoiceAccessibilityService = require('../../src/services/VoiceAccessibilityService');
        
        // Create database connection for the service
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'musenest'
        });
        
        voiceAccessibilityService = new VoiceAccessibilityService(db);
        await voiceAccessibilityService.initialize();
    }
    return voiceAccessibilityService;
}

// Middleware to ensure service is initialized
async function ensureServiceReady(req, res, next) {
    try {
        await initializeService();
        next();
    } catch (error) {
        console.error('Failed to initialize Voice Accessibility Service:', error);
        res.status(503).json({
            error: 'Voice Accessibility Service unavailable',
            details: error.message
        });
    }
}

/**
 * GET /api/voice-accessibility/health
 * Get service health status and accessibility system metrics
 */
router.get('/health', ensureServiceReady, async (req, res) => {
    try {
        const health = await voiceAccessibilityService.getServiceHealthStatus();
        res.json(health);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to get health status',
            details: error.message
        });
    }
});

/**
 * POST /api/voice-accessibility/process-voice-command
 * Process a voice command and execute corresponding action
 * 
 * Body: {
 *   "userId": 123,
 *   "voiceInput": "navigate to home page",
 *   "context": {
 *     "page": "/gallery",
 *     "device": "mobile",
 *     "session_id": "VOICE_SESSION_123"
 *   }
 * }
 */
router.post('/process-voice-command', ensureServiceReady, async (req, res) => {
    try {
        const { userId, voiceInput, context = {} } = req.body;
        
        if (!userId || !voiceInput) {
            return res.status(400).json({
                error: 'Missing required parameters',
                required: ['userId', 'voiceInput']
            });
        }
        
        if (typeof voiceInput !== 'string' || voiceInput.trim().length === 0) {
            return res.status(400).json({
                error: 'Invalid voice input',
                message: 'Voice input must be a non-empty string'
            });
        }
        
        console.log(`🎤 Processing voice command from user: ${userId}`);
        
        const voiceCommandResult = await voiceAccessibilityService.processVoiceCommand(
            userId, 
            voiceInput.trim(), 
            context
        );
        
        res.json({
            success: !voiceCommandResult.error,
            ...voiceCommandResult
        });
        
    } catch (error) {
        console.error('Voice command processing error:', error);
        res.status(500).json({
            error: 'Failed to process voice command',
            details: error.message
        });
    }
});

/**
 * GET /api/voice-accessibility/user-profile/:userId
 * Get user accessibility profile and preferences
 * 
 * Query params:
 * - include_history: include usage history (default false)
 * - include_analytics: include usage analytics (default false)
 */
router.get('/user-profile/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { 
            include_history = 'false', 
            include_analytics = 'false' 
        } = req.query;
        
        if (!userId || isNaN(parseInt(userId))) {
            return res.status(400).json({
                error: 'Invalid user ID',
                message: 'User ID must be a valid number'
            });
        }
        
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'musenest'
        });
        
        // Get user accessibility profile
        const [profiles] = await db.execute(`
            SELECT * FROM user_accessibility_profiles 
            WHERE user_id = ? AND profile_active = TRUE
            ORDER BY last_used_at DESC 
            LIMIT 1
        `, [userId]);
        
        if (profiles.length === 0) {
            await db.end();
            return res.status(404).json({
                error: 'User accessibility profile not found',
                user_id: userId
            });
        }
        
        const profileData = profiles[0];
        
        // Parse JSON fields
        profileData.activation_phrases = JSON.parse(profileData.activation_phrases || '[]');
        profileData.custom_keyboard_shortcuts = JSON.parse(profileData.custom_keyboard_shortcuts || '{}');
        
        // Get usage history if requested
        if (include_history === 'true') {
            const [history] = await db.execute(`
                SELECT 
                    feature_name,
                    feature_category,
                    feature_enabled,
                    feature_helpfulness_score,
                    created_at
                FROM accessibility_feature_usage 
                WHERE user_id = ?
                ORDER BY created_at DESC 
                LIMIT 50
            `, [userId]);
            
            profileData.usage_history = history;
        }
        
        // Get analytics if requested
        if (include_analytics === 'true') {
            // Get feature usage summary
            const [featureUsage] = await db.execute(`
                SELECT 
                    feature_category,
                    COUNT(*) as usage_count,
                    AVG(feature_helpfulness_score) as avg_helpfulness,
                    AVG(feature_ease_of_use_score) as avg_ease_of_use,
                    AVG(session_duration_minutes) as avg_session_duration
                FROM accessibility_feature_usage 
                WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                GROUP BY feature_category
                ORDER BY usage_count DESC
            `, [userId]);
            
            // Get voice interface performance
            const [voicePerformance] = await db.execute(`
                SELECT 
                    COUNT(*) as total_sessions,
                    AVG(session_duration_seconds) as avg_session_duration,
                    AVG(successful_commands) as avg_successful_commands,
                    AVG(session_satisfaction_rating) as avg_satisfaction,
                    SUM(total_commands_issued) as total_commands
                FROM voice_interface_sessions 
                WHERE user_id = ? AND session_start >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            `, [userId]);
            
            profileData.analytics = {
                feature_usage: featureUsage.map(feature => ({
                    ...feature,
                    avg_helpfulness: parseFloat(feature.avg_helpfulness || 0),
                    avg_ease_of_use: parseFloat(feature.avg_ease_of_use || 0),
                    avg_session_duration: parseFloat(feature.avg_session_duration || 0)
                })),
                voice_performance: voicePerformance[0] ? {
                    ...voicePerformance[0],
                    total_sessions: parseInt(voicePerformance[0].total_sessions || 0),
                    avg_session_duration: parseFloat(voicePerformance[0].avg_session_duration || 0),
                    avg_successful_commands: parseFloat(voicePerformance[0].avg_successful_commands || 0),
                    avg_satisfaction: parseFloat(voicePerformance[0].avg_satisfaction || 0),
                    total_commands: parseInt(voicePerformance[0].total_commands || 0)
                } : {}
            };
        }
        
        await db.end();
        
        res.json({
            success: true,
            user_profile: profileData
        });
        
    } catch (error) {
        console.error('Get user profile error:', error);
        res.status(500).json({
            error: 'Failed to get user accessibility profile',
            details: error.message
        });
    }
});

/**
 * PUT /api/voice-accessibility/user-profile/:userId
 * Update user accessibility preferences and settings
 * 
 * Body: {
 *   "voice_recognition_enabled": true,
 *   "speech_synthesis_enabled": true,
 *   "high_contrast_mode": false,
 *   "font_size_multiplier": 1.2,
 *   "speech_rate": 1.0,
 *   "keyboard_shortcuts_enabled": true,
 *   // ... other accessibility settings
 * }
 */
router.put('/user-profile/:userId', ensureServiceReady, async (req, res) => {
    try {
        const { userId } = req.params;
        const accessibilitySettings = req.body;
        
        if (!userId || isNaN(parseInt(userId))) {
            return res.status(400).json({
                error: 'Invalid user ID',
                message: 'User ID must be a valid number'
            });
        }
        
        if (!accessibilitySettings || typeof accessibilitySettings !== 'object') {
            return res.status(400).json({
                error: 'Invalid accessibility settings',
                message: 'Settings must be a valid object'
            });
        }
        
        console.log(`♿ Updating accessibility settings for user: ${userId}`);
        
        const settingsUpdate = await voiceAccessibilityService.updateUserAccessibilitySettings(
            parseInt(userId), 
            accessibilitySettings
        );
        
        res.json({
            success: true,
            ...settingsUpdate
        });
        
    } catch (error) {
        console.error('Update accessibility settings error:', error);
        res.status(500).json({
            error: 'Failed to update accessibility settings',
            details: error.message
        });
    }
});

/**
 * POST /api/voice-accessibility/generate-speech
 * Generate text-to-speech audio for content
 * 
 * Body: {
 *   "text": "Welcome to our accessible platform",
 *   "voiceOptions": {
 *     "voice": "en-US-Neural",
 *     "rate": 1.0,
 *     "pitch": 1.0,
 *     "volume": 1.0
 *   }
 * }
 */
router.post('/generate-speech', ensureServiceReady, async (req, res) => {
    try {
        const { text, voiceOptions = {} } = req.body;
        
        if (!text || typeof text !== 'string' || text.trim().length === 0) {
            return res.status(400).json({
                error: 'Invalid text input',
                message: 'Text must be a non-empty string'
            });
        }
        
        if (text.length > 10000) {
            return res.status(400).json({
                error: 'Text too long',
                message: 'Text must be less than 10,000 characters'
            });
        }
        
        console.log('🔊 Generating speech from text');
        
        const speechResult = await voiceAccessibilityService.generateSpeechFromText(
            text.trim(), 
            voiceOptions
        );
        
        res.json({
            success: true,
            ...speechResult
        });
        
    } catch (error) {
        console.error('Speech generation error:', error);
        res.status(500).json({
            error: 'Failed to generate speech',
            details: error.message
        });
    }
});

/**
 * GET /api/voice-accessibility/voice-commands
 * Get available voice commands and their descriptions
 * 
 * Query params:
 * - category: filter by command category (optional)
 * - language: filter by language (default 'en')
 */
router.get('/voice-commands', async (req, res) => {
    try {
        const { category, language = 'en' } = req.query;
        
        // Mock voice commands data - in production, this would come from the service
        const voiceCommands = {
            navigation: [
                { command: "go home", description: "Navigate to home page", example: "Go home" },
                { command: "go back", description: "Navigate back to previous page", example: "Go back" },
                { command: "scroll up", description: "Scroll up on current page", example: "Scroll up" },
                { command: "scroll down", description: "Scroll down on current page", example: "Scroll down" },
                { command: "next page", description: "Go to next page", example: "Next page" },
                { command: "previous page", description: "Go to previous page", example: "Previous page" }
            ],
            application: [
                { command: "open gallery", description: "Open image gallery", example: "Open gallery" },
                { command: "view profile", description: "View user profile", example: "View profile" },
                { command: "open settings", description: "Open settings menu", example: "Open settings" },
                { command: "help", description: "Show help information", example: "Help" },
                { command: "logout", description: "Log out of account", example: "Logout" }
            ],
            accessibility: [
                { command: "read page", description: "Read current page content aloud", example: "Read page" },
                { command: "describe image", description: "Describe the current image", example: "Describe image" },
                { command: "increase font", description: "Increase font size", example: "Increase font" },
                { command: "decrease font", description: "Decrease font size", example: "Decrease font" },
                { command: "high contrast", description: "Toggle high contrast mode", example: "High contrast" },
                { command: "focus mode", description: "Toggle focus mode", example: "Focus mode" }
            ],
            content: [
                { command: "search for", description: "Search for specific content", example: "Search for photos" },
                { command: "click", description: "Click on specified element", example: "Click submit button" },
                { command: "select", description: "Select specified item", example: "Select first option" }
            ]
        };
        
        let filteredCommands = voiceCommands;
        if (category && voiceCommands[category]) {
            filteredCommands = { [category]: voiceCommands[category] };
        }
        
        res.json({
            success: true,
            language: language,
            voice_commands: filteredCommands,
            total_commands: Object.values(filteredCommands).reduce((sum, commands) => sum + commands.length, 0),
            categories: Object.keys(filteredCommands)
        });
        
    } catch (error) {
        console.error('Get voice commands error:', error);
        res.status(500).json({
            error: 'Failed to get voice commands',
            details: error.message
        });
    }
});

/**
 * GET /api/voice-accessibility/analytics
 * Get comprehensive accessibility usage analytics
 * 
 * Query params:
 * - timeframe: 7d, 30d, 90d (default 30d)
 * - user_id: filter by specific user (optional)
 * - feature_category: filter by feature category (optional)
 */
router.get('/analytics', async (req, res) => {
    try {
        const { 
            timeframe = '30d', 
            user_id,
            feature_category 
        } = req.query;
        
        const validTimeframes = ['7d', '30d', '90d'];
        if (!validTimeframes.includes(timeframe)) {
            return res.status(400).json({
                error: 'Invalid timeframe',
                valid_options: validTimeframes
            });
        }
        
        console.log(`📊 Generating accessibility analytics for timeframe: ${timeframe}`);
        
        const days = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 90;
        
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'musenest'
        });
        
        // Get accessibility usage summary
        const [usageSummary] = await db.execute(`
            SELECT * FROM v_accessibility_usage_summary 
            WHERE usage_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
            ${feature_category ? 'AND feature_category = ?' : ''}
            ORDER BY usage_date DESC, total_usage_events DESC
        `, feature_category ? [days, feature_category] : [days]);
        
        // Get voice interface performance
        const [voicePerformance] = await db.execute(`
            SELECT * FROM v_voice_interface_performance 
            WHERE session_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
            ORDER BY session_date DESC
        `, [days]);
        
        // Get compliance status
        const [complianceStatus] = await db.execute(`
            SELECT * FROM v_accessibility_compliance_status 
            ORDER BY compliance_percentage DESC
        `);
        
        // Get feature adoption trends
        const [adoptionTrends] = await db.execute(`
            SELECT 
                DATE(afu.created_at) as date,
                afu.feature_category,
                COUNT(DISTINCT afu.user_id) as unique_users,
                COUNT(*) as usage_events,
                AVG(afu.feature_helpfulness_score) as avg_helpfulness
            FROM accessibility_feature_usage afu
            WHERE afu.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
              ${user_id ? 'AND afu.user_id = ?' : ''}
              ${feature_category ? 'AND afu.feature_category = ?' : ''}
            GROUP BY DATE(afu.created_at), afu.feature_category
            ORDER BY date DESC, usage_events DESC
        `, [days, user_id, feature_category].filter(Boolean));
        
        // Get user satisfaction metrics
        const [satisfactionMetrics] = await db.execute(`
            SELECT 
                afu.feature_category,
                AVG(afu.feature_helpfulness_score) as avg_helpfulness,
                AVG(afu.feature_ease_of_use_score) as avg_ease_of_use,
                COUNT(CASE WHEN afu.would_recommend = TRUE THEN 1 END) as would_recommend_count,
                COUNT(CASE WHEN afu.task_completion_improved = TRUE THEN 1 END) as task_improvement_count,
                COUNT(CASE WHEN afu.accessibility_barrier_removed = TRUE THEN 1 END) as barrier_removal_count,
                COUNT(*) as total_responses
            FROM accessibility_feature_usage afu
            WHERE afu.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
              ${user_id ? 'AND afu.user_id = ?' : ''}
              ${feature_category ? 'AND afu.feature_category = ?' : ''}
            GROUP BY afu.feature_category
            ORDER BY avg_helpfulness DESC
        `, [days, user_id, feature_category].filter(Boolean));
        
        await db.end();
        
        // Process results
        const analytics = {
            timeframe,
            generated_at: new Date().toISOString(),
            filters: {
                user_id: user_id || null,
                feature_category: feature_category || null
            },
            
            usage_summary: usageSummary.map(summary => ({
                ...summary,
                total_usage_events: parseInt(summary.total_usage_events || 0),
                unique_users: parseInt(summary.unique_users || 0),
                avg_helpfulness: parseFloat(summary.avg_helpfulness || 0),
                avg_ease_of_use: parseFloat(summary.avg_ease_of_use || 0),
                improved_task_completion: parseInt(summary.improved_task_completion || 0),
                barriers_removed: parseInt(summary.barriers_removed || 0),
                avg_session_duration: parseFloat(summary.avg_session_duration || 0)
            })),
            
            voice_performance: voicePerformance.map(performance => ({
                ...performance,
                total_sessions: parseInt(performance.total_sessions || 0),
                avg_session_duration: parseFloat(performance.avg_session_duration || 0),
                avg_successful_commands: parseFloat(performance.avg_successful_commands || 0),
                avg_command_confidence: parseFloat(performance.avg_command_confidence || 0),
                avg_satisfaction: parseFloat(performance.avg_satisfaction || 0),
                completed_sessions: parseInt(performance.completed_sessions || 0),
                interrupted_sessions: parseInt(performance.interrupted_sessions || 0)
            })),
            
            compliance_status: complianceStatus.map(status => ({
                ...status,
                total_checks: parseInt(status.total_checks || 0),
                compliant_checks: parseInt(status.compliant_checks || 0),
                non_compliant_checks: parseInt(status.non_compliant_checks || 0),
                needs_review_checks: parseInt(status.needs_review_checks || 0),
                compliance_percentage: parseFloat(status.compliance_percentage || 0),
                avg_fix_effort: parseFloat(status.avg_fix_effort || 0),
                remediation_completed: parseInt(status.remediation_completed || 0)
            })),
            
            adoption_trends: adoptionTrends.map(trend => ({
                ...trend,
                unique_users: parseInt(trend.unique_users || 0),
                usage_events: parseInt(trend.usage_events || 0),
                avg_helpfulness: parseFloat(trend.avg_helpfulness || 0)
            })),
            
            satisfaction_metrics: satisfactionMetrics.map(metric => ({
                ...metric,
                avg_helpfulness: parseFloat(metric.avg_helpfulness || 0),
                avg_ease_of_use: parseFloat(metric.avg_ease_of_use || 0),
                would_recommend_count: parseInt(metric.would_recommend_count || 0),
                task_improvement_count: parseInt(metric.task_improvement_count || 0),
                barrier_removal_count: parseInt(metric.barrier_removal_count || 0),
                total_responses: parseInt(metric.total_responses || 0)
            }))
        };
        
        res.json({
            success: true,
            ...analytics
        });
        
    } catch (error) {
        console.error('Analytics generation error:', error);
        res.status(500).json({
            error: 'Failed to generate analytics',
            details: error.message
        });
    }
});

/**
 * GET /api/voice-accessibility/compliance-status
 * Get WCAG compliance status and accessibility audit results
 * 
 * Query params:
 * - wcag_level: A, AA, AAA (default all)
 * - standard: WCAG_2.1, WCAG_2.2, Section_508, etc. (default all)
 */
router.get('/compliance-status', async (req, res) => {
    try {
        const { wcag_level, standard } = req.query;
        
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'musenest'
        });
        
        let query = `
            SELECT 
                check_id,
                check_name,
                check_description,
                wcag_level,
                wcag_guideline,
                compliance_standard,
                check_type,
                severity,
                current_compliance_status,
                remediation_status,
                estimated_fix_effort_hours,
                last_checked_at
            FROM accessibility_compliance_checks
            WHERE 1=1
        `;
        const params = [];
        
        if (wcag_level) {
            query += ' AND wcag_level = ?';
            params.push(wcag_level);
        }
        
        if (standard) {
            query += ' AND compliance_standard = ?';
            params.push(standard);
        }
        
        query += ' ORDER BY severity DESC, wcag_level, current_compliance_status';
        
        const [complianceChecks] = await db.execute(query, params);
        
        // Get summary statistics
        const [summary] = await db.execute(`
            SELECT 
                COUNT(*) as total_checks,
                COUNT(CASE WHEN current_compliance_status = 'compliant' THEN 1 END) as compliant,
                COUNT(CASE WHEN current_compliance_status = 'non_compliant' THEN 1 END) as non_compliant,
                COUNT(CASE WHEN current_compliance_status = 'needs_review' THEN 1 END) as needs_review,
                COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_issues,
                COUNT(CASE WHEN severity = 'serious' THEN 1 END) as serious_issues,
                AVG(estimated_fix_effort_hours) as avg_fix_effort
            FROM accessibility_compliance_checks
            WHERE (? IS NULL OR wcag_level = ?) 
              AND (? IS NULL OR compliance_standard = ?)
        `, [wcag_level, wcag_level, standard, standard]);
        
        await db.end();
        
        // Process results
        const complianceData = {
            summary: summary[0] ? {
                total_checks: parseInt(summary[0].total_checks || 0),
                compliant: parseInt(summary[0].compliant || 0),
                non_compliant: parseInt(summary[0].non_compliant || 0),
                needs_review: parseInt(summary[0].needs_review || 0),
                critical_issues: parseInt(summary[0].critical_issues || 0),
                serious_issues: parseInt(summary[0].serious_issues || 0),
                avg_fix_effort: parseFloat(summary[0].avg_fix_effort || 0),
                compliance_percentage: summary[0].total_checks > 0 ? 
                    Math.round((summary[0].compliant / summary[0].total_checks) * 100) : 0
            } : {},
            
            checks: complianceChecks.map(check => ({
                ...check,
                impact_areas: JSON.parse(check.impact_areas || '[]'),
                estimated_fix_effort_hours: parseFloat(check.estimated_fix_effort_hours || 0)
            })),
            
            filters: {
                wcag_level: wcag_level || 'all',
                standard: standard || 'all'
            }
        };
        
        res.json({
            success: true,
            compliance_data: complianceData
        });
        
    } catch (error) {
        console.error('Compliance status error:', error);
        res.status(500).json({
            error: 'Failed to get compliance status',
            details: error.message
        });
    }
});

/**
 * POST /api/voice-accessibility/test
 * Test voice interface and accessibility features
 */
router.post('/test', ensureServiceReady, async (req, res) => {
    try {
        const testScenarios = [
            {
                user_id: 3001,
                voice_command: 'navigate to home page',
                expected_action: 'navigation',
                context: { page: '/gallery', test_mode: true }
            },
            {
                user_id: 3002,
                voice_command: 'read page content',
                expected_action: 'accessibility',
                context: { page: '/about', test_mode: true }
            },
            {
                user_id: 3003,
                voice_command: 'increase font size',
                expected_action: 'accessibility',
                context: { page: '/settings', test_mode: true }
            }
        ];
        
        console.log('🧪 Running voice and accessibility test');
        
        const testResults = [];
        
        for (const scenario of testScenarios) {
            const result = await voiceAccessibilityService.processVoiceCommand(
                scenario.user_id,
                scenario.voice_command,
                scenario.context
            );
            
            testResults.push({
                user_id: scenario.user_id,
                test_command: scenario.voice_command,
                expected_action: scenario.expected_action,
                command_recognized: !result.error,
                processing_time_ms: result.processing_time_ms || 0,
                confidence_score: result.nlu_analysis?.confidence || 0,
                test_passed: !result.error && result.command_success
            });
        }
        
        const successRate = testResults.filter(r => r.test_passed).length / testResults.length;
        
        res.json({
            success: true,
            test_scenarios: testScenarios.length,
            test_results: testResults,
            success_rate: successRate,
            avg_processing_time: testResults.reduce((sum, r) => sum + r.processing_time_ms, 0) / testResults.length,
            message: 'Voice and accessibility test completed successfully'
        });
        
    } catch (error) {
        console.error('Test execution error:', error);
        res.status(500).json({
            error: 'Failed to run test',
            details: error.message
        });
    }
});

// Error handling middleware
router.use((error, req, res, next) => {
    console.error('Voice Accessibility API Error:', error);
    res.status(500).json({
        error: 'Internal server error in Voice Accessibility API',
        details: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'
    });
});

module.exports = router;