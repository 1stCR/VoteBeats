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

  login: (email, password) =>
    apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  logout: () =>
    apiRequest('/api/auth/logout', { method: 'POST' }),

  getMe: () =>
    apiRequest('/api/auth/me'),

  updateProfile: (displayName) =>
    apiRequest('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify({ displayName }),
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

  updateEvent: (id, eventData) =>
    apiRequest(`/api/events/${id}`, {
      method: 'PUT',
      body: JSON.stringify(eventData),
    }),

  deleteEvent: (id) =>
    apiRequest(`/api/events/${id}`, { method: 'DELETE' }),

  // Requests
  submitRequest: (eventId, requestData) =>
    apiRequest(`/api/events/${eventId}/requests`, {
      method: 'POST',
      body: JSON.stringify(requestData),
    }),

  getRequests: (eventId) =>
    apiRequest(`/api/events/${eventId}/requests`),

  updateRequestStatus: (eventId, requestId, status) =>
    apiRequest(`/api/events/${eventId}/requests/${requestId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),

  deleteRequest: (eventId, requestId) =>
    apiRequest(`/api/events/${eventId}/requests/${requestId}`, { method: 'DELETE' }),

  voteRequest: (eventId, requestId, userId) =>
    apiRequest(`/api/events/${eventId}/requests/${requestId}/vote`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),

  // Songs
  searchSongs: (query) =>
    apiRequest(`/api/songs/search?q=${encodeURIComponent(query)}`),

  // Health
  healthCheck: () =>
    apiRequest('/api/health'),
};

export default api;
