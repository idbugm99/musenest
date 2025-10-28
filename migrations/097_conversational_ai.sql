-- Conversational AI and Customer Support System Migration
-- Adds comprehensive tables for conversational AI, chat history, intent management,
-- knowledge base, customer support workflows, and AI learning systems

USE phoenix4ge;

-- Conversation management and state tracking
CREATE TABLE IF NOT EXISTS conversation_sessions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    conversation_id VARCHAR(100) UNIQUE NOT NULL,
    user_id BIGINT NOT NULL,
    
    -- Session information
    session_status ENUM('active', 'paused', 'ended', 'transferred', 'abandoned') DEFAULT 'active',
    channel ENUM('web', 'mobile', 'api', 'phone', 'email', 'chat_widget') DEFAULT 'web',
    language_code VARCHAR(10) DEFAULT 'en',
    
    -- Conversation metrics
    turn_count INT DEFAULT 0,
    total_user_messages INT DEFAULT 0,
    total_ai_responses INT DEFAULT 0,
    successful_resolutions INT DEFAULT 0,
    agent_handoffs INT DEFAULT 0,
    
    -- Context and state
    conversation_context JSON, -- Current conversation context
    user_profile_data JSON, -- User profile information
    session_metadata JSON, -- Device, IP, user agent, etc.
    conversation_summary TEXT, -- Summary of conversation
    
    -- Quality and satisfaction
    satisfaction_rating DECIMAL(3,2), -- 1.0 to 5.0 rating
    resolution_quality ENUM('excellent', 'good', 'satisfactory', 'poor', 'unresolved') DEFAULT NULL,
    ai_performance_score DECIMAL(6,4), -- AI performance in this conversation
    
    -- Timing information
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    ended_at TIMESTAMP NULL,
    total_duration_seconds INT DEFAULT 0,
    
    -- Escalation and handoff
    escalated_to_agent BOOLEAN DEFAULT FALSE,
    agent_id BIGINT NULL, -- ID of agent who took over
    escalation_reason TEXT, -- Why conversation was escalated
    agent_handoff_at TIMESTAMP NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_conversation_id (conversation_id),
    INDEX idx_user_id (user_id),
    INDEX idx_session_status (session_status),
    INDEX idx_channel (channel),
    INDEX idx_started_at (started_at DESC),
    INDEX idx_last_activity_at (last_activity_at DESC),
    INDEX idx_satisfaction_rating (satisfaction_rating DESC),
    INDEX idx_escalated_to_agent (escalated_to_agent),
    INDEX idx_user_active_sessions (user_id, session_status, last_activity_at DESC)
);

-- Individual conversation turns (messages and responses)
CREATE TABLE IF NOT EXISTS conversation_turns (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    conversation_id VARCHAR(100) NOT NULL,
    turn_number INT NOT NULL,
    
    -- Message information
    message_type ENUM('user_message', 'ai_response', 'system_message', 'agent_message') NOT NULL,
    message_content TEXT NOT NULL,
    message_language VARCHAR(10) DEFAULT 'en',
    
    -- User input analysis (for user messages)
    user_intent VARCHAR(100), -- Detected user intent
    intent_confidence DECIMAL(6,4), -- Confidence in intent detection
    extracted_entities JSON, -- Extracted entities from message
    sentiment_score DECIMAL(6,4), -- Sentiment analysis score (-1.0 to 1.0)
    sentiment_label ENUM('very_negative', 'negative', 'neutral', 'positive', 'very_positive'),
    
    -- AI response details (for AI responses)
    response_type ENUM('informative', 'clarifying', 'empathetic', 'solution_oriented', 'escalation') DEFAULT NULL,
    response_confidence DECIMAL(6,4), -- Confidence in response quality
    knowledge_sources_used JSON, -- Knowledge base articles used
    response_generation_time_ms INT, -- Time to generate response
    
    -- Context and processing
    conversation_context JSON, -- Context at time of this turn
    processing_metadata JSON, -- AI processing information
    quality_score DECIMAL(6,4), -- Quality score of turn
    
    -- User feedback on turn
    user_feedback ENUM('helpful', 'not_helpful', 'partially_helpful') DEFAULT NULL,
    user_feedback_text TEXT, -- Detailed user feedback
    feedback_timestamp TIMESTAMP NULL,
    
    -- Timing
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_conversation_id (conversation_id),
    INDEX idx_turn_number (turn_number),
    INDEX idx_message_type (message_type),
    INDEX idx_user_intent (user_intent),
    INDEX idx_sentiment_score (sentiment_score),
    INDEX idx_response_confidence (response_confidence DESC),
    INDEX idx_created_at (created_at DESC),
    INDEX idx_conversation_flow (conversation_id, turn_number),
    
    FOREIGN KEY (conversation_id) REFERENCES conversation_sessions(conversation_id) ON DELETE CASCADE
);

