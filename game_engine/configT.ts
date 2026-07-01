/**
 * Training Configurations (configT.ts)
 * 包含强化学习、GNN 模型及训练的相关参数
 */

// 与前端 UI 交互的默认训练参数
export const DEFAULT_EPISODES = 100;
export const DEFAULT_LEARNING_RATE = 0.001;
export const UI_UPDATE_INTERVAL = 1;

// 神经网络及特征维度参数
export const GNN_INPUT_FEATURES = 8;

// 特征向量编码中的常数
export const FEATURE_NORM_ID = 10.0;
export const FEATURE_NORM_VALUE = 100.0;
export const FEATURE_NORM_DEV_GAIN = 50000.0;
export const FEATURE_NORM_GOV_GAIN = 10000.0;
export const FEATURE_NORM_VOLUME = 1000.0; // 体积归一化常数

// PPO 强化学习参数
export const PPO_GAMMA = 0.97;
export const PPO_CLIP_VAL = 0.2;
export const PPO_EPOCHS = 4;

// 强化学习博弈补偿与罚则
export const PLACE_INCENTIVE = 0.25;
export const SKIP_PENALTY = 0.5;

import * as tf from '@tensorflow/tfjs';
import { PlayerType, PlayerConfig } from './configE';
import { getUnitVolume } from './function';

/**
 * 提取单个 Unit 节点的特征向量
 */
export function setFeature(
  u: any,
  devGain: number,
  govGain: number,
  v: number
): number[] {
  const type = u.state.type;
  const idInBuilding = Number(u.topology.idinbuilding ?? 0);
  const volume = getUnitVolume(u);

  // 1. 归一化开发商潜在利润 (直接使用外部计算好的 evaluate 增量)
  const normDevGain = Math.min(1, devGain / FEATURE_NORM_DEV_GAIN);

  // 2. 归一化政府公共税收及影响增益 (直接使用外部计算好的 evaluate 增量)
  const normGovGain = Math.min(1, govGain / FEATURE_NORM_GOV_GAIN);

  // 3. 构建并统一返回 8 维特征向量列表
  return [
    type === 0 ? 1 : 0,                 // [1] 是否为空置状态 (One-Hot)
    type === 1 ? 1 : 0,                 // [2] 是否为住宅状态 (One-Hot)
    type === 2 ? 1 : 0,                 // [3] 是否为绿地状态 (One-Hot)
    volume / FEATURE_NORM_VOLUME,       // [4] 体积归一化 (用 volume 替代原本的总高度特征)
    idInBuilding / FEATURE_NORM_ID,     // [5] 所处楼宇内的楼层索引位置 (垂直相对高度)
    v / FEATURE_NORM_VALUE,             // [6] 土地评估价值归一化
    normDevGain,                        // [7] 开发商相对开发收益
    normGovGain,                        // [8] 政府相对公共收益贡献
  ];
}

// 动态计算出所有合法的可建造 UnitType 列表
export const buildableTypes = Array.from(
  new Set(
    Object.values(PlayerConfig).flatMap(p => p.allowed_types)
  )
).sort((a, b) => a - b);

// 强化学习持久化 Actor 模型列表 (由 PlayerType 动态索引映射)
export const actorModels = new Map<PlayerType, tf.LayersModel>();
export let centralizedCriticModel: tf.LayersModel | null = null;

/**
 * 通用方法：创建单个 Actor 神经网络模型
 */
export function createActorModel(inputSize: number, outputSize: number): tf.LayersModel {
  const featuresInput = tf.input({ shape: [inputSize], name: 'state_features' });

  const dense1 = tf.layers.dense({ units: 64, activation: 'relu' }).apply(featuresInput) as tf.SymbolicTensor;
  const dense2 = tf.layers.dense({ units: 32, activation: 'relu' }).apply(dense1) as tf.SymbolicTensor;
  const output = tf.layers.dense({ units: outputSize }).apply(dense2) as tf.SymbolicTensor;

  return tf.model({ inputs: featuresInput, outputs: output });
}

/**
 * 通用方法：创建 Centralized Critic 神经网络模型
 */
export function createCriticModel(inputSize: number): tf.LayersModel {
  const featuresInput = tf.input({ shape: [inputSize], name: 'state_features' });

  const dense1 = tf.layers.dense({ units: 64, activation: 'relu' }).apply(featuresInput) as tf.SymbolicTensor;
  const dense2 = tf.layers.dense({ units: 32, activation: 'relu' }).apply(dense1) as tf.SymbolicTensor;
  const output = tf.layers.dense({ units: 2 }).apply(dense2) as tf.SymbolicTensor;

  return tf.model({ inputs: featuresInput, outputs: output });
}

/**
 * 初始化或获取已存在的强化学习模型及评判网络 (支持多角色动态映射)
 */
export function initOrGetRLModels(inputSize: number, outputSize: number): {
  actors: Map<PlayerType, tf.LayersModel>;
  centralizedCriticModel: tf.LayersModel;
} {
  // 从引擎设置 PlayerConfig 中动态获取所有角色类型
  const playerTypes = Object.keys(PlayerConfig).map(Number) as PlayerType[];

  for (const playerType of playerTypes) {
    let needsRebuild = false;
    const existingModel = actorModels.get(playerType);
    if (existingModel) {
      const expectedShape = existingModel.inputs[0].shape[1];
      if (expectedShape !== inputSize) {
        console.log(`[MAPPO] Map size change detected (expected Actor shape: ${expectedShape}, current inputSize: ${inputSize}). Rebuilding actor models...`);
        needsRebuild = true;
      }
    }

    if (existingModel && !needsRebuild) {
      console.log(`[MAPPO] Reusing existing loaded/trained Player Actor model: ${PlayerConfig[playerType].name}`);
    } else {
      console.log(`[MAPPO] Initializing new Player Actor model: ${PlayerConfig[playerType].name}`);
      const model = createActorModel(inputSize, outputSize);
      actorModels.set(playerType, model);
    }
  }

  let criticNeedsRebuild = false;
  if (centralizedCriticModel) {
    const expectedCriticShape = centralizedCriticModel.inputs[0].shape[1];
    if (expectedCriticShape !== inputSize) {
      console.log(`[MAPPO] Map size change detected (expected Critic shape: ${expectedCriticShape}, current inputSize: ${inputSize}). Rebuilding critic model...`);
      criticNeedsRebuild = true;
    }
  }

  if (centralizedCriticModel && !criticNeedsRebuild) {
    console.log("[MAPPO] Reusing existing loaded/trained Centralized Critic model.");
  } else {
    console.log("[MAPPO] Initializing new Centralized Critic model.");
    centralizedCriticModel = createCriticModel(inputSize);
  }

  return {
    actors: actorModels,
    centralizedCriticModel: centralizedCriticModel
  };
}

/**
 * 重置持久化模型缓存状态
 */
export function resetRLModels() {
  actorModels.clear();
  centralizedCriticModel = null;
}

/**
 * 为指定角色设置 Actor 模型
 */
export function setActorModel(playerType: PlayerType, model: tf.LayersModel | null) {
  if (model) {
    actorModels.set(playerType, model);
  } else {
    actorModels.delete(playerType);
  }
}

/**
 * 设置 Centralized Critic 模型
 */
export function setCentralizedCriticModel(model: tf.LayersModel | null) {
  centralizedCriticModel = model;
}
