-- MuseNest Admin Reconstruction: Dedicated Page Content Tables
-- This migration replaces the generic content system with dedicated page content tables
-- similar to RoseMastos's proven architecture

-- Model Home Page Content
CREATE TABLE IF NOT EXISTS model_home_page_content (
    id INT AUTO_INCREMENT PRIMARY KEY,
    model_id INT NOT NULL,
    
    -- Hero Section
    hero_section_visible BOOLEAN NOT NULL DEFAULT TRUE,
    hero_title VARCHAR(255) NULL,
    hero_subtitle TEXT NULL,
    hero_background_image_id INT NULL,
    hero_background_opacity DECIMAL(3,2) DEFAULT 0.6,
    hero_button_1_text VARCHAR(100) NULL,
    hero_button_1_link VARCHAR(100) NULL,
    hero_button_2_text VARCHAR(100) NULL,
    hero_button_2_link VARCHAR(100) NULL,
    
    -- About Section
    about_section_visible BOOLEAN NOT NULL DEFAULT TRUE,
    about_title VARCHAR(255) NULL,
    about_paragraph_1 TEXT NULL,
    about_paragraph_2 TEXT NULL,
    about_link_text VARCHAR(100) NULL,
    about_link_destination VARCHAR(50) NULL,
    portrait_image_id INT NULL,
    portrait_alt VARCHAR(255) NULL,
    portrait_section_visible BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Gallery Section
    gallery_section_visible BOOLEAN NOT NULL DEFAULT TRUE,
    featured_gallery_section_id INT NULL,
    gallery_section_title VARCHAR(255) NULL,
    gallery_button_text VARCHAR(100) NULL,
    gallery_button_link VARCHAR(100) NULL,
    
    -- Testimonials Section
    testimonials_section_visible BOOLEAN NOT NULL DEFAULT TRUE,
    testimonials_section_title VARCHAR(255) NULL,
    testimonials_display_count INT DEFAULT 3,
    
    -- CTA Section
    cta_section_visible BOOLEAN NOT NULL DEFAULT TRUE,
    cta_section_title VARCHAR(255) NULL,
    cta_section_subtitle TEXT NULL,
    cta_button_1_text VARCHAR(100) NULL,
    cta_button_1_link VARCHAR(100) NULL,
    cta_button_2_text VARCHAR(100) NULL,
    cta_button_2_link VARCHAR(100) NULL,
    
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_model_home_content (model_id),
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE,
    FOREIGN KEY (hero_background_image_id) REFERENCES gallery_images(id) ON DELETE SET NULL,
    FOREIGN KEY (portrait_image_id) REFERENCES gallery_images(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Model About Page Content
CREATE TABLE IF NOT EXISTS model_about_page_content (
    id INT AUTO_INCREMENT PRIMARY KEY,
    model_id INT NOT NULL,
    
    -- Page Header
    page_title VARCHAR(255) NULL,
    page_subtitle TEXT NULL,
    page_title_visible BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Main Content
    main_content_visible BOOLEAN NOT NULL DEFAULT TRUE,
    main_paragraph_1 TEXT NULL,
    main_paragraph_2 TEXT NULL,
    main_paragraph_3 TEXT NULL,
    main_paragraph_4 TEXT NULL,
    
    -- Portrait Section
    portrait_visible BOOLEAN NOT NULL DEFAULT TRUE,
    portrait_image_id INT NULL,
    portrait_alt VARCHAR(255) NULL,
    
    -- Services Section
    services_visible BOOLEAN NOT NULL DEFAULT TRUE,
    services_title VARCHAR(255) NULL,
    service_1 VARCHAR(500) NULL,
    service_2 VARCHAR(500) NULL,
    service_3 VARCHAR(500) NULL,
    service_4 VARCHAR(500) NULL,
    service_5 VARCHAR(500) NULL,
    
    -- Interests Section
    interests_visible BOOLEAN NOT NULL DEFAULT TRUE,
    interests_title VARCHAR(255) NULL,
    interests TEXT NULL,
    
    -- Facts Section
    facts_visible BOOLEAN NOT NULL DEFAULT TRUE,
    facts_title VARCHAR(255) NULL,
    fact_age VARCHAR(100) NULL,
    fact_age_visible BOOLEAN NOT NULL DEFAULT TRUE,
    fact_height VARCHAR(100) NULL,
    fact_height_visible BOOLEAN NOT NULL DEFAULT TRUE,
    fact_languages VARCHAR(200) NULL,
    fact_languages_visible BOOLEAN NOT NULL DEFAULT TRUE,
    fact_education VARCHAR(200) NULL,
    fact_education_visible BOOLEAN NOT NULL DEFAULT TRUE,
    fact_availability VARCHAR(200) NULL,
    fact_availability_visible BOOLEAN NOT NULL DEFAULT TRUE,
    custom_facts TEXT NULL,
    custom_facts_visible BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Gallery Section
    gallery_visible BOOLEAN NOT NULL DEFAULT TRUE,
    gallery_section_id INT NULL,
    gallery_title VARCHAR(255) NULL,
    
    -- CTA Section
    about_cta_visible BOOLEAN NOT NULL DEFAULT TRUE,
    cta_title VARCHAR(255) NULL,
    cta_description TEXT NULL,
    cta_button_1_text VARCHAR(100) NULL,
    cta_button_1_link VARCHAR(100) NULL,
    cta_button_2_text VARCHAR(100) NULL,
    cta_button_2_link VARCHAR(100) NULL,
    
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_model_about_content (model_id),
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE,
    FOREIGN KEY (portrait_image_id) REFERENCES gallery_images(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Model Contact Page Content
CREATE TABLE IF NOT EXISTS model_contact_page_content (
    id INT AUTO_INCREMENT PRIMARY KEY,
    model_id INT NOT NULL,
    
    -- Page Header
    page_title VARCHAR(255) NULL,
    page_subtitle TEXT NULL,
    page_subtext TEXT NULL,
    contact_header_visible BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Contact Form Section
    contact_form_visible BOOLEAN NOT NULL DEFAULT TRUE,
    form_title VARCHAR(255) NULL,
    form_name_label VARCHAR(100) NULL,
    form_email_label VARCHAR(100) NULL,
    form_phone_label VARCHAR(100) NULL,
    form_date_label VARCHAR(100) NULL,
    form_duration_label VARCHAR(100) NULL,
    form_duration_options TEXT NULL,
    form_message_label VARCHAR(100) NULL,
    form_message_placeholder TEXT NULL,
    form_button_text VARCHAR(100) NULL,
    form_destination_email VARCHAR(200) NULL,
    
    -- Direct Contact Section
    contact_direct_visible BOOLEAN NOT NULL DEFAULT TRUE,
    direct_title VARCHAR(255) NULL,
    direct_email_label VARCHAR(100) NULL,
    direct_phone_label VARCHAR(100) NULL,
    direct_response_label VARCHAR(100) NULL,
    direct_response_text VARCHAR(200) NULL,
    
    -- Guidelines Section
    contact_guidelines_visible BOOLEAN NOT NULL DEFAULT TRUE,
    guidelines_title VARCHAR(255) NULL,
    guideline_1 VARCHAR(200) NULL,
    guideline_2 VARCHAR(200) NULL,
    guideline_3 VARCHAR(200) NULL,
    guideline_4 VARCHAR(200) NULL,
    guideline_5 VARCHAR(200) NULL,
    
    -- Location Section
    contact_location_visible BOOLEAN NOT NULL DEFAULT TRUE,
    location_title VARCHAR(255) NULL,
    location_area_text VARCHAR(200) NULL,
    location_services_text VARCHAR(200) NULL,
    location_travel_text VARCHAR(200) NULL,
    
    -- Privacy Section
    contact_privacy_visible BOOLEAN NOT NULL DEFAULT TRUE,
    privacy_title VARCHAR(255) NULL,
    privacy_text TEXT NULL,
    
    -- Gallery Section
    gallery_visible BOOLEAN NOT NULL DEFAULT FALSE,
    gallery_section_id INT NULL,
    gallery_title VARCHAR(255) NULL,
    
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_model_contact_content (model_id),
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Model Rates Page Content
CREATE TABLE IF NOT EXISTS model_rates_page_content (
    id INT AUTO_INCREMENT PRIMARY KEY,
    model_id INT NOT NULL,
    
    -- Page Header
    page_title VARCHAR(255) NULL,
    page_subtitle TEXT NULL,
    rates_header_visible BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Rates Table Section
    rates_table_visible BOOLEAN NOT NULL DEFAULT TRUE,
    table_title VARCHAR(255) NULL,
    table_description TEXT NULL,
    show_service_name_column BOOLEAN NOT NULL DEFAULT TRUE,
    show_duration_column BOOLEAN NOT NULL DEFAULT TRUE,
    show_price_column BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Incall Section
    rates_incall_visible BOOLEAN NOT NULL DEFAULT TRUE,
    incall_show_service_name BOOLEAN NOT NULL DEFAULT TRUE,
    incall_show_duration BOOLEAN NOT NULL DEFAULT TRUE,
    incall_show_price BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Outcall Section
    rates_outcall_visible BOOLEAN NOT NULL DEFAULT TRUE,
    outcall_show_service_name BOOLEAN NOT NULL DEFAULT TRUE,
    outcall_show_duration BOOLEAN NOT NULL DEFAULT TRUE,
    outcall_show_price BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Extended Section
    rates_extended_visible BOOLEAN NOT NULL DEFAULT TRUE,
    extended_show_service_name BOOLEAN NOT NULL DEFAULT TRUE,
    extended_show_duration BOOLEAN NOT NULL DEFAULT TRUE,
    extended_show_price BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Donations Section
    donations_visible BOOLEAN NOT NULL DEFAULT TRUE,
    donation_title VARCHAR(255) NULL,
    donation_description TEXT NULL,
    
    -- Payment Section
    rates_payment_visible BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Additional Services Section
    rates_additional_visible BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Terms Section
    terms_visible BOOLEAN NOT NULL DEFAULT TRUE,
    terms_title VARCHAR(255) NULL,
    terms_content TEXT NULL,
    
    -- CTA Section
    cta_visible BOOLEAN NOT NULL DEFAULT TRUE,
    cta_title VARCHAR(255) NULL,
    cta_description TEXT NULL,
    cta_button_1_text VARCHAR(100) NULL,
    cta_button_1_link VARCHAR(100) NULL,
    cta_button_2_text VARCHAR(100) NULL,
    cta_button_2_link VARCHAR(100) NULL,
    
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_model_rates_content (model_id),
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Model Gallery Page Content
CREATE TABLE IF NOT EXISTS model_gallery_page_content (
    id INT AUTO_INCREMENT PRIMARY KEY,
    model_id INT NOT NULL,
    
    -- Page Header
    page_title VARCHAR(255) NULL,
    page_subtitle TEXT NULL,
    page_description TEXT NULL,
    gallery_header_visible BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Gallery Settings
    default_layout VARCHAR(50) DEFAULT 'masonry',
    enable_filters BOOLEAN NOT NULL DEFAULT TRUE,
    enable_lightbox BOOLEAN NOT NULL DEFAULT TRUE,
    enable_fullscreen BOOLEAN NOT NULL DEFAULT TRUE,
    show_captions BOOLEAN NOT NULL DEFAULT TRUE,
    images_per_page INT DEFAULT 20,
    
    -- Navigation
    show_categories BOOLEAN NOT NULL DEFAULT TRUE,
    show_search BOOLEAN NOT NULL DEFAULT FALSE,
    show_sort_options BOOLEAN NOT NULL DEFAULT FALSE,
    
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_model_gallery_content (model_id),
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Model Etiquette Page Content  
CREATE TABLE IF NOT EXISTS model_etiquette_page_content (
    id INT AUTO_INCREMENT PRIMARY KEY,
    model_id INT NOT NULL,
    
    -- Page Header
    page_title VARCHAR(255) NULL,
    page_subtitle TEXT NULL,
    page_subtext TEXT NULL,
    etiquette_header_visible BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Custom Sections (Flexible like RoseMastos)
    section_1_title TEXT NULL,
    section_1_body TEXT NULL,
    section_1_visible BOOLEAN NOT NULL DEFAULT TRUE,
    
    section_2_title TEXT NULL,
    section_2_body TEXT NULL,
    section_2_visible BOOLEAN NOT NULL DEFAULT TRUE,
    
    section_3_title TEXT NULL,
    section_3_body TEXT NULL,
    section_3_visible BOOLEAN NOT NULL DEFAULT TRUE,
    
    section_4_title TEXT NULL,
    section_4_body TEXT NULL,
    section_4_visible BOOLEAN NOT NULL DEFAULT FALSE,
    
    section_5_title TEXT NULL,
    section_5_body TEXT NULL,
    section_5_visible BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Gallery Section
    gallery_visible BOOLEAN NOT NULL DEFAULT FALSE,
    gallery_section_id INT NULL,
    gallery_title VARCHAR(255) NULL,
    
    -- CTA Section
    cta_visible BOOLEAN NOT NULL DEFAULT TRUE,
    cta_title TEXT NULL,
    cta_body TEXT NULL,
    cta_button_text VARCHAR(100) NULL,
    cta_button_link VARCHAR(100) NULL,
    
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_model_etiquette_content (model_id),
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create default content for existing models
INSERT INTO model_home_page_content (model_id, hero_title, hero_subtitle, about_title, gallery_section_title, testimonials_section_title, cta_section_title)
SELECT 
    id,
    'Welcome' as hero_title,
    'Elegance & Sophistication' as hero_subtitle,
    'About Me' as about_title,
    'Gallery' as gallery_section_title,
    'What Clients Say' as testimonials_section_title,
    'Ready to Meet?' as cta_section_title
FROM models 
WHERE NOT EXISTS (SELECT 1 FROM model_home_page_content WHERE model_id = models.id);

INSERT INTO model_about_page_content (model_id, page_title, services_title, interests_title, facts_title, cta_title)
SELECT 
    id,
    'About Me' as page_title,
    'My Services' as services_title,
    'My Interests' as interests_title,
    'At a Glance' as facts_title,
    'Let''s Connect' as cta_title
FROM models 
WHERE NOT EXISTS (SELECT 1 FROM model_about_page_content WHERE model_id = models.id);

INSERT INTO model_contact_page_content (model_id, page_title, form_title, direct_title, guidelines_title, location_title, privacy_title)
SELECT 
    id,
    'Contact Me' as page_title,
    'Send a Message' as form_title,
    'Direct Contact' as direct_title,
    'Contact Guidelines' as guidelines_title,
    'Location & Services' as location_title,
    'Privacy & Discretion' as privacy_title
FROM models 
WHERE NOT EXISTS (SELECT 1 FROM model_contact_page_content WHERE model_id = models.id);

INSERT INTO model_rates_page_content (model_id, page_title, table_title, donation_title, terms_title, cta_title)
SELECT 
    id,
    'Rates & Services' as page_title,
    'Service Options' as table_title,
    'Investment' as donation_title,
    'Terms & Conditions' as terms_title,
    'Book Your Experience' as cta_title
FROM models 
WHERE NOT EXISTS (SELECT 1 FROM model_rates_page_content WHERE model_id = models.id);

INSERT INTO model_gallery_page_content (model_id, page_title)
SELECT 
    id,
    'Gallery' as page_title
FROM models 
WHERE NOT EXISTS (SELECT 1 FROM model_gallery_page_content WHERE model_id = models.id);

INSERT INTO model_etiquette_page_content (model_id, page_title, section_1_title, section_2_title, section_3_title, cta_title)
SELECT 
    id,
    'Etiquette & Guidelines' as page_title,
    'Booking Process' as section_1_title,
    'Mutual Respect' as section_2_title,
    'Preparation & Hygiene' as section_3_title,
    'Questions?' as cta_title
FROM models 
WHERE NOT EXISTS (SELECT 1 FROM model_etiquette_page_content WHERE model_id = models.id);