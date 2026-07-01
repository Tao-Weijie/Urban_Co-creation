import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgpu';
import '@tensorflow/tfjs-backend-wasm';
import { setWasmPaths } from '@tensorflow/tfjs-backend-wasm';
import { tsEngine, UrbanGraph, GameEngine } from './engine';
import { PlayerType, PlayerConfig, UnitType } from './configE';
import {
  GNN_INPUT_FEATURES,
  PPO_GAMMA,
  PPO_CLIP_VAL,
  PPO_EPOCHS,
  UI_UPDATE_INTERVAL,
  PLACE_INCENTIVE,
  SKIP_PENALTY,
  setFeature,
  actorModels,
  centralizedCriticModel,
  initOrGetRLModels,
  resetRLModels,
  setActorModel,
  setCentralizedCriticModel,
  buildableTypes
} from './configT';


export interface TopologyData {
  metadata: {
    game_started?: boolean;
    timer?: number;
    max_turns?: number;
    player_order?: number[];
    next_player?: number;
    valid_action?: number[];
    valid_type?: number[];
    evaulate?: {
      government_profit: number;
      developer_profit: number;
      total_population: number;
    };
  };
  blocks: any[];
  units: any[];
}


export function actionToId(
  action: [number, number | null, number | null],
  units: any[]
): number {
  const [actionType, unitId, targetUnitType] = action;
  const K = buildableTypes.length;
  if (actionType === 0 || unitId === null || targetUnitType === null) {
    return units.length * K;
  }
  const unitIndex = units.findIndex(u => Number(u.topology.id) === Number(unitId));
  if (unitIndex === -1) {
    return units.length * K;
  }
  const typeIndex = buildableTypes.indexOf(targetUnitType);
  if (typeIndex === -1) {
    return units.length * K;
  }
  return unitIndex * K + typeIndex;
}

export function idToAction(
  actionIndex: number,
  units: any[]
): [number, number | null, number | null] {
  const N = units.length;
  const K = buildableTypes.length;
  if (actionIndex === N * K) {
    return [0, null, null];
  }
  const unitIndex = Math.floor(actionIndex / K);
  const typeIndex = actionIndex % K;
  if (unitIndex < 0 || unitIndex >= N) {
    return [0, null, null];
  }
  const unit = units[unitIndex];
  const unitId = Number(unit.topology.id);
  const targetUnitType = buildableTypes[typeIndex];
  const actionType = unit.state.type === 0 ? 1 : 2;
  return [actionType, unitId, targetUnitType];
}

export function encodeGraphState(
  graph: TopologyData
): number[][] {
  const units = graph.units;
  const N = units.length;
  const baseGraph = UrbanGraph.fromJson(graph);
  // 预先跑一次以在 baseGraph 中缓存计算出当前地块的真实 blockValues 估值
  GameEngine.evaluate_developer_profit(baseGraph);

  const nodeFeatures: number[][] = [];
  for (let i = 0; i < N; i++) {
    const u = units[i];
    const uid = Number(u.topology.id);
    const bid = Number(u.topology.blockid);

    // 从已经缓存好的映射中快速直接读取原始地价 v
    const v = baseGraph.blockValues.get(bid) ?? 30;

    let devGain = 0;
    let govGain = 0;

    // 找到 baseGraph 唯一实例中对应的单元对象，直接通过引用原地修改
    const targetUnit = baseGraph.units.find(ou => Number(ou.id) === uid);
    if (targetUnit) {
      const originalType = targetUnit.type;

      // 局部暂存受影响地块的原评估地价以供还原，防全局污染
      const affectedBlocks = [bid, ...baseGraph.getNeighbors(bid)];
      const originalValues = new Map<number, number>();
      for (const ab of affectedBlocks) {
        originalValues.set(ab, baseGraph.blockValues.get(ab) ?? 30.0);
      }

      // 1. 原地模拟在此位置放置住宅的大盘开发商利润增量
      targetUnit.type = UnitType.RESIDENTIAL;
      GameEngine.update_local_value(baseGraph, bid); // 仅局部更新受影响块
      const resDevProfit = GameEngine.evaluate_developer_profit(baseGraph, true); // skipUpdate 设为 true

      targetUnit.type = UnitType.EMPTY;
      GameEngine.update_local_value(baseGraph, bid);
      const emptyDevProfit = GameEngine.evaluate_developer_profit(baseGraph, true);

      devGain = Math.max(0, resDevProfit - emptyDevProfit);

      // 2. 原地模拟在此位置放置绿地的大盘政府收益增量
      targetUnit.type = UnitType.GREEN;
      GameEngine.update_local_value(baseGraph, bid);
      const resGovProfit = GameEngine.evaluate_government_profit(baseGraph, true);

      govGain = Math.max(0, resGovProfit - emptyDevProfit); // 使用相同的 empty 基准进行相减

      // 原地复原单元的真实状态，并完整回滚局部地块评估值，保证大盘数据状态一致
      targetUnit.type = originalType;
      for (const ab of affectedBlocks) {
        baseGraph.blockValues.set(ab, originalValues.get(ab)!);
      }
    }

    const row = setFeature(u, devGain, govGain, v);
    nodeFeatures.push(row);
  }

  return nodeFeatures;
}

