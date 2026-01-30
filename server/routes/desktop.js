const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { generateToken, authenticateToken } = require('../middleware/auth');

const router = express.Router();

// POST /api/desktop/auth - Authenticate desktop helper application
router.post('/auth', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const validPassword = bcrypt.compareSync(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateToken(user);

    res.json({
      user: { id: user.id, email: user.email, displayName: user.display_name },
      token,
      source: 'desktop-helper'
    });
  } catch (err) {
    console.error('Desktop auth error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/events/:eventId/now-playing - Update now playing from desktop helper
router.post('/events/:eventId/now-playing', authenticateToken, (req, res) => {
  try {
    const { eventId } = req.params;
    const { songTitle, artistName, spotifyUri, position, duration, status } = req.body;

    if (!songTitle || !artistName) {
      return res.status(400).json({ error: 'Song title and artist name are required' });
    }

    // Verify user owns this event
    const event = db.prepare('SELECT * FROM events WHERE id = ? AND dj_id = ?').get(eventId, req.user.id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found or unauthorized' });
    }

    // Try to find matching request in queue using fuzzy matching
    const requests = db.prepare(
      "SELECT * FROM requests WHERE event_id = ? AND status IN ('queued', 'nowPlaying') ORDER BY manual_order ASC, vote_count DESC"
    ).all(eventId);

    let matchedRequest = null;

    // Exact match first
    matchedRequest = requests.find(r =>
      r.song_title.toLowerCase() === songTitle.toLowerCase() &&
      r.artist_name.toLowerCase() === artistName.toLowerCase()
    );

    // Fuzzy match if no exact match
    if (!matchedRequest) {
      matchedRequest = requests.find(r => {
        const titleMatch = r.song_title.toLowerCase().includes(songTitle.toLowerCase()) ||
          songTitle.toLowerCase().includes(r.song_title.toLowerCase());
        const artistMatch = r.artist_name.toLowerCase().includes(artistName.toLowerCase()) ||
          artistName.toLowerCase().includes(r.artist_name.toLowerCase());
        return titleMatch && artistMatch;
      });
    }

    // If we found a match, update its status
    if (matchedRequest) {
      const newStatus = status || 'nowPlaying';

      // If marking as now playing, first mark any current now-playing as played
      if (newStatus === 'nowPlaying') {
        db.prepare(
          "UPDATE requests SET status = 'played', updated_at = datetime('now') WHERE event_id = ? AND status = 'nowPlaying'"
        ).run(eventId);
      }

      db.prepare(
        "UPDATE requests SET status = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(newStatus, matchedRequest.id);

      return res.json({
        success: true,
        matched: true,
        requestId: matchedRequest.id,
        title: matchedRequest.song_title,
        artist: matchedRequest.artist_name,
        status: newStatus,
        spotifyUri: spotifyUri || null,
        position: position || 0,
        duration: duration || 0
      });
    }

    // No match found - still acknowledge the update
    return res.json({
      success: true,
      matched: false,
      message: 'Song detected but no matching request found in queue',
      songTitle,
      artistName,
      position: position || 0,
      duration: duration || 0
    });
  } catch (err) {
    console.error('Now playing update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/events/:eventId/sync - Batch sync offline updates
router.post('/events/:eventId/sync', authenticateToken, (req, res) => {
  try {
    const { eventId } = req.params;
    const { updates } = req.body;

    if (!updates || !Array.isArray(updates)) {
      return res.status(400).json({ error: 'Updates array is required' });
    }

    // Verify user owns this event
    const event = db.prepare('SELECT * FROM events WHERE id = ? AND dj_id = ?').get(eventId, req.user.id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found or unauthorized' });
    }

    const results = [];

    for (const update of updates) {
      const { songTitle, artistName, status, timestamp } = update;

      // Find matching request
      const request = db.prepare(
        "SELECT * FROM requests WHERE event_id = ? AND LOWER(song_title) = LOWER(?) AND LOWER(artist_name) = LOWER(?)"
      ).get(eventId, songTitle, artistName);

      if (request) {
        // Only update if the offline update is newer
        db.prepare(
          "UPDATE requests SET status = ?, updated_at = datetime('now') WHERE id = ?"
        ).run(status || 'played', request.id);

        results.push({ songTitle, artistName, matched: true, status: status || 'played' });
      } else {
        results.push({ songTitle, artistName, matched: false });
      }
    }

    res.json({
      success: true,
      synced: results.length,
      results
    });
  } catch (err) {
    console.error('Sync error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/desktop/status - Check desktop helper connection status
router.get('/status', authenticateToken, (req, res) => {
  res.json({
    connected: true,
    user: { id: req.user.id, email: req.user.email },
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
