-- Migration 071: RoseMastos Contact Page Structure
-- Adds comprehensive contact page content management matching RoseMastos functionality

-- Rename existing table to preserve data (only if it exists)
SET @table_exists = (SELECT COUNT(*) FROM information_schema.tables 
                     WHERE table_schema = 'phoenix4ge' AND table_name = 'model_contact_page_content');
SET @sql = IF(@table_exists > 0, 
              'ALTER TABLE model_contact_page_content RENAME TO model_contact_page_content_legacy', 
              'SELECT "No existing table to rename" AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Create comprehensive contact page content table matching RoseMastos structure
CREATE TABLE model_contact_page_content (
    id INT PRIMARY KEY AUTO_INCREMENT,
    model_id INT NOT NULL,
    
    -- Page Header Section
    page_title VARCHAR(255) DEFAULT 'Contact Me',
    page_subtitle TEXT,
    contact_header_visible BOOLEAN DEFAULT TRUE,
    
    -- Contact Form Section  
    form_title VARCHAR(255) DEFAULT 'Send a Message',
    form_name_label VARCHAR(255) DEFAULT 'Your Name',
    form_email_label VARCHAR(255) DEFAULT 'Email Address',
    form_phone_label VARCHAR(255) DEFAULT 'Phone Number (Optional)',
    form_date_label VARCHAR(255) DEFAULT 'Preferred Date',
    form_duration_label VARCHAR(255) DEFAULT 'Duration',
    form_duration_options TEXT,
    form_message_label VARCHAR(255) DEFAULT 'Message',
    form_message_placeholder TEXT,
    form_button_text VARCHAR(255) DEFAULT 'Send Message',
    contact_form_visible BOOLEAN DEFAULT TRUE,
    
    -- Direct Contact Section
    direct_title VARCHAR(255) DEFAULT 'Direct Contact',
    direct_email_label VARCHAR(255) DEFAULT 'Email',
    direct_phone_label VARCHAR(255) DEFAULT 'Phone', 
    direct_response_label VARCHAR(255) DEFAULT 'Response Time',
    direct_response_text VARCHAR(255) DEFAULT 'Within 2-4 hours',
    contact_direct_visible BOOLEAN DEFAULT TRUE,
    
    -- Booking Guidelines Section
    guidelines_title VARCHAR(255) DEFAULT 'Booking Guidelines',
    guideline_1 VARCHAR(255) DEFAULT 'Include your preferred date and time',
    guideline_2 VARCHAR(255) DEFAULT 'Specify desired duration of our meeting',
    guideline_3 VARCHAR(255) DEFAULT 'Mention if you are a first-time or returning client',
    guideline_4 VARCHAR(255) DEFAULT 'Be prepared for a brief screening process',
    guideline_5 VARCHAR(255) DEFAULT 'Allow 24+ hours for booking confirmation',
    contact_guidelines_visible BOOLEAN DEFAULT TRUE,
    
    -- Location Section
    location_title VARCHAR(255) DEFAULT 'Location',
    location_area_text VARCHAR(255) DEFAULT 'Currently serving the greater area',
    location_services_text VARCHAR(255) DEFAULT 'Incall and outcall services available',
    location_travel_text VARCHAR(255) DEFAULT 'Travel arrangements can be discussed',
    contact_location_visible BOOLEAN DEFAULT TRUE,
    
    -- Privacy Notice Section
    privacy_title VARCHAR(255) DEFAULT 'Privacy & Discretion',
    privacy_text TEXT,
    contact_privacy_visible BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE,
    INDEX idx_model_contact_content (model_id)
);

-- Migrate existing data from legacy table (only if legacy table exists)
INSERT INTO model_contact_page_content (
    model_id,
    page_title,
    page_subtitle,
    form_title,
    direct_title,
    form_duration_options,
    form_message_placeholder,
    privacy_text,
    created_at,
    updated_at
)
SELECT 
    model_id,
    COALESCE(page_title, 'Contact Me'),
    COALESCE(page_subtitle, 'I look forward to hearing from you. Please use the form below or my preferred contact methods.'),
    COALESCE(form_title, 'Send a Message'),
    COALESCE(direct_title, 'Direct Contact'),
    '1 Hour,90 Minutes,2 Hours,3 Hours,Overnight,Extended (please specify)',
    'Please include any specific requests or questions...',
    'All communications are handled with the utmost discretion and confidentiality. Your privacy is my priority, and I expect the same level of respect in return.',
    created_at,
    updated_at
FROM model_contact_page_content_legacy
WHERE EXISTS (SELECT 1 FROM information_schema.tables 
              WHERE table_schema = 'phoenix4ge' AND table_name = 'model_contact_page_content_legacy');

-- Seed default content for Model Example (id=39) - Delete first to avoid duplicates
DELETE FROM model_contact_page_content WHERE model_id = 39;
INSERT INTO model_contact_page_content (
    model_id,
    page_title,
    page_subtitle,
    form_title,
    direct_title,
    guidelines_title,
    guideline_1,
    guideline_2,
    guideline_3,
    guideline_4,
    guideline_5,
    location_title,
    location_area_text,
    location_services_text,
    location_travel_text,
    privacy_title,
    privacy_text,
    form_duration_options,
    form_message_placeholder
) VALUES (
    39,
    'Contact Model Example',
    'I look forward to hearing from you. Please use the form below or reach out through my preferred contact methods.',
    'Send a Message',
    'Direct Contact',
    'Booking Guidelines',
    'Include your preferred date and time in your message',
    'Specify the desired duration of our meeting',
    'Mention if you are a first-time or returning client',
    'Be prepared for a brief screening process for safety',
    'Allow 24+ hours advance notice for booking confirmation',
    'Location & Services',
    'Currently serving the greater metro area',
    'Both incall and outcall appointments available',
    'Travel arrangements can be discussed for extended bookings',
    'Privacy & Discretion',
    'All communications are handled with the utmost discretion and confidentiality. Your privacy is my priority, and I expect the same level of respect and professionalism in return.',
    '1 Hour,90 Minutes,2 Hours,3 Hours,Overnight,Extended (please specify)',
    'Please include any specific requests or questions...'
);