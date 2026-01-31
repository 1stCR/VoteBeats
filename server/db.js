const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'votebeats.db');
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

module.exports = db;
