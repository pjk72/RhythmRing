import React, { useState, useEffect, useCallback } from 'react';
import { Track, SavedRingtone } from './types';
import {
  searchITunesSongs,
  getFallbackSongs,
  createTrackFromAudioFile,
} from './utils/audioUtils';
import { Header } from './components/Header';
import { SearchBar } from './components/SearchBar';
import { SongList } from './components/SongList';
import { RingtonesLibrary } from './components/RingtonesLibrary';
import { AudioFileUploader } from './components/AudioFileUploader';
import { Upload, Sparkles, Music, FileAudio } from 'lucide-react';

export default function App() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isWindowDragging, setIsWindowDragging] = useState<boolean>(false);

  // Ringtones Library State
  const [ringtones, setRingtones] = useState<SavedRingtone[]>(() => {
    try {
      const saved = localStorage.getItem('custom_mp3_ringtones');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [activeRingtoneId, setActiveRingtoneId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('active_ringtone_id') || null;
    } catch {
      return null;
    }
  });

  const [isLibraryOpen, setIsLibraryOpen] = useState<boolean>(false);

  // Initial load search for current global charts leader
  useEffect(() => {
    handleSearch('Sabrina Carpenter');
  }, []);

  // Save ringtones to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('custom_mp3_ringtones', JSON.stringify(ringtones));
    } catch (e) {
      console.warn('Impossibile salvare in localStorage:', e);
    }
  }, [ringtones]);

  useEffect(() => {
    try {
      if (activeRingtoneId) {
        localStorage.setItem('active_ringtone_id', activeRingtoneId);
      }
    } catch (e) {}
  }, [activeRingtoneId]);

  const handleSearch = async (searchTerm: string) => {
    setIsLoading(true);
    try {
      const results = await searchITunesSongs(searchTerm);
      const songResults = results.length > 0 ? results : getFallbackSongs(searchTerm);
      setTracks(songResults);
    } catch (error) {
      console.error('Errore ricerca:', error);
      const fallback = getFallbackSongs(searchTerm);
      setTracks(fallback);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTrackUploaded = (newTrack: Track) => {
    setTracks((prev) => [newTrack, ...prev.filter((t) => t.trackId !== newTrack.trackId)]);
    // Smooth scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveRingtone = (newRingtone: SavedRingtone) => {
    setRingtones((prev) => [newRingtone, ...prev]);
    if (!activeRingtoneId) {
      setActiveRingtoneId(newRingtone.id);
    }
  };

  const handleDeleteRingtone = (id: string) => {
    setRingtones((prev) => prev.filter((r) => r.id !== id));
    if (activeRingtoneId === id) {
      setActiveRingtoneId(null);
    }
  };

  // Global window Drag & Drop handler
  useEffect(() => {
    let dragCounter = 0;

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCounter++;
      if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
        setIsWindowDragging(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter <= 0) {
        setIsWindowDragging(false);
        dragCounter = 0;
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      setIsWindowDragging(false);
      dragCounter = 0;

      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        for (let i = 0; i < e.dataTransfer.files.length; i++) {
          const file = e.dataTransfer.files[i];
          const isAudio =
            file.type.startsWith('audio/') ||
            /\.(mp3|wav|ogg|m4a|aac|flac|webm|opus|wma|aiff)$/i.test(file.name);

          if (isAudio) {
            try {
              const track = await createTrackFromAudioFile(file);
              handleTrackUploaded(track);
            } catch (err) {
              console.error('Errore drop audio:', err);
            }
          }
        }
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white relative">
      {/* Global Drag & Drop Overlay */}
      {isWindowDragging && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md border-4 border-dashed border-pink-500 flex flex-col items-center justify-center p-6 pointer-events-none animate-in fade-in duration-200">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-pink-500 via-rose-500 to-amber-500 flex items-center justify-center text-white shadow-2xl mb-4 animate-bounce">
            <Upload className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black text-white">Rilascia il File Audio qui</h2>
          <p className="text-slate-300 text-sm mt-1">
            Verrà importato istantaneamente nello Studio per taglio e montaggio
          </p>
        </div>
      )}

      {/* Top Header */}
      <Header
        ringtonesCount={ringtones.length}
        onOpenLibrary={() => setIsLibraryOpen(true)}
        onTrackUploaded={handleTrackUploaded}
      />

      {/* Main Workspace Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Dedicated Local Audio File Uploader */}
        <AudioFileUploader onTrackUploaded={handleTrackUploaded} />

        {/* Search Bar section */}
        <SearchBar
          onSearch={handleSearch}
          isLoading={isLoading}
          totalResults={tracks.length}
        />

        {/* Unified Songs List: Each card contains its own Analysis & Trimmer Studio */}
        <SongList
          tracks={tracks}
          onSaveRingtone={handleSaveRingtone}
          isLoading={isLoading}
        />
      </main>

      {/* Saved Ringtones Drawer */}
      <RingtonesLibrary
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        ringtones={ringtones}
        onDeleteRingtone={handleDeleteRingtone}
        activeRingtoneId={activeRingtoneId}
        onSetActiveRingtone={(id) => setActiveRingtoneId(id)}
      />

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/90 py-6 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© {new Date().getFullYear()} RhythmRing MP3 — Crea suonerie personalizzate dai tuoi brani preferiti o dai tuoi file.</p>
          <p className="text-slate-600">Alimentato da iTunes Search API & Web Audio Engine</p>
        </div>
      </footer>
    </div>
  );
}

