import * as tf from '@tensorflow/tfjs';
import { pyodideEngine } from './pyodideEngine';

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
 * Encodes the graph state into a flat array of features for TF.js.
 */
export function encodeGraphState(graph: TopologyData): number[] {
  const features: number[] = [];
  for (const u of graph.units) {
    features.push(u.type === 0 ? 1 : 0); // Empty
    features.push(u.type === 1 ? 1 : 0); // Residential
    features.push(u.type === 2 ? 1 : 0); // Green
    features.push((u.height ?? 1) / 10.0);
  }
  return features;
}

// Global persistent tfjs model variables for PPO (Actor and Critic networks)
export let developerRLModel: tf.LayersModel | null = null;       // Actor
export let developerCriticModel: tf.LayersModel | null = null;   // Critic
export let governmentRLModel: tf.LayersModel | null = null;      // Actor
export let governmentCriticModel: tf.LayersModel | null = null;  // Critic

/**
 * Initializes or retrieves existing persistent RL Actor and Critic models.
 */
export function initOrGetRLModels(inputSize: number, outputSize: number): {
  developerModel: tf.LayersModel;
  developerCriticModel: tf.LayersModel;
  governmentModel: tf.LayersModel;
  governmentCriticModel: tf.LayersModel;
} {
  if (developerRLModel) {
    console.log("[PPO] Reusing existing loaded/trained Developer Actor model.");
  } else {
    console.log("[PPO] Initializing new Developer Actor & Critic models.");
  }
  if (governmentRLModel) {
    console.log("[PPO] Reusing existing loaded/trained Government Actor model.");
  } else {
    console.log("[PPO] Initializing new Government Actor & Critic models.");
  }

  if (!developerRLModel) {
    // Developer Actor (Policy network)
    const actor = tf.sequential();
    actor.add(tf.layers.dense({ inputShape: [inputSize], units: 64, activation: 'relu' }));
    actor.add(tf.layers.dense({ units: 32, activation: 'relu' }));
    actor.add(tf.layers.dense({ units: outputSize })); // Logits output (linear)
    developerRLModel = actor;

    // Developer Critic (State-Value network)
    const critic = tf.sequential();
    critic.add(tf.layers.dense({ inputShape: [inputSize], units: 64, activation: 'relu' }));
    critic.add(tf.layers.dense({ units: 32, activation: 'relu' }));
    critic.add(tf.layers.dense({ units: 1 })); // State-value scalar output
    developerCriticModel = critic;
  }

  if (!governmentRLModel) {
    // Government Actor (Policy network)
    const actor = tf.sequential();
    actor.add(tf.layers.dense({ inputShape: [inputSize], units: 64, activation: 'relu' }));
    actor.add(tf.layers.dense({ units: 32, activation: 'relu' }));
    actor.add(tf.layers.dense({ units: outputSize })); // Logits output (linear)
    governmentRLModel = actor;

    // Government Critic (State-Value network)
    const critic = tf.sequential();
    critic.add(tf.layers.dense({ inputShape: [inputSize], units: 64, activation: 'relu' }));
    critic.add(tf.layers.dense({ units: 32, activation: 'relu' }));
    critic.add(tf.layers.dense({ units: 1 })); // State-value scalar output
    governmentCriticModel = critic;
  }

  return {
    developerModel: developerRLModel,
    developerCriticModel: developerCriticModel!,
    governmentModel: governmentRLModel,
    governmentCriticModel: governmentCriticModel!
  };
}

/**
 * Clears both in-memory model instances and deletes any legacy models from browser IndexedDB.
 */
