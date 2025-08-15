-- MuseNest Calendar Page Content Structure
-- Migration: 072_calendar_page_content_structure.sql
-- Creates the model_calendar_page_content table for database-driven calendar page content

-- Create the calendar page content table
CREATE TABLE IF NOT EXISTS model_calendar_page_content (
    id INT AUTO_INCREMENT PRIMARY KEY,
    model_id INT NOT NULL,
    
    -- Page Structure Fields
    page_title VARCHAR(255) NULL DEFAULT 'My Calendar',
    page_subtitle TEXT NULL,
    
    -- Calendar Display Settings
    calendar_header_visible TINYINT(1) NOT NULL DEFAULT 1,
    calendar_grid_visible TINYINT(1) NOT NULL DEFAULT 1,
    calendar_legend_visible TINYINT(1) NOT NULL DEFAULT 1,
    calendar_navigation_visible TINYINT(1) NOT NULL DEFAULT 1,
    
    -- Mobile View Settings
    mobile_list_view_enabled TINYINT(1) NOT NULL DEFAULT 1,
    mobile_month_view_enabled TINYINT(1) NOT NULL DEFAULT 1,
    default_mobile_view ENUM('list', 'month') NOT NULL DEFAULT 'list',
    
    -- Legend Customization
    legend_available_label VARCHAR(50) NULL DEFAULT 'Available',
    legend_travel_label VARCHAR(50) NULL DEFAULT 'Travel',
    legend_vacation_label VARCHAR(50) NULL DEFAULT 'Vacation', 
    legend_unavailable_label VARCHAR(50) NULL DEFAULT 'Unavailable',
    
    -- Call-to-Action Section
    cta_visible TINYINT(1) NOT NULL DEFAULT 1,
    cta_title VARCHAR(255) NULL DEFAULT 'Ready for an Exclusive Experience?',
    cta_text TEXT NULL,
    cta_button_text VARCHAR(100) NULL DEFAULT 'Contact Me',
    cta_button_link VARCHAR(255) NULL DEFAULT '/contact',
    
    -- Navigation Settings
    nav_previous_text VARCHAR(50) NULL DEFAULT 'Previous',
    nav_next_text VARCHAR(50) NULL DEFAULT 'Next',
    
    -- Error Message Customization
    error_title VARCHAR(255) NULL DEFAULT 'Calendar Unavailable',
    error_message TEXT NULL,
    loading_message VARCHAR(255) NULL DEFAULT 'Loading calendar...',
    
    -- Footer Information
    footer_visible TINYINT(1) NOT NULL DEFAULT 0,
    footer_title VARCHAR(255) NULL,
    footer_description TEXT NULL,
    footer_note TEXT NULL,
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes and Constraints
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE,
    UNIQUE KEY unique_model_calendar_content (model_id)
);

-- Insert default content for existing models
INSERT INTO model_calendar_page_content (model_id, page_title, page_subtitle, cta_title, cta_text, cta_button_text)
SELECT 
    id,
    'My Calendar' as page_title,
    'View my current location and availability. Check where I''m traveling and when I''m available for exclusive appointments.' as page_subtitle,
    'Ready for an Exclusive Experience?' as cta_title,
    'Contact me to schedule an exclusive appointment when I''m in your area.' as cta_text,
    'Contact Me' as cta_button_text
FROM models 
WHERE status = 'active'
ON DUPLICATE KEY UPDATE
    page_title = VALUES(page_title),
    page_subtitle = VALUES(page_subtitle),
    cta_title = VALUES(cta_title),
    cta_text = VALUES(cta_text),
    cta_button_text = VALUES(cta_button_text);

-- Grant permissions (if needed)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON musenest.model_calendar_page_content TO 'your_user'@'localhost';