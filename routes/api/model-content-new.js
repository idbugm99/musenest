const express = require('express');
const router = express.Router();
const { query } = require('../../config/database');

// Get home page content for a model
router.get('/:modelSlug/home', async (req, res) => {
    try {
        const { modelSlug } = req.params;
        
        // Get model ID from slug
        const modelResult = await query('SELECT id FROM models WHERE slug = ?', [modelSlug]);
        if (modelResult.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Model not found'
            });
        }
        
        const modelId = modelResult[0].id;
        
        // Get home page content
        const contentResult = await query(
            'SELECT * FROM model_home_page_content WHERE model_id = ?',
            [modelId]
        );
        
        let content = {};
        if (contentResult.length > 0) {
            content = contentResult[0];
        } else {
            // Create default content if none exists
            await query(`
                INSERT INTO model_home_page_content 
                (model_id, hero_title, hero_subtitle, about_title, gallery_section_title, testimonials_section_title, cta_section_title)
                VALUES (?, 'Welcome', 'Elegance & Sophistication', 'About Me', 'Gallery', 'What Clients Say', 'Ready to Meet?')
            `, [modelId]);
            
            const newContentResult = await query(
                'SELECT * FROM model_home_page_content WHERE model_id = ?',
                [modelId]
            );
            content = newContentResult[0] || {};
        }
        
        res.json({
            success: true,
            data: content
        });
        
    } catch (error) {
        console.error('Error fetching home page content:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch home page content'
        });
    }
});

// Update home page content for a model
router.put('/:modelSlug/home', async (req, res) => {
    try {
        const { modelSlug } = req.params;
        const updateData = req.body;
        
        // Get model ID from slug
        const modelResult = await query('SELECT id FROM models WHERE slug = ?', [modelSlug]);
        if (modelResult.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Model not found'
            });
        }
        
        const modelId = modelResult[0].id;
        
        // Build update query dynamically
        const allowedFields = [
            'hero_section_visible', 'hero_title', 'hero_subtitle', 'hero_background_image_id', 
            'hero_background_opacity', 'hero_button_1_text', 'hero_button_1_link', 
            'hero_button_2_text', 'hero_button_2_link', 'about_section_visible', 
            'about_title', 'about_paragraph_1', 'about_paragraph_2', 'about_link_text', 
            'about_link_destination', 'portrait_image_id', 'portrait_alt', 
            'portrait_section_visible', 'gallery_section_visible', 'featured_gallery_section_id',
            'gallery_section_title', 'gallery_button_text', 'gallery_button_link',
            'testimonials_section_visible', 'testimonials_section_title', 'testimonials_display_count',
            'cta_section_visible', 'cta_section_title', 'cta_section_subtitle',
            'cta_button_1_text', 'cta_button_1_link', 'cta_button_2_text', 'cta_button_2_link',
            'page_published'
        ];
        
        const updateFields = [];
        const updateValues = [];
        
        Object.keys(updateData).forEach(key => {
            if (allowedFields.includes(key)) {
                updateFields.push(`${key} = ?`);
                updateValues.push(updateData[key]);
            }
        });
        
        if (updateFields.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No valid fields to update'
            });
        }
        
        updateValues.push(modelId);
        
        const updateQuery = `
            UPDATE model_home_page_content 
            SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
            WHERE model_id = ?
        `;
        
        await query(updateQuery, updateValues);
        
        res.json({
            success: true,
            message: 'Home page content updated successfully'
        });
        
    } catch (error) {
        console.error('Error updating home page content:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update home page content'
        });
    }
});

