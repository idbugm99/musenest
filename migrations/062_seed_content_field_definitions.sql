-- Global content field definitions to drive grouped page content forms
-- Home Page (page_type_id = 1)
INSERT IGNORE INTO content_field_definitions
  (model_id, page_type_id, content_key, label, input_type, help_text, is_required, group_label, section_order, field_order, options_json)
VALUES
  (NULL, 1, 'hero_title', 'Hero Title', 'text', NULL, 0, 'Hero', 1, 1, NULL),
  (NULL, 1, 'hero_subtitle', 'Hero Subtitle', 'text', NULL, 0, 'Hero', 1, 2, NULL),
  (NULL, 1, 'hero_description', 'Hero Description', 'textarea', NULL, 0, 'Hero', 1, 3, NULL),
  (NULL, 1, 'hero_button_1', 'Primary Button Text', 'text', NULL, 0, 'Hero', 1, 4, NULL),
  (NULL, 1, 'hero_button_1_link', 'Primary Button Link', 'select', 'Destination page', 0, 'Hero', 1, 5, '{"options":[{"label":"Calendar","value":"calendar"},{"label":"Contact","value":"contact"},{"label":"Gallery","value":"gallery"},{"label":"Rates","value":"rates"},{"label":"About","value":"about"},{"label":"Etiquette","value":"etiquette"}] }'),
  (NULL, 1, 'hero_button_2', 'Secondary Button Text', 'text', NULL, 0, 'Hero', 1, 6, NULL),
  (NULL, 1, 'hero_button_2_link', 'Secondary Button Link', 'select', 'Destination page', 0, 'Hero', 1, 7, '{"options":[{"label":"Calendar","value":"calendar"},{"label":"Contact","value":"contact"},{"label":"Gallery","value":"gallery"},{"label":"Rates","value":"rates"},{"label":"About","value":"about"},{"label":"Etiquette","value":"etiquette"}] }'),

  (NULL, 1, 'about_title', 'About Section Title', 'text', NULL, 0, 'About', 2, 1, NULL),
  (NULL, 1, 'about_paragraph_1', 'About Paragraph 1', 'textarea', NULL, 0, 'About', 2, 2, NULL),
  (NULL, 1, 'about_paragraph_2', 'About Paragraph 2', 'textarea', NULL, 0, 'About', 2, 3, NULL),
  (NULL, 1, 'about_link_text', 'About Link Text', 'text', NULL, 0, 'About', 2, 4, NULL),
  (NULL, 1, 'about_link_destination', 'About Link Destination', 'select', NULL, 0, 'About', 2, 5, '{"options":[{"label":"About","value":"about"},{"label":"Contact","value":"contact"},{"label":"Gallery","value":"gallery"},{"label":"Rates","value":"rates"},{"label":"Calendar","value":"calendar"}] }'),

  (NULL, 1, 'gallery_section_title', 'Gallery Section Title', 'text', NULL, 0, 'Gallery', 3, 1, NULL),
  (NULL, 1, 'gallery_button_text', 'Gallery Button Text', 'text', NULL, 0, 'Gallery', 3, 2, NULL),

  (NULL, 1, 'testimonials_section_title', 'Testimonials Title', 'text', NULL, 0, 'Testimonials', 4, 1, NULL),

  (NULL, 1, 'cta_section_title', 'CTA Title', 'text', NULL, 0, 'CTA', 5, 1, NULL),
  (NULL, 1, 'cta_section_subtitle', 'CTA Subtitle', 'textarea', NULL, 0, 'CTA', 5, 2, NULL);

-- About Page (page_type_id = 2)
INSERT IGNORE INTO content_field_definitions
  (model_id, page_type_id, content_key, label, input_type, help_text, is_required, group_label, section_order, field_order, options_json)
