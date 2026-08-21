import React, { useEffect, useState, useRef, useCallback } from 'react';
import { SavedRingtone } from '../types';
import { PhoneCall, PhoneOff, Volume2, Sparkles } from 'lucide-react';
import { bufferToAudioBlob, createSynthAudioBuffer } from '../utils/audioUtils';
import { globalAudioManager } from '../utils/audioPlaybackManager';

interface CallSimulatorModalProps {
  ringtone: SavedRingtone | null;
  onClose: () => void;
}

export const CallSimulatorModal: React.FC<CallSimulatorModalProps> = ({
  ringtone,
  onClose,
}) => {
  const [callAnswered, setCallAnswered] = useState(false);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const stopAudio = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (activeAudioRef.current) {
      try {
        activeAudioRef.current.pause();
        activeAudioRef.current.currentTime = 0;
      } catch (e) {}
      activeAudioRef.current = null;
    }
    globalAudioManager.stop('call-simulator');
  }, []);

  useEffect(() => {
    if (!ringtone || callAnswered) {
      stopAudio();
      return;
    }

    const { startTime = 0, endTime = 30, fadeInSec = 0, fadeOutSec = 0 } = ringtone;

    const getGain = (curr: number) => {
      const rel = curr - startTime;
      const rem = endTime - curr;
      let gain = 1.0;
      if (fadeInSec > 0 && rel >= 0 && rel < fadeInSec) {
        gain = Math.min(gain, Math.max(0.05, rel / fadeInSec));
      }
      if (fadeOutSec > 0 && rem >= 0 && rem < fadeOutSec) {
        gain = Math.min(gain, Math.max(0.05, rem / fadeOutSec));
      }
      return Math.max(0.05, Math.min(1.0, gain));
    };

    const playSynth = () => {
      try {
        if (!audioCtxRef.current) {
          audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        const ctx = audioCtxRef.current;
        const synthBuf = createSynthAudioBuffer(ctx, ringtone.bpm || 120, 30);
        const blob = bufferToAudioBlob(synthBuf, startTime, endTime, fadeInSec, fadeOutSec);
        const blobUrl = URL.createObjectURL(blob);
        const audio = new Audio(blobUrl);
        activeAudioRef.current = audio;
        audio.loop = true;
        audio.play().catch(() => {});
      } catch (e) {}
    };

    const audioUrl = ringtone.previewUrl || ringtone.audioBlobUrl;

    if (audioUrl) {
      const audio = new Audio();
      activeAudioRef.current = audio;
      audio.preload = 'auto';
      audio.src = audioUrl;

      const loopCheckInterval = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = window.setInterval(() => {
          if (!activeAudioRef.current) {
            if (timerRef.current) clearInterval(timerRef.current);
            return;
          }
          const ct = activeAudioRef.current.currentTime;
          // Loop back to startTime when reaching endTime or end of track
          if (ct >= endTime || (activeAudioRef.current.duration && ct >= activeAudioRef.current.duration)) {
            try {
              activeAudioRef.current.currentTime = startTime;
              activeAudioRef.current.volume = fadeInSec > 0 ? 0.05 : 1.0;
              activeAudioRef.current.play().catch(() => {});
            } catch (e) {}
          } else if (ct >= startTime) {
            try {
              activeAudioRef.current.volume = getGain(ct);
            } catch (e) {}
          }
        }, 25);
      };

      audio.onloadedmetadata = () => {
        if (startTime > 0) {
          try {
            audio.currentTime = startTime;
          } catch (e) {}
        }
      };

      audio.oncanplay = () => {
        if (startTime > 0 && Math.abs(audio.currentTime - startTime) > 0.5) {
          try {
            audio.currentTime = startTime;
          } catch (e) {}
        }
      };

      audio.onerror = () => {
        playSynth();
      };

      globalAudioManager.play('call-simulator', () => {
        stopAudio();
      });

      if (startTime > 0) {
        try {
          audio.currentTime = startTime;
        } catch (e) {}
      }
      audio.volume = fadeInSec > 0 ? 0.05 : 1.0;

      audio.play().then(() => {
        loopCheckInterval();
      }).catch((err) => {
        console.warn('Call simulator audio play failed:', err);
        if (err?.name !== 'AbortError') {
          playSynth();
        }
      });
    } else {
      playSynth();
    }

    return () => {
      stopAudio();
    };
  }, [ringtone, callAnswered, stopAudio]);

  const handleHangUp = () => {
    stopAudio();
    onClose();
  };

  const handleAnswer = () => {
    stopAudio();
    setCallAnswered(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl overflow-hidden flex flex-col items-center text-center">
        {/* Smartphone top bar simulation */}
        <div className="w-24 h-4 bg-slate-950 rounded-full mb-6 flex items-center justify-center">
          <div className="w-3 h-3 rounded-full bg-slate-800 mr-2" />
          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
        </div>

        {/* Status text */}
        <div className="flex items-center gap-1.5 px-3 py-1 bg-rose-950/80 border border-rose-800/80 text-rose-300 text-xs font-semibold rounded-full mb-6">
          <Sparkles className="w-3.5 h-3.5 text-rose-400 animate-spin-slow" />
          <span>{callAnswered ? 'Call in progress (00:04)...' : 'Incoming Call...'}</span>
        </div>

        {/* Album / Caller Artwork */}
        <div className="relative w-28 h-28 rounded-full overflow-hidden border-4 border-slate-700 shadow-xl mb-4">
          <img
            src={ringtone.artworkUrl}
            alt={ringtone.title}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-indigo-500/10 animate-pulse" />
        </div>

        {/* Caller details */}
        <h3 className="text-xl font-bold text-white tracking-tight">{ringtone.title}</h3>
        <p className="text-sm font-medium text-slate-400 mt-0.5">{ringtone.artist}</p>

        {/* Ringtone tag */}
        <div className="mt-3 px-3 py-1 bg-slate-800/90 rounded-xl border border-slate-700 text-xs text-indigo-300 font-medium flex items-center gap-1.5">
          <Volume2 className="w-3.5 h-3.5 text-indigo-400 animate-bounce" />
          <span>Custom MP3 Ringtone Active</span>
        </div>

        {/* Call Action Controls */}
        <div className="mt-8 w-full flex items-center justify-around">
          {callAnswered ? (
            <button
              type="button"
              onClick={handleHangUp}
              className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-600/40 active:scale-90 transition-all"
            >
              <PhoneOff className="w-7 h-7" />
            </button>
          ) : (
            <>
              {/* Decline Call */}
              <div className="flex flex-col items-center gap-1">
                <button
                  type="button"
                  onClick={handleHangUp}
                  className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-600/30 active:scale-90 transition-all"
                >
                  <PhoneOff className="w-6 h-6" />
                </button>
                <span className="text-[11px] text-slate-400 font-medium">Decline</span>
              </div>

              {/* Answer Call */}
              <div className="flex flex-col items-center gap-1">
                <button
                  type="button"
                  onClick={handleAnswer}
                  className="w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-600/30 active:scale-90 transition-all animate-bounce"
                >
                  <PhoneCall className="w-6 h-6" />
                </button>
                <span className="text-[11px] text-slate-400 font-medium">Answer</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
