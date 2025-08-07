-- Component Registry Migration
-- Creates component management system for the Business Manager CRM
-- Date: 2025-08-04

-- Component Registry - Master list of all reusable components
CREATE TABLE component_registry (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category ENUM('navigation', 'dashboard', 'forms', 'charts', 'modals', 'data', 'ui', 'business') NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    dependencies JSON,
    auto_save_enabled BOOLEAN DEFAULT FALSE,
    api_endpoints JSON,
    css_classes JSON,
    js_functions JSON,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_name (name),
    INDEX idx_category (category),
    INDEX idx_active (is_active)
);

-- Component Versions - Track component changes over time
CREATE TABLE component_versions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    component_id INT NOT NULL,
    version VARCHAR(20) NOT NULL,
    changelog TEXT,
    file_hash VARCHAR(64),
    is_current BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (component_id) REFERENCES component_registry(id) ON DELETE CASCADE,
    UNIQUE KEY unique_component_version (component_id, version),
    INDEX idx_current (is_current)
);

-- Component Usage - Track where components are used
CREATE TABLE component_usage (
    id INT PRIMARY KEY AUTO_INCREMENT,
    component_id INT NOT NULL,
    used_in_page VARCHAR(255) NOT NULL,
    used_in_section VARCHAR(100),
    usage_context ENUM('embedded', 'modal', 'ajax_load', 'template') DEFAULT 'embedded',
    load_order INT DEFAULT 0,
    is_critical BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (component_id) REFERENCES component_registry(id) ON DELETE CASCADE,
    INDEX idx_page (used_in_page),
    INDEX idx_component (component_id),
    INDEX idx_critical (is_critical)
);

-- Insert initial component registry entries for existing Business Manager components
INSERT INTO component_registry (name, description, category, file_path, dependencies, auto_save_enabled, api_endpoints, css_classes, js_functions) VALUES
('Client Management', 'Complete client management interface with KPIs, data table, and profile modal', 'business', '/admin/components/client-management.html', 
 JSON_ARRAY('bootstrap', 'font-awesome', 'auto-save-input', 'data-table', 'kpi-card'), 
 true, 
 JSON_ARRAY('/api/clients', '/api/clients/{id}', '/api/site-configuration/subscription/analytics'),
 JSON_ARRAY('client-management', 'client-profile-modal', 'client-kpi'),
 JSON_ARRAY('ClientManagement', 'loadClientData', 'editClient', 'autoSaveField')),

('Client Onboarding Wizard', 'Multi-step client onboarding with template selection and subscription setup', 'business', '/admin/components/client-onboarding-wizard.html',
 JSON_ARRAY('bootstrap', 'font-awesome'),
 false,
 JSON_ARRAY('/api/clients', '/api/clients/templates', '/api/site-configuration/subscription/tiers'),
 JSON_ARRAY('onboarding-wizard', 'wizard-step', 'template-card', 'subscription-card'),
 JSON_ARRAY('ClientOnboarding', 'navigateToSection', 'createAccount', 'validateCurrentStep')),

('KPI Dashboard Card', 'Reusable KPI card component with auto-refresh and hover effects', 'dashboard', '/admin/components/kpi-card.html',
 JSON_ARRAY('bootstrap', 'font-awesome'),
 false,
 JSON_ARRAY('/api/analytics/{metric}'),
 JSON_ARRAY('kpi-card', 'metric-card', 'metric-icon', 'metric-value'),
 JSON_ARRAY('KPICard', 'refreshData', 'formatValue')),

('Auto-Save Input', 'Form input component with real-time auto-save functionality', 'forms', '/admin/components/auto-save-input.html',
 JSON_ARRAY('bootstrap'),
 true,
 JSON_ARRAY(),
 JSON_ARRAY('auto-save', 'save-indicator', 'form-control'),
 JSON_ARRAY('autoSaveField', 'showSaveIndicator')),

('Enhanced Data Table', 'Feature-rich data table with search, filter, sorting, and pagination', 'data', '/admin/components/data-table.html',
 JSON_ARRAY('bootstrap', 'font-awesome'),
 false,
 JSON_ARRAY(),
 JSON_ARRAY('data-table-container', 'table-responsive', 'sortable'),
 JSON_ARRAY('DataTable', 'loadData', 'renderTable', 'renderPagination'));

-- Insert component usage tracking for Business Manager
INSERT INTO component_usage (component_id, used_in_page, used_in_section, usage_context, load_order, is_critical) VALUES
((SELECT id FROM component_registry WHERE name = 'Client Management'), 'musenest-business-manager.html', 'clients-list', 'ajax_load', 1, true),
((SELECT id FROM component_registry WHERE name = 'Client Onboarding Wizard'), 'musenest-business-manager.html', 'clients-onboard', 'ajax_load', 1, true),
((SELECT id FROM component_registry WHERE name = 'KPI Dashboard Card'), 'client-management.html', 'client-kpis', 'embedded', 1, false),
((SELECT id FROM component_registry WHERE name = 'Auto-Save Input'), 'client-management.html', 'client-profile-modal', 'embedded', 2, true),
((SELECT id FROM component_registry WHERE name = 'Enhanced Data Table'), 'client-management.html', 'client-list', 'embedded', 3, true);

-- Create initial version entries
INSERT INTO component_versions (component_id, version, changelog, is_current) VALUES
((SELECT id FROM component_registry WHERE name = 'Client Management'), '1.0.0', 'Initial implementation with full client management functionality', true),
((SELECT id FROM component_registry WHERE name = 'Client Onboarding Wizard'), '1.0.0', 'Initial multi-step onboarding wizard with template and subscription selection', true),
((SELECT id FROM component_registry WHERE name = 'KPI Dashboard Card'), '1.0.0', 'Initial KPI card component with auto-refresh capabilities', true),
((SELECT id FROM component_registry WHERE name = 'Auto-Save Input'), '1.0.0', 'Initial auto-save input component with visual indicators', true),
((SELECT id FROM component_registry WHERE name = 'Enhanced Data Table'), '1.0.0', 'Initial data table with full search, filter, and pagination support', true);