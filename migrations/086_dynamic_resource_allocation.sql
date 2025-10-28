-- Dynamic Resource Allocation System Migration
-- Adds tables and infrastructure for intelligent resource management and allocation

USE phoenix4ge;

-- Resource pools configuration and current allocation
CREATE TABLE IF NOT EXISTS resource_pools (
    id INT PRIMARY KEY AUTO_INCREMENT,
    pool_name ENUM('cpu', 'memory', 'database_connections', 'storage_io') NOT NULL,
    total_capacity DECIMAL(10,2) NOT NULL,
    allocated_capacity DECIMAL(10,2) DEFAULT 0.00,
    reserved_capacity DECIMAL(10,2) DEFAULT 0.00,
    utilization_percentage DECIMAL(5,2) DEFAULT 0.00,
    efficiency_score DECIMAL(4,3) DEFAULT 0.000,
    last_rebalanced TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE KEY idx_pool_name (pool_name),
    INDEX idx_utilization (utilization_percentage),
    INDEX idx_efficiency (efficiency_score DESC),
    INDEX idx_last_rebalanced (last_rebalanced)
);

-- Resource pool segments (specific allocations within each pool)
CREATE TABLE IF NOT EXISTS resource_pool_segments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    pool_name ENUM('cpu', 'memory', 'database_connections', 'storage_io') NOT NULL,
    segment_name ENUM('web_server', 'database', 'cache', 'ml_processing', 'background_tasks', 'system_reserve') NOT NULL,
    min_allocation DECIMAL(10,2) NOT NULL,
    max_allocation DECIMAL(10,2) NOT NULL,
    current_allocation DECIMAL(10,2) NOT NULL,
    target_allocation DECIMAL(10,2),
    priority ENUM('critical', 'high', 'medium', 'low') NOT NULL DEFAULT 'medium',
    elasticity_factor DECIMAL(4,3) DEFAULT 1.000, -- How quickly this segment can scale
    performance_threshold DECIMAL(5,2) DEFAULT 80.00, -- Performance threshold for scaling
    last_scaled TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY idx_pool_segment (pool_name, segment_name),
    INDEX idx_priority (priority),
    INDEX idx_current_allocation (current_allocation),
    INDEX idx_performance_threshold (performance_threshold),
    INDEX idx_last_scaled (last_scaled)
);

-- Resource demand predictions and patterns
CREATE TABLE IF NOT EXISTS resource_demand_predictions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    pool_name ENUM('cpu', 'memory', 'database_connections', 'storage_io') NOT NULL,
    segment_name ENUM('web_server', 'database', 'cache', 'ml_processing', 'background_tasks', 'system_reserve') NOT NULL,
    prediction_horizon ENUM('1min', '5min', '15min', '1hour', '6hour', '24hour') NOT NULL,
    predicted_demand DECIMAL(10,2) NOT NULL,
    predicted_utilization DECIMAL(5,2) NOT NULL,
    confidence_score DECIMAL(4,3) NOT NULL,
    prediction_factors JSON, -- Factors that influenced this prediction
    algorithm_used ENUM('linear_regression', 'arima', 'neural_network', 'ensemble') DEFAULT 'linear_regression',
    actual_demand DECIMAL(10,2), -- Filled in when actual data becomes available
    prediction_accuracy DECIMAL(4,3), -- Calculated when actual becomes available
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    validated_at TIMESTAMP NULL,
    
    INDEX idx_pool_segment_horizon (pool_name, segment_name, prediction_horizon),
    INDEX idx_confidence_score (confidence_score DESC),
    INDEX idx_created_at (created_at),
    INDEX idx_prediction_accuracy (prediction_accuracy DESC)
);

-- Resource allocation decisions and history
CREATE TABLE IF NOT EXISTS resource_allocation_decisions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    decision_id VARCHAR(100) NOT NULL UNIQUE,
    trigger_type ENUM('performance_threshold', 'predicted_demand', 'manual', 'scheduled', 'emergency') NOT NULL,
    resource_changes JSON NOT NULL, -- Array of resource allocation changes
    decision_reasoning TEXT,
    confidence_score DECIMAL(4,3),
    expected_impact JSON, -- Expected performance improvements
    implementation_status ENUM('pending', 'implementing', 'completed', 'failed', 'reverted') DEFAULT 'pending',
    implementation_start TIMESTAMP NULL,
    implementation_end TIMESTAMP NULL,
    success BOOLEAN NULL,
    actual_impact JSON, -- Measured performance impact
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_decision_id (decision_id),
    INDEX idx_trigger_type (trigger_type),
    INDEX idx_implementation_status (implementation_status),
    INDEX idx_success (success),
    INDEX idx_created_at (created_at)
);

