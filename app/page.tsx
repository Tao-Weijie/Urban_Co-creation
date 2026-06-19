"use client";

import React, { useState } from 'react';
import {
  Block,
  UrbanUnit,
  TopologyData,
  TopologyMetadata,
  ActionType
} from '@/rules/topology';

import Viewport3D from '@/components/3DViewport';
import LeftBar from '@/components/LeftBar';
import HoverPanel from '@/components/HoverPanel';
import BottomBar from '@/components/BottomBar';
import EditFaceModal from '@/components/EditFaceModal';
import GameActionModal from '@/components/GameActionModal';

export default function Home() {
  // Theme state
  const [theme, setTheme] = React.useState<'light' | 'dark'>('light');

  const handleToggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    if (typeof window !== 'undefined') {
      if (nextTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  };

  React.useEffect(() => {
    // Force initial default light theme
    document.documentElement.classList.remove('dark');
  }, []);

  // Model and Grid metadata states
  const [modelName, setModelName] = useState<string>('');
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [gridName, setGridName] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isForceWhite, setIsForceWhite] = useState<boolean>(false);

  // Active loaded topology data and stats
  const [topologyData, setTopologyData] = useState<TopologyData | null>(null);
  const [originalTopologyData, setOriginalTopologyData] = useState<TopologyData | null>(null);
  const [macroStats, setMacroStats] = useState({
    government_tax: 0,
    developer_profit: 0,
    total_population: 0
  });

  // Game States
  const [gameStarted, setGameStarted] = useState<boolean>(false);
  const [turnOrder, setTurnOrder] = useState<(string | number)[]>([]);
  const [activeRoleIndex, setActiveRoleIndex] = useState<number>(0);
  const [turnNumber, setTurnNumber] = useState<number>(1);
  const [rolesConfig, setRolesConfig] = useState<Record<string, { name: string; allowed_types: number[]; allowed_actions: (string | number)[] }>>({});

  // UI Interactive States
  const [hoveredUnitInfo, setHoveredUnitInfo] = useState<UrbanUnit | null>(null);
  const [hoverPosition, setHoverPosition] = useState<{ x: number, y: number } | null>(null);
  const [selectedUnitForEdit, setSelectedUnitForEdit] = useState<UrbanUnit | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [selectedUnitForGameAction, setSelectedUnitForGameAction] = useState<UrbanUnit | null>(null);
  const [isGameActionModalOpen, setIsGameActionModalOpen] = useState<boolean>(false);

  React.useEffect(() => {
    const fetchRoles = async () => {
      try {
        const response = await fetch('/api/game/players');
        if (response.ok) {
          const data = await response.json();
          setRolesConfig(data);
          if (turnOrder.length === 0) {
            const keys = Object.keys(data).map(k => isNaN(Number(k)) ? k : Number(k));
            setTurnOrder(keys);
          }
        }
      } catch (err) {
        console.error("Failed to fetch roles config:", err);
      }
    };
    fetchRoles();
  }, []);

  // Hover position helper
  const handleUnitHover = (unit: UrbanUnit | null, x?: number, y?: number) => {
    setHoveredUnitInfo(unit);
    if (unit && x !== undefined && y !== undefined) {
      setHoverPosition({ x, y });
    } else {
      setHoverPosition(null);
    }
  };

  // View switch trigger
  const [standardView, setStandardView] = useState<'top' | 'front' | 'left' | null>(null);

  // Upload environment background model
  const handleModelUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setModelFile(file);
      setModelName(file.name);
    }
  };

  // Clear background model
  const clearBackgroundModel = () => {
    setModelFile(null);
    setModelName('');
  };

  // Helper to strip boundary coordinates before sending to backend
  const stripBoundaries = (data: TopologyData) => {
    return {
      blocks: data.blocks.map(({ id, neighbor }) => ({ id, neighbor })),
      units: data.units.map(({ id, parentid, type, value, population, height }) => ({
        id, parentid, type, value, population, height
      })),
      timer: data.metadata?.timer || 0,
      metadata: data.metadata || {}
    };
  };

  // Helper to merge boundaries back from local data cache
  const mergeBoundaries = (response: any, localData: TopologyData): TopologyData => {
    const blocks = response.blocks ? response.blocks.map((b: any) => {
      const localBlock = localData.blocks.find(lb => lb.id === b.id);
      return {
        ...b,
        boundary: localBlock ? localBlock.boundary : []
      };
    }) : localData.blocks;

    const units = response.units ? response.units.map((u: any) => {
      const localUnit = localData.units.find(lu => lu.id === u.id);
      if (localUnit) {
        return {
          ...u,
          boundary: localUnit.boundary
        };
      } else {
        const parentBlock = localData.blocks.find(lb => lb.id === u.parentid);
        return {
          ...u,
          boundary: parentBlock ? parentBlock.boundary : []
        };
      }
    }) : localData.units;

    return {
      metadata: {
        ...localData.metadata,
        ...response.metadata,
        timer: response.metadata?.timer !== undefined ? response.metadata.timer : (response.timer !== undefined ? response.timer : (localData.metadata?.timer || 0))
      },
      blocks,
      units
    };
  };

  // Run urban economics evaluation and set results in state
  const runEvaluation = async (currentTopology: TopologyData, currentGridName: string, metadata?: TopologyMetadata) => {
    try {
      setIsLoading(true);
      const strippedPayload = stripBoundaries(currentTopology);

      const response = await fetch('/api/game/build', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(strippedPayload),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Server returned error: ${errText}`);
      }

      const data = await response.json();

      setMacroStats({
        government_tax: data.metadata?.evaulate?.government_tax || 0,
        developer_profit: data.metadata?.evaulate?.developer_profit || 0,
        total_population: data.metadata?.evaulate?.total_population || 0
      });

      const mergedTopology = mergeBoundaries(data, currentTopology);
      if (metadata) {
        mergedTopology.metadata = metadata;
      }

      setTopologyData(mergedTopology);
    } catch (err: any) {
      console.error("Failed to run urban economics evaluation:", err);
      alert("Evaluation Error: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Upload topology JSON file
  const handleJsonUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const uint8Array = new Uint8Array(arrayBuffer);

        // Detect UTF-16 BOM
        let encoding = 'utf-8';
        if (uint8Array.length >= 2) {
          if (uint8Array[0] === 0xff && uint8Array[1] === 0xfe) {
            encoding = 'utf-16le';
          } else if (uint8Array[0] === 0xfe && uint8Array[1] === 0xff) {
            encoding = 'utf-16be';
          }
        }

        const decoder = new TextDecoder(encoding);
        const text = decoder.decode(uint8Array);
        const json = JSON.parse(text) as TopologyData;

        if (json.blocks) {
          let units = json.units || [];
          json.blocks.forEach((block: Block) => {
            const hasUnit = units.some((u: any) => u.parentid === block.id);
            if (!hasUnit) {
              units.push({
                id: block.id,
                parentid: block.id,
                type: 0, // EMPTY
                value: 0.0,
                population: 0.0,
                boundary: block.boundary,
                height: 1 // default height 1
              });
            }
          });

          // Ensure all type 0 units have 0 value, 0 population, and default height 1 if empty
          units = units.map((u: any) => {
            if (u.type === 0) {
              return { ...u, value: 0.0, population: 0.0, height: u.height || 1 };
            }
            return u;
          });

          const completeJson: TopologyData = {
            metadata: json.metadata || { map_id: "urban_map", total_faces: json.blocks.length, timer: 0 },
            blocks: json.blocks,
            units
          };

          setGridName(file.name);
          setOriginalTopologyData(completeJson);
          runEvaluation(completeJson, file.name, completeJson.metadata);
        } else {
          alert("Failed to parse grid JSON. Missing required 'blocks' property.");
        }
      } catch (err) {
        console.error(err);
        alert("Failed to parse grid JSON. Ensure it matches topology specifications.");
      }
      setIsLoading(false);
    };
    reader.readAsArrayBuffer(file);
  };

  // Clear topology grid 3D objects and reset states
  const clearTopologyGrid = () => {
    setTopologyData(null);
    setOriginalTopologyData(null);
    setGridName('');
    setHoveredUnitInfo(null);
    setMacroStats({
      government_tax: 0,
      developer_profit: 0,
      total_population: 0
    });
  };

  const handleSwapOrder = () => {
    setTurnOrder((prev) => prev.length > 1 ? [...prev.slice(1), prev[0]] : prev);
  };

  const handleStartGame = async () => {
    if (!topologyData) {
      alert("Please upload a topology grid JSON first.");
      return;
    }
    try {
      setIsLoading(true);
      const strippedPayload = stripBoundaries(topologyData);

      const response = await fetch('/api/game/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          player_order: turnOrder
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText);
      }

      const data = await response.json();

      // Update states and metrics
      setMacroStats({
        government_tax: data.metadata?.evaulate?.government_tax || 0,
        developer_profit: data.metadata?.evaulate?.developer_profit || 0,
        total_population: data.metadata?.evaulate?.total_population || 0
      });

      const mergedTopology = mergeBoundaries(data, topologyData);
      setTopologyData(mergedTopology);

      // Sync game state from backend metadata
      const backendMeta = data.metadata || {};
      setGameStarted(backendMeta.game_started || true);
      if (backendMeta.player_order) {
        setTurnOrder(backendMeta.player_order);
      }
      setActiveRoleIndex(0);
      setTurnNumber((data.metadata?.timer !== undefined ? data.metadata.timer : (data.timer || 0)) + 1);

    } catch (err: any) {
      console.error("Failed to start game:", err);
      alert("Start Game Error: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetGame = () => {
    setGameStarted(false);
    setActiveRoleIndex(0);
    setTurnNumber(1);
    const initialKeys = Object.keys(rolesConfig).map(k => isNaN(Number(k)) ? k : Number(k));
    setTurnOrder(initialKeys.length > 0 ? initialKeys : [1, 2]);
    if (originalTopologyData) {
      const resetCopy = JSON.parse(JSON.stringify(originalTopologyData));
      if (resetCopy.metadata) {
        resetCopy.metadata.game_started = false;
        delete resetCopy.metadata.player_order;
        delete resetCopy.metadata.next_player;
        delete resetCopy.metadata.valid_action;
        delete resetCopy.metadata.valid_type;
      }
      setTopologyData(resetCopy);
      runEvaluation(resetCopy, gridName, resetCopy.metadata);
    } else {
      clearTopologyGrid();
    }
  };

  const handleSelectGameAction = (actionType: ActionType.PLACE | ActionType.REPLACE) => {
    if (selectedUnitForGameAction) {
      handlePlayTurn(actionType, selectedUnitForGameAction.id);
      setIsGameActionModalOpen(false);
      setSelectedUnitForGameAction(null);
    }
  };

  const handlePlayTurn = async (actionType: ActionType, unitId?: number) => {
    if (!topologyData) return;

    try {
      setIsLoading(true);
      const currentRole = turnOrder[activeRoleIndex];

      const activeRoleVal = turnOrder[activeRoleIndex];
      const allowedBuildings = rolesConfig[String(activeRoleVal)]?.allowed_types || [];
      const unitType = allowedBuildings.length > 0 ? allowedBuildings[0] : null;

      const response = await fetch('/api/game/step', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action_type: actionType,
          unit_id: unitId ?? null,
          unit_type: unitType
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText);
      }

      const data = await response.json();

      // Update states
      setMacroStats({
        government_tax: data.metadata?.evaulate?.government_tax || 0,
        developer_profit: data.metadata?.evaulate?.developer_profit || 0,
        total_population: data.metadata?.evaulate?.total_population || 0
      });

      const mergedTopology = mergeBoundaries(data, topologyData);
      setTopologyData(mergedTopology);

      // Sync game state from backend metadata
      const backendMeta = data.metadata || {};
      if (backendMeta.player_order) {
        setTurnOrder(backendMeta.player_order);
      }
      setActiveRoleIndex(0);
      setTurnNumber((data.metadata?.timer !== undefined ? data.metadata.timer : (data.timer || 0)) + 1);

    } catch (err: any) {
      console.error("Failed to execute game turn step:", err);
      alert("Game Turn Error: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkipTurn = () => {
    handlePlayTurn(ActionType.SKIP);
  };

  // Save modifications to the selected unit and trigger evaluation update
  const handleSaveUnitEdit = (editBuiltType: string) => {
    if (!selectedUnitForEdit || !topologyData) return;

    const isOccupied = editBuiltType !== 'empty';
    let typeVal = 0;
    if (editBuiltType === 'residential') typeVal = 1;
    else if (editBuiltType === 'green' || editBuiltType === 'park') typeVal = 2;

    const updatedUnits = topologyData.units.map(u => {
      if (u.id === selectedUnitForEdit.id) {
        return {
          ...u,
          type: typeVal,
          value: isOccupied ? u.value : 0.0,
          population: isOccupied ? u.population : 0.0,
          height: u.height
        };
      }
      return u;
    });

    const updatedTopology = {
      ...topologyData,
      units: updatedUnits
    };

    runEvaluation(updatedTopology, gridName);
    setIsEditModalOpen(false);

    // Update the hover info if the currently hovered unit was the edited one
    if (hoveredUnitInfo && hoveredUnitInfo.id === selectedUnitForEdit.id) {
      const updatedUnit = updatedUnits.find(u => u.id === selectedUnitForEdit.id);
      if (updatedUnit) {
        setHoveredUnitInfo(updatedUnit);
      }
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-background font-sans text-foreground select-none transition-colors duration-300">

      {/* 3D Viewport Container */}
      <Viewport3D
        modelFile={modelFile}
        modelName={modelName}
        gridName={gridName}
        topologyData={topologyData}
        isForceWhite={isForceWhite}
        standardView={standardView}
        onStandardViewProcessed={() => setStandardView(null)}
        onUnitHover={handleUnitHover}
        onUnitClick={(unit) => {
          if (gameStarted) {
            setSelectedUnitForGameAction(unit);
            setIsGameActionModalOpen(true);
          } else {
            setSelectedUnitForEdit(unit);
            setIsEditModalOpen(true);
          }
        }}
        onLoadingChange={setIsLoading}
      />

      {/* Floating Menu Toolbar (Left Sidebar) */}
      <LeftBar
        modelName={modelName}
        gridName={gridName}
        isLoading={isLoading}
        macroStats={macroStats}
        isForceWhite={isForceWhite}
        onModelUpload={handleModelUpload}
        onModelClear={clearBackgroundModel}
        onJsonUpload={handleJsonUpload}
        onJsonClear={clearTopologyGrid}
        onToggleForceWhite={() => setIsForceWhite(!isForceWhite)}
        hasTopologyData={topologyData !== null}

        // Game Mode props
        gameStarted={gameStarted}
        turnOrder={turnOrder}
        activeRoleIndex={activeRoleIndex}
        turnNumber={turnNumber}
        onStartGame={handleStartGame}
        onResetGame={handleResetGame}
        onUpdateTurnOrder={setTurnOrder}
        onSkipTurn={handleSkipTurn}
        rolesConfig={rolesConfig}
      />

      {/* Hover Information Panel (Follows cursor) */}
      {!isEditModalOpen && (
        <HoverPanel hoveredUnitInfo={hoveredUnitInfo} hoverPosition={hoverPosition} topologyData={topologyData} />
      )}

      {/* Standard Views Selector (Bottom Center) */}
      <BottomBar onSetView={setStandardView} theme={theme} onToggleTheme={handleToggleTheme} />

      {/* Edit Unit Properties Modal Popup */}
      <EditFaceModal
        isOpen={isEditModalOpen}
        unit={selectedUnitForEdit}
        currentBuiltType={
          selectedUnitForEdit
            ? (selectedUnitForEdit.type === 1
              ? 'residential'
              : (selectedUnitForEdit.type === 2
                ? 'green'
                : 'empty'))
            : 'empty'
        }
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleSaveUnitEdit}
      />

      {/* Game Action Modal Popup */}
      {(() => {
        const activeRoleVal = topologyData?.metadata?.next_player ?? turnOrder[activeRoleIndex] ?? 1;
        const allowedBehavior = topologyData?.metadata?.valid_action ?? [];
        const allowedBuildings = topologyData?.metadata?.valid_type ?? [];
        const roleName = rolesConfig[String(activeRoleVal)]?.name ?? (activeRoleVal === 1 ? "Developer" : "Government");
        return (
          <GameActionModal
            isOpen={isGameActionModalOpen}
            unit={selectedUnitForGameAction}
            activeRole={activeRoleVal}
            allowedBehavior={allowedBehavior}
            allowedBuildings={allowedBuildings}
            roleName={roleName}
            onClose={() => {
              setIsGameActionModalOpen(false);
              setSelectedUnitForGameAction(null);
            }}
            onSelectAction={handleSelectGameAction}
          />
        );
      })()}

    </div>
  );
}
