const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3002';

const REQUEST_TIMEOUT = 30000; // 30 second timeout

function getUserFriendlyMessage(status, serverMessage) {
  if (serverMessage && !serverMessage.includes('status') && serverMessage.length < 200) {
    return serverMessage;
  }
  switch (status) {
    case 400: return 'Invalid request. Please check your input and try again.';
    case 401: return 'Your session has expired. Please log in again.';
    case 403: return 'You don\'t have permission to perform this action.';
    case 404: return 'The requested resource was not found.';
    case 409: return 'This action conflicts with the current state. Please refresh and try again.';
    case 429: return 'Too many requests. Please wait a moment and try again.';
    case 500: return 'Something went wrong on our end. Please try again later.';
    case 502:
    case 503: return 'The server is temporarily unavailable. Please try again in a few moments.';
    default: return 'An unexpected error occurred. Please try again.';
  }
}

async function apiRequest(path, options = {}) {
  const token = localStorage.getItem('votebeats_token');

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      const error = new Error('The request timed out. Please check your connection and try again.');
      error.isNetworkError = true;
      error.isTimeout = true;
      throw error;
    }
    const error = new Error('Unable to connect to the server. Please check your internet connection and try again.');
    error.isNetworkError = true;
    throw error;
  }

  clearTimeout(timeoutId);

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const serverMsg = data?.error;
    const error = new Error(getUserFriendlyMessage(response.status, serverMsg));
    error.status = response.status;
    error.data = data;
    error.serverMessage = serverMsg;
    throw error;
  }

  return data;
}

