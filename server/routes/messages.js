const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { sanitizeString } = require('../utils/sanitize');

const router = express.Router();

// Helper function to format message
function formatMessage(row) {
  return {
    id: row.id,
    eventId: row.event_id,
    content: row.content,
    targetAudience: row.target_audience,
    type: row.type,
    createdAt: row.created_at
  };
}

// POST /events/:eventId/messages - Create a DJ message (DJ only, requires auth)
router.post('/events/:eventId/messages', authenticateToken, (req, res) => {
  const { eventId } = req.params;
  const { content, targetAudience = 'all' } = req.body;
  const djId = req.user.id;

  // Validate content
  if (!content || typeof content !== 'string' || !content.trim()) {
    return res.status(400).json({ error: 'Message content is required' });
  }

  // Verify event ownership
  const event = db.prepare('SELECT dj_id FROM events WHERE id = ?').get(eventId);
  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }
  if (event.dj_id !== djId) {
    return res.status(403).json({ error: 'Only the event DJ can send messages' });
  }

  // Insert message
  const messageId = uuidv4();
  const sanitizedContent = sanitizeString(content.trim());

  try {
    db.prepare(`
      INSERT INTO messages (id, event_id, dj_id, content, target_audience, type)
      VALUES (?, ?, ?, ?, ?, 'custom')
    `).run(messageId, eventId, djId, sanitizedContent, targetAudience);

    const message = db.prepare(`
      SELECT id, event_id, content, target_audience, type, created_at
      FROM messages
      WHERE id = ?
    `).get(messageId);

    res.status(201).json(formatMessage(message));
  } catch (err) {
    console.error('Failed to create message:', err);
    res.status(500).json({ error: 'Failed to create message' });
  }
});

// GET /events/:eventId/messages - List all messages for an event (public, no auth)
router.get('/events/:eventId/messages', (req, res) => {
  const { eventId } = req.params;

  // Verify event exists
  const event = db.prepare('SELECT id FROM events WHERE id = ?').get(eventId);
  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }

  try {
    const messages = db.prepare(`
      SELECT id, event_id, content, target_audience, type, created_at
      FROM messages
      WHERE event_id = ?
      ORDER BY created_at DESC
    `).all(eventId);

    res.json(messages.map(formatMessage));
  } catch (err) {
    console.error('Failed to fetch messages:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// DELETE /events/:eventId/messages/:messageId - Delete a message (DJ only, requires auth)
router.delete('/events/:eventId/messages/:messageId', authenticateToken, (req, res) => {
  const { eventId, messageId } = req.params;
  const djId = req.user.id;

  // Verify event ownership
  const event = db.prepare('SELECT dj_id FROM events WHERE id = ?').get(eventId);
  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }
  if (event.dj_id !== djId) {
    return res.status(403).json({ error: 'Only the event DJ can delete messages' });
  }

  // Verify message belongs to this event
  const message = db.prepare('SELECT event_id FROM messages WHERE id = ?').get(messageId);
  if (!message) {
    return res.status(404).json({ error: 'Message not found' });
  }
  if (message.event_id !== eventId) {
    return res.status(400).json({ error: 'Message does not belong to this event' });
  }

  try {
    db.prepare('DELETE FROM messages WHERE id = ?').run(messageId);
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to delete message:', err);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

module.exports = router;
