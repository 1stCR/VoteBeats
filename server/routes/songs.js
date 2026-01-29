const express = require('express');
const https = require('https');

const router = express.Router();

// GET /api/songs/search?q=query - iTunes API proxy
router.get('/search', (req, res) => {
  const query = req.query.q;
  if (!query) {
    return res.status(400).json({ error: 'Search query is required' });
  }

  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=20`;

  https.get(url, (response) => {
    let data = '';
    response.on('data', chunk => data += chunk);
    response.on('end', () => {
      try {
        const parsed = JSON.parse(data);
        const results = (parsed.results || []).map(track => ({
          trackId: track.trackId,
          title: track.trackName,
          artist: track.artistName,
          album: track.collectionName,
          albumArtUrl: track.artworkUrl100 ? track.artworkUrl100.replace('100x100', '300x300') : null,
          durationMs: track.trackTimeMillis,
          explicit: track.trackExplicitness === 'explicit',
          previewUrl: track.previewUrl
        }));
        res.json({ results, resultCount: results.length });
      } catch (err) {
        res.status(500).json({ error: 'Failed to parse iTunes response' });
      }
    });
  }).on('error', (err) => {
    console.error('iTunes search error:', err);
    res.status(500).json({ error: 'Failed to search iTunes' });
  });
});

module.exports = router;
