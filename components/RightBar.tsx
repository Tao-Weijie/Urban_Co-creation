import React, { useState } from 'react';
import { RLTrainingMetrics } from '@/game_engine/training';

interface RightBarProps {
  hasTopologyData: boolean;
  isRlTraining: boolean;
  rlProgress: number;
  rlEpisode: number;
  rlLoss: number | null;
  rlLossHistory: number[];
  rlMetrics: RLTrainingMetrics | null;
  onTrainRL: (episodes: number, lr: number) => Promise<void>;
  onCancelTrainRL: () => void;
  isRlLoaded: boolean;
  onSaveRL: () => void;
  onLoadRLFile: (file: File) => void;
  onClearRL: () => void;
}

export default function RightBar({
  hasTopologyData,
  isRlTraining,
  rlProgress,
  rlEpisode,
  rlLoss,
  rlLossHistory,
  rlMetrics,
  onTrainRL,
  onCancelTrainRL,
  isRlLoaded,
  onSaveRL,
  onLoadRLFile,
  onClearRL
}: RightBarProps) {
  const [rlEpisodesInput, setRlEpisodesInput] = useState<number>(100);
  const [rlLrInput, setRlLrInput] = useState<number>(0.001);

  const renderLossChart = () => {
    if (rlLossHistory.length === 0) return null;

    const w = 270;
    const h = 80;
    const padLeft = 10;
    const padRight = 10;
    const padTop = 10;
    const padBottom = 10;

    const minLoss = Math.min(...rlLossHistory);
    const maxLoss = Math.max(...rlLossHistory);
    const lossRange = maxLoss - minLoss;

    const points = rlLossHistory.map((val, idx) => {
      const x = padLeft + (idx / Math.max(1, rlLossHistory.length - 1)) * (w - padLeft - padRight);
      const y = lossRange === 0
        ? h / 2
        : h - padBottom - ((val - minLoss) / lossRange) * (h - padTop - padBottom);
      return { x, y };
    });

    const pathData = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const areaPathData = points.length > 0
      ? `${pathData} L ${points[points.length - 1].x.toFixed(1)} ${(h - padBottom).toFixed(1)} L ${points[0].x.toFixed(1)} ${(h - padBottom).toFixed(1)} Z`
      : '';

    return (
      <div className="bg-black/5 dark:bg-black/35 border border-black/5 dark:border-white/5 rounded-2xl p-3 space-y-2">
        <div className="flex justify-between items-center text-[8px] font-mono text-zinc-500 select-none">
          <span>Loss Trend</span>
          <span className="text-[8px] font-bold text-violet-500">
            Min: {minLoss.toFixed(4)} | Max: {maxLoss.toFixed(4)}
          </span>
        </div>
        <div className="relative h-[80px] w-full">
          <svg className="w-full h-full overflow-visible" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
            <defs>
              <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Grid line */}
            <line x1={padLeft} y1={padTop} x2={w - padRight} y2={padTop} stroke="currentColor" className="text-zinc-200 dark:text-zinc-800" strokeWidth="0.5" strokeDasharray="2 2" />
            <line x1={padLeft} y1={h - padBottom} x2={w - padRight} y2={h - padBottom} stroke="currentColor" className="text-zinc-200 dark:text-zinc-800" strokeWidth="0.5" />

            {/* Area under the line */}
            {areaPathData && (
              <path d={areaPathData} fill="url(#chartGrad)" />
            )}

            {/* The line itself */}
            {pathData && (
              <path d={pathData} fill="none" stroke="#8b5cf6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            )}

            {/* Last data point marker */}
            {points.length > 0 && (
              <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="2.5" fill="#8b5cf6" className="animate-pulse" />
            )}
          </svg>
        </div>
      </div>
    );
  };

  const renderMetricsDashboard = () => {
    if (!rlMetrics) return null;

    const fmt = (val: number, decimals = 4) => val.toFixed(decimals);
    const maxEntropyEstimate = 3.5;
    const devEntropyPct = Math.min(100, Math.max(0, (rlMetrics.devEntropy / maxEntropyEstimate) * 100));
    const govEntropyPct = Math.min(100, Math.max(0, (rlMetrics.govEntropy / maxEntropyEstimate) * 100));

    return (
      <div className="bg-black/5 dark:bg-black/35 border border-black/5 dark:border-white/5 rounded-2xl p-3.5 space-y-3 transition-all duration-300">
        <div className="flex justify-between items-center text-[8px] font-mono text-zinc-500 select-none">
          <span className="flex items-center gap-1 font-bold">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
            MAPPO Diagnostics
          </span>
          <span className="font-bold text-zinc-400 dark:text-zinc-600">Episode {rlMetrics.episode}</span>
        </div>

        {/* Developer Stats */}
        <div className="space-y-1.5 border-b border-black/5 dark:border-white/5 pb-2">
          <div className="flex justify-between items-center">
            <span className="text-[9px] font-bold text-violet-500">Developer (Actor)</span>
            <span className={`text-[8px] font-mono font-bold px-1.5 py-0.2 rounded ${
              rlMetrics.devReward > 0 ? 'bg-emerald-500/10 text-emerald-500' :
              rlMetrics.devReward < 0 ? 'bg-red-500/10 text-red-500' : 'bg-zinc-500/10 text-zinc-500'
            }`}>
              Rew: {rlMetrics.devReward > 0 ? '+' : ''}{fmt(rlMetrics.devReward, 3)}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[8px] font-mono text-zinc-500">
            <div>
              <span className="block text-[6.5px] text-zinc-400 uppercase">Actor L</span>
              <span className="font-bold text-zinc-700 dark:text-zinc-300">{fmt(rlMetrics.devActorLoss)}</span>
            </div>
            <div>
              <span className="block text-[6.5px] text-zinc-400 uppercase">Critic L</span>
              <span className="font-bold text-zinc-700 dark:text-zinc-300">{fmt(rlMetrics.devCriticLoss)}</span>
            </div>
          </div>
          <div className="space-y-0.5 text-[8px] font-mono text-zinc-500">
            <div className="flex justify-between text-[7px] text-zinc-400">
              <span>Entropy</span>
              <span>{fmt(rlMetrics.devEntropy, 2)}</span>
            </div>
            <div className="w-full h-1 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-300"
                style={{ width: `${devEntropyPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Government Stats */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="text-[9px] font-bold text-indigo-500">Government (Actor)</span>
            <span className={`text-[8px] font-mono font-bold px-1.5 py-0.2 rounded ${
              rlMetrics.govReward > 0 ? 'bg-emerald-500/10 text-emerald-500' :
              rlMetrics.govReward < 0 ? 'bg-red-500/10 text-red-500' : 'bg-zinc-500/10 text-zinc-500'
            }`}>
              Rew: {rlMetrics.govReward > 0 ? '+' : ''}{fmt(rlMetrics.govReward, 3)}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[8px] font-mono text-zinc-500">
            <div>
              <span className="block text-[6.5px] text-zinc-400 uppercase">Actor L</span>
              <span className="font-bold text-zinc-700 dark:text-zinc-300">{fmt(rlMetrics.govActorLoss)}</span>
            </div>
            <div>
              <span className="block text-[6.5px] text-zinc-400 uppercase">Critic L</span>
              <span className="font-bold text-zinc-700 dark:text-zinc-300">{fmt(rlMetrics.govCriticLoss)}</span>
            </div>
          </div>
          <div className="space-y-0.5 text-[8px] font-mono text-zinc-500">
            <div className="flex justify-between text-[7px] text-zinc-400">
              <span>Entropy</span>
              <span>{fmt(rlMetrics.govEntropy, 2)}</span>
            </div>
            <div className="w-full h-1 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-300"
                style={{ width: `${govEntropyPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="absolute top-6 right-6 z-10 w-80 max-w-sm app-bar p-5 duration-300 overflow-y-auto max-h-[92vh]">
      
      {/* MAPPO Multi-Agent Training Panel */}
      <div className="space-y-3">
        <div className="flex justify-between items-center select-none">
          <span className="app-title block">
            Agent Training
          </span>
        </div>

        <div className="space-y-3 pt-1">
            {!hasTopologyData ? null : (
              <>
                {/* Parameters Form */}
                <div className="bg-black/5 dark:bg-black/35 border border-black/5 dark:border-white/5 rounded-2xl p-3 space-y-2 text-[9px] font-mono">
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500">Episodes:</span>
                    <input 
                      type="number" 
                      value={rlEpisodesInput} 
                      onChange={(e) => setRlEpisodesInput(Math.max(1, parseInt(e.target.value) || 100))}
                      className="w-16 bg-white dark:bg-black/50 border border-black/10 dark:border-white/10 rounded px-1.5 py-0.5 text-right" 
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500">Learning Rate:</span>
                    <select 
                      value={rlLrInput} 
                      onChange={(e) => setRlLrInput(parseFloat(e.target.value))}
                      className="w-16 bg-white dark:bg-black/50 border border-black/10 dark:border-white/10 rounded px-1 py-0.5 text-right cursor-pointer"
                    >
                      <option value={0.01}>0.010</option>
                      <option value={0.005}>0.005</option>
                      <option value={0.001}>0.001</option>
                    </select>
                  </div>
                </div>

                {/* Model Status Indicator */}
                <div className="flex justify-between items-center text-[9px] font-mono text-zinc-500 bg-black/5 dark:bg-black/35 border border-black/5 dark:border-white/5 rounded-2xl p-2.5">
                  <span>Model Status:</span>
                  <span className={`font-bold flex items-center gap-1 ${isRlLoaded ? 'text-emerald-500' : 'text-zinc-400'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${isRlLoaded ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'}`}></span>
                    {isRlLoaded ? 'Loaded' : 'Not Loaded'}
                  </span>
                </div>

                {renderLossChart()}

                {renderMetricsDashboard()}

                {/* Progress and training button */}
                {isRlTraining ? (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[9px] font-mono text-violet-500">
                      <span>Training MAPPO...</span>
                      <span>Ep {rlEpisode} / {rlEpisodesInput}</span>
                    </div>
                    <div className="w-full h-1.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-violet-500 transition-all duration-150" 
                        style={{ width: `${rlProgress}%` }}
                      />
                    </div>
                    {rlLoss !== null && (
                      <div className="flex justify-between text-[9px] font-mono text-zinc-500">
                        <span>Avg Training Loss:</span>
                        <span className="font-semibold text-zinc-700 dark:text-zinc-300">{rlLoss.toFixed(6)}</span>
                      </div>
                    )}
                    <button 
                      onClick={onCancelTrainRL}
                      className="w-full py-1.5 text-[10px] app-btn-outline border-red-500/20 text-red-500 hover:bg-red-500/5 hover:text-red-400"
                    >
                      Cancel Training
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <button 
                      onClick={() => onTrainRL(rlEpisodesInput, rlLrInput)}
                      className="w-full py-2 text-[10px] app-btn-primary"
                    >
                      Train RL Agents (MAPPO)
                    </button>

                    <div className="border-t border-black/5 dark:border-white/5 pt-3 space-y-2">
                      <button 
                        onClick={onSaveRL}
                        disabled={!isRlLoaded}
                        className={`w-full py-2 text-[10px] app-btn-outline ${
                          isRlLoaded
                            ? 'border-violet-500/20 text-violet-500 hover:bg-violet-500/5'
                            : 'border-zinc-300 text-zinc-400 dark:border-zinc-800 dark:text-zinc-600 cursor-not-allowed opacity-50'
                        }`}
                      >
                        Save Models (Download File)
                      </button>

                      <label className="flex flex-col items-center justify-center w-full h-16 border border-violet-500/25 border-dashed rounded-xl cursor-pointer bg-violet-500/5 hover:bg-violet-500/10 transition-all">
                        <div className="text-center px-4">
                          <p className="text-[10px] text-violet-600 dark:text-violet-400 font-bold font-sans">Load Model from Unified File</p>
                          <p className="text-[8px] text-zinc-500 font-mono mt-0.5">Select unified model (.json) file</p>
                        </div>
                        <input 
                          type="file" 
                          accept=".json" 
                          className="hidden" 
                          onChange={(e) => {
                            if (e.target.files && e.target.files.length > 0) {
                              onLoadRLFile(e.target.files[0]);
                            }
                          }} 
                        />
                      </label>

                      <button 
                        onClick={onClearRL}
                        className="w-full py-1.5 text-[9px] app-btn-outline border border-red-500/20 text-red-500 hover:bg-red-500/5"
                      >
                        Clear Memory & Browser Cache
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
      </div>
    </div>
  );
}
