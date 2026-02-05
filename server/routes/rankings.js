const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { calculateScores, scoresAreStale, recompactRankings, removeSongFromAllRankings } = require('../utils/copeland');

const router = express.Router();

// Helper to safely parse settings that may be double-encoded
function parseSettings(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    let parsed = JSON.parse(raw);
    if (typeof parsed === 'string') {
      parsed = JSON.parse(parsed);
    }
    return parsed || {};
  } catch (e) {
    return {};
  }
}

// Helper: get ranked-choice settings for an event, or null if not in ranked-choice mode
function getRankedChoiceSettings(eventId) {
  const event = db.prepare('SELECT settings FROM events WHERE id = ?').get(eventId);
  if (!event) return null;
  const settings = parseSettings(event.settings);
  if (settings.queueMode !== 'ranked-choice') return null;
  return {
    rankingDepth: (settings.rankedChoiceSettings && settings.rankedChoiceSettings.rankingDepth) || 10,
    primaryScoringMode: (settings.rankedChoiceSettings && settings.rankedChoiceSettings.primaryScoringMode) || 'consensus',
    minRankDelta: (settings.rankedChoiceSettings && settings.rankedChoiceSettings.hiddenGemThreshold && settings.rankedChoiceSettings.hiddenGemThreshold.minRankDelta) || 5,
    maxRankerPercentage: (settings.rankedChoiceSettings && settings.rankedChoiceSettings.hiddenGemThreshold && settings.rankedChoiceSettings.hiddenGemThreshold.maxRankerPercentage) || 20,
    minParticipantsForActivation: (settings.rankedChoiceSettings && settings.rankedChoiceSettings.minParticipantsForActivation) || 5,
    refreshIntervalSeconds: (settings.rankedChoiceSettings && settings.rankedChoiceSettings.refreshIntervalSeconds) || 30
  };
}

