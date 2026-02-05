const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { sanitizeString } = require('../utils/sanitize');
const { containsProfanity, filterProfanity } = require('../utils/profanity');
const { findFuzzyMatches } = require('../utils/fuzzyMatch');
const { calculateScores, scoresAreStale, removeSongFromAllRankings } = require('../utils/copeland');

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

// Helper: Check queue health and auto-generate a DJ message if queue is low
function checkQueueHealthAndNotify(eventId) {
  try {
    const event = db.prepare('SELECT id, dj_id, settings FROM events WHERE id = ?').get(eventId);
    if (!event) return;

    const settings = parseSettings(event.settings);
    const threshold = settings.lowQueueThreshold;
    if (!threshold || threshold <= 0) return;

    // Count queued + pending songs (active queue)
    const queueCount = db.prepare(
      "SELECT COUNT(*) as cnt FROM requests WHERE event_id = ? AND status IN ('queued', 'pending')"
    ).get(eventId);
    const count = queueCount?.cnt || 0;

    if (count > threshold) return;

    // Check if we already sent an auto queue_low message recently (within last 10 minutes)
    const recentAutoMsg = db.prepare(
      "SELECT id FROM messages WHERE event_id = ? AND type = 'auto_queue_low' AND created_at > datetime('now', '-10 minutes')"
    ).get(eventId);

    if (recentAutoMsg) return; // Don't spam - already sent recently

    // Auto-generate a DJ message
    const messageId = uuidv4();
    const content = count === 0
      ? '🎵 The queue is empty! Request your favorite songs to keep the music going!'
      : `⚠️ Only ${count} song${count === 1 ? '' : 's'} left in the queue! Help keep the party going — request more songs!`;

    db.prepare(`
      INSERT INTO messages (id, event_id, dj_id, content, target_audience, type)
      VALUES (?, ?, ?, ?, 'all', 'auto_queue_low')
    `).run(messageId, eventId, event.dj_id, content);

    console.log(`[Auto] Queue low notification sent for event ${eventId} (${count} songs remaining)`);
  } catch (err) {
    console.error('Queue health check error:', err);
  }
}

// Helper: Check vote window close time and auto-generate notifications at 24hr and 1hr before close
function checkVoteCloseAndNotify(eventId) {
  try {
    const event = db.prepare('SELECT id, dj_id, settings FROM events WHERE id = ?').get(eventId);
    if (!event) return;

    const settings = parseSettings(event.settings);

    // Only applies to scheduled vote close mode with a close time set
    if (settings.votingCloseMode !== 'scheduled' || !settings.votingCloseTime) return;
    // If voting is already manually closed, no need for notifications
    if (settings.votingClosed) return;

    const now = Date.now();
    const closeTime = new Date(settings.votingCloseTime).getTime();
    const diff = closeTime - now;

    // If voting already closed (past the time), no notification needed
    if (diff <= 0) return;

    const ONE_HOUR = 60 * 60 * 1000;
    const TWENTY_FOUR_HOURS = 24 * ONE_HOUR;

    // Check for 24-hour notification (between 1hr and 24hrs remaining)
    if (diff <= TWENTY_FOUR_HOURS && diff > ONE_HOUR) {
      // Check if we already sent a 24hr notification (12-hour cooldown)
      const recent24h = db.prepare(
        "SELECT id FROM messages WHERE event_id = ? AND type = 'auto_vote_close_24h' AND created_at > datetime('now', '-720 minutes')"
      ).get(eventId);

      if (!recent24h) {
        const hoursLeft = Math.ceil(diff / ONE_HOUR);
        const messageId = uuidv4();
        const content = `⏰ Voting closes in ${hoursLeft} hour${hoursLeft === 1 ? '' : 's'}! Make sure to vote on your favorite songs and submit any last requests!`;

        db.prepare(`
          INSERT INTO messages (id, event_id, dj_id, content, target_audience, type)
          VALUES (?, ?, ?, ?, 'all', 'auto_vote_close_24h')
        `).run(messageId, eventId, event.dj_id, content);

        console.log(`[Auto] Vote close 24h notification sent for event ${eventId} (${hoursLeft}h remaining)`);
      }
    }

    // Check for 1-hour notification (1 hour or less remaining)
    if (diff <= ONE_HOUR) {
      // Check if we already sent a 1hr notification (30-minute cooldown)
      const recent1h = db.prepare(
        "SELECT id FROM messages WHERE event_id = ? AND type = 'auto_vote_close_1h' AND created_at > datetime('now', '-30 minutes')"
      ).get(eventId);

      if (!recent1h) {
        const minutesLeft = Math.ceil(diff / (60 * 1000));
        const messageId = uuidv4();
        const content = minutesLeft <= 5
          ? `🚨 LAST CALL! Voting closes in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}! Get your final votes in NOW!`
          : `⏰ Voting closes in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}! Don't miss your chance — vote and request songs now!`;

        db.prepare(`
          INSERT INTO messages (id, event_id, dj_id, content, target_audience, type)
          VALUES (?, ?, ?, ?, 'all', 'auto_vote_close_1h')
        `).run(messageId, eventId, event.dj_id, content);

        console.log(`[Auto] Vote close 1h notification sent for event ${eventId} (${minutesLeft}min remaining)`);
      }
    }
  } catch (err) {
    console.error('Vote close notification check error:', err);
  }
}

