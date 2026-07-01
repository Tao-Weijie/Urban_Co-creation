import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { DEFAULT_EPISODES, DEFAULT_LEARNING_RATE } from '../game_engine/configT';

export default function RightBar() {
  const {
    topologyData,
    isRlTraining,
    rlProgress,
    rlEpisode,
    rlLoss,
    rlLossHistory,
    rlMetrics,
    isRlLoaded,
    rolesConfig,
    handleTrainRL,
    cancelTrainRL,
    handleSaveRL,
    onLoadRLFile,
    handleClearRLModels
  } = useGame();

  const hasTopologyData = topologyData !== null;
  const onTrainRL = handleTrainRL;
  const onCancelTrainRL = cancelTrainRL;
  const onSaveRL = handleSaveRL;
  const onClearRL = handleClearRLModels;

  const [rlEpisodesInput, setRlEpisodesInput] = useState<number | ''>(DEFAULT_EPISODES);
  const [rlLrInput, setRlLrInput] = useState<number | ''>(DEFAULT_LEARNING_RATE);

  const renderLossChartContent = () => {
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
      <div className="space-y-2">
        <div className="flex justify-between items-center text-[8px] font-mono text-zinc-500 select-none">
          <span>Loss Trend</span>
          <span className="text-[8px] text-primary">
            Min: {minLoss.toFixed(4)} | Max: {maxLoss.toFixed(4)}
          </span>
        </div>
        <div className="relative h-[80px] w-full">
          <svg className="w-full h-full overflow-visible" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
            <defs>
              <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.25" />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.0" />
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
              <path d={pathData} fill="none" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            )}

            {/* Last data point marker */}
            {points.length > 0 && (
              <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="2.5" fill="var(--primary)" className="animate-pulse" />
            )}
          </svg>
        </div>
      </div>
    );
  };

  const renderMetricsDashboardContent = () => {
    if (!rlMetrics) return null;

    const fmt = (val: number, decimals = 4) => val.toFixed(decimals);
    const maxEntropyEstimate = 3.5;

    return (
      <div className="space-y-3 pt-2">
        {Object.keys(rolesConfig).map((roleId) => {
          const role = rolesConfig[roleId];
          const playerMetrics = rlMetrics.players?.[roleId] || rlMetrics.players?.[Number(roleId)];
          if (!playerMetrics) return null;

          const entropyPct = Math.min(100, Math.max(0, (playerMetrics.entropy / maxEntropyEstimate) * 100));

          return (
            <div key={roleId} className="space-y-1.5 pb-2 last:pb-0">
              <div className="flex justify-between items-center">
                <span className="text-[9px] font-bold" style={{ color: role.color }}>
                  {role.name}
                </span>
                <span className={`app-reward-badge ${
                  playerMetrics.reward > 0 ? 'app-reward-badge-positive' :
                  playerMetrics.reward < 0 ? 'app-reward-badge-negative' : 'app-reward-badge-neutral'
                }`}>
                  Rew: {playerMetrics.reward > 0 ? '+' : ''}{fmt(playerMetrics.reward, 3)}
                </span>
              </div>
              <div className="app-metrics-grid">
                <div className="app-metrics-item">
                  <span className="app-metrics-label">Actor L</span>
                  <span className="app-metrics-value">{fmt(playerMetrics.actorLoss)}</span>
                </div>
                <div className="app-metrics-item">
                  <span className="app-metrics-label">Critic L</span>
                  <span className="app-metrics-value">{fmt(playerMetrics.criticLoss)}</span>
                </div>
              </div>
              <div className="app-entropy-container">
                <div className="app-entropy-header">
                  <span>Entropy</span>
                  <span>{fmt(playerMetrics.entropy, 2)}</span>
                </div>
                <div className="app-entropy-progress-bg">
                  <div
                    className="h-full transition-all duration-300"
                    style={{
                      width: `${entropyPct}%`,
                      backgroundColor: role.color
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="right-6 app-sidebar">

      {/* MAPPO Multi-Agent Training Panel */}
      <div className="space-y-3">
        <div className="flex justify-between items-center select-none">
          <span className="app-title block">
            Agent Training
          </span>
        </div>
        {hasTopologyData && (
          <div className="space-y-3 pt-1 animate-in fade-in duration-300">
            {/* Training Setting Section */}
            <div className="app-section-card space-y-2.5 text-[9px] font-mono">
              <span className="app-subtitle block">Training Setting</span>
              {/* Model Status */}
              <div className="flex justify-between items-center">
                <span className="text-zinc-500">Model Status:</span>
                <span className={`font-bold flex items-center gap-1 ${isRlLoaded ? 'text-emerald-500' : 'text-zinc-400'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isRlLoaded ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'}`}></span>
                  {isRlLoaded ? 'Loaded' : 'Not Loaded'}
                </span>
              </div>

              {/* Episodes */}
              <div className="flex justify-between items-center">
                <span className="text-zinc-500">Episodes:</span>
                <input
                  type="number"
                  value={rlEpisodesInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') {
                      setRlEpisodesInput('');
                    } else {
                      const parsed = parseInt(val);
                      setRlEpisodesInput(isNaN(parsed) ? '' : Math.max(1, parsed));
                    }
                  }}
                  className="w-16 bg-white dark:bg-black/50 outline outline-1 outline-black/10 dark:outline-white/10 rounded px-1.5 py-0.5 text-right"
                />
              </div>

              {/* Learning Rate */}
              <div className="flex justify-between items-center">
                <span className="text-zinc-500">Learning Rate:</span>
                <input
                  type="number"
                  step="any"
                  value={rlLrInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') {
                      setRlLrInput('');
                    } else {
                      const parsed = parseFloat(val);
                      setRlLrInput(isNaN(parsed) ? '' : Math.max(0, parsed));
                    }
                  }}
                  className="w-16 bg-white dark:bg-black/50 outline outline-1 outline-black/10 dark:outline-white/10 rounded px-1.5 py-0.5 text-right"
                />
              </div>

              {/* Action Control */}
              <div className="pt-2">
                {isRlTraining ? (
                  <button
                    onClick={onCancelTrainRL}
                    className="w-full py-1.5 text-[10px] app-btn-outline outline-red-500/20 text-red-500 hover:bg-red-500/5 hover:text-red-400"
                  >
                    Cancel Training
                  </button>
                ) : (
                  <button
                    onClick={() => onTrainRL(rlEpisodesInput === '' ? 100 : rlEpisodesInput, rlLrInput === '' ? 0.001 : rlLrInput)}
                    className="w-full py-2 text-[10px] app-btn-primary"
                  >
                    Train Agents
                  </button>
                )}
              </div>
            </div>

            {/* Training State Section */}
            {(rlLossHistory.length > 0 || rlMetrics !== null || isRlTraining) && (
              <div className="app-section-card space-y-3.5">
                <span className="app-subtitle block">Training State</span>

                {/* 1. Loss Trend */}
                {renderLossChartContent()}

                {/* 2. Character Model Diagnostics */}
                {renderMetricsDashboardContent()}

                {/* 3. Training Progress Bar (Moved to the bottom) */}
                {isRlTraining && (
                  <div className="pt-2 space-y-1.5">
                    <div className="flex justify-between text-[9px] font-mono text-primary">
                      <span className="font-semibold text-zinc-400 dark:text-zinc-600">Progress</span>
                      <span>Ep {rlEpisode} / {rlEpisodesInput || 100}</span>
                    </div>
                    <div className="w-full h-1.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-150"
                        style={{ width: `${rlProgress}%` }}
                      />
                    </div>
                    {rlLoss !== null && (
                      <div className="flex justify-between text-[9px] font-mono text-zinc-500">
                        <span>Avg Training Loss:</span>
                        <span className="font-semibold text-zinc-700 dark:text-zinc-300">{rlLoss.toFixed(6)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Training Model Section (Only visible when not actively training) */}
            {!isRlTraining && (
              <div className="app-section-card space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {/* Left: Save Button */}
                  <button
                    onClick={onSaveRL}
                    disabled={!isRlLoaded}
                    className={`w-full h-[50px] text-[10px] app-btn-outline flex items-center justify-center ${isRlLoaded
                      ? 'outline-primary/20 text-primary hover:bg-primary/5'
                      : 'outline-zinc-300 text-zinc-400 dark:outline-zinc-800 dark:text-zinc-600 cursor-not-allowed opacity-50'
                      }`}
                  >
                    Save Model
                  </button>

                  {/* Right: Upload Container */}
                  <div className="upload-container !h-[50px]">
                    {!isRlLoaded ? (
                      <label className="absolute inset-0 upload-btn-empty">
                        <div className="text-center px-1">
                          <p className="text-[9px] font-semibold font-sans">Upload agents(.json)</p>
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
                    ) : (
                      <div
                        onClick={onClearRL}
                        className="absolute inset-0 upload-btn-filled"
                      >
                        <span className="font-sans text-[8px] text-zinc-400 dark:text-zinc-500 uppercase font-bold">
                          Clear
                        </span>
                        <span className="truncate w-full font-bold px-1" title="model.json">
                          Agents.json
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
