import React from 'react';
import { UrbanUnit, TopologyData, UnitTypeConfig, UnitType } from '@/game_engine/config';

import { useGame } from '../context/GameContext';

export default function HoverPanel() {
  const { hoveredUnitInfo, hoverPosition, displayedTopologyData } = useGame();
  const unit = hoveredUnitInfo;
  const topologyData = displayedTopologyData;

  if (!unit || !hoverPosition || !topologyData) {
    return null;
  }

  // Find parent block to show block info if needed
  const block = topologyData.blocks.find(b => b.topology.id === unit.topology.blockid);

  // Prevent overflow outside of viewport boundaries
  let left = hoverPosition.x + 15;
  let top = hoverPosition.y + 15;

  if (typeof window !== 'undefined') {
    const tooltipWidth = 288; // w-72 matches 288px width
    const tooltipHeight = 240; // Approximate max height of the panel

    if (left + tooltipWidth > window.innerWidth) {
      left = hoverPosition.x - tooltipWidth - 15;
    }
    if (top + tooltipHeight > window.innerHeight) {
      top = hoverPosition.y - tooltipHeight - 15;
    }

    // Keep it on screen
    left = Math.max(10, left);
    top = Math.max(10, top);
  }

  return (
    <div 
      style={{ left, top }}
      className="fixed pointer-events-none z-50 w-72 app-bar p-4"
    >
      <div className="space-y-3 font-mono text-xs">
        {/* Tooltip Header */}
        <div className="space-y-2">
          <div className="flex justify-between items-center pb-1">
            <span className="text-zinc-500 dark:text-zinc-400">Hovered Unit:</span>
            <span className="font-semibold text-pink-500 truncate max-w-[130px]">
              Unit {unit.topology.id}
            </span>
          </div>
          <div className="h-[1px] bg-black/5 dark:bg-white/5 w-full" />
        </div>
        
        {/* Tooltip Metrics */}
        <div className="space-y-2 text-zinc-600 dark:text-zinc-300">
          <div className="flex justify-between">
            <span>id:</span>
            <span className="text-zinc-950 dark:text-zinc-100 font-semibold">{unit.topology.id}</span>
          </div>
          <div className="flex justify-between">
            <span>block id:</span>
            <span className="text-zinc-950 dark:text-zinc-100 font-semibold">{unit.topology.blockid}</span>
          </div>
          <div className="flex justify-between">
            <span>building id:</span>
            <span className="text-zinc-950 dark:text-zinc-100 font-semibold">{unit.topology.buildingid}</span>
          </div>
          <div className="flex justify-between">
            <span>id in building:</span>
            <span className="text-zinc-950 dark:text-zinc-100 font-semibold">{unit.topology.idinbuilding}</span>
          </div>
          <div className="flex justify-between">
            <span>type:</span>
            <span className="text-zinc-950 dark:text-zinc-100 font-semibold">
              {UnitTypeConfig[unit.state.type as UnitType]?.name || 'Empty'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>height:</span>
            <span className="text-zinc-950 dark:text-zinc-100 font-semibold">{unit.geometry.height}</span>
          </div>
          <div className="flex justify-between">
            <span>block value:</span>
            <span className="text-pink-500 dark:text-pink-400 font-semibold">{block?.state?.value ?? 0}</span>
          </div>
          <div className="flex justify-between">
            <span>population:</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{unit.state.population ?? 0}</span>
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="h-[1px] bg-black/5 dark:bg-white/5 w-full" />
          <div className="pt-1 text-[9px] text-zinc-500 dark:text-zinc-400 italic text-center">
            Click on any unit mesh to edit its type.
          </div>
        </div>
      </div>
    </div>
  );
}

