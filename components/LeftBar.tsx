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

  // Turn-based game loop props
  gameStarted: boolean;
  turnOrder: (string | number)[];
  activeRoleIndex: number;
  turnNumber: number;
  onStartGame: () => void;
  onResetGame: () => void;
  onUpdateTurnOrder: (newOrder: (string | number)[]) => void;
  onSkipTurn: () => void;
  rolesConfig: Record<string, { name: string; allowed_types: number[]; allowed_actions: (string | number)[] }>;
}

const ROLE_STYLES: Record<string, { bgClass: string; activeBorderClass: string; dotClass: string }> = {
  "1": {
    bgClass: 'bg-amber-500/10 border-amber-500/25 text-amber-700 dark:text-amber-400',
    activeBorderClass: 'ring-2 ring-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.45)] border-amber-500',
    dotClass: 'bg-amber-500'
  },
  "2": {
    bgClass: 'bg-cyan-500/10 border-cyan-500/25 text-cyan-700 dark:text-cyan-400',
    activeBorderClass: 'ring-2 ring-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.45)] border-cyan-500',
    dotClass: 'bg-cyan-500'
  }
};

const DEFAULT_STYLE = {
  bgClass: 'bg-pink-500/10 border-pink-500/25 text-pink-700 dark:text-pink-400',
  activeBorderClass: 'ring-2 ring-pink-500 shadow-[0_0_15px_rgba(236,72,153,0.45)] border-pink-500',
  dotClass: 'bg-pink-500'
};