VALUES
  (NULL, 2, 'page_title', 'Page Title', 'text', NULL, 0, 'Content', 1, 1, NULL),
  (NULL, 2, 'main_paragraph_1', 'Paragraph 1', 'textarea', NULL, 0, 'Content', 1, 2, NULL),
  (NULL, 2, 'main_paragraph_2', 'Paragraph 2', 'textarea', NULL, 0, 'Content', 1, 3, NULL),
  (NULL, 2, 'main_paragraph_3', 'Paragraph 3', 'textarea', NULL, 0, 'Content', 1, 4, NULL),
  (NULL, 2, 'main_paragraph_4', 'Paragraph 4', 'textarea', NULL, 0, 'Content', 1, 5, NULL),
  (NULL, 2, 'services_title', 'Services Title', 'text', NULL, 0, 'Content', 1, 6, NULL),
  (NULL, 2, 'services_list', 'Services List', 'textarea', 'One per line', 0, 'Content', 1, 7, NULL),
  (NULL, 2, 'interests_title', 'Interests Title', 'text', NULL, 0, 'Content', 1, 8, NULL),
  (NULL, 2, 'interests', 'Interests', 'textarea', 'Comma separated', 0, 'Content', 1, 9, NULL),
  (NULL, 2, 'facts_title', 'Quick Facts Title', 'text', NULL, 0, 'Quick Facts', 2, 1, NULL),
  (NULL, 2, 'quick_facts', 'Quick Facts (JSON or simple)', 'textarea', 'Supports JSON or key:value per line', 0, 'Quick Facts', 2, 2, NULL),
  (NULL, 2, 'cta_section_title', 'CTA Title', 'text', NULL, 0, 'CTA', 3, 1, NULL),
  (NULL, 2, 'cta_section_subtitle', 'CTA Subtitle', 'textarea', NULL, 0, 'CTA', 3, 2, NULL);

-- Contact Page (page_type_id = 3)
INSERT IGNORE INTO content_field_definitions
  (model_id, page_type_id, content_key, label, input_type, help_text, is_required, group_label, section_order, field_order, options_json)
VALUES
  (NULL, 3, 'page_title', 'Page Title', 'text', NULL, 0, 'Header', 1, 1, NULL),
  (NULL, 3, 'intro_text', 'Intro Text', 'textarea', NULL, 0, 'Header', 1, 2, NULL),
  (NULL, 3, 'contact_methods', 'Contact Methods', 'textarea', 'Comma or line separated', 0, 'Contact', 2, 1, NULL),
  (NULL, 3, 'booking_policy', 'Booking Policy', 'textarea', NULL, 0, 'Contact', 2, 2, NULL),
  (NULL, 3, 'screening_requirements', 'Screening Requirements', 'textarea', NULL, 0, 'Contact', 2, 3, NULL),
  (NULL, 3, 'location_info', 'Location Info', 'textarea', NULL, 0, 'Contact', 2, 4, NULL);

-- Etiquette Page (page_type_id = 16)
INSERT IGNORE INTO content_field_definitions
  (model_id, page_type_id, content_key, label, input_type, help_text, is_required, group_label, section_order, field_order, options_json)
VALUES
  (NULL, 16, 'page_title', 'Page Title', 'text', NULL, 0, 'Header', 1, 1, NULL),
  (NULL, 16, 'intro_text', 'Intro Text', 'textarea', NULL, 0, 'Header', 1, 2, NULL),
  (NULL, 16, 'guidelines', 'Guidelines', 'textarea', 'One per line', 0, 'Guidelines', 2, 1, NULL),
  (NULL, 16, 'booking_etiquette', 'Booking Etiquette', 'textarea', NULL, 0, 'Guidelines', 2, 2, NULL),
  (NULL, 16, 'meeting_guidelines', 'Meeting Guidelines', 'textarea', NULL, 0, 'Guidelines', 2, 3, NULL),
  (NULL, 16, 'boundaries', 'Boundaries', 'textarea', NULL, 0, 'Guidelines', 2, 4, NULL);

-- Rates Page (page_type_id = 5)
INSERT IGNORE INTO content_field_definitions
  (model_id, page_type_id, content_key, label, input_type, help_text, is_required, group_label, section_order, field_order, options_json)
VALUES
  (NULL, 5, 'page_title', 'Page Title', 'text', NULL, 0, 'Header', 1, 1, NULL),
  (NULL, 5, 'rates_intro', 'Intro Text', 'textarea', NULL, 0, 'Header', 1, 2, NULL),
  (NULL, 5, 'rate_cards', 'Rate Cards (JSON or lines)', 'textarea', 'JSON array or title:price per line', 0, 'Rates', 2, 1, NULL),
  (NULL, 5, 'packages', 'Packages (optional)', 'textarea', 'JSON or lines', 0, 'Rates', 2, 2, NULL),
  (NULL, 5, 'deposit_policy', 'Deposit Policy', 'textarea', NULL, 0, 'Policies', 3, 1, NULL),
  (NULL, 5, 'cancellation_policy', 'Cancellation Policy', 'textarea', NULL, 0, 'Policies', 3, 2, NULL);