-- Resource performance metrics tracking
CREATE TABLE IF NOT EXISTS resource_performance_metrics (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    pool_name ENUM('cpu', 'memory', 'database_connections', 'storage_io') NOT NULL,
    segment_name ENUM('web_server', 'database', 'cache', 'ml_processing', 'background_tasks', 'system_reserve') NOT NULL,
    metric_type ENUM('utilization', 'response_time', 'throughput', 'error_rate', 'saturation') NOT NULL,
    metric_value DECIMAL(10,4) NOT NULL,
    baseline_value DECIMAL(10,4),
    threshold_value DECIMAL(10,4),
    is_threshold_exceeded BOOLEAN DEFAULT FALSE,
    measurement_context JSON, -- Additional context about the measurement
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_pool_segment (pool_name, segment_name),
    INDEX idx_metric_type (metric_type),
    INDEX idx_recorded_at (recorded_at),
    INDEX idx_threshold_exceeded (is_threshold_exceeded),
    INDEX idx_metric_value (metric_value)
);

-- Resource scaling events log
CREATE TABLE IF NOT EXISTS resource_scaling_events (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    event_id VARCHAR(100) NOT NULL UNIQUE,
    pool_name ENUM('cpu', 'memory', 'database_connections', 'storage_io') NOT NULL,
    segment_name ENUM('web_server', 'database', 'cache', 'ml_processing', 'background_tasks', 'system_reserve') NOT NULL,
    scaling_action ENUM('scale_up', 'scale_down', 'rebalance', 'emergency_allocation') NOT NULL,
    previous_allocation DECIMAL(10,2) NOT NULL,
    new_allocation DECIMAL(10,2) NOT NULL,
    scaling_factor DECIMAL(6,3), -- How much the resource was scaled (e.g., 1.5 = 50% increase)
    trigger_reason TEXT,
    trigger_metrics JSON,
    scaling_duration_ms BIGINT,
    success BOOLEAN DEFAULT TRUE,
    error_details TEXT,
    performance_impact JSON,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_event_id (event_id),
    INDEX idx_pool_segment (pool_name, segment_name),
    INDEX idx_scaling_action (scaling_action),
    INDEX idx_executed_at (executed_at),
    INDEX idx_success (success)
);

-- Resource allocation rules and policies
CREATE TABLE IF NOT EXISTS resource_allocation_policies (
    id INT PRIMARY KEY AUTO_INCREMENT,
    policy_name VARCHAR(100) NOT NULL UNIQUE,
    policy_type ENUM('scaling_rule', 'priority_rule', 'constraint_rule', 'emergency_rule') NOT NULL,
    pool_name ENUM('cpu', 'memory', 'database_connections', 'storage_io', 'all') DEFAULT 'all',
    segment_name ENUM('web_server', 'database', 'cache', 'ml_processing', 'background_tasks', 'system_reserve', 'all') DEFAULT 'all',
    conditions JSON NOT NULL, -- Conditions that trigger this policy
    actions JSON NOT NULL, -- Actions to take when conditions are met
    priority INT DEFAULT 5,
    is_active BOOLEAN DEFAULT TRUE,
    cooldown_minutes INT DEFAULT 5, -- Minimum time between policy executions
    max_executions_per_hour INT DEFAULT 12,
    last_executed TIMESTAMP NULL,
    execution_count INT DEFAULT 0,
    success_rate DECIMAL(5,4) DEFAULT 0.0000,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_policy_name (policy_name),
    INDEX idx_policy_type (policy_type),
    INDEX idx_pool_segment (pool_name, segment_name),
    INDEX idx_is_active (is_active),
    INDEX idx_priority (priority DESC),
    INDEX idx_last_executed (last_executed)
);