// Helper: Check event start time and auto-generate "starting soon" notification
function checkEventStartAndNotify(eventId) {
  try {
    const event = db.prepare('SELECT id, dj_id, date, start_time, settings FROM events WHERE id = ?').get(eventId);
    if (!event) return;

    // Need both date and start_time to calculate when event starts
    if (!event.date || !event.start_time) return;

    // Combine date and start_time into a full datetime
    const eventStartStr = event.date + 'T' + event.start_time;
    const eventStartTime = new Date(eventStartStr).getTime();
    if (isNaN(eventStartTime)) return;

    const now = Date.now();
    const diff = eventStartTime - now;

    // If event already started or more than 24 hours away, no notification needed
    if (diff <= 0 || diff > 24 * 60 * 60 * 1000) return;

    const ONE_HOUR = 60 * 60 * 1000;

    // 1-hour notification (event starts within 1 hour) - 30 minute cooldown
    if (diff <= ONE_HOUR) {
      const recent1h = db.prepare(
        "SELECT id FROM messages WHERE event_id = ? AND type = 'auto_event_start_1h' AND created_at > datetime('now', '-30 minutes')"
      ).get(eventId);

      if (!recent1h) {
        const minutesLeft = Math.ceil(diff / (60 * 1000));
        const messageId = uuidv4();
        const location = event.start_time ? ' at ' + event.start_time : '';
        const venue = (() => { try { return parseSettings(event.settings).location || ''; } catch(e) { return ''; } })();
        const content = minutesLeft <= 10
          ? `🎉 The event is starting in just ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}! Get your song requests in now!`
          : `🎶 The event starts in ${minutesLeft} minutes${location}! Make sure your favorite songs are in the queue!`;

        db.prepare(`
          INSERT INTO messages (id, event_id, dj_id, content, target_audience, type)
          VALUES (?, ?, ?, ?, 'all', 'auto_event_start_1h')
        `).run(messageId, eventId, event.dj_id, content);

        console.log(`[Auto] Event start 1h notification sent for event ${eventId} (${minutesLeft}min remaining)`);
      }
    }
    // 24-hour notification (event starts within 24 hours but more than 1 hour away) - 12 hour cooldown
    else if (diff <= 24 * ONE_HOUR) {
      const recent24h = db.prepare(
        "SELECT id FROM messages WHERE event_id = ? AND type = 'auto_event_start_24h' AND created_at > datetime('now', '-720 minutes')"
      ).get(eventId);

      if (!recent24h) {
        const hoursLeft = Math.ceil(diff / ONE_HOUR);
        const messageId = uuidv4();
        const content = `🎵 The event starts in ${hoursLeft} hour${hoursLeft === 1 ? '' : 's'}! Start browsing songs and get your requests ready!`;

        db.prepare(`
          INSERT INTO messages (id, event_id, dj_id, content, target_audience, type)
          VALUES (?, ?, ?, ?, 'all', 'auto_event_start_24h')
        `).run(messageId, eventId, event.dj_id, content);

        console.log(`[Auto] Event start 24h notification sent for event ${eventId} (${hoursLeft}h remaining)`);
      }
    }
  } catch (err) {
    console.error('Event start notification check error:', err);
  }
}

