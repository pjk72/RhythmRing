import React, { useEffect, useState, useRef } from 'react';
import { SavedRingtone } from '../types';
import { PhoneCall, PhoneOff, Volume2, ShieldAlert, Sparkles } from 'lucide-react';
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
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    if (!ringtone) return;

    let isMounted = true;

    async function playRingtone() {
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
        if (ringtone?.previewUrl) {
          try {
            const resp = await fetch(ringtone.previewUrl);
            if (resp.ok) {
              const arrayBuf = await resp.arrayBuffer();
              audioBuffer = await ctx.decodeAudioData(arrayBuf);
            }
          } catch (e) {
            console.warn('Fallback a sintetizzatore per simulatore chiamata:', e);
          }
        }

        if (!audioBuffer) {
          audioBuffer = createSynthAudioBuffer(ctx, ringtone?.bpm || 120, 30);
        }

        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.loop = true;
        source.connect(ctx.destination);
        
        if (isMounted) {
          globalAudioManager.play('call-simulator', () => {
            if (sourceNodeRef.current) {
              try {
                sourceNodeRef.current.stop();
              } catch (e) {}
              sourceNodeRef.current = null;
            }
          });

          source.start(0, ringtone.startTime, ringtone.durationSec);
          sourceNodeRef.current = source;
        }
      } catch (err) {
        console.warn('Errore riproduzione suoneria chiamata:', err);
      }
    }

    playRingtone();

    return () => {
      isMounted = false;
      globalAudioManager.stop('call-simulator');
      if (sourceNodeRef.current) {
        try {
          sourceNodeRef.current.stop();
        } catch (e) {}
      }
    };
  }, [ringtone]);

  if (!ringtone) return null;

  const handleHangUp = () => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
      } catch (e) {}
    }
    onClose();
  };

  const handleAnswer = () => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
      } catch (e) {}
    }
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
          <span>{callAnswered ? 'Chiamata in corso (00:04)...' : 'Chiamata in Arrivo...'}</span>
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

        {/* Suoneria tag */}
        <div className="mt-3 px-3 py-1 bg-slate-800/90 rounded-xl border border-slate-700 text-xs text-indigo-300 font-medium flex items-center gap-1.5">
          <Volume2 className="w-3.5 h-3.5 text-indigo-400 animate-bounce" />
          <span>Suoneria Personalizzata MP3 Active</span>
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
                <span className="text-[11px] text-slate-400 font-medium">Rifiuta</span>
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
                <span className="text-[11px] text-slate-400 font-medium">Rispondi</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
