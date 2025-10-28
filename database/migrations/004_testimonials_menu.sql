-- phoenix4ge Database Migration 004
-- Testimonials and Menu System
-- Run date: 2025-07-24

-- ===================================
-- TESTIMONIALS
-- ===================================

CREATE TABLE testimonials (
    id INT PRIMARY KEY AUTO_INCREMENT,
    model_id INT NOT NULL,
    client_name VARCHAR(100),
    client_initial VARCHAR(10), -- for privacy
    testimonial_text TEXT NOT NULL,
    rating INT CHECK (rating >= 1 AND rating <= 5),
    is_featured BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE,
    INDEX idx_model_featured (model_id, is_featured, is_active)
);

-- ===================================
-- MENU SYSTEM
-- ===================================

CREATE TABLE menu_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    model_id INT NOT NULL,
    label VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    url_path VARCHAR(200),
    is_visible BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    is_external BOOLEAN DEFAULT FALSE,
    
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE,
    INDEX idx_model_menu (model_id, sort_order)
);