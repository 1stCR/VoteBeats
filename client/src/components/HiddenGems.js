import React from 'react';
import { Gem, Play, Lock, Music } from 'lucide-react';

export default function HiddenGems({ gems, onPlayNext, onLockToPosition }) {
  if (!gems || gems.length === 0) return null;

  const formatPercent = (rate) => Math.round((rate || 0) * 100) + '%';

  return (
    <div>
      <h4 className="text-sm font-semibold mb-2 flex items-center gap-1 text-amber-600 dark:text-amber-400">
        <Gem className="w-4 h-4" /> Hidden Gems
        <span className="font-normal text-gray-500 ml-1">High in Discovery, low in Consensus</span>
      </h4>
      <div className="space-y-2">
        {gems.map(gem => (
          <div key={gem.requestId} className="p-3 rounded-lg border border-amber-200 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-900/10">
            <div className="flex items-center gap-3">
              {gem.song && gem.song.albumArtUrl ? (
                <img src={gem.song.albumArtUrl} alt="" className="w-10 h-10 rounded flex-shrink-0 object-cover" />
              ) : (
                <div className="w-10 h-10 rounded bg-amber-200 dark:bg-amber-800 flex items-center justify-center flex-shrink-0">
                  <Music className="w-5 h-5 text-amber-500" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{gem.song ? gem.song.title : gem.title}</p>
                <p className="text-xs text-gray-500">{gem.song ? gem.song.artist : gem.artist}</p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                  Discovery #{gem.discoveryRank} ({formatPercent(gem.discoveryWinRate)})
                  vs Consensus #{gem.consensusRank} ({formatPercent(gem.consensusWinRate)})
                  &middot; {gem.rankerCount} ranked
                </p>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button
                  onClick={() => onPlayNext(gem.requestId)}
                  className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded text-xs font-medium hover:bg-green-200 dark:hover:bg-green-900/50 flex items-center gap-1"
                  title="Play this song next"
                >
                  <Play className="w-3 h-3" /> Play Next
                </button>
                <button
                  onClick={() => onLockToPosition(gem.requestId)}
                  className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded text-xs font-medium hover:bg-blue-200 dark:hover:bg-blue-900/50 flex items-center gap-1"
                  title="Lock to queue position"
                >
                  <Lock className="w-3 h-3" /> Lock
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