const getRoleDetails = (
  role: string | number,
  rolesConfig: Record<string, { name: string; allowed_types: number[]; allowed_actions: (string | number)[] }>
) => {
  const roleIdStr = String(role);
  const config = rolesConfig[roleIdStr];
  const style = ROLE_STYLES[roleIdStr] || DEFAULT_STYLE;

  if (!config) {
    if (roleIdStr === '1' || roleIdStr === 'developer') {
      return {
        name: 'Developer (开发商)',
        desc: 'Places Residential (放置住宅)',
        ...ROLE_STYLES["1"]
      };
    }
    return {
      name: 'Government (政府)',
      desc: 'Places Green (放置绿地)',
      ...ROLE_STYLES["2"]
    };
  }

  const buildingNames = config.allowed_types.map(b => {
    if (b === 1) return 'Residential (住宅)';
    if (b === 2) return 'Green / Park (绿地)';
    return 'Empty (空地)';
  }).join(', ');

  const actionsText = config.allowed_actions.join('/');

  return {
    name: config.name,
    desc: `Builds: ${buildingNames} (${actionsText})`,
    ...style
  };
};

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
  hasTopologyData,

  gameStarted,
  turnOrder,
  activeRoleIndex,
  turnNumber,
  onStartGame,
  onResetGame,
  onUpdateTurnOrder,
  onSkipTurn,
  rolesConfig
}: LeftBarProps) {
  const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    
    const newOrder = [...turnOrder];
    const draggedItem = newOrder[draggedIndex];
    newOrder.splice(draggedIndex, 1);
    newOrder.splice(index, 0, draggedItem);
    
    setDraggedIndex(index);
    onUpdateTurnOrder(newOrder);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };
  return (
    <div className="absolute top-6 left-6 z-10 w-80 max-w-sm rounded-2xl border border-black/10 bg-white/80 dark:border-white/10 dark:bg-black/70 p-5 shadow-2xl backdrop-blur-md transition-all duration-300 hover:border-black/20 dark:hover:border-white/20 text-zinc-800 dark:text-zinc-200 overflow-y-auto max-h-[92vh]">
      
      {/* Loading Indicator */}
      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-3 bg-black/5 dark:bg-black/40 border border-black/5 dark:border-white/5 rounded-xl text-xs font-mono text-pink-500 animate-pulse mb-4">
          Processing Data...
        </div>
      )}

      {/* Game Mode Controls Panel */}
      <div className="mb-4 pb-4 border-b border-black/5 dark:border-white/5 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-bold text-pink-500 uppercase tracking-wider block">Game Mode (回合制博弈)</span>
          {gameStarted && (
            <span className="text-[10px] font-mono font-bold bg-pink-500/20 text-pink-600 dark:text-pink-400 px-2 py-0.5 rounded-full">
              Turn {turnNumber}
            </span>
          )}
        </div>

        {!gameStarted ? (
          /* SETUP PHASE */
          <div className="space-y-3">
            <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-semibold uppercase tracking-wider">Configure Turn Order (Drag to Reorder):</div>
            <div className="space-y-2">
              {turnOrder.map((role, index) => {
                const details = getRoleDetails(role, rolesConfig);
                return (
                  <div 
                    key={role} 
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center justify-between p-2.5 rounded-xl border ${details.bgClass} cursor-grab active:cursor-grabbing transition-all ${
                      draggedIndex === index ? 'opacity-50 border-pink-500' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold">{index + 1}.</span>
                      <span className={`w-2 h-2 rounded-full ${details.dotClass}`}></span>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold font-sans">{details.name}</span>
                        <span className="text-[9px] opacity-75">{details.desc}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2">
              <button 
                onClick={onStartGame}
                disabled={!hasTopologyData}
                className={`flex-1 py-2 rounded-xl text-[10px] font-bold text-white transition-all text-center cursor-pointer ${
                  hasTopologyData 
                    ? 'bg-gradient-to-r from-pink-500 to-rose-500 hover:opacity-95 shadow-lg shadow-pink-500/25' 
                    : 'bg-zinc-400 dark:bg-zinc-700 cursor-not-allowed opacity-50'
                }`}
              >
                🎮 Start Game
              </button>
            </div>
            {!hasTopologyData && (
              <div className="text-[9px] text-zinc-500 text-center font-sans">
                ⚠️ Upload a grid JSON below to enable starting the game.
              </div>
            )}
          </div>
        ) : (
          /* PLAY PHASE */
          <div className="space-y-3">
            <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-semibold uppercase tracking-wider">Whose Turn:</div>
            
            <div className="space-y-2">
              {turnOrder.map((role, index) => {
                const isActive = turnOrder[activeRoleIndex] === role;
                const details = getRoleDetails(role, rolesConfig);
                return (
                  <div 
                    key={role} 
                    className={`flex items-center justify-between p-2.5 rounded-xl border ${details.bgClass} ${isActive ? details.activeBorderClass : 'opacity-40'} transition-all duration-300`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${details.dotClass} ${isActive ? 'animate-pulse' : ''}`}></span>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold font-sans">{details.name}</span>
                        <span className="text-[9px] opacity-75">{details.desc}</span>
                      </div>
                    </div>
                    {isActive && (
                      <span className="text-[9px] font-mono font-bold bg-white/70 dark:bg-black/50 px-2 py-0.5 rounded-md animate-bounce text-pink-600 dark:text-pink-400">
                        ACTIVE 👈
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="space-y-3 pt-1">
              <div className="text-[10px] bg-pink-500/10 border border-pink-500/20 text-pink-600 dark:text-pink-400 p-3 rounded-xl text-center font-sans space-y-1">
                <div className="font-bold">👉 Action: Click Map Tile</div>
                <div className="text-[9px] opacity-90">
                  Click any empty grid tile on the 3D map to place your designated building.
                </div>
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={onSkipTurn}
                  className="flex-1 py-2.5 rounded-xl text-[10px] font-bold border border-black/10 bg-black/5 hover:bg-black/10 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10 transition-all cursor-pointer text-zinc-700 dark:text-zinc-300"
                >
                  ⏭️ Skip Turn (跳过回合)
                </button>
                <button 
                  onClick={onResetGame}
                  className="flex-1 py-2.5 rounded-xl text-[10px] font-bold text-red-500 hover:text-red-400 dark:text-red-400 dark:hover:text-red-300 border border-red-500/20 hover:bg-red-500/5 transition-all text-center cursor-pointer"
                >
                  ⏹️ Reset Game (重置)
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 1: Background City Model */}
      <div className="mb-4 pb-4 border-b border-black/5 dark:border-white/5 space-y-2">
        <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">1. Environment Background</span>
        
        {!modelName ? (
          <label className="flex flex-col items-center justify-center w-full h-16 border border-black/10 border-dashed dark:border-white/10 dark:border-dashed rounded-xl cursor-pointer bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 transition-all">
            <div className="text-center px-4">
              <p className="text-[10px] text-zinc-600 dark:text-zinc-300 font-semibold font-sans">Upload City Model (.glb / .obj)</p>
            </div>
            <input type="file" className="hidden" accept=".glb,.gltf,.obj" onChange={onModelUpload} />
          </label>
        ) : (
          <div className="bg-black/5 border border-black/5 dark:bg-black/35 dark:border-white/5 rounded-xl p-2.5 space-y-2 font-mono text-[10px]">
            <div className="flex justify-between items-center text-zinc-500 dark:text-zinc-400">
              <span className="truncate max-w-[150px] text-zinc-800 dark:text-zinc-200" title={modelName}>{modelName}</span>
              <button onClick={onModelClear} className="text-red-500 hover:text-red-400 dark:text-red-400 dark:hover:text-red-300 font-bold ml-2 cursor-pointer">Clear</button>
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-black/5 dark:border-white/5">
              <span className="text-zinc-600 dark:text-zinc-300 text-[9px] font-semibold uppercase">Force White model</span>
              <button 
                onClick={onToggleForceWhite}
                className={`relative inline-flex h-3.5 w-7 flex-shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 focus:outline-none ${isForceWhite ? 'bg-pink-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}
              >
                <span className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white shadow transition duration-200 ${isForceWhite ? 'translate-x-3.5' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: Interactive Grid */}
      <div className="mb-4 pb-4 border-b border-black/5 dark:border-white/5 space-y-2">
        <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">2. Interactive Topology</span>
        
        {!gridName ? (
          <label className="flex flex-col items-center justify-center w-full h-16 border border-black/10 border-dashed dark:border-white/10 dark:border-dashed rounded-xl cursor-pointer bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 transition-all">
            <div className="text-center px-4">
              <p className="text-[10px] text-zinc-600 dark:text-zinc-300 font-semibold font-sans">Upload Grid (.json)</p>
            </div>
            <input type="file" className="hidden" accept=".json" onChange={onJsonUpload} />
          </label>
        ) : (
          <div className="bg-black/5 border border-black/5 dark:bg-black/35 dark:border-white/5 rounded-xl p-2.5 flex justify-between items-center font-mono text-[10px]">
            <span className="text-zinc-800 dark:text-zinc-300 truncate max-w-[180px]" title={gridName}>{gridName}</span>
            <button onClick={onJsonClear} className="text-red-500 hover:text-red-400 dark:text-red-400 dark:hover:text-red-300 font-bold ml-2 cursor-pointer">Clear</button>
          </div>
        )}
      </div>

      {/* SECTION 3: Macro Indicators */}
      {hasTopologyData && (
        <div className="mb-4 pb-4 border-b border-black/5 dark:border-white/5 space-y-2 font-mono text-[10px]">
          <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">3. Urban Economics</span>
          <div className="bg-black/5 border border-black/5 dark:bg-black/35 dark:border-white/5 rounded-xl p-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-zinc-500 dark:text-zinc-400">Total Population:</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">{macroStats.total_population} Ppl</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-500 dark:text-zinc-400">Developer Profit:</span>
              <span className="font-semibold text-pink-600 dark:text-pink-500">${macroStats.developer_profit.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-500 dark:text-zinc-400">Government Tax:</span>
              <span className="font-semibold text-cyan-600 dark:text-cyan-400">${macroStats.government_tax.toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {/* Controls Guide */}
      <div className="mb-1 space-y-1.5">
        <h2 className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Controls Guide</h2>
        <ul className="text-[10px] text-zinc-700 dark:text-zinc-300 space-y-0.5 bg-black/5 border border-black/5 dark:bg-black/35 dark:border-white/5 rounded-xl p-3 font-mono">
          <li>Left Click + Drag: Rotate</li>
          <li>Right Click + Drag: Pan</li>
          <li>Scroll Wheel: Zoom</li>
        </ul>
      </div>
    </div>
  );
}
