import * as tf from '@tensorflow/tfjs';
import { tsEngine, PlayerType } from './tsEngine';


export interface TopologyData {
  metadata: {
    game_started?: boolean;
    timer?: number;
    player_order?: number[];
    next_player?: number;
    valid_action?: number[];
    valid_type?: number[];
    evaulate?: {
      government_tax: number;
      developer_profit: number;
      total_population: number;
    };
  };
  blocks: any[];
  units: any[];
}

/**
 * Builds a block-id → neighbour-block-ids lookup map from the static topology.
 * Blocks never change during a game, so this is computed once per training run.
 */
export function buildNeighborMap(blocks: any[]): Map<number, number[]> {
  const map = new Map<number, number[]>();
  for (const b of blocks) {
    map.set(Number(b.id), (b.neighbor || []).map(Number));
  }
  return map;
}

/**
 * Encodes the graph state into a flat array of features for TF.js.
 * Per-unit features (7 per unit):
 *   [is_empty, is_residential, is_green, height_norm, value_norm,
 *    dev_potential, gov_influence]
 *
 * dev_potential  — estimated developer net profit if this cell becomes residential,
 *                  derived from the evaluate() formula (normalised by 50 000).
 * gov_influence  — estimated government tax gain if this cell becomes green, based
 *                  on neighbouring residential density (normalised by 10 000).
 */
export function encodeGraphState(
  graph: TopologyData,
  neighborMap?: Map<number, number[]>
): number[] {
  // Build block → units index for neighbour lookups
  const blockUnits = new Map<number, any[]>();
  for (const u of graph.units) {
    const bid = Number(u.blockid ?? -1);
    if (!blockUnits.has(bid)) blockUnits.set(bid, []);
    blockUnits.get(bid)!.push(u);
  }

  // Evaluation constants (mirror of tsEngine evaluate())
  const P_max = 150.0, mu = 60.0, sigma = 20.0;

  const features: number[] = [];
  for (const u of graph.units) {
    const bid = Number(u.blockid ?? -1);
    const blockObj = graph.blocks.find(b => b.id === bid);
    const v = blockObj?.value ?? u.value ?? 30;
    const h   = u.height ?? 1;

    features.push(u.type === 0 ? 1 : 0);       // is_empty
    features.push(u.type === 1 ? 1 : 0);       // is_residential
    features.push(u.type === 2 ? 1 : 0);       // is_green
    features.push(h / 10.0);                   // height normalised
    features.push(v / 100.0);                  // land value (evaluation knowledge)

    // --- dev_potential ---
    // Estimated developer net profit if this unit becomes residential.
    // Formula: revenue = pop × v × 0.5;  cost = v × h × 10
    const pop_per_floor = P_max * Math.exp(-Math.pow(v - mu, 2) / (2 * sigma * sigma));
    const est_pop  = Math.round(pop_per_floor) * h;
    const dev_gain = Math.max(0, est_pop * v * 0.5 - v * h * 10);
    features.push(Math.min(1, dev_gain / 50000.0));

    // --- gov_influence ---
    // Government earns tax from residential units (land_price + population_tax).
    // Placing green at this cell increases neighbouring residential values.
    // Proxy: count same-block + neighbour residential units × base tax rate.
    let gov_gain = 0;
    if (neighborMap) {
      const neighborIds = neighborMap.get(bid) ?? [];
      const sameRes = (blockUnits.get(bid) ?? []).filter((bu: any) => bu.type === 1).length;
      let nbRes = 0;
      for (const nid of neighborIds) {
        nbRes += (blockUnits.get(nid) ?? []).filter((nu: any) => nu.type === 1).length;
      }
      // Approximate tax boost: each nearby residential unit contributes ~500 tax units
      gov_gain = (sameRes + nbRes * 0.5) * 500;
    }
    features.push(Math.min(1, gov_gain / 10000.0));
  }
  return features;
}

// Global persistent tfjs model variables for MAPPO (Actor and Centralized Critic networks)
export let developerRLModel: tf.LayersModel | null = null;         // Actor
export let governmentRLModel: tf.LayersModel | null = null;        // Actor
export let centralizedCriticModel: tf.LayersModel | null = null;   // Centralized Critic (Outputs [V_dev, V_gov])

