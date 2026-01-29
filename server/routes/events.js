const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// ALL event management routes require authentication
router.use(authenticateToken);

// POST /api/events - Create event
router.post('/', (req, res) => {
  try {
    const { name, date, startTime, endTime, location, description, settings } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Event name is required' });
    }

    const id = uuidv4();
    const settingsJson = JSON.stringify(settings || {});

    db.prepare(`INSERT INTO events (id, dj_id, name, date, start_time, end_time, location, description, settings)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, req.user.id, name, date || null, startTime || null, endTime || null, location || null, description || null, settingsJson);

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
      .run(name, date, startTime, endTime, location, description, status, settings ? JSON.stringify(settings) : null, req.params.id);

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
    settings: JSON.parse(event.settings || '{}'),
    createdAt: event.created_at,
    updatedAt: event.updated_at
  };
}

module.exports = router;
