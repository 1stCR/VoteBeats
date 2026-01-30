import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
// eslint-disable-next-line no-unused-vars
import { ArrowLeft, Music, Trash2, X, AlertTriangle, Calendar, MapPin, Clock, Check, XCircle, CheckSquare, Square, ListMusic, Settings, BarChart3, Inbox, MessageSquare, ClipboardList, ChevronDown, Menu, Sun, Moon, Download, Copy, ExternalLink, Play, StopCircle, Radio, Users, StickyNote, Save, ArrowUpDown, Search, Keyboard, GripVertical } from 'lucide-react';
import { api } from '../config/api';
import { useTheme } from '../contexts/ThemeContext';
import EventSettingsForm from '../components/EventSettingsForm';
import { QRCodeCanvas } from 'qrcode.react';

export default function EventManagePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { darkMode, toggleTheme } = useTheme();
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
  const [messageTargetAudience, setMessageTargetAudience] = useState('all');
  const [allEvents, setAllEvents] = useState([]);
  const [showEventDropdown, setShowEventDropdown] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [expandedVoters, setExpandedVoters] = useState({});
  const [voterData, setVoterData] = useState({});
  const [editingNotes, setEditingNotes] = useState(null); // requestId being edited
  const [noteTexts, setNoteTexts] = useState({}); // { requestId: text }
  const [batchMode, setBatchMode] = useState(false); // batch selection mode
  const [approving, setApproving] = useState(false);
  const [queueFilter, setQueueFilter] = useState('all'); // all, pending, queued, nowPlaying, played, rejected
  const [queueSort, setQueueSort] = useState('votes'); // votes, time, title, artist
  const [queueSearch, setQueueSearch] = useState(''); // search within queue
  const [showShortcuts, setShowShortcuts] = useState(false); // keyboard shortcuts help
  const [songEndingAlert, setSongEndingAlert] = useState(null); // { songId, nextSong, remainingSeconds }
  const [dismissedAlerts, setDismissedAlerts] = useState(new Set()); // set of songIds already dismissed
  const [requestToasts, setRequestToasts] = useState([]); // toast notifications for new requests
  const knownRequestIds = useRef(null); // tracks known request IDs to detect new ones
  const [draggedRequestId, setDraggedRequestId] = useState(null); // drag-and-drop: ID being dragged
  const [dragOverRequestId, setDragOverRequestId] = useState(null); // drag-and-drop: ID being hovered over
  const [editMode, setEditMode] = useState(false); // batch edit mode: pauses attendee updates
  const [togglingEditMode, setTogglingEditMode] = useState(false);
  const [preppedSongs, setPreppedSongs] = useState(() => {
    try {
      const saved = localStorage.getItem(`votebeats_prepped_${id}`);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  }); // set of request IDs marked as "Ready in Spotify"

  // Collapsible sections state (persisted to localStorage)
  const [collapsedSections, setCollapsedSections] = useState(() => {
    try {
      const saved = localStorage.getItem(`votebeats_collapsed_${id}`);
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  const toggleSection = (section) => {
    setCollapsedSections(prev => {
      const updated = { ...prev, [section]: !prev[section] };
      try { localStorage.setItem(`votebeats_collapsed_${id}`, JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  // Persist prepped songs to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(`votebeats_prepped_${id}`, JSON.stringify([...preppedSongs]));
    } catch {}
  }, [preppedSongs, id]);

  // Helper to format duration from milliseconds to mm:ss
  const formatDuration = (ms) => {
    if (!ms) return null;
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

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

  // Poll for real-time updates (new requests, vote changes)
  useEffect(() => {
    if (!id) return;
    const djPollInterval = setInterval(() => {
      loadRequests();
    }, 3000); // Poll every 3 seconds for real-time vote updates
    return () => clearInterval(djPollInterval);
  }, [id, loadRequests]);

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

  // New request notification: detect new pending requests and show toast (approval mode)
  const pageLoadTime = useRef(Date.now());
  useEffect(() => {
    const currentIds = new Set(requests.map(r => r.id));

    // On first load (null ref), seed the known IDs without showing toasts
    if (knownRequestIds.current === null) {
      knownRequestIds.current = currentIds;
      return;
    }

    // Don't show toasts within first 10 seconds of page load (let initial data settle)
    if (Date.now() - pageLoadTime.current < 10000) {
      knownRequestIds.current = currentIds;
      return;
    }

    // Only show notifications when require approval is enabled
    const approvalMode = event?.settings?.requireApproval;
    if (!approvalMode) {
      knownRequestIds.current = currentIds;
      return;
    }

    // Detect new request IDs that are pending
    const newPendingRequests = requests.filter(
      r => r.status === 'pending' && !knownRequestIds.current.has(r.id)
    );

    if (newPendingRequests.length > 0) {
      const newToasts = newPendingRequests.map(r => ({
        id: r.id,
        songTitle: r.song?.title || 'Unknown Song',
        artistName: r.song?.artist || 'Unknown Artist',
        albumArtUrl: r.song?.albumArtUrl || null,
        nickname: r.requestedBy?.nickname || null,
        timestamp: Date.now(),
      }));
      setRequestToasts(prev => [...prev, ...newToasts]);
    }

    knownRequestIds.current = currentIds;
  }, [requests, event]);

  // Auto-dismiss request toasts after 15 seconds
  useEffect(() => {
    if (requestToasts.length === 0) return;
    const timer = setTimeout(() => {
      setRequestToasts(prev => prev.slice(1));
    }, 15000);
    return () => clearTimeout(timer);
  }, [requestToasts]);

  // Song ending alert: monitor now-playing song and alert 30s before it ends
  useEffect(() => {
    const npReq = requests.find(r => r.status === 'nowPlaying');
    if (!npReq || !npReq.song?.durationMs || !npReq.updatedAt) {
      setSongEndingAlert(null);
      return;
    }

    const songId = npReq.id;
    const durationMs = npReq.song.durationMs;
    // Server stores datetime('now') as UTC without Z suffix; ensure UTC parsing
    const updatedAtStr = npReq.updatedAt || '';
    const startTime = new Date(updatedAtStr.includes('T') ? updatedAtStr : updatedAtStr.replace(' ', 'T') + 'Z').getTime();

    const checkRemaining = () => {
      const elapsed = Date.now() - startTime;
      const remainingMs = durationMs - elapsed;
      const remainingSec = Math.max(0, Math.floor(remainingMs / 1000));

      if (remainingSec <= 30 && remainingSec > 0 && !dismissedAlerts.has(songId)) {
        // Find next song in queue (sorted by votes, no search filter)
        const queued = requests.filter(r => r.status === 'queued');
        const sorted = [...queued].sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0));
        const nextSong = sorted[0] || null;

        setSongEndingAlert({
          songId,
          currentSong: npReq.song,
          nextSong: nextSong ? nextSong.song : null,
          nextSongId: nextSong ? nextSong.id : null,
          nextSongSpotifyUrl: nextSong ? getSpotifySearchUrl(nextSong.song) : null,
          remainingSeconds: remainingSec,
        });
      } else if (remainingSec <= 0 || dismissedAlerts.has(songId)) {
        setSongEndingAlert(prev => prev?.songId === songId ? null : prev);
      }
    };

    checkRemaining();
    const interval = setInterval(checkRemaining, 1000);
    return () => clearInterval(interval);
  }, [requests, dismissedAlerts]); // eslint-disable-line react-hooks/exhaustive-deps

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
      await api.sendDJMessage(id, newDJMessage.trim(), messageTargetAudience);
      setNewDJMessage('');
      setMessageTargetAudience('all');
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

  async function handleBulkApprove() {
    setApproving(true);
    try {
      await api.bulkApproveRequests(id, Array.from(selectedRequests));
      setSelectedRequests(new Set());
      setBatchMode(false);
      await loadRequests();
    } catch (err) {
      setError(err.message || 'Failed to approve requests');
    } finally {
      setApproving(false);
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

  async function handleEventStatusChange(newStatus) {
    try {
      await api.updateEvent(id, { status: newStatus });
      setEvent(prev => ({ ...prev, status: newStatus }));
    } catch (err) {
      setError('Failed to update event status');
    }
  }

  async function toggleVoters(requestId) {
    if (expandedVoters[requestId]) {
      setExpandedVoters(prev => ({ ...prev, [requestId]: false }));
      return;
    }
    try {
      const data = await api.getRequestVoters(id, requestId);
      setVoterData(prev => ({ ...prev, [requestId]: data }));
      setExpandedVoters(prev => ({ ...prev, [requestId]: true }));
    } catch (err) {
      console.error('Failed to load voters:', err);
    }
  }

  function toggleNotes(requestId, currentNotes) {
    if (editingNotes === requestId) {
      setEditingNotes(null);
      return;
    }
    setNoteTexts(prev => ({ ...prev, [requestId]: currentNotes || '' }));
    setEditingNotes(requestId);
  }

  async function handleSaveNotes(requestId) {
    try {
      await api.updateRequestNotes(id, requestId, noteTexts[requestId] || '');
      // Update local state to reflect saved notes
      setRequests(prev => prev.map(r =>
        r.id === requestId ? { ...r, djNotes: noteTexts[requestId] || null } : r
      ));
      setEditingNotes(null);
    } catch (err) {
      console.error('Failed to save notes:', err);
    }
  }

  function getSpotifySearchUrl(song) {
    if (!song) return null;
    const query = `${song.title || ''} ${song.artist || ''}`.trim();
    return `https://open.spotify.com/search/${encodeURIComponent(query)}`;
  }

  // Keyboard shortcuts for DJ power users
  useEffect(() => {
    function handleKeyDown(e) {
      // Don't trigger shortcuts when typing in inputs
      const tag = e.target.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) return;
      // Don't trigger with modifier keys (except shift for ?)
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      switch (e.key) {
        case '?':
          e.preventDefault();
          setShowShortcuts(prev => !prev);
          break;
        case 'a': {
          // Approve top pending request (by vote count)
          e.preventDefault();
          const topPending = [...requests.filter(r => r.status === 'pending')]
            .sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0))[0];
          if (topPending) handleStatusChange(topPending.id, 'queued');
          break;
        }
        case 'r': {
          // Reject top pending request
          e.preventDefault();
          const topPendingR = [...requests.filter(r => r.status === 'pending')]
            .sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0))[0];
          if (topPendingR) handleStatusChange(topPendingR.id, 'rejected');
          break;
        }
        case 'p': {
          // Play top queued request (mark as Now Playing)
          e.preventDefault();
          const topQueued = requests.filter(r => r.status === 'queued')
            .sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0))[0];
          if (topQueued) handleStatusChange(topQueued.id, 'nowPlaying');
          break;
        }
        case 'n': {
          // Next - mark current Now Playing as Played
          e.preventDefault();
          const np = requests.find(r => r.status === 'nowPlaying');
          if (np) handleStatusChange(np.id, 'played');
          break;
        }
        case 'Escape':
          setShowShortcuts(false);
          break;
        default:
          break;
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requests]);

  function sortRequests(reqs) {
    const filtered = filterBySearch(reqs);
    return [...filtered].sort((a, b) => {
      // When sorting by votes (default), prioritize manually ordered items first
      if (queueSort === 'votes') {
        const aHasOrder = a.manualOrder !== null && a.manualOrder !== undefined;
        const bHasOrder = b.manualOrder !== null && b.manualOrder !== undefined;
        if (aHasOrder && bHasOrder) return a.manualOrder - b.manualOrder;
        if (aHasOrder && !bHasOrder) return -1;
        if (!aHasOrder && bHasOrder) return 1;
        return (b.voteCount || 0) - (a.voteCount || 0);
      }
      switch (queueSort) {
        case 'time':
          return new Date(a.createdAt) - new Date(b.createdAt);
        case 'title':
          return (a.song?.title || '').localeCompare(b.song?.title || '');
        case 'artist':
          return (a.song?.artist || '').localeCompare(b.song?.artist || '');
        default:
          return 0;
      }
    });
  }

  function filterBySearch(reqs) {
    if (!queueSearch.trim()) return reqs;
    const q = queueSearch.toLowerCase().trim();
    return reqs.filter(r =>
      (r.song?.title || '').toLowerCase().includes(q) ||
      (r.song?.artist || '').toLowerCase().includes(q) ||
      (r.requestedBy?.nickname || '').toLowerCase().includes(q)
    );
  }

  // Edit mode: pause attendee updates while reorganizing
  async function handleToggleEditMode() {
    setTogglingEditMode(true);
    try {
      const newMode = !editMode;
      await api.toggleEditMode(id, newMode);
      setEditMode(newMode);
    } catch (err) {
      console.error('Failed to toggle edit mode:', err);
    } finally {
      setTogglingEditMode(false);
    }
  }

  // Load edit mode status on mount
  useEffect(() => {
    async function checkEditMode() {
      try {
        const data = await api.getEditModeStatus(id);
        setEditMode(data.editMode);
      } catch (err) {
        // Ignore - edit mode defaults to off
      }
    }
    checkEditMode();
  }, [id]);

  // Drag-and-drop handlers for queue reordering
  function handleDragStart(e, requestId) {
    setDraggedRequestId(requestId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', requestId);
    // Make the dragged element semi-transparent
    if (e.target.closest('[data-drag-item]')) {
      setTimeout(() => {
        const el = e.target.closest('[data-drag-item]');
        if (el) el.style.opacity = '0.4';
      }, 0);
    }
  }

  function handleDragOver(e, requestId) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (requestId !== dragOverRequestId) {
      setDragOverRequestId(requestId);
    }
  }

  function handleDragEnd(e) {
    // Reset opacity
    if (e.target.closest('[data-drag-item]')) {
      e.target.closest('[data-drag-item]').style.opacity = '1';
    }
    setDraggedRequestId(null);
    setDragOverRequestId(null);
  }

  async function handleDrop(e, targetRequestId) {
    e.preventDefault();
    setDragOverRequestId(null);
    const sourceRequestId = draggedRequestId;
    setDraggedRequestId(null);

    // Reset opacity on all items
    document.querySelectorAll('[data-drag-item]').forEach(el => el.style.opacity = '1');

    if (!sourceRequestId || sourceRequestId === targetRequestId) return;

    // Get current sorted order of queued requests
    const sorted = sortRequests(queuedRequests);
    const sourceIndex = sorted.findIndex(r => r.id === sourceRequestId);
    const targetIndex = sorted.findIndex(r => r.id === targetRequestId);

    if (sourceIndex === -1 || targetIndex === -1) return;

    // Create new order: remove source, insert at target position
    const reordered = [...sorted];
    const [moved] = reordered.splice(sourceIndex, 1);
    reordered.splice(targetIndex, 0, moved);

    // Assign manual_order values (1-based)
    const updates = reordered.map((r, i) => ({ id: r.id, manualOrder: i + 1 }));

    // Optimistically update local state
    setRequests(prev => {
      const updated = [...prev];
      for (const u of updates) {
        const idx = updated.findIndex(r => r.id === u.id);
        if (idx !== -1) {
          updated[idx] = { ...updated[idx], manualOrder: u.manualOrder };
        }
      }
      return updated;
    });

    // Persist to server (update all reordered items)
    try {
      await Promise.all(updates.map(u => api.updateRequestOrder(id, u.id, u.manualOrder)));
    } catch (err) {
      console.error('Failed to save order:', err);
      // Reload to get server state on error
      loadRequests();
    }
  }

  function getStatusBadge(s) {
    switch(s) {
      case 'active':
        return { label: 'Live', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: Radio };
      case 'completed':
        return { label: 'Completed', color: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300', icon: Check };
      default:
        return { label: 'Upcoming', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: Clock };
    }
  }

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const queuedRequests = requests.filter(r => r.status === 'queued');
  const nowPlayingRequest = requests.find(r => r.status === 'nowPlaying');
  const playedRequests = requests.filter(r => r.status === 'played');
  const rejectedRequests = requests.filter(r => r.status === 'rejected');
  const otherRequests = requests.filter(r => r.status !== 'pending');

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6" data-loading-skeleton>
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mb-2" />
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/4 mb-6" />
            <div className="flex gap-3 mb-6">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-10 bg-slate-200 dark:bg-slate-700 rounded-lg w-24" />
              ))}
            </div>
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-lg flex-shrink-0" />
                <div className="flex-1">
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3 mb-2" />
                  <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
                </div>
                <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-16" />
              </div>
            ))}
          </div>
        </div>
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
      {/* Mobile Top Bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="p-1 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
        >
          <Menu className="w-6 h-6" />
        </button>
        <Music className="w-5 h-5 text-primary-500" />
        <h2 className="font-bold text-slate-900 dark:text-white truncate">{event?.name}</h2>
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col min-h-screen transform transition-transform duration-200 ease-in-out ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
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
                onClick={() => { navigate(link.path); setMobileSidebarOpen(false); }}
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

        {/* Theme Toggle & Delete Event */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-700 space-y-1">
          <button
            onClick={() => setShowShortcuts(true)}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-lg transition-colors text-sm font-medium"
            data-shortcuts-button
          >
            <Keyboard className="w-4 h-4" />
            Shortcuts
            <span className="ml-auto text-xs text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded font-mono">?</span>
          </button>
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-lg transition-colors text-sm font-medium"
            data-theme-toggle
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            {darkMode ? 'Light Mode' : 'Dark Mode'}
          </button>
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
        <main className="flex-1 p-4 pt-16 lg:p-8 lg:pt-8 max-w-4xl w-full">
          {error && (
            <div className="mb-6 bg-red-500/10 border border-red-500/50 rounded-lg p-3 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Action Required Banner */}
          {(() => {
            const actionItems = [];

            // Critical: Pending requests need review (red)
            if (pendingRequests.length > 0) {
              actionItems.push({
                urgency: 'critical',
                icon: Inbox,
                message: pendingRequests.length === 1
                  ? '1 song request awaiting approval'
                  : pendingRequests.length + ' song requests awaiting approval',
                action: 'Review',
                onAction: () => navigate('/events/' + id + '/manage/pending'),
              });
            }

            // Warning: Queue is empty but event is active (amber)
            if (event?.status === 'active' && queuedRequests.length === 0 && !nowPlayingRequest) {
              actionItems.push({
                urgency: 'warning',
                icon: AlertTriangle,
                message: 'Queue is empty \u2014 no songs queued or playing',
                action: 'View Queue',
                onAction: () => navigate('/events/' + id + '/manage/queue'),
              });
            }

            // Warning: Nothing currently playing during active event (amber)
            if (event?.status === 'active' && !nowPlayingRequest && queuedRequests.length > 0) {
              actionItems.push({
                urgency: 'warning',
                icon: Play,
                message: queuedRequests.length + ' song' + (queuedRequests.length !== 1 ? 's' : '') + ' queued but nothing playing',
                action: 'View Queue',
                onAction: () => navigate('/events/' + id + '/manage/queue'),
              });
            }

            // Warning: Queue health — less than 30 minutes of music queued (amber)
            if (event?.status === 'active') {
              const queueMs = queuedRequests.reduce((sum, r) => sum + (r.song?.durationMs || 0), 0);
              const queueMin = Math.floor(queueMs / 60000);
              if (queueMs < 30 * 60 * 1000) {
                actionItems.push({
                  urgency: 'warning',
                  icon: Clock,
                  message: queueMin === 0
                    ? 'Queue has no music — add songs to keep the dance going'
                    : 'Only ' + queueMin + ' minute' + (queueMin !== 1 ? 's' : '') + ' of music queued — add songs to keep the dance going',
                  action: 'View Pending',
                  onAction: () => navigate('/events/' + id + '/manage/pending'),
                });
              }
            }

            // Sort by urgency: critical first, then warning
            actionItems.sort((a, b) => {
              const order = { critical: 0, warning: 1 };
              const va = order[a.urgency] !== undefined ? order[a.urgency] : 2;
              const vb = order[b.urgency] !== undefined ? order[b.urgency] : 2;
              return va - vb;
            });

            if (actionItems.length === 0) return null;

            return (
              <div className="mb-6 space-y-2" data-action-required>
                {actionItems.map((item, idx) => {
                  const ItemIcon = item.icon;
                  const isCritical = item.urgency === 'critical';
                  return (
                    <div
                      key={idx}
                      className={'flex items-center gap-3 p-3 rounded-lg border text-sm ' +
                        (isCritical
                          ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
                          : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300')
                      }
                    >
                      <ItemIcon className={'w-5 h-5 flex-shrink-0 ' + (isCritical ? 'text-red-500 dark:text-red-400' : 'text-amber-500 dark:text-amber-400')} />
                      <span className="flex-1 font-medium">{item.message}</span>
                      <button
                        onClick={item.onAction}
                        className={'px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex-shrink-0 ' +
                          (isCritical
                            ? 'bg-red-600 hover:bg-red-700 text-white'
                            : 'bg-amber-500 hover:bg-amber-600 text-white')
                        }
                      >
                        {item.action}
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {activeView === 'queue' && (
            <>
              {/* Event Info Header */}
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 mb-6">
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{event?.name}</h2>
                  {(() => {
                    const badge = getStatusBadge(event?.status);
                    const BadgeIcon = badge.icon;
                    return (
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${badge.color}`}>
                        <BadgeIcon className="w-3 h-3" />
                        {badge.label}
                      </span>
                    );
                  })()}
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {event?.status !== 'active' && event?.status !== 'completed' && (
                    <button
                      onClick={() => handleEventStatusChange('active')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white text-xs font-medium rounded-lg hover:bg-green-600 transition-colors"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Go Live
                    </button>
                  )}
                  {event?.status === 'active' && (
                    <button
                      onClick={() => handleEventStatusChange('completed')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-500 text-white text-xs font-medium rounded-lg hover:bg-slate-600 transition-colors"
                    >
                      <StopCircle className="w-3.5 h-3.5" />
                      End Event
                    </button>
                  )}
                  {event?.status === 'completed' && (
                    <button
                      onClick={() => handleEventStatusChange('upcoming')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 text-white text-xs font-medium rounded-lg hover:bg-blue-600 transition-colors"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      Reopen
                    </button>
                  )}
                </div>
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


              {/* Share & QR Code */}
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 mb-6">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Share Event</h3>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                  <div className="bg-white p-3 rounded-xl border border-slate-200 dark:border-slate-300 flex-shrink-0">
                    <QRCodeCanvas
                      value={window.location.origin + '/e/' + id}
                      size={160}
                      level="H"
                      includeMargin={false}
                      id="event-qr-code"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">Attendees can scan this QR code or visit:</p>
                    <div className="flex items-center gap-2 mb-4">
                      <code className="flex-1 text-sm bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white px-3 py-2 rounded-lg truncate">
                        {window.location.origin}/e/{id}
                      </code>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(window.location.origin + '/e/' + id);
                          alert('URL copied to clipboard!');
                        }}
                        className="p-2 text-slate-500 hover:text-primary-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors flex-shrink-0"
                        title="Copy URL"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <a
                        href={'/e/' + id}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-slate-500 hover:text-primary-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors flex-shrink-0"
                        title="Open event page"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                    <button
                      onClick={() => {
                        const canvas = document.getElementById('event-qr-code');
                        if (canvas) {
                          const link = document.createElement('a');
                          link.download = (event?.name || 'event').replace(/[^a-zA-Z0-9]/g, '_') + '_QR.png';
                          link.href = canvas.toDataURL('image/png');
                          link.click();
                        }
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors text-sm font-medium"
                    >
                      <Download className="w-4 h-4" />
                      Download QR Code
                    </button>
                  </div>
                </div>
              </div>

              {/* Song Requests Queue */}
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                    Song Requests ({requests.length})
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleToggleEditMode}
                      disabled={togglingEditMode}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                        editMode
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-300 dark:border-amber-700 animate-pulse'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                      }`}
                      title={editMode ? 'Attendee views are paused. Click to publish changes.' : 'Pause attendee updates while you reorganize the queue'}
                      data-edit-mode-toggle
                    >
                      <span className="flex items-center gap-1.5">
                        {editMode ? <StopCircle className="w-3.5 h-3.5" /> : <Settings className="w-3.5 h-3.5" />}
                        {togglingEditMode ? 'Saving...' : editMode ? 'Publish Changes' : 'Edit Mode'}
                      </span>
                    </button>
                    {editMode && (
                      <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                        Attendee updates paused
                      </span>
                    )}
                    {pendingRequests.length > 0 && (
                      <button
                        onClick={() => { setBatchMode(!batchMode); setSelectedRequests(new Set()); }}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                          batchMode
                            ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 border border-primary-300 dark:border-primary-700'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                        }`}
                        data-batch-toggle
                      >
                        <span className="flex items-center gap-1.5">
                          <CheckSquare className="w-3.5 h-3.5" />
                          {batchMode ? 'Exit Batch' : 'Batch Select'}
                        </span>
                      </button>
                    )}
                    {selectedRequests.size > 0 && (
                      <>
                        <button
                          onClick={handleBulkApprove}
                          disabled={approving}
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-50"
                          data-bulk-approve
                        >
                          <Check className="w-4 h-4" />
                          {approving ? 'Approving...' : `Approve (${selectedRequests.size})`}
                        </button>
                        <button
                          onClick={() => setShowBulkRejectDialog(true)}
                          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                          data-bulk-reject
                        >
                          <XCircle className="w-4 h-4" />
                          Reject ({selectedRequests.size})
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Queue time timeline bar */}
                {requests.length > 0 && (() => {
                  const activeRequests = requests.filter(r => ['pending', 'queued', 'nowPlaying'].includes(r.status));
                  const totalQueueMs = activeRequests.reduce((sum, r) => sum + (r.song?.durationMs || 0), 0);
                  const totalQueueMin = Math.round(totalQueueMs / 60000);
                  const totalQueueFormatted = `${Math.floor(totalQueueMs / 60000)}:${String(Math.floor((totalQueueMs % 60000) / 1000)).padStart(2, '0')}`;

                  // Calculate event duration from start/end time
                  let eventDurationMin = null;
                  if (event?.startTime && event?.endTime) {
                    const [sh, sm] = event.startTime.split(':').map(Number);
                    const [eh, em] = event.endTime.split(':').map(Number);
                    eventDurationMin = (eh * 60 + em) - (sh * 60 + sm);
                    if (eventDurationMin <= 0) eventDurationMin += 24 * 60; // handle midnight crossing
                  }

                  const percentage = eventDurationMin ? Math.min((totalQueueMin / eventDurationMin) * 100, 100) : null;
                  const barColor = percentage === null ? 'bg-slate-400'
                    : percentage >= 80 ? 'bg-green-500'
                    : percentage >= 50 ? 'bg-yellow-500'
                    : 'bg-red-500';
                  const statusLabel = percentage === null ? ''
                    : percentage >= 80 ? 'Good coverage'
                    : percentage >= 50 ? 'Getting there'
                    : 'Need more songs';

                  // Calculate projected end time
                  let projectedEnd = null;
                  if (event?.startTime && totalQueueMs > 0) {
                    const [sh, sm] = event.startTime.split(':').map(Number);
                    const startMinutes = sh * 60 + sm;
                    const endMinutes = startMinutes + Math.ceil(totalQueueMs / 60000);
                    const endH = Math.floor(endMinutes / 60) % 24;
                    const endM = endMinutes % 60;
                    projectedEnd = `${endH % 12 || 12}:${String(endM).padStart(2, '0')} ${endH >= 12 ? 'PM' : 'AM'}`;
                  }

                  return (
                    <div className="mb-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600">
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                        <span>Queue: {totalQueueFormatted} ({activeRequests.length} songs)</span>
                        {eventDurationMin ? (
                          <span>{statusLabel} ({Math.round(percentage)}%)</span>
                        ) : (
                          <span>No event time set</span>
                        )}
                      </div>
                      <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                          style={{ width: percentage !== null ? `${percentage}%` : '0%' }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                        {eventDurationMin ? (
                          <>
                            <span>0 min</span>
                            {projectedEnd && <span>Projected end: {projectedEnd}</span>}
                            <span>{eventDurationMin} min event</span>
                          </>
                        ) : (
                          <>
                            <span>{activeRequests.filter(r => r.song?.durationMs).length} songs with duration data</span>
                            {projectedEnd && <span>Projected end: {projectedEnd}</span>}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Status filter bar and sort */}
                {requests.length > 0 && (
                  <div className="space-y-2 mb-4">
                    <div className="flex flex-wrap gap-2">
                      {[
                        { key: 'all', label: 'All', count: requests.length },
                        { key: 'pending', label: 'Pending', count: pendingRequests.length },
                        { key: 'queued', label: 'Queued', count: queuedRequests.length },
                        { key: 'nowPlaying', label: 'Now Playing', count: nowPlayingRequest ? 1 : 0 },
                        { key: 'played', label: 'Played', count: playedRequests.length },
                        { key: 'rejected', label: 'Rejected', count: rejectedRequests.length },
                      ].map(f => (
                        <button
                          key={f.key}
                          onClick={() => setQueueFilter(f.key)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                            queueFilter === f.key
                              ? 'bg-primary-500 text-white'
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                          }`}
                        >
                          {f.label} ({f.count})
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-xs text-slate-500 dark:text-slate-400">Sort:</span>
                      {[
                        { key: 'votes', label: 'Votes' },
                        { key: 'time', label: 'Time' },
                        { key: 'title', label: 'Title' },
                        { key: 'artist', label: 'Artist' },
                      ].map(s => (
                        <button
                          key={s.key}
                          onClick={() => setQueueSort(s.key)}
                          className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                            queueSort === s.key
                              ? 'bg-slate-700 text-white dark:bg-slate-200 dark:text-slate-800'
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search by song, artist, or requester..."
                        value={queueSearch}
                        onChange={(e) => setQueueSearch(e.target.value)}
                        className="w-full pl-9 pr-8 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                      {queueSearch && (
                        <button
                          onClick={() => setQueueSearch('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {requests.length === 0 ? (
                  <p className="text-slate-500 dark:text-slate-400 text-center py-8">No song requests yet. Share the event link with your audience!</p>
                ) : (
                  <div className="space-y-6">
                    {/* Pending requests with checkboxes */}
                    {pendingRequests.length > 0 && (queueFilter === 'all' || queueFilter === 'pending') && (
                      <div>
                        <div className="flex items-center gap-3 mb-3">
                          <button onClick={toggleSelectAll} className="text-slate-400 hover:text-primary-500 transition-colors">
                            {selectedRequests.size === pendingRequests.length ? (
                              <CheckSquare className="w-5 h-5 text-primary-500" />
                            ) : (
                              <Square className="w-5 h-5" />
                            )}
                          </button>
                          <button onClick={() => toggleSection('pending')} className="flex items-center gap-1 text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide hover:text-slate-700 dark:hover:text-slate-200 transition-colors" data-collapse-toggle="pending">
                            <ChevronDown className={`w-4 h-4 transition-transform ${collapsedSections.pending ? '-rotate-90' : ''}`} />
                            Pending ({pendingRequests.length})
                          </button>
                        </div>
                        {!collapsedSections.pending && (<div className="space-y-2">
                          {sortRequests(pendingRequests).map(request => (
                            <div key={request.id}>
                              <div
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
                                {request.song?.albumArtUrl ? (
                                  <img src={request.song.albumArtUrl} alt="" className="w-10 h-10 rounded flex-shrink-0 object-cover bg-slate-200 dark:bg-slate-700" loading="lazy" />
                                ) : (
                                  <div className="w-10 h-10 rounded flex-shrink-0 bg-slate-200 dark:bg-slate-600 flex items-center justify-center">
                                    <Music className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-slate-900 dark:text-white truncate">
                                    {request.song?.title}
                                    {request.song?.explicitFlag && event?.settings?.warnExplicit !== false && (
                                      <span className="inline-flex items-center ml-1.5 px-1.5 py-0.5 text-[10px] font-bold bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded" title="Explicit content">E</span>
                                    )}
                                  </p>
                                  <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                                    {request.song?.artist}
                                    {request.song?.durationMs && (
                                      <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">({formatDuration(request.song.durationMs)})</span>
                                    )}
                                  </p>
                                  {request.requestedBy?.nickname && (
                                    <p className="text-xs text-primary-500 dark:text-primary-400 truncate">🎵 {request.requestedBy.nickname}</p>
                                  )}
                                  {request.message && (
                                    <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5" title={request.message}>
                                      💬 {request.message}
                                    </p>
                                  )}
                                </div>
                                <button
                                  onClick={() => (request.voteCount || 0) > 0 && toggleVoters(request.id)}
                                  className={`flex items-center gap-1 text-sm ${(request.voteCount || 0) > 0 ? 'text-primary-500 hover:text-primary-600 cursor-pointer' : 'text-slate-500 cursor-default'}`}
                                  title={(request.voteCount || 0) > 0 ? 'Click to see voters' : ''}
                                >
                                  <Users className="w-3.5 h-3.5" />
                                  <span>{request.voteCount || 0} votes</span>
                                </button>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <button
                                    onClick={() => toggleNotes(request.id, request.djNotes)}
                                    className={`p-1.5 rounded transition-colors ${request.djNotes ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-600'}`}
                                    title={request.djNotes ? 'Edit note' : 'Add note'}
                                  >
                                    <StickyNote className="w-4 h-4" />
                                  </button>
                                  <a
                                    href={getSpotifySearchUrl(request.song)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
                                    title="Search on Spotify"
                                  >
                                    <ExternalLink className="w-4 h-4" />
                                  </a>
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
                              {expandedVoters[request.id] && voterData[request.id] && (
                                <div className="ml-8 mt-1 mb-2 p-2 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-600 text-xs">
                                  <p className="font-medium text-slate-700 dark:text-slate-300 mb-1">Voters ({voterData[request.id].totalVoters}):</p>
                                  <ul className="space-y-0.5">
                                    {voterData[request.id].voters.map((v, i) => (
                                      <li key={i} className="text-slate-600 dark:text-slate-400">
                                        {v.nickname ? v.nickname : `Anonymous (${v.userId.slice(0, 8)}...)`}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {/* DJ Notes display/edit */}
                              {(request.djNotes && editingNotes !== request.id) && (
                                <div className="ml-8 mt-1 mb-1 px-2 py-1.5 bg-amber-50 dark:bg-amber-900/20 rounded border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-300 cursor-pointer" onClick={() => toggleNotes(request.id, request.djNotes)}>
                                  <span className="font-medium">DJ Note:</span> {request.djNotes}
                                </div>
                              )}
                              {editingNotes === request.id && (
                                <div className="ml-8 mt-1 mb-2 flex gap-2 items-start">
                                  <input
                                    type="text"
                                    value={noteTexts[request.id] || ''}
                                    onChange={(e) => setNoteTexts(prev => ({ ...prev, [request.id]: e.target.value }))}
                                    placeholder="Add a private note..."
                                    className="flex-1 px-2 py-1.5 text-xs border border-amber-300 dark:border-amber-700 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-1 focus:ring-amber-400 outline-none"
                                    onKeyDown={(e) => e.key === 'Enter' && handleSaveNotes(request.id)}
                                    autoFocus
                                  />
                                  <button
                                    onClick={() => handleSaveNotes(request.id)}
                                    className="px-2 py-1.5 text-xs font-medium bg-amber-500 text-white rounded hover:bg-amber-600 transition-colors flex items-center gap-1"
                                  >
                                    <Save className="w-3 h-3" />
                                    Save
                                  </button>
                                  <button
                                    onClick={() => setEditingNotes(null)}
                                    className="px-2 py-1.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>)}
                      </div>
                    )}

                    {/* Now Playing */}
                    {nowPlayingRequest && (queueFilter === 'all' || queueFilter === 'nowPlaying') && filterBySearch([nowPlayingRequest]).length > 0 && (
                      <div className="mb-4">
                        <button onClick={() => toggleSection('nowPlaying')} className="text-sm font-semibold text-green-600 dark:text-green-400 uppercase tracking-wide mb-3 flex items-center gap-2 hover:text-green-700 dark:hover:text-green-300 transition-colors" data-collapse-toggle="nowPlaying">
                          <ChevronDown className={`w-4 h-4 transition-transform ${collapsedSections.nowPlaying ? '-rotate-90' : ''}`} />
                          <Radio className="w-4 h-4 animate-pulse" />
                          Now Playing
                        </button>
                        {!collapsedSections.nowPlaying && (<div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border-2 border-green-300 dark:border-green-700">
                          {nowPlayingRequest.song?.albumArtUrl ? (
                            <img src={nowPlayingRequest.song.albumArtUrl} alt="" className="w-12 h-12 rounded flex-shrink-0 object-cover bg-slate-200 dark:bg-slate-700" loading="lazy" />
                          ) : (
                            <div className="w-12 h-12 rounded flex-shrink-0 bg-green-200 dark:bg-green-800 flex items-center justify-center">
                              <Music className="w-6 h-6 text-green-500" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-slate-900 dark:text-white truncate">
                              {nowPlayingRequest.song?.title}
                              {nowPlayingRequest.song?.explicitFlag && event?.settings?.warnExplicit !== false && (
                                <span className="inline-flex items-center ml-1.5 px-1.5 py-0.5 text-[10px] font-bold bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded" title="Explicit content">E</span>
                              )}
                            </p>
                            <p className="text-sm text-slate-600 dark:text-slate-300 truncate">
                              {nowPlayingRequest.song?.artist}
                              {nowPlayingRequest.song?.durationMs && (
                                <span className="ml-2 text-xs text-slate-400">({formatDuration(nowPlayingRequest.song.durationMs)})</span>
                              )}
                            </p>
                            {nowPlayingRequest.requestedBy?.nickname && (
                              <p className="text-xs text-primary-500 dark:text-primary-400">🎵 {nowPlayingRequest.requestedBy.nickname}</p>
                            )}
                          </div>
                          <a
                            href={getSpotifySearchUrl(nowPlayingRequest.song)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-green-500 hover:bg-green-100 dark:hover:bg-green-900/30 rounded transition-colors"
                            title="Search on Spotify"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                          <button
                            onClick={() => handleStatusChange(nowPlayingRequest.id, 'played')}
                            className="px-3 py-1.5 text-xs font-medium bg-slate-500 text-white rounded-lg hover:bg-slate-600 transition-colors"
                            title="Mark as played"
                          >
                            Mark Played
                          </button>
                        </div>)}
                      </div>
                    )}

                    {/* Queued songs with Play button */}
                    {queuedRequests.length > 0 && (queueFilter === 'all' || queueFilter === 'queued') && (
                      <div className="mb-4">
                        <button onClick={() => toggleSection('upNext')} className="flex items-center gap-1 text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3 hover:text-slate-700 dark:hover:text-slate-200 transition-colors" data-collapse-toggle="upNext">
                          <ChevronDown className={`w-4 h-4 transition-transform ${collapsedSections.upNext ? '-rotate-90' : ''}`} />
                          Up Next ({queuedRequests.length})
                        </button>
                        {!collapsedSections.upNext && (<div className="space-y-2">
                          {sortRequests(queuedRequests).map((request, index) => (
                            <div
                              key={request.id}
                              data-drag-item={request.id}
                              draggable="true"
                              onDragStart={(e) => handleDragStart(e, request.id)}
                              onDragOver={(e) => handleDragOver(e, request.id)}
                              onDrop={(e) => handleDrop(e, request.id)}
                              onDragEnd={handleDragEnd}
                              className={dragOverRequestId === request.id && draggedRequestId !== request.id ? 'border-t-2 border-primary-500' : ''}
                              style={{ cursor: 'grab' }}
                            >
                              <div className={`flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 ${draggedRequestId === request.id ? 'opacity-40' : ''}`}>
                                <div className="flex-shrink-0 cursor-grab text-slate-300 dark:text-slate-500 hover:text-slate-500 dark:hover:text-slate-300" title="Drag to reorder">
                                  <GripVertical className="w-4 h-4" />
                                </div>
                                {request.song?.albumArtUrl ? (
                                  <img src={request.song.albumArtUrl} alt="" className="w-10 h-10 rounded flex-shrink-0 object-cover bg-slate-200 dark:bg-slate-700" loading="lazy" />
                                ) : (
                                  <div className="w-10 h-10 rounded flex-shrink-0 bg-slate-200 dark:bg-slate-600 flex items-center justify-center">
                                    <Music className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-slate-900 dark:text-white truncate">
                                    {request.song?.title}
                                    {request.song?.explicitFlag && event?.settings?.warnExplicit !== false && (
                                      <span className="inline-flex items-center ml-1.5 px-1.5 py-0.5 text-[10px] font-bold bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded" title="Explicit content">E</span>
                                    )}
                                  </p>
                                  <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                                    {request.song?.artist}
                                    {request.song?.durationMs && (
                                      <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">({formatDuration(request.song.durationMs)})</span>
                                    )}
                                  </p>
                                  {request.requestedBy?.nickname && (
                                    <p className="text-xs text-primary-500 dark:text-primary-400 truncate">🎵 {request.requestedBy.nickname}</p>
                                  )}
                                  {request.message && (
                                    <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5" title={request.message}>
                                      💬 {request.message}
                                    </p>
                                  )}
                                </div>
                                <span className="text-sm text-slate-500">{request.voteCount || 0} votes</span>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <button
                                    onClick={() => toggleNotes(request.id, request.djNotes)}
                                    className={`p-1.5 rounded transition-colors ${request.djNotes ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-600'}`}
                                    title={request.djNotes ? 'Edit note' : 'Add note'}
                                  >
                                    <StickyNote className="w-4 h-4" />
                                  </button>
                                  <a
                                    href={getSpotifySearchUrl(request.song)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
                                    title="Search on Spotify"
                                  >
                                    <ExternalLink className="w-4 h-4" />
                                  </a>
                                  <button
                                    onClick={() => handleStatusChange(request.id, 'nowPlaying')}
                                    className="px-3 py-1.5 text-xs font-medium bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center gap-1"
                                    title="Play Now"
                                  >
                                    <Play className="w-3 h-3" />
                                    Play
                                  </button>
                                  <button
                                    onClick={() => handleStatusChange(request.id, 'rejected')}
                                    className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                    title="Remove"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                              {/* DJ Notes display/edit */}
                              {(request.djNotes && editingNotes !== request.id) && (
                                <div className="ml-8 mt-1 mb-1 px-2 py-1.5 bg-amber-50 dark:bg-amber-900/20 rounded border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-300 cursor-pointer" onClick={() => toggleNotes(request.id, request.djNotes)}>
                                  <span className="font-medium">DJ Note:</span> {request.djNotes}
                                </div>
                              )}
                              {editingNotes === request.id && (
                                <div className="ml-8 mt-1 mb-2 flex gap-2 items-start">
                                  <input
                                    type="text"
                                    value={noteTexts[request.id] || ''}
                                    onChange={(e) => setNoteTexts(prev => ({ ...prev, [request.id]: e.target.value }))}
                                    placeholder="Add a private note..."
                                    className="flex-1 px-2 py-1.5 text-xs border border-amber-300 dark:border-amber-700 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-1 focus:ring-amber-400 outline-none"
                                    onKeyDown={(e) => e.key === 'Enter' && handleSaveNotes(request.id)}
                                    autoFocus
                                  />
                                  <button
                                    onClick={() => handleSaveNotes(request.id)}
                                    className="px-2 py-1.5 text-xs font-medium bg-amber-500 text-white rounded hover:bg-amber-600 transition-colors flex items-center gap-1"
                                  >
                                    <Save className="w-3 h-3" />
                                    Save
                                  </button>
                                  <button
                                    onClick={() => setEditingNotes(null)}
                                    className="px-2 py-1.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>)}
                      </div>
                    )}

                    {/* Other requests (played/rejected shown here; queued/nowPlaying shown above) */}
                    {otherRequests.length > 0 && (queueFilter === 'all' || queueFilter === 'played' || queueFilter === 'rejected') && (
                      <div>
                        <button onClick={() => toggleSection('processed')} className="flex items-center gap-1 text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3 hover:text-slate-700 dark:hover:text-slate-200 transition-colors" data-collapse-toggle="processed">
                          <ChevronDown className={`w-4 h-4 transition-transform ${collapsedSections.processed ? '-rotate-90' : ''}`} />
                          Processed ({queueFilter === 'played' ? playedRequests.length : queueFilter === 'rejected' ? rejectedRequests.length : otherRequests.length})
                        </button>
                        {!collapsedSections.processed && (<div className="space-y-2">
                          {sortRequests(queueFilter === 'played' ? playedRequests : queueFilter === 'rejected' ? rejectedRequests : otherRequests).map(request => (
                            <div
                              key={request.id}
                              className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 opacity-60"
                            >
                              {request.song?.albumArtUrl ? (
                                <img src={request.song.albumArtUrl} alt="" className="w-10 h-10 rounded flex-shrink-0 object-cover bg-slate-200 dark:bg-slate-700" loading="lazy" />
                              ) : (
                                <div className="w-10 h-10 rounded flex-shrink-0 bg-slate-200 dark:bg-slate-600 flex items-center justify-center">
                                  <Music className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-slate-900 dark:text-white truncate">
                                  {request.song?.title}
                                  {request.song?.explicitFlag && event?.settings?.warnExplicit !== false && (
                                    <span className="inline-flex items-center ml-1.5 px-1.5 py-0.5 text-[10px] font-bold bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded" title="Explicit content">E</span>
                                  )}
                                </p>
                                <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                                  {request.song?.artist}
                                  {request.song?.durationMs && (
                                    <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">({formatDuration(request.song.durationMs)})</span>
                                  )}
                                </p>
                                {request.requestedBy?.nickname && (
                                  <p className="text-xs text-primary-500 dark:text-primary-400 truncate">🎵 {request.requestedBy.nickname}</p>
                                )}
                                {request.message && (
                                  <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5" title={request.message}>
                                    💬 {request.message}
                                  </p>
                                )}
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
                        </div>)}
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
                <div className="flex items-center gap-2">
                  {pendingRequests.length > 0 && (
                    <button
                      onClick={() => { setBatchMode(!batchMode); setSelectedRequests(new Set()); }}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                        batchMode
                          ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 border border-primary-300 dark:border-primary-700'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <CheckSquare className="w-3.5 h-3.5" />
                        {batchMode ? 'Exit Batch' : 'Batch Select'}
                      </span>
                    </button>
                  )}
                  {selectedRequests.size > 0 && (
                    <>
                      <button
                        onClick={handleBulkApprove}
                        disabled={approving}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-50"
                      >
                        <Check className="w-4 h-4" />
                        {approving ? 'Approving...' : `Approve (${selectedRequests.size})`}
                      </button>
                      <button
                        onClick={() => setShowBulkRejectDialog(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                      >
                        <XCircle className="w-4 h-4" />
                        Reject ({selectedRequests.size})
                      </button>
                    </>
                  )}
                </div>
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
                  {sortRequests(pendingRequests).map(request => (
                    <div key={request.id}>
                      <div
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
                        {request.song?.albumArtUrl ? (
                          <img src={request.song.albumArtUrl} alt="" className="w-10 h-10 rounded flex-shrink-0 object-cover bg-slate-200 dark:bg-slate-700" loading="lazy" />
                        ) : (
                          <div className="w-10 h-10 rounded flex-shrink-0 bg-slate-200 dark:bg-slate-600 flex items-center justify-center">
                            <Music className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900 dark:text-white truncate">
                            {request.song?.title}
                            {request.song?.explicitFlag && event?.settings?.warnExplicit !== false && (
                              <span className="inline-flex items-center ml-1.5 px-1.5 py-0.5 text-[10px] font-bold bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded" title="Explicit content">E</span>
                            )}
                          </p>
                          <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                            {request.song?.artist}
                            {request.song?.durationMs && (
                              <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">({formatDuration(request.song.durationMs)})</span>
                            )}
                          </p>
                          {request.requestedBy?.nickname && (
                            <p className="text-xs text-primary-500 dark:text-primary-400 truncate">🎵 {request.requestedBy.nickname}</p>
                          )}
                          {request.message && (
                            <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5" title={request.message}>
                              💬 {request.message}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => (request.voteCount || 0) > 0 && toggleVoters(request.id)}
                          className={`flex items-center gap-1 text-sm ${(request.voteCount || 0) > 0 ? 'text-primary-500 hover:text-primary-600 cursor-pointer' : 'text-slate-500 cursor-default'}`}
                          title={(request.voteCount || 0) > 0 ? 'Click to see voters' : ''}
                        >
                          <Users className="w-3.5 h-3.5" />
                          <span>{request.voteCount || 0} votes</span>
                        </button>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => toggleNotes(request.id, request.djNotes)}
                            className={`p-1.5 rounded transition-colors ${request.djNotes ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-600'}`}
                            title={request.djNotes ? 'Edit note' : 'Add note'}
                          >
                            <StickyNote className="w-4 h-4" />
                          </button>
                          <a
                            href={getSpotifySearchUrl(request.song)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
                            title="Search on Spotify"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
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
                      {expandedVoters[request.id] && voterData[request.id] && (
                        <div className="ml-8 mt-1 mb-2 p-2 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-600 text-xs">
                          <p className="font-medium text-slate-700 dark:text-slate-300 mb-1">Voters ({voterData[request.id].totalVoters}):</p>
                          <ul className="space-y-0.5">
                            {voterData[request.id].voters.map((v, i) => (
                              <li key={i} className="text-slate-600 dark:text-slate-400">
                                {v.nickname ? v.nickname : `Anonymous (${v.userId.slice(0, 8)}...)`}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {/* DJ Notes display/edit */}
                      {(request.djNotes && editingNotes !== request.id) && (
                        <div className="ml-8 mt-1 mb-1 px-2 py-1.5 bg-amber-50 dark:bg-amber-900/20 rounded border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-300 cursor-pointer" onClick={() => toggleNotes(request.id, request.djNotes)}>
                          <span className="font-medium">DJ Note:</span> {request.djNotes}
                        </div>
                      )}
                      {editingNotes === request.id && (
                        <div className="ml-8 mt-1 mb-2 flex gap-2 items-start">
                          <input
                            type="text"
                            value={noteTexts[request.id] || ''}
                            onChange={(e) => setNoteTexts(prev => ({ ...prev, [request.id]: e.target.value }))}
                            placeholder="Add a private note..."
                            className="flex-1 px-2 py-1.5 text-xs border border-amber-300 dark:border-amber-700 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-1 focus:ring-amber-400 outline-none"
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveNotes(request.id)}
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveNotes(request.id)}
                            className="px-2 py-1.5 text-xs font-medium bg-amber-500 text-white rounded hover:bg-amber-600 transition-colors flex items-center gap-1"
                          >
                            <Save className="w-3 h-3" />
                            Save
                          </button>
                          <button
                            onClick={() => setEditingNotes(null)}
                            className="px-2 py-1.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}


          {activeView === 'messages' && (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">DJ Messages</h3>
              <div className="mb-4">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Quick Templates</p>
                <div className="flex flex-wrap gap-2" data-message-templates>
                  {[
                    'We need more songs! Send your requests!',
                    'Voting closes soon! Cast your votes now!',
                    'Great job! The queue is looking awesome!',
                    'Taking a short break. Be right back!',
                    'Last call for song requests!',
                  ].map((tmpl) => (
                    <button
                      key={tmpl}
                      onClick={() => setNewDJMessage(tmpl)}
                      className="px-3 py-1.5 text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/30 hover:text-primary-600 dark:hover:text-primary-400 transition-colors border border-slate-200 dark:border-slate-600"
                      data-message-template
                    >
                      {tmpl}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mb-6">
                <textarea
                  value={newDJMessage}
                  onChange={(e) => setNewDJMessage(e.target.value)}
                  placeholder="Type a message to your attendees..."
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none mb-3"
                />
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">Send to:</label>
                    <select
                      value={messageTargetAudience}
                      onChange={(e) => setMessageTargetAudience(e.target.value)}
                      className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                      data-audience-select
                    >
                      <option value="all">Everyone</option>
                      <option value="no_requests">People who haven't requested</option>
                      <option value="top_voters">Top voters (3+ votes)</option>
                      <option value="played_requesters">People whose songs were played</option>
                    </select>
                  </div>
                  <button
                    onClick={handleSendDJMessage}
                    disabled={sendingMessage || !newDJMessage.trim()}
                    className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50 text-sm font-medium"
                  >
                    {sendingMessage ? 'Sending...' : 'Send Message'}
                  </button>
                </div>
                {messageTargetAudience !== 'all' && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                    This message will only be visible to {messageTargetAudience === 'no_requests' ? 'attendees who haven\'t submitted any requests' : messageTargetAudience === 'top_voters' ? 'attendees who have voted on 3+ songs' : 'attendees whose requests have been played'}.
                  </p>
                )}
              </div>
              {djMessages.length === 0 ? (
                <p className="text-slate-500 dark:text-slate-400 text-center py-4">No messages sent yet.</p>
              ) : (
                <div className="space-y-3">
                  {djMessages.map(msg => (
                    <div key={msg.id} className="flex items-start justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-900 dark:text-white">{msg.content}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-xs text-slate-500">{new Date(msg.createdAt).toLocaleString()}</p>
                          {msg.targetAudience && msg.targetAudience !== 'all' && (
                            <span className={`px-1.5 py-0.5 text-xs rounded-full font-medium ${
                              msg.targetAudience === 'no_requests' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                              msg.targetAudience === 'top_voters' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                              msg.targetAudience === 'played_requesters' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                              'bg-slate-100 text-slate-700 dark:bg-slate-600 dark:text-slate-300'
                            }`}>
                              {msg.targetAudience === 'no_requests' ? 'No requests' :
                               msg.targetAudience === 'top_voters' ? 'Top voters' :
                               msg.targetAudience === 'played_requesters' ? 'Played requesters' :
                               msg.targetAudience}
                            </span>
                          )}
                        </div>
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


          {activeView === 'prep' && (() => {
            const nowPlaying = requests.find(r => r.status === 'nowPlaying');
            const queuedSongs = [...requests.filter(r => r.status === 'queued')]
              .sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0));
            const prepSongs = queuedSongs.slice(0, 5);
            const totalPrepMs = prepSongs.reduce((sum, r) => sum + (r.song?.durationMs || 0), 0);

            return (
              <div className="space-y-4" data-prep-view>
                {/* Now Playing Banner */}
                {nowPlaying && (
                  <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl shadow-sm p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Radio className="w-4 h-4 text-white animate-pulse" />
                      <span className="text-xs font-bold text-white uppercase tracking-wider">Now Playing</span>
                    </div>
                    <div className="flex items-center gap-4">
                      {nowPlaying.song?.albumArtUrl ? (
                        <img src={nowPlaying.song.albumArtUrl} alt="" className="w-14 h-14 rounded-lg shadow-md flex-shrink-0 object-cover bg-slate-200 dark:bg-slate-700" loading="lazy" />
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                          <Music className="w-7 h-7 text-white/70" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-lg font-bold text-white truncate">{nowPlaying.song?.title || 'Unknown'}</p>
                        <p className="text-sm text-white/80 truncate">{nowPlaying.song?.artist || 'Unknown'}</p>
                        {nowPlaying.song?.durationMs && (
                          <p className="text-xs text-white/60 mt-1">{formatDuration(nowPlaying.song.durationMs)}</p>
                        )}
                      </div>
                      <a
                        href={getSpotifySearchUrl(nowPlaying.song)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                        title="Search on Spotify"
                      >
                        <ExternalLink className="w-4 h-4 text-white" />
                      </a>
                    </div>
                  </div>
                )}

                {/* Up Next Header */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Up Next</h3>
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      {prepSongs.length} of {queuedSongs.length} queued
                    </span>
                  </div>
                  {totalPrepMs > 0 && (
                    <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">
                      Estimated time: {formatDuration(totalPrepMs)}
                    </p>
                  )}

                  {prepSongs.length === 0 ? (
                    <div className="text-center py-12">
                      <ListMusic className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                      <p className="text-slate-500 dark:text-slate-400 font-medium">No songs in the queue</p>
                      <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Approve pending requests or wait for attendees to submit songs.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {prepSongs.map((request, index) => (
                        <div
                          key={request.id}
                          className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-600/50 hover:border-primary-200 dark:hover:border-primary-700 transition-colors"
                          data-prep-song
                        >
                          {/* Position number */}
                          <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-bold text-primary-600 dark:text-primary-400">{index + 1}</span>
                          </div>

                          {/* Album Art */}
                          {request.song?.albumArtUrl ? (
                            <img src={request.song.albumArtUrl} alt="" className="w-14 h-14 rounded-lg shadow-sm flex-shrink-0 object-cover bg-slate-200 dark:bg-slate-700" loading="lazy" />
                          ) : (
                            <div className="w-14 h-14 rounded-lg bg-slate-200 dark:bg-slate-600 flex items-center justify-center flex-shrink-0">
                              <Music className="w-7 h-7 text-slate-400 dark:text-slate-500" />
                            </div>
                          )}

                          {/* Song Info */}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-slate-900 dark:text-white truncate">{request.song?.title || 'Unknown Song'}</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{request.song?.artist || 'Unknown Artist'}</p>
                            <div className="flex items-center gap-3 mt-1">
                              {request.song?.durationMs && (
                                <span className="text-xs text-slate-400 dark:text-slate-500">{formatDuration(request.song.durationMs)}</span>
                              )}
                              <span className="text-xs text-primary-500 dark:text-primary-400 font-medium">
                                {request.voteCount || 0} {(request.voteCount || 0) === 1 ? 'vote' : 'votes'}
                              </span>
                            </div>
                          </div>

                          {/* Prep Status Toggle */}
                          <button
                            onClick={() => setPreppedSongs(prev => {
                              const next = new Set(prev);
                              if (next.has(request.id)) {
                                next.delete(request.id);
                              } else {
                                next.add(request.id);
                              }
                              return next;
                            })}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 flex-shrink-0 ${
                              preppedSongs.has(request.id)
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
                                : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                            }`}
                            data-prep-status={preppedSongs.has(request.id) ? 'ready' : 'not-prepped'}
                          >
                            {preppedSongs.has(request.id) ? '✅ Ready in Spotify' : '⚠️ Not prepped'}
                          </button>

                          {/* Actions */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <a
                              href={getSpotifySearchUrl(request.song)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                              title="Search on Spotify"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                            <button
                              onClick={() => handleStatusChange(request.id, 'nowPlaying')}
                              className="px-3 py-1.5 text-xs font-medium text-white bg-green-500 hover:bg-green-600 rounded-lg transition-colors flex items-center gap-1"
                              title="Play Now"
                            >
                              <Play className="w-3 h-3" />
                              Play
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {activeView === 'settings' && (
            <EventSettingsForm event={event} eventId={id} onSaved={(updated) => setEvent(updated)} />
          )}

          {activeView === 'analytics' && (() => {
            // Compute analytics from existing requests data
            const totalRequests = requests.length;
            const pendingCount = requests.filter(r => r.status === 'pending').length;
            const queuedCount = requests.filter(r => r.status === 'queued').length;
            const nowPlayingCount = requests.filter(r => r.status === 'nowPlaying').length;
            const playedCount = requests.filter(r => r.status === 'played').length;
            const rejectedCount = requests.filter(r => r.status === 'rejected').length;
            const approvedCount = queuedCount + nowPlayingCount + playedCount;
            const totalVotes = requests.reduce((sum, r) => sum + (r.voteCount || 0), 0);
            const avgVotes = totalRequests > 0 ? (totalVotes / totalRequests).toFixed(1) : '0';
            const maxVotes = requests.length > 0 ? Math.max(...requests.map(r => r.voteCount || 0)) : 0;

            // Total play duration (played + nowPlaying songs)
            const playedSongs = requests.filter(r => r.status === 'played' || r.status === 'nowPlaying');
            const totalPlayMs = playedSongs.reduce((sum, r) => sum + (r.song?.durationMs || r.durationMs || 0), 0);
            const totalPlayMin = Math.floor(totalPlayMs / 60000);
            const totalPlaySec = Math.floor((totalPlayMs % 60000) / 1000);

            // Top 5 most voted songs
            const topSongs = [...requests].sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0)).slice(0, 5);

            // Artist frequency
            const artistCounts = {};
            requests.forEach(r => {
              const artist = r.song?.artist || r.artist || r.artistName || 'Unknown';
              artistCounts[artist] = (artistCounts[artist] || 0) + 1;
            });
            const topArtists = Object.entries(artistCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

            // Status distribution for bar chart
            const statusData = [
              { label: 'Played', count: playedCount, color: 'bg-green-500', textColor: 'text-green-600 dark:text-green-400' },
              { label: 'Now Playing', count: nowPlayingCount, color: 'bg-blue-500', textColor: 'text-blue-600 dark:text-blue-400' },
              { label: 'Queued', count: queuedCount, color: 'bg-purple-500', textColor: 'text-purple-600 dark:text-purple-400' },
              { label: 'Pending', count: pendingCount, color: 'bg-amber-500', textColor: 'text-amber-600 dark:text-amber-400' },
              { label: 'Rejected', count: rejectedCount, color: 'bg-red-500', textColor: 'text-red-600 dark:text-red-400' },
            ];
            const maxStatusCount = Math.max(...statusData.map(s => s.count), 1);

            // Unique requesters
            const uniqueRequesters = new Set(requests.map(r => r.requestedBy?.userId || r.requestedBy)).size;

            // Songs with dedications/messages
            const withMessages = requests.filter(r => r.message && r.message.trim()).length;

            // Peak request times - group by hour
            const hourCounts = {};
            requests.forEach(r => {
              const ts = r.createdAt || r.created_at;
              if (ts) {
                const d = new Date(ts.includes('T') ? ts : ts + 'Z');
                const hour = d.getHours();
                hourCounts[hour] = (hourCounts[hour] || 0) + 1;
              }
            });
            const hourEntries = Object.entries(hourCounts)
              .map(([h, c]) => ({ hour: parseInt(h), count: c }))
              .sort((a, b) => a.hour - b.hour);
            const maxHourCount = hourEntries.length > 0 ? Math.max(...hourEntries.map(e => e.count)) : 1;
            const peakHour = hourEntries.length > 0 ? hourEntries.reduce((a, b) => b.count > a.count ? b : a) : null;
            const formatHour = (h) => {
              const ampm = h >= 12 ? 'PM' : 'AM';
              const h12 = h % 12 || 12;
              return `${h12}${ampm}`;
            };

            // Most active participants - group by requestedBy userId
            const participantMap = {};
            requests.forEach(r => {
              const userId = r.requestedBy?.userId || r.requestedBy || 'unknown';
              const nickname = r.requestedBy?.nickname || r.nickname || null;
              if (!participantMap[userId]) {
                participantMap[userId] = { userId, nickname, requestCount: 0 };
              }
              participantMap[userId].requestCount += 1;
              // Update nickname to the latest one
              if (nickname) participantMap[userId].nickname = nickname;
            });
            const topParticipants = Object.values(participantMap)
              .sort((a, b) => b.requestCount - a.requestCount)
              .slice(0, 5);

            // Diversity metrics
            const uniqueArtists = new Set(requests.map(r => r.song?.artist || r.artistName || 'Unknown')).size;
            const artistDiversity = totalRequests > 0 ? Math.round((uniqueArtists / totalRequests) * 100) : 0;

            // Genre breakdown
            const genreCounts = {};
            requests.forEach(r => {
              const genre = r.song?.genre || r.genre || null;
              if (genre) {
                genreCounts[genre] = (genreCounts[genre] || 0) + 1;
              }
            });
            const topGenres = Object.entries(genreCounts).sort((a, b) => b[1] - a[1]);
            const maxGenreCount = topGenres.length > 0 ? topGenres[0][1] : 1;
            const topGenreName = topGenres.length > 0 ? topGenres[0][0] : null;

            // CSV export function
            const exportCSV = () => {
              const headers = ['Song Title', 'Artist', 'Genre', 'Status', 'Votes', 'Requester', 'Nickname', 'Message', 'Duration (ms)', 'Explicit', 'Created At', 'Updated At'];
              const rows = requests.map(r => [
                r.song?.title || r.songTitle || '',
                r.song?.artist || r.artistName || '',
                r.song?.genre || '',
                r.status || '',
                r.voteCount || 0,
                r.requestedBy?.userId || r.requestedBy || '',
                r.requestedBy?.nickname || r.nickname || '',
                (r.message || '').replace(/"/g, '""'),
                r.song?.durationMs || r.durationMs || '',
                r.song?.explicitFlag ? 'Yes' : 'No',
                r.createdAt || '',
                r.updatedAt || '',
              ]);
              const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
              const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `${(event?.name || 'event').replace(/[^a-z0-9]/gi, '_')}_requests.csv`;
              link.click();
              URL.revokeObjectURL(url);
            };

            return (
              <div className="space-y-6" data-analytics-dashboard>
                {/* Header */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <BarChart3 className="w-6 h-6 text-primary-500" />
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white">Event Analytics</h3>
                    </div>
                    <button
                      onClick={exportCSV}
                      className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold rounded-lg transition-colors"
                      data-export-csv
                    >
                      <Download className="w-4 h-4" />
                      Export CSV
                    </button>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Overview of {event?.name || 'your event'} activity and engagement
                  </p>
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-analytics-metrics>
                  <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Total Requests</p>
                    <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1" data-stat="total-requests">{totalRequests}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{approvedCount} approved</p>
                  </div>
                  <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Total Votes</p>
                    <p className="text-3xl font-bold text-primary-600 dark:text-primary-400 mt-1" data-stat="total-votes">{totalVotes}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{avgVotes} avg per song</p>
                  </div>
                  <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Songs Played</p>
                    <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-1" data-stat="songs-played">{playedCount}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{totalPlayMin}m {totalPlaySec}s total</p>
                  </div>
                  <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Unique Attendees</p>
                    <p className="text-3xl font-bold text-violet-600 dark:text-violet-400 mt-1" data-stat="unique-attendees">{uniqueRequesters}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{withMessages} with dedications</p>
                  </div>
                </div>

                {/* Status Distribution */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6" data-analytics-status>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-4 uppercase tracking-wide">Request Status Distribution</h4>
                  <div className="space-y-3">
                    {statusData.map(item => (
                      <div key={item.label} className="flex items-center gap-3">
                        <span className={`text-xs font-medium w-24 text-right ${item.textColor}`}>{item.label}</span>
                        <div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full h-6 overflow-hidden">
                          <div
                            className={`${item.color} h-full rounded-full flex items-center justify-end pr-2 transition-all duration-500`}
                            style={{ width: `${Math.max((item.count / maxStatusCount) * 100, item.count > 0 ? 8 : 0)}%` }}
                          >
                            {item.count > 0 && <span className="text-xs font-bold text-white">{item.count}</span>}
                          </div>
                        </div>
                        {item.count === 0 && <span className="text-xs text-slate-400">0</span>}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Peak Request Times */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6" data-analytics-peak-times>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-4 uppercase tracking-wide">⏰ Peak Request Times</h4>
                  {hourEntries.length === 0 ? (
                    <p className="text-sm text-slate-400 dark:text-slate-500">No request timing data available.</p>
                  ) : (
                    <div className="space-y-2">
                      {hourEntries.map(entry => (
                        <div key={entry.hour} className="flex items-center gap-3">
                          <span className={`text-xs font-mono font-medium w-12 text-right ${peakHour && entry.hour === peakHour.hour ? 'text-primary-600 dark:text-primary-400 font-bold' : 'text-slate-500 dark:text-slate-400'}`}>
                            {formatHour(entry.hour)}
                          </span>
                          <div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full h-5 overflow-hidden">
                            <div
                              className={`${peakHour && entry.hour === peakHour.hour ? 'bg-primary-500' : 'bg-indigo-400 dark:bg-indigo-500'} h-full rounded-full flex items-center justify-end pr-2 transition-all duration-500`}
                              style={{ width: `${Math.max((entry.count / maxHourCount) * 100, 10)}%` }}
                            >
                              <span className="text-xs font-bold text-white">{entry.count}</span>
                            </div>
                          </div>
                          {peakHour && entry.hour === peakHour.hour && (
                            <span className="text-xs font-bold text-primary-600 dark:text-primary-400">PEAK</span>
                          )}
                        </div>
                      ))}
                      {peakHour && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                          Peak hour: <span className="font-bold text-primary-600 dark:text-primary-400">{formatHour(peakHour.hour)}</span> with {peakHour.count} {peakHour.count === 1 ? 'request' : 'requests'}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Two Column Layout */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Top Voted Songs */}
                  <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6" data-analytics-top-songs>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-4 uppercase tracking-wide">🏆 Top Voted Songs</h4>
                    {topSongs.length === 0 ? (
                      <p className="text-sm text-slate-400 dark:text-slate-500">No songs yet</p>
                    ) : (
                      <div className="space-y-3">
                        {topSongs.map((song, i) => (
                          <div key={song.id} className="flex items-center gap-3">
                            <span className={`text-lg font-bold w-6 text-center ${i === 0 ? 'text-amber-500' : i === 1 ? 'text-slate-400' : i === 2 ? 'text-orange-600' : 'text-slate-300 dark:text-slate-600'}`}>
                              {i + 1}
                            </span>
                            {(song.song?.albumArtUrl || song.albumArtUrl) && (
                              <img src={song.song?.albumArtUrl || song.albumArtUrl} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0 bg-slate-200 dark:bg-slate-700" loading="lazy" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{song.song?.title || song.songTitle || 'Unknown'}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{song.song?.artist || song.artistName || 'Unknown'}</p>
                            </div>
                            <div className="flex items-center gap-1 text-primary-600 dark:text-primary-400">
                              <span className="text-sm font-bold">{song.voteCount || 0}</span>
                              <span className="text-xs">votes</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Top Artists */}
                  <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6" data-analytics-top-artists>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-4 uppercase tracking-wide">🎤 Most Requested Artists</h4>
                    {topArtists.length === 0 ? (
                      <p className="text-sm text-slate-400 dark:text-slate-500">No requests yet</p>
                    ) : (
                      <div className="space-y-3">
                        {topArtists.map(([artist, count], i) => (
                          <div key={artist} className="flex items-center gap-3">
                            <span className={`text-lg font-bold w-6 text-center ${i === 0 ? 'text-amber-500' : i === 1 ? 'text-slate-400' : i === 2 ? 'text-orange-600' : 'text-slate-300 dark:text-slate-600'}`}>
                              {i + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{artist}</p>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{count}</span>
                              <span className="text-xs text-slate-400">{count === 1 ? 'song' : 'songs'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Genre Breakdown */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6" data-analytics-genres>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-4 uppercase tracking-wide">🎵 Genre Breakdown</h4>
                  {topGenres.length === 0 ? (
                    <p className="text-sm text-slate-400 dark:text-slate-500">No genre data available. Genres are captured from iTunes metadata when songs are requested.</p>
                  ) : (
                    <div className="space-y-3">
                      {topGenres.map(([genre, count], i) => (
                        <div key={genre} className="flex items-center gap-3">
                          <span className={`text-xs font-medium w-28 text-right truncate ${i === 0 ? 'text-primary-600 dark:text-primary-400 font-bold' : 'text-slate-600 dark:text-slate-300'}`}>
                            {genre}{i === 0 ? ' ⭐' : ''}
                          </span>
                          <div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full h-6 overflow-hidden">
                            <div
                              className={`${i === 0 ? 'bg-primary-500' : 'bg-slate-400 dark:bg-slate-500'} h-full rounded-full flex items-center justify-end pr-2 transition-all duration-500`}
                              style={{ width: `${Math.max((count / maxGenreCount) * 100, 8)}%` }}
                            >
                              <span className="text-xs font-bold text-white">{count}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                      {topGenreName && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                          Most popular genre: <span className="font-bold text-primary-600 dark:text-primary-400">{topGenreName}</span> ({topGenres[0][1]} {topGenres[0][1] === 1 ? 'request' : 'requests'})
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Most Active Participants */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6" data-analytics-participants>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-4 uppercase tracking-wide">👥 Most Active Participants</h4>
                  {topParticipants.length === 0 ? (
                    <p className="text-sm text-slate-400 dark:text-slate-500">No participant data available.</p>
                  ) : (
                    <div className="space-y-3">
                      {topParticipants.map((p, i) => (
                        <div key={p.userId} className="flex items-center gap-3" data-participant>
                          <span className={`text-lg font-bold w-6 text-center ${i === 0 ? 'text-amber-500' : i === 1 ? 'text-slate-400' : i === 2 ? 'text-orange-600' : 'text-slate-300 dark:text-slate-600'}`}>
                            {i + 1}
                          </span>
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {(p.nickname || 'A')[0].toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate" data-participant-name>
                              {p.nickname || 'Anonymous Attendee'}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{p.requestCount}</span>
                            <span className="text-xs text-slate-400 ml-1">{p.requestCount === 1 ? 'request' : 'requests'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Song Diversity Metrics */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6" data-analytics-diversity>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-4 uppercase tracking-wide">🌈 Song Diversity</h4>
                  {totalRequests === 0 ? (
                    <p className="text-sm text-slate-400 dark:text-slate-500">No song data to analyze.</p>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Genre Diversity */}
                        <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg border border-purple-100 dark:border-purple-800" data-diversity-genre>
                          <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">{topGenres.length}</p>
                          <p className="text-xs font-semibold text-purple-500 dark:text-purple-400 mt-1">Unique Genres</p>
                          <div className="mt-2 bg-purple-100 dark:bg-purple-900/40 rounded-full h-2 overflow-hidden">
                            <div className="bg-purple-500 h-full rounded-full" style={{ width: `${Math.min(topGenres.length * 20, 100)}%` }} />
                          </div>
                        </div>
                        {/* Artist Variety */}
                        <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-lg border border-blue-100 dark:border-blue-800" data-diversity-artist>
                          <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{uniqueArtists}</p>
                          <p className="text-xs font-semibold text-blue-500 dark:text-blue-400 mt-1">Unique Artists</p>
                          <div className="mt-2 bg-blue-100 dark:bg-blue-900/40 rounded-full h-2 overflow-hidden">
                            <div className="bg-blue-500 h-full rounded-full" style={{ width: `${artistDiversity}%` }} />
                          </div>
                        </div>
                        {/* Overall Diversity Score */}
                        <div className="text-center p-4 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-lg border border-emerald-100 dark:border-emerald-800">
                          <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{artistDiversity}%</p>
                          <p className="text-xs font-semibold text-emerald-500 dark:text-emerald-400 mt-1">Artist Variety Score</p>
                          <div className="mt-2 bg-emerald-100 dark:bg-emerald-900/40 rounded-full h-2 overflow-hidden">
                            <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${artistDiversity}%` }} />
                          </div>
                        </div>
                      </div>
                      {/* Diversity Insight */}
                      <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg" data-diversity-insight>
                        <p className="text-xs text-slate-600 dark:text-slate-300">
                          <span className="font-bold">💡 Insight:</span>{' '}
                          {artistDiversity >= 80
                            ? 'Excellent variety! Your audience requested a very diverse mix of artists.'
                            : artistDiversity >= 50
                            ? 'Good variety! A healthy mix of different artists in the queue.'
                            : artistDiversity >= 30
                            ? 'Moderate variety. Some artists were requested multiple times.'
                            : 'Low variety. The audience focused on a few favorite artists.'}
                          {topGenres.length >= 4
                            ? ` Genre-wise, a great spread across ${topGenres.length} genres shows eclectic taste.`
                            : topGenres.length >= 2
                            ? ` ${topGenres.length} genres represented — a decent range of musical styles.`
                            : topGenres.length === 1
                            ? ` All songs fell into one genre (${topGenres[0][0]}).`
                            : ''}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Additional Stats */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6" data-analytics-extra>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-4 uppercase tracking-wide">📊 Quick Stats</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="text-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">{maxVotes}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Most votes on a song</p>
                    </div>
                    <div className="text-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">{avgVotes}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Avg votes per song</p>
                    </div>
                    <div className="text-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">{totalRequests > 0 ? Math.round((approvedCount / totalRequests) * 100) : 0}%</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Approval rate</p>
                    </div>
                    <div className="text-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">{rejectedCount}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Songs rejected</p>
                    </div>
                    <div className="text-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">{withMessages}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Songs with dedications</p>
                    </div>
                    <div className="text-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">{djMessages.length}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">DJ messages sent</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </main>
      </div>

      {/* Song Ending Alert */}
      {songEndingAlert && (
        <div className="fixed bottom-4 right-4 z-50 w-80 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-orange-200 dark:border-orange-800 overflow-hidden animate-pulse-once" data-song-ending-alert>
          <div className="bg-orange-500 px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <Clock className="w-4 h-4" />
              <span className="text-sm font-bold">Song ending in {songEndingAlert.remainingSeconds}s</span>
            </div>
            <button
              onClick={() => {
                setDismissedAlerts(prev => new Set(prev).add(songEndingAlert.songId));
                setSongEndingAlert(null);
              }}
              className="text-white/80 hover:text-white transition-colors"
              data-dismiss-alert
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4">
            {songEndingAlert.nextSong ? (
              <>
                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide font-semibold mb-2">Up Next</p>
                <div className="flex items-center gap-3">
                  {songEndingAlert.nextSong.albumArtUrl ? (
                    <img src={songEndingAlert.nextSong.albumArtUrl} alt="" className="w-10 h-10 rounded flex-shrink-0 object-cover bg-slate-200 dark:bg-slate-700" loading="lazy" />
                  ) : (
                    <div className="w-10 h-10 rounded bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                      <Music className="w-5 h-5 text-slate-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{songEndingAlert.nextSong.title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {songEndingAlert.nextSong.artist}
                      {songEndingAlert.nextSong.durationMs && (
                        <span className="ml-1">({formatDuration(songEndingAlert.nextSong.durationMs)})</span>
                      )}
                    </p>
                  </div>
                </div>
                {/* Prep reminder for unprepped next song */}
                {songEndingAlert.nextSongId && !preppedSongs.has(songEndingAlert.nextSongId) && (
                  <div className="mt-3 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg" data-prep-reminder>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">⚠️</span>
                      <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">Not prepped yet!</span>
                    </div>
                    <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">Open in Spotify and add to queue, then mark as ready.</p>
                  </div>
                )}
                {songEndingAlert.nextSongSpotifyUrl && (
                  <a
                    href={songEndingAlert.nextSongSpotifyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 flex items-center justify-center gap-2 w-full px-3 py-2 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open in Spotify
                  </a>
                )}
                {songEndingAlert.nextSongId && !preppedSongs.has(songEndingAlert.nextSongId) && (
                  <button
                    onClick={() => setPreppedSongs(prev => {
                      const next = new Set(prev);
                      next.add(songEndingAlert.nextSongId);
                      return next;
                    })}
                    className="mt-2 flex items-center justify-center gap-2 w-full px-3 py-2 bg-primary-500 hover:bg-primary-600 text-white text-xs font-semibold rounded-lg transition-colors"
                    data-mark-prepped-from-alert
                  >
                    ✅ Mark as Prepped
                  </button>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">No songs queued up next</p>
            )}
          </div>
        </div>
      )}

      {/* New Request Toast Notifications */}
      {requestToasts.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-2" data-request-toasts>
          {requestToasts.map((toast) => (
            <div
              key={toast.id}
              className="w-80 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-primary-200 dark:border-primary-800 overflow-hidden cursor-pointer hover:shadow-xl transition-shadow animate-slide-in"
              onClick={() => {
                navigate('/events/' + id + '/manage/pending');
                setRequestToasts(prev => prev.filter(t => t.id !== toast.id));
              }}
              data-request-toast
            >
              <div className="bg-primary-500 px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2 text-white">
                  <Inbox className="w-4 h-4" />
                  <span className="text-sm font-bold">New Request</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setRequestToasts(prev => prev.filter(t => t.id !== toast.id));
                  }}
                  className="text-white/80 hover:text-white transition-colors"
                  data-dismiss-request-toast
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 flex items-center gap-3">
                {toast.albumArtUrl ? (
                  <img src={toast.albumArtUrl} alt="" className="w-10 h-10 rounded flex-shrink-0 object-cover bg-slate-200 dark:bg-slate-700" loading="lazy" />
                ) : (
                  <div className="w-10 h-10 rounded bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                    <Music className="w-5 h-5 text-slate-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{toast.songTitle}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{toast.artistName}</p>
                  {toast.nickname && (
                    <p className="text-xs text-primary-500 dark:text-primary-400 truncate mt-0.5">Requested by {toast.nickname}</p>
                  )}
                </div>
              </div>
              <div className="px-4 pb-3">
                <p className="text-xs text-slate-400 dark:text-slate-500">Click to review pending requests</p>
              </div>
            </div>
          ))}
        </div>
      )}

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

      {/* Keyboard Shortcuts Help Dialog */}
      {showShortcuts && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowShortcuts(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Keyboard className="w-5 h-5 text-primary-500" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Keyboard Shortcuts</h3>
              </div>
              <button onClick={() => setShowShortcuts(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              {[
                { key: 'A', desc: 'Approve top pending request' },
                { key: 'R', desc: 'Reject top pending request' },
                { key: 'P', desc: 'Play top queued song (Now Playing)' },
                { key: 'N', desc: 'Next song (mark played)' },
                { key: '?', desc: 'Toggle this help' },
                { key: 'Esc', desc: 'Close dialogs' },
              ].map(s => (
                <div key={s.key} className="flex items-center gap-3">
                  <kbd className="inline-flex items-center justify-center min-w-[2rem] px-2 py-1 text-xs font-mono font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 rounded shadow-sm">
                    {s.key}
                  </kbd>
                  <span className="text-sm text-slate-600 dark:text-slate-300">{s.desc}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">
              Shortcuts are disabled when typing in text fields.
            </p>
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