-- ML model performance for resource allocation prediction
CREATE TABLE IF NOT EXISTS resource_prediction_models (
    id INT PRIMARY KEY AUTO_INCREMENT,
    model_name VARCHAR(100) NOT NULL UNIQUE,
    model_type ENUM('demand_prediction', 'scaling_decision', 'performance_optimization', 'anomaly_detection') NOT NULL,
    target_resource ENUM('cpu', 'memory', 'database_connections', 'storage_io', 'all') NOT NULL,
    algorithm_type ENUM('linear_regression', 'arima', 'neural_network', 'ensemble', 'isolation_forest') NOT NULL,
    feature_set JSON NOT NULL,
    model_accuracy DECIMAL(4,3) DEFAULT 0.000,
    precision_score DECIMAL(4,3),
    recall_score DECIMAL(4,3),
    f1_score DECIMAL(4,3),
    training_data_size INT DEFAULT 0,
    validation_data_size INT DEFAULT 0,
    hyperparameters JSON,
    model_version VARCHAR(50),
    last_trained TIMESTAMP NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_model_name (model_name),
    INDEX idx_model_type (model_type),
    INDEX idx_target_resource (target_resource),
    INDEX idx_model_accuracy (model_accuracy DESC),
    INDEX idx_is_active (is_active),
    INDEX idx_last_trained (last_trained)
);

-- System resource constraints and limits
CREATE TABLE IF NOT EXISTS resource_constraints (
    id INT PRIMARY KEY AUTO_INCREMENT,
    constraint_name VARCHAR(100) NOT NULL UNIQUE,
    constraint_type ENUM('hard_limit', 'soft_limit', 'ratio_constraint', 'dependency_constraint') NOT NULL,
    resource_pool ENUM('cpu', 'memory', 'database_connections', 'storage_io', 'all') NOT NULL,
    constraint_definition JSON NOT NULL, -- Definition of the constraint
    enforcement_level ENUM('strict', 'advisory', 'emergency_only') DEFAULT 'strict',
    violation_action ENUM('block_allocation', 'scale_down_others', 'alert_only', 'emergency_override') DEFAULT 'block_allocation',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_constraint_name (constraint_name),
    INDEX idx_constraint_type (constraint_type),
    INDEX idx_resource_pool (resource_pool),
    INDEX idx_is_active (is_active)
);

-- Insert default resource pool configurations
INSERT IGNORE INTO resource_pools (pool_name, total_capacity, allocated_capacity, utilization_percentage) VALUES
('cpu', 100.00, 75.00, 75.00),
('memory', 100.00, 80.00, 80.00),
('database_connections', 100.00, 60.00, 60.00),
('storage_io', 100.00, 45.00, 45.00);

-- Insert default resource pool segments
INSERT IGNORE INTO resource_pool_segments (pool_name, segment_name, min_allocation, max_allocation, current_allocation, priority, elasticity_factor, performance_threshold) VALUES
-- CPU segments
('cpu', 'web_server', 30.00, 60.00, 35.00, 'high', 1.200, 75.00),
('cpu', 'database', 20.00, 40.00, 25.00, 'critical', 0.800, 70.00),
('cpu', 'cache', 5.00, 20.00, 8.00, 'medium', 1.500, 80.00),
('cpu', 'ml_processing', 2.00, 15.00, 5.00, 'low', 2.000, 85.00),
('cpu', 'background_tasks', 1.00, 10.00, 2.00, 'low', 1.800, 90.00),
-- Memory segments
('memory', 'web_server', 25.00, 50.00, 30.00, 'high', 1.100, 80.00),
('memory', 'database', 30.00, 60.00, 35.00, 'critical', 0.700, 75.00),
('memory', 'cache', 10.00, 30.00, 15.00, 'medium', 1.300, 85.00),
('memory', 'ml_processing', 2.00, 20.00, 3.00, 'low', 2.200, 90.00),
('memory', 'system_reserve', 5.00, 15.00, 7.00, 'critical', 0.500, 95.00),
-- Database connections segments
('database_connections', 'web_server', 40.00, 70.00, 45.00, 'high', 1.000, 80.00),
('database_connections', 'cache', 10.00, 30.00, 10.00, 'medium', 1.200, 85.00),
('database_connections', 'ml_processing', 2.00, 15.00, 3.00, 'low', 1.500, 90.00),
('database_connections', 'background_tasks', 1.00, 10.00, 2.00, 'low', 1.300, 95.00),
-- Storage I/O segments
('storage_io', 'web_server', 30.00, 60.00, 35.00, 'high', 1.100, 75.00),
('storage_io', 'database', 20.00, 50.00, 25.00, 'critical', 0.800, 70.00),
('storage_io', 'cache', 5.00, 25.00, 8.00, 'medium', 1.400, 80.00),
('storage_io', 'ml_processing', 2.00, 20.00, 5.00, 'low', 2.000, 85.00),
('storage_io', 'background_tasks', 1.00, 15.00, 2.00, 'low', 1.600, 90.00);

