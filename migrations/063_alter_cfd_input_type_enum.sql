-- Expand input_type enum to support selects and boolean switches
ALTER TABLE content_field_definitions
  MODIFY COLUMN input_type ENUM('text','textarea','html','number','select','boolean') NOT NULL DEFAULT 'text';