-- Knowledge base for AI responses
CREATE TABLE IF NOT EXISTS ai_knowledge_base (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    knowledge_id VARCHAR(100) UNIQUE NOT NULL,
    
    -- Content information
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    content_type ENUM('faq', 'how_to_guide', 'troubleshooting', 'product_info', 'policy_info', 'general_info') NOT NULL,
    category VARCHAR(200),
    subcategory VARCHAR(200),
    
    -- Content metadata
    tags JSON, -- Searchable tags
    keywords JSON, -- Keywords for matching
    intents_applicable JSON, -- Which intents this content applies to
    language_code VARCHAR(10) DEFAULT 'en',
    
    -- Content quality and usage
    accuracy_score DECIMAL(6,4) DEFAULT 1.0000, -- Content accuracy
    usefulness_score DECIMAL(6,4) DEFAULT 0.5000, -- How useful content is
    usage_count BIGINT DEFAULT 0, -- How often content is used
    success_rate DECIMAL(6,4) DEFAULT 0.0000, -- Success rate when used
    
    -- Content versioning
    version VARCHAR(20) DEFAULT '1.0',
    is_active BOOLEAN DEFAULT TRUE,
    superseded_by_knowledge_id VARCHAR(100), -- ID of newer version
    
    -- Content freshness
    content_last_reviewed TIMESTAMP,
    content_expires_at TIMESTAMP, -- When content should be reviewed
    auto_update_enabled BOOLEAN DEFAULT FALSE,
    
    -- Usage analytics
    last_used_at TIMESTAMP,
    positive_feedback_count INT DEFAULT 0,
    negative_feedback_count INT DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_knowledge_id (knowledge_id),
    INDEX idx_content_type (content_type),
    INDEX idx_category (category),
    INDEX idx_language_code (language_code),
    INDEX idx_accuracy_score (accuracy_score DESC),
    INDEX idx_usefulness_score (usefulness_score DESC),
    INDEX idx_usage_count (usage_count DESC),
    INDEX idx_is_active (is_active),
    INDEX idx_last_used_at (last_used_at DESC),
    FULLTEXT INDEX idx_content_search (title, content, category, subcategory),
    
    FOREIGN KEY (superseded_by_knowledge_id) REFERENCES ai_knowledge_base(knowledge_id) ON DELETE SET NULL
);

-- Intent classification and management
CREATE TABLE IF NOT EXISTS intent_classifications (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    intent_name VARCHAR(100) NOT NULL,
    intent_category ENUM('greeting', 'question', 'complaint', 'compliment', 'request_help', 
                         'technical_support', 'billing_inquiry', 'account_management', 
                         'feature_request', 'feedback', 'booking_inquiry', 'payment_issue', 
                         'content_question', 'navigation_help', 'goodbye', 'unclear_intent') NOT NULL,
    
    -- Intent definition
    intent_description TEXT,
    example_phrases JSON, -- Example phrases for this intent
    keywords JSON, -- Keywords that trigger this intent
    entities_expected JSON, -- Expected entities for this intent
    
    -- Intent handling
    response_templates JSON, -- Template responses for this intent
    follow_up_actions JSON, -- Actions to take for this intent
    escalation_criteria JSON, -- When to escalate this intent
    
    -- Intent performance
    classification_accuracy DECIMAL(6,4) DEFAULT 0.0000, -- How accurately classified
    resolution_rate DECIMAL(6,4) DEFAULT 0.0000, -- How often resolved
    user_satisfaction DECIMAL(6,4) DEFAULT 0.0000, -- User satisfaction for this intent
    
    -- Configuration
    confidence_threshold DECIMAL(6,4) DEFAULT 0.7500, -- Minimum confidence to classify
    is_enabled BOOLEAN DEFAULT TRUE,
    requires_agent_handoff BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_intent_name (intent_name),
    INDEX idx_intent_category (intent_category),
    INDEX idx_classification_accuracy (classification_accuracy DESC),
    INDEX idx_resolution_rate (resolution_rate DESC),
    INDEX idx_is_enabled (is_enabled),
    
    UNIQUE KEY unique_intent_name (intent_name)
);

