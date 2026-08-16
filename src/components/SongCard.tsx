import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { Track, SavedRingtone } from '../types';
import {
  analyzeTrackRhythm,
  analyzeTrackKey,
  createSynthAudioBuffer,
  bufferToAudioBlob,
} from '../utils/audioUtils';
import { globalAudioManager } from '../utils/audioPlaybackManager';
import { AudioTrimmer } from './AudioTrimmer';
import {
  Play,
  Pause,
  Calendar,
  Clock,
  Disc3,
  Sliders,
  ChevronDown,
  ChevronUp,
  Gauge,
  Flame,
  Music2,
  Activity,
  Sparkles,
  Volume2,
  FolderOpen,
  Laptop,
  Smartphone,
} from 'lucide-react';


interface SongCardProps {
  track: Track;
  index: number;
  onSaveRingtone: (ringtone: SavedRingtone) => void;
  isInitiallyExpanded?: boolean;
}

export const SongCard: React.FC<SongCardProps> = ({
  track,
  index,
  onSaveRingtone,
  isInitiallyExpanded = true,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(isInitiallyExpanded);
  const [isPlayingPreview, setIsPlayingPreview] = useState<boolean>(false);
  const [trimRange, setTrimRange] = useState<{
    startTime: number;
    endTime: number;
    fadeInSec: number;
    fadeOutSec: number;
  }>({
    startTime: 0,
    endTime: 30,
    fadeInSec: 0,
    fadeOutSec: 0,
  });

  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const trimRangeRef = useRef(trimRange);

  useEffect(() => {
    trimRangeRef.current = trimRange;
  }, [trimRange]);

  // Compute track-specific rhythm and key analysis
  const rhythm = useMemo(() => analyzeTrackRhythm(track), [track]);
  const keyData = useMemo(() => analyzeTrackKey(track), [track]);

  const previewSourceId = `preview-${track.trackId}`;

  const stopPreview = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (previewAudioRef.current) {
      try {
        previewAudioRef.current.pause();
        previewAudioRef.current.currentTime = 0;
      } catch (e) {}
      previewAudioRef.current = null;
    }
    setIsPlayingPreview(false);
    globalAudioManager.stop(previewSourceId);
  }, [previewSourceId]);

  useEffect(() => {
    const handleGlobalStop = () => {
      stopPreview();
    };
    window.addEventListener('global-audio-stop', handleGlobalStop);
    return () => {
      window.removeEventListener('global-audio-stop', handleGlobalStop);
      stopPreview();
    };
  }, [previewSourceId, stopPreview]);

  // Handler to play only the trimmed audio segment directly from search results
  const togglePreview = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (isPlayingPreview) {
      stopPreview();
      return;
    }

    const { startTime, endTime, fadeInSec, fadeOutSec } = trimRangeRef.current;

    // Register with global manager to stop all other playing audio across the app
    globalAudioManager.play(previewSourceId, () => {
      stopPreview();
    });

    const getGain = (curr: number) => {
      const rel = curr - startTime;
      const rem = endTime - curr;
      let gain = 1.0;
      if (fadeInSec > 0 && rel >= 0 && rel < fadeInSec) {
        gain = Math.min(gain, Math.max(0.01, rel / fadeInSec));
      }
      if (fadeOutSec > 0 && rem >= 0 && rem < fadeOutSec) {
        gain = Math.min(gain, Math.max(0.01, rem / fadeOutSec));
      }
      return Math.max(0.01, Math.min(1.0, gain));
    };

    const playSynthSnippet = () => {
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const synthBuf = createSynthAudioBuffer(audioCtx, rhythm?.bpm || 120, 30);
        const blob = bufferToAudioBlob(synthBuf, startTime, endTime, fadeInSec, fadeOutSec);
        const blobUrl = URL.createObjectURL(blob);
        const audio = new Audio(blobUrl);
        previewAudioRef.current = audio;
        audio.play().then(() => {
          setIsPlayingPreview(true);
        }).catch((err) => console.warn(err));
        audio.onended = () => {
          URL.revokeObjectURL(blobUrl);
          stopPreview();
        };
      } catch (err) {
        console.error(err);
        setIsPlayingPreview(false);
      }
    };

    if (track.previewUrl) {
      const audio = new Audio();
      previewAudioRef.current = audio;
      audio.crossOrigin = 'anonymous';
      audio.src = track.previewUrl;

      const startPlayback = () => {
        try {
          audio.currentTime = startTime;
          audio.volume = fadeInSec > 0 ? 0.01 : 1.0;
          audio.play().then(() => {
            setIsPlayingPreview(true);
          }).catch(() => {
            playSynthSnippet();
          });
        } catch (err) {
          playSynthSnippet();
        }
      };

      audio.addEventListener('canplay', startPlayback, { once: true });

      // Safety check in case canplay has already fired
      setTimeout(() => {
        if (previewAudioRef.current === audio && audio.paused && audio.readyState >= 2) {
          startPlayback();
        }
      }, 250);

      // High-precision interval (20ms) to ensure playback terminates exactly at endTime
      // and calculates smooth Fade In / Fade Out volume automation
      const interval = window.setInterval(() => {
        if (!previewAudioRef.current) {
          window.clearInterval(interval);
          return;
        }
        const ct = previewAudioRef.current.currentTime;
        if (ct >= endTime) {
          stopPreview();
        } else if (ct >= startTime) {
          try {
            previewAudioRef.current.volume = getGain(ct);
          } catch (e) {}
        }
      }, 20);
      timerRef.current = interval;

      audio.addEventListener('ended', () => {
        stopPreview();
      });

      audio.load();
      setIsPlayingPreview(true);
    } else {
      playSynthSnippet();
    }
  };

  const formatDuration = (millis: number) => {
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const getEnergyPercentage = (energy: string) => {
    switch (energy) {
      case 'Molto Alta':
        return 95;
      case 'Alta':
        return 75;
      case 'Media':
        return 50;
      default:
        return 35;
    }
  };

  const energyPct = getEnergyPercentage(rhythm.energyLevel);
  const artwork = track.artworkUrl600 || track.artworkUrl100;
  const segmentDurationSec = (trimRange.endTime - trimRange.startTime).toFixed(1);

  return (
    <div
      id={`song-card-${track.trackId}`}
      className="relative overflow-hidden bg-slate-950/70 border border-slate-700/80 rounded-2xl p-3.5 sm:p-4.5 shadow-2xl flex flex-col gap-3 hover:border-slate-500/80 transition-all group"
    >
      {/* 1. SFONDO COMPLETO CARD CON COPERTINA ALBUM VISIBILE */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl z-0">
        {/* Immagine copertina a tutto schermo */}
        <img
          src={artwork}
          alt={`${track.trackName} cover art`}
          className="w-full h-full object-cover object-center opacity-50 scale-105 filter blur-[0.5px] brightness-95 transition-transform duration-700 group-hover:scale-110"
          loading="lazy"
          referrerPolicy="no-referrer"
        />

        {/* Gradiente sfumato elegante: trasparente e contrastato per massima leggibilità */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/75 to-slate-950/45" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-slate-950/40" />
      </div>

      {/* 2. COPERTINA ALBUM NITIDA SUL LATO DESTRO (Effetto Spotlight visibile) */}
      <div className="absolute right-0 top-0 bottom-0 w-36 sm:w-64 md:w-80 pointer-events-none overflow-hidden rounded-r-2xl z-0">
        <img
          src={artwork}
          alt=""
          aria-hidden="true"
          className="w-full h-full object-cover object-center opacity-70 sm:opacity-80 filter contrast-110 brightness-100"
          referrerPolicy="no-referrer"
        />
        {/* Soft fade out to the left */}
        <div className="absolute inset-0 bg-gradient-to-l from-transparent via-slate-950/50 to-slate-950" />
      </div>

      {/* CONTENT LAYER */}
      <div className="relative z-10 flex flex-col gap-3">
        {/* SONG CARD HEADER: 3 Structured Lines + Play/Pause & Taglia Suoneria with Dark Gradient Backdrop for Visual Contrast */}
        <div className="relative p-2.5 sm:p-3 rounded-xl bg-gradient-to-r from-slate-950/95 via-slate-950/85 to-slate-950/60 border border-white/10 backdrop-blur-md shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 sm:gap-3">
          {/* Main Details (3 Linee ordinate) */}
          <div className="min-w-0 flex-1 flex flex-col gap-1.5 w-full">
            {/* 1° LINEA: Play Anteprima Segmento + #N + Titolo + Artista + Genere */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              {/* Quick Play/Pause Preview Button for Trimmed Segment */}
              <button
                id={`preview-btn-${track.trackId}`}
                type="button"
                onClick={togglePreview}
                title={
                  isPlayingPreview
                    ? 'Pausa anteprima segmento tagliato'
                    : `Ascolta anteprima segmento tagliato (${trimRange.startTime.toFixed(1)}s - ${trimRange.endTime.toFixed(1)}s)`
                }
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all shrink-0 shadow-md active:scale-95 ${
                  isPlayingPreview
                    ? 'bg-rose-500 text-white ring-2 ring-rose-400 shadow-rose-500/40 animate-pulse'
                    : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-indigo-600/30 hover:scale-105'
                }`}
              >
                {isPlayingPreview ? (
                  <Pause className="w-3.5 h-3.5 fill-current" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                )}
              </button>

              <span className="text-[10px] font-mono font-bold text-slate-300 bg-slate-900/90 border border-slate-700 px-1.5 py-0.5 rounded shrink-0">
                #{index + 1}
              </span>

              <h2 className="text-white font-extrabold text-sm sm:text-base truncate max-w-[180px] sm:max-w-xs md:max-w-md drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                {track.trackName}
              </h2>

              <span className="text-slate-400 font-semibold text-xs hidden sm:inline">—</span>

              <p className="text-indigo-200 font-semibold text-xs sm:text-sm truncate max-w-[130px] sm:max-w-[180px] drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                {track.artistName}
              </p>

              {/* Genere del Brano / Badge File Locale */}
              {track.isLocalFile ? (
                <span className="flex items-center gap-1 bg-pink-950/90 text-pink-300 border border-pink-700/80 px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-bold shrink-0 backdrop-blur-xs shadow-xs">
                  <FolderOpen className="w-3 h-3 text-pink-400" />
                  <span>File Locale {track.fileSizeFormatted ? `(${track.fileSizeFormatted})` : ''}</span>
                </span>
              ) : (
                <span className="flex items-center gap-1 bg-emerald-950/90 text-emerald-300 border border-emerald-700/80 px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-medium shrink-0 backdrop-blur-xs">
                  <Music2 className="w-3 h-3 text-emerald-400" />
                  <span>{track.primaryGenreName}</span>
                </span>
              )}


              {/* DIRECT PREVIEW TRIMMED SEGMENT CHIP BUTTON */}
              <button
                type="button"
                onClick={togglePreview}
                title={`Ascolta anteprima del solo segmento tagliato (${trimRange.startTime}s - ${trimRange.endTime}s)`}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-semibold border transition-all active:scale-95 ${
                  isPlayingPreview
                    ? 'bg-rose-950/90 text-rose-200 border-rose-500/80 shadow-rose-500/20'
                    : 'bg-indigo-950/80 hover:bg-indigo-900/90 text-indigo-200 border-indigo-500/50 hover:border-indigo-400'
                }`}
              >
                {isPlayingPreview ? (
                  <>
                    <span className="flex gap-0.5 items-end h-3">
                      <span className="w-0.5 h-3 bg-rose-400 animate-bounce" />
                      <span className="w-0.5 h-2 bg-rose-400 animate-bounce [animation-delay:0.15s]" />
                      <span className="w-0.5 h-3 bg-rose-400 animate-bounce [animation-delay:0.3s]" />
                    </span>
                    <span>In riproduzione ({segmentDurationSec}s)</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3 h-3 text-indigo-400" />
                    <span>Anteprima Taglio</span>
                    <span className="font-mono text-[9px] bg-indigo-900/80 px-1 py-0.2 rounded text-indigo-300">
                      {trimRange.startTime.toFixed(1)}s-{trimRange.endTime.toFixed(1)}s
                    </span>
                  </>
                )}
              </button>
            </div>

            {/* 2° LINEA: Album, Anno e Durata */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-slate-300 pl-8 sm:pl-10">
              <span className="flex items-center gap-1 text-slate-100 font-medium truncate max-w-[220px] sm:max-w-md drop-shadow-sm">
                <Disc3 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span className="truncate">{track.collectionName}</span>
              </span>

              <span className="text-slate-500">•</span>

              <span className="flex items-center gap-1 text-slate-200 drop-shadow-sm">
                <Calendar className="w-3 h-3 text-slate-400" />
                <span>{track.releaseYear}</span>
              </span>

              <span className="text-slate-500">•</span>

              <span className="flex items-center gap-1 text-slate-200 drop-shadow-sm">
                <Clock className="w-3 h-3 text-slate-400" />
                <span>{formatDuration(track.trackTimeMillis)}</span>
              </span>
            </div>

            {/* 3° LINEA: Analisi Ritmo (BPM, Tempo & Livello Energia) */}
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5 pl-8 sm:pl-10">
              <div className="flex items-center gap-1 text-[10px] sm:text-[11px] text-slate-300 font-medium mr-0.5">
                <Activity className="w-3 h-3 text-indigo-400" />
                <span>Ritmo:</span>
              </div>

              {/* Tempo & BPM */}
              <div
                title={`Tempo: ${rhythm.bpm} BPM (${rhythm.timeSignature}) - ${rhythm.tempoName}`}
                className="flex items-center gap-1 bg-cyan-950/90 border border-cyan-700/80 text-cyan-200 px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-semibold backdrop-blur-xs"
              >
                <Gauge className="w-3 h-3 text-cyan-400 shrink-0" />
                <span>{rhythm.bpm} BPM</span>
                <span className="text-[9px] font-mono text-cyan-200 bg-cyan-900/80 px-1 rounded">
                  {rhythm.timeSignature}
                </span>
                <span className="text-[10px] text-cyan-300 font-normal hidden md:inline">
                  • {rhythm.tempoName}
                </span>
              </div>

              {/* Energia Ritmo */}
              <div
                title={`Livello Energia: ${rhythm.energyLevel} (${energyPct}%)`}
                className="flex items-center gap-1 bg-amber-950/90 border border-amber-700/80 text-amber-200 px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-semibold backdrop-blur-xs"
              >
                <Flame className="w-3 h-3 text-amber-400 shrink-0" />
                <span>{rhythm.energyLevel}</span>
                <span className="text-[9px] sm:text-[10px] font-mono text-amber-300">({energyPct}%)</span>
              </div>
            </div>
          </div>

          {/* Pulsante Discreto "Taglia Suoneria" */}
          <div className="flex items-center self-end sm:self-center shrink-0 w-full sm:w-auto justify-end pt-1.5 sm:pt-0 border-t sm:border-t-0 border-slate-800/80">
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              title={isExpanded ? 'Comprimi Studio Suoneria' : 'Apri Studio Taglio Suoneria'}
              className={`w-full sm:w-auto px-3 py-1.5 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all border backdrop-blur-xs ${
                isExpanded
                  ? 'bg-slate-900/90 text-slate-100 border-slate-500 hover:bg-slate-800 shadow-md'
                  : 'bg-slate-900/70 text-slate-200 hover:text-white border-slate-700 hover:border-slate-400 hover:bg-slate-900/90 shadow-sm'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 text-indigo-400" />
              <span>{isExpanded ? 'Riduci Studio' : 'Apri Studio'}</span>
              {isExpanded ? (
                <ChevronUp className="w-3.5 h-3.5 text-slate-300" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-slate-300" />
              )}
            </button>
          </div>
        </div>

        {/* STUDIO TAGLIO FRAMMENTO AUDIO & CREA SUONERIA (Espandibile al clic) */}
        {isExpanded && (
          <div className="pt-2 border-t border-slate-800/80 animate-fadeIn">
            <AudioTrimmer
              track={track}
              rhythm={rhythm}
              keyData={keyData}
              onSaveRingtone={onSaveRingtone}
              trimRange={trimRange}
              onTrimChange={setTrimRange}
            />
          </div>
        )}
      </div>
    </div>
  );
};