-- Insert default resource allocation policies
INSERT IGNORE INTO resource_allocation_policies (policy_name, policy_type, pool_name, segment_name, conditions, actions, priority, cooldown_minutes) VALUES
('high_cpu_scale_up', 'scaling_rule', 'cpu', 'web_server', 
 JSON_OBJECT('utilization_threshold', 85, 'duration_minutes', 3), 
 JSON_OBJECT('action', 'scale_up', 'factor', 1.2, 'max_allocation', 60), 
 8, 10),
('database_critical_protection', 'priority_rule', 'all', 'database', 
 JSON_OBJECT('database_utilization_threshold', 90), 
 JSON_OBJECT('action', 'prioritize', 'reduce_others', true, 'emergency_reserve', 10), 
 10, 5),
('memory_constraint_enforcement', 'constraint_rule', 'memory', 'all', 
 JSON_OBJECT('total_memory_threshold', 95), 
 JSON_OBJECT('action', 'scale_down', 'target_segments', JSON_ARRAY('ml_processing', 'background_tasks')), 
 9, 3),
('emergency_resource_reallocation', 'emergency_rule', 'all', 'all', 
 JSON_OBJECT('system_health_threshold', 0.3, 'any_segment_critical', true), 
 JSON_OBJECT('action', 'emergency_rebalance', 'preserve_critical', JSON_ARRAY('database', 'web_server')), 
 10, 1);

-- Insert default resource prediction models
INSERT IGNORE INTO resource_prediction_models (model_name, model_type, target_resource, algorithm_type, feature_set, model_accuracy, model_version) VALUES
('cpu_demand_predictor', 'demand_prediction', 'cpu', 'linear_regression', 
 JSON_ARRAY('current_utilization', 'time_of_day', 'day_of_week', 'active_sessions', 'request_rate'), 
 0.750, '1.0.0'),
('memory_scaling_optimizer', 'scaling_decision', 'memory', 'ensemble', 
 JSON_ARRAY('memory_utilization', 'cache_hit_rate', 'gc_frequency', 'active_connections'), 
 0.820, '1.0.0'),
('database_performance_predictor', 'performance_optimization', 'database_connections', 'neural_network',
 JSON_ARRAY('connection_count', 'query_complexity', 'cache_efficiency', 'io_wait_time'), 
 0.780, '1.0.0'),
('resource_anomaly_detector', 'anomaly_detection', 'all', 'isolation_forest',
 JSON_ARRAY('utilization_patterns', 'response_times', 'error_rates', 'scaling_frequency'), 
 0.890, '1.0.0');

-- Insert default resource constraints
INSERT IGNORE INTO resource_constraints (constraint_name, constraint_type, resource_pool, constraint_definition, enforcement_level) VALUES
('max_total_cpu_utilization', 'hard_limit', 'cpu', JSON_OBJECT('max_utilization', 95, 'emergency_threshold', 98), 'strict'),
('memory_headroom_requirement', 'soft_limit', 'memory', JSON_OBJECT('min_free_percentage', 10, 'warning_threshold', 5), 'advisory'),
('database_connection_ratio', 'ratio_constraint', 'database_connections', JSON_OBJECT('web_server_min_ratio', 0.6, 'critical_reserve', 10), 'strict'),
('ml_processing_dependency', 'dependency_constraint', 'all', JSON_OBJECT('requires', JSON_ARRAY('cpu', 'memory'), 'min_allocation', JSON_OBJECT('cpu', 5, 'memory', 8)), 'advisory');

-- Create views for easier resource analysis
CREATE OR REPLACE VIEW v_resource_allocation_summary AS
SELECT 
    rp.pool_name,
    rp.total_capacity,
    rp.allocated_capacity,
    rp.utilization_percentage,
    rp.efficiency_score,
    COUNT(rps.id) as segment_count,
    AVG(rps.current_allocation) as avg_segment_allocation,
    MAX(rps.current_allocation) as max_segment_allocation,
    MIN(rps.current_allocation) as min_segment_allocation,
    SUM(CASE WHEN rps.current_allocation > rps.performance_threshold THEN 1 ELSE 0 END) as segments_over_threshold
