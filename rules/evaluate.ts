export interface FaceState {
  is_occupied: boolean;
  built_type: string;
  height_floors: number;
  value?: number;
  population?: number;
}

export interface FaceEvaluation {
  score: number;
}

export interface Face {
  id: number;
  neighbors: number[];
  boundary_polyline: number[][]; // [ [x, y, z], ... ]
  state: FaceState;
  evaluation: FaceEvaluation;
}

export interface TopologyMetadata {
  map_id: string;
  total_faces: number;
}

export interface TopologyData {
  metadata: TopologyMetadata;
  faces: Face[];
}

export interface EvaluationResult {
  faces: Face[];
  government_tax: number;
  developer_profit: number;
  total_population: number;
}

/**
 * Evaluates the urban economy metrics for the given faces.
 * Ported from evaluate.py to frontend rules.
 */
export function evaluateUrbanEconomy(faces: Face[]): EvaluationResult {
  // 1. Create a map for fast lookup of faces by ID
  const faceMap = new Map<number, Face>();
  
  // Clone the faces to prevent modifying the inputs in-place directly
  const clonedFaces: Face[] = faces.map(f => ({
    ...f,
    state: {
      ...f.state,
      value: f.state.value ?? 0,
      population: f.state.population ?? 0,
    },
    evaluation: {
      ...f.evaluation,
      score: f.evaluation?.score ?? 0,
    }
  }));

  for (const face of clonedFaces) {
    faceMap.set(face.id, face);
  }

  // 2. 第一步：计算所有住宅的价值 (Value)
  for (const face of clonedFaces) {
    if (face.state.built_type !== 'residential') {
      continue;
    }

    let value = 40; // 基础价值基准分

    // 扫描邻居
    for (const neighborId of face.neighbors) {
      const neighbor = faceMap.get(neighborId);
      if (neighbor) {
        const neighborType = neighbor.state.built_type;
        if (neighborType === 'park' || neighborType === 'greenway' || neighborType === 'green') {
          value += 25; // 绿地大幅加分
        } else if (neighborType === 'residential') {
          value -= 5;  // 住宅扎堆，产生拥挤负效应
        }
      }
    }

    // 限制在10-100分
    face.state.value = Math.max(10, Math.min(100, value));
  }

  // 3. 第二步：根据正态分布计算入住人口 (Population)
  const mu = 60;       // 人口最喜欢的黄金房价点
  const sigma = 20;    // 敏感度系数
  const P_max = 150;   // 单个格子最大承载人口

  let totalCityPopulation = 0;
  let totalDeveloperProfit = 0;

  for (const face of clonedFaces) {
    if (face.state.built_type === 'residential') {
      const v = face.state.value ?? 0;
      
      // 高斯/正态分布公式
      const pop = P_max * Math.exp(-Math.pow(v - mu, 2) / (2 * Math.pow(sigma, 2)));
      const roundedPop = Math.round(pop);

      face.state.population = roundedPop;
      face.evaluation.score = v; // 把价值作为前端显示的得分

      // 累计数据
      totalCityPopulation += roundedPop;
      totalDeveloperProfit += roundedPop * v;
    } else {
      // Reset non-residential values
      face.state.value = 0;
      face.state.population = 0;
      face.evaluation.score = 0;
    }
  }

  // 4. 第三步：计算政府总税收
  const taxRate = 0.5;
  const totalGovernmentTax = Math.round(totalCityPopulation * taxRate);

  return {
    faces: clonedFaces,
    government_tax: totalGovernmentTax,
    developer_profit: totalDeveloperProfit,
    total_population: totalCityPopulation
  };
}
