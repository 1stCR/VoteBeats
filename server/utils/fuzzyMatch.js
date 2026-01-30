/**
 * Fuzzy matching utility for detecting song variations.
 * Detects remixes, live versions, acoustic versions, and slight title differences.
 */

/**
 * Normalize a song title for comparison:
 * - Lowercase
 * - Remove parenthetical suffixes like (Remix), (Live), (Acoustic), (feat. X), etc.
 * - Remove bracket suffixes like [Deluxe Edition]
 * - Remove common separators and suffixes like "- Radio Edit", "- Remastered"
 * - Trim whitespace and collapse multiple spaces
 */
function normalizeTitle(title) {
  if (!title || typeof title !== 'string') return '';
  let normalized = title.toLowerCase().trim();

  // Remove content in parentheses: (Remix), (feat. ...), (Live Version), etc.
  normalized = normalized.replace(/\s*\([^)]*\)\s*/g, ' ');

  // Remove content in brackets: [Deluxe], [Remastered], etc.
  normalized = normalized.replace(/\s*\[[^\]]*\]\s*/g, ' ');

  // Remove common suffixes after dash: - Remix, - Radio Edit, - Remastered, etc.
  normalized = normalized.replace(/\s*[-–—]\s*(remix|radio edit|remaster(ed)?|deluxe|live|acoustic|version|edit|mix|extended|single|bonus track|explicit|clean).*$/i, '');

  // Remove "feat.", "ft.", "featuring" and everything after
  normalized = normalized.replace(/\s*(feat\.?|ft\.?|featuring)\s+.*/i, '');

  // Remove special characters except alphanumeric and spaces
  normalized = normalized.replace(/[^a-z0-9\s]/g, '');

  // Collapse multiple spaces
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

/**
 * Normalize an artist name for comparison.
 */
function normalizeArtist(artist) {
  if (!artist || typeof artist !== 'string') return '';
  let normalized = artist.toLowerCase().trim();

  // Remove "feat.", "ft.", "featuring" and everything after
  normalized = normalized.replace(/\s*(feat\.?|ft\.?|featuring)\s+.*/i, '');

  // Remove content in parentheses
  normalized = normalized.replace(/\s*\([^)]*\)\s*/g, ' ');

  // Remove special characters except alphanumeric and spaces
  normalized = normalized.replace(/[^a-z0-9\s]/g, '');

  // Collapse multiple spaces
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

/**
 * Calculate Levenshtein distance between two strings.
 */
function levenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate similarity ratio between two strings (0 to 1).
 * 1 = identical, 0 = completely different.
 */
function similarity(a, b) {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const dist = levenshteinDistance(a, b);
  return 1 - dist / maxLen;
}

/**
 * Check if two songs are fuzzy matches (potential duplicates).
 * Returns a match object with similarity score and match type, or null if no match.
 *
 * @param {Object} newSong - { title, artist }
 * @param {Object} existingSong - { title, artist }
 * @returns {Object|null} - { score, matchType, normalizedNew, normalizedExisting } or null
 */
function isFuzzyMatch(newSong, existingSong) {
  const newTitle = normalizeTitle(newSong.title);
  const existingTitle = normalizeTitle(existingSong.title);
  const newArtist = normalizeArtist(newSong.artist);
  const existingArtist = normalizeArtist(existingSong.artist);

  // Skip if either title is empty after normalization
  if (!newTitle || !existingTitle) return null;

  // Check for exact normalized title match with same artist
  if (newTitle === existingTitle && newArtist === existingArtist) {
    return {
      score: 1.0,
      matchType: 'exact_normalized',
      normalizedNew: newTitle,
      normalizedExisting: existingTitle
    };
  }

  // Check for exact normalized title match with similar artist (different spelling)
  const titleSim = similarity(newTitle, existingTitle);
  const artistSim = similarity(newArtist, existingArtist);

  // High title similarity + same or similar artist = likely variation
  if (titleSim >= 0.85 && artistSim >= 0.7) {
    return {
      score: (titleSim * 0.7 + artistSim * 0.3),
      matchType: 'fuzzy_title_artist',
      normalizedNew: newTitle,
      normalizedExisting: existingTitle
    };
  }

  // Exact normalized title match regardless of artist (e.g., cover versions)
  // Only flag if titles are nearly identical
  if (titleSim >= 0.95 && artistSim >= 0.3) {
    return {
      score: titleSim * 0.8,
      matchType: 'same_song_different_artist',
      normalizedNew: newTitle,
      normalizedExisting: existingTitle
    };
  }

  // One title contains the other (substring match) with same artist
  if (artistSim >= 0.7 && (newTitle.includes(existingTitle) || existingTitle.includes(newTitle))) {
    const longerLen = Math.max(newTitle.length, existingTitle.length);
    const shorterLen = Math.min(newTitle.length, existingTitle.length);
    const containScore = shorterLen / longerLen;
    if (containScore >= 0.5) {
      return {
        score: containScore * 0.9,
        matchType: 'substring_match',
        normalizedNew: newTitle,
        normalizedExisting: existingTitle
      };
    }
  }

  return null;
}

/**
 * Find all fuzzy matches for a new song against a list of existing requests.
 *
 * @param {Object} newSong - { title, artist }
 * @param {Array} existingRequests - Array of { id, song_title, artist_name, vote_count, status }
 * @returns {Array} - Array of match objects sorted by score descending
 */
function findFuzzyMatches(newSong, existingRequests) {
  const matches = [];

  for (const existing of existingRequests) {
    const match = isFuzzyMatch(
      { title: newSong.title, artist: newSong.artist },
      { title: existing.song_title, artist: existing.artist_name }
    );

    if (match) {
      matches.push({
        ...match,
        existingRequest: {
          id: existing.id,
          songTitle: existing.song_title,
          artistName: existing.artist_name,
          voteCount: existing.vote_count || 0,
          status: existing.status
        }
      });
    }
  }

  // Sort by score descending
  matches.sort((a, b) => b.score - a.score);

  return matches;
}

module.exports = {
  normalizeTitle,
  normalizeArtist,
  levenshteinDistance,
  similarity,
  isFuzzyMatch,
  findFuzzyMatches
};
