import React from 'react';
import { Track, RhythmAnalysis, KeyAnalysis } from '../types';
import {
  Gauge,
  Key,
  Flame,
  Music2,
  Activity,
} from 'lucide-react';

interface AnalysisPanelProps {
  track: Track | null;
  rhythm: RhythmAnalysis | null;
  keyData: KeyAnalysis | null;
}

export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({
  track,
  rhythm,
  keyData,
}) => {
  if (!track || !rhythm || !keyData) return null;

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

  return (
    <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 sm:p-4 shadow-sm flex flex-col gap-2.5">
      {/* Minimal Header Label */}
      <div className="flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-1.5 font-semibold text-slate-300">
          <Activity className="w-3.5 h-3.5 text-indigo-400" />
          <span>Analisi Ritmo & Tonalità</span>
        </div>
        <span className="text-[10px] font-mono text-indigo-400/90 bg-indigo-950/60 border border-indigo-800/50 px-2 py-0.5 rounded-full font-medium">
          Dati Armonici
        </span>
      </div>

      {/* Minimalist Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
        {/* 1. BPM & Tempo */}
        <div className="bg-slate-900/90 border border-slate-800/90 rounded-lg p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] text-cyan-400 font-medium">
            <span className="flex items-center gap-1">
              <Gauge className="w-3 h-3 text-cyan-400" />
              Tempo (BPM)
            </span>
            <span className="text-[9px] font-mono text-cyan-300 bg-cyan-950/80 border border-cyan-800/60 px-1 rounded">
              {rhythm.timeSignature}
            </span>
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-1">
            <div className="text-lg font-black text-white tracking-tight leading-none">
              {rhythm.bpm} <span className="text-[10px] font-semibold text-slate-400">BPM</span>
            </div>
            <span className="text-[10px] text-cyan-300/80 font-medium truncate max-w-[80px]">
              {rhythm.tempoName}
            </span>
          </div>
        </div>

        {/* 2. Rhythm Energy */}
        <div className="bg-slate-900/90 border border-slate-800/90 rounded-lg p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] text-amber-400 font-medium">
            <span className="flex items-center gap-1">
              <Flame className="w-3 h-3 text-amber-400" />
              Energia
            </span>
            <span className="text-[10px] font-bold text-amber-300">
              {energyPct}%
            </span>
          </div>
          <div className="mt-1">
            <div className="flex items-center justify-between text-xs font-bold text-amber-200 leading-none mb-1.5">
              <span>{rhythm.energyLevel}</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1 overflow-hidden">
              <div
                className="bg-gradient-to-r from-amber-500 to-rose-500 h-1 rounded-full"
                style={{ width: `${energyPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* 3. Musical Key & Camelot */}
        <div className="bg-slate-900/90 border border-slate-800/90 rounded-lg p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] text-indigo-400 font-medium">
            <span className="flex items-center gap-1">
              <Key className="w-3 h-3 text-indigo-400" />
              Tonalità
            </span>
            <span className="text-[9px] font-mono font-bold text-indigo-300 bg-indigo-950/80 border border-indigo-800/60 px-1.5 py-0.5 rounded">
              {keyData.camelotKey}
            </span>
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-1">
            <div className="text-sm font-extrabold text-indigo-200 truncate leading-none">
              {keyData.key}
            </div>
            <span className="text-[10px] text-slate-400 font-medium shrink-0">
              {keyData.mode}
            </span>
          </div>
        </div>

        {/* 4. Genre & Year */}
        <div className="bg-slate-900/90 border border-slate-800/90 rounded-lg p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] text-emerald-400 font-medium">
            <span className="flex items-center gap-1">
              <Music2 className="w-3 h-3 text-emerald-400" />
              Genere & Anno
            </span>
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-1">
            <div className="text-xs font-bold text-emerald-300 truncate leading-none">
              {track.primaryGenreName}
            </div>
            <span className="text-[10px] text-slate-300 font-mono font-semibold bg-slate-800 px-1.5 py-0.5 rounded shrink-0">
              {track.releaseYear}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
