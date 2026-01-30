const fs = require('fs');
const path = require('path');

const indexFile = path.join(__dirname, 'index.js');
let content = fs.readFileSync(indexFile, 'utf8');

if (content.includes('spotifyRoutes')) {
  console.log('ALREADY EXISTS: Spotify routes already in index.js');
  process.exit(0);
}

// Add import
content = content.replace(
  "const templateRoutes = require('./routes/templates');",
  "const templateRoutes = require('./routes/templates');\nconst spotifyRoutes = require('./routes/spotify');"
);

// Add route mount
content = content.replace(
  "app.use('/api/templates', templateRoutes);",
  "app.use('/api/templates', templateRoutes);\napp.use('/api/spotify', spotifyRoutes);"
);

fs.writeFileSync(indexFile, content);
console.log('SUCCESS: Added Spotify routes to index.js');
