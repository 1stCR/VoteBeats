const fs = require('fs');
const path = require('path');

const apiFile = path.join(__dirname, '..', 'client', 'src', 'config', 'api.js');
let content = fs.readFileSync(apiFile, 'utf8');

if (content.includes('getSpotifyStatus')) {
  console.log('ALREADY EXISTS: Spotify API methods already in api.js');
  process.exit(0);
}

const spotifyMethods = `
  // Spotify Integration
  getSpotifyStatus: () =>
    apiRequest('/api/spotify/status'),

  connectSpotify: (spotifyDisplayName, spotifyEmail) =>
    apiRequest('/api/spotify/connect', {
      method: 'POST',
      body: JSON.stringify({ spotifyDisplayName, spotifyEmail }),
    }),

  disconnectSpotify: () =>
    apiRequest('/api/spotify/disconnect', { method: 'DELETE' }),

  // Health`;

content = content.replace('  // Health', spotifyMethods);

fs.writeFileSync(apiFile, content);
console.log('SUCCESS: Added Spotify API methods to api.js');