// Get about page content for a model
router.get('/:modelSlug/about', async (req, res) => {
    try {
        const { modelSlug } = req.params;
        
        // Get model ID from slug
        const modelResult = await query('SELECT id FROM models WHERE slug = ?', [modelSlug]);
        if (modelResult.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Model not found'
            });
        }
        
        const modelId = modelResult[0].id;
        
        // Get about page content
        const contentResult = await query(
            'SELECT * FROM model_about_page_content WHERE model_id = ?',
            [modelId]
        );
        
        let content = {};
        if (contentResult.length > 0) {
            content = contentResult[0];
        } else {
            // Create default content if none exists
            await query(`
                INSERT INTO model_about_page_content 
                (model_id, page_title, services_title, cta_title)
                VALUES (?, 'About Me', 'My Services', 'Let\\'s Connect')
            `, [modelId]);
            
            const newContentResult = await query(
                'SELECT * FROM model_about_page_content WHERE model_id = ?',
                [modelId]
            );
            content = newContentResult[0] || {};
        }
        
        res.json({
            success: true,
            data: content
        });
        
    } catch (error) {
        console.error('Error fetching about page content:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch about page content'
        });
    }
});

// Update about page content for a model
router.put('/:modelSlug/about', async (req, res) => {
    try {
        const { modelSlug } = req.params;
        const updateData = req.body;
        
        // Get model ID from slug
        const modelResult = await query('SELECT id FROM models WHERE slug = ?', [modelSlug]);
        if (modelResult.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Model not found'
            });
        }
        
        const modelId = modelResult[0].id;
        
        // Build update query dynamically
        const allowedFields = [
            'page_title', 'page_subtitle', 'page_title_visible', 'main_content_visible',
            'main_paragraph_1', 'main_paragraph_2', 'main_paragraph_3', 'main_paragraph_4',
            'portrait_visible', 'portrait_image_id', 'portrait_alt', 'services_visible',
            'services_title', 'service_1', 'service_2', 'service_3', 'service_4', 'service_5',
            'interests_visible', 'interests_title', 'interests', 'quick_facts_visible',
            'quick_facts_title', 'qf_location', 'qf_languages', 'qf_education', 'qf_specialties',
            'about_cta_visible', 'cta_title', 'cta_description', 'cta_button_1_text',
            'cta_button_1_link', 'cta_button_2_text', 'cta_button_2_link',
            'page_published'
        ];
        
        const updateFields = [];
        const updateValues = [];
        
        Object.keys(updateData).forEach(key => {
            if (allowedFields.includes(key)) {
                updateFields.push(`${key} = ?`);
                updateValues.push(updateData[key]);
            }
        });
        
        if (updateFields.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No valid fields to update'
            });
        }
        
        updateValues.push(modelId);
        
        const updateQuery = `
            UPDATE model_about_page_content 
            SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
            WHERE model_id = ?
        `;
        
        await query(updateQuery, updateValues);
        
        res.json({
            success: true,
            message: 'About page content updated successfully'
        });
        
    } catch (error) {
        console.error('Error updating about page content:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update about page content'
        });
    }
});

// Get contact page content for a model
router.get('/:modelSlug/contact', async (req, res) => {
    try {
        const { modelSlug } = req.params;
        
        // Get model ID from slug
        const modelResult = await query('SELECT id FROM models WHERE slug = ?', [modelSlug]);
        if (modelResult.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Model not found'
            });
        }
        
        const modelId = modelResult[0].id;
        
        // Get contact page content
        const contentResult = await query(
            'SELECT * FROM model_contact_page_content WHERE model_id = ?',
            [modelId]
        );
        
        let content = {};
        if (contentResult.length > 0) {
            content = contentResult[0];
        } else {
            // Create default content if none exists
            await query(`
                INSERT INTO model_contact_page_content 
                (model_id, page_title, form_title, direct_title)
                VALUES (?, 'Contact Me', 'Send a Message', 'Direct Contact')
            `, [modelId]);
            
            const newContentResult = await query(
                'SELECT * FROM model_contact_page_content WHERE model_id = ?',
                [modelId]
            );
            content = newContentResult[0] || {};
        }
        
        res.json({
            success: true,
            data: content
        });
        
    } catch (error) {
        console.error('Error fetching contact page content:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch contact page content'
        });
    }
});