export async function clearAllCachedModels(): Promise<void> {
  developerRLModel = null;
  developerCriticModel = null;
  governmentRLModel = null;
  governmentCriticModel = null;

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

/**
 * Reconstructs valid actions list for a role in JS.
 */
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
    units.forEach((unit: any) => {
      if (hasPlace && unit.type === 0) {
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
  const N = graph.units.length;
  const inputSize = N * 4;
  const outputSize = N + 1; // N slots + 1 SKIP

  const { developerModel, developerCriticModel, governmentModel, governmentCriticModel } = initOrGetRLModels(inputSize, outputSize);

  // Setup optimizers for both agents
  const devOptimizer = tf.train.adam(learningRate);
  const govOptimizer = tf.train.adam(learningRate);

  const gamma = 0.90;
  const clipVal = 0.2;
  const epochs = 4; // number of PPO optimization epochs per rollout
  const maxSteps = 100;

  // Clean starting graph JSON for stateless payloads
  const startingGraphPayload = {
    blocks: graph.blocks.map(b => ({ id: b.id, neighbor: b.neighbor })),
    units: graph.units.map(u => ({ id: u.id, parentid: u.parentid, type: u.type, height: u.height, value: u.value, population: u.population })),
    metadata: { timer: 0, game_started: false }
  };

  for (let ep = 0; ep < episodes; ep++) {
    if (isCancelled()) break;

    // Trajectory buffers
    const developerBuffer: Transition[] = [];
    const governmentBuffer: Transition[] = [];

    // 1. Call training start on backend
    let episodeState: TopologyData = pyodideEngine.trainingStart({
      graph: startingGraphPayload,
      player_order: [1, 2]
    });
    let stepCount = 0;

    let finalStateFeatures = encodeGraphState(episodeState);
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

      const stateFeatures = encodeGraphState(episodeState);
      const activePlayer = episodeState.metadata.next_player ?? 1;

      const actorModel = activePlayer === 1 ? developerModel : governmentModel;
      const criticModel = activePlayer === 1 ? developerCriticModel : governmentCriticModel;

      // Forward pass to get action logits and state value
      const { logits, stateValue } = tf.tidy(() => {
        const xs = tf.tensor2d([stateFeatures]);
        const l = actorModel.predict(xs) as tf.Tensor;
        const v = criticModel.predict(xs) as tf.Tensor;
        return {
          logits: Array.from(l.dataSync()),
          stateValue: v.dataSync()[0]
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

      const nextEpisodeState: TopologyData = pyodideEngine.trainingStep(
        chosenAction[0] ?? 0,
        chosenAction[1],
        builtType
      );

      const lastMetrics = episodeState.metadata.evaulate || { developer_profit: 0, government_tax: 0 };
      const nextMetrics = nextEpisodeState.metadata.evaulate || { developer_profit: 0, government_tax: 0 };

      // Reward computation
      let reward = 0;
      if (activePlayer === 1) { // Developer
        reward = (nextMetrics.developer_profit - lastMetrics.developer_profit) / 1000.0;
      } else { // Government
        reward = (nextMetrics.government_tax - lastMetrics.government_tax) / 100.0;
      }

      const nextUnitsFinished = nextEpisodeState.units.every(u => u.type !== 0);
      const nextTimerFinished = (nextEpisodeState.metadata?.timer ?? 0) >= maxSteps;
      const done = nextUnitsFinished || nextTimerFinished;

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

      if (activePlayer === 1) {
        developerBuffer.push(transition);
      } else {
        governmentBuffer.push(transition);
      }

      episodeState = nextEpisodeState;
      finalStateFeatures = encodeGraphState(episodeState);
      finalDone = done;
      stepCount++;
    }

    if (isCancelled()) break;

    // 2. Perform policy and value gradient optimization using trajectory buffers
    interface OptimizationMetrics {
      avgLoss: number;
      actorLoss: number;
      criticLoss: number;
      entropy: number;
    }

    const optimizeAgent = async (
      actorModel: tf.LayersModel,
      criticModel: tf.LayersModel,
      optimizer: tf.Optimizer,
      buffer: Transition[],
      lastStateFeatures: number[],
      done: boolean
    ): Promise<OptimizationMetrics> => {
      if (buffer.length === 0) {
        return { avgLoss: 0, actorLoss: 0, criticLoss: 0, entropy: 0 };
      }

      const T = buffer.length;
      const returns: number[][] = new Array(T);
      const advantages: number[] = new Array(T);

      // Bootstrap value for terminal/non-terminal states
      let nextVal = 0;
      if (!done) {
        nextVal = tf.tidy(() => {
          const xs = tf.tensor2d([lastStateFeatures]);
          return (criticModel.predict(xs) as tf.Tensor).dataSync()[0];
        });
      }

      let G = nextVal;
      for (let t = T - 1; t >= 0; t--) {
        G = buffer[t].reward + gamma * G;
        returns[t] = [G];
        advantages[t] = G - buffer[t].value;
      }

      // Standardize advantages
      const mean = advantages.reduce((a, b) => a + b, 0) / T;
      const variance = advantages.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / T;
      const std = Math.sqrt(variance) + 1e-8;
      const normalizedAdvantages = advantages.map(a => (a - mean) / std);

      // Prepare training tensors
      const statesTensor = tf.tensor2d(buffer.map(t => t.state));
      const actionsTensor = tf.tensor1d(buffer.map(t => t.actionIdx), 'int32');
      const oldLogProbsTensor = tf.tensor1d(buffer.map(t => t.oldLogProb));
      const returnsTensor = tf.tensor2d(returns);
      const advantagesTensor = tf.tensor1d(normalizedAdvantages);
      const masksTensor = tf.tensor2d(buffer.map(t => t.mask));

      let totalEpochLoss = 0;
      let totalActorLoss = 0;
      let totalCriticLoss = 0;
      let totalEntropy = 0;

      for (let epoch = 0; epoch < epochs; epoch++) {
        let epochActorLoss = 0;
        let epochCriticLoss = 0;
        let epochEntropy = 0;

        const lossTensor = optimizer.minimize(() => {
          const logits = actorModel.predict(statesTensor) as tf.Tensor;
          const values = criticModel.predict(statesTensor) as tf.Tensor;

          // Mask invalid action logits to -1e9
          const maskedLogits = tf.where(masksTensor.greater(0), logits, tf.fill(logits.shape, -1e9));
          const probs = tf.softmax(maskedLogits);

          // Get action probability and log probability
          const newProbs = tf.sum(probs.mul(tf.oneHot(actionsTensor, outputSize)), 1);
          const newLogProbs = tf.log(newProbs.add(1e-8));

          // Ratio
          const ratio = tf.exp(newLogProbs.sub(oldLogProbsTensor));

          // Clipped policy loss
          const surr1 = ratio.mul(advantagesTensor);
          const surr2 = tf.clipByValue(ratio, 1.0 - clipVal, 1.0 + clipVal).mul(advantagesTensor);
          const actorLoss = tf.mean(tf.minimum(surr1, surr2)).neg();

          // Critic value loss (MSE)
          const criticLoss = tf.losses.meanSquaredError(returnsTensor, values);

          // Entropy regularization bonus
          const entropy = tf.mean(tf.sum(probs.mul(tf.log(probs.add(1e-8))).neg(), 1));

          // Joint loss: actorLoss + 0.5 * criticLoss - 0.01 * entropy
          const loss = actorLoss.add(criticLoss.mul(0.5)).sub(entropy.mul(0.01));

          // Extract values synchronously for display
          epochActorLoss = actorLoss.dataSync()[0];
          epochCriticLoss = criticLoss.dataSync()[0];
          epochEntropy = entropy.dataSync()[0];

          return loss as tf.Scalar;
        }, true, [
          ...actorModel.trainableWeights.map((w: any) => w.val),
          ...criticModel.trainableWeights.map((w: any) => w.val)
        ]);

        if (lossTensor) {
          totalEpochLoss += lossTensor.dataSync()[0];
          lossTensor.dispose();
        }

        totalActorLoss += epochActorLoss;
        totalCriticLoss += epochCriticLoss;
        totalEntropy += epochEntropy;
      }

      // Dispose epoch-level batch tensors
      statesTensor.dispose();
      actionsTensor.dispose();
      oldLogProbsTensor.dispose();
      returnsTensor.dispose();
      advantagesTensor.dispose();
      masksTensor.dispose();

      return {
        avgLoss: totalEpochLoss / epochs,
        actorLoss: totalActorLoss / epochs,
        criticLoss: totalCriticLoss / epochs,
        entropy: totalEntropy / epochs
      };
    };

    const devReward = developerBuffer.reduce((sum, t) => sum + t.reward, 0);
    const govReward = governmentBuffer.reduce((sum, t) => sum + t.reward, 0);

    let devMetrics = { avgLoss: 0, actorLoss: 0, criticLoss: 0, entropy: 0 };
    let govMetrics = { avgLoss: 0, actorLoss: 0, criticLoss: 0, entropy: 0 };

    if (developerBuffer.length > 0) {
      devMetrics = await optimizeAgent(developerModel, developerCriticModel, devOptimizer, developerBuffer, finalStateFeatures, finalDone);
    }
    if (governmentBuffer.length > 0) {
      govMetrics = await optimizeAgent(governmentModel, governmentCriticModel, govOptimizer, governmentBuffer, finalStateFeatures, finalDone);
    }

    const avgLoss = (devMetrics.avgLoss + govMetrics.avgLoss) / 2;
    onEpisodeEnd({
      episode: ep + 1,
      avgLoss,
      devActorLoss: devMetrics.actorLoss,
      devCriticLoss: devMetrics.criticLoss,
      devEntropy: devMetrics.entropy,
      devReward,
      govActorLoss: govMetrics.actorLoss,
      govCriticLoss: govMetrics.criticLoss,
      govEntropy: govMetrics.entropy,
      govReward
    });

    // Yield control back to browser thread
    await tf.nextFrame();
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
  const model = activePlayer === 1 ? developerRLModel : governmentRLModel;
  if (!model) {
    return null;
  }

  const stateFeatures = encodeGraphState(graph);
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
  a.download = 'urban-ppo-models.json';
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

  // Re-initialize Developer Critic network
  const devCritic = tf.sequential();
  devCritic.add(tf.layers.dense({ inputShape: [inputSize], units: 64, activation: 'relu' }));
  devCritic.add(tf.layers.dense({ units: 32, activation: 'relu' }));
  devCritic.add(tf.layers.dense({ units: 1 }));
  developerCriticModel = devCritic;

  // Re-initialize Government Critic network
  const govCritic = tf.sequential();
  govCritic.add(tf.layers.dense({ inputShape: [inputSize], units: 64, activation: 'relu' }));
  govCritic.add(tf.layers.dense({ units: 32, activation: 'relu' }));
  govCritic.add(tf.layers.dense({ units: 1 }));
  governmentCriticModel = govCritic;
}