FROM resource_pools rp
LEFT JOIN resource_pool_segments rps ON rp.pool_name = rps.pool_name
GROUP BY rp.pool_name, rp.total_capacity, rp.allocated_capacity, rp.utilization_percentage, rp.efficiency_score;

CREATE OR REPLACE VIEW v_resource_scaling_effectiveness AS
SELECT 
    pool_name,
    segment_name,
    scaling_action,
    COUNT(*) as total_scaling_events,
    AVG(scaling_factor) as avg_scaling_factor,
    COUNT(CASE WHEN success = TRUE THEN 1 END) as successful_events,
    COUNT(CASE WHEN success = FALSE THEN 1 END) as failed_events,
    AVG(scaling_duration_ms) as avg_duration_ms,
    MAX(executed_at) as last_scaling_event
FROM resource_scaling_events
WHERE executed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY pool_name, segment_name, scaling_action;

CREATE OR REPLACE VIEW v_resource_prediction_accuracy AS
SELECT 
    rdp.pool_name,
    rdp.segment_name,
    rdp.prediction_horizon,
    rdp.algorithm_used,
    COUNT(*) as total_predictions,
    COUNT(CASE WHEN rdp.actual_demand IS NOT NULL THEN 1 END) as validated_predictions,
    AVG(rdp.confidence_score) as avg_confidence,
    AVG(CASE WHEN rdp.actual_demand IS NOT NULL THEN rdp.prediction_accuracy END) as avg_accuracy,
    MAX(rdp.created_at) as latest_prediction
FROM resource_demand_predictions rdp
WHERE rdp.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY rdp.pool_name, rdp.segment_name, rdp.prediction_horizon, rdp.algorithm_used;

CREATE OR REPLACE VIEW v_resource_performance_trends AS
SELECT 
    pool_name,
    segment_name,
    metric_type,
    DATE(recorded_at) as date,
    AVG(metric_value) as avg_value,
    MIN(metric_value) as min_value,
    MAX(metric_value) as max_value,
    COUNT(CASE WHEN is_threshold_exceeded = TRUE THEN 1 END) as threshold_violations,
    COUNT(*) as total_measurements
FROM resource_performance_metrics
WHERE recorded_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY pool_name, segment_name, metric_type, DATE(recorded_at)
ORDER BY pool_name, segment_name, metric_type, date DESC;

-- Create stored procedures for resource management
DELIMITER $$

