-- MuseNest Database Migration 003
-- FAQ, Services, and Booking System
-- Run date: 2025-07-24

-- ===================================
-- FAQ SYSTEM
-- ===================================

-- FAQ categories
CREATE TABLE faq_categories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    model_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    sort_order INT DEFAULT 0,
    is_visible BOOLEAN DEFAULT TRUE,
    
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE,
    UNIQUE KEY unique_model_category (model_id, slug)
);

-- FAQ items
CREATE TABLE faq_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    model_id INT NOT NULL,
    category_id INT,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    sort_order INT DEFAULT 0,
    is_visible BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES faq_categories(id) ON DELETE SET NULL,
    INDEX idx_model_category (model_id, category_id),
    INDEX idx_visible (is_visible)
);

-- ===================================
-- RATES & SERVICES
-- ===================================

-- Service categories
CREATE TABLE service_categories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    model_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    sort_order INT DEFAULT 0,
    is_visible BOOLEAN DEFAULT TRUE,
    
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE,
    UNIQUE KEY unique_model_service_category (model_id, slug)
);

-- Services/rates
CREATE TABLE services (
    id INT PRIMARY KEY AUTO_INCREMENT,
    model_id INT NOT NULL,
    category_id INT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    duration VARCHAR(50),
    price DECIMAL(10,2),
    price_display VARCHAR(50), -- for custom price displays
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES service_categories(id) ON DELETE SET NULL,
    INDEX idx_model_category (model_id, category_id)
);

-- ===================================
-- BOOKING SYSTEM
-- ===================================

-- Availability
CREATE TABLE availability (
    id INT PRIMARY KEY AUTO_INCREMENT,
    model_id INT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    all_day BOOLEAN DEFAULT FALSE,
    location VARCHAR(100),
    status ENUM('available', 'booked', 'blocked', 'tentative') DEFAULT 'available',
    notes TEXT,
    color VARCHAR(7) DEFAULT '#3B82F6',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE,
    INDEX idx_model_dates (model_id, start_date, end_date)
);

-- Bookings (future feature)
CREATE TABLE bookings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    model_id INT NOT NULL,
    client_name VARCHAR(100),
    client_email VARCHAR(120),
    client_phone VARCHAR(20),
    service_id INT,
    booking_date DATE NOT NULL,
    booking_time TIME,
    duration_hours INT,
    location VARCHAR(100),
    special_requests TEXT,
    status ENUM('pending', 'confirmed', 'completed', 'cancelled') DEFAULT 'pending',
    total_amount DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL,
    INDEX idx_model_date (model_id, booking_date)
);