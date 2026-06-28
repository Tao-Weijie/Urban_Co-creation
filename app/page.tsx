"use client";

import React, { useState } from 'react';
import {
  Block,
  UrbanUnit,
  TopologyData,
  TopologyMetadata,
  ActionType
} from '@/game_engine/topology';

import Viewport3D from '@/components/3DViewport';
import LeftBar from '@/components/LeftBar';
import RightBar from '@/components/RightBar';
import HoverPanel from '@/components/HoverPanel';
import BottomBar from '@/components/BottomBar';
import EditFaceModal from '@/components/EditFaceModal';
import GameActionModal from '@/components/GameActionModal';

import {
  trainRL,
  saveRLModels,
  loadRLModelFromSingleFile,
  clearAllCachedModels,
  getRLActionRecommendation,
  RLTrainingMetrics
} from '@/game_engine/training';
import { tsEngine } from '@/game_engine/tsEngine';

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
  const [isModelLoading, setIsModelLoading] = useState<boolean>(false);
  const [isMapLoading, setIsMapLoading] = useState<boolean>(false);


  // Active loaded topology data and stats
  const [topologyData, setTopologyData] = useState<TopologyData | null>(null);
  const topologyDataRef = React.useRef<TopologyData | null>(null);
  React.useEffect(() => {
    topologyDataRef.current = topologyData;
  }, [topologyData]);

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

  // Role-based AI Settings
  const [roleAISettings, setRoleAISettings] = useState<Record<string, boolean>>({
    "1": false, // Developer
    "2": false  // Government
  });
  const [isAiThinking, setIsAiThinking] = useState<boolean>(false);
  const aiTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isGameOver, setIsGameOver] = useState<boolean>(false);

  // Game History for Timeline
  const [gameHistory, setGameHistory] = useState<{
    topologyData: TopologyData;
    macroStats: {
      government_tax: number;
      developer_profit: number;
      total_population: number;
    };
    activeRoleIndex: number;
    turnNumber: number;
    turnOrder: (string | number)[];
  }[]>([]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState<number>(0);

  // Displayed/Projected states matching the current timeline index (if browsing history)
  const isBrowsingHistory = gameStarted && currentHistoryIndex < gameHistory.length - 1;

  const displayedTopologyData = gameStarted && gameHistory[currentHistoryIndex]
    ? gameHistory[currentHistoryIndex].topologyData
    : topologyData;

  const displayedMacroStats = gameStarted && gameHistory[currentHistoryIndex]
    ? gameHistory[currentHistoryIndex].macroStats
    : macroStats;

  const displayedTurnNumber = gameStarted && gameHistory[currentHistoryIndex]
    ? gameHistory[currentHistoryIndex].turnNumber
    : turnNumber;

  const displayedActiveRoleIndex = gameStarted && gameHistory[currentHistoryIndex]
    ? gameHistory[currentHistoryIndex].activeRoleIndex
    : activeRoleIndex;

  const displayedTurnOrder = gameStarted && gameHistory[currentHistoryIndex]
    ? gameHistory[currentHistoryIndex].turnOrder
    : turnOrder;

  const handleToggleRoleAI = (roleId: string) => {
    setRoleAISettings(prev => ({
      ...prev,
      [roleId]: !prev[roleId]
    }));
  };

  // DQN Reinforcement Learning Simulated States
  const [isRlTraining, setIsRlTraining] = useState<boolean>(false);
  const [rlProgress, setRlProgress] = useState<number>(0);
  const [rlEpisode, setRlEpisode] = useState<number>(0);
  const [rlLoss, setRlLoss] = useState<number | null>(null);
  const [rlLossHistory, setRlLossHistory] = useState<number[]>([]);
  const [rlMetrics, setRlMetrics] = useState<RLTrainingMetrics | null>(null);
  const [isRlLoaded, setIsRlLoaded] = useState<boolean>(false);

  // Timeline playback states
  const [isTimelinePlaying, setIsTimelinePlaying] = useState<boolean>(false);
  const [timelineFps, setTimelineFps] = useState<number>(5);
  const timelineIntervalRef = React.useRef<NodeJS.Timeout | null>(null);

  // Timeline Autoplay Loop Effect
  React.useEffect(() => {
    console.log("Timeline Autoplay Effect: playing =", isTimelinePlaying, "fps =", timelineFps);
    if (isTimelinePlaying) {
      if (timelineIntervalRef.current) clearInterval(timelineIntervalRef.current);
      const delay = 1000 / timelineFps;
      console.log(`Setting timeline interval with delay: ${delay}ms`);
      timelineIntervalRef.current = setInterval(() => {
        setCurrentHistoryIndex((prev) => {
          if (prev >= gameHistory.length - 1) {
            setIsTimelinePlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, delay);
    } else {
      if (timelineIntervalRef.current) {
        clearInterval(timelineIntervalRef.current);
        timelineIntervalRef.current = null;
      }
    }
    return () => {
      if (timelineIntervalRef.current) {
        clearInterval(timelineIntervalRef.current);
      }
    };
  }, [isTimelinePlaying, timelineFps, gameHistory.length]);

  React.useEffect(() => {
    const initEngine = async () => {
      try {
        await tsEngine.init();

        // Fetch roles config from the engine
        const roles = await tsEngine.initializePlayer();
        setRolesConfig(roles);
        if (turnOrder.length === 0) {
          const keys = Object.keys(roles).map(k => isNaN(Number(k)) ? k : Number(k));
          setTurnOrder(keys);
        }

      } catch (err) {
        console.error("Engine init error:", err);
      }
    };

    if (typeof window !== 'undefined') {
      initEngine();
    }
  }, []);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current);
      if (timelineIntervalRef.current) clearInterval(timelineIntervalRef.current);
    };
  }, []);

  // Automated AI Turn Loop Effect
  React.useEffect(() => {
    if (!gameStarted || !topologyData || isPaused || isGameOver || isBrowsingHistory) {
      if (aiTimeoutRef.current) {
        clearTimeout(aiTimeoutRef.current);
        aiTimeoutRef.current = null;
      }
      setIsAiThinking(false);
      return;
    }

    const allOccupied = topologyData.units.every(u => u.state.type !== 0);
    const stepLimitReached = (topologyData.metadata?.timer || 0) >= 200;

    if (allOccupied || stepLimitReached) {
      setIsGameOver(true);
      if (aiTimeoutRef.current) {
        clearTimeout(aiTimeoutRef.current);
        aiTimeoutRef.current = null;
      }
      setIsAiThinking(false);
      setTimeout(() => {
        alert(`Game Finished! ${allOccupied ? "All tiles are occupied." : "Reached maximum limit of 200 steps."}`);
      }, 50);
      return;
    }

    const activePlayer = turnOrder[activeRoleIndex];
    const isAIEnabled = roleAISettings[String(activePlayer)] || false;

    if (isAIEnabled) {
      if (aiTimeoutRef.current) return; // Prevent double-triggering

      setIsAiThinking(true);
      aiTimeoutRef.current = setTimeout(async () => {
        try {
          const activePlayer = turnOrder[activeRoleIndex];
          // 1. Fetch valid actions from the engine
          const { actions } = await tsEngine.getValidActions(Number(activePlayer));
          if (actions.length === 0) {
            setIsGameOver(true);
            alert("Game Finished! No more valid actions.");
            return;
          }

          // 2. Select action: Use DQN model recommendation if loaded, otherwise fallback to random selection
          let chosenAction = actions[Math.floor(Math.random() * actions.length)];
          if (isRlLoaded && topologyData) {
            const recommendation = getRLActionRecommendation(topologyData, actions);
            if (recommendation) {
              const matchedAction = actions.find((a: any[]) => a[0] === recommendation.actionType && a[1] === recommendation.unitId);
              if (matchedAction) {
                chosenAction = matchedAction;
                console.log(`DQN Recommendation executed: ${recommendation.actionType} on unit ${recommendation.unitId} (reward Q: ${recommendation.predictedReward.toFixed(4)})`);
              }
            }
          }
          const [actionType, unitId] = chosenAction;

          // 3. Play the turn
          await handlePlayTurn(actionType, unitId === null ? undefined : unitId);
        } catch (err: any) {
          console.error("AI turn action error:", err);
          setIsGameOver(true);
        } finally {
          setIsAiThinking(false);
          aiTimeoutRef.current = null;
        }
      }, 150); // 150ms delay to prevent exceeding React update depth limits and allow visual turn transitions
    } else {
      if (aiTimeoutRef.current) {
        clearTimeout(aiTimeoutRef.current);
        aiTimeoutRef.current = null;
      }
      setIsAiThinking(false);
    }
  }, [gameStarted, activeRoleIndex, turnOrder, roleAISettings, topologyData, isPaused, isGameOver, isBrowsingHistory, isRlLoaded]);

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
      setIsModelLoading(true);
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
      blocks: data.blocks.map((b) => ({ id: b.topology.id, neighbor: b.topology.neighbor })),
      units: data.units.map((u) => ({
        id: u.topology.id,
        parentid: u.topology.blockid,
        type: u.state.type,
        value: u.state.value,
        population: u.state.population,
        height: u.geometry.height
      })),
      timer: data.metadata?.timer || 0,
      metadata: data.metadata || {}
    };
  };

  // Helper to merge boundaries back from local data cache
  const mergeBoundaries = (response: any, localData: TopologyData): TopologyData => {
    const blocks = response.blocks ? response.blocks.map((b: any) => {
      const localBlock = localData.blocks.find(lb => lb.topology.id === b.id);
      return {
        topology: {
          id: b.id,
          neighbor: b.neighbor || []
        },
        geometry: {
          boundary: localBlock ? localBlock.geometry.boundary : [],
          hole: localBlock ? localBlock.geometry.hole : []
        },
        state: {
          value: b.value
        }
      };
    }) : localData.blocks;

    const units = response.units ? response.units.map((u: any) => {
      const localUnit = localData.units.find(lu => lu.topology.id === u.topology.id);
      if (localUnit) {
        return {
          ...u,
          geometry: {
            ...u.geometry,
            boundary: localUnit.geometry.boundary
          }
        };
      } else {
        const parentBlock = localData.blocks.find(lb => lb.topology.id === u.topology.blockid);
        return {
          ...u,
          geometry: {
            ...u.geometry,
            boundary: parentBlock ? parentBlock.geometry.boundary : []
          }
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

      const data = await tsEngine.buildGame(strippedPayload);

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
      setIsMapLoading(false);
    }
  };

  // Upload topology JSON file
  const handleJsonUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setIsMapLoading(true);
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
            const hasUnit = units.some((u: any) => u.topology.blockid === block.topology.id);
            if (!hasUnit) {
              units.push({
                topology: {
                  id: block.topology.id,
                  blockid: block.topology.id,
                  buildingid: 0,
                  idinbuilding: 0
                },
                geometry: {
                  boundary: block.geometry.boundary,
                  height: 1
                },
                state: {
                  type: 0, // EMPTY
                  value: 0.0,
                  population: 0.0
                }
              });
            }
          });

          // Ensure all type 0 units have 0 value, 0 population, and default height 1 if empty
          units = units.map((u: any) => {
            if (u.state.type === 0) {
              return {
                ...u,
                state: {
                  ...u.state,
                  value: 0.0,
                  population: 0.0
                },
                geometry: {
                  ...u.geometry,
                  height: u.geometry.height || 1
                }
              };
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
      setIsMapLoading(false);
    };
    reader.readAsArrayBuffer(file);
  };



  // Clear topology grid 3D objects and reset states
  const clearTopologyGrid = () => {
    setGameStarted(false);
    setTopologyData(null);
    setOriginalTopologyData(null);
    setGridName('');
    setHoveredUnitInfo(null);
    setRoleAISettings({ "1": false, "2": false });
    setIsAiThinking(false);
    setIsPaused(false);
    setIsGameOver(false);
    setGameHistory([]);
    setCurrentHistoryIndex(0);
    setIsTimelinePlaying(false);
    setRlLossHistory([]);
    setMacroStats({
      government_tax: 0,
      developer_profit: 0,
      total_population: 0
    });
  };

  const handleStartGame = async () => {
    if (!topologyData) {
      alert("Please upload a topology grid JSON first.");
      return;
    }
    try {
      setIsLoading(true);
      // Start game logic locally
      const data = await tsEngine.startGame({
        player_order: turnOrder.map(Number)
      });

      const nextStats = {
        government_tax: data.metadata?.evaulate?.government_tax || 0,
        developer_profit: data.metadata?.evaulate?.developer_profit || 0,
        total_population: data.metadata?.evaulate?.total_population || 0
      };
      setMacroStats(nextStats);

      const mergedTopology = mergeBoundaries(data, topologyData);
      setTopologyData(mergedTopology);

      // Sync game state from backend metadata
      const backendMeta = data.metadata || {};
      setGameStarted(backendMeta.game_started || true);
      let nextTurnOrder = turnOrder;
      if (backendMeta.player_order) {
        setTurnOrder(backendMeta.player_order);
        nextTurnOrder = backendMeta.player_order;
      }
      setActiveRoleIndex(0);
      const nextTurnNumber = (data.metadata?.timer !== undefined ? data.metadata.timer : (data.timer || 0)) + 1;
      setTurnNumber(nextTurnNumber);

      setIsPaused(false);
      setIsGameOver(false);
      setIsTimelinePlaying(false);

      // Initialize history
      const initialHistoryState = {
        topologyData: mergedTopology,
        macroStats: nextStats,
        activeRoleIndex: 0,
        turnNumber: nextTurnNumber,
        turnOrder: nextTurnOrder
      };
      setGameHistory([initialHistoryState]);
      setCurrentHistoryIndex(0);

    } catch (err: any) {
      console.error("Failed to start game:", err);
      alert("Start Game Error: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetGame = () => {
    setIsPaused(false);
    setIsGameOver(false);
    setGameStarted(false);
    setActiveRoleIndex(0);
    setTurnNumber(1);
    setIsAiThinking(false);
    setGameHistory([]);
    setCurrentHistoryIndex(0);
    setIsTimelinePlaying(false);
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

  const handleSelectGameAction = (actionType: ActionType) => {
    if (selectedUnitForGameAction) {
      const targetUnitId = actionType === ActionType.SKIP ? undefined : selectedUnitForGameAction.topology.id;
      handlePlayTurn(actionType, targetUnitId);
      setIsGameActionModalOpen(false);
      setSelectedUnitForGameAction(null);
    }
  };

  const handlePlayTurn = async (actionType: ActionType, unitId?: number) => {
    if (!topologyData) return;

    try {
      setIsLoading(true);
      const activeRoleVal = turnOrder[activeRoleIndex];
      const allowedBuildings = rolesConfig[String(activeRoleVal)]?.allowed_types || [];
      const unitType = allowedBuildings.length > 0 ? allowedBuildings[0] : null;

      // Call action locally
      const data = await tsEngine.runGameStep({
        action_type: actionType,
        unit_id: unitId ?? null,
        unit_type: unitType
      });

      // Update states
      const nextStats = {
        government_tax: data.metadata?.evaulate?.government_tax || 0,
        developer_profit: data.metadata?.evaulate?.developer_profit || 0,
        total_population: data.metadata?.evaulate?.total_population || 0
      };
      setMacroStats(nextStats);

      const mergedTopology = mergeBoundaries(data, topologyData);
      setTopologyData(mergedTopology);

      // Sync game state from backend metadata
      const backendMeta = data.metadata || {};
      let nextTurnOrder = turnOrder;
      if (backendMeta.player_order) {
        setTurnOrder(backendMeta.player_order);
        nextTurnOrder = backendMeta.player_order;
      }
      setActiveRoleIndex(0);
      const nextTurnNumber = (data.metadata?.timer !== undefined ? data.metadata.timer : (data.timer || 0)) + 1;
      setTurnNumber(nextTurnNumber);

      // Update history
      const nextHistoryState = {
        topologyData: mergedTopology,
        macroStats: nextStats,
        activeRoleIndex: 0,
        turnNumber: nextTurnNumber,
        turnOrder: nextTurnOrder
      };
      setGameHistory(prev => {
        const newHist = [...prev, nextHistoryState];
        setCurrentHistoryIndex(newHist.length - 1);
        return newHist;
      });

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
      if (u.topology.id === selectedUnitForEdit.topology.id) {
        return {
          ...u,
          state: {
            ...u.state,
            type: typeVal,
            value: isOccupied ? u.state.value : 0.0,
            population: isOccupied ? u.state.population : 0.0
          },
          geometry: {
            ...u.geometry,
            height: u.geometry.height
          }
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
    if (hoveredUnitInfo && hoveredUnitInfo.topology.id === selectedUnitForEdit.topology.id) {
      const updatedUnit = updatedUnits.find(u => u.topology.id === selectedUnitForEdit.topology.id);
      if (updatedUnit) {
        setHoveredUnitInfo(updatedUnit);
      }
    }
  };

  const rlCancelledRef = React.useRef<boolean>(false);

  // DQN Reinforcement Learning Training Handler using TensorFlow.js in the browser
  const handleTrainRL = async (episodes: number, lr: number) => {
    if (!originalTopologyData) {
      alert("Please upload a grid topology JSON first.");
      return;
    }
    try {
      setIsRlTraining(true);
      setRlProgress(0);
      setRlEpisode(0);
      setRlLoss(null);
      setRlLossHistory([]);
      setRlMetrics(null);
      rlCancelledRef.current = false;

      await trainRL(
        originalTopologyData,
        episodes,
        lr,
        (metrics: RLTrainingMetrics) => {
          setRlEpisode(metrics.episode);
          setRlLoss(metrics.avgLoss);
          setRlProgress(Math.round((metrics.episode / episodes) * 100));
          setRlLossHistory(prev => [...prev, metrics.avgLoss]);
          setRlMetrics(metrics);
        },
        () => rlCancelledRef.current
      );

      if (!rlCancelledRef.current) {
        setIsRlTraining(false);
        setIsRlLoaded(true);
        setRlProgress(100);
        setRlEpisode(episodes);
        alert("RL Training completed! (TensorFlow.js)");
      }
    } catch (err: any) {
      console.error("DQN RL Training Error:", err);
      alert("RL Training failed: " + err.message);
      setIsRlTraining(false);
    }
  };

  const cancelTrainRL = () => {
    rlCancelledRef.current = true;
    setIsRlTraining(false);
  };

  const handleSaveRL = async () => {
    try {
      await saveRLModels();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const onLoadRLFile = async (file: File) => {
    try {
      await loadRLModelFromSingleFile(file);
      setIsRlLoaded(true);
      alert("MAPPO models successfully loaded from the unified file!");
    } catch (err: any) {
      console.error(err);
      alert("Failed to load models: " + err.message);
    }
  };

  const handleClearRLModels = async () => {
    try {
      await clearAllCachedModels();
      setIsRlLoaded(false);
      setRlLossHistory([]);
      setRlMetrics(null);
      alert("Cached model settings cleared.");
    } catch (err: any) {
      alert("Failed to clear models: " + err.message);
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-background font-sans text-foreground select-none transition-colors duration-300">


      {/* 3D Viewport Container */}
      <Viewport3D
        modelFile={modelFile}
        modelName={modelName}
        gridName={gridName}
        topologyData={displayedTopologyData}
        standardView={standardView}
        onStandardViewProcessed={() => setStandardView(null)}
        onUnitHover={handleUnitHover}
        onUnitClick={(unit) => {
          if (isBrowsingHistory) return; // Disable clicking during history browsing
          if (isAiThinking || (gameStarted && roleAISettings[String(displayedTurnOrder[displayedActiveRoleIndex])])) return; // Disable clicking during AI thinking
          if (gameStarted) {
            setSelectedUnitForGameAction(unit);
            setIsGameActionModalOpen(true);
          } else {
            setSelectedUnitForEdit(unit);
            setIsEditModalOpen(true);
          }
        }}
        onLoadingChange={(loading) => {
          setIsLoading(loading);
          setIsModelLoading(loading);
        }}
      />

      {/* Floating Menu Toolbar (Left Sidebar) */}
      <LeftBar
        modelName={modelName}
        gridName={gridName}
        isLoading={isLoading}
        isModelLoading={isModelLoading}
        isMapLoading={isMapLoading}
        macroStats={displayedMacroStats}
        onModelUpload={handleModelUpload}
        onModelClear={clearBackgroundModel}
        onJsonUpload={handleJsonUpload}
        onJsonClear={clearTopologyGrid}
        hasTopologyData={topologyData !== null}

        // Game Mode props
        gameStarted={gameStarted}
        turnOrder={displayedTurnOrder}
        activeRoleIndex={displayedActiveRoleIndex}
        turnNumber={displayedTurnNumber}
        onStartGame={handleStartGame}
        onUpdateTurnOrder={setTurnOrder}
        rolesConfig={rolesConfig}
        roleAISettings={roleAISettings}
        onToggleRoleAI={handleToggleRoleAI}
        isPaused={isPaused}
        isGameOver={isGameOver}
        onTogglePause={() => setIsPaused(!isPaused)}
        onEndGame={handleResetGame}
      />

      {/* MAPPO Training Right Sidebar */}
      <RightBar
        hasTopologyData={topologyData !== null}
        isRlTraining={isRlTraining}
        rlProgress={rlProgress}
        rlEpisode={rlEpisode}
        rlLoss={rlLoss}
        rlLossHistory={rlLossHistory}
        rlMetrics={rlMetrics}
        onTrainRL={handleTrainRL}
        onCancelTrainRL={cancelTrainRL}
        isRlLoaded={isRlLoaded}
        onSaveRL={handleSaveRL}
        onLoadRLFile={onLoadRLFile}
        onClearRL={handleClearRLModels}
      />

      {/* Hover Information Panel (Follows cursor) */}
      {!isEditModalOpen && (
        <HoverPanel hoveredUnitInfo={hoveredUnitInfo} hoverPosition={hoverPosition} topologyData={displayedTopologyData} />
      )}

      {/* Standard Views Selector & Playback Timeline (Bottom Center) */}
      <BottomBar
        onSetView={setStandardView}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        gameStarted={gameStarted}
        gameHistoryLength={gameHistory.length}
        currentIndex={currentHistoryIndex}
        onIndexChange={setCurrentHistoryIndex}
        isDraggable={isPaused || isGameOver}
        isPlaying={isTimelinePlaying}
        onTogglePlay={() => setIsTimelinePlaying(!isTimelinePlaying)}
        fps={timelineFps}
        onFpsChange={setTimelineFps}
      />

      {/* Edit Unit Properties Modal Popup */}
      <EditFaceModal
        isOpen={isEditModalOpen}
        unit={selectedUnitForEdit}
        currentBuiltType={
          selectedUnitForEdit
            ? (selectedUnitForEdit.state.type === 1
              ? 'residential'
              : (selectedUnitForEdit.state.type === 2
                ? 'green'
                : 'empty'))
            : 'empty'
        }
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleSaveUnitEdit}
      />

      {/* Game Action Modal Popup */}
      {(() => {
        const activeRoleVal = displayedTopologyData?.metadata?.next_player ?? displayedTurnOrder[displayedActiveRoleIndex] ?? 1;
        const allowedBehavior = displayedTopologyData?.metadata?.valid_action ?? [];
        const allowedBuildings = displayedTopologyData?.metadata?.valid_type ?? [];
        const roleName = rolesConfig[String(activeRoleVal)]?.name ?? `Role ${activeRoleVal}`;
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