/**
 * Clears both in-memory model instances and deletes any legacy models from browser IndexedDB.
 */
export async function clearAllCachedModels(): Promise<void> {
  resetRLModels();

  try {
    await tf.io.removeModel('indexeddb://developer-ppo-model');
  } catch (e) {
    // Ignore if not present
  }
  try {
    await tf.io.removeModel('indexeddb://government-ppo-model');
  } catch (e) {
    // Ignore if not present
  }
}

function getValidActions(state: TopologyData): [number, number | null, number | null][] {
  const validActions: [number, number | null, number | null][] = [];
  const metadata = state.metadata || {};
  const validActionTypes = metadata.valid_action || [];
  const validUnitTypes = metadata.valid_type || [];

  // Check SKIP (0)
  if (validActionTypes.includes(0)) {
    validActions.push([0, null, null]);
  }

  // Check PLACE (1) and REPLACE (2)
  const hasPlace = validActionTypes.includes(1);
  const hasReplace = validActionTypes.includes(2);

  if (hasPlace || hasReplace) {
    const units = state.units || [];
    const buildingUnits = new Map<number, any[]>();
    for (const u of units) {
      const bid = u.topology.buildingid;
      if (!buildingUnits.has(bid)) {
        buildingUnits.set(bid, []);
      }
      buildingUnits.get(bid)!.push(u);
    }

    units.forEach((unit: any) => {
      const bid = unit.topology.buildingid;
      const idInBuilding = unit.topology.idinbuilding;
      const type = unit.state.type;
      const id = unit.topology.id;

      const bUnits = buildingUnits.get(bid) || [];
      const lowerUnits = bUnits.filter(ou => ou.topology.idinbuilding < idInBuilding);
      const isBottomMostEmpty = lowerUnits.every(ou => ou.state.type !== 0);

      if (hasPlace && type === 0 && isBottomMostEmpty) {
        validUnitTypes.forEach((t: any) => {
          validActions.push([1, id, Number(t)]);
        });
      } else if (hasReplace && type !== 0) {
        validUnitTypes.forEach((t: any) => {
          validActions.push([2, id, Number(t)]);
        });
      }
    });
  }

  return validActions;
}

interface Transition {
  stateFeatures: number[];
  actionIdx: number;
  oldLogProb: number;
  reward: number;
  value: number;
  done: boolean;
  mask: number[];
}

export interface RLTrainingMetrics {
  episode: number;
  avgLoss: number;
  players: Record<string | number, {
    actorLoss: number;
    criticLoss: number;
    entropy: number;
    reward: number;
  }>;
}

/**
 * Trains the Multi-Agent PPO models step-by-step using self-play episodes.
 * Uses on-policy trajectory collection and policy gradient updates client-side.
 */