-- Customer support workflows and automation
CREATE TABLE IF NOT EXISTS support_workflows (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    workflow_id VARCHAR(100) UNIQUE NOT NULL,
    workflow_name VARCHAR(300) NOT NULL,
    
    -- Workflow definition
    workflow_type ENUM('linear', 'conditional', 'parallel', 'escalation') NOT NULL,
    trigger_conditions JSON NOT NULL, -- Conditions that trigger this workflow
    workflow_steps JSON NOT NULL, -- Steps in the workflow
    
    -- Workflow execution
    is_active BOOLEAN DEFAULT TRUE,
    automation_level ENUM('fully_automated', 'semi_automated', 'manual_approval_required') DEFAULT 'fully_automated',
    execution_priority INT DEFAULT 50, -- 1-100 priority
    
    -- Success criteria
    success_conditions JSON, -- How to determine success
    failure_conditions JSON, -- How to determine failure
    timeout_minutes INT DEFAULT 60, -- Workflow timeout
    
    -- Performance tracking
    execution_count BIGINT DEFAULT 0,
    success_count BIGINT DEFAULT 0,
    failure_count BIGINT DEFAULT 0,
    average_execution_time_minutes DECIMAL(8,2) DEFAULT 0.00,
    
    -- Workflow analytics
    user_satisfaction_impact DECIMAL(6,4) DEFAULT 0.0000,
    resolution_time_improvement DECIMAL(8,2) DEFAULT 0.00, -- Minutes saved
    cost_per_execution DECIMAL(10,4) DEFAULT 0.0000,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_workflow_id (workflow_id),
    INDEX idx_workflow_type (workflow_type),
    INDEX idx_is_active (is_active),
    INDEX idx_execution_priority (execution_priority DESC),
    INDEX idx_execution_count (execution_count DESC),
    INDEX idx_success_rate_calc (success_count, execution_count),
    
    UNIQUE KEY unique_workflow_name (workflow_name)
);

-- AI learning and improvement tracking
CREATE TABLE IF NOT EXISTS ai_learning_sessions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    learning_session_id VARCHAR(100) UNIQUE NOT NULL,
    
    -- Learning context
    learning_type ENUM('conversation_feedback', 'agent_corrections', 'knowledge_updates', 'model_retraining', 'performance_optimization') NOT NULL,
    learning_source ENUM('user_feedback', 'agent_review', 'automated_analysis', 'manual_input', 'performance_metrics') NOT NULL,
    
    -- Learning data
    input_data JSON NOT NULL, -- Data used for learning
    learning_outcomes JSON, -- What was learned
    model_updates JSON, -- Updates made to models
    performance_improvements JSON, -- Measured improvements
    
    -- Learning metrics
    learning_confidence DECIMAL(6,4), -- Confidence in learning
    validation_score DECIMAL(6,4), -- Validation of learning
    implementation_success BOOLEAN DEFAULT FALSE,
    rollback_required BOOLEAN DEFAULT FALSE,
    
    -- Impact measurement
    before_performance_metrics JSON, -- Metrics before learning
    after_performance_metrics JSON, -- Metrics after learning
    improvement_percentage DECIMAL(8,4), -- Percentage improvement
    
    -- Learning session metadata
    data_points_processed BIGINT DEFAULT 0,
    processing_time_minutes INT,
    computational_cost DECIMAL(10,4),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    
    INDEX idx_learning_session_id (learning_session_id),
    INDEX idx_learning_type (learning_type),
    INDEX idx_learning_source (learning_source),
    INDEX idx_learning_confidence (learning_confidence DESC),
    INDEX idx_implementation_success (implementation_success),
    INDEX idx_created_at (created_at DESC)
);