// Update contact page content for a model
router.put('/:modelSlug/contact', async (req, res) => {
    try {
        const { modelSlug } = req.params;
        const updateData = req.body;
        
        // Get model ID from slug
        const modelResult = await query('SELECT id FROM models WHERE slug = ?', [modelSlug]);
        if (modelResult.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Model not found'
            });
        }
        
        const modelId = modelResult[0].id;
        
        // Build update query dynamically
        const allowedFields = [
            'page_title', 'page_subtitle', 'intro_text', 'form_title', 'direct_title',
            'direct_email_label', 'direct_phone_label', 'direct_response_label', 'direct_response_text',
            'guidelines_title', 'guideline_1', 'guideline_2', 'guideline_3', 'guideline_4', 'guideline_5',
            'privacy_title', 'privacy_text', 
            'location_title', 'location_area_text', 'location_services_text', 'location_travel_text',
            'page_published'
        ];
        
        const updateFields = [];
        const updateValues = [];
        
        Object.keys(updateData).forEach(key => {
            if (allowedFields.includes(key)) {
                updateFields.push(`${key} = ?`);
                updateValues.push(updateData[key]);
            }
        });
        
        if (updateFields.length === 0) {
            console.log('Contact API Debug:', {
                updateData,
                allowedFields,
                receivedKeys: Object.keys(updateData),
                matchingKeys: Object.keys(updateData).filter(key => allowedFields.includes(key))
            });
            return res.status(400).json({
                success: false,
                message: 'No valid fields to update'
            });
        }
        
        updateValues.push(modelId);
        
        const updateQuery = `
            UPDATE model_contact_page_content 
            SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
            WHERE model_id = ?
        `;
        
        await query(updateQuery, updateValues);
        
        res.json({
            success: true,
            message: 'Contact page content updated successfully'
        });
        
    } catch (error) {
        console.error('Error updating contact page content:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update contact page content'
        });
    }
});

// Get gallery page content for a model
router.get('/:modelSlug/gallery', async (req, res) => {
    try {
        const { modelSlug } = req.params;
        
        // Get model ID from slug
        const modelResult = await query('SELECT id FROM models WHERE slug = ?', [modelSlug]);
        if (modelResult.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Model not found'
            });
        }
        
        const modelId = modelResult[0].id;
        
        // Get gallery page content
        const contentResult = await query(
            'SELECT * FROM model_gallery_page_content WHERE model_id = ?',
            [modelId]
        );
        
        let content = {};
        if (contentResult.length > 0) {
            content = contentResult[0];
        } else {
            // Create default content if none exists
            await query(`
                INSERT INTO model_gallery_page_content 
                (model_id, page_title, selected_sections)
                VALUES (?, 'Gallery', '[]')
            `, [modelId]);
            
            const newContentResult = await query(
                'SELECT * FROM model_gallery_page_content WHERE model_id = ?',
                [modelId]
            );
            content = newContentResult[0] || {};
        }
        
        res.json({
            success: true,
            data: content
        });
        
    } catch (error) {
        console.error('Error fetching gallery page content:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch gallery page content'
        });
    }
});

