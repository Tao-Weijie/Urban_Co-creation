import React from 'react';
import { JsonImporter } from './JsonImporter';
import { GlobalStateIndicatorsConfig } from '../game_engine/configE';
import { useGame } from '../context/GameContext';
import { hexToRgba } from './global';

const getRoleDetails = (
  role: string | number,
  rolesConfig: Record<string, { name: string; color: string; allowed_types: number[]; allowed_actions: (string | number)[] }>
) => {
  const roleIdStr = String(role);
  const config = rolesConfig[roleIdStr];
  const color = config?.color || '#ec4899'; // Fallback to pink if config isn't loaded yet

  return {
    name: config?.name || `Role ${roleIdStr}`,
    styles: {
      backgroundColor: hexToRgba(color, 0.1),
      outline: `1px solid ${hexToRgba(color, 0.25)}`,
      color: color
    },
    activeStyles: {
      backgroundColor: hexToRgba(color, 0.1),
      color: color,
      outline: `2px solid ${color}`
    },
    dotStyles: {
      backgroundColor: color
    }
  };
};

export default function LeftBar() {
  const {
    modelName,
    gridName,
    isModelLoading,
    setIsModelLoading,
    isMapLoading,
    setIsMapLoading,
    displayedTopologyData,
    displayedGlobal,
    gameStarted,
    isRlTraining,
    displayedTurnOrder,
    displayedActiveRoleIndex,
    displayedTurnNumber,
    rolesConfig,
    roleAISettings,
    isPaused,
    isGameOver,
    handleToggleRoleAI,
    handleModelUpload,
    clearBackgroundModel,
    clearTopologyGrid,
    handleStartGame,
    handleResetGame,
    setIsPaused,
    setTurnOrder,
    handleJsonImported,
    handleJsonLoadingStart,
    handleJsonLoadingEnd,
    gameHistory
  } = useGame();

  const topologyData = displayedTopologyData;
  const gameHistoryLength = gameHistory?.length ?? 0;
  const global = displayedGlobal;
  const turnOrder = displayedTurnOrder;
  const activeRoleIndex = displayedActiveRoleIndex;
  const turnNumber = displayedTurnNumber;

  const hasTopologyData = topologyData !== null;
  const onModelUpload = handleModelUpload;
  const onModelClear = clearBackgroundModel;
  const onTogglePause = () => setIsPaused(!isPaused);
  const onEndGame = handleResetGame;
  const onToggleRoleAI = handleToggleRoleAI;
  const onUpdateTurnOrder = setTurnOrder;
  const onStartGame = handleStartGame;

  const onJsonImported = handleJsonImported;
  const onJsonLoadingStart = handleJsonLoadingStart;
  const onJsonLoadingEnd = handleJsonLoadingEnd;
  const onJsonClear = clearTopologyGrid;
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
    <div className="left-6 app-sidebar">

      {/* Game Setting Main Header */}
      <div className="mb-4">
        <h2 className="app-title">Game Setting</h2>
      </div>

      {/* Load Urban Section */}
      <div className="mb-4 last:mb-0">
        <div className="app-section-card space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {/* Environment Model Upload */}
            <div className="upload-container">
              {!modelName ? (
                <label className={`absolute inset-0 upload-btn-empty ${(gameStarted || isRlTraining) ? 'disabled' : ''}`}>
                  <div className="text-center px-2">
                    <p className="text-[9px] font-semibold font-sans">Upload model(.obj)</p>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept=".glb,.gltf,.obj"
                    onChange={onModelUpload}
                    disabled={gameStarted || isRlTraining}
                  />
                </label>
              ) : (
                <div
                  onClick={() => {
                    if (!gameStarted && !isRlTraining) {
                      onModelClear();
                    }
                  }}
                  className={`absolute inset-0 upload-btn-filled ${(gameStarted || isRlTraining) ? 'disabled' : ''}`}
                >
                  <span className="font-sans text-[8px] text-zinc-400 dark:text-zinc-500 uppercase font-bold">
                    {(gameStarted || isRlTraining) ? 'Locked' : 'Clear Model'}
                  </span>
                  <span className="truncate w-full font-bold px-1" title={modelName}>{modelName}</span>
                </div>
              )}

              {/* Bottom-to-top wave fill */}
              {isModelLoading && <div className="upload-wave" />}
            </div>

            {/* Interactive Map Upload */}
            <JsonImporter
              gridName={gridName}
              gameStarted={gameStarted || isRlTraining}
              isMapLoading={isMapLoading}
              onJsonClear={onJsonClear}
              onJsonImported={onJsonImported}
              onLoadingStart={onJsonLoadingStart}
              onLoadingEnd={onJsonLoadingEnd}
            />

          </div>
        </div>
      </div>

      {/* Game Mode Controls Panel */}
      <div className="mb-4 last:mb-0">
        <div className="app-section-card space-y-3">
          <div className="flex justify-between items-center">
            <span className="app-subtitle block">Game Mode</span>
            <span className="text-xs text-gray-400">Turn {gameStarted ? turnNumber : 0}/{gameHistoryLength}</span>
          </div>
          {!gameStarted ? (
            /* SETUP PHASE */
            <div className="space-y-3">
              <div className="space-y-2">
                {turnOrder.map((role, index) => {
                  const details = getRoleDetails(role, rolesConfig);
                  const isAIEnabled = roleAISettings[String(role)] || false;
                  return (
                    <div
                      key={role}
                      draggable={!isRlTraining}
                      onDragStart={(e) => {
                        if (isRlTraining) return;
                        handleDragStart(e, index);
                      }}
                      onDragOver={(e) => {
                        if (isRlTraining) return;
                        handleDragOver(e, index);
                      }}
                      onDragEnd={handleDragEnd}
                      style={details.styles}
                      className={`role-bar ${isRlTraining ? 'cursor-not-allowed opacity-60' : 'cursor-grab active:cursor-grabbing'} ${draggedIndex === index ? 'opacity-50 outline-pink-500' : ''}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold font-sans">{details.name}</span>
                      </div>

                      {/* AI Toggle Switch */}
                      <div className="flex items-center gap-1.5 bg-black/5 dark:bg-white/5 px-2 py-1 rounded-lg" onClick={(e) => e.stopPropagation()}>
                        <span className="text-[8px] font-bold text-zinc-500 dark:text-zinc-400">AI</span>
                        <button
                          onClick={() => {
                            if (!isRlTraining) {
                              onToggleRoleAI(String(role));
                            }
                          }}
                          disabled={isRlTraining}
                          className={`app-switch-sm ${isAIEnabled ? 'bg-pink-500' : 'bg-zinc-300 dark:bg-zinc-700'} ${isRlTraining ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <span className={`app-switch-sm-dot ${isAIEnabled ? 'translate-x-3.5' : 'translate-x-0'}`} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-col gap-2">
                <button
                  onClick={onStartGame}
                  disabled={!hasTopologyData || isRlTraining}
                  className={`w-full py-2 text-[10px] app-btn-primary ${(!hasTopologyData || isRlTraining)
                    ? '!bg-zinc-400 dark:!bg-zinc-700 cursor-not-allowed opacity-50'
                    : ''
                    }`}
                >
                  Start Game
                </button>
              </div>
            </div>
          ) : (
            /* PLAY PHASE */
            <div className="space-y-3">
              <div className="space-y-2">
                {fixedRoles.map((roleKey) => {
                  const activeRoleVal = turnOrder[activeRoleIndex];
                  const isActive = String(activeRoleVal) === String(roleKey);
                  const details = getRoleDetails(roleKey, rolesConfig);
                  const isAIEnabled = roleAISettings[String(roleKey)] || false;
                  return (
                    <div
                      key={roleKey}
                      style={isActive ? details.activeStyles : details.styles}
                      className={`role-bar ${isActive ? '' : 'opacity-40'} transition-all duration-300`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold font-sans">
                          {details.name}
                        </span>
                      </div>

                      {/* AI Toggle Switch */}
                      <div className="flex items-center gap-1.5 bg-black/5 dark:bg-white/5 px-2 py-1 rounded-lg">
                        <span className="text-[8px] font-bold text-zinc-500 dark:text-zinc-400">AI</span>
                        <button
                          onClick={() => onToggleRoleAI(String(roleKey))}
                          className={`app-switch-sm ${isAIEnabled ? 'bg-pink-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                        >
                          <span className={`app-switch-sm-dot ${isAIEnabled ? 'translate-x-3.5' : 'translate-x-0'}`} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-2">
                {isGameOver ? (
                  <button
                    onClick={onEndGame}
                    className="w-full py-2 text-[10px] app-btn-primary"
                  >
                    End Game
                  </button>
                ) : (
                  <>
                    <button
                      onClick={onTogglePause}
                      className="flex-1 py-2 text-[10px] app-btn-secondary"
                    >
                      {isPaused ? 'Resume' : 'Pause'}
                    </button>
                    <button
                      onClick={onEndGame}
                      className="flex-1 py-2 text-[10px] app-btn-outline outline-red-500/20 text-red-500 hover:bg-red-500/5 dark:text-red-400 dark:hover:text-red-300"
                    >
                      End Game
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 3: Macro Indicators */}
      {hasTopologyData && (
        <div className="mb-4 last:mb-0">
          <div className="app-section-card space-y-3">
            <span className="app-subtitle block">Game State</span>
            <div className="space-y-2">
              {GlobalStateIndicatorsConfig.map((ind) => {
                const val = ind.getValue(topologyData, global);
                if (val === undefined || val === null) {
                  return null;
                }

                const displayColor = ind.color;
                const formattedVal = typeof val === 'number' ? Math.round(val).toLocaleString() : val;

                return (
                  <div key={ind.key} className="flex justify-between items-center">
                    <span className="indicator-label">{ind.key}:</span>
                    <span
                      className={`indicator-value ${displayColor ? '' : 'text-zinc-700 dark:text-zinc-300'}`}
                      style={displayColor ? { color: displayColor } : undefined}
                    >
                      {formattedVal}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
