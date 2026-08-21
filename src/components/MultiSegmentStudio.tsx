import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  Plus,
  Trash2,
  Copy,
  Volume2,
  VolumeX,
  Sparkles,
  Sliders,
  Layers,
  Download,
  BellPlus,
  RotateCcw,
  Check,
  Split,
  Music,
  ArrowRightLeft,
  ChevronDown,
  ChevronUp,
  Tag,
  Clock,
  SlidersHorizontal,
  GripVertical,
  MoveHorizontal,
  ChevronsLeft,
  ChevronsRight,
  ArrowLeftRight,
} from 'lucide-react';
import {
  Track,
  AudioSegment,
  AudioMarker,
  MontageSettings,
  SavedRingtone,
} from '../types';
import {
  mergeAudioSegments,
  audioBufferToWavBlob,
  downloadBlobAsFile,
  bufferToAudioBlob,
} from '../utils/audioUtils';

interface MultiSegmentStudioProps {
  track: Track | null;
  audioBuffer: AudioBuffer | null;
  audioDuration: number;
  onSaveRingtone: (ringtone: SavedRingtone) => void;
  onClose?: () => void;
}

const PRESET_COLORS = [
  { name: 'Indigo', bg: 'bg-indigo-500', text: 'text-indigo-400', border: 'border-indigo-500', hex: '#6366f1' },
  { name: 'Smeraldo', bg: 'bg-emerald-500', text: 'text-emerald-400', border: 'border-emerald-500', hex: '#10b981' },
  { name: 'Ambra', bg: 'bg-amber-500', text: 'text-amber-400', border: 'border-amber-500', hex: '#f59e0b' },
  { name: 'Fucsia', bg: 'bg-pink-500', text: 'text-pink-400', border: 'border-pink-500', hex: '#ec4899' },
  { name: 'Ciano', bg: 'bg-cyan-500', text: 'text-cyan-400', border: 'border-cyan-500', hex: '#06b6d4' },
  { name: 'Viola', bg: 'bg-purple-500', text: 'text-purple-400', border: 'border-purple-500', hex: '#a855f7' },
];

