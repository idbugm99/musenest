/**
 * Chat Widget Helper Service
 * Handles model chat settings and widget configuration
 */

const { query } = require('../config/database');

class ChatWidgetHelper {
    /**
     * Get chat configuration for a model
     */
    async getModelChatConfig(modelId) {
        try {
            const result = await query(`
                SELECT id, slug, name, chat_enabled, online_status, 
                       chat_welcome_message, chat_away_message
                FROM models 
                WHERE slug = ? OR id = ?
                LIMIT 1
            `, [modelId, modelId]);

            if (result.length === 0) {
                return {
                    enabled: false,
                    modelId: null,
                    modelSlug: null,
                    reason: 'Model not found'
                };
            }

            const model = result[0];
            const isEnabled = model.chat_enabled === 1 || model.chat_enabled === true;

            return {
                enabled: isEnabled,
                modelId: model.id,
                modelSlug: model.slug,
                modelName: model.name,
                onlineStatus: model.online_status,
                welcomeMessage: model.chat_welcome_message,
                awayMessage: model.chat_away_message,
                reason: !isEnabled ? 'Chat disabled by model' : null
            };
        } catch (error) {
            console.error('Error getting model chat config:', error);
            return {
                enabled: false,
                modelId: null,
                modelSlug: null,
                reason: 'Database error'
            };
        }
    }

    /**
     * Generate chat widget configuration JavaScript
     */
    generateChatWidgetConfig(chatConfig) {
        if (!chatConfig.enabled) {
            return `
                <script>
                    // Chat not enabled for this model
                    window.modelChatConfig = { enabled: false, reason: '${chatConfig.reason || 'Chat disabled'}' };
                </script>
            `;
        }

        return `
            <script>
                window.modelChatConfig = {
                    enabled: true,
                    modelId: '${chatConfig.modelId}',
                    modelSlug: '${chatConfig.modelSlug}',
                    modelName: '${chatConfig.modelName || ''}',
                    onlineStatus: '${chatConfig.onlineStatus || 'offline'}',
                    welcomeMessage: ${JSON.stringify(chatConfig.welcomeMessage || '')},
                    awayMessage: ${JSON.stringify(chatConfig.awayMessage || '')}
                };
            </script>
        `;
    }

    /**
     * Generate complete chat widget HTML includes
     */
    generateChatWidgetIncludes(chatConfig) {
        if (!chatConfig.enabled) {
            return '<!-- Chat widget disabled for this model -->';
        }

        const configScript = this.generateChatWidgetConfig(chatConfig);
        
        return `
            <!-- Universal Chat Widget -->
            <link rel="stylesheet" href="/public/universal-chat-widget.css">
            ${configScript}
            <script src="/public/universal-chat-widget.js"></script>
        `;
    }

    /**
     * Handlebars helper function - synchronous version that generates dynamic loading script
     */
    static createHandlebarsHelper() {
        return function(modelId, options) {
            try {
                // Generate a script that will dynamically load the chat widget
                const script = `
                    <!-- Universal Chat Widget -->
                    <script>
                    // Load chat widget dynamically after checking model settings
                    (async function() {
                        try {
                            // Check if model has chat enabled via API
                            const response = await fetch('/api/model-profile/${modelId}');
                            const data = await response.json();
                            
                            if (data.success && data.data && data.data.chat_enabled) {
                                // Load CSS
                                const cssLink = document.createElement('link');
                                cssLink.rel = 'stylesheet';
                                cssLink.href = '/public/universal-chat-widget.css';
                                document.head.appendChild(cssLink);
                                
                                // Set configuration
                                window.modelChatConfig = {
                                    enabled: true,
                                    modelId: data.data.id,
                                    modelSlug: data.data.slug || '${modelId}',
                                    modelName: data.data.name || '',
                                    onlineStatus: data.data.online_status || 'offline',
                                    welcomeMessage: data.data.chat_welcome_message || '',
                                    awayMessage: data.data.chat_away_message || ''
                                };
                                
                                // Load JS
                                const jsScript = document.createElement('script');
                                jsScript.src = '/public/universal-chat-widget.js';
                                document.body.appendChild(jsScript);
                            } else {
                                // Chat not enabled
                                window.modelChatConfig = { enabled: false, reason: 'Chat disabled' };
                            }
                        } catch (error) {
                            console.error('Failed to load chat widget:', error);
                            window.modelChatConfig = { enabled: false, reason: 'Load error' };
                        }
                    })();
                    </script>
                `;
                return script;
            } catch (error) {
                console.error('Chat widget helper error:', error);
                return '<!-- Chat widget helper error -->';
            }
        };
    }

    /**
     * Express middleware to add chat config to locals
     */
    static createMiddleware() {
        const helper = new ChatWidgetHelper();
        
        return async (req, res, next) => {
            // Add chat config method to res.locals
            res.locals.getChatConfig = async (modelId) => {
                return await helper.getModelChatConfig(modelId);
            };
            
            res.locals.chatWidgetIncludes = async (modelId) => {
                const chatConfig = await helper.getModelChatConfig(modelId);
                return helper.generateChatWidgetIncludes(chatConfig);
            };
            
            next();
        };
    }

    /**
     * Get chat widget status for API
     */
    async getChatWidgetStatus(modelId) {
        const chatConfig = await this.getModelChatConfig(modelId);
        
        return {
            success: true,
            chatEnabled: chatConfig.enabled,
            modelId: chatConfig.modelId,
            modelSlug: chatConfig.modelSlug,
            onlineStatus: chatConfig.onlineStatus,
            config: chatConfig.enabled ? {
                welcomeMessage: chatConfig.welcomeMessage,
                awayMessage: chatConfig.awayMessage
            } : null,
            reason: chatConfig.reason
        };
    }
}

module.exports = ChatWidgetHelper;