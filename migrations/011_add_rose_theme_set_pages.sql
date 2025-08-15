-- Migration 011: Add Rose theme set page mappings
-- Run date: 2025-08-15

-- Insert standard core page mappings for Rose (home, about, gallery, rates, calendar, contact)
INSERT INTO theme_set_pages (theme_set_id, page_type_id, template_file, has_custom_layout, features)
SELECT ts.id, pt.id, CONCAT('rose/', pt.name, '.html'), TRUE, '{"animations":"soft"}'
FROM theme_sets ts
JOIN page_types pt ON pt.name IN ('home','about','gallery','rates','calendar','contact')
WHERE ts.name = 'rose'
  AND NOT EXISTS (
      SELECT 1 FROM theme_set_pages tsp
      WHERE tsp.theme_set_id = ts.id AND tsp.page_type_id = pt.id
  );
