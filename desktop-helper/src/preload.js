const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('votebeats', {
  // Store operations
  getStore: (key) => ipcRenderer.invoke('get-store', key),
  setStore: (key, value) => ipcRenderer.invoke('set-store', key, value),

  // State
  getState: () => ipcRenderer.invoke('get-state'),

  // Authentication
  login: (credentials) => ipcRenderer.invoke('login', credentials),

  // Events
  getEvents: () => ipcRenderer.invoke('get-events'),
  selectEvent: (data) => ipcRenderer.invoke('select-event', data),

  // Setup
  completeSetup: () => ipcRenderer.invoke('complete-setup'),
  resetSetup: () => ipcRenderer.invoke('reset-setup'),

  // Monitoring
  startMonitoring: () => ipcRenderer.invoke('start-monitoring'),
  stopMonitoring: () => ipcRenderer.invoke('stop-monitoring'),
  checkSpotify: () => ipcRenderer.invoke('check-spotify'),
  confirmUpdate: (track) => ipcRenderer.invoke('confirm-update', track),

  // Auto-update
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  restartAndUpdate: () => ipcRenderer.invoke('restart-and-update'),
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('update-available', (event, data) => callback(data));
  },
  onUpdateDownloaded: (callback) => {
    ipcRenderer.on('update-downloaded', (event, data) => callback(data));
  },

  // Auto-start
  setAutoStart: (enabled) => ipcRenderer.invoke('set-auto-start', enabled),
  getAutoStart: () => ipcRenderer.invoke('get-auto-start'),

  // Event listeners from main process
  onTrackChanged: (callback) => {
    ipcRenderer.on('track-changed', (event, data) => callback(data));
  },
  onMonitoringStatus: (callback) => {
    ipcRenderer.on('monitoring-status', (event, data) => callback(data));
  },
  onConfirmNowPlaying: (callback) => {
    ipcRenderer.on('confirm-now-playing', (event, data) => callback(data));
  },
  onSongEndingSoon: (callback) => {
    ipcRenderer.on('song-ending-soon', (event, data) => callback(data));
  },
  onNowPlayingUpdated: (callback) => {
    ipcRenderer.on('now-playing-updated', (event, data) => callback(data));
  },
  onNavigate: (callback) => {
    ipcRenderer.on('navigate', (event, page) => callback(page));
  }
});
