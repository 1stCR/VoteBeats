const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// POST /api/events/:eventId/requests - Submit song request (attendee - no auth required)
router.post('/events/:eventId/requests', (req, res) => {
  try {
    const { eventId } = req.params;
    const { songTitle, artistName, albumArtUrl, durationMs, explicitFlag, itunesTrackId, requestedBy, nickname, message } = req.body;

    if (!songTitle || !artistName || !requestedBy) {
      return res.status(400).json({ error: 'Song title, artist name, and requester ID are required' });
    }

    // Check event exists
    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const id = uuidv4();
    db.prepare(`INSERT INTO requests (id, event_id, song_title, artist_name, album_art_url, duration_ms, explicit_flag, itunes_track_id, requested_by, nickname, message)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, eventId, songTitle, artistName, albumArtUrl || null, durationMs || null, explicitFlag ? 1 : 0, itunesTrackId || null, requestedBy, nickname || null, message || null);

    const request = db.prepare('SELECT * FROM requests WHERE id = ?').get(id);
    res.status(201).json(formatRequest(request));
  } catch (err) {
    console.error('Create request error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/events/:eventId/requests - List requests (public for attendees, or authenticated for DJ)
router.get('/events/:eventId/requests', (req, res) => {
  try {
    const { eventId } = req.params;
    const requests = db.prepare('SELECT * FROM requests WHERE event_id = ? ORDER BY vote_count DESC, created_at ASC').all(eventId);
    res.json(requests.map(formatRequest));
  } catch (err) {
    console.error('List requests error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/events/:eventId/requests/:requestId/status - Update request status (DJ only)
router.put('/events/:eventId/requests/:requestId/status', authenticateToken, (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'queued', 'nowPlaying', 'played', 'rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const request = db.prepare('SELECT r.*, e.dj_id FROM requests r JOIN events e ON r.event_id = e.id WHERE r.id = ? AND r.event_id = ?')
      .get(req.params.requestId, req.params.eventId);

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.dj_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    db.prepare('UPDATE requests SET status = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(status, req.params.requestId);

    const updated = db.prepare('SELECT * FROM requests WHERE id = ?').get(req.params.requestId);
    res.json(formatRequest(updated));
  } catch (err) {
    console.error('Update request status error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/events/:eventId/requests/:requestId - Remove request (DJ only)
router.delete('/events/:eventId/requests/:requestId', authenticateToken, (req, res) => {
  try {
    const request = db.prepare('SELECT r.*, e.dj_id FROM requests r JOIN events e ON r.event_id = e.id WHERE r.id = ? AND r.event_id = ?')
      .get(req.params.requestId, req.params.eventId);

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.dj_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    db.prepare('DELETE FROM votes WHERE request_id = ?').run(req.params.requestId);
    db.prepare('DELETE FROM requests WHERE id = ?').run(req.params.requestId);

    res.json({ message: 'Request deleted successfully' });
  } catch (err) {
    console.error('Delete request error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/events/:eventId/requests/:requestId/vote - Upvote (attendee)
router.post('/events/:eventId/requests/:requestId/vote', (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const request = db.prepare('SELECT * FROM requests WHERE id = ? AND event_id = ?')
      .get(req.params.requestId, req.params.eventId);
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Check if already voted
    const existingVote = db.prepare('SELECT * FROM votes WHERE request_id = ? AND user_id = ?')
      .get(req.params.requestId, userId);
    if (existingVote) {
      return res.status(409).json({ error: 'Already voted for this request' });
    }

    const voteId = uuidv4();
    db.prepare('INSERT INTO votes (id, request_id, user_id) VALUES (?, ?, ?)')
      .run(voteId, req.params.requestId, userId);

    // Update vote count
    db.prepare('UPDATE requests SET vote_count = vote_count + 1, updated_at = datetime(\'now\') WHERE id = ?')
      .run(req.params.requestId);

    const updated = db.prepare('SELECT * FROM requests WHERE id = ?').get(req.params.requestId);
    res.json(formatRequest(updated));
  } catch (err) {
    console.error('Vote error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

function formatRequest(req) {
  return {
    id: req.id,
    eventId: req.event_id,
    song: {
      title: req.song_title,
      artist: req.artist_name,
      albumArtUrl: req.album_art_url,
      durationMs: req.duration_ms,
      explicitFlag: !!req.explicit_flag,
      itunesTrackId: req.itunes_track_id
    },
    requestedBy: {
      userId: req.requested_by,
      nickname: req.nickname
    },
    message: req.message,
    status: req.status,
    voteCount: req.vote_count,
    manualOrder: req.manual_order,
    djNotes: req.dj_notes,
    preppedInSpotify: !!req.prepped_in_spotify,
    createdAt: req.created_at,
    updatedAt: req.updated_at
  };
}

module.exports = router;
