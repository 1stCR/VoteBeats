const { v4: uuidv4 } = require('uuid');

/**
 * Copeland pairwise comparison scoring for ranked-choice queue mode.
 * Computes both Consensus and Discovery scores simultaneously.
 *
 * Consensus: unranked songs are treated as implicit last place (lose to all ranked songs).
 * Discovery: unranked songs have no opinion weight (no matchups generated).
 */

/**
 * Calculate aggregate scores for all rankable songs in an event.
 * @param {string} eventId
 * @param {object} db - better-sqlite3 database instance
 * @param {object} options
 * @param {number} options.minRankDelta - Hidden gem: minimum rank position difference (default 5)
 * @param {number} options.maxRankerPercentage - Hidden gem: max ranker % of total participants (default 20)
 * @returns {{ totalParticipants: number, consensusScores: Array, discoveryScores: Array, hiddenGems: Array }}
 */
function calculateScores(eventId, db, options = {}) {
  const minRankDelta = options.minRankDelta || 5;
  const maxRankerPercentage = options.maxRankerPercentage || 20;

  // Fetch all rankings for this event, grouped by participant
  const allRankings = db.prepare(
    'SELECT participant_id, request_id, position FROM rankings WHERE event_id = ? ORDER BY participant_id, position ASC'
  ).all(eventId);

  // Group by participant
  const participantRankings = {};
  for (const row of allRankings) {
    if (!participantRankings[row.participant_id]) {
      participantRankings[row.participant_id] = [];
    }
    participantRankings[row.participant_id].push({
      requestId: row.request_id,
      position: row.position
    });
  }

  const participantIds = Object.keys(participantRankings);
  const totalParticipants = participantIds.length;

  // Fetch all rankable requests (queued or pending)
  const rankableRequests = db.prepare(
    "SELECT id, song_title, artist_name, created_at FROM requests WHERE event_id = ? AND status IN ('queued', 'pending')"
  ).all(eventId);

  const allSongIds = new Set(rankableRequests.map(r => r.id));
  const requestMap = {};
  for (const r of rankableRequests) {
    requestMap[r.id] = r;
  }

  if (allSongIds.size === 0 || totalParticipants === 0) {
    // Clear any existing scores
    db.prepare('DELETE FROM ranking_scores WHERE event_id = ?').run(eventId);
    return { totalParticipants: 0, consensusScores: [], discoveryScores: [], hiddenGems: [] };
  }

  // Initialize win/loss tallies for both modes
  // Key: songId, Value: { wins, losses }
  const consensusTally = {};
  const discoveryTally = {};
  const rankerCounts = {};
  const positionSums = {};
  const positionCounts = {};

  for (const songId of allSongIds) {
    consensusTally[songId] = { wins: 0, losses: 0 };
    discoveryTally[songId] = { wins: 0, losses: 0 };
    rankerCounts[songId] = 0;
    positionSums[songId] = 0;
    positionCounts[songId] = 0;
  }

  // Process each participant's rankings
  for (const participantId of participantIds) {
    const rankings = participantRankings[participantId];
    const rankedSongIds = new Set();
    const rankedList = []; // sorted by position

    for (const r of rankings) {
      if (allSongIds.has(r.requestId)) {
        rankedSongIds.add(r.requestId);
        rankedList.push(r);
        rankerCounts[r.requestId]++;
        positionSums[r.requestId] += r.position;
        positionCounts[r.requestId]++;
      }
    }

    // Sort by position (should already be sorted but ensure)
    rankedList.sort((a, b) => a.position - b.position);

    // Generate pairwise matchups from ranked songs
    for (let i = 0; i < rankedList.length; i++) {
      for (let j = i + 1; j < rankedList.length; j++) {
        const winner = rankedList[i].requestId;
        const loser = rankedList[j].requestId;

        // Both modes: ranked vs ranked matchup
        consensusTally[winner].wins++;
        consensusTally[loser].losses++;
        discoveryTally[winner].wins++;
        discoveryTally[loser].losses++;
      }
    }

    // Consensus mode: unranked songs lose to all ranked songs
    const unrankedSongIds = [];
    for (const songId of allSongIds) {
      if (!rankedSongIds.has(songId)) {
        unrankedSongIds.push(songId);
      }
    }

    for (const unrankedId of unrankedSongIds) {
      for (const rankedItem of rankedList) {
        // In consensus mode: ranked song beats unranked song
        consensusTally[rankedItem.requestId].wins++;
        consensusTally[unrankedId].losses++;
      }
      // Discovery mode: no matchup generated for unranked songs — skip
    }
  }

  // Calculate Copeland scores and win rates
  function buildScoreList(tally) {
    const scores = [];
    for (const songId of allSongIds) {
      const t = tally[songId];
      const copeland = t.wins - t.losses;
      const total = t.wins + t.losses;
      const winRate = total > 0 ? t.wins / total : 0;
      const avgPos = positionCounts[songId] > 0 ? positionSums[songId] / positionCounts[songId] : Infinity;
      const req = requestMap[songId];

      scores.push({
        requestId: songId,
        copeland,
        wins: t.wins,
        losses: t.losses,
        winRate,
        rankerCount: rankerCounts[songId],
        avgPosition: avgPos,
        createdAt: req ? req.created_at : null,
        title: req ? req.song_title : null,
        artist: req ? req.artist_name : null
      });
    }

    // Sort: Copeland DESC, rankerCount DESC, avgPosition ASC, createdAt ASC
    scores.sort((a, b) => {
      if (b.copeland !== a.copeland) return b.copeland - a.copeland;
      if (b.rankerCount !== a.rankerCount) return b.rankerCount - a.rankerCount;
      if (a.avgPosition !== b.avgPosition) return a.avgPosition - b.avgPosition;
      // Earliest request time wins
      if (a.createdAt && b.createdAt) return a.createdAt.localeCompare(b.createdAt);
      return 0;
    });

    // Assign ranks
    for (let i = 0; i < scores.length; i++) {
      scores[i].rank = i + 1;
    }

    return scores;
  }

  const consensusScores = buildScoreList(consensusTally);
  const discoveryScores = buildScoreList(discoveryTally);

  // Build rank lookup maps
  const consensusRankMap = {};
  for (const s of consensusScores) {
    consensusRankMap[s.requestId] = s.rank;
  }
  const discoveryRankMap = {};
  for (const s of discoveryScores) {
    discoveryRankMap[s.requestId] = s.rank;
  }

  // Detect Hidden Gems
  const hiddenGems = [];
  for (const songId of allSongIds) {
    const cRank = consensusRankMap[songId];
    const dRank = discoveryRankMap[songId];
    const rankDelta = cRank - dRank; // positive = higher in Discovery
    const rankerPct = totalParticipants > 0 ? (rankerCounts[songId] / totalParticipants) * 100 : 0;

    if (rankDelta >= minRankDelta && rankerPct < maxRankerPercentage) {
      const cScore = consensusScores.find(s => s.requestId === songId);
      const dScore = discoveryScores.find(s => s.requestId === songId);
      const req = requestMap[songId];

      hiddenGems.push({
        requestId: songId,
        title: req ? req.song_title : null,
        artist: req ? req.artist_name : null,
        consensusRank: cRank,
        consensusWinRate: cScore ? cScore.winRate : 0,
        discoveryRank: dRank,
        discoveryWinRate: dScore ? dScore.winRate : 0,
        rankDelta,
        rankerCount: rankerCounts[songId],
        rankerPercentage: rankerPct
      });
    }
  }

  // Sort hidden gems by rank delta descending
  hiddenGems.sort((a, b) => b.rankDelta - a.rankDelta);

  // Persist scores to ranking_scores table
  const upsertStmt = db.prepare(`
    INSERT INTO ranking_scores (id, event_id, request_id, consensus_copeland, consensus_wins, consensus_losses, consensus_win_rate, consensus_rank, discovery_copeland, discovery_wins, discovery_losses, discovery_win_rate, discovery_rank, ranker_count, avg_position, is_hidden_gem, calculated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(event_id, request_id) DO UPDATE SET
      consensus_copeland = excluded.consensus_copeland,
      consensus_wins = excluded.consensus_wins,
      consensus_losses = excluded.consensus_losses,
      consensus_win_rate = excluded.consensus_win_rate,
      consensus_rank = excluded.consensus_rank,
      discovery_copeland = excluded.discovery_copeland,
      discovery_wins = excluded.discovery_wins,
      discovery_losses = excluded.discovery_losses,
      discovery_win_rate = excluded.discovery_win_rate,
      discovery_rank = excluded.discovery_rank,
      ranker_count = excluded.ranker_count,
      avg_position = excluded.avg_position,
      is_hidden_gem = excluded.is_hidden_gem,
      calculated_at = excluded.calculated_at
  `);

  // Build a set of songIds that have scores
  const scoredSongIds = new Set();

  const persistAll = db.transaction(() => {
    for (const cs of consensusScores) {
      const ds = discoveryScores.find(d => d.requestId === cs.requestId);
      const isGem = hiddenGems.some(g => g.requestId === cs.requestId) ? 1 : 0;
      const avgPos = positionCounts[cs.requestId] > 0 ? positionSums[cs.requestId] / positionCounts[cs.requestId] : null;

      // Check for existing row to reuse its id
      const existing = db.prepare('SELECT id FROM ranking_scores WHERE event_id = ? AND request_id = ?').get(eventId, cs.requestId);
      const scoreId = existing ? existing.id : uuidv4();

      upsertStmt.run(
        scoreId,
        eventId,
        cs.requestId,
        cs.copeland, cs.wins, cs.losses, cs.winRate, cs.rank,
        ds ? ds.copeland : 0, ds ? ds.wins : 0, ds ? ds.losses : 0, ds ? ds.winRate : 0, ds ? ds.rank : null,
        rankerCounts[cs.requestId],
        avgPos,
        isGem
      );
      scoredSongIds.add(cs.requestId);
    }

    // Remove scores for songs no longer in the rankable set
    const existingScores = db.prepare('SELECT request_id FROM ranking_scores WHERE event_id = ?').all(eventId);
    for (const row of existingScores) {
      if (!scoredSongIds.has(row.request_id)) {
        db.prepare('DELETE FROM ranking_scores WHERE event_id = ? AND request_id = ?').run(eventId, row.request_id);
      }
    }
  });

  persistAll();

  return { totalParticipants, consensusScores, discoveryScores, hiddenGems };
}

