import React from 'react';
import { UrbanUnit, ActionType } from '@/game_engine/topology';

interface GameActionModalProps {
  isOpen: boolean;
  unit: UrbanUnit | null;
  activeRole: string | number;
  allowedBehavior: (string | number)[];
  allowedBuildings: number[];
  roleName: string;
  onClose: () => void;
  onSelectAction: (actionType: ActionType) => void;
}

const getUnitTypeName = (type: number) => {
  switch (type) {
    case 1:
      return 'Residential';
    case 2:
      return 'Green / Park';
    default:
      return 'Empty';
  }
};

const getBuildingTypeName = (type: number) => {
  switch (type) {
    case 1:
      return 'Residential';
    case 2:
      return 'Green / Park';
    default:
      return 'Empty';
  }
};

export default function GameActionModal({
  isOpen,
  unit,
  activeRole,
  allowedBehavior,
  allowedBuildings,
  roleName,
  onClose,
  onSelectAction
}: GameActionModalProps) {
  if (!isOpen || !unit) return null;

  const isPlaceAllowed = (allowedBehavior.includes(ActionType.PLACE) || allowedBehavior.includes('place')) && unit.state.type === 0;
  const isReplaceAllowed = (allowedBehavior.includes(ActionType.REPLACE) || allowedBehavior.includes('replace')) && unit.state.type !== 0;

  const targetBuildingType = allowedBuildings.length > 0 ? allowedBuildings[0] : 0;
  const buildingName = getBuildingTypeName(targetBuildingType);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-96 rounded-3xl border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-950 p-6 shadow-2xl space-y-5 text-zinc-800 dark:text-zinc-200 animate-in fade-in zoom-in-95 duration-150">

        {/* Modal Header */}
        <div className="flex justify-between items-center pb-2 border-b border-black/5 dark:border-white/5">
          <div>
            <span className="app-title block">Game Turn Decision</span>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              Role: {roleName}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 font-sans text-lg cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="space-y-3 font-sans text-xs">
          <div className="bg-black/5 dark:bg-white/5 p-3 rounded-xl border border-black/5 dark:border-white/5 space-y-1">
            <div className="flex justify-between">
              <span className="text-zinc-500 dark:text-zinc-400">Target Unit ID:</span>
              <span className="font-mono font-bold">{unit.topology.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500 dark:text-zinc-400">Current Status:</span>
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">{getUnitTypeName(unit.state.type)}</span>
            </div>
          </div>

          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">
            Choose an action to perform on this unit. The turn will advance automatically after action is executed.
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 pt-2">
          {isPlaceAllowed && (
            <button
              onClick={() => onSelectAction(ActionType.PLACE)}
              className="w-full py-3 text-xs font-bold text-white bg-gradient-to-r from-pink-500 to-rose-500 hover:opacity-95 shadow-md shadow-pink-500/10 rounded-xl transition duration-150 cursor-pointer flex items-center justify-center gap-1.5"
            >
              🔨 Place {buildingName}
            </button>
          )}

          {isReplaceAllowed && (
            <button
              onClick={() => onSelectAction(ActionType.REPLACE)}
              className="w-full py-3 text-xs font-bold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-95 shadow-md shadow-orange-500/10 rounded-xl transition duration-150 cursor-pointer flex items-center justify-center gap-1.5"
            >
              Replace with {buildingName}
            </button>
          )}

          {!isPlaceAllowed && !isReplaceAllowed && (
            <div className="text-center py-3 px-4 rounded-xl border border-dashed border-red-500/20 bg-red-500/5 text-red-500 font-medium text-xs">
              No valid actions can be performed on this tile by your role. (Current tile must be empty to place, or occupied to replace).
            </div>
          )}

          <button
            onClick={() => onSelectAction(ActionType.SKIP)}
            className="w-full py-2.5 text-xs font-bold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 dark:text-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-xl transition duration-150 cursor-pointer flex items-center justify-center gap-1.5"
          >
            Skip Turn
          </button>

          <button
            onClick={onClose}
            className="w-full py-2.5 text-xs font-semibold text-zinc-600 bg-black/5 border border-black/10 dark:text-zinc-300 dark:bg-white/5 dark:border-white/10 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 transition duration-150 cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
