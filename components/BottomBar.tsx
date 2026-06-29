import React from 'react';

import { useGame } from '../context/GameContext';

export default function BottomBar() {
  const {
    setStandardView,
    theme,
    handleToggleTheme,
    gameStarted,
    gameHistory,
    currentHistoryIndex,
    setCurrentHistoryIndex,
    isPaused,
    isGameOver,
    isTimelinePlaying,
    setIsTimelinePlaying,
    timelineFps,
    setTimelineFps
  } = useGame();

  const onSetView = setStandardView;
  const onToggleTheme = handleToggleTheme;
  const gameHistoryLength = gameHistory.length;
  const currentIndex = currentHistoryIndex;
  const onIndexChange = setCurrentHistoryIndex;
  const isDraggable = isPaused || isGameOver;
  const isPlaying = isTimelinePlaying;
  const onTogglePlay = () => setIsTimelinePlaying(!isTimelinePlaying);
  const fps = timelineFps;
  const onFpsChange = setTimelineFps;
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center app-bar p-4 duration-500">
      
      {/* View Selectors & Theme Toggle (Always Visible Left Side) */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => onSetView('top')}
          className="flex-shrink-0 w-[68px] py-2 text-[10px] app-btn-secondary"
        >
          Top
        </button>
        <button
          onClick={() => onSetView('front')}
          className="flex-shrink-0 w-[68px] py-2 text-[10px] app-btn-secondary"
        >
          Front
        </button>
        <button
          onClick={() => onSetView('left')}
          className="flex-shrink-0 w-[68px] py-2 text-[10px] app-btn-secondary"
        >
          Left
        </button>
        
        <button
          onClick={onToggleTheme}
          className={`app-switch-md self-center ${
            theme === 'dark' ? 'bg-zinc-700' : 'bg-zinc-300/80'
          }`}
          title="Toggle Theme Mode"
        >
          <span
            className={`app-switch-md-dot ${
              theme === 'dark' ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Timeline Control Segment (Grows to the right when gameStarted is active) */}
      <div 
        className={`relative flex items-center transition-all duration-500 ease-in-out overflow-hidden ${
          gameStarted && gameHistoryLength > 0
            ? 'w-[480px] opacity-100 translate-x-0 ml-4'
            : 'w-0 opacity-0 translate-x-10 pointer-events-none ml-0'
        }`}
      >
        {gameStarted && gameHistoryLength > 0 && (
          <div className="flex items-center gap-4 w-[480px] flex-shrink-0 animate-in fade-in slide-in-from-left-4 duration-300 delay-100">
            {/* Play/Pause Button */}
            <button
              onClick={onTogglePlay}
              disabled={!isDraggable && gameHistoryLength <= 1}
              className={`app-btn-primary w-7 h-7 !gap-0 ${
                (!isDraggable && gameHistoryLength <= 1) ? '!bg-zinc-400 cursor-not-allowed opacity-50' : ''
              }`}
              title={isPlaying ? "Pause Playback" : "Start Playback"}
            >
              {isPlaying ? (
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            {/* Slider with labels */}
            <div className="flex-1 flex items-center gap-2">
              <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500">1</span>
              <input
                type="range"
                min={0}
                max={gameHistoryLength - 1}
                value={currentIndex}
                disabled={!isDraggable || isPlaying}
                onChange={(e) => onIndexChange(parseInt(e.target.value))}
                className={`flex-1 h-1.5 rounded-lg appearance-none bg-zinc-200 dark:bg-zinc-800 cursor-pointer accent-pink-500 outline-none ${
                  (!isDraggable || isPlaying) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-zinc-300 dark:hover:bg-zinc-700'
                }`}
              />
              <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500">{gameHistoryLength}</span>
            </div>

            {/* Info and FPS */}
            <div className="flex items-center gap-2 font-mono text-[9px]">
              {/* FPS Input */}
              <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 outline outline-1 outline-black/5 dark:outline-white/10 px-2 py-0.5 rounded-lg">
                <span className="text-zinc-400">FPS:</span>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={fps}
                  onChange={(e) => {
                    const parsedVal = parseInt(e.target.value);
                    const nextFps = Math.max(1, Math.min(60, isNaN(parsedVal) ? 1 : parsedVal));
                    onFpsChange(nextFps);
                  }}
                  className="w-7 bg-transparent text-center border-none outline-none font-bold text-pink-500"
                />
              </div>

              {/* Turn X / Y Badge */}
              <span className="font-bold bg-pink-500/10 outline outline-1 outline-pink-500/20 text-pink-600 dark:text-pink-400 px-2.5 py-1 rounded-lg">
                Turn {currentIndex + 1}/{gameHistoryLength}
              </span>
            </div>

          </div>
        )}
      </div>

    </div>
  );
}
