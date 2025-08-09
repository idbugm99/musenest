-- Seed visibility/switch fields to mirror RoseMastos section toggles
-- Home (1)
INSERT IGNORE INTO content_field_definitions
  (model_id, page_type_id, content_key, label, input_type, help_text, is_required, group_label, section_order, field_order, options_json)
VALUES
  (NULL, 1, 'hero_section_visible', 'Hero Visible', 'boolean', 'Show/Hide hero section', 0, 'Hero', 1, 0, NULL),
  (NULL, 1, 'about_section_visible', 'About Preview Visible', 'boolean', NULL, 0, 'About', 2, 0, NULL),
  (NULL, 1, 'portrait_section_visible', 'Portrait Visible', 'boolean', NULL, 0, 'About', 2, 0, NULL),
  (NULL, 1, 'gallery_section_visible', 'Gallery Preview Visible', 'boolean', NULL, 0, 'Gallery', 3, 0, NULL),
  (NULL, 1, 'testimonials_section_visible', 'Testimonials Visible', 'boolean', NULL, 0, 'Testimonials', 4, 0, NULL),
  (NULL, 1, 'cta_section_visible', 'CTA Visible', 'boolean', NULL, 0, 'CTA', 5, 0, NULL);

-- About (2)
INSERT IGNORE INTO content_field_definitions
  (model_id, page_type_id, content_key, label, input_type, help_text, is_required, group_label, section_order, field_order, options_json)
VALUES
  (NULL, 2, 'page_title_visible', 'Title Visible', 'boolean', NULL, 0, 'Content', 1, 0, NULL),
  (NULL, 2, 'main_content_visible', 'Main Content Visible', 'boolean', NULL, 0, 'Content', 1, 0, NULL),
  (NULL, 2, 'services_visible', 'Services Visible', 'boolean', NULL, 0, 'Content', 1, 0, NULL),
  (NULL, 2, 'interests_visible', 'Interests Visible', 'boolean', NULL, 0, 'Content', 1, 0, NULL),
  (NULL, 2, 'portrait_visible', 'Portrait Visible', 'boolean', NULL, 0, 'Content', 1, 0, NULL),
  (NULL, 2, 'custom_facts_visible', 'Quick Facts Visible', 'boolean', NULL, 0, 'Quick Facts', 2, 0, NULL),
  (NULL, 2, 'about_cta_visible', 'CTA Visible', 'boolean', NULL, 0, 'CTA', 3, 0, NULL);

-- Contact (3)
INSERT IGNORE INTO content_field_definitions
  (model_id, page_type_id, content_key, label, input_type, help_text, is_required, group_label, section_order, field_order, options_json)
VALUES
  (NULL, 3, 'contact_header_visible', 'Header Visible', 'boolean', NULL, 0, 'Header', 1, 0, NULL),
  (NULL, 3, 'contact_form_visible', 'Form Visible', 'boolean', NULL, 0, 'Contact', 2, 0, NULL),
  (NULL, 3, 'contact_direct_visible', 'Direct Contact Visible', 'boolean', NULL, 0, 'Contact', 2, 0, NULL),
  (NULL, 3, 'contact_guidelines_visible', 'Guidelines Visible', 'boolean', NULL, 0, 'Contact', 2, 0, NULL),
  (NULL, 3, 'contact_location_visible', 'Location Visible', 'boolean', NULL, 0, 'Contact', 2, 0, NULL),
  (NULL, 3, 'contact_privacy_visible', 'Privacy Visible', 'boolean', NULL, 0, 'Contact', 2, 0, NULL);

-- Etiquette (16)
INSERT IGNORE INTO content_field_definitions
  (model_id, page_type_id, content_key, label, input_type, help_text, is_required, group_label, section_order, field_order, options_json)
VALUES
  (NULL, 16, 'etiquette_header_visible', 'Header Visible', 'boolean', NULL, 0, 'Header', 1, 0, NULL),
  (NULL, 16, 'etiquette_booking_visible', 'Booking Visible', 'boolean', NULL, 0, 'Booking & Screening', 2, 0, NULL),
  (NULL, 16, 'etiquette_respect_visible', 'Respect Visible', 'boolean', NULL, 0, 'Respect & Boundaries', 3, 0, NULL),
  (NULL, 16, 'etiquette_hygiene_visible', 'Hygiene Visible', 'boolean', NULL, 0, 'Hygiene & Presentation', 4, 0, NULL),
  (NULL, 16, 'etiquette_cancellation_visible', 'Cancellation Visible', 'boolean', NULL, 0, 'Cancellation Policy', 5, 0, NULL),
  (NULL, 16, 'etiquette_safety_visible', 'Safety Visible', 'boolean', NULL, 0, 'Safety & Discretion', 6, 0, NULL),
  (NULL, 16, 'etiquette_questions_visible', 'Questions Visible', 'boolean', NULL, 0, 'Questions', 7, 0, NULL);

-- Rates (5)
INSERT IGNORE INTO content_field_definitions
  (model_id, page_type_id, content_key, label, input_type, help_text, is_required, group_label, section_order, field_order, options_json)
VALUES
  (NULL, 5, 'rates_header_visible', 'Header Visible', 'boolean', NULL, 0, 'Header', 1, 0, NULL),
  (NULL, 5, 'rates_table_visible', 'Rates Table Visible', 'boolean', NULL, 0, 'Rates', 2, 0, NULL),
  (NULL, 5, 'donations_visible', 'Donations Visible', 'boolean', NULL, 0, 'Donations', 3, 0, NULL),
  (NULL, 5, 'terms_visible', 'Terms Visible', 'boolean', NULL, 0, 'Terms', 4, 0, NULL),
  (NULL, 5, 'cta_visible', 'CTA Visible', 'boolean', NULL, 0, 'CTA', 5, 0, NULL);


