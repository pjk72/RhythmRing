import React, { useState, useEffect, useRef } from 'react';
import { SavedRingtone } from '../types';
import {
  Bell,
  X,
  Play,
  Pause,
  Download,
  Trash2,
  PhoneCall,
  Smartphone,
  CheckCircle2,
  Sparkles,
  Music,
  Loader2,
  Share2,
  Check,
} from 'lucide-react';
import {
  bufferToAudioBlob,
  createSynthAudioBuffer,
  downloadBlobAsFile,
} from '../utils/audioUtils';
import { globalAudioManager } from '../utils/audioPlaybackManager';
import { CallSimulatorModal } from './CallSimulatorModal';

interface RingtonesLibraryProps {
  isOpen: boolean;
  onClose: () => void;
  ringtones: SavedRingtone[];
  onDeleteRingtone: (id: string) => void;
  activeRingtoneId: string | null;
  onSetActiveRingtone: (id: string) => void;
}

export const RingtonesLibrary: React.FC<RingtonesLibraryProps> = ({
  isOpen,
  onClose,
  ringtones,
  onDeleteRingtone,
  activeRingtoneId,
  onSetActiveRingtone,
}) => {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [shareFeedback, setShareFeedback] = useState<{ id: string; message: string } | null>(null);
  const [simulatorRingtone, setSimulatorRingtone] = useState<SavedRingtone | null>(null);

  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const activeBlobUrlRef = useRef<string | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const stopCurrentAudio = () => {
    if (activeAudioRef.current) {
      try {
        activeAudioRef.current.pause();
        activeAudioRef.current.currentTime = 0;
      } catch (e) {}
      activeAudioRef.current = null;
    }
    if (activeBlobUrlRef.current) {
      try {
        URL.revokeObjectURL(activeBlobUrlRef.current);
      } catch (e) {}
      activeBlobUrlRef.current = null;
    }
    setPlayingId(null);
    setLoadingId(null);
    globalAudioManager.stop('ringtone-library');
  };

  useEffect(() => {
    const handleGlobalStop = () => {
      stopCurrentAudio();
    };
    window.addEventListener('global-audio-stop', handleGlobalStop);
    return () => {
      window.removeEventListener('global-audio-stop', handleGlobalStop);
      stopCurrentAudio();
    };
  }, []);

  if (!isOpen) return null;

  const togglePlayRingtone = async (ringtone: SavedRingtone) => {
    if (playingId === ringtone.id || loadingId === ringtone.id) {
      stopCurrentAudio();
      return;
    }

    stopCurrentAudio();
    setLoadingId(ringtone.id);

    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext ||
          (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      let audioBuffer: AudioBuffer | null = null;

      if (ringtone.previewUrl) {
        try {
          const resp = await fetch(ringtone.previewUrl);
          if (resp.ok) {
            const arrayBuf = await resp.arrayBuffer();
            audioBuffer = await ctx.decodeAudioData(arrayBuf);
          }
        } catch (fetchErr) {
          console.warn('Impossibile caricare audio dal previewUrl, uso sintetizzatore:', fetchErr);
        }
      }

      if (!audioBuffer) {
        audioBuffer = createSynthAudioBuffer(ctx, ringtone.bpm || 120, 30);
      }

      const blob = bufferToAudioBlob(
        audioBuffer,
        ringtone.startTime,
        ringtone.endTime,
        ringtone.fadeInSec || 0,
        ringtone.fadeOutSec || 0
      );
      const url = URL.createObjectURL(blob);
      activeBlobUrlRef.current = url;

      const audio = new Audio(url);
      activeAudioRef.current = audio;

      audio.onended = () => {
        stopCurrentAudio();
      };

      audio.onerror = (e) => {
        console.error('Errore riproduzione elemento Audio:', e);
        stopCurrentAudio();
      };

      globalAudioManager.play('ringtone-library', () => {
        stopCurrentAudio();
      });

      await audio.play();
      setLoadingId(null);
      setPlayingId(ringtone.id);
    } catch (err) {
      console.error('Errore durante la riproduzione della suoneria:', err);
      stopCurrentAudio();
    }
  };

  const handleDownload = async (ringtone: SavedRingtone) => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext ||
          (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      let buf: AudioBuffer | null = null;

      if (ringtone.previewUrl) {
        try {
          const resp = await fetch(ringtone.previewUrl);
          if (resp.ok) {
            const arrayBuf = await resp.arrayBuffer();
            buf = await ctx.decodeAudioData(arrayBuf);
          }
        } catch (e) {
          console.warn('Download fallback a sintetizzatore:', e);
        }
      }

      if (!buf) {
        buf = createSynthAudioBuffer(ctx, ringtone.bpm || 120, 30);
      }

      const blob = bufferToAudioBlob(
        buf,
        ringtone.startTime,
        ringtone.endTime,
        ringtone.fadeInSec || 0,
        ringtone.fadeOutSec || 0
      );
      const safeTitle = ringtone.title.replace(/[^a-zA-Z0-9]/g, '_');
      const safeArtist = ringtone.artist.replace(/[^a-zA-Z0-9]/g, '_');
      const fadeTag =
        ringtone.fadeInSec || ringtone.fadeOutSec
          ? `_Fade[In${ringtone.fadeInSec || 0}s-Out${ringtone.fadeOutSec || 0}s]`
          : '';
      downloadBlobAsFile(
        blob,
        `${safeArtist}_-_${safeTitle}_[Suoneria_${Math.round(ringtone.startTime)}-${Math.round(ringtone.endTime)}s${fadeTag}].mp3`
      );
    } catch (err) {
      console.error('Errore durante il download:', err);
    }
  };

  const handleShare = async (ringtone: SavedRingtone) => {
    setSharingId(ringtone.id);
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext ||
          (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      let buf: AudioBuffer | null = null;

      if (ringtone.previewUrl) {
        try {
          const resp = await fetch(ringtone.previewUrl);
          if (resp.ok) {
            const arrayBuf = await resp.arrayBuffer();
            buf = await ctx.decodeAudioData(arrayBuf);
          }
        } catch (e) {
          console.warn('Share fallback a sintetizzatore:', e);
        }
      }

      if (!buf) {
        buf = createSynthAudioBuffer(ctx, ringtone.bpm || 120, 30);
      }

      const blob = bufferToAudioBlob(
        buf,
        ringtone.startTime,
        ringtone.endTime,
        ringtone.fadeInSec || 0,
        ringtone.fadeOutSec || 0
      );

      const safeTitle = ringtone.title.replace(/[^a-zA-Z0-9]/g, '_');
      const safeArtist = ringtone.artist.replace(/[^a-zA-Z0-9]/g, '_');
      const fadeTag =
        ringtone.fadeInSec || ringtone.fadeOutSec
          ? `_Fade[In${ringtone.fadeInSec || 0}s-Out${ringtone.fadeOutSec || 0}s]`
          : '';
      const filename = `${safeArtist}_-_${safeTitle}_[Suoneria_${Math.round(ringtone.startTime)}-${Math.round(ringtone.endTime)}s${fadeTag}].mp3`;

      const file = new File([blob], filename, { type: 'audio/mp3' });
      const shareData = {
        title: `${ringtone.title} - ${ringtone.artist} (Suoneria)`,
        text: `Ascolta e salva la suoneria di "${ringtone.title}" (${ringtone.startTime}s - ${ringtone.endTime}s)!`,
      };

      // Use Web Share API with files if supported
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          ...shareData,
          files: [file],
        });
        setShareFeedback({ id: ringtone.id, message: 'Suoneria condivisa!' });
      } else if (navigator.share) {
        // Fallback: Web Share API without files
        await navigator.share({
          ...shareData,
          url: window.location.href,
        });
        setShareFeedback({ id: ringtone.id, message: 'Dettagli condivisi!' });
      } else {
        // Fallback if Web Share API is not supported on this device/browser
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(
            `🎵 Suoneria: ${ringtone.title} - ${ringtone.artist} (${ringtone.startTime}s - ${ringtone.endTime}s)\nCreata con Studio Suonerie: ${window.location.href}`
          );
          setShareFeedback({ id: ringtone.id, message: 'Copiato negli appunti!' });
        } else {
          setShareFeedback({ id: ringtone.id, message: 'Web Share non supportato' });
        }
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.error('Errore durante la condivisione:', err);
        setShareFeedback({ id: ringtone.id, message: 'Errore condivisione' });
      }
    } finally {
      setSharingId(null);
      setTimeout(() => {
        setShareFeedback((prev) => (prev?.id === ringtone.id ? null : prev));
      }, 3000);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex justify-end animate-fade-in">
        <div className="w-full max-w-lg bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl overflow-hidden">
          {/* Drawer Header */}
          <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-950 border border-indigo-800 flex items-center justify-center text-indigo-400">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-slate-100 font-bold text-lg">
                  Libreria Suonerie Personalizzate
                </h2>
                <p className="text-xs text-slate-400">
                  {ringtones.length} frammenti MP3 salvati
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Ringtones Scrollable List */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 custom-scrollbar">
            {ringtones.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                <Music className="w-12 h-12 text-slate-600 mb-3" />
                <h3 className="text-slate-200 font-bold text-base">Nessuna suoneria salvata</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-xs">
                  Cerca una canzone, taglia il tuo frammento preferito e premi "Salva Come Suoneria" per vederlo qui!
                </p>
              </div>
            ) : (
              ringtones.map((ringtone) => {
                const isActive = activeRingtoneId === ringtone.id;
                const isPlaying = playingId === ringtone.id;
                const isLoading = loadingId === ringtone.id;

                return (
                  <div
                    key={ringtone.id}
                    className={`p-4 rounded-2xl border transition-all flex flex-col gap-3 ${
                      isActive
                        ? 'bg-indigo-950/80 border-indigo-500/80 shadow-lg ring-1 ring-indigo-500/40'
                        : 'bg-slate-800/80 border-slate-700/80 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Artwork */}
                      <img
                        src={ringtone.artworkUrl}
                        alt={ringtone.title}
                        className="w-12 h-12 rounded-xl object-cover border border-slate-700 shrink-0"
                        referrerPolicy="no-referrer"
                      />

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-slate-100 font-bold text-sm truncate">
                            {ringtone.title}
                          </h4>
                          {isActive && (
                            <span className="shrink-0 flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded-full border border-emerald-800">
                              <CheckCircle2 className="w-3 h-3" /> Attiva
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-300 font-medium truncate">
                          {ringtone.artist}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px]">
                          <span className="text-indigo-300 font-mono">
                            {ringtone.startTime}s - {ringtone.endTime}s ({ringtone.durationSec}s)
                          </span>
                          {(ringtone.fadeInSec || ringtone.fadeOutSec) ? (
                            <span className="text-[10px] font-mono text-purple-300 bg-purple-950/80 border border-purple-800/60 px-1.5 py-0.2 rounded">
                              {ringtone.fadeInSec ? `Fade In: ${ringtone.fadeInSec}s` : ''}
                              {ringtone.fadeInSec && ringtone.fadeOutSec ? ' • ' : ''}
                              {ringtone.fadeOutSec ? `Fade Out: ${ringtone.fadeOutSec}s` : ''}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => onDeleteRingtone(ringtone.id)}
                        className="p-2 text-slate-500 hover:text-rose-400 transition-colors"
                        title="Elimina suoneria"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Action buttons bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-700/60 text-xs">
                      <div className="flex items-center gap-2">
                        {/* Play snippet */}
                        <button
                          type="button"
                          onClick={() => togglePlayRingtone(ringtone)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 font-medium transition-all"
                        >
                          {isLoading ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                              <span>Caricamento...</span>
                            </>
                          ) : isPlaying ? (
                            <>
                              <Pause className="w-3.5 h-3.5 text-rose-400" />
                              <span>Pausa</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Ascolta MP3</span>
                            </>
                          )}
                        </button>

                        {/* Set Active */}
                        <button
                          type="button"
                          onClick={() => onSetActiveRingtone(ringtone.id)}
                          className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                            isActive
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-900 text-slate-300 hover:bg-indigo-900 border border-slate-700'
                          }`}
                        >
                          {isActive ? 'Suoneria Predefinita' : 'Imposta Predefinita'}
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {/* Share Button (Web Share API) */}
                        <button
                          id={`share-ringtone-${ringtone.id}`}
                          type="button"
                          onClick={() => handleShare(ringtone)}
                          disabled={sharingId === ringtone.id}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-900 hover:bg-slate-700 text-slate-300 hover:text-indigo-300 rounded-lg border border-slate-700 transition-all font-medium disabled:opacity-50"
                          title="Condividi file suoneria con altri"
                        >
                          {sharingId === ringtone.id ? (
                            <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                          ) : (
                            <Share2 className="w-3.5 h-3.5 text-indigo-400" />
                          )}
                          <span>Condividi</span>
                        </button>

                        {/* Simulate Call */}
                        <button
                          id={`test-call-ringtone-${ringtone.id}`}
                          type="button"
                          onClick={() => setSimulatorRingtone(ringtone)}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 rounded-lg font-semibold"
                          title="Simula chiamata in arrivo con questa suoneria"
                        >
                          <PhoneCall className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Test Chiamata</span>
                        </button>

                        {/* Download MP3 */}
                        <button
                          id={`download-ringtone-${ringtone.id}`}
                          type="button"
                          onClick={() => handleDownload(ringtone)}
                          className="p-1.5 bg-slate-900 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700"
                          title="Scarica File MP3"
                        >
                          <Download className="w-4 h-4 text-cyan-400" />
                        </button>
                      </div>
                    </div>

                    {/* Share status message if active */}
                    {shareFeedback?.id === ringtone.id && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-950/90 border border-indigo-500/60 rounded-xl text-xs font-semibold text-indigo-200 animate-fade-in shadow-md">
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>{shareFeedback.message}</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {/* Mobile / Smartphone Ringtone Setup Guide */}
            <div className="mt-6 p-4 bg-slate-950 border border-slate-800 rounded-2xl text-xs text-slate-300 space-y-2">
              <div className="flex items-center gap-2 text-indigo-400 font-bold">
                <Smartphone className="w-4 h-4" />
                <span>Come impostare l'MP3 come Suoneria sul telefono:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-slate-400 pl-1">
                <li>
                  <strong className="text-slate-200">Android:</strong> Scarica l'MP3, apri Impostazioni &gt; Suoni e vibrazione &gt; Suoneria &gt; Aggiungi da dispositivo (+).
                </li>
                <li>
                  <strong className="text-slate-200">iPhone / iOS:</strong> Scarica l'MP3 e importalo tramite GarageBand o iTunes per impostarlo come suoneria m4r.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Call Simulator Overlay */}
      {simulatorRingtone && (
        <CallSimulatorModal
          ringtone={simulatorRingtone}
          onClose={() => setSimulatorRingtone(null)}
        />
      )}
    </>
  );
};