export const MultiSegmentStudio: React.FC<MultiSegmentStudioProps> = ({
  track,
  audioBuffer,
  audioDuration,
  onSaveRingtone,
}) => {
  // Multi-Segment state
  const [segments, setSegments] = useState<AudioSegment[]>([
    {
      id: 'seg-1',
      name: 'Intro / Hook',
      startTime: 0,
      endTime: Math.min(8, audioDuration || 30),
      fadeInSec: 0.5,
      fadeOutSec: 0.5,
      color: '#6366f1',
      gain: 1.0,
      isMuted: false,
    },
    {
      id: 'seg-2',
      name: 'Chorus / Drop',
      startTime: Math.min(8, (audioDuration || 30) * 0.4),
      endTime: Math.min(20, (audioDuration || 30) * 0.8),
      fadeInSec: 0.5,
      fadeOutSec: 1.0,
      color: '#10b981',
      gain: 1.0,
      isMuted: false,
    },
  ]);

  const [activeSegmentId, setActiveSegmentId] = useState<string>('seg-1');
  const [markers, setMarkers] = useState<AudioMarker[]>([]);
  const [newMarkerLabel, setNewMarkerLabel] = useState<string>('');

  // Montage settings
  const [montageSettings, setMontageSettings] = useState<MontageSettings>({
    crossfadeSec: 0.5,
    gapSilenceSec: 0,
    normalizeVolume: true,
  });

  // Playback state
  const [isPlayingSequence, setIsPlayingSequence] = useState<boolean>(false);
  const [isPlayingSingle, setIsPlayingSingle] = useState<string | null>(null);
  const [playbackProgress, setPlaybackProgress] = useState<number>(0);
  const [isExportingMerged, setIsExportingMerged] = useState<boolean>(false);
  const [isSaved, setIsSaved] = useState<boolean>(false);

  const activeAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const playbackStartTimeRef = useRef<number>(0);
  const currentPlayingDurationRef = useRef<number>(0);

  // Timeline Interactive Drag & Resize State
  const [activeDrag, setActiveDrag] = useState<{
    segmentId: string;
    type: 'move' | 'resize-start' | 'resize-end';
    startTime: number;
    endTime: number;
  } | null>(null);
  const [hoveredTime, setHoveredTime] = useState<number | null>(null);

  const timelineTrackRef = useRef<HTMLDivElement | null>(null);
  const dragInteractionRef = useRef<{
    segmentId: string;
    type: 'move' | 'resize-start' | 'resize-end';
    startX: number;
    initialStart: number;
    initialEnd: number;
    trackWidth: number;
  } | null>(null);
  const segmentsRef = useRef<AudioSegment[]>(segments);

  useEffect(() => {
    segmentsRef.current = segments;
  }, [segments]);

  // Stop any active Web Audio playback
  const stopPlayback = () => {
    if (activeAudioSourceRef.current) {
      try {
        activeAudioSourceRef.current.stop();
        activeAudioSourceRef.current.disconnect();
      } catch (err) {}
      activeAudioSourceRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setIsPlayingSequence(false);
    setIsPlayingSingle(null);
    setPlaybackProgress(0);
  };

  useEffect(() => {
    return () => {
      stopPlayback();
    };
  }, []);

  const activeSegment = segments.find((s) => s.id === activeSegmentId) || segments[0];

  // Update specific field in a segment
  const updateSegment = useCallback((id: string, updates: Partial<AudioSegment>) => {
    setSegments((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
  }, []);

  // Timeline Drag & Resize Pointer Handlers
  const handleStartTimelineDrag = (
    e: React.MouseEvent | React.TouchEvent,
    seg: AudioSegment,
    type: 'move' | 'resize-start' | 'resize-end'
  ) => {
    e.preventDefault();
    e.stopPropagation();

    setActiveSegmentId(seg.id);

    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const trackRect = timelineTrackRef.current?.getBoundingClientRect();
    const trackWidth = trackRect && trackRect.width > 0 ? trackRect.width : 1;

    dragInteractionRef.current = {
      segmentId: seg.id,
      type,
      startX: clientX,
      initialStart: seg.startTime,
      initialEnd: seg.endTime,
      trackWidth,
    };

    setActiveDrag({
      segmentId: seg.id,
      type,
      startTime: seg.startTime,
      endTime: seg.endTime,
    });
  };

  useEffect(() => {
    const handleGlobalPointerMove = (e: MouseEvent | TouchEvent) => {
      const drag = dragInteractionRef.current;
      if (!drag || !timelineTrackRef.current) return;

      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const deltaX = clientX - drag.startX;
      const totalDur = audioDuration || 30;
      const deltaTime = (deltaX / drag.trackWidth) * totalDur;

      if (drag.type === 'move') {
        const length = drag.initialEnd - drag.initialStart;
        let newStart = Math.max(0, Math.min(totalDur - length, drag.initialStart + deltaTime));
        let newEnd = newStart + length;

        newStart = Math.round(newStart * 10) / 10;
        newEnd = Math.round(newEnd * 10) / 10;

        updateSegment(drag.segmentId, { startTime: newStart, endTime: newEnd });
        setActiveDrag({
          segmentId: drag.segmentId,
          type: 'move',
          startTime: newStart,
          endTime: newEnd,
        });
      } else if (drag.type === 'resize-start') {
        let newStart = Math.max(0, Math.min(drag.initialEnd - 0.2, drag.initialStart + deltaTime));
        newStart = Math.round(newStart * 10) / 10;

        updateSegment(drag.segmentId, { startTime: newStart });
        setActiveDrag({
          segmentId: drag.segmentId,
          type: 'resize-start',
          startTime: newStart,
          endTime: drag.initialEnd,
        });
      } else if (drag.type === 'resize-end') {
        let newEnd = Math.max(drag.initialStart + 0.2, Math.min(totalDur, drag.initialEnd + deltaTime));
        newEnd = Math.round(newEnd * 10) / 10;

        updateSegment(drag.segmentId, { endTime: newEnd });
        setActiveDrag({
          segmentId: drag.segmentId,
          type: 'resize-end',
          startTime: drag.initialStart,
          endTime: newEnd,
        });
      }
    };

    const handleGlobalPointerUp = () => {
      if (dragInteractionRef.current) {
        dragInteractionRef.current = null;
        setActiveDrag(null);
      }
    };

    window.addEventListener('mousemove', handleGlobalPointerMove, { passive: false });
    window.addEventListener('mouseup', handleGlobalPointerUp);
    window.addEventListener('touchmove', handleGlobalPointerMove, { passive: false });
    window.addEventListener('touchend', handleGlobalPointerUp);

    return () => {
      window.removeEventListener('mousemove', handleGlobalPointerMove);
      window.removeEventListener('mouseup', handleGlobalPointerUp);
      window.removeEventListener('touchmove', handleGlobalPointerMove);
      window.removeEventListener('touchend', handleGlobalPointerUp);
    };
  }, [audioDuration, updateSegment]);

  // Click on empty timeline track space to move or set active clip
  const handleTimelineTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragInteractionRef.current || !timelineTrackRef.current) return;
    const rect = timelineTrackRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const totalDur = audioDuration || 30;
    const clickedTime = Math.max(0, Math.min(totalDur, (clickX / rect.width) * totalDur));
    const roundedTime = Math.round(clickedTime * 10) / 10;

    if (activeSegment) {
      const len = activeSegment.endTime - activeSegment.startTime;
      let newStart = Math.min(totalDur - len, roundedTime);
      let newEnd = Math.min(totalDur, newStart + len);
      updateSegment(activeSegment.id, {
        startTime: Math.round(newStart * 10) / 10,
        endTime: Math.round(newEnd * 10) / 10,
      });
    }
  };

  // Nudge functions for pixel-perfect adjustments
  const handleNudgeSegment = (
    segId: string,
    action: 'start' | 'end' | 'move',
    delta: number
  ) => {
    const seg = segments.find((s) => s.id === segId);
    if (!seg) return;
    const totalDur = audioDuration || 30;

    if (action === 'start') {
      const newStart = Math.max(0, Math.min(seg.endTime - 0.2, seg.startTime + delta));
      updateSegment(segId, { startTime: Math.round(newStart * 10) / 10 });
    } else if (action === 'end') {
      const newEnd = Math.max(seg.startTime + 0.2, Math.min(totalDur, seg.endTime + delta));
      updateSegment(segId, { endTime: Math.round(newEnd * 10) / 10 });
    } else if (action === 'move') {
      const len = seg.endTime - seg.startTime;
      let newStart = Math.max(0, Math.min(totalDur - len, seg.startTime + delta));
      let newEnd = newStart + len;
      updateSegment(segId, {
        startTime: Math.round(newStart * 10) / 10,
        endTime: Math.round(newEnd * 10) / 10,
      });
    }
  };

  // Add new segment
  const handleAddSegment = () => {
    const dur = audioDuration || 30;
    const lastSeg = segments[segments.length - 1];
    let newStart = lastSeg ? Math.min(dur - 2, lastSeg.endTime) : 0;
    let newEnd = Math.min(dur, newStart + 6);
    if (newEnd <= newStart) {
      newStart = Math.max(0, dur - 6);
      newEnd = dur;
    }

    const nextColorIdx = segments.length % PRESET_COLORS.length;
    const newId = `seg-${Date.now()}`;
    const newSeg: AudioSegment = {
      id: newId,
      name: `Clip ${segments.length + 1}`,
      startTime: Math.round(newStart * 10) / 10,
      endTime: Math.round(newEnd * 10) / 10,
      fadeInSec: 0.5,
      fadeOutSec: 0.5,
      color: PRESET_COLORS[nextColorIdx].hex,
      gain: 1.0,
      isMuted: false,
    };

    setSegments((prev) => [...prev, newSeg]);
    setActiveSegmentId(newId);
  };

  // Duplicate segment
  const handleDuplicateSegment = (seg: AudioSegment) => {
    const newId = `seg-${Date.now()}`;
    const dur = audioDuration || 30;
    const len = seg.endTime - seg.startTime;
    let newStart = Math.min(dur - len, seg.endTime);
    let newEnd = Math.min(dur, newStart + len);

    const duplicated: AudioSegment = {
      ...seg,
      id: newId,
      name: `${seg.name} (Copy)`,
      startTime: Math.round(newStart * 10) / 10,
      endTime: Math.round(newEnd * 10) / 10,
    };

    setSegments((prev) => [...prev, duplicated]);
    setActiveSegmentId(newId);
  };

  // Delete segment
  const handleDeleteSegment = (id: string) => {
    if (segments.length <= 1) return;
    const remaining = segments.filter((s) => s.id !== id);
    setSegments(remaining);
    if (activeSegmentId === id) {
      setActiveSegmentId(remaining[0].id);
    }
  };

  // Add marker at current position
  const handleAddMarker = (time: number) => {
    const label = newMarkerLabel.trim() || `Cue ${markers.length + 1}`;
    const newMarker: AudioMarker = {
      id: `mark-${Date.now()}`,
      timeSec: Math.round(time * 10) / 10,
      label,
      color: PRESET_COLORS[markers.length % PRESET_COLORS.length].hex,
    };
    setMarkers((prev) => [...prev, newMarker]);
    setNewMarkerLabel('');
  };

  const handleDeleteMarker = (id: string) => {
    setMarkers((prev) => prev.filter((m) => m.id !== id));
  };

  // Play single segment
  const handlePlaySingleSegment = (seg: AudioSegment) => {
    if (!audioBuffer) return;

    if (isPlayingSingle === seg.id) {
      stopPlayback();
      return;
    }

    stopPlayback();

    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioContextRef.current = audioCtx;

    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;

    const gainNode = audioCtx.createGain();
    const duration = Math.max(0.2, seg.endTime - seg.startTime);

    // Apply Fade In & Fade Out automation
    const now = audioCtx.currentTime;
    gainNode.gain.setValueAtTime(seg.fadeInSec > 0 ? 0.001 : seg.gain, now);
    if (seg.fadeInSec > 0) {
      gainNode.gain.exponentialRampToValueAtTime(Math.max(0.01, seg.gain), now + seg.fadeInSec);
    }

    if (seg.fadeOutSec > 0) {
      const fadeOutStart = now + duration - seg.fadeOutSec;
      gainNode.gain.setValueAtTime(seg.gain, Math.max(now, fadeOutStart));
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);
    }

    source.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    source.start(0, seg.startTime, duration);
    activeAudioSourceRef.current = source;
    setIsPlayingSingle(seg.id);

    playbackStartTimeRef.current = Date.now();
    currentPlayingDurationRef.current = duration;

    const updateProgress = () => {
      const elapsed = (Date.now() - playbackStartTimeRef.current) / 1000;
      const prog = Math.min(100, (elapsed / duration) * 100);
      setPlaybackProgress(prog);

      if (elapsed < duration) {
        animationFrameRef.current = requestAnimationFrame(updateProgress);
      } else {
        stopPlayback();
      }
    };
    animationFrameRef.current = requestAnimationFrame(updateProgress);

    source.onended = () => {
      stopPlayback();
    };
  };

  // Play full merged sequence
  const handlePlayMergedSequence = () => {
    if (!audioBuffer) return;

    if (isPlayingSequence) {
      stopPlayback();
      return;
    }

    stopPlayback();

    const merged = mergeAudioSegments(audioBuffer, segments, montageSettings);
    if (!merged) return;

    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioContextRef.current = audioCtx;

    const source = audioCtx.createBufferSource();
    source.buffer = merged;
    source.connect(audioCtx.destination);

    const totalDur = merged.duration;
    source.start(0);
    activeAudioSourceRef.current = source;
    setIsPlayingSequence(true);

    playbackStartTimeRef.current = Date.now();
    currentPlayingDurationRef.current = totalDur;

    const updateProgress = () => {
      const elapsed = (Date.now() - playbackStartTimeRef.current) / 1000;
      const prog = Math.min(100, (elapsed / totalDur) * 100);
      setPlaybackProgress(prog);

      if (elapsed < totalDur) {
        animationFrameRef.current = requestAnimationFrame(updateProgress);
      } else {
        stopPlayback();
      }
    };
    animationFrameRef.current = requestAnimationFrame(updateProgress);

    source.onended = () => {
      stopPlayback();
    };
  };

  // Calculate total active montage duration
  const activeSegs = segments.filter((s) => !s.isMuted);
  const rawDuration = activeSegs.reduce((acc, s) => acc + Math.max(0, s.endTime - s.startTime), 0);
  const overlapSec = activeSegs.length > 1 ? (activeSegs.length - 1) * montageSettings.crossfadeSec : 0;
  const estimatedTotalSec = Math.max(0, rawDuration - overlapSec + (activeSegs.length > 1 ? (activeSegs.length - 1) * montageSettings.gapSilenceSec : 0));

  // Export merged montage as WAV/MP3 file
  const handleExportMerged = () => {
    if (!audioBuffer) return;
    setIsExportingMerged(true);

    try {
      const merged = mergeAudioSegments(audioBuffer, segments, montageSettings);
      if (!merged) {
        setIsExportingMerged(false);
        return;
      }

      const blob = audioBufferToWavBlob(merged);
      const safeTitle = (track?.trackName || 'Audio_Montage')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .toLowerCase();
      downloadBlobAsFile(blob, `${safeTitle}_montage_${activeSegs.length}clips.wav`);
    } catch (err) {
      console.error('Montage export error:', err);
    } finally {
      setIsExportingMerged(false);
    }
  };

  // Export individual clip
  const handleExportSingleClip = (seg: AudioSegment) => {
    if (!audioBuffer) return;
    try {
      const blob = bufferToAudioBlob(
        audioBuffer,
        seg.startTime,
        seg.endTime,
        seg.fadeInSec,
        seg.fadeOutSec
      );
      const safeTitle = `${track?.trackName || 'Audio'}_${seg.name}`
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .toLowerCase();
      downloadBlobAsFile(blob, `${safeTitle}.wav`);
    } catch (err) {
      console.error('Segment export error:', err);
    }
  };

  // Save merged montage as Ringtone
  const handleSaveAsRingtone = () => {
    if (!track || !audioBuffer) return;

    try {
      const merged = mergeAudioSegments(audioBuffer, segments, montageSettings);
      let blobUrl = '';
      if (merged) {
        const blob = audioBufferToWavBlob(merged);
        blobUrl = URL.createObjectURL(blob);
      }

      const newRingtone: SavedRingtone = {
        id: `montage-${Date.now()}`,
        trackId: track.trackId,
        title: `${track.trackName} [Montage ${activeSegs.length} Clips]`,
        artist: track.artistName,
        album: track.collectionName,
        artworkUrl: track.artworkUrl600 || track.artworkUrl100,
        startTime: 0,
        endTime: Math.round(estimatedTotalSec * 10) / 10,
        durationSec: Math.round(estimatedTotalSec * 10) / 10,
        fadeInSec: segments[0]?.fadeInSec || 0,
        fadeOutSec: segments[segments.length - 1]?.fadeOutSec || 0,
        createdAt: new Date().toLocaleDateString('en-US', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
        bpm: 120,
        keyNote: 'Montage',
        audioBlobUrl: blobUrl,
      };

      onSaveRingtone(newRingtone);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (err) {
      console.error('Error saving montage:', err);
    }
  };

  const dur = audioDuration || 30;

  return (
    <div className="bg-slate-900/90 border border-indigo-500/30 rounded-2xl p-3 sm:p-5 flex flex-col gap-4 shadow-xl text-slate-100">
      {/* Header with Title & Quick Sequence Player */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-pink-500 flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
            <Layers className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-white tracking-wide">
                Advanced Multi-Segment Studio
              </h4>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {segments.length} Clips {activeSegs.length !== segments.length && `(${activeSegs.length} active)`}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Create arrangements by combining multiple parts of the song with seamless crossfade
            </p>
          </div>
        </div>

        {/* Global Sequence Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handlePlayMergedSequence}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-semibold text-xs transition-all shadow-md active:scale-95 ${
              isPlayingSequence
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
            }`}
          >
            {isPlayingSequence ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>Stop Sequence</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Play Montage ({estimatedTotalSec.toFixed(1)}s)</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleAddSegment}
            className="flex items-center gap-1 px-3 py-2 rounded-lg font-semibold text-xs bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-500/30 transition-all active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Clip</span>
          </button>
        </div>
      </div>

      {/* VISUAL INTERACTIVE TIMELINE (DRAGGABLE & RESIZABLE CLIPS) */}
      <div className="bg-slate-950/90 border border-white/10 rounded-2xl p-3 sm:p-4 flex flex-col gap-3 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-300 font-medium px-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 font-bold text-white">
              <Clock className="w-4 h-4 text-indigo-400" />
              <span>Audio Track Timeline (0.0s - {dur.toFixed(1)}s)</span>
            </div>
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <MoveHorizontal className="w-3 h-3" />
              Drag clips or edges ↔ to adjust start/end
            </span>
          </div>

          <div className="flex items-center gap-3 text-[11px] font-mono text-indigo-300">
            {hoveredTime !== null && (
              <span className="text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-white/10">
                Pointer: <strong className="text-white">{hoveredTime.toFixed(1)}s</strong>
              </span>
            )}
            <span>Mix: ~{estimatedTotalSec.toFixed(1)}s</span>
          </div>
        </div>

        {/* Global Progress Bar when playing sequence */}
        {(isPlayingSequence || isPlayingSingle) && (
          <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 via-rose-500 to-amber-500 transition-all duration-75 shadow-sm"
              style={{ width: `${playbackProgress}%` }}
            />
          </div>
        )}

        {/* Multi-Segment Arranger Track Canvas */}
        <div
          ref={timelineTrackRef}
          onClick={handleTimelineTrackClick}
          onMouseMove={(e) => {
            if (!timelineTrackRef.current) return;
            const rect = timelineTrackRef.current.getBoundingClientRect();
            const pos = Math.max(0, Math.min(dur, ((e.clientX - rect.left) / rect.width) * dur));
            setHoveredTime(Math.round(pos * 10) / 10);
          }}
          onMouseLeave={() => setHoveredTime(null)}
          className="relative h-20 sm:h-24 bg-gradient-to-b from-slate-900/95 to-slate-950/95 rounded-xl border-2 border-slate-700/60 overflow-hidden select-none p-1.5 flex items-center cursor-crosshair group shadow-inner"
        >
          {/* Background grid ticks every 10% / seconds */}
          <div className="absolute inset-0 flex justify-between pointer-events-none opacity-25 px-2">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="h-full border-r border-dashed border-white/40 flex flex-col justify-between py-1">
                <span className="text-[8px] font-mono text-slate-400">
                  {((dur / 8) * i).toFixed(0)}s
                </span>
                <span className="text-[8px] font-mono text-slate-400">
                  {((dur / 8) * i).toFixed(0)}s
                </span>
              </div>
            ))}
          </div>

          {/* Hover Time Guide Line */}
          {hoveredTime !== null && !activeDrag && (
            <div
              style={{ left: `${(hoveredTime / dur) * 100}%` }}
              className="absolute top-0 bottom-0 w-px bg-pink-400/80 pointer-events-none z-30 flex flex-col items-center"
            >
              <span className="text-[8px] font-mono bg-pink-600 text-white px-1 rounded shadow -mt-2">
                {hoveredTime.toFixed(1)}s
              </span>
            </div>
          )}

          {/* Cue Markers */}
          {markers.map((marker) => {
            const leftPct = (marker.timeSec / dur) * 100;
            return (
              <div
                key={marker.id}
                style={{ left: `${leftPct}%` }}
                title={`${marker.label} (${marker.timeSec}s)`}
                className="absolute top-0 bottom-0 z-20 pointer-events-auto flex flex-col items-center group cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddMarker(marker.timeSec);
                }}
              >
                <div
                  className="px-1 py-0.5 rounded text-[8px] font-bold text-white shadow-xs truncate max-w-[60px]"
                  style={{ backgroundColor: marker.color }}
                >
                  {marker.label}
                </div>
                <div className="w-0.5 h-full bg-white/60" />
              </div>
            );
          })}

          {/* Rendered Segment Blocks */}
          {segments.map((seg, idx) => {
            const leftPct = Math.max(0, Math.min(100, (seg.startTime / dur) * 100));
            const widthPct = Math.max(
              2,
              Math.min(100 - leftPct, ((seg.endTime - seg.startTime) / dur) * 100)
            );
            const isActive = seg.id === activeSegmentId;
            const isBeingDragged = activeDrag?.segmentId === seg.id;

            return (
              <div
                key={seg.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveSegmentId(seg.id);
                }}
                style={{
                  left: `${leftPct}%`,
                  width: `${widthPct}%`,
                }}
                className={`absolute top-1.5 bottom-1.5 rounded-xl transition-shadow select-none flex items-center justify-between text-xs font-semibold overflow-visible z-10 group/seg ${
                  seg.isMuted
                    ? 'opacity-40 bg-slate-800 border border-slate-600 text-slate-400 line-through'
                    : isActive
                    ? 'ring-2 ring-white shadow-2xl z-20 text-white shadow-pink-500/20'
                    : 'opacity-90 hover:opacity-100 text-white hover:ring-1 hover:ring-white/50'
                }`}
              >
                {/* Segment background color tint */}
                <div
                  className="absolute inset-0 rounded-xl opacity-85 shadow-md"
                  style={{ backgroundColor: seg.color }}
                />

                {/* Fade In visual indicator */}
                {seg.fadeInSec > 0 && (
                  <div
                    className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-black/50 to-transparent pointer-events-none rounded-l-xl"
                    style={{
                      width: `${Math.min(
                        100,
                        (seg.fadeInSec / Math.max(0.1, seg.endTime - seg.startTime)) * 100
                      )}%`,
                    }}
                  />
                )}

                {/* Fade Out visual indicator */}
                {seg.fadeOutSec > 0 && (
                  <div
                    className="absolute right-0 top-0 bottom-0 bg-gradient-to-l from-black/50 to-transparent pointer-events-none rounded-r-xl"
                    style={{
                      width: `${Math.min(
                        100,
                        (seg.fadeOutSec / Math.max(0.1, seg.endTime - seg.startTime)) * 100
                      )}%`,
                    }}
                  />
                )}

                {/* LEFT RESIZE HANDLE (START TIME) */}
                <div
                  onMouseDown={(e) => handleStartTimelineDrag(e, seg, 'resize-start')}
                  onTouchStart={(e) => handleStartTimelineDrag(e, seg, 'resize-start')}
                  title="Drag to adjust start time"
                  className={`absolute left-0 top-0 bottom-0 w-3.5 z-30 cursor-ew-resize flex items-center justify-center transition-all rounded-l-xl touch-none ${
                    isActive
                      ? 'bg-white/40 hover:bg-white text-slate-900'
                      : 'bg-black/20 hover:bg-white/50 text-white'
                  }`}
                >
                  <div className="w-1 h-5 bg-white rounded-full shadow-md" />
                </div>

                {/* CENTER BODY (MOVE ENTIRE CLIP) */}
                <div
                  onMouseDown={(e) => handleStartTimelineDrag(e, seg, 'move')}
                  onTouchStart={(e) => handleStartTimelineDrag(e, seg, 'move')}
                  title="Drag to move entire clip along track"
                  className="flex-1 h-full flex items-center justify-between px-3 cursor-grab active:cursor-grabbing z-20 touch-none truncate"
                >
                  {/* Segment Content Label */}
                  <div className="flex items-center gap-1.5 truncate text-[11px]">
                    <span className="w-4 h-4 rounded-full bg-black/50 flex items-center justify-center text-[9px] font-mono font-bold shrink-0 shadow-xs">
                      {idx + 1}
                    </span>
                    <span className="truncate font-extrabold tracking-wide drop-shadow-sm">
                      {seg.name}
                    </span>
                  </div>

                  <div className="text-[10px] font-mono font-bold bg-black/40 px-1.5 py-0.5 rounded shadow-inner shrink-0 hidden sm:block">
                    {(seg.endTime - seg.startTime).toFixed(1)}s
                  </div>
                </div>

                {/* RIGHT RESIZE HANDLE (END TIME) */}
                <div
                  onMouseDown={(e) => handleStartTimelineDrag(e, seg, 'resize-end')}
                  onTouchStart={(e) => handleStartTimelineDrag(e, seg, 'resize-end')}
                  title="Drag to adjust end time"
                  className={`absolute right-0 top-0 bottom-0 w-3.5 z-30 cursor-ew-resize flex items-center justify-center transition-all rounded-r-xl touch-none ${
                    isActive
                      ? 'bg-white/40 hover:bg-white text-slate-900'
                      : 'bg-black/20 hover:bg-white/50 text-white'
                  }`}
                >
                  <div className="w-1 h-5 bg-white rounded-full shadow-md" />
                </div>

                {/* Floating Active Drag Tooltip */}
                {(isBeingDragged || isActive) && (
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-950 text-white border border-white/20 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md shadow-2xl z-40 whitespace-nowrap pointer-events-none flex items-center gap-1.5">
                    <span className="text-indigo-300">{seg.startTime.toFixed(1)}s</span>
                    <span>➔</span>
                    <span className="text-amber-300">{seg.endTime.toFixed(1)}s</span>
                    <span className="text-slate-400">({(seg.endTime - seg.startTime).toFixed(1)}s)</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* TIMELINE PRECISION NUDGE BAR (FOR THE ACTIVE CLIP) */}
        {activeSegment && (
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 pt-2 border-t border-white/10 bg-slate-900/60 rounded-xl p-2.5">
            <div className="flex items-center gap-2">
              <div
                className="w-3.5 h-3.5 rounded-full shrink-0"
                style={{ backgroundColor: activeSegment.color }}
              />
              <span className="text-xs font-bold text-white truncate max-w-[150px]">
                {activeSegment.name}:
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
              {/* Nudge Start Time */}
              <div className="flex items-center gap-1 bg-slate-950/80 px-2 py-1 rounded-lg border border-white/10">
                <span className="text-[11px] text-slate-400 font-semibold">Start:</span>
                <button
                  type="button"
                  onClick={() => handleNudgeSegment(activeSegment.id, 'start', -1)}
                  className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 text-[10px] font-mono font-bold transition-all"
                  title="-1 second"
                >
                  -1s
                </button>
                <button
                  type="button"
                  onClick={() => handleNudgeSegment(activeSegment.id, 'start', -0.1)}
                  className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 text-[10px] font-mono font-bold transition-all"
                  title="-0.1 seconds"
                >
                  -0.1s
                </button>
                <span className="font-mono text-indigo-200 font-bold px-1 text-xs">
                  {activeSegment.startTime.toFixed(1)}s
                </span>
                <button
                  type="button"
                  onClick={() => handleNudgeSegment(activeSegment.id, 'start', 0.1)}
                  className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 text-[10px] font-mono font-bold transition-all"
                  title="+0.1 seconds"
                >
                  +0.1s
                </button>
                <button
                  type="button"
                  onClick={() => handleNudgeSegment(activeSegment.id, 'start', 1)}
                  className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 text-[10px] font-mono font-bold transition-all"
                  title="+1 second"
                >
                  +1s
                </button>
              </div>

              {/* Shift entire clip left/right */}
              <div className="flex items-center gap-1 bg-slate-950/80 px-2 py-1 rounded-lg border border-white/10">
                <span className="text-[11px] text-slate-400 font-semibold">Move:</span>
                <button
                  type="button"
                  onClick={() => handleNudgeSegment(activeSegment.id, 'move', -0.5)}
                  className="flex items-center gap-0.5 px-2 py-0.5 rounded bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-500/30 text-indigo-200 text-[10px] font-bold transition-all"
                  title="Shift entire clip left by 0.5s"
                >
                  <ChevronsLeft className="w-3 h-3" />
                  <span>-0.5s</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleNudgeSegment(activeSegment.id, 'move', 0.5)}
                  className="flex items-center gap-0.5 px-2 py-0.5 rounded bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-500/30 text-indigo-200 text-[10px] font-bold transition-all"
                  title="Shift entire clip right by 0.5s"
                >
                  <span>+0.5s</span>
                  <ChevronsRight className="w-3 h-3" />
                </button>
              </div>

              {/* Nudge End Time */}
              <div className="flex items-center gap-1 bg-slate-950/80 px-2 py-1 rounded-lg border border-white/10">
                <span className="text-[11px] text-slate-400 font-semibold">End:</span>
                <button
                  type="button"
                  onClick={() => handleNudgeSegment(activeSegment.id, 'end', -1)}
                  className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 text-[10px] font-mono font-bold transition-all"
                  title="-1 second"
                >
                  -1s
                </button>
                <button
                  type="button"
                  onClick={() => handleNudgeSegment(activeSegment.id, 'end', -0.1)}
                  className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 text-[10px] font-mono font-bold transition-all"
                  title="-0.1 seconds"
                >
                  -0.1s
                </button>
                <span className="font-mono text-amber-200 font-bold px-1 text-xs">
                  {activeSegment.endTime.toFixed(1)}s
                </span>
                <button
                  type="button"
                  onClick={() => handleNudgeSegment(activeSegment.id, 'end', 0.1)}
                  className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 text-[10px] font-mono font-bold transition-all"
                  title="+0.1 seconds"
                >
                  +0.1s
                </button>
                <button
                  type="button"
                  onClick={() => handleNudgeSegment(activeSegment.id, 'end', 1)}
                  className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 text-[10px] font-mono font-bold transition-all"
                  title="+1 second"
                >
                  +1s
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CLIPS LIST & ACTIVE CLIP EDITOR (SPLIT VIEW) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Left Col (5 cols): Clips List & Sequence Order */}
        <div className="lg:col-span-5 flex flex-col gap-2 bg-slate-950/60 border border-white/10 rounded-xl p-2.5">
          <div className="flex items-center justify-between text-xs font-semibold px-1 text-slate-300">
            <span>Clip Sequence ({segments.length})</span>
            <span className="text-[10px] text-slate-400">Click to edit</span>
          </div>

          <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto pr-1">
            {segments.map((seg, idx) => {
              const isSelected = seg.id === activeSegmentId;
              const isCurrentlyPlaying = isPlayingSingle === seg.id;

              return (
                <div
                  key={seg.id}
                  onClick={() => setActiveSegmentId(seg.id)}
                  className={`p-2 rounded-lg border transition-all flex items-center justify-between gap-2 cursor-pointer ${
                    isSelected
                      ? 'bg-slate-900 border-indigo-500/80 shadow-md ring-1 ring-indigo-500/40'
                      : 'bg-slate-950/80 hover:bg-slate-900/60 border-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate min-w-0">
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: seg.color }}
                    />
                    <div className="truncate min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white truncate">
                          {idx + 1}. {seg.name}
                        </span>
                        {seg.isMuted && (
                          <span className="text-[9px] px-1 bg-rose-950/80 text-rose-300 rounded border border-rose-500/30">
                            Muted
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {seg.startTime.toFixed(1)}s → {seg.endTime.toFixed(1)}s (
                        {(seg.endTime - seg.startTime).toFixed(1)}s)
                      </div>
                    </div>
                  </div>

                  {/* Actions for this clip */}
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => handlePlaySingleSegment(seg)}
                      title="Listen to this clip only"
                      className={`p-1.5 rounded-md border transition-all ${
                        isCurrentlyPlaying
                          ? 'bg-emerald-600 text-white border-emerald-400'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-white/10'
                      }`}
                    >
                      {isCurrentlyPlaying ? (
                        <Pause className="w-3 h-3 fill-current" />
                      ) : (
                        <Play className="w-3 h-3 fill-current" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => updateSegment(seg.id, { isMuted: !seg.isMuted })}
                      title={seg.isMuted ? 'Unmute clip in mix' : 'Mute clip in mix'}
                      className={`p-1.5 rounded-md border transition-all ${
                        seg.isMuted
                          ? 'bg-rose-950/80 text-rose-300 border-rose-500/40'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border-white/10'
                      }`}
                    >
                      {seg.isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDuplicateSegment(seg)}
                      title="Duplicate this clip"
                      className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10 transition-all"
                    >
                      <Copy className="w-3 h-3" />
                    </button>

                    {segments.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteSegment(seg.id)}
                        title="Delete clip"
                        className="p-1.5 rounded-md bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-500/30 transition-all"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Col (7 cols): Active Clip Detailed Fine-Tuning */}
        <div className="lg:col-span-7 flex flex-col gap-3 bg-slate-950/60 border border-white/10 rounded-xl p-3">
          <div className="flex items-center justify-between text-xs font-bold text-white pb-1.5 border-b border-white/10">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400" />
              <span>Edit Selected Clip:</span>
            </div>
            <div className="flex items-center gap-1.5">
              {/* Color Presets */}
              {PRESET_COLORS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => updateSegment(activeSegment.id, { color: c.hex })}
                  style={{ backgroundColor: c.hex }}
                  className={`w-3.5 h-3.5 rounded-full transition-all ${
                    activeSegment.color === c.hex
                      ? 'ring-2 ring-white scale-110 shadow-sm'
                      : 'opacity-70 hover:opacity-100'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Name & Quick Play of selected clip */}
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-1.5 bg-slate-900 rounded-lg px-2.5 py-1.5 border border-white/10">
              <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                type="text"
                value={activeSegment.name}
                onChange={(e) => updateSegment(activeSegment.id, { name: e.target.value })}
                placeholder="Clip name (e.g. Intro, Chorus...)"
                className="bg-transparent text-xs font-semibold text-white outline-none w-full"
              />
            </div>

            <button
              type="button"
              onClick={() => handlePlaySingleSegment(activeSegment)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-sm active:scale-95 transition-all"
            >
              {isPlayingSingle === activeSegment.id ? (
                <>
                  <Pause className="w-3 h-3 fill-current" />
                  <span>Pause Clip</span>
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 fill-current" />
                  <span>Play Clip</span>
                </>
              )}
            </button>
          </div>

          {/* Interval Sliders (Start & End) */}
          <div className="bg-slate-900/80 rounded-lg p-2.5 border border-white/10 flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-200">Clip Trim Range</span>
              <span className="font-mono text-indigo-300 font-bold">
                {activeSegment.startTime.toFixed(1)}s → {activeSegment.endTime.toFixed(1)}s (
                {(activeSegment.endTime - activeSegment.startTime).toFixed(1)}s)
              </span>
            </div>

            {/* Start slider */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[11px] text-slate-400 w-12 shrink-0">Start:</span>
              <input
                type="range"
                min={0}
                max={Math.max(0, activeSegment.endTime - 0.5)}
                step={0.1}
                value={activeSegment.startTime}
                onChange={(e) =>
                  updateSegment(activeSegment.id, {
                    startTime: parseFloat(e.target.value),
                  })
                }
                className="w-full accent-indigo-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
              <span className="font-mono text-[11px] text-indigo-200 w-10 text-right">
                {activeSegment.startTime.toFixed(1)}s
              </span>
            </div>

            {/* End slider */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[11px] text-slate-400 w-12 shrink-0">End:</span>
              <input
                type="range"
                min={activeSegment.startTime + 0.5}
                max={dur}
                step={0.1}
                value={activeSegment.endTime}
                onChange={(e) =>
                  updateSegment(activeSegment.id, {
                    endTime: parseFloat(e.target.value),
                  })
                }
                className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
              <span className="font-mono text-[11px] text-amber-200 w-10 text-right">
                {activeSegment.endTime.toFixed(1)}s
              </span>
            </div>
          </div>

          {/* Fade & Gain Settings for Active Clip */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            {/* Fade In */}
            <div className="bg-slate-900/80 rounded-lg p-2 border border-white/10 flex flex-col gap-1">
              <div className="flex items-center justify-between text-[11px] text-slate-300">
                <span>Fade In</span>
                <span className="font-mono text-indigo-300">{activeSegment.fadeInSec.toFixed(1)}s</span>
              </div>
              <input
                type="range"
                min={0}
                max={Math.min(3, (activeSegment.endTime - activeSegment.startTime) / 2)}
                step={0.1}
                value={activeSegment.fadeInSec}
                onChange={(e) =>
                  updateSegment(activeSegment.id, { fadeInSec: parseFloat(e.target.value) })
                }
                className="w-full accent-indigo-400 h-1 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* Fade Out */}
            <div className="bg-slate-900/80 rounded-lg p-2 border border-white/10 flex flex-col gap-1">
              <div className="flex items-center justify-between text-[11px] text-slate-300">
                <span>Fade Out</span>
                <span className="font-mono text-amber-300">{activeSegment.fadeOutSec.toFixed(1)}s</span>
              </div>
              <input
                type="range"
                min={0}
                max={Math.min(3, (activeSegment.endTime - activeSegment.startTime) / 2)}
                step={0.1}
                value={activeSegment.fadeOutSec}
                onChange={(e) =>
                  updateSegment(activeSegment.id, { fadeOutSec: parseFloat(e.target.value) })
                }
                className="w-full accent-amber-400 h-1 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* Gain / Volume */}
            <div className="bg-slate-900/80 rounded-lg p-2 border border-white/10 flex flex-col gap-1">
              <div className="flex items-center justify-between text-[11px] text-slate-300">
                <span>Volume</span>
                <span className="font-mono text-emerald-300">{Math.round(activeSegment.gain * 100)}%</span>
              </div>
              <input
                type="range"
                min={0.2}
                max={1.8}
                step={0.05}
                value={activeSegment.gain}
                onChange={(e) =>
                  updateSegment(activeSegment.id, { gain: parseFloat(e.target.value) })
                }
                className="w-full accent-emerald-400 h-1 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>

      {/* MONTAGE CROSSFADE & SEQUENCE SETTINGS */}
      <div className="bg-slate-950/70 border border-white/10 rounded-xl p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="w-4 h-4 text-indigo-400 shrink-0" />
          <div>
            <span className="font-bold text-white block">Crossfade Transitions Between Clips</span>
            <span className="text-[11px] text-slate-400">
              Smoothly blends transitions from one clip to the next
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {[
            { label: '0s (None)', val: 0 },
            { label: '0.5s', val: 0.5 },
            { label: '1.0s', val: 1.0 },
            { label: '1.5s', val: 1.5 },
            { label: '2.0s', val: 2.0 },
          ].map((opt) => (
            <button
              key={opt.val}
              type="button"
              onClick={() =>
                setMontageSettings((prev) => ({ ...prev, crossfadeSec: opt.val }))
              }
              className={`px-2.5 py-1 rounded-md font-semibold text-xs border transition-all ${
                montageSettings.crossfadeSec === opt.val
                  ? 'bg-indigo-600 text-white border-indigo-400 shadow-xs'
                  : 'bg-slate-900 text-slate-300 border-white/10 hover:bg-slate-800'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ACTION FOOTER: EXPORT MERGED MONTAGE & SAVE AS RINGTONE */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-2 border-t border-white/10">
        <div className="text-[11px] text-slate-400">
          Estimated total:{' '}
          <strong className="text-white">{estimatedTotalSec.toFixed(1)} seconds</strong>{' '}
          ({activeSegs.length} active clips)
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Export merged WAV */}
          <button
            type="button"
            onClick={handleExportMerged}
            disabled={isExportingMerged || activeSegs.length === 0}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExportingMerged ? 'Exporting...' : 'Download Montage (WAV/MP3)'}</span>
          </button>

          {/* Save as Ringtone */}
          <button
            type="button"
            onClick={handleSaveAsRingtone}
            disabled={activeSegs.length === 0}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs shadow-md active:scale-95 transition-all ${
              isSaved
                ? 'bg-emerald-600 text-white shadow-emerald-600/30'
                : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-indigo-600/30'
            }`}
          >
            {isSaved ? (
              <>
                <Check className="w-3.5 h-3.5 text-white" />
                <span>Montage Saved!</span>
              </>
            ) : (
              <>
                <BellPlus className="w-3.5 h-3.5 text-white" />
                <span>Save as Ringtone</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
