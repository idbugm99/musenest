-- Model Gallery core tables (idempotent)

-- gallery_sections
CREATE TABLE IF NOT EXISTS gallery_sections (
  id INT AUTO_INCREMENT PRIMARY KEY,
  model_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  layout_type ENUM('grid','masonry','carousel','lightbox_grid') NOT NULL DEFAULT 'grid',
  grid_columns TINYINT NOT NULL DEFAULT 3,
  enable_filters TINYINT(1) NOT NULL DEFAULT 0,
  enable_lightbox TINYINT(1) NOT NULL DEFAULT 1,
  enable_fullscreen TINYINT(1) NOT NULL DEFAULT 0,
  default_filter VARCHAR(100) DEFAULT NULL,
  is_visible TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- gallery_images
CREATE TABLE IF NOT EXISTS gallery_images (
  id INT AUTO_INCREMENT PRIMARY KEY,
  section_id INT NOT NULL,
  model_id INT NOT NULL,
  filename VARCHAR(1024) NOT NULL,
  caption VARCHAR(1024) DEFAULT NULL,
  tags VARCHAR(1024) DEFAULT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_gallery_images_section FOREIGN KEY (section_id) REFERENCES gallery_sections(id) ON DELETE CASCADE,
  INDEX idx_gallery_images_section_active_order (section_id, is_active, order_index),
  INDEX idx_gallery_images_model (model_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Indexes for sections (if not created by engine defaults)
-- Note: MySQL 8+ INFORMATION_SCHEMA checks for idempotency
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'gallery_sections' AND INDEX_NAME = 'idx_gallery_sections_model_visible_sort'
  ) THEN
    ALTER TABLE gallery_sections
      ADD INDEX idx_gallery_sections_model_visible_sort (model_id, is_visible, sort_order);
  END IF;
END$$;


