const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateToken: auth } = require('../middleware/auth');

// Helper function to get user's model ID
async function getUserModelId(userId) {
    try {
        const models = await query(`
            SELECT m.id 
            FROM models m
            JOIN model_users mu ON m.id = mu.model_id
            WHERE mu.user_id = ? AND mu.is_active = true
            ORDER BY mu.role = 'owner' DESC
            LIMIT 1
        `, [userId]);
        
        return models.length > 0 ? models[0].id : null;
    } catch (error) {
        console.error('getUserModelId error:', error);
        return null;
    }
}

// Get all calendar events for the authenticated user's model
router.get('/', auth, async (req, res) => {
    try {
        const modelId = await getUserModelId(req.user.id);
        if (!modelId) {
            return res.status(404).json({
                success: false,
                message: 'No model found for user'
            });
        }

        const { month, year } = req.query;
        let whereClause = 'WHERE model_id = ? AND is_visible = true';
        let params = [modelId];

        // Filter by month/year if provided
        if (month && year) {
            whereClause += ` AND (
                (YEAR(start_date) = ? AND MONTH(start_date) = ?) OR
                (YEAR(end_date) = ? AND MONTH(end_date) = ?) OR
                (start_date <= ? AND end_date >= ?)
            )`;
            const monthStart = `${year}-${month.padStart(2, '0')}-01`;
            const monthEnd = `${year}-${month.padStart(2, '0')}-31`;
            params.push(year, month, year, month, monthEnd, monthStart);
        }

        const events = await query(`
            SELECT 
                id, title, description, start_date, end_date, 
                start_time, end_time, all_day, location, status, 
                color, is_recurring, recurrence_pattern, notes,
                created_at, updated_at
            FROM calendar_events 
            ${whereClause}
            ORDER BY start_date, start_time
        `, params);

        res.json({
            success: true,
            events: events
        });

    } catch (error) {
        console.error('Error fetching calendar events:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch calendar events'
        });
    }
});

// Get single calendar event
router.get('/:id', auth, async (req, res) => {
    try {
        const modelId = await getUserModelId(req.user.id);
        if (!modelId) {
            return res.status(404).json({
                success: false,
                message: 'No model found for user'
            });
        }

        const events = await query(`
            SELECT * FROM calendar_events 
            WHERE id = ? AND model_id = ?
        `, [req.params.id, modelId]);

        if (events.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Calendar event not found'
            });
        }

        res.json({
            success: true,
            event: events[0]
        });

    } catch (error) {
        console.error('Error fetching calendar event:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch calendar event'
        });
    }
});

// Create new calendar event
router.post('/', auth, async (req, res) => {
    try {
        const modelId = await getUserModelId(req.user.id);
        if (!modelId) {
            return res.status(404).json({
                success: false,
                message: 'No model found for user'
            });
        }

        const {
            title, description, start_date, end_date,
            start_time, end_time, all_day, location,
            status, color, is_recurring, recurrence_pattern, notes
        } = req.body;

        // Validation
        if (!title || !start_date || !end_date) {
            return res.status(400).json({
                success: false,
                message: 'Title, start date, and end date are required'
            });
        }

        const result = await query(`
            INSERT INTO calendar_events (
                model_id, title, description, start_date, end_date,
                start_time, end_time, all_day, location, status,
                color, is_recurring, recurrence_pattern, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            modelId, title, description, start_date, end_date,
            start_time, end_time, all_day || true, location,
            status || 'available', color || '#3B82F6',
            is_recurring || false, recurrence_pattern, notes
        ]);

        res.status(201).json({
            success: true,
            message: 'Calendar event created successfully',
            event: {
                id: result.insertId,
                model_id: modelId,
                title, description, start_date, end_date,
                start_time, end_time, all_day, location,
                status, color, is_recurring, recurrence_pattern, notes
            }
        });

    } catch (error) {
        console.error('Error creating calendar event:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create calendar event'
        });
    }
});

// Update calendar event
router.put('/:id', auth, async (req, res) => {
    try {
        const modelId = await getUserModelId(req.user.id);
        if (!modelId) {
            return res.status(404).json({
                success: false,
                message: 'No model found for user'
            });
        }

        const {
            title, description, start_date, end_date,
            start_time, end_time, all_day, location,
            status, color, is_recurring, recurrence_pattern, notes
        } = req.body;

        // Check if event exists and belongs to user
        const existingEvents = await query(`
            SELECT id FROM calendar_events 
            WHERE id = ? AND model_id = ?
        `, [req.params.id, modelId]);

        if (existingEvents.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Calendar event not found'
            });
        }

        await query(`
            UPDATE calendar_events SET
                title = ?, description = ?, start_date = ?, end_date = ?,
                start_time = ?, end_time = ?, all_day = ?, location = ?,
                status = ?, color = ?, is_recurring = ?, 
                recurrence_pattern = ?, notes = ?, updated_at = NOW()
            WHERE id = ? AND model_id = ?
        `, [
            title, description, start_date, end_date,
            start_time, end_time, all_day, location,
            status, color, is_recurring, recurrence_pattern, notes,
            req.params.id, modelId
        ]);

        res.json({
            success: true,
            message: 'Calendar event updated successfully'
        });

    } catch (error) {
        console.error('Error updating calendar event:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update calendar event'
        });
    }
});

// Delete calendar event
router.delete('/:id', auth, async (req, res) => {
    try {
        const modelId = await getUserModelId(req.user.id);
        if (!modelId) {
            return res.status(404).json({
                success: false,
                message: 'No model found for user'
            });
        }

        // Check if event exists and belongs to user
        const existingEvents = await query(`
            SELECT title FROM calendar_events 
            WHERE id = ? AND model_id = ?
        `, [req.params.id, modelId]);

        if (existingEvents.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Calendar event not found'
            });
        }

        await query(`
            DELETE FROM calendar_events 
            WHERE id = ? AND model_id = ?
        `, [req.params.id, modelId]);

        res.json({
            success: true,
            message: 'Calendar event deleted successfully',
            deleted_event: existingEvents[0]
        });

    } catch (error) {
        console.error('Error deleting calendar event:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete calendar event'
        });
    }
});

// Get calendar statistics
router.get('/stats/overview', auth, async (req, res) => {
    try {
        const modelId = await getUserModelId(req.user.id);
        if (!modelId) {
            return res.json({
                total_events: 0,
                upcoming_events: 0,
                available_days: 0,
                vacation_days: 0
            });
        }

        const today = new Date().toISOString().split('T')[0];

        const [totalEvents] = await query(`
            SELECT COUNT(*) as count FROM calendar_events 
            WHERE model_id = ? AND is_visible = true
        `, [modelId]);

        const [upcomingEvents] = await query(`
            SELECT COUNT(*) as count FROM calendar_events 
            WHERE model_id = ? AND start_date >= ? AND is_visible = true
        `, [modelId, today]);

        const [availableDays] = await query(`
            SELECT COUNT(*) as count FROM calendar_events 
            WHERE model_id = ? AND status = 'available' AND is_visible = true
        `, [modelId]);

        const [vacationDays] = await query(`
            SELECT COUNT(*) as count FROM calendar_events 
            WHERE model_id = ? AND status = 'vacation' AND is_visible = true
        `, [modelId]);

        res.json({
            total_events: totalEvents.count,
            upcoming_events: upcomingEvents.count,
            available_days: availableDays.count,
            vacation_days: vacationDays.count
        });

    } catch (error) {
        console.error('Error fetching calendar stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch calendar statistics'
        });
    }
});

module.exports = router;