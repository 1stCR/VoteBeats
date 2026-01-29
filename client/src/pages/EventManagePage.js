import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Music, Trash2, X, AlertTriangle, Calendar, MapPin, Clock, Check, XCircle, CheckSquare, Square, ListMusic, Settings, BarChart3, Inbox, MessageSquare, ClipboardList, ChevronDown } from 'lucide-react';
import { api } from '../config/api';
import EventSettingsForm from '../components/EventSettingsForm';

export default function EventManagePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [event, setEvent] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showBulkRejectDialog, setShowBulkRejectDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [selectedRequests, setSelectedRequests] = useState(new Set());
  const [djMessages, setDjMessages] = useState([]);
  const [newDJMessage, setNewDJMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [allEvents, setAllEvents] = useState([]);
  const [showEventDropdown, setShowEventDropdown] = useState(false);

  // Determine active view from URL path
  const pathParts = location.pathname.split('/');
  const lastPart = pathParts[pathParts.length - 1];
  const activeView = (lastPart === 'settings' || lastPart === 'analytics' || lastPart === 'pending' || lastPart === 'messages' || lastPart === 'prep') ? lastPart : 'queue';

  const loadEvent = useCallback(async () => {
    try {
      const data = await api.getEvent(id);
      setEvent(data);
    } catch (err) {
      setError(err.message || 'Failed to load event');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadRequests = useCallback(async () => {
    try {
      const data = await api.getRequests(id);
      setRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load requests:', err);
    }
  }, [id]);

  useEffect(() => {
    loadEvent();
    loadRequests();
  }, [loadEvent, loadRequests]);

  useEffect(() => {
    async function loadAllEvents() {
      try {
        const events = await api.getEvents();
        setAllEvents(Array.isArray(events) ? events : []);
      } catch (err) {
        console.error('Failed to load all events:', err);
      }
    }
    loadAllEvents();
  }, []);

  async function handleDelete() {
    setDeleting(true);
    try {
      await api.deleteEvent(id);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Failed to delete event');
      setShowDeleteDialog(false);
    } finally {
      setDeleting(false);
    }
  }

  function toggleSelect(requestId) {
    setSelectedRequests(prev => {
      const next = new Set(prev);
      if (next.has(requestId)) {
        next.delete(requestId);
      } else {
        next.add(requestId);
      }
      return next;
    });
  }

  const fetchDJMessages = useCallback(async () => {
    try {
      const msgs = await api.getEventMessages(id);
      setDjMessages(Array.isArray(msgs) ? msgs : []);
    } catch (err) {
      console.error('Failed to load DJ messages:', err);
    }
  }, [id]);

  useEffect(() => {
    fetchDJMessages();
  }, [fetchDJMessages]);

  async function handleSendDJMessage() {
    if (!newDJMessage.trim()) return;
    setSendingMessage(true);
    try {
      await api.sendDJMessage(id, newDJMessage.trim());
      setNewDJMessage('');
      fetchDJMessages();
    } catch (err) {
      alert(err.message || 'Failed to send message');
    }
    setSendingMessage(false);
  }

  async function handleDeleteDJMessage(messageId) {
    try {
      await api.deleteDJMessage(id, messageId);
      fetchDJMessages();
    } catch (err) {
      console.error('Failed to delete message');
    }
  }

  function toggleSelectAll() {
    const pendingRequests = requests.filter(r => r.status === 'pending');
    if (selectedRequests.size === pendingRequests.length && pendingRequests.length > 0) {
      setSelectedRequests(new Set());
    } else {
      setSelectedRequests(new Set(pendingRequests.map(r => r.id)));
    }
  }

  async function handleBulkReject() {
    setRejecting(true);
    try {
      await api.bulkRejectRequests(id, Array.from(selectedRequests));
      setSelectedRequests(new Set());
      setShowBulkRejectDialog(false);
      await loadRequests();
    } catch (err) {
      setError(err.message || 'Failed to reject requests');
    } finally {
      setRejecting(false);
    }
  }

  async function handleStatusChange(requestId, status) {
    try {
      await api.updateRequestStatus(id, requestId, status);
      await loadRequests();
    } catch (err) {
      setError(err.message || 'Failed to update request');
    }
  }

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const otherRequests = requests.filter(r => r.status !== 'pending');

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <p className="text-slate-500">Loading event...</p>
      </div>
    );
  }

  if (error && !event) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button onClick={() => navigate('/dashboard')} className="text-primary-500 hover:underline">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const sidebarLinks = [
    { key: 'queue', label: 'Queue', icon: ListMusic, path: '/events/' + id + '/manage/queue' },
    { key: 'pending', label: 'Pending Requests', icon: Inbox, path: '/events/' + id + '/manage/pending' },
    { key: 'messages', label: 'Messages', icon: MessageSquare, path: '/events/' + id + '/manage/messages' },
    { key: 'prep', label: 'Prep', icon: ClipboardList, path: '/events/' + id + '/manage/prep' },
    { key: 'settings', label: 'Settings', icon: Settings, path: '/events/' + id + '/manage/settings' },
    { key: 'analytics', label: 'Analytics', icon: BarChart3, path: '/events/' + id + '/manage/analytics' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col min-h-screen">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
          <div className="relative">
            <button
              onClick={() => setShowEventDropdown(!showEventDropdown)}
              className="flex items-center gap-2 w-full text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg p-1 -m-1 transition-colors"
              data-event-selector
            >
              <Music className="w-5 h-5 text-primary-500 flex-shrink-0" />
              <h2 className="font-bold text-slate-900 dark:text-white truncate flex-1">{event?.name}</h2>
              <ChevronDown className={"w-4 h-4 text-slate-400 transition-transform " + (showEventDropdown ? "rotate-180" : "")} />
            </button>
            {showEventDropdown && allEvents.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                {allEvents.map(ev => (
                  <button
                    key={ev.id}
                    onClick={() => {
                      setShowEventDropdown(false);
                      if (ev.id !== id) {
                        navigate('/events/' + ev.id + '/manage/' + activeView);
                      }
                    }}
                    className={"w-full text-left px-3 py-2 text-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50 " +
                      (ev.id === id ? "bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 font-medium" : "text-slate-700 dark:text-slate-300")
                    }
                  >
                    <div className="truncate">{ev.name}</div>
                    {ev.date && <div className="text-xs text-slate-400 truncate">{ev.date}</div>}
                  </button>
                ))}
              </div>
            )}
          </div>
          {event?.date && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 ml-7">{event.date}</p>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-3 space-y-1">
          {sidebarLinks.map(link => {
            const Icon = link.icon;
            const isActive = activeView === link.key;
            return (
              <button
                key={link.key}
                onClick={() => navigate(link.path)}
                className={'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ' +
                  (isActive
                    ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-white')
                }
                data-sidebar-link={link.key}
              >
                <Icon className={'w-5 h-5 ' + (isActive ? 'text-primary-500' : 'text-slate-400 dark:text-slate-500')} />
                {link.label}
              </button>
            );
          })}
        </nav>

        {/* Delete Event Button */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setShowDeleteDialog(true)}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-sm font-medium"
          >
            <Trash2 className="w-4 h-4" />
            Delete Event
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        <main className="flex-1 p-8 max-w-4xl">
          {error && (
            <div className="mb-6 bg-red-500/10 border border-red-500/50 rounded-lg p-3 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {activeView === 'queue' && (
            <>
              {/* Event Info Header */}
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 mb-6">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">{event?.name}</h2>
                <div className="flex flex-wrap gap-4 text-sm text-slate-600 dark:text-slate-300">
                  {event?.date && (
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <span>{event.date}</span>
                    </div>
                  )}
                  {event?.location && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-slate-400" />
                      <span>{event.location}</span>
                    </div>
                  )}
                  {(event?.start_time || event?.end_time) && (
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-slate-400" />
                      <span>{event?.start_time || ''} {event?.start_time && event?.end_time ? '-' : ''} {event?.end_time || ''}</span>
                    </div>
                  )}
                </div>
                {event?.description && (
                  <p className="mt-3 text-slate-500 dark:text-slate-400 text-sm">{event.description}</p>
                )}
              </div>

              {/* Song Requests Queue */}
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                    Song Requests ({requests.length})
                  </h3>
                  {selectedRequests.size > 0 && (
                    <button
                      onClick={() => setShowBulkRejectDialog(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject Selected ({selectedRequests.size})
                    </button>
                  )}
                </div>

                {requests.length === 0 ? (
                  <p className="text-slate-500 dark:text-slate-400 text-center py-8">No song requests yet. Share the event link with your audience!</p>
                ) : (
                  <div className="space-y-6">
                    {/* Pending requests with checkboxes */}
                    {pendingRequests.length > 0 && (
                      <div>
                        <div className="flex items-center gap-3 mb-3">
                          <button onClick={toggleSelectAll} className="text-slate-400 hover:text-primary-500 transition-colors">
                            {selectedRequests.size === pendingRequests.length ? (
                              <CheckSquare className="w-5 h-5 text-primary-500" />
                            ) : (
                              <Square className="w-5 h-5" />
                            )}
                          </button>
                          <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                            Pending ({pendingRequests.length})
                          </h4>
                        </div>
                        <div className="space-y-2">
                          {pendingRequests.map(request => (
                            <div
                              key={request.id}
                              className={'flex items-center gap-3 p-3 rounded-lg border transition-colors ' +
                                (selectedRequests.has(request.id)
                                  ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-700'
                                  : 'bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600')
                              }
                            >
                              <button
                                onClick={() => toggleSelect(request.id)}
                                className="text-slate-400 hover:text-primary-500 transition-colors flex-shrink-0"
                              >
                                {selectedRequests.has(request.id) ? (
                                  <CheckSquare className="w-5 h-5 text-primary-500" />
                                ) : (
                                  <Square className="w-5 h-5" />
                                )}
                              </button>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-slate-900 dark:text-white truncate">{request.song?.title}</p>
                                <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{request.song?.artist}</p>
                              </div>
                              <div className="flex items-center gap-1 text-sm text-slate-500">
                                <span>{request.voteCount || 0} votes</span>
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                  onClick={() => handleStatusChange(request.id, 'queued')}
                                  className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
                                  title="Approve"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleStatusChange(request.id, 'rejected')}
                                  className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                  title="Reject"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Other requests */}
                    {otherRequests.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
                          Processed ({otherRequests.length})
                        </h4>
                        <div className="space-y-2">
                          {otherRequests.map(request => (
                            <div
                              key={request.id}
                              className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 opacity-60"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-slate-900 dark:text-white truncate">{request.song?.title}</p>
                                <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{request.song?.artist}</p>
                              </div>
                              <span className={'text-xs font-medium px-2 py-1 rounded-full ' +
                                (request.status === 'rejected'
                                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                  : request.status === 'queued'
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                  : request.status === 'played'
                                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                  : 'bg-slate-100 text-slate-700 dark:bg-slate-600 dark:text-slate-300')
                              }>
                                {request.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}



          {activeView === 'pending' && (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  Pending Requests ({pendingRequests.length})
                </h3>
                {selectedRequests.size > 0 && (
                  <button
                    onClick={() => setShowBulkRejectDialog(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject Selected ({selectedRequests.size})
                  </button>
                )}
              </div>

              {pendingRequests.length === 0 ? (
                <p className="text-slate-500 dark:text-slate-400 text-center py-8">No pending requests at the moment.</p>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-3 mb-3">
                    <button onClick={toggleSelectAll} className="text-slate-400 hover:text-primary-500 transition-colors">
                      {selectedRequests.size === pendingRequests.length ? (
                        <CheckSquare className="w-5 h-5 text-primary-500" />
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                    </button>
                    <span className="text-sm text-slate-500 dark:text-slate-400">Select All</span>
                  </div>
                  {pendingRequests.map(request => (
                    <div
                      key={request.id}
                      className={'flex items-center gap-3 p-3 rounded-lg border transition-colors ' +
                        (selectedRequests.has(request.id)
                          ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-700'
                          : 'bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600')
                      }
                    >
                      <button
                        onClick={() => toggleSelect(request.id)}
                        className="text-slate-400 hover:text-primary-500 transition-colors flex-shrink-0"
                      >
                        {selectedRequests.has(request.id) ? (
                          <CheckSquare className="w-5 h-5 text-primary-500" />
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 dark:text-white truncate">{request.song?.title}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{request.song?.artist}</p>
                      </div>
                      <div className="flex items-center gap-1 text-sm text-slate-500">
                        <span>{request.voteCount || 0} votes</span>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => handleStatusChange(request.id, 'queued')}
                          className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
                          title="Approve"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleStatusChange(request.id, 'rejected')}
                          className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                          title="Reject"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}


          {activeView === 'messages' && (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">DJ Messages</h3>
              <div className="mb-6">
                <textarea
                  value={newDJMessage}
                  onChange={(e) => setNewDJMessage(e.target.value)}
                  placeholder="Type a message to your attendees..."
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none mb-3"
                />
                <button
                  onClick={handleSendDJMessage}
                  disabled={sendingMessage || !newDJMessage.trim()}
                  className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50 text-sm font-medium"
                >
                  {sendingMessage ? 'Sending...' : 'Send to All Attendees'}
                </button>
              </div>
              {djMessages.length === 0 ? (
                <p className="text-slate-500 dark:text-slate-400 text-center py-4">No messages sent yet.</p>
              ) : (
                <div className="space-y-3">
                  {djMessages.map(msg => (
                    <div key={msg.id} className="flex items-start justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-900 dark:text-white">{msg.content}</p>
                        <p className="text-xs text-slate-500 mt-1">{new Date(msg.createdAt).toLocaleString()}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteDJMessage(msg.id)}
                        className="text-red-500 hover:text-red-700 text-xs"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}


          {activeView === 'prep' && (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Prep Ahead</h3>
              <p className="text-slate-500 dark:text-slate-400 text-center py-8">Prepare your setlist and cue songs ahead of time. Coming soon.</p>
            </div>
          )}

          {activeView === 'settings' && (
            <EventSettingsForm event={event} eventId={id} onSaved={(updated) => setEvent(updated)} />
          )}

          {activeView === 'analytics' && (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-8">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Event Analytics</h3>
              <p className="text-slate-500 dark:text-slate-400">Analytics dashboard coming soon.</p>
            </div>
          )}
        </main>
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Delete Event</h3>
            </div>
            <p className="text-slate-600 dark:text-slate-300 mb-6">
              Are you sure you want to delete <strong>{event?.name}</strong>? This will permanently remove the event and all associated song requests. This action cannot be undone.
            </p>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setShowDeleteDialog(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete Event'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Reject Confirmation Dialog */}
      {showBulkRejectDialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Reject Requests</h3>
            </div>
            <p className="text-slate-600 dark:text-slate-300 mb-6">
              Are you sure you want to reject <strong>{selectedRequests.size}</strong> selected song request{selectedRequests.size !== 1 ? 's' : ''}? This action will mark them as rejected.
            </p>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setShowBulkRejectDialog(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkReject}
                disabled={rejecting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {rejecting ? 'Rejecting...' : 'Reject All Selected'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
