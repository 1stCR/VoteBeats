import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Music, Search, Send, ThumbsUp, ListMusic, User, Link2, Flame, Clock, AlertTriangle } from 'lucide-react';
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
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [votingCountdown, setVotingCountdown] = useState(null);
  const [votingOpenCountdown, setVotingOpenCountdown] = useState(null);
  const [voteError, setVoteError] = useState('');
  const [similarSongDialog, setSimilarSongDialog] = useState(null); // { song, matches }

  // Helper to format time diff
  const formatTimeDiff = (diff) => {
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    if (days > 0) return days + 'd ' + hours + 'h ' + minutes + 'm';
    if (hours > 0) return hours + 'h ' + minutes + 'm ' + seconds + 's';
    return minutes + 'm ' + seconds + 's';
  };

  // Countdown timer for voting open
  useEffect(() => {
    const settings = event?.settings;
    if (!settings) return;

    if (settings.votingSchedule === 'scheduled' && settings.votingOpenTime) {
      const updateOpenCountdown = () => {
        const now = Date.now();
        const openTime = new Date(settings.votingOpenTime).getTime();
        const diff = openTime - now;

        if (diff <= 0) {
          setVotingOpenCountdown(null); // Voting has opened
          return;
        }

        setVotingOpenCountdown({ notYetOpen: true, text: formatTimeDiff(diff), diff });
      };

      updateOpenCountdown();
      const interval = setInterval(updateOpenCountdown, 1000);
      return () => clearInterval(interval);
    }

    setVotingOpenCountdown(null);
  }, [event?.settings?.votingSchedule, event?.settings?.votingOpenTime]);

  // Countdown timer for voting close
  useEffect(() => {
    const settings = event?.settings;
    if (!settings) return;

    // If voting is manually closed
    if (settings.votingClosed) {
      setVotingCountdown({ closed: true, text: 'Voting Closed' });
      return;
    }

    // If scheduled close mode with a close time
    if (settings.votingCloseMode === 'scheduled' && settings.votingCloseTime) {
      const updateCountdown = () => {
        const now = Date.now();
        const closeTime = new Date(settings.votingCloseTime).getTime();
        const diff = closeTime - now;

        if (diff <= 0) {
          setVotingCountdown({ closed: true, text: 'Voting Closed' });
          return;
        }

        setVotingCountdown({ closed: false, text: formatTimeDiff(diff), urgency: diff <= 3600000 ? 'urgent' : diff <= 86400000 ? 'warning' : 'normal', diff });
      };

      updateCountdown();
      const interval = setInterval(updateCountdown, 1000);
      return () => clearInterval(interval);
    }

    // No countdown needed (manual mode, not closed)
    setVotingCountdown(null);
  }, [event?.settings?.votingClosed, event?.settings?.votingCloseMode, event?.settings?.votingCloseTime]);

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
      fetchEvent();
    }, 3000); // Poll every 3 seconds for real-time vote updates
    return () => clearInterval(pollInterval);
  }, [eventId, loading, fetchRequests, fetchEvent]);

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
        const msgs = await api.getEventMessages(eventId, attendeeId);
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
    if (votingOpenCountdown?.notYetOpen) {
      alert('Voting has not opened yet. Please wait for the voting window to open!');
      return;
    }
    if (votingCountdown?.closed) {
      alert('Voting has closed. The final playlist is set!');
      return;
    }
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

  async function handleSubmitRequest(song, skipSimilarCheck = false) {
    if (votingOpenCountdown?.notYetOpen) {
      alert('Voting has not opened yet. Please wait for the voting window to open!');
      return;
    }
    if (votingCountdown?.closed) {
      alert('Voting has closed. The final playlist is set!');
      return;
    }

    const songTitle = song.trackName || song.title;
    const artistName = song.artistName || song.artist;

    // Check for similar songs in the queue (fuzzy matching)
    if (!skipSimilarCheck) {
      try {
        const result = await api.checkSimilarSongs(eventId, songTitle, artistName);
        if (result.hasSimilar && result.matches.length > 0) {
          setSimilarSongDialog({ song, matches: result.matches });
          return; // Don't submit yet — show dialog
        }
      } catch (err) {
        // If the check fails, proceed with submission anyway
        console.warn('Similar song check failed, proceeding:', err);
      }
    }

    try {
      await api.submitRequest(eventId, {
        songTitle,
        artistName,
        albumArtUrl: song.artworkUrl100 || song.albumArtUrl || null,
        durationMs: song.trackTimeMillis || song.durationMs || null,
        explicitFlag: song.trackExplicitness === 'explicit' || song.explicit || false,
        itunesTrackId: song.trackId || null,
        requestedBy: attendeeId,
        nickname: nickname.trim() || null,
        message: message.trim() || null,
        genre: song.genre || song.primaryGenreName || null,
      });
      setSubmitSuccess(songTitle);
      setSearchQuery('');
      setSearchResults([]);
      setMessage('');
      setTimeout(() => setSubmitSuccess(''), 3000);
      fetchRequests();
    } catch (err) {
      alert(err.message || 'Failed to submit request');
    }
  }

  function handleProceedAnyway() {
    if (similarSongDialog) {
      const song = similarSongDialog.song;
      setSimilarSongDialog(null);
      handleSubmitRequest(song, true); // Skip similar check on retry
    }
  }

  function handleVoteOnExisting(requestId) {
    setSimilarSongDialog(null);
    handleVote(requestId);
    setActiveTab('queue'); // Switch to queue tab to see the voted song
  }

  async function handleVote(requestId) {
    // Optimistic UI update: immediately update vote count and visual state
    const previousRequests = [...requests];
    const targetReq = requests.find(r => r.id === requestId);
    const wasVoted = targetReq?.votedByUser;

    setRequests(prev => prev.map(r => {
      if (r.id !== requestId) return r;
      return {
        ...r,
        voteCount: wasVoted
          ? Math.max((r.voteCount || 0) - 1, 0)
          : (r.voteCount || 0) + 1,
        votedByUser: !wasVoted,
      };
    }));
    setVoteError('');

    try {
      await api.voteRequest(eventId, requestId, attendeeId);
      // Server confirmed — fetch fresh data to sync any other changes
      fetchRequests();
    } catch (err) {
      // Rollback to previous state on failure
      setRequests(previousRequests);
      const msg = err?.message || 'Vote failed. Please try again.';
      setVoteError(msg);
      setTimeout(() => setVoteError(''), 4000);
    }
  }

  const myRequests = requests.filter(r => r.requestedBy?.userId === attendeeId);
  const myVotes = requests.filter(r => r.votedByUser && r.requestedBy?.userId !== attendeeId);

  // Compute overall rankings for queue position display
  const rankedQueue = requests
    .filter(r => r.status === 'queued' || r.status === 'pending')
    .sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0));
  const getRank = (reqId) => {
    const idx = rankedQueue.findIndex(r => r.id === reqId);
    return idx >= 0 ? idx + 1 : null;
  };

  // Variety prompt: suggest other genres when queue is homogeneous
  const genrePrompt = (() => {
    const queueSongs = requests.filter(r => r.status === 'queued' || r.status === 'pending');
    const genreSongs = queueSongs.filter(r => r.song?.genre);
    if (genreSongs.length < 3) return null; // Need at least 3 genre-tagged songs
    const genreCounts = {};
    genreSongs.forEach(r => {
      genreCounts[r.song.genre] = (genreCounts[r.song.genre] || 0) + 1;
    });
    const sorted = Object.entries(genreCounts).sort((a, b) => b[1] - a[1]);
    const topGenre = sorted[0][0];
    const topCount = sorted[0][1];
    const ratio = topCount / genreSongs.length;
    if (ratio >= 0.6) {
      const otherGenres = ['Rock', 'Hip-Hop', 'R&B', 'Country', 'Electronic', 'Jazz', 'Latin', 'Classical']
        .filter(g => g !== topGenre);
      const suggestions = otherGenres.slice(0, 3).join(', ');
      return { topGenre, ratio: Math.round(ratio * 100), suggestions };
    }
    return null;
  })();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4" data-loading-skeleton>
        <div className="max-w-2xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-2/3 mx-auto mb-2" />
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mx-auto mb-6" />
            <div className="flex gap-2 justify-center mb-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-10 bg-slate-200 dark:bg-slate-700 rounded-lg w-28" />
              ))}
            </div>
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 flex items-center gap-3">
                <div className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-lg flex-shrink-0" />
                <div className="flex-1">
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
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

          {votingOpenCountdown && (
            <div id="voting-open-banner" className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-blue-500/20 text-blue-100">
              <Clock className="w-4 h-4" />
              {`Voting opens in ${votingOpenCountdown.text}`}
            </div>
          )}
          {votingCountdown && (
            <div id="voting-countdown-banner" className={`mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
              votingCountdown.closed
                ? 'bg-red-500/20 text-red-100'
                : votingCountdown.urgency === 'urgent'
                ? 'bg-orange-500/20 text-orange-100 animate-pulse'
                : votingCountdown.urgency === 'warning'
                ? 'bg-yellow-500/20 text-yellow-100'
                : 'bg-white/20 text-white'
            }`}>
              <Clock className="w-4 h-4" />
              {votingCountdown.closed ? 'Voting Closed' : `Voting closes in ${votingCountdown.text}`}
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
                    <p className="text-xs text-primary-500 dark:text-primary-400 mt-1">DJ Announcement{msg.createdAt ? ` • ${new Date(msg.createdAt).toLocaleString()}` : ''}</p>
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

        {voteError && (
          <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300 flex items-center gap-2" data-vote-error>
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01" /></svg>
            {voteError}
          </div>
        )}

        <div className="bg-white dark:bg-slate-800 rounded-b-xl shadow-sm border border-t-0 border-slate-200 dark:border-slate-700 p-4 mb-8">
          {activeTab === 'request' && (
            <div>
              {votingOpenCountdown?.notYetOpen ? (
                <div className="text-center py-12">
                  <Clock className="w-16 h-16 text-blue-300 dark:text-blue-600 mx-auto mb-4" />
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Voting hasn't opened yet</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">The voting window will open soon.</p>
                  <div className="inline-block px-6 py-3 bg-gradient-to-r from-blue-500 to-primary-500 rounded-full">
                    <p className="text-lg font-bold text-white">Opens in {votingOpenCountdown.text}</p>
                  </div>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-4">Come back when voting opens to request and vote on songs!</p>
                </div>
              ) : votingCountdown?.closed ? (
                <div className="text-center py-12">
                  <ListMusic className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Voting has closed</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">The final playlist is set!</p>
                  <div className="inline-block px-6 py-3 bg-gradient-to-r from-primary-500 to-purple-500 rounded-full">
                    <p className="text-lg font-bold text-white">See you at the dance!</p>
                  </div>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-4">Check the Queue tab to see your contributions highlighted</p>
                </div>
              ) : (
                <>
              {genrePrompt && (
                <div id="variety-prompt" className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    <span className="font-medium">Mix it up!</span> The queue is {genrePrompt.ratio}% {genrePrompt.topGenre}. Try requesting some {genrePrompt.suggestions}!
                  </p>
                </div>
              )}
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
                    aria-label="Search songs"
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
                        <img src={song.artworkUrl100 || song.albumArtUrl} alt="" className="w-10 h-10 rounded bg-slate-200 dark:bg-slate-700" loading="lazy" />
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
              <p className="mt-3 text-xs text-slate-400 dark:text-slate-500" data-privacy-notice>
                No account needed. Your requests are anonymous — only your optional nickname is shared with the DJ.
              </p>
                </>
              )}
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
                            <img src={req.song.albumArtUrl} alt="" className="w-12 h-12 rounded bg-slate-200 dark:bg-slate-700" loading="lazy" />
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
                            <img src={req.song.albumArtUrl} alt="" className="w-10 h-10 rounded bg-slate-200 dark:bg-slate-700" loading="lazy" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{req.song?.title}</p>
                            <p className="text-xs text-slate-500 truncate">{req.song?.artist}</p>
                          </div>
                          <button
                            onClick={() => handleVote(req.id)}
                            disabled={votingCountdown?.closed || votingOpenCountdown?.notYetOpen}
                            className={`flex items-center gap-1 px-2 py-1 text-xs rounded-full transition-colors ${
                              votingCountdown?.closed
                                ? 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                                : 'bg-slate-200 dark:bg-slate-600 hover:bg-primary-100 dark:hover:bg-primary-900'
                            }`}
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
                  {/* Genre Filter */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Filter by Genre
                    </label>
                    <select
                      value={selectedGenre}
                      onChange={(e) => setSelectedGenre(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                    >
                      <option value="all">All Genres</option>
                      {Array.from(new Set(
                        requests
                          .filter(r => (r.status === 'queued' || r.status === 'pending') && r.song?.genre)
                          .map(r => r.song.genre)
                      )).sort().map(genre => (
                        <option key={genre} value={genre}>{genre}</option>
                      ))}
                    </select>
                  </div>
                  {requests.filter(r => (r.status === 'queued' || r.status === 'pending') && (selectedGenre === 'all' || r.song?.genre === selectedGenre)).length === 0 ? (
                    <p className="text-sm text-slate-500">{selectedGenre === 'all' ? 'No songs in the queue yet. Be the first to request!' : `No ${selectedGenre} songs in the queue.`}</p>
                  ) : (
                    <div className="space-y-2">
                      {requests.filter(r => (r.status === 'queued' || r.status === 'pending') && (selectedGenre === 'all' || r.song?.genre === selectedGenre))
                        .sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0))
                        .map((req, index) => (
                        <div key={req.id} className={`flex items-center gap-3 p-3 rounded-lg ${
                          votingCountdown?.closed && req.requestedBy?.userId === attendeeId
                            ? 'bg-emerald-50 dark:bg-emerald-900/20 ring-2 ring-emerald-300 dark:ring-emerald-700'
                            : votingCountdown?.closed && req.votedByUser
                            ? 'bg-primary-50 dark:bg-primary-900/20 ring-2 ring-primary-300 dark:ring-primary-700'
                            : 'bg-slate-50 dark:bg-slate-700/50'
                        }`} data-rank={index + 1}>
                          <span className={`flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold ${
                            index === 0 ? 'bg-yellow-400 text-yellow-900' :
                            index === 1 ? 'bg-slate-300 text-slate-700' :
                            index === 2 ? 'bg-amber-600 text-white' :
                            'bg-slate-100 dark:bg-slate-600 text-slate-500 dark:text-slate-300'
                          }`}>
                            {index + 1}
                          </span>
                          {req.song?.albumArtUrl && (
                            <img src={req.song.albumArtUrl} alt="" className="w-10 h-10 rounded bg-slate-200 dark:bg-slate-700" loading="lazy" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{req.song?.title}</p>
                              {votingCountdown?.closed && req.requestedBy?.userId === attendeeId && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-xs font-medium rounded-full flex-shrink-0">
                                  Your request
                                </span>
                              )}
                              {votingCountdown?.closed && req.votedByUser && req.requestedBy?.userId !== attendeeId && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 text-xs font-medium rounded-full flex-shrink-0">
                                  You voted
                                </span>
                              )}
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
                            disabled={votingCountdown?.closed || votingOpenCountdown?.notYetOpen}
                            className={`flex items-center gap-1 px-2 py-1 text-xs rounded-full transition-colors ${
                              (votingCountdown?.closed || votingOpenCountdown?.notYetOpen)
                                ? 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                                : req.votedByUser
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
                  {myRequests.map(req => {
                    const rank = getRank(req.id);
                    return (
                    <div key={req.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                      {req.song?.albumArtUrl && (
                        <img src={req.song.albumArtUrl} alt="" className="w-10 h-10 rounded bg-slate-200 dark:bg-slate-700" loading="lazy" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{req.song?.title}</p>
                        <p className="text-xs text-slate-500 truncate">{req.song?.artist}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-primary-500 dark:text-primary-400 font-medium">{req.voteCount || 0} {(req.voteCount || 0) === 1 ? 'vote' : 'votes'}</span>
                          {rank && (
                            <span className="text-xs text-slate-400 dark:text-slate-500">• Rank #{rank} of {rankedQueue.length}</span>
                          )}
                        </div>
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
                    );
                  })}
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
                        <img src={req.song.albumArtUrl} alt="" className="w-10 h-10 rounded bg-slate-200 dark:bg-slate-700" loading="lazy" />
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

        {/* Similar Song Warning Dialog */}
        {similarSongDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setSimilarSongDialog(null)}>
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 relative" onClick={e => e.stopPropagation()} data-similar-dialog>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Similar Song Found</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">This song may already be in the queue</p>
                </div>
              </div>

              <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">You're requesting:</p>
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  {similarSongDialog.song.trackName || similarSongDialog.song.title}
                </p>
                <p className="text-xs text-slate-500">
                  {similarSongDialog.song.artistName || similarSongDialog.song.artist}
                </p>
              </div>

              <div className="mb-4">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Already in queue:</p>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {similarSongDialog.matches.map((match, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-800">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                          {match.existingRequest.songTitle}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {match.existingRequest.artistName}
                        </p>
                        <p className="text-xs text-primary-500 dark:text-primary-400 mt-0.5">
                          {match.existingRequest.voteCount || 0} {(match.existingRequest.voteCount || 0) === 1 ? 'vote' : 'votes'}
                        </p>
                      </div>
                      <button
                        onClick={() => handleVoteOnExisting(match.existingRequest.id)}
                        className="px-3 py-1.5 bg-primary-500 text-white text-xs font-medium rounded-lg hover:bg-primary-600 transition-colors flex items-center gap-1 flex-shrink-0"
                      >
                        <ThumbsUp className="w-3 h-3" />
                        Vote
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleProceedAnyway}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors"
                >
                  Request Anyway
                </button>
                <button
                  onClick={() => setSimilarSongDialog(null)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