export async function trainRL(
  graph: TopologyData,
  episodes: number,
  learningRate: number,
  onEpisodeEnd: (metrics: RLTrainingMetrics) => void,
  isCancelled: () => boolean,
  backendOption: 'gpu' | 'wasm' | 'cpu' = 'gpu'
): Promise<void> {
  // 动态切换指定后端，保持 GPU/WASM/CPU 高效选择
  if (backendOption === 'wasm') {
    try {
      setWasmPaths('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm/dist/');
      tf.env().set('WASM_HAS_MULTITHREAD_SUPPORT', true);
      tf.env().set('WASM_HAS_SIMD_SUPPORT', true);
      await tf.setBackend('wasm');
      console.log(`[MAPPO] Switched backend to: WASM (SIMD & Multithread enabled)`);
    } catch (e) {
      console.warn(`[MAPPO] Failed to switch to WASM backend, fallback to CPU:`, e);
      await tf.setBackend('cpu');
    }
  } else if (backendOption === 'cpu') {
    await tf.setBackend('cpu');
    console.log(`[MAPPO] Switched backend to: CPU`);
  } else {
    // 强制使用 GPU，优先使用 WebGPU 其次 WebGL
    if (tf.getBackend() !== 'webgpu' && tf.getBackend() !== 'webgl') {
      try {
        await tf.setBackend('webgpu');
        console.log(`[MAPPO] Switched backend to: WebGPU`);
      } catch (e) {
        console.warn(`[MAPPO] Failed to switch to WebGPU backend, trying WebGL:`, e);
        try {
          await tf.setBackend('webgl');
          console.log(`[MAPPO] Switched backend to: WebGL`);
        } catch (err) {
          console.warn(`[MAPPO] Failed to switch to WebGL backend, fallback to current:`, err);
        }
      }
    }
  }

  // Normalize graph blocks and units to match the standard tsEngine.ts JSON format
  const normalizedGraph = {
    blocks: graph.blocks.map(b => ({
      topology: {
        id: b.topology.id,
        neighbor: b.topology.neighbor
      },
      state: {
        value: b.state.value
      }
    })),
    units: graph.units.map(u => ({
      topology: {
        id: u.topology.id,
        blockid: u.topology.blockid,
        buildingid: u.topology.buildingid,
        idinbuilding: u.topology.idinbuilding
      },
      geometry: {
        boundary: u.geometry.boundary,
        height: u.geometry.height
      },
      state: {
        type: u.state.type,
        value: u.state.value,
        population: u.state.population
      }
    })),
    metadata: graph.metadata
  };

  const N = normalizedGraph.units.length;
  const inputSize = N * GNN_INPUT_FEATURES;
  const outputSize = (N * buildableTypes.length) + 1; // N slots * K unitTypes + 1 SKIP

  const { actors, centralizedCriticModel } = initOrGetRLModels(inputSize, outputSize);
  const developerModel = actors.get(PlayerType.DEVELOPER)!;
  const governmentModel = actors.get(PlayerType.GOVERNMENT)!;

  // Setup optimizers for actors and the centralized critic
  const devOptimizer = tf.train.adam(learningRate);
  const govOptimizer = tf.train.adam(learningRate);
  const criticOptimizer = tf.train.adam(learningRate);

  const gamma = PPO_GAMMA;  // Effective horizon ≈ 1/(1-γ) = 33 steps; covers long-range placement strategies
  const clipVal = PPO_CLIP_VAL;
  const epochs = PPO_EPOCHS; // number of PPO optimization epochs per rollout

  const maxSteps = graph.metadata?.max_turns ?? (N * 2);

  // Clean starting graph JSON for stateless payloads
  const startingGraphPayload = {
    blocks: normalizedGraph.blocks,
    units: normalizedGraph.units,
    metadata: { timer: 0, game_started: false }
  };

  for (let ep = 0; ep < episodes; ep++) {
    if (isCancelled()) break;

    // Trajectory buffers
    const developerBuffer: Transition[] = [];
    const governmentBuffer: Transition[] = [];

    // 1. Call training start on backend
    let episodeState: TopologyData = tsEngine.trainingStart({
      graph: startingGraphPayload,
      player_order: [1, 2]
    });
    let stepCount = 0;

    let stateFeatures = encodeGraphState(episodeState).flat();
    let finalStateFeatures = stateFeatures;
    let finalDone = false;

    // On-policy rollout collection loop
    while (stepCount < maxSteps) {
      if (isCancelled()) break;

      const unitsFinished = episodeState.units.every(u => u.state.type !== 0);
      const timerFinished = (episodeState.metadata?.timer ?? 0) >= maxSteps;
      if (unitsFinished || timerFinished) {
        finalDone = true;
        break;
      }

      const validActions = getValidActions(episodeState);
      if (validActions.length === 0) {
        finalDone = true;
        break;
      }

      const activePlayer = episodeState.metadata.next_player ?? PlayerType.DEVELOPER;
      if (activePlayer !== PlayerType.DEVELOPER && activePlayer !== PlayerType.GOVERNMENT) {
        throw new TypeError(`Invalid PlayerType value: ${activePlayer}`);
      }

      const actorModel = activePlayer === PlayerType.DEVELOPER ? developerModel : governmentModel;

      // Forward pass to get action logits and state value from Centralized Critic (1D Flat MLP style)
      const { lTensor, vTensor } = tf.tidy(() => {
        const xs = tf.tensor2d([stateFeatures]);
        const l = actorModel.predict(xs) as tf.Tensor;
        const v = centralizedCriticModel.predict(xs) as tf.Tensor; // outputs [V_dev, V_gov]
        return { lTensor: l.clone(), vTensor: v.clone() };
      });

      const logitsData = await lTensor.data();
      const vData = await vTensor.data();
      lTensor.dispose();
      vTensor.dispose();

      const logits = Array.from(logitsData);
      const stateValue = activePlayer === PlayerType.DEVELOPER ? vData[0] : vData[1];

      // Construct action mask (1 for valid, 0 for invalid)
      const mask = new Array(outputSize).fill(0);
      const validIndices = validActions.map(action => {
        const idx = actionToId(action, episodeState.units);
        mask[idx] = 1;
        return idx;
      });

      // Softmax over valid actions in JS for performance
      const validLogits = validIndices.map(idx => logits[idx]);
      const maxVal = Math.max(...validLogits);
      const exps = validLogits.map(l => Math.exp(l - maxVal));
      const sumExps = exps.reduce((a, b) => a + b, 0);
      const validProbs = exps.map(e => e / (sumExps + 1e-8));

      // Sample action from probability distribution
      let chosenAction = validActions[0];
      let actionIdx = N * buildableTypes.length; // SKIP index
      let oldLogProb = 0;

      const r = Math.random();
      let cumulativeProb = 0;
      for (let i = 0; i < validProbs.length; i++) {
        cumulativeProb += validProbs[i];
        if (r <= cumulativeProb) {
          chosenAction = validActions[i];
          actionIdx = validIndices[i];
          oldLogProb = Math.log(validProbs[i] + 1e-8);
          break;
        }
      }

      // Step action configuration
      const builtType = chosenAction[2] ?? 0;

      const nextEpisodeState: TopologyData = tsEngine.trainingStep(
        chosenAction[0] ?? 0,
        chosenAction[1],
        builtType
      );

      const lastMetrics = episodeState.metadata.evaulate || { developer_profit: 0, government_profit: 0 };
      const nextMetrics = nextEpisodeState.metadata.evaulate || { developer_profit: 0, government_profit: 0 };

      // Reward computation
      let reward = 0;
      if (activePlayer === PlayerType.DEVELOPER) { // Developer
        reward = (nextMetrics.developer_profit - lastMetrics.developer_profit) / 1000.0;
      } else { // Government
        reward = (nextMetrics.government_profit - lastMetrics.government_profit) / 100.0;
      }

      // 1. PLACE 动作探索补偿激励：抵消前期建房的建筑成本赤字，鼓励积极规划
      const isPlace = (chosenAction[0] ?? 0) === 1;
      if (isPlace) {
        reward += PLACE_INCENTIVE;
      }

      // 2. 智能条件 SKIP 惩罚：有空地却跳过重罚，建满跳过不罚
      const isSkip = (chosenAction[0] ?? 0) === 0;
      if (isSkip) {
        const hasEmptySlots = episodeState.units.some(u => u.state.type === 0);
        if (hasEmptySlots) {
          reward -= SKIP_PENALTY;
        }
      }

      const nextUnitsFinished = nextEpisodeState.units.every(u => u.state.type !== 0);
      const nextTimerFinished = (nextEpisodeState.metadata?.timer ?? 0) >= maxSteps;
      const done = nextUnitsFinished || nextTimerFinished;

      // Penalty 2: 终局惩罚 — 若因超时结束且仍有空格，按空格比例惩罚
      if (done && nextTimerFinished && !nextUnitsFinished) {
         const totalUnits = nextEpisodeState.units.length;
         const emptyUnits = nextEpisodeState.units.filter(u => u.state.type === 0).length;
         const emptyRatio = totalUnits > 0 ? emptyUnits / totalUnits : 0;
         reward -= 0.5 * emptyRatio;
      }

      // Record step transition
      const transition: Transition = {
        stateFeatures,
        actionIdx,
        oldLogProb,
        reward,
        value: stateValue,
        done,
        mask
      };

      if (activePlayer === PlayerType.DEVELOPER) {
        developerBuffer.push(transition);
      } else {
        governmentBuffer.push(transition);
      }

      episodeState = nextEpisodeState;
      stateFeatures = encodeGraphState(episodeState).flat();
      finalStateFeatures = stateFeatures;
      finalDone = done;
      stepCount++;

      // 每 50 步主动释放一次 CPU 主线程控制权，兼顾网页响应能力与硬件计算吞吐率
      if (stepCount % 50 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    if (isCancelled()) break;

    // 2. Perform centralized critic and actor gradient optimization using trajectory buffers
    let devMetrics = { actorLoss: 0, entropy: 0 };
    let govMetrics = { actorLoss: 0, entropy: 0 };
    let avgLoss = 0;
    let devCriticLoss = 0;
    let govCriticLoss = 0;

    // Bootstrap values for terminal/non-terminal states from centralized critic
    let lastValDev = 0;
    let lastValGov = 0;
    if (!finalDone) {
      const vTensor = tf.tidy(() => {
        const xs = tf.tensor2d([finalStateFeatures]);
        return (centralizedCriticModel.predict(xs) as tf.Tensor).clone();
      });
      const vData = await vTensor.data();
      vTensor.dispose();
      lastValDev = vData[0];
      lastValGov = vData[1];
    }

    // Prepare Developer returns & advantages
    const devT = developerBuffer.length;
    const devReturns: number[][] = new Array(devT);
    const devAdvantages: number[] = new Array(devT);
    let G_dev = lastValDev;
    for (let t = devT - 1; t >= 0; t--) {
      G_dev = developerBuffer[t].reward + gamma * G_dev;
      devReturns[t] = [G_dev];
      devAdvantages[t] = G_dev - developerBuffer[t].value;
    }

    // Standardize Developer advantages
    let normalizedDevAdvantages: number[] = [];
    if (devT > 0) {
      const meanDev = devAdvantages.reduce((a, b) => a + b, 0) / devT;
      const varDev = devAdvantages.reduce((a, b) => a + Math.pow(b - meanDev, 2), 0) / devT;
      const stdDev = Math.sqrt(varDev) + 1e-8;
      normalizedDevAdvantages = devAdvantages.map(a => (a - meanDev) / stdDev);
    }

    // Prepare Government returns & advantages
    const govT = governmentBuffer.length;
    const govReturns: number[][] = new Array(govT);
    const govAdvantages: number[] = new Array(govT);
    let G_gov = lastValGov;
    for (let t = govT - 1; t >= 0; t--) {
      G_gov = governmentBuffer[t].reward + gamma * G_gov;
      govReturns[t] = [G_gov];
      govAdvantages[t] = G_gov - governmentBuffer[t].value;
    }

    // Standardize Government advantages
    let normalizedGovAdvantages: number[] = [];
    if (govT > 0) {
      const meanGov = govAdvantages.reduce((a, b) => a + b, 0) / govT;
      const varGov = govAdvantages.reduce((a, b) => a + Math.pow(b - meanGov, 2), 0) / govT;
      const stdGov = Math.sqrt(varGov) + 1e-8;
      normalizedGovAdvantages = govAdvantages.map(a => (a - meanGov) / stdGov);
    }

    // Pre-create tensors outside the epoch optimization loop to avoid memory leaks/re-creation overhead
    let devStatesTensor: tf.Tensor2D | null = null;
    let devActionsTensor: tf.Tensor1D | null = null;
    let devOldLogProbsTensor: tf.Tensor1D | null = null;
    let devReturnsTensor: tf.Tensor2D | null = null;
    let devAdvantagesTensor: tf.Tensor1D | null = null;
    let devMasksTensor: tf.Tensor2D | null = null;

    if (devT > 0) {
      devStatesTensor = tf.tensor2d(developerBuffer.map(t => t.stateFeatures));
      devActionsTensor = tf.tensor1d(developerBuffer.map(t => t.actionIdx), 'int32');
      devOldLogProbsTensor = tf.tensor1d(developerBuffer.map(t => t.oldLogProb));
      devReturnsTensor = tf.tensor2d(devReturns);
      devAdvantagesTensor = tf.tensor1d(normalizedDevAdvantages);
      devMasksTensor = tf.tensor2d(developerBuffer.map(t => t.mask));
    }

    let govStatesTensor: tf.Tensor2D | null = null;
    let govActionsTensor: tf.Tensor1D | null = null;
    let govOldLogProbsTensor: tf.Tensor1D | null = null;
    let govReturnsTensor: tf.Tensor2D | null = null;
    let govAdvantagesTensor: tf.Tensor1D | null = null;
    let govMasksTensor: tf.Tensor2D | null = null;

    if (govT > 0) {
      govStatesTensor = tf.tensor2d(governmentBuffer.map(t => t.stateFeatures));
      govActionsTensor = tf.tensor1d(governmentBuffer.map(t => t.actionIdx), 'int32');
      govOldLogProbsTensor = tf.tensor1d(governmentBuffer.map(t => t.oldLogProb));
      govReturnsTensor = tf.tensor2d(govReturns);
      govAdvantagesTensor = tf.tensor1d(normalizedGovAdvantages);
      govMasksTensor = tf.tensor2d(governmentBuffer.map(t => t.mask));
    }

    let totalEpochDevActorLoss = 0;
    let totalEpochDevEntropy = 0;
    let totalEpochGovActorLoss = 0;
    let totalEpochGovEntropy = 0;
    let totalEpochDevCriticLoss = 0;
    let totalEpochGovCriticLoss = 0;

    for (let epoch = 0; epoch < epochs; epoch++) {
      // 1. Optimize Developer Actor (Policy network)
      if (devT > 0 && devStatesTensor && devActionsTensor && devOldLogProbsTensor && devAdvantagesTensor && devMasksTensor) {
        let epDevActorLoss = 0;
        let epDevEntropy = 0;
        let devActorLossTensor: tf.Tensor | null = null;
        let devEntropyTensor: tf.Tensor | null = null;
        const lossTensor = devOptimizer.minimize(() => {
          const logits = developerModel.predict(devStatesTensor!) as tf.Tensor;
          const maskedLogits = tf.where(devMasksTensor!.greater(0), logits, tf.fill(logits.shape, -1e9));
          const probs = tf.softmax(maskedLogits);
          const newProbs = tf.sum(probs.mul(tf.oneHot(devActionsTensor!, outputSize)), 1);
          const newLogProbs = tf.log(newProbs.add(1e-8));
          const ratio = tf.exp(newLogProbs.sub(devOldLogProbsTensor!));
          const surr1 = ratio.mul(devAdvantagesTensor!);
          const surr2 = tf.clipByValue(ratio, 1.0 - clipVal, 1.0 + clipVal).mul(devAdvantagesTensor!);
          const actorLoss = tf.mean(tf.minimum(surr1, surr2)).neg();
          const entropy = tf.mean(tf.sum(probs.mul(tf.log(probs.add(1e-8))).neg(), 1));
          const loss = actorLoss.sub(entropy.mul(0.01));
 
          devActorLossTensor = tf.keep(actorLoss.clone());
          devEntropyTensor = tf.keep(entropy.clone());
          return loss as tf.Scalar;
        }, true, developerModel.trainableWeights.map((w: any) => w.val));
        if (lossTensor) {
          if (devActorLossTensor) {
            epDevActorLoss = (await (devActorLossTensor as tf.Tensor).data())[0];
            (devActorLossTensor as tf.Tensor).dispose();
          }
          if (devEntropyTensor) {
            epDevEntropy = (await (devEntropyTensor as tf.Tensor).data())[0];
            (devEntropyTensor as tf.Tensor).dispose();
          }
          totalEpochDevActorLoss += epDevActorLoss;
          totalEpochDevEntropy += epDevEntropy;
          lossTensor.dispose();
        }
      }

      // 2. Optimize Government Actor (Policy network)
      if (govT > 0 && govStatesTensor && govActionsTensor && govOldLogProbsTensor && govAdvantagesTensor && govMasksTensor) {
        let epGovActorLoss = 0;
        let epGovEntropy = 0;
        let govActorLossTensor: tf.Tensor | null = null;
        let govEntropyTensor: tf.Tensor | null = null;
        const lossTensor = govOptimizer.minimize(() => {
          const logits = governmentModel.predict(govStatesTensor!) as tf.Tensor;
          const maskedLogits = tf.where(govMasksTensor!.greater(0), logits, tf.fill(logits.shape, -1e9));
          const probs = tf.softmax(maskedLogits);
          const newProbs = tf.sum(probs.mul(tf.oneHot(govActionsTensor!, outputSize)), 1);
          const newLogProbs = tf.log(newProbs.add(1e-8));
          const ratio = tf.exp(newLogProbs.sub(govOldLogProbsTensor!));
          const surr1 = ratio.mul(govAdvantagesTensor!);
          const surr2 = tf.clipByValue(ratio, 1.0 - clipVal, 1.0 + clipVal).mul(govAdvantagesTensor!);
          const actorLoss = tf.mean(tf.minimum(surr1, surr2)).neg();
          const entropy = tf.mean(tf.sum(probs.mul(tf.log(probs.add(1e-8))).neg(), 1));
          const loss = actorLoss.sub(entropy.mul(0.01));
 
          govActorLossTensor = tf.keep(actorLoss.clone());
          govEntropyTensor = tf.keep(entropy.clone());
          return loss as tf.Scalar;
        }, true, governmentModel.trainableWeights.map((w: any) => w.val));
        if (lossTensor) {
          if (govActorLossTensor) {
            epGovActorLoss = (await (govActorLossTensor as tf.Tensor).data())[0];
            (govActorLossTensor as tf.Tensor).dispose();
          }
          if (govEntropyTensor) {
            epGovEntropy = (await (govEntropyTensor as tf.Tensor).data())[0];
            (govEntropyTensor as tf.Tensor).dispose();
          }
          totalEpochGovActorLoss += epGovActorLoss;
          totalEpochGovEntropy += epGovEntropy;
          lossTensor.dispose();
        }
      }

      // 3. Optimize Centralized Critic network
      let epDevCriticLoss = 0;
      let epGovCriticLoss = 0;
      if (devT > 0 || govT > 0) {
        let devCLossTensor: tf.Tensor | null = null;
        let govCLossTensor: tf.Tensor | null = null;
        const cLossTensor = criticOptimizer.minimize(() => {
          let loss: tf.Tensor = tf.scalar(0);
          let hasLoss = false;
          if (devT > 0 && devStatesTensor && devReturnsTensor) {
            const devPreds = centralizedCriticModel.apply(devStatesTensor!, { training: true }) as tf.Tensor;
            const devPredValues = tf.slice(devPreds, [0, 0], [-1, 1]); // index 0 is Developer
            const cLoss = tf.losses.meanSquaredError(devReturnsTensor!, devPredValues);
            devCLossTensor = tf.keep(cLoss.clone());
            loss = loss.add(cLoss);
            hasLoss = true;
          }
          if (govT > 0 && govStatesTensor && govReturnsTensor) {
            const govPreds = centralizedCriticModel.apply(govStatesTensor!, { training: true }) as tf.Tensor;
            const govPredValues = tf.slice(govPreds, [0, 1], [-1, 1]); // index 1 is Government
            const cLoss = tf.losses.meanSquaredError(govReturnsTensor!, govPredValues);
            govCLossTensor = tf.keep(cLoss.clone());
            loss = loss.add(cLoss);
            hasLoss = true;
          }
          return hasLoss ? (loss as tf.Scalar) : tf.scalar(0).add(tf.sum(centralizedCriticModel.trainableWeights[0].read()).mul(0.0)) as tf.Scalar;
        }, true, centralizedCriticModel.trainableWeights.map((w: any) => w.val));
        if (cLossTensor) {
          if (devCLossTensor) {
            epDevCriticLoss = (await (devCLossTensor as tf.Tensor).data())[0];
            (devCLossTensor as tf.Tensor).dispose();
          }
          if (govCLossTensor) {
            epGovCriticLoss = (await (govCLossTensor as tf.Tensor).data())[0];
            (govCLossTensor as tf.Tensor).dispose();
          }
          totalEpochDevCriticLoss += epDevCriticLoss;
          totalEpochGovCriticLoss += epGovCriticLoss;
          cLossTensor.dispose();
        }
      }
    }

    // Clean up pre-created tensors
    if (devStatesTensor) devStatesTensor.dispose();
    if (devActionsTensor) devActionsTensor.dispose();
    if (devOldLogProbsTensor) devOldLogProbsTensor.dispose();
    if (devReturnsTensor) devReturnsTensor.dispose();
    if (devAdvantagesTensor) devAdvantagesTensor.dispose();
    if (devMasksTensor) devMasksTensor.dispose();

    if (govStatesTensor) govStatesTensor.dispose();
    if (govActionsTensor) govActionsTensor.dispose();
    if (govOldLogProbsTensor) govOldLogProbsTensor.dispose();
    if (govReturnsTensor) govReturnsTensor.dispose();
    if (govAdvantagesTensor) govAdvantagesTensor.dispose();
    if (govMasksTensor) govMasksTensor.dispose();

    // Average the epoch metrics
    devMetrics = { actorLoss: totalEpochDevActorLoss / epochs, entropy: totalEpochDevEntropy / epochs };
    govMetrics = { actorLoss: totalEpochGovActorLoss / epochs, entropy: totalEpochGovEntropy / epochs };
    devCriticLoss = totalEpochDevCriticLoss / epochs;
    govCriticLoss = totalEpochGovCriticLoss / epochs;
    avgLoss = (devCriticLoss + govCriticLoss) / 2;

    const devReward = developerBuffer.reduce((sum, t) => sum + t.reward, 0);
    const govReward = governmentBuffer.reduce((sum, t) => sum + t.reward, 0);

    // Throttle React UI updates based on configT interval
    const shouldUpdateUI = (ep + 1) % UI_UPDATE_INTERVAL === 0 || ep === episodes - 1;
    if (shouldUpdateUI) {
      onEpisodeEnd({
        episode: ep + 1,
        avgLoss,
        players: {
          [PlayerType.DEVELOPER]: {
            actorLoss: devMetrics.actorLoss,
            criticLoss: devCriticLoss,
            entropy: devMetrics.entropy,
            reward: devReward
          },
          [PlayerType.GOVERNMENT]: {
            actorLoss: govMetrics.actorLoss,
            criticLoss: govCriticLoss,
            entropy: govMetrics.entropy,
            reward: govReward
          }
        }
      });
    }

    // Yield control to the browser event loop
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}

/**
 * Gets action recommendation using the trained TF.js Actor model in the browser.
 */
export function getRLActionRecommendation(
  graph: TopologyData,
  validActions: [number, number | null, number | null][]
): { actionType: number; unitId: number | null; predictedReward: number } | null {
  if (validActions.length === 0 || !graph.metadata?.player_order || graph.metadata.player_order.length === 0) {
    return null;
  }

  const activePlayer = graph.metadata.player_order[0];
  if (activePlayer !== PlayerType.DEVELOPER && activePlayer !== PlayerType.GOVERNMENT) {
    throw new TypeError(`Invalid PlayerType value: ${activePlayer}`);
  }
  const model = actorModels.get(activePlayer);
  if (!model) {
    return null;
  }

  // Normalize graph blocks and units to match the standard tsEngine.ts JSON format
  const normalizedGraph = {
    blocks: graph.blocks.map(b => ({
      topology: {
        id: b.topology.id,
        neighbor: b.topology.neighbor
      },
      state: {
        value: b.state.value
      }
    })),
    units: graph.units.map(u => ({
      topology: {
        id: u.topology.id,
        blockid: u.topology.blockid,
        buildingid: u.topology.buildingid,
        idinbuilding: u.topology.idinbuilding
      },
      geometry: {
        boundary: u.geometry.boundary,
        height: u.geometry.height
      },
      state: {
        type: u.state.type,
        value: u.state.value,
        population: u.state.population
      }
    })),
    metadata: graph.metadata
  };

  const stateFeatures = encodeGraphState(normalizedGraph).flat();
  const logits = tf.tidy(() => {
    const xs = tf.tensor2d([stateFeatures]);
    const ys = model.predict(xs) as tf.Tensor;
    return Array.from(ys.dataSync());
  });

  let bestAction: [number, number | null, number | null] | null = null;
  let maxLogit = -Infinity;

  for (const action of validActions) {
    const actionIdx = actionToId(action, normalizedGraph.units);
    const logit = logits[actionIdx];
    if (logit > maxLogit) {
      maxLogit = logit;
      bestAction = action;
    }
  }

  if (!bestAction) return null;
  return {
    actionType: bestAction[0] ?? 0,
    unitId: bestAction[1],
    predictedReward: maxLogit
  };
}

export interface ConsolidatedModelPayload {
  version: string;
  developer: {
    modelTopology: any;
    weightSpecs: any[];
    weightData: string;
  };
  government: {
    modelTopology: any;
    weightSpecs: any[];
    weightData: string;
  };
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Saves both Developer and Government PPO Actor models as a single consolidated JSON file.
 */
export async function saveRLModels(): Promise<void> {
  const devModel = actorModels.get(PlayerType.DEVELOPER);
  const govModel = actorModels.get(PlayerType.GOVERNMENT);

  if (!devModel || !govModel) {
    throw new Error("No trained RL models found to save. Please train the model first!");
  }

  const artifactsHolder = {
    dev: null as tf.io.ModelArtifacts | null,
    gov: null as tf.io.ModelArtifacts | null
  };

  await devModel.save({
    save: async (artifacts) => {
      artifactsHolder.dev = artifacts;
      return { modelArtifactsInfo: { dateSaved: new Date(), modelTopologyType: 'JSON' } };
    }
  });

  await govModel.save({
    save: async (artifacts) => {
      artifactsHolder.gov = artifacts;
      return { modelArtifactsInfo: { dateSaved: new Date(), modelTopologyType: 'JSON' } };
    }
  });

  if (!artifactsHolder.dev || !artifactsHolder.gov) {
    throw new Error("Failed to serialize model weights in memory.");
  }

  const payload: ConsolidatedModelPayload = {
    version: "1.0",
    developer: {
      modelTopology: artifactsHolder.dev.modelTopology,
      weightSpecs: artifactsHolder.dev.weightSpecs ?? [],
      weightData: artifactsHolder.dev.weightData ? arrayBufferToBase64(artifactsHolder.dev.weightData as ArrayBuffer) : ""
    },
    government: {
      modelTopology: artifactsHolder.gov.modelTopology,
      weightSpecs: artifactsHolder.gov.weightSpecs ?? [],
      weightData: artifactsHolder.gov.weightData ? arrayBufferToBase64(artifactsHolder.gov.weightData as ArrayBuffer) : ""
    }
  };

  const jsonString = JSON.stringify(payload);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'urban-mappo-models.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Loads both Developer and Government PPO Actor models from a single consolidated JSON file.
 */
export async function loadRLModelFromSingleFile(jsonFile: File): Promise<void> {
  const text = await jsonFile.text();
  const payload: ConsolidatedModelPayload = JSON.parse(text);

  if (!payload.developer || !payload.government) {
    throw new Error("Invalid consolidated model file structure.");
  }

  // Load Developer Actor Model
  const devModel = await tf.loadLayersModel({
    load: async () => {
      return {
        modelTopology: payload.developer.modelTopology,
        weightSpecs: payload.developer.weightSpecs,
        weightData: base64ToArrayBuffer(payload.developer.weightData)
      };
    }
  });

  // Load Government Actor Model
  const govModel = await tf.loadLayersModel({
    load: async () => {
      return {
        modelTopology: payload.government.modelTopology,
        weightSpecs: payload.government.weightSpecs,
        weightData: base64ToArrayBuffer(payload.government.weightData)
      };
    }
  });

  setActorModel(PlayerType.DEVELOPER, devModel);
  setActorModel(PlayerType.GOVERNMENT, govModel);

  const inputSize = devModel.inputs[0].shape[1] || (477 * GNN_INPUT_FEATURES); // 默认以全图 477 个单元为例

  // Re-initialize Centralized Critic network
  const featuresInput = tf.input({ shape: [inputSize], name: 'state_features' });

  const dense1 = tf.layers.dense({ units: 64, activation: 'relu' }).apply(featuresInput) as tf.SymbolicTensor;
  const dense2 = tf.layers.dense({ units: 32, activation: 'relu' }).apply(dense1) as tf.SymbolicTensor;
  const output = tf.layers.dense({ units: 2 }).apply(dense2) as tf.SymbolicTensor;

  setCentralizedCriticModel(tf.model({ inputs: featuresInput, outputs: output }));
}
