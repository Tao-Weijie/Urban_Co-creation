import React from 'react';
import { useGame } from '../context/GameContext';
import { UnitTypeConfig, UnitType } from '@/game_engine/configE';

export default function EditPanel() {
  const {
    isEditModalOpen,
    selectedUnitForEdit,
    setIsEditModalOpen,
    handleSaveUnitEdit
  } = useGame();

  const isOpen = isEditModalOpen;
  const unit = selectedUnitForEdit;
  const onClose = () => setIsEditModalOpen(false);
  const onSave = handleSaveUnitEdit;

  if (!isOpen || !unit) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-96 rounded-3xl outline outline-1 outline-black/10 bg-white dark:outline-white/10 dark:bg-zinc-950 p-6 space-y-5 text-zinc-800 dark:text-zinc-200 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Panel Header */}
        <div className="flex justify-between items-center pb-2">
          <div>
            <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100">
              Edit Unit Properties
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
              <span className="text-zinc-500 dark:text-zinc-400">Current Type:</span>
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                {UnitTypeConfig[unit.state.type as UnitType]?.name || 'Empty'}
              </span>
            </div>
          </div>
        </div>

        {/* Unit Type Action Buttons */}
        <div className="flex gap-2 pt-2 w-full">
          {Object.entries(UnitTypeConfig).map(([typeStr, conf]) => {
            const typeVal = Number(typeStr);
            const isEmpty = typeVal === 0;
            return (
              <button
                key={typeStr}
                onClick={() => {
                  onSave(typeVal);
                  onClose();
                }}
                style={isEmpty ? undefined : { backgroundColor: conf.color }}
                className={
                  isEmpty
                    ? "flex-1 py-2.5 text-xs font-bold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 dark:text-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-xl transition duration-150 cursor-pointer flex items-center justify-center"
                    : "flex-1 py-2.5 text-xs font-bold text-white hover:opacity-90 rounded-xl transition duration-150 cursor-pointer flex items-center justify-center"
                }
              >
                {conf.name}
              </button>
            );
          })}
        </div>

      </div>
    </div>
  );
}
