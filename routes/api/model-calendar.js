const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const logger = require('../../utils/logger');

async function getModelBySlug(slug){
  const rows = await db.query('SELECT id, slug, name FROM models WHERE slug = ? LIMIT 1', [slug]);
  return rows && rows[0] ? rows[0] : null;
}

router.get('/:modelSlug', async (req, res) => {
  try {
    const model = await getModelBySlug(req.params.modelSlug);
    if (!model) return res.fail(404, 'Model not found');
    
    // Get month/year from query params, default to current month
    const now = new Date();
    const year = parseInt(req.query.year) || now.getFullYear();
    const month = parseInt(req.query.month) || (now.getMonth() + 1);
    
    // Calculate month boundaries
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);
    
    // Get model timezone
    const timezoneRows = await db.query('SELECT setting_value FROM model_settings WHERE model_id = ? AND setting_key = "timezone"', [model.id]);
    const timezone = timezoneRows.length > 0 ? timezoneRows[0].setting_value : 'UTC';
    
    // Get availability data that overlaps with this month
    const rows = await db.query(`
      SELECT id, model_id, start_date, end_date, all_day, location, 
             service_type, radius_miles, location_details, status, color, notes,
             created_at, updated_at
      FROM calendar_availability 
      WHERE model_id = ? 
        AND start_date <= ? 
        AND end_date >= ? 
      ORDER BY start_date ASC
    `, [model.id, monthEnd.toISOString().split('T')[0], monthStart.toISOString().split('T')[0]]);
    
    // Process calendar data for monthly grid display
    const calendarData = processMonthlyCalendar(year, month, rows, timezone);
    
    return res.success({ 
      calendar: calendarData,
      periods: rows, 
      timezone: timezone, 
      model: model,
      currentMonth: month,
      currentYear: year
    });
  } catch (error) {
    logger.error('calendar.list error', { error: error.message });
    return res.fail(500, 'Failed to load calendar', error.message);
  }
});

// Helper function to process monthly calendar data
function processMonthlyCalendar(year, month, periods, timezone) {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);
  const daysInMonth = monthEnd.getDate();
  
  // Get first day of week (0 = Sunday, 1 = Monday, etc)
  const firstDayOfWeek = monthStart.getDay();
  
  // Calculate previous/next month info
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  
  // Create calendar grid (6 weeks max)
  const weeks = [];
  let currentDate = 1;
  let weekIndex = 0;
  
  // Fill calendar weeks
  for (let week = 0; week < 6 && currentDate <= daysInMonth; week++) {
    const weekDays = [];
    const weekSpans = [];
    
    // Fill 7 days for this week
    for (let day = 0; day < 7; day++) {
      if (week === 0 && day < firstDayOfWeek) {
        // Empty cells before month starts
        weekDays.push(0);
      } else if (currentDate <= daysInMonth) {
        weekDays.push(currentDate);
        currentDate++;
      } else {
        // Empty cells after month ends
        weekDays.push(0);
      }
    }
    
    // Find availability spans for this week
    periods.forEach(period => {
      const periodStart = new Date(period.start_date);
      const periodEnd = new Date(period.end_date);
      
      // Check if this period overlaps with this week
      const weekStart = new Date(year, month - 1, weekDays.find(d => d > 0) || 1);
      const weekEnd = new Date(year, month - 1, weekDays[weekDays.length - 1] || daysInMonth);
      
      if (periodStart <= weekEnd && periodEnd >= weekStart) {
        // Calculate span position and width
        const spanStart = Math.max(periodStart.getDate(), weekDays.find(d => d > 0) || 1);
        const spanEnd = Math.min(periodEnd.getDate(), weekDays[weekDays.length - 1] || daysInMonth);
        
        if (spanStart <= spanEnd) {
          const startPos = weekDays.findIndex(d => d === spanStart);
          const endPos = weekDays.findIndex(d => d === spanEnd);
          
          if (startPos !== -1 && endPos !== -1) {
            // Format location display based on service type and radius
            const locationDisplay = formatLocationDisplay(
              period.location, 
              period.service_type, 
              period.radius_miles
            );
            
            weekSpans.push({
              id: period.id,
              location: locationDisplay,
              service_type: period.service_type,
              radius_miles: period.radius_miles,
              location_details: period.location_details,
              status: period.status,
              color: period.color || getStatusColor(period.status),
              notes: period.notes,
              start_pos: startPos,
              width: (endPos - startPos + 1),
              time_display: period.all_day ? null : formatTimeRange(period.start_time, period.end_time)
            });
          }
        }
      }
    });
    
    weeks.push({
      days: weekDays,
      spans: weekSpans
    });
    
    weekIndex++;
  }
  
  return {
    year,
    month,
    monthName: getMonthName(month),
    daysInMonth,
    firstDayOfWeek,
    weeks,
    navigation: {
      prevMonth: { month: prevMonth, year: prevYear },
      nextMonth: { month: nextMonth, year: nextYear }
    }
  };
}

// Helper functions
function getStatusColor(status) {
  const colors = {
    'available': '#10B981',
    'travel': '#3B82F6', 
    'vacation': '#F59E0B',
    'unavailable': '#6B7280'
  };
  return colors[status] || '#6B7280';
}

function getMonthName(month) {
  const names = ['', 'January', 'February', 'March', 'April', 'May', 'June', 
                 'July', 'August', 'September', 'October', 'November', 'December'];
  return names[month];
}

