import React from 'react';

interface LeftBarProps {
  modelName: string;
  gridName: string;
  isLoading: boolean;
  macroStats: {
    total_population: number;
    developer_profit: number;
    government_tax: number;
  };
  isForceWhite: boolean;
  onModelUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onModelClear: () => void;
  onJsonUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onJsonClear: () => void;
  onToggleForceWhite: () => void;
  hasTopologyData: boolean;
}

export default function LeftBar({
  modelName,
  gridName,
  isLoading,
  macroStats,
  isForceWhite,
  onModelUpload,
  onModelClear,
  onJsonUpload,
  onJsonClear,
  onToggleForceWhite,
  hasTopologyData
}: LeftBarProps) {
  return (
    <div className="absolute top-6 left-6 z-10 w-80 max-w-sm rounded-2xl border border-white/10 bg-black/60 p-5 shadow-2xl backdrop-blur-md transition-all duration-300 hover:border-white/20">
      
      {/* Loading Indicator */}
      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-3 bg-black/40 border border-white/5 rounded-xl text-xs font-mono text-pink-500 animate-pulse mb-4">
          Processing Data...
        </div>
      )}

      {/* SECTION 1: Background City Model */}
      <div className="mb-4 pb-4 border-b border-white/5 space-y-2">
        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">1. Environment Background</span>
        
        {!modelName ? (
          <label className="flex flex-col items-center justify-center w-full h-16 border border-white/10 border-dashed rounded-xl cursor-pointer bg-white/5 hover:bg-white/10 transition-all">
            <div className="text-center px-4">
              <p className="text-[10px] text-zinc-300 font-semibold font-sans">Upload City Model (.glb / .obj)</p>
            </div>
            <input type="file" className="hidden" accept=".glb,.gltf,.obj" onChange={onModelUpload} />
          </label>
        ) : (
          <div className="bg-black/35 border border-white/5 rounded-xl p-2.5 space-y-2 font-mono text-[10px]">
            <div className="flex justify-between items-center text-zinc-400">
              <span className="truncate max-w-[150px]" title={modelName}>{modelName}</span>
              <button onClick={onModelClear} className="text-red-400 hover:text-red-300 font-bold ml-2">Clear</button>
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-white/5">
              <span className="text-zinc-300 text-[9px] font-semibold uppercase">Force White model</span>
              <button 
                onClick={onToggleForceWhite}
                className={`relative inline-flex h-3.5 w-7 flex-shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 focus:outline-none ${isForceWhite ? 'bg-pink-500' : 'bg-zinc-700'}`}
              >
                <span className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white shadow transition duration-200 ${isForceWhite ? 'translate-x-3.5' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: Interactive Grid */}
      <div className="mb-4 pb-4 border-b border-white/5 space-y-2">
        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">2. Interactive Topology</span>
        
        {!gridName ? (
          <label className="flex flex-col items-center justify-center w-full h-16 border border-white/10 border-dashed rounded-xl cursor-pointer bg-white/5 hover:bg-white/10 transition-all">
            <div className="text-center px-4">
              <p className="text-[10px] text-zinc-300 font-semibold font-sans">Upload Grid (.json)</p>
            </div>
            <input type="file" className="hidden" accept=".json" onChange={onJsonUpload} />
          </label>
        ) : (
          <div className="bg-black/35 border border-white/5 rounded-xl p-2.5 flex justify-between items-center font-mono text-[10px]">
            <span className="text-zinc-300 truncate max-w-[180px]" title={gridName}>{gridName}</span>
            <button onClick={onJsonClear} className="text-red-400 hover:text-red-300 font-bold ml-2">Clear</button>
          </div>
        )}
      </div>

      {/* SECTION 3: Macro Indicators */}
      {hasTopologyData && (
        <div className="mb-4 pb-4 border-b border-white/5 space-y-2 font-mono text-[10px]">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">3. Urban Economics</span>
          <div className="bg-black/35 border border-white/5 rounded-xl p-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-zinc-400">Total Population:</span>
              <span className="font-semibold text-emerald-400">{macroStats.total_population} Ppl</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-400">Developer Profit:</span>
              <span className="font-semibold text-pink-500">${macroStats.developer_profit.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-400">Government Tax:</span>
              <span className="font-semibold text-cyan-400">${macroStats.government_tax.toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {/* Controls Guide */}
      <div className="mb-1 space-y-1.5">
        <h2 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Controls Guide</h2>
        <ul className="text-[10px] text-zinc-300 space-y-0.5 bg-black/35 rounded-xl p-3 border border-white/5 font-mono">
          <li>Left Click + Drag: Rotate</li>
          <li>Right Click + Drag: Pan</li>
          <li>Scroll Wheel: Zoom</li>
        </ul>
      </div>
    </div>
  );
}
