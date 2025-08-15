-- Add service type, radius, and location details to calendar availability
ALTER TABLE calendar_availability 
ADD COLUMN service_type ENUM('incall', 'outcall', 'both') DEFAULT 'incall' AFTER location,
ADD COLUMN radius_miles INT NULL DEFAULT NULL AFTER service_type,
ADD COLUMN location_details TEXT NULL AFTER radius_miles;

-- Update existing records to have default service type
UPDATE calendar_availability SET service_type = 'incall' WHERE service_type IS NULL;