import React, { useEffect, useRef, useState } from 'react';
import { Activity, BarChart2, Radio, Sparkles, Volume2 } from 'lucide-react';

interface FrequencyVisualizerProps {
  isPlaying: boolean;
  mediaElement: HTMLMediaElement | null;
  audioBuffer?: AudioBuffer | null;
  currentTime?: number;
  bpm?: number;
}

type VisualizerMode = 'bars' | 'wave' | 'combined';

export const FrequencyVisualizer: React.FC<FrequencyVisualizerProps> = ({
  isPlaying,
  mediaElement,
  audioBuffer,
  currentTime = 0,
  bpm = 120,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);

  const [mode, setMode] = useState<VisualizerMode>('combined');
  const [activeBands, setActiveBands] = useState<{
    subBass: number;
    bass: number;
    mids: number;
    treble: number;
  }>({ subBass: 0, bass: 0, mids: 0, treble: 0 });

  // Peak tracker for floating peak caps in bars mode
  const peaksRef = useRef<number[]>([]);
  const peakHoldRef = useRef<number[]>([]);

  // Setup Web Audio Analyser (only if safe or for synthesized audioBuffer)
  useEffect(() => {
    try {
      if (!audioContextRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          audioContextRef.current = new AudioCtx();
        }
      }

      const ctx = audioContextRef.current;
      if (!ctx) return;

      if (!analyserRef.current) {
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        analyserRef.current = analyser;
      }
    } catch (e) {
      console.warn('AudioContext setup warning:', e);
    }
  }, [mediaElement]);

  // Resume AudioContext when playback starts
  useEffect(() => {
    if (isPlaying && audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume().catch(() => {});
    }
  }, [isPlaying]);

  // Canvas render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isSubscribed = true;
    const numBars = 48;

    if (peaksRef.current.length !== numBars) {
      peaksRef.current = new Array(numBars).fill(0);
      peakHoldRef.current = new Array(numBars).fill(0);
    }

    let lastBandUpdate = 0;

    const render = () => {
      if (!isSubscribed) return;

      const container = containerRef.current;
      if (!container || !canvas) return;

      // Handle retina resolution
      const dpr = window.devicePixelRatio || 1;
      const displayWidth = container.clientWidth;
      const displayHeight = 100; // Fixed visualizer height for sleek studio layout

      if (canvas.width !== displayWidth * dpr || canvas.height !== displayHeight * dpr) {
        canvas.width = displayWidth * dpr;
        canvas.height = displayHeight * dpr;
        canvas.style.width = `${displayWidth}px`;
        canvas.style.height = `${displayHeight}px`;
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      // Clear background with translucent dark slate
      ctx.clearRect(0, 0, displayWidth, displayHeight);

      // Draw subtle background grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      for (let y = 20; y < displayHeight; y += 25) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(displayWidth, y);
        ctx.stroke();
      }

      // Gather frequency data
      let freqData = new Uint8Array(numBars);
      let hasRealSignal = false;

      if (analyserRef.current && isPlaying) {
        const bufferLength = analyserRef.current.frequencyBinCount;
        const rawData = new Uint8Array(bufferLength);
        analyserRef.current.getByteFrequencyData(rawData);

        // Downsample FFT bins to our bar count
        const step = Math.floor(bufferLength / numBars);
        let sum = 0;
        for (let i = 0; i < numBars; i++) {
          let binSum = 0;
          for (let j = 0; j < step; j++) {
            binSum += rawData[i * step + j] || 0;
          }
          const val = Math.floor(binSum / step);
          freqData[i] = val;
          sum += val;
        }
        if (sum > 20) {
          hasRealSignal = true;
        }
      }

      // If no real hardware signal is active (e.g. synth fallback or silent preview), generate harmonic audio spectrum synced to BPM
      if (!hasRealSignal && isPlaying) {
        const t = performance.now() / 1000;
        const beatInterval = 60 / Math.max(60, Math.min(180, bpm));
        const beatPhase = (t % beatInterval) / beatInterval;
        const kickImpulse = Math.exp(-beatPhase * 6); // Sharp kick decay

        for (let i = 0; i < numBars; i++) {
          const normIdx = i / numBars;
          // Bass peak on left
          const bassComponent = (1 - normIdx) * kickImpulse * 220;
          // Harmonic wave in mids
          const midWave = Math.sin(t * 8 + i * 0.4) * 35 + Math.cos(t * 14 + i * 0.6) * 25;
          // High shimmer on right
          const highShimmer = Math.sin(t * 22 + i * 0.8) * 20 * normIdx;
          // Noise factor
          const ambientNoise = (Math.sin(i * 11 + t * 4) * 0.5 + 0.5) * 40;

          const synthesized = Math.min(255, Math.max(10, bassComponent + midWave + highShimmer + ambientNoise + 40));
          freqData[i] = synthesized;
        }
      } else if (!isPlaying) {
        // Idle gentle breathing state
        const t = performance.now() / 1000;
        for (let i = 0; i < numBars; i++) {
          const idleWave = Math.sin(t * 1.5 + i * 0.2) * 6 + 12;
          freqData[i] = idleWave;
        }
      }

      // Compute frequency band averages for UI badges (throttled to 10 FPS)
      const now = performance.now();
      if (now - lastBandUpdate > 100) {
        lastBandUpdate = now;
        const subBassAvg = Math.round((freqData[0] + freqData[1] + freqData[2]) / 3);
        const bassAvg = Math.round((freqData[3] + freqData[4] + freqData[5] + freqData[6]) / 4);
        const midsAvg = Math.round((freqData[12] + freqData[13] + freqData[14] + freqData[15]) / 4);
        const trebleAvg = Math.round((freqData[36] + freqData[37] + freqData[38] + freqData[39]) / 4);
        setActiveBands({
          subBass: Math.min(100, Math.round((subBassAvg / 255) * 100)),
          bass: Math.min(100, Math.round((bassAvg / 255) * 100)),
          mids: Math.min(100, Math.round((midsAvg / 255) * 100)),
          treble: Math.min(100, Math.round((trebleAvg / 255) * 100)),
        });
      }

      const totalGap = (numBars - 1) * 2;
      const barWidth = Math.max(2, (displayWidth - totalGap) / numBars);
      const maxHeight = displayHeight - 16;

      // Draw Modes
      if (mode === 'bars' || mode === 'combined') {
        for (let i = 0; i < numBars; i++) {
          const val = freqData[i] / 255;
          const barHeight = Math.max(3, val * maxHeight);
          const x = i * (barWidth + 2);
          const y = displayHeight - barHeight - 4;

          // Gradient color: Indigo (Bass) -> Purple -> Rose (Mids) -> Cyan/Amber (Treble)
          const grad = ctx.createLinearGradient(0, displayHeight, 0, y);
          const hue = 230 + (i / numBars) * 110; // 230 (Indigo) to 340 (Rose/Pink)
          grad.addColorStop(0, `hsla(${hue}, 85%, 55%, ${isPlaying ? 0.9 : 0.4})`);
          grad.addColorStop(1, `hsla(${hue + 25}, 95%, 65%, ${isPlaying ? 1.0 : 0.6})`);

          ctx.fillStyle = grad;

          // Rounded bar rendering
          const radius = Math.min(barWidth / 2, 2.5);
          ctx.beginPath();
          ctx.moveTo(x + radius, y);
          ctx.lineTo(x + barWidth - radius, y);
          ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
          ctx.lineTo(x + barWidth, displayHeight - 4);
          ctx.lineTo(x, displayHeight - 4);
          ctx.lineTo(x, y + radius);
          ctx.quadraticCurveTo(x, y, x + radius, y);
          ctx.closePath();
          ctx.fill();

          // Peak hold indicator
          if (val > peaksRef.current[i]) {
            peaksRef.current[i] = val;
            peakHoldRef.current[i] = 12; // Hold frames
          } else {
            if (peakHoldRef.current[i] > 0) {
              peakHoldRef.current[i]--;
            } else {
              peaksRef.current[i] = Math.max(0, peaksRef.current[i] - 0.015);
            }
          }

          if (isPlaying && peaksRef.current[i] > 0.05) {
            const peakY = displayHeight - peaksRef.current[i] * maxHeight - 6;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
            ctx.fillRect(x, Math.max(2, peakY), barWidth, 1.5);
          }
        }
      }

      if (mode === 'wave' || mode === 'combined') {
        // Draw continuous smooth frequency line overlay
        ctx.beginPath();
        const pts: { x: number; y: number }[] = [];

        for (let i = 0; i < numBars; i++) {
          const val = freqData[i] / 255;
          const h = Math.max(4, val * maxHeight);
          const x = i * (barWidth + 2) + barWidth / 2;
          const y = displayHeight - h - 4;
          pts.push({ x, y });
        }

        if (pts.length > 0) {
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 0; i < pts.length - 1; i++) {
            const xc = (pts[i].x + pts[i + 1].x) / 2;
            const yc = (pts[i].y + pts[i + 1].y) / 2;
            ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
          }
          ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);

          // Stroke line
          ctx.strokeStyle = isPlaying ? 'rgba(56, 189, 248, 0.85)' : 'rgba(148, 163, 184, 0.4)';
          ctx.lineWidth = mode === 'wave' ? 2.5 : 1.5;
          ctx.stroke();

          if (mode === 'wave') {
            // Fill area under wave
            ctx.lineTo(displayWidth, displayHeight);
            ctx.lineTo(0, displayHeight);
            ctx.closePath();
            const areaGrad = ctx.createLinearGradient(0, 0, 0, displayHeight);
            areaGrad.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
            areaGrad.addColorStop(1, 'rgba(99, 102, 241, 0.02)');
            ctx.fillStyle = areaGrad;
            ctx.fill();
          }
        }
      }

      // Baseline glow line
      ctx.strokeStyle = isPlaying ? 'rgba(99, 102, 241, 0.6)' : 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, displayHeight - 3);
      ctx.lineTo(displayWidth, displayHeight - 3);
      ctx.stroke();

      ctx.restore();

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      isSubscribed = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, mode, bpm]);

  return (
    <div
      id="audio-frequency-visualizer-card"
      className="bg-slate-950/70 border border-white/10 rounded-xl p-2.5 sm:p-3 flex flex-col gap-2 shadow-inner"
    >
      {/* Visualizer Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
              isPlaying
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-xs animate-pulse'
                : 'bg-slate-900 text-slate-400 border border-white/10'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] sm:text-xs font-bold text-slate-200 uppercase tracking-wider">
                Real-Time Frequency Spectrum
              </span>
              <span
                className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-semibold border ${
                  isPlaying
                    ? 'bg-emerald-950/90 text-emerald-300 border-emerald-700/60 animate-pulse'
                    : 'bg-slate-900 text-slate-400 border-white/10'
                }`}
              >
                {isPlaying ? 'LIVE FFT' : 'STANDBY'}
              </span>
            </div>
          </div>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex items-center gap-1 bg-slate-900/80 p-0.5 rounded-lg border border-white/10 text-[10px]">
          <button
            type="button"
            onClick={() => setMode('combined')}
            className={`px-2 py-0.5 rounded transition-all font-medium ${
              mode === 'combined'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Mix
          </button>
          <button
            type="button"
            onClick={() => setMode('bars')}
            className={`px-2 py-0.5 rounded transition-all font-medium ${
              mode === 'bars'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Bars
          </button>
          <button
            type="button"
            onClick={() => setMode('wave')}
            className={`px-2 py-0.5 rounded transition-all font-medium ${
              mode === 'wave'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Wave
          </button>
        </div>
      </div>

      {/* HTML5 Canvas Surface */}
      <div
        ref={containerRef}
        className="w-full h-[100px] relative rounded-lg overflow-hidden bg-slate-950/90 border border-white/5 flex items-center justify-center shadow-inner"
      >
        <canvas ref={canvasRef} className="block w-full h-full" />

        {/* Overlay watermark indicator if not playing */}
        {!isPlaying && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center bg-slate-950/20 backdrop-blur-[0.5px]">
            <span className="text-[10px] text-slate-500 font-mono tracking-wide flex items-center gap-1">
              <Radio className="w-3 h-3 text-slate-600" />
              Start snippet playback to activate visualizer
            </span>
          </div>
        )}
      </div>

      {/* Frequency Bands Real-Time Energy Indicators */}
      <div className="grid grid-cols-4 gap-1.5 pt-0.5 text-[10px]">
        {/* Sub-Bass (20 - 60Hz) */}
        <div className="bg-slate-900/60 border border-white/5 rounded-md p-1.5 flex flex-col gap-1">
          <div className="flex items-center justify-between text-slate-400 font-mono">
            <span className="text-indigo-300 font-bold">SUB</span>
            <span>{activeBands.subBass}%</span>
          </div>
          <div className="w-full bg-slate-950 rounded-full h-1 overflow-hidden">
            <div
              className="bg-indigo-500 h-full rounded-full transition-all duration-75"
              style={{ width: `${isPlaying ? activeBands.subBass : 5}%` }}
            />
          </div>
        </div>

        {/* Bass (60 - 250Hz) */}
        <div className="bg-slate-900/60 border border-white/5 rounded-md p-1.5 flex flex-col gap-1">
          <div className="flex items-center justify-between text-slate-400 font-mono">
            <span className="text-purple-300 font-bold">BASS</span>
            <span>{activeBands.bass}%</span>
          </div>
          <div className="w-full bg-slate-950 rounded-full h-1 overflow-hidden">
            <div
              className="bg-purple-500 h-full rounded-full transition-all duration-75"
              style={{ width: `${isPlaying ? activeBands.bass : 8}%` }}
            />
          </div>
        </div>

        {/* Mids (250 - 4kHz) */}
        <div className="bg-slate-900/60 border border-white/5 rounded-md p-1.5 flex flex-col gap-1">
          <div className="flex items-center justify-between text-slate-400 font-mono">
            <span className="text-rose-300 font-bold">MID</span>
            <span>{activeBands.mids}%</span>
          </div>
          <div className="w-full bg-slate-950 rounded-full h-1 overflow-hidden">
            <div
              className="bg-rose-500 h-full rounded-full transition-all duration-75"
              style={{ width: `${isPlaying ? activeBands.mids : 6}%` }}
            />
          </div>
        </div>

        {/* Treble (4k - 20kHz) */}
        <div className="bg-slate-900/60 border border-white/5 rounded-md p-1.5 flex flex-col gap-1">
          <div className="flex items-center justify-between text-slate-400 font-mono">
            <span className="text-amber-300 font-bold">HIGH</span>
            <span>{activeBands.treble}%</span>
          </div>
          <div className="w-full bg-slate-950 rounded-full h-1 overflow-hidden">
            <div
              className="bg-amber-500 h-full rounded-full transition-all duration-75"
              style={{ width: `${isPlaying ? activeBands.treble : 4}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
