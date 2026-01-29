import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Music, Search, Send, ThumbsUp, ListMusic, User, Link2, Flame } from 'lucide-react';
import { api } from '../config/api';

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function getAttendeeId() {
  let id = localStorage.getItem('votebeats_attendee_id');
  if (!id) {
    id = generateUUID();
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
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const [manualArtist, setManualArtist] = useState('');
  const [searching, setSearching] = useState(false);
  const [nickname, setNickname] = useState(() => localStorage.getItem('votebeats_nickname') || '');
  const [codeWord, setCodeWord] = useState(() => localStorage.getItem('votebeats_codeword') || '');
  const [showCodeWordInput, setShowCodeWordInput] = useState(false);
  const [codeWordLinked, setCodeWordLinked] = useState(!!localStorage.getItem('votebeats_codeword'));
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
      const data = await api.getRequests(eventId, attendeeId);
      setRequests(data);
    } catch (err) {
      console.error('Failed to fetch requests');
    }
  }, [eventId, attendeeId]);

  // Poll for real-time updates (vote counts, status changes)
  useEffect(() => {
    if (!eventId || loading) return;
    const pollInterval = setInterval(() => {
      fetchRequests();
    }, 3000); // Poll every 3 seconds for real-time vote updates
    return () => clearInterval(pollInterval);
  }, [eventId, loading, fetchRequests]);

  // Resolve code word to linked attendee ID
  useEffect(() => {
    if (codeWord && codeWord.length >= 3) {
      localStorage.setItem('votebeats_codeword', codeWord);
      api.resolveCodeWord(codeWord)
        .then(data => {
          localStorage.setItem('votebeats_attendee_id', data.attendeeId);
          setCodeWordLinked(true);
        })
        .catch(() => {});
    } else if (!codeWord) {
      localStorage.removeItem('votebeats_codeword');
      setCodeWordLinked(false);
    }
  }, [codeWord]);

  // Persist nickname to localStorage
  useEffect(() => {
    if (nickname) {
      localStorage.setItem('votebeats_nickname', nickname);
    } else {
      localStorage.removeItem('votebeats_nickname');
    }
  }, [nickname]);

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

  function handleManualSubmit() {
    if (!manualTitle.trim() || !manualArtist.trim()) return;
    handleSubmitRequest({
      trackName: manualTitle.trim(),
      artistName: manualArtist.trim(),
      trackId: null,
      artworkUrl100: null,
      trackTimeMillis: null,
      trackExplicitness: 'notExplicit',
    });
    setManualTitle('');
    setManualArtist('');
    setShowManualEntry(false);
  }

  function isExplicitBlocked() {
    return event && event.settings && event.settings.blockExplicit !== false;
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
  const myVotes = requests.filter(r => r.votedByUser && r.requestedBy?.userId !== attendeeId);

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
                {event.status === 'completed' && (
                  <div id="event-status-banner" className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-center py-3 px-4 rounded-xl mb-4 text-sm font-medium">
                    This event has ended. Song requests are no longer being accepted.
                  </div>
                )}
                {event.status === 'upcoming' && (
                  <div id="event-status-upcoming" className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-center py-3 px-4 rounded-xl mb-4 text-sm font-medium">
                    This event hasn't started yet. Stay tuned!
                  </div>
                )}

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
                
                {!showCodeWordInput && !codeWordLinked && (
                  <button
                    type="button"
                    onClick={() => setShowCodeWordInput(true)}
                    className="text-xs text-primary-500 hover:text-primary-600 flex items-center gap-1 mt-1"
                  >
                    <Link2 className="w-3 h-3" />
                    Link another device
                  </button>
                )}
                {(showCodeWordInput || codeWordLinked) && (
                  <div className="flex items-center gap-2 mt-1">
                    <Link2 className="w-3 h-3 text-primary-500 flex-shrink-0" />
                    <input
                      type="text"
                      value={codeWord}
                      onChange={(e) => setCodeWord(e.target.value.trim())}
                      placeholder="Enter code word..."
                      className="flex-1 px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-1 focus:ring-primary-500 outline-none"
                    />
                    {codeWordLinked && <span className="text-xs text-green-500">✓ Linked</span>}
                  </div>
                )}
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


              {/* Manual Entry Fallback */}
              {searchQuery.trim() && !searching && (
                <div className="mb-4">
                  {!showManualEntry ? (
                    <button
                      type="button"
                      onClick={() => setShowManualEntry(true)}
                      className="text-sm text-primary-500 hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300 font-medium"
                    >
                      Can't find your song? Enter it manually
                    </button>
                  ) : (
                    <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 border border-slate-200 dark:border-slate-600">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Manual Song Entry</p>
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={manualTitle}
                          onChange={(e) => setManualTitle(e.target.value)}
                          placeholder="Song title *"
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-500 rounded-lg bg-white dark:bg-slate-600 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                        />
                        <input
                          type="text"
                          value={manualArtist}
                          onChange={(e) => setManualArtist(e.target.value)}
                          placeholder="Artist name *"
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-500 rounded-lg bg-white dark:bg-slate-600 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={handleManualSubmit}
                            disabled={!manualTitle.trim() || !manualArtist.trim()}
                            className="px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50"
                          >
                            Submit Request
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowManualEntry(false)}
                            className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-lg transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
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
              {(event?.status === 'completed' && event?.settings?.postCloseVisibility === 'hide') ? (
                <div className="text-center py-8">
                  <ListMusic className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Playlist Hidden</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">The final playlist will be revealed at the event!</p>
                </div>
              ) : (event?.status === 'active' && event?.settings?.duringEventVisibility === 'hide') ? (
                <div className="text-center py-8">
                  <ListMusic className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Queue Hidden</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">The DJ has hidden the queue during the event.</p>
                </div>
              ) : (event?.status === 'active' && event?.settings?.duringEventVisibility === 'nowPlayingOnly') ? (
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Now Playing</h2>
                  {requests.filter(r => r.status === 'nowPlaying').length === 0 ? (
                    <p className="text-sm text-slate-500">Nothing playing right now.</p>
                  ) : (
                    <div className="space-y-2">
                      {requests.filter(r => r.status === 'nowPlaying').map(req => (
                        <div key={req.id} className="flex items-center gap-3 p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-800">
                          {req.song?.albumArtUrl && (
                            <img src={req.song.albumArtUrl} alt="" className="w-12 h-12 rounded" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{req.song?.title}</p>
                            <p className="text-xs text-slate-500 truncate">{req.song?.artist}</p>
                          </div>
                          <span className="text-xs font-medium text-primary-600 dark:text-primary-400">NOW PLAYING</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : event?.settings?.queueVisibility === 'blind' ? (
                <div className="text-center py-8">
                  <ListMusic className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                  <p className="text-sm text-slate-500 dark:text-slate-400">Queue is hidden for this event. Submit your requests from the Request tab!</p>
                </div>
              ) : event?.settings?.queueVisibility === 'own' ? (
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
                    Your Queued Songs ({requests.filter(r => (r.status === 'queued' || r.status === 'pending') && r.requestedBy?.userId === attendeeId).length})
                  </h2>
                  {requests.filter(r => (r.status === 'queued' || r.status === 'pending') && r.requestedBy?.userId === attendeeId).length === 0 ? (
                    <p className="text-sm text-slate-500">You don't have any songs in the queue yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {requests.filter(r => (r.status === 'queued' || r.status === 'pending') && r.requestedBy?.userId === attendeeId).map(req => (
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
              ) : (
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
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{req.song?.title}</p>
                              {req.trending && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-xs font-medium rounded-full flex-shrink-0" title={`+${req.recentVotes} votes in last hour`}>
                                  <Flame className="w-3 h-3" />
                                  +{req.recentVotes}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 truncate">{req.song?.artist}</p>
                            {req.totalVoters > 0 && (
                              <p className="text-xs text-primary-500 dark:text-primary-400 mt-0.5">
                                {req.voterNames && req.voterNames.length > 0 ? (
                                  <>
                                    {req.voterNames.slice(0, 2).join(', ')}
                                    {req.totalVoters > req.voterNames.length ? (
                                      <> and {req.totalVoters - req.voterNames.slice(0, 2).length} other{req.totalVoters - req.voterNames.slice(0, 2).length !== 1 ? 's' : ''} voted</>
                                    ) : req.voterNames.length > 2 ? (
                                      <> and {req.voterNames.length - 2} other{req.voterNames.length - 2 !== 1 ? 's' : ''} voted</>
                                    ) : (
                                      <> voted</>
                                    )}
                                  </>
                                ) : (
                                  <>{req.totalVoters} {req.totalVoters === 1 ? 'person' : 'people'} voted</>
                                )}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => handleVote(req.id)}
                            className={`flex items-center gap-1 px-2 py-1 text-xs rounded-full transition-colors ${
                              req.votedByUser
                                ? 'bg-primary-500 text-white'
                                : 'bg-slate-200 dark:bg-slate-600 hover:bg-primary-100 dark:hover:bg-primary-900'
                            }`}
                            title={req.votedByUser ? 'You voted for this' : 'Vote for this song'}
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

              {/* My Votes section */}
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 mt-8">
                My Votes ({myVotes.length})
              </h2>
              {myVotes.length === 0 ? (
                <p className="text-sm text-slate-500">You haven't voted for any other songs yet.</p>
              ) : (
                <div className="space-y-2">
                  {myVotes.map(req => (
                    <div key={req.id} className="flex items-center gap-3 p-3 bg-primary-50 dark:bg-primary-900/10 rounded-lg border border-primary-200 dark:border-primary-800">
                      {req.song?.albumArtUrl && (
                        <img src={req.song.albumArtUrl} alt="" className="w-10 h-10 rounded" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{req.song?.title}</p>
                        <p className="text-xs text-slate-500 truncate">{req.song?.artist}</p>
                      </div>
                      <span className="flex items-center gap-1 px-2 py-0.5 text-xs rounded-full font-medium bg-primary-500 text-white">
                        <ThumbsUp className="w-3 h-3" />
                        {req.voteCount || 0}
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