-- Multi-language support and translation
CREATE TABLE IF NOT EXISTS conversation_translations (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    conversation_id VARCHAR(100) NOT NULL,
    turn_id BIGINT NOT NULL, -- Reference to conversation_turns.id
    
    -- Translation details
    source_language VARCHAR(10) NOT NULL,
    target_language VARCHAR(10) NOT NULL,
    source_text TEXT NOT NULL,
    translated_text TEXT NOT NULL,
    
    -- Translation quality
    translation_method ENUM('neural_translation', 'professional_translation', 'hybrid') DEFAULT 'neural_translation',
    translation_confidence DECIMAL(6,4),
    quality_score DECIMAL(6,4), -- Quality of translation
    
    -- Translation metadata
    translation_provider VARCHAR(100),
    translation_cost DECIMAL(8,4),
    translation_time_ms INT,
    context_preserved BOOLEAN DEFAULT TRUE,
    
    -- Validation and feedback
    human_reviewed BOOLEAN DEFAULT FALSE,
    review_score DECIMAL(6,4), -- Human review score
    correction_required BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_conversation_id (conversation_id),
    INDEX idx_turn_id (turn_id),
    INDEX idx_source_language (source_language),
    INDEX idx_target_language (target_language),
    INDEX idx_translation_confidence (translation_confidence DESC),
    INDEX idx_quality_score (quality_score DESC),
    
    FOREIGN KEY (turn_id) REFERENCES conversation_turns(id) ON DELETE CASCADE
);

-- Performance analytics and monitoring
CREATE TABLE IF NOT EXISTS ai_performance_analytics (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    analysis_period_start TIMESTAMP NOT NULL,
    analysis_period_end TIMESTAMP NOT NULL,
    analysis_type ENUM('conversation_performance', 'intent_accuracy', 'response_quality', 'user_satisfaction', 'resolution_effectiveness') NOT NULL,
    
    -- Performance metrics
    total_conversations BIGINT DEFAULT 0,
    successful_resolutions BIGINT DEFAULT 0,
    agent_handoffs BIGINT DEFAULT 0,
    average_conversation_length DECIMAL(8,2) DEFAULT 0.00,
    average_response_time_ms DECIMAL(10,2) DEFAULT 0.00,
    
    -- Quality metrics
    average_user_satisfaction DECIMAL(6,4) DEFAULT 0.0000,
    intent_classification_accuracy DECIMAL(6,4) DEFAULT 0.0000,
    response_relevance_score DECIMAL(6,4) DEFAULT 0.0000,
    knowledge_base_hit_rate DECIMAL(6,4) DEFAULT 0.0000,
    
    -- Efficiency metrics
    cost_per_conversation DECIMAL(10,4) DEFAULT 0.0000,
    time_saved_minutes DECIMAL(12,2) DEFAULT 0.00,
    automation_percentage DECIMAL(6,4) DEFAULT 0.0000,
    
    -- Detailed analytics
    performance_breakdown JSON, -- Detailed performance breakdown
    improvement_suggestions JSON, -- AI-generated improvement suggestions
    trend_analysis JSON, -- Trend analysis results
    comparative_analysis JSON, -- Comparison with previous periods
    
    -- Data quality
    data_completeness_percentage DECIMAL(6,4),
    analysis_confidence_level DECIMAL(6,4),
    statistical_significance DECIMAL(6,4),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_analysis_period (analysis_period_start, analysis_period_end),
    INDEX idx_analysis_type (analysis_type),
    INDEX idx_total_conversations (total_conversations DESC),
    INDEX idx_successful_resolutions (successful_resolutions DESC),
    INDEX idx_average_user_satisfaction (average_user_satisfaction DESC),
    INDEX idx_intent_classification_accuracy (intent_classification_accuracy DESC)
);

