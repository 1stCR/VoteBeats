import React, { useState, useCallback } from 'react';
import { GripVertical, Plus, X, Trophy, TrendingUp, TrendingDown, Music, ChevronUp, ChevronDown } from 'lucide-react';
import { api } from '../config/api';

export default function MyRankings({ eventId, attendeeId, rankings, crowdScores, rankingDepth, onRankingsChanged, onSwitchTab }) {
  const [draggingIndex, setDraggingIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [removing, setRemoving] = useState(null);

  const slotsUsed = rankings.length;
  const slotsRemaining = rankingDepth - slotsUsed;

  // Get crowd rank for a request
  const getCrowdRank = useCallback((requestId) => {
    if (!crowdScores || !crowdScores.scores) return null;
    const score = crowdScores.scores.find(s => s.requestId === requestId);
    return score ? score.rank : null;
  }, [crowdScores]);

  // Drag and drop handlers
  const handleDragStart = (e, index) => {
    setDraggingIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = async (e, dropIndex) => {
    e.preventDefault();
    setDragOverIndex(null);
    const fromIndex = draggingIndex;
    setDraggingIndex(null);

    if (fromIndex === null || fromIndex === dropIndex) return;

    const newOrder = [...rankings];
    const [moved] = newOrder.splice(fromIndex, 1);
    newOrder.splice(dropIndex, 0, moved);

    try {
      await api.reorderRankings(eventId, attendeeId, newOrder.map(r => r.requestId));
      onRankingsChanged();
    } catch (err) {
      console.error('Reorder failed:', err);
    }
  };

  const handleDragEnd = () => {
    setDraggingIndex(null);
    setDragOverIndex(null);
  };

  // Move up/down for mobile
  const moveItem = async (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= rankings.length) return;

    const newOrder = [...rankings];
    const [moved] = newOrder.splice(index, 1);
    newOrder.splice(newIndex, 0, moved);

    try {
      await api.reorderRankings(eventId, attendeeId, newOrder.map(r => r.requestId));
      onRankingsChanged();
    } catch (err) {
      console.error('Move failed:', err);
    }
  };

  const removeFromRanking = async (requestId) => {
    setRemoving(requestId);
    try {
      await api.removeFromRanking(eventId, requestId, attendeeId);
      onRankingsChanged();
    } catch (err) {
      console.error('Remove failed:', err);
    } finally {
      setRemoving(null);
    }
  };

  // Get crowd rank indicator
  const getRankIndicator = (requestId, myPosition) => {
    const crowdRank = getCrowdRank(requestId);
    if (!crowdRank) return null;

    if (crowdRank === 1) {
      return <span className="inline-flex items-center text-yellow-500 text-xs ml-2"><Trophy className="w-3 h-3 mr-0.5" /> #1</span>;
    }
    if (crowdRank < myPosition) {
      return <span className="inline-flex items-center text-green-500 text-xs ml-2"><TrendingUp className="w-3 h-3 mr-0.5" /> #{crowdRank}</span>;
    }
    if (crowdRank > myPosition + 3) {
      return <span className="inline-flex items-center text-red-400 text-xs ml-2"><TrendingDown className="w-3 h-3 mr-0.5" /> #{crowdRank}</span>;
    }
    return <span className="text-gray-400 text-xs ml-2">#{crowdRank}</span>;
  };

  // Trending suggestions: top crowd songs not in user's ranking
  const trendingSuggestions = (() => {
    if (!crowdScores || !crowdScores.scores) return [];
    const rankedIds = new Set(rankings.map(r => r.requestId));
    return crowdScores.scores
      .filter(s => !rankedIds.has(s.requestId) && s.status !== 'played' && s.status !== 'rejected')
      .slice(0, 5);
  })();

  const addToRanking = async (requestId) => {
    try {
      await api.addToRanking(eventId, attendeeId, requestId);
      onRankingsChanged();
    } catch (err) {
      console.error('Add to ranking failed:', err);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Music className="w-5 h-5" />
          My Top {rankingDepth}
        </h3>
        <span className="text-sm text-gray-500">
          {slotsUsed} of {rankingDepth} slots used
        </span>
      </div>

      {/* Ranking threshold message */}
      {crowdScores && !crowdScores.activated && (
        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-3 text-sm text-blue-700 dark:text-blue-300">
          Ranked mode activates when {crowdScores.minParticipantsForActivation} people submit rankings.
          Currently {crowdScores.totalParticipants} participant{crowdScores.totalParticipants !== 1 ? 's' : ''}.
          Build your list now!
        </div>
      )}

      {/* Rankings list */}
      {rankings.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Music className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No songs ranked yet</p>
          <p className="text-sm mt-1">Browse the queue and add your favorites!</p>
          <button
            onClick={() => onSwitchTab('browse')}
            className="mt-3 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
          >
            <Plus className="w-4 h-4 inline mr-1" /> Browse Queue
          </button>
        </div>
      ) : (
        <div className="space-y-1">
          {rankings.map((item, index) => (
            <div
              key={item.requestId}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={`flex items-center gap-2 p-3 rounded-lg border transition-all cursor-grab active:cursor-grabbing ${
                draggingIndex === index ? 'opacity-50 border-purple-400' : ''
              } ${
                dragOverIndex === index ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
              }`}
            >
              {/* Drag handle */}
              <GripVertical className="w-4 h-4 text-gray-400 flex-shrink-0" />

              {/* Position number */}
              <span className="w-6 text-center font-bold text-purple-600 dark:text-purple-400 text-sm flex-shrink-0">
                {index + 1}
              </span>

              {/* Album art */}
              {item.song && item.song.albumArtUrl ? (
                <img src={item.song.albumArtUrl} alt="" className="w-10 h-10 rounded flex-shrink-0 object-cover" />
              ) : (
                <div className="w-10 h-10 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                  <Music className="w-5 h-5 text-gray-400" />
                </div>
              )}

              {/* Song info */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{item.song ? item.song.title : 'Unknown'}</p>
                <p className="text-xs text-gray-500 truncate">
                  {item.song ? item.song.artist : 'Unknown'}
                  {getRankIndicator(item.requestId, index + 1)}
                </p>
              </div>

              {/* Move up/down buttons (mobile) */}
              <div className="flex flex-col gap-0.5 sm:hidden flex-shrink-0">
                <button
                  onClick={() => moveItem(index, -1)}
                  disabled={index === 0}
                  className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  onClick={() => moveItem(index, 1)}
                  disabled={index === rankings.length - 1}
                  className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>

              {/* Remove button */}
              <button
                onClick={() => removeFromRanking(item.requestId)}
                disabled={removing === item.requestId}
                className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add song button */}
      {slotsRemaining > 0 && rankings.length > 0 && (
        <button
          onClick={() => onSwitchTab('browse')}
          className="w-full py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 hover:border-purple-400 hover:text-purple-600 transition-colors text-sm flex items-center justify-center gap-1"
        >
          <Plus className="w-4 h-4" /> Add Song to My Rankings ({slotsRemaining} slot{slotsRemaining !== 1 ? 's' : ''} open)
        </button>
      )}

      {/* Trending suggestions */}
      {trendingSuggestions.length > 0 && slotsRemaining > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-1">
            <TrendingUp className="w-4 h-4" /> Trending - Add to your rankings?
          </h4>
          <div className="space-y-1">
            {trendingSuggestions.map(song => (
              <div key={song.requestId} className="flex items-center gap-3 p-2 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{song.song.title}</p>
                  <p className="text-xs text-gray-500">
                    Crowd #{song.rank} &middot; {song.rankerCount} ranked
                  </p>
                </div>
                <button
                  onClick={() => addToRanking(song.requestId)}
                  className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded text-xs font-medium hover:bg-purple-200 dark:hover:bg-purple-900/50 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