// GET /api/events/:eventId/public - Get public event info (no auth required)
router.get('/events/:eventId/public', (req, res) => {
  try {
    const event = db.prepare('SELECT id, name, date, start_time, end_time, location, description, status, settings FROM events WHERE id = ?').get(req.params.eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check for automated vote close notifications on each public poll
    checkVoteCloseAndNotify(req.params.eventId);
    // Check for automated event starting soon notifications
    checkEventStartAndNotify(req.params.eventId);

    res.json({
      id: event.id,
      name: event.name,
      date: event.date,
      startTime: event.start_time,
      endTime: event.end_time,
      location: event.location,
      description: event.description,
      status: event.status,
      settings: parseSettings(event.settings)
    });
  } catch (err) {
    console.error('Get public event error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// GET /api/events/:eventId/requests/check-similar - Check for similar songs in queue (attendee)
router.get('/events/:eventId/requests/check-similar', (req, res) => {
  try {
    const { eventId } = req.params;
    const { songTitle, artistName } = req.query;

    if (!songTitle || !artistName) {
      return res.status(400).json({ error: 'songTitle and artistName are required' });
    }

    // Check event exists
    const event = db.prepare('SELECT id FROM events WHERE id = ?').get(eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Get all non-rejected requests for this event (across ALL attendees)
    const existingRequests = db.prepare(
      'SELECT id, song_title, artist_name, vote_count, status FROM requests WHERE event_id = ? AND status != ?'
    ).all(eventId, 'rejected');

    // Find fuzzy matches
    const matches = findFuzzyMatches(
      { title: songTitle, artist: artistName },
      existingRequests
    );

    res.json({
      hasSimilar: matches.length > 0,
      matches: matches.slice(0, 5) // Return top 5 matches
    });
  } catch (err) {
    console.error('Check similar error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/events/:eventId/requests - Submit song request (attendee - no auth required)
router.post('/events/:eventId/requests', (req, res) => {
  try {
    const { eventId } = req.params;
    const { songTitle, artistName, albumArtUrl, durationMs, explicitFlag, itunesTrackId, requestedBy, nickname, message, genre } = req.body;

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
    const settings = parseSettings(event.settings);
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

    // Check post-close request limit (when event is completed)
    if (event.status === 'completed') {
      const postCloseLimit = settings.postCloseRequestLimit;
      if (postCloseLimit !== undefined && postCloseLimit !== null) {
        if (postCloseLimit === 0) {
          return res.status(403).json({
            error: 'Requests are closed for this event.',
            reason: 'event_closed'
          });
        }
        // Count requests made after event was completed (or just use total if we can't track)
        const existingCount = db.prepare('SELECT COUNT(*) as count FROM requests WHERE event_id = ? AND requested_by = ?')
          .get(eventId, requestedBy).count;
        if (existingCount >= postCloseLimit) {
          return res.status(429).json({
            error: `Post-close request limit reached. Maximum ${postCloseLimit} requests after event close.`,
            limit: postCloseLimit,
            current: existingCount
          });
        }
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

    // Check if requests are auto-closed by time
    if (settings.requestCloseTime) {
      const closeTime = new Date(settings.requestCloseTime).getTime();
      if (Date.now() >= closeTime) {
        return res.status(403).json({
          error: 'Song requests have closed for this event.',
          reason: 'requests_closed',
          closedAt: settings.requestCloseTime
        });
      }
    }

    // Check for duplicate song request by same attendee
    if (itunesTrackId) {
      const existingByTrack = db.prepare(
        'SELECT id FROM requests WHERE event_id = ? AND requested_by = ? AND itunes_track_id = ? AND status != ?'
      ).get(eventId, requestedBy, itunesTrackId, 'rejected');
      if (existingByTrack) {
        return res.status(409).json({
          error: 'You have already requested this song. Try voting for it instead!',
          reason: 'duplicate_request',
          existingRequestId: existingByTrack.id
        });
      }
    } else {
      const existingByName = db.prepare(
        'SELECT id FROM requests WHERE event_id = ? AND requested_by = ? AND song_title = ? AND artist_name = ? AND status != ?'
      ).get(eventId, requestedBy, cleanSongTitle, cleanArtistName, 'rejected');
      if (existingByName) {
        return res.status(409).json({
          error: 'You have already requested this song. Try voting for it instead!',
          reason: 'duplicate_request',
          existingRequestId: existingByName.id
        });
      }
    }

    // Profanity filter on messages and nicknames
    let filteredMessage = cleanMessage;
    let filteredNickname = cleanNickname;
    if (settings.profanityFilter !== false) {
      if (cleanMessage && containsProfanity(cleanMessage)) {
        filteredMessage = filterProfanity(cleanMessage);
      }
      if (cleanNickname && containsProfanity(cleanNickname)) {
        filteredNickname = filterProfanity(cleanNickname);
      }
    }

    const id = uuidv4();
    // Determine initial status: 'pending' if requireApproval, 'queued' otherwise
    const initialStatus = settings.requireApproval ? 'pending' : 'queued';

    db.prepare(`INSERT INTO requests (id, event_id, song_title, artist_name, album_art_url, duration_ms, explicit_flag, itunes_track_id, requested_by, nickname, message, status, song_genre)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, eventId, cleanSongTitle, cleanArtistName, albumArtUrl || null, durationMs || null, explicitFlag ? 1 : 0, itunesTrackId || null, cleanRequestedBy, filteredNickname, filteredMessage, initialStatus, genre || null);

    const request = db.prepare('SELECT * FROM requests WHERE id = ?').get(id);
    res.status(201).json(formatRequest(request));
  } catch (err) {
    console.error('Create request error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/events/:eventId/edit-mode - Toggle edit mode (DJ only)
router.put('/events/:eventId/edit-mode', authenticateToken, (req, res) => {
  try {
    const { eventId } = req.params;
    const { enabled } = req.body;

    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    if (event.dj_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (enabled) {
      // Entering edit mode: snapshot the current requests
      const requests = db.prepare('SELECT * FROM requests WHERE event_id = ? ORDER BY CASE WHEN manual_order IS NOT NULL THEN 0 ELSE 1 END, manual_order ASC, vote_count DESC, created_at ASC').all(eventId);
      const snapshot = JSON.stringify(requests.map(r => formatRequest(r)));
      db.prepare('UPDATE events SET edit_mode = 1, edit_mode_snapshot = ?, updated_at = datetime(\'now\') WHERE id = ?')
        .run(snapshot, eventId);
      res.json({ editMode: true, message: 'Edit mode enabled. Attendee views are frozen.' });
    } else {
      // Exiting edit mode: clear snapshot, attendees will see live data
      db.prepare('UPDATE events SET edit_mode = 0, edit_mode_snapshot = NULL, updated_at = datetime(\'now\') WHERE id = ?')
        .run(eventId);
      res.json({ editMode: false, message: 'Edit mode disabled. Changes published to attendees.' });
    }
  } catch (err) {
    console.error('Toggle edit mode error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/events/:eventId/edit-mode - Get edit mode status (DJ only)
router.get('/events/:eventId/edit-mode', authenticateToken, (req, res) => {
  try {
    const { eventId } = req.params;
    const event = db.prepare('SELECT edit_mode FROM events WHERE id = ?').get(eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json({ editMode: !!event.edit_mode });
  } catch (err) {
    console.error('Get edit mode error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/events/:eventId/requests - List requests (public for attendees, or authenticated for DJ)
router.get('/events/:eventId/requests', (req, res) => {
  try {
    const { eventId } = req.params;
    const { userId } = req.query; // Optional: attendee user ID for vote tracking

    // Optional auth check: determine if caller is the event's DJ
    let isDJ = false;
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token) {
      try {
        const jwt = require('jsonwebtoken');
        const { JWT_SECRET } = require('../middleware/auth');
        const user = jwt.verify(token, JWT_SECRET);
        const event = db.prepare('SELECT dj_id FROM events WHERE id = ?').get(eventId);
        if (event && user.id === event.dj_id) {
          isDJ = true;
        }
      } catch (e) {
        // Invalid token - treat as public access
      }
    }

    // If edit mode is active and user is NOT the DJ, return frozen snapshot
    if (!isDJ) {
      const eventCheck = db.prepare('SELECT edit_mode, edit_mode_snapshot FROM events WHERE id = ?').get(eventId);
      if (eventCheck && eventCheck.edit_mode && eventCheck.edit_mode_snapshot) {
        try {
          const snapshot = JSON.parse(eventCheck.edit_mode_snapshot);
          // Strip DJ notes from snapshot and return
          return res.json(snapshot.map(r => {
            delete r.djNotes;
            return r;
          }));
        } catch (e) {
          // Invalid snapshot, fall through to live data
        }
      }
    }

    // Determine queue mode for sort order
    const eventForSettings = db.prepare('SELECT settings FROM events WHERE id = ?').get(eventId);
    const eventSettings = eventForSettings ? parseSettings(eventForSettings.settings) : {};
    const isRankedChoice = eventSettings.queueMode === 'ranked-choice';

    let requests;
    if (isRankedChoice) {
      // Ranked-choice mode: sort by manual_order first, then by Copeland score from ranking_scores
      const primaryMode = (eventSettings.rankedChoiceSettings && eventSettings.rankedChoiceSettings.primaryScoringMode) || 'consensus';
      const refreshInterval = (eventSettings.rankedChoiceSettings && eventSettings.rankedChoiceSettings.refreshIntervalSeconds) || 30;

      // Lazy recalculation if scores are stale
      if (scoresAreStale(eventId, db, refreshInterval)) {
        const minRankDelta = (eventSettings.rankedChoiceSettings && eventSettings.rankedChoiceSettings.hiddenGemThreshold && eventSettings.rankedChoiceSettings.hiddenGemThreshold.minRankDelta) || 5;
        const maxRankerPct = (eventSettings.rankedChoiceSettings && eventSettings.rankedChoiceSettings.hiddenGemThreshold && eventSettings.rankedChoiceSettings.hiddenGemThreshold.maxRankerPercentage) || 20;
        calculateScores(eventId, db, { minRankDelta, maxRankerPercentage: maxRankerPct });
      }

      const copelandCol = primaryMode === 'discovery' ? 'rs.discovery_copeland' : 'rs.consensus_copeland';
      const rankCol = primaryMode === 'discovery' ? 'rs.discovery_rank' : 'rs.consensus_rank';

      requests = db.prepare(
        `SELECT r.*, ${copelandCol} as primary_copeland, ${rankCol} as primary_rank, rs.ranker_count as rs_ranker_count, rs.avg_position as rs_avg_position
         FROM requests r
         LEFT JOIN ranking_scores rs ON rs.request_id = r.id AND rs.event_id = r.event_id
         WHERE r.event_id = ?
         ORDER BY
           CASE WHEN r.manual_order IS NOT NULL THEN 0 ELSE 1 END,
           r.manual_order ASC,
           COALESCE(${copelandCol}, -999999) DESC,
           COALESCE(rs.ranker_count, 0) DESC,
           COALESCE(rs.avg_position, 999) ASC,
           r.created_at ASC`
      ).all(eventId);
    } else {
      // Simple voting mode: sort by manual_order, then vote count, then creation time
      requests = db.prepare('SELECT * FROM requests WHERE event_id = ? ORDER BY CASE WHEN manual_order IS NOT NULL THEN 0 ELSE 1 END, manual_order ASC, vote_count DESC, created_at ASC').all(eventId);
    }

    // Calculate recent votes (last hour) for trending indicators
    const recentVotesStmt = db.prepare(
      'SELECT COUNT(*) as count FROM votes WHERE request_id = ? AND created_at >= datetime(\'now\', \'-1 hour\')'
    );

    // Get voter nicknames for social proof display
    const voterNicknamesStmt = db.prepare(
      `SELECT DISTINCT r.nickname FROM votes v
       JOIN requests r ON r.requested_by = v.user_id AND r.event_id = ?
       WHERE v.request_id = ? AND r.nickname IS NOT NULL AND r.nickname != ''
       LIMIT 3`
    );
    const voterCountStmt = db.prepare(
      'SELECT COUNT(*) as count FROM votes WHERE request_id = ?'
    );

    // Check if specific user voted for each request
    const userVoteStmt = userId ? db.prepare(
      'SELECT id FROM votes WHERE request_id = ? AND user_id = ?'
    ) : null;

    res.json(requests.map(r => {
      const recentVotes = recentVotesStmt.get(r.id)?.count || 0;
      const formatted = formatRequest(r);
      formatted.recentVotes = recentVotes;
      formatted.trending = recentVotes >= 3;

      // Strip private DJ notes from public (non-DJ) responses
      if (!isDJ) {
        delete formatted.djNotes;
      }

      // Social proof: voter nicknames
      const totalVoters = voterCountStmt.get(r.id)?.count || 0;
      const voterNames = voterNicknamesStmt.all(eventId, r.id).map(v => v.nickname);
      formatted.voterNames = voterNames;
      formatted.totalVoters = totalVoters;

      // User vote tracking
      if (userVoteStmt) {
        formatted.votedByUser = !!userVoteStmt.get(r.id, userId);
      }

      return formatted;
    }));
  } catch (err) {
    console.error('List requests error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// PUT /api/events/:eventId/requests/bulk-approve - Bulk approve requests (DJ only)
router.put('/events/:eventId/requests/bulk-approve', authenticateToken, (req, res) => {
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
        const result = updateStmt.run('queued', id, eventId);
        updated += result.changes;
      }
      return updated;
    });

    const count = updateMany(requestIds);
    res.json({ message: `${count} requests approved`, count });
  } catch (err) {
    console.error('Bulk approve error:', err);
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

    // Check queue health after bulk rejection
    checkQueueHealthAndNotify(eventId);

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

    // If transitioning to nowPlaying or played, snapshot final scores and remove from rankings
    if (['nowPlaying', 'played'].includes(status)) {
      // Snapshot final ranking scores for historical preservation
      const finalScoreRow = db.prepare('SELECT * FROM ranking_scores WHERE event_id = ? AND request_id = ?')
        .get(req.params.eventId, req.params.requestId);
      if (finalScoreRow) {
        const finalScoresJson = JSON.stringify({
          consensusRank: finalScoreRow.consensus_rank,
          consensusWinRate: finalScoreRow.consensus_win_rate,
          consensusCopeland: finalScoreRow.consensus_copeland,
          discoveryRank: finalScoreRow.discovery_rank,
          discoveryWinRate: finalScoreRow.discovery_win_rate,
          discoveryCopeland: finalScoreRow.discovery_copeland,
          rankerCount: finalScoreRow.ranker_count,
          avgPosition: finalScoreRow.avg_position
        });
        db.prepare('UPDATE requests SET final_scores = ? WHERE id = ?').run(finalScoresJson, req.params.requestId);
      }

      // Remove song from all participant rankings and scores cache
      removeSongFromAllRankings(req.params.eventId, req.params.requestId, db);
    }

    db.prepare('UPDATE requests SET status = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(status, req.params.requestId);

    // Check queue health after status changes that reduce the active queue
    if (['played', 'rejected', 'nowPlaying'].includes(status)) {
      checkQueueHealthAndNotify(req.params.eventId);
    }

    const updated = db.prepare('SELECT * FROM requests WHERE id = ?').get(req.params.requestId);
    res.json(formatRequest(updated));
  } catch (err) {
    console.error('Update request status error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/events/:eventId/requests/:requestId/order - Set manual order (DJ only)
router.put('/events/:eventId/requests/:requestId/order', authenticateToken, (req, res) => {
  try {
    const { manualOrder } = req.body;

    const request = db.prepare('SELECT r.*, e.dj_id FROM requests r JOIN events e ON r.event_id = e.id WHERE r.id = ? AND r.event_id = ?')
      .get(req.params.requestId, req.params.eventId);

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.dj_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // manualOrder can be null (to remove manual ordering) or a number
    const orderValue = (manualOrder === null || manualOrder === undefined) ? null : parseInt(manualOrder, 10);

    db.prepare('UPDATE requests SET manual_order = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(orderValue, req.params.requestId);

    const updated = db.prepare('SELECT * FROM requests WHERE id = ?').get(req.params.requestId);
    res.json(formatRequest(updated));
  } catch (err) {
    console.error('Update request order error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/events/:eventId/requests/:requestId/voters - Get voter details (DJ only)
router.get('/events/:eventId/requests/:requestId/voters', authenticateToken, (req, res) => {
  try {
    const request = db.prepare('SELECT r.*, e.dj_id FROM requests r JOIN events e ON r.event_id = e.id WHERE r.id = ? AND r.event_id = ?')
      .get(req.params.requestId, req.params.eventId);

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.dj_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Get all voters with their nicknames (from their requests in this event)
    const voters = db.prepare(
      `SELECT v.user_id, v.created_at,
        (SELECT r2.nickname FROM requests r2 WHERE r2.requested_by = v.user_id AND r2.event_id = ? AND r2.nickname IS NOT NULL AND r2.nickname != '' LIMIT 1) as nickname
       FROM votes v
       WHERE v.request_id = ?
       ORDER BY v.created_at ASC`
    ).all(req.params.eventId, req.params.requestId);

    res.json({
      requestId: req.params.requestId,
      totalVoters: voters.length,
      voters: voters.map(v => ({
        userId: v.user_id,
        nickname: v.nickname || null,
        votedAt: v.created_at
      }))
    });
  } catch (err) {
    console.error('Get voters error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/events/:eventId/requests/:requestId/notes - Update DJ private notes (DJ only)
router.put('/events/:eventId/requests/:requestId/notes', authenticateToken, (req, res) => {
  try {
    const request = db.prepare('SELECT r.*, e.dj_id FROM requests r JOIN events e ON r.event_id = e.id WHERE r.id = ? AND r.event_id = ?')
      .get(req.params.requestId, req.params.eventId);

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.dj_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { notes } = req.body;
    const cleanNotes = (notes || '').trim();

    db.prepare('UPDATE requests SET dj_notes = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(cleanNotes || null, req.params.requestId);

    const updated = db.prepare('SELECT * FROM requests WHERE id = ?').get(req.params.requestId);
    res.json(formatRequest(updated));
  } catch (err) {
    console.error('Update DJ notes error:', err);
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

    // Remove from all rankings and scores before deleting
    removeSongFromAllRankings(req.params.eventId, req.params.requestId, db);

    db.prepare('DELETE FROM seen_songs WHERE event_id = ? AND request_id = ?').run(req.params.eventId, req.params.requestId);
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

    // Check request status - only pending/queued songs can be voted on
    if (request.status !== 'pending' && request.status !== 'queued') {
      return res.status(403).json({
        error: 'Voting is only allowed on pending or queued songs.',
        reason: 'vote_locked',
        currentStatus: request.status
      });
    }

    // Check voting schedule
    const event = db.prepare('SELECT settings FROM events WHERE id = ?').get(req.params.eventId);
    if (event) {
      const settings = parseSettings(event.settings);
      if (settings.votingSchedule === 'scheduled' && settings.votingOpenTime) {
        const openTime = new Date(settings.votingOpenTime).getTime();
        if (Date.now() < openTime) {
          return res.status(403).json({
            error: 'Voting has not opened yet.',
            votingOpensAt: settings.votingOpenTime,
            reason: 'voting_not_open'
          });
        }
      }
    }

    // Check if voting is closed (manually or scheduled)
    if (event) {
      const closeSettings = parseSettings(event.settings);
      if (closeSettings.votingClosed) {
        return res.status(403).json({
          error: 'Voting is currently closed.',
          reason: 'voting_closed'
        });
      }
      if (closeSettings.votingCloseMode === 'scheduled' && closeSettings.votingCloseTime) {
        const closeTime = new Date(closeSettings.votingCloseTime).getTime();
        if (Date.now() >= closeTime) {
          return res.status(403).json({
            error: 'Voting has closed.',
            votingClosedAt: closeSettings.votingCloseTime,
            reason: 'voting_closed_scheduled'
          });
        }
      }
    }

    // Toggle vote: if already voted, remove (unvote); otherwise add
    const existingVote = db.prepare('SELECT * FROM votes WHERE request_id = ? AND user_id = ?')
      .get(req.params.requestId, userId);
    if (existingVote) {
      // Unvote - remove existing vote
      db.prepare('DELETE FROM votes WHERE request_id = ? AND user_id = ?')
        .run(req.params.requestId, userId);
      db.prepare('UPDATE requests SET vote_count = MAX(vote_count - 1, 0), updated_at = datetime(\'now\') WHERE id = ?')
        .run(req.params.requestId);
      const updated = db.prepare('SELECT * FROM requests WHERE id = ?').get(req.params.requestId);
      const formatted = formatRequest(updated);
      formatted.unvoted = true;
      return res.json(formatted);
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
      itunesTrackId: req.itunes_track_id,
      genre: req.song_genre
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
    finalScores: req.final_scores ? JSON.parse(req.final_scores) : null,
    createdAt: req.created_at,
    updatedAt: req.updated_at
  };
}


// Resolve code word to attendee ID
router.post('/code-word', (req, res) => {
  try {
    const { codeWord } = req.body;
    if (!codeWord || typeof codeWord !== 'string' || codeWord.trim().length < 3) {
      return res.status(400).json({ error: 'Code word must be at least 3 characters' });
    }

    const normalizedCode = codeWord.trim().toLowerCase();

    // Check if code word already exists
    let identity = db.prepare('SELECT * FROM attendee_identities WHERE code_word = ?').get(normalizedCode);

    if (!identity) {
      // Generate a new attendee ID for this code word
      const { v4: uuidv4 } = require('uuid');
      const newAttendeeId = uuidv4();
      db.prepare('INSERT INTO attendee_identities (code_word, attendee_id) VALUES (?, ?)').run(normalizedCode, newAttendeeId);
      identity = { code_word: normalizedCode, attendee_id: newAttendeeId };
    }

    res.json({ attendeeId: identity.attendee_id, codeWord: normalizedCode });
  } catch (err) {
    console.error('Code word error:', err);
    res.status(500).json({ error: 'Failed to resolve code word' });
  }
});

module.exports = router;
