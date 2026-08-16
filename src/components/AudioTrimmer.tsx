import React, { useState, useEffect, useRef } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';
import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline.esm.js';
import { Track, RhythmAnalysis, KeyAnalysis, SavedRingtone } from '../types';
import {
  Play,
  Pause,
  Download,
  BellPlus,
  RotateCcw,
  Sparkles,
  Check,
  Plus,
  Minus,
  Waves,
  TrendingUp,
  TrendingDown,
  Volume2,
  Scissors,
  SlidersHorizontal,
  Layers,
} from 'lucide-react';
import {
  bufferToAudioBlob,
  createSynthAudioBuffer,
  downloadBlobAsFile,
} from '../utils/audioUtils';
import { globalAudioManager } from '../utils/audioPlaybackManager';
import { FrequencyVisualizer } from './FrequencyVisualizer';
import { MultiSegmentStudio } from './MultiSegmentStudio';


interface AudioTrimmerProps {
  track: Track | null;
  rhythm: RhythmAnalysis | null;
  keyData: KeyAnalysis | null;
  onSaveRingtone: (ringtone: SavedRingtone) => void;
  trimRange?: {
    startTime: number;
    endTime: number;
    fadeInSec: number;
    fadeOutSec: number;
  };
  onTrimChange?: (range: {
    startTime: number;
    endTime: number;
    fadeInSec: number;
    fadeOutSec: number;
  }) => void;
}

