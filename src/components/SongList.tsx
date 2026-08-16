import React from 'react';
import { Track, SavedRingtone } from '../types';
import { SongCard } from './SongCard';
import { Music } from 'lucide-react';

interface SongListProps {
  tracks: Track[];
  onSaveRingtone: (ringtone: SavedRingtone) => void;
  isLoading: boolean;
}

export const SongList: React.FC<SongListProps> = ({
  tracks,
  onSaveRingtone,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-12 flex flex-col items-center justify-center min-h-[360px]">
        <div className="w-12 h-12 rounded-full border-4 border-indigo-500/30 border-t-indigo-500 animate-spin mb-4" />
        <p className="text-slate-200 font-semibold text-base">Ricerca brani e album in corso...</p>
        <p className="text-slate-400 text-xs mt-1">
          Analisi delle frequenze e caricamento timeline audio
        </p>
      </div>
    );
  }

  if (tracks.length === 0) {
    return (
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center min-h-[320px]">
        <div className="w-16 h-16 rounded-2xl bg-slate-800/80 flex items-center justify-center text-slate-400 mb-4 shadow-lg">
          <Music className="w-8 h-8" />
        </div>
        <h3 className="text-slate-100 font-bold text-lg">Nessun brano trovato</h3>
        <p className="text-slate-400 text-sm mt-1.5 max-w-md">
          Prova a cercare con un altro nome artista o titolo brano tramite la barra di ricerca in alto.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      {tracks.map((track, index) => (
        <SongCard
          key={track.trackId}
          track={track}
          index={index}
          onSaveRingtone={onSaveRingtone}
          isInitiallyExpanded={index === 0} // First card expanded by default, others collapsible
        />
      ))}
    </div>
  );
};
