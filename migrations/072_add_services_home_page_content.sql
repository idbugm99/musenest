-- Add services section fields to model_home_page_content table
-- This enables templates to display customizable services sections on home pages

-- Add services section visibility and title
ALTER TABLE model_home_page_content 
ADD COLUMN services_section_visible BOOLEAN DEFAULT TRUE AFTER travel_cta_link,
ADD COLUMN services_title VARCHAR(255) DEFAULT NULL AFTER services_section_visible;

-- Add individual service fields (3 services supported)
-- Service 1
ALTER TABLE model_home_page_content 
ADD COLUMN service_1_visible BOOLEAN DEFAULT TRUE AFTER services_title,
ADD COLUMN service_1_title VARCHAR(255) DEFAULT NULL AFTER service_1_visible,
ADD COLUMN service_1_description TEXT DEFAULT NULL AFTER service_1_title,
ADD COLUMN service_1_icon VARCHAR(255) DEFAULT 'fas fa-gem' AFTER service_1_description;

-- Service 2
ALTER TABLE model_home_page_content 
ADD COLUMN service_2_visible BOOLEAN DEFAULT TRUE AFTER service_1_icon,
ADD COLUMN service_2_title VARCHAR(255) DEFAULT NULL AFTER service_2_visible,
ADD COLUMN service_2_description TEXT DEFAULT NULL AFTER service_2_title,
ADD COLUMN service_2_icon VARCHAR(255) DEFAULT 'fas fa-star' AFTER service_2_description;

-- Service 3
ALTER TABLE model_home_page_content 
ADD COLUMN service_3_visible BOOLEAN DEFAULT TRUE AFTER service_2_icon,
ADD COLUMN service_3_title VARCHAR(255) DEFAULT NULL AFTER service_3_visible,
ADD COLUMN service_3_description TEXT DEFAULT NULL AFTER service_3_title,
ADD COLUMN service_3_icon VARCHAR(255) DEFAULT 'fas fa-crown' AFTER service_3_description;

-- Services CTA button
ALTER TABLE model_home_page_content 
ADD COLUMN services_cta_text VARCHAR(255) DEFAULT NULL AFTER service_3_icon,
ADD COLUMN services_cta_link VARCHAR(255) DEFAULT 'rates' AFTER services_cta_text;

-- Add sample services data for Model Example (model_id = 39)
UPDATE model_home_page_content 
SET services_section_visible = 1,
    services_title = 'My Services',
    service_1_visible = 1,
    service_1_title = 'Premium Companionship',
    service_1_description = 'Professional escort services with elegance and discretion for discerning clients.',
    service_1_icon = 'fas fa-gem',
    service_2_visible = 1,
    service_2_title = 'Travel Companion',
    service_2_description = 'Sophisticated travel companionship for business trips and leisure getaways.',
    service_2_icon = 'fas fa-plane',
    service_3_visible = 1,
    service_3_title = 'Event Accompaniment',
    service_3_description = 'Professional accompaniment for social events, dinners, and business functions.',
    service_3_icon = 'fas fa-calendar-check',
    services_cta_text = 'View All Services & Rates',
    services_cta_link = 'rates'
WHERE model_id = 39;