export const AudioTrimmer: React.FC<AudioTrimmerProps> = ({
  track,
  rhythm,
  keyData,
  onSaveRingtone,
  trimRange,
  onTrimChange,
}) => {
  const [startTime, setStartTime] = useState<number>(trimRange?.startTime ?? 0);
  const [endTime, setEndTime] = useState<number>(trimRange?.endTime ?? 30);
  const [fadeInSec, setFadeInSec] = useState<number>(trimRange?.fadeInSec ?? 0);
  const [fadeOutSec, setFadeOutSec] = useState<number>(trimRange?.fadeOutSec ?? 0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLooping, setIsLooping] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [isReady, setIsReady] = useState<boolean>(false);
  const [audioDuration, setAudioDuration] = useState<number>(30);
  const [mediaElement, setMediaElement] = useState<HTMLMediaElement | null>(null);
  const [studioMode, setStudioMode] = useState<'single' | 'multisegment'>('single');

  const containerRef = useRef<HTMLDivElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const regionsPluginRef = useRef<any>(null);
  const activeRegionRef = useRef<any>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);

  const isLoopingRef = useRef<boolean>(isLooping);
  const startTimeRef = useRef<number>(startTime);
  const endTimeRef = useRef<number>(endTime);
  const fadeInSecRef = useRef<number>(fadeInSec);
  const fadeOutSecRef = useRef<number>(fadeOutSec);
  const isPlayingRef = useRef<boolean>(isPlaying);

  useEffect(() => {
    isLoopingRef.current = isLooping;
  }, [isLooping]);

  useEffect(() => {
    startTimeRef.current = startTime;
  }, [startTime]);

  useEffect(() => {
    endTimeRef.current = endTime;
  }, [endTime]);

  useEffect(() => {
    fadeInSecRef.current = fadeInSec;
  }, [fadeInSec]);

  useEffect(() => {
    fadeOutSecRef.current = fadeOutSec;
  }, [fadeOutSec]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Sync back to parent SongCard whenever trim values change
  useEffect(() => {
    if (onTrimChange) {
      onTrimChange({ startTime, endTime, fadeInSec, fadeOutSec });
    }
  }, [startTime, endTime, fadeInSec, fadeOutSec, onTrimChange]);

  // Sync from external trimRange changes (e.g. from parent preset or reset)
  useEffect(() => {
    if (trimRange) {
      if (
        trimRange.startTime !== startTimeRef.current ||
        trimRange.endTime !== endTimeRef.current
      ) {
        setStartTime(trimRange.startTime);
        setEndTime(trimRange.endTime);
        startTimeRef.current = trimRange.startTime;
        endTimeRef.current = trimRange.endTime;
        if (activeRegionRef.current) {
          activeRegionRef.current.setOptions({
            start: trimRange.startTime,
            end: trimRange.endTime,
          });
        }
      }
      if (trimRange.fadeInSec !== fadeInSecRef.current) {
        setFadeInSec(trimRange.fadeInSec);
        fadeInSecRef.current = trimRange.fadeInSec;
      }
      if (trimRange.fadeOutSec !== fadeOutSecRef.current) {
        setFadeOutSec(trimRange.fadeOutSec);
        fadeOutSecRef.current = trimRange.fadeOutSec;
      }
    }
  }, [
    trimRange?.startTime,
    trimRange?.endTime,
    trimRange?.fadeInSec,
    trimRange?.fadeOutSec,
  ]);

  const trimmerId = `trimmer-${track?.trackId || 'unknown'}`;

  // Global Audio Event Handler
  useEffect(() => {
    const handleGlobalStop = () => {
      stopPlayback();
    };
    window.addEventListener('global-audio-stop', handleGlobalStop);
    return () => {
      window.removeEventListener('global-audio-stop', handleGlobalStop);
      stopPlayback();
      globalAudioManager.stop(trimmerId);
    };
  }, [trimmerId]);

  const stopPlayback = () => {
    if (wavesurferRef.current) {
      try {
        wavesurferRef.current.pause();
      } catch (e) {}
    }
    setIsPlaying(false);
    isPlayingRef.current = false;
    globalAudioManager.stop(trimmerId);
  };

  // Helper to compute volume automation during playback
  const getAutomatedVolume = (
    currentTime: number,
    start: number,
    end: number,
    fadeIn: number,
    fadeOut: number
  ): number => {
    let vol = 1.0;
    const relTime = currentTime - start;
    const remTime = end - currentTime;

    // Fade in ramp
    if (fadeIn > 0 && relTime >= 0 && relTime < fadeIn) {
      vol = Math.min(vol, Math.max(0.01, relTime / fadeIn));
    }

    // Fade out ramp
    if (fadeOut > 0 && remTime >= 0 && remTime < fadeOut) {
      vol = Math.min(vol, Math.max(0.01, remTime / fadeOut));
    }

    return Math.max(0.01, Math.min(1.0, vol));
  };

  // Initialize WaveSurfer with Regions and Timeline plugins
  useEffect(() => {
    if (!track || !containerRef.current) return;

    setIsReady(false);
    setIsPlaying(false);
    setStartTime(0);
    setEndTime(30);
    startTimeRef.current = 0;
    endTimeRef.current = 30;

    if (wavesurferRef.current) {
      try {
        wavesurferRef.current.destroy();
      } catch (e) {}
      wavesurferRef.current = null;
    }

    const wsRegions = RegionsPlugin.create();
    regionsPluginRef.current = wsRegions;

    const wsTimeline = TimelinePlugin.create({
      container: timelineRef.current || undefined,
      height: 18,
      style: {
        fontSize: '10px',
        color: '#94a3b8',
      },
    });

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: 'rgba(99, 102, 241, 0.45)', // Indigo translucent bars
      progressColor: '#f43f5e', // Vibrant rose for playback
      cursorColor: '#fb7185',
      cursorWidth: 2,
      barWidth: 3,
      barGap: 2,
      barRadius: 3,
      height: 95,
      normalize: true,
      plugins: [wsRegions, wsTimeline],
    });

    wavesurferRef.current = ws;

    let isCancelled = false;

    const setupRegion = (duration: number) => {
      wsRegions.clearRegions();
      // By default select entire track duration
      const initialEnd = duration;

      const reg = wsRegions.addRegion({
        id: 'trim-snippet',
        start: 0,
        end: initialEnd,
        color: 'rgba(99, 102, 241, 0.22)',
        drag: true,
        resize: true,
        minLength: 0.5,
        maxLength: duration,
      });

      activeRegionRef.current = reg;
      setStartTime(0);
      setEndTime(initialEnd);
      startTimeRef.current = 0;
      endTimeRef.current = initialEnd;
    };

    ws.on('ready', () => {
      if (isCancelled) return;
      const dur = ws.getDuration() || 30;
      setAudioDuration(dur);
      setupRegion(dur);
      setIsReady(true);
      try {
        const media = ws.getMediaElement();
        if (media) {
          setMediaElement(media);
        }
      } catch (e) {}

      // Extract AudioBuffer for high-fidelity export
      try {
        const decodedBuf = ws.getDecodedData();
        if (decodedBuf) {
          audioBufferRef.current = decodedBuf;
        }
      } catch (e) {}
    });

    // Handle Region drag / resize events from user touch & mouse
    wsRegions.on('region-updated', (region: any) => {
      const s = Math.round(region.start * 10) / 10;
      const e = Math.round(region.end * 10) / 10;
      setStartTime(s);
      setEndTime(e);
      startTimeRef.current = s;
      endTimeRef.current = e;

      // Adjust fade values if snippet becomes shorter than fade lengths
      const snippetLen = e - s;
      const maxFade = Math.max(0, Math.floor((snippetLen / 2) * 10) / 10);
      if (fadeInSecRef.current > maxFade) {
        setFadeInSec(maxFade);
      }
      if (fadeOutSecRef.current > maxFade) {
        setFadeOutSec(maxFade);
      }
    });

    // Handle loop playback and volume automation when playhead progresses
    ws.on('timeupdate', (currentTime: number) => {
      const s = startTimeRef.current;
      const e = endTimeRef.current;

      if (isPlayingRef.current) {
        // Apply dynamic volume automation (Fade In / Fade Out)
        const vol = getAutomatedVolume(
          currentTime,
          s,
          e,
          fadeInSecRef.current,
          fadeOutSecRef.current
        );
        try {
          ws.setVolume(vol);
        } catch (err) {}

        // Boundary loop check
        if (currentTime >= e) {
          if (isLoopingRef.current) {
            ws.setTime(s);
            // Apply initial volume at start of loop
            const initialVol = fadeInSecRef.current > 0 ? 0.01 : 1.0;
            try {
              ws.setVolume(initialVol);
            } catch (err) {}
            ws.play();
          } else {
            stopPlayback();
            ws.setTime(s);
          }
        }
      }
    });

    ws.on('finish', () => {
      if (isLoopingRef.current) {
        ws.setTime(startTimeRef.current);
        const initialVol = fadeInSecRef.current > 0 ? 0.01 : 1.0;
        try {
          ws.setVolume(initialVol);
        } catch (err) {}
        ws.play();
      } else {
        stopPlayback();
      }
    });

    // Load Audio (Local Blob, URL or Synth Fallback)
    async function loadAudioSource() {
      try {
        if (track?.audioBuffer) {
          audioBufferRef.current = track.audioBuffer;
        }

        if (track?.fileBlob && wavesurferRef.current) {
          await wavesurferRef.current.loadBlob(track.fileBlob);
          return;
        }

        if (track?.previewUrl) {
          try {
            const resp = await fetch(track.previewUrl);
            const blob = await resp.blob();
            if (!isCancelled && wavesurferRef.current) {
              await wavesurferRef.current.loadBlob(blob);
              return;
            }
          } catch (corsErr) {
            console.warn(
              'CORS / Fetch fallito su URL iTunes preview, carico tramite Web Audio Synth:',
              corsErr
            );
          }
        }

        // Fallback with synthetic buffer
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const synthBuf = createSynthAudioBuffer(audioCtx, rhythm?.bpm || 120, 30);
        audioBufferRef.current = synthBuf;

        // Convert AudioBuffer to WAV Blob for WaveSurfer
        const wavBlob = bufferToAudioBlob(synthBuf, 0, 30, 0, 0);
        if (!isCancelled && wavesurferRef.current) {
          await wavesurferRef.current.loadBlob(wavBlob);
        }
      } catch (loadErr) {
        console.error('Errore nel caricamento Wavesurfer:', loadErr);
      }
    }


    loadAudioSource();

    return () => {
      isCancelled = true;
      try {
        ws.destroy();
      } catch (e) {}
      wavesurferRef.current = null;
      activeRegionRef.current = null;
    };
  }, [track?.trackId]);

  // Synchronize WaveSurfer region with code updates (sliders, +/- buttons, presets)
  const syncRegionToValues = (newStart: number, newEnd: number) => {
    const s = Math.max(0, Math.min(audioDuration - 0.5, Math.round(newStart * 10) / 10));
    const e = Math.max(s + 0.5, Math.min(audioDuration, Math.round(newEnd * 10) / 10));

    setStartTime(s);
    setEndTime(e);
    startTimeRef.current = s;
    endTimeRef.current = e;

    // Adjust fade values if needed
    const snippetLen = e - s;
    const maxFade = Math.max(0, Math.floor((snippetLen / 2) * 10) / 10);
    if (fadeInSec > maxFade) setFadeInSec(maxFade);
    if (fadeOutSec > maxFade) setFadeOutSec(maxFade);

    if (activeRegionRef.current) {
      activeRegionRef.current.setOptions({
        start: s,
        end: e,
      });
    }

    if (wavesurferRef.current && isPlayingRef.current) {
      wavesurferRef.current.setTime(s);
      const initialVol = fadeInSecRef.current > 0 ? 0.01 : 1.0;
      try {
        wavesurferRef.current.setVolume(initialVol);
      } catch (e) {}
      wavesurferRef.current.play();
    }
  };

  const adjustStartTime = (delta: number) => {
    const newStart = Math.max(0, Math.min(endTime - 0.5, startTime + delta));
    syncRegionToValues(newStart, endTime);
  };

  const adjustEndTime = (delta: number) => {
    const newEnd = Math.min(audioDuration, Math.max(startTime + 0.5, endTime + delta));
    syncRegionToValues(startTime, newEnd);
  };

  // Reset Trimmer Selection to Full Track Duration
  const handleReset = () => {
    syncRegionToValues(0, audioDuration);
  };

  const snippetDurationNum = Math.max(0.5, endTime - startTime);
  const maxAllowedFadeSec = Math.min(5, Math.floor((snippetDurationNum / 2) * 10) / 10);

  const adjustFadeIn = (delta: number) => {
    const updated = Math.max(0, Math.min(maxAllowedFadeSec, Math.round((fadeInSec + delta) * 10) / 10));
    setFadeInSec(updated);
  };

  const adjustFadeOut = (delta: number) => {
    const updated = Math.max(0, Math.min(maxAllowedFadeSec, Math.round((fadeOutSec + delta) * 10) / 10));
    setFadeOutSec(updated);
  };

  const playSnippet = () => {
    if (!wavesurferRef.current) return;

    globalAudioManager.play(trimmerId, () => {
      if (wavesurferRef.current) {
        try {
          wavesurferRef.current.pause();
        } catch (e) {}
      }
      setIsPlaying(false);
      isPlayingRef.current = false;
    });

    const initialVol = fadeInSecRef.current > 0 ? 0.01 : 1.0;
    try {
      wavesurferRef.current.setVolume(initialVol);
    } catch (e) {}

    wavesurferRef.current.setTime(startTimeRef.current);
    wavesurferRef.current.play();
    setIsPlaying(true);
    isPlayingRef.current = true;
  };

  const togglePlay = () => {
    if (isPlaying) {
      stopPlayback();
    } else {
      playSnippet();
    }
  };

  // Export MP3 Handler with Fade Automation
  const handleDownloadMp3 = () => {
    if (!track) return;
    setIsExporting(true);

    try {
      let buf = audioBufferRef.current;
      if (!buf) {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        buf = createSynthAudioBuffer(audioCtx, rhythm?.bpm || 120, audioDuration);
      }

      const blob = bufferToAudioBlob(buf, startTime, endTime, fadeInSec, fadeOutSec);

      const safeTrackName = track.trackName.replace(/[^a-zA-Z0-9]/g, '_');
      const safeArtistName = track.artistName.replace(/[^a-zA-Z0-9]/g, '_');
      const fadeTag =
        fadeInSec > 0 || fadeOutSec > 0
          ? `_Fade[In${fadeInSec}s-Out${fadeOutSec}s]`
          : '';
      const filename = `${safeArtistName}_-_${safeTrackName}_[Suoneria_${Math.round(
        startTime
      )}-${Math.round(endTime)}s${fadeTag}].mp3`;

      downloadBlobAsFile(blob, filename);
    } catch (err) {
      alert("Errore durante l'esportazione del file MP3: " + err);
    } finally {
      setIsExporting(false);
    }
  };

  // Save to Ringtones Handler with Fade Automation
  const handleSaveToRingtones = () => {
    if (!track) return;

    const snippetDuration = Math.round((endTime - startTime) * 10) / 10;
    const newRingtone: SavedRingtone = {
      id: `ringtone-${Date.now()}`,
      trackId: track.trackId,
      title: track.trackName,
      artist: track.artistName,
      album: track.collectionName,
      artworkUrl: track.artworkUrl100,
      previewUrl: track.previewUrl,
      startTime: Math.round(startTime * 10) / 10,
      endTime: Math.round(endTime * 10) / 10,
      durationSec: snippetDuration,
      fadeInSec: fadeInSec > 0 ? fadeInSec : undefined,
      fadeOutSec: fadeOutSec > 0 ? fadeOutSec : undefined,
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      bpm: rhythm?.bpm || 120,
      keyNote: keyData?.key || 'Do Maggiore',
    };

    onSaveRingtone(newRingtone);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  if (!track) return null;

  const snippetDurationSec = (endTime - startTime).toFixed(1);

  const handleSwitchMode = (mode: 'single' | 'multisegment') => {
    if (isPlaying && wavesurferRef.current) {
      try {
        wavesurferRef.current.pause();
        setIsPlaying(false);
      } catch (err) {}
    }
    setStudioMode(mode);
    if (mode === 'single') {
      setTimeout(() => {
        if (wavesurferRef.current) {
          try {
            // Re-sync region and redraw if layout shifted
            if (activeRegionRef.current) {
              activeRegionRef.current.setOptions({
                start: startTimeRef.current,
                end: endTimeRef.current,
              });
            }
          } catch (e) {}
        }
      }, 50);
    }
  };

  return (
    <div
      id={`audio-trimmer-studio-${track.trackId}`}
      className="bg-slate-950/40 backdrop-blur-md border border-white/10 rounded-2xl p-3 sm:p-4.5 shadow-2xl flex flex-col gap-3 sm:gap-4"
    >
      {/* Studio Header: Mobile-First Compact Bar & Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-white/10">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-indigo-500 via-purple-500 to-rose-500 flex items-center justify-center text-white shadow-md shrink-0">
            <Waves className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-slate-100 font-bold text-xs sm:text-sm truncate drop-shadow-sm flex items-center gap-1.5">
              <span>Studio Audio Avanzato</span>
              <span className="text-[9px] font-mono font-normal text-indigo-300 bg-indigo-950/80 px-1.5 py-0.2 rounded border border-indigo-700/50 hidden sm:inline">
                Web Audio API
              </span>
            </h3>
            <p className="text-[10px] sm:text-[11px] text-slate-300 truncate">
              {studioMode === 'single'
                ? 'Taglio rapido suoneria con Fade In/Out'
                : 'Arrangiamento e unione di più segmenti con Crossfade'}
            </p>
          </div>
        </div>

        {/* Mode Selector Tabs (Taglio Singolo vs Montaggio Multi-Segmento) */}
        <div className="flex items-center gap-1.5 bg-slate-950/90 p-1 rounded-xl border border-white/10 shrink-0">
          <button
            type="button"
            onClick={() => handleSwitchMode('single')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              studioMode === 'single'
                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Scissors className="w-3.5 h-3.5" />
            <span>Taglio Singolo</span>
          </button>

          <button
            type="button"
            onClick={() => handleSwitchMode('multisegment')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              studioMode === 'multisegment'
                ? 'bg-gradient-to-r from-indigo-600 to-pink-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-pink-400" />
            <span>Montaggio Multi-Segmento</span>
          </button>
        </div>
      </div>

      {/* MULTI-SEGMENT STUDIO VIEW */}
      <div className={studioMode === 'multisegment' ? 'block' : 'hidden'}>
        <MultiSegmentStudio
          track={track}
          audioBuffer={audioBufferRef.current}
          audioDuration={audioDuration}
          onSaveRingtone={onSaveRingtone}
        />
      </div>

      {/* SINGLE TRIMMER STUDIO VIEW (PERSISTENT DOM TO PRESERVE WAVESURFER & REGIONS) */}
      <div className={studioMode === 'single' ? 'flex flex-col gap-3 sm:gap-4' : 'hidden'}>
        {/* CONTROLLI ASCOLTO, LOOP & FRAMMENTI RAPIDI (ALL'INIZIO DELLO STUDIO) */}


      <div className="bg-slate-950/60 border border-white/10 rounded-xl p-2.5 sm:p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shadow-sm">
        {/* Play button & Loop toggle */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={togglePlay}
            disabled={!isReady}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 text-white rounded-lg border border-indigo-400/30 font-semibold text-xs transition-all active:scale-95 shadow-md shadow-indigo-600/20"
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 text-white fill-white" />
                <span>Pausa</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-white fill-white" />
                <span>Ascolta Frammento</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsLooping(!isLooping)}
            title="Attiva o disattiva ripetizione continua"
            className={`flex items-center justify-center gap-1 px-2.5 py-2 rounded-lg border text-xs font-semibold transition-all shrink-0 ${
              isLooping
                ? 'bg-indigo-950/90 text-indigo-300 border-indigo-500/50 shadow-xs'
                : 'bg-slate-950/70 text-slate-400 border-white/10'
            }`}
          >
            <RotateCcw className="w-3 h-3" />
            <span>Loop {isLooping ? 'ON' : 'OFF'}</span>
          </button>
        </div>

        {/* Frammenti Presets + Reset Button */}
        <div className="grid grid-cols-3 gap-1.5 text-[11px]">
          <button
            type="button"
            onClick={() => syncRegionToValues(0, 8)}
            className="px-2 py-1.5 bg-slate-900/80 hover:bg-slate-800 text-slate-200 rounded-md border border-white/10 text-center font-medium active:scale-95 truncate shadow-2xs"
          >
            0s - 8s (Intro)
          </button>
          <button
            type="button"
            onClick={() => syncRegionToValues(8, 18)}
            className="px-2 py-1.5 bg-slate-900/80 hover:bg-slate-800 text-slate-200 rounded-md border border-white/10 text-center font-medium active:scale-95 truncate shadow-2xs"
          >
            8s - 18s (Ritorn.)
          </button>
          <button
            id="reset-trimmer-btn"
            type="button"
            onClick={handleReset}
            title="Reimposta la selezione all'intera durata del brano (0s - fine)"
            className="px-2 py-1.5 bg-indigo-950/90 hover:bg-indigo-900 text-indigo-200 hover:text-white rounded-md border border-indigo-500/40 text-center font-semibold active:scale-95 truncate flex items-center justify-center gap-1 shadow-xs"
          >
            <RotateCcw className="w-3 h-3 text-amber-400 shrink-0" />
            <span>Reset (0-{Math.round(audioDuration)}s)</span>
          </button>
        </div>
      </div>

      {/* REAL-TIME WAVESURFER TIMELINE & WAVEFORM CONTAINER */}
      <div className="bg-slate-950/50 backdrop-blur-sm border border-white/10 rounded-xl p-2 sm:p-3 flex flex-col gap-2 shadow-inner">
        {/* WaveSurfer rendering canvas element */}
        <div className="relative rounded-xl overflow-hidden bg-slate-950/60 border border-white/10 p-2 shadow-inner">
          {/* Loading indicator */}
          {!isReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 z-20 backdrop-blur-xs">
              <div className="flex items-center gap-2 text-indigo-300 text-xs font-semibold">
                <div className="w-4 h-4 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
                <span>Generazione onda sonora in tempo reale...</span>
              </div>
            </div>
          )}

          {/* WaveSurfer Container */}
          <div ref={containerRef} className="w-full cursor-pointer touch-none" />

          {/* WaveSurfer Timeline element */}
          <div ref={timelineRef} className="w-full mt-1 border-t border-white/10 pt-0.5" />
        </div>

        {/* BARRA UNIFICATA SELEZIONE BRANO (MERGE INIZIO & FINE) */}
        <div className="bg-slate-950/70 border border-white/10 rounded-xl p-2.5 sm:p-3 flex flex-col gap-2.5 shadow-inner">
          {/* Header Barra Unificata Inizio & Fine */}
          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-slate-200">
              <Scissors className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span>Intervallo Suoneria (Inizio & Fine)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-400 hidden sm:inline">
                Durata Selezionata:
              </span>
              <span className="font-mono font-bold text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-500/40 text-[11px] sm:text-xs">
                {snippetDurationSec}s / {audioDuration.toFixed(1)}s
              </span>
            </div>
          </div>

          {/* Griglia Unificata Dual-Control Inizio & Fine */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3 bg-slate-900/60 p-2 sm:p-2.5 rounded-xl border border-white/5">
            {/* Sezione Inizio */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-indigo-300 flex items-center gap-1.5 text-[11px] sm:text-xs">
                  <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
                  Inizio:
                </span>
                <span className="font-mono font-bold text-indigo-300 bg-indigo-950/80 px-1.5 py-0.5 rounded border border-indigo-500/40 text-[11px]">
                  {startTime.toFixed(1)}s
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => adjustStartTime(-0.5)}
                  title="Anticipa inizio (-0.5s)"
                  className="w-6 h-6 rounded bg-slate-950 border border-white/10 text-slate-200 hover:bg-slate-800 flex items-center justify-center shrink-0 active:scale-95 shadow-xs"
                >
                  <Minus className="w-3 h-3" />
                </button>

                <input
                  type="range"
                  min={0}
                  max={Math.max(0.5, audioDuration - 0.5)}
                  step={0.1}
                  value={startTime}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    let s = val;
                    let eVal = endTimeRef.current;
                    if (val >= eVal - 0.5) {
                      eVal = Math.min(audioDuration, val + 0.5);
                      s = Math.max(0, eVal - 0.5);
                    }
                    syncRegionToValues(s, eVal);
                  }}
                  className="flex-1 accent-indigo-500 cursor-pointer h-2 bg-slate-950 rounded-lg touch-none"
                />

                <button
                  type="button"
                  onClick={() => adjustStartTime(0.5)}
                  title="Posticipa inizio (+0.5s)"
                  className="w-6 h-6 rounded bg-slate-950 border border-white/10 text-slate-200 hover:bg-slate-800 flex items-center justify-center shrink-0 active:scale-95 shadow-xs"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Sezione Fine */}
            <div className="flex flex-col gap-1.5 md:border-l md:border-white/10 md:pl-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-amber-300 flex items-center gap-1.5 text-[11px] sm:text-xs">
                  <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                  Fine:
                </span>
                <span className="font-mono font-bold text-amber-300 bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-500/40 text-[11px]">
                  {endTime.toFixed(1)}s
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => adjustEndTime(-0.5)}
                  title="Anticipa fine (-0.5s)"
                  className="w-6 h-6 rounded bg-slate-950 border border-white/10 text-slate-200 hover:bg-slate-800 flex items-center justify-center shrink-0 active:scale-95 shadow-xs"
                >
                  <Minus className="w-3 h-3" />
                </button>

                <input
                  type="range"
                  min={0.5}
                  max={audioDuration}
                  step={0.1}
                  value={endTime}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    let s = startTimeRef.current;
                    let eVal = val;
                    if (val <= s + 0.5) {
                      s = Math.max(0, val - 0.5);
                      eVal = Math.min(audioDuration, s + 0.5);
                    }
                    syncRegionToValues(s, eVal);
                  }}
                  className="flex-1 accent-amber-500 cursor-pointer h-2 bg-slate-950 rounded-lg touch-none"
                />

                <button
                  type="button"
                  onClick={() => adjustEndTime(0.5)}
                  title="Posticipa fine (+0.5s)"
                  className="w-6 h-6 rounded bg-slate-950 border border-white/10 text-slate-200 hover:bg-slate-800 flex items-center justify-center shrink-0 active:scale-95 shadow-xs"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* BARRA UNIFICATA DISSOLVENZE (MERGE FADE IN & FADE OUT) */}
        <div className="bg-slate-950/70 border border-white/10 rounded-xl p-2.5 sm:p-3 flex flex-col gap-2.5 shadow-inner">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-slate-200 font-semibold text-xs">
              <Volume2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span>Dissolvenze Audio (Fade In / Fade Out)</span>
            </div>
            <div className="flex items-center gap-2">
              {(fadeInSec > 0 || fadeOutSec > 0) ? (
                <span className="text-[10px] font-mono text-indigo-300 bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-500/40">
                  In: +{fadeInSec}s | Out: -{fadeOutSec}s
                </span>
              ) : (
                <span className="text-[10px] text-slate-400">
                  Nessuna dissolvenza attiva
                </span>
              )}
              <span className="text-[10px] text-slate-400 hidden sm:inline">
                (Max {maxAllowedFadeSec}s)
              </span>
            </div>
          </div>

          {/* Griglia Unificata Dual-Control Dissolvenze */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 bg-slate-900/60 p-2 sm:p-2.5 rounded-xl border border-white/5">
            {/* Dissolvenza Inizio / Fade In */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-1 text-xs">
                <span className="font-semibold text-emerald-300 flex items-center gap-1 text-[11px]">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  Fade In (Entrata):
                </span>
                <span className="font-mono font-bold text-emerald-300 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800/60 text-[11px]">
                  +{fadeInSec.toFixed(1)}s
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => adjustFadeIn(-0.5)}
                  disabled={fadeInSec <= 0}
                  className="w-5 h-5 rounded bg-slate-950 border border-white/10 text-slate-300 hover:bg-slate-800 disabled:opacity-40 flex items-center justify-center shrink-0 active:scale-95"
                >
                  <Minus className="w-2.5 h-2.5" />
                </button>

                <input
                  type="range"
                  min={0}
                  max={maxAllowedFadeSec}
                  step={0.5}
                  value={fadeInSec}
                  onChange={(e) => setFadeInSec(parseFloat(e.target.value))}
                  className="flex-1 accent-emerald-500 cursor-pointer h-1.5 bg-slate-950 rounded-lg touch-none"
                />

                <button
                  type="button"
                  onClick={() => adjustFadeIn(0.5)}
                  disabled={fadeInSec >= maxAllowedFadeSec}
                  className="w-5 h-5 rounded bg-slate-950 border border-white/10 text-slate-300 hover:bg-slate-800 disabled:opacity-40 flex items-center justify-center shrink-0 active:scale-95"
                >
                  <Plus className="w-2.5 h-2.5" />
                </button>
              </div>

              {/* Quick Preset Buttons for Fade In */}
              <div className="grid grid-cols-4 gap-1 text-[10px] pt-0.5">
                {[0, 1, 2, 3].map((sec) => (
                  <button
                    key={`fade-in-${sec}`}
                    type="button"
                    disabled={sec > maxAllowedFadeSec}
                    onClick={() => setFadeInSec(Math.min(sec, maxAllowedFadeSec))}
                    className={`py-0.5 rounded border text-center font-medium transition-all ${
                      fadeInSec === sec
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs'
                        : 'bg-slate-950/70 hover:bg-slate-800 text-slate-300 border-white/10 disabled:opacity-30'
                    }`}
                  >
                    {sec === 0 ? 'No Fade' : `+${sec}s`}
                  </button>
                ))}
              </div>
            </div>

            {/* Dissolvenza Fine / Fade Out */}
            <div className="flex flex-col gap-1.5 sm:border-l sm:border-white/10 sm:pl-3">
              <div className="flex items-center justify-between gap-1 text-xs">
                <span className="font-semibold text-rose-300 flex items-center gap-1 text-[11px]">
                  <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                  Fade Out (Uscita):
                </span>
                <span className="font-mono font-bold text-rose-300 bg-rose-950/80 px-1.5 py-0.5 rounded border border-rose-800/60 text-[11px]">
                  -{fadeOutSec.toFixed(1)}s
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => adjustFadeOut(-0.5)}
                  disabled={fadeOutSec <= 0}
                  className="w-5 h-5 rounded bg-slate-950 border border-white/10 text-slate-300 hover:bg-slate-800 disabled:opacity-40 flex items-center justify-center shrink-0 active:scale-95"
                >
                  <Minus className="w-2.5 h-2.5" />
                </button>

                <input
                  type="range"
                  min={0}
                  max={maxAllowedFadeSec}
                  step={0.5}
                  value={fadeOutSec}
                  onChange={(e) => setFadeOutSec(parseFloat(e.target.value))}
                  className="flex-1 accent-rose-500 cursor-pointer h-1.5 bg-slate-950 rounded-lg touch-none"
                />

                <button
                  type="button"
                  onClick={() => adjustFadeOut(0.5)}
                  disabled={fadeOutSec >= maxAllowedFadeSec}
                  className="w-5 h-5 rounded bg-slate-950 border border-white/10 text-slate-300 hover:bg-slate-800 disabled:opacity-40 flex items-center justify-center shrink-0 active:scale-95"
                >
                  <Plus className="w-2.5 h-2.5" />
                </button>
              </div>

              {/* Quick Preset Buttons for Fade Out */}
              <div className="grid grid-cols-4 gap-1 text-[10px] pt-0.5">
                {[0, 1, 2, 3].map((sec) => (
                  <button
                    key={`fade-out-${sec}`}
                    type="button"
                    disabled={sec > maxAllowedFadeSec}
                    onClick={() => setFadeOutSec(Math.min(sec, maxAllowedFadeSec))}
                    className={`py-0.5 rounded border text-center font-medium transition-all ${
                      fadeOutSec === sec
                        ? 'bg-rose-600 text-white border-rose-500 shadow-xs'
                        : 'bg-slate-950/70 hover:bg-slate-800 text-slate-300 border-white/10 disabled:opacity-30'
                    }`}
                  >
                    {sec === 0 ? 'No Fade' : `-${sec}s`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* REAL-TIME AUDIO FREQUENCY VISUALIZER (CANVAS API) */}
        <FrequencyVisualizer
          isPlaying={isPlaying}
          mediaElement={mediaElement}
          audioBuffer={audioBufferRef.current}
          bpm={rhythm?.bpm || 120}
        />
      </div>

      {/* ACTION BUTTONS: SAVE & EXPORT MP3 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
        {/* Save as Custom Ringtone */}
        <button
          id="save-ringtone-btn"
          type="button"
          onClick={handleSaveToRingtones}
          className={`flex items-center justify-center gap-2 px-4 py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-md active:scale-[0.98] ${
            isSaved
              ? 'bg-emerald-600 text-white shadow-emerald-600/30'
              : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-indigo-600/20'
          }`}
        >
          {isSaved ? (
            <>
              <Check className="w-4 h-4 text-white" />
              <span>Aggiunta a Le Mie Suonerie!</span>
            </>
          ) : (
            <>
              <BellPlus className="w-4 h-4 text-indigo-200" />
              <span>Salva Come Suoneria</span>
            </>
          )}
        </button>

        {/* Download as MP3 File */}
        <button
          id="download-mp3-btn"
          type="button"
          disabled={isExporting || !isReady}
          onClick={handleDownloadMp3}
          className="flex items-center justify-center gap-2 px-4 py-2.5 sm:py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:bg-slate-700 text-white rounded-xl font-bold text-xs sm:text-sm transition-all shadow-md shadow-emerald-600/20 active:scale-[0.98]"
        >
          <Download className="w-4 h-4 text-emerald-200" />
          <span>{isExporting ? 'Generazione MP3...' : 'Scarica File MP3'}</span>
        </button>
      </div>
      </div>
    </div>
  );
};


