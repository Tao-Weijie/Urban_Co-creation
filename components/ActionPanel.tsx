import React from 'react';
import { useGame } from '../context/GameContext';
import { ActionType, UnitTypeConfig, UnitType } from '@/game_engine/config';

const getUnitTypeName = (type: number) => {
  return UnitTypeConfig[type as UnitType]?.name || 'Empty';
};

export default function ActionPanel() {
  const {
    isGameActionModalOpen,
    selectedUnitForGameAction,
    displayedTopologyData,
    displayedTurnOrder,
    displayedActiveRoleIndex,
    rolesConfig,
    setIsGameActionModalOpen,
    setSelectedUnitForGameAction,
    handleSelectGameAction
  } = useGame();

  const isOpen = isGameActionModalOpen;
  const unit = selectedUnitForGameAction;
  const metadata = displayedTopologyData?.metadata;
  const turnOrder = displayedTurnOrder;
  const activeRoleIndex = displayedActiveRoleIndex;
  const onClose = () => {
    setIsGameActionModalOpen(false);
    setSelectedUnitForGameAction(null);
  };
  const onSelectAction = handleSelectGameAction;
  if (!isOpen || !unit) return null;

  const activeRole = metadata?.next_player ?? turnOrder[activeRoleIndex] ?? 1;
  const allowedBuildings = metadata?.valid_type ?? [];
  const validActions = metadata?.valid_actions ?? [];
  const roleName = rolesConfig[String(activeRole)]?.name ?? `Role ${activeRole}`;

  const isPlaceAllowed = validActions.some(va => va[0] === ActionType.PLACE && va[1] === unit.topology.id);
  const isReplaceAllowed = validActions.some(va => va[0] === ActionType.REPLACE && va[1] === unit.topology.id);

  const targetBuildingType = allowedBuildings.length > 0 ? allowedBuildings[0] : 0;
  const buildingName = getUnitTypeName(targetBuildingType);
  const roleColor = rolesConfig[String(activeRole)]?.color || '#ffffff';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-96 rounded-3xl outline outline-1 outline-black/10 bg-white dark:outline-white/10 dark:bg-zinc-950 p-6 shadow-2xl space-y-5 text-zinc-800 dark:text-zinc-200 animate-in fade-in zoom-in-95 duration-150">

        {/* Panel Header */}
        <div className="flex justify-between items-center pb-2">
          <div>
            <h3 style={{ color: roleColor }} className="text-sm font-bold">
              {roleName}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 font-sans text-lg cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Panel Body */}
        <div className="space-y-3 font-sans text-xs">
          <div className="bg-black/5 dark:bg-white/5 p-3 rounded-xl outline outline-1 outline-black/5 dark:outline-white/5 space-y-1">
            <div className="flex justify-between">
              <span className="text-zinc-500 dark:text-zinc-400">Unit ID:</span>
              <span className="font-mono font-bold">{unit.topology.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500 dark:text-zinc-400">Current Status:</span>
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">{getUnitTypeName(unit.state.type)}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2 w-full">
          {isPlaceAllowed && (
            <button
              onClick={() => onSelectAction(ActionType.PLACE)}
              style={{ backgroundColor: UnitTypeConfig[targetBuildingType as UnitType]?.color }}
              className="flex-1 py-2.5 text-xs font-bold text-white hover:opacity-90 rounded-xl transition duration-150 cursor-pointer flex items-center justify-center"
            >
              {buildingName}
            </button>
          )}

          {isReplaceAllowed && (
            <button
              onClick={() => onSelectAction(ActionType.REPLACE)}
              style={{ backgroundColor: UnitTypeConfig[targetBuildingType as UnitType]?.color }}
              className="flex-1 py-2.5 text-xs font-bold text-white hover:opacity-90 rounded-xl transition duration-150 cursor-pointer flex items-center justify-center"
            >
              {buildingName}
            </button>
          )}

          {!isPlaceAllowed && !isReplaceAllowed && (
            <div className="flex-1 text-center py-2.5 px-3 rounded-xl outline outline-1 outline-dashed outline-red-500/20 bg-red-500/5 text-red-500 font-medium text-[10px] leading-tight flex items-center justify-center">
              No builds
            </div>
          )}

          <button
            onClick={() => onSelectAction(ActionType.SKIP)}
            className="flex-1 py-2.5 text-xs font-bold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 dark:text-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-xl transition duration-150 cursor-pointer flex items-center justify-center"
          >
            Skip
          </button>
        </div>

      </div>
    </div>
  );
}
