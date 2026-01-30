const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, Notification, dialog } = require('electron');
const path = require('path');
const Store = require('electron-store');
const { autoUpdater } = require('electron-updater');

// Persistent settings store
const store = new Store({
  defaults: {
    serverUrl: 'http://localhost:3002',
    authToken: null,
    djEmail: null,
    selectedEventId: null,
    selectedEventName: null,
    automationMode: 'semi-automatic', // 'fully-automatic', 'semi-automatic', 'manual'
    pollingInterval: 3000, // ms
    autoStart: false,
    setupComplete: false
  }
});

let mainWindow = null;
let tray = null;
let spotifyPoller = null;
let isQuitting = false;

// Current state
let currentState = {
  isMonitoring: false,
  spotifyDetected: false,
  isOnline: true,
  nowPlaying: null,
  lastDetectedTrack: null,
  offlineQueue: []
};

function createTrayIcon(status) {
  // Status: 'connected', 'no-spotify', 'offline'
  const colors = {
    connected: '#22c55e',
    'no-spotify': '#eab308',
    offline: '#ef4444'
  };

  // Create a simple 16x16 tray icon using nativeImage
  const size = 16;
  const canvas = Buffer.alloc(size * size * 4);
  const color = colors[status] || colors.connected;
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);

  for (let i = 0; i < size * size; i++) {
    const x = i % size;
    const y = Math.floor(i / size);
    const cx = size / 2;
    const cy = size / 2;
    const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);

    if (dist <= size / 2 - 1) {
      canvas[i * 4] = r;
      canvas[i * 4 + 1] = g;
      canvas[i * 4 + 2] = b;
      canvas[i * 4 + 3] = 255;
    } else {
      canvas[i * 4 + 3] = 0;
    }
  }

  return nativeImage.createFromBuffer(canvas, { width: size, height: size });
}

function createMainWindow() {
  const setupComplete = store.get('setupComplete');

  mainWindow = new BrowserWindow({
    width: setupComplete ? 420 : 500,
    height: setupComplete ? 600 : 650,
    minWidth: 380,
    minHeight: 500,
    resizable: true,
    frame: true,
    title: 'VoteBeats Desktop Helper',
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (setupComplete) {
    mainWindow.loadFile(path.join(__dirname, 'renderer', 'main.html'));
  } else {
    mainWindow.loadFile(path.join(__dirname, 'renderer', 'setup.html'));
  }

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

function createTray() {
  const status = !currentState.isOnline ? 'offline'
    : !currentState.spotifyDetected ? 'no-spotify'
    : 'connected';

  tray = new Tray(createTrayIcon(status));
  updateTrayMenu();

  tray.setToolTip('VoteBeats Desktop Helper');

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    } else {
      createMainWindow();
    }
  });
}

