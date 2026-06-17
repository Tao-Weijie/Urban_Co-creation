import React from 'react';

interface BottomBarProps {
  onSetView: (view: 'top' | 'front' | 'left') => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export default function BottomBar({ onSetView, theme, onToggleTheme }: BottomBarProps) {
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 rounded-2xl border border-black/10 bg-white/70 dark:border-white/10 dark:bg-black/60 px-5 py-3 shadow-2xl backdrop-blur-md transition-all duration-300 hover:border-black/20 dark:hover:border-white/20 text-zinc-800 dark:text-zinc-200">
      <button
        onClick={() => onSetView('top')}
        className="rounded-xl bg-black/5 border border-black/5 dark:bg-white/5 dark:border-white/5 hover:bg-black/10 dark:hover:bg-white/12 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider transition-all duration-150 active:scale-95 cursor-pointer"
      >
        Top View
      </button>
      <div className="h-4 w-[1px] bg-black/10 dark:bg-white/10" />
      <button
        onClick={() => onSetView('front')}
        className="rounded-xl bg-black/5 border border-black/5 dark:bg-white/5 dark:border-white/5 hover:bg-black/10 dark:hover:bg-white/12 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider transition-all duration-150 active:scale-95 cursor-pointer"
      >
        Front View
      </button>
      <div className="h-4 w-[1px] bg-black/10 dark:bg-white/10" />
      <button
        onClick={() => onSetView('left')}
        className="rounded-xl bg-black/5 border border-black/5 dark:bg-white/5 dark:border-white/5 hover:bg-black/10 dark:hover:bg-white/12 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider transition-all duration-150 active:scale-95 cursor-pointer"
      >
        Left View
      </button>
      <div className="h-4 w-[1px] bg-black/10 dark:bg-white/10" />
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
  );
}
