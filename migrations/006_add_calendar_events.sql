-- Migration 006: Add Calendar Events System
-- Creates calendar events table for availability management

CREATE TABLE calendar_events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    model_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    start_time TIME NULL,
    end_time TIME NULL,
    all_day BOOLEAN DEFAULT TRUE,
    location VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'available',
    color VARCHAR(7) DEFAULT '#3B82F6',
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_pattern VARCHAR(50),
    notes TEXT,
    is_visible BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE,
    INDEX idx_calendar_events_model_id (model_id),
    INDEX idx_calendar_events_dates (start_date, end_date),
    INDEX idx_calendar_events_status (status)
);

-- Insert sample calendar events for testing
INSERT INTO calendar_events (model_id, title, description, start_date, end_date, location, status, color, notes) VALUES
(5, 'Available in Downtown', 'Available for appointments downtown', '2025-07-28', '2025-07-30', 'Downtown Denver', 'available', '#10B981', 'Premium downtown location'),
(5, 'Weekend Availability', 'Weekend appointments available', '2025-08-02', '2025-08-03', 'DTC Area', 'available', '#3B82F6', 'Saturday and Sunday availability'),
(5, 'Vacation Break', 'Out of town for vacation', '2025-08-10', '2025-08-15', 'Hawaii', 'vacation', '#EF4444', 'Annual vacation - no appointments');