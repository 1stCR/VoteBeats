import React, { useState, useEffect } from 'react';
import { Lock, RefreshCw, BarChart3, Columns, List, Users, Clock, Gem } from 'lucide-react';
import { api } from '../config/api';
import HiddenGems from './HiddenGems';

export default function RankedQueueView({ eventId, onRequestAction }) {
  const [dualScores, setDualScores] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState('unified'); // 'side-by-side' or 'unified'
  const [error, setError] = useState('');

  // Auto-detect view mode based on screen width
  useEffect(() => {
    const checkWidth = () => {
      setViewMode(window.innerWidth >= 1024 ? 'side-by-side' : 'unified');
    };
    checkWidth();
    window.addEventListener('resize', checkWidth);
    return () => window.removeEventListener('resize', checkWidth);
  }, []);

  // Fetch dual scores
  const fetchScores = async () => {
    try {
      const data = await api.getDualRankingScores(eventId);
      setDualScores(data);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load ranking scores');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScores();
    const interval = setInterval(fetchScores, 5000); // poll every 5s for DJ
    return () => clearInterval(interval);
  }, [eventId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await api.refreshRankings(eventId);
      await fetchScores();
    } catch (err) {
      setError(err.message || 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  };

  const handleLockNext = async (requestId) => {
    try {
      await api.updateRequestOrder(eventId, requestId, 1);
      if (onRequestAction) onRequestAction();
      fetchScores();
    } catch (err) {
      console.error('Lock failed:', err);
    }
  };

  const handlePlayNext = async (requestId) => {
    try {
      await api.updateRequestOrder(eventId, requestId, 1);
      await api.updateRequestStatus(eventId, requestId, 'nowPlaying');
      if (onRequestAction) onRequestAction();
      fetchScores();
    } catch (err) {
      console.error('Play next failed:', err);
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading ranking scores...</div>;
  }

  if (error) {
    return <div className="text-center py-8 text-red-500">{error}</div>;
  }

  if (!dualScores) return null;

  const { primaryMode, activated, totalParticipants, minParticipantsForActivation, lastRefresh, consensusScores, discoveryScores, hiddenGems } = dualScores;

  const formatPercent = (rate) => Math.round((rate || 0) * 100) + '%';

  const timeSinceRefresh = lastRefresh ? Math.round((Date.now() - new Date(lastRefresh + 'Z').getTime()) / 1000) : null;

  const renderScoreCard = (score, showGemBadge = false) => (
    <div key={score.requestId} className={`flex items-center gap-3 p-3 rounded-lg border ${
      score.isHiddenGem ? 'border-amber-300 dark:border-amber-600 bg-amber-50/50 dark:bg-amber-900/10' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
    }`}>
      <span className="w-8 text-center font-bold text-lg text-gray-400">
        {score.rank || '-'}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{score.song.title}</p>
        <p className="text-xs text-gray-500 truncate">{score.song.artist}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {formatPercent(score.winRate)} win rate &middot; {score.rankerCount} ranked
          {score.copeland !== undefined && ` \u00b7 Copeland: ${score.copeland > 0 ? '+' : ''}${score.copeland}`}
        </p>
      </div>
      {showGemBadge && score.isHiddenGem && (
        <span className="text-amber-500 flex-shrink-0" title="Hidden Gem">
          <Gem className="w-4 h-4" />
        </span>
      )}
      {score.manualOrder && (
        <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 text-xs rounded flex-shrink-0">
          <Lock className="w-3 h-3 inline mr-0.5" />#{score.manualOrder}
        </span>
      )}
      <button
        onClick={() => handleLockNext(score.requestId)}
        className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-blue-500 flex-shrink-0"
        title="Lock to position"
      >
        <Lock className="w-4 h-4" />
      </button>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Control Panel */}
      <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
              Queue Mode: Ranked-Choice
            </span>
            <span className="ml-2 px-2 py-0.5 bg-purple-200 dark:bg-purple-800 text-purple-700 dark:text-purple-300 rounded text-xs">
              {primaryMode === 'consensus' ? 'Consensus' : 'Discovery'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Users className="w-3 h-3" /> {totalParticipants} ranking
            </span>
            {timeSinceRefresh !== null && (
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Clock className="w-3 h-3" /> {timeSinceRefresh}s ago
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1"
          >
            <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} /> Refresh Now
          </button>
          <button
            onClick={() => setViewMode(viewMode === 'side-by-side' ? 'unified' : 'side-by-side')}
            className="px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-1"
          >
            {viewMode === 'side-by-side' ? <List className="w-3 h-3" /> : <Columns className="w-3 h-3" />}
            {viewMode === 'side-by-side' ? 'Unified' : 'Side-by-Side'}
          </button>
        </div>

        {!activated && (
          <div className="mt-2 text-xs text-amber-600 dark:text-amber-400">
            Waiting for {minParticipantsForActivation} participants to submit rankings ({totalParticipants} so far). Queue uses request time until then.
          </div>
        )}
      </div>

      {/* Queue Views */}
      {viewMode === 'side-by-side' ? (
        <div className="grid grid-cols-2 gap-4">
          {/* Consensus Column */}
          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
              <BarChart3 className="w-4 h-4" />
              {primaryMode === 'consensus' ? 'Consensus (Auto-Queue)' : 'Consensus'}
            </h4>
            <div className="space-y-1">
              {consensusScores.map(s => renderScoreCard(s))}
            </div>
          </div>

          {/* Discovery Column */}
          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
              <Gem className="w-4 h-4 text-amber-500" />
              {primaryMode === 'discovery' ? 'Discovery (Auto-Queue)' : 'Discovery (Hidden Gems)'}
            </h4>
            <div className="space-y-1">
              {discoveryScores.map(s => renderScoreCard(s, true))}
            </div>
          </div>
        </div>
      ) : (
        <div>
          {/* Unified: Primary mode list */}
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
            <BarChart3 className="w-4 h-4" />
            Auto-Sorted Queue ({primaryMode === 'consensus' ? 'Consensus' : 'Discovery'} Mode)
          </h4>
          <div className="space-y-1">
            {(primaryMode === 'consensus' ? consensusScores : discoveryScores).map(s => {
              const otherScore = primaryMode === 'consensus'
                ? discoveryScores.find(d => d.requestId === s.requestId)
                : consensusScores.find(c => c.requestId === s.requestId);
              return (
                <div key={s.requestId} className={`flex items-center gap-3 p-3 rounded-lg border ${
                  s.isHiddenGem ? 'border-amber-300 dark:border-amber-600 bg-amber-50/50 dark:bg-amber-900/10' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                }`}>
                  <span className="w-8 text-center font-bold text-lg text-gray-400">
                    {s.rank || '-'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{s.song.title}</p>
                    <p className="text-xs text-gray-500 truncate">{s.song.artist}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {primaryMode === 'consensus' ? 'C' : 'D'}: {formatPercent(s.winRate)}
                      {otherScore && ` \u00b7 ${primaryMode === 'consensus' ? 'D' : 'C'}: ${formatPercent(otherScore.winRate)}`}
                      &middot; {s.rankerCount} ranked
                    </p>
                  </div>
                  {s.isHiddenGem && (
                    <span className="text-amber-500 flex-shrink-0" title="Hidden Gem">
                      <Gem className="w-4 h-4" />
                    </span>
                  )}
                  {s.manualOrder && (
                    <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 text-xs rounded flex-shrink-0">
                      <Lock className="w-3 h-3 inline mr-0.5" />#{s.manualOrder}
                    </span>
                  )}
                  <button
                    onClick={() => handleLockNext(s.requestId)}
                    className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-blue-500 flex-shrink-0"
                    title="Lock to position"
                  >
                    <Lock className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Hidden Gems Section */}
          {hiddenGems.length > 0 && (
            <div className="mt-6">
              <HiddenGems
                gems={hiddenGems}
                onPlayNext={handlePlayNext}
                onLockToPosition={handleLockNext}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
