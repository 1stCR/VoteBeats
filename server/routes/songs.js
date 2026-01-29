const express = require('express');
const https = require('https');

const router = express.Router();

// Simple in-memory cache for iTunes search results (5 min TTL)
const searchCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

function getCachedResult(query) {
  const key = query.toLowerCase().trim();
  const cached = searchCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  searchCache.delete(key);
  return null;
}

function setCachedResult(query, data) {
  const key = query.toLowerCase().trim();
  searchCache.set(key, { data, timestamp: Date.now() });
  // Limit cache size to 200 entries
  if (searchCache.size > 200) {
    const oldest = searchCache.keys().next().value;
    searchCache.delete(oldest);
  }
}

// GET /api/songs/search?q=query - iTunes API proxy
router.get('/search', (req, res) => {
  const query = req.query.q;
  if (!query) {
    return res.status(400).json({ error: 'Search query is required' });
  }

  // Check cache first
  const cached = getCachedResult(query);
  if (cached) {
    return res.json(cached);
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
        const response_data = { results, resultCount: results.length };
        setCachedResult(query, response_data);
        res.json(response_data);
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
