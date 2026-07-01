import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  TopologyData,
  TopologyMetadata,
  UrbanUnit,
  ActionType
} from '@/game_engine/configE';
import { tsEngine } from '@/game_engine/engine';
import {
  trainRL,
  saveRLModels,
  loadRLModelFromSingleFile,
  clearAllCachedModels,
  getRLActionRecommendation,
  RLTrainingMetrics
} from '@/game_engine/training';

interface GameContextType {
  // Theme
  theme: 'light' | 'dark';
  handleToggleTheme: () => void;

  // Metadata
  modelName: string;
  modelFile: File | null;
  gridName: string;
  setGridName: (name: string) => void;
  isLoading: boolean;
  setIsLoading: (val: boolean) => void;
  isModelLoading: boolean;
  setIsModelLoading: (val: boolean) => void;
  isMapLoading: boolean;
  setIsMapLoading: (val: boolean) => void;

  // Topology Data & Evaluation results
  topologyData: TopologyData | null;
  setTopologyData: (data: TopologyData | null) => void;
  originalTopologyData: TopologyData | null;
  setOriginalTopologyData: (data: TopologyData | null) => void;
  global: any;
  setGlobal: (stats: any) => void;

  // Game flow states
  gameStarted: boolean;
  setGameStarted: (val: boolean) => void;
  turnOrder: (string | number)[];
  setTurnOrder: (order: (string | number)[]) => void;
  activeRoleIndex: number;
  setActiveRoleIndex: (idx: number) => void;
  turnNumber: number;
  setTurnNumber: (num: number) => void;
  rolesConfig: Record<string, { name: string; color: string; allowed_types: number[]; allowed_actions: (string | number)[] }>;

  // Interactive UI states
  hoveredUnitInfo: UrbanUnit | null;
  hoverPosition: { x: number; y: number } | null;
  selectedUnitForEdit: UrbanUnit | null;
  setSelectedUnitForEdit: (unit: UrbanUnit | null) => void;
  isEditModalOpen: boolean;
  setIsEditModalOpen: (val: boolean) => void;
  selectedUnitForGameAction: UrbanUnit | null;
  setSelectedUnitForGameAction: (unit: UrbanUnit | null) => void;
  isGameActionModalOpen: boolean;
  setIsGameActionModalOpen: (val: boolean) => void;

  // AI & controls
  roleAISettings: Record<string, boolean>;
  isAiThinking: boolean;
  isPaused: boolean;
  setIsPaused: (val: boolean) => void;
  isGameOver: boolean;
  setIsGameOver: (val: boolean) => void;

  // RL states
  isRlTraining: boolean;
  rlProgress: number;
  rlEpisode: number;
  rlLoss: number | null;
  rlLossHistory: number[];
  rlMetrics: RLTrainingMetrics | null;
  isRlLoaded: boolean;

  // Timeline
  isTimelinePlaying: boolean;
  setIsTimelinePlaying: (val: boolean) => void;
  timelineFps: number;
  setTimelineFps: (fps: number) => void;
  currentHistoryIndex: number;
  setCurrentHistoryIndex: (idx: number) => void;
  gameHistory: any[];
  setGameHistory: (history: any[]) => void;

  // Views
  standardView: 'top' | 'front' | 'left' | null;
  displayMode: string;
  setDisplayMode: (mode: string) => void;
  setStandardView: (view: 'top' | 'front' | 'left' | null) => void;
  isCameraLocked: boolean;
  setIsCameraLocked: (val: boolean) => void;

  // Derived timeline states
  isBrowsingHistory: boolean;
  displayedTopologyData: TopologyData | null;
  displayedGlobal: any;
  displayedTurnNumber: number;
  displayedActiveRoleIndex: number;
  displayedTurnOrder: (string | number)[];

  // Actions
  handleToggleRoleAI: (roleId: string) => void;
  handleUnitHover: (unit: UrbanUnit | null, x?: number, y?: number) => void;
  handleModelUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  clearBackgroundModel: () => void;
  runEvaluation: (currentTopology: TopologyData, currentGridName: string, metadata?: TopologyMetadata) => Promise<void>;
  clearTopologyGrid: () => void;
  handleJsonImported: (completeJson: any, filename: string) => void;
  handleJsonLoadingStart: () => void;
  handleJsonLoadingEnd: () => void;
  handleStartGame: () => Promise<void>;
  handleResetGame: () => void;
  handleSelectGameAction: (actionType: ActionType) => void;
  handlePlayTurn: (actionType: ActionType, unitId?: number) => Promise<void>;
  handleSkipTurn: () => void;
  handleSaveUnitEdit: (typeVal: number) => void;
  handleTrainRL: (episodes: number, lr: number) => Promise<void>;
  cancelTrainRL: () => void;
  handleSaveRL: () => Promise<void>;
  onLoadRLFile: (file: File) => Promise<void>;
  handleClearRLModels: () => Promise<void>;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Theme state
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

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