// Update gallery page content selection
router.put('/:modelSlug/gallery', async (req, res) => {
    console.log('🎨 Gallery PUT route hit!', req.params, req.body);
    try {
        const { modelSlug } = req.params;
        const updateData = req.body;
        
        // Get model ID from slug
        const modelResult = await query('SELECT id FROM models WHERE slug = ?', [modelSlug]);
        if (modelResult.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Model not found'
            });
        }
        
        const modelId = modelResult[0].id;
        
        // Check if gallery page content exists, create if not
        const existingContent = await query('SELECT * FROM model_gallery_page_content WHERE model_id = ?', [modelId]);
        
        if (existingContent.length === 0) {
            // Create default gallery page content
            await query(`
                INSERT INTO model_gallery_page_content (model_id, selected_sections)
                VALUES (?, ?)
            `, [modelId, updateData.selected_sections || '[]']);
        } else {
            // Update existing content
            const allowedFields = [
                'selected_sections', 'page_title', 'page_subtitle', 'page_description',
                'gallery_header_visible', 'page_published', 'hero_background_image_id', 'hero_background_opacity',
                'gallery_page_title', 'gallery_page_subtitle', 
                'default_grid_columns', 'image_quality', 'enable_lightbox', 'show_image_info',
                'show_category_filter', 'default_category', 'default_sort_order', 'allow_sort_change',
                'images_per_page', 'show_image_count'
            ];
            
            const updateFields = [];
            const updateValues = [];
            
            Object.keys(updateData).forEach(key => {
                if (allowedFields.includes(key)) {
                    updateFields.push(`${key} = ?`);
                    updateValues.push(updateData[key]);
                }
            });
            
            if (updateFields.length === 0) {
                console.log('Gallery API Debug: No matching fields', {
                    received: Object.keys(updateData),
                    allowed: allowedFields
                });
                return res.status(400).json({
                    success: false,
                    message: 'No valid fields to update'
                });
            }
            
            updateValues.push(modelId);
            
            const updateQuery = `
                UPDATE model_gallery_page_content 
                SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
                WHERE model_id = ?
            `;
            
            console.log('Gallery Update Query:', updateQuery);
            console.log('Gallery Update Values:', updateValues);
            
            await query(updateQuery, updateValues);
        }
        
        res.json({
            success: true,
            message: 'Gallery content selection updated successfully'
        });
        
    } catch (error) {
        console.error('Error updating gallery content selection:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update gallery content selection'
        });
    }
});

// Get etiquette page content for a model
router.get('/:modelSlug/etiquette', async (req, res) => {
    try {
        const { modelSlug } = req.params;
        
        // Get model ID from slug
        const modelResult = await query('SELECT id FROM models WHERE slug = ?', [modelSlug]);
        if (modelResult.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Model not found'
            });
        }
        
        const modelId = modelResult[0].id;
        
        // Get etiquette page content
        const contentResult = await query(
            'SELECT * FROM model_etiquette_page_content WHERE model_id = ?',
            [modelId]
        );
        
        let content = {};
        if (contentResult.length > 0) {
            content = contentResult[0];
        } else {
            // Create default content if none exists
            await query(`
                INSERT INTO model_etiquette_page_content 
                (model_id, page_title, etiquette_header_visible, section_1_visible, section_2_visible, section_3_visible, cta_visible)
                VALUES (?, 'Etiquette & Guidelines', 1, 1, 1, 1, 1)
            `, [modelId]);
            
            const newContentResult = await query(
                'SELECT * FROM model_etiquette_page_content WHERE model_id = ?',
                [modelId]
            );
            content = newContentResult[0] || {};
        }
        
        res.json({
            success: true,
            data: content
        });
        
    } catch (error) {
        console.error('Error fetching etiquette content:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch etiquette content'
        });
    }
});

// Update etiquette page content for a model
router.put('/:modelSlug/etiquette', async (req, res) => {
    try {
        const { modelSlug } = req.params;
        const updateData = req.body;
        
        // Get model ID from slug
        const modelResult = await query('SELECT id FROM models WHERE slug = ?', [modelSlug]);
        if (modelResult.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Model not found'
            });
        }
        
        const modelId = modelResult[0].id;
        
        // Check if content exists
        const existingResult = await query(
            'SELECT id FROM model_etiquette_page_content WHERE model_id = ?',
            [modelId]
        );
        
        if (existingResult.length > 0) {
            // Update existing content
            const setClause = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
            const values = [...Object.values(updateData), modelId];
            
            await query(
                `UPDATE model_etiquette_page_content SET ${setClause}, updated_at = NOW() WHERE model_id = ?`,
                values
            );
        } else {
            // Insert new content
            const fields = ['model_id', ...Object.keys(updateData)];
            const placeholders = fields.map(() => '?').join(', ');
            const values = [modelId, ...Object.values(updateData)];
            
            await query(
                `INSERT INTO model_etiquette_page_content (${fields.join(', ')}) VALUES (${placeholders})`,
                values
            );
        }
        
        res.json({
            success: true,
            message: 'Etiquette content updated successfully'
        });
        
    } catch (error) {
        console.error('Error updating etiquette content:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update etiquette content'
        });
    }
});

module.exports = router;