CREATE PROCEDURE AnalyzeResourceUtilization(
    IN p_pool_name VARCHAR(50),
    IN p_hours_back INT DEFAULT 24
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    -- Current resource allocation status
    SELECT 
        'Current Allocation' as analysis_type,
        pool_name,
        total_capacity,
        allocated_capacity,
        utilization_percentage,
        efficiency_score
    FROM resource_pools
    WHERE (p_pool_name IS NULL OR pool_name = p_pool_name);
    
    -- Segment performance analysis
    SELECT 
        'Segment Performance' as analysis_type,
        rps.pool_name,
        rps.segment_name,
        rps.current_allocation,
        rps.performance_threshold,
        rps.priority,
        CASE 
            WHEN rps.current_allocation > rps.performance_threshold THEN 'Over Threshold'
            WHEN rps.current_allocation > rps.performance_threshold * 0.8 THEN 'Near Threshold'
            ELSE 'Within Limits'
        END as status,
        rps.last_scaled
    FROM resource_pool_segments rps
    WHERE (p_pool_name IS NULL OR rps.pool_name = p_pool_name)
    ORDER BY rps.pool_name, rps.priority DESC, rps.current_allocation DESC;
    
    -- Recent scaling events
    SELECT 
        'Recent Scaling Events' as analysis_type,
        pool_name,
        segment_name,
        scaling_action,
        previous_allocation,
        new_allocation,
        scaling_factor,
        success,
        executed_at
    FROM resource_scaling_events
    WHERE executed_at >= DATE_SUB(NOW(), INTERVAL p_hours_back HOUR)
      AND (p_pool_name IS NULL OR pool_name = p_pool_name)
    ORDER BY executed_at DESC
    LIMIT 50;
    
    COMMIT;
END$$

CREATE PROCEDURE OptimizeResourceAllocation(
    IN p_pool_name VARCHAR(50)
)
BEGIN
    DECLARE v_total_capacity DECIMAL(10,2);
    DECLARE v_current_utilization DECIMAL(5,2);
    DECLARE v_optimization_factor DECIMAL(4,3) DEFAULT 1.000;
    
    -- Get current pool status
    SELECT total_capacity, utilization_percentage
    INTO v_total_capacity, v_current_utilization
    FROM resource_pools
    WHERE pool_name = p_pool_name;
    
    -- Calculate optimization factor
    IF v_current_utilization > 90 THEN
        SET v_optimization_factor = 0.950; -- Reduce allocations by 5%
    ELSEIF v_current_utilization < 60 THEN
        SET v_optimization_factor = 1.100; -- Increase allocations by 10%
    END IF;
    
    -- Update segment allocations based on priority and performance
    UPDATE resource_pool_segments rps
    SET current_allocation = LEAST(
            rps.max_allocation,
            GREATEST(
                rps.min_allocation,
                rps.current_allocation * v_optimization_factor * 
                (CASE rps.priority
                    WHEN 'critical' THEN 1.050
                    WHEN 'high' THEN 1.025
                    WHEN 'medium' THEN 1.000
                    WHEN 'low' THEN 0.950
                END)
            )
        ),
        updated_at = NOW()
    WHERE pool_name = p_pool_name;
    
    -- Update pool utilization
    UPDATE resource_pools rp
    SET allocated_capacity = (
            SELECT SUM(current_allocation)
            FROM resource_pool_segments
            WHERE pool_name = p_pool_name
        ),
        utilization_percentage = (allocated_capacity / total_capacity) * 100,
        last_rebalanced = NOW()
    WHERE pool_name = p_pool_name;
    
    -- Return optimization results
    SELECT 
        p_pool_name as pool_name,
        'Optimization completed' as status,
        v_optimization_factor as optimization_factor,
        (SELECT allocated_capacity FROM resource_pools WHERE pool_name = p_pool_name) as new_allocated_capacity,
        (SELECT utilization_percentage FROM resource_pools WHERE pool_name = p_pool_name) as new_utilization_percentage;
END$$

CREATE PROCEDURE ValidateResourceConstraints()
BEGIN
    -- Check hard limits
    SELECT 
        'Constraint Violations' as check_type,
        rc.constraint_name,
        rc.constraint_type,
        rc.resource_pool,
        rp.utilization_percentage as current_utilization,
        JSON_EXTRACT(rc.constraint_definition, '$.max_utilization') as max_allowed,
        CASE 
            WHEN rp.utilization_percentage > JSON_EXTRACT(rc.constraint_definition, '$.max_utilization') THEN 'VIOLATION'
            WHEN rp.utilization_percentage > JSON_EXTRACT(rc.constraint_definition, '$.max_utilization') * 0.9 THEN 'WARNING'
            ELSE 'OK'
        END as status
    FROM resource_constraints rc
    JOIN resource_pools rp ON (rc.resource_pool = rp.pool_name OR rc.resource_pool = 'all')
    WHERE rc.is_active = TRUE
      AND rc.constraint_type = 'hard_limit'
    ORDER BY 
        CASE status WHEN 'VIOLATION' THEN 1 WHEN 'WARNING' THEN 2 ELSE 3 END;
END$$

DELIMITER ;

-- Create indexes for optimal query performance
ALTER TABLE resource_performance_metrics ADD INDEX idx_pool_segment_metric_time (pool_name, segment_name, metric_type, recorded_at DESC);
ALTER TABLE resource_demand_predictions ADD INDEX idx_prediction_validation (created_at, validated_at, prediction_accuracy DESC);
ALTER TABLE resource_allocation_decisions ADD INDEX idx_decision_impact (created_at, success, confidence_score DESC);
ALTER TABLE resource_scaling_events ADD INDEX idx_scaling_performance (pool_name, segment_name, executed_at DESC, success);

-- Grant permissions for dynamic resource allocation service
-- Note: In production, create a dedicated resource management service user
-- GRANT SELECT, INSERT, UPDATE, DELETE ON phoenix4ge.resource_* TO 'resource_manager'@'localhost';
-- GRANT EXECUTE ON PROCEDURE phoenix4ge.AnalyzeResourceUtilization TO 'resource_manager'@'localhost';
-- GRANT EXECUTE ON PROCEDURE phoenix4ge.OptimizeResourceAllocation TO 'resource_manager'@'localhost';
-- GRANT EXECUTE ON PROCEDURE phoenix4ge.ValidateResourceConstraints TO 'resource_manager'@'localhost';

SELECT 'Dynamic Resource Allocation System migration completed successfully' as status;