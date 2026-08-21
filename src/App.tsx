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
import { Upload, Sparkles, Music, FileAudio, CheckCircle2, AlertCircle, Loader2, X } from 'lucide-react';

interface ToastState {
  type: 'loading' | 'success' | 'error';
  message: string;
}

export default function App() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isWindowDragging, setIsWindowDragging] = useState<boolean>(false);
  const [toast, setToast] = useState<ToastState | null>(null);

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
      console.warn('Unable to save to localStorage:', e);
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
      console.error('Search error:', error);
      const fallback = getFallbackSongs(searchTerm);
      setTracks(fallback);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTrackUploaded = useCallback((newTrack: Track) => {
    setTracks((prev) => [newTrack, ...prev.filter((t) => t.trackId !== newTrack.trackId)]);
    // Smooth scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

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

  // Helper to check if drag event involves files
  const isFileDragEvent = (e: DragEvent) => {
    if (!e.dataTransfer) return false;
    const types = Array.from(e.dataTransfer.types || []);
    return types.includes('Files') || types.includes('public.file-url') || types.includes('application/x-moz-file');
  };

  // Global window Drag & Drop handler
  useEffect(() => {
    let dragCounter = 0;

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      if (isFileDragEvent(e)) {
        dragCounter++;
        setIsWindowDragging(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounter--;
      // Check if mouse actually left the browser window viewport
      if (dragCounter <= 0 || e.clientX === 0 || e.clientY === 0) {
        setIsWindowDragging(false);
        dragCounter = 0;
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
    };

    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      setIsWindowDragging(false);
      dragCounter = 0;

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        let importedCount = 0;

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const isAudio =
            file.type.startsWith('audio/') ||
            file.type.includes('audio') ||
            /\.(mp3|wav|ogg|m4a|aac|flac|webm|opus|wma|aiff|alac|caf|m4r|mid|midi|mp4)$/i.test(file.name);

          if (isAudio) {
            setToast({
              type: 'loading',
              message: `Processing "${file.name}"...`,
            });

            try {
              const track = await createTrackFromAudioFile(file);
              handleTrackUploaded(track);
              importedCount++;
              setToast({
                type: 'success',
                message: `"${file.name}" successfully loaded into Studio!`,
              });
              setTimeout(() => setToast(null), 4000);
            } catch (err: any) {
              console.error('Audio drop error:', err);
              setToast({
                type: 'error',
                message: err.message || `Unable to open "${file.name}"`,
              });
              setTimeout(() => setToast(null), 5000);
            }
          } else {
            setToast({
              type: 'error',
              message: `"${file.name}" is not a valid audio format. Please drop MP3, WAV, M4A, AAC, OGG, or FLAC files.`,
            });
            setTimeout(() => setToast(null), 5000);
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
  }, [handleTrackUploaded]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white relative">
      {/* Toast Notification Banner */}
      {toast && (
        <div className="fixed top-20 right-4 z-50 animate-in fade-in slide-in-from-top-4 duration-300 max-w-md">
          <div
            className={`flex items-center gap-3 p-3.5 sm:p-4 rounded-2xl shadow-2xl backdrop-blur-xl border ${
              toast.type === 'loading'
                ? 'bg-slate-900/95 border-indigo-500/50 text-indigo-200'
                : toast.type === 'success'
                ? 'bg-emerald-950/95 border-emerald-500/50 text-emerald-100'
                : 'bg-rose-950/95 border-rose-500/50 text-rose-100'
            }`}
          >
            {toast.type === 'loading' && <Loader2 className="w-5 h-5 animate-spin text-indigo-400 shrink-0" />}
            {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
            {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />}
            <p className="text-xs sm:text-sm font-medium flex-1">{toast.message}</p>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="text-slate-400 hover:text-white p-1 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Global Drag & Drop Overlay */}
      {isWindowDragging && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
          }}
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md border-4 border-dashed border-pink-500 flex flex-col items-center justify-center p-6 animate-in fade-in duration-200 cursor-copy"
        >
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-pink-500 via-rose-500 to-amber-500 flex items-center justify-center text-white shadow-2xl mb-4 animate-bounce">
            <Upload className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black text-white">Drop Audio File Here</h2>
          <p className="text-slate-300 text-sm mt-1 text-center max-w-md">
            It will be instantly imported into the Studio for rhythm analysis, trimming, and ringtone creation
          </p>
          <div className="mt-4 flex items-center gap-2 text-xs text-pink-300/80 bg-pink-950/60 px-3 py-1.5 rounded-full border border-pink-500/30 font-medium">
            <span>Supports MP3, WAV, M4A, AAC, OGG, FLAC, and other audio formats</span>
          </div>
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
          <p>© {new Date().getFullYear()} RhythmRing MP3 — Create custom ringtones from your favorite tracks or local audio files.</p>
          <p className="text-slate-600">Powered by iTunes Search API & Web Audio Engine</p>
        </div>
      </footer>
    </div>
  );
}

