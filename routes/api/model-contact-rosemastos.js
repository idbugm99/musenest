const express = require('express');
const router = express.Router();
const db = require('../../config/database');

// Get contact page content for a model
router.get('/:slug/content', async (req, res) => {
    try {
        const { slug } = req.params;
        
        // Get model ID from slug
        const [modelRows] = await db.execute(
            'SELECT id FROM models WHERE slug = ?',
            [slug]
        );
        
        if (modelRows.length === 0) {
            return res.status(404).json({ error: 'Model not found' });
        }
        
        const modelId = modelRows[0].id;
        
        // Get contact page content
        const [contentRows] = await db.execute(`
            SELECT * FROM model_contact_page_content WHERE model_id = ?
        `, [modelId]);
        
        if (contentRows.length === 0) {
            // Return default structure if no content exists
            return res.json({
                model_id: modelId,
                page_title: 'Contact Me',
                page_subtitle: 'I look forward to hearing from you. Please use the form below or my preferred contact methods.',
                contact_header_visible: true,
                
                form_title: 'Send a Message',
                form_name_label: 'Your Name',
                form_email_label: 'Email Address',
                form_phone_label: 'Phone Number (Optional)',
                form_date_label: 'Preferred Date',
                form_duration_label: 'Duration',
                form_duration_options: '1 Hour,90 Minutes,2 Hours,3 Hours,Overnight,Extended (please specify)',
                form_message_label: 'Message',
                form_message_placeholder: 'Please include any specific requests or questions...',
                form_button_text: 'Send Message',
                contact_form_visible: true,
                
                direct_title: 'Direct Contact',
                direct_email_label: 'Email',
                direct_phone_label: 'Phone',
                direct_response_label: 'Response Time',
                direct_response_text: 'Within 2-4 hours',
                contact_direct_visible: true,
                
                guidelines_title: 'Booking Guidelines',
                guideline_1: 'Include your preferred date and time',
                guideline_2: 'Specify desired duration of our meeting',
                guideline_3: 'Mention if you are a first-time or returning client',
                guideline_4: 'Be prepared for a brief screening process',
                guideline_5: 'Allow 24+ hours for booking confirmation',
                contact_guidelines_visible: true,
                
                location_title: 'Location',
                location_area_text: 'Currently serving the greater area',
                location_services_text: 'Incall and outcall services available',
                location_travel_text: 'Travel arrangements can be discussed',
                contact_location_visible: true,
                
                privacy_title: 'Privacy & Discretion',
                privacy_text: 'All communications are handled with the utmost discretion and confidentiality. Your privacy is my priority, and I expect the same level of respect in return.',
                contact_privacy_visible: true
            });
        }
        
        res.json(contentRows[0]);
        
    } catch (error) {
        console.error('Error fetching contact content:', error);
        res.status(500).json({ error: 'Failed to fetch contact content' });
    }
});

