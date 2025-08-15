-- Migration 009: Add Rose Theme
-- Run date: 2025-08-15

-- Insert Rose theme record (if not exists)
INSERT INTO themes (name, display_name, description)
SELECT 'rose', 'Rose', 'Luxurious romantic theme with deep rose palette'
WHERE NOT EXISTS (SELECT 1 FROM themes WHERE name = 'rose');

-- Insert default Rose theme colors
INSERT INTO theme_colors (theme_id, color_type, color_value)
SELECT t.id, c.color_type, c.color_value
FROM themes t
CROSS JOIN (
    SELECT 'primary' AS color_type, '#B80F2E' AS color_value UNION ALL
    SELECT 'secondary', '#2B0A0E' UNION ALL
    SELECT 'background', '#FAF7F8' UNION ALL
    SELECT 'text', '#222222' UNION ALL
    SELECT 'accent', '#C9A86A' UNION ALL
    SELECT 'border', '#FFE5EC'
) c
WHERE t.name = 'rose'
  AND NOT EXISTS (
      SELECT 1 FROM theme_colors tc
      WHERE tc.theme_id = t.id AND tc.color_type = c.color_type
  );
