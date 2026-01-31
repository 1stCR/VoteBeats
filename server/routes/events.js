const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { sanitizeString } = require('../utils/sanitize');

const router = express.Router();

// Helper to safely parse settings that may be double-encoded
function parseSettings(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    let parsed = JSON.parse(raw);
    // Handle double-encoded: if we parsed and got a string, parse again
    if (typeof parsed === 'string') {
      parsed = JSON.parse(parsed);
    }
    return parsed || {};
  } catch (e) {
    return {};
  }
}

// Helper to ensure settings is a proper JSON string for DB storage
function settingsToJson(settings) {
  if (!settings) return JSON.stringify({});
  if (typeof settings === 'string') {
    // If already a string, check if it's valid JSON
    try {
      JSON.parse(settings);
      return settings; // Already a valid JSON string
    } catch (e) {
      return JSON.stringify({});
    }
  }
  return JSON.stringify(settings);
}

// ALL event management routes require authentication
router.use(authenticateToken);

// POST /api/events - Create event
router.post('/', (req, res) => {
  try {
    const { name, date, startTime, endTime, location, description, settings } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Event name is required' });
    }

    // Sanitize user inputs
    const cleanName = sanitizeString(name);
    const cleanLocation = location ? sanitizeString(location) : null;
    const cleanDescription = description ? sanitizeString(description) : null;

    const id = uuidv4();
    const settingsJson = settingsToJson(settings);

    db.prepare(`INSERT INTO events (id, dj_id, name, date, start_time, end_time, location, description, settings)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, req.user.id, cleanName, date || null, startTime || null, endTime || null, cleanLocation, cleanDescription, settingsJson);

    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
    res.status(201).json(formatEvent(event));
  } catch (err) {
    console.error('Create event error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/events - List DJ's events
router.get('/', (req, res) => {
  try {
    const events = db.prepare('SELECT * FROM events WHERE dj_id = ? ORDER BY created_at DESC').all(req.user.id);
    res.json(events.map(formatEvent));
  } catch (err) {
    console.error('List events error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/events/:id - Get event details
router.get('/:id', (req, res) => {
  try {
    const event = db.prepare('SELECT * FROM events WHERE id = ? AND dj_id = ?').get(req.params.id, req.user.id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json(formatEvent(event));
  } catch (err) {
    console.error('Get event error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/events/:id - Update event
router.put('/:id', (req, res) => {
  try {
    const event = db.prepare('SELECT * FROM events WHERE id = ? AND dj_id = ?').get(req.params.id, req.user.id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const { name, date, startTime, endTime, location, description, status, settings } = req.body;

    // Sanitize user inputs
    const cleanName = name ? sanitizeString(name) : undefined;
    const cleanLocation = location ? sanitizeString(location) : undefined;
    const cleanDescription = description ? sanitizeString(description) : undefined;

    db.prepare(`UPDATE events SET
      name = COALESCE(?, name),
      date = COALESCE(?, date),
      start_time = COALESCE(?, start_time),
      end_time = COALESCE(?, end_time),
      location = COALESCE(?, location),
      description = COALESCE(?, description),
      status = COALESCE(?, status),
      settings = COALESCE(?, settings),
      updated_at = datetime('now')
      WHERE id = ?`)
      .run(cleanName, date, startTime, endTime, cleanLocation, cleanDescription, status, settings ? settingsToJson(settings) : null, req.params.id);

    const updated = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
    res.json(formatEvent(updated));
  } catch (err) {
    console.error('Update event error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/events/:id - Delete event
router.delete('/:id', (req, res) => {
  try {
    const event = db.prepare('SELECT * FROM events WHERE id = ? AND dj_id = ?').get(req.params.id, req.user.id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Delete associated data
    db.prepare('DELETE FROM messages WHERE event_id = ?').run(req.params.id);
    db.prepare('DELETE FROM votes WHERE request_id IN (SELECT id FROM requests WHERE event_id = ?)').run(req.params.id);
    db.prepare('DELETE FROM requests WHERE event_id = ?').run(req.params.id);
    db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);

    res.json({ message: 'Event deleted successfully' });
  } catch (err) {
    console.error('Delete event error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

function formatEvent(event) {
  return {
    id: event.id,
    djId: event.dj_id,
    name: event.name,
    date: event.date,
    startTime: event.start_time,
    endTime: event.end_time,
    location: event.location,
    description: event.description,
    status: event.status,
    settings: parseSettings(event.settings),
    createdAt: event.created_at,
    updatedAt: event.updated_at
  };
}

module.exports = router;