// Update contact page content
router.put('/:slug/content', async (req, res) => {
    try {
        const { slug } = req.params;
        const updates = req.body;
        
        // Get model ID from slug
        const [modelRows] = await db.execute(
            'SELECT id FROM models WHERE slug = ?',
            [slug]
        );
        
        if (modelRows.length === 0) {
            return res.status(404).json({ error: 'Model not found' });
        }
        
        const modelId = modelRows[0].id;
        
        // Check if record exists
        const [existingRows] = await db.execute(
            'SELECT id FROM model_contact_page_content WHERE model_id = ?',
            [modelId]
        );
        
        if (existingRows.length === 0) {
            // Create new record with all the fields
            const [result] = await db.execute(`
                INSERT INTO model_contact_page_content (
                    model_id, page_title, page_subtitle, contact_header_visible,
                    form_title, form_name_label, form_email_label, form_phone_label,
                    form_date_label, form_duration_label, form_duration_options,
                    form_message_label, form_message_placeholder, form_button_text, contact_form_visible,
                    direct_title, direct_email_label, direct_phone_label, 
                    direct_response_label, direct_response_text, contact_direct_visible,
                    guidelines_title, guideline_1, guideline_2, guideline_3, guideline_4, guideline_5, contact_guidelines_visible,
                    location_title, location_area_text, location_services_text, location_travel_text, contact_location_visible,
                    privacy_title, privacy_text, contact_privacy_visible
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                modelId,
                updates.page_title || 'Contact Me',
                updates.page_subtitle || 'I look forward to hearing from you.',
                updates.contact_header_visible !== undefined ? updates.contact_header_visible : true,
                updates.form_title || 'Send a Message',
                updates.form_name_label || 'Your Name',
                updates.form_email_label || 'Email Address',
                updates.form_phone_label || 'Phone Number (Optional)',
                updates.form_date_label || 'Preferred Date',
                updates.form_duration_label || 'Duration',
                updates.form_duration_options || '1 Hour,90 Minutes,2 Hours,3 Hours,Overnight,Extended (please specify)',
                updates.form_message_label || 'Message',
                updates.form_message_placeholder || 'Please include any specific requests or questions...',
                updates.form_button_text || 'Send Message',
                updates.contact_form_visible !== undefined ? updates.contact_form_visible : true,
                updates.direct_title || 'Direct Contact',
                updates.direct_email_label || 'Email',
                updates.direct_phone_label || 'Phone',
                updates.direct_response_label || 'Response Time',
                updates.direct_response_text || 'Within 2-4 hours',
                updates.contact_direct_visible !== undefined ? updates.contact_direct_visible : true,
                updates.guidelines_title || 'Booking Guidelines',
                updates.guideline_1 || 'Include your preferred date and time',
                updates.guideline_2 || 'Specify desired duration of our meeting',
                updates.guideline_3 || 'Mention if you are a first-time or returning client',
                updates.guideline_4 || 'Be prepared for a brief screening process',
                updates.guideline_5 || 'Allow 24+ hours for booking confirmation',
                updates.contact_guidelines_visible !== undefined ? updates.contact_guidelines_visible : true,
                updates.location_title || 'Location',
                updates.location_area_text || 'Currently serving the greater area',
                updates.location_services_text || 'Incall and outcall services available',
                updates.location_travel_text || 'Travel arrangements can be discussed',
                updates.contact_location_visible !== undefined ? updates.contact_location_visible : true,
                updates.privacy_title || 'Privacy & Discretion',
                updates.privacy_text || 'All communications are handled with the utmost discretion and confidentiality.',
                updates.contact_privacy_visible !== undefined ? updates.contact_privacy_visible : true
            ]);
            
            return res.json({ 
                success: true, 
                message: 'Contact content created successfully',
                id: result.insertId
            });
        } else {
            // Update existing record
            const updateFields = [];
            const updateValues = [];
            
            // Define all possible fields
            const allowedFields = [
                'page_title', 'page_subtitle', 'contact_header_visible',
                'form_title', 'form_name_label', 'form_email_label', 'form_phone_label',
                'form_date_label', 'form_duration_label', 'form_duration_options',
                'form_message_label', 'form_message_placeholder', 'form_button_text', 'contact_form_visible',
                'direct_title', 'direct_email_label', 'direct_phone_label',
                'direct_response_label', 'direct_response_text', 'contact_direct_visible',
                'guidelines_title', 'guideline_1', 'guideline_2', 'guideline_3', 'guideline_4', 'guideline_5', 'contact_guidelines_visible',
                'location_title', 'location_area_text', 'location_services_text', 'location_travel_text', 'contact_location_visible',
                'privacy_title', 'privacy_text', 'contact_privacy_visible'
            ];
            
            // Build dynamic update query
            allowedFields.forEach(field => {
                if (updates[field] !== undefined) {
                    updateFields.push(`${field} = ?`);
                    updateValues.push(updates[field]);
                }
            });
            
            if (updateFields.length === 0) {
                return res.status(400).json({ error: 'No valid fields to update' });
            }
            
            updateValues.push(modelId);
            
            await db.execute(
                `UPDATE model_contact_page_content SET ${updateFields.join(', ')} WHERE model_id = ?`,
                updateValues
            );
            
            return res.json({ 
                success: true, 
                message: 'Contact content updated successfully'
            });
        }
        
    } catch (error) {
        console.error('Error updating contact content:', error);
        res.status(500).json({ error: 'Failed to update contact content' });
    }
});

// Update single field (for auto-save)
router.patch('/:slug/content/:field', async (req, res) => {
    try {
        const { slug, field } = req.params;
        const { value } = req.body;
        
        // Get model ID from slug
        const [modelRows] = await db.execute(
            'SELECT id FROM models WHERE slug = ?',
            [slug]
        );
        
        if (modelRows.length === 0) {
            return res.status(404).json({ error: 'Model not found' });
        }
        
        const modelId = modelRows[0].id;
        
        // Validate field name
        const allowedFields = [
            'page_title', 'page_subtitle', 'contact_header_visible',
            'form_title', 'form_name_label', 'form_email_label', 'form_phone_label',
            'form_date_label', 'form_duration_label', 'form_duration_options',
            'form_message_label', 'form_message_placeholder', 'form_button_text', 'contact_form_visible',
            'direct_title', 'direct_email_label', 'direct_phone_label',
            'direct_response_label', 'direct_response_text', 'contact_direct_visible',
            'guidelines_title', 'guideline_1', 'guideline_2', 'guideline_3', 'guideline_4', 'guideline_5', 'contact_guidelines_visible',
            'location_title', 'location_area_text', 'location_services_text', 'location_travel_text', 'contact_location_visible',
            'privacy_title', 'privacy_text', 'contact_privacy_visible'
        ];
        
        if (!allowedFields.includes(field)) {
            return res.status(400).json({ error: 'Invalid field name' });
        }
        
        // Check if record exists, create if it doesn't
        const [existingRows] = await db.execute(
            'SELECT id FROM model_contact_page_content WHERE model_id = ?',
            [modelId]
        );
        
        if (existingRows.length === 0) {
            // Create new record with default values and the updated field
            const [result] = await db.execute(`
                INSERT INTO model_contact_page_content (
                    model_id, ${field}
                ) VALUES (?, ?)
            `, [modelId, value]);
            
            return res.json({ 
                success: true, 
                message: 'Contact content created with field update',
                id: result.insertId
            });
        } else {
            // Update the specific field
            await db.execute(
                `UPDATE model_contact_page_content SET ${field} = ? WHERE model_id = ?`,
                [value, modelId]
            );
            
            return res.json({ 
                success: true, 
                message: `Field ${field} updated successfully`
            });
        }
        
    } catch (error) {
        console.error('Error updating contact field:', error);
        res.status(500).json({ error: 'Failed to update contact field' });
    }
});

// Delete contact content
router.delete('/:slug/content', async (req, res) => {
    try {
        const { slug } = req.params;
        
        // Get model ID from slug
        const [modelRows] = await db.execute(
            'SELECT id FROM models WHERE slug = ?',
            [slug]
        );
        
        if (modelRows.length === 0) {
            return res.status(404).json({ error: 'Model not found' });
        }
        
        const modelId = modelRows[0].id;
        
        await db.execute(
            'DELETE FROM model_contact_page_content WHERE model_id = ?',
            [modelId]
        );
        
        res.json({ 
            success: true, 
            message: 'Contact content deleted successfully'
        });
        
    } catch (error) {
        console.error('Error deleting contact content:', error);
        res.status(500).json({ error: 'Failed to delete contact content' });
    }
});

module.exports = router;