const fs = require('fs');
const path = require('path');

const dbFile = path.join(__dirname, 'db.js');
let content = fs.readFileSync(dbFile, 'utf8');

if (content.includes('spotify_connected')) {
  console.log('ALREADY EXISTS: Spotify columns already in db.js');
  process.exit(0);
}

const marker = "try { db.exec('ALTER TABLE events ADD COLUMN edit_mode_snapshot TEXT'); } catch(e) { /* column exists */ }";
const insertion = marker + `

// Spotify integration columns
try { db.exec('ALTER TABLE users ADD COLUMN spotify_connected INTEGER DEFAULT 0'); } catch(e) { /* column exists */ }
try { db.exec('ALTER TABLE users ADD COLUMN spotify_display_name TEXT'); } catch(e) { /* column exists */ }
try { db.exec('ALTER TABLE users ADD COLUMN spotify_email TEXT'); } catch(e) { /* column exists */ }
try { db.exec('ALTER TABLE users ADD COLUMN spotify_connected_at TEXT'); } catch(e) { /* column exists */ }`;

content = content.replace(marker, insertion);
fs.writeFileSync(dbFile, content);
console.log('SUCCESS: Added Spotify columns to db.js');