/**
 * Initializes or retrieves existing persistent RL Actor and Centralized Critic models.
 */
export function initOrGetRLModels(inputSize: number, outputSize: number): {
  developerModel: tf.LayersModel;
  governmentModel: tf.LayersModel;
  centralizedCriticModel: tf.LayersModel;
} {
  if (developerRLModel) {
    console.log("[MAPPO] Reusing existing loaded/trained Developer Actor model.");
  } else {
    console.log("[MAPPO] Initializing new Developer Actor model.");
  }
  if (governmentRLModel) {
    console.log("[MAPPO] Reusing existing loaded/trained Government Actor model.");
  } else {
    console.log("[MAPPO] Initializing new Government Actor model.");
  }
  if (centralizedCriticModel) {
    console.log("[MAPPO] Reusing existing loaded/trained Centralized Critic model.");
  } else {
    console.log("[MAPPO] Initializing new Centralized Critic model.");
  }

  if (!developerRLModel) {
    // Developer Actor (Policy network)
    // Hidden layers scaled for ~300-unit maps (inputSize ≈ 1500)
    const actor = tf.sequential();
    actor.add(tf.layers.dense({ inputShape: [inputSize], units: 256, activation: 'relu' }));
    actor.add(tf.layers.dense({ units: 128, activation: 'relu' }));
    actor.add(tf.layers.dense({ units: outputSize })); // Logits output (linear)
    developerRLModel = actor;
  }

  if (!governmentRLModel) {
    // Government Actor (Policy network)
    const actor = tf.sequential();
    actor.add(tf.layers.dense({ inputShape: [inputSize], units: 256, activation: 'relu' }));
    actor.add(tf.layers.dense({ units: 128, activation: 'relu' }));
    actor.add(tf.layers.dense({ units: outputSize })); // Logits output (linear)
    governmentRLModel = actor;
  }

  if (!centralizedCriticModel) {
    // Centralized Critic: wider network to evaluate combined state of both agents
    const critic = tf.sequential();
    critic.add(tf.layers.dense({ inputShape: [inputSize], units: 256, activation: 'relu' }));
    critic.add(tf.layers.dense({ units: 128, activation: 'relu' }));
    critic.add(tf.layers.dense({ units: 2 })); // 2 outputs: [V_dev, V_gov]
    centralizedCriticModel = critic;
  }

  return {
    developerModel: developerRLModel,
    governmentModel: governmentRLModel,
    centralizedCriticModel: centralizedCriticModel
  };
}

/**
 * Clears both in-memory model instances and deletes any legacy models from browser IndexedDB.
 */