-- Insert default intent classifications
INSERT IGNORE INTO intent_classifications (intent_name, intent_category, intent_description, example_phrases, response_templates) VALUES
('greeting_hello', 'greeting', 'User greets the AI assistant', '["hello", "hi", "hey there", "good morning", "good afternoon"]', '["Hello! How can I assist you today?", "Hi there! What can I help you with?", "Good to see you! How may I help?"]'),
('help_request_general', 'request_help', 'User asks for general help or assistance', '["can you help me", "I need help", "assist me please", "I have a question"]', '["I\'d be happy to help! What specific question or issue can I assist you with?", "Of course! Please tell me more about what you need help with."]'),
('technical_support_issue', 'technical_support', 'User reports a technical problem', '["not working", "broken", "error", "bug", "technical issue"]', '["I understand you\'re experiencing a technical issue. Can you provide more details about what\'s happening?", "Let me help you troubleshoot this technical problem."]'),
('billing_question', 'billing_inquiry', 'User has questions about billing or payments', '["billing", "payment", "charge", "invoice", "subscription cost"]', '["I can help with billing questions. What specific billing information do you need?", "Let me assist you with your billing inquiry."]'),
('account_help', 'account_management', 'User needs help with account management', '["account settings", "profile", "login", "password", "account access"]', '["I can help with account-related questions. What do you need assistance with regarding your account?"]'),
('goodbye_farewell', 'goodbye', 'User says goodbye or ends conversation', '["goodbye", "bye", "thanks", "that\'s all", "see you later"]', '["Thank you for using our service! Have a great day!", "Goodbye! Feel free to return if you need more assistance.", "Take care! We\'re here whenever you need help."]');

-- Insert sample knowledge base entries
INSERT IGNORE INTO ai_knowledge_base (knowledge_id, title, content, content_type, category, tags, keywords, intents_applicable) VALUES
('KB_ACCOUNT_LOGIN', 'How to log into your account', 'To log into your account: 1) Go to the login page 2) Enter your email and password 3) Click "Sign In" 4) If you forgot your password, click "Reset Password"', 'how_to_guide', 'Account Management', '["login", "sign in", "password"]', '["login", "sign in", "password", "account access"]', '["account_help", "technical_support_issue"]'),
('KB_BILLING_INFO', 'Understanding your billing', 'Your billing cycle runs monthly from the date you subscribed. You can view your billing history in Account Settings > Billing. Payment methods accepted include credit cards and PayPal.', 'faq', 'Billing', '["billing", "payment", "subscription"]', '["billing", "payment", "invoice", "subscription", "cost"]', '["billing_question"]'),
('KB_TECHNICAL_SUPPORT', 'Common technical issues', 'If you experience technical issues: 1) Clear your browser cache 2) Try a different browser 3) Check your internet connection 4) Contact support if the issue persists', 'troubleshooting', 'Technical Support', '["technical", "troubleshooting", "issues"]', '["not working", "broken", "error", "technical issue"]', '["technical_support_issue"]');

-- Insert sample support workflows
INSERT IGNORE INTO support_workflows (workflow_id, workflow_name, workflow_type, trigger_conditions, workflow_steps, success_conditions) VALUES
('WF_BILLING_INQUIRY', 'Billing Inquiry Resolution', 'linear', '{"intent": "billing_question", "confidence": 0.8}', '{"steps": [{"action": "gather_account_info"}, {"action": "search_knowledge_base", "category": "billing"}, {"action": "provide_solution"}, {"action": "confirm_resolution"}]}', '{"user_satisfaction": 4.0, "issue_resolved": true}'),
('WF_TECHNICAL_SUPPORT', 'Technical Issue Troubleshooting', 'conditional', '{"intent": "technical_support_issue", "confidence": 0.75}', '{"steps": [{"action": "identify_issue_type"}, {"action": "provide_troubleshooting_steps"}, {"action": "verify_resolution", "if_not": "escalate_to_agent"}]}', '{"issue_resolved": true}'),
('WF_AGENT_ESCALATION', 'Agent Handoff Workflow', 'escalation', '{"escalation_required": true}', '{"steps": [{"action": "summarize_conversation"}, {"action": "collect_contact_info"}, {"action": "create_support_ticket"}, {"action": "notify_agent"}, {"action": "transfer_conversation"}]}', '{"agent_contacted": true, "context_transferred": true}');

