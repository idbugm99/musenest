-- Migration 010: Add Rose Theme Set (for modular architecture)
-- Run date: 2025-08-15

INSERT INTO theme_sets (name, display_name, description, default_color_scheme)
SELECT 'rose', 'Rose', 'Luxurious romantic theme with deep rose palette',
       '{"primary":"#B80F2E","secondary":"#2B0A0E","background":"#FAF7F8","text":"#222222","accent":"#C9A86A","border":"#FFE5EC"}'
WHERE NOT EXISTS (SELECT 1 FROM theme_sets WHERE name = 'rose');
