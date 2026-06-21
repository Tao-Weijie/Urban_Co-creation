import React from 'react';

interface BottomBarProps {
  onSetView: (view: 'top' | 'front' | 'left') => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;

  // Game and Timeline States
  gameStarted: boolean;
  gameHistoryLength: number;
  currentIndex: number;
  onIndexChange: (index: number) => void;
  isDraggable: boolean;
  isPlaying: boolean;
  onTogglePlay: () => void;
  fps: number;
  onFpsChange: (fps: number) => void;
}

export default function BottomBar({
  onSetView,
  theme,
  onToggleTheme,
  gameStarted,
  gameHistoryLength,
  currentIndex,
  onIndexChange,
  isDraggable,
  isPlaying,
  onTogglePlay,
  fps,
  onFpsChange
}: BottomBarProps) {
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center rounded-2xl border border-black/10 bg-white/80 dark:border-white/10 dark:bg-black/70 px-5 h-[54px] shadow-2xl backdrop-blur-md transition-all duration-500 hover:border-black/20 dark:hover:border-white/20 text-zinc-800 dark:text-zinc-200">
      
      {/* View Selectors & Theme Toggle (Always Visible Left Side) */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => onSetView('top')}
          className="flex-shrink-0 w-[68px] text-center rounded-xl bg-black/5 border border-black/5 dark:bg-white/5 dark:border-white/5 hover:bg-black/10 dark:hover:bg-white/12 py-2 text-[11px] font-bold uppercase tracking-wider transition-all duration-150 active:scale-95 cursor-pointer"
        >
          Top
        </button>
        <div className="h-4 w-[1px] bg-black/10 dark:bg-white/10 flex-shrink-0" />
        <button
          onClick={() => onSetView('front')}
          className="flex-shrink-0 w-[68px] text-center rounded-xl bg-black/5 border border-black/5 dark:bg-white/5 dark:border-white/5 hover:bg-black/10 dark:hover:bg-white/12 py-2 text-[11px] font-bold uppercase tracking-wider transition-all duration-150 active:scale-95 cursor-pointer"
        >
          Front
        </button>
        <div className="h-4 w-[1px] bg-black/10 dark:bg-white/10 flex-shrink-0" />
        <button
          onClick={() => onSetView('left')}
          className="flex-shrink-0 w-[68px] text-center rounded-xl bg-black/5 border border-black/5 dark:bg-white/5 dark:border-white/5 hover:bg-black/10 dark:hover:bg-white/12 py-2 text-[11px] font-bold uppercase tracking-wider transition-all duration-150 active:scale-95 cursor-pointer"
        >
          Left
        </button>
        <div className="h-4 w-[1px] bg-black/10 dark:bg-white/10 flex-shrink-0" />
        
        <button
          onClick={onToggleTheme}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none self-center ${
            theme === 'dark' ? 'bg-zinc-700' : 'bg-zinc-300/80'
          }`}
          title="Toggle Theme Mode"
        >
          <span
            className={`pointer-events-none relative inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition duration-200 ease-in-out ${
              theme === 'dark' ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Timeline Control Segment (Grows to the right when gameStarted is active) */}
      <div 
        className={`relative flex items-center transition-all duration-500 ease-in-out ${
          gameStarted && gameHistoryLength > 0
            ? 'w-[480px] opacity-100 translate-x-0 ml-4 pl-4 border-l border-black/10 dark:border-white/10'
            : 'w-0 opacity-0 translate-x-10 pointer-events-none ml-0 pl-0 border-l-transparent overflow-hidden'
        }`}
      >
        {gameStarted && gameHistoryLength > 0 && (
          <div className="flex items-center gap-4 w-full animate-in fade-in slide-in-from-left-4 duration-300 delay-100">
            {/* Play/Pause Button */}
            <button
              onClick={onTogglePlay}
              disabled={!isDraggable && gameHistoryLength <= 1}
              className={`flex items-center justify-center w-7 h-7 rounded-xl bg-pink-500 hover:bg-pink-600 text-white transition-all shadow-md cursor-pointer ${
                (!isDraggable && gameHistoryLength <= 1) ? 'opacity-50 cursor-not-allowed bg-zinc-400 hover:bg-zinc-400' : ''
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
              <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 px-2 py-0.5 rounded-lg">
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
              <span className="font-bold bg-pink-500/10 border border-pink-500/20 text-pink-600 dark:text-pink-400 px-2.5 py-1 rounded-lg">
                Turn {currentIndex + 1}/{gameHistoryLength}
              </span>
            </div>


          </div>
        )}
      </div>

    </div>
  );
}
