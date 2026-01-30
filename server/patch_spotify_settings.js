const fs = require('fs');
const path = require('path');

const settingsFile = path.join(__dirname, '..', 'client', 'src', 'pages', 'SettingsPage.js');
let content = fs.readFileSync(settingsFile, 'utf8');

if (content.includes('spotifyConnected')) {
  console.log('ALREADY EXISTS: Spotify section already in SettingsPage.js');
  process.exit(0);
}

// 1. Add Music icon import
content = content.replace(
  "import { User, Mail, Save, ArrowLeft, CheckCircle, Shield, ShieldCheck, ShieldOff, Lock, Eye, EyeOff, Bell, Volume2, Sliders  } from 'lucide-react';",
  "import { User, Mail, Save, ArrowLeft, CheckCircle, Shield, ShieldCheck, ShieldOff, Lock, Eye, EyeOff, Bell, Volume2, Sliders, Music, Link2, Unlink2, ExternalLink  } from 'lucide-react';"
);

// 2. Add Spotify state variables after defEvtError state
content = content.replace(
  "  const [defEvtSaving, setDefEvtSaving] = useState(false);\n  const [defEvtSuccess, setDefEvtSuccess] = useState('');\n  const [defEvtError, setDefEvtError] = useState('');",
  `  const [defEvtSaving, setDefEvtSaving] = useState(false);
  const [defEvtSuccess, setDefEvtSuccess] = useState('');
  const [defEvtError, setDefEvtError] = useState('');

  // Spotify connection state
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [spotifyDisplayName, setSpotifyDisplayName] = useState('');
  const [spotifyEmail, setSpotifyEmail] = useState('');
  const [spotifyConnectedAt, setSpotifyConnectedAt] = useState('');
  const [spotifyLoading, setSpotifyLoading] = useState(true);
  const [spotifyAction, setSpotifyAction] = useState(false);
  const [spotifyError, setSpotifyError] = useState('');
  const [spotifySuccess, setSpotifySuccess] = useState('');`
);

// 3. Add Spotify useEffect after default event settings useEffect
content = content.replace(
  "  // Load default event settings on mount\n  useEffect(() => {\n    api.getDefaultEventSettings()\n      .then(data => setDefaultEventSettings(data))\n      .catch(() => {})\n      .finally(() => setDefEvtLoading(false));\n  }, []);",
  `  // Load default event settings on mount
  useEffect(() => {
    api.getDefaultEventSettings()
      .then(data => setDefaultEventSettings(data))
      .catch(() => {})
      .finally(() => setDefEvtLoading(false));
  }, []);

  // Load Spotify connection status on mount
  useEffect(() => {
    api.getSpotifyStatus()
      .then(data => {
        setSpotifyConnected(data.connected);
        setSpotifyDisplayName(data.displayName || '');
        setSpotifyEmail(data.email || '');
        setSpotifyConnectedAt(data.connectedAt || '');
      })
      .catch(() => {
        // Ignore - endpoint might not be available
      })
      .finally(() => setSpotifyLoading(false));
  }, []);`
);

// 4. Add Spotify handler functions before handleLogout
content = content.replace(
  "  async function handleLogout() {",
  `  async function handleConnectSpotify() {
    setSpotifyError('');
    setSpotifySuccess('');
    setSpotifyAction(true);
    try {
      // Simulate Spotify OAuth - in production, would redirect to Spotify auth URL
      const djName = currentUser?.displayName || 'DJ';
      const data = await api.connectSpotify(djName + "'s Spotify", currentUser?.email);
      setSpotifyConnected(data.connected);
      setSpotifyDisplayName(data.displayName);
      setSpotifyEmail(data.email);
      setSpotifyConnectedAt(data.connectedAt);
      setSpotifySuccess('Spotify account connected successfully!');
      setTimeout(() => setSpotifySuccess(''), 5000);
    } catch (err) {
      setSpotifyError(err.message || 'Failed to connect Spotify account.');
    } finally {
      setSpotifyAction(false);
    }
  }

  async function handleDisconnectSpotify() {
    setSpotifyError('');
    setSpotifySuccess('');
    setSpotifyAction(true);
    try {
      await api.disconnectSpotify();
      setSpotifyConnected(false);
      setSpotifyDisplayName('');
      setSpotifyEmail('');
      setSpotifyConnectedAt('');
      setSpotifySuccess('Spotify account disconnected.');
      setTimeout(() => setSpotifySuccess(''), 5000);
    } catch (err) {
      setSpotifyError(err.message || 'Failed to disconnect Spotify account.');
    } finally {
      setSpotifyAction(false);
    }
  }

  async function handleLogout() {`
);

