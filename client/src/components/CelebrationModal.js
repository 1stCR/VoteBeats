import React from 'react';
import { Music, X } from 'lucide-react';

export default function CelebrationModal({ song, rankerCount, onDismiss }) {
  if (!song) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onDismiss}>
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl transform animate-bounce-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onDismiss}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Celebration header */}
        <div className="text-4xl mb-4">
          <span role="img" aria-label="celebration">&#127881;</span>
        </div>

        <h2 className="text-xl font-bold mb-2">
          YOUR #1 PICK IS PLAYING!
        </h2>

        {/* Song info */}
        <div className="flex items-center justify-center gap-3 my-4 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
          {song.albumArtUrl ? (
            <img src={song.albumArtUrl} alt="" className="w-12 h-12 rounded" />
          ) : (
            <div className="w-12 h-12 rounded bg-purple-200 dark:bg-purple-800 flex items-center justify-center">
              <Music className="w-6 h-6 text-purple-500" />
            </div>
          )}
          <div className="text-left">
            <p className="font-semibold">{song.title}</p>
            <p className="text-sm text-gray-500">{song.artist}</p>
          </div>
        </div>

        {/* Social proof */}
        {rankerCount > 1 && (
          <p className="text-sm text-gray-500 mb-4">
            You and {rankerCount - 1} other{rankerCount - 1 !== 1 ? 's' : ''} made this happen!
          </p>
        )}

        {/* Dismiss button */}
        <button
          onClick={onDismiss}
          className="mt-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
        >
          Awesome!
        </button>
      </div>
    </div>
  );
}