  useEffect(() => {
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
  const topologyDataRef = useRef<TopologyData | null>(null);
  useEffect(() => {
    topologyDataRef.current = topologyData;
  }, [topologyData]);

  const [originalTopologyData, setOriginalTopologyData] = useState<TopologyData | null>(null);
  const [global, setGlobal] = useState<any>({});

  // Game States
  const [gameStarted, setGameStarted] = useState<boolean>(false);
  const [turnOrder, setTurnOrder] = useState<(string | number)[]>([]);
  const [activeRoleIndex, setActiveRoleIndex] = useState<number>(0);
  const [turnNumber, setTurnNumber] = useState<number>(1);
  const [rolesConfig, setRolesConfig] = useState<Record<string, { name: string; color: string; allowed_types: number[]; allowed_actions: (string | number)[] }>>({});

  // UI Interactive States
  const [hoveredUnitInfo, setHoveredUnitInfo] = useState<UrbanUnit | null>(null);
  const [hoverPosition, setHoverPosition] = useState<{ x: number, y: number } | null>(null);
  const [selectedUnitForEdit, setSelectedUnitForEdit] = useState<UrbanUnit | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [selectedUnitForGameAction, setSelectedUnitForGameAction] = useState<UrbanUnit | null>(null);
  const [isGameActionModalOpen, setIsGameActionModalOpen] = useState<boolean>(false);

  const [roleAISettings, setRoleAISettings] = useState<Record<string, boolean>>({});
  const [isAiThinking, setIsAiThinking] = useState<boolean>(false);
  const aiTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isGameOver, setIsGameOver] = useState<boolean>(false);

  // Game History for Timeline
  const [gameHistory, setGameHistory] = useState<{
    topologyData: TopologyData;
    global: any;
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

  const displayedGlobal = gameStarted && gameHistory[currentHistoryIndex]
    ? gameHistory[currentHistoryIndex].global
    : global;

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
  const timelineIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Timeline Autoplay Loop Effect
  useEffect(() => {
    if (isTimelinePlaying) {
      if (timelineIntervalRef.current) clearInterval(timelineIntervalRef.current);
      const delay = 1000 / timelineFps;
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

  useEffect(() => {
    const initEngine = async () => {
      try {
        await tsEngine.init();
        const roles = await tsEngine.initializePlayer();
        setRolesConfig(roles);
        
        // Dynamically initialize roleAISettings based on roles
        const initialAISettings: Record<string, boolean> = {};
        Object.keys(roles).forEach(k => {
          initialAISettings[k] = false;
        });
        setRoleAISettings(initialAISettings);

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
  useEffect(() => {
    return () => {
      if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current);
      if (timelineIntervalRef.current) clearInterval(timelineIntervalRef.current);
    };
  }, []);

  // Automated AI Turn Loop Effect
  useEffect(() => {
    if (!gameStarted || !topologyData || isPaused || isGameOver || isBrowsingHistory) {
      if (aiTimeoutRef.current) {
        clearTimeout(aiTimeoutRef.current);
        aiTimeoutRef.current = null;
      }
      setIsAiThinking(false);
      return;
    }

    const allOccupied = topologyData.units.every(u => u.state.type !== 0);
    const maxSteps = topologyData.metadata?.max_turns ?? (topologyData.units.length * 2);
    const stepLimitReached = (topologyData.metadata?.timer || 0) >= maxSteps;

    if (allOccupied || stepLimitReached) {
      setIsGameOver(true);
      if (aiTimeoutRef.current) {
        clearTimeout(aiTimeoutRef.current);
        aiTimeoutRef.current = null;
      }
      setIsAiThinking(false);
      setTimeout(() => {
        alert(`Game Finished! ${allOccupied ? "All tiles are occupied." : `Reached maximum limit of ${maxSteps} steps.`}`);
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
          const { actions } = await tsEngine.getValidActions(Number(activePlayer));
          if (actions.length === 0) {
            setIsGameOver(true);
            alert("Game Finished! No more valid actions.");
            return;
          }

          let chosenAction = actions[Math.floor(Math.random() * actions.length)];
          if (isRlLoaded && topologyData) {
            const allowedBuildings = rolesConfig[String(activePlayer)]?.allowed_types || [];
            const defaultUnitType = allowedBuildings.length > 0 ? Number(allowedBuildings[0]) : null;
            const rActions = actions.map((a: any[]) => [
              a[0],
              a[1],
              a[0] === 0 ? null : defaultUnitType
            ]) as [number, number | null, number | null][];

            const recommendation = getRLActionRecommendation(topologyData, rActions);
            if (recommendation) {
              const matchedAction = actions.find((a: any[]) => a[0] === recommendation.actionType && a[1] === recommendation.unitId);
              if (matchedAction) {
                chosenAction = matchedAction;
                console.log(`DQN Recommendation executed: ${recommendation.actionType} on unit ${recommendation.unitId} (reward Q: ${recommendation.predictedReward.toFixed(4)})`);
              }
            }
          }
          const [actionType, unitId] = chosenAction;

          await handlePlayTurn(actionType, unitId === null ? undefined : unitId);
        } catch (err: any) {
          console.error("AI turn action error:", err);
          setIsGameOver(true);
        } finally {
          setIsAiThinking(false);
          aiTimeoutRef.current = null;
        }
      }, 150);
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
  const [displayMode, setDisplayMode] = useState<string>('N');
  const [isCameraLocked, setIsCameraLocked] = useState<boolean>(false);

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
      blocks: data.blocks.map((b) => ({
        topology: {
          id: b.topology.id,
          neighbor: b.topology.neighbor
        },
        state: {
          value: b.state.value
        }
      })),
      units: data.units.map((u) => ({
        topology: {
          id: u.topology.id,
          blockid: u.topology.blockid,
          buildingid: u.topology.buildingid,
          idinbuilding: u.topology.idinbuilding
        },
        geometry: {
          boundary: [],
          height: u.geometry.height
        },
        state: {
          type: u.state.type,
          value: u.state.value,
          population: u.state.population
        }
      })),
      timer: data.metadata?.timer || 0,
      metadata: data.metadata || {}
    };
  };

  // Helper to merge boundaries back from local data cache
  const mergeBoundaries = (response: any, localData: TopologyData): TopologyData => {
    const blocks = response.blocks ? response.blocks.map((b: any) => {
      const bid = Number(b.topology.id);
      const localBlock = localData.blocks.find(lb => Number(lb.topology.id) === bid);
      return {
        topology: {
          id: bid,
          neighbor: b.topology.neighbor || []
        },
        geometry: {
          boundary: localBlock ? localBlock.geometry.boundary : [],
          hole: localBlock ? localBlock.geometry.hole : []
        },
        state: {
          value: b.state.value
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
            boundary: localUnit.geometry.boundary,
            hole: localUnit.geometry.hole || []
          }
        };
      } else {
        const parentBlock = localData.blocks.find(lb => lb.topology.id === u.topology.blockid);
        return {
          ...u,
          geometry: {
            ...u.geometry,
            boundary: parentBlock ? parentBlock.geometry.boundary : [],
            hole: []
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

      setGlobal(data.metadata?.evaulate || {});

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

  const handleJsonImported = (completeJson: any, filename: string) => {
    setGridName(filename);
    setOriginalTopologyData(completeJson);
    runEvaluation(completeJson, filename, completeJson.metadata);
  };

  const handleJsonLoadingStart = () => {
    setIsLoading(true);
    setIsMapLoading(true);
  };

  const handleJsonLoadingEnd = () => {
    setIsLoading(false);
    setIsMapLoading(false);
  };

  // Clear topology grid 3D objects and reset states
  const clearTopologyGrid = () => {
    setGameStarted(false);
    setTopologyData(null);
    setOriginalTopologyData(null);
    setGridName('');
    setHoveredUnitInfo(null);

    // Dynamically reset roleAISettings based on rolesConfig
    const resetAISettings: Record<string, boolean> = {};
    Object.keys(rolesConfig).forEach(k => {
      resetAISettings[k] = false;
    });
    setRoleAISettings(resetAISettings);
    setIsAiThinking(false);
    setIsPaused(false);
    setIsGameOver(false);
    setGameHistory([]);
    setCurrentHistoryIndex(0);
    setIsTimelinePlaying(false);
    setRlLossHistory([]);
    setGlobal({});
  };

  const handleStartGame = async () => {
    if (!topologyData) {
      alert("Please upload a grid topology JSON first.");
      return;
    }
    try {
      setIsLoading(true);
      const data = await tsEngine.startGame({
        player_order: turnOrder.map(Number)
      });

      const nextStats = data.metadata?.evaulate || {};
      setGlobal(nextStats);

      const mergedTopology = mergeBoundaries(data, topologyData);
      setTopologyData(mergedTopology);

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

      const initialHistoryState = {
        topologyData: mergedTopology,
        global: nextStats,
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

      const data = await tsEngine.runGameStep({
        action_type: actionType,
        unit_id: unitId ?? null,
        unit_type: unitType
      });

      const nextStats = data.metadata?.evaulate || {};
      setGlobal(nextStats);

      const mergedTopology = mergeBoundaries(data, topologyData);
      setTopologyData(mergedTopology);

      const backendMeta = data.metadata || {};
      let nextTurnOrder = turnOrder;
      if (backendMeta.player_order) {
        setTurnOrder(backendMeta.player_order);
        nextTurnOrder = backendMeta.player_order;
      }
      setActiveRoleIndex(0);
      const nextTurnNumber = (data.metadata?.timer !== undefined ? data.metadata.timer : (data.timer || 0)) + 1;
      setTurnNumber(nextTurnNumber);

      const nextHistoryState = {
        topologyData: mergedTopology,
        global: nextStats,
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

  const handleSaveUnitEdit = (typeVal: number) => {
    if (!selectedUnitForEdit || !topologyData) return;

    const isOccupied = typeVal !== 0;
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

    if (hoveredUnitInfo && hoveredUnitInfo.topology.id === selectedUnitForEdit.topology.id) {
      const updatedUnit = updatedUnits.find(u => u.topology.id === selectedUnitForEdit.topology.id);
      if (updatedUnit) {
        setHoveredUnitInfo(updatedUnit);
      }
    }
  };

  const rlCancelledRef = useRef<boolean>(false);

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
    <GameContext.Provider value={{
      theme,
      handleToggleTheme,
      modelName,
      modelFile,
      gridName,
      setGridName,
      isLoading,
      setIsLoading,
      isModelLoading,
      setIsModelLoading,
      isMapLoading,
      setIsMapLoading,
      topologyData,
      setTopologyData,
      originalTopologyData,
      setOriginalTopologyData,
      global,
      setGlobal,
      gameStarted,
      setGameStarted,
      turnOrder,
      setTurnOrder,
      activeRoleIndex,
      setActiveRoleIndex,
      turnNumber,
      setTurnNumber,
      rolesConfig,
      hoveredUnitInfo,
      hoverPosition,
      selectedUnitForEdit,
      setSelectedUnitForEdit,
      isEditModalOpen,
      setIsEditModalOpen,
      selectedUnitForGameAction,
      setSelectedUnitForGameAction,
      isGameActionModalOpen,
      setIsGameActionModalOpen,
      roleAISettings,
      isAiThinking,
      isPaused,
      setIsPaused,
      isGameOver,
      setIsGameOver,
      isRlTraining,
      rlProgress,
      rlEpisode,
      rlLoss,
      rlLossHistory,
      rlMetrics,
      isRlLoaded,
      isTimelinePlaying,
      setIsTimelinePlaying,
      timelineFps,
      setTimelineFps,
      currentHistoryIndex,
      setCurrentHistoryIndex,
      gameHistory,
      setGameHistory,
      standardView,
      setStandardView,
      displayMode,
      setDisplayMode,
      isCameraLocked,
      setIsCameraLocked,
      isBrowsingHistory,
      displayedTopologyData,
      displayedGlobal,
      displayedTurnNumber,
      displayedActiveRoleIndex,
      displayedTurnOrder,
      handleToggleRoleAI,
      handleUnitHover,
      handleModelUpload,
      clearBackgroundModel,
      runEvaluation,
      clearTopologyGrid,
      handleJsonImported,
      handleJsonLoadingStart,
      handleJsonLoadingEnd,
      handleStartGame,
      handleResetGame,
      handleSelectGameAction,
      handlePlayTurn,
      handleSkipTurn,
      handleSaveUnitEdit,
      handleTrainRL,
      cancelTrainRL,
      handleSaveRL,
      onLoadRLFile,
      handleClearRLModels
    }}>
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};
