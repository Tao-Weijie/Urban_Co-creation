import React from 'react';

interface BottomBarProps {
  onSetView: (view: 'top' | 'front' | 'left') => void;
}

export default function BottomBar({ onSetView }: BottomBarProps) {
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/60 px-5 py-3 shadow-2xl backdrop-blur-md transition-all duration-300 hover:border-white/20">
      <button
        onClick={() => onSetView('top')}
        className="rounded-xl bg-white/5 border border-white/5 hover:bg-white/12 hover:border-white/15 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider transition-all duration-150 active:scale-95"
      >
        Top View
      </button>
      <div className="h-4 w-[1px] bg-white/10" />
      <button
        onClick={() => onSetView('front')}
        className="rounded-xl bg-white/5 border border-white/5 hover:bg-white/12 hover:border-white/15 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider transition-all duration-150 active:scale-95"
      >
        Front View
      </button>
      <div className="h-4 w-[1px] bg-white/10" />
      <button
        onClick={() => onSetView('left')}
        className="rounded-xl bg-white/5 border border-white/5 hover:bg-white/12 hover:border-white/15 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider transition-all duration-150 active:scale-95"
      >
        Left View
      </button>
    </div>
  );
}
