const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Database path priority:
// 1. DB_PATH env var (if set)
// 2. Production: ./data/votebeats.db (Docker volume mount)
// 3. Development: ./votebeats.db (backwards compatible)
function getDatabasePath() {
  if (process.env.DB_PATH) {
    const envPath = process.env.DB_PATH;
    return path.isAbsolute(envPath) ? envPath : path.join(__dirname, envPath);
  }

  if (process.env.NODE_ENV === 'production') {
    return path.join(__dirname, 'data', 'votebeats.db');
  }

  return path.join(__dirname, 'votebeats.db');
}

const dbPath = getDatabasePath();

// Ensure directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
  console.log(`Created database directory: ${dbDir}`);
}

console.log(`SQLite database path: ${dbPath}`);

const db = new Database(dbPath);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    dj_id TEXT NOT NULL,
    name TEXT NOT NULL,
    date TEXT,
    start_time TEXT,
    end_time TEXT,
    location TEXT,
    description TEXT,
    status TEXT DEFAULT 'upcoming',
    settings TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (dj_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS requests (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    song_title TEXT NOT NULL,
    artist_name TEXT NOT NULL,
    album_art_url TEXT,
    duration_ms INTEGER,
    explicit_flag INTEGER DEFAULT 0,
    itunes_track_id TEXT,
    requested_by TEXT NOT NULL,
    nickname TEXT,
    message TEXT,
    status TEXT DEFAULT 'pending',
    vote_count INTEGER DEFAULT 0,
    manual_order INTEGER,
    dj_notes TEXT,
    prepped_in_spotify INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (event_id) REFERENCES events(id)
  );

  CREATE TABLE IF NOT EXISTS votes (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(request_id, user_id),
    FOREIGN KEY (request_id) REFERENCES requests(id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    dj_id TEXT NOT NULL,
    content TEXT NOT NULL,
    target_audience TEXT DEFAULT 'all',
    type TEXT DEFAULT 'custom',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (event_id) REFERENCES events(id),
    FOREIGN KEY (dj_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS attendees (
    id TEXT PRIMARY KEY,
    nickname TEXT,
    code_word TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
`);


// Migrations - add columns if they don't exist
try { db.exec('ALTER TABLE users ADD COLUMN totp_secret TEXT'); } catch(e) { /* column exists */ }
try { db.exec('ALTER TABLE users ADD COLUMN totp_enabled INTEGER DEFAULT 0'); } catch(e) { /* column exists */ }
try { db.exec("ALTER TABLE users ADD COLUMN notification_preferences TEXT DEFAULT '{}'"); } catch(e) { /* column exists */ }
try { db.exec("ALTER TABLE users ADD COLUMN default_event_settings TEXT DEFAULT '{}'"); } catch(e) { /* column exists */ }

try { db.exec('ALTER TABLE requests ADD COLUMN song_genre TEXT'); } catch(e) { /* column exists */ }
try { db.exec('ALTER TABLE events ADD COLUMN edit_mode INTEGER DEFAULT 0'); } catch(e) { /* column exists */ }
try { db.exec('ALTER TABLE events ADD COLUMN edit_mode_snapshot TEXT'); } catch(e) { /* column exists */ }

// Spotify integration columns
try { db.exec('ALTER TABLE users ADD COLUMN spotify_connected INTEGER DEFAULT 0'); } catch(e) { /* column exists */ }
try { db.exec('ALTER TABLE users ADD COLUMN spotify_display_name TEXT'); } catch(e) { /* column exists */ }
try { db.exec('ALTER TABLE users ADD COLUMN spotify_email TEXT'); } catch(e) { /* column exists */ }
try { db.exec('ALTER TABLE users ADD COLUMN spotify_connected_at TEXT'); } catch(e) { /* column exists */ }

// Create message_reads table for tracking which attendees have read messages
db.exec(`
  CREATE TABLE IF NOT EXISTS message_reads (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    read_at TEXT DEFAULT (datetime('now')),
    UNIQUE(message_id, user_id),
    FOREIGN KEY (message_id) REFERENCES messages(id)
  );
`);

// Create settings_templates table
db.exec(`
  CREATE TABLE IF NOT EXISTS settings_templates (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    settings TEXT NOT NULL DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// Create feedback table for in-app feedback collection
db.exec(`
  CREATE TABLE IF NOT EXISTS feedback (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    user_type TEXT NOT NULL DEFAULT 'attendee',
    user_id TEXT,
    feedback_type TEXT NOT NULL DEFAULT 'praise',
    rating INTEGER,
    message TEXT,
    email TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (event_id) REFERENCES events(id)
  );
`);

// Create feature_requests table for public roadmap
db.exec(`
  CREATE TABLE IF NOT EXISTS feature_requests (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'under_consideration',
    author_id TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (author_id) REFERENCES users(id)
  );
`);

// Create roadmap_votes table for feature request voting
db.exec(`
  CREATE TABLE IF NOT EXISTS roadmap_votes (
    id TEXT PRIMARY KEY,
    feature_request_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (feature_request_id) REFERENCES feature_requests(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(feature_request_id, user_id)
  );
`);

// Create domain_config table for custom domain setup
db.exec(`
  CREATE TABLE IF NOT EXISTS domain_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    custom_domain TEXT,
    domain_verified INTEGER DEFAULT 0,
    ssl_provisioned INTEGER DEFAULT 0,
    www_redirect TEXT DEFAULT 'www_to_apex',
    dns_configured INTEGER DEFAULT 0,
    cors_updated INTEGER DEFAULT 0,
    spotify_redirect_updated INTEGER DEFAULT 0,
    firebase_hosting_configured INTEGER DEFAULT 0,
    setup_completed_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
`);

// Ensure a single config row exists
const domainRow = db.prepare('SELECT id FROM domain_config WHERE id = 1').get();
if (!domainRow) {
  db.prepare('INSERT INTO domain_config (id) VALUES (1)').run();
}

// Create rankings table for ranked-choice queue mode (participant personal ranked lists)
db.exec(`
  CREATE TABLE IF NOT EXISTS rankings (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    participant_id TEXT NOT NULL,
    request_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    added_at TEXT DEFAULT (datetime('now')),
    UNIQUE(event_id, participant_id, request_id),
    FOREIGN KEY (event_id) REFERENCES events(id),
    FOREIGN KEY (request_id) REFERENCES requests(id)
  );
`);

// Create ranking_scores table for cached aggregate pairwise scores (both Consensus and Discovery modes)
db.exec(`
  CREATE TABLE IF NOT EXISTS ranking_scores (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    request_id TEXT NOT NULL,
    consensus_copeland INTEGER DEFAULT 0,
    consensus_wins INTEGER DEFAULT 0,
    consensus_losses INTEGER DEFAULT 0,
    consensus_win_rate REAL DEFAULT 0,
    consensus_rank INTEGER,
    discovery_copeland INTEGER DEFAULT 0,
    discovery_wins INTEGER DEFAULT 0,
    discovery_losses INTEGER DEFAULT 0,
    discovery_win_rate REAL DEFAULT 0,
    discovery_rank INTEGER,
    ranker_count INTEGER DEFAULT 0,
    avg_position REAL,
    is_hidden_gem INTEGER DEFAULT 0,
    calculated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(event_id, request_id),
    FOREIGN KEY (event_id) REFERENCES events(id),
    FOREIGN KEY (request_id) REFERENCES requests(id)
  );
`);

// Create seen_songs table for tracking browse queue seen/unseen per participant
db.exec(`
  CREATE TABLE IF NOT EXISTS seen_songs (
    event_id TEXT NOT NULL,
    participant_id TEXT NOT NULL,
    request_id TEXT NOT NULL,
    seen_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (event_id, participant_id, request_id)
  );
`);

// Migration: add final_scores column for historical preservation when songs are played
try { db.exec('ALTER TABLE requests ADD COLUMN final_scores TEXT'); } catch(e) { /* column exists */ }

module.exports = db;
