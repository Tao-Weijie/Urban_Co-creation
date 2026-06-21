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
  isModelLoading?: boolean;
  isMapLoading?: boolean;

  // Turn-based game loop props
  gameStarted: boolean;
  turnOrder: (string | number)[];
  activeRoleIndex: number;
  turnNumber: number;
  onStartGame: () => void;
  onUpdateTurnOrder: (newOrder: (string | number)[]) => void;
  rolesConfig: Record<string, { name: string; allowed_types: number[]; allowed_actions: (string | number)[] }>;
  roleAISettings: Record<string, boolean>;
  onToggleRoleAI: (roleId: string) => void;
  isPaused: boolean;
  isGameOver: boolean;
  onTogglePause: () => void;
  onEndGame: () => void;
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
        name: 'Developer',
        ...ROLE_STYLES["1"]
      };
    }
    return {
      name: 'Government',
      ...ROLE_STYLES["2"]
    };
  }

  return {
    name: config.name,
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
  isModelLoading = false,
  isMapLoading = false,
  gameStarted,
  turnOrder,
  activeRoleIndex,
  turnNumber,
  onStartGame,
  onUpdateTurnOrder,
  rolesConfig,
  roleAISettings,
  onToggleRoleAI,
  isPaused,
  isGameOver,
  onTogglePause,
  onEndGame
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

  // Determine fixed list of roles sorted by ID
  const fixedRoles = Object.keys(rolesConfig).length > 0 
    ? Object.keys(rolesConfig).map(Number).sort((a, b) => a - b)
    : [1, 2];

  return (
    <div className="absolute top-6 left-6 z-10 w-80 max-w-sm rounded-2xl border border-black/10 bg-white/80 dark:border-white/10 dark:bg-black/70 p-5 shadow-2xl backdrop-blur-md transition-all duration-300 hover:border-black/20 dark:hover:border-white/20 text-zinc-800 dark:text-zinc-200 overflow-y-auto max-h-[92vh]">

      {/* Inline styles for custom upload animations */}
      <style>{`
        @keyframes fillUp {
          0% {
            height: 0%;
            opacity: 0.15;
          }
          50% {
            height: 100%;
            opacity: 0.55;
          }
          100% {
            height: 100%;
            opacity: 0;
          }
        }
      `}</style>



      {/* Load Urban Section */}
      <div className="mb-4 pb-4 border-b border-black/5 dark:border-white/5 space-y-2">
        <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">Load Urban</span>
        <div className="grid grid-cols-2 gap-3">
          
          {/* Environment Model Upload */}
          <div className="relative overflow-hidden rounded-xl h-20">
            {!modelName ? (
              <label 
                className={`absolute inset-0 flex flex-col items-center justify-center border border-dashed rounded-xl transition-all ${
                  gameStarted 
                    ? 'border-zinc-300 dark:border-zinc-800 opacity-40 cursor-not-allowed' 
                    : 'border-zinc-300 hover:border-pink-500 dark:border-zinc-700 dark:hover:border-pink-500 bg-transparent cursor-pointer'
                }`}
              >
                <div className="text-center px-2">
                  <p className="text-[9px] text-zinc-500 dark:text-zinc-400 font-semibold font-sans">Upload model(.obj)</p>
                </div>
                <input 
                  type="file" 
                  className="hidden" 
                  accept=".glb,.gltf,.obj" 
                  onChange={onModelUpload} 
                  disabled={gameStarted} 
                />
              </label>
            ) : (
              <div 
                onClick={() => {
                  if (!gameStarted) {
                    onModelClear();
                  }
                }}
                className={`absolute inset-0 flex flex-col items-center justify-center border rounded-xl p-2 font-mono text-[9px] transition-all text-center select-none ${
                  gameStarted 
                    ? 'border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800/30 text-zinc-400 dark:text-zinc-600 opacity-40 cursor-not-allowed' 
                    : 'border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800/50 text-zinc-700 dark:text-zinc-300 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-500 cursor-pointer group'
                }`}
              >
                <span className="font-sans text-[8px] text-zinc-400 dark:text-zinc-500 group-hover:text-red-500/80 transition-colors uppercase font-bold mb-1">
                  {gameStarted ? 'Locked' : 'Clear Model'}
                </span>
                <span className="truncate w-full font-bold px-1" title={modelName}>{modelName}</span>
                {/* Force White model switch in active mode */}
                <div className="mt-1 flex items-center justify-center gap-1 group-hover:hidden" onClick={(e) => e.stopPropagation()}>
                  <span className="text-[7px] text-zinc-500">white:</span>
                  <button 
                    onClick={onToggleForceWhite}
                    className={`relative inline-flex h-2.5 w-5 flex-shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 focus:outline-none ${isForceWhite ? 'bg-pink-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                  >
                    <span className={`inline-block h-1.5 w-1.5 transform rounded-full bg-white shadow transition duration-200 ${isForceWhite ? 'translate-x-2.5' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
            )}

            {/* Bottom-to-top wave fill */}
            {isModelLoading && (
              <div className="absolute bottom-0 left-0 right-0 bg-pink-500 dark:bg-pink-500 pointer-events-none animate-[fillUp_1.8s_ease-in-out_infinite]" />
            )}
          </div>

          {/* Interactive Map Upload */}
          <div className="relative overflow-hidden rounded-xl h-20">
            {!gridName ? (
              <label 
                className={`absolute inset-0 flex flex-col items-center justify-center border border-dashed rounded-xl transition-all ${
                  gameStarted 
                    ? 'border-zinc-300 dark:border-zinc-800 opacity-40 cursor-not-allowed' 
                    : 'border-zinc-300 hover:border-pink-500 dark:border-zinc-700 dark:hover:border-pink-500 bg-transparent cursor-pointer'
                }`}
              >
                <div className="text-center px-2">
                  <p className="text-[9px] text-zinc-500 dark:text-zinc-400 font-semibold font-sans">Upload map(.json)</p>
                </div>
                <input 
                  type="file" 
                  className="hidden" 
                  accept=".json" 
                  onChange={onJsonUpload} 
                  disabled={gameStarted} 
                />
              </label>
            ) : (
              <div 
                onClick={() => {
                  if (!gameStarted) {
                    onJsonClear();
                  }
                }}
                className={`absolute inset-0 flex flex-col items-center justify-center border rounded-xl p-2 font-mono text-[9px] transition-all text-center select-none ${
                  gameStarted 
                    ? 'border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800/30 text-zinc-400 dark:text-zinc-600 opacity-40 cursor-not-allowed' 
                    : 'border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800/50 text-zinc-700 dark:text-zinc-300 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-500 cursor-pointer group'
                }`}
              >
                <span className="font-sans text-[8px] text-zinc-400 dark:text-zinc-500 group-hover:text-red-500/80 transition-colors uppercase font-bold mb-1">
                  {gameStarted ? 'Locked' : 'Clear Map'}
                </span>
                <span className="truncate w-full font-bold px-1" title={gridName}>{gridName}</span>
              </div>
            )}

            {/* Bottom-to-top wave fill */}
            {isMapLoading && (
              <div className="absolute bottom-0 left-0 right-0 bg-pink-500 dark:bg-pink-500 pointer-events-none animate-[fillUp_1.8s_ease-in-out_infinite]" />
            )}
          </div>

        </div>
      </div>

      {/* Game Mode Controls Panel */}
      <div className="mb-4 pb-4 border-b border-black/5 dark:border-white/5 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-bold text-pink-500 uppercase tracking-wider block">Game Mode</span>
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
                const isAIEnabled = roleAISettings[String(role)] || false;
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
                      </div>
                    </div>

                    {/* AI Toggle Switch */}
                    <div className="flex items-center gap-1.5 bg-black/5 dark:bg-white/5 px-2 py-1 rounded-lg" onClick={(e) => e.stopPropagation()}>
                      <span className="text-[8px] font-bold text-zinc-500 dark:text-zinc-400">AI</span>
                      <button 
                        onClick={() => onToggleRoleAI(String(role))}
                        className={`relative inline-flex h-3.5 w-7 flex-shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 focus:outline-none ${isAIEnabled ? 'bg-pink-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                      >
                        <span className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white shadow transition duration-200 ${isAIEnabled ? 'translate-x-3.5' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col gap-2">
              <button 
                onClick={onStartGame}
                disabled={!hasTopologyData}
                className={`w-full py-2 rounded-xl text-[10px] font-bold text-white transition-all text-center cursor-pointer ${
                  hasTopologyData
                    ? 'bg-gradient-to-r from-pink-500 to-rose-500 hover:opacity-95 shadow-lg shadow-pink-500/25' 
                    : 'bg-zinc-400 dark:bg-zinc-700 cursor-not-allowed opacity-50'
                }`}
              >
                Start Game
              </button>
            </div>
            {!hasTopologyData && (
              <div className="text-[9px] text-zinc-500 text-center font-sans">
                Upload a grid JSON below to enable starting the game.
              </div>
            )}
          </div>
        ) : (
          /* PLAY PHASE */
          <div className="space-y-3">
            <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-semibold uppercase tracking-wider">Whose Turn:</div>
            
            <div className="space-y-2">
              {fixedRoles.map((roleKey) => {
                const activeRoleVal = turnOrder[activeRoleIndex];
                const isActive = String(activeRoleVal) === String(roleKey);
                const details = getRoleDetails(roleKey, rolesConfig);
                const isAIEnabled = roleAISettings[String(roleKey)] || false;
                return (
                  <div 
                    key={roleKey} 
                    className={`flex items-center justify-between p-2.5 rounded-xl border ${details.bgClass} ${isActive ? details.activeBorderClass : 'opacity-40'} transition-all duration-300`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${details.dotClass} ${isActive ? 'animate-pulse' : ''}`}></span>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold font-sans">
                          {details.name}
                        </span>
                      </div>
                    </div>

                    {/* AI Toggle Switch */}
                    <div className="flex items-center gap-1.5 bg-black/5 dark:bg-white/5 px-2 py-1 rounded-lg">
                      <span className="text-[8px] font-bold text-zinc-500 dark:text-zinc-400">AI</span>
                      <button 
                        onClick={() => onToggleRoleAI(String(roleKey))}
                        className={`relative inline-flex h-3.5 w-7 flex-shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 focus:outline-none ${isAIEnabled ? 'bg-pink-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                      >
                        <span className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white shadow transition duration-200 ${isAIEnabled ? 'translate-x-3.5' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="space-y-3 pt-1">
              <div className="flex gap-2">
                {isGameOver ? (
                  <button 
                    onClick={onEndGame}
                    className="w-full py-2.5 rounded-xl text-[10px] font-bold text-white bg-gradient-to-r from-red-500 to-rose-600 hover:opacity-95 shadow-lg shadow-red-500/25 transition-all text-center cursor-pointer"
                  >
                    End Game
                  </button>
                ) : (
                  <>
                    <button 
                      onClick={onTogglePause}
                      className="flex-1 py-2.5 rounded-xl text-[10px] font-bold border border-black/10 bg-black/5 hover:bg-black/10 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-300 transition-all cursor-pointer"
                    >
                      {isPaused ? 'Resume' : 'Pause'}
                    </button>
                    <button 
                      onClick={onEndGame}
                      className="flex-1 py-2.5 rounded-xl text-[10px] font-bold text-red-500 hover:text-red-400 dark:text-red-400 dark:hover:text-red-300 border border-red-500/20 hover:bg-red-500/5 transition-all text-center cursor-pointer"
                    >
                      End Game
                    </button>
                  </>
                )}
              </div>
            </div>
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
              <span className="text-zinc-500 dark:text-zinc-400">Developer Capital:</span>
              <span className="font-semibold text-pink-600 dark:text-pink-500">${macroStats.developer_profit.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-500 dark:text-zinc-400">Government Capital:</span>
              <span className="font-semibold text-cyan-600 dark:text-cyan-400">${macroStats.government_tax.toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
