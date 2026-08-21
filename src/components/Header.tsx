import React from 'react';
import { Music, Bell, Sparkles, Disc, Upload } from 'lucide-react';
import { Track } from '../types';
import { AudioFileUploader } from './AudioFileUploader';

interface HeaderProps {
  ringtonesCount: number;
  onOpenLibrary: () => void;
  selectedTrackName?: string;
  onTrackUploaded?: (track: Track) => void;
}

export const Header: React.FC<HeaderProps> = ({
  ringtonesCount,
  onOpenLibrary,
  selectedTrackName,
  onTrackUploaded,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 text-slate-100 px-4 sm:px-8 py-3.5 shadow-lg">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Brand title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
            <Disc className="w-6 h-6 animate-spin-slow" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              RhythmRing MP3
            </h1>
            <p className="text-xs text-slate-400 font-medium">
              Create custom ringtones from your favorite tracks or audio files
            </p>
          </div>
        </div>

        {/* Action buttons: Upload Local Audio & Saved Ringtones */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
          {onTrackUploaded && (
            <AudioFileUploader
              compact
              onTrackUploaded={onTrackUploaded}
            />
          )}

          <button
            id="open-library-btn"
            onClick={onOpenLibrary}
            className="relative flex items-center gap-2 px-3.5 sm:px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl font-medium text-xs sm:text-sm transition-all shadow-md shadow-indigo-600/20 hover:shadow-indigo-500/30 active:scale-[0.98]"
          >
            <Bell className="w-4 h-4 text-indigo-200" />
            <span>My Ringtones</span>
            {ringtonesCount > 0 && (
              <span className="ml-1 px-2 py-0.5 bg-rose-500 text-white text-xs font-bold rounded-full animate-pulse">
                {ringtonesCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

