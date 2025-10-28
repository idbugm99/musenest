-- phoenix4ge Database Migration 002
-- Gallery and Media Management System
-- Run date: 2025-07-24

-- ===================================
-- GALLERY SYSTEM
-- ===================================

-- Gallery sections
CREATE TABLE gallery_sections (
    id INT PRIMARY KEY AUTO_INCREMENT,
    model_id INT NOT NULL,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    layout_type ENUM('grid', 'masonry', 'carousel', 'slideshow') DEFAULT 'grid',
    grid_columns INT DEFAULT 3,
    is_visible BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE,
    INDEX idx_model_id (model_id)
);

-- Gallery section settings (normalized from JSON)
CREATE TABLE gallery_section_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    section_id INT NOT NULL,
    setting_key VARCHAR(100) NOT NULL,
    setting_value VARCHAR(255),
    
    FOREIGN KEY (section_id) REFERENCES gallery_sections(id) ON DELETE CASCADE,
    UNIQUE KEY unique_section_setting (section_id, setting_key)
);

-- Gallery images
CREATE TABLE gallery_images (
    id INT PRIMARY KEY AUTO_INCREMENT,
    model_id INT NOT NULL,
    section_id INT NOT NULL,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255),
    caption VARCHAR(255),
    alt_text VARCHAR(255),
    file_size INT,
    width INT,
    height INT,
    mime_type VARCHAR(50),
    is_featured BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE,
    FOREIGN KEY (section_id) REFERENCES gallery_sections(id) ON DELETE CASCADE,
    INDEX idx_model_section (model_id, section_id),
    INDEX idx_active (is_active)
);

-- Image tags (normalized - no comma-separated strings)
CREATE TABLE image_tags (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) UNIQUE NOT NULL,
    slug VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Image-tag relationships
CREATE TABLE image_tag_assignments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    image_id INT NOT NULL,
    tag_id INT NOT NULL,
    
    FOREIGN KEY (image_id) REFERENCES gallery_images(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES image_tags(id) ON DELETE CASCADE,
    UNIQUE KEY unique_image_tag (image_id, tag_id)
);