export const api = {
  // Auth
  register: (email, password, displayName) =>
    apiRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, displayName }),
    }),

  login: (email, password, totpCode) =>
    apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, ...(totpCode ? { totpCode } : {}) }),
    }),

  logout: () =>
    apiRequest('/api/auth/logout', { method: 'POST' }),

  forgotPassword: (email) =>
    apiRequest('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  getMe: () =>
    apiRequest('/api/auth/me'),

  updateProfile: (displayName) =>
    apiRequest('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify({ displayName }),
    }),


  // 2FA
  get2FAStatus: () =>
    apiRequest('/api/auth/2fa/status'),

  setup2FA: () =>
    apiRequest('/api/auth/2fa/setup', { method: 'POST' }),

  verify2FA: (code) =>
    apiRequest('/api/auth/2fa/verify', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  disable2FA: (password) =>
    apiRequest('/api/auth/2fa/disable', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),

  validate2FA: (code, tempToken) =>
    apiRequest('/api/auth/2fa/validate', {
      method: 'POST',
      body: JSON.stringify({ code, tempToken }),
    }),


  // Notification Preferences
  getNotificationPreferences: () =>
    apiRequest('/api/auth/notification-preferences'),

  updateNotificationPreferences: (prefs) =>
    apiRequest('/api/auth/notification-preferences', {
      method: 'PUT',
      body: JSON.stringify(prefs),
    }),


  // Default Event Settings
  getDefaultEventSettings: () =>
    apiRequest('/api/auth/default-event-settings'),

  resolveCodeWord: (codeWord) =>
    apiRequest('/api/code-word', {
      method: 'POST',
      body: JSON.stringify({ codeWord }),
    }),

  updateDefaultEventSettings: (settings) =>
    apiRequest('/api/auth/default-event-settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),

  // Events
  createEvent: (eventData) =>
    apiRequest('/api/events', {
      method: 'POST',
      body: JSON.stringify(eventData),
    }),

  getEvents: () =>
    apiRequest('/api/events'),

  getEvent: (id) =>
    apiRequest(`/api/events/${id}`),

  getPublicEvent: (id) =>
    apiRequest(`/api/events/${id}/public`),

  updateEvent: (id, eventData) =>
    apiRequest(`/api/events/${id}`, {
      method: 'PUT',
      body: JSON.stringify(eventData),
    }),

  deleteEvent: (id) =>
    apiRequest(`/api/events/${id}`, { method: 'DELETE' }),

  // Requests
  checkSimilarSongs: (eventId, songTitle, artistName) =>
    apiRequest(`/api/events/${eventId}/requests/check-similar?songTitle=${encodeURIComponent(songTitle)}&artistName=${encodeURIComponent(artistName)}`),

  submitRequest: (eventId, requestData) =>
    apiRequest(`/api/events/${eventId}/requests`, {
      method: 'POST',
      body: JSON.stringify(requestData),
    }),

  getRequests: (eventId, userId) =>
    apiRequest(`/api/events/${eventId}/requests${userId ? `?userId=${encodeURIComponent(userId)}` : ''}`),

  updateRequestStatus: (eventId, requestId, status) =>
    apiRequest(`/api/events/${eventId}/requests/${requestId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),

  deleteRequest: (eventId, requestId) =>
    apiRequest(`/api/events/${eventId}/requests/${requestId}`, { method: 'DELETE' }),

  bulkApproveRequests: (eventId, requestIds) =>
    apiRequest(`/api/events/${eventId}/requests/bulk-approve`, {
      method: 'PUT',
      body: JSON.stringify({ requestIds }),
    }),

  bulkRejectRequests: (eventId, requestIds) =>
    apiRequest(`/api/events/${eventId}/requests/bulk-reject`, {
      method: 'PUT',
      body: JSON.stringify({ requestIds }),
    }),

  voteRequest: (eventId, requestId, userId) =>
    apiRequest(`/api/events/${eventId}/requests/${requestId}/vote`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),

  updateRequestOrder: (eventId, requestId, manualOrder) =>
    apiRequest(`/api/events/${eventId}/requests/${requestId}/order`, {
      method: 'PUT',
      body: JSON.stringify({ manualOrder }),
    }),

  getRequestVoters: (eventId, requestId) =>
    apiRequest(`/api/events/${eventId}/requests/${requestId}/voters`),

  updateRequestNotes: (eventId, requestId, notes) =>
    apiRequest(`/api/events/${eventId}/requests/${requestId}/notes`, {
      method: 'PUT',
      body: JSON.stringify({ notes }),
    }),

  // Edit Mode
  toggleEditMode: (eventId, enabled) =>
    apiRequest(`/api/events/${eventId}/edit-mode`, {
      method: 'PUT',
      body: JSON.stringify({ enabled }),
    }),

  getEditModeStatus: (eventId) =>
    apiRequest(`/api/events/${eventId}/edit-mode`),

  // Songs
  searchSongs: (query) =>
    apiRequest(`/api/songs/search?q=${encodeURIComponent(query)}`),

  // Messages
  sendDJMessage: (eventId, content, targetAudience = 'all') =>
    apiRequest(`/api/events/${eventId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, targetAudience }),
    }),

  getEventMessages: (eventId, userId) =>
    apiRequest(`/api/events/${eventId}/messages${userId ? `?userId=${encodeURIComponent(userId)}` : ''}`),

  deleteDJMessage: (eventId, messageId) =>
    apiRequest(`/api/events/${eventId}/messages/${messageId}`, { method: 'DELETE' }),

  markMessageRead: (eventId, messageId, userId) =>
    apiRequest(`/api/events/${eventId}/messages/${messageId}/read`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),

  // Templates
  getTemplates: () =>
    apiRequest('/api/templates'),

  createTemplate: (name, settings) =>
    apiRequest('/api/templates', {
      method: 'POST',
      body: JSON.stringify({ name, settings }),
    }),

  updateTemplate: (id, name, settings) =>
    apiRequest(`/api/templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name, settings }),
    }),

  deleteTemplate: (id) =>
    apiRequest(`/api/templates/${id}`, { method: 'DELETE' }),


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

  // Feedback
  submitFeedback: (eventId, feedbackData) =>
    apiRequest(`/api/events/${eventId}/feedback`, {
      method: 'POST',
      body: JSON.stringify(feedbackData),
    }),

  getEventFeedback: (eventId) =>
    apiRequest(`/api/events/${eventId}/feedback`),

  getAllFeedback: () =>
    apiRequest('/api/feedback/all'),

  getFeedbackStats: () =>
    apiRequest('/api/feedback/stats'),

  // Roadmap / Feature Request Board
  getRoadmap: (params) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiRequest('/api/roadmap' + query);
  },

  createFeatureRequest: (data) =>
    apiRequest('/api/roadmap', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  voteFeatureRequest: (id) =>
    apiRequest('/api/roadmap/' + id + '/vote', {
      method: 'POST',
    }),

  updateFeatureRequestStatus: (id, status) =>
    apiRequest('/api/roadmap/' + id + '/status', {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),

  deleteFeatureRequest: (id) =>
    apiRequest('/api/roadmap/' + id, {
      method: 'DELETE',
    }),

  // Domain Configuration
  getDomainConfig: () =>
    apiRequest('/api/domain/config'),

  updateDomainConfig: (config) =>
    apiRequest('/api/domain/config', {
      method: 'PUT',
      body: JSON.stringify(config),
    }),

  getDnsInstructions: () =>
    apiRequest('/api/domain/dns-instructions'),

  // Health
  healthCheck: () =>
    apiRequest('/api/health'),
};

export default api;