/**
 * Check if scores need recalculation (stale beyond refresh interval).
 * @param {string} eventId
 * @param {object} db
 * @param {number} refreshIntervalSeconds - default 30
 * @returns {boolean}
 */
function scoresAreStale(eventId, db, refreshIntervalSeconds = 30) {
  const latest = db.prepare(
    'SELECT calculated_at FROM ranking_scores WHERE event_id = ? ORDER BY calculated_at DESC LIMIT 1'
  ).get(eventId);

  if (!latest) return true;

  const calcTime = new Date(latest.calculated_at + 'Z').getTime();
  const now = Date.now();
  return (now - calcTime) > (refreshIntervalSeconds * 1000);
}

/**
 * Re-compact ranking positions for a participant after a song is removed.
 * Ensures positions are sequential (1, 2, 3, ...) with no gaps.
 * @param {string} eventId
 * @param {string} participantId
 * @param {object} db
 */
function recompactRankings(eventId, participantId, db) {
  const rankings = db.prepare(
    'SELECT id, position FROM rankings WHERE event_id = ? AND participant_id = ? ORDER BY position ASC'
  ).all(eventId, participantId);

  const updateStmt = db.prepare('UPDATE rankings SET position = ? WHERE id = ?');
  const recompact = db.transaction(() => {
    for (let i = 0; i < rankings.length; i++) {
      const newPos = i + 1;
      if (rankings[i].position !== newPos) {
        updateStmt.run(newPos, rankings[i].id);
      }
    }
  });
  recompact();
}

/**
 * Remove a song from all rankings and clean up scores.
 * Called when a song transitions to nowPlaying/played or is deleted.
 * @param {string} eventId
 * @param {string} requestId
 * @param {object} db
 */
function removeSongFromAllRankings(eventId, requestId, db) {
  // Find all participants who ranked this song
  const affectedParticipants = db.prepare(
    'SELECT DISTINCT participant_id FROM rankings WHERE event_id = ? AND request_id = ?'
  ).all(eventId, requestId);

  // Remove the song from rankings
  db.prepare('DELETE FROM rankings WHERE event_id = ? AND request_id = ?').run(eventId, requestId);

  // Remove from scores cache
  db.prepare('DELETE FROM ranking_scores WHERE event_id = ? AND request_id = ?').run(eventId, requestId);

  // Re-compact each affected participant's rankings
  for (const row of affectedParticipants) {
    recompactRankings(eventId, row.participant_id, db);
  }
}

module.exports = {
  calculateScores,
  scoresAreStale,
  recompactRankings,
  removeSongFromAllRankings
};
