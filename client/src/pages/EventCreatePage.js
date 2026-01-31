import React, { useState, useEffect } from 'react';
import { Music, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../config/api';

export default function EventCreatePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    date: '',
    location: '',
    startTime: '',
    endTime: '',
    description: '',
  });


  const [defaultSettings, setDefaultSettings] = useState(null);

  // Load default event settings
  useEffect(() => {
    api.getDefaultEventSettings()
      .then(data => setDefaultSettings(data))
      .catch(() => {});
  }, []);

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Event name is required');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const eventData = {
        name: form.name.trim(),
        date: form.date || null,
        location: form.location.trim() || null,
        start_time: form.startTime || null,
        end_time: form.endTime || null,
        description: form.description.trim() || null,
      };
      // Apply default settings if available (send as object, server will stringify)
      if (defaultSettings) {
        eventData.settings = {
          blockExplicit: defaultSettings.blockExplicit || false,
          votingEnabled: defaultSettings.votingEnabled !== false,
          requestsOpen: defaultSettings.requestsOpen !== false,
          maxRequestsPerUser: defaultSettings.maxRequestsPerUser || 0,
          autoApprove: defaultSettings.autoApprove || false,
        };
      }
      await api.createEvent(eventData);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Failed to create event');
    } finally {
      setLoading(false);
    }
  }

  const inputClass = "w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <header className="bg-white dark:bg-slate-800 shadow-sm border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          </button>
          <div className="flex items-center gap-2">
            <Music className="w-6 h-6 text-primary-500" />
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Create Event</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-8">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">New Event</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-8">Set up your event details and start collecting song requests.</p>
          {defaultSettings && (defaultSettings.blockExplicit || !defaultSettings.votingEnabled || !defaultSettings.requestsOpen || defaultSettings.autoApprove || defaultSettings.maxRequestsPerUser > 0) && (
            <div className="mb-6 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg p-3 text-primary-700 dark:text-primary-300 text-sm">
              Your default event settings will be applied. You can change them later in event settings.
            </div>
          )}

          {error && (
            <div className="mb-6 bg-red-500/10 border border-red-500/50 rounded-lg p-3 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Event Name *
              </label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="e.g., Friday Night Dance"
                className={inputClass}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Date</label>
                <input type="date" name="date" value={form.date} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Location (optional)</label>
                <input type="text" name="location" value={form.location} onChange={handleChange} placeholder="e.g., Community Center" className={inputClass} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Start Time</label>
                <input type="time" name="startTime" value={form.startTime} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">End Time</label>
                <input type="time" name="endTime" value={form.endTime} onChange={handleChange} className={inputClass} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description (optional)</label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                rows={3}
                placeholder="Tell attendees about your event..."
                className={inputClass + " resize-none"}
              />
            </div>

            <div className="pt-4 flex gap-4">
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="flex-1 py-3 px-6 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-3 px-6 bg-gradient-to-r from-primary-500 to-accent-500 text-white font-semibold rounded-lg hover:from-primary-600 hover:to-accent-600 transition-all shadow-lg shadow-primary-500/25 disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Event'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
