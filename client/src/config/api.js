const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3002';

async function apiRequest(path, options = {}) {
  const token = localStorage.getItem('votebeats_token');

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(data?.error || `Request failed with status ${response.status}`);
    error.status = response.status;
    error.data = data;
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

  // Health
  healthCheck: () =>
    apiRequest('/api/health'),
};

export default api;