function formatTimeRange(startTime, endTime) {
  if (!startTime || !endTime) return null;
  return `${startTime} - ${endTime}`;
}

function formatLocationDisplay(location, serviceType, radiusMiles) {
  if (!location) return 'Location TBD';
  
  const baseLocation = location;
  
  switch (serviceType) {
    case 'incall':
      return `${baseLocation} Incall`;
    
    case 'outcall':
      if (radiusMiles && radiusMiles > 0) {
        return `Outcall within ${radiusMiles} miles of ${baseLocation}`;
      }
      return `${baseLocation} Outcall`;
    
    case 'both':
      if (radiusMiles && radiusMiles > 0) {
        return `${baseLocation} Incall & Outcall within ${radiusMiles} miles`;
      }
      return `${baseLocation} Incall & Outcall`;
    
    default:
      return baseLocation;
  }
}

router.post('/:modelSlug', async (req, res) => {
  try {
    const model = await getModelBySlug(req.params.modelSlug);
    if (!model) return res.fail(404, 'Model not found');
    
    const { 
      start_date, 
      end_date, 
      all_day = 1, 
      location = null, 
      service_type = 'incall',
      radius_miles = null,
      location_details = null,
      status = 'available', 
      color = null, 
      notes = null, 
      is_visible = 1 
    } = req.body || {};
    
    if (!start_date || !end_date) return res.fail(400, 'start_date and end_date required');
    
    // Validate service_type
    const validServiceTypes = ['incall', 'outcall', 'both'];
    if (!validServiceTypes.includes(service_type)) {
      return res.fail(400, 'service_type must be incall, outcall, or both');
    }
    
    const result = await db.query(
      'INSERT INTO calendar_availability (model_id, start_date, end_date, all_day, location, service_type, radius_miles, location_details, status, color, notes, is_visible) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 
      [model.id, start_date, end_date, all_day ? 1 : 0, location, service_type, radius_miles, location_details, status, color, notes, is_visible ? 1 : 0]
    );
    
    const rows = await db.query('SELECT * FROM calendar_availability WHERE id = ?', [result.insertId]);
    return res.success({ period: rows[0] }, 201);
  } catch (error) {
    logger.error('calendar.create error', { error: error.message });
    return res.fail(500, 'Failed to add period', error.message);
  }
});

router.put('/:modelSlug/:id', async (req, res) => {
  try {
    const model = await getModelBySlug(req.params.modelSlug);
    if (!model) return res.fail(404, 'Model not found');
    
    const { 
      start_date, 
      end_date, 
      all_day = 1, 
      location = null, 
      service_type = 'incall',
      radius_miles = null,
      location_details = null,
      status = 'available', 
      color = null, 
      notes = null, 
      is_visible = 1 
    } = req.body || {};
    
    if (!start_date || !end_date) return res.fail(400, 'start_date and end_date required');
    
    // Validate service_type
    const validServiceTypes = ['incall', 'outcall', 'both'];
    if (!validServiceTypes.includes(service_type)) {
      return res.fail(400, 'service_type must be incall, outcall, or both');
    }
    
    await db.query(
      'UPDATE calendar_availability SET start_date = ?, end_date = ?, all_day = ?, location = ?, service_type = ?, radius_miles = ?, location_details = ?, status = ?, color = ?, notes = ?, is_visible = ?, updated_at = NOW() WHERE id = ? AND model_id = ?', 
      [start_date, end_date, all_day ? 1 : 0, location, service_type, radius_miles, location_details, status, color, notes, is_visible ? 1 : 0, parseInt(req.params.id), model.id]
    );
    
    const rows = await db.query('SELECT * FROM calendar_availability WHERE id = ? AND model_id = ?', [parseInt(req.params.id), model.id]);
    if (!rows.length) return res.fail(404, 'Calendar period not found');
    
    return res.success({ period: rows[0] });
  } catch (error) {
    logger.error('calendar.update error', { error: error.message });
    return res.fail(500, 'Failed to update period', error.message);
  }
});

router.put('/:modelSlug/:id/visibility', async (req, res) => {
  try {
    const model = await getModelBySlug(req.params.modelSlug);
    if (!model) return res.fail(404, 'Model not found');
    const { is_visible = 1 } = req.body || {};
    
    await db.query('UPDATE calendar_availability SET is_visible = ?, updated_at = NOW() WHERE id = ? AND model_id = ?', 
      [is_visible ? 1 : 0, parseInt(req.params.id), model.id]);
    
    const rows = await db.query('SELECT * FROM calendar_availability WHERE id = ? AND model_id = ?', [parseInt(req.params.id), model.id]);
    if (!rows.length) return res.fail(404, 'Calendar period not found');
    
    return res.success({ period: rows[0] });
  } catch (error) {
    logger.error('calendar.visibility error', { error: error.message });
    return res.fail(500, 'Failed to toggle visibility', error.message);
  }
});

router.delete('/:modelSlug/:id', async (req, res) => {
  try {
    const model = await getModelBySlug(req.params.modelSlug);
    if (!model) return res.fail(404, 'Model not found');
    await db.query('DELETE FROM calendar_availability WHERE id = ? AND model_id = ?', [parseInt(req.params.id), model.id]);
    return res.success({ deleted: true });
  } catch (error) {
    logger.error('calendar.delete error', { error: error.message });
    return res.fail(500, 'Failed to delete period', error.message);
  }
});

module.exports = router;


