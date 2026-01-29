const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { sanitizeString } = require('../utils/sanitize');
const { containsProfanity, filterProfanity } = require('../utils/profanity');

const router = express.Router();

// GET /api/events/:eventId/public - Get public event info (no auth required)
router.get('/events/:eventId/public', (req, res) => {
  try {
    const event = db.prepare('SELECT id, name, date, start_time, end_time, location, description, status, settings FROM events WHERE id = ?').get(req.params.eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json({
      id: event.id,
      name: event.name,
      date: event.date,
      startTime: event.start_time,
      endTime: event.end_time,
      location: event.location,
      description: event.description,
      status: event.status,
      settings: JSON.parse(event.settings || '{}')
    });
  } catch (err) {
    console.error('Get public event error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// POST /api/events/:eventId/requests - Submit song request (attendee - no auth required)
router.post('/events/:eventId/requests', (req, res) => {
  try {
    const { eventId } = req.params;
    const { songTitle, artistName, albumArtUrl, durationMs, explicitFlag, itunesTrackId, requestedBy, nickname, message } = req.body;

    if (!songTitle || !artistName || !requestedBy) {
      return res.status(400).json({ error: 'Song title, artist name, and requester ID are required' });
    }

    // Sanitize user inputs against XSS
    const cleanSongTitle = sanitizeString(songTitle);
    const cleanArtistName = sanitizeString(artistName);
    const cleanNickname = nickname ? sanitizeString(nickname) : null;
    const cleanMessage = message ? sanitizeString(message) : null;
    const cleanRequestedBy = sanitizeString(requestedBy);

    // Check event exists
    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check request limit per attendee
    const settings = JSON.parse(event.settings || '{}');
    if (settings.requestLimit && settings.requestLimit > 0) {
      const existingCount = db.prepare('SELECT COUNT(*) as count FROM requests WHERE event_id = ? AND requested_by = ?')
        .get(eventId, requestedBy).count;
      if (existingCount >= settings.requestLimit) {
        return res.status(429).json({
          error: `Request limit reached. Maximum ${settings.requestLimit} requests per attendee.`,
          limit: settings.requestLimit,
          current: existingCount
        });
      }
    }

    // Check cooldown period between requests
    if (settings.cooldownMinutes && settings.cooldownMinutes > 0) {
      const lastRequest = db.prepare(
        'SELECT created_at FROM requests WHERE event_id = ? AND requested_by = ? ORDER BY created_at DESC LIMIT 1'
      ).get(eventId, requestedBy);

      if (lastRequest) {
        const lastTime = new Date(lastRequest.created_at + 'Z').getTime();
        const now = Date.now();
        const cooldownMs = settings.cooldownMinutes * 60 * 1000;
        const elapsed = now - lastTime;

        if (elapsed < cooldownMs) {
          const remainingSec = Math.ceil((cooldownMs - elapsed) / 1000);
          const remainingMin = Math.ceil(remainingSec / 60);
          return res.status(429).json({
            error: `Please wait ${remainingMin} minute(s) before submitting another request.`,
            cooldownMinutes: settings.cooldownMinutes,
            retryAfterSeconds: remainingSec
          });
        }
      }
    }

    // Check explicit content blocking
    if (settings.blockExplicit && explicitFlag) {
      return res.status(403).json({
        error: 'Explicit content is not allowed for this event.',
        blocked: true,
        reason: 'explicit'
      });
    }

    // Profanity filter on messages and nicknames
    let filteredMessage = cleanMessage;
    let filteredNickname = cleanNickname;
    if (settings.filterProfanity) {
      if (cleanMessage && containsProfanity(cleanMessage)) {
        filteredMessage = filterProfanity(cleanMessage);
      }
      if (cleanNickname && containsProfanity(cleanNickname)) {
        filteredNickname = filterProfanity(cleanNickname);
      }
    }

    const id = uuidv4();
    db.prepare(`INSERT INTO requests (id, event_id, song_title, artist_name, album_art_url, duration_ms, explicit_flag, itunes_track_id, requested_by, nickname, message)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, eventId, cleanSongTitle, cleanArtistName, albumArtUrl || null, durationMs || null, explicitFlag ? 1 : 0, itunesTrackId || null, cleanRequestedBy, filteredNickname, filteredMessage);

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


// PUT /api/events/:eventId/requests/bulk-reject - Bulk reject requests (DJ only)
router.put('/events/:eventId/requests/bulk-reject', authenticateToken, (req, res) => {
  try {
    const { eventId } = req.params;
    const { requestIds } = req.body;

    if (!Array.isArray(requestIds) || requestIds.length === 0) {
      return res.status(400).json({ error: 'requestIds array is required' });
    }

    // Verify event ownership
    const event = db.prepare('SELECT * FROM events WHERE id = ? AND dj_id = ?').get(eventId, req.user.id);
    if (!event) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const updateStmt = db.prepare('UPDATE requests SET status = ?, updated_at = datetime(\'now\') WHERE id = ? AND event_id = ?');
    const updateMany = db.transaction((ids) => {
      let updated = 0;
      for (const id of ids) {
        const result = updateStmt.run('rejected', id, eventId);
        updated += result.changes;
      }
      return updated;
    });

    const count = updateMany(requestIds);
    res.json({ message: `${count} requests rejected`, count });
  } catch (err) {
    console.error('Bulk reject error:', err);
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
