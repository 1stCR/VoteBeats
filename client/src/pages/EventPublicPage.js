import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Music, Search, Send, ThumbsUp, Clock, ListMusic, User } from 'lucide-react';
import { api } from '../config/api';

function getAttendeeId() {
  let id = localStorage.getItem('votebeats_attendee_id');
  if (!id) {
    id = 'attendee-' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('votebeats_attendee_id', id);
  }
  return id;
}

export default function EventPublicPage() {
  const { eventId } = useParams();
  const [event, setEvent] = useState(null);
  const [djAnnouncements, setDjAnnouncements] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('request');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [nickname, setNickname] = useState('');
  const [message, setMessage] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');

  const attendeeId = getAttendeeId();

  const fetchEvent = useCallback(async () => {
    try {
      const data = await api.getPublicEvent(eventId);
      setEvent(data);
    } catch (err) {
      setError('Event not found');
    }
  }, [eventId]);

  const fetchRequests = useCallback(async () => {
    try {
      const data = await api.getRequests(eventId);
      setRequests(data);
    } catch (err) {
      console.error('Failed to fetch requests');
    }
  }, [eventId]);

  useEffect(() => {
    async function init() {
      setLoading(true);
      await fetchEvent();
      await fetchRequests();

      try {
        const msgs = await api.getEventMessages(eventId);
        setDjAnnouncements(msgs);
      } catch (err) {
        console.error('Failed to fetch DJ messages');
      }
      setLoading(false);
    }
    init();
  }, [fetchEvent, fetchRequests]);

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const results = await api.searchSongs(searchQuery);
      setSearchResults(results.results || results || []);
    } catch (err) {
      setSearchResults([]);
    }
    setSearching(false);
  }

  async function handleSubmitRequest(song) {
    try {
      await api.submitRequest(eventId, {
        songTitle: song.trackName || song.title,
        artistName: song.artistName || song.artist,
        albumArtUrl: song.artworkUrl100 || song.albumArtUrl || null,
        durationMs: song.trackTimeMillis || song.durationMs || null,
        explicitFlag: song.trackExplicitness === 'explicit' || song.explicit || false,
        itunesTrackId: song.trackId || null,
        requestedBy: attendeeId,
        nickname: nickname.trim() || null,
        message: message.trim() || null,
      });
      setSubmitSuccess(song.trackName || song.title);
      setSearchQuery('');
      setSearchResults([]);
      setMessage('');
      setTimeout(() => setSubmitSuccess(''), 3000);
      fetchRequests();
    } catch (err) {
      alert(err.message || 'Failed to submit request');
    }
  }

  async function handleVote(requestId) {
    try {
      await api.voteRequest(eventId, requestId, attendeeId);
      fetchRequests();
    } catch (err) {
      // Already voted or error
    }
  }

  const myRequests = requests.filter(r => r.requestedBy?.userId === attendeeId);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <p className="text-slate-500">Loading event...</p>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Event Not Found</h2>
          <p className="text-slate-500">This event doesn't exist or is no longer available.</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { key: 'request', label: 'Request Song', icon: Music },
    { key: 'queue', label: 'Queue', icon: ListMusic },
    { key: 'my-requests', label: 'My Requests', icon: User },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <header className="bg-gradient-to-r from-primary-600 to-accent-600 text-white shadow-lg">
        <div className="max-w-2xl mx-auto px-4 py-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Music className="w-6 h-6" />
            <span className="text-sm font-medium opacity-80">VoteBeats</span>
          </div>
          <h1 className="text-2xl font-bold">{event.name}</h1>
          {event.location && <p className="text-sm opacity-80 mt-1">{event.location}</p>}
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4">
        {djAnnouncements.length > 0 && (
          <div className="mt-4 mb-2 space-y-2">
            {djAnnouncements.map(msg => (
              <div key={msg.id} className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <Music className="w-4 h-4 text-primary-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-primary-700 dark:text-primary-300">{msg.content}</p>
                    <p className="text-xs text-primary-500 dark:text-primary-400 mt-1">DJ Announcement</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <nav className="flex border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-t-xl mt-4">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 py-3 px-2 text-sm font-medium flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div className="bg-white dark:bg-slate-800 rounded-b-xl shadow-sm border border-t-0 border-slate-200 dark:border-slate-700 p-4 mb-8">
          {activeTab === 'request' && (
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Request a Song</h2>

              {submitSuccess && (
                <div className="mb-4 bg-green-500/10 border border-green-500/50 rounded-lg p-3 text-green-600 dark:text-green-400 text-sm">
                  "{submitSuccess}" has been requested!
                </div>
              )}

              <div className="mb-4">
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Your name (optional)"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none mb-3"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="Search for a song..."
                    className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  />
                  <button
                    onClick={handleSearch}
                    disabled={searching}
                    className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50"
                  >
                    <Search className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {searching && <p className="text-sm text-slate-500 mb-4">Searching...</p>}

              {searchResults.length > 0 && (
                <div className="space-y-2 mb-4">
                  {searchResults.map((song, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                      {(song.artworkUrl100 || song.albumArtUrl) && (
                        <img src={song.artworkUrl100 || song.albumArtUrl} alt="" className="w-10 h-10 rounded" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{song.trackName || song.title}</p>
                        <p className="text-xs text-slate-500 truncate">{song.artistName || song.artist}</p>
                      </div>
                      <button
                        onClick={() => handleSubmitRequest(song)}
                        className="px-3 py-1.5 bg-primary-500 text-white text-xs font-medium rounded-lg hover:bg-primary-600 transition-colors flex items-center gap-1"
                      >
                        <Send className="w-3 h-3" />
                        Request
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Add a message to the DJ (optional)"
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
                />
              </div>
            </div>
          )}

          {activeTab === 'queue' && (
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
                Live Queue ({requests.filter(r => r.status === 'queued' || r.status === 'pending').length})
              </h2>
              {requests.filter(r => r.status === 'queued' || r.status === 'pending').length === 0 ? (
                <p className="text-sm text-slate-500">No songs in the queue yet. Be the first to request!</p>
              ) : (
                <div className="space-y-2">
                  {requests.filter(r => r.status === 'queued' || r.status === 'pending').map(req => (
                    <div key={req.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                      {req.song?.albumArtUrl && (
                        <img src={req.song.albumArtUrl} alt="" className="w-10 h-10 rounded" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{req.song?.title}</p>
                        <p className="text-xs text-slate-500 truncate">{req.song?.artist}</p>
                      </div>
                      <button
                        onClick={() => handleVote(req.id)}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-slate-200 dark:bg-slate-600 rounded-full hover:bg-primary-100 dark:hover:bg-primary-900 transition-colors"
                      >
                        <ThumbsUp className="w-3 h-3" />
                        {req.voteCount || 0}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'my-requests' && (
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
                My Requests ({myRequests.length})
              </h2>
              {myRequests.length === 0 ? (
                <p className="text-sm text-slate-500">You haven't requested any songs yet.</p>
              ) : (
                <div className="space-y-2">
                  {myRequests.map(req => (
                    <div key={req.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                      {req.song?.albumArtUrl && (
                        <img src={req.song.albumArtUrl} alt="" className="w-10 h-10 rounded" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{req.song?.title}</p>
                        <p className="text-xs text-slate-500 truncate">{req.song?.artist}</p>
                      </div>
                      <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                        req.status === 'pending' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                        req.status === 'queued' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                        req.status === 'played' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        req.status === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {req.status === 'pending' && 'Pending'}
                        {req.status === 'queued' && 'In Queue'}
                        {req.status === 'played' && 'Played'}
                        {req.status === 'rejected' && 'Rejected'}
                        {req.status === 'nowPlaying' && 'Now Playing'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
