const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { sanitizeString } = require('../utils/sanitize');

const router = express.Router();

// Rate limiting: max 5 feedback submissions per attendee per event
const FEEDBACK_LIMIT_PER_USER = 5;

// Helper function to format feedback
function formatFeedback(row) {
  return {
    id: row.id,
    eventId: row.event_id,
    userType: row.user_type,
    userId: row.user_id,
    feedbackType: row.feedback_type,
    rating: row.rating,
    message: row.message,
    email: row.email,
    createdAt: row.created_at
  };
}

// POST /events/:eventId/feedback - Submit feedback (public, no auth required for attendees)
router.post('/events/:eventId/feedback', (req, res) => {
  const { eventId } = req.params;
  const { feedbackType = 'praise', rating, message, email, userId, userType = 'attendee' } = req.body;

  // Validate event exists
  const event = db.prepare('SELECT id, name FROM events WHERE id = ?').get(eventId);
  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }

  // Validate feedbackType
  const validTypes = ['bug', 'suggestion', 'praise'];
  if (!validTypes.includes(feedbackType)) {
    return res.status(400).json({ error: 'Invalid feedback type. Must be: bug, suggestion, or praise' });
  }

  // Validate rating if provided (1-5)
  if (rating !== undefined && rating !== null) {
    const numRating = Number(rating);
    if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }
  }

  // Must have either a rating or a message
  if (!rating && (!message || !message.trim())) {
    return res.status(400).json({ error: 'Please provide a rating or a message' });
  }

  // Rate limiting: check how many feedbacks this user has submitted for this event
  if (userId) {
    const existingCount = db.prepare(
      'SELECT COUNT(*) as cnt FROM feedback WHERE event_id = ? AND user_id = ?'
    ).get(eventId, userId);

    if ((existingCount?.cnt || 0) >= FEEDBACK_LIMIT_PER_USER) {
      return res.status(429).json({ error: 'You have already submitted the maximum number of feedback entries for this event' });
    }
  }

  try {
    const feedbackId = uuidv4();
    const sanitizedMessage = message ? sanitizeString(message.trim()) : null;
    const sanitizedEmail = email ? sanitizeString(email.trim()) : null;

    db.prepare(`
      INSERT INTO feedback (id, event_id, user_type, user_id, feedback_type, rating, message, email)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(feedbackId, eventId, userType, userId || null, feedbackType, rating || null, sanitizedMessage, sanitizedEmail);

    const feedback = db.prepare('SELECT * FROM feedback WHERE id = ?').get(feedbackId);

    // Log notification to console (dev mode email/webhook substitute)
    console.log('\n========================================');
    console.log('NEW FEEDBACK RECEIVED');
    console.log('========================================');
    console.log('Event: ' + event.name + ' (' + eventId + ')');
    console.log('Type: ' + feedbackType);
    console.log('From: ' + userType + (sanitizedEmail ? ' (' + sanitizedEmail + ')' : ''));
    if (rating) console.log('Rating: ' + rating + '/5');
    if (sanitizedMessage) console.log('Message: ' + sanitizedMessage);
    console.log('========================================\n');

    res.status(201).json(formatFeedback(feedback));
  } catch (err) {
    console.error('Failed to submit feedback:', err);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

// GET /events/:eventId/feedback - Get feedback for an event (DJ only, requires auth)
router.get('/events/:eventId/feedback', authenticateToken, (req, res) => {
  const { eventId } = req.params;
  const djId = req.user.id;

  // Verify event ownership
  const event = db.prepare('SELECT dj_id FROM events WHERE id = ?').get(eventId);
  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }
  if (event.dj_id !== djId) {
    return res.status(403).json({ error: 'Only the event DJ can view feedback' });
  }

  try {
    const feedbackList = db.prepare(`
      SELECT * FROM feedback WHERE event_id = ? ORDER BY created_at DESC
    `).all(eventId);

    res.json(feedbackList.map(formatFeedback));
  } catch (err) {
    console.error('Failed to fetch feedback:', err);
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

// GET /feedback/all - Get all feedback across all events for the DJ (DJ only, requires auth)
router.get('/feedback/all', authenticateToken, (req, res) => {
  const djId = req.user.id;

  try {
    const feedbackList = db.prepare(`
      SELECT f.*, e.name as event_name
      FROM feedback f
      JOIN events e ON f.event_id = e.id
      WHERE e.dj_id = ?
      ORDER BY f.created_at DESC
      LIMIT 100
    `).all(djId);

    res.json(feedbackList.map(row => ({
      ...formatFeedback(row),
      eventName: row.event_name
    })));
  } catch (err) {
    console.error('Failed to fetch all feedback:', err);
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

// GET /feedback/stats - Get aggregate feedback stats for the DJ (DJ only, requires auth)
router.get('/feedback/stats', authenticateToken, (req, res) => {
  const djId = req.user.id;

  try {
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total,
        AVG(CASE WHEN f.rating IS NOT NULL THEN f.rating END) as avg_rating,
        SUM(CASE WHEN f.feedback_type = 'bug' THEN 1 ELSE 0 END) as bugs,
        SUM(CASE WHEN f.feedback_type = 'suggestion' THEN 1 ELSE 0 END) as suggestions,
        SUM(CASE WHEN f.feedback_type = 'praise' THEN 1 ELSE 0 END) as praise
      FROM feedback f
      JOIN events e ON f.event_id = e.id
      WHERE e.dj_id = ?
    `).get(djId);

    res.json({
      total: stats.total || 0,
      avgRating: stats.avg_rating ? Number(stats.avg_rating.toFixed(1)) : null,
      bugs: stats.bugs || 0,
      suggestions: stats.suggestions || 0,
      praise: stats.praise || 0
    });
  } catch (err) {
    console.error('Failed to fetch feedback stats:', err);
    res.status(500).json({ error: 'Failed to fetch feedback stats' });
  }
});

module.exports = router;
