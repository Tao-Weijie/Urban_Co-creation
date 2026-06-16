import React from 'react';
import { Face } from '@/rules/evaluate';

interface FacePropertiesPanelProps {
  hoveredFaceInfo: Face | null;
  hoverPosition: { x: number; y: number } | null;
}

export default function FacePropertiesPanel({ hoveredFaceInfo, hoverPosition }: FacePropertiesPanelProps) {
  // Only display the panel if hovering over a non-empty (occupied) block
  const isOccupiedBlock = 
    hoveredFaceInfo && 
    hoveredFaceInfo.state?.built_type !== 'empty' && 
    hoveredFaceInfo.state?.is_occupied;

  if (!hoveredFaceInfo || !hoverPosition || !isOccupiedBlock) {
    return null;
  }

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
      className="fixed pointer-events-none z-50 w-72 rounded-2xl border border-white/10 bg-black/85 p-4 shadow-2xl backdrop-blur-md"
    >
      <div className="space-y-3 font-mono text-xs">
        {/* Tooltip Header */}
        <div className="flex justify-between items-center pb-2 border-b border-white/5">
          <span className="text-zinc-400">Hovered Face:</span>
          <span className="font-semibold text-pink-500 truncate max-w-[130px]">
            Face {hoveredFaceInfo.id}
          </span>
        </div>
        
        {/* Tooltip Metrics */}
        <div className="space-y-2 text-zinc-300">
          <div className="flex justify-between">
            <span>Face ID:</span>
            <span className="text-zinc-100 font-semibold">{hoveredFaceInfo.id}</span>
          </div>
          <div className="flex justify-between">
            <span>Occupied:</span>
            <span className={`font-semibold ${hoveredFaceInfo.state?.is_occupied ? 'text-emerald-400' : 'text-zinc-500'}`}>
              {hoveredFaceInfo.state?.is_occupied ? 'YES' : 'NO'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Build Type:</span>
            <span className="text-zinc-100 uppercase font-semibold">{hoveredFaceInfo.state?.built_type || 'N/A'}</span>
          </div>
          <div className="flex justify-between">
            <span>Floors:</span>
            <span className="text-zinc-100 font-semibold">{hoveredFaceInfo.state?.height_floors ?? 0} F</span>
          </div>
          <div className="flex justify-between">
            <span>Value Score:</span>
            <span className="text-pink-400 font-semibold">{hoveredFaceInfo.evaluation?.score ?? 0} Pts</span>
          </div>
          {hoveredFaceInfo.state?.built_type === 'residential' && (
            <div className="flex justify-between">
              <span>Population:</span>
              <span className="text-emerald-400 font-semibold">{hoveredFaceInfo.state?.population ?? 0} Ppl</span>
            </div>
          )}
          <div className="flex justify-between pb-1">
            <span>Neighbors:</span>
            <span className="text-zinc-100 truncate max-w-[120px]" title={hoveredFaceInfo.neighbors?.join(', ')}>
              {hoveredFaceInfo.neighbors?.join(', ') || 'None'}
            </span>
          </div>
        </div>
        
        <div className="pt-2 border-t border-white/5 text-[9px] text-zinc-400 italic text-center">
          💡 Click on any face mesh to edit its type.
        </div>
      </div>
    </div>
  );
}