-- Create views for conversational AI analytics
CREATE OR REPLACE VIEW v_conversation_performance_summary AS
SELECT 
    DATE(cs.started_at) as conversation_date,
    cs.channel,
    cs.language_code,
    COUNT(*) as total_conversations,
    COUNT(CASE WHEN cs.session_status = 'ended' AND cs.resolution_quality IN ('excellent', 'good', 'satisfactory') THEN 1 END) as successful_resolutions,
    COUNT(CASE WHEN cs.escalated_to_agent = TRUE THEN 1 END) as agent_handoffs,
    AVG(cs.turn_count) as avg_conversation_length,
    AVG(cs.total_duration_seconds) as avg_duration_seconds,
    AVG(cs.satisfaction_rating) as avg_satisfaction_rating,
    AVG(cs.ai_performance_score) as avg_ai_performance
FROM conversation_sessions cs
WHERE cs.started_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY DATE(cs.started_at), cs.channel, cs.language_code
ORDER BY conversation_date DESC, total_conversations DESC;

CREATE OR REPLACE VIEW v_intent_classification_performance AS
SELECT 
    ic.intent_name,
    ic.intent_category,
    COUNT(ct.id) as total_classifications,
    AVG(ct.intent_confidence) as avg_confidence,
    COUNT(CASE WHEN ct.user_feedback = 'helpful' THEN 1 END) as helpful_responses,
    COUNT(CASE WHEN ct.user_feedback = 'not_helpful' THEN 1 END) as unhelpful_responses,
    ic.classification_accuracy,
    ic.resolution_rate,
    ic.user_satisfaction
FROM intent_classifications ic
LEFT JOIN conversation_turns ct ON ic.intent_name = ct.user_intent
WHERE ct.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) OR ct.created_at IS NULL
GROUP BY ic.intent_name, ic.intent_category, ic.classification_accuracy, ic.resolution_rate, ic.user_satisfaction
ORDER BY total_classifications DESC, avg_confidence DESC;

CREATE OR REPLACE VIEW v_knowledge_base_effectiveness AS
SELECT 
    kb.knowledge_id,
    kb.title,
    kb.content_type,
    kb.category,
    kb.usage_count,
    kb.accuracy_score,
    kb.usefulness_score,
    kb.success_rate,
    kb.positive_feedback_count,
    kb.negative_feedback_count,
    CASE 
        WHEN (kb.positive_feedback_count + kb.negative_feedback_count) > 0 
        THEN kb.positive_feedback_count / (kb.positive_feedback_count + kb.negative_feedback_count)
        ELSE 0 
    END as feedback_ratio,
    DATEDIFF(NOW(), kb.content_last_reviewed) as days_since_review,
    kb.last_used_at
FROM ai_knowledge_base kb
WHERE kb.is_active = TRUE
ORDER BY kb.usage_count DESC, kb.success_rate DESC;

-- Create stored procedures for conversational AI operations
DELIMITER $$

CREATE PROCEDURE StartConversationSession(
    IN p_user_id BIGINT,
    IN p_channel VARCHAR(20) DEFAULT 'web',
    IN p_language VARCHAR(10) DEFAULT 'en',
    IN p_session_metadata JSON DEFAULT NULL
)
BEGIN
    DECLARE v_conversation_id VARCHAR(100);
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    -- Generate conversation ID
    SET v_conversation_id = CONCAT('CONV_', UNIX_TIMESTAMP(), '_', p_user_id, '_', SUBSTRING(MD5(RAND()), 1, 6));
    
    -- Create conversation session
    INSERT INTO conversation_sessions (
        conversation_id,
        user_id,
        session_status,
        channel,
        language_code,
        session_metadata
    ) VALUES (
        v_conversation_id,
        p_user_id,
        'active',
        p_channel,
        p_language,
        p_session_metadata
    );
    
    SELECT v_conversation_id as conversation_id, 'Conversation session started successfully' as message;
    
    COMMIT;