// GET /api/events/:eventId/rankings - Get participant's personal rankings
router.get('/events/:eventId/rankings', (req, res) => {
  try {
    const { eventId } = req.params;
    const { participantId } = req.query;

    if (!participantId) {
      return res.status(400).json({ error: 'participantId query parameter is required' });
    }

    const event = db.prepare('SELECT id FROM events WHERE id = ?').get(eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const rankings = db.prepare(
      `SELECT rk.request_id, rk.position, rk.added_at,
              r.song_title, r.artist_name, r.album_art_url, r.status
       FROM rankings rk
       JOIN requests r ON r.id = rk.request_id
       WHERE rk.event_id = ? AND rk.participant_id = ?
       ORDER BY rk.position ASC`
    ).all(eventId, participantId);

    const rcSettings = getRankedChoiceSettings(eventId);
    const rankingDepth = rcSettings ? rcSettings.rankingDepth : 10;

    res.json({
      rankings: rankings.map(r => ({
        requestId: r.request_id,
        position: r.position,
        addedAt: r.added_at,
        song: {
          title: r.song_title,
          artist: r.artist_name,
          albumArtUrl: r.album_art_url
        },
        status: r.status
      })),
      slotsUsed: rankings.length,
      rankingDepth
    });
  } catch (err) {
    console.error('Get rankings error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/events/:eventId/rankings - Set/replace full ranking list
router.put('/events/:eventId/rankings', (req, res) => {
  try {
    const { eventId } = req.params;
    const { participantId, rankings: rankingList } = req.body;

    if (!participantId || !Array.isArray(rankingList)) {
      return res.status(400).json({ error: 'participantId and rankings array are required' });
    }

    const event = db.prepare('SELECT id FROM events WHERE id = ?').get(eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const rcSettings = getRankedChoiceSettings(eventId);
    if (!rcSettings) {
      return res.status(400).json({ error: 'Event is not in ranked-choice mode' });
    }

    if (rankingList.length > rcSettings.rankingDepth) {
      return res.status(400).json({ error: `Maximum ${rcSettings.rankingDepth} songs allowed in ranking` });
    }

    // Validate all request IDs exist and are in valid status
    const requestIds = rankingList.map(r => r.requestId);
    for (const requestId of requestIds) {
      const request = db.prepare("SELECT id, status FROM requests WHERE id = ? AND event_id = ? AND status IN ('queued', 'pending')").get(requestId, eventId);
      if (!request) {
        return res.status(400).json({ error: `Request ${requestId} not found or not in a rankable status` });
      }
    }

    // Replace all rankings for this participant in a transaction
    const replaceAll = db.transaction(() => {
      db.prepare('DELETE FROM rankings WHERE event_id = ? AND participant_id = ?').run(eventId, participantId);

      const insertStmt = db.prepare(
        'INSERT INTO rankings (id, event_id, participant_id, request_id, position) VALUES (?, ?, ?, ?, ?)'
      );

      for (let i = 0; i < rankingList.length; i++) {
        insertStmt.run(uuidv4(), eventId, participantId, rankingList[i].requestId, i + 1);
      }
    });

    replaceAll();

    res.json({ message: 'Rankings updated', count: rankingList.length });
  } catch (err) {
    console.error('Set rankings error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/events/:eventId/rankings/add - Add single song to ranking
router.post('/events/:eventId/rankings/add', (req, res) => {
  try {
    const { eventId } = req.params;
    const { participantId, requestId, position } = req.body;

    if (!participantId || !requestId) {
      return res.status(400).json({ error: 'participantId and requestId are required' });
    }

    const event = db.prepare('SELECT id FROM events WHERE id = ?').get(eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const rcSettings = getRankedChoiceSettings(eventId);
    if (!rcSettings) {
      return res.status(400).json({ error: 'Event is not in ranked-choice mode' });
    }

    // Check request exists and is rankable
    const request = db.prepare("SELECT id FROM requests WHERE id = ? AND event_id = ? AND status IN ('queued', 'pending')").get(requestId, eventId);
    if (!request) {
      return res.status(404).json({ error: 'Request not found or not in a rankable status' });
    }

    // Check if already ranked
    const existing = db.prepare('SELECT id FROM rankings WHERE event_id = ? AND participant_id = ? AND request_id = ?').get(eventId, participantId, requestId);
    if (existing) {
      return res.status(409).json({ error: 'Song is already in your rankings' });
    }

    // Check ranking depth limit
    const currentCount = db.prepare('SELECT COUNT(*) as cnt FROM rankings WHERE event_id = ? AND participant_id = ?').get(eventId, participantId).cnt;
    if (currentCount >= rcSettings.rankingDepth) {
      return res.status(400).json({ error: `Maximum ${rcSettings.rankingDepth} songs allowed in ranking. Remove a song first.` });
    }

    // Determine position: use specified position or append to end
    let insertPosition = position || (currentCount + 1);
    if (insertPosition < 1) insertPosition = 1;
    if (insertPosition > currentCount + 1) insertPosition = currentCount + 1;

    // Shift existing items down if inserting in the middle
    if (insertPosition <= currentCount) {
      db.prepare(
        'UPDATE rankings SET position = position + 1 WHERE event_id = ? AND participant_id = ? AND position >= ?'
      ).run(eventId, participantId, insertPosition);
    }

    db.prepare(
      'INSERT INTO rankings (id, event_id, participant_id, request_id, position) VALUES (?, ?, ?, ?, ?)'
    ).run(uuidv4(), eventId, participantId, requestId, insertPosition);

    res.status(201).json({
      message: 'Song added to rankings',
      position: insertPosition,
      slotsUsed: currentCount + 1,
      rankingDepth: rcSettings.rankingDepth
    });
  } catch (err) {
    console.error('Add to ranking error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/events/:eventId/rankings/:requestId - Remove song from ranking
router.delete('/events/:eventId/rankings/:requestId', (req, res) => {
  try {
    const { eventId, requestId } = req.params;
    const { participantId } = req.query;

    if (!participantId) {
      return res.status(400).json({ error: 'participantId query parameter is required' });
    }

    const result = db.prepare(
      'DELETE FROM rankings WHERE event_id = ? AND participant_id = ? AND request_id = ?'
    ).run(eventId, participantId, requestId);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Ranking entry not found' });
    }

    // Re-compact positions
    recompactRankings(eventId, participantId, db);

    const remaining = db.prepare('SELECT COUNT(*) as cnt FROM rankings WHERE event_id = ? AND participant_id = ?').get(eventId, participantId).cnt;

    res.json({ message: 'Song removed from rankings', slotsUsed: remaining });
  } catch (err) {
    console.error('Remove from ranking error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/events/:eventId/rankings/reorder - Reorder ranking positions (drag-and-drop)
router.put('/events/:eventId/rankings/reorder', (req, res) => {
  try {
    const { eventId } = req.params;
    const { participantId, orderedRequestIds } = req.body;

    if (!participantId || !Array.isArray(orderedRequestIds)) {
      return res.status(400).json({ error: 'participantId and orderedRequestIds array are required' });
    }

    // Verify all IDs are actually in the participant's rankings
    const currentRankings = db.prepare(
      'SELECT request_id FROM rankings WHERE event_id = ? AND participant_id = ?'
    ).all(eventId, participantId);

    const currentSet = new Set(currentRankings.map(r => r.request_id));
    for (const id of orderedRequestIds) {
      if (!currentSet.has(id)) {
        return res.status(400).json({ error: `Request ${id} is not in your rankings` });
      }
    }

    // Update positions
    const updateStmt = db.prepare(
      'UPDATE rankings SET position = ? WHERE event_id = ? AND participant_id = ? AND request_id = ?'
    );

    const reorder = db.transaction(() => {
      for (let i = 0; i < orderedRequestIds.length; i++) {
        updateStmt.run(i + 1, eventId, participantId, orderedRequestIds[i]);
      }
    });

    reorder();

    res.json({ message: 'Rankings reordered' });
  } catch (err) {
    console.error('Reorder rankings error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/events/:eventId/rankings/scores - Get aggregate scores (primary mode for attendees)
router.get('/events/:eventId/rankings/scores', (req, res) => {
  try {
    const { eventId } = req.params;
    const { participantId } = req.query;

    const rcSettings = getRankedChoiceSettings(eventId);
    if (!rcSettings) {
      return res.status(400).json({ error: 'Event is not in ranked-choice mode' });
    }

    // Lazy recalculation: recalculate if stale
    if (scoresAreStale(eventId, db, rcSettings.refreshIntervalSeconds)) {
      calculateScores(eventId, db, {
        minRankDelta: rcSettings.minRankDelta,
        maxRankerPercentage: rcSettings.maxRankerPercentage
      });
    }

    const primaryMode = rcSettings.primaryScoringMode;

    // Fetch scores sorted by primary mode rank
    const scores = db.prepare(
      `SELECT rs.*, r.song_title, r.artist_name, r.album_art_url, r.status, r.created_at as request_created_at
       FROM ranking_scores rs
       JOIN requests r ON r.id = rs.request_id
       WHERE rs.event_id = ?
       ORDER BY rs.${primaryMode === 'discovery' ? 'discovery_rank' : 'consensus_rank'} ASC`
    ).all(eventId);

    // Count total participants with rankings
    const totalParticipants = db.prepare(
      'SELECT COUNT(DISTINCT participant_id) as cnt FROM rankings WHERE event_id = ?'
    ).get(eventId).cnt;

    // If participantId provided, include their ranking position for each song
    let participantRankings = {};
    if (participantId) {
      const userRankings = db.prepare(
        'SELECT request_id, position FROM rankings WHERE event_id = ? AND participant_id = ?'
      ).all(eventId, participantId);
      for (const r of userRankings) {
        participantRankings[r.request_id] = r.position;
      }
    }

    const activated = totalParticipants >= rcSettings.minParticipantsForActivation;

    res.json({
      primaryMode,
      activated,
      totalParticipants,
      minParticipantsForActivation: rcSettings.minParticipantsForActivation,
      scores: scores.map(s => ({
        requestId: s.request_id,
        song: {
          title: s.song_title,
          artist: s.artist_name,
          albumArtUrl: s.album_art_url
        },
        status: s.status,
        rank: primaryMode === 'discovery' ? s.discovery_rank : s.consensus_rank,
        winRate: primaryMode === 'discovery' ? s.discovery_win_rate : s.consensus_win_rate,
        copeland: primaryMode === 'discovery' ? s.discovery_copeland : s.consensus_copeland,
        rankerCount: s.ranker_count,
        myRankingPosition: participantRankings[s.request_id] || null,
        requestCreatedAt: s.request_created_at
      }))
    });
  } catch (err) {
    console.error('Get ranking scores error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/events/:eventId/rankings/scores/dual - Get both mode scores + hidden gems (DJ only)
router.get('/events/:eventId/rankings/scores/dual', authenticateToken, (req, res) => {
  try {
    const { eventId } = req.params;

    // Verify DJ owns this event
    const event = db.prepare('SELECT dj_id, settings FROM events WHERE id = ?').get(eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    if (event.dj_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const rcSettings = getRankedChoiceSettings(eventId);
    if (!rcSettings) {
      return res.status(400).json({ error: 'Event is not in ranked-choice mode' });
    }

    // Lazy recalculation
    if (scoresAreStale(eventId, db, rcSettings.refreshIntervalSeconds)) {
      calculateScores(eventId, db, {
        minRankDelta: rcSettings.minRankDelta,
        maxRankerPercentage: rcSettings.maxRankerPercentage
      });
    }

    // Fetch all scores with both modes
    const scores = db.prepare(
      `SELECT rs.*, r.song_title, r.artist_name, r.album_art_url, r.status, r.manual_order, r.created_at as request_created_at
       FROM ranking_scores rs
       JOIN requests r ON r.id = rs.request_id
       WHERE rs.event_id = ?
       ORDER BY rs.consensus_rank ASC`
    ).all(eventId);

    // Fetch hidden gems
    const hiddenGems = scores.filter(s => s.is_hidden_gem).map(s => ({
      requestId: s.request_id,
      song: { title: s.song_title, artist: s.artist_name, albumArtUrl: s.album_art_url },
      consensusRank: s.consensus_rank,
      consensusWinRate: s.consensus_win_rate,
      discoveryRank: s.discovery_rank,
      discoveryWinRate: s.discovery_win_rate,
      rankDelta: s.consensus_rank - s.discovery_rank,
      rankerCount: s.ranker_count
    }));

    // Sort hidden gems by rank delta descending
    hiddenGems.sort((a, b) => b.rankDelta - a.rankDelta);

    // Count total participants
    const totalParticipants = db.prepare(
      'SELECT COUNT(DISTINCT participant_id) as cnt FROM rankings WHERE event_id = ?'
    ).get(eventId).cnt;

    const activated = totalParticipants >= rcSettings.minParticipantsForActivation;

    // Get last calculation time
    const lastCalc = db.prepare(
      'SELECT calculated_at FROM ranking_scores WHERE event_id = ? ORDER BY calculated_at DESC LIMIT 1'
    ).get(eventId);

    res.json({
      primaryMode: rcSettings.primaryScoringMode,
      activated,
      totalParticipants,
      minParticipantsForActivation: rcSettings.minParticipantsForActivation,
      lastRefresh: lastCalc ? lastCalc.calculated_at : null,
      consensusScores: scores.map(s => ({
        requestId: s.request_id,
        song: { title: s.song_title, artist: s.artist_name, albumArtUrl: s.album_art_url },
        status: s.status,
        manualOrder: s.manual_order,
        rank: s.consensus_rank,
        winRate: s.consensus_win_rate,
        copeland: s.consensus_copeland,
        wins: s.consensus_wins,
        losses: s.consensus_losses,
        rankerCount: s.ranker_count,
        avgPosition: s.avg_position
      })),
      discoveryScores: scores.sort((a, b) => (a.discovery_rank || 999) - (b.discovery_rank || 999)).map(s => ({
        requestId: s.request_id,
        song: { title: s.song_title, artist: s.artist_name, albumArtUrl: s.album_art_url },
        status: s.status,
        manualOrder: s.manual_order,
        rank: s.discovery_rank,
        winRate: s.discovery_win_rate,
        copeland: s.discovery_copeland,
        wins: s.discovery_wins,
        losses: s.discovery_losses,
        rankerCount: s.ranker_count,
        avgPosition: s.avg_position,
        isHiddenGem: !!s.is_hidden_gem
      })),
      hiddenGems
    });
  } catch (err) {
    console.error('Get dual scores error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/events/:eventId/rankings/refresh - Force immediate recalculation (DJ only)
router.post('/events/:eventId/rankings/refresh', authenticateToken, (req, res) => {
  try {
    const { eventId } = req.params;

    const event = db.prepare('SELECT dj_id, settings FROM events WHERE id = ?').get(eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    if (event.dj_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const rcSettings = getRankedChoiceSettings(eventId);
    if (!rcSettings) {
      return res.status(400).json({ error: 'Event is not in ranked-choice mode' });
    }

    const result = calculateScores(eventId, db, {
      minRankDelta: rcSettings.minRankDelta,
      maxRankerPercentage: rcSettings.maxRankerPercentage
    });

    res.json({
      message: 'Rankings refreshed',
      totalParticipants: result.totalParticipants,
      totalScored: result.consensusScores.length,
      hiddenGemsFound: result.hiddenGems.length
    });
  } catch (err) {
    console.error('Refresh rankings error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/events/:eventId/rankings/seen - Mark songs as seen in browse queue
router.post('/events/:eventId/rankings/seen', (req, res) => {
  try {
    const { eventId } = req.params;
    const { participantId, requestIds } = req.body;

    if (!participantId || !Array.isArray(requestIds)) {
      return res.status(400).json({ error: 'participantId and requestIds array are required' });
    }

    const insertStmt = db.prepare(
      'INSERT OR IGNORE INTO seen_songs (event_id, participant_id, request_id) VALUES (?, ?, ?)'
    );

    const markSeen = db.transaction(() => {
      for (const requestId of requestIds) {
        insertStmt.run(eventId, participantId, requestId);
      }
    });

    markSeen();

    res.json({ message: 'Songs marked as seen', count: requestIds.length });
  } catch (err) {
    console.error('Mark seen error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/events/:eventId/rankings/unseen-count - Get unseen song count
router.get('/events/:eventId/rankings/unseen-count', (req, res) => {
  try {
    const { eventId } = req.params;
    const { participantId } = req.query;

    if (!participantId) {
      return res.status(400).json({ error: 'participantId query parameter is required' });
    }

    // Count requests that are not in seen_songs for this participant
    const result = db.prepare(
      `SELECT COUNT(*) as cnt FROM requests r
       WHERE r.event_id = ? AND r.status IN ('queued', 'pending')
       AND r.id NOT IN (
         SELECT ss.request_id FROM seen_songs ss
         WHERE ss.event_id = ? AND ss.participant_id = ?
       )`
    ).get(eventId, eventId, participantId);

    res.json({ unseenCount: result.cnt });
  } catch (err) {
    console.error('Get unseen count error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/events/:eventId/rankings/switch-mode - Switch primary scoring mode (DJ only)
router.post('/events/:eventId/rankings/switch-mode', authenticateToken, (req, res) => {
  try {
    const { eventId } = req.params;
    const { primaryScoringMode } = req.body;

    if (!['consensus', 'discovery'].includes(primaryScoringMode)) {
      return res.status(400).json({ error: 'primaryScoringMode must be "consensus" or "discovery"' });
    }

    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    if (event.dj_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const settings = parseSettings(event.settings);
    if (settings.queueMode !== 'ranked-choice') {
      return res.status(400).json({ error: 'Event is not in ranked-choice mode' });
    }

    // Update the primary scoring mode
    if (!settings.rankedChoiceSettings) {
      settings.rankedChoiceSettings = {};
    }
    settings.rankedChoiceSettings.primaryScoringMode = primaryScoringMode;

    db.prepare('UPDATE events SET settings = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(JSON.stringify(settings), eventId);

    res.json({ message: `Primary scoring mode switched to ${primaryScoringMode}`, primaryScoringMode });
  } catch (err) {
    console.error('Switch mode error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
