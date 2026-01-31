const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { sanitizeString } = require('../utils/sanitize');

const router = express.Router();

// Rate limiting: max 10 feature requests per DJ
const MAX_REQUESTS_PER_DJ = 10;
// Rate limiting: max 1 vote per DJ per feature request
const VALID_STATUSES = ['under_consideration', 'planned', 'in_progress', 'shipped'];

function formatFeatureRequest(row, currentUserId) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    authorId: row.author_id,
    authorName: row.author_name || 'Anonymous DJ',
    voteCount: row.vote_count || 0,
    hasVoted: row.has_voted ? true : false,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// GET /roadmap - Get all feature requests (public, sorted by votes)
router.get('/roadmap', optionalAuth, (req, res) => {
  const currentUserId = req.user ? req.user.id : null;
  const { status, sort } = req.query;

  try {
    let query = `
      SELECT fr.*,
        u.display_name as author_name,
        COALESCE((SELECT COUNT(*) FROM roadmap_votes rv WHERE rv.feature_request_id = fr.id), 0) as vote_count
    `;

    if (currentUserId) {
      query += `, (SELECT COUNT(*) FROM roadmap_votes rv WHERE rv.feature_request_id = fr.id AND rv.user_id = ?) as has_voted`;
    } else {
      query += `, 0 as has_voted`;
    }

    query += `
      FROM feature_requests fr
      LEFT JOIN users u ON fr.author_id = u.id
    `;

    const params = currentUserId ? [currentUserId] : [];

    if (status && VALID_STATUSES.includes(status)) {
      query += ` WHERE fr.status = ?`;
      params.push(status);
    }

    if (sort === 'newest') {
      query += ` ORDER BY fr.created_at DESC`;
    } else {
      query += ` ORDER BY vote_count DESC, fr.created_at DESC`;
    }

    query += ` LIMIT 100`;

    const requests = db.prepare(query).all(...params);
    res.json(requests.map(r => formatFeatureRequest(r, currentUserId)));
  } catch (err) {
    console.error('Failed to fetch roadmap:', err);
    res.status(500).json({ error: 'Failed to fetch feature requests' });
  }
});

// POST /roadmap - Submit a new feature request (DJ only)
router.post('/roadmap', authenticateToken, (req, res) => {
  const { title, description } = req.body;
  const authorId = req.user.id;

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Title is required' });
  }
  if (title.trim().length > 200) {
    return res.status(400).json({ error: 'Title must be 200 characters or less' });
  }
  if (description && description.length > 2000) {
    return res.status(400).json({ error: 'Description must be 2000 characters or less' });
  }

  // Rate limit: max requests per DJ
  const existingCount = db.prepare(
    'SELECT COUNT(*) as cnt FROM feature_requests WHERE author_id = ?'
  ).get(authorId);

  if ((existingCount?.cnt || 0) >= MAX_REQUESTS_PER_DJ) {
    return res.status(429).json({ error: 'You have reached the maximum number of feature requests (' + MAX_REQUESTS_PER_DJ + ')' });
  }

  try {
    const id = uuidv4();
    const cleanTitle = sanitizeString(title.trim());
    const cleanDescription = description ? sanitizeString(description.trim()) : null;

    db.prepare(`
      INSERT INTO feature_requests (id, title, description, author_id, status)
      VALUES (?, ?, ?, ?, 'under_consideration')
    `).run(id, cleanTitle, cleanDescription, authorId);

    // Auto-upvote by author
    db.prepare(`
      INSERT INTO roadmap_votes (id, feature_request_id, user_id)
      VALUES (?, ?, ?)
    `).run(uuidv4(), id, authorId);

    const request = db.prepare(`
      SELECT fr.*, u.display_name as author_name,
        1 as vote_count, 1 as has_voted
      FROM feature_requests fr
      LEFT JOIN users u ON fr.author_id = u.id
      WHERE fr.id = ?
    `).get(id);

    res.status(201).json(formatFeatureRequest(request, authorId));
  } catch (err) {
    console.error('Failed to create feature request:', err);
    res.status(500).json({ error: 'Failed to create feature request' });
  }
});

// POST /roadmap/:id/vote - Toggle vote on a feature request (DJ only)
router.post('/roadmap/:id/vote', authenticateToken, (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const featureRequest = db.prepare('SELECT id FROM feature_requests WHERE id = ?').get(id);
  if (!featureRequest) {
    return res.status(404).json({ error: 'Feature request not found' });
  }

  try {
    const existingVote = db.prepare(
      'SELECT id FROM roadmap_votes WHERE feature_request_id = ? AND user_id = ?'
    ).get(id, userId);

    if (existingVote) {
      // Remove vote (toggle off)
      db.prepare('DELETE FROM roadmap_votes WHERE id = ?').run(existingVote.id);
    } else {
      // Add vote
      db.prepare(`
        INSERT INTO roadmap_votes (id, feature_request_id, user_id)
        VALUES (?, ?, ?)
      `).run(uuidv4(), id, userId);
    }

    const voteCount = db.prepare(
      'SELECT COUNT(*) as cnt FROM roadmap_votes WHERE feature_request_id = ?'
    ).get(id);

    res.json({
      voted: !existingVote,
      voteCount: voteCount?.cnt || 0
    });
  } catch (err) {
    console.error('Failed to toggle vote:', err);
    res.status(500).json({ error: 'Failed to update vote' });
  }
});

// PUT /roadmap/:id/status - Update status of a feature request (DJ who authored OR admin)
router.put('/roadmap/:id/status', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const userId = req.user.id;

  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Invalid status. Must be: ' + VALID_STATUSES.join(', ') });
  }

  const featureRequest = db.prepare('SELECT id, author_id FROM feature_requests WHERE id = ?').get(id);
  if (!featureRequest) {
    return res.status(404).json({ error: 'Feature request not found' });
  }

  // Only author can update status (acts as admin for their own requests)
  // In a real app, you'd have a separate admin role
  if (featureRequest.author_id !== userId) {
    return res.status(403).json({ error: 'Only the author can update the status' });
  }

  try {
    db.prepare(`
      UPDATE feature_requests SET status = ?, updated_at = datetime('now') WHERE id = ?
    `).run(status, id);

    res.json({ id, status, message: 'Status updated successfully' });
  } catch (err) {
    console.error('Failed to update status:', err);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// DELETE /roadmap/:id - Delete a feature request (author only)
router.delete('/roadmap/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const featureRequest = db.prepare('SELECT id, author_id FROM feature_requests WHERE id = ?').get(id);
  if (!featureRequest) {
    return res.status(404).json({ error: 'Feature request not found' });
  }

  if (featureRequest.author_id !== userId) {
    return res.status(403).json({ error: 'Only the author can delete this request' });
  }

  try {
    db.prepare('DELETE FROM roadmap_votes WHERE feature_request_id = ?').run(id);
    db.prepare('DELETE FROM feature_requests WHERE id = ?').run(id);
    res.json({ message: 'Feature request deleted successfully' });
  } catch (err) {
    console.error('Failed to delete feature request:', err);
    res.status(500).json({ error: 'Failed to delete feature request' });
  }
});

module.exports = router;
