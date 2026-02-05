import React, { useState, useEffect, useRef } from 'react';
import { Plus, Check, Music, Filter, Eye, EyeOff } from 'lucide-react';
import { api } from '../config/api';

export default function BrowseQueue({ eventId, attendeeId, requests, rankings, crowdScores, rankingDepth, onRankingsChanged, onSeenUpdated }) {
  const [sortBy, setSortBy] = useState('crowd-rank'); // crowd-rank, newest, ranker-count
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const hasMarkedSeen = useRef(false);

  const rankedRequestIds = new Set(rankings.map(r => r.requestId));
  const slotsUsed = rankings.length;
  const canAddMore = slotsUsed < rankingDepth;

  // Get crowd scores map
  const crowdScoreMap = {};
  if (crowdScores && crowdScores.scores) {
    for (const s of crowdScores.scores) {
      crowdScoreMap[s.requestId] = s;
    }
  }

  // Separate seen/unseen
  const seenRequestIds = new Set();
  const unseenRequests = [];
  const seenRequests = [];

  // Determine seen/unseen using localStorage (simple approach that persists)
  const seenKey = `votebeats_seen_${eventId}_${attendeeId}`;
  const getSeenIds = () => {
    try {
      const stored = localStorage.getItem(seenKey);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  };

  const storedSeenIds = getSeenIds();

  // Filter to only rankable requests
  const rankableRequests = requests.filter(r => r.status === 'queued' || r.status === 'pending');

  for (const req of rankableRequests) {
    if (storedSeenIds.has(req.id)) {
      seenRequests.push(req);
      seenRequestIds.add(req.id);
    } else {
      unseenRequests.push(req);
    }
  }

  // Sort function
  const sortRequests = (list) => {
    return [...list].sort((a, b) => {
      const scoreA = crowdScoreMap[a.id];
      const scoreB = crowdScoreMap[b.id];

      if (sortBy === 'crowd-rank') {
        const rankA = scoreA ? scoreA.rank : 999;
        const rankB = scoreB ? scoreB.rank : 999;
        return rankA - rankB;
      }
      if (sortBy === 'newest') {
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      }
      if (sortBy === 'ranker-count') {
        const countA = scoreA ? scoreA.rankerCount : 0;
        const countB = scoreB ? scoreB.rankerCount : 0;
        return countB - countA;
      }
      return 0;
    });
  };

  const sortedUnseen = sortRequests(unseenRequests);
  const sortedSeen = sortRequests(seenRequests);

  // Mark all visible songs as seen after rendering
  useEffect(() => {
    if (hasMarkedSeen.current) return;
    if (rankableRequests.length === 0) return;

    hasMarkedSeen.current = true;

    // Mark all current requests as seen in localStorage
    const newSeen = new Set(storedSeenIds);
    for (const req of rankableRequests) {
      newSeen.add(req.id);
    }
    localStorage.setItem(seenKey, JSON.stringify([...newSeen]));

    // Also mark on server
    const newRequestIds = rankableRequests.map(r => r.id);
    api.markSongsSeen(eventId, attendeeId, newRequestIds).catch(() => {});

    // Notify parent that seen count updated
    if (onSeenUpdated) onSeenUpdated();
  }, [rankableRequests.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const addToRanking = async (requestId) => {
    try {
      await api.addToRanking(eventId, attendeeId, requestId);
      onRankingsChanged();
    } catch (err) {
      console.error('Add to ranking failed:', err);
    }
  };

  const renderSongCard = (req, isNew) => {
    const score = crowdScoreMap[req.id];
    const isRanked = rankedRequestIds.has(req.id);
    const myPosition = rankings.find(r => r.requestId === req.id)?.position;

    return (
      <div key={req.id} className={`flex items-center gap-3 p-3 rounded-lg border ${
        isNew ? 'border-purple-200 dark:border-purple-700 bg-purple-50/50 dark:bg-purple-900/10' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
      }`}>
        {/* Album art */}
        {req.song && req.song.albumArtUrl ? (
          <img src={req.song.albumArtUrl} alt="" className="w-10 h-10 rounded flex-shrink-0 object-cover" />
        ) : (
          <div className="w-10 h-10 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
            <Music className="w-5 h-5 text-gray-400" />
          </div>
        )}

        {/* Song info */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{req.song.title}</p>
          <p className="text-xs text-gray-500">
            {req.song.artist}
            {score && (
              <span className="ml-2">
                Crowd #{score.rank} &middot; {score.rankerCount} ranked
              </span>
            )}
          </p>
          {isNew && (
            <p className="text-xs text-purple-500 mt-0.5">
              Added {formatTimeAgo(req.createdAt)}
            </p>
          )}
        </div>

        {/* Action button */}
        {isRanked ? (
          <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded text-xs font-medium flex items-center gap-1">
            <Check className="w-3 h-3" /> In my #{myPosition}
          </span>
        ) : canAddMore ? (
          <button
            onClick={() => addToRanking(req.id)}
            className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded text-xs font-medium hover:bg-purple-200 dark:hover:bg-purple-900/50 flex items-center gap-1 flex-shrink-0"
          >
            <Plus className="w-3 h-3" /> Add
          </button>
        ) : (
          <span className="text-xs text-gray-400 flex-shrink-0">Rankings full</span>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header with filter */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          Browse Queue
        </h3>
        <div className="relative">
          <button
            onClick={() => setShowFilterMenu(!showFilterMenu)}
            className="flex items-center gap-1 px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <Filter className="w-3 h-3" /> Sort
          </button>
          {showFilterMenu && (
            <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 py-1 min-w-36">
              {[
                { value: 'crowd-rank', label: 'Crowd Rank' },
                { value: 'newest', label: 'Newest First' },
                { value: 'ranker-count', label: 'Most Ranked' },
              ].map(option => (
                <button
                  key={option.value}
                  onClick={() => { setSortBy(option.value); setShowFilterMenu(false); }}
                  className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${
                    sortBy === option.value ? 'text-purple-600 dark:text-purple-400 font-medium' : ''
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Unseen section */}
      {sortedUnseen.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-purple-600 dark:text-purple-400 mb-2 flex items-center gap-1">
            <EyeOff className="w-4 h-4" /> New Since You Last Checked ({sortedUnseen.length})
          </h4>
          <div className="space-y-1">
            {sortedUnseen.map(req => renderSongCard(req, true))}
          </div>
        </div>
      )}

      {/* Seen section */}
      {sortedSeen.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-1">
            <Eye className="w-4 h-4" /> Previously Seen ({sortedSeen.length})
          </h4>
          <div className="space-y-1">
            {sortedSeen.map(req => renderSongCard(req, false))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {rankableRequests.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Music className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No songs in the queue yet</p>
          <p className="text-sm mt-1">Be the first to request a song!</p>
        </div>
      )}
    </div>
  );
}

function formatTimeAgo(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr + (dateStr.includes('Z') ? '' : 'Z'));
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