END$$

CREATE PROCEDURE GetConversationAnalytics(
    IN p_start_date DATE DEFAULT NULL,
    IN p_end_date DATE DEFAULT NULL,
    IN p_channel VARCHAR(20) DEFAULT NULL
)
BEGIN
    DECLARE v_start_date DATE DEFAULT COALESCE(p_start_date, DATE_SUB(CURDATE(), INTERVAL 30 DAY));
    DECLARE v_end_date DATE DEFAULT COALESCE(p_end_date, CURDATE());
    
    -- Conversation performance metrics
    SELECT 
        'Conversation Metrics' as section,
        COUNT(*) as total_conversations,
        COUNT(CASE WHEN session_status = 'ended' THEN 1 END) as completed_conversations,
        COUNT(CASE WHEN escalated_to_agent = TRUE THEN 1 END) as agent_handoffs,
        AVG(turn_count) as avg_conversation_length,
        AVG(satisfaction_rating) as avg_satisfaction,
        AVG(ai_performance_score) as avg_ai_performance
    FROM conversation_sessions
    WHERE DATE(started_at) BETWEEN v_start_date AND v_end_date
      AND (p_channel IS NULL OR channel = p_channel);
    
    -- Intent classification performance
    SELECT 
        'Intent Performance' as section,
        ct.user_intent,
        COUNT(*) as classifications_count,
        AVG(ct.intent_confidence) as avg_confidence,
        COUNT(CASE WHEN ct.user_feedback = 'helpful' THEN 1 END) as helpful_count,
        COUNT(CASE WHEN ct.user_feedback = 'not_helpful' THEN 1 END) as not_helpful_count
    FROM conversation_turns ct
    JOIN conversation_sessions cs ON ct.conversation_id = cs.conversation_id
    WHERE DATE(ct.created_at) BETWEEN v_start_date AND v_end_date
      AND (p_channel IS NULL OR cs.channel = p_channel)
      AND ct.user_intent IS NOT NULL
    GROUP BY ct.user_intent
    ORDER BY classifications_count DESC;
    
    -- Knowledge base usage
    SELECT 
        'Knowledge Base Usage' as section,
        kb.title,
        kb.category,
        kb.usage_count,
        kb.success_rate,
        kb.positive_feedback_count,
        kb.negative_feedback_count
    FROM ai_knowledge_base kb
    WHERE kb.last_used_at BETWEEN v_start_date AND DATE_ADD(v_end_date, INTERVAL 1 DAY)
      AND kb.usage_count > 0
    ORDER BY kb.usage_count DESC
    LIMIT 20;
END$$

DELIMITER ;

-- Create indexes for optimal AI query performance
ALTER TABLE conversation_sessions ADD INDEX idx_ai_performance (ai_performance_score DESC, satisfaction_rating DESC);
ALTER TABLE conversation_turns ADD INDEX idx_intent_analysis (user_intent, intent_confidence DESC, sentiment_score);
ALTER TABLE ai_knowledge_base ADD INDEX idx_knowledge_performance (usage_count DESC, success_rate DESC, accuracy_score DESC);
ALTER TABLE intent_classifications ADD INDEX idx_classification_performance (classification_accuracy DESC, resolution_rate DESC);

-- Grant permissions for conversational AI service
-- Note: In production, create a dedicated AI service user
-- GRANT SELECT, INSERT, UPDATE, DELETE ON phoenix4ge.conversation_sessions TO 'ai_service'@'localhost';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON phoenix4ge.conversation_turns TO 'ai_service'@'localhost';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON phoenix4ge.ai_knowledge_base TO 'ai_service'@'localhost';
-- GRANT EXECUTE ON PROCEDURE phoenix4ge.StartConversationSession TO 'ai_service'@'localhost';
-- GRANT EXECUTE ON PROCEDURE phoenix4ge.GetConversationAnalytics TO 'ai_service'@'localhost';

SELECT 'Conversational AI and Customer Support system migration completed successfully' as status;