export async function clearAllCachedModels(): Promise<void> {
  developerRLModel = null;
  governmentRLModel = null;
  centralizedCriticModel = null;

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

function getValidActions(state: TopologyData): (number | null)[][] {
  const validActions: (number | null)[][] = [];
  const metadata = state.metadata || {};
  const validActionTypes = metadata.valid_action || [];

  // Check SKIP (0)
  if (validActionTypes.includes(0)) {
    validActions.push([0, null]);
  }

  // Check PLACE (1) and REPLACE (2)
  const hasPlace = validActionTypes.includes(1);
  const hasReplace = validActionTypes.includes(2);

  if (hasPlace || hasReplace) {
    const units = state.units || [];
    const buildingUnits = new Map<number, any[]>();
    for (const u of units) {
      if (!buildingUnits.has(u.buildingid)) {
        buildingUnits.set(u.buildingid, []);
      }
      buildingUnits.get(u.buildingid)!.push(u);
    }

    units.forEach((unit: any) => {
      const bUnits = buildingUnits.get(unit.buildingid) || [];
      const lowerUnits = bUnits.filter(ou => ou.idinbuilding < unit.idinbuilding);
      const isBottomMostEmpty = lowerUnits.every(ou => ou.type !== 0);

      if (hasPlace && unit.type === 0 && isBottomMostEmpty) {
        validActions.push([1, unit.id]);
      } else if (hasReplace && unit.type !== 0) {
        validActions.push([2, unit.id]);
      }
    });
  }

  return validActions;
}

interface Transition {
  state: number[];
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
  devActorLoss: number;
  devCriticLoss: number;
  devEntropy: number;
  devReward: number;
  govActorLoss: number;
  govCriticLoss: number;
  govEntropy: number;
  govReward: number;
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
  isCancelled: () => boolean
): Promise<void> {
  // Force WebGL backend in TensorFlow.js for GPU acceleration
  if (tf.getBackend() !== 'webgl') {
    try {
      await tf.setBackend('webgl');
      console.log(`[MAPPO] Switched backend to: webgl`);
    } catch (e) {
      console.warn(`[MAPPO] Failed to switch to backend webgl:`, e);
    }
  }
  const N = graph.units.length;
  const inputSize = N * 7; // 7 features per unit: [is_empty, is_res, is_green, height, value, dev_potential, gov_influence]
  const outputSize = N + 1; // N slots + 1 SKIP

  const { developerModel, governmentModel, centralizedCriticModel } = initOrGetRLModels(inputSize, outputSize);

  // Setup optimizers for actors and the centralized critic
  const devOptimizer = tf.train.adam(learningRate);
  const govOptimizer = tf.train.adam(learningRate);
  const criticOptimizer = tf.train.adam(learningRate);

  const gamma = 0.97;  // Effective horizon ≈ 1/(1-γ) = 33 steps; covers long-range placement strategies
  const clipVal = 0.2;
  const epochs = 4; // number of PPO optimization epochs per rollout

  // Dynamic maxSteps: each player needs N/2 steps to potentially fill all units.
  // Add 50% buffer for SKIP actions and exploration → ceil(N × 1.5), minimum 150.
  const maxSteps = Math.max(150, Math.ceil(N * 1.5));

  // Pre-compute block neighbour map once — blocks are static throughout the episode.
  const neighborMap = buildNeighborMap(graph.blocks);

  // Clean starting graph JSON for stateless payloads
  const startingGraphPayload = {
    blocks: graph.blocks.map(b => ({ id: b.id, neighbor: b.neighbor, value: b.value })),
    units: graph.units.map(u => ({
      id: u.id,
      blockid: u.blockid,
      buildingid: u.buildingid,
      idinbuilding: u.idinbuilding,
      type: u.type,
      height: u.height,
      value: u.value,
      population: u.population
    })),
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

    let finalStateFeatures = encodeGraphState(episodeState, neighborMap);
    let finalDone = false;

    // On-policy rollout collection loop
    while (stepCount < maxSteps) {
      if (isCancelled()) break;

      const unitsFinished = episodeState.units.every(u => u.type !== 0);
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

      const stateFeatures = encodeGraphState(episodeState, neighborMap);
      const activePlayer = episodeState.metadata.next_player ?? PlayerType.DEVELOPER;
      if (activePlayer !== PlayerType.DEVELOPER && activePlayer !== PlayerType.GOVERNMENT) {
        throw new TypeError(`Invalid PlayerType value: ${activePlayer}`);
      }

      const actorModel = activePlayer === PlayerType.DEVELOPER ? developerModel : governmentModel;

      // Forward pass to get action logits and state value from Centralized Critic
      const { logits, stateValue } = tf.tidy(() => {
        const xs = tf.tensor2d([stateFeatures]);
        const l = actorModel.predict(xs) as tf.Tensor;
        const v = centralizedCriticModel.predict(xs) as tf.Tensor; // outputs [V_dev, V_gov]
        const vData = v.dataSync();
        return {
          logits: Array.from(l.dataSync()),
          stateValue: activePlayer === PlayerType.DEVELOPER ? vData[0] : vData[1]
        };
      });

      // Construct action mask (1 for valid, 0 for invalid)
      const mask = new Array(outputSize).fill(0);
      const validIndices = validActions.map(action => {
        const aType = action[0];
        const uId = action[1];
        let idx = N;
        if (aType !== 0 && uId !== null) {
          idx = episodeState.units.findIndex(u => u.id === uId);
          if (idx === -1) idx = N;
        }
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
      let actionIdx = N;
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
      const validTypes = episodeState.metadata.valid_type || [];
      const builtType = validTypes.length > 0 ? validTypes[0] : 0;

      const nextEpisodeState: TopologyData = tsEngine.trainingStep(
        chosenAction[0] ?? 0,
        chosenAction[1],
        builtType
      );

      const lastMetrics = episodeState.metadata.evaulate || { developer_profit: 0, government_tax: 0 };
      const nextMetrics = nextEpisodeState.metadata.evaulate || { developer_profit: 0, government_tax: 0 };

      // Reward computation
      let reward = 0;
      if (activePlayer === PlayerType.DEVELOPER) { // Developer
        reward = (nextMetrics.developer_profit - lastMetrics.developer_profit) / 1000.0;
      } else { // Government
        reward = (nextMetrics.government_tax - lastMetrics.government_tax) / 100.0;
      }

      // Penalty 1: SKIP 行为惩罚 — 鼓励 Agent 积极建设而非空过 (仅用于 developer 角色)
      const isSkip = (chosenAction[0] ?? 0) === 0;
      if (isSkip && activePlayer === PlayerType.DEVELOPER) {
        reward -= 0.05;
      }

      const nextUnitsFinished = nextEpisodeState.units.every(u => u.type !== 0);
      const nextTimerFinished = (nextEpisodeState.metadata?.timer ?? 0) >= maxSteps;
      const done = nextUnitsFinished || nextTimerFinished;

      // Penalty 2: 终局惩罚 — 若因超时结束且仍有空格，按空格比例惩罚
      if (done && nextTimerFinished && !nextUnitsFinished) {
        const totalUnits = nextEpisodeState.units.length;
        const emptyUnits = nextEpisodeState.units.filter(u => u.type === 0).length;
        const emptyRatio = totalUnits > 0 ? emptyUnits / totalUnits : 0;
        reward -= 0.5 * emptyRatio;
      }

      // Record step transition
      const transition: Transition = {
        state: stateFeatures,
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
      finalStateFeatures = encodeGraphState(episodeState, neighborMap);
      finalDone = done;
      stepCount++;
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
      const vData = tf.tidy(() => {
        const xs = tf.tensor2d([finalStateFeatures]);
        return (centralizedCriticModel.predict(xs) as tf.Tensor).dataSync();
      });
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
      devStatesTensor = tf.tensor2d(developerBuffer.map(t => t.state));
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
      govStatesTensor = tf.tensor2d(governmentBuffer.map(t => t.state));
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

          epDevActorLoss = actorLoss.dataSync()[0];
          epDevEntropy = entropy.dataSync()[0];
          return loss as tf.Scalar;
        }, true, developerModel.trainableWeights.map((w: any) => w.val));
        if (lossTensor) {
          totalEpochDevActorLoss += epDevActorLoss;
          totalEpochDevEntropy += epDevEntropy;
          lossTensor.dispose();
        }
      }

      // 2. Optimize Government Actor (Policy network)
      if (govT > 0 && govStatesTensor && govActionsTensor && govOldLogProbsTensor && govAdvantagesTensor && govMasksTensor) {
        let epGovActorLoss = 0;
        let epGovEntropy = 0;
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

          epGovActorLoss = actorLoss.dataSync()[0];
          epGovEntropy = entropy.dataSync()[0];
          return loss as tf.Scalar;
        }, true, governmentModel.trainableWeights.map((w: any) => w.val));
        if (lossTensor) {
          totalEpochGovActorLoss += epGovActorLoss;
          totalEpochGovEntropy += epGovEntropy;
          lossTensor.dispose();
        }
      }

      // 3. Optimize Centralized Critic network
      let epDevCriticLoss = 0;
      let epGovCriticLoss = 0;
      const cLossTensor = criticOptimizer.minimize(() => {
        let loss = tf.scalar(0);
        if (devT > 0 && devStatesTensor && devReturnsTensor) {
          const devPreds = centralizedCriticModel.predict(devStatesTensor!) as tf.Tensor;
          const devPredValues = tf.slice(devPreds, [0, 0], [-1, 1]); // index 0 is Developer
          const cLoss = tf.losses.meanSquaredError(devReturnsTensor!, devPredValues);
          epDevCriticLoss = cLoss.dataSync()[0];
          loss = loss.add(cLoss);
        }
        if (govT > 0 && govStatesTensor && govReturnsTensor) {
          const govPreds = centralizedCriticModel.predict(govStatesTensor!) as tf.Tensor;
          const govPredValues = tf.slice(govPreds, [0, 1], [-1, 1]); // index 1 is Government
          const cLoss = tf.losses.meanSquaredError(govReturnsTensor!, govPredValues);
          epGovCriticLoss = cLoss.dataSync()[0];
          loss = loss.add(cLoss);
        }
        return loss as tf.Scalar;
      }, true, centralizedCriticModel.trainableWeights.map((w: any) => w.val));
      if (cLossTensor) {
        totalEpochDevCriticLoss += epDevCriticLoss;
        totalEpochGovCriticLoss += epGovCriticLoss;
        cLossTensor.dispose();
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

    // Throttle React UI updates to every 10 episodes
    const shouldUpdateUI = (ep + 1) % 10 === 0 || ep === episodes - 1;
    if (shouldUpdateUI) {
      onEpisodeEnd({
        episode: ep + 1,
        avgLoss,
        devActorLoss: devMetrics.actorLoss,
        devCriticLoss,
        devEntropy: devMetrics.entropy,
        devReward,
        govActorLoss: govMetrics.actorLoss,
        govCriticLoss,
        govEntropy: govMetrics.entropy,
        govReward
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
  validActions: (number | null)[][]
): { actionType: number; unitId: number | null; predictedReward: number } | null {
  if (validActions.length === 0 || !graph.metadata?.player_order || graph.metadata.player_order.length === 0) {
    return null;
  }

  const activePlayer = graph.metadata.player_order[0];
  if (activePlayer !== PlayerType.DEVELOPER && activePlayer !== PlayerType.GOVERNMENT) {
    throw new TypeError(`Invalid PlayerType value: ${activePlayer}`);
  }
  const model = activePlayer === PlayerType.DEVELOPER ? developerRLModel : governmentRLModel;
  if (!model) {
    return null;
  }

  const neighborMap = buildNeighborMap(graph.blocks ?? []);
  const stateFeatures = encodeGraphState(graph, neighborMap);
  const logits = tf.tidy(() => {
    const xs = tf.tensor2d([stateFeatures]);
    const ys = model.predict(xs) as tf.Tensor;
    return Array.from(ys.dataSync());
  });

  const N = graph.units.length;
  let bestAction: (number | null)[] | null = null;
  let maxLogit = -Infinity;

  for (const action of validActions) {
    const actionType = action[0];
    const unitId = action[1];

    let actionIdx = N;
    if (actionType !== 0 && unitId !== null) {
      actionIdx = graph.units.findIndex(u => u.id === unitId);
      if (actionIdx === -1) actionIdx = N;
    }

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
  if (!developerRLModel || !governmentRLModel) {
    throw new Error("No trained RL models found to save. Please train the model first!");
  }

  const artifactsHolder = {
    dev: null as tf.io.ModelArtifacts | null,
    gov: null as tf.io.ModelArtifacts | null
  };

  await developerRLModel.save({
    save: async (artifacts) => {
      artifactsHolder.dev = artifacts;
      return { modelArtifactsInfo: { dateSaved: new Date(), modelTopologyType: 'JSON' } };
    }
  });

  await governmentRLModel.save({
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

  developerRLModel = devModel;
  governmentRLModel = govModel;

  const inputSize = devModel.inputs[0].shape[1] || 100;

  // Re-initialize Centralized Critic network
  const critic = tf.sequential();
  critic.add(tf.layers.dense({ inputShape: [inputSize], units: 64, activation: 'relu' }));
  critic.add(tf.layers.dense({ units: 32, activation: 'relu' }));
  critic.add(tf.layers.dense({ units: 2 })); // 2 outputs: [V_dev, V_gov]
  centralizedCriticModel = critic;
}
