"use client";

import React from 'react';
import { GameProvider, useGame } from '@/context/GameContext';
import Viewport3D from '@/components/3DViewport';
import LeftBar from '@/components/LeftBar';
import RightBar from '@/components/RightBar';
import HoverPanel from '@/components/HoverPanel';
import BottomBar from '@/components/BottomBar';
import EditPanel from '@/components/EditPanel';
import ActionPanel from '@/components/ActionPanel';

function GameContent() {
  const { theme, isEditModalOpen } = useGame();

  return (
    <div className={`relative w-screen h-screen overflow-hidden bg-background font-sans text-foreground select-none transition-colors duration-300 ${theme === 'dark' ? 'dark' : ''}`}>
      {/* 3D Viewport Container */}
      <Viewport3D />

      {/* Left Sidebar Control Panel */}
      <LeftBar />

      {/* MAPPO Training Right Sidebar */}
      <RightBar />

      {/* Hover Information Panel (Follows cursor) */}
      {!isEditModalOpen && <HoverPanel />}

      {/* Standard Views Selector & Playback Timeline (Bottom Center) */}
      <BottomBar />

      {/* Edit Unit Properties Modal Popup */}
      <EditPanel />

      {/* Game Action Modal Popup */}
      <ActionPanel />
    </div>
  );
}

export default function Home() {
  return (
    <GameProvider>
      <GameContent />
    </GameProvider>
  );
}
