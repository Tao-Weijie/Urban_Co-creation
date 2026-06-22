import React from 'react';
import { UrbanUnit, TopologyData } from '@/game_engine/topology';

interface HoverPanelProps {
  hoveredUnitInfo: UrbanUnit | null;
  hoverPosition: { x: number; y: number } | null;
  topologyData: TopologyData | null;
}

export default function HoverPanel({ hoveredUnitInfo, hoverPosition, topologyData }: HoverPanelProps) {
  const unit = hoveredUnitInfo;

  if (!unit || !hoverPosition || !topologyData) {
    return null;
  }

  // Find parent block to show block info if needed
  const block = topologyData.blocks.find(b => b.id === unit.parentid);

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
      className="fixed pointer-events-none z-50 w-72 rounded-2xl border border-black/10 bg-white/90 dark:border-white/10 dark:bg-black/85 p-4 shadow-2xl backdrop-blur-md text-zinc-800 dark:text-zinc-200"
    >
      <div className="space-y-3 font-mono text-xs">
        {/* Tooltip Header */}
        <div className="flex justify-between items-center pb-2 border-b border-black/5 dark:border-white/5">
          <span className="text-zinc-500 dark:text-zinc-400">Hovered Unit:</span>
          <span className="font-semibold text-pink-500 truncate max-w-[130px]">
            Unit {unit.id}
          </span>
        </div>
        
        {/* Tooltip Metrics */}
        <div className="space-y-2 text-zinc-600 dark:text-zinc-300">
          <div className="flex justify-between">
            <span>id:</span>
            <span className="text-zinc-950 dark:text-zinc-100 font-semibold">{unit.id}</span>
          </div>
          <div className="flex justify-between">
            <span>parent id:</span>
            <span className="text-zinc-950 dark:text-zinc-100 font-semibold">{unit.parentid}</span>
          </div>
          <div className="flex justify-between">
            <span>type:</span>
            <span className="text-zinc-950 dark:text-zinc-100 font-semibold">
              {unit.type === 1 ? 'residential' : (unit.type === 2 ? 'green' : 'empty')}
            </span>
          </div>
          <div className="flex justify-between">
            <span>height:</span>
            <span className="text-zinc-950 dark:text-zinc-100 font-semibold">{unit.height}</span>
          </div>
          <div className="flex justify-between">
            <span>value:</span>
            <span className="text-pink-500 dark:text-pink-400 font-semibold">{unit.value}</span>
          </div>
          <div className="flex justify-between">
            <span>population:</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{unit.population ?? 0}</span>
          </div>
        </div>
        
        <div className="pt-2 border-t border-black/5 dark:border-white/5 text-[9px] text-zinc-500 dark:text-zinc-400 italic text-center">
          Click on any unit mesh to edit its type.
        </div>
      </div>
    </div>
  );
}