function updateTrayMenu() {
  const eventName = store.get('selectedEventName') || 'No event selected';
  const nowPlaying = currentState.nowPlaying
    ? `${currentState.nowPlaying.title} - ${currentState.nowPlaying.artist}`
    : 'Nothing playing';

  const statusText = !currentState.isOnline ? 'Offline'
    : !currentState.spotifyDetected ? 'Spotify not detected'
    : currentState.isMonitoring ? 'Connected & Monitoring'
    : 'Ready';

  const contextMenu = Menu.buildFromTemplate([
    { label: `Event: ${eventName}`, enabled: false },
    { label: `Now Playing: ${nowPlaying}`, enabled: false },
    { type: 'separator' },
    { label: `Status: ${statusText}`, enabled: false },
    { type: 'separator' },
    {
      label: currentState.isMonitoring ? 'Stop Monitoring' : 'Start Monitoring',
      click: () => {
        if (currentState.isMonitoring) {
          stopSpotifyMonitoring();
        } else {
          startSpotifyMonitoring();
        }
      }
    },
    {
      label: 'Open Dashboard',
      click: () => {
        const { shell } = require('electron');
        const serverUrl = store.get('serverUrl').replace(':3002', ':3000');
        shell.openExternal(`${serverUrl}/dashboard`);
      }
    },
    { type: 'separator' },
    {
      label: 'Show Window',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createMainWindow();
        }
      }
    },
    {
      label: 'Settings',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
          mainWindow.webContents.send('navigate', 'settings');
        } else {
          createMainWindow();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit VoteBeats Helper',
      click: () => {
        isQuitting = true;
        stopSpotifyMonitoring();
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  // Update tray icon based on status
  const status = !currentState.isOnline ? 'offline'
    : !currentState.spotifyDetected ? 'no-spotify'
    : 'connected';
  tray.setImage(createTrayIcon(status));
}

// Spotify local API monitoring
async function checkSpotifyStatus() {
  const fetch = require('node-fetch');
  try {
    // Try the Spotify local API (Windows/Mac default port)
    const response = await fetch('http://localhost:4381/remote/status.json', {
      headers: { 'Origin': 'https://open.spotify.com' },
      timeout: 2000
    });

    if (response.ok) {
      const data = await response.json();
      currentState.spotifyDetected = true;

      if (data.track) {
        const track = {
          title: data.track.track_resource?.name || data.track.track_name || 'Unknown',
          artist: data.track.artist_resource?.name || data.track.artist_name || 'Unknown',
          album: data.track.album_resource?.name || data.track.album_name || '',
          uri: data.track.track_resource?.uri || '',
          duration: data.track.length || 0,
          position: data.playing_position || 0,
          isPlaying: data.playing || false
        };

        return track;
      }
    }
    return null;
  } catch (err) {
    // Spotify not running or not accessible - try alternative port
    try {
      const altResponse = await fetch('http://127.0.0.1:4370/remote/status.json', {
        headers: { 'Origin': 'https://open.spotify.com' },
        timeout: 2000
      });
      if (altResponse.ok) {
        const data = await altResponse.json();
        currentState.spotifyDetected = true;
        return data.track ? {
          title: data.track.track_resource?.name || 'Unknown',
          artist: data.track.artist_resource?.name || 'Unknown',
          album: data.track.album_resource?.name || '',
          uri: data.track.track_resource?.uri || '',
          duration: data.track.length || 0,
          position: data.playing_position || 0,
          isPlaying: data.playing || false
        } : null;
      }
    } catch {
      // Neither port available
    }

    currentState.spotifyDetected = false;
    return null;
  }
}

async function updateNowPlaying(track) {
  const fetch = require('node-fetch');
  const serverUrl = store.get('serverUrl');
  const authToken = store.get('authToken');
  const eventId = store.get('selectedEventId');

  if (!authToken || !eventId) return;

  const payload = {
    songTitle: track.title,
    artistName: track.artist,
    spotifyUri: track.uri,
    position: Math.round(track.position * 1000),
    duration: Math.round(track.duration * 1000),
    status: 'nowPlaying'
  };

  if (!currentState.isOnline) {
    // Store for offline sync
    currentState.offlineQueue.push({
      ...payload,
      timestamp: Date.now()
    });
    return;
  }

  try {
    const response = await fetch(`${serverUrl}/api/events/${eventId}/now-playing`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      const result = await response.json();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('now-playing-updated', result);
      }
    }
  } catch (err) {
    console.error('Failed to update now playing:', err.message);
    currentState.isOnline = false;
    currentState.offlineQueue.push({ ...payload, timestamp: Date.now() });
    updateTrayMenu();
  }
}

async function syncOfflineQueue() {
  if (currentState.offlineQueue.length === 0) return;

  const fetch = require('node-fetch');
  const serverUrl = store.get('serverUrl');
  const authToken = store.get('authToken');
  const eventId = store.get('selectedEventId');

  if (!authToken || !eventId) return;

  try {
    const response = await fetch(`${serverUrl}/api/events/${eventId}/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ updates: currentState.offlineQueue })
    });

    if (response.ok) {
      currentState.offlineQueue = [];
      currentState.isOnline = true;
      updateTrayMenu();
    }
  } catch (err) {
    console.error('Offline sync failed:', err.message);
  }
}

function startSpotifyMonitoring() {
  if (spotifyPoller) return;

  const interval = store.get('pollingInterval');
  currentState.isMonitoring = true;

  spotifyPoller = setInterval(async () => {
    const track = await checkSpotifyStatus();

    if (track && track.isPlaying) {
      const trackKey = `${track.title}::${track.artist}`;
      const lastKey = currentState.lastDetectedTrack
        ? `${currentState.lastDetectedTrack.title}::${currentState.lastDetectedTrack.artist}`
        : null;

      // New song detected
      if (trackKey !== lastKey) {
        const automationMode = store.get('automationMode');

        // Mark previous song as played
        if (currentState.lastDetectedTrack) {
          const playedPayload = { ...currentState.lastDetectedTrack, status: 'played' };
          if (automationMode === 'fully-automatic') {
            await updateNowPlaying({ ...currentState.lastDetectedTrack });
          }
        }

        currentState.lastDetectedTrack = track;
        currentState.nowPlaying = track;

        if (automationMode === 'fully-automatic') {
          await updateNowPlaying(track);
        } else if (automationMode === 'semi-automatic') {
          // Show confirmation dialog
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('confirm-now-playing', track);
          }

          // Also show desktop notification
          if (Notification.isSupported()) {
            const notif = new Notification({
              title: 'New Song Detected',
              body: `${track.title} - ${track.artist}`,
              silent: false
            });
            notif.show();
          }
        } else {
          // Manual mode - just notify
          if (Notification.isSupported()) {
            const notif = new Notification({
              title: 'Song Change Detected',
              body: `${track.title} - ${track.artist}\nClick to update queue.`,
              silent: false
            });
            notif.show();
          }
        }

        updateTrayMenu();

        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('track-changed', track);
        }
      }

      // Song ending alert (30 seconds before end)
      if (track.duration > 0) {
        const remaining = track.duration - track.position;
        if (remaining > 0 && remaining <= 30 && remaining > 27) {
          if (Notification.isSupported()) {
            new Notification({
              title: 'Song Ending Soon',
              body: `${track.title} ends in ${Math.round(remaining)} seconds`,
              silent: false
            }).show();
          }
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('song-ending-soon', { track, remaining: Math.round(remaining) });
          }
        }
      }
    }

    // Periodic online check & sync
    if (!currentState.isOnline) {
      try {
        const fetch = require('node-fetch');
        await fetch(store.get('serverUrl') + '/api/events', { timeout: 3000 });
        currentState.isOnline = true;
        await syncOfflineQueue();
        updateTrayMenu();
      } catch {}
    }

    updateTrayMenu();
  }, interval);

  updateTrayMenu();

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('monitoring-status', { isMonitoring: true });
  }
}

function stopSpotifyMonitoring() {
  if (spotifyPoller) {
    clearInterval(spotifyPoller);
    spotifyPoller = null;
  }
  currentState.isMonitoring = false;
  updateTrayMenu();

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('monitoring-status', { isMonitoring: false });
  }
}

// IPC Handlers
ipcMain.handle('get-store', (event, key) => {
  return store.get(key);
});

ipcMain.handle('set-store', (event, key, value) => {
  store.set(key, value);
  return true;
});

ipcMain.handle('get-state', () => {
  return currentState;
});

ipcMain.handle('login', async (event, { email, password, serverUrl }) => {
  const fetch = require('node-fetch');
  try {
    if (serverUrl) store.set('serverUrl', serverUrl);
    const url = store.get('serverUrl');

    const response = await fetch(`${url}/api/desktop/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (response.ok) {
      const data = await response.json();
      store.set('authToken', data.token);
      store.set('djEmail', email);
      return { success: true, token: data.token, user: data.user };
    } else {
      const err = await response.json();
      return { success: false, error: err.message || 'Login failed' };
    }
  } catch (err) {
    return { success: false, error: 'Cannot connect to server: ' + err.message };
  }
});

ipcMain.handle('get-events', async () => {
  const fetch = require('node-fetch');
  try {
    const url = store.get('serverUrl');
    const token = store.get('authToken');

    const response = await fetch(`${url}/api/events`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
      const data = await response.json();
      return { success: true, events: data.events || data };
    }
    return { success: false, error: 'Failed to fetch events' };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('select-event', (event, { eventId, eventName }) => {
  store.set('selectedEventId', eventId);
  store.set('selectedEventName', eventName);
  updateTrayMenu();
  return { success: true };
});

ipcMain.handle('complete-setup', () => {
  store.set('setupComplete', true);
  if (mainWindow) {
    mainWindow.loadFile(path.join(__dirname, 'renderer', 'main.html'));
  }
  return { success: true };
});

ipcMain.handle('start-monitoring', () => {
  startSpotifyMonitoring();
  return { success: true };
});

ipcMain.handle('stop-monitoring', () => {
  stopSpotifyMonitoring();
  return { success: true };
});

ipcMain.handle('confirm-update', async (event, track) => {
  await updateNowPlaying(track);
  return { success: true };
});

ipcMain.handle('check-spotify', async () => {
  const track = await checkSpotifyStatus();
  return { detected: currentState.spotifyDetected, track };
});

ipcMain.handle('reset-setup', () => {
  store.clear();
  stopSpotifyMonitoring();
  if (mainWindow) {
    mainWindow.loadFile(path.join(__dirname, 'renderer', 'setup.html'));
  }
  return { success: true };
});

ipcMain.handle('set-auto-start', (event, enabled) => {
  store.set('autoStart', enabled);
  updateAutoStart();
  return { success: true, autoStart: enabled };
});

ipcMain.handle('get-auto-start', () => {
  return { autoStart: store.get('autoStart') };
});

// Auto-start with system
function updateAutoStart() {
  const autoStart = store.get('autoStart');
  app.setLoginItemSettings({
    openAtLogin: autoStart,
    path: process.execPath,
    args: ['--hidden']
  });
}

// App lifecycle
app.whenReady().then(() => {
  // Apply auto-start setting on launch
  updateAutoStart();

  // If launched with --hidden flag (from auto-start), don't show window initially
  const launchedHidden = process.argv.includes('--hidden');

  createMainWindow();
  createTray();

  if (launchedHidden && mainWindow) {
    mainWindow.hide();
  }

  // Auto-update check
  autoUpdater.checkForUpdatesAndNotify();
  autoUpdater.on('update-available', (info) => {
    if (Notification.isSupported()) {
      new Notification({
        title: 'Update Available',
        body: 'A new version of VoteBeats Desktop Helper is available. Downloading...'
      }).show();
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-available', info);
    }
  });
  autoUpdater.on('update-downloaded', (info) => {
    if (Notification.isSupported()) {
      new Notification({
        title: 'Update Ready',
        body: 'Update downloaded. Restart to apply.'
      }).show();
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-downloaded', info);
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    } else if (mainWindow) {
      mainWindow.show();
    }
  });
});

app.on('window-all-closed', () => {
  // Don't quit on window close - keep running in tray
  if (process.platform !== 'darwin') {
    // On Windows, the app continues via tray
  }
});

ipcMain.handle('restart-and-update', () => {
  autoUpdater.quitAndInstall();
});

ipcMain.handle('check-for-updates', async () => {
  try {
    const result = await autoUpdater.checkForUpdates();
    return { success: true, version: result?.updateInfo?.version };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  stopSpotifyMonitoring();
});

// Prevent multiple instances
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}
