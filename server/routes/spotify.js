const express = require('express');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All Spotify routes require authentication
router.use(authenticateToken);

// GET /api/spotify/status - Get Spotify connection status
router.get('/status', (req, res) => {
  try {
    const user = db.prepare(
      'SELECT spotify_connected, spotify_display_name, spotify_email, spotify_connected_at FROM users WHERE id = ?'
    ).get(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      connected: !!user.spotify_connected,
      displayName: user.spotify_display_name || null,
      email: user.spotify_email || null,
      connectedAt: user.spotify_connected_at || null,
    });
  } catch (err) {
    console.error('Get Spotify status error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/spotify/connect - Connect Spotify account (simulated OAuth)
// In production, this would initiate Spotify OAuth flow
// In development, we simulate the connection with provided display name
router.post('/connect', (req, res) => {
  try {
    const { spotifyDisplayName, spotifyEmail } = req.body;

    // Simulate OAuth - in production this would happen via Spotify callback
    const displayName = spotifyDisplayName || 'Spotify User';
    const email = spotifyEmail || `${req.user.email}`;

    db.prepare(
      `UPDATE users SET
        spotify_connected = 1,
        spotify_display_name = ?,
        spotify_email = ?,
        spotify_connected_at = datetime('now'),
        updated_at = datetime('now')
      WHERE id = ?`
    ).run(displayName, email, req.user.id);

    console.log(`[Spotify] DJ ${req.user.id} connected Spotify account: ${displayName} (${email})`);

    res.json({
      connected: true,
      displayName,
      email,
      connectedAt: new Date().toISOString(),
      message: 'Spotify account connected successfully',
    });
  } catch (err) {
    console.error('Connect Spotify error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/spotify/disconnect - Disconnect Spotify account
router.delete('/disconnect', (req, res) => {
  try {
    const user = db.prepare('SELECT spotify_connected FROM users WHERE id = ?').get(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.spotify_connected) {
      return res.status(400).json({ error: 'Spotify account is not connected' });
    }

    db.prepare(
      `UPDATE users SET
        spotify_connected = 0,
        spotify_display_name = NULL,
        spotify_email = NULL,
        spotify_connected_at = NULL,
        updated_at = datetime('now')
      WHERE id = ?`
    ).run(req.user.id);

    console.log(`[Spotify] DJ ${req.user.id} disconnected Spotify account`);

    res.json({
      connected: false,
      message: 'Spotify account disconnected successfully',
    });
  } catch (err) {
    console.error('Disconnect Spotify error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
