const express = require('express');
const router = express.Router();
const db = require('../../config/database');

async function getModel(slug) {
  const [rows] = await db.execute('SELECT id FROM models WHERE slug = ? LIMIT 1', [slug]);
  return rows[0];
}

// Get all etiquette content (RoseMastos-style structured content)
router.get('/:slug/content', async (req, res) => {
  try {
    const model = await getModel(req.params.slug);
    if (!model) return res.status(404).json({ success: false, message: 'Model not found' });

    const [rows] = await db.execute(
      'SELECT * FROM model_etiquette_page_content WHERE model_id = ? LIMIT 1',
      [model.id]
    );

    const content = rows[0] || null;
    return res.json({ success: true, data: { etiquette_content: content } });
  } catch (e) {
    console.error('Failed to load etiquette content:', e);
    return res.status(500).json({ success: false, message: 'Failed to load etiquette content', error: e.message });
  }
});

// Update specific field in etiquette content
router.put('/:slug/content/:field', async (req, res) => {
  try {
    const model = await getModel(req.params.slug);
    if (!model) return res.status(404).json({ success: false, message: 'Model not found' });

    const { field } = req.params;
    const { value } = req.body;

    // Validate field exists in schema
    const validFields = [
      'page_title', 'page_subtitle', 'etiquette_header_visible',
      'etiquette_booking_visible', 'booking_title',
      'booking_initial_contact_title', 'booking_initial_contact_text',
      'booking_screening_title', 'booking_screening_text',
      'booking_advance_title', 'booking_advance_text',
      'etiquette_respect_visible', 'respect_title',
      'respect_mutual_title', 'respect_mutual_text',
      'respect_boundaries_title', 'respect_boundaries_text',
      'respect_personal_title', 'respect_personal_text',
      'etiquette_hygiene_visible', 'hygiene_title',
      'hygiene_personal_title', 'hygiene_personal_text',
      'hygiene_attire_title', 'hygiene_attire_text',
      'hygiene_substances_title', 'hygiene_substances_text',
      'etiquette_cancellation_visible', 'cancellation_title',
      'cancellation_advance_title', 'cancellation_advance_text',
      'cancellation_noshow_title', 'cancellation_noshow_text',
      'cancellation_my_title', 'cancellation_my_text',
      'etiquette_safety_visible', 'safety_title',
      'safety_confidentiality_title', 'safety_confidentiality_text',
      'safety_environment_title', 'safety_environment_text',
      'safety_communication_title', 'safety_communication_text',
      'etiquette_questions_visible', 'questions_title', 'questions_text',
      'questions_button_text', 'questions_button_link'
    ];

    if (!validFields.includes(field)) {
      return res.status(400).json({ success: false, message: 'Invalid field' });
    }

    // Check if record exists
    const [existing] = await db.execute(
      'SELECT id FROM model_etiquette_page_content WHERE model_id = ? LIMIT 1',
      [model.id]
    );

    if (existing.length === 0) {
      // Create new record first
      await db.execute(
        'INSERT INTO model_etiquette_page_content (model_id) VALUES (?)',
        [model.id]
      );
    }

    // Update the specific field
    await db.execute(
      `UPDATE model_etiquette_page_content SET ${field} = ?, updated_at = NOW() WHERE model_id = ?`,
      [value, model.id]
    );

    return res.json({ success: true, message: 'Field updated successfully' });
  } catch (e) {
    console.error('Failed to update etiquette field:', e);
    return res.status(500).json({ success: false, message: 'Failed to update field', error: e.message });
  }
});

// Bulk update etiquette content
router.put('/:slug/content', async (req, res) => {
  try {
    const model = await getModel(req.params.slug);
    if (!model) return res.status(404).json({ success: false, message: 'Model not found' });

    const updates = req.body;
    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'No updates provided' });
    }

    // Check if record exists
    const [existing] = await db.execute(
      'SELECT id FROM model_etiquette_page_content WHERE model_id = ? LIMIT 1',
      [model.id]
    );

    if (existing.length === 0) {
      // Create new record first
      await db.execute(
        'INSERT INTO model_etiquette_page_content (model_id) VALUES (?)',
        [model.id]
      );
    }

    // Build dynamic update query
    const validFields = [
      'page_title', 'page_subtitle', 'etiquette_header_visible',
      'etiquette_booking_visible', 'booking_title',
      'booking_initial_contact_title', 'booking_initial_contact_text',
      'booking_screening_title', 'booking_screening_text',
      'booking_advance_title', 'booking_advance_text',
      'etiquette_respect_visible', 'respect_title',
      'respect_mutual_title', 'respect_mutual_text',
      'respect_boundaries_title', 'respect_boundaries_text',
      'respect_personal_title', 'respect_personal_text',
      'etiquette_hygiene_visible', 'hygiene_title',
      'hygiene_personal_title', 'hygiene_personal_text',
      'hygiene_attire_title', 'hygiene_attire_text',
      'hygiene_substances_title', 'hygiene_substances_text',
      'etiquette_cancellation_visible', 'cancellation_title',
      'cancellation_advance_title', 'cancellation_advance_text',
      'cancellation_noshow_title', 'cancellation_noshow_text',
      'cancellation_my_title', 'cancellation_my_text',
      'etiquette_safety_visible', 'safety_title',
      'safety_confidentiality_title', 'safety_confidentiality_text',
      'safety_environment_title', 'safety_environment_text',
      'safety_communication_title', 'safety_communication_text',
      'etiquette_questions_visible', 'questions_title', 'questions_text',
      'questions_button_text', 'questions_button_link'
    ];

    const updateFields = Object.keys(updates).filter(field => validFields.includes(field));
    if (updateFields.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields provided' });
    }

    const setClause = updateFields.map(field => `${field} = ?`).join(', ');
    const values = updateFields.map(field => updates[field]);
    values.push(model.id); // for WHERE clause

    await db.execute(
      `UPDATE model_etiquette_page_content SET ${setClause}, updated_at = NOW() WHERE model_id = ?`,
      values
    );

    return res.json({ success: true, message: 'Content updated successfully', updatedFields: updateFields });
  } catch (e) {
    console.error('Failed to update etiquette content:', e);
    return res.status(500).json({ success: false, message: 'Failed to update content', error: e.message });
  }
});

module.exports = router;