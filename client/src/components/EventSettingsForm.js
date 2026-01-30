import React, { useState, useEffect } from 'react';
import { Save, CheckCircle } from 'lucide-react';
import { api } from '../config/api';

export default function EventSettingsForm({ event, eventId, onSaved }) {
  const [formData, setFormData] = useState({
    name: '',
    date: '',
    startTime: '',
    endTime: '',
    location: '',
    description: '',
    blockExplicit: true,
    profanityFilter: true,
    requireApproval: false,
    warnExplicit: true,
    requestLimit: 0,
    postCloseRequestLimit: '',
    votingSchedule: 'immediate',
    votingOpenTime: '',
    votingCloseMode: 'manual',
    votingCloseTime: '',
    votingClosed: false,
    queueVisibility: 'full',
    postCloseVisibility: 'show',
    duringEventVisibility: 'nowPlayingAndUpcoming',
    requestCloseTime: '',
    cooldownMinutes: 0,
    lowQueueThreshold: 3,
  });
  const [templates, setTemplates] = useState([]);
  const [templateName, setTemplateName] = useState('');
  const [showTemplateSave, setShowTemplateSave] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getTemplates().then(setTemplates).catch(() => {});
  }, []);

  useEffect(() => {
    if (event) {
      const settings = event.settings || {};
      setFormData({
        name: event.name || '',
        date: event.date || '',
        startTime: event.startTime || event.start_time || '',
        endTime: event.endTime || event.end_time || '',
        location: event.location || '',
        description: event.description || '',
        blockExplicit: settings.blockExplicit !== false,
        profanityFilter: settings.profanityFilter !== false,
        requireApproval: settings.requireApproval || false,
        warnExplicit: settings.warnExplicit !== false,
        requestLimit: settings.requestLimit || 0,
        postCloseRequestLimit: settings.postCloseRequestLimit !== undefined ? settings.postCloseRequestLimit : '',
        votingSchedule: settings.votingSchedule || 'immediate',
        votingOpenTime: settings.votingOpenTime || '',
        votingCloseMode: settings.votingCloseMode || 'manual',
        votingCloseTime: settings.votingCloseTime || '',
        votingClosed: settings.votingClosed || false,
        queueVisibility: settings.queueVisibility || 'full',
        postCloseVisibility: settings.postCloseVisibility || 'show',
        duringEventVisibility: settings.duringEventVisibility || 'nowPlayingAndUpcoming',
        requestCloseTime: settings.requestCloseTime || '',
        cooldownMinutes: settings.cooldownMinutes || 0,
        lowQueueThreshold: settings.lowQueueThreshold !== undefined ? settings.lowQueueThreshold : 3,
      });
    }
  }, [event]);

  async function saveTemplate() {
    if (!templateName.trim()) return;
    try {
      const { blockExplicit, profanityFilter, requireApproval, warnExplicit, requestLimit, postCloseRequestLimit, votingSchedule, votingOpenTime, votingCloseMode, votingCloseTime, votingClosed, queueVisibility, postCloseVisibility, duringEventVisibility, requestCloseTime, cooldownMinutes, lowQueueThreshold } = formData;
      const settings = { blockExplicit, profanityFilter, requireApproval, warnExplicit, requestLimit, postCloseRequestLimit, votingSchedule, votingOpenTime, votingCloseMode, votingCloseTime, votingClosed, queueVisibility, postCloseVisibility, duringEventVisibility, requestCloseTime, cooldownMinutes, lowQueueThreshold };
      const created = await api.createTemplate(templateName.trim(), settings);
      setTemplates(prev => [created, ...prev]);
      setTemplateName('');
      setShowTemplateSave(false);
    } catch (err) {
      setError(err.message || 'Failed to save template');
    }
  }

  function loadTemplate(template) {
    const s = template.settings || {};
    setFormData(prev => ({
      ...prev,
      blockExplicit: s.blockExplicit !== undefined ? s.blockExplicit : true,
      profanityFilter: s.profanityFilter !== undefined ? s.profanityFilter : true,
      requireApproval: s.requireApproval || false,
      warnExplicit: s.warnExplicit !== undefined ? s.warnExplicit : true,
      requestLimit: s.requestLimit || 0,
      postCloseRequestLimit: s.postCloseRequestLimit !== undefined ? s.postCloseRequestLimit : '',
      votingSchedule: s.votingSchedule || 'immediate',
      votingOpenTime: s.votingOpenTime || '',
      votingCloseMode: s.votingCloseMode || 'manual',
      votingCloseTime: s.votingCloseTime || '',
      votingClosed: s.votingClosed || false,
      queueVisibility: s.queueVisibility || 'full',
      postCloseVisibility: s.postCloseVisibility || 'show',
      duringEventVisibility: s.duringEventVisibility || 'nowPlayingAndUpcoming',
      requestCloseTime: s.requestCloseTime || '',
      cooldownMinutes: s.cooldownMinutes || 0,
      lowQueueThreshold: s.lowQueueThreshold !== undefined ? s.lowQueueThreshold : 3,
    }));
    setSaved(false);
  }

  async function deleteTemplate(id) {
    try {
      await api.deleteTemplate(id);
      setTemplates(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      console.error('Failed to delete template:', err);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const { blockExplicit, profanityFilter, requireApproval, warnExplicit, requestLimit, postCloseRequestLimit, votingSchedule, votingOpenTime, votingCloseMode, votingCloseTime, votingClosed, queueVisibility, postCloseVisibility, duringEventVisibility, requestCloseTime, cooldownMinutes, lowQueueThreshold, ...eventFields } = formData;
      const updated = await api.updateEvent(eventId, {
        ...eventFields,
        settings: { ...(event?.settings || {}), blockExplicit, profanityFilter, requireApproval, warnExplicit, requestLimit: requestLimit > 0 ? requestLimit : 0, postCloseRequestLimit: postCloseRequestLimit !== '' ? parseInt(postCloseRequestLimit) || 0 : undefined, votingSchedule, votingOpenTime: votingSchedule === 'scheduled' ? votingOpenTime : '', votingCloseMode, votingCloseTime: votingCloseMode === 'scheduled' ? votingCloseTime : '', votingClosed, queueVisibility, postCloseVisibility, duringEventVisibility, requestCloseTime: requestCloseTime || undefined, cooldownMinutes: cooldownMinutes > 0 ? cooldownMinutes : 0, lowQueueThreshold: lowQueueThreshold > 0 ? lowQueueThreshold : 3 },
      });
      onSaved(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  function handleChange(field, value) {
    setFormData(prev => ({ ...prev, [field]: value }));
    setSaved(false);
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-8">
      <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Event Settings</h3>

      {error && (
        <div className="mb-4 bg-red-500/10 border border-red-500/50 rounded-lg p-3 text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {saved && (
        <div className="mb-4 bg-green-500/10 border border-green-500/50 rounded-lg p-3 text-green-600 dark:text-green-400 text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          Settings saved successfully!
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">

      {/* Templates */}
      <div className="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-4 border border-primary-200 dark:border-primary-800">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-primary-700 dark:text-primary-300">Settings Templates</label>
          <button
            type="button"
            onClick={() => setShowTemplateSave(!showTemplateSave)}
            className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-200"
          >
            {showTemplateSave ? 'Cancel' : '+ Save Current'}
          </button>
        </div>
        {showTemplateSave && (
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Template name..."
              className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-600 border border-slate-300 dark:border-slate-500 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
            <button
              type="button"
              onClick={saveTemplate}
              disabled={!templateName.trim()}
              className="px-3 py-1.5 bg-primary-500 text-white text-sm rounded-lg hover:bg-primary-600 disabled:opacity-50 transition-colors"
            >
              Save
            </button>
          </div>
        )}
        {templates.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">No saved templates yet. Configure settings and save as template.</p>
        ) : (
          <div className="space-y-1">
            {templates.map(t => (
              <div key={t.id} className="flex items-center justify-between bg-white dark:bg-slate-700 rounded px-3 py-1.5">
                <button
                  type="button"
                  onClick={() => loadTemplate(t)}
                  className="text-sm text-slate-700 dark:text-slate-200 hover:text-primary-600 dark:hover:text-primary-400 font-medium"
                >
                  {t.name}
                </button>
                <button
                  type="button"
                  onClick={() => deleteTemplate(t.id)}
                  className="text-xs text-red-400 hover:text-red-600"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Event Name *</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            required
            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
            placeholder="Event name"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Date</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => handleChange('date', e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Location</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => handleChange('location', e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
              placeholder="Location"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Start Time</label>
            <input
              type="time"
              value={formData.startTime}
              onChange={(e) => handleChange('startTime', e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">End Time</label>
            <input
              type="time"
              value={formData.endTime}
              onChange={(e) => handleChange('endTime', e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
            />
          </div>
        </div>

        {/* Content Filtering */}
        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 border border-slate-200 dark:border-slate-600">
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Block Explicit Songs</label>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Filter out songs marked as explicit on iTunes</p>
            </div>
            <button
              type="button"
              onClick={() => handleChange('blockExplicit', !formData.blockExplicit)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.blockExplicit ? 'bg-primary-500' : 'bg-slate-300 dark:bg-slate-600'}`}
              role="switch"
              aria-checked={formData.blockExplicit}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.blockExplicit ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>

        {/* Warn Explicit */}
        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 border border-slate-200 dark:border-slate-600">
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Warn About Explicit</label>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Show warning badge on explicit songs in your queue</p>
            </div>
            <button
              type="button"
              onClick={() => handleChange('warnExplicit', !formData.warnExplicit)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.warnExplicit ? 'bg-primary-500' : 'bg-slate-300 dark:bg-slate-600'}`}
              role="switch"
              aria-checked={formData.warnExplicit}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.warnExplicit ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>

        {/* Profanity Filter */}
        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 border border-slate-200 dark:border-slate-600">
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Profanity Filter</label>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Filter profanity in attendee messages and nicknames</p>
            </div>
            <button
              type="button"
              onClick={() => handleChange('profanityFilter', !formData.profanityFilter)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.profanityFilter ? 'bg-primary-500' : 'bg-slate-300 dark:bg-slate-600'}`}
              role="switch"
              aria-checked={formData.profanityFilter}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.profanityFilter ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>

        {/* Require Approval */}
        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 border border-slate-200 dark:border-slate-600">
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Require DJ Approval</label>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Manually review all song requests before they enter the queue</p>
            </div>
            <button
              type="button"
              onClick={() => handleChange('requireApproval', !formData.requireApproval)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.requireApproval ? 'bg-primary-500' : 'bg-slate-300 dark:bg-slate-600'}`}
              role="switch"
              aria-checked={formData.requireApproval}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.requireApproval ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>

        {/* Request Limit */}
        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 border border-slate-200 dark:border-slate-600">
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Request Limit Per Attendee</label>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Maximum song requests per person (0 = unlimited)</p>
            </div>
            <input
              type="number"
              min="0"
              max="100"
              value={formData.requestLimit}
              onChange={(e) => handleChange('requestLimit', parseInt(e.target.value) || 0)}
              className="w-20 px-3 py-1.5 bg-white dark:bg-slate-600 border border-slate-300 dark:border-slate-500 rounded-lg text-slate-900 dark:text-white text-center focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
            />
          </div>
        </div>

        {/* Post-Close Request Limit */}
        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 border border-slate-200 dark:border-slate-600">
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Post-Close Request Limit</label>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Requests allowed per person after event ends (empty = no limit, 0 = blocked)</p>
            </div>
            <input
              type="number"
              min="0"
              max="100"
              value={formData.postCloseRequestLimit}
              onChange={(e) => handleChange('postCloseRequestLimit', e.target.value)}
              placeholder="No limit"
              className="w-20 px-3 py-1.5 bg-white dark:bg-slate-600 border border-slate-300 dark:border-slate-500 rounded-lg text-slate-900 dark:text-white text-center focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
            />
          </div>
        </div>

        {/* Voting Schedule */}
        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 border border-slate-200 dark:border-slate-600">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Voting Schedule</label>
            <div className="flex gap-3 mb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="votingSchedule"
                  value="immediate"
                  checked={formData.votingSchedule === 'immediate'}
                  onChange={(e) => handleChange('votingSchedule', e.target.value)}
                  className="text-primary-500"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">Open immediately</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="votingSchedule"
                  value="scheduled"
                  checked={formData.votingSchedule === 'scheduled'}
                  onChange={(e) => handleChange('votingSchedule', e.target.value)}
                  className="text-primary-500"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">Scheduled</span>
              </label>
            </div>
            {formData.votingSchedule === 'scheduled' && (
              <input
                type="datetime-local"
                value={formData.votingOpenTime}
                onChange={(e) => handleChange('votingOpenTime', e.target.value)}
                className="w-full px-3 py-1.5 bg-white dark:bg-slate-600 border border-slate-300 dark:border-slate-500 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all text-sm"
              />
            )}
          </div>
        </div>

        {/* Voting Close */}
        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 border border-slate-200 dark:border-slate-600">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Voting Close</label>
            <div className="flex gap-3 mb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="votingCloseMode"
                  value="manual"
                  checked={formData.votingCloseMode === 'manual'}
                  onChange={(e) => handleChange('votingCloseMode', e.target.value)}
                  className="text-primary-500"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">Manual</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="votingCloseMode"
                  value="scheduled"
                  checked={formData.votingCloseMode === 'scheduled'}
                  onChange={(e) => handleChange('votingCloseMode', e.target.value)}
                  className="text-primary-500"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">Scheduled</span>
              </label>
            </div>
            {formData.votingCloseMode === 'scheduled' && (
              <input
                type="datetime-local"
                value={formData.votingCloseTime}
                onChange={(e) => handleChange('votingCloseTime', e.target.value)}
                className="w-full px-3 py-1.5 bg-white dark:bg-slate-600 border border-slate-300 dark:border-slate-500 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all text-sm mb-2"
              />
            )}
            {formData.votingCloseMode === 'manual' && (
              <button
                type="button"
                onClick={() => handleChange('votingClosed', !formData.votingClosed)}
                className={`mt-1 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${formData.votingClosed ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-red-500 hover:bg-red-600 text-white'}`}
              >
                {formData.votingClosed ? 'Reopen Voting' : 'Close Voting Now'}
              </button>
            )}
          </div>
        </div>

        {/* Queue Visibility */}
        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 border border-slate-200 dark:border-slate-600">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Queue Visibility for Attendees</label>
          <select
            value={formData.queueVisibility}
            onChange={(e) => handleChange('queueVisibility', e.target.value)}
            className="w-full px-3 py-2 bg-white dark:bg-slate-600 border border-slate-300 dark:border-slate-500 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all text-sm"
          >
            <option value="full">Full Queue - Attendees see all requests</option>
            <option value="own">Own Only - Attendees see only their requests</option>
            <option value="blind">Blind - Attendees can only search and submit</option>
          </select>
        </div>

        {/* Post-Close Visibility */}
        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 border border-slate-200 dark:border-slate-600">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Post-Close Queue Visibility</label>
          <select
            value={formData.postCloseVisibility}
            onChange={(e) => handleChange('postCloseVisibility', e.target.value)}
            className="w-full px-3 py-2 bg-white dark:bg-slate-600 border border-slate-300 dark:border-slate-500 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all text-sm"
          >
            <option value="show">Show Final Playlist - Attendees see the final queue</option>
            <option value="hide">Hide Playlist - Queue hidden after voting closes</option>
          </select>
        </div>

        {/* During-Event Visibility */}
        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 border border-slate-200 dark:border-slate-600">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">During-Event Queue Visibility</label>
          <select
            value={formData.duringEventVisibility}
            onChange={(e) => handleChange('duringEventVisibility', e.target.value)}
            className="w-full px-3 py-2 bg-white dark:bg-slate-600 border border-slate-300 dark:border-slate-500 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all text-sm"
          >
            <option value="nowPlayingAndUpcoming">Now Playing + Upcoming Queue</option>
            <option value="nowPlayingOnly">Now Playing Only</option>
            <option value="hide">Hide All</option>
          </select>
        </div>

        {/* Auto-Close Requests */}
        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 border border-slate-200 dark:border-slate-600">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Auto-Close Requests At</label>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Stop accepting new requests after this time (leave empty for no auto-close)</p>
            <input
              type="datetime-local"
              value={formData.requestCloseTime}
              onChange={(e) => handleChange('requestCloseTime', e.target.value)}
              className="w-full px-3 py-1.5 bg-white dark:bg-slate-600 border border-slate-300 dark:border-slate-500 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all text-sm"
            />
          </div>
        </div>

        {/* Cool-Down Period */}
        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 border border-slate-200 dark:border-slate-600">
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Cool-Down Period (minutes)</label>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Time between requests from the same attendee (0 = no cooldown)</p>
            </div>
            <input
              type="number"
              min="0"
              max="120"
              value={formData.cooldownMinutes}
              onChange={(e) => handleChange('cooldownMinutes', parseInt(e.target.value) || 0)}
              className="w-20 px-3 py-1.5 bg-white dark:bg-slate-600 border border-slate-300 dark:border-slate-500 rounded-lg text-slate-900 dark:text-white text-center focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
            />
          </div>
        </div>

        {/* Low Queue Notification Threshold */}
        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 border border-slate-200 dark:border-slate-600">
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Low Queue Alert Threshold</label>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Notify attendees when queued songs fall below this number (0 = disabled)</p>
            </div>
            <input
              type="number"
              min="0"
              max="20"
              value={formData.lowQueueThreshold}
              onChange={(e) => handleChange('lowQueueThreshold', parseInt(e.target.value) || 0)}
              className="w-20 px-3 py-1.5 bg-white dark:bg-slate-600 border border-slate-300 dark:border-slate-500 rounded-lg text-slate-900 dark:text-white text-center focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            rows={3}
            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all resize-none"
            placeholder="Event description"
          />
        </div>

        <div className="pt-4">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-primary-500 to-accent-500 text-white font-semibold rounded-lg hover:from-primary-600 hover:to-accent-600 transition-all shadow-lg shadow-primary-500/25 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
