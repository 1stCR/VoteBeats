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

// GET /events/:eventId/messages - List messages for an event (public, with optional audience filtering)
router.get('/events/:eventId/messages', (req, res) => {
  const { eventId } = req.params;
  const { userId } = req.query; // attendee's anonymous ID for audience filtering

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

    // If no userId provided (e.g. DJ view), return all messages with read counts
    if (!userId) {
      const messagesWithReads = messages.map(msg => {
        const readCount = db.prepare(
          'SELECT COUNT(*) as cnt FROM message_reads WHERE message_id = ?'
        ).get(msg.id);
        return {
          ...formatMessage(msg),
          readCount: readCount?.cnt || 0,
        };
      });
      return res.json(messagesWithReads);
    }

    // Filter messages based on target_audience and attendee activity
    const filteredMessages = messages.filter(msg => {
      const audience = msg.target_audience;

      // 'all' messages go to everyone
      if (audience === 'all') return true;

      if (audience === 'no_requests') {
        // People who haven't submitted any requests
        const requestCount = db.prepare(
          'SELECT COUNT(*) as cnt FROM requests WHERE event_id = ? AND requested_by = ?'
        ).get(eventId, userId);
        return (requestCount?.cnt || 0) === 0;
      }

      if (audience === 'top_voters') {
        // People who have voted on at least 3 songs
        const voteCount = db.prepare(
          'SELECT COUNT(*) as cnt FROM votes WHERE user_id = ? AND request_id IN (SELECT id FROM requests WHERE event_id = ?)'
        ).get(userId, eventId);
        return (voteCount?.cnt || 0) >= 3;
      }

      if (audience === 'played_requesters') {
        // People whose at least one request has been played
        const playedCount = db.prepare(
          'SELECT COUNT(*) as cnt FROM requests WHERE event_id = ? AND requested_by = ? AND status = ?'
        ).get(eventId, userId, 'played');
        return (playedCount?.cnt || 0) > 0;
      }

      // Unknown audience type - show it to be safe
      return true;
    });

    res.json(filteredMessages.map(formatMessage));
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

// POST /events/:eventId/messages/:messageId/read - Mark a message as read by attendee
router.post('/events/:eventId/messages/:messageId/read', (req, res) => {
  const { eventId, messageId } = req.params;
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  // Verify message exists and belongs to this event
  const message = db.prepare('SELECT event_id FROM messages WHERE id = ?').get(messageId);
  if (!message) {
    return res.status(404).json({ error: 'Message not found' });
  }
  if (message.event_id !== eventId) {
    return res.status(400).json({ error: 'Message does not belong to this event' });
  }

  try {
    const readId = uuidv4();
    db.prepare(`
      INSERT OR IGNORE INTO message_reads (id, message_id, user_id)
      VALUES (?, ?, ?)
    `).run(readId, messageId, userId);

    res.json({ success: true });
  } catch (err) {
    console.error('Failed to mark message as read:', err);
    res.status(500).json({ error: 'Failed to mark message as read' });
  }
});

// GET /events/:eventId/messages/:messageId/reads - Get read stats for a message (DJ only)
router.get('/events/:eventId/messages/:messageId/reads', authenticateToken, (req, res) => {
  const { eventId, messageId } = req.params;
  const djId = req.user.id;

  // Verify event ownership
  const event = db.prepare('SELECT dj_id FROM events WHERE id = ?').get(eventId);
  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }
  if (event.dj_id !== djId) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  try {
    const readCount = db.prepare(
      'SELECT COUNT(*) as cnt FROM message_reads WHERE message_id = ?'
    ).get(messageId);

    res.json({ messageId, readCount: readCount?.cnt || 0 });
  } catch (err) {
    console.error('Failed to get read stats:', err);
    res.status(500).json({ error: 'Failed to get read stats' });
  }
});

module.exports = router;