// 5. Add Spotify section in JSX - after Notification Preferences, before Account Info
const spotifySection = `
        {/* Spotify Integration Section */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Music className="w-5 h-5 text-green-500" />
            Spotify Integration
          </h2>

          {spotifyError && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm mb-4">
              {spotifyError}
            </div>
          )}

          {spotifySuccess && (
            <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 px-4 py-3 rounded-lg text-sm flex items-center gap-2 mb-4">
              <CheckCircle className="w-4 h-4" />
              {spotifySuccess}
            </div>
          )}

          {spotifyLoading ? (
            <div className="text-slate-500 dark:text-slate-400 text-sm">Loading Spotify status...</div>
          ) : spotifyConnected ? (
            <div>
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                    <Music className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-green-800 dark:text-green-300">Connected to Spotify</p>
                    <p className="text-sm text-green-600 dark:text-green-400">{spotifyDisplayName}</p>
                  </div>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Account</span>
                    <span className="text-slate-700 dark:text-slate-300">{spotifyEmail}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Connected</span>
                    <span className="text-slate-700 dark:text-slate-300">
                      {spotifyConnectedAt ? new Date(spotifyConnectedAt).toLocaleDateString() : 'Unknown'}
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                Your Spotify account is linked. You can export playlists and use Spotify features in your events.
              </p>

              <div className="flex gap-3">
                <a
                  href="https://open.spotify.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 border border-green-300 dark:border-green-700 text-green-600 dark:text-green-400 rounded-xl hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors text-sm font-medium flex items-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open Spotify
                </a>
                <button
                  onClick={handleDisconnectSpotify}
                  disabled={spotifyAction}
                  className="px-4 py-2 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                >
                  <Unlink2 className="w-4 h-4" />
                  {spotifyAction ? 'Disconnecting...' : 'Disconnect Spotify'}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                Connect your Spotify account to enable playlist export, one-click song lookup, and seamless integration with your DJ workflow.
              </p>
              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 mb-4">
                <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">With Spotify connected, you can:</h4>
                <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-400">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                    Export your event queue as a Spotify playlist
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                    One-click search for songs in Spotify
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                    Track prep status for each song
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                    Download playlists for offline playback
                  </li>
                </ul>
              </div>
              <button
                onClick={handleConnectSpotify}
                disabled={spotifyAction}
                className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-xl transition-all shadow-lg shadow-green-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Link2 className="w-5 h-5" />
                {spotifyAction ? 'Connecting...' : 'Connect Spotify Account'}
              </button>
            </div>
          )}
        </div>

        {/* Account Info Section */}`;

content = content.replace("        {/* Account Info Section */}", spotifySection);

// 6. Update Account Info section to include Spotify connection status
content = content.replace(
  `            <div className="flex justify-between items-center py-2">
              <span className="text-slate-500 dark:text-slate-400">Two-Factor Auth</span>
              <span className={twoFAEnabled ? 'text-green-600 dark:text-green-400 font-medium' : 'text-slate-400'}>
                {twoFAEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>`,
  `            <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-700">
              <span className="text-slate-500 dark:text-slate-400">Two-Factor Auth</span>
              <span className={twoFAEnabled ? 'text-green-600 dark:text-green-400 font-medium' : 'text-slate-400'}>
                {twoFAEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-slate-500 dark:text-slate-400">Spotify</span>
              <span className={spotifyConnected ? 'text-green-600 dark:text-green-400 font-medium' : 'text-slate-400'}>
                {spotifyConnected ? 'Connected' : 'Not connected'}
              </span>
            </div>`
);

fs.writeFileSync(settingsFile, content);
console.log('SUCCESS: Added Spotify section to SettingsPage.js');
