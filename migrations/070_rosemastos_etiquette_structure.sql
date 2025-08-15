-- Migration: RoseMastos-style Etiquette Content Structure
-- Create comprehensive etiquette content tables matching RoseMastos functionality

-- Main etiquette page content (replaces etiquette_page_header)
DROP TABLE IF EXISTS model_etiquette_page_content;
CREATE TABLE model_etiquette_page_content (
    id INT AUTO_INCREMENT PRIMARY KEY,
    model_id INT NOT NULL,
    
    -- Page header
    page_title VARCHAR(255) DEFAULT 'Etiquette & Guidelines',
    page_subtitle TEXT,
    etiquette_header_visible BOOLEAN DEFAULT TRUE,
    
    -- Booking & Screening section
    etiquette_booking_visible BOOLEAN DEFAULT TRUE,
    booking_title VARCHAR(255) DEFAULT 'Booking & Screening',
    booking_initial_contact_title VARCHAR(255) DEFAULT 'Initial Contact',
    booking_initial_contact_text TEXT,
    booking_screening_title VARCHAR(255) DEFAULT 'Screening Process',
    booking_screening_text TEXT,
    booking_advance_title VARCHAR(255) DEFAULT 'Advance Booking',
    booking_advance_text TEXT,
    
    -- Respect & Boundaries section
    etiquette_respect_visible BOOLEAN DEFAULT TRUE,
    respect_title VARCHAR(255) DEFAULT 'Respect & Boundaries',
    respect_mutual_title VARCHAR(255) DEFAULT 'Mutual Respect',
    respect_mutual_text TEXT,
    respect_boundaries_title VARCHAR(255) DEFAULT 'Professional Boundaries',
    respect_boundaries_text TEXT,
    respect_personal_title VARCHAR(255) DEFAULT 'Personal Information',
    respect_personal_text TEXT,
    
    -- Hygiene & Presentation section
    etiquette_hygiene_visible BOOLEAN DEFAULT TRUE,
    hygiene_title VARCHAR(255) DEFAULT 'Hygiene & Presentation',
    hygiene_personal_title VARCHAR(255) DEFAULT 'Personal Hygiene',
    hygiene_personal_text TEXT,
    hygiene_attire_title VARCHAR(255) DEFAULT 'Attire',
    hygiene_attire_text TEXT,
    hygiene_substances_title VARCHAR(255) DEFAULT 'Substances',
    hygiene_substances_text TEXT,
    
    -- Cancellation Policy section
    etiquette_cancellation_visible BOOLEAN DEFAULT TRUE,
    cancellation_title VARCHAR(255) DEFAULT 'Cancellation Policy',
    cancellation_advance_title VARCHAR(255) DEFAULT 'Advance Notice',
    cancellation_advance_text TEXT,
    cancellation_noshow_title VARCHAR(255) DEFAULT 'No-Shows',
    cancellation_noshow_text TEXT,
    cancellation_my_title VARCHAR(255) DEFAULT 'My Cancellations',
    cancellation_my_text TEXT,
    
    -- Safety & Discretion section (full width)
    etiquette_safety_visible BOOLEAN DEFAULT TRUE,
    safety_title VARCHAR(255) DEFAULT 'Safety & Discretion',
    safety_confidentiality_title VARCHAR(255) DEFAULT 'Confidentiality',
    safety_confidentiality_text TEXT,
    safety_environment_title VARCHAR(255) DEFAULT 'Safe Environment',
    safety_environment_text TEXT,
    safety_communication_title VARCHAR(255) DEFAULT 'Professional Communication',
    safety_communication_text TEXT,
    
    -- Questions/Contact CTA section
    etiquette_questions_visible BOOLEAN DEFAULT TRUE,
    questions_title VARCHAR(255) DEFAULT 'Questions?',
    questions_text TEXT,
    questions_button_text VARCHAR(255) DEFAULT 'Contact Me',
    questions_button_link VARCHAR(255) DEFAULT 'contact',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE,
    UNIQUE KEY unique_model_etiquette (model_id)
);

-- Seed default content for existing models
INSERT IGNORE INTO model_etiquette_page_content (model_id)
SELECT id FROM models WHERE slug IN ('modelexample', 'camgirl', 'escortmodel');

-- Keep existing generic tables for backward compatibility but rename them
RENAME TABLE etiquette_page_header TO etiquette_page_header_legacy;
RENAME TABLE etiquette_sections TO etiquette_sections_legacy;
RENAME TABLE etiquette_items TO etiquette_items_legacy;  
RENAME TABLE etiquette_ctas TO etiquette_ctas_